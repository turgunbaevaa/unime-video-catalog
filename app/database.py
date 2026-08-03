import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_DETAILS = os.getenv("MONGO_URL", "mongodb://localhost:27017")

client = AsyncIOMotorClient(MONGO_DETAILS)

database = client.unime_video_catalog

videos_collection = database.get_collection("videos")
folders_collection = database.get_collection("folders")


async def ensure_indexes() -> None:
    """Create indexes used by list/search/folder queries (idempotent)."""
    await videos_collection.create_index("folder_id")
    await videos_collection.create_index("conference_group")
    await videos_collection.create_index("is_deleted")
    await videos_collection.create_index("created_at")
    await videos_collection.create_index("azure_stream_url")

    await folders_collection.create_index("is_deleted")
    await folders_collection.create_index("created_at")
