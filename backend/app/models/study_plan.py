from datetime import datetime, timezone, date
from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    session_date = Column(Date, nullable=False, default=date.today)
    start_time = Column(String(10), nullable=False)  # "17:00"
    end_time = Column(String(10), nullable=False)    # "18:30"
    duration_minutes = Column(Integer, default=90)
    status = Column(String(20), default="scheduled")  # scheduled, completed, skipped
    recommendation_reason = Column(Text, nullable=True)
    is_accepted = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="study_sessions")
    task = relationship("Task", back_populates="study_sessions")
