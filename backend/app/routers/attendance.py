import math
from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, StudentProfile
from app.models.subject import Subject
from app.models.attendance import AttendanceRecord
from app.schemas.attendance import (
    AttendanceRecordCreate,
    AttendanceRecordUpdate,
    AttendanceRecordResponse,
    SubjectAttendanceSummary,
    OverallAttendanceSummary,
)
from app.routers.deps import get_current_user

router = APIRouter(prefix="/attendance", tags=["Attendance"])

def calculate_classes_needed(present: int, total: int, target_pct: float) -> int:
    """
    Computes minimum consecutive attended classes needed to reach target_pct.
    Formula: (P + x) / (C + x) >= target
    => x = ceil((target * C - P) / (1 - target))
    """
    if total == 0:
        return 0
    current_pct = (present / total) * 100.0
    if current_pct >= target_pct:
        return 0

    t_ratio = target_pct / 100.0
    if t_ratio >= 1.0:
        return 0  # Mathematically impossible to reach 100% if even 1 class was missed

    numerator = (t_ratio * total) - present
    denominator = 1.0 - t_ratio
    needed = math.ceil(numerator / denominator)
    return max(0, needed)

def compute_subject_summary(
    subject: Subject,
    records: List[AttendanceRecord],
    min_threshold: float
) -> SubjectAttendanceSummary:
    total = len(records)
    present = sum(1 for r in records if r.status == "present")
    absent = sum(1 for r in records if r.status == "absent")
    leave = sum(1 for r in records if r.status == "leave")

    pct = round((present / total * 100.0), 1) if total > 0 else 0.0
    target = subject.target_attendance or min_threshold

    if total == 0:
        status_label = "safe"
        classes_needed = 0
        explanation = "No classes logged yet for this subject."
    elif pct >= target:
        status_label = "safe"
        classes_needed = 0
        explanation = f"Attendance is above the target of {target}%."
    elif pct >= (target - 10.0):
        status_label = "warning"
        classes_needed = calculate_classes_needed(present, total, target)
        explanation = f"Need to attend next {classes_needed} consecutive classes to hit {target}%."
    else:
        status_label = "critical"
        classes_needed = calculate_classes_needed(present, total, target)
        explanation = f"Critical shortage! Need next {classes_needed} consecutive classes to achieve {target}%."

    return SubjectAttendanceSummary(
        subject_id=subject.id,
        subject_name=subject.name,
        subject_code=subject.code,
        color=subject.color or "#4f46e5",
        total_classes=total,
        present_count=present,
        absent_count=absent,
        leave_count=leave,
        percentage=pct,
        target_percentage=target,
        status=status_label,
        classes_needed_for_target=classes_needed,
        explanation=explanation
    )

@router.get("/summary", response_model=OverallAttendanceSummary)
def get_attendance_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    min_threshold = profile.minimum_attendance_target if profile else 75.0

    subjects = db.query(Subject).filter(Subject.user_id == current_user.id).all()
    all_records = db.query(AttendanceRecord).filter(AttendanceRecord.user_id == current_user.id).all()

    subject_summaries = []
    total_conducted = len(all_records)
    total_present = sum(1 for r in all_records if r.status == "present")
    total_absent = sum(1 for r in all_records if r.status == "absent")
    total_leave = sum(1 for r in all_records if r.status == "leave")

    for s in subjects:
        s_records = [r for r in all_records if r.subject_id == s.id]
        subject_summaries.append(compute_subject_summary(s, s_records, min_threshold))

    overall_pct = round((total_present / total_conducted * 100.0), 1) if total_conducted > 0 else 100.0
    is_warning = overall_pct < min_threshold

    return OverallAttendanceSummary(
        overall_percentage=overall_pct,
        total_conducted=total_conducted,
        total_present=total_present,
        total_absent=total_absent,
        total_leave=total_leave,
        target_percentage=min_threshold,
        is_warning=is_warning,
        subject_summaries=subject_summaries
    )

@router.get("", response_model=List[AttendanceRecordResponse])
def get_attendance_records(
    subject_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(AttendanceRecord).filter(AttendanceRecord.user_id == current_user.id)

    if subject_id:
        query = query.filter(AttendanceRecord.subject_id == subject_id)
    if start_date:
        query = query.filter(AttendanceRecord.date >= start_date)
    if end_date:
        query = query.filter(AttendanceRecord.date <= end_date)
    if status_filter:
        query = query.filter(AttendanceRecord.status == status_filter.lower())

    records = query.order_by(AttendanceRecord.date.desc()).all()
    results = []
    for r in records:
        subj = r.subject
        results.append(AttendanceRecordResponse(
            id=r.id,
            user_id=r.user_id,
            subject_id=r.subject_id,
            subject_name=subj.name if subj else "Unknown",
            subject_code=subj.code if subj else "",
            date=r.date,
            status=r.status,
            notes=r.notes,
            created_at=r.created_at
        ))
    return results

@router.post("", response_model=AttendanceRecordResponse, status_code=status.HTTP_201_CREATED)
def record_attendance(
    record_in: AttendanceRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    subj = db.query(Subject).filter(Subject.id == record_in.subject_id, Subject.user_id == current_user.id).first()
    if not subj:
        raise HTTPException(status_code=400, detail="Invalid subject ID or subject does not belong to you.")

    if record_in.date > date.today():
        raise HTTPException(status_code=400, detail="Cannot record attendance for future dates.")

    if record_in.status.lower() not in ["present", "absent", "leave"]:
        raise HTTPException(status_code=400, detail="Status must be 'present', 'absent', or 'leave'.")

    # Upsert logic if record exists for user, subject, and date
    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.user_id == current_user.id,
        AttendanceRecord.subject_id == record_in.subject_id,
        AttendanceRecord.date == record_in.date
    ).first()

    if existing:
        existing.status = record_in.status.lower()
        existing.notes = record_in.notes
        db.commit()
        db.refresh(existing)
        return AttendanceRecordResponse(
            id=existing.id,
            user_id=existing.user_id,
            subject_id=existing.subject_id,
            subject_name=subj.name,
            subject_code=subj.code,
            date=existing.date,
            status=existing.status,
            notes=existing.notes,
            created_at=existing.created_at
        )

    rec = AttendanceRecord(
        user_id=current_user.id,
        subject_id=record_in.subject_id,
        date=record_in.date,
        status=record_in.status.lower(),
        notes=record_in.notes
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    return AttendanceRecordResponse(
        id=rec.id,
        user_id=rec.user_id,
        subject_id=rec.subject_id,
        subject_name=subj.name,
        subject_code=subj.code,
        date=rec.date,
        status=rec.status,
        notes=rec.notes,
        created_at=rec.created_at
    )

@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attendance_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id, AttendanceRecord.user_id == current_user.id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Attendance record not found.")
    db.delete(rec)
    db.commit()
    return None
