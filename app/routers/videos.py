from fastapi import APIRouter, HTTPException, status, Query, Request, Depends
from typing import Optional, Any, List
from app.models.video import (
    VideoCreate,
    VideoResponse,
    VideoUpdate,
    PaginatedVideoList,
    VideoBulkCreate,
    VideoBulkResponse,
    VideoBulkItemResult,
    VideoBulkSummary,
)
from app.database import videos_collection, folders_collection
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
from urllib.parse import urlparse, unquote
import re

router = APIRouter(
    prefix="/api/v1/videos",
    tags=["Videos"]
)

ALLOWED_VIDEO_SORTS = {
    "created_at_desc": {"created_at": -1},
    "created_at_asc": {"created_at": 1},
    "title_asc": {"title": 1},
    "title_desc": {"title": -1},
}

MAX_BULK_URLS = 200


def _to_object_id(video_id: str) -> ObjectId:
    try:
        return ObjectId(video_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid video id")


async def _touch_folder(folder_id: Optional[str]) -> None:
    """Bump folder updated_at when videos are added or moved (best-effort)."""
    if not folder_id:
        return
    try:
        await folders_collection.update_one(
            {"_id": ObjectId(folder_id)},
            {"$set": {"updated_at": datetime.utcnow()}},
        )
    except Exception:
        # Invalid folder id or missing folder must not block video writes
        pass


_MEDIA_EXTENSIONS = {
    "mp4", "mov", "mkv", "avi", "wmv", "webm", "m4v", "mpg", "mpeg",
    "mp3", "wav", "m4a", "aac", "flac", "m3u8", "ts",
}

_TITLE_ACRONYMS = {
    "ai", "ml", "nlp", "api", "gpu", "cpu", "ui", "ux", "sql", "db", "iot", "vr", "ar", "os",
}


def _is_opaque_filename(name: str) -> bool:
    """True when the basename looks like a GUID/UUID/hash with no words."""
    cleaned = re.sub(r"[\s\-_]", "", name)
    if len(cleaned) < 16:
        return False
    return bool(re.fullmatch(r"[0-9a-fA-F]+", cleaned))


def _humanize_filename_title(name: str) -> str:
    """
    Turn a file basename into a clean catalog title.
    lecture_01 / introduction-to-ai → Lecture 01 / Introduction To AI
    """
    name = re.sub(r"[-_]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    if not name:
        return "Untitled video"

    if _is_opaque_filename(name):
        return "Untitled video"

    words: List[str] = []
    for raw in name.split(" "):
        if not raw:
            continue
        if raw.isdigit():
            words.append(raw)
            continue
        lower = raw.lower()
        if lower in _TITLE_ACRONYMS:
            words.append(lower.upper())
        else:
            words.append(lower[:1].upper() + lower[1:])

    title = " ".join(words).strip()
    if len(title) < 3:
        return f"Video {title}".strip() if title else "Untitled video"
    return title[:200]


def _title_from_url(url: str) -> str:
    """Derive a human-readable title from the URL path filename when no other metadata exists."""
    parsed = urlparse(url)
    path = unquote(parsed.path or "").rstrip("/")
    name = path.split("/")[-1] if path else ""

    # Strip only known media extensions (.mp4, .mov, …)
    if "." in name and not name.startswith("."):
        base, ext = name.rsplit(".", 1)
        if ext.lower() in _MEDIA_EXTENSIONS:
            name = base

    if not name:
        return "Untitled video"

    return _humanize_filename_title(name)


def _normalize_url(raw: str) -> str:
    return raw.strip()


def _validate_stream_url(url: str) -> Optional[str]:
    """Return an error message if invalid, else None."""
    if not url:
        return "Empty URL"
    try:
        parsed = urlparse(url)
    except Exception:
        return "Malformed URL"
    if parsed.scheme not in ("http", "https"):
        return "URL must start with http:// or https://"
    if not parsed.netloc or " " in url.strip():
        return "Malformed URL"
    return None


async def _ensure_active_folder(folder_id: str) -> None:
    """Same folder rules as bulk upload: valid ObjectId, exists, not archived."""
    folder_id = (folder_id or "").strip()
    try:
        folder_oid = ObjectId(folder_id)
    except InvalidId as exc:
        raise HTTPException(status_code=400, detail="Invalid folder_id") from exc

    folder = await folders_collection.find_one({"_id": folder_oid})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if folder.get("is_deleted"):
        raise HTTPException(
            status_code=400,
            detail="Cannot add videos to an archived folder",
        )


async def _ensure_unique_stream_url(url: str) -> None:
    """Reject create when azure_stream_url already exists (same as bulk)."""
    existing = await videos_collection.find_one({"azure_stream_url": url})
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Video with this URL already exists",
        )


async def insert_video_record(
    *,
    title: str,
    authors: List[str],
    tags: List[str],
    azure_stream_url: str,
    folder_id: str,
    date_recorded: Optional[datetime] = None,
    conference_group: Optional[str] = None,
    conference_part: Optional[int] = None,
    perform_ai_processing: bool = True,
    language: Optional[str] = None,
    publisher: Optional[str] = None,
    copyright: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    """Shared insert used by single create and bulk upload."""
    video_dict: dict[str, Any] = {
        "title": title,
        "authors": authors,
        "tags": tags or [],
        "azure_stream_url": str(azure_stream_url),
        "folder_id": folder_id,
        "date_recorded": date_recorded or datetime.utcnow(),
        "created_at": datetime.utcnow(),
        "ai_processing": {
            "status": "pending" if perform_ai_processing else "skipped",
            "transcript_segments": [],
            "language": language,
        },
        "opac_export": {"is_exported": False},
        "is_deleted": False,
    }
    group = (conference_group or "").strip()
    if group:
        video_dict["conference_group"] = group
        if conference_part is not None:
            video_dict["conference_part"] = conference_part
    if publisher:
        video_dict["publisher"] = publisher
    if copyright:
        video_dict["copyright"] = copyright
    if description:
        video_dict["description"] = description

    new_video = await videos_collection.insert_one(video_dict)
    await _touch_folder(folder_id)

    created_video = await videos_collection.find_one({"_id": new_video.inserted_id})
    created_video["_id"] = str(created_video["_id"])
    return created_video


# Administrator Verification Placeholder
async def verify_admin(request: Request):
    # auth_header = request.headers.get("Authorization")
    # if not auth_header:
    #     raise HTTPException(status_code=401, detail="Unauthorized")
    pass


@router.post("/", response_model=VideoResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(verify_admin)])
async def create_video(video: VideoCreate):
    video_dict = video.model_dump()
    folder_id = str(video_dict["folder_id"]).strip()
    stream_url = str(video_dict["azure_stream_url"]).strip()

    await _ensure_active_folder(folder_id)
    await _ensure_unique_stream_url(stream_url)

    return await insert_video_record(
        title=video_dict["title"],
        authors=video_dict.get("authors") or [],
        tags=video_dict.get("tags") or [],
        azure_stream_url=stream_url,
        folder_id=folder_id,
        date_recorded=video_dict.get("date_recorded"),
        conference_group=video_dict.get("conference_group"),
        conference_part=video_dict.get("conference_part"),
        perform_ai_processing=True,
    )


@router.post(
    "/bulk",
    response_model=VideoBulkResponse,
    dependencies=[Depends(verify_admin)],
)
async def bulk_create_videos(payload: VideoBulkCreate):
    """
    Create many videos from Azure URLs with shared metadata.
    Invalid / duplicate entries are skipped; valid entries are still created.
    """
    folder_id = payload.folder_id.strip()
    await _ensure_active_folder(folder_id)

    if len(payload.urls) > MAX_BULK_URLS:
        raise HTTPException(
            status_code=400,
            detail=f"Too many URLs: maximum is {MAX_BULK_URLS} per request",
        )

    authors = [a.strip() for a in (payload.authors or []) if a and str(a).strip()]
    tags = [t.strip() for t in (payload.tags or []) if t and str(t).strip()]

    summary = VideoBulkSummary(total=len(payload.urls))
    results: List[VideoBulkItemResult] = []
    seen_in_batch: set[str] = set()

    for raw in payload.urls:
        url = _normalize_url(raw if isinstance(raw, str) else str(raw))

        if not url:
            summary.invalid_urls += 1
            results.append(
                VideoBulkItemResult(
                    url="",
                    status="empty",
                    message="Empty line skipped",
                )
            )
            continue

        url_error = _validate_stream_url(url)
        if url_error:
            summary.invalid_urls += 1
            results.append(
                VideoBulkItemResult(url=url, status="invalid", message=url_error)
            )
            continue

        if url in seen_in_batch:
            summary.skipped_duplicates += 1
            results.append(
                VideoBulkItemResult(
                    url=url,
                    status="duplicate_in_batch",
                    message="Duplicate URL in this upload batch",
                )
            )
            continue
        seen_in_batch.add(url)

        existing = await videos_collection.find_one({"azure_stream_url": url})
        if existing:
            summary.skipped_duplicates += 1
            results.append(
                VideoBulkItemResult(
                    url=url,
                    status="duplicate_existing",
                    video_id=str(existing["_id"]),
                    title=existing.get("title"),
                    message="Video with this URL already exists",
                )
            )
            continue

        title = _title_from_url(url)
        try:
            created = await insert_video_record(
                title=title,
                authors=authors,
                tags=tags,
                azure_stream_url=url,
                folder_id=folder_id,
                date_recorded=payload.date_recorded,
                perform_ai_processing=payload.perform_ai_processing,
                language=payload.language,
                publisher=payload.publisher,
                copyright=payload.copyright,
                description=payload.description,
            )
            summary.created += 1
            results.append(
                VideoBulkItemResult(
                    url=url,
                    status="created",
                    video_id=created["_id"],
                    title=created.get("title"),
                    message="Created",
                )
            )
        except Exception as exc:
            summary.failed += 1
            results.append(
                VideoBulkItemResult(
                    url=url,
                    status="failed",
                    message=str(exc),
                )
            )

    return VideoBulkResponse(summary=summary, results=results)


@router.get("/", response_model=PaginatedVideoList)
async def get_all_videos(
        include_deleted: bool = False,
        only_deleted: bool = False,
        page: int = Query(1, ge=1, description="Page number"),
        limit: int = Query(12, ge=1, le=100, description="Number of items per page"),
        folder_id: Optional[str] = None,
        q: Optional[str] = Query(None, description="Search query string"),
        sort: Optional[str] = Query(
            None,
            description="Sort groups: created_at_desc (default), created_at_asc, title_asc, title_desc",
        ),
):

    if only_deleted:
        query = {"is_deleted": True}
    elif include_deleted:
        query = {}
    else:
        query = {"is_deleted": {"$ne": True}}

    if folder_id:
        query["folder_id"] = folder_id

    if q:
        query_text = q.strip()
        if query_text:
            # Escape metacharacters so queries like C++ / (2024) / * never break $regex
            search_regex = {"$regex": re.escape(query_text), "$options": "i"}
            query["$or"] = [
                {"title": search_regex},
                {"authors": search_regex},
                {"tags": search_regex},
                {"ai_processing.llm_summary": search_regex},
            ]

    sort_key = sort if sort in ALLOWED_VIDEO_SORTS else "created_at_desc"
    group_sort = ALLOWED_VIDEO_SORTS[sort_key]

    skip = (page - 1) * limit

    # 1. Count unique conference groups / standalone videos for pagination
    count_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {
                "$cond": [
                    {
                        "$and": [
                            {"$ne": [{"$ifNull": ["$conference_group", ""]}, ""]},
                            {"$ne": ["$conference_group", None]},
                        ]
                    },
                    "$conference_group",
                    "$_id",
                ]
            }
        }},
        {"$count": "total"}
    ]
    count_result = await videos_collection.aggregate(count_pipeline).to_list(1)
    total_count = count_result[0]["total"] if count_result else 0

    # 2. Page by conference group (or single video id), then unwind members
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {
                "$cond": [
                    {
                        "$and": [
                            {"$ne": [{"$ifNull": ["$conference_group", ""]}, ""]},
                            {"$ne": ["$conference_group", None]},
                        ]
                    },
                    "$conference_group",
                    "$_id",
                ]
            },
            "videos": {"$push": "$$ROOT"},
            "created_at": {"$first": "$created_at"},
            "title": {"$first": "$title"},
        }},
        {"$sort": group_sort},
        {"$skip": skip},
        {"$limit": limit},
        {"$unwind": "$videos"},
        {"$replaceRoot": {"newRoot": "$videos"}},
        {"$sort": {"conference_group": 1, "conference_part": 1}}
    ]

    # limit * 50 retrieves all parts for the filtered groups (the limit here applies to groups, not videos)
    videos = await videos_collection.aggregate(pipeline).to_list(length=limit * 50)

    for video in videos:
        video["_id"] = str(video["_id"])

    return {
        "items": videos,
        "total_count": total_count,
        "page": page,
        "limit": limit
    }


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(video_id: str):
    video = await videos_collection.find_one({"_id": _to_object_id(video_id)})
    if video is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    video["_id"] = str(video["_id"])
    return video


