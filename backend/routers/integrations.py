"""
Integration Management Router
===============================
MASTER-only provider management, company-wise configuration, dashboard, logs.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from database import get_db
from auth.dependencies import get_current_user, require_master, require_admin
from models.user import User
from models.integration import (
    IntegrationProvider,
    CompanyIntegration,
    GlobalIntegrationDefault,
    ProviderLog,
    ProviderUsage,
    WebhookLog,
)
from schemas.integration import (
    IntegrationProviderCreate, IntegrationProviderUpdate, IntegrationProviderResponse,
    CompanyIntegrationCreate, CompanyIntegrationUpdate, CompanyIntegrationResponse,
    GlobalDefaultCreate, GlobalDefaultUpdate, GlobalDefaultResponse,
    ProviderLogResponse, ProviderUsageResponse, WebhookLogResponse,
    ConnectionTestRequest, ConnectionTestResponse,
    IntegrationDashboard,
)
from providers.crypto import encrypt_credentials, decrypt_credentials, mask_credentials
from providers.schemas import missing_required_credentials
from services.integration_service import (
    test_provider_connection,
    get_integration_dashboard,
)

# Auto-register all adapters on import
import providers.sms        # noqa: F401
import providers.email       # noqa: F401
import providers.maps        # noqa: F401
import providers.kyc         # noqa: F401
import providers.bank        # noqa: F401
import providers.otp         # noqa: F401

router = APIRouter()


def _validate_credentials(db: Session, provider_id: Optional[int], credentials: Optional[dict]):
    """Reject credential payloads missing keys the adapter requires."""
    if not provider_id or credentials is None:
        return
    ip = db.query(IntegrationProvider).filter(IntegrationProvider.id == provider_id).first()
    if not ip:
        return
    missing = missing_required_credentials(ip.code, credentials)
    if missing:
        raise HTTPException(
            422,
            f"Missing required credential(s) for {ip.name}: {', '.join(missing)}",
        )


def _require_provider_in_category(
    db: Session, provider_id: Optional[int], category: str, label: str = "Provider"
) -> Optional[IntegrationProvider]:
    """Fetch a provider and ensure it belongs to the given category."""
    if not provider_id:
        return None
    ip = db.query(IntegrationProvider).filter(IntegrationProvider.id == provider_id).first()
    if not ip:
        raise HTTPException(404, f"{label} not found")
    if ip.category != category:
        raise HTTPException(
            422,
            f"{label} '{ip.name}' belongs to category '{ip.category}', not '{category}'",
        )
    return ip


# ═══════════════════════════════════════════════════════════════════════════
#  PROVIDER CATALOGUE (master)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/providers", response_model=list[IntegrationProviderResponse])
def list_providers(
    category: Optional[str] = None,
    include_inactive: bool = Query(False),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    # Read-only catalogue: admins need it to configure their company's
    # integrations. Inactive providers are hidden unless master explicitly
    # asks for them (provider management screen).
    q = db.query(IntegrationProvider)
    if not (include_inactive and current_user.role == "master"):
        q = q.filter(IntegrationProvider.is_active.is_(True))
    if category:
        q = q.filter(IntegrationProvider.category == category)
    return q.order_by(IntegrationProvider.category, IntegrationProvider.name).all()


@router.post("/providers", response_model=IntegrationProviderResponse, status_code=201)
def create_provider(
    body: IntegrationProviderCreate,
    current_user: User = Depends(require_master),
    db: Session = Depends(get_db),
):
    exists = db.query(IntegrationProvider).filter(IntegrationProvider.code == body.code).first()
    if exists:
        raise HTTPException(409, "Provider code already exists")
    p = IntegrationProvider(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/providers/{provider_id}", response_model=IntegrationProviderResponse)
def update_provider(
    provider_id: int,
    body: IntegrationProviderUpdate,
    current_user: User = Depends(require_master),
    db: Session = Depends(get_db),
):
    p = db.query(IntegrationProvider).filter(IntegrationProvider.id == provider_id).first()
    if not p:
        raise HTTPException(404, "Provider not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/providers/{provider_id}", status_code=204)
def delete_provider(
    provider_id: int,
    current_user: User = Depends(require_master),
    db: Session = Depends(get_db),
):
    p = db.query(IntegrationProvider).filter(IntegrationProvider.id == provider_id).first()
    if not p:
        raise HTTPException(404, "Provider not found")
    db.delete(p)
    db.commit()


@router.get("/providers/categories")
def list_categories(current_user: User = Depends(require_master)):
    from schemas.integration import INTEGRATION_CATEGORIES
    return list(INTEGRATION_CATEGORIES)


# ═══════════════════════════════════════════════════════════════════════════
#  GLOBAL DEFAULTS (master)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/global-defaults", response_model=list[GlobalDefaultResponse])
def list_global_defaults(
    current_user: User = Depends(require_master),
    db: Session = Depends(get_db),
):
    rows = db.query(GlobalIntegrationDefault).all()
    result = []
    for gd in rows:
        pname = None
        fbname = None
        if gd.provider_id:
            ip = db.query(IntegrationProvider).filter(IntegrationProvider.id == gd.provider_id).first()
            pname = ip.name if ip else None
        if gd.fallback_provider_id:
            ip2 = db.query(IntegrationProvider).filter(IntegrationProvider.id == gd.fallback_provider_id).first()
            fbname = ip2.name if ip2 else None
        result.append(GlobalDefaultResponse(
            id=gd.id, category=gd.category, provider_id=gd.provider_id,
            fallback_provider_id=gd.fallback_provider_id,
            config=gd.config, is_enabled=gd.is_enabled,
            credentials_set=bool(gd.credentials),
            provider_name=pname, fallback_provider_name=fbname,
            created_at=gd.created_at, updated_at=gd.updated_at,
        ))
    return result


@router.post("/global-defaults", response_model=GlobalDefaultResponse, status_code=201)
def upsert_global_default(
    body: GlobalDefaultCreate,
    current_user: User = Depends(require_master),
    db: Session = Depends(get_db),
):
    _require_provider_in_category(db, body.provider_id, body.category)
    _require_provider_in_category(db, body.fallback_provider_id, body.category, label="Fallback provider")

    gd = db.query(GlobalIntegrationDefault).filter(GlobalIntegrationDefault.category == body.category).first()
    if gd:
        for k, v in body.model_dump(exclude_unset=True).items():
            if k == "credentials" and v:
                # Merge into stored credentials so partial updates keep other keys
                provided = {ck: cv for ck, cv in v.items() if str(cv or "").strip()}
                merged = {**(decrypt_credentials(gd.credentials) or {}), **provided}
                _validate_credentials(db, body.provider_id or gd.provider_id, merged)
                setattr(gd, k, encrypt_credentials(merged))
            else:
                setattr(gd, k, v)
    else:
        data = body.model_dump()
        if data.get("credentials"):
            _validate_credentials(db, data.get("provider_id"), data["credentials"])
            data["credentials"] = encrypt_credentials(data["credentials"])
        gd = GlobalIntegrationDefault(**data)
        db.add(gd)
    db.commit()
    db.refresh(gd)

    pname = None
    if gd.provider_id:
        ip = db.query(IntegrationProvider).filter(IntegrationProvider.id == gd.provider_id).first()
        pname = ip.name if ip else None
    fbname = None
    if gd.fallback_provider_id:
        ip2 = db.query(IntegrationProvider).filter(IntegrationProvider.id == gd.fallback_provider_id).first()
        fbname = ip2.name if ip2 else None

    return GlobalDefaultResponse(
        id=gd.id, category=gd.category, provider_id=gd.provider_id,
        fallback_provider_id=gd.fallback_provider_id,
        config=gd.config, is_enabled=gd.is_enabled,
        credentials_set=bool(gd.credentials),
        provider_name=pname, fallback_provider_name=fbname,
        created_at=gd.created_at, updated_at=gd.updated_at,
    )


@router.get("/global-defaults/{category}/credentials")
def get_global_default_credentials(
    category: str,
    current_user: User = Depends(require_master),
    db: Session = Depends(get_db),
):
    """Masked view of stored credentials — shows which keys are set, never full values."""
    gd = db.query(GlobalIntegrationDefault).filter(GlobalIntegrationDefault.category == category).first()
    if not gd:
        raise HTTPException(404, "Global default not found")
    return {"credentials": mask_credentials(decrypt_credentials(gd.credentials)) or {}}


@router.delete("/global-defaults/{category}", status_code=204)
def delete_global_default(
    category: str,
    current_user: User = Depends(require_master),
    db: Session = Depends(get_db),
):
    gd = db.query(GlobalIntegrationDefault).filter(GlobalIntegrationDefault.category == category).first()
    if not gd:
        raise HTTPException(404, "Global default not found")
    db.delete(gd)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════
#  COMPANY INTEGRATIONS (master + admin for own company)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/company/{company_id}", response_model=list[CompanyIntegrationResponse])
def list_company_integrations(
    company_id: int,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Admin can see own company; master can see any
    if current_user.role != "master" and current_user.company_id != company_id:
        raise HTTPException(403, "Access denied")

    q = db.query(CompanyIntegration).filter(CompanyIntegration.company_id == company_id)
    if category:
        q = q.filter(CompanyIntegration.category == category)
    rows = q.order_by(CompanyIntegration.category, CompanyIntegration.priority).all()

    result = []
    for ci in rows:
        ip = db.query(IntegrationProvider).filter(IntegrationProvider.id == ci.provider_id).first()
        result.append(CompanyIntegrationResponse(
            id=ci.id, company_id=ci.company_id, provider_id=ci.provider_id,
            category=ci.category, is_enabled=ci.is_enabled, is_default=ci.is_default,
            priority=ci.priority, is_fallback=ci.is_fallback, config=ci.config,
            daily_quota=ci.daily_quota, monthly_quota=ci.monthly_quota,
            rate_limit_per_min=ci.rate_limit_per_min,
            health_status=ci.health_status, last_health_check=ci.last_health_check,
            created_at=ci.created_at, updated_at=ci.updated_at,
            credentials_set=bool(ci.credentials),
            provider_name=ip.name if ip else None,
            provider_code=ip.code if ip else None,
        ))
    return result


@router.post("/company/{company_id}", response_model=CompanyIntegrationResponse, status_code=201)
def create_company_integration(
    company_id: int,
    body: CompanyIntegrationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("master",) and current_user.company_id != company_id:
        raise HTTPException(403, "Only master can configure other companies")
    if current_user.role not in ("master", "admin"):
        raise HTTPException(403, "Admin or master access required")

    # Provider must exist and belong to the requested category
    ip = _require_provider_in_category(db, body.provider_id, body.category)

    existing = db.query(CompanyIntegration).filter(
        CompanyIntegration.company_id == company_id,
        CompanyIntegration.provider_id == body.provider_id,
    ).first()
    if existing:
        raise HTTPException(409, f"'{ip.name}' is already configured for this company")

    _validate_credentials(db, body.provider_id, body.credentials)

    data = body.model_dump()
    data["company_id"] = company_id
    if data.get("credentials"):
        data["credentials"] = encrypt_credentials(data["credentials"])

    # If setting as default, unset other defaults for same category
    if data.get("is_default"):
        db.query(CompanyIntegration).filter(
            CompanyIntegration.company_id == company_id,
            CompanyIntegration.category == data["category"],
        ).update({"is_default": False})

    ci = CompanyIntegration(**data)
    db.add(ci)
    db.commit()
    db.refresh(ci)

    return CompanyIntegrationResponse(
        id=ci.id, company_id=ci.company_id, provider_id=ci.provider_id,
        category=ci.category, is_enabled=ci.is_enabled, is_default=ci.is_default,
        priority=ci.priority, is_fallback=ci.is_fallback, config=ci.config,
        daily_quota=ci.daily_quota, monthly_quota=ci.monthly_quota,
        rate_limit_per_min=ci.rate_limit_per_min,
        health_status=ci.health_status, last_health_check=ci.last_health_check,
        created_at=ci.created_at, updated_at=ci.updated_at,
        credentials_set=bool(ci.credentials),
        provider_name=ip.name, provider_code=ip.code,
    )


@router.put("/company/{company_id}/{integration_id}", response_model=CompanyIntegrationResponse)
def update_company_integration(
    company_id: int,
    integration_id: int,
    body: CompanyIntegrationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("master",) and current_user.company_id != company_id:
        raise HTTPException(403, "Access denied")
    if current_user.role not in ("master", "admin"):
        raise HTTPException(403, "Admin or master access required")

    ci = db.query(CompanyIntegration).filter(
        CompanyIntegration.id == integration_id, CompanyIntegration.company_id == company_id,
    ).first()
    if not ci:
        raise HTTPException(404, "Integration not found")

    updates = body.model_dump(exclude_unset=True)
    if "credentials" in updates and updates["credentials"]:
        # Merge into stored credentials so partial updates keep other keys
        provided = {ck: cv for ck, cv in updates["credentials"].items() if str(cv or "").strip()}
        merged = {**(decrypt_credentials(ci.credentials) or {}), **provided}
        _validate_credentials(db, ci.provider_id, merged)
        updates["credentials"] = encrypt_credentials(merged)

    # If setting as default, unset others
    if updates.get("is_default"):
        db.query(CompanyIntegration).filter(
            CompanyIntegration.company_id == company_id,
            CompanyIntegration.category == ci.category,
            CompanyIntegration.id != integration_id,
        ).update({"is_default": False})

    for k, v in updates.items():
        setattr(ci, k, v)
    db.commit()
    db.refresh(ci)

    ip = db.query(IntegrationProvider).filter(IntegrationProvider.id == ci.provider_id).first()
    return CompanyIntegrationResponse(
        id=ci.id, company_id=ci.company_id, provider_id=ci.provider_id,
        category=ci.category, is_enabled=ci.is_enabled, is_default=ci.is_default,
        priority=ci.priority, is_fallback=ci.is_fallback, config=ci.config,
        daily_quota=ci.daily_quota, monthly_quota=ci.monthly_quota,
        rate_limit_per_min=ci.rate_limit_per_min,
        health_status=ci.health_status, last_health_check=ci.last_health_check,
        created_at=ci.created_at, updated_at=ci.updated_at,
        credentials_set=bool(ci.credentials),
        provider_name=ip.name if ip else None,
        provider_code=ip.code if ip else None,
    )


@router.get("/company/{company_id}/{integration_id}/credentials")
def get_company_integration_credentials(
    company_id: int,
    integration_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Masked view of stored credentials — shows which keys are set, never full values."""
    if current_user.role not in ("master", "admin"):
        raise HTTPException(403, "Admin or master access required")
    if current_user.role != "master" and current_user.company_id != company_id:
        raise HTTPException(403, "Access denied")
    ci = db.query(CompanyIntegration).filter(
        CompanyIntegration.id == integration_id, CompanyIntegration.company_id == company_id,
    ).first()
    if not ci:
        raise HTTPException(404, "Integration not found")
    return {"credentials": mask_credentials(decrypt_credentials(ci.credentials)) or {}}


