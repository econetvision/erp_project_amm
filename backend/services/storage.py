"""Unified media storage for photos and logos.

Two interchangeable backends, selected by ``settings.storage_backend``:

* ``local`` — writes under ``settings.upload_root`` (default ``<backend>/uploads``).
  Point ``UPLOAD_ROOT`` at a mounted Railway volume so files survive redeploys.
* ``s3``   — stores in an S3-compatible bucket (AWS S3, Cloudflare R2, MinIO…).

Routers call :func:`save_image` and persist the returned reference on the model.
The ``/uploads/{path}`` route calls :func:`serve`, which returns the real object
or a route-appropriate placeholder when it is missing (so the UI/mobile app never
renders a broken image).
"""
from __future__ import annotations

import os

from fastapi.responses import FileResponse, Response, StreamingResponse

from config.settings import settings

# <backend>/ — this file lives at <backend>/services/storage.py
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULTS_DIR = os.path.join(_BASE_DIR, "static", "defaults")


def _upload_root() -> str:
    """Absolute local root for stored files (falls back to <backend>/uploads)."""
    root = settings.upload_root or os.path.join(_BASE_DIR, "uploads")
    return os.path.abspath(root)


def _key(category: str, filename: str) -> str:
    """Storage key / relative path, e.g. photos/users/1_abcd.jpg."""
    return f"photos/{category}/{filename}"


def default_media_path(rel_path: str) -> str:
    """Pick a placeholder image based on the route segment."""
    p = (rel_path or "").lower()
    if "companies" in p:
        name = "company.svg"
    elif "employees" in p:
        name = "employee.svg"
    elif "users" in p:
        name = "user.svg"
    else:
        name = "generic.svg"
    return os.path.join(_DEFAULTS_DIR, name)


def _s3_client():
    import boto3  # imported lazily so local deployments don't need the dependency

    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url or None,
        region_name=settings.s3_region or None,
        aws_access_key_id=settings.s3_access_key_id or None,
        aws_secret_access_key=settings.s3_secret_access_key or None,
    )


def save_image(category: str, filename: str, data: bytes, content_type: str = "image/jpeg") -> str:
    """Persist image bytes and return the reference to store on the model.

    Returns a ``/uploads/...`` relative path (served by this app) or, when
    ``s3_public_base_url`` is configured, an absolute public URL.
    """
    key = _key(category, filename)

    if settings.storage_backend == "s3":
        _s3_client().put_object(
            Bucket=settings.s3_bucket, Key=key, Body=data, ContentType=content_type,
        )
        if settings.s3_public_base_url:
            return f"{settings.s3_public_base_url.rstrip('/')}/{key}"
        return f"/uploads/{key}"

    # local backend
    dest = os.path.join(_upload_root(), key)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(data)
    return f"/uploads/{key}"


def serve(rel_path: str) -> Response:
    """Return the stored object for ``rel_path`` (relative to the uploads root),
    or a placeholder image if it is missing."""
    if settings.storage_backend == "s3":
        try:
            obj = _s3_client().get_object(Bucket=settings.s3_bucket, Key=rel_path)
            return StreamingResponse(
                obj["Body"].iter_chunks(),
                media_type=obj.get("ContentType", "application/octet-stream"),
            )
        except Exception:
            return FileResponse(default_media_path(rel_path), media_type="image/svg+xml")

    # local backend — guard against path traversal, then serve if present.
    root = _upload_root()
    full = os.path.abspath(os.path.join(root, rel_path))
    if full.startswith(root + os.sep) and os.path.isfile(full):
        return FileResponse(full)
    return FileResponse(default_media_path(rel_path), media_type="image/svg+xml")
