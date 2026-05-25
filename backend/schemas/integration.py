from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


# ── Categories ────────────────────────────────────────────────────────────
INTEGRATION_CATEGORIES = (
    "sms", "email", "maps", "kyc", "bank",
    "notification", "otp", "geolocation",
)

CategoryType = Literal[
    "sms", "email", "maps", "kyc", "bank",
    "notification", "otp", "geolocation",
]

HealthStatus = Literal["healthy", "degraded", "down", "unknown"]
LogStatus    = Literal["pending", "success", "failed", "retrying"]


# ── IntegrationProvider ──────────────────────────────────────────────────
class IntegrationProviderBase(BaseModel):
    category:      CategoryType
    code:          str = Field(max_length=100)
    name:          str = Field(max_length=255)
    description:   Optional[str] = None
    logo_url:      Optional[str] = None
    config_schema: Optional[dict] = None
    is_active:     bool = True
    version:       Optional[str] = "1.0"

class IntegrationProviderCreate(IntegrationProviderBase):
    pass

class IntegrationProviderUpdate(BaseModel):
    name:          Optional[str] = None
    description:   Optional[str] = None
    logo_url:      Optional[str] = None
    config_schema: Optional[dict] = None
    is_active:     Optional[bool] = None
    version:       Optional[str] = None

class IntegrationProviderResponse(IntegrationProviderBase):
    id:         int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── CompanyIntegration ───────────────────────────────────────────────────
class CompanyIntegrationBase(BaseModel):
    company_id:        int
    provider_id:       int
    category:          CategoryType
    is_enabled:        bool = True
    is_default:        bool = False
    priority:          int = 0
    is_fallback:       bool = False
    config:            Optional[dict] = None
    daily_quota:       Optional[int] = None
    monthly_quota:     Optional[int] = None
    rate_limit_per_min: Optional[int] = None

class CompanyIntegrationCreate(CompanyIntegrationBase):
    credentials: Optional[dict] = None          # plain-text; will be encrypted before storage

class CompanyIntegrationUpdate(BaseModel):
    is_enabled:        Optional[bool] = None
    is_default:        Optional[bool] = None
    priority:          Optional[int] = None
    is_fallback:       Optional[bool] = None
    credentials:       Optional[dict] = None
    config:            Optional[dict] = None
    daily_quota:       Optional[int] = None
    monthly_quota:     Optional[int] = None
    rate_limit_per_min: Optional[int] = None

class CompanyIntegrationResponse(CompanyIntegrationBase):
    id:                int
    health_status:     Optional[str] = "unknown"
    last_health_check: Optional[datetime] = None
    created_at:        datetime
    updated_at:        datetime
    # Never expose raw credentials – show masked version
    credentials_set:   bool = False
    provider_name:     Optional[str] = None
    provider_code:     Optional[str] = None
    model_config = {"from_attributes": True}


# ── GlobalIntegrationDefault ─────────────────────────────────────────────
class GlobalDefaultCreate(BaseModel):
    category:             CategoryType
    provider_id:          Optional[int] = None
    fallback_provider_id: Optional[int] = None
    credentials:          Optional[dict] = None
    config:               Optional[dict] = None
    is_enabled:           bool = True

class GlobalDefaultUpdate(BaseModel):
    provider_id:          Optional[int] = None
    fallback_provider_id: Optional[int] = None
    credentials:          Optional[dict] = None
    config:               Optional[dict] = None
    is_enabled:           Optional[bool] = None

class GlobalDefaultResponse(BaseModel):
    id:                   int
    category:             str
    provider_id:          Optional[int] = None
    fallback_provider_id: Optional[int] = None
    config:               Optional[dict] = None
    is_enabled:           bool
    credentials_set:      bool = False
    provider_name:        Optional[str] = None
    fallback_provider_name: Optional[str] = None
    created_at:           datetime
    updated_at:           datetime
    model_config = {"from_attributes": True}


# ── ProviderLog ──────────────────────────────────────────────────────────
class ProviderLogResponse(BaseModel):
    id:            int
    company_id:    Optional[int] = None
    provider_id:   Optional[int] = None
    category:      str
    action:        str
    status:        str
    error_message: Optional[str] = None
    latency_ms:    Optional[int] = None
    retry_count:   int = 0
    created_at:    datetime
    provider_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ── WebhookLog ───────────────────────────────────────────────────────────
class WebhookLogResponse(BaseModel):
    id:            int
    provider_id:   Optional[int] = None
    company_id:    Optional[int] = None
    event_type:    Optional[str] = None
    status:        str
    error_message: Optional[str] = None
    created_at:    datetime
    model_config = {"from_attributes": True}


# ── ProviderUsage ────────────────────────────────────────────────────────
class ProviderUsageResponse(BaseModel):
    id:               int
    company_id:       int
    provider_id:      int
    category:         str
    date:             datetime
    request_count:    int
    success_count:    int
    failure_count:    int
    total_latency_ms: int
    provider_name:    Optional[str] = None
    model_config = {"from_attributes": True}


# ── Dashboard analytics ─────────────────────────────────────────────────
class CategoryUsageSummary(BaseModel):
    category:       str
    total_requests: int
    success_count:  int
    failure_count:  int
    avg_latency_ms: Optional[float] = None

class ProviderHealthSummary(BaseModel):
    provider_id:   int
    provider_name: str
    category:      str
    health_status: str
    companies_using: int

class IntegrationDashboard(BaseModel):
    total_providers:      int
    active_integrations:  int
    categories_summary:   list[CategoryUsageSummary]
    provider_health:      list[ProviderHealthSummary]
    recent_failures:      list[ProviderLogResponse]


# ── Test connection ──────────────────────────────────────────────────────
class ConnectionTestRequest(BaseModel):
    provider_id:  int
    credentials:  Optional[dict] = None     # if empty, use stored credentials
    config:       Optional[dict] = None

class ConnectionTestResponse(BaseModel):
    success:    bool
    message:    str
    latency_ms: Optional[int] = None
