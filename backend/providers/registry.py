"""
Provider Registry & Runtime Resolver
=====================================
- Maintains a registry of all adapter classes keyed by provider code.
- resolve_provider(category, company_id, db) → instantiated adapter
  with decrypted credentials, honouring company overrides and global defaults.
"""
from __future__ import annotations

import logging
from typing import Type, Optional

from sqlalchemy.orm import Session

from providers.base import BaseProvider
from providers.crypto import decrypt_credentials
from models.integration import (
    IntegrationProvider,
    CompanyIntegration,
    GlobalIntegrationDefault,
)

logger = logging.getLogger(__name__)

# ── Adapter registry ─────────────────────────────────────────────────────
_REGISTRY: dict[str, Type[BaseProvider]] = {}


def register_provider(cls: Type[BaseProvider]) -> Type[BaseProvider]:
    """Class decorator – registers an adapter by its CODE."""
    if cls.CODE:
        _REGISTRY[cls.CODE] = cls
    return cls


def get_registered_codes() -> list[str]:
    return list(_REGISTRY.keys())


def get_adapter_class(code: str) -> Optional[Type[BaseProvider]]:
    return _REGISTRY.get(code)


# ── Runtime resolver ─────────────────────────────────────────────────────

def resolve_provider(
    category: str,
    company_id: Optional[int],
    db: Session,
    *,
    fallback: bool = False,
) -> Optional[BaseProvider]:
    """
    Resolve the active provider adapter for a given category & company.

    Resolution order:
      1. Company-specific default (is_default=True, is_enabled=True)
      2. Global default for category
      3. If `fallback=True`, try company fallback, then global fallback
      4. None
    """
    credentials: dict | None = None
    config: dict | None = None
    provider_code: str | None = None

    # 1) Company-specific
    if company_id:
        q = (
            db.query(CompanyIntegration, IntegrationProvider)
            .join(IntegrationProvider, CompanyIntegration.provider_id == IntegrationProvider.id)
            .filter(
                CompanyIntegration.company_id == company_id,
                CompanyIntegration.category == category,
                CompanyIntegration.is_enabled == True,
            )
        )
        if fallback:
            row = q.filter(CompanyIntegration.is_fallback == True).first()
        else:
            row = q.filter(CompanyIntegration.is_default == True).first()
            if not row:
                # pick highest priority
                row = q.order_by(CompanyIntegration.priority.asc()).first()

        if row:
            ci, ip = row
            credentials = decrypt_credentials(ci.credentials)
            config = ci.config
            provider_code = ip.code

    # 2) Global default
    if not provider_code:
        gd = (
            db.query(GlobalIntegrationDefault)
            .filter(GlobalIntegrationDefault.category == category, GlobalIntegrationDefault.is_enabled == True)
            .first()
        )
        if gd:
            pid = gd.fallback_provider_id if fallback else gd.provider_id
            if pid:
                ip = db.query(IntegrationProvider).filter(IntegrationProvider.id == pid).first()
                if ip:
                    provider_code = ip.code
                    credentials = decrypt_credentials(gd.credentials)
                    config = gd.config

    if not provider_code:
        logger.warning(f"No provider resolved for category={category} company={company_id}")
        return None

    adapter_cls = _REGISTRY.get(provider_code)
    if not adapter_cls:
        logger.error(f"No adapter registered for provider code={provider_code}")
        return None

    return adapter_cls(credentials=credentials or {}, config=config or {})


def resolve_with_fallback(
    category: str,
    company_id: Optional[int],
    db: Session,
) -> list[BaseProvider]:
    """Return [primary, fallback] providers (non-None)."""
    providers = []
    primary = resolve_provider(category, company_id, db, fallback=False)
    if primary:
        providers.append(primary)
    fb = resolve_provider(category, company_id, db, fallback=True)
    if fb and (not primary or fb.CODE != primary.CODE):
        providers.append(fb)
    return providers
