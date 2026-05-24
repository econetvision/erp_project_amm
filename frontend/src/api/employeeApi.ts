import api from "./axiosConfig";
import type { Employee, EmployeeCreate, EmployeeUpdate, PaginatedResponse } from "../types/employee";
import type { AxiosResponse } from "axios";

export const getAllEmployees = (params?: { page?: number; per_page?: number; q?: string; all?: boolean }): Promise<AxiosResponse<PaginatedResponse<Employee>>> => api.get("/api/employees", { params });
export const getEmployee     = (id: number | string): Promise<AxiosResponse<Employee>> => api.get(`/api/employees/${id}`);
export const createEmployee  = (data: EmployeeCreate): Promise<AxiosResponse<Employee>> => api.post("/api/employees", data);
export const updateEmployee  = (id: number | string, d: EmployeeCreate): Promise<AxiosResponse<Employee>> => api.put(`/api/employees/${id}`, d);
export const patchEmployee   = (id: number | string, d: EmployeeUpdate): Promise<AxiosResponse<Employee>> => api.patch(`/api/employees/${id}`, d);
export const deleteEmployee  = (id: number | string): Promise<AxiosResponse<void>> => api.delete(`/api/employees/${id}`);
export const registerFace    = (id: number | string, img: string): Promise<AxiosResponse<Employee>> => api.post(`/api/employees/${id}/face`, { image: img });
export const lookupIfsc      = (empId: number | string, ifsc: string): Promise<AxiosResponse<{bank: string; branch: string; address: string; city: string; state: string}>> => api.get(`/api/employees/${empId}/ifsc-lookup`, { params: { ifsc } });
export const verifyBank      = (empId: number | string): Promise<AxiosResponse<Employee>> => api.post(`/api/employees/${empId}/verify-bank`);

// Twilio phone/email verification
export const sendPhoneOtp    = (id: number | string): Promise<AxiosResponse<{ detail: string; status: string }>> => api.post(`/api/employees/${id}/send-phone-otp`);
export const verifyPhone     = (id: number | string, code: string): Promise<AxiosResponse<Employee>> => api.post(`/api/employees/${id}/verify-phone`, { code });
export const sendEmailOtp    = (id: number | string): Promise<AxiosResponse<{ detail: string; status: string }>> => api.post(`/api/employees/${id}/send-email-otp`);
export const verifyEmail     = (id: number | string, code: string): Promise<AxiosResponse<Employee>> => api.post(`/api/employees/${id}/verify-email`, { code });

// Work location assignment
export const assignWorkLocation = (id: number | string, data: { work_location_name: string; work_latitude: number; work_longitude: number; attendance_radius_km?: number }): Promise<AxiosResponse<Employee>> => api.put(`/api/employees/${id}/work-location`, data);
