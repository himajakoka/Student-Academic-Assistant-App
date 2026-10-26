import sys
import os
from datetime import datetime, date, timedelta, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import SessionLocal, engine, Base
from app.models.user import User, StudentProfile, UserPreference
from app.models.subject import Subject
from app.models.timetable import TimetableEntry
from app.models.task import Task
from app.models.attendance import AttendanceRecord
from app.models.marks import Assessment
from app.models.study_plan import StudySession
from app.models.document import Document, DocumentChunk
from app.models.chat import ChatConversation, ChatMessage
from app.models.notification import Notification
from app.utils.security import get_password_hash
from app.services.priority_service import calculate_priority_score
from app.services.document_parser import chunk_text
from app.services.study_planner_service import generate_intelligent_study_plan

DEMO_EMAIL = "student@academic.edu"
DEMO_PASSWORD = "password123"

def seed_database(reset: bool = False):
    db = SessionLocal()
    try:
        if reset:
            print("[INFO] Resetting all database tables...")
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
            print("[INFO] Database schema re-created successfully.")

        # Check if demo student exists
        existing_user = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if existing_user and not reset:
            print(f"[INFO] Demo account '{DEMO_EMAIL}' already exists. Skipping re-seed.")
            return

        print(f"[INFO] Creating demo student account: {DEMO_EMAIL} ...")
        user = User(
            email=DEMO_EMAIL,
            hashed_password=get_password_hash(DEMO_PASSWORD),
            is_active=True
        )
        db.add(user)
        db.flush()

        profile = StudentProfile(
            user_id=user.id,
            full_name="Alex Mercer",
            college="National Institute of Technology",
            course="B.Tech Computer Science & Engineering",
            semester="Semester 6",
            academic_year="2026-2027",
            avatar_url="",
            preferred_study_hours_per_day=4.0,
            preferred_break_duration_minutes=15,
            minimum_attendance_target=75.0
        )
        db.add(profile)

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
        db.flush()

        print("[INFO] Seeding academic subjects...")
        subjects_data = [
            {"name": "Distributed Systems", "code": "CS601", "faculty": "Dr. Sarah Jenkins", "color": "#4f46e5", "target": 75.0},
            {"name": "Machine Learning & Neural Nets", "code": "CS602", "faculty": "Prof. Alan Turing", "color": "#7c3aed", "target": 80.0},
            {"name": "Database Management & Warehousing", "code": "CS603", "faculty": "Dr. Michael Stone", "color": "#06b6d4", "target": 75.0},
            {"name": "Computer Networks & Security", "code": "CS604", "faculty": "Prof. Lisa Ray", "color": "#059669", "target": 75.0},
            {"name": "Cloud Computing Architecture", "code": "CS605", "faculty": "Dr. Robert Vance", "color": "#d97706", "target": 75.0},
        ]
        created_subjects = {}
        for s_info in subjects_data:
            s = Subject(
                user_id=user.id,
                name=s_info["name"],
                code=s_info["code"],
                faculty=s_info["faculty"],
                semester="Semester 6",
                color=s_info["color"],
                target_attendance=s_info["target"]
            )
            db.add(s)
            db.flush()
            created_subjects[s.code] = s

        print("[INFO] Seeding weekly timetable...")
        timetable_data = [
            # Monday
            {"code": "CS601", "day": "Monday", "start": "09:00", "end": "10:30", "room": "Hall 302"},
            {"code": "CS602", "day": "Monday", "start": "11:00", "end": "12:30", "room": "Lab 4B"},
            {"code": "CS603", "day": "Monday", "start": "14:00", "end": "15:30", "room": "Hall 105"},
            # Tuesday
            {"code": "CS604", "day": "Tuesday", "start": "09:30", "end": "11:00", "room": "Room 201"},
            {"code": "CS605", "day": "Tuesday", "start": "11:30", "end": "13:00", "room": "Cloud Lab"},
            # Wednesday
            {"code": "CS601", "day": "Wednesday", "start": "09:00", "end": "10:30", "room": "Hall 302"},
            {"code": "CS602", "day": "Wednesday", "start": "11:00", "end": "12:30", "room": "Lab 4B"},
            {"code": "CS604", "day": "Wednesday", "start": "14:00", "end": "15:30", "room": "Room 201"},
            # Thursday
            {"code": "CS603", "day": "Thursday", "start": "10:00", "end": "11:30", "room": "Hall 105"},
            {"code": "CS605", "day": "Thursday", "start": "13:00", "end": "14:30", "room": "Cloud Lab"},
            # Friday
            {"code": "CS602", "day": "Friday", "start": "09:30", "end": "11:00", "room": "Lab 4B"},
            {"code": "CS601", "day": "Friday", "start": "11:30", "end": "13:00", "room": "Hall 302"},
        ]
        for t_info in timetable_data:
            s_obj = created_subjects[t_info["code"]]
            entry = TimetableEntry(
                user_id=user.id,
                subject_id=s_obj.id,
                day_of_week=t_info["day"],
                start_time=t_info["start"],
                end_time=t_info["end"],
                classroom=t_info["room"],
                faculty_name=s_obj.faculty,
                notes=f"Regular lecture for {s_obj.name}"
            )
            db.add(entry)

        print("[INFO] Seeding tasks and upcoming examinations...")
        now = datetime.now(timezone.utc)
        tasks_data = [
            {
                "title": "Raft Consensus Algorithm Implementation",
                "code": "CS601",
                "type": "assignment",
                "days_offset": 2,
                "effort": 180,
                "priority": "high",
                "desc": "Implement leader election and log replication in Python/Go."
            },
            {
                "title": "Convolutional Neural Network Midterm Exam",
                "code": "CS602",
                "type": "examination",
                "days_offset": 5,
                "effort": 240,
                "priority": "urgent",
                "desc": "Covers backpropagation, CNN architectures (ResNet, VGG), and optimization algorithms."
            },
            {
                "title": "B-Tree Indexing & Query Optimization Benchmark",
                "code": "CS603",
                "type": "project",
                "days_offset": 8,
                "effort": 150,
                "priority": "medium",
                "desc": "Analyze execution plans using EXPLAIN ANALYZE on PostgreSQL."
            },
            {
                "title": "Network Packet Sniffing & TLS Handshake Lab",
                "code": "CS604",
                "type": "assignment",
                "days_offset": 4,
                "effort": 90,
                "priority": "medium",
                "desc": "Capture Wireshark pcap traces and explain TLS 1.3 key exchange."
            },
            {
                "title": "Kubernetes Microservices Deployment",
                "code": "CS605",
                "type": "assignment",
                "days_offset": 12,
                "effort": 120,
                "priority": "low",
                "desc": "Deploy containerized multi-tier service with Ingress controller."
            },
            {
                "title": "Read Academic Paper: MapReduce Foundations",
                "code": "CS601",
                "type": "revision",
                "days_offset": -1,  # Completed yesterday
                "effort": 60,
                "priority": "medium",
                "desc": "Summarize MapReduce fault tolerance mechanisms.",
                "completed": True
            }
        ]
        for td in tasks_data:
            s_obj = created_subjects.get(td["code"])
            due = now + timedelta(days=td["days_offset"])
            is_comp = td.get("completed", False)
            score, reason = calculate_priority_score(
                task_type=td["type"],
                priority=td["priority"],
                due_date=due,
                estimated_effort_minutes=td["effort"],
                is_completed=is_comp
            )
            t_obj = Task(
                user_id=user.id,
                subject_id=s_obj.id if s_obj else None,
                title=td["title"],
                description=td["desc"],
                task_type=td["type"],
                due_date=due,
                estimated_effort_minutes=td["effort"],
                priority=td["priority"],
                priority_score=score,
                priority_reason=reason,
                status="completed" if is_comp else "pending",
                completed_at=now - timedelta(hours=12) if is_comp else None
            )
            db.add(t_obj)

        print("[INFO] Seeding attendance records...")
        today = date.today()
        # Create past 14 days attendance records
        att_patterns = {
            "CS601": [("present", 10), ("absent", 2)],     # 10/12 = 83.3% (Safe)
            "CS602": [("present", 11), ("leave", 1)],      # 11/12 = 91.7% (Safe)
            "CS603": [("present", 7), ("absent", 4)],      # 7/11 = 63.6% (Warning!)
            "CS604": [("present", 9), ("absent", 1)],      # 9/10 = 90.0% (Safe)
            "CS605": [("present", 8), ("absent", 2)],      # 8/10 = 80.0% (Safe)
        }
        day_counter = 1
        for code, pattern in att_patterns.items():
            s_obj = created_subjects[code]
            cur_day = today - timedelta(days=20)
            for status_type, count in pattern:
                for _ in range(count):
                    # Skip weekends
                    while cur_day.weekday() >= 5 or cur_day > today:
                        cur_day += timedelta(days=1)
                    if cur_day <= today:
                        att_rec = AttendanceRecord(
                            user_id=user.id,
                            subject_id=s_obj.id,
                            date=cur_day,
                            status=status_type,
                            notes=f"Logged as {status_type}"
                        )
                        db.add(att_rec)
                    cur_day += timedelta(days=1)

        print("[INFO] Seeding marks and assessments...")
        assessments_data = [
            {"code": "CS601", "name": "Mid-Semester Exam", "type": "midterm", "got": 42.0, "max": 50.0, "days": -15},
            {"code": "CS601", "name": "Lab Quiz 1: RPCs", "type": "quiz", "got": 18.0, "max": 20.0, "days": -8},
            {"code": "CS602", "name": "Linear Models Test", "type": "quiz", "got": 19.5, "max": 20.0, "days": -20},
            {"code": "CS602", "name": "Mid-Semester Exam", "type": "midterm", "got": 47.0, "max": 50.0, "days": -12},
            {"code": "CS603", "name": "SQL & Relational Algebra", "type": "quiz", "got": 11.0, "max": 20.0, "days": -18},  # Lower score
            {"code": "CS603", "name": "Mid-Semester Exam", "type": "midterm", "got": 29.0, "max": 50.0, "days": -10},  # Lower score: 58%
            {"code": "CS604", "name": "Network Protocol Quiz", "type": "quiz", "got": 17.0, "max": 20.0, "days": -14},
            {"code": "CS605", "name": "Virtualization Assessment", "type": "quiz", "got": 18.0, "max": 20.0, "days": -7},
        ]
        for a_data in assessments_data:
            s_obj = created_subjects[a_data["code"]]
            pct = round((a_data["got"] / a_data["max"]) * 100.0, 1)
            ass = Assessment(
                user_id=user.id,
                subject_id=s_obj.id,
                assessment_name=a_data["name"],
                assessment_type=a_data["type"],
                marks_obtained=a_data["got"],
                maximum_marks=a_data["max"],
                percentage=pct,
                assessment_date=today + timedelta(days=a_data["days"]),
                notes=f"Official evaluation for {s_obj.name}"
            )
            db.add(ass)

        print("[INFO] Seeding sample study vault document...")
        sample_doc_text = """
DISTRIBUTED SYSTEMS REVISION NOTES (CS601) - 2026/2027
Topic: Raft Consensus Algorithm & Byzantine Fault Tolerance

1. Raft Overview:
Raft is a consensus algorithm designed as an alternative to Paxos. It is intended to be more understandable than Paxos by means of separation of logic.
Raft decomposes consensus into three subproblems:
- Leader Election: When existing leader fails, a new leader is elected.
- Log Replication: The leader accepts log entries from clients and replicates them across other servers.
- Safety: If any server has applied a particular log entry to its state machine, no other server may apply a different entry for that index.

2. Server States:
At any time each server is in one of three states:
- Leader: handles all client requests (if a client contacts a follower, follower redirects to leader).
- Follower: passive, responds to incoming requests from leaders and candidates.
- Candidate: used to elect a new leader.

3. Election Timeout:
Followers randomize their election timeouts between 150ms and 300ms to prevent split-vote scenarios during election terms.
Heartbeats are sent periodically via empty AppendEntries RPCs.
""".strip()

        sample_filename = f"user_{user.id}_raft_consensus_notes.txt"
        file_path = os.path.join(os.path.dirname(__file__), "uploads", sample_filename)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(sample_doc_text)

        s_dist = created_subjects["CS601"]
        doc = Document(
            user_id=user.id,
            subject_id=s_dist.id,
            title="Raft Consensus & Distributed Systems Revision Notes",
            category="notes",
            original_filename="Raft_Consensus_Notes.txt",
            stored_filename=sample_filename,
            file_type="TXT",
            file_size=len(sample_doc_text.encode("utf-8")),
            extracted_text=sample_doc_text,
            indexed_at=now
        )
        db.add(doc)
        db.flush()

        chunks = chunk_text(sample_doc_text)
        for idx, ch in enumerate(chunks):
            db.add(DocumentChunk(
                document_id=doc.id,
                user_id=user.id,
                chunk_index=idx,
                chunk_text=ch
            ))

        db.commit()

        print("[INFO] Generating initial intelligent study sessions...")
        generate_intelligent_study_plan(
            user_id=user.id,
            db=db,
            days_ahead=7,
            daily_available_hours=4.0,
            break_duration_minutes=15
        )

        print("================================================================")
        print(" SUCCESS: Database seeded successfully with realistic data!")
        print(" Demo Account Credentials:")
        print(f"   Email:    {DEMO_EMAIL}")
        print(f"   Password: {DEMO_PASSWORD}")
        print("================================================================")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding failed: {str(e)}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv
    seed_database(reset=reset_flag)
