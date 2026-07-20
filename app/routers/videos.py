from fastapi import APIRouter, HTTPException, status
from typing import List
from app.models.video import VideoCreate, VideoResponse
from app.database import videos_collection
from bson import ObjectId
from datetime import datetime

router = APIRouter(
    prefix="/api/v1/videos",
    tags=["Videos"]
)


@router.post("/", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
async def create_video(video: VideoCreate):
    video_dict = video.model_dump()

    video_dict["azure_stream_url"] = str(video_dict["azure_stream_url"])

    video_dict["created_at"] = datetime.utcnow()
    video_dict["ai_processing"] = {"status": "pending", "transcript_segments": []}
    video_dict["opac_export"] = {"is_exported": False}

    # Save in MongoDB
    new_video = await videos_collection.insert_one(video_dict)

    # Get saved video from db
    created_video = await videos_collection.find_one({"_id": new_video.inserted_id})
    created_video["_id"] = str(created_video["_id"])

    return created_video


@router.get("/", response_model=List[VideoResponse])
async def get_all_videos(include_deleted: bool = False):
    # If `include_deleted=False`, we only search for videos that do not have the `is_deleted: True` flag set
    query = {} if include_deleted else {"is_deleted": {"$ne": True}}

    videos = await videos_collection.find(query).to_list(100)
    for video in videos:
        video["_id"] = str(video["_id"])

    return videos


@router.delete("/{video_id}")
async def delete_video(video_id: str, permanent: bool = False):
    # 1. We check that the ID provided is in the correct MongoDB format
    if not ObjectId.is_valid(video_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid video ID format")

    # 2. The logic behind PERMANENT deletion
    if permanent:
        result = await videos_collection.delete_one({"_id": ObjectId(video_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
        return {"message": "Video permanently deleted"}

    # 3. The logic behind SOFT deletion
    else:
        result = await videos_collection.update_one(
            {"_id": ObjectId(video_id)},
            {"$set": {"is_deleted": True}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
        return {"message": "Video softly deleted"}