from typing import Optional, List, Dict
from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict, model_validator

class AssessmentBase(BaseModel):
    subject_id: int
    assessment_name: str = Field(..., min_length=1, max_length=100)
    assessment_type: str = Field("quiz", description="quiz, midterm, assignment, final, practical, other")
    marks_obtained: float = Field(..., ge=0.0)
    maximum_marks: float = Field(..., gt=0.0)
    assessment_date: date = Field(default_factory=date.today)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def check_marks(self):
        if self.marks_obtained > self.maximum_marks:
            raise ValueError("Marks obtained cannot exceed maximum marks.")
        return self

class AssessmentCreate(AssessmentBase):
    pass

class AssessmentUpdate(BaseModel):
    subject_id: Optional[int] = None
    assessment_name: Optional[str] = Field(None, min_length=1, max_length=100)
    assessment_type: Optional[str] = None
    marks_obtained: Optional[float] = Field(None, ge=0.0)
    maximum_marks: Optional[float] = Field(None, gt=0.0)
    assessment_date: Optional[date] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def check_marks(self):
        if self.marks_obtained is not None and self.maximum_marks is not None:
            if self.marks_obtained > self.maximum_marks:
                raise ValueError("Marks obtained cannot exceed maximum marks.")
        return self

class AssessmentResponse(AssessmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    subject_color: Optional[str] = None
    percentage: float
    created_at: datetime

class SubjectPerformanceSummary(BaseModel):
    subject_id: int
    subject_name: str
    subject_code: str
    color: str
    assessment_count: int
    average_percentage: float
    highest_percentage: float
    lowest_percentage: float
    is_weak_subject: bool

class PerformanceAnalyticsResponse(BaseModel):
    overall_average: float
    total_assessments: int
    subject_performance: List[SubjectPerformanceSummary]
    weak_subjects: List[str]
    insights: List[str]
    recent_assessments: List[AssessmentResponse]
