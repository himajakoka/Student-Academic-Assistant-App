from datetime import datetime, timezone

def calculate_priority_score(
    task_type: str,
    priority: str,
    due_date: datetime,
    estimated_effort_minutes: int,
    is_completed: bool = False
) -> tuple[float, str]:
    """
    Deterministic priority scoring formula (0.0 to 100.0).
    Components:
    1. Base Priority Weight (10 to 40 pts)
    2. Task Type Weight (10 to 35 pts)
    3. Urgency / Time-to-Deadline Weight (3 to 35 pts)
    4. Effort Factor (2 to 10 pts)
    """
    if is_completed:
        return 0.0, "Task is already completed."

    # 1. Base Priority Weight
    p_weights = {
        "urgent": 40.0,
        "high": 30.0,
        "medium": 20.0,
        "low": 10.0,
    }
    p_score = p_weights.get(priority.lower(), 20.0)

    # 2. Task Type Weight
    type_weights = {
        "examination": 35.0,
        "assignment": 25.0,
        "project": 20.0,
        "revision": 15.0,
        "personal": 10.0,
    }
    t_score = type_weights.get(task_type.lower(), 15.0)

    # 3. Urgency / Time to deadline
    now = datetime.now(timezone.utc)
    # Ensure due_date is offset-aware
    if due_date.tzinfo is None:
        due_date_aware = due_date.replace(tzinfo=timezone.utc)
    else:
        due_date_aware = due_date

    diff_seconds = (due_date_aware - now).total_seconds()
    hours_left = diff_seconds / 3600.0

    if hours_left < 0:
        u_score = 35.0
        urgency_text = f"OVERDUE by {abs(int(hours_left))}h"
    elif hours_left <= 24:
        u_score = 30.0
        urgency_text = f"due in {max(1, int(hours_left))}h"
    elif hours_left <= 72:
        u_score = 22.0
        urgency_text = f"due in {int(hours_left / 24)}d"
    elif hours_left <= 168:  # 7 days
        u_score = 15.0
        urgency_text = f"due in {int(hours_left / 24)}d"
    elif hours_left <= 336:  # 14 days
        u_score = 8.0
        urgency_text = f"due in {int(hours_left / 24)}d"
    else:
        u_score = 3.0
        urgency_text = f"due in {int(hours_left / 24)}d"

    # 4. Effort factor
    if estimated_effort_minutes >= 180:
        e_score = 10.0
        effort_text = f"{estimated_effort_minutes // 60}h effort"
    elif estimated_effort_minutes >= 120:
        e_score = 7.0
        effort_text = "2h effort"
    elif estimated_effort_minutes >= 60:
        e_score = 4.0
        effort_text = "1h effort"
    else:
        e_score = 2.0
        effort_text = f"{estimated_effort_minutes}m effort"

    # Total score bounded between 0 and 100
    raw_total = p_score + t_score + u_score + e_score
    # Normalize with 120 max theoretical to 100 max scale
    normalized_score = min(100.0, round((raw_total / 120.0) * 100.0, 1))

    reason = f"{task_type.capitalize()} ({priority} priority, {urgency_text}, {effort_text})"
    return normalized_score, reason
