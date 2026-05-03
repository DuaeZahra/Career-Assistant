import asyncio
import os
import time
import uuid
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, func as sqlfunc
from dotenv import load_dotenv

from config import settings
from database import init_db
import database
from models.db_models import AnalysisSession, GeneratedDocument, JobApplication
from models.schemas import (
    AnalysisResult, JobAnalysis, ResumeAnalysis, SkillGap,
    GeneratedDocument as GenDocSchema, UploadResponse,
    EmailRequest, EmailResponse,
    AgentRequest, AgentResponse,
    AnalysisHistoryItem, SystemStats, DatabaseStats, CacheStats, StorageStats,
)
from services.pdf_parser import PDFParser
from services.gemini_service import GeminiService
from services.skill_analyzer import SkillAnalyzer
from services.document_generator import DocumentGenerator
from services.email_service import EmailService
from services.agent_service import CareerAgentService
from services.cache_service import cache
from services.storage_service import init_storage, storage as _storage_ref  # noqa: F401
# Re-export under the name used by endpoints; the singleton is mutated by init_storage,
# so we always fetch via the module to get the live object.
import services.storage_service as _storage_module

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
START_TIME = time.time()

# ── Lifespan: startup / shutdown ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db(settings.DATABASE_URL)
    await cache.connect(settings.REDIS_URL)
    init_storage(settings.STORAGE_BACKEND, BASE_DIR)
    logger.info(
        f"App started — DB: {settings.DATABASE_URL.split('://')[0]}, "
        f"Cache: {'on' if cache.available else 'off'}, "
        f"Storage: {settings.STORAGE_BACKEND}"
    )
    yield
    # Shutdown
    await cache.close()

# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Automated Career Assistant API",
    description="AI-powered resume tailoring and cover letter generation",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Service singletons ────────────────────────────────────────────────────────

GEMINI_API_KEY = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY not set")

gemini_service = GeminiService(GEMINI_API_KEY) if GEMINI_API_KEY else None
pdf_parser = PDFParser()
skill_analyzer = SkillAnalyzer()
document_generator = DocumentGenerator(output_dir=os.path.join(BASE_DIR, "generated"))

# Fallback in-memory store (used when DB is unavailable)
analysis_store: dict = {}

# ── DB helpers ────────────────────────────────────────────────────────────────

async def _save_analysis(
    session_id: str,
    resume_filename: str,
    job_filename: str,
    result: AnalysisResult,
    from_cache: bool = False,
    resume_key: str = "",
    job_key: str = "",
) -> None:
    if database.AsyncSessionLocal is None:
        return
    try:
        async with database.AsyncSessionLocal() as db:
            row = AnalysisSession(
                id=session_id,
                resume_filename=resume_filename,
                job_filename=job_filename,
                resume_storage_key=resume_key,
                job_storage_key=job_key,
                job_analysis=result.job_analysis.model_dump(),
                resume_analysis=result.resume_analysis.model_dump(),
                skill_gap=result.skill_gap.model_dump(),
                match_percentage=result.match_percentage,
                from_cache=from_cache,
            )
            db.add(row)
            await db.commit()
    except Exception as e:
        logger.warning(f"DB save failed: {e}")


async def _save_document(
    session_id: str, doc_type: str, fmt: str, filename: str,
    storage_key: str, size: int
) -> None:
    if database.AsyncSessionLocal is None:
        return
    try:
        async with database.AsyncSessionLocal() as db:
            db.add(GeneratedDocument(
                session_id=session_id,
                doc_type=doc_type,
                format=fmt,
                filename=filename,
                storage_key=storage_key,
                file_size_bytes=size,
            ))
            await db.commit()
    except Exception as e:
        logger.warning(f"DB doc save failed: {e}")


async def _save_application(
    session_id: str, recipient: str, subject: str, status: str, n_attachments: int
) -> None:
    if database.AsyncSessionLocal is None:
        return
    try:
        async with database.AsyncSessionLocal() as db:
            db.add(JobApplication(
                session_id=session_id,
                recipient_email=recipient,
                subject=subject,
                status=status,
                attachments_count=n_attachments,
            ))
            await db.commit()
    except Exception as e:
        logger.warning(f"DB application save failed: {e}")

