from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.subject import Subject
from app.schemas.subject import SubjectCreate, SubjectUpdate, SubjectResponse
from app.routers.deps import get_current_user

router = APIRouter(prefix="/subjects", tags=["Subjects"])

@router.get("", response_model=List[SubjectResponse])
def get_subjects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Subject).filter(Subject.user_id == current_user.id).all()

@router.post("", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    subj_in: SubjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing = db.query(Subject).filter(
        Subject.user_id == current_user.id,
        Subject.code == subj_in.code.upper()
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Subject with code '{subj_in.code.upper()}' already exists in your course list."
        )

    subj = Subject(
        user_id=current_user.id,
        name=subj_in.name,
        code=subj_in.code.upper(),
        faculty=subj_in.faculty,
        semester=subj_in.semester or "Semester 6",
        color=subj_in.color or "#4f46e5",
        target_attendance=subj_in.target_attendance or 75.0
    )
    db.add(subj)
    db.commit()
    db.refresh(subj)
    return subj

@router.put("/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: int,
    subj_in: SubjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    subj = db.query(Subject).filter(Subject.id == subject_id, Subject.user_id == current_user.id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found or unauthorized.")

    update_data = subj_in.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"]:
        update_data["code"] = update_data["code"].upper()

    for field, val in update_data.items():
        setattr(subj, field, val)

    db.commit()
    db.refresh(subj)
    return subj

@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    subj = db.query(Subject).filter(Subject.id == subject_id, Subject.user_id == current_user.id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found or unauthorized.")

    db.delete(subj)
    db.commit()
    return None
