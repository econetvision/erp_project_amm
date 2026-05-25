"""
Integration Service
====================
Orchestrates provider resolution, execution with retry/fallback, logging, and usage tracking.
"""
from __future__ import annotations

import logging
from datetime import datetime, date
from typing import Optional, Any, Callable

from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from models.integration import (
    IntegrationProvider,
    CompanyIntegration,
    GlobalIntegrationDefault,
    ProviderLog,
    ProviderUsage,
    WebhookLog,
)
from providers.base import ProviderResult
from providers.registry import resolve_provider, resolve_with_fallback
from providers.crypto import encrypt_credentials, decrypt_credentials, mask_credentials

logger = logging.getLogger(__name__)


# ── Provider execution with retry + fallback ──────────────────────────────

def execute_provider_action(
    category: str,
    action: str,
    company_id: Optional[int],
    db: Session,
    fn_name: str,
    *args,
    max_retries: int = 2,
    **kwargs,
) -> ProviderResult:
    """
    Execute a provider action with automatic retry and fallback.

    1. Resolve primary provider for category/company
    2. Call fn_name on it
    3. On failure: retry up to max_retries
    4. If still failing: try fallback provider
    5. Log every attempt to provider_logs + update usage counters
    """
    providers = resolve_with_fallback(category, company_id, db)
    if not providers:
        return ProviderResult(success=False, error=f"No provider configured for {category}")

    last_result: Optional[ProviderResult] = None

    for provider in providers:
        provider_row = (
            db.query(IntegrationProvider)
            .filter(IntegrationProvider.code == provider.CODE)
            .first()
        )
        provider_id = provider_row.id if provider_row else None

        for attempt in range(max_retries + 1):
            fn: Callable = getattr(provider, fn_name, None)
            if fn is None:
                last_result = ProviderResult(
                    success=False,
                    error=f"Provider {provider.CODE} does not support {fn_name}",
                    provider_code=provider.CODE,
                )
                break

            result = fn(*args, **kwargs)
            last_result = result

            # Log the attempt
            _log_attempt(db, company_id, provider_id, category, action, result, attempt)

            if result.success:
                _update_usage(db, company_id, provider_id, category, success=True, latency=result.latency_ms)
                return result

            # Failed – increment retry
            logger.warning(
                f"Provider {provider.CODE} attempt {attempt+1} failed: {result.error}"
            )

        # All retries exhausted for this provider – update failure usage
        if provider_id:
            _update_usage(db, company_id, provider_id, category, success=False, latency=last_result.latency_ms if last_result else 0)

    return last_result or ProviderResult(success=False, error="All providers failed")


def test_provider_connection(
    provider_id: int,
    db: Session,
    credentials: Optional[dict] = None,
    config: Optional[dict] = None,
    company_id: Optional[int] = None,
) -> ProviderResult:
    """Test connection for a specific provider."""
    from providers.registry import get_adapter_class

    ip = db.query(IntegrationProvider).filter(IntegrationProvider.id == provider_id).first()
    if not ip:
        return ProviderResult(success=False, error="Provider not found")

    adapter_cls = get_adapter_class(ip.code)
    if not adapter_cls:
        return ProviderResult(success=False, error=f"No adapter for {ip.code}")

    # If no credentials supplied, try to get from company integration or global default
    if not credentials:
        if company_id:
            ci = (
                db.query(CompanyIntegration)
                .filter(CompanyIntegration.company_id == company_id, CompanyIntegration.provider_id == provider_id)
                .first()
            )
            if ci:
                credentials = decrypt_credentials(ci.credentials)
                config = config or ci.config
        if not credentials:
            gd = (
                db.query(GlobalIntegrationDefault)
                .filter(GlobalIntegrationDefault.provider_id == provider_id)
                .first()
            )
            if gd:
                credentials = decrypt_credentials(gd.credentials)
                config = config or gd.config

    adapter = adapter_cls(credentials=credentials or {}, config=config or {})
    result = adapter.test_connection()

    # Update health status on company integration
    if company_id:
        ci = (
            db.query(CompanyIntegration)
            .filter(CompanyIntegration.company_id == company_id, CompanyIntegration.provider_id == provider_id)
            .first()
        )
        if ci:
            ci.health_status = "healthy" if result.success else "down"
            ci.last_health_check = datetime.utcnow()
            db.commit()

    return result


# ── Dashboard analytics ───────────────────────────────────────────────────