@router.patch("/{video_id}", response_model=VideoResponse, dependencies=[Depends(verify_admin)])
async def update_video(video_id: str, video: VideoUpdate):
    update_data = video.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    if "azure_stream_url" in update_data:
        update_data["azure_stream_url"] = str(update_data["azure_stream_url"])

    target_video = await videos_collection.find_one({"_id": _to_object_id(video_id)})
    if not target_video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    if "is_deleted" in update_data:
        if update_data["is_deleted"]:
            update_data.setdefault("deleted_at", datetime.utcnow())
            update_data["archived_with_folder"] = False
        else:
            update_data["deleted_at"] = None
            update_data["archived_with_folder"] = False

    if "conference_group" in update_data:
        group = (update_data.get("conference_group") or "").strip()
        if group:
            update_data["conference_group"] = group
        else:
            update_data["conference_group"] = None
            update_data["conference_part"] = None

    await videos_collection.update_one(
        {"_id": _to_object_id(video_id)}, {"$set": update_data}
    )

    if "folder_id" in update_data:
        await _touch_folder(update_data.get("folder_id"))
        old_folder = target_video.get("folder_id")
        if old_folder and old_folder != update_data.get("folder_id"):
            await _touch_folder(old_folder)

    updated_video = await videos_collection.find_one({"_id": _to_object_id(video_id)})
    updated_video["_id"] = str(updated_video["_id"])
    return updated_video


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_admin)])
async def soft_delete_video(video_id: str):
    """Marks the record as deleted without removing it from the database."""
    result = await videos_collection.update_one(
        {"_id": _to_object_id(video_id)},
        {
            "$set": {
                "is_deleted": True,
                "deleted_at": datetime.utcnow(),
                "archived_with_folder": False,
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")


@router.delete("/{video_id}/permanent", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_admin)])
async def delete_video_permanently(video_id: str):
    """Permanently removes the record from the database. Cannot be undone."""
    result = await videos_collection.delete_one({"_id": _to_object_id(video_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
