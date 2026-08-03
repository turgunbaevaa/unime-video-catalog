"""
Full-catalog JSON backup / restore helpers.

Safe restore uses staging + live snapshot collections so validation failures
never wipe the live DB, and mid-restore failures can roll back.

Backup versions:
  - v1: folders + videos (current export)
  - v2: accepted on import for older files; only folders + videos are restored
Legacy plain video arrays remain supported.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException

from app.database import database, folders_collection, videos_collection

BACKUP_FORMAT = "unime-video-catalog-backup"
BACKUP_VERSION = 1
SUPPORTED_BACKUP_VERSIONS = {1, 2}

STAGING_FOLDERS = "_backup_staging_folders"
STAGING_VIDEOS = "_backup_staging_videos"
SNAPSHOT_FOLDERS = "_backup_snapshot_folders"
SNAPSHOT_VIDEOS = "_backup_snapshot_videos"

# Soft ceiling for catalog size in this project stage
MAX_DOCUMENTS_PER_COLLECTION = 100_000


def _serialize_value(value: Any) -> Any:
    """Convert Mongo values into JSON-safe types (ISO datetimes, string ObjectIds)."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        # Preserve timezone-aware values; naive → assume UTC for stable round-trip
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc).isoformat()
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _serialize_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    return value


def _parse_datetime_string(value: str) -> datetime | None:
    """Parse ISO or legacy str(datetime) strings used by older default=str exports."""
    text = value.strip()
    if not text:
        return None
    try:
        # Support trailing Z
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        pass
    for fmt in (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _deserialize_value(value: Any) -> Any:
    """Restore datetimes from ISO/legacy strings; leave ObjectId refs as strings."""
    if isinstance(value, dict):
        return {key: _deserialize_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_deserialize_value(item) for item in value]
    if isinstance(value, str):
        # Heuristic: only parse strings that look like datetimes
        if len(value) >= 19 and value[4] == "-" and value[7] == "-":
            parsed = _parse_datetime_string(value)
            if parsed is not None:
                return parsed
    return value


def _serialize_documents(docs: list[dict]) -> list[dict]:
    return [_serialize_value(doc) for doc in docs]


async def build_backup_payload() -> dict[str, Any]:
    folders = await folders_collection.find().to_list(MAX_DOCUMENTS_PER_COLLECTION)
    videos = await videos_collection.find().to_list(MAX_DOCUMENTS_PER_COLLECTION)

    return {
        "format": BACKUP_FORMAT,
        "version": BACKUP_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "collections": {
            "folders": _serialize_documents(folders),
            "videos": _serialize_documents(videos),
        },
    }


def _require_object_id(value: Any, *, context: str) -> ObjectId:
    if not isinstance(value, str) or not value.strip():
        raise HTTPException(
            status_code=400,
            detail=f"Invalid _id in {context}: expected non-empty string ObjectId.",
        )
    try:
        return ObjectId(value)
    except InvalidId as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid _id in {context}: {value!r} is not a valid ObjectId.",
        ) from exc


def _prepare_collection_docs(
    docs: Any,
    *,
    collection_name: str,
) -> list[dict]:
    if not isinstance(docs, list):
        raise HTTPException(
            status_code=400,
            detail=f"collections.{collection_name} must be a JSON array.",
        )
    if len(docs) > MAX_DOCUMENTS_PER_COLLECTION:
        raise HTTPException(
            status_code=400,
            detail=(
                f"collections.{collection_name} exceeds the maximum of "
                f"{MAX_DOCUMENTS_PER_COLLECTION} documents."
            ),
        )

    prepared: list[dict] = []
    seen_ids: set[str] = set()

    for index, raw in enumerate(docs):
        if not isinstance(raw, dict):
            raise HTTPException(
                status_code=400,
                detail=f"collections.{collection_name}[{index}] must be an object.",
            )
        if "_id" not in raw:
            raise HTTPException(
                status_code=400,
                detail=f"collections.{collection_name}[{index}] is missing _id.",
            )

        object_id = _require_object_id(
            raw["_id"],
            context=f"collections.{collection_name}[{index}]",
        )
        id_str = str(object_id)
        if id_str in seen_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate _id in collections.{collection_name}: {id_str}",
            )
        seen_ids.add(id_str)

        item = _deserialize_value(dict(raw))
        item["_id"] = object_id
        prepared.append(item)

    return prepared


