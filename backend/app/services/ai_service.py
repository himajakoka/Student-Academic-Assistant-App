import json
from typing import Tuple, List, Optional
import httpx
from app.config import settings
from app.schemas.chat import SourceReference
from app.schemas.dashboard import DailyBriefing
from datetime import datetime, timezone

SYSTEM_INSTRUCTION = """You are an intelligent, helpful, and empathetic Personal Student Academic & Life Assistant for the academic year 2026-2027.
You help students manage their timetable, tasks, assignments, examinations, attendance, study schedules, and uploaded notes/documents.

CRITICAL RULES:
1. ONLY state personal facts (classes, due dates, attendance percentages, marks, or document text) that are present in the provided AUTHORIZED STUDENT CONTEXT.
2. If the student asks about a specific class, deadline, mark, attendance status, or document that is NOT in the context, explicitly say that the information is currently not recorded or unavailable in their database.
3. Distinguish saved facts from general educational concepts. For general study questions, explain clearly with examples.
4. Keep answers structured, encouraging, concise, and academically actionable.
"""

def generate_local_demo_response(
    query: str,
    context: str,
    sources: List[SourceReference]
) -> str:
    """Generate a clean, deterministic grounded demo response when no external LLM key is configured."""
    q_lower = query.lower()

    if any(w in q_lower for w in ["timetable", "class", "lecture", "schedule", "today", "tomorrow"]):
        if "### SAVED TIMETABLE:" in context:
            return (
                "**[DEMO MODE: Grounded on your saved timetable]**\n\n"
                "Here is your timetable schedule extracted from your database:\n\n"
                f"{context.split('### SAVED TIMETABLE:')[1].split('###')[0].strip()}\n\n"
                "Tip: Make sure to review your classroom locations ahead of time."
            )
        else:
            return "**[DEMO MODE]** You currently do not have any timetable entries scheduled in your database. Please add your subjects and classes in the Timetable section."

    if any(w in q_lower for w in ["task", "assignment", "due", "deadline", "exam", "pending"]):
        if "### TASKS & DEADLINES:" in context:
            return (
                "**[DEMO MODE: Grounded on your saved tasks]**\n\n"
                "Here are your upcoming tasks and examinations from your registry:\n\n"
                f"{context.split('### TASKS & DEADLINES:')[1].split('###')[0].strip()}\n\n"
                "Recommendation: Prioritize urgent items first using the Study Planner."
            )
        else:
            return "**[DEMO MODE]** You have no active pending tasks or exams recorded right now. You can create a new assignment or examination from the Tasks page."

    if any(w in q_lower for w in ["attendance", "present", "absent", "shortage", "percentage"]):
        if "### ATTENDANCE RECORDS:" in context:
            return (
                "**[DEMO MODE: Grounded on your saved attendance]**\n\n"
                "Here is your current subject-wise attendance breakdown:\n\n"
                f"{context.split('### ATTENDANCE RECORDS:')[1].split('###')[0].strip()}\n\n"
                "Notice: Attend upcoming lectures consistently to keep your overall attendance safely above the target threshold."
            )
        else:
            return "**[DEMO MODE]** No attendance logs were found in your records. Mark your daily class attendance in the Attendance module."

    if any(w in q_lower for w in ["mark", "marks", "score", "scores", "assessment", "cgpa", "performance"]):
        if "### RECORDED MARKS & ASSESSMENTS:" in context:
            return (
                "**[DEMO MODE: Grounded on your assessment scores]**\n\n"
                "Here are your recorded test and assignment results:\n\n"
                f"{context.split('### RECORDED MARKS & ASSESSMENTS:')[1].split('###')[0].strip()}\n\n"
                "Insight: Review the Marks Analytics dashboard for subject-wise trend charts."
            )
        else:
            return "**[DEMO MODE]** No assessments or exam scores are currently saved in your profile. Add your test results in the Marks & Analytics tab."

    if "### RELEVANT DOCUMENT EXCERPTS:" in context:
        doc_snippet = context.split("### RELEVANT DOCUMENT EXCERPTS:")[1].split("###")[0].strip()
        return (
            "**[DEMO MODE: Grounded on your uploaded documents]**\n\n"
            f"Based on your uploaded course materials:\n\n"
            f"{doc_snippet}\n\n"
            "If you need a deeper explanation of any specific formula or section, let me know!"
        )

    # General academic fallback
    return (
        f"**[DEMO MODE - Local Assistant]**\n\n"
        f"I received your inquiry: *\"{query}\"*\n\n"
        "I am operating in **Local Academic Demo Mode** because no live Gemini API key is configured. "
        "I can directly inspect and answer questions regarding your saved timetable, assignments, attendance logs, exam marks, and uploaded vault documents.\n\n"
        "To enable live generative LLM intelligence, add your `GEMINI_API_KEY` to the `.env` file."
    )

