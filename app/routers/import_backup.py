from fastapi import APIRouter, UploadFile, File

from app.backup import restore_from_upload_bytes

router = APIRouter(
    prefix="/api/v1/import",
    tags=["Import"],
)


@router.post("/backup")
async def import_database_backup(file: UploadFile = File(...)):
    """
    Restore folders + videos from a versioned JSON backup.
    Validation runs before any live database mutation.
    """
    content = await file.read()
    return await restore_from_upload_bytes(content)
