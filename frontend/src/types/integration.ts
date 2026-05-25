// ── Integration Management Types ──────────────────────────────────────

export type IntegrationCategory =
  | "sms" | "email" | "maps" | "kyc" | "bank"
  | "notification" | "otp" | "geolocation";

export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";
export type LogStatus    = "pending" | "success" | "failed" | "retrying";

// ── Provider catalogue ──────────────────────────────────────────────

export interface IntegrationProvider {
  id: number;
  category: IntegrationCategory;
  code: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  config_schema: Record<string, any> | null;
  is_active: boolean;
  version: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationProviderCreate {
  category: IntegrationCategory;
  code: string;
  name: string;
  description?: string;
  logo_url?: string;
  config_schema?: Record<string, any>;
  is_active?: boolean;
  version?: string;
}

export interface IntegrationProviderUpdate {
  name?: string;
  description?: string;
  logo_url?: string;
  config_schema?: Record<string, any>;
  is_active?: boolean;
  version?: string;
}

// ── Company integration ─────────────────────────────────────────────

export interface CompanyIntegration {
  id: number;
  company_id: number;
  provider_id: number;
  category: IntegrationCategory;
  is_enabled: boolean;
  is_default: boolean;
  priority: number;
  is_fallback: boolean;
  config: Record<string, any> | null;
  daily_quota: number | null;
  monthly_quota: number | null;
  rate_limit_per_min: number | null;
  health_status: HealthStatus;
  last_health_check: string | null;
  credentials_set: boolean;
  provider_name: string | null;
  provider_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyIntegrationCreate {
  provider_id: number;
  category: IntegrationCategory;
  is_enabled?: boolean;
  is_default?: boolean;
  priority?: number;
  is_fallback?: boolean;
  credentials?: Record<string, string>;
  config?: Record<string, any>;
  daily_quota?: number;
  monthly_quota?: number;
  rate_limit_per_min?: number;
}

export interface CompanyIntegrationUpdate {
  is_enabled?: boolean;
  is_default?: boolean;
  priority?: number;
  is_fallback?: boolean;
  credentials?: Record<string, string>;
  config?: Record<string, any>;
  daily_quota?: number;
  monthly_quota?: number;
  rate_limit_per_min?: number;
}

// ── Global defaults ─────────────────────────────────────────────────

export interface GlobalDefault {
  id: number;
  category: string;
  provider_id: number | null;
  fallback_provider_id: number | null;
  config: Record<string, any> | null;
  is_enabled: boolean;
  credentials_set: boolean;
  provider_name: string | null;
  fallback_provider_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlobalDefaultCreate {
  category: IntegrationCategory;
  provider_id?: number;
  fallback_provider_id?: number;
  credentials?: Record<string, string>;
  config?: Record<string, any>;
  is_enabled?: boolean;
}

export interface GlobalDefaultUpdate {
  provider_id?: number;
  fallback_provider_id?: number;
  credentials?: Record<string, string>;
  config?: Record<string, any>;
  is_enabled?: boolean;
}

// ── Logs & Usage ────────────────────────────────────────────────────

export interface ProviderLog {
  id: number;
  company_id: number | null;
  provider_id: number | null;
  category: string;
  action: string;
  status: LogStatus;
  error_message: string | null;
  latency_ms: number | null;
  retry_count: number;
  created_at: string;
  provider_name: string | null;
}

export interface WebhookLog {
  id: number;
  provider_id: number | null;
  company_id: number | null;
  event_type: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface ProviderUsage {
  id: number;
  company_id: number;
  provider_id: number;
  category: string;
  date: string;
  request_count: number;
  success_count: number;
  failure_count: number;
  total_latency_ms: number;
  provider_name: string | null;
}

// ── Dashboard ───────────────────────────────────────────────────────

export interface CategoryUsageSummary {
  category: string;
  total_requests: number;
  success_count: number;
  failure_count: number;
  avg_latency_ms: number | null;
}

export interface ProviderHealthSummary {
  provider_id: number;
  provider_name: string;
  category: string;
  health_status: HealthStatus;
  companies_using: number;
}

export interface IntegrationDashboard {
  total_providers: number;
  active_integrations: number;
  categories_summary: CategoryUsageSummary[];
  provider_health: ProviderHealthSummary[];
  recent_failures: ProviderLog[];
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency_ms: number | null;
}

// ── Paginated response ──────────────────────────────────────────────

export interface PaginatedLogs {
  items: ProviderLog[];
  total: number;
  page: number;
  pages: number;
}
