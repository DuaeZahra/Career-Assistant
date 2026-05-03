# Deployment Guide — Automated Career Assistant

**Course:** Cloud Computing  
**Submitted By:** Dua-e-Zahra (2022151) · Faarza Khan (2022156) · Maryam Shafiq (2022585)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Project Structure](#2-project-structure)
3. [Environment Configuration](#3-environment-configuration)
4. [Option A — Local Development (No Docker)](#4-option-a--local-development-no-docker)
5. [Option B — Docker Compose (Recommended)](#5-option-b--docker-compose-recommended)
6. [Option C — AWS Deployment](#6-option-c--aws-deployment)
7. [Option D — Google Cloud Platform Deployment](#7-option-d--google-cloud-platform-deployment)
8. [Storage Backend Switching](#8-storage-backend-switching)
9. [Verifying the Deployment](#9-verifying-the-deployment)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

### Required for all options
| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.11+ | Backend runtime |
| Node.js | 20+ | Frontend runtime |
| Git | any | Clone the repo |

### Required for Docker (Option B)
| Tool | Version | Purpose |
|------|---------|---------|
| Docker | 24+ | Container runtime |
| Docker Compose | 2.20+ | Multi-service orchestration |

### Required API Keys
| Key | Where to get it | Required? |
|-----|----------------|-----------|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com) — free tier available | **Yes** |
| `SENDER_EMAIL` + `SENDER_PASSWORD` | Gmail account + [App Password](https://myaccount.google.com/apppasswords) | No — email sending only |

---

## 2. Project Structure

```
Automated Career Assistant/
├── backend/
│   ├── main.py                  ← FastAPI app entry point
│   ├── config.py                ← All settings (pydantic-settings)
│   ├── database.py              ← SQLAlchemy async engine setup
│   ├── Dockerfile               ← Backend container image
│   ├── requirements.txt         ← Python dependencies
│   ├── models/
│   │   ├── schemas.py           ← Pydantic request/response models
│   │   └── db_models.py         ← SQLAlchemy ORM table definitions
│   └── services/
│       ├── agent_service.py     ← LangChain ReAct agent (8 tools)
│       ├── cache_service.py     ← Redis cache layer
│       ├── storage_service.py   ← Local / S3 / GCS abstraction
│       ├── gemini_service.py    ← Google Gemini API calls
│       ├── pdf_parser.py        ← PDF text extraction
│       ├── skill_analyzer.py    ← Three-tier skill gap analysis
│       ├── document_generator.py← DOCX and PDF generation
│       └── email_service.py     ← SMTP email dispatch
├── frontend/
│   ├── app/
│   │   ├── page.tsx             ← Main page (3 tabs)
│   │   └── globals.css
│   ├── components/              ← React UI components
│   ├── Dockerfile               ← Frontend container image (multi-stage)
│   └── package.json
├── docker-compose.yml           ← Full 4-service stack
├── .env.example                 ← Template — copy to .env
└── requirements.txt             ← Top-level Python deps
```

---

## 3. Environment Configuration

### 3.1 Create your `.env` file

```bash
cp .env.example .env
```

Then open `.env` and fill in your values:

```bash
# ── REQUIRED ──────────────────────────────────────────────────────────────────
GEMINI_API_KEY=AIza...your_key_here...

# ── EMAIL (optional — only needed for the "Send Application" feature) ─────────
SENDER_EMAIL=yourname@gmail.com
SENDER_PASSWORD=xxxx xxxx xxxx xxxx    # Gmail App Password (16 chars, with spaces)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587

# ── DATABASE ───────────────────────────────────────────────────────────────────
# Leave as-is for local dev (SQLite, no setup needed)
DATABASE_URL=sqlite+aiosqlite:///./career_assistant.db

# Switch to this for Docker / production
# DATABASE_URL=postgresql+asyncpg://postgres:career123@localhost:5432/career_assistant
POSTGRES_PASSWORD=career123

# ── CACHE ──────────────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=3600

# ── STORAGE ────────────────────────────────────────────────────────────────────
STORAGE_BACKEND=local    # options: local | s3 | gcs

# AWS S3 (only if STORAGE_BACKEND=s3)
# S3_BUCKET=your-bucket-name
# AWS_ACCESS_KEY_ID=AKIA...
# AWS_SECRET_ACCESS_KEY=...
# AWS_REGION=us-east-1

# Google Cloud Storage (only if STORAGE_BACKEND=gcs)
# GCS_BUCKET=your-bucket-name
# GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json

# ── FRONTEND ───────────────────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> **Gmail App Password:** Go to Google Account → Security → 2-Step Verification → App passwords. Generate one for "Mail". Use that 16-character password as `SENDER_PASSWORD`, not your regular login password.

---

## 4. Option A — Local Development (No Docker)

Best for: quick testing, making code changes, no Docker installed.

**Limitations:** No Redis caching (app still works, just slower). Uses SQLite instead of PostgreSQL.

### Step 1 — Clone and enter the project

```bash
git clone <repo-url>
cd "Automated Career Assistant"
```

### Step 2 — Set up the backend

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install aiosqlite
```

### Step 3 — Configure environment

```bash
# From the project root
cp .env.example .env
# Edit .env and set GEMINI_API_KEY
```

### Step 4 — Start the backend

```bash
cd backend
python main.py
```

Expected output:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Database initialized (sqlite)
INFO:     Redis cache unavailable — caching disabled
INFO:     Storage backend: local
```

### Step 5 — Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Expected output:
```
▲ Next.js 16.x.x
- Local:        http://localhost:3000
- Ready in 2.1s
```

### Step 6 — Open the app

Navigate to **http://localhost:3000**

---

## 5. Option B — Docker Compose (Recommended)

Best for: full stack with PostgreSQL + Redis, consistent environment, closest to production.

All four services start automatically in the correct order with health checks.

### Step 1 — Configure environment

```bash
cp .env.example .env
# Edit .env — set GEMINI_API_KEY at minimum
```

### Step 2 — Build and start all services

```bash
docker compose up --build
```

First run downloads base images and builds the containers (~3–5 minutes). Subsequent starts are faster.

You will see logs from all four services interleaved. Wait until you see:

```
backend-1   | INFO:     Application startup complete.
frontend-1  | ▲ Next.js 16.x.x - Ready in 2.1s
```

### Step 3 — Open the app

Navigate to **http://localhost:3000**

The API is also directly accessible at **http://localhost:8000**

### Step 4 — Verify all services are healthy

```bash
docker compose ps
```

All four services should show `healthy` or `running`:

```
NAME         STATUS              PORTS
postgres-1   Up (healthy)        0.0.0.0:5432->5432/tcp
redis-1      Up (healthy)        0.0.0.0:6379->6379/tcp
backend-1    Up (healthy)        0.0.0.0:8000->8000/tcp
frontend-1   Up                  0.0.0.0:3000->3000/tcp
```

### Useful Docker Compose commands

```bash
# Start in the background (detached mode)
docker compose up --build -d

# View logs from all services
docker compose logs -f

# View logs from one service only
docker compose logs -f backend

# Restart one service (e.g. after editing backend code)
docker compose restart backend

# Stop all services (keeps the database volume)
docker compose down

# Stop all services AND delete the database (full reset)
docker compose down -v

# Rebuild a single service image
docker compose build backend
```

### Startup order explained

Docker Compose starts services in this order, waiting for each to pass its health check before proceeding:

```
postgres (pg_isready)
    ↓ healthy
redis (redis-cli ping)
    ↓ healthy
backend (curl /api/health)
    ↓ healthy
frontend
```

This prevents the backend from crashing on startup because the database isn't ready yet.

---

## 6. Option C — AWS Deployment

Deploy to AWS using managed services for the database, cache, and storage.

### Architecture on AWS

```
Internet → ALB → ECS Fargate (backend + frontend)
                      ↓              ↓
                   RDS PostgreSQL   ElastiCache Redis
                      ↓
                   S3 Bucket (file storage)
```

### Step 1 — Create an S3 bucket

```bash
aws s3 mb s3://career-assistant-prod --region us-east-1

# Block public access
aws s3api put-public-access-block \
  --bucket career-assistant-prod \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### Step 2 — Create an RDS PostgreSQL instance

In the AWS Console:
1. Go to **RDS → Create database**
2. Engine: **PostgreSQL 16**
3. Template: **Free tier** (for testing) or **Production**
4. DB instance identifier: `career-assistant-db`
5. Master username: `postgres`
6. Master password: set a strong password
7. Note the **endpoint** (e.g. `career-assistant-db.xxxx.us-east-1.rds.amazonaws.com`)

### Step 3 — Create an ElastiCache Redis cluster

In the AWS Console:
1. Go to **ElastiCache → Create cluster**
2. Engine: **Redis 7**
3. Cluster name: `career-assistant-cache`
4. Node type: `cache.t3.micro` (free tier eligible)
5. Note the **Primary endpoint** (e.g. `career-assistant-cache.xxxx.cfg.use1.cache.amazonaws.com:6379`)

### Step 4 — Create an IAM user for S3 access

```bash
# Create user
aws iam create-user --user-name career-assistant-app

# Attach S3 policy
aws iam put-user-policy \
  --user-name career-assistant-app \
  --policy-name S3Access \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::career-assistant-prod/*"
    }]
  }'

# Create access keys
aws iam create-access-key --user-name career-assistant-app
```

Save the `AccessKeyId` and `SecretAccessKey` from the output.

### Step 5 — Update `.env` for AWS

```bash
# Database
DATABASE_URL=postgresql+asyncpg://postgres:<password>@career-assistant-db.xxxx.us-east-1.rds.amazonaws.com:5432/career_assistant

# Cache
REDIS_URL=redis://career-assistant-cache.xxxx.cfg.use1.cache.amazonaws.com:6379/0

# Storage
STORAGE_BACKEND=s3
S3_BUCKET=career-assistant-prod
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

### Step 6 — Deploy with Docker Compose (EC2)

On an EC2 instance with Docker installed:

```bash
# Clone the repo
git clone <repo-url>
cd "Automated Career Assistant"

# Configure environment
cp .env.example .env
# Edit .env with the AWS values from Step 5

# Start only the app containers (DB and cache are managed by AWS)
docker compose up --build backend frontend
```

> **Note:** When deploying to AWS managed services, remove or comment out the `postgres` and `redis` services from `docker-compose.yml` — you don't need to run them locally since they're hosted by AWS.

---

## 7. Option D — Google Cloud Platform Deployment

Deploy to GCP using Cloud Run, Cloud SQL, Memorystore, and Google Cloud Storage.

### Architecture on GCP

```
Internet → Cloud Load Balancing → Cloud Run (backend + frontend)
                                        ↓              ↓
                                 Cloud SQL (PostgreSQL)  Memorystore (Redis)
                                        ↓
                                 GCS Bucket (file storage)
```

### Step 1 — Create a GCS bucket

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Create bucket
gsutil mb -l us-central1 gs://career-assistant-prod

# Make bucket private
gsutil uniformbucketlevelaccess set on gs://career-assistant-prod
```

### Step 2 — Create a Cloud SQL instance

```bash
gcloud sql instances create career-assistant-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1

# Set password
gcloud sql users set-password postgres \
  --instance=career-assistant-db \
  --password=YOUR_PASSWORD

# Create database
gcloud sql databases create career_assistant \
  --instance=career-assistant-db
```

### Step 3 — Create a Memorystore Redis instance

```bash
gcloud redis instances create career-assistant-cache \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_7_0
```

Get the IP:
```bash
gcloud redis instances describe career-assistant-cache --region=us-central1 \
  --format="get(host)"
```

### Step 4 — Create a service account for GCS access

```bash
# Create service account
gcloud iam service-accounts create career-assistant-app \
  --display-name="Career Assistant App"

# Grant GCS access
gsutil iam ch \
  serviceAccount:career-assistant-app@YOUR_PROJECT_ID.iam.gserviceaccount.com:objectAdmin \
  gs://career-assistant-prod

# Download key file
gcloud iam service-accounts keys create service-account.json \
  --iam-account=career-assistant-app@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### Step 5 — Update `.env` for GCP

```bash
# Database (Cloud SQL public IP or use Cloud SQL Auth Proxy)
DATABASE_URL=postgresql+asyncpg://postgres:<password>@<cloud-sql-ip>:5432/career_assistant

# Cache (Memorystore private IP)
REDIS_URL=redis://<memorystore-ip>:6379/0

# Storage
STORAGE_BACKEND=gcs
GCS_BUCKET=career-assistant-prod
GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json
```

### Step 6 — Deploy to Cloud Run

```bash
# Build and push backend image
gcloud builds submit ./backend \
  --tag gcr.io/YOUR_PROJECT_ID/career-assistant-backend

# Deploy backend
gcloud run deploy career-assistant-backend \
  --image gcr.io/YOUR_PROJECT_ID/career-assistant-backend \
  --platform managed \
  --region us-central1 \
  --set-env-vars="$(cat .env | grep -v '#' | xargs | tr ' ' ',')"

# Build and push frontend image
gcloud builds submit ./frontend \
  --tag gcr.io/YOUR_PROJECT_ID/career-assistant-frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://career-assistant-backend-xxxx-uc.a.run.app

# Deploy frontend
gcloud run deploy career-assistant-frontend \
  --image gcr.io/YOUR_PROJECT_ID/career-assistant-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 8. Storage Backend Switching

The storage backend is controlled entirely by the `STORAGE_BACKEND` environment variable. No code changes are required.

### Switch to Local (default)

```bash
STORAGE_BACKEND=local
```

Files are stored in `backend/uploads/` and `backend/generated/`. Docker volumes ensure they persist across container restarts.

### Switch to AWS S3

```bash
STORAGE_BACKEND=s3
S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

Then restart the backend:
```bash
docker compose restart backend
```

### Switch to Google Cloud Storage

```bash
STORAGE_BACKEND=gcs
GCS_BUCKET=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json
```

Mount the service account file by adding to `docker-compose.yml` under the `backend` service:

```yaml
backend:
  volumes:
    - ./backend/uploads:/app/uploads
    - ./backend/generated:/app/generated
    - ./service-account.json:/app/service-account.json:ro   # add this line
```

Then restart:
```bash
docker compose restart backend
```

---

## 9. Verifying the Deployment

After starting with any option, run through these checks:

### 9.1 API Health Check

```bash
curl http://localhost:8000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "uptime_seconds": 12,
  "gemini_configured": true,
  "database": true,
  "cache": true
}
```

- `gemini_configured: false` → `GEMINI_API_KEY` is not set in `.env`
- `database: false` → PostgreSQL is not reachable; app falls back to in-memory store
- `cache: false` → Redis is not reachable; app continues without caching (normal for Option A)

### 9.2 System Stats

```bash
curl http://localhost:8000/api/system/stats
```

```json
{
  "database": { "available": true, "total_analyses": 0 },
  "cache":    { "available": true, "hit_rate": 0.0 },
  "storage":  { "backend": "local", "uploads_count": 0 }
}
```

### 9.3 Frontend Loads

Open **http://localhost:3000** — you should see three tabs: Career Assistant, History, System Monitor.

### 9.4 End-to-End Test

1. Go to the **Career Assistant** tab
2. Upload a resume PDF and a job description PDF
3. Click **Analyze**
4. Verify the skill gap results appear
5. Click **Generate Resume** (DOCX or PDF)
6. Verify the file downloads
7. Go to the **History** tab — your analysis should appear
8. Go to the **System Monitor** tab — total_analyses should now be 1

---

## 10. Troubleshooting

### Backend won't start — `GEMINI_API_KEY not set`

```
WARNING - GEMINI_API_KEY not set
```

Edit your `.env` file and set `GEMINI_API_KEY=AIza...`. Then restart:
```bash
docker compose restart backend
```

### Database connection error on startup

```
WARNING - Database unavailable — running without persistence
```

With Docker Compose this should not happen because of the health check dependency. If it does:
```bash
docker compose down && docker compose up
```

For local dev (Option A), this warning is normal — SQLite is used automatically.

### Redis not connecting

```
WARNING - Redis unavailable — caching disabled
```

The app continues to work without Redis — Gemini is called every time instead of using cached responses. If you want caching in Option A, install and start Redis locally:

```bash
# Windows (via winget or Chocolatey)
winget install Redis.Redis

# Mac
brew install redis && brew services start redis

# Linux
sudo apt install redis-server && sudo systemctl start redis
```

### Frontend shows "Failed to fetch"

The frontend cannot reach the backend. Check:

1. Is the backend running? `docker compose ps` or check the terminal.
2. Is `NEXT_PUBLIC_API_URL` set correctly in `.env`?
   - Local dev: `http://localhost:8000`
   - Docker: `http://localhost:8000`
   - Production: your backend's public URL

### Email sending fails

```
Error sending email: SMTP AUTH failed
```

- Make sure you are using a **Gmail App Password**, not your regular Gmail password.
- Go to Google Account → Security → 2-Step Verification → App passwords.
- Enable 2-Step Verification first if you haven't already.

### Docker build fails — `npm ci` error

```
npm error ENOENT: package-lock.json
```

```bash
cd frontend
npm install          # generates package-lock.json
cd ..
docker compose build frontend
```

### Port already in use

```
Error: address already in use :::8000
```

Another process is using the port. Find and stop it:

```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <pid> /F

# Mac/Linux
lsof -ti:8000 | xargs kill -9
```

Or change the port in `docker-compose.yml`:
```yaml
ports:
  - "8001:8000"   # host:container — change the left side only
```

---

*For questions about the cloud architecture, see `CLOUD_SERVICES.md`. For the full feature list, see `FEATURES.md`.*
