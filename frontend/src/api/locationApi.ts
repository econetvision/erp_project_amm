import api from "./axiosConfig";
import type { AxiosResponse } from "axios";

export interface WorkLocation {
  id: number;
  location_name: string;
  location_code: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number;
  longitude: number;
  allowed_radius_m: number;
  work_type: string | null;
  supervisor_id: number | null;
  is_active: boolean;
  created_by: number | null;
  employee_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface WorkLocationCreate {
  location_name: string;
  location_code?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude: number;
  longitude: number;
  allowed_radius_m?: number;
  work_type?: string;
  supervisor_id?: number;
  is_active?: boolean;
}

export interface WorkLocationUpdate {
  location_name?: string;
  location_code?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  allowed_radius_m?: number;
  work_type?: string;
  supervisor_id?: number;
  is_active?: boolean;
}

export interface EmployeeAssignment {
  id: number;
  employee_id: number;
  location_id: number;
  is_primary: boolean;
  assigned_by: number | null;
  assigned_at: string | null;
  location_name: string | null;
  employee_name: string | null;
}

export const getAllLocations = (params?: { q?: string; city?: string; active_only?: boolean }): Promise<AxiosResponse<WorkLocation[]>> =>
  api.get("/api/locations", { params });

export const getLocation = (id: number): Promise<AxiosResponse<WorkLocation>> =>
  api.get(`/api/locations/${id}`);

export const createLocation = (data: WorkLocationCreate): Promise<AxiosResponse<WorkLocation>> =>
  api.post("/api/locations", data);

export const updateLocation = (id: number, data: WorkLocationUpdate): Promise<AxiosResponse<WorkLocation>> =>
  api.put(`/api/locations/${id}`, data);

export const deleteLocation = (id: number): Promise<AxiosResponse<void>> =>
  api.delete(`/api/locations/${id}`);

export const getLocationEmployees = (locationId: number): Promise<AxiosResponse<EmployeeAssignment[]>> =>
  api.get(`/api/locations/${locationId}/employees`);

export const assignEmployee = (data: { employee_id: number; location_id: number; is_primary?: boolean }): Promise<AxiosResponse<EmployeeAssignment>> =>
  api.post("/api/locations/assign", data);

export const assignBulk = (data: { employee_ids: number[]; location_id: number; is_primary?: boolean }): Promise<AxiosResponse<{ detail: string }>> =>
  api.post("/api/locations/assign-bulk", data);

export const unassignEmployee = (assignmentId: number): Promise<AxiosResponse<void>> =>
  api.delete(`/api/locations/assign/${assignmentId}`);