def parse_and_validate_backup(data: Any) -> tuple[list[dict], list[dict]]:
    """
    Validate backup JSON and return (folders, videos) with ObjectId _id values.
    Supports:
      - versioned envelope v1 / v2 (folders + videos restored; any other keys ignored)
      - legacy plain array of videos (folders empty)
    """
    if isinstance(data, list):
        # Legacy format from older exports (videos only)
        videos = _prepare_collection_docs(data, collection_name="videos")
        return [], videos

    if not isinstance(data, dict):
        raise HTTPException(
            status_code=400,
            detail="Invalid backup: expected a JSON object or a legacy videos array.",
        )

    fmt = data.get("format")
    version = data.get("version")
    collections = data.get("collections")

    if fmt != BACKUP_FORMAT:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid backup format: expected {BACKUP_FORMAT!r}, "
                f"got {fmt!r}."
            ),
        )

    if version not in SUPPORTED_BACKUP_VERSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported backup version: expected one of "
                f"{sorted(SUPPORTED_BACKUP_VERSIONS)}, got {version!r}."
            ),
        )

    if not isinstance(collections, dict):
        raise HTTPException(
            status_code=400,
            detail="Invalid backup: 'collections' must be an object.",
        )

    if "folders" not in collections or "videos" not in collections:
        raise HTTPException(
            status_code=400,
            detail="Invalid backup: collections must include 'folders' and 'videos'.",
        )

    folders = _prepare_collection_docs(
        collections["folders"], collection_name="folders"
    )
    videos = _prepare_collection_docs(
        collections["videos"], collection_name="videos"
    )
    return folders, videos


async def _replace_collection(target_name: str, documents: list[dict]) -> None:
    collection = database.get_collection(target_name)
    await collection.delete_many({})
    if documents:
        await collection.insert_many(documents)


async def _copy_collection(source_name: str, dest_name: str) -> None:
    source = database.get_collection(source_name)
    dest = database.get_collection(dest_name)
    await dest.delete_many({})
    docs = await source.find().to_list(MAX_DOCUMENTS_PER_COLLECTION)
    if docs:
        await dest.insert_many(docs)


async def _drop_temp_collections() -> None:
    for name in (
        STAGING_FOLDERS,
        STAGING_VIDEOS,
        SNAPSHOT_FOLDERS,
        SNAPSHOT_VIDEOS,
    ):
        await database.drop_collection(name)


async def restore_backup_collections(
    folders: list[dict],
    videos: list[dict],
) -> dict[str, int]:
    """
    Atomically-enough replace live folders + videos.
    Validates must already have succeeded before calling this.
    """
    await _drop_temp_collections()

    try:
        # 1) Stage incoming data
        await _replace_collection(STAGING_FOLDERS, folders)
        await _replace_collection(STAGING_VIDEOS, videos)

        # 2) Snapshot current live data for rollback
        await _copy_collection("folders", SNAPSHOT_FOLDERS)
        await _copy_collection("videos", SNAPSHOT_VIDEOS)

        # 3) Apply staged data to live collections
        try:
            staged_folders = (
                await database.get_collection(STAGING_FOLDERS)
                .find()
                .to_list(MAX_DOCUMENTS_PER_COLLECTION)
            )
            staged_videos = (
                await database.get_collection(STAGING_VIDEOS)
                .find()
                .to_list(MAX_DOCUMENTS_PER_COLLECTION)
            )
            await _replace_collection("folders", staged_folders)
            await _replace_collection("videos", staged_videos)
        except Exception as apply_error:
            # Rollback live collections from snapshot
            snapshot_folders = (
                await database.get_collection(SNAPSHOT_FOLDERS)
                .find()
                .to_list(MAX_DOCUMENTS_PER_COLLECTION)
            )
            snapshot_videos = (
                await database.get_collection(SNAPSHOT_VIDEOS)
                .find()
                .to_list(MAX_DOCUMENTS_PER_COLLECTION)
            )
            await _replace_collection("folders", snapshot_folders)
            await _replace_collection("videos", snapshot_videos)
            raise HTTPException(
                status_code=500,
                detail=f"Restore failed and was rolled back: {apply_error}",
            ) from apply_error

        return {
            "folders": len(folders),
            "videos": len(videos),
        }
    finally:
        await _drop_temp_collections()


async def restore_from_upload_bytes(content: bytes) -> dict[str, Any]:
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid JSON: {exc.msg}",
        ) from exc

    folders, videos = parse_and_validate_backup(data)
    counts = await restore_backup_collections(folders, videos)

    return {
        "message": (
            f"Successfully restored {counts['folders']} folders "
            f"and {counts['videos']} videos."
        ),
        "folders_restored": counts["folders"],
        "videos_restored": counts["videos"],
    }
