import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from datetime import datetime, date, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.services.priority_service import calculate_priority_score
from app.routers.attendance import calculate_classes_needed
from app.services.rag_service import tokenize, calculate_relevance_score
from app.services.ai_service import generate_local_demo_response

from sqlalchemy.pool import StaticPool

# Test database
TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client():
    return TestClient(app)

def test_deterministic_priority_score():
    """Verify that priority calculation formula is deterministic, strictly bounded, and explainable."""
    now = datetime.now(timezone.utc)
    due_24h = now + timedelta(hours=20)
    score, reason = calculate_priority_score(
        task_type="examination",
        priority="urgent",
        due_date=due_24h,
        estimated_effort_minutes=180,
        is_completed=False
    )
    assert 80.0 <= score <= 100.0
    assert "examination" in reason.lower()
    assert "urgent" in reason.lower()

    # Completed task should have score 0.0
    score_done, _ = calculate_priority_score(
        task_type="examination",
        priority="urgent",
        due_date=due_24h,
        estimated_effort_minutes=180,
        is_completed=True
    )
    assert score_done == 0.0

def test_attendance_target_calculation():
    """Test required classes calculation formula: (P + x) / (C + x) >= target."""
    # 7 present out of 10 = 70%, target = 75%
    # (7 + x) / (10 + x) >= 0.75 => 7 + x >= 7.5 + 0.75x => 0.25x >= 0.5 => x = 2
    needed = calculate_classes_needed(present=7, total=10, target_pct=75.0)
    assert needed == 2

    # Already above target: 9/10 = 90% >= 75%
    assert calculate_classes_needed(present=9, total=10, target_pct=75.0) == 0

def test_auth_registration_and_login(client):
    """Test student registration, login, profile initialization, and JWT generation."""
    reg_payload = {
        "email": "sarah@university.edu",
        "password": "SecurePassword123!",
        "full_name": "Sarah Connor",
        "college": "Tech University",
        "course": "B.Tech AI",
        "semester": "Semester 6",
        "academic_year": "2026-2027"
    }
    # Register
    res = client.post("/api/auth/register", json=reg_payload)
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["email"] == "sarah@university.edu"
    assert data["full_name"] == "Sarah Connor"

    # Duplicate register should fail
    res_dup = client.post("/api/auth/register", json=reg_payload)
    assert res_dup.status_code == 400

    # Login
    login_res = client.post("/api/auth/login", json={
        "email": "sarah@university.edu",
        "password": "SecurePassword123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # Verify protected route
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["full_name"] == "Sarah Connor"

def test_unauthorized_access(client):
    """Verify that unauthenticated requests to protected endpoints return 401."""
    res = client.get("/api/dashboard")
    assert res.status_code == 401

    res_tasks = client.get("/api/tasks")
    assert res_tasks.status_code == 401

def test_user_data_isolation(client):
    """Verify that student A cannot access student B's data."""
    # Register Student A
    res_a = client.post("/api/auth/register", json={
        "email": "student_a@edu.com",
        "password": "password123",
        "full_name": "Student A"
    })
    token_a = res_a.json()["access_token"]

    # Register Student B
    res_b = client.post("/api/auth/register", json={
        "email": "student_b@edu.com",
        "password": "password123",
        "full_name": "Student B"
    })
    token_b = res_b.json()["access_token"]

    # Student A creates a subject
    sub_res = client.post("/api/subjects", json={
        "name": "Secret Physics",
        "code": "PHY101",
        "faculty": "Dr. Oppenheimer"
    }, headers={"Authorization": f"Bearer {token_a}"})
    assert sub_res.status_code == 201
    subject_id = sub_res.json()["id"]

    # Student B views subjects - should NOT see Student A's subject
    b_subjects = client.get("/api/subjects", headers={"Authorization": f"Bearer {token_b}"}).json()
    assert len(b_subjects) == 0

    # Student B tries to delete Student A's subject - should return 404
    del_res = client.delete(f"/api/subjects/{subject_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert del_res.status_code == 404

def test_timetable_crud_and_conflict_detection(client):
    """Test timetable creation and conflict detection for overlapping classes."""
    reg = client.post("/api/auth/register", json={
        "email": "timetable_user@edu.com",
        "password": "password123",
        "full_name": "Timetable Student"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create subject
    subj = client.post("/api/subjects", json={"name": "Calculus", "code": "MTH101"}, headers=headers).json()

    # Create class Monday 09:00 - 10:30
    c1 = client.post("/api/timetable", json={
        "subject_id": subj["id"],
        "day_of_week": "Monday",
        "start_time": "09:00",
        "end_time": "10:30",
        "classroom": "Room 101"
    }, headers=headers)
    assert c1.status_code == 201

    # Overlapping class Monday 10:00 - 11:30 should trigger 409 conflict
    c_conflict = client.post("/api/timetable", json={
        "subject_id": subj["id"],
        "day_of_week": "Monday",
        "start_time": "10:00",
        "end_time": "11:30",
        "classroom": "Room 102"
    }, headers=headers)
    assert c_conflict.status_code == 409

def test_ai_fallback_demo_mode():
    """Verify that local AI demo mode produces grounded, clearly identified responses."""
    demo_reply = generate_local_demo_response(
        query="What is my attendance in CS601?",
        context="### ATTENDANCE RECORDS:\n- CS601: 10/12 attended (83.3%), Target: 75%",
        sources=[]
    )
    assert "[DEMO MODE" in demo_reply
    assert "83.3%" in demo_reply
