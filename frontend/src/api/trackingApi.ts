import api from "./axiosConfig";
import type { VehicleLocation } from "../types/vehicle";
import type { AxiosResponse } from "axios";

export const getLatestLocations = (): Promise<AxiosResponse<VehicleLocation[]>> => api.get("/api/tracking/latest");
export const getLocationHistory = (vehicleId: number | string, limit: number = 50): Promise<AxiosResponse<VehicleLocation[]>> =>
  api.get(`/api/tracking/${vehicleId}/history`, { params: { limit } });
export const pushLocation = (data: { vehicle_id: number; latitude: number; longitude: number; speed?: number }): Promise<AxiosResponse<VehicleLocation>> => api.post("/api/tracking/push", data);

export function openTrackingSocket(vehicleId: number | string, onMessage: (update: VehicleLocation) => void): WebSocket {
  const base = (process.env.REACT_APP_API_URL || "http://localhost:8088")
    .replace(/^http/, "ws")
    .replace(/\/$/, "");
  const stored = localStorage.getItem("erp_auth");
  const token = stored ? (JSON.parse(stored) as { access_token?: string }).access_token : undefined;
  const ws = new WebSocket(`${base}/api/tracking/ws/${vehicleId}?token=${encodeURIComponent(token || "")}`);
  ws.onmessage = (e: MessageEvent) => {
    try { onMessage(JSON.parse(e.data)); } catch (_) {}
  };
  return ws;
}
