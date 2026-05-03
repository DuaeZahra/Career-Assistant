import os
import logging
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class StorageService:
    """
    Cloud-agnostic file storage abstraction.

    Backends (set via STORAGE_BACKEND env var):
      local  — filesystem (default; works out of the box)
      s3     — AWS S3 (needs AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET)
      gcs    — Google Cloud Storage (needs GCS_BUCKET + GOOGLE_APPLICATION_CREDENTIALS)
    """

    def __init__(self, backend: str = "local", base_dir: str = "."):
        self.backend = backend
        self.base_dir = base_dir
        self._s3 = None
        self._gcs = None
        logger.info(f"Storage backend: {backend}")

    # ── Public API ────────────────────────────────────────────────────────────

    async def save_upload(self, data: bytes, filename: str) -> str:
        return await self._write(data, f"uploads/{filename}")

    async def save_generated(self, data: bytes, filename: str) -> str:
        return await self._write(data, f"generated/{filename}")

    async def get_local_path(self, key: str) -> Optional[str]:
        """Return a filesystem path usable by the app.
        For cloud backends the file is downloaded to a temp location."""
        if self.backend == "local":
            path = os.path.join(self.base_dir, key)
            return path if os.path.exists(path) else None
        data = await self._read(key)
        if data is None:
            return None
        suffix = Path(key).suffix
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(data)
        tmp.close()
        return tmp.name

    def count_files(self, folder: str) -> int:
        if self.backend == "local":
            path = os.path.join(self.base_dir, folder)
            return len(os.listdir(path)) if os.path.exists(path) else 0
        return -1  # listing not implemented for cloud backends

    # ── Dispatch ─────────────────────────────────────────────────────────────

    async def _write(self, data: bytes, key: str) -> str:
        if self.backend == "s3":
            return await self._s3_put(data, key)
        if self.backend == "gcs":
            return await self._gcs_put(data, key)
        return self._local_write(data, key)

    async def _read(self, key: str) -> Optional[bytes]:
        if self.backend == "s3":
            return await self._s3_get(key)
        if self.backend == "gcs":
            return await self._gcs_get(key)
        return self._local_read(key)

    # ── Local ─────────────────────────────────────────────────────────────────

    def _local_write(self, data: bytes, key: str) -> str:
        path = os.path.join(self.base_dir, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        return key

    def _local_read(self, key: str) -> Optional[bytes]:
        path = os.path.join(self.base_dir, key)
        try:
            with open(path, "rb") as f:
                return f.read()
        except FileNotFoundError:
            return None

    # ── AWS S3 ────────────────────────────────────────────────────────────────

    def _s3_client(self):
        if self._s3 is None:
            import boto3
            from config import settings
            self._s3 = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION,
            )
        return self._s3

    async def _s3_put(self, data: bytes, key: str) -> str:
        import asyncio
        from config import settings
        client = self._s3_client()
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None,
            lambda: client.put_object(Bucket=settings.S3_BUCKET, Key=key, Body=data),
        )
        return key

    async def _s3_get(self, key: str) -> Optional[bytes]:
        import asyncio
        from config import settings
        client = self._s3_client()
        loop = asyncio.get_running_loop()
        try:
            resp = await loop.run_in_executor(
                None,
                lambda: client.get_object(Bucket=settings.S3_BUCKET, Key=key),
            )
            return resp["Body"].read()
        except Exception:
            return None

    # ── Google Cloud Storage ──────────────────────────────────────────────────

    def _gcs_client(self):
        if self._gcs is None:
            from google.cloud import storage as gcs
            self._gcs = gcs.Client()
        return self._gcs

    async def _gcs_put(self, data: bytes, key: str) -> str:
        import asyncio
        from config import settings
        client = self._gcs_client()
        bucket = client.bucket(settings.GCS_BUCKET)
        blob = bucket.blob(key)
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, lambda: blob.upload_from_string(data))
        return key

    async def _gcs_get(self, key: str) -> Optional[bytes]:
        import asyncio
        from config import settings
        client = self._gcs_client()
        bucket = client.bucket(settings.GCS_BUCKET)
        blob = bucket.blob(key)
        loop = asyncio.get_running_loop()
        try:
            return await loop.run_in_executor(None, blob.download_as_bytes)
        except Exception:
            return None


storage: Optional[StorageService] = None


def init_storage(backend: str, base_dir: str) -> StorageService:
    global storage
    storage = StorageService(backend=backend, base_dir=base_dir)
    return storage
