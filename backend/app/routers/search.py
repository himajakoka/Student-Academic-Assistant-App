from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.task import Task
from app.models.timetable import TimetableEntry
from app.models.subject import Subject
from app.models.marks import Assessment
from app.models.document import Document
from app.schemas.search import GlobalSearchResponse, SearchResultItem
from app.routers.deps import get_current_user

router = APIRouter(prefix="/search", tags=["Global Search"])

@router.get("", response_model=GlobalSearchResponse)
def global_search(
    q: str = Query(..., min_length=1, description="Search query string"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pattern = f"%{q.strip()}%"
    results: List[SearchResultItem] = []

    # 1. Search Tasks
    tasks = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.id,
            Task.title.ilike(pattern) | Task.description.ilike(pattern)
        )
        .limit(10)
        .all()
    )
    for t in tasks:
        results.append(SearchResultItem(
            category="task",
            id=t.id,
            title=t.title,
            subtitle=f"{t.task_type.capitalize()} • Due {t.due_date.strftime('%b %d')}",
            link_url="/tasks",
            details=f"Status: {t.status}, Priority: {t.priority}"
        ))

    # 2. Search Subjects
    subjects = (
        db.query(Subject)
        .filter(
            Subject.user_id == current_user.id,
            Subject.name.ilike(pattern) | Subject.code.ilike(pattern) | Subject.faculty.ilike(pattern)
        )
        .limit(10)
        .all()
    )
    for s in subjects:
        results.append(SearchResultItem(
            category="subject",
            id=s.id,
            title=f"{s.name} ({s.code})",
            subtitle=f"Faculty: {s.faculty or 'N/A'}",
            link_url="/timetable",
            details=f"Target: {s.target_attendance}% attendance"
        ))

    # 3. Search Timetable Entries
    entries = (
        db.query(TimetableEntry, Subject)
        .join(Subject, TimetableEntry.subject_id == Subject.id)
        .filter(
            TimetableEntry.user_id == current_user.id,
            TimetableEntry.classroom.ilike(pattern) |
            TimetableEntry.day_of_week.ilike(pattern) |
            Subject.name.ilike(pattern)
        )
        .limit(10)
        .all()
    )
    for e, s in entries:
        results.append(SearchResultItem(
            category="timetable",
            id=e.id,
            title=f"{s.name} - {e.day_of_week}",
            subtitle=f"{e.start_time} - {e.end_time} • {e.classroom}",
            link_url="/timetable",
            details=f"Faculty: {e.faculty_name or s.faculty or 'N/A'}"
        ))

    # 4. Search Assessments
    assessments = (
        db.query(Assessment, Subject)
        .join(Subject, Assessment.subject_id == Subject.id)
        .filter(
            Assessment.user_id == current_user.id,
            Assessment.assessment_name.ilike(pattern) | Subject.name.ilike(pattern)
        )
        .limit(10)
        .all()
    )
    for a, s in assessments:
        results.append(SearchResultItem(
            category="assessment",
            id=a.id,
            title=f"{a.assessment_name} - {s.name}",
            subtitle=f"Scored {a.marks_obtained}/{a.maximum_marks} ({a.percentage}%)",
            link_url="/marks",
            details=f"Date: {a.assessment_date}"
        ))

    # 5. Search Documents
    documents = (
        db.query(Document)
        .filter(
            Document.user_id == current_user.id,
            Document.title.ilike(pattern) |
            Document.category.ilike(pattern) |
            Document.original_filename.ilike(pattern) |
            Document.extracted_text.ilike(pattern)
        )
        .limit(10)
        .all()
    )
    for d in documents:
        results.append(SearchResultItem(
            category="document",
            id=d.id,
            title=d.title,
            subtitle=f"{d.category.capitalize()} • {d.file_type}",
            link_url="/documents",
            details=f"File: {d.original_filename} ({round(d.file_size / 1024, 1)} KB)"
        ))

    return GlobalSearchResponse(
        query=q,
        total_results=len(results),
        results=results
    )
