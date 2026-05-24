import api from "./axiosConfig";
import type { Vehicle, VehicleCreate, VehicleAssignment } from "../types/vehicle";
import type { AxiosResponse } from "axios";

export const listVehicles   = (): Promise<AxiosResponse<Vehicle[]>> => api.get("/api/vehicles");
export const getVehicle     = (id: number | string): Promise<AxiosResponse<Vehicle>> => api.get(`/api/vehicles/${id}`);
export const createVehicle  = (data: VehicleCreate): Promise<AxiosResponse<Vehicle>> => api.post("/api/vehicles", data);
export const updateVehicle  = (id: number | string, d: Partial<Vehicle>): Promise<AxiosResponse<Vehicle>> => api.patch(`/api/vehicles/${id}`, d);
export const deleteVehicle  = (id: number | string): Promise<AxiosResponse<void>> => api.delete(`/api/vehicles/${id}`);

export const listAssignments  = (activeOnly: boolean = true): Promise<AxiosResponse<VehicleAssignment[]>> =>
  api.get("/api/assignments", { params: { active_only: activeOnly } });
export const assignVehicle    = (data: { vehicle_id: number; employee_id: number; notes: string | null }): Promise<AxiosResponse<VehicleAssignment>> => api.post("/api/assignments", data);
export const releaseVehicle   = (id: number): Promise<AxiosResponse<void>> => api.delete(`/api/assignments/${id}`);
