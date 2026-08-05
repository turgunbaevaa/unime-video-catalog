from pydantic import BaseModel
from typing import Optional, List

class FolderCreate(BaseModel):
    name: str
    description: Optional[str] = None

class FolderList(BaseModel):
    items: List[dict]
    total_count: int
    page: int
    limit: int
    
class FolderUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_deleted: Optional[bool] = None
