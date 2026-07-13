"""IFSC directory service.

Lookups are served from the local ``ifsc_codes`` table, populated from the
Razorpay IFSC dataset (https://github.com/razorpay/ifsc/releases) via
``import_dataset`` / ``python import_ifsc.py``. The public
https://ifsc.razorpay.com API is only used as a fallback for codes that are
newer than the imported dataset; successful fallback hits are cached back
into the table.
"""
from __future__ import annotations

import csv
import io
import logging
import re
import tempfile

import httpx
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import SessionLocal
from models.ifsc import IfscCode, IfscDatasetMeta

logger = logging.getLogger(__name__)

RAZORPAY_IFSC_API = "https://ifsc.razorpay.com"
LATEST_RELEASE_API = "https://api.github.com/repos/razorpay/ifsc/releases/latest"
IFSC_PATTERN = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")

# ── Lookup ────────────────────────────────────────────────────────────────

def get_local(db: Session, ifsc_code: str) -> IfscCode | None:
    return db.query(IfscCode).filter(IfscCode.ifsc == ifsc_code).first()


def dataset_loaded(db: Session) -> bool:
    return db.query(IfscDatasetMeta.id).first() is not None


def to_razorpay_format(row: IfscCode) -> dict:
    """Mirror the response shape of the public ifsc.razorpay.com API."""
    return {
        "IFSC": row.ifsc,
        "BANK": row.bank,
        "BRANCH": row.branch or "",
        "CENTRE": row.centre or "",
        "DISTRICT": row.district or "",
        "STATE": row.state or "",
        "ADDRESS": row.address or "",
        "CITY": row.city or "",
        "CONTACT": row.contact or "",
        "MICR": row.micr or "",
        "SWIFT": row.swift or "",
        "ISO3166": row.iso3166 or "",
        "BANKCODE": row.ifsc[:4],
        "IMPS": row.imps,
        "RTGS": row.rtgs,
        "NEFT": row.neft,
        "UPI": row.upi,
        "SOURCE": "local",
    }


def _row_from_api_payload(data: dict) -> IfscCode:
    def _s(key, limit):
        val = data.get(key) or ""
        return str(val)[:limit] if val else None

    return IfscCode(
        ifsc=str(data["IFSC"]).upper()[:11],
        bank=str(data.get("BANK") or "")[:200],
        branch=data.get("BRANCH") or None,
        centre=_s("CENTRE", 200),
        district=_s("DISTRICT", 200),
        state=_s("STATE", 200),
        address=data.get("ADDRESS") or None,
        city=_s("CITY", 200),
        contact=_s("CONTACT", 100),
        micr=_s("MICR", 20),
        swift=_s("SWIFT", 20),
        iso3166=_s("ISO3166", 10),
        imps=bool(data.get("IMPS")),
        rtgs=bool(data.get("RTGS")),
        neft=bool(data.get("NEFT")),
        upi=bool(data.get("UPI")),
    )


def _cache_remote_hit(db: Session, data: dict) -> None:
    """Best-effort insert of a fallback API hit so the next lookup is local."""
    try:
        db.merge(_row_from_api_payload(data))
        db.commit()
    except Exception:
        db.rollback()
        logger.warning("Failed to cache IFSC %s from fallback API", data.get("IFSC"))


async def lookup_ifsc(ifsc_code: str, db: Session) -> dict:
    """Look up bank details for an IFSC code. Local dataset first, live
    Razorpay API as fallback for codes newer than the imported dataset."""
    code = ifsc_code.strip().upper()
    row = get_local(db, code)
    if row:
        return {
            "bank": row.bank,
            "branch": row.branch or "",
            "address": row.address or "",
            "city": row.city or "",
            "state": row.state or "",
        }

    have_dataset = dataset_loaded(db)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{RAZORPAY_IFSC_API}/{code}")
        if resp.status_code == 404:
            raise HTTPException(status_code=400, detail=f"Invalid IFSC code: {code}")
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError:
        if have_dataset:
            # The full directory is loaded and the code isn't in it — treat
            # as invalid instead of failing on an unreachable fallback.
            raise HTTPException(status_code=400, detail=f"Invalid IFSC code: {code}")
        raise HTTPException(status_code=502, detail="Could not reach IFSC lookup service")

    _cache_remote_hit(db, data)
    return {
        "bank": data.get("BANK", ""),
        "branch": data.get("BRANCH", ""),
        "address": data.get("ADDRESS", ""),
        "city": data.get("CITY", ""),
        "state": data.get("STATE", ""),
    }


