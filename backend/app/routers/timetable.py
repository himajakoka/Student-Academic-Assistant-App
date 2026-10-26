from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.timetable import TimetableEntry
from app.models.subject import Subject
from app.schemas.timetable import (
    TimetableEntryCreate,
    TimetableEntryUpdate,
    TimetableEntryResponse,
    ConflictCheckResult,
)
from app.routers.deps import get_current_user

router = APIRouter(prefix="/timetable", tags=["Timetable"])

def has_time_conflict(
    day: str,
    start: str,
    end: str,
    user_id: int,
    db: Session,
    exclude_entry_id: Optional[int] = None
) -> Optional[TimetableEntry]:
    """Check if a time slot overlaps with another scheduled class on the same day for this student."""
    query = db.query(TimetableEntry).filter(
        TimetableEntry.user_id == user_id,
        TimetableEntry.day_of_week.ilike(day.strip())
    )
    if exclude_entry_id:
        query = query.filter(TimetableEntry.id != exclude_entry_id)

    entries = query.all()
    for e in entries:
        # Overlap condition: start < e.end and end > e.start
        if start < e.end_time and end > e.start_time:
            return e
    return None

def build_entry_response(entry: TimetableEntry) -> TimetableEntryResponse:
    subj = entry.subject
    return TimetableEntryResponse(
        id=entry.id,
        user_id=entry.user_id,
        subject_id=entry.subject_id,
        subject_name=subj.name if subj else "Unknown",
        subject_code=subj.code if subj else "",
        subject_color=subj.color if subj else "#4f46e5",
        day_of_week=entry.day_of_week,
        start_time=entry.start_time,
        end_time=entry.end_time,
        classroom=entry.classroom,
        faculty_name=entry.faculty_name or (subj.faculty if subj else None),
        notes=entry.notes,
        created_at=entry.created_at
    )

@router.get("", response_model=List[TimetableEntryResponse])
def get_timetable(
    day: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(TimetableEntry).filter(TimetableEntry.user_id == current_user.id)
    if day:
        query = query.filter(TimetableEntry.day_of_week.ilike(day.strip()))
    
    entries = query.order_by(TimetableEntry.day_of_week, TimetableEntry.start_time).all()
    return [build_entry_response(e) for e in entries]

@router.get("/today", response_model=List[TimetableEntryResponse])
def get_today_classes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today_name = datetime.now().strftime("%A")
    entries = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.user_id == current_user.id,
            TimetableEntry.day_of_week.ilike(today_name)
        )
        .order_by(TimetableEntry.start_time)
        .all()
    )
    return [build_entry_response(e) for e in entries]

@router.post("/check-conflict", response_model=ConflictCheckResult)
def check_conflict(
    entry_in: TimetableEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conflicting = has_time_conflict(
        entry_in.day_of_week,
        entry_in.start_time,
        entry_in.end_time,
        current_user.id,
        db
    )
    if conflicting:
        subj = conflicting.subject
        return ConflictCheckResult(
            has_conflict=True,
            conflicting_entry_id=conflicting.id,
            message=f"Conflict detected: Overlaps with '{subj.name if subj else 'Class'}' ({conflicting.start_time} - {conflicting.end_time}) on {conflicting.day_of_week}."
        )
    return ConflictCheckResult(has_conflict=False, message="No conflict detected.")

@router.post("", response_model=TimetableEntryResponse, status_code=status.HTTP_201_CREATED)
def create_timetable_entry(
    entry_in: TimetableEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify subject belongs to user
    subj = db.query(Subject).filter(Subject.id == entry_in.subject_id, Subject.user_id == current_user.id).first()
    if not subj:
        raise HTTPException(status_code=400, detail="Invalid subject ID or subject does not belong to you.")

    if entry_in.start_time >= entry_in.end_time:
        raise HTTPException(status_code=400, detail="Class start time must be before end time.")

    conflicting = has_time_conflict(entry_in.day_of_week, entry_in.start_time, entry_in.end_time, current_user.id, db)
    if conflicting:
        c_subj = conflicting.subject
        raise HTTPException(
            status_code=409,
            detail=f"Class scheduling conflict! Overlaps with '{c_subj.name if c_subj else 'Class'}' ({conflicting.start_time} - {conflicting.end_time}) on {conflicting.day_of_week}."
        )

    entry = TimetableEntry(
        user_id=current_user.id,
        subject_id=entry_in.subject_id,
        day_of_week=entry_in.day_of_week.capitalize(),
        start_time=entry_in.start_time,
        end_time=entry_in.end_time,
        classroom=entry_in.classroom or "Room 101",
        faculty_name=entry_in.faculty_name or subj.faculty,
        notes=entry_in.notes
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return build_entry_response(entry)

@router.put("/{entry_id}", response_model=TimetableEntryResponse)
def update_timetable_entry(
    entry_id: int,
    entry_in: TimetableEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = db.query(TimetableEntry).filter(TimetableEntry.id == entry_id, TimetableEntry.user_id == current_user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Timetable entry not found.")

    update_data = entry_in.model_dump(exclude_unset=True)
    new_day = update_data.get("day_of_week", entry.day_of_week)
    new_start = update_data.get("start_time", entry.start_time)
    new_end = update_data.get("end_time", entry.end_time)

    if new_start >= new_end:
        raise HTTPException(status_code=400, detail="Class start time must be before end time.")

    conflicting = has_time_conflict(new_day, new_start, new_end, current_user.id, db, exclude_entry_id=entry.id)
    if conflicting:
        c_subj = conflicting.subject
        raise HTTPException(
            status_code=409,
            detail=f"Class scheduling conflict! Overlaps with '{c_subj.name if c_subj else 'Class'}' ({conflicting.start_time} - {conflicting.end_time}) on {conflicting.day_of_week}."
        )

    for field, val in update_data.items():
        if field == "day_of_week" and val:
            setattr(entry, field, val.capitalize())
        else:
            setattr(entry, field, val)

    db.commit()
    db.refresh(entry)
    return build_entry_response(entry)

@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timetable_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = db.query(TimetableEntry).filter(TimetableEntry.id == entry_id, TimetableEntry.user_id == current_user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Timetable entry not found.")

    db.delete(entry)
    db.commit()
    return None
