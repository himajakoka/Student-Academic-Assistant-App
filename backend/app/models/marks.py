from datetime import datetime, timezone, date
from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    assessment_name = Column(String(100), nullable=False)
    assessment_type = Column(String(30), default="quiz")  # midterm, final, quiz, assignment, practical, other
    marks_obtained = Column(Float, nullable=False)
    maximum_marks = Column(Float, nullable=False)
    percentage = Column(Float, nullable=False)
    assessment_date = Column(Date, default=date.today)
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="assessments")
    subject = relationship("Subject", back_populates="assessments")
