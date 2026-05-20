import api from "./axiosConfig";

export const getLatestLocations = ()           => api.get("/api/tracking/latest");
export const getLocationHistory = (vehicleId, limit = 50) =>
  api.get(`/api/tracking/${vehicleId}/history`, { params: { limit } });
export const pushLocation = (data) => api.post("/api/tracking/push", data);

// Returns a WebSocket connected to the given vehicleId's live feed
export function openTrackingSocket(vehicleId, onMessage) {
  const base = (process.env.REACT_APP_API_URL || "http://localhost:8088")
    .replace(/^http/, "ws")
    .replace(/\/$/, "");
  const ws = new WebSocket(`${base}/api/tracking/ws/${vehicleId}`);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch (_) {}
  };
  return ws;
}
