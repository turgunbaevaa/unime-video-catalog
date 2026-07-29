from fastapi import APIRouter, HTTPException, status, Query
from typing import Optional
from app.models.video import VideoCreate, VideoResponse, VideoUpdate, PaginatedVideoList
from app.database import videos_collection
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime

router = APIRouter(
    prefix="/api/v1/videos",
    tags=["Videos"]
)


def _to_object_id(video_id: str) -> ObjectId:
    try:
        return ObjectId(video_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid video id")


@router.post("/", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
async def create_video(video: VideoCreate):
    video_dict = video.model_dump()

    video_dict["azure_stream_url"] = str(video_dict["azure_stream_url"])

    video_dict["created_at"] = datetime.utcnow()
    video_dict["ai_processing"] = {"status": "pending", "transcript_segments": []}
    video_dict["opac_export"] = {"is_exported": False}
    video_dict["is_deleted"] = False

    # Save in MongoDB
    new_video = await videos_collection.insert_one(video_dict)

    # Get saved video from db
    created_video = await videos_collection.find_one({"_id": new_video.inserted_id})
    created_video["_id"] = str(created_video["_id"])

    return created_video


@router.get("/", response_model=PaginatedVideoList)
async def get_all_videos(
        include_deleted: bool = False,
        only_deleted: bool = False,
        page: int = Query(1, ge=1, description="Page number"),
        limit: int = Query(12, ge=1, le=100, description="Number of items per page"),
        folder_id: Optional[str] = None  
):
    if only_deleted:
        query = {"is_deleted": True}
    elif include_deleted:
        query = {}
    else:
        query = {"is_deleted": {"$ne": True}}

    if folder_id:
        query["folder_id"] = folder_id

    total_count = await videos_collection.count_documents(query)
    skip = (page - 1) * limit

    videos = await videos_collection.find(query).sort("created_at", -1).skip(skip).to_list(length=limit)

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


@router.patch("/{video_id}", response_model=VideoResponse)
async def update_video(video_id: str, video: VideoUpdate):
    update_data = video.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    if "azure_stream_url" in update_data:
        update_data["azure_stream_url"] = str(update_data["azure_stream_url"])

    result = await videos_collection.update_one(
        {"_id": _to_object_id(video_id)}, {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    updated_video = await videos_collection.find_one({"_id": _to_object_id(video_id)})
    updated_video["_id"] = str(updated_video["_id"])
    return updated_video


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_video(video_id: str):
    """Marks the record as deleted without removing it from the database."""
    result = await videos_collection.update_one(
        {"_id": _to_object_id(video_id)},
        {"$set": {"is_deleted": True, "deleted_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")


@router.delete("/{video_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video_permanently(video_id: str):
    """Permanently removes the record from the database. Cannot be undone."""
    result = await videos_collection.delete_one({"_id": _to_object_id(video_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")