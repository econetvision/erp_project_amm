import api from "./axiosConfig";
import type { JobRoutine, JobDetail, JobRoutineLog, JobCreate } from "../types/job";
import type { AxiosResponse } from "axios";

export const getJobs      = (): Promise<AxiosResponse<JobRoutine[]>> => api.get("/api/jobs");
export const getJob       = (id: number | string): Promise<AxiosResponse<JobDetail>> => api.get(`/api/jobs/${id}`);
export const createJob    = (data: JobCreate): Promise<AxiosResponse<JobRoutine>> => api.post("/api/jobs", data);
export const updateJob    = (id: number | string, data: Partial<JobCreate>): Promise<AxiosResponse<JobRoutine>> => api.put(`/api/jobs/${id}`, data);
export const deleteJob    = (id: number | string): Promise<AxiosResponse<void>> => api.delete(`/api/jobs/${id}`);
export const runJobNow    = (id: number | string): Promise<AxiosResponse<JobRoutineLog>> => api.post(`/api/jobs/${id}/run`);
