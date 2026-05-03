# Automated Career Assistant — Features & Cloud Architecture

## Overview

An AI-powered web application that helps job seekers tailor their resumes and cover letters to specific job descriptions. Users upload their resume and a job posting as PDFs; the system analyzes the skill gap, generates optimized documents, and can send the application email — all autonomously via a LangChain agent.

---

## Core Product Features

### 1. PDF Document Parsing
- Accepts resume and job description as PDF uploads
- Extracts and cleans raw text using `pypdf`
- Async extraction — does not block other requests

### 2. AI-Powered Job Analysis (Google Gemini)
- Extracts job title, company name, contact email
- Identifies required skills, preferred skills, and key responsibilities
- Returns structured JSON via Gemini 2.5 Flash Lite

### 3. AI-Powered Resume Analysis
- Extracts candidate name, skills list, experience, education, and summary
- Normalizes skill names for consistent comparison

### 4. Skill Gap Analysis
- Three-tier matching: **exact match**, **partial match**, **missing**
- Weighted match percentage: exact = 100%, partial = 50%
- Side-by-side comparison of job requirements vs. candidate profile

### 5. Tailored Resume Generation
- Gemini rewrites the resume to align with the specific job description
- ATS-optimized formatting
- Export as **DOCX** or **PDF**
- Markdown bold/italic preserved in output documents

### 6. Cover Letter Generation
- Generates a personalized cover letter from resume + job description context
- Addresses key responsibilities and required skills
- Export as **DOCX** or **PDF**

### 7. Application Email Sending
- Sends application email via SMTP (Gmail-compatible)
- Attaches generated resume and cover letter
- Pre-fills recipient email if extracted from job description
- Validates email addresses before sending

### 8. LangChain ReAct Agent
- Autonomous agent that can run the full workflow end-to-end from a single natural-language instruction
- Uses the **ReAct pattern** (Reasoning + Acting) via LangChain
- Powered by **Gemini 2.5 Flash**
- Maximum 15 reasoning iterations per task

#### Agent Tools (8 total)
| Tool | What it does |
|------|-------------|
| `parse_pdf` | Extract text from a PDF file |
| `analyze_job_description` | Parse job requirements with AI |
| `analyze_resume` | Parse resume content with AI |
| `analyze_skill_gap` | Compare skills and calculate match % |
| `generate_tailored_resume` | Produce an ATS-optimized resume |
| `generate_cover_letter` | Write a personalized cover letter |
| `send_application_email` | Submit the application by email |
| `validate_documents` | Confirm generated files exist |

### 9. Deterministic Agent Evaluation Framework
- 8 test scenarios covering the full workflow
- 7 evaluation rules: tool selection, logical sequence, step count, error handling, etc.
- 8 computed metrics:
  - Task Accuracy, Task Success Rate
  - Action Execution Correctness
  - Tool Usage Correctness
  - Latency Metrics
  - Reasoning Efficiency
  - Cost Efficiency (estimated API token usage)
  - Workflow Efficiency (path deviation)
- Runs in **simulation mode** (no LLM calls) or against the live agent
- Saves timestamped JSON evaluation reports

---

## Cloud Computing Features

### 1. Containerization with Docker

Every service runs in its own container. A single `docker compose up` starts the full stack.

```
docker-compose.yml
├── postgres   — PostgreSQL 16 (persistent storage)
├── redis      — Redis 7 (AI response cache)
├── backend    — FastAPI + LangChain (Python 3.11)
└── frontend   — Next.js 16 (Node 20, multi-stage build)
```

- **Multi-stage frontend build** keeps the production image lean
- **Health checks** on every service; backend waits for DB and Redis to be ready
- **Named volume** (`postgres_data`) ensures data survives container restarts
- **Environment variable injection** — all secrets via `.env`, never hardcoded

### 2. Persistent Database (PostgreSQL / SQLite)

Replaces the in-memory Python dict with a proper relational database.

| Table | Purpose |
|-------|---------|
| `analysis_sessions` | Every upload+analysis with full JSON results |
| `generated_documents` | Metadata for every resume and cover letter created |
| `job_applications` | Record of every email sent (recipient, status, attachments) |

- **SQLAlchemy 2.0 async ORM** — non-blocking DB queries
- **Dev default:** SQLite (`sqlite+aiosqlite:///./career_assistant.db`) — zero setup
- **Production:** PostgreSQL via `postgresql+asyncpg://...`
- Schema auto-created on startup via `Base.metadata.create_all`
- **Graceful degradation** — app runs fully if DB is unavailable

### 3. Redis Caching Layer

Caches expensive Gemini AI API responses to avoid redundant calls and reduce cost.

- Cache key = SHA-256 hash of input text (job description or resume text)
- **TTL: 1 hour** (configurable via `CACHE_TTL`)
- Namespaces: `job_analysis`, `resume_analysis`, `tailored_resume`, `cover_letter`
- `⚡ Cached` badge shown in History UI when a result was served from cache
- **Graceful degradation** — app runs fully if Redis is unavailable (cache simply disabled)

### 4. Cloud Storage Abstraction

A single `StorageService` class that switches between storage backends via a single environment variable (`STORAGE_BACKEND`).

| Backend | Use case |
|---------|---------|
| `local` | Development — files on the local filesystem |
| `s3` | Production on AWS — files in an S3 bucket |
| `gcs` | Production on GCP — files in a Google Cloud Storage bucket |

