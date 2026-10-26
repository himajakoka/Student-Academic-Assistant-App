from typing import List, Optional
from pydantic import BaseModel

class SearchResultItem(BaseModel):
    category: str  # "task", "timetable", "subject", "assessment", "document"
    id: int
    title: str
    subtitle: str
    link_url: str
    details: Optional[str] = None

class GlobalSearchResponse(BaseModel):
    query: str
    total_results: int
    results: List[SearchResultItem]
