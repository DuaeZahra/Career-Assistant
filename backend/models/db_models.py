import uuid
from sqlalchemy import Column, String, Float, DateTime, JSON, Integer, Boolean
from sqlalchemy.sql import func
from database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class AnalysisSession(Base):
    __tablename__ = "analysis_sessions"

    id = Column(String(32), primary_key=True, default=_uuid)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    resume_filename = Column(String(255))
    job_filename = Column(String(255))
    resume_storage_key = Column(String(512))
    job_storage_key = Column(String(512))

    job_analysis = Column(JSON)
    resume_analysis = Column(JSON)
    skill_gap = Column(JSON)
    match_percentage = Column(Float)
    from_cache = Column(Boolean, default=False)


class GeneratedDocument(Base):
    __tablename__ = "generated_documents"

    id = Column(String(32), primary_key=True, default=_uuid)
    session_id = Column(String(32))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    doc_type = Column(String(50))   # "resume" | "cover_letter"
    format = Column(String(10))     # "docx"  | "pdf"
    filename = Column(String(255))
    storage_key = Column(String(512))
    file_size_bytes = Column(Integer)


class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(String(32), primary_key=True, default=_uuid)
    session_id = Column(String(32))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    recipient_email = Column(String(255))
    subject = Column(String(500))
    status = Column(String(50))       # "sent" | "failed" | "pending"
    attachments_count = Column(Integer, default=0)
