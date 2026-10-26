from datetime import datetime, date, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, StudentProfile
from app.models.timetable import TimetableEntry
from app.models.task import Task
from app.models.subject import Subject
from app.models.attendance import AttendanceRecord
from app.models.marks import Assessment
from app.models.study_plan import StudySession
from app.models.notification import Notification
from app.schemas.dashboard import DashboardSummaryResponse, DailyBriefing
from app.routers.timetable import build_entry_response
from app.routers.tasks import build_task_response
from app.routers.attendance import compute_subject_summary
from app.routers.study_planner import build_session_response
from app.services.ai_service import generate_daily_briefing
from app.services.notification_service import check_and_generate_notifications
from app.routers.deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Run notification check
    check_and_generate_notifications(current_user.id, db)

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    student_name = profile.full_name if profile else "Student"
    college = profile.college if profile else "Engineering Institute"
    course = profile.course if profile else "Computer Science"
    semester = profile.semester if profile else "Semester 6"
    min_attendance = profile.minimum_attendance_target if profile else 75.0

    today = date.today()
    now_utc = datetime.now(timezone.utc)
    day_name = datetime.now().strftime("%A")
    formatted_date = datetime.now().strftime("%B %d, %Y")

    # 2. Today's classes
    today_classes = (
        db.query(TimetableEntry)
        .filter(TimetableEntry.user_id == current_user.id, TimetableEntry.day_of_week.ilike(day_name))
        .order_by(TimetableEntry.start_time)
        .all()
    )
    todays_classes_resp = [build_entry_response(c) for c in today_classes]

    # 3. Tasks statistics
    all_tasks = db.query(Task).filter(Task.user_id == current_user.id).all()
    pending_tasks = [t for t in all_tasks if t.status != "completed"]
    completed_tasks = [t for t in all_tasks if t.status == "completed"]
    overdue_tasks = [
        t for t in pending_tasks
        if (t.due_date.replace(tzinfo=timezone.utc) if t.due_date.tzinfo is None else t.due_date) < now_utc
    ]

    # Sort upcoming pending tasks
    sorted_upcoming = sorted(pending_tasks, key=lambda x: (x.due_date, -x.priority_score))[:5]
    upcoming_tasks_resp = [build_task_response(t) for t in sorted_upcoming]

    # 4. Attendance
    subjects = db.query(Subject).filter(Subject.user_id == current_user.id).all()
    all_att = db.query(AttendanceRecord).filter(AttendanceRecord.user_id == current_user.id).all()
    subject_attendance_summaries = []
    for s in subjects:
        s_recs = [r for r in all_att if r.subject_id == s.id]
        subject_attendance_summaries.append(compute_subject_summary(s, s_recs, min_attendance))

    total_conducted = len(all_att)
    total_present = sum(1 for r in all_att if r.status == "present")
    overall_att_pct = round((total_present / total_conducted * 100.0), 1) if total_conducted > 0 else 100.0
    is_att_warning = overall_att_pct < min_attendance

    # 5. Marks
    all_assessments = db.query(Assessment).filter(Assessment.user_id == current_user.id).all()
    all_pcts = [a.percentage for a in all_assessments]
    overall_marks_avg = round(sum(all_pcts) / len(all_pcts), 1) if all_pcts else 0.0

    subject_marks_summaries = []
    weak_subjects = []
    for s in subjects:
        s_ass = [a for a in all_assessments if a.subject_id == s.id]
        if s_ass:
            pcts = [a.percentage for a in s_ass]
            avg = round(sum(pcts) / len(pcts), 1)
            is_weak = avg < 65.0
            if is_weak:
                weak_subjects.append(s.name)
            subject_marks_summaries.append({
                "subject_id": s.id,
                "subject_name": s.name,
                "subject_code": s.code,
                "color": s.color or "#4f46e5",
                "assessment_count": len(s_ass),
                "average_percentage": avg,
                "highest_percentage": max(pcts),
                "lowest_percentage": min(pcts),
                "is_weak_subject": is_weak
            })

    # 6. Today's study sessions
    todays_sessions = (
        db.query(StudySession)
        .filter(StudySession.user_id == current_user.id, StudySession.session_date == today)
        .order_by(StudySession.start_time)
        .all()
    )
    todays_sessions_resp = [build_session_response(s, db) for s in todays_sessions]

    # 7. Unread notifications
    unread_count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).count()

    # 8. Daily Briefing
    briefing = generate_daily_briefing(
        student_name=student_name,
        todays_classes_count=len(todays_classes_resp),
        pending_tasks_count=len(pending_tasks),
        overdue_tasks_count=len(overdue_tasks),
        attendance_pct=overall_att_pct,
        is_warning=is_att_warning
    )

    return DashboardSummaryResponse(
        student_name=student_name,
        college=college,
        course=course,
        semester=semester,
        current_date=formatted_date,
        current_day=day_name,
        daily_briefing=briefing,
        todays_classes=todays_classes_resp,
        upcoming_tasks=upcoming_tasks_resp,
        pending_tasks_count=len(pending_tasks),
        completed_tasks_count=len(completed_tasks),
        overdue_tasks_count=len(overdue_tasks),
        overall_attendance_percentage=overall_att_pct,
        is_attendance_warning=is_att_warning,
        subject_attendance=subject_attendance_summaries,
        overall_marks_average=overall_marks_avg,
        subject_marks=subject_marks_summaries,
        weak_subjects=weak_subjects,
        todays_study_sessions=todays_sessions_resp,
        unread_notifications_count=unread_count
    )
