from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class FolderCreate(BaseModel):
    name: str
    description: Optional[str] = None

class FolderResponse(BaseModel):
    name: str
    description: Optional[str] = None
    created_at: datetime
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None

class FolderList(BaseModel):
    items: List[dict]
    total_count: int
    page: int
    limit: int
    
class FolderUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_deleted: Optional[bool] = None