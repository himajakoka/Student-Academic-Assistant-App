from datetime import date, datetime, timedelta, time
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.timetable import TimetableEntry
from app.models.task import Task
from app.models.marks import Assessment
from app.models.subject import Subject
from app.models.study_plan import StudySession
from app.models.user import StudentProfile

DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

def parse_time_str(t_str: str) -> int:
    """Convert 'HH:MM' string to minutes from midnight."""
    parts = t_str.split(":")
    return int(parts[0]) * 60 + int(parts[1])

def minutes_to_time_str(minutes: int) -> str:
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"

def generate_intelligent_study_plan(
    user_id: int,
    db: Session,
    days_ahead: int = 7,
    daily_available_hours: float = 4.0,
    break_duration_minutes: int = 15,
    target_date: date = None
) -> Tuple[List[StudySession], List[str], str]:
    """
    Intelligent workload-balancing study planning engine.
    - Avoids timetable class overlaps.
    - Prioritizes pending tasks with highest priority scores / upcoming deadlines.
    - Allocates extra revision sessions for subjects with recorded low test scores (< 60%).
    - Generates explainable reasons for each session.
    """
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()
    if profile:
        if daily_available_hours is None or daily_available_hours <= 0:
            daily_available_hours = profile.preferred_study_hours_per_day or 4.0
        if break_duration_minutes is None:
            break_duration_minutes = profile.preferred_break_duration_minutes or 15

    subjects = db.query(Subject).filter(Subject.user_id == user_id).all()
    tasks = (
        db.query(Task)
        .filter(Task.user_id == user_id, Task.status != "completed")
        .order_by(Task.priority_score.desc(), Task.due_date.asc())
        .all()
    )
    timetable_entries = db.query(TimetableEntry).filter(TimetableEntry.user_id == user_id).all()
    assessments = db.query(Assessment).filter(Assessment.user_id == user_id).all()

    warnings = []
    if not subjects:
        warnings.append("No subjects found in your profile. Please add subjects to generate a personalized study plan.")
        return [], warnings, "Unable to generate study plan: No subjects registered."

    if not tasks:
        warnings.append("No pending tasks or examinations recorded. The planner will schedule general revision sessions for your active subjects.")

    # Find weak subjects (average score < 65%)
    subject_marks: Dict[int, List[float]] = {}
    for a in assessments:
        subject_marks.setdefault(a.subject_id, []).append(a.percentage)
    
    weak_subject_ids = set()
    for s_id, scores in subject_marks.items():
        if scores and (sum(scores) / len(scores)) < 65.0:
            weak_subject_ids.add(s_id)

    # Classify timetable by day
    timetable_by_day: Dict[str, List[Tuple[int, int]]] = {}
    for entry in timetable_entries:
        start_m = parse_time_str(entry.start_time)
        end_m = parse_time_str(entry.end_time)
        timetable_by_day.setdefault(entry.day_of_week.capitalize(), []).append((start_m, end_m))

    # Available evening/afternoon study slots: default between 16:00 (960 min) and 22:30 (1350 min)
    # Session length: 60-90 minutes
    session_length = 90
    max_sessions_per_day = max(1, int((daily_available_hours * 60) // (session_length + break_duration_minutes)))

    start_date = target_date or date.today()
    generated_sessions: List[StudySession] = []

    # Queue of study tasks/subjects
    task_idx = 0
    subject_idx = 0

    for day_offset in range(days_ahead):
        current_day_date = start_date + timedelta(days=day_offset)
        day_name = current_day_date.strftime("%A")
        busy_intervals = timetable_by_day.get(day_name, [])

        # Start search for available window from 16:30 (990 mins)
        current_slot_start = 990
        day_sessions_created = 0

        while day_sessions_created < max_sessions_per_day and current_slot_start + session_length <= 1350:
            slot_end = current_slot_start + session_length

            # Check overlap with timetable classes
            has_overlap = False
            for busy_start, busy_end in busy_intervals:
                if not (slot_end <= busy_start or current_slot_start >= busy_end):
                    has_overlap = True
                    current_slot_start = busy_end + break_duration_minutes
                    break

            if has_overlap:
                continue

            # Decide what to study
            assigned_task: Task = None
            assigned_subject: Subject = None
            reason: str = ""

            # 1. First priority: Pending task with high urgency
            if tasks and task_idx < len(tasks):
                assigned_task = tasks[task_idx]
                if assigned_task.subject_id:
                    assigned_subject = db.query(Subject).filter(Subject.id == assigned_task.subject_id).first()
                title = f"Task Sprint: {assigned_task.title}"
                reason = f"Urgent deadline: {assigned_task.priority_reason or 'High priority coursework'}"
                task_idx += 1
            # 2. Second priority: Weak subject reinforcement
            elif weak_subject_ids:
                weak_id = list(weak_subject_ids)[subject_idx % len(weak_subject_ids)]
                assigned_subject = db.query(Subject).filter(Subject.id == weak_id).first()
                title = f"Concept Mastery: {assigned_subject.name if assigned_subject else 'Subject Review'}"
                reason = f"Targeted review: Subject test average is below target ({assigned_subject.name if assigned_subject else ''})."
                subject_idx += 1
            # 3. Third priority: Rotational subject revision
            elif subjects:
                assigned_subject = subjects[subject_idx % len(subjects)]
                title = f"Topic Revision: {assigned_subject.name}"
                reason = f"Standard revision cycle to reinforce weekly lecture material."
                subject_idx += 1
            else:
                break

            session = StudySession(
                user_id=user_id,
                subject_id=assigned_subject.id if assigned_subject else None,
                task_id=assigned_task.id if assigned_task else None,
                title=title,
                session_date=current_day_date,
                start_time=minutes_to_time_str(current_slot_start),
                end_time=minutes_to_time_str(slot_end),
                duration_minutes=session_length,
                status="scheduled",
                recommendation_reason=reason,
                is_accepted=True
            )
            generated_sessions.append(session)
            day_sessions_created += 1
            current_slot_start = slot_end + break_duration_minutes

    explanation = (
        f"Generated {len(generated_sessions)} structured study sessions over {days_ahead} days. "
        f"The planner reserved {daily_available_hours}h/day, scheduled around your registered classes, "
        f"and prioritized pressing assignment deadlines and lower-scoring subjects."
    )

    return generated_sessions, warnings, explanation