- Uploads and generated documents are saved through this abstraction
- For S3/GCS backends, files are downloaded to a temp path when the app needs a local file handle
- Zero code changes needed to switch backends — only the env var changes

### 5. Environment-Based Configuration

All settings managed via `pydantic-settings` (`backend/config.py`).

```
GEMINI_API_KEY       — AI service
DATABASE_URL         — swap SQLite ↔ PostgreSQL
REDIS_URL            — cache server location
STORAGE_BACKEND      — local | s3 | gcs
S3_BUCKET / GCS_BUCKET — cloud storage target
AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
SENDER_EMAIL / SENDER_PASSWORD — email credentials
```

- `.env.example` documents every variable
- Docker Compose injects DB and Redis URLs automatically
- Frontend reads `NEXT_PUBLIC_API_URL` for the backend address (works on any host)

### 6. Application History API & UI

- `GET /api/history` — returns the 50 most recent analyses from the database
- `GET /api/history/{id}` — returns full JSON detail for one session
- Frontend **History tab** shows a sortable table with:
  - Date, job title, company, match percentage, cache indicator
  - Click-to-expand detail drawer with full skill gap breakdown

### 7. System Monitoring API & Dashboard

- `GET /api/system/stats` — returns live metrics from all cloud services
- `GET /api/health` — service status, uptime, feature flags

#### Monitoring Dashboard (frontend System Monitor tab)
- **Service status bar** — API, Gemini, Database, Redis, Storage (green/grey dots)
- **Database metrics** — total analyses, documents, applications
- **Cache metrics** — hit count, miss count, hit-rate percentage
- **Storage metrics** — backend type, upload count, generated file count
- Auto-refreshes every 30 seconds

---

## Tech Stack

### Backend
| Component | Technology |
|-----------|-----------|
| Web framework | FastAPI 0.109 + Uvicorn |
| AI / LLM | Google Gemini 2.5 Flash / Flash Lite |
| Agent framework | LangChain 0.1 (ReAct agent) |
| Database ORM | SQLAlchemy 2.0 async |
| Database driver | aiosqlite (dev) · asyncpg (prod) |
| Cache client | redis-py 5+ (asyncio) |
| PDF parsing | pypdf 4 |
| Document generation | python-docx · ReportLab |
| Email | smtplib (SMTP/TLS) |
| Config | pydantic-settings |
| Language | Python 3.11 |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16.1 (App Router, Turbopack) |
| UI library | React 19 |
| Styling | Tailwind CSS 4 |
| Language | TypeScript 5 |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| Containers | Docker + Docker Compose |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Storage | Local filesystem / AWS S3 / Google Cloud Storage |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Root status |
| GET | `/api/health` | Full service health + feature flags |
| POST | `/api/upload-and-analyze` | Upload PDFs → skill gap analysis |
| POST | `/api/generate-resume` | Generate tailored resume (DOCX/PDF) |
| POST | `/api/generate-cover-letter` | Generate cover letter (DOCX/PDF) |
| POST | `/api/send-email` | Send application email with attachments |
| POST | `/api/agent/run` | Run LangChain agent with natural language task |
| GET | `/api/agent/metrics` | Agent execution metrics |
| POST | `/api/agent/evaluate` | Run deterministic agent evaluation |
| GET | `/api/agent/tools` | List available agent tools |
| GET | `/api/history` | List 50 most recent analysis sessions |
| GET | `/api/history/{id}` | Full detail for one analysis session |
| GET | `/api/system/stats` | DB counts, Redis hit-rate, storage info |

---

## Work Breakdown (3 Members)

### Member 1 — Cloud Infrastructure & DevOps
- `docker-compose.yml` — 4-service container orchestration
- `backend/Dockerfile` + `frontend/Dockerfile`
- `backend/services/storage_service.py` — Local / S3 / GCS abstraction
- `.env.example` — environment variable documentation
- Container health checks, volume mounts, dependency ordering

### Member 2 — Backend Services & Data Layer
- `backend/config.py` — Pydantic settings management
- `backend/database.py` — SQLAlchemy async engine + session factory
- `backend/models/db_models.py` — ORM models (AnalysisSession, GeneratedDocument, JobApplication)
- `backend/services/cache_service.py` — Redis caching with graceful fallback
- `backend/main.py` — new endpoints (`/api/history`, `/api/system/stats`), DB persistence, cache integration
- `backend/models/schemas.py` — monitoring schemas (SystemStats, CacheStats, etc.)

### Member 3 — Frontend & Monitoring UI
- `frontend/components/ApplicationHistory.tsx` — history table with detail drawer
- `frontend/components/MonitoringDashboard.tsx` — real-time system health dashboard
- `frontend/app/page.tsx` — tab navigation (Career Assistant / History / System Monitor)
- Full existing UI (FileUpload, AnalysisResults, DocumentGeneration, EmailSender, AgentEvaluation)

---

## Running the App

### Local Development (no Docker required)
```bash
# Backend
cd backend
pip install -r requirements.txt
pip install redis aiosqlite asyncpg
python main.py          # starts on http://localhost:8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev             # starts on http://localhost:3000
```

### Full Cloud Stack (Docker)
```bash
cp .env.example .env    # fill in GEMINI_API_KEY
docker compose up       # starts all 4 services
```
Open [http://localhost:3000](http://localhost:3000)

### Switch to Cloud Storage
```env
# In .env — no code changes needed
STORAGE_BACKEND=s3
S3_BUCKET=my-career-assistant-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```
