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
async def get_all_videos():
    videos = await videos_collection.find().to_list(100)
    for video in videos:
        video["_id"] = str(video["_id"])

    return videos