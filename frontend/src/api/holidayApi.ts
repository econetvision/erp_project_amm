import api from "./axiosConfig";
import type { Holiday } from "../types/vehicle";
import type { AxiosResponse } from "axios";

export const getHolidays   = (year: number): Promise<AxiosResponse<Holiday[]>> => api.get(`/api/holidays?year=${year}`);
export const createHoliday = (data: { date: string; name: string; holiday_type?: string; is_optional?: boolean }): Promise<AxiosResponse<Holiday>> => api.post("/api/holidays", data);
export const deleteHoliday = (id: number): Promise<AxiosResponse<void>> => api.delete(`/api/holidays/${id}`);
