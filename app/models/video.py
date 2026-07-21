from pydantic import BaseModel, HttpUrl, Field
from datetime import datetime
from typing import List, Optional

# 1. Model for Whisper timecodes (inserted array)
class TranscriptSegment(BaseModel):
    start_time: float = Field(..., description="Start time of the segment in seconds")
    end_time: float = Field(..., description="End time of the segment in seconds")
    text: str = Field(..., description="Transcribed text for this segment")

# 2. Model for AI processing
class AIData(BaseModel):
    status: str = Field(default="pending", description="Status: pending, processing, completed")
    language: Optional[str] = Field(None, description="Detected language (e.g., 'it', 'en')")
    whisper_transcript: Optional[str] = Field(None, description="Full raw transcription text")
    transcript_segments: List[TranscriptSegment] = Field(default=[], description="Segmented transcription with timestamps")
    llm_summary: Optional[str] = Field(None, description="AI generated lecture summary")

# 3. Model for the integration status with the university catalog (OPAC)
class OPACExportData(BaseModel):
    is_exported: bool = Field(default=False)
    last_exported_at: Optional[datetime] = Field(None)

# 4. Model for CREATING a new video (the one sent by the frontend)
class VideoCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200, example="Lezione di Storia Romana")
    authors: List[str] = Field(..., example=["Prof. Nicola Spada"])
    date_recorded: datetime = Field(default_factory=datetime.utcnow)
    tags: List[str] = Field(default=[], example=["History", "Rome"])
    azure_stream_url: HttpUrl = Field(..., example="https://web.microsoftstream.com/video/example-id")

# 5. Model for UPDATING an existing video (all fields optional, only the ones
# provided are applied)
class VideoUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200, example="Lezione di Storia Romana")
    authors: Optional[List[str]] = Field(None, example=["Prof. Nicola Spada"])
    date_recorded: Optional[datetime] = None
    tags: Optional[List[str]] = Field(None, example=["History", "Rome"])
    azure_stream_url: Optional[HttpUrl] = Field(None, example="https://web.microsoftstream.com/video/example-id")

# 6. The complete video model (how it is stored in MongoDB and returned via the API)
class VideoResponse(VideoCreate):
    id: str = Field(..., alias="_id", description="MongoDB ObjectId as string")
    ai_processing: AIData = Field(default_factory=AIData)
    opac_export: OPACExportData = Field(default_factory=OPACExportData)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    uploaded_by: Optional[str] = Field(None, description="User ID who uploaded the video")
    is_deleted: bool = Field(default=False, description="Soft-delete flag")
    deleted_at: Optional[datetime] = Field(None, description="When the record was soft-deleted")

    class Config:
        populate_by_name = True # Allows FastAPI to correctly read the _id from MongoDB