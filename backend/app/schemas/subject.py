from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class SubjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=20)
    faculty: Optional[str] = None
    semester: Optional[str] = "Semester 6"
    color: Optional[str] = "#4f46e5"
    target_attendance: Optional[float] = Field(75.0, ge=0.0, le=100.0)

class SubjectCreate(SubjectBase):
    pass

class SubjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    faculty: Optional[str] = None
    semester: Optional[str] = None
    color: Optional[str] = None
    target_attendance: Optional[float] = Field(None, ge=0.0, le=100.0)

class SubjectResponse(SubjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
