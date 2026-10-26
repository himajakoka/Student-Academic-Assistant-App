from app.database import Base
from app.models.user import User, StudentProfile, UserPreference
from app.models.subject import Subject
from app.models.timetable import TimetableEntry
from app.models.task import Task
from app.models.attendance import AttendanceRecord
from app.models.marks import Assessment
from app.models.study_plan import StudySession
from app.models.document import Document, DocumentChunk
from app.models.chat import ChatConversation, ChatMessage
from app.models.notification import Notification

__all__ = [
    "Base",
    "User",
    "StudentProfile",
    "UserPreference",
    "Subject",
    "TimetableEntry",
    "Task",
    "AttendanceRecord",
    "Assessment",
    "StudySession",
    "Document",
    "DocumentChunk",
    "ChatConversation",
    "ChatMessage",
    "Notification",
]
