import api from "./axiosConfig";
import type { DashboardOverview, EmployeeStat, DailyEmployeeStatus } from "../types/attendance";
import type { AxiosResponse } from "axios";

export const getDashboardOverview  = (month: number, year: number): Promise<AxiosResponse<DashboardOverview>> =>
  api.get(`/api/attendance/dashboard/overview?month=${month}&year=${year}`);

export const getEmployeeStats      = (month: number, year: number): Promise<AxiosResponse<EmployeeStat[]>> =>
  api.get(`/api/attendance/dashboard/employee-stats?month=${month}&year=${year}`);

export const getDailySummary       = (dateStr: string): Promise<AxiosResponse<DailyEmployeeStatus[]>> =>
  api.get(`/api/attendance/daily-summary?date=${dateStr}`);

export interface LocationStats {
  total_locations: number;
  active_locations: number;
  total_assigned: number;
  city_distribution: Record<string, number>;
}

export const getLocationStats = (): Promise<AxiosResponse<LocationStats>> =>
  api.get("/api/locations/stats");
