import api from "./axiosConfig";
import type {
  Company, CompanyCreate, CompanyUpdate, CompanyStats,
} from "../types/company";
import type { PaginatedResponse } from "../types/employee";
import type { AxiosResponse } from "axios";

export const getCompanies = (
  params?: { page?: number; per_page?: number; q?: string; all?: boolean }
): Promise<AxiosResponse<PaginatedResponse<Company>>> =>
  api.get("/api/companies", { params });

export const getCompanyStats = (): Promise<AxiosResponse<CompanyStats[]>> =>
  api.get("/api/companies/stats");

export const getCompany = (id: number): Promise<AxiosResponse<Company>> =>
  api.get(`/api/companies/${id}`);

export const createCompany = (data: CompanyCreate): Promise<AxiosResponse<Company>> =>
  api.post("/api/companies", data);

export const updateCompany = (id: number, data: CompanyUpdate): Promise<AxiosResponse<Company>> =>
  api.put(`/api/companies/${id}`, data);

export const deleteCompany = (id: number): Promise<AxiosResponse<void>> =>
  api.delete(`/api/companies/${id}`);

export const uploadCompanyLogo = (id: number, image: string): Promise<AxiosResponse<Company>> =>
  api.post(`/api/companies/${id}/logo`, { image });

export const assignAdminToCompany = (
  companyId: number, userId: number
): Promise<AxiosResponse<{ detail: string }>> =>
  api.post(`/api/companies/${companyId}/assign-admin?user_id=${userId}`);
