import api from "./axiosConfig";
import type {
  SalaryStructure, EmployeeSalary, Advance, PayrollRun, PayrollRunDetail,
} from "../types/payroll";
import type { AxiosResponse } from "axios";

// Salary Structures
export const getStructures   = (): Promise<AxiosResponse<SalaryStructure[]>> => api.get("/api/payroll/structures");
export const createStructure = (data: any): Promise<AxiosResponse<SalaryStructure>> => api.post("/api/payroll/structures", data);
export const updateStructure = (id: number | string, data: any): Promise<AxiosResponse<SalaryStructure>> => api.put(`/api/payroll/structures/${id}`, data);
export const deleteStructure = (id: number | string): Promise<AxiosResponse<void>> => api.delete(`/api/payroll/structures/${id}`);

// Employee Salary
export const getEmployeeSalary   = (empId: number | string): Promise<AxiosResponse<EmployeeSalary[]>> => api.get(`/api/payroll/employees/${empId}/salary`);
export const assignSalary        = (empId: number | string, data: { structure_id: number; basic_pay: number }): Promise<AxiosResponse<EmployeeSalary>> => api.post(`/api/payroll/employees/${empId}/salary`, data);

// Advances
export const getAdvances    = (empId?: number): Promise<AxiosResponse<Advance[]>> => api.get("/api/payroll/advances", { params: empId ? { employee_id: empId } : {} });
export const createAdvance  = (data: any): Promise<AxiosResponse<Advance>> => api.post("/api/payroll/advances", data);
export const deleteAdvance  = (id: number | string): Promise<AxiosResponse<void>> => api.delete(`/api/payroll/advances/${id}`);

// Payroll Runs
export const getPayrollRuns   = (): Promise<AxiosResponse<PayrollRun[]>> => api.get("/api/payroll/runs");
export const getPayrollRun    = (id: number | string): Promise<AxiosResponse<PayrollRunDetail>> => api.get(`/api/payroll/runs/${id}`);
export const createPayrollRun = (data: { month: number; year: number }): Promise<AxiosResponse<PayrollRun>> => api.post("/api/payroll/runs", data);
export const finalizeRun      = (id: number | string): Promise<AxiosResponse<PayrollRun>> => api.post(`/api/payroll/runs/${id}/finalize`);
export const cancelRun        = (id: number | string): Promise<AxiosResponse<void>> => api.delete(`/api/payroll/runs/${id}`);
