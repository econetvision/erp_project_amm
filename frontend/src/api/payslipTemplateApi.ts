import api from "./axiosConfig";
import type {
  PayslipTemplate,
  PayslipTemplateCreate,
  PayslipTemplateUpdate,
  TemplateLayout,
} from "../types/payslipTemplate";
import type { AxiosResponse } from "axios";

export const getTemplates = (companyId?: number): Promise<AxiosResponse<PayslipTemplate[]>> =>
  api.get("/api/payslip-templates", { params: companyId ? { company_id: companyId } : {} });

export const getTemplate = (id: number): Promise<AxiosResponse<PayslipTemplate>> =>
  api.get(`/api/payslip-templates/${id}`);

export const getDefaultLayout = (): Promise<AxiosResponse<TemplateLayout>> =>
  api.get("/api/payslip-templates/default-layout");

export const createTemplate = (data: PayslipTemplateCreate): Promise<AxiosResponse<PayslipTemplate>> =>
  api.post("/api/payslip-templates", data);

export const updateTemplate = (id: number, data: PayslipTemplateUpdate): Promise<AxiosResponse<PayslipTemplate>> =>
  api.put(`/api/payslip-templates/${id}`, data);

export const deleteTemplate = (id: number): Promise<AxiosResponse<void>> =>
  api.delete(`/api/payslip-templates/${id}`);

export const duplicateTemplate = (id: number): Promise<AxiosResponse<PayslipTemplate>> =>
  api.post(`/api/payslip-templates/${id}/duplicate`);