# ── Core endpoints ────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "Automated Career Assistant API", "status": "running", "version": settings.APP_VERSION}


@app.post("/api/upload-and-analyze", response_model=AnalysisResult)
async def upload_and_analyze(
    resume: UploadFile = File(...),
    job_description: UploadFile = File(...),
):
    try:
        if not resume.filename.endswith(".pdf"):
            raise HTTPException(400, "Resume must be a PDF file")
        if not job_description.filename.endswith(".pdf"):
            raise HTTPException(400, "Job description must be a PDF file")

        resume_id = f"resume_{uuid.uuid4().hex}.pdf"
        job_id = f"job_{uuid.uuid4().hex}.pdf"

        resume_bytes = await resume.read()
        job_bytes = await job_description.read()

        # Storage — upload to configured backend
        from services.storage_service import storage
        if storage:
            resume_key = await storage.save_upload(resume_bytes, resume_id)
            job_key = await storage.save_upload(job_bytes, job_id)
            resume_path = await storage.get_local_path(resume_key) or os.path.join(BASE_DIR, "uploads", resume_id)
            job_path = await storage.get_local_path(job_key) or os.path.join(BASE_DIR, "uploads", job_id)
        else:
            resume_path = os.path.join(BASE_DIR, "uploads", resume_id)
            job_path = os.path.join(BASE_DIR, "uploads", job_id)
            resume_key = resume_path
            job_key = job_path
            os.makedirs(os.path.join(BASE_DIR, "uploads"), exist_ok=True)
            with open(resume_path, "wb") as f:
                f.write(resume_bytes)
            with open(job_path, "wb") as f:
                f.write(job_bytes)

        logger.info("Extracting text from PDFs...")
        resume_text, job_text = await asyncio.gather(
            pdf_parser.extract_text_from_pdf(resume_path),
            pdf_parser.extract_text_from_pdf(job_path),
        )

        if not resume_text:
            raise HTTPException(400, "Could not extract text from resume")
        if not job_text:
            raise HTTPException(400, "Could not extract text from job description")
        if not gemini_service:
            raise HTTPException(500, "AI service not configured. Set GEMINI_API_KEY")

        from_cache = False

        # Redis cache — check both keys concurrently, then fire missing Gemini calls together
        job_analysis_data, resume_analysis_data = await asyncio.gather(
            cache.get("job_analysis", job_text),
            cache.get("resume_analysis", resume_text),
        )

        if job_analysis_data:
            from_cache = True
        if resume_analysis_data:
            from_cache = True

        # For any cache miss, call Gemini in parallel
        async def _fetch_job():
            logger.info("Analyzing job description with Gemini...")
            data = await gemini_service.analyze_job_description(job_text)
            await cache.set("job_analysis", data, job_text, ttl=settings.CACHE_TTL)
            return data

        async def _fetch_resume():
            logger.info("Analyzing resume with Gemini...")
            data = await gemini_service.analyze_resume(resume_text)
            await cache.set("resume_analysis", data, resume_text, ttl=settings.CACHE_TTL)
            return data

        if job_analysis_data is None and resume_analysis_data is None:
            job_analysis_data, resume_analysis_data = await asyncio.gather(
                _fetch_job(), _fetch_resume()
            )
        elif job_analysis_data is None:
            job_analysis_data = await _fetch_job()
        elif resume_analysis_data is None:
            resume_analysis_data = await _fetch_resume()

        job_analysis = JobAnalysis(**job_analysis_data)
        resume_analysis = ResumeAnalysis(**resume_analysis_data)

        all_job_skills = job_analysis.required_skills + job_analysis.preferred_skills
        skill_gap_data = skill_analyzer.analyze_skill_gap(all_job_skills, resume_analysis.skills)
        skill_gap = SkillGap(**skill_gap_data)
        match_percentage = skill_analyzer.calculate_match_percentage(
            len(skill_gap.matching_skills), len(skill_gap.partial_skills), len(all_job_skills)
        )

        result = AnalysisResult(
            job_analysis=job_analysis,
            resume_analysis=resume_analysis,
            skill_gap=skill_gap,
            match_percentage=match_percentage,
        )

        analysis_id = uuid.uuid4().hex
        analysis_store[analysis_id] = {
            "result": result,
            "resume_path": resume_path,
            "job_path": job_path,
            "resume_text": resume_text,
            "job_text": job_text,
        }

        # Persist to DB (non-blocking on failure)
        await _save_analysis(
            analysis_id,
            resume.filename,
            job_description.filename,
            result,
            from_cache=from_cache,
            resume_key=resume_key,
            job_key=job_key,
        )

        logger.info(f"Analysis complete — match: {match_percentage:.1f}% | cached: {from_cache}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"upload_and_analyze error: {e}")
        raise HTTPException(500, f"Error processing files: {e}")


@app.post("/api/generate-resume")
async def generate_resume(
    resume: UploadFile = File(...),
    job_description: UploadFile = File(...),
    format: str = Form("docx"),
):
    try:
        if format not in ("docx", "pdf"):
            raise HTTPException(400, "Format must be 'docx' or 'pdf'")

        resume_id = f"resume_{uuid.uuid4().hex}.pdf"
        job_id = f"job_{uuid.uuid4().hex}.pdf"
        resume_path = os.path.join(BASE_DIR, "uploads", resume_id)
        job_path = os.path.join(BASE_DIR, "uploads", job_id)

        os.makedirs(os.path.join(BASE_DIR, "uploads"), exist_ok=True)
        with open(resume_path, "wb") as f:
            f.write(await resume.read())
        with open(job_path, "wb") as f:
            f.write(await job_description.read())

        resume_text = await pdf_parser.extract_text_from_pdf(resume_path)
        job_text = await pdf_parser.extract_text_from_pdf(job_path)
        if not resume_text or not job_text:
            raise HTTPException(400, "Could not extract text from files")
        if not gemini_service:
            raise HTTPException(500, "AI service not configured")

        # Cache tailored resume content
        tailored_content = await cache.get("tailored_resume", resume_text, job_text)
        if not tailored_content:
            logger.info("Generating tailored resume with Gemini...")
            tailored_content = await gemini_service.generate_tailored_resume(resume_text, job_text)
            await cache.set("tailored_resume", tailored_content, resume_text, job_text, ttl=settings.CACHE_TTL)

        filename = f"latest_resume.{format}"
        out_path = os.path.join(BASE_DIR, "generated", filename)
        if os.path.exists(out_path):
            os.remove(out_path)

        if format == "docx":
            file_path = document_generator.generate_docx_resume(tailored_content, filename)
        else:
            file_path = document_generator.generate_pdf_resume(tailored_content, filename)

        os.remove(resume_path)
        os.remove(job_path)

        file_size = os.path.getsize(file_path)
        await _save_document("", "resume", format, filename, f"generated/{filename}", file_size)

        media_type = (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            if format == "docx"
            else "application/pdf"
        )
        return FileResponse(file_path, media_type=media_type, filename=filename)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"generate_resume error: {e}")
        raise HTTPException(500, f"Error generating resume: {e}")


