from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.marks import Assessment
from app.models.subject import Subject
from app.schemas.marks import (
    AssessmentCreate,
    AssessmentUpdate,
    AssessmentResponse,
    SubjectPerformanceSummary,
    PerformanceAnalyticsResponse,
)
from app.routers.deps import get_current_user

router = APIRouter(prefix="/marks", tags=["Marks & Analytics"])

def build_assessment_response(a: Assessment) -> AssessmentResponse:
    subj = a.subject
    return AssessmentResponse(
        id=a.id,
        user_id=a.user_id,
        subject_id=a.subject_id,
        subject_name=subj.name if subj else "Unknown",
        subject_code=subj.code if subj else "",
        subject_color=subj.color if subj else "#4f46e5",
        assessment_name=a.assessment_name,
        assessment_type=a.assessment_type,
        marks_obtained=a.marks_obtained,
        maximum_marks=a.maximum_marks,
        percentage=a.percentage,
        assessment_date=a.assessment_date,
        notes=a.notes,
        created_at=a.created_at
    )

@router.get("", response_model=List[AssessmentResponse])
def get_assessments(
    subject_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Assessment).filter(Assessment.user_id == current_user.id)
    if subject_id:
        query = query.filter(Assessment.subject_id == subject_id)
    assessments = query.order_by(Assessment.assessment_date.desc()).all()
    return [build_assessment_response(a) for a in assessments]

@router.get("/analytics", response_model=PerformanceAnalyticsResponse)
def get_performance_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    subjects = db.query(Subject).filter(Subject.user_id == current_user.id).all()
    assessments = db.query(Assessment).filter(Assessment.user_id == current_user.id).order_by(Assessment.assessment_date.asc()).all()

    subject_summaries = []
    weak_subjects = []
    insights = []

    all_percentages = [a.percentage for a in assessments]
    overall_avg = round(sum(all_percentages) / len(all_percentages), 1) if all_percentages else 0.0

    for s in subjects:
        s_assessments = [a for a in assessments if a.subject_id == s.id]
        if s_assessments:
            s_pcts = [a.percentage for a in s_assessments]
            avg = round(sum(s_pcts) / len(s_pcts), 1)
            highest = max(s_pcts)
            lowest = min(s_pcts)
            is_weak = avg < 65.0
            if is_weak:
                weak_subjects.append(s.name)

            subject_summaries.append(SubjectPerformanceSummary(
                subject_id=s.id,
                subject_name=s.name,
                subject_code=s.code,
                color=s.color or "#4f46e5",
                assessment_count=len(s_assessments),
                average_percentage=avg,
                highest_percentage=highest,
                lowest_percentage=lowest,
                is_weak_subject=is_weak
            ))
        else:
            # Subject has no recorded assessments yet
            subject_summaries.append(SubjectPerformanceSummary(
                subject_id=s.id,
                subject_name=s.name,
                subject_code=s.code,
                color=s.color or "#4f46e5",
                assessment_count=0,
                average_percentage=0.0,
                highest_percentage=0.0,
                lowest_percentage=0.0,
                is_weak_subject=False
            ))

    # Explainable insights based strictly on recorded scores
    if len(assessments) == 0:
        insights.append("No assessments recorded yet. Add your marks to unlock performance analytics and trends.")
    elif len(assessments) < 3:
        insights.append(f"Recorded {len(assessments)} assessment(s). More test data is needed to identify statistically meaningful trends.")
    else:
        # Check trend of last 3 assessments
        recent_3 = assessments[-3:]
        if recent_3[-1].percentage > recent_3[0].percentage:
            insights.append("Positive trajectory: Your recent assessment scores show an upward improvement.")
        elif recent_3[-1].percentage < recent_3[0].percentage:
            insights.append("Downward score fluctuation detected in your latest test. Consider scheduling revision sessions.")
        else:
            insights.append("Performance consistency maintained across your latest evaluations.")

    if weak_subjects:
        insights.append(f"Focus area: Lower average scores recorded in {', '.join(weak_subjects)}. The Study Planner will allocate reinforcement sessions.")

    recent_sorted = sorted(assessments, key=lambda x: x.assessment_date, reverse=True)[:5]

    return PerformanceAnalyticsResponse(
        overall_average=overall_avg,
        total_assessments=len(assessments),
        subject_performance=subject_summaries,
        weak_subjects=weak_subjects,
        insights=insights,
        recent_assessments=[build_assessment_response(a) for a in recent_sorted]
    )

@router.post("", response_model=AssessmentResponse, status_code=status.HTTP_201_CREATED)
def create_assessment(
    a_in: AssessmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    subj = db.query(Subject).filter(Subject.id == a_in.subject_id, Subject.user_id == current_user.id).first()
    if not subj:
        raise HTTPException(status_code=400, detail="Invalid subject ID or subject does not belong to you.")

    if a_in.marks_obtained > a_in.maximum_marks:
        raise HTTPException(status_code=400, detail="Marks obtained cannot exceed maximum marks.")

    percentage = round((a_in.marks_obtained / a_in.maximum_marks) * 100.0, 1)

    assessment = Assessment(
        user_id=current_user.id,
        subject_id=a_in.subject_id,
        assessment_name=a_in.assessment_name,
        assessment_type=a_in.assessment_type.lower(),
        marks_obtained=a_in.marks_obtained,
        maximum_marks=a_in.maximum_marks,
        percentage=percentage,
        assessment_date=a_in.assessment_date,
        notes=a_in.notes
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return build_assessment_response(assessment)

@router.put("/{assessment_id}", response_model=AssessmentResponse)
def update_assessment(
    assessment_id: int,
    a_in: AssessmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id, Assessment.user_id == current_user.id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found.")

    update_data = a_in.model_dump(exclude_unset=True)
    if "subject_id" in update_data and update_data["subject_id"]:
        subj = db.query(Subject).filter(Subject.id == update_data["subject_id"], Subject.user_id == current_user.id).first()
        if not subj:
            raise HTTPException(status_code=400, detail="Invalid subject ID.")

    new_obtained = update_data.get("marks_obtained", assessment.marks_obtained)
    new_max = update_data.get("maximum_marks", assessment.maximum_marks)

    if new_obtained > new_max:
        raise HTTPException(status_code=400, detail="Marks obtained cannot exceed maximum marks.")

    for field, val in update_data.items():
        setattr(assessment, field, val)

    assessment.percentage = round((new_obtained / new_max) * 100.0, 1)

    db.commit()
    db.refresh(assessment)
    return build_assessment_response(assessment)

@router.delete("/{assessment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assessment(
    assessment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id, Assessment.user_id == current_user.id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    db.delete(assessment)
    db.commit()
    return None
