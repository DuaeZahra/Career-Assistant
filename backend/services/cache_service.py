import hashlib
import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class CacheService:
    """
    Redis-backed cache for expensive Gemini AI responses.
    Gracefully degrades to a no-op when Redis is unavailable.
    """

    def __init__(self):
        self._client = None
        self.available = False

    async def connect(self, redis_url: str) -> None:
        try:
            import redis.asyncio as aioredis
            self._client = aioredis.from_url(
                redis_url, encoding="utf-8", decode_responses=True
            )
            await self._client.ping()
            self.available = True
            logger.info("Redis cache connected")
        except Exception as e:
            logger.warning(f"Redis unavailable — caching disabled: {e}")
            self.available = False

    # ── Cache key ────────────────────────────────────────────────────────────

    def _key(self, namespace: str, *parts: str) -> str:
        h = hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()[:16]
        return f"career:{namespace}:{h}"

    # ── Public helpers ────────────────────────────────────────────────────────

    async def get(self, namespace: str, *key_parts: str) -> Optional[Any]:
        if not self.available:
            return None
        try:
            raw = await self._client.get(self._key(namespace, *key_parts))
            if raw:
                logger.info(f"Cache HIT  [{namespace}]")
                return json.loads(raw)
            logger.info(f"Cache MISS [{namespace}]")
            return None
        except Exception as e:
            logger.warning(f"Cache get error: {e}")
            return None

    async def set(
        self, namespace: str, value: Any, *key_parts: str, ttl: int = 3600
    ) -> bool:
        if not self.available:
            return False
        try:
            await self._client.set(
                self._key(namespace, *key_parts), json.dumps(value), ex=ttl
            )
            return True
        except Exception as e:
            logger.warning(f"Cache set error: {e}")
            return False

    async def get_stats(self) -> dict:
        if not self.available:
            return {"available": False}
        try:
            info = await self._client.info("stats")
            hits = info.get("keyspace_hits", 0)
            misses = info.get("keyspace_misses", 0)
            return {
                "available": True,
                "keyspace_hits": hits,
                "keyspace_misses": misses,
                "hit_rate": round(hits / max(hits + misses, 1) * 100, 2),
            }
        except Exception as e:
            return {"available": False, "error": str(e)}

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()


cache = CacheService()
