from fastapi import APIRouter, HTTPException, status, Query, Depends
from datetime import datetime
from typing import Optional
import re
from bson import ObjectId
from bson.errors import InvalidId
from app.database import folders_collection, videos_collection
from app.models.folder import FolderCreate, FolderUpdate, FolderList
from app.deps import verify_admin

router = APIRouter(
    prefix="/api/v1/folders",
    tags=["Folders"]
)


def _as_folder_id_str(folder: dict) -> str:
    raw = folder.get("_id")
    return str(raw)


def _parse_folder_oid(folder_id: str) -> ObjectId:
    try:
        return ObjectId(folder_id)
    except InvalidId as exc:
        raise HTTPException(status_code=400, detail="Invalid folder ID format") from exc


async def _get_folder_or_404(folder_id: str) -> dict:
    folder = await folders_collection.find_one({"_id": _parse_folder_oid(folder_id)})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


async def _cascade_archive_videos(folder_id: str, now: datetime) -> None:
    """
    Soft-delete only currently active videos and mark them as archived with the folder.
    Independently archived videos are left untouched.
    """
    await videos_collection.update_many(
        {"folder_id": folder_id, "is_deleted": {"$ne": True}},
        {
            "$set": {
                "is_deleted": True,
                "deleted_at": now,
                "archived_with_folder": True,
            }
        },
    )


async def _cascade_restore_videos(folder_id: str) -> None:
    """Restore only videos that were archived as part of a folder archive."""
    await videos_collection.update_many(
        {"folder_id": folder_id, "archived_with_folder": True},
        {
            "$set": {
                "is_deleted": False,
                "deleted_at": None,
                "archived_with_folder": False,
            }
        },
    )


async def _enrich_folder(folder: dict) -> dict:
    """
    Attach additive video_count + last_updated without changing core fields.
    Active folders count non-deleted videos; archived folders count deleted videos.
    """
    folder_id = _as_folder_id_str(folder)
    if folder.get("is_deleted"):
        video_query = {"folder_id": folder_id, "is_deleted": True}
    else:
        video_query = {"folder_id": folder_id, "is_deleted": {"$ne": True}}

    video_count = await videos_collection.count_documents(video_query)
    newest = (
        await videos_collection.find(video_query)
        .sort("created_at", -1)
        .limit(1)
        .to_list(1)
    )

    candidates = []
    for value in (
        folder.get("updated_at"),
        folder.get("created_at"),
        newest[0].get("created_at") if newest else None,
    ):
        if value is not None:
            candidates.append(value)

    folder["video_count"] = video_count
    folder["last_updated"] = max(candidates) if candidates else None
    return folder


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_admin)])
async def create_folder(folder: FolderCreate):
    """Create a new folder"""
    now = datetime.utcnow()
    folder_dict = folder.dict()
    folder_dict["created_at"] = now
    folder_dict["updated_at"] = now
    folder_dict["is_deleted"] = False
    folder_dict["deleted_at"] = None

    result = await folders_collection.insert_one(folder_dict)
    created_folder = await folders_collection.find_one({"_id": result.inserted_id})

    if created_folder:
        created_folder["_id"] = str(created_folder["_id"])
        created_folder = await _enrich_folder(created_folder)

    return created_folder


@router.get("/", response_model=FolderList)
async def get_folders(
        include_deleted: bool = False,
        only_deleted: bool = False,
        page: int = Query(1, ge=1, description="Page number"),
        limit: int = Query(12, ge=1, le=100, description="Number of items per page"),
        q: Optional[str] = Query(None, description="Search query string"),
):
    """Get all folders with pagination and archive filtering"""
    if only_deleted:
        query: dict = {"is_deleted": True}
    elif include_deleted:
        query = {}
    else:
        query = {"is_deleted": {"$ne": True}}

    if q:
        query_text = q.strip()
        if query_text:
            search_regex = {"$regex": re.escape(query_text), "$options": "i"}
            query["$or"] = [
                {"name": search_regex},
                {"description": search_regex},
            ]

    total_count = await folders_collection.count_documents(query)
    skip = (page - 1) * limit

    cursor = folders_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
    folders = await cursor.to_list(length=limit)

    enriched = []
    for f in folders:
        f["_id"] = str(f["_id"])
        enriched.append(await _enrich_folder(f))

    return {
        "items": enriched,
        "total_count": total_count,
        "page": page,
        "limit": limit
    }


@router.get("/{folder_id}", response_model=dict)
async def get_folder(folder_id: str):
    """Get a specific folder by ID"""
    try:
        folder = await _get_folder_or_404(folder_id)
        folder["_id"] = str(folder["_id"])
        return await _enrich_folder(folder)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid folder ID format")


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_admin)])
async def soft_delete_folder(folder_id: str):
    """Soft delete (Archive) a folder and cascading active videos inside it."""
    try:
        await _get_folder_or_404(folder_id)
        now = datetime.utcnow()
        await _cascade_archive_videos(folder_id, now)

        result = await folders_collection.update_one(
            {"_id": ObjectId(folder_id)},
            {"$set": {
                "is_deleted": True,
                "deleted_at": now,
                "updated_at": now,
            }}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Folder not found")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid folder ID format")


@router.delete("/{folder_id}/permanent", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_admin)])
async def delete_folder_permanently(folder_id: str):
    """
    Permanently delete an empty folder.
    Matches archive UI: the folder must contain no videos.
    """
    try:
        await _get_folder_or_404(folder_id)

        video_count = await videos_collection.count_documents({"folder_id": folder_id})
        if video_count > 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Folder is not empty. Permanently delete or restore all videos "
                    "inside it before deleting the folder."
                ),
            )

        result = await folders_collection.delete_one({"_id": ObjectId(folder_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Folder not found")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid folder ID format")


@router.patch("/{folder_id}", dependencies=[Depends(verify_admin)])
async def update_folder(folder_id: str, folder_update: FolderUpdate):
    update_data = folder_update.dict(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No data provided to update")

    folder = await _get_folder_or_404(folder_id)

    if "is_deleted" in update_data:
        is_deleted_status = update_data["is_deleted"]
        now = datetime.utcnow()
        if is_deleted_status:
            await _cascade_archive_videos(folder_id, now)
            update_data["deleted_at"] = now
        else:
            await _cascade_restore_videos(folder_id)
            update_data["deleted_at"] = None

    update_data["updated_at"] = datetime.utcnow()

    result = await folders_collection.update_one(
        {"_id": folder["_id"]},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Folder not found")

    updated_folder = await folders_collection.find_one({"_id": folder["_id"]})
    updated_folder["_id"] = str(updated_folder["_id"])
    return await _enrich_folder(updated_folder)
