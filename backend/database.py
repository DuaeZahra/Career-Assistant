from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import logging

logger = logging.getLogger(__name__)

engine = None
AsyncSessionLocal = None


class Base(DeclarativeBase):
    pass


async def init_db(database_url: str):
    global engine, AsyncSessionLocal
    try:
        engine = create_async_engine(database_url, echo=False, pool_pre_ping=True)
        AsyncSessionLocal = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info(f"Database initialized ({database_url.split('://')[0]})")
    except Exception as e:
        logger.warning(f"Database unavailable — running without persistence: {e}")
        engine = None
        AsyncSessionLocal = None
