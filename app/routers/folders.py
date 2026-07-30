from fastapi import APIRouter, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.database import folders_collection, videos_collection
from app.models.folder import FolderCreate, FolderUpdate, FolderList

router = APIRouter(
    prefix="/api/v1/folders",
    tags=["Folders"]
)


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_folder(folder: FolderCreate):
    """Create a new folder"""
    folder_dict = folder.dict()
    folder_dict["created_at"] = datetime.utcnow()
    folder_dict["is_deleted"] = False
    folder_dict["deleted_at"] = None

    result = await folders_collection.insert_one(folder_dict)
    created_folder = await folders_collection.find_one({"_id": result.inserted_id})

    if created_folder:
        created_folder["_id"] = str(created_folder["_id"])

    return created_folder


@router.get("/", response_model=FolderList)
async def get_folders(
        include_deleted: bool = False,
        only_deleted: bool = False,
        page: int = Query(1, ge=1, description="Page number"),
        limit: int = Query(12, ge=1, le=100, description="Number of items per page")
):
    """Get all folders with pagination and archive filtering"""
    if only_deleted:
        query = {"is_deleted": True}
    elif include_deleted:
        query = {}
    else:
        query = {"is_deleted": {"$ne": True}}

    total_count = await folders_collection.count_documents(query)
    skip = (page - 1) * limit

    cursor = folders_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
    folders = await cursor.to_list(length=limit)

    for f in folders:
        f["_id"] = str(f["_id"])

    return {
        "items": folders,
        "total_count": total_count,
        "page": page,
        "limit": limit
    }


@router.get("/{folder_id}", response_model=dict)
async def get_folder(folder_id: str):
    """Get a specific folder by ID"""
    try:
        folder = await folders_collection.find_one({"_id": ObjectId(folder_id)})
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

        folder["_id"] = str(folder["_id"])
        return folder
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid folder ID format")


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_folder(folder_id: str):
    """Soft delete (Archive) a folder and all videos inside it (Cascading)"""
    try:
        await videos_collection.update_many(
            {"folder_id": folder_id},
            {"$set": {"is_deleted": True, "deleted_at": datetime.utcnow()}}
        )

        result = await folders_collection.update_one(
            {"_id": ObjectId(folder_id)},
            {"$set": {"is_deleted": True, "deleted_at": datetime.utcnow()}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Folder not found")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid folder ID format")


@router.delete("/{folder_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder_permanently(folder_id: str):
    """Permanently delete a folder. Fails if the folder contains videos."""
    try:
        videos_count = await videos_collection.count_documents({"folder_id": folder_id})
        if videos_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete folder. It contains {videos_count} video(s). Please delete or move them first."
            )

        result = await folders_collection.delete_one({"_id": ObjectId(folder_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Folder not found")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid folder ID format")


@router.patch("/{folder_id}")
async def update_folder(folder_id: str, folder_update: FolderUpdate):
    update_data = folder_update.dict(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No data provided to update")

    if "is_deleted" in update_data:
        is_deleted_status = update_data["is_deleted"]
        deleted_at_val = datetime.utcnow() if is_deleted_status else None

        await videos_collection.update_many(
            {"folder_id": folder_id},
            {"$set": {"is_deleted": is_deleted_status, "deleted_at": deleted_at_val}}
        )

    result = await folders_collection.update_one(
        {"_id": ObjectId(folder_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Folder not found")

    updated_folder = await folders_collection.find_one({"_id": ObjectId(folder_id)})
    updated_folder["_id"] = str(updated_folder["_id"])
    return updated_folder