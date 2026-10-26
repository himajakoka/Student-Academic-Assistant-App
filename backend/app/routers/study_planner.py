from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.study_plan import StudySession
from app.models.subject import Subject
from app.models.task import Task
from app.schemas.study_plan import (
    StudySessionCreate,
    StudySessionUpdate,
    StudySessionResponse,
    StudyPlanGenerateRequest,
    StudyPlanGenerateResponse,
)
from app.services.study_planner_service import generate_intelligent_study_plan
from app.routers.deps import get_current_user

router = APIRouter(prefix="/study-plan", tags=["Study Planner"])

def build_session_response(s: StudySession, db: Session) -> StudySessionResponse:
    subj = db.query(Subject).filter(Subject.id == s.subject_id).first() if s.subject_id else None
    task = db.query(Task).filter(Task.id == s.task_id).first() if s.task_id else None
    return StudySessionResponse(
        id=s.id,
        user_id=s.user_id,
        subject_id=s.subject_id,
        subject_name=subj.name if subj else None,
        subject_code=subj.code if subj else None,
        subject_color=subj.color if subj else "#4f46e5",
        task_id=s.task_id,
        task_title=task.title if task else None,
        title=s.title,
        session_date=s.session_date,
        start_time=s.start_time,
        end_time=s.end_time,
        duration_minutes=s.duration_minutes,
        status=s.status,
        recommendation_reason=s.recommendation_reason,
        is_accepted=s.is_accepted,
        created_at=s.created_at
    )

@router.get("", response_model=List[StudySessionResponse])
def get_study_sessions(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(StudySession).filter(StudySession.user_id == current_user.id)
    if start_date:
        query = query.filter(StudySession.session_date >= start_date)
    if end_date:
        query = query.filter(StudySession.session_date <= end_date)
    sessions = query.order_by(StudySession.session_date.asc(), StudySession.start_time.asc()).all()
    return [build_session_response(s, db) for s in sessions]

@router.post("/generate", response_model=StudyPlanGenerateResponse)
def generate_study_plan(
    req: StudyPlanGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Clear existing uncompleted future study sessions to regenerate cleanly
    target_start = req.target_date or date.today()
    db.query(StudySession).filter(
        StudySession.user_id == current_user.id,
        StudySession.session_date >= target_start,
        StudySession.status == "scheduled"
    ).delete(synchronize_session=False)

    generated_sessions, warnings, explanation = generate_intelligent_study_plan(
        user_id=current_user.id,
        db=db,
        days_ahead=req.days_ahead,
        daily_available_hours=req.daily_available_hours,
        break_duration_minutes=req.break_duration_minutes,
        target_date=target_start
    )

    for session in generated_sessions:
        db.add(session)
    db.commit()

    # Query newly added sessions to return with IDs
    saved_sessions = (
        db.query(StudySession)
        .filter(StudySession.user_id == current_user.id, StudySession.session_date >= target_start)
        .order_by(StudySession.session_date.asc(), StudySession.start_time.asc())
        .all()
    )

    return StudyPlanGenerateResponse(
        message="Study plan generated successfully.",
        sessions_generated=len(saved_sessions),
        sessions=[build_session_response(s, db) for s in saved_sessions],
        explanation=explanation,
        missing_data_warnings=warnings
    )

@router.post("", response_model=StudySessionResponse, status_code=status.HTTP_201_CREATED)
def create_manual_session(
    s_in: StudySessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = StudySession(
        user_id=current_user.id,
        subject_id=s_in.subject_id,
        task_id=s_in.task_id,
        title=s_in.title,
        session_date=s_in.session_date,
        start_time=s_in.start_time,
        end_time=s_in.end_time,
        duration_minutes=s_in.duration_minutes,
        recommendation_reason=s_in.recommendation_reason or "Manually planned study block",
        is_accepted=s_in.is_accepted,
        status="scheduled"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return build_session_response(session, db)

@router.put("/{session_id}", response_model=StudySessionResponse)
def update_session(
    session_id: int,
    s_in: StudySessionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(StudySession).filter(StudySession.id == session_id, StudySession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found.")

    update_data = s_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(session, field, val)

    db.commit()
    db.refresh(session)
    return build_session_response(session, db)

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(StudySession).filter(StudySession.id == session_id, StudySession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found.")
    db.delete(session)
    db.commit()
    return None
