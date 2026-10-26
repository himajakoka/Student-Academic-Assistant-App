from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class ChatMessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[int] = None

class SourceReference(BaseModel):
    source_type: str  # "document", "timetable", "task", "attendance", "marks", "study_plan"
    title: str
    reference_detail: str

class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    role: str
    content: str
    sources: Optional[List[SourceReference]] = None
    is_demo: bool
    created_at: datetime

class ChatConversationCreate(BaseModel):
    title: Optional[str] = "Academic Consultation"

class ChatConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

class ChatConversationDetailResponse(ChatConversationResponse):
    messages: List[ChatMessageResponse] = []
