# Cloud Architecture & Operations

Everything about how this app is deployed, how the cloud services fit together, and how to update the live deployment when you change the local codebase.

---

## Part 1 — Cloud Services

### What's running and where

The entire stack runs on a single AWS EC2 instance, with all 4 services orchestrated by Docker Compose. From the public internet, only ports 22 (SSH), 3000 (Next.js), and 8000 (FastAPI) are exposed via the security group; Postgres and Redis listen only on the Docker bridge network and are unreachable from outside.

```
Internet
   │
   │ TCP 22 (SSH, your IP only)
   │ TCP 3000 (Next.js)
   │ TCP 8000 (FastAPI)
   ▼
┌───────────────────────────────────────────────────────┐
│  AWS VPC                                              │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Public Subnet (10.0.1.0/24)                    │  │
│  │  ┌───────────────────────────────────────────┐  │  │
│  │  │  EC2 Instance (Ubuntu 24.04, 20 GB EBS)   │  │  │
│  │  │  ┌────────────────────────────────────┐   │  │  │
│  │  │  │  Docker Compose network            │   │  │  │
│  │  │  │  ┌─────────┐  ┌─────────┐          │   │  │  │
│  │  │  │  │ frontend├─►│ backend │          │   │  │  │
│  │  │  │  └─────────┘  └────┬────┘          │   │  │  │
│  │  │  │       :3000        │               │   │  │  │
│  │  │  │                ┌───┴────┬─────┐    │   │  │  │
│  │  │  │                ▼        ▼     ▼    │   │  │  │
│  │  │  │           postgres   redis   files │   │  │  │
│  │  │  │            :5432    :6379    /app/ │   │  │  │
│  │  │  │           (volume)         uploads │   │  │  │
│  │  │  └────────────────────────────────────┘   │  │  │
│  │  └───────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  Internet Gateway ◄──── Route Table ◄──── Subnet      │
└───────────────────────────────────────────────────────┘
```

### AWS resources used

| Service | Resource | Purpose |
|---|---|---|
| **EC2** | 1× Ubuntu 24.04 instance | Compute host running Docker |
| **EBS** | 20 GB gp3 root volume | OS + Docker images + Postgres data + uploads |
| **VPC** | 1× custom VPC | Network isolation |
| **Subnet** | 1× public subnet | Houses the EC2 |
| **Internet Gateway** | 1 | Public IP routing |
| **Route Table** | 1 | Subnet ↔ IGW binding |
| **Security Group** | 1 | Inbound rules: 22 / 3000 / 8000 |
| **IAM** | 1× user with programmatic creds | Optional, for S3 storage backend |

The EC2 box also has **swap configured** (necessary because the Next.js Turbopack production build briefly uses more RAM than a small instance has).

### The four containers

| | Image | Listens | What it does |
|---|---|---|---|
| **frontend** | `node:20-alpine` (multi-stage) | `:3000` | Next.js 16 standalone server. Static + SSR. Talks to backend via the public `NEXT_PUBLIC_API_URL` baked in at build time. |
| **backend** | `python:3.11-slim` | `:8000` | FastAPI app. Async SQLAlchemy talks to Postgres; `redis-py` talks to Redis; Gemini API calls go out over HTTPS. |
| **postgres** | `postgres:16-alpine` | `:5432` (internal) | Persists analysis sessions, generated documents, sent applications. Volume-backed so data survives container restarts. |
| **redis** | `redis:7-alpine` | `:6379` (internal) | LRU cache (256 MB cap) for Gemini responses keyed by content hash. Cuts demo costs since identical inputs hit the cache. |

All four start in dependency order. Backend won't start until Postgres + Redis pass their healthchecks; frontend won't start until backend passes its `/api/health` check.

### Cloud-native concepts demonstrated