def get_integration_dashboard(db: Session, company_id: Optional[int] = None) -> dict:
    """Build analytics for the integration dashboard."""
    from schemas.integration import (
        CategoryUsageSummary, ProviderHealthSummary, ProviderLogResponse, IntegrationDashboard,
    )

    # Total providers
    total_providers = db.query(IntegrationProvider).filter(IntegrationProvider.is_active == True).count()

    # Active integrations
    q = db.query(CompanyIntegration).filter(CompanyIntegration.is_enabled == True)
    if company_id:
        q = q.filter(CompanyIntegration.company_id == company_id)
    active_integrations = q.count()

    # Category usage summary (last 30 days)
    thirty_days_ago = datetime.utcnow().replace(day=1)
    usage_q = db.query(
        ProviderUsage.category,
        sqlfunc.sum(ProviderUsage.request_count).label("total"),
        sqlfunc.sum(ProviderUsage.success_count).label("success"),
        sqlfunc.sum(ProviderUsage.failure_count).label("failure"),
        sqlfunc.avg(
            sqlfunc.nullif(ProviderUsage.total_latency_ms, 0)
            / sqlfunc.nullif(ProviderUsage.request_count, 0)
        ).label("avg_lat"),
    ).filter(ProviderUsage.date >= thirty_days_ago)
    if company_id:
        usage_q = usage_q.filter(ProviderUsage.company_id == company_id)
    usage_q = usage_q.group_by(ProviderUsage.category)
    categories_summary = [
        CategoryUsageSummary(
            category=r.category,
            total_requests=int(r.total or 0),
            success_count=int(r.success or 0),
            failure_count=int(r.failure or 0),
            avg_latency_ms=float(r.avg_lat) if r.avg_lat else None,
        )
        for r in usage_q.all()
    ]

    # Provider health
    health_q = (
        db.query(
            CompanyIntegration.provider_id,
            IntegrationProvider.name,
            IntegrationProvider.category,
            CompanyIntegration.health_status,
            sqlfunc.count(CompanyIntegration.id).label("cnt"),
        )
        .join(IntegrationProvider, CompanyIntegration.provider_id == IntegrationProvider.id)
        .filter(CompanyIntegration.is_enabled == True)
    )
    if company_id:
        health_q = health_q.filter(CompanyIntegration.company_id == company_id)
    health_q = health_q.group_by(
        CompanyIntegration.provider_id,
        IntegrationProvider.name,
        IntegrationProvider.category,
        CompanyIntegration.health_status,
    )
    provider_health = [
        ProviderHealthSummary(
            provider_id=r.provider_id,
            provider_name=r.name,
            category=r.category,
            health_status=r.health_status or "unknown",
            companies_using=int(r.cnt),
        )
        for r in health_q.all()
    ]

    # Recent failures
    fail_q = db.query(ProviderLog).filter(ProviderLog.status == "failed")
    if company_id:
        fail_q = fail_q.filter(ProviderLog.company_id == company_id)
    fail_q = fail_q.order_by(ProviderLog.created_at.desc()).limit(20)
    recent_failures = []
    for log in fail_q.all():
        pname = None
        if log.provider_id:
            ip = db.query(IntegrationProvider).filter(IntegrationProvider.id == log.provider_id).first()
            pname = ip.name if ip else None
        recent_failures.append(ProviderLogResponse(
            id=log.id, company_id=log.company_id, provider_id=log.provider_id,
            category=log.category, action=log.action, status=log.status,
            error_message=log.error_message, latency_ms=log.latency_ms,
            retry_count=log.retry_count, created_at=log.created_at,
            provider_name=pname,
        ))

    return IntegrationDashboard(
        total_providers=total_providers,
        active_integrations=active_integrations,
        categories_summary=categories_summary,
        provider_health=provider_health,
        recent_failures=recent_failures,
    ).model_dump()


# ── Helpers ───────────────────────────────────────────────────────────────

def _log_attempt(
    db: Session,
    company_id: Optional[int],
    provider_id: Optional[int],
    category: str,
    action: str,
    result: ProviderResult,
    retry_count: int,
):
    log = ProviderLog(
        company_id=company_id,
        provider_id=provider_id,
        category=category,
        action=action,
        status="success" if result.success else "failed",
        error_message=result.error,
        latency_ms=result.latency_ms,
        retry_count=retry_count,
    )
    db.add(log)
    try:
        db.commit()
    except Exception:
        db.rollback()


def _update_usage(
    db: Session,
    company_id: Optional[int],
    provider_id: Optional[int],
    category: str,
    success: bool,
    latency: int,
):
    if not company_id or not provider_id:
        return
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    usage = (
        db.query(ProviderUsage)
        .filter(
            ProviderUsage.company_id == company_id,
            ProviderUsage.provider_id == provider_id,
            ProviderUsage.date == today,
        )
        .first()
    )
    if not usage:
        usage = ProviderUsage(
            company_id=company_id,
            provider_id=provider_id,
            category=category,
            date=today,
        )
        db.add(usage)
    usage.request_count += 1
    if success:
        usage.success_count += 1
    else:
        usage.failure_count += 1
    usage.total_latency_ms += latency
    try:
        db.commit()
    except Exception:
        db.rollback()


def save_webhook(
    db: Session,
    provider_id: Optional[int],
    company_id: Optional[int],
    event_type: str,
    payload: dict,
    headers: Optional[dict] = None,
):
    wh = WebhookLog(
        provider_id=provider_id,
        company_id=company_id,
        event_type=event_type,
        payload=payload,
        headers=headers,
        status="received",
    )
    db.add(wh)
    db.commit()
    return wh
