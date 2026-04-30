import api from "./axiosConfig";

export const getDashboardOverview  = (month, year) =>
  api.get(`/api/attendance/dashboard/overview?month=${month}&year=${year}`);

export const getEmployeeStats      = (month, year) =>
  api.get(`/api/attendance/dashboard/employee-stats?month=${month}&year=${year}`);

export const getDailySummary       = (dateStr) =>
  api.get(`/api/attendance/daily-summary?date=${dateStr}`);
