# 🎓 AcademiaLife: AI-Powered Personal Student Academic & Life Assistant

> **Academic Mini Project • Academic Year 2026–2027**  
> A full-stack, end-to-end intelligent assistant for university students. Manages class timetables, assignments, examinations, attendance compliance, performance analytics, revision workloads, and course documents with authorized AI retrieval (RAG).

---

## 📑 Table of Contents

1. [Project Overview & Key Features](#-project-overview--key-features)
2. [Technology Stack & Architecture](#-technology-stack--architecture)
3. [Prerequisites](#-prerequisites)
4. [Backend Setup & Running](#-backend-setup--running)
5. [Frontend Setup & Running](#-frontend-setup--running)
6. [Database Initialization & Seed Data](#-database-initialization--seed-data)
7. [AI Integration & Local Demo Mode](#-ai-integration--local-demo-mode)
8. [Voice Assistant Features](#-voice-assistant-features)
9. [Automated Testing & Verification](#-automated-testing--verification)
10. [Troubleshooting Common Issues](#-troubleshooting-common-issues)
11. [External Services & Production Roadmap](#-external-services--production-roadmap)

---

## 🌟 Project Overview & Key Features

AcademiaLife is built from the ground up to solve the real academic friction university students encounter every semester:

- **Personalized Main Dashboard & Daily Briefing**:
  - Live morning briefing with classes, pending coursework, and attendance warnings.
  - Quick action counters for tasks, timetable, performance, and urgent exams.
- **Timetable Management with Conflict Detection**:
  - Weekly timetable and daily schedule views.
  - Real-time overlap collision detection preventing conflicting classes.
- **Task, Assignment & Examination Registry**:
  - Full CRUD operations with deterministic priority scoring ($0.0 - 100.0$) factoring urgency, coursework type, and effort.
  - Explainable reasons for priority ratings and overdue deadline alerts.
- **AI Study Planner & Workload Balancer**:
  - Automatically identifies open evening windows around registered timetable classes.
  - Schedules study blocks prioritizing urgent deadlines and weak subjects ($< 65\%$).
- **Attendance Compliance & Target Calculator**:
  - Computes exact subject-wise and overall percentages.
  - Deterministic formula calculation: shows exactly how many consecutive future classes must be attended to regain $\ge 75\%$ target standing.
- **Marks & Academic Performance Analytics**:
  - Visual charts powered by Recharts (subject comparisons and score trajectories).
  - Identifies weak subjects and generates explainable diagnostic insights.
- **Authorized AI Assistant with RAG**:
  - Retrieves only the authenticated student's classes, marks, tasks, and uploaded documents.
  - Displays structured source citations for all grounded facts.
  - Graceful Local Demo Mode when no external API key is configured.
- **Voice Assistant**:
  - Web Speech API integration for voice questions and speech synthesis (TTS) read-aloud.
- **Smart Document Vault**:
  - Upload PDF, TXT, MD course materials (up to 15MB).
  - Extracts text and breaks it into overlapping chunks for retrieval.
  - Secure server-side path traversal prevention and authenticated downloads.
- **In-App Notifications & Global Search**:
  - Real-time warnings for upcoming 24h deadlines, exams, and attendance drops.
  - Universal keyword search across tasks, timetable, marks, subjects, and documents.

---

## 🛠 Technology Stack & Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    REACT + TYPESCRIPT UI                    │
│   Vite • Tailwind CSS • Lucide Icons • Recharts • Axios     │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST API (JWT Bearer)
┌──────────────────────────────▼──────────────────────────────┐
│                    FASTAPI PYTHON BACKEND                   │
│  Pydantic Validation • Bcrypt Hashes • OAuth2 Tokens        │
│  Deterministic Scoring • RAG Retrieval • Document Parser    │
└──────────────┬──────────────────────────────┬───────────────┘
               │ SQLAlchemy ORM               │ HTTPS Calls
┌──────────────▼──────────────┐┌──────────────▼───────────────┐
│     SQLITE DATABASE         ││   GOOGLE GEMINI API (LLM)   │
│ (PostgreSQL Compatible)     ││ (Local Fallback Demo Mode)   │
└─────────────────────────────┘└──────────────────────────────┘
```

- **Frontend**:
  - React 19 with TypeScript and Vite
  - Tailwind CSS for responsive styling
  - React Router 7 for protected client routing
  - Recharts for data analytics visualizations
  - Lucide React for consistent icons
  - Axios with JWT request & response interceptors
- **Backend**:
  - Python 3.10+ / 3.14 with FastAPI
  - SQLAlchemy 2.0 ORM
  - Pydantic v2 validation models
  - Bcrypt password hashing
  - PyPDF for document text parsing
  - Pytest test runner
- **Database**:
  - SQLite (Local development default)
  - Clean relational schema with user isolation foreign keys, indexes, and cascades.

---

## 📋 Prerequisites

Ensure your system has the following installed:
1. **Python 3.10 or higher** (Python 3.14 supported):
   ```bash
   python --version
   ```
2. **Node.js 18 or higher** and npm:
   ```bash
   node --version
   npm --version
   ```

---

## 🚀 Backend Setup & Running

### 1. Install Backend Dependencies
From the project root directory:
```bash
python -m pip install -r backend/requirements.txt
```

### 2. Configure Environment Variables
Create a `.env` file inside `backend/` (or copy from `backend/.env.example`):
```bash
cp backend/.env.example backend/.env
```
Default configuration values:
```ini
PROJECT_NAME="AI-Powered Personal Student Academic & Life Assistant"
SECRET_KEY="dev-secret-key-change-in-production-academics-2026-2027"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=10080
DATABASE_URL="sqlite:///./academic_assistant.db"
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-1.5-flash"
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE_MB=15
```

### 3. Seed Database with Sample Student Data
Populate the database with realistic sample subjects, timetable entries, tasks, attendance records, marks, and vault documents:
```bash
python backend/seed.py --reset
```

### 4. Run the Backend API Server
Start the FastAPI server via Uvicorn:
```bash
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
- API Base URL: `http://127.0.0.1:8000`
- Interactive Swagger UI: `http://127.0.0.1:8000/api/docs`
- Health check: `http://127.0.0.1:8000/health`

---

## 💻 Frontend Setup & Running

### 1. Install Frontend Dependencies
From the project root directory:
```bash
cd frontend
npm install
```

### 2. Run the Vite Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### 3. Build for Production Check
```bash
npm run build
```

---

## 🔑 Demo Account Credentials

A pre-configured student demonstration account is provided for evaluation:

| Field | Value |
| :--- | :--- |
| **Email** | `student@academic.edu` |
| **Password** | `password123` |
| **Student Name** | Alex Mercer |
| **Degree Program** | B.Tech Computer Science & Engineering (Semester 6) |

> 💡 **Quick Login**: The Login page features a one-click button labeled **"Use Fictional Demo Student Account"** which auto-fills these credentials for immediate testing!

To register a fresh student account, click **"Create student profile"** on the login page.

---

## 🤖 AI Integration & Local Demo Mode

AcademiaLife features **Dual-Engine AI Intelligence**:

1. **Live Generative LLM Mode**:
   - Provide your Google Gemini API key in `backend/.env`:
     ```ini
     GEMINI_API_KEY="your-actual-gemini-api-key"
     ```
   - All questions are grounded in your authorized student database records using RAG.
2. **Local Grounded Demo Mode (Offline / Zero-Config)**:
   - When `GEMINI_API_KEY` is blank or external services time out, the assistant seamlessly runs in **Local Demo Mode**.
   - Answers are deterministically grounded on your real timetable, tasks, attendance records, marks, and uploaded notes.
   - Responses are explicitly marked with `[DEMO MODE: Grounded on your saved data]` so simulated output is never confused with LLM output.

---

## 🎤 Voice Assistant Features

- **Speech-to-Text (STT)**: Click the microphone button in the AI Assistant chat bar to speak your academic question. Recognized speech appears in the prompt input.
- **Text-to-Speech (TTS)**: Click the **"Speak"** button under any assistant message to hear the explanation read aloud. Use **"Stop Speaking"** to mute.
- **Graceful Degradation**: If browser microphone permissions are blocked or unsupported, the interface continues functioning via standard keyboard input.

---

## 🧪 Automated Testing & Verification

Run the comprehensive Pytest suite covering authentication, data isolation, CRUD operations, deterministic scoring, attendance formulas, and AI fallback:

```bash
python -m pytest backend/tests/ -v
```

### Verified Test Cases:
1. `test_deterministic_priority_score`: Verifies $0.0 - 100.0$ bounded scoring and reason generation.
2. `test_attendance_target_calculation`: Validates attendance recovery formula $\frac{P + x}{C + x} \ge T$.
3. `test_auth_registration_and_login`: Tests registration, password hashing, and JWT bearer tokens.
4. `test_unauthorized_access`: Verifies that unauthenticated calls return HTTP 401.
5. `test_user_data_isolation`: Proves Student A cannot view or delete Student B's records.
6. `test_timetable_crud_and_conflict_detection`: Tests timetable entry creation and overlapping class collision prevention.
7. `test_ai_fallback_demo_mode`: Verifies grounded responses and demo labeling when API keys are absent.

---

## ❓ Troubleshooting Common Issues

1. **Port 8000 already in use**:
   Change the port in the uvicorn command:
   ```bash
   python -m uvicorn app.main:app --app-dir backend --port 8080 --reload
   ```
2. **PowerShell execution policy blocks `npm`**:
   Run npm using `cmd /c npm run dev` or `npx.cmd`.
3. **Resetting database**:
   Run `python backend/seed.py --reset` to clear and re-seed the SQLite database.

---

## 🔒 Security & Production Checklist

- **Secrets**: In production, replace `SECRET_KEY` with a 256-bit cryptographically secure string and keep `.env` out of version control.
- **Database**: To migrate to PostgreSQL, update `DATABASE_URL` in `.env` to `postgresql://user:password@localhost:5432/academic_assistant`.
- **CORS**: Configure `CORS_ORIGINS` in `config.py` to match your production domain.

---
*Developed for Academic Year 2026–2027 Mini Project Evaluation.*
