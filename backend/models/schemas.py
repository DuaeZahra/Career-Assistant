from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class SkillGap(BaseModel):
    """Model for skill gap analysis"""
    matching_skills: List[str]
    missing_skills: List[str]
    partial_skills: List[str]

class JobAnalysis(BaseModel):
    """Model for job description analysis"""
    required_skills: List[str]
    preferred_skills: List[str]
    job_title: Optional[str] = "Not Specified"
    company_name: Optional[str] = None
    contact_email: Optional[str] = None
    key_responsibilities: List[str]

class ResumeAnalysis(BaseModel):
    """Model for resume analysis"""
    candidate_name: Optional[str] = None
    skills: List[str]
    experience: List[str]
    education: List[str]
    summary: Optional[str] = None

class AnalysisResult(BaseModel):
    """Complete analysis result"""
    job_analysis: JobAnalysis
    resume_analysis: ResumeAnalysis
    skill_gap: SkillGap
    match_percentage: float

class GeneratedDocument(BaseModel):
    """Model for generated documents"""
    filename: str
    file_path: str
    content: str
    document_type: str  # "resume" or "cover_letter"

class UploadResponse(BaseModel):
    """Response after file upload"""
    success: bool
    message: str
    analysis_id: Optional[str] = None

class EmailRequest(BaseModel):
    """Request model for sending application email"""
    recipient_email: str
    subject: str
    body: str
    resume_path: str
    cover_letter_path: str

class EmailResponse(BaseModel):
    """Response after sending email"""
    success: bool
    message: str

class AgentRequest(BaseModel):
    """Request model for agent tasks"""
    task: str
    context: Optional[Dict[str, Any]] = None

class AgentResponse(BaseModel):
    """Response from agent execution"""
    success: bool
    output: str
    intermediate_steps: Optional[List[Any]] = None
    action_history: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None

# ── Cloud / monitoring schemas ────────────────────────────────────────────────

class AnalysisHistoryItem(BaseModel):
    id: str
    created_at: Optional[str] = None
    resume_filename: Optional[str] = None
    job_filename: Optional[str] = None
    match_percentage: Optional[float] = None
    from_cache: bool = False
    job_title: Optional[str] = None
    company_name: Optional[str] = None


class CacheStats(BaseModel):
    available: bool
    keyspace_hits: int = 0
    keyspace_misses: int = 0
    hit_rate: float = 0.0


class DatabaseStats(BaseModel):
    available: bool
    total_analyses: int = 0
    total_documents: int = 0
    total_applications: int = 0


class StorageStats(BaseModel):
    backend: str
    uploads_count: int = 0
    generated_count: int = 0


class SystemStats(BaseModel):
    app_version: str
    database: DatabaseStats
    cache: CacheStats
    storage: StorageStats