@app.post("/api/generate-cover-letter")
async def generate_cover_letter(
    resume: UploadFile = File(...),
    job_description: UploadFile = File(...),
    format: str = Form("docx"),
):
    try:
        if format not in ("docx", "pdf"):
            raise HTTPException(400, "Format must be 'docx' or 'pdf'")

        resume_id = f"resume_{uuid.uuid4().hex}.pdf"
        job_id = f"job_{uuid.uuid4().hex}.pdf"
        resume_path = os.path.join(BASE_DIR, "uploads", resume_id)
        job_path = os.path.join(BASE_DIR, "uploads", job_id)

        os.makedirs(os.path.join(BASE_DIR, "uploads"), exist_ok=True)
        with open(resume_path, "wb") as f:
            f.write(await resume.read())
        with open(job_path, "wb") as f:
            f.write(await job_description.read())

        resume_text = await pdf_parser.extract_text_from_pdf(resume_path)
        job_text = await pdf_parser.extract_text_from_pdf(job_path)
        if not resume_text or not job_text:
            raise HTTPException(400, "Could not extract text from files")
        if not gemini_service:
            raise HTTPException(500, "AI service not configured")

        cover_content = await cache.get("cover_letter", resume_text, job_text)
        if not cover_content:
            logger.info("Generating cover letter with Gemini...")
            cover_content = await gemini_service.generate_cover_letter(resume_text, job_text)
            await cache.set("cover_letter", cover_content, resume_text, job_text, ttl=settings.CACHE_TTL)

        filename = f"latest_cover_letter.{format}"
        out_path = os.path.join(BASE_DIR, "generated", filename)
        if os.path.exists(out_path):
            os.remove(out_path)

        if format == "docx":
            file_path = document_generator.generate_docx_cover_letter(cover_content, filename)
        else:
            file_path = document_generator.generate_pdf_cover_letter(cover_content, filename)

        os.remove(resume_path)
        os.remove(job_path)

        file_size = os.path.getsize(file_path)
        await _save_document("", "cover_letter", format, filename, f"generated/{filename}", file_size)

        media_type = (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            if format == "docx"
            else "application/pdf"
        )
        return FileResponse(file_path, media_type=media_type, filename=filename)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"generate_cover_letter error: {e}")
        raise HTTPException(500, f"Error generating cover letter: {e}")


