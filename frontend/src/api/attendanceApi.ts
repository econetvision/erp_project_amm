import api from "./axiosConfig";
import type { Attendance, MonthlyReport, FaceScanResult } from "../types/attendance";
import type { AxiosResponse } from "axios";

export const clockIn          = (data: { employee_id: number; date: string; entry_time: string; image: string | null }): Promise<AxiosResponse<Attendance>> => api.post("/api/attendance/clock-in", data);
export const clockOut         = (id: number, data: { exit_time: string; image: string | null }): Promise<AxiosResponse<Attendance>> => api.patch(`/api/attendance/${id}/clock-out`, data);
export const getMonthlyReport = (empId: number | string, m: number, y: number): Promise<AxiosResponse<MonthlyReport>> => api.get(`/api/attendance/${empId}/monthly?month=${m}&year=${y}`);
export const getTodayStatus   = (empId: number | string): Promise<AxiosResponse<Attendance>> => api.get(`/api/attendance/${empId}/today`);
export const updateAttendance = (id: number, data: Partial<Attendance>): Promise<AxiosResponse<Attendance>> => api.put(`/api/attendance/${id}`, data);
export const deleteAttendance = (id: number): Promise<AxiosResponse<void>> => api.delete(`/api/attendance/${id}`);
export const faceScan         = (image: string): Promise<AxiosResponse<FaceScanResult>> => api.post("/api/attendance/face-scan", { image });
