from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, StudentProfile, UserPreference
from app.schemas.auth import UserRegister, UserLogin, Token, ChangePasswordRequest
from app.schemas.profile import ProfileResponse
from app.utils.security import get_password_hash, verify_password, create_access_token
from app.routers.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    # Create user
    user = User(
        email=user_in.email.lower(),
        hashed_password=get_password_hash(user_in.password),
        is_active=True
    )
    db.add(user)
    db.flush()

    # Create default student profile
    profile = StudentProfile(
        user_id=user.id,
        full_name=user_in.full_name,
        college=user_in.college or "National Institute of Technology",
        course=user_in.course or "B.Tech Computer Science & Engineering",
        semester=user_in.semester or "Semester 6",
        academic_year=user_in.academic_year or "2026-2027",
        preferred_study_hours_per_day=4.0,
        preferred_break_duration_minutes=15,
        minimum_attendance_target=75.0
    )
    db.add(profile)

    # Create default user preference
    pref = UserPreference(
        user_id=user.id,
        theme="light",
        attendance_warning_threshold=75.0,
        email_notifications=True,
        sound_enabled=True,
        reminder_hours_before_deadline=24,
        auto_generate_study_plans=True
    )
    db.add(pref)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"user_id": user.id, "email": user.email})
    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=profile.full_name
    )

@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_in.email.lower()).first()
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account is deactivated.")

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    full_name = profile.full_name if profile else "Student"

    token = create_access_token(data={"user_id": user.id, "email": user.email})
    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=full_name
    )

@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    
    current_user.hashed_password = get_password_hash(req.new_password)
    db.commit()
    return {"message": "Password changed successfully."}

@router.get("/me", response_model=ProfileResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found.")

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
