from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict

class StudySessionBase(BaseModel):
    subject_id: Optional[int] = None
    task_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=200)
    session_date: date
    start_time: str = Field(..., description="HH:MM format, e.g. 17:00")
    end_time: str = Field(..., description="HH:MM format, e.g. 18:30")
    duration_minutes: int = Field(90, ge=15, le=360)
    recommendation_reason: Optional[str] = None
    is_accepted: bool = True

class StudySessionCreate(StudySessionBase):
    pass

class StudySessionUpdate(BaseModel):
    title: Optional[str] = None
    session_date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None  # scheduled, completed, skipped
    recommendation_reason: Optional[str] = None
    is_accepted: Optional[bool] = None

class StudySessionResponse(StudySessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    subject_color: Optional[str] = None
    task_title: Optional[str] = None
    status: str
    created_at: datetime

class StudyPlanGenerateRequest(BaseModel):
    days_ahead: int = Field(7, ge=1, le=14)
    daily_available_hours: Optional[float] = Field(None, ge=1.0, le=12.0)
    break_duration_minutes: Optional[int] = Field(None, ge=5, le=60)
    target_date: Optional[date] = None

class StudyPlanGenerateResponse(BaseModel):
    message: str
    sessions_generated: int
    sessions: List[StudySessionResponse]
    explanation: str
    missing_data_warnings: List[str] = []