@app.post("/api/send-email", response_model=EmailResponse)
async def send_application_email(request: EmailRequest):
    try:
        smtp_server = os.getenv("SMTP_SERVER", settings.SMTP_SERVER)
        smtp_port = int(os.getenv("SMTP_PORT", str(settings.SMTP_PORT)))
        sender_email = os.getenv("SENDER_EMAIL", settings.SENDER_EMAIL)
        sender_password = os.getenv("SENDER_PASSWORD", settings.SENDER_PASSWORD)

        if not sender_email or not sender_password:
            raise HTTPException(500, "Email not configured. Set SENDER_EMAIL and SENDER_PASSWORD")

        email_service = EmailService(smtp_server, smtp_port, sender_email, sender_password)

        if not email_service.validate_email(request.recipient_email):
            raise HTTPException(400, "Invalid recipient email address")

        def resolve_path(path: str) -> Optional[str]:
            if not path:
                return None
            if os.path.isabs(path) and os.path.exists(path):
                return path
            clean = path.lstrip("backend/").lstrip("backend\\")
            resolved = os.path.join(BASE_DIR, clean)
            return resolved if os.path.exists(resolved) else None

        attachments = [p for p in (resolve_path(request.resume_path), resolve_path(request.cover_letter_path)) if p]

        if not attachments:
            raise HTTPException(400, f"No valid attachments found — resume: {request.resume_path}")

        success = await email_service.send_application_email(
            recipient_email=request.recipient_email,
            subject=request.subject,
            body=request.body,
            attachment_paths=attachments,
        )

        status = "sent" if success else "failed"
        await _save_application("", request.recipient_email, request.subject, status, len(attachments))

        if success:
            return EmailResponse(success=True, message="Application email sent successfully!")
        raise HTTPException(500, "Failed to send email")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"send_email error: {e}")
        raise HTTPException(500, f"Error sending email: {e}")

# ── Agent endpoints (unchanged logic) ────────────────────────────────────────

career_agent = None


def get_agent():
    global career_agent
    if career_agent is None and GEMINI_API_KEY:
        career_agent = CareerAgentService(
            api_key=GEMINI_API_KEY,
            document_generator=document_generator,
            output_dir=os.path.join(BASE_DIR, "generated"),
        )
    return career_agent


@app.post("/api/agent/run", response_model=AgentResponse)
async def run_agent(request: AgentRequest):
    try:
        agent = get_agent()
        if not agent:
            raise HTTPException(500, "Agent not configured. Set GEMINI_API_KEY")
        result = await agent.run(request.task)
        return AgentResponse(
            success=result.get("success", False),
            output=result.get("output", ""),
            intermediate_steps=result.get("intermediate_steps"),
            action_history=result.get("action_history"),
            error=result.get("error"),
        )
    except Exception as e:
        raise HTTPException(500, f"Agent execution error: {e}")


@app.get("/api/agent/metrics")
async def get_agent_metrics():
    agent = get_agent()
    if not agent:
        return {"message": "Agent not initialized yet"}
    return agent.get_metrics()


@app.get("/api/agent/tools")
async def list_agent_tools():
    agent = get_agent()
    if not agent:
        return {"message": "Agent not initialized yet", "tools": []}
    return {
        "total_tools": len(agent.tools),
        "tools": [{"name": t.name, "description": t.description} for t in agent.tools],
        "framework": "LangChain with Google Gemini",
        "agent_type": "ReAct (Reasoning + Acting)",
    }

