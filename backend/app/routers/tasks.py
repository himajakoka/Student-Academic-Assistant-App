from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.task import Task
from app.models.subject import Subject
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskStatusUpdate
from app.services.priority_service import calculate_priority_score
from app.routers.deps import get_current_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])

def build_task_response(task: Task) -> TaskResponse:
    now = datetime.now(timezone.utc)
    due_aware = task.due_date.replace(tzinfo=timezone.utc) if task.due_date.tzinfo is None else task.due_date
    is_overdue = (task.status != "completed") and (due_aware < now)
    
    subj = task.subject
    return TaskResponse(
        id=task.id,
        user_id=task.user_id,
        subject_id=task.subject_id,
        subject_name=subj.name if subj else None,
        subject_code=subj.code if subj else None,
        subject_color=subj.color if subj else "#4f46e5",
        title=task.title,
        description=task.description,
        task_type=task.task_type,
        due_date=task.due_date,
        estimated_effort_minutes=task.estimated_effort_minutes,
        priority=task.priority,
        priority_score=task.priority_score,
        priority_reason=task.priority_reason,
        status=task.status,
        completed_at=task.completed_at,
        is_overdue=is_overdue,
        created_at=task.created_at,
        updated_at=task.updated_at
    )

@router.get("", response_model=List[TaskResponse])
def get_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    subject_id: Optional[int] = None,
    task_type: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = Query("urgency", description="urgency, priority_score, due_date, created_at"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Task).filter(Task.user_id == current_user.id)

    if status:
        query = query.filter(Task.status == status.lower())
    if priority:
        query = query.filter(Task.priority == priority.lower())
    if subject_id:
        query = query.filter(Task.subject_id == subject_id)
    if task_type:
        query = query.filter(Task.task_type == task_type.lower())
    if search:
        query = query.filter(Task.title.ilike(f"%{search}%") | Task.description.ilike(f"%{search}%"))

    # Sorting
    if sort_by == "priority_score":
        query = query.order_by(Task.priority_score.desc())
    elif sort_by == "due_date":
        query = query.order_by(Task.due_date.asc())
    elif sort_by == "created_at":
        query = query.order_by(Task.created_at.desc())
    else:  # "urgency" default
        query = query.order_by(Task.due_date.asc(), Task.priority_score.desc())

    tasks = query.all()
    return [build_task_response(t) for t in tasks]

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if task_in.subject_id:
        subj = db.query(Subject).filter(Subject.id == task_in.subject_id, Subject.user_id == current_user.id).first()
        if not subj:
            raise HTTPException(status_code=400, detail="Invalid subject ID.")

    score, reason = calculate_priority_score(
        task_type=task_in.task_type,
        priority=task_in.priority or "medium",
        due_date=task_in.due_date,
        estimated_effort_minutes=task_in.estimated_effort_minutes,
        is_completed=False
    )

    task = Task(
        user_id=current_user.id,
        subject_id=task_in.subject_id,
        title=task_in.title,
        description=task_in.description,
        task_type=task_in.task_type,
        due_date=task_in.due_date,
        estimated_effort_minutes=task_in.estimated_effort_minutes,
        priority=task_in.priority or "medium",
        priority_score=score,
        priority_reason=reason,
        status="pending"
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return build_task_response(task)

@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return build_task_response(task)

@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_in: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    update_data = task_in.model_dump(exclude_unset=True)

    if "subject_id" in update_data and update_data["subject_id"]:
        subj = db.query(Subject).filter(Subject.id == update_data["subject_id"], Subject.user_id == current_user.id).first()
        if not subj:
            raise HTTPException(status_code=400, detail="Invalid subject ID.")

    for field, val in update_data.items():
        setattr(task, field, val)

    # Re-calculate priority score
    is_done = task.status == "completed"
    if is_done and not task.completed_at:
        task.completed_at = datetime.now(timezone.utc)
    elif not is_done:
        task.completed_at = None

    score, reason = calculate_priority_score(
        task_type=task.task_type,
        priority=task.priority,
        due_date=task.due_date,
        estimated_effort_minutes=task.estimated_effort_minutes,
        is_completed=is_done
    )
    task.priority_score = score
    task.priority_reason = reason

    db.commit()
    db.refresh(task)
    return build_task_response(task)

@router.patch("/{task_id}/status", response_model=TaskResponse)
def update_task_status(
    task_id: int,
    status_in: TaskStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    task.status = status_in.status.lower()
    if task.status == "completed":
        task.completed_at = datetime.now(timezone.utc)
        task.priority_score = 0.0
        task.priority_reason = "Completed"
    else:
        task.completed_at = None
        score, reason = calculate_priority_score(
            task_type=task.task_type,
            priority=task.priority,
            due_date=task.due_date,
            estimated_effort_minutes=task.estimated_effort_minutes,
            is_completed=False
        )
        task.priority_score = score
        task.priority_reason = reason

    db.commit()
    db.refresh(task)
    return build_task_response(task)

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    db.delete(task)
    db.commit()
    return None