async def ask_ai(
    query: str,
    context: str,
    sources: List[SourceReference],
    conversation_history: Optional[List[dict]] = None
) -> Tuple[str, bool]:
    """
    Calls Gemini API if available, otherwise falls back gracefully to local demo mode.
    Returns: (response_text, is_demo)
    """
    api_key = settings.GEMINI_API_KEY.strip()
    if not api_key:
        return generate_local_demo_response(query, context, sources), True

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={api_key}"

    # Build prompt
    prompt = f"{SYSTEM_INSTRUCTION}\n\nAUTHORIZED STUDENT CONTEXT SCOPED TO CURRENT USER:\n{context}\n\nSTUDENT QUESTION:\n{query}"

    contents = []
    if conversation_history:
        for msg in conversation_history[-6:]:
            role = "user" if msg.get("role") == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 1024,
        }
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text = parts[0].get("text", "")
                        return text, False

            # If response not 200, log and fall back to local demo
            return (
                f"[DEMO MODE - API Service Returned Status {resp.status_code}. Fallback engaged]\n\n" +
                generate_local_demo_response(query, context, sources),
                True
            )
    except Exception as e:
        return (
            f"[DEMO MODE - Network/API Timeout. Fallback engaged]\n\n" +
            generate_local_demo_response(query, context, sources),
            True
        )

def generate_daily_briefing(
    student_name: str,
    todays_classes_count: int,
    pending_tasks_count: int,
    overdue_tasks_count: int,
    attendance_pct: float,
    is_warning: bool
) -> DailyBriefing:
    """Generates an actionable daily briefing summary."""
    highlights = []
    
    if todays_classes_count > 0:
        highlights.append(f"You have {todays_classes_count} scheduled class{'es' if todays_classes_count > 1 else ''} today.")
    else:
        highlights.append("No classes scheduled for today. Great day for revision and deep study.")

    if overdue_tasks_count > 0:
        highlights.append(f"Attention: {overdue_tasks_count} task{'s are' if overdue_tasks_count > 1 else ' is'} currently overdue!")
    elif pending_tasks_count > 0:
        highlights.append(f"{pending_tasks_count} pending assignment{'s' if pending_tasks_count > 1 else ''} in progress.")
    else:
        highlights.append("All tasks and assignments are up to date!")

    if is_warning:
        highlights.append(f"Attendance warning: Your current overall average is {attendance_pct}%, which is below target.")
    else:
        highlights.append(f"Attendance is healthy at {attendance_pct}%.")

    summary = (
        f"Good day, {student_name}! You have {todays_classes_count} classes and "
        f"{pending_tasks_count} pending tasks on your agenda. "
        + ("Please address your overdue tasks immediately." if overdue_tasks_count > 0 else "Keep up the consistent momentum!")
    )

    return DailyBriefing(
        summary=summary,
        highlights=highlights,
        is_ai_generated=False,
        generated_at=datetime.now(timezone.utc)
    )