# ── Cloud / monitoring endpoints ──────────────────────────────────────────────

@app.get("/api/history")
async def get_history():
    """Return the 50 most-recent analysis sessions from the database."""
    if database.AsyncSessionLocal is None:
        return {"available": False, "items": [], "message": "Database not configured"}
    try:
        async with database.AsyncSessionLocal() as db:
            rows = (await db.execute(
                select(AnalysisSession)
                .order_by(AnalysisSession.created_at.desc())
                .limit(50)
            )).scalars().all()
        return {
            "available": True,
            "items": [
                AnalysisHistoryItem(
                    id=r.id,
                    created_at=r.created_at.isoformat() if r.created_at else None,
                    resume_filename=r.resume_filename,
                    job_filename=r.job_filename,
                    match_percentage=r.match_percentage,
                    from_cache=bool(r.from_cache),
                    job_title=(r.job_analysis or {}).get("job_title"),
                    company_name=(r.job_analysis or {}).get("company_name"),
                ).model_dump()
                for r in rows
            ],
        }
    except Exception as e:
        logger.error(f"History fetch error: {e}")
        return {"available": False, "items": [], "error": str(e)}


@app.get("/api/history/{session_id}")
async def get_history_item(session_id: str):
    """Return full analysis details for a specific session."""
    if database.AsyncSessionLocal is None:
        raise HTTPException(503, "Database not configured")
    async with database.AsyncSessionLocal() as db:
        row = (await db.execute(
            select(AnalysisSession).where(AnalysisSession.id == session_id)
        )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Session not found")
    return {
        "id": row.id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "resume_filename": row.resume_filename,
        "job_filename": row.job_filename,
        "match_percentage": row.match_percentage,
        "from_cache": row.from_cache,
        "job_analysis": row.job_analysis,
        "resume_analysis": row.resume_analysis,
        "skill_gap": row.skill_gap,
    }


@app.get("/api/system/stats")
async def system_stats():
    """Cloud monitoring endpoint — DB counts, Redis hit-rate, storage info."""
    storage = _storage_module.storage  # module-level singleton, no per-call import

    db_stats: dict = {"available": False, "total_analyses": 0, "total_documents": 0, "total_applications": 0}
    if database.AsyncSessionLocal is not None:
        try:
            async with database.AsyncSessionLocal() as db:
                analyses, documents, applications = await asyncio.gather(
                    db.scalar(select(sqlfunc.count()).select_from(AnalysisSession)),
                    db.scalar(select(sqlfunc.count()).select_from(GeneratedDocument)),
                    db.scalar(select(sqlfunc.count()).select_from(JobApplication)),
                )
                db_stats = {
                    "available": True,
                    "total_analyses": analyses or 0,
                    "total_documents": documents or 0,
                    "total_applications": applications or 0,
                }
        except Exception as e:
            logger.warning(f"DB stats error: {e}")

    cache_stats, = await asyncio.gather(cache.get_stats())
    return SystemStats(
        app_version=settings.APP_VERSION,
        database=DatabaseStats(**db_stats),
        cache=CacheStats(**cache_stats),
        storage=StorageStats(
            backend=settings.STORAGE_BACKEND,
            uploads_count=storage.count_files("uploads") if storage else 0,
            generated_count=storage.count_files("generated") if storage else 0,
        ),
    )


@app.get("/api/health")
async def health_check():
    storage = _storage_module.storage  # module-level singleton, no per-call import
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "uptime_seconds": round(time.time() - START_TIME),
        "gemini_configured": gemini_service is not None,
        "agent_available": GEMINI_API_KEY is not None,
        "database": database.AsyncSessionLocal is not None,
        "cache": cache.available,
        "storage_backend": settings.STORAGE_BACKEND,
        "track_a_compliant": True,
        "features": {
            "langchain_integration": True,
            "tool_system": True,
            "real_actions": True,
            "persistent_storage": database.AsyncSessionLocal is not None,
            "redis_cache": cache.available,
            "cloud_storage": settings.STORAGE_BACKEND != "local",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
