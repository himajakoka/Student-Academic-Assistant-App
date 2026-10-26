from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    email: str
    full_name: str
    college: Optional[str] = None
    course: Optional[str] = None
    semester: Optional[str] = None
    academic_year: Optional[str] = None
    avatar_url: Optional[str] = None
    preferred_study_hours_per_day: float
    preferred_break_duration_minutes: int
    minimum_attendance_target: float

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    college: Optional[str] = None
    course: Optional[str] = None
    semester: Optional[str] = None
    academic_year: Optional[str] = None
    avatar_url: Optional[str] = None
    preferred_study_hours_per_day: Optional[float] = Field(None, ge=1.0, le=16.0)
    preferred_break_duration_minutes: Optional[int] = Field(None, ge=5, le=60)
    minimum_attendance_target: Optional[float] = Field(None, ge=50.0, le=100.0)

class PreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    theme: str
    attendance_warning_threshold: float
    email_notifications: bool
    sound_enabled: bool
    reminder_hours_before_deadline: int
    auto_generate_study_plans: bool

class PreferenceUpdate(BaseModel):
    theme: Optional[str] = None
    attendance_warning_threshold: Optional[float] = Field(None, ge=50.0, le=100.0)
    email_notifications: Optional[bool] = None
    sound_enabled: Optional[bool] = None
    reminder_hours_before_deadline: Optional[int] = Field(None, ge=1, le=168)
    auto_generate_study_plans: Optional[bool] = None
