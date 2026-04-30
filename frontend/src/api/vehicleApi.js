import api from "./axiosConfig";

export const listVehicles   = ()        => api.get("/api/vehicles");
export const getVehicle     = (id)      => api.get(`/api/vehicles/${id}`);
export const createVehicle  = (data)    => api.post("/api/vehicles", data);
export const updateVehicle  = (id, d)   => api.patch(`/api/vehicles/${id}`, d);
export const deleteVehicle  = (id)      => api.delete(`/api/vehicles/${id}`);

export const listAssignments  = (activeOnly = true) =>
  api.get("/api/assignments", { params: { active_only: activeOnly } });
export const assignVehicle    = (data) => api.post("/api/assignments", data);
export const releaseVehicle   = (id)   => api.delete(`/api/assignments/${id}`);
