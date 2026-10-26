import re
import math
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.document import Document, DocumentChunk
from app.models.timetable import TimetableEntry
from app.models.task import Task
from app.models.attendance import AttendanceRecord
from app.models.marks import Assessment
from app.models.subject import Subject
from app.schemas.chat import SourceReference

def tokenize(text: str) -> List[str]:
    return [w.lower() for w in re.findall(r'\b[a-zA-Z0-9_]{2,}\b', text)]

def calculate_relevance_score(query_tokens: List[str], text: str) -> float:
    if not query_tokens or not text:
        return 0.0
    text_lower = text.lower()
    score = 0.0
    for token in query_tokens:
        count = text_lower.count(token)
        if count > 0:
            score += 1.0 + math.log(1.0 + count)
    return score

def retrieve_authorized_context(
    query: str,
    user_id: int,
    db: Session,
    max_chunks: int = 4
) -> Tuple[str, List[SourceReference]]:
    """
    Retrieves authorized academic records and document passages scoped strictly to user_id.
    Returns:
        context_str: Formatted text to inject into the LLM system/user context.
        sources: Structured references to return in the API response for citations.
    """
    query_tokens = tokenize(query)
    sources: List[SourceReference] = []
    context_sections = []

    # 1. Search uploaded document chunks
    chunks = db.query(DocumentChunk).filter(DocumentChunk.user_id == user_id).all()
    scored_chunks = []
    for chunk in chunks:
        score = calculate_relevance_score(query_tokens, chunk.chunk_text)
        if score > 0:
            scored_chunks.append((score, chunk))

    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    top_chunks = scored_chunks[:max_chunks]

    if top_chunks:
        doc_texts = []
        for score, chunk in top_chunks:
            doc = db.query(Document).filter(Document.id == chunk.document_id).first()
            doc_title = doc.title if doc else "Document"
            doc_texts.append(f"[{doc_title} (Chunk {chunk.chunk_index})]:\n{chunk.chunk_text}")
            sources.append(SourceReference(
                source_type="document",
                title=doc_title,
                reference_detail=f"Uploaded Document: {doc_title} (Section {chunk.chunk_index + 1})"
            ))
        context_sections.append("### RELEVANT DOCUMENT EXCERPTS:\n" + "\n\n".join(doc_texts))

    # 2. Check if query is related to timetable
    timetable_keywords = {"timetable", "schedule", "class", "classes", "lecture", "faculty", "room", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "today", "tomorrow"}
    if any(k in query_tokens for k in timetable_keywords) or len(query_tokens) < 3:
        entries = (
            db.query(TimetableEntry, Subject)
            .join(Subject, TimetableEntry.subject_id == Subject.id)
            .filter(TimetableEntry.user_id == user_id)
            .all()
        )
        if entries:
            tt_lines = []
            for entry, subj in entries:
                tt_lines.append(f"- {entry.day_of_week} {entry.start_time}-{entry.end_time}: {subj.name} ({subj.code}) in {entry.classroom}, Faculty: {entry.faculty_name or subj.faculty or 'N/A'}")
            context_sections.append("### SAVED TIMETABLE:\n" + "\n".join(tt_lines))
            sources.append(SourceReference(
                source_type="timetable",
                title="Weekly Timetable",
                reference_detail=f"{len(entries)} regular class sessions registered in database"
            ))

    # 3. Check if query is related to tasks / assignments / exams
    task_keywords = {"task", "tasks", "assignment", "assignments", "exam", "exams", "examination", "project", "deadline", "due", "pending", "urgent", "priority"}
    if any(k in query_tokens for k in task_keywords) or len(query_tokens) < 3:
        tasks = db.query(Task).filter(Task.user_id == user_id).order_by(Task.due_date.asc()).all()
        if tasks:
            task_lines = []
            for t in tasks:
                subj = db.query(Subject).filter(Subject.id == t.subject_id).first() if t.subject_id else None
                subj_name = subj.name if subj else "General"
                task_lines.append(f"- [{t.status.upper()}] {t.title} ({t.task_type.capitalize()} for {subj_name}): Due {t.due_date.strftime('%Y-%m-%d %H:%M')}, Priority: {t.priority} (Score {t.priority_score})")
            context_sections.append("### TASKS & DEADLINES:\n" + "\n".join(task_lines))
            sources.append(SourceReference(
                source_type="task",
                title="Student Task Registry",
                reference_detail=f"{len(tasks)} tracked assignments & exams"
            ))

    # 4. Check if query is related to attendance
    attendance_keywords = {"attendance", "present", "absent", "leave", "bunk", "percentage", "shortage", "eligible", "minimum"}
    if any(k in query_tokens for k in attendance_keywords):
        subjects = db.query(Subject).filter(Subject.id == Subject.id, Subject.user_id == user_id).all()
        att_lines = []
        for s in subjects:
            records = db.query(AttendanceRecord).filter(AttendanceRecord.user_id == user_id, AttendanceRecord.subject_id == s.id).all()
            total = len(records)
            present = sum(1 for r in records if r.status == "present")
            pct = round((present / total * 100), 1) if total > 0 else 0.0
            att_lines.append(f"- {s.name} ({s.code}): {present}/{total} attended ({pct}%), Target: {s.target_attendance}%")
        if att_lines:
            context_sections.append("### ATTENDANCE RECORDS:\n" + "\n".join(att_lines))
            sources.append(SourceReference(
                source_type="attendance",
                title="Attendance Records",
                reference_detail="Subject-wise logged class attendance"
            ))

    # 5. Check if query is related to marks / assessments
    marks_keywords = {"mark", "marks", "grade", "score", "scores", "assessment", "exam", "quiz", "midterm", "performance", "average", "cgpa", "percentage"}
    if any(k in query_tokens for k in marks_keywords):
        assessments = db.query(Assessment, Subject).join(Subject, Assessment.subject_id == Subject.id).filter(Assessment.user_id == user_id).all()
        if assessments:
            marks_lines = []
            for a, s in assessments:
                marks_lines.append(f"- {s.name}: {a.assessment_name} ({a.assessment_type}) = {a.marks_obtained}/{a.maximum_marks} ({a.percentage}%) on {a.assessment_date}")
            context_sections.append("### RECORDED MARKS & ASSESSMENTS:\n" + "\n".join(marks_lines))
            sources.append(SourceReference(
                source_type="marks",
                title="Assessment Records",
                reference_detail=f"{len(assessments)} recorded scores"
            ))

    combined_context = "\n\n".join(context_sections) if context_sections else "No specific personal records directly matched the query keywords."
    return combined_context, sources
