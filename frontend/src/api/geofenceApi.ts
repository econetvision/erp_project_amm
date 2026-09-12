import api from "./axiosConfig";
import type { AxiosResponse } from "axios";

export interface GeofenceExitEvent {
  id: number;
  employee_id: number;
  employee_name: string | null;
  employee_code: string | null;
  location_id: number | null;
  location_name: string | null;
  distance_m: number | null;
  latitude: number | null;
  longitude: number | null;
  exited_at: string;
  returned_at: string | null;
  notified_user_ids: number[] | null;
}

export interface GeofenceEventFilters {
  open_only?: boolean;
  employee_id?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export const getGeofenceEvents = (params: GeofenceEventFilters = {}): Promise<AxiosResponse<GeofenceExitEvent[]>> =>
  api.get("/api/geofence/events", { params });
