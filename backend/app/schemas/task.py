from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    subject_id: Optional[int] = None
    task_type: str = Field("assignment", description="assignment, examination, project, revision, personal")
    due_date: datetime
    estimated_effort_minutes: int = Field(60, ge=5, le=1440)
    priority: Optional[str] = Field("medium", description="low, medium, high, urgent")

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    subject_id: Optional[int] = None
    task_type: Optional[str] = None
    due_date: Optional[datetime] = None
    estimated_effort_minutes: Optional[int] = Field(None, ge=5, le=1440)
    priority: Optional[str] = None
    status: Optional[str] = None  # pending, in_progress, completed

class TaskStatusUpdate(BaseModel):
    status: str = Field(..., description="pending, in_progress, completed")

class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    subject_color: Optional[str] = None
    priority_score: float
    priority_reason: Optional[str] = None
    status: str
    completed_at: Optional[datetime] = None
    is_overdue: bool = False
    created_at: datetime
    updated_at: datetime
