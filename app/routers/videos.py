from fastapi import APIRouter, HTTPException, status, Query, Request, Depends
from typing import Optional
from app.models.video import VideoCreate, VideoResponse, VideoUpdate, PaginatedVideoList
from app.database import videos_collection, folders_collection
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
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

    video_dict["azure_stream_url"] = str(video_dict["azure_stream_url"])

    video_dict["created_at"] = datetime.utcnow()
    video_dict["ai_processing"] = {"status": "pending", "transcript_segments": []}
    video_dict["opac_export"] = {"is_exported": False}
    video_dict["is_deleted"] = False

    # Save in MongoDB
    new_video = await videos_collection.insert_one(video_dict)

    await _touch_folder(video_dict.get("folder_id"))

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

    # 1. Count the total number of unique TV series to ensure proper pagination
    count_pipeline = [
        {"$match": query},
        {"$group": {"_id": {"$ifNull": ["$group_id", "$_id"]}}},
        {"$count": "total"}
    ]
    count_result = await videos_collection.aggregate(count_pipeline).to_list(1)
    total_count = count_result[0]["total"] if count_result else 0

    # 2. Take out the items, grouping them so as not to interrupt the series
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {"$ifNull": ["$group_id", "$_id"]},
            "videos": {"$push": "$$ROOT"},
            "created_at": {"$first": "$created_at"},
            "title": {"$first": "$title"},
        }},
        {"$sort": group_sort},
        {"$skip": skip},
        {"$limit": limit},
        {"$unwind": "$videos"},
        {"$replaceRoot": {"newRoot": "$videos"}},
        {"$sort": {"group_id": 1, "part_number": 1}}
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

    # Moving the entire series when changing folders
    if "folder_id" in update_data and target_video.get("group_id"):
        new_folder_id = update_data["folder_id"]

        # Updating the folder for all parts
        await videos_collection.update_many(
            {"group_id": target_video["group_id"]},
            {"$set": {"folder_id": new_folder_id}}
        )

        # Apply the remaining updates to a specific video
        await videos_collection.update_one(
            {"_id": _to_object_id(video_id)}, {"$set": update_data}
        )
    else:
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
        {"$set": {"is_deleted": True, "deleted_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")


@router.delete("/{video_id}/permanent", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_admin)])
async def delete_video_permanently(video_id: str):
    """Permanently removes the record from the database. Cannot be undone."""
    result = await videos_collection.delete_one({"_id": _to_object_id(video_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")