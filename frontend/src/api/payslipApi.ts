import api from "./axiosConfig";
import type { Payslip, PayslipGenerateRequest } from "../types/payslip";
import type { AxiosResponse } from "axios";

export const generatePayslip      = (data: PayslipGenerateRequest): Promise<AxiosResponse<Payslip>> => api.post("/api/payslips/generate", data);
export const getEmployeePayslips  = (empId: number | string): Promise<AxiosResponse<Payslip[]>> => api.get(`/api/payslips/${empId}`);
export const getPayslip           = (empId: number | string, y: number | string, m: number | string): Promise<AxiosResponse<Payslip>> => api.get(`/api/payslips/${empId}/${y}/${m}`);
export const getMonthPayslips     = (y: number | string, m: number | string): Promise<AxiosResponse<Payslip[]>> => api.get(`/api/payslips/month/${y}/${m}`);
export const deletePayslip        = (id: number): Promise<AxiosResponse<void>> => api.delete(`/api/payslips/${id}`);