- **Containerization** — every service in its own image, immutable, reproducible
- **Service orchestration** — Docker Compose handles dependency order, healthchecks, restarts
- **Multi-stage builds** — frontend Dockerfile builds in `node:20-alpine` then runs in a stripped-down `runner` stage with non-root user (~80 MB final image vs ~1 GB single-stage)
- **Persistent volumes** — Postgres data survives `docker compose down`
- **12-factor configuration** — every secret and URL comes from environment variables, never code
- **Build-time vs runtime env vars** — `NEXT_PUBLIC_API_URL` is baked into the JS bundle at build (it's a client-side var), while `DATABASE_URL` is read at runtime
- **Healthchecks** — every container reports its own readiness via Docker; the orchestrator gates startup on it
- **CORS** — explicit cross-origin allowlist managed by the backend
- **Caching layer** — distributed (Redis) instead of in-process, so it survives backend restarts
- **Pluggable storage** — file uploads go through a `local | s3 | gcs` abstraction switchable by env var

---

## Part 2 — Initial Deployment

This section is what we did once to get the app on AWS. You only repeat this if the EC2 box is destroyed.

### Steps performed

1. **Created an AWS account** with root user and 2FA
2. **Created an IAM user** `career-assistant-server` with programmatic credentials (no console access). Permissions limited to S3 (for the optional storage backend); EC2 management is done through the root account from the console.
3. **Created a VPC** with one public subnet (`10.0.1.0/24`), one Internet Gateway attached, and a route table sending `0.0.0.0/0` traffic to the IGW.
4. **Launched EC2** — Ubuntu 24.04 server, instance type with at least 2 GB RAM, 20 GB gp3 root volume, attached to the public subnet.
5. **Created a security group** with inbound rules:
   - TCP 22 from `<your-home-ip>/32` (SSH)
   - TCP 3000 from `0.0.0.0/0` (Next.js, public)
   - TCP 8000 from `0.0.0.0/0` (FastAPI, public)
   - All outbound allowed
6. **Configured swap** on the instance:
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
7. **Installed Docker + Compose** via the official `get-docker.sh` script and added `ubuntu` to the `docker` group.
8. **Cloned the repo** into `~/Career-Assistant`.
9. **Created `.env`** on the EC2 box with all required variables (see README's Configuration table). Critically:
   - `ALLOWED_ORIGINS=http://<ec2-public-ip>:3000`
   - `NEXT_PUBLIC_API_URL=http://<ec2-public-ip>:8000`
   - `GEMINI_API_KEY`
   - `SENDER_EMAIL`, `SENDER_PASSWORD` (Gmail app password)
10. **Started the stack**: `docker compose up -d --build`

### Things that bit us during deployment

These are real problems we hit and resolved — read these as a checklist before debugging.

| Symptom | Root cause | Fix |
|---|---|---|
| Frontend loads but every API call fails with CORS | `ALLOWED_ORIGINS` not set on EC2 → backend defaulted to allowing only `localhost:3000` | Add `ALLOWED_ORIGINS=http://<ec2-ip>:3000` to `.env`; recreate backend |
| `/api/health` reports `database: false` even though Postgres container is healthy | `from database import AsyncSessionLocal` in `main.py` captured `None` at import time; the global mutated by `init_db` never propagated back | Switched to `import database` + `database.AsyncSessionLocal` everywhere — see commit history |
| `database: false` on a fresh start, then becomes `true` after a restart | Race condition: backend started before Postgres was ready, `init_db` failed silently | `depends_on.condition: service_healthy` in compose; recreating backend after Postgres is up resolves it |
| Frontend "send email" button does nothing | Frontend components hardcoded `http://localhost:8000` instead of using `NEXT_PUBLIC_API_URL` | Replaced 4 hardcoded URLs in `FileUpload.tsx`, `DocumentGeneration.tsx`, `EmailSender.tsx`; rebuild frontend |
| Email send returns `535 BadCredentials` | Gmail App Password copied with spaces, or regular password used | Regenerate at myaccount.google.com/apppasswords; paste as 16 chars no spaces |
| Browser shows "blob URL loaded over insecure connection" warning when downloading docs | App is HTTP, browser warns about `URL.createObjectURL()` | Cosmetic — files still download. Fix only by adding HTTPS (Cloudflare Tunnel / Caddy + DuckDNS / ALB+ACM) |

---

## Part 3 — Update Workflow: Local → Deployed

This is the most important part for ongoing work. **Editing files in VS Code does NOT update the live deployment.** Your local repo and the EC2 box are two separate copies.

### Mental model

```
┌─────────────────────┐                    ┌─────────────────────┐
│   Your laptop       │                    │   EC2 box           │
│   (VS Code edits    │  ─── scp / git ──► │   ~/Career-         │
│    happen here)     │                    │   Assistant/        │
│                     │                    │                     │
│   git working tree  │                    │   git working tree  │
└─────────────────────┘                    └─────────────────────┘
                                                     │
                                          docker compose build
                                                     │
                                                     ▼
                                           ┌─────────────────┐
                                           │ Live containers │
                                           └─────────────────┘
```

To update the running app you need three steps in order:

1. **Get changed files onto the EC2 box** (scp or `git pull`)
2. **Rebuild the Docker image** for whatever you changed (frontend, backend, or both)
3. **Recreate the container** so it picks up the new image

Restarting the container alone (`docker compose restart backend`) **does not pick up code changes** — Docker has a cached image and your code lives inside that image. You must rebuild.

### Workflow A — quick patch (one or two files)

Use this when you're iterating fast and don't want to push to GitHub yet.

```powershell
# 1. Upload the changed file(s) directly
scp -i career-assistant-key.pem .\backend\main.py ubuntu@44.195.26.38:~/Career-Assistant/backend/main.py

# 2. Rebuild + recreate the affected service
ssh -i career-assistant-key.pem ubuntu@44.195.26.38 "cd ~/Career-Assistant && docker compose build backend && docker compose up -d --force-recreate backend"

# 3. Verify (60-second wait for Next.js or 5 seconds for backend)
Invoke-RestMethod http://44.195.26.38:8000/api/health
```

For multiple files, list them all in one `scp`:

```powershell
scp -i career-assistant-key.pem `
  .\frontend\components\EmailSender.tsx `
  .\frontend\components\FileUpload.tsx `
  .\frontend\components\DocumentGeneration.tsx `
  ubuntu@44.195.26.38:~/Career-Assistant/frontend/components/
```

### Workflow B — git-based deploy (preferred for real changes)

Use this when changes are committed and you want a clean deployment record.

```powershell
# Local — commit and push to GitHub
git add backend/main.py
git commit -m "fix: short message"
git push

# EC2 — pull and rebuild
ssh -i career-assistant-key.pem ubuntu@44.195.26.38
# now on the remote box:
cd ~/Career-Assistant
git pull
docker compose build backend
docker compose up -d --force-recreate backend
exit
```

Or as one local one-liner:

```powershell
ssh -i career-assistant-key.pem ubuntu@44.195.26.38 "cd ~/Career-Assistant && git pull && docker compose build && docker compose up -d --force-recreate"
```

### Which service to rebuild

| What you changed | Rebuild |
|---|---|
| `backend/**/*.py` | `backend` |
| `backend/Dockerfile` or `backend/requirements.txt` | `backend` |
| `frontend/**/*.tsx`, `*.ts`, `*.css` | `frontend` |
| `frontend/Dockerfile`, `package.json` | `frontend` |
| `docker-compose.yml` | All services (`docker compose up -d --force-recreate`) |
| `.env` only | Just `--force-recreate` (no build needed) |
| Postgres schema (`models/db_models.py`) | `backend`, then run migrations or recreate the volume |

### Common rebuild times

- **Backend image**: 10–30 seconds (cached layer for `pip install`)
- **Frontend image**: 60–200 seconds (Turbopack production build dominates)
- **Either, with Docker layer cache cold**: 3–5 minutes

### Things to watch out for after a redeploy

1. **Frontend cache** — your browser holds the old JS bundle. Hard-refresh (Ctrl+Shift+R) or open Incognito. The hash-suffixed bundle filenames change on each build, so a normal refresh usually picks the new one up, but force it to be sure.
2. **`.env` changes don't trigger rebuild** — they apply on container recreate only. If you edit `.env` and just run `docker compose up -d`, nothing happens. Use `--force-recreate`.
3. **Frontend env vars are baked at build time** — if you change `NEXT_PUBLIC_API_URL` in `.env`, you must `docker compose build frontend` (not just recreate). The variable is replaced into the JS bundle during `next build`.
4. **Backend env vars are read at runtime** — changing them only requires `--force-recreate backend`, no rebuild.
5. **Database schema changes** — `Base.metadata.create_all()` only creates new tables; it doesn't migrate existing ones. To apply column changes you'd need Alembic or to drop/recreate the `postgres_data` volume (loses data).

### One-liner cookbook

```powershell
# Tail backend logs live
ssh -i career-assistant-key.pem ubuntu@44.195.26.38 "cd ~/Career-Assistant && docker compose logs backend -f --tail 50"

# Tail frontend logs
ssh -i career-assistant-key.pem ubuntu@44.195.26.38 "cd ~/Career-Assistant && docker compose logs frontend -f --tail 50"

# Restart everything (no rebuild)
ssh -i career-assistant-key.pem ubuntu@44.195.26.38 "cd ~/Career-Assistant && docker compose restart"

# Full rebuild and recreate (everything)
ssh -i career-assistant-key.pem ubuntu@44.195.26.38 "cd ~/Career-Assistant && docker compose build && docker compose up -d --force-recreate"

# Inspect Postgres counts directly (useful for demo screenshots)
Invoke-RestMethod http://44.195.26.38:8000/api/system/stats

# Disk usage on EC2 (Docker images can pile up)
ssh -i career-assistant-key.pem ubuntu@44.195.26.38 "df -h / && docker system df"

# Reclaim disk space — removes unused images/networks/build cache
ssh -i career-assistant-key.pem ubuntu@44.195.26.38 "docker system prune -af"
```

---

## Part 4 — Troubleshooting Reference

### Health checklist

```powershell
# 1. Are all containers healthy?
ssh -i career-assistant-key.pem ubuntu@44.195.26.38 "cd ~/Career-Assistant && docker compose ps"

# 2. Backend says all dependencies up?
Invoke-RestMethod http://44.195.26.38:8000/api/health

# 3. Stats endpoint shows DB and cache?
Invoke-RestMethod http://44.195.26.38:8000/api/system/stats

# 4. CORS allows the frontend origin?
$r = Invoke-WebRequest -Uri "http://44.195.26.38:8000/api/health" -Headers @{"Origin"="http://44.195.26.38:3000"} -UseBasicParsing
$r.Headers.GetEnumerator() | Where-Object { $_.Key -like "access-control-*" }
```

### When SSH stops working

Symptom: `ssh: connect to host ... port 22: Connection timed out` while the app on `:3000` and `:8000` keeps responding.

Cause: Your residential / mobile / coffee-shop IP rotated, and your security group's port 22 rule pinned to your old IP.

Fix:
1. Check your current IP: `(Invoke-WebRequest -UseBasicParsing https://checkip.amazonaws.com).Content.Trim()`
2. AWS Console → EC2 → Security Groups → your SG → Edit inbound rules → port 22 → Source = "My IP" (auto-populates current) → Save

### When you've broken the live app

The fastest rollback is a `git revert` + redeploy. If you scp'd files without committing, you've lost the previous version locally — but the previous Docker image is still on EC2 unless you pruned. List images:

```powershell
ssh -i career-assistant-key.pem ubuntu@44.195.26.38 "docker images | grep career-assistant"
```

If a previous tagged image exists, you can re-run that tag manually. Otherwise, fix the code and redeploy forward — there's no "undo" once you've recreated the container with bad code.

### Logs you actually want during a demo

```powershell
# Most informative: filtered backend log of just request handling and AI calls
ssh -i career-assistant-key.pem ubuntu@44.195.26.38 "cd ~/Career-Assistant && docker compose logs backend -f --tail 0 | grep -vE 'GET /api/health'"
```

That shows uploads, Gemini calls, cache hits/misses, document generation, and email sends — without the noise of frontend health polling.

---

## Part 5 — Cost Optimization Notes

For an always-on demo box this stack costs roughly:

- **EC2 instance** — $5–15/month depending on size (free tier covers 12 months for `t2.micro`/`t3.micro`, but the frontend build needs more RAM)
- **EBS 20 GB gp3** — ~$1.60/month
- **Data transfer** — negligible for a demo
- **Gemini API** — covered by free tier for normal demo traffic
- **Gmail SMTP** — free
- **Total** — usually under $10/month for a small demo, $0 if on free tier

To minimize cost when not actively demoing:

1. **Stop (not terminate) the EC2 instance** when idle — preserves the EBS volume and `.env`, but the public IP changes on restart unless you've allocated an Elastic IP
2. **Allocate an Elastic IP** if you want a stable address ($3.60/month if associated)
3. **Snapshot before stopping for long periods** so you can recreate the instance from scratch later

When the IP changes after a stop/start cycle, two things break:

- `ALLOWED_ORIGINS` in `.env` still references the old IP → CORS fails. Update and recreate backend.
- `NEXT_PUBLIC_API_URL` baked into the frontend bundle still references the old IP → frontend hits the wrong host. Update `.env`, **rebuild** frontend.
- Your local SG rule for port 22 may also need updating if `My IP` rotated.

A more robust fix is to use a free domain (DuckDNS, FreeDNS) pointed at your EC2's public IP, and reference it in `.env` instead of the raw IP. Then when the IP changes, you only update the DNS record once.