@router.delete("/company/{company_id}/{integration_id}", status_code=204)
def delete_company_integration(
    company_id: int,
    integration_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("master", "admin"):
        raise HTTPException(403, "Admin or master access required")
    if current_user.role != "master" and current_user.company_id != company_id:
        raise HTTPException(403, "Access denied")
    ci = db.query(CompanyIntegration).filter(
        CompanyIntegration.id == integration_id, CompanyIntegration.company_id == company_id,
    ).first()
    if not ci:
        raise HTTPException(404, "Integration not found")
    db.delete(ci)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════
#  CONNECTION TESTING
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/test-connection", response_model=ConnectionTestResponse)
def test_connection(
    body: ConnectionTestRequest,
    company_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("master", "admin"):
        raise HTTPException(403, "Admin or master access required")
    cid = company_id or current_user.company_id
    result = test_provider_connection(body.provider_id, db, body.credentials, body.config, cid)
    return ConnectionTestResponse(
        success=result.success,
        message=result.error or "Connection successful",
        latency_ms=result.latency_ms,
    )


# ═══════════════════════════════════════════════════════════════════════════
#  DASHBOARD & ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/dashboard")
def integration_dashboard(
    company_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("master", "admin"):
        raise HTTPException(403, "Admin or master access required")
    cid = company_id if current_user.role == "master" else current_user.company_id
    return get_integration_dashboard(db, cid)


# ═══════════════════════════════════════════════════════════════════════════
#  LOGS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/logs", response_model=dict)
def list_provider_logs(
    company_id: Optional[int] = Query(None),
    category: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("master", "admin"):
        raise HTTPException(403, "Admin or master access required")

    q = db.query(ProviderLog)
    cid = company_id if current_user.role == "master" else current_user.company_id
    if cid:
        q = q.filter(ProviderLog.company_id == cid)
    if category:
        q = q.filter(ProviderLog.category == category)
    if status:
        q = q.filter(ProviderLog.status == status)

    total = q.count()
    logs = q.order_by(ProviderLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    items = []
    for log in logs:
        pname = None
        if log.provider_id:
            ip = db.query(IntegrationProvider).filter(IntegrationProvider.id == log.provider_id).first()
            pname = ip.name if ip else None
        items.append(ProviderLogResponse(
            id=log.id, company_id=log.company_id, provider_id=log.provider_id,
            category=log.category, action=log.action, status=log.status,
            error_message=log.error_message, latency_ms=log.latency_ms,
            retry_count=log.retry_count, created_at=log.created_at,
            provider_name=pname,
        ))

    return {"items": [i.model_dump() for i in items], "total": total, "page": page, "pages": (total + per_page - 1) // per_page}


@router.get("/usage", response_model=list[ProviderUsageResponse])
def list_usage(
    company_id: Optional[int] = Query(None),
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("master", "admin"):
        raise HTTPException(403, "Admin or master access required")

    q = db.query(ProviderUsage)
    cid = company_id if current_user.role == "master" else current_user.company_id
    if cid:
        q = q.filter(ProviderUsage.company_id == cid)
    if category:
        q = q.filter(ProviderUsage.category == category)

    rows = q.order_by(ProviderUsage.date.desc()).limit(100).all()

    result = []
    for u in rows:
        pname = None
        ip = db.query(IntegrationProvider).filter(IntegrationProvider.id == u.provider_id).first()
        pname = ip.name if ip else None
        result.append(ProviderUsageResponse(
            id=u.id, company_id=u.company_id, provider_id=u.provider_id,
            category=u.category, date=u.date,
            request_count=u.request_count, success_count=u.success_count,
            failure_count=u.failure_count, total_latency_ms=u.total_latency_ms,
            provider_name=pname,
        ))
    return result


@router.get("/webhook-logs", response_model=dict)
def list_webhook_logs(
    company_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_master),
    db: Session = Depends(get_db),
):
    q = db.query(WebhookLog)
    if company_id:
        q = q.filter(WebhookLog.company_id == company_id)
    total = q.count()
    logs = q.order_by(WebhookLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    items = [
        WebhookLogResponse(
            id=w.id, provider_id=w.provider_id, company_id=w.company_id,
            event_type=w.event_type, status=w.status,
            error_message=w.error_message, created_at=w.created_at,
        ).model_dump()
        for w in logs
    ]
    return {"items": items, "total": total, "page": page, "pages": (total + per_page - 1) // per_page}
