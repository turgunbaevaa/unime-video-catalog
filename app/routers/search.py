from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from typing import Annotated, List
from app.database import videos_collection, folders_collection
import asyncio
import re

router = APIRouter(
    prefix="/api/v1/search",
    tags=["Search"],
)

# Cap query length to avoid pathological regex scans on huge input strings.
MAX_QUERY_LENGTH = 200


class SearchResponse(BaseModel):
    folders: List[dict] = Field(default_factory=list)
    videos: List[dict] = Field(default_factory=list)
    total_folders: int = 0
    total_videos: int = 0
    page: int = 1
    limit: int = 12


def _regex_filter(q: str) -> dict:
    return {"$regex": re.escape(q), "$options": "i"}


def _stringify_ids(documents: list) -> list:
    for doc in documents:
        doc["_id"] = str(doc["_id"])
    return documents


def _empty_response(page: int, limit: int) -> SearchResponse:
    return SearchResponse(page=page, limit=limit)


@router.get("/", response_model=SearchResponse)
async def global_search(
    q: Annotated[
        str,
        Query(
            min_length=1,
            max_length=200,
            description="Search query string",
        ),
    ],
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    limit: Annotated[
        int, Query(ge=1, le=100, description="Items per page per section")
    ] = 12,
):
    """
    Global catalog search across folders and videos.
    Soft-deleted records are excluded. Conference grouping is not applied here.
    """
    query_text = q.strip()[:MAX_QUERY_LENGTH]
    if not query_text:
        return _empty_response(page, limit)

    search_regex = _regex_filter(query_text)
    skip = (page - 1) * limit

    folder_query = {
        "is_deleted": {"$ne": True},
        "$or": [
            {"name": search_regex},
            {"description": search_regex},
        ],
    }

    video_query = {
        "is_deleted": {"$ne": True},
        "$or": [
            {"title": search_regex},
            {"authors": search_regex},
            {"tags": search_regex},
            {"ai_processing.llm_summary": search_regex},
        ],
    }

    # Run counts and page fetches in parallel — same filters, independent I/O.
    total_folders, total_videos, folders, videos = await asyncio.gather(
        folders_collection.count_documents(folder_query),
        videos_collection.count_documents(video_query),
        folders_collection.find(folder_query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(length=limit),
        videos_collection.find(video_query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(length=limit),
    )

    return SearchResponse(
        folders=_stringify_ids(folders),
        videos=_stringify_ids(videos),
        total_folders=total_folders,
        total_videos=total_videos,
        page=page,
        limit=limit,
    )
