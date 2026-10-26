from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    title: str
    category: str
    original_filename: str
    file_type: str
    file_size: int
    has_extracted_text: bool
    created_at: datetime

class DocumentDetailResponse(DocumentResponse):
    extracted_text_snippet: Optional[str] = None

class DocumentSearchResult(BaseModel):
    document_id: int
    title: str
    category: str
    subject_name: Optional[str] = None
    snippet: str
    score: float
