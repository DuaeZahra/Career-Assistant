# Cloud Services — Automated Career Assistant

**Course:** Cloud Computing  
**Submitted By:** Dua-e-Zahra (2022151) · Faarza Khan (2022156) · Maryam Shafiq (2022585)  
**Date:** April 25, 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Containerization — Docker & Docker Compose](#2-containerization--docker--docker-compose)
3. [Database as a Service — PostgreSQL](#3-database-as-a-service--postgresql)
4. [Distributed Cache — Redis](#4-distributed-cache--redis)
5. [Cloud Storage Abstraction — S3 / GCS / Local](#5-cloud-storage-abstraction--s3--gcs--local)
6. [12-Factor Configuration — pydantic-settings](#6-12-factor-configuration--pydantic-settings)
7. [Observability — Health & Monitoring Endpoints](#7-observability--health--monitoring-endpoints)
8. [Deployment Guide](#8-deployment-guide)

---

## 1. Architecture Overview

The application is a cloud-native, four-service system orchestrated by Docker Compose. Every service runs in its own container; the backend depends on both the database and cache being healthy before it starts; the frontend depends on the backend.

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Network                      │
│                                                         │
│  ┌──────────────┐        ┌──────────────────────────┐   │
│  │   Frontend   │──HTTP──│        Backend           │   │
│  │  Next.js 16  │        │  FastAPI + LangChain     │   │
│  │  :3000       │        │  :8000                   │   │
│  └──────────────┘        └────────┬─────────┬───────┘   │
│                                   │         │           │
│                          ┌────────┘         └────────┐  │
│                          ▼                           ▼  │
│                  ┌──────────────┐       ┌──────────────┐ │
│                  │  PostgreSQL  │       │    Redis 7   │ │
│                  │  :5432       │       │    :6379     │ │
│                  └──────────────┘       └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

| Service    | Image / Runtime         | Role                                      | Port |
|------------|-------------------------|-------------------------------------------|------|
| frontend   | node:20-alpine          | React UI — Career Assistant, History, Monitor | 3000 |
| backend    | python:3.11-slim        | FastAPI REST API + LangChain ReAct Agent  | 8000 |
| postgres   | postgres:16-alpine      | Persistent storage — sessions, documents, applications | 5432 |
| redis      | redis:7-alpine          | AI response cache — reduces Gemini API cost and latency | 6379 |

---

## 2. Containerization — Docker & Docker Compose

### 2.1 Docker Compose Stack

**File:** `docker-compose.yml`

All four services are defined in a single Compose file with explicit health checks and startup ordering — mirroring how a Kubernetes deployment uses readiness probes and `initContainers`.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 10

  backend:
    build: ./backend
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 15s
      retries: 5

  frontend:
    build: ./frontend
    depends_on:
      backend: { condition: service_healthy }
```

**Key design decisions:**

- `depends_on` with `service_healthy` ensures the backend never starts before the database and cache are ready — prevents startup race conditions.
- `restart: unless-stopped` on all services provides automatic recovery from crashes.
- PostgreSQL data is stored in a named volume (`postgres_data`) so it survives container restarts.
- Redis is configured with a 256 MB memory cap and `allkeys-lru` eviction — the cache drops the least-recently-used keys under memory pressure rather than throwing errors.

### 2.2 Backend Dockerfile

**File:** `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir "redis>=5.0.0" "aiosqlite>=0.20.0" "asyncpg>=0.29.0"

COPY . .
RUN mkdir -p uploads generated

EXPOSE 8000
CMD ["python", "main.py"]
```

- Uses `python:3.11-slim` to keep the image small.
- Installs `libpq-dev` for PostgreSQL native driver support (`asyncpg`).
- Installs both `aiosqlite` (dev/SQLite) and `asyncpg` (prod/PostgreSQL) — the app switches between them via `DATABASE_URL` without a code change.

### 2.3 Frontend Dockerfile

**File:** `frontend/Dockerfile`

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
    && adduser  --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

- **Multi-stage build** — the builder stage compiles TypeScript and bundles assets; the runner stage copies only the production output, keeping the final image lean.
- Runs as a non-root user (`nextjs`) — a security best practice for containers.
- `NEXT_PUBLIC_API_URL` is a build-time argument so the same Dockerfile works for local, staging, and production by passing a different `--build-arg`.

---

## 3. Database as a Service — PostgreSQL

### 3.1 Connection & Engine

**File:** `backend/database.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

engine = create_async_engine(database_url, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

- `pool_pre_ping=True` — SQLAlchemy tests each connection before use, automatically reconnecting if the database was restarted.
- `expire_on_commit=False` — allows reading model attributes after a commit without issuing a second query (important for async code where lazy loading does not work).
- **Graceful degradation:** if the database is unreachable on startup, `AsyncSessionLocal` is set to `None` and every endpoint that needs the DB returns a partial response rather than crashing.

### 3.2 URL Switching — Dev vs Production

| Environment | `DATABASE_URL` value |
|-------------|----------------------|
| Local dev   | `sqlite+aiosqlite:///./career_assistant.db` |
| Docker / Prod | `postgresql+asyncpg://postgres:<password>@postgres:5432/career_assistant` |

No code change is needed — the driver prefix in the URL is all SQLAlchemy needs to pick the correct backend.

### 3.3 Data Models

**File:** `backend/models/db_models.py`

Three tables are defined using SQLAlchemy's declarative ORM:

#### `analysis_sessions`

Stores every resume-vs-job-description comparison.

| Column | Type | Description |
|--------|------|-------------|
| `id` | String(32) | UUID primary key |
| `created_at` | DateTime(tz) | Server-set timestamp |
| `resume_filename` | String(255) | Original uploaded filename |
| `job_filename` | String(255) | Original uploaded filename |
| `resume_storage_key` | String(512) | Key in storage backend |
| `job_storage_key` | String(512) | Key in storage backend |
| `job_analysis` | JSON | Full Gemini job analysis output |
| `resume_analysis` | JSON | Full Gemini resume analysis output |
| `skill_gap` | JSON | Matching / missing / partial skills |
| `match_percentage` | Float | Weighted match score (0–100) |
| `from_cache` | Boolean | Whether Gemini was bypassed via Redis |

#### `generated_documents`

Tracks every resume and cover letter file produced.

| Column | Type | Description |
|--------|------|-------------|
| `id` | String(32) | UUID primary key |
| `session_id` | String(32) | Links to `analysis_sessions` |
| `doc_type` | String(50) | `"resume"` or `"cover_letter"` |
| `format` | String(10) | `"docx"` or `"pdf"` |
| `storage_key` | String(512) | Path/key in storage backend |
| `file_size_bytes` | Integer | File size for monitoring |

#### `job_applications`

Records every email dispatch attempt.

| Column | Type | Description |
|--------|------|-------------|
| `id` | String(32) | UUID primary key |
| `session_id` | String(32) | Links to `analysis_sessions` |
| `recipient_email` | String(255) | Employer email address |
| `subject` | String(500) | Email subject line |
| `status` | String(50) | `"sent"`, `"failed"`, or `"pending"` |
| `attachments_count` | Integer | Number of files attached |

### 3.4 Async Operations

All database writes use `async with AsyncSessionLocal() as db` sessions and `await db.commit()`. This is non-blocking — the FastAPI event loop is free to handle other requests while a DB write is in progress.

```python
async with AsyncSessionLocal() as db:
    db.add(AnalysisSession(id=session_id, ...))
    await db.commit()
```

### 3.5 Cloud Equivalent

In production on AWS or GCP:

| Component | Cloud Service |
|-----------|---------------|
| PostgreSQL container | AWS RDS (PostgreSQL) or Google Cloud SQL |
| `DATABASE_URL` | Change to the managed service endpoint — no code change |
| `postgres_data` volume | Replaced by the managed service's persistent storage |

---

## 4. Distributed Cache — Redis

### 4.1 Why Redis

Gemini API calls cost money and take 1–3 seconds each. For identical inputs (same resume + same job description), the response will always be the same. Redis stores these responses so repeat requests return instantly without hitting the API.

### 4.2 Implementation

**File:** `backend/services/cache_service.py`

```python
class CacheService:
    async def connect(self, redis_url: str) -> None:
        self._client = aioredis.from_url(redis_url, encoding="utf-8", decode_responses=True)
        await self._client.ping()
        self.available = True

    def _key(self, namespace: str, *parts: str) -> str:
        h = hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()[:16]
        return f"career:{namespace}:{h}"

    async def get(self, namespace: str, *key_parts: str) -> Optional[Any]:
        raw = await self._client.get(self._key(namespace, *key_parts))
        return json.loads(raw) if raw else None

    async def set(self, namespace: str, value: Any, *key_parts: str, ttl: int = 3600) -> bool:
        await self._client.set(self._key(namespace, *key_parts), json.dumps(value), ex=ttl)
```

### 4.3 Cache Key Design

Cache keys are SHA-256 hashes of the raw input content, not filenames:

```
career:job_analysis:<sha256(job_text)[:16]>
career:resume_analysis:<sha256(resume_text)[:16]>
career:tailored_resume:<sha256(resume_text + job_text)[:16]>
career:cover_letter:<sha256(resume_text + job_text)[:16]>
```

Using content hashes means two different files with the same text produce the same cache key — maximizing hit rate. Filenames are ignored.

### 4.4 TTL Policy

All cache entries expire after **3600 seconds (1 hour)**. This is configurable via the `CACHE_TTL` environment variable. After expiry, the next request fetches fresh data from Gemini and re-populates the cache.

### 4.5 Graceful Degradation

If Redis is not running, `self.available` stays `False`. Every `get()` returns `None` and every `set()` returns `False` silently — the application continues to function correctly, just without caching.

### 4.6 Memory Management

Redis is configured with:
```
--maxmemory 256mb --maxmemory-policy allkeys-lru
```

When memory is full, it evicts the least-recently-used key. This prevents Redis from consuming unbounded memory on the host.

### 4.7 Hit-Rate Monitoring

```python
async def get_stats(self) -> dict:
    info = await self._client.info("stats")
    hits   = info.get("keyspace_hits", 0)
    misses = info.get("keyspace_misses", 0)
    return {
        "available": True,
        "keyspace_hits": hits,
        "keyspace_misses": misses,
        "hit_rate": round(hits / max(hits + misses, 1) * 100, 2),
    }
```

This is surfaced in the `/api/system/stats` endpoint and displayed in the frontend monitoring dashboard.

### 4.8 Cloud Equivalent

| Component | Cloud Service |
|-----------|---------------|
| Redis container | AWS ElastiCache (Redis) or Google Memorystore |
| `REDIS_URL` | Change to the managed service endpoint — no code change |

---

## 5. Cloud Storage Abstraction — S3 / GCS / Local

### 5.1 Design

**File:** `backend/services/storage_service.py`

A single `StorageService` class wraps three storage backends behind an identical public API. The backend is selected at startup via the `STORAGE_BACKEND` environment variable.

```
STORAGE_BACKEND=local   →  Local filesystem (default)
STORAGE_BACKEND=s3      →  AWS S3
STORAGE_BACKEND=gcs     →  Google Cloud Storage
```

No application code outside `storage_service.py` knows which backend is active.

### 5.2 Public API

```python
await storage.save_upload(data: bytes, filename: str) -> str
await storage.save_generated(data: bytes, filename: str) -> str
await storage.get_local_path(key: str) -> Optional[str]
storage.count_files(folder: str) -> int
```

All file operations go through these four methods. The calling code (in `main.py`) is identical regardless of whether files are stored locally, in S3, or in GCS.

### 5.3 Backend Implementations

#### Local Filesystem

```python
def _local_write(self, data: bytes, key: str) -> str:
    path = os.path.join(self.base_dir, key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return key
```

Files are written to `backend/uploads/` and `backend/generated/`, which are mounted as Docker volumes for persistence across container restarts.

#### AWS S3

```python
async def _s3_put(self, data: bytes, key: str) -> str:
    client = self._s3_client()      # boto3, lazy-initialized
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        lambda: client.put_object(Bucket=settings.S3_BUCKET, Key=key, Body=data),
    )
    return key
```

boto3 is synchronous, so `run_in_executor` runs it in a thread pool without blocking the async event loop.

**Required environment variables for S3:**
```
STORAGE_BACKEND=s3
S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
```

#### Google Cloud Storage

```python
async def _gcs_put(self, data: bytes, key: str) -> str:
    client = self._gcs_client()     # google.cloud.storage, lazy-initialized
    bucket = client.bucket(settings.GCS_BUCKET)
    blob = bucket.blob(key)
    await loop.run_in_executor(None, lambda: blob.upload_from_string(data))
    return key
```

Authentication uses a service account JSON file pointed to by the `GOOGLE_APPLICATION_CREDENTIALS` environment variable — the standard GCP authentication pattern.

**Required environment variables for GCS:**
```
STORAGE_BACKEND=gcs
GCS_BUCKET=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### 5.4 Cloud Download for Local Processing

When a cloud backend is active, `get_local_path()` downloads the file to a temporary location so tools that need a filesystem path (like `pypdf`) can still work:

```python
async def get_local_path(self, key: str) -> Optional[str]:
    if self.backend == "local":
        return os.path.join(self.base_dir, key)
    data = await self._read(key)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=Path(key).suffix)
    tmp.write(data)
    tmp.close()
    return tmp.name
```

### 5.5 Switching Backends

To switch from local to S3, only the `.env` file changes — no code modification required:

```bash
# Before (local)
STORAGE_BACKEND=local

# After (AWS S3)
STORAGE_BACKEND=s3
S3_BUCKET=career-assistant-prod
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

---

## 6. 12-Factor Configuration — pydantic-settings

### 6.1 Settings Class

**File:** `backend/config.py`

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str    = "Automated Career Assistant"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool      = False

    GEMINI_API_KEY: Optional[str] = None

    DATABASE_URL: str  = "sqlite+aiosqlite:///./career_assistant.db"
    REDIS_URL: str     = "redis://localhost:6379/0"
    CACHE_TTL: int     = 3600

    STORAGE_BACKEND: str         = "local"
    S3_BUCKET: Optional[str]     = None
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str              = "us-east-1"
    GCS_BUCKET: Optional[str]   = None

    SMTP_SERVER: str            = "smtp.gmail.com"
    SMTP_PORT: int              = 587
    SENDER_EMAIL: Optional[str] = None
    SENDER_PASSWORD: Optional[str] = None

    model_config = {"env_file": ".env", "extra": "ignore"}

settings = Settings()
```

`pydantic-settings` reads values from environment variables first, then falls back to the `.env` file, then to the defaults defined in the class. This is the 12-factor app [Config](https://12factor.net/config) principle: configuration is separated from code and stored in the environment.

### 6.2 Environment Variables Reference

**File:** `.env.example`

```bash
# AI (required)
GEMINI_API_KEY=your_gemini_api_key_here

# Email (optional)
SENDER_EMAIL=your_gmail@gmail.com
SENDER_PASSWORD=your_app_password

# Database
DATABASE_URL=sqlite+aiosqlite:///./career_assistant.db   # dev
# DATABASE_URL=postgresql+asyncpg://postgres:pw@localhost:5432/career_assistant  # prod
POSTGRES_PASSWORD=career123

# Cache
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=3600

# Storage
STORAGE_BACKEND=local          # or: s3 | gcs
# S3_BUCKET=...
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# GCS_BUCKET=...
# GOOGLE_APPLICATION_CREDENTIALS=...

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 6.3 Docker Compose Environment Injection

In `docker-compose.yml`, the backend service overrides specific variables for the containerized environment:

```yaml
backend:
  env_file: .env          # loads all user-defined vars from .env
  environment:
    DATABASE_URL: postgresql+asyncpg://postgres:${POSTGRES_PASSWORD:-career123}@postgres:5432/career_assistant
    REDIS_URL: redis://redis:6379/0
    STORAGE_BACKEND: ${STORAGE_BACKEND:-local}
```

The `env_file` loads the user's secrets (API keys, email credentials); the `environment` block overrides service URLs to use Docker's internal DNS names (`postgres`, `redis`) instead of `localhost`.

---

## 7. Observability — Health & Monitoring Endpoints

### 7.1 Health Check — `GET /api/health`

Returns the live status of all infrastructure components. Used by Docker Compose's `healthcheck` directive and by any external load balancer or uptime monitor.

**Response:**
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "uptime_seconds": 3842,
  "gemini_configured": true,
  "agent_available": true,
  "database": true,
  "cache": true,
  "storage_backend": "local",
  "track_a_compliant": true,
  "features": {
    "langchain_integration": true,
    "tool_system": true,
    "real_actions": true,
    "persistent_storage": true,
    "redis_cache": true,
    "cloud_storage": false
  }
}
```

### 7.2 System Stats — `GET /api/system/stats`

Returns operational metrics aggregated from the database, Redis, and storage backend.

**Response:**
```json
{
  "app_version": "2.0.0",
  "database": {
    "available": true,
    "total_analyses": 47,
    "total_documents": 93,
    "total_applications": 18
  },
  "cache": {
    "available": true,
    "keyspace_hits": 312,
    "keyspace_misses": 89,
    "hit_rate": 77.81
  },
  "storage": {
    "backend": "local",
    "uploads_count": 12,
    "generated_count": 93
  }
}
```

**Implementation:**
```python
@app.get("/api/system/stats")
async def system_stats():
    analyses, documents, applications = await asyncio.gather(
        db.scalar(select(func.count()).select_from(AnalysisSession)),
        db.scalar(select(func.count()).select_from(GeneratedDocument)),
        db.scalar(select(func.count()).select_from(JobApplication)),
    )
    cache_stats = await cache.get_stats()
    return SystemStats(database=..., cache=cache_stats, storage=...)
```

The three database count queries run concurrently using `asyncio.gather`, keeping the endpoint fast.

### 7.3 Agent Metrics — `GET /api/agent/metrics`

Returns runtime statistics for the LangChain agent — total actions executed, success rate, and a breakdown by action type.

**Response:**
```json
{
  "total_actions": 24,
  "successful_actions": 22,
  "failed_actions": 2,
  "success_rate": 91.67,
  "action_breakdown": {
    "parse_pdf": 8,
    "analyze_skill_gap": 4,
    "generate_tailored_resume": 4,
    "send_application_email": 3,
    "validate_documents": 5
  }
}
```

### 7.4 Frontend Monitoring Dashboard

**File:** `frontend/components/MonitoringDashboard.tsx`

The System Monitor tab in the UI polls `/api/system/stats` and `/api/health` every **30 seconds** and displays:

- Service health indicators (green / grey dot per service)
- Database record counts (analyses, documents, applications)
- Redis availability and cache hit-rate percentage
- Storage backend name and file counts
- Application uptime

---

## 8. Deployment Guide

### 8.1 Local Development (no Docker)

```bash
# 1. Install backend dependencies
cd backend
pip install -r requirements.txt

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — set GEMINI_API_KEY at minimum

# 3. Start backend (uses SQLite by default — no database setup needed)
python main.py

# 4. In another terminal, start frontend
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

### 8.2 Docker Compose (recommended)

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env — set GEMINI_API_KEY

# 2. Build and start all four services
docker compose up --build

# 3. Check all services are healthy
docker compose ps
```

Open `http://localhost:3000`. The stack starts in order: PostgreSQL → Redis → Backend → Frontend.

**Useful commands:**

```bash
# View logs from all services
docker compose logs -f

# View logs from one service
docker compose logs -f backend

# Stop everything
docker compose down

# Stop and delete the database volume (full reset)
docker compose down -v
```

### 8.3 Switching to AWS S3 Storage

```bash
# In .env
STORAGE_BACKEND=s3
S3_BUCKET=my-career-assistant-bucket
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

Restart the backend: `docker compose restart backend`. No code changes required.

### 8.4 Switching to Google Cloud Storage

```bash
# In .env
STORAGE_BACKEND=gcs
GCS_BUCKET=my-career-assistant-bucket
GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json
```

Mount the service account file into the backend container by adding to `docker-compose.yml`:

```yaml
backend:
  volumes:
    - ./service-account.json:/app/service-account.json:ro
```

### 8.5 Production Cloud Deployment Checklist

| Step | Action |
|------|--------|
| Database | Replace the `postgres` container with AWS RDS or Google Cloud SQL; update `DATABASE_URL` |
| Cache | Replace the `redis` container with AWS ElastiCache or Google Memorystore; update `REDIS_URL` |
| Storage | Set `STORAGE_BACKEND=s3` or `gcs` with appropriate credentials |
| Secrets | Move `.env` values to AWS Secrets Manager, GCP Secret Manager, or Kubernetes Secrets |
| Frontend URL | Set `NEXT_PUBLIC_API_URL` to the backend's public domain at build time |
| TLS | Terminate HTTPS at a load balancer or API gateway in front of the backend |
| Scaling | Both backend and frontend are stateless — scale horizontally behind a load balancer |

---

*All cloud service implementations are in the `backend/` directory. Configuration reference is in `.env.example`. The Docker stack definition is in `docker-compose.yml`.*
