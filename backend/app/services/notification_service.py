from datetime import datetime, date, timezone, timedelta
from typing import List
from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.task import Task
from app.models.subject import Subject
from app.models.attendance import AttendanceRecord
from app.models.user import StudentProfile

def check_and_generate_notifications(user_id: int, db: Session) -> List[Notification]:
    """Generates real-time in-app alerts based on current student data."""
    created_notifications = []
    now = datetime.now(timezone.utc)
    today = date.today()

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()
    min_attendance = profile.minimum_attendance_target if profile else 75.0

    # 1. Check tasks due within 24 hours
    urgent_tasks = (
        db.query(Task)
        .filter(
            Task.user_id == user_id,
            Task.status != "completed",
            Task.due_date >= now - timedelta(hours=6),
            Task.due_date <= now + timedelta(hours=24)
        )
        .all()
    )
    for t in urgent_tasks:
        exists = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.notification_type == "deadline",
            Notification.title.like(f"%{t.title}%"),
            Notification.created_at >= now - timedelta(hours=12)
        ).first()
        if not exists:
            hours_left = max(0, int((t.due_date.replace(tzinfo=timezone.utc) - now).total_seconds() / 3600))
            notif = Notification(
                user_id=user_id,
                title=f"Deadline Approaching: {t.title}",
                message=f"Task '{t.title}' is due in {hours_left} hours ({t.due_date.strftime('%b %d, %H:%M')}).",
                notification_type="deadline",
                link_url="/tasks",
                is_read=False
            )
            db.add(notif)
            created_notifications.append(notif)

    # 2. Check exams within 3 days
    upcoming_exams = (
        db.query(Task)
        .filter(
            Task.user_id == user_id,
            Task.task_type == "examination",
            Task.status != "completed",
            Task.due_date >= now,
            Task.due_date <= now + timedelta(days=3)
        )
        .all()
    )
    for e in upcoming_exams:
        exists = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.notification_type == "exam",
            Notification.title.like(f"%{e.title}%"),
            Notification.created_at >= now - timedelta(hours=24)
        ).first()
        if not exists:
            notif = Notification(
                user_id=user_id,
                title=f"Upcoming Examination: {e.title}",
                message=f"Examination '{e.title}' is coming up on {e.due_date.strftime('%A, %b %d')}. Be prepared!",
                notification_type="exam",
                link_url="/study-planner",
                is_read=False
            )
            db.add(notif)
            created_notifications.append(notif)

    # 3. Check attendance warnings
    subjects = db.query(Subject).filter(Subject.user_id == user_id).all()
    for s in subjects:
        records = db.query(AttendanceRecord).filter(AttendanceRecord.user_id == user_id, AttendanceRecord.subject_id == s.id).all()
        if records:
            total = len(records)
            present = sum(1 for r in records if r.status == "present")
            pct = round((present / total) * 100, 1)
            if pct < min_attendance:
                exists = db.query(Notification).filter(
                    Notification.user_id == user_id,
                    Notification.notification_type == "attendance_warning",
                    Notification.title.like(f"%{s.name}%"),
                    Notification.created_at >= now - timedelta(days=3)
                ).first()
                if not exists:
                    notif = Notification(
                        user_id=user_id,
                        title=f"Attendance Warning: {s.name}",
                        message=f"Your attendance in {s.name} ({pct}%) is below your minimum threshold of {min_attendance}%.",
                        notification_type="attendance_warning",
                        link_url="/attendance",
                        is_read=False
                    )
                    db.add(notif)
                    created_notifications.append(notif)

    if created_notifications:
        db.commit()

    return created_notifications
