import api from "./axiosConfig";
import type { MasterOverview, CompanyStats } from "../types/company";
import type { AxiosResponse } from "axios";

export const getMasterOverview = (): Promise<AxiosResponse<MasterOverview>> =>
  api.get("/api/master/overview");

export const getCompaniesSummary = (): Promise<AxiosResponse<CompanyStats[]>> =>
  api.get("/api/master/companies-summary");

export const impersonateUser = (
  userId: number
): Promise<AxiosResponse<any>> =>
  api.post(`/api/master/impersonate/${userId}`);
