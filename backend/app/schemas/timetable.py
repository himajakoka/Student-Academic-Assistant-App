from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class TimetableEntryBase(BaseModel):
    subject_id: int
    day_of_week: str = Field(..., description="Day of week (e.g. Monday)")
    start_time: str = Field(..., description="HH:MM format, e.g. 09:00")
    end_time: str = Field(..., description="HH:MM format, e.g. 10:00")
    classroom: Optional[str] = "Room 101"
    faculty_name: Optional[str] = None
    notes: Optional[str] = None

class TimetableEntryCreate(TimetableEntryBase):
    pass

class TimetableEntryUpdate(BaseModel):
    subject_id: Optional[int] = None
    day_of_week: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    classroom: Optional[str] = None
    faculty_name: Optional[str] = None
    notes: Optional[str] = None

class TimetableEntryResponse(TimetableEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    subject_color: Optional[str] = None
    created_at: datetime

class ConflictCheckResult(BaseModel):
    has_conflict: bool
    message: Optional[str] = None
    conflicting_entry_id: Optional[int] = None
