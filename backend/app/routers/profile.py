from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, StudentProfile, UserPreference
from app.schemas.profile import ProfileResponse, ProfileUpdate, PreferenceResponse, PreferenceUpdate
from app.routers.deps import get_current_user

router = APIRouter(prefix="/profile", tags=["Student Profile"])

@router.get("", response_model=ProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return ProfileResponse(
        id=profile.id,
        user_id=current_user.id,
        email=current_user.email,
        full_name=profile.full_name,
        college=profile.college,
        course=profile.course,
        semester=profile.semester,
        academic_year=profile.academic_year,
        avatar_url=profile.avatar_url,
        preferred_study_hours_per_day=profile.preferred_study_hours_per_day,
        preferred_break_duration_minutes=profile.preferred_break_duration_minutes,
        minimum_attendance_target=profile.minimum_attendance_target
    )

@router.put("", response_model=ProfileResponse)
def update_profile(
    prof_in: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    update_data = prof_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(profile, field, val)

    db.commit()
    db.refresh(profile)

    return ProfileResponse(
        id=profile.id,
        user_id=current_user.id,
        email=current_user.email,
        full_name=profile.full_name,
        college=profile.college,
        course=profile.course,
        semester=profile.semester,
        academic_year=profile.academic_year,
        avatar_url=profile.avatar_url,
        preferred_study_hours_per_day=profile.preferred_study_hours_per_day,
        preferred_break_duration_minutes=profile.preferred_break_duration_minutes,
        minimum_attendance_target=profile.minimum_attendance_target
    )

@router.get("/preferences", response_model=PreferenceResponse)
def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref

@router.put("/preferences", response_model=PreferenceResponse)
def update_preferences(
    pref_in: PreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)

    update_data = pref_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(pref, field, val)

    db.commit()
    db.refresh(pref)
    return pref