def lookup_ifsc_raw_sync(ifsc_code: str) -> dict:
    """Synchronous lookup returning the razorpay-API-shaped payload.
    Used by provider adapters; raises ValueError for invalid codes."""
    code = ifsc_code.strip().upper()
    db = SessionLocal()
    try:
        row = get_local(db, code)
        if row:
            return to_razorpay_format(row)
        have_dataset = dataset_loaded(db)
        try:
            resp = httpx.get(f"{RAZORPAY_IFSC_API}/{code}", timeout=10)
            if resp.status_code == 404:
                raise ValueError(f"Invalid IFSC code: {code}")
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError:
            if have_dataset:
                raise ValueError(f"Invalid IFSC code: {code}")
            raise
        _cache_remote_hit(db, data)
        return data
    finally:
        db.close()


# ── Dataset import ────────────────────────────────────────────────────────

# ifsc_codes column → IFSC.csv header
_CSV_COLUMNS = {
    "ifsc": "IFSC", "bank": "BANK", "branch": "BRANCH", "centre": "CENTRE",
    "district": "DISTRICT", "state": "STATE", "address": "ADDRESS",
    "city": "CITY", "contact": "CONTACT", "micr": "MICR", "swift": "SWIFT",
    "iso3166": "ISO3166", "imps": "IMPS", "rtgs": "RTGS", "neft": "NEFT",
    "upi": "UPI",
}
_TEXT_LIMITS = {"ifsc": 11, "bank": 200, "centre": 200, "district": 200,
                "state": 200, "city": 200, "contact": 100, "micr": 20,
                "swift": 20, "iso3166": 10}
_BOOL_COLUMNS = {"imps", "rtgs", "neft", "upi"}


def resolve_latest_release() -> tuple[str, str]:
    """Return (version_tag, IFSC.csv download URL) of the latest dataset release."""
    resp = httpx.get(LATEST_RELEASE_API, timeout=30,
                     headers={"Accept": "application/vnd.github+json"})
    resp.raise_for_status()
    release = resp.json()
    for asset in release.get("assets", []):
        if asset.get("name") == "IFSC.csv":
            return release["tag_name"], asset["browser_download_url"]
    raise RuntimeError(f"IFSC.csv asset not found in release {release.get('tag_name')}")


def download_dataset(url: str) -> str:
    """Stream IFSC.csv (~36 MB) to a temp file; returns the file path."""
    tmp = tempfile.NamedTemporaryFile(mode="wb", suffix=".csv", delete=False)
    with httpx.stream("GET", url, timeout=120, follow_redirects=True) as resp:
        resp.raise_for_status()
        for chunk in resp.iter_bytes():
            tmp.write(chunk)
    tmp.close()
    return tmp.name


def import_dataset(db: Session, csv_path: str, version: str) -> dict:
    """Replace the ifsc_codes table with the contents of an IFSC.csv dump.
    Runs in a single transaction (TRUNCATE + COPY), so lookups keep working
    on the old data until the new import commits."""
    columns = list(_CSV_COLUMNS)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    seen: set[str] = set()
    skipped = 0

    with open(csv_path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        missing = [h for h in _CSV_COLUMNS.values() if h not in (reader.fieldnames or [])]
        if missing:
            raise RuntimeError(f"IFSC.csv is missing expected columns: {missing}")
        for raw in reader:
            code = (raw.get("IFSC") or "").strip().upper()
            if not IFSC_PATTERN.match(code) or code in seen:
                skipped += 1
                continue
            seen.add(code)
            out = []
            for col in columns:
                val = (raw.get(_CSV_COLUMNS[col]) or "").strip()
                if col == "ifsc":
                    val = code
                if col in _BOOL_COLUMNS:
                    val = "true" if val.lower() == "true" else "false"
                elif col in _TEXT_LIMITS:
                    val = val[:_TEXT_LIMITS[col]]
                out.append(val)
            writer.writerow(out)

    if len(seen) < 100_000:
        # The real dataset has ~170k branches; a tiny file means a bad
        # download — refuse to wipe the table for it.
        raise RuntimeError(f"Refusing to import suspiciously small dataset ({len(seen)} rows)")

    buffer.seek(0)
    db.execute(text("TRUNCATE ifsc_codes"))
    cursor = db.connection().connection.cursor()
    # Empty unquoted fields become NULL (COPY csv default), booleans parse
    # natively. bank is NOT NULL but genuinely blank for a few live codes
    # (e.g. RTGS head-office entries), so keep those as empty strings.
    cursor.copy_expert(
        f"COPY ifsc_codes ({', '.join(columns)}) FROM STDIN "
        f"WITH (FORMAT csv, FORCE_NOT_NULL (bank))",
        buffer,
    )
    meta = db.query(IfscDatasetMeta).first()
    if not meta:
        meta = IfscDatasetMeta(version=version, row_count=len(seen))
        db.add(meta)
    else:
        meta.version = version
        meta.row_count = len(seen)
    db.commit()
    logger.info("Imported IFSC dataset %s: %d rows (%d skipped)", version, len(seen), skipped)
    return {"version": version, "rows": len(seen), "skipped": skipped}
