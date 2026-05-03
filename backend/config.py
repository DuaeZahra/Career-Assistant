from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "Automated Career Assistant"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    GEMINI_API_KEY: Optional[str] = None

    # SQLite for dev; swap to postgresql+asyncpg://... for Docker/prod
    DATABASE_URL: str = "sqlite+aiosqlite:///./career_assistant.db"

    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL: int = 3600  # seconds — 1 hour

    # Storage: "local" | "s3" | "gcs"
    STORAGE_BACKEND: str = "local"
    GCS_BUCKET: Optional[str] = None
    S3_BUCKET: Optional[str] = None
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"

    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SENDER_EMAIL: Optional[str] = None
    SENDER_PASSWORD: Optional[str] = None

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
