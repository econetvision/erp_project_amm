import api from "./axiosConfig";
import type { AxiosResponse } from "axios";
import type {
  IntegrationProvider,
  IntegrationProviderCreate,
  IntegrationProviderUpdate,
  CompanyIntegration,
  CompanyIntegrationCreate,
  CompanyIntegrationUpdate,
  GlobalDefault,
  GlobalDefaultCreate,
  GlobalDefaultUpdate,
  IntegrationDashboard,
  ProviderUsage,
  ConnectionTestResult,
  PaginatedLogs,
} from "../types/integration";

const BASE = "/api/integrations";

// ── Provider catalogue ──────────────────────────────────────────────

export const getProviders = (category?: string): Promise<AxiosResponse<IntegrationProvider[]>> =>
  api.get(`${BASE}/providers`, { params: category ? { category } : {} });

export const createProvider = (data: IntegrationProviderCreate): Promise<AxiosResponse<IntegrationProvider>> =>
  api.post(`${BASE}/providers`, data);

export const updateProvider = (id: number, data: IntegrationProviderUpdate): Promise<AxiosResponse<IntegrationProvider>> =>
  api.put(`${BASE}/providers/${id}`, data);

export const deleteProvider = (id: number): Promise<AxiosResponse<void>> =>
  api.delete(`${BASE}/providers/${id}`);

export const getCategories = (): Promise<AxiosResponse<string[]>> =>
  api.get(`${BASE}/providers/categories`);

// ── Global defaults ─────────────────────────────────────────────────

export const getGlobalDefaults = (): Promise<AxiosResponse<GlobalDefault[]>> =>
  api.get(`${BASE}/global-defaults`);

export const upsertGlobalDefault = (data: GlobalDefaultCreate | GlobalDefaultUpdate & { category: string }): Promise<AxiosResponse<GlobalDefault>> =>
  api.post(`${BASE}/global-defaults`, data);

export const deleteGlobalDefault = (category: string): Promise<AxiosResponse<void>> =>
  api.delete(`${BASE}/global-defaults/${category}`);

// ── Company integrations ────────────────────────────────────────────

export const getCompanyIntegrations = (companyId: number, category?: string): Promise<AxiosResponse<CompanyIntegration[]>> =>
  api.get(`${BASE}/company/${companyId}`, { params: category ? { category } : {} });

export const createCompanyIntegration = (companyId: number, data: CompanyIntegrationCreate): Promise<AxiosResponse<CompanyIntegration>> =>
  api.post(`${BASE}/company/${companyId}`, data);

export const updateCompanyIntegration = (companyId: number, integrationId: number, data: CompanyIntegrationUpdate): Promise<AxiosResponse<CompanyIntegration>> =>
  api.put(`${BASE}/company/${companyId}/${integrationId}`, data);

export const deleteCompanyIntegration = (companyId: number, integrationId: number): Promise<AxiosResponse<void>> =>
  api.delete(`${BASE}/company/${companyId}/${integrationId}`);

// ── Connection testing ──────────────────────────────────────────────

export const testConnection = (
  providerId: number,
  credentials?: Record<string, string>,
  config?: Record<string, any>,
  companyId?: number,
): Promise<AxiosResponse<ConnectionTestResult>> =>
  api.post(`${BASE}/test-connection`, { provider_id: providerId, credentials, config }, { params: companyId ? { company_id: companyId } : {} });

// ── Dashboard & analytics ───────────────────────────────────────────

export const getIntegrationDashboard = (companyId?: number): Promise<AxiosResponse<IntegrationDashboard>> =>
  api.get(`${BASE}/dashboard`, { params: companyId ? { company_id: companyId } : {} });

// ── Logs ────────────────────────────────────────────────────────────

export const getProviderLogs = (params?: {
  company_id?: number;
  category?: string;
  status?: string;
  page?: number;
  per_page?: number;
}): Promise<AxiosResponse<PaginatedLogs>> =>
  api.get(`${BASE}/logs`, { params });

export const getProviderUsage = (params?: {
  company_id?: number;
  category?: string;
}): Promise<AxiosResponse<ProviderUsage[]>> =>
  api.get(`${BASE}/usage`, { params });

export const getWebhookLogs = (params?: {
  company_id?: number;
  page?: number;
  per_page?: number;
}): Promise<AxiosResponse<PaginatedLogs>> =>
  api.get(`${BASE}/webhook-logs`, { params });
