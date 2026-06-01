import api from "./axiosConfig";
import type { AxiosResponse } from "axios";

export interface HealthInfo {
  status: string;
  backend: {
    version: string;
    build_sha: string;
    build_time: string;
  };
  database: {
    status: string;
    last_migration: string | null;
  };
  server_time: string;
}

export const getHealthInfo = (): Promise<AxiosResponse<HealthInfo>> =>
  api.get("/health");
