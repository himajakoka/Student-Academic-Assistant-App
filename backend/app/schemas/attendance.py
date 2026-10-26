from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict

class AttendanceRecordBase(BaseModel):
    subject_id: int
    date: date
    status: str = Field(..., description="present, absent, leave")
    notes: Optional[str] = None

class AttendanceRecordCreate(AttendanceRecordBase):
    pass

class AttendanceRecordUpdate(BaseModel):
    status: Optional[str] = Field(None, description="present, absent, leave")
    notes: Optional[str] = None

class AttendanceRecordResponse(AttendanceRecordBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    created_at: datetime

class SubjectAttendanceSummary(BaseModel):
    subject_id: int
    subject_name: str
    subject_code: str
    color: str
    total_classes: int
    present_count: int
    absent_count: int
    leave_count: int
    percentage: float
    target_percentage: float
    status: str  # "safe", "warning", "critical"
    classes_needed_for_target: int
    explanation: str

class OverallAttendanceSummary(BaseModel):
    overall_percentage: float
    total_conducted: int
    total_present: int
    total_absent: int
    total_leave: int
    target_percentage: float
    is_warning: bool
    subject_summaries: List[SubjectAttendanceSummary]
