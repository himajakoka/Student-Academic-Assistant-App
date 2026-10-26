"""
Database management module for College Event Management Portal.
Handles SQLite database connection, schema creation, migrations, and seeding.
"""

import os
import sqlite3
import uuid
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash

# Base directories
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, 'instance')
DATABASE_PATH = os.path.join(INSTANCE_DIR, 'events.db')


def ensure_instance_dir():
    """Ensure the instance directory exists."""
    if not os.path.exists(INSTANCE_DIR):
        os.makedirs(INSTANCE_DIR, exist_ok=True)


def get_db():
    """
    Get a database connection with row factory enabled and foreign keys enforced.
    """
    ensure_instance_dir()
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    """
    Initialize database schema and seed default records if database is empty.
    """
    ensure_instance_dir()
    conn = get_db()
    cursor = conn.cursor()

    # 1. Events Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            event_date TEXT NOT NULL,
            event_time TEXT NOT NULL,
            venue TEXT NOT NULL,
            capacity INTEGER NOT NULL DEFAULT 100,
            organizer_name TEXT DEFAULT 'Faculty Event Coordinator',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 2. Registrations Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            registration_id TEXT UNIQUE NOT NULL,
            event_id INTEGER NOT NULL,
            student_name TEXT NOT NULL,
            student_email TEXT NOT NULL,
            student_register_number TEXT NOT NULL,
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL DEFAULT 'Confirmed',
            FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
            UNIQUE (event_id, student_register_number)
        );
    """)

    # 3. Organizers Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS organizers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Index for fast lookups
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_date ON events (event_date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_category ON events (category);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reg_regno ON registrations (student_register_number);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations (event_id);")

    conn.commit()

    # Seed default organizer if none exists
    seed_organizer(conn)

    # Seed sample events if none exist
    seed_sample_events(conn)

    conn.close()
    print("Database initialized successfully at:", DATABASE_PATH)


def seed_organizer(conn):
    """Seed the default organizer account if not present."""
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM organizers WHERE username = ?", ('admin',))
    if cursor.fetchone() is None:
        default_password = os.environ.get('DEFAULT_ORGANIZER_PASSWORD', 'admin123')
        pwd_hash = generate_password_hash(default_password)
        cursor.execute("""
            INSERT INTO organizers (username, password_hash, full_name, email)
            VALUES (?, ?, ?, ?)
        """, ('admin', pwd_hash, 'Head Event Coordinator', 'events.admin@presidencyuniversity.in'))
        conn.commit()
        print("Default organizer 'admin' created successfully.")


def seed_sample_events(conn):
    """Seed realistic sample college events if table is empty."""
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM events")
    count = cursor.fetchone()['count']

    if count == 0:
        today = datetime.now().date()
        
        sample_events = [
            (
                "HackPulse 2026: 24-Hour National Hackathon",
                "Technical",
                "Join over 300 passionate student developers, designers, and innovators for a 24-hour sprint. Build AI, Web3, and IoT solutions for real-world campus and societal challenges. Free food, swag packs, mentor sessions, and cash prizes worth ₹50,000!",
                (today + timedelta(days=5)).strftime("%Y-%m-%d"),
                "09:00",
                "APJ Abdul Kalam Auditorium, Block 3",
                150,
                "Department of Computer Applications"
            ),
            (
                "Innovision: National AI & Machine Learning Symposium",
                "Technical",
                "Keynote address by industry leaders from top tech firms on Generative AI, LLMs in enterprise, and computer vision. Includes live coding workshops and student project exhibition with industry evaluations.",
                (today + timedelta(days=9)).strftime("%Y-%m-%d"),
                "10:00",
                "Sir MV Seminar Hall, Engineering Block",
                120,
                "AI & Data Science Student Forum"
            ),
            (
                "Dhwani 2026: Annual Inter-College Cultural Fest",
                "Cultural",
                "The most anticipated cultural extravaganza of the academic year! Featuring battle of the bands, solo & group dance championships, street play, fashion walk, beatboxing, and a live celebrity musical night.",
                (today + timedelta(days=14)).strftime("%Y-%m-%d"),
                "16:30",
                "University Open Air Amphitheatre",
                500,
                "Student Cultural Committee"
            ),
            (
                "Full-Stack Web Development with Python & Cloud Workshop",
                "Workshop",
                "A hands-on, 6-hour interactive masterclass on designing REST APIs with Flask, containerization with Docker, responsive frontends, and cloud deployment on Linux VMs. Bring your laptops!",
                (today + timedelta(days=18)).strftime("%Y-%m-%d"),
                "10:00",
                "Computing Lab 4, IT Block",
                60,
                "Open Source Developers Club"
            ),
            (
                "Inter-Department Cricket & Football Tournament",
                "Sports",
                "Cheer for your department in the annual sports meet. Features 16 department teams competing in T10 cricket and 7-a-side football matches over 3 days of intense athletic action.",
                (today + timedelta(days=22)).strftime("%Y-%m-%d"),
                "08:30",
                "University Main Sports Arena",
                200,
                "Department of Physical Education"
            ),
            (
                "Career Readiness & Tech Interview Strategies Seminar",
                "Seminar",
                "Distinguished alumni share actionable frameworks to crack tech interviews, resume crafting strategies, behavioral interview mastery, and navigating internship offers in top software companies.",
                (today + timedelta(days=27)).strftime("%Y-%m-%d"),
                "14:00",
                "Management Block Auditorium",
                180,
                "Training & Placement Cell"
            ),
            (
                "RoboWars & Drone Racing Championship",
                "Technical",
                "Witness high-octane robotic combat and agile FPV drone obstacle racing designed and engineered by engineering students. Exciting trophies and certification for participants.",
                (today + timedelta(days=32)).strftime("%Y-%m-%d"),
                "11:00",
                "Indoor Sports Complex",
                100,
                "Robotics & Automation Society"
            ),
            (
                "Canvas & Clay: Fine Arts and Photography Exhibition",
                "Cultural",
                "Showcase of student oil paintings, digital art, charcoal sketches, sculptures, and campus photography. Visitors can vote for the People's Choice Art Award.",
                (today + timedelta(days=35)).strftime("%Y-%m-%d"),
                "10:30",
                "Central Library Exhibition Foyer",
                90,
                "Fine Arts & Photography Club"
            )
        ]

        cursor.executemany("""
            INSERT INTO events (title, category, description, event_date, event_time, venue, capacity, organizer_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_events)

        conn.commit()

        # Seed sample registrations for initial events to make stats look lively
        cursor.execute("SELECT id FROM events ORDER BY id ASC LIMIT 3")
        event_ids = [row['id'] for row in cursor.fetchall()]

        sample_registrations = [
            (f"REG-2026-{uuid.uuid4().hex[:6].upper()}", event_ids[0], "Rahul Sharma", "rahul.s@presidencyuniversity.in", "2024BCA014", "Confirmed"),
            (f"REG-2026-{uuid.uuid4().hex[:6].upper()}", event_ids[0], "Priya Nair", "priya.n@presidencyuniversity.in", "2024BCA028", "Confirmed"),
            (f"REG-2026-{uuid.uuid4().hex[:6].upper()}", event_ids[0], "Arjun Menon", "arjun.m@presidencyuniversity.in", "2024BCA056", "Confirmed"),
            (f"REG-2026-{uuid.uuid4().hex[:6].upper()}", event_ids[1], "Ananya Rao", "ananya.r@presidencyuniversity.in", "2024BCA089", "Confirmed"),
            (f"REG-2026-{uuid.uuid4().hex[:6].upper()}", event_ids[1], "Rahul Sharma", "rahul.s@presidencyuniversity.in", "2024BCA014", "Confirmed"),
            (f"REG-2026-{uuid.uuid4().hex[:6].upper()}", event_ids[2], "Kiran Kumar", "kiran.k@presidencyuniversity.in", "2023BCA112", "Confirmed"),
        ]

        cursor.executemany("""
            INSERT INTO registrations (registration_id, event_id, student_name, student_email, student_register_number, status)
            VALUES (?, ?, ?, ?, ?, ?)
        """, sample_registrations)

        conn.commit()
        print(f"Sample data successfully seeded: {len(sample_events)} events and {len(sample_registrations)} registrations.")


if __name__ == '__main__':
    init_db()
