from typing import Optional, List, Dict, Any
from datetime import date, datetime
from pydantic import BaseModel
from app.schemas.timetable import TimetableEntryResponse
from app.schemas.task import TaskResponse
from app.schemas.attendance import SubjectAttendanceSummary
from app.schemas.marks import SubjectPerformanceSummary
from app.schemas.study_plan import StudySessionResponse

class DailyBriefing(BaseModel):
    summary: str
    highlights: List[str]
    is_ai_generated: bool
    generated_at: datetime

class DashboardSummaryResponse(BaseModel):
    student_name: str
    college: str
    course: str
    semester: str
    current_date: str
    current_day: str
    daily_briefing: DailyBriefing
    
    # Timetable
    todays_classes: List[TimetableEntryResponse]
    
    # Tasks
    upcoming_tasks: List[TaskResponse]
    pending_tasks_count: int
    completed_tasks_count: int
    overdue_tasks_count: int
    
    # Attendance
    overall_attendance_percentage: float
    is_attendance_warning: bool
    subject_attendance: List[SubjectAttendanceSummary]
    
    # Marks & Analytics
    overall_marks_average: float
    subject_marks: List[SubjectPerformanceSummary]
    weak_subjects: List[str]
    
    # Study plan for today
    todays_study_sessions: List[StudySessionResponse]
    
    # Notifications unread count
    unread_notifications_count: int
