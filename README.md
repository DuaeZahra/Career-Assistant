# Automated Career Assistant

AI-powered career assistant that analyzes job descriptions and resumes, identifies skill gaps, generates tailored resumes and cover letters, and sends application emails — all running on a containerized cloud-native stack.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11-009688?style=flat-square&logo=fastapi)
![Postgres](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)
![AWS](https://img.shields.io/badge/AWS-EC2-FF9900?style=flat-square&logo=amazon-aws)

## Live Deployment

| | |
|---|---|
| Frontend | http://44.195.26.38:3000 |
| Backend API | http://44.195.26.38:8000 |
| Health check | http://44.195.26.38:8000/api/health |

Hosted on AWS EC2 (Ubuntu 24.04, `t3.small`-class), 4 Docker containers behind a single security group.

## What it does

1. **Upload** — drop your resume PDF and a job description PDF
2. **Analyze** — Google Gemini extracts skills, responsibilities, and key requirements from both, then computes a match percentage
3. **Generate** — produces an ATS-friendly tailored resume + a personalized cover letter (DOCX or PDF)
4. **Send** — emails the application with attachments directly to the hiring manager via SMTP
5. **Track** — every analysis, generated document, and sent email is persisted to Postgres and visible in the History tab

## Architecture

```
                ┌──────────────────────────────────────┐
                │            AWS EC2 Instance          │
                │   (Ubuntu 24.04, single host)        │
                │                                      │
   Browser ───► │  ┌──────────┐    ┌──────────┐       │
   :3000       │  │ Next.js  │───►│ FastAPI  │       │
                │  │ frontend │    │ backend  │       │
                │  └──────────┘    └─┬──┬──┬──┘       │
                │                    │  │  │           │
                │           ┌────────┘  │  └────────┐  │
                │           ▼           ▼           ▼  │
                │     ┌──────────┐ ┌────────┐ ┌──────┐ │
                │     │ Postgres │ │ Redis  │ │ Disk │ │
                │     │ history  │ │ cache  │ │ files│ │
                │     └──────────┘ └────────┘ └──────┘ │
                │                                      │
                └──────────────────────────────────────┘
                              │
                              ▼ SMTP (port 587)
                         Gmail / SES
                              │
                              ▼
                       Hiring manager
```

| Service | Image | Purpose |
|---|---|---|
| `frontend` | `node:20-alpine` (multi-stage build) | Next.js 16 UI on port 3000 |
| `backend` | `python:3.11-slim` | FastAPI + LangChain agent on port 8000 |
| `postgres` | `postgres:16-alpine` | Persistent analysis/document/application history |
| `redis` | `redis:7-alpine` | LRU cache for Gemini responses (saves API cost on duplicate runs) |

For the full breakdown of cloud concepts, AWS infrastructure choices, and the local→deployed update workflow, see **[CLOUD_AND_OPERATIONS.md](CLOUD_AND_OPERATIONS.md)**.

## Tech Stack

**Frontend** — Next.js 16 (App Router), TypeScript, Tailwind CSS
**Backend** — FastAPI, SQLAlchemy 2.0 async, Pydantic v2, LangChain
**AI** — Google Gemini 2.5 Flash Lite
**Data** — PostgreSQL 16 (async via `asyncpg`), Redis 7
**PDF/DOCX** — `pypdf`, `python-docx`, ReportLab
**Email** — `smtplib` over STARTTLS to Gmail SMTP
**Infra** — Docker Compose, AWS EC2, AWS VPC

## Quick Start (Local Development)

### Prerequisites
- Docker Desktop (or Docker Engine + Compose)
- A Google Gemini API key — [get one free here](https://aistudio.google.com/apikey)
- (Optional, for email) Gmail account with 2FA enabled and an [App Password](https://myaccount.google.com/apppasswords)

### Run the full stack with Docker Compose

```bash
git clone <your-repo-url>
cd "Automated Career Assistant"

# Create .env in the repo root
cat > .env <<EOF
GEMINI_API_KEY=your-key-here
POSTGRES_PASSWORD=career123
ALLOWED_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
SENDER_EMAIL=your-email@gmail.com
SENDER_PASSWORD=your-16-char-app-password
EOF

docker compose up -d --build
```

That brings up all 4 services. Visit:
- App: http://localhost:3000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

### Run components without Docker (development)

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py     # serves on :8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev        # serves on :3000
```

In this mode the backend uses SQLite (no Postgres needed) and runs without Redis (cache silently disabled). Gemini API key is still required.

## Project Structure

```
.
├── docker-compose.yml          # 4-service orchestration with healthchecks
├── .env                        # Local config (gitignored)
├── README.md                   # this file
├── CLOUD_AND_OPERATIONS.md     # cloud architecture + update workflow
├── FEATURES.md                 # feature-level breakdown
│
├── backend/
│   ├── Dockerfile              # python:3.11-slim
│   ├── main.py                 # FastAPI app, all endpoints, lifespan
│   ├── config.py               # pydantic-settings, env-driven
│   ├── database.py             # async SQLAlchemy engine + session factory
│   ├── models/
│   │   ├── db_models.py        # AnalysisSession, GeneratedDocument, JobApplication
│   │   └── schemas.py          # Pydantic request/response models
│   └── services/
│       ├── pdf_parser.py       # pypdf wrapper
│       ├── gemini_service.py   # Gemini API client + prompts
│       ├── skill_analyzer.py   # exact/partial/missing matching
│       ├── document_generator.py  # DOCX + PDF rendering
│       ├── email_service.py    # SMTP send with attachments
│       ├── cache_service.py    # Redis client with hit-rate tracking
│       ├── storage_service.py  # local | s3 | gcs storage abstraction
│       └── agent_service.py    # LangChain ReAct agent
│
└── frontend/
    ├── Dockerfile              # multi-stage: builder → standalone runtime
    ├── app/
    │   ├── page.tsx            # tab router (Career Assistant, History)
    │   └── layout.tsx
    └── components/
        ├── FileUpload.tsx
        ├── AnalysisResults.tsx
        ├── DocumentGeneration.tsx
        ├── EmailSender.tsx
        └── ApplicationHistory.tsx
```

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Service info |
| `GET` | `/api/health` | Liveness + dependency status (DB, cache, Gemini) |
| `GET` | `/api/system/stats` | DB row counts, Redis hit-rate, storage stats |
| `POST` | `/api/upload-and-analyze` | Multipart upload of resume + JD → analysis |
| `POST` | `/api/generate-resume` | Tailored resume (DOCX or PDF) |
| `POST` | `/api/generate-cover-letter` | Cover letter (DOCX or PDF) |
| `POST` | `/api/send-email` | Send application email with attachments |
| `GET` | `/api/history` | Last 50 analyses |
| `GET` | `/api/history/{id}` | Full details for one analysis |
| `POST` | `/api/agent/run` | LangChain agent end-to-end task |
| `GET` | `/api/agent/tools` | List of available agent tools |

Auto-generated OpenAPI docs at `/docs`.

## Configuration

All configuration is environment-driven (12-factor). Required and optional vars:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | yes | — | Google AI Studio key |
| `POSTGRES_PASSWORD` | yes (Docker) | `career123` | Database password |
| `DATABASE_URL` | no | SQLite local file | Auto-set by Compose to Postgres |
| `REDIS_URL` | no | `redis://localhost:6379/0` | Auto-set by Compose to `redis://redis:6379/0` |
| `ALLOWED_ORIGINS` | yes (prod) | `http://localhost:3000,http://localhost:3001` | CORS allowlist, comma-separated |
| `NEXT_PUBLIC_API_URL` | yes (prod) | `http://localhost:8000` | Baked into frontend at build time |
| `STORAGE_BACKEND` | no | `local` | `local`, `s3`, or `gcs` |
| `SENDER_EMAIL` | for email | — | Gmail address |
| `SENDER_PASSWORD` | for email | — | Gmail App Password (16 chars, no spaces) |
| `SMTP_SERVER` | no | `smtp.gmail.com` | |
| `SMTP_PORT` | no | `587` | STARTTLS |
| `CACHE_TTL` | no | `3600` | Seconds (1 hour) |

## Troubleshooting

**Frontend gets CORS error after deploying**
The browser-served origin (e.g. `http://44.195.26.38:3000`) must be in `ALLOWED_ORIGINS`. Set it in `.env` and recreate the backend container — see [CLOUD_AND_OPERATIONS.md](CLOUD_AND_OPERATIONS.md).

**`/api/health` returns `database: false`**
Check `docker compose logs backend | grep -i database` for the actual error. Common cause: the backend started before Postgres was ready. Recreating the backend (`docker compose up -d --force-recreate backend`) usually fixes it because Compose now waits for Postgres's healthcheck.

**Email sends fail with `535 BadCredentials`**
You're using your regular Gmail password instead of an App Password, or you pasted the App Password with spaces. Re-generate at https://myaccount.google.com/apppasswords, store as 16 unbroken chars.

**Frontend changes don't appear in browser after redeploy**
Hard-refresh (Ctrl+Shift+R) or open in Incognito. Next.js standalone bundles are heavily cached.

For full operational guidance see [CLOUD_AND_OPERATIONS.md](CLOUD_AND_OPERATIONS.md).

## License

MIT — see source for details.
