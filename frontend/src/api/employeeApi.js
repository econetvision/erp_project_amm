import api from "./axiosConfig";

export const getAllEmployees = ()        => api.get("/api/employees");
export const getEmployee     = (id)      => api.get(`/api/employees/${id}`);
export const createEmployee  = (data)    => api.post("/api/employees", data);
export const updateEmployee  = (id, d)   => api.put(`/api/employees/${id}`, d);
export const patchEmployee   = (id, d)   => api.patch(`/api/employees/${id}`, d);
export const deleteEmployee  = (id)      => api.delete(`/api/employees/${id}`);
export const registerFace    = (id, img) => api.post(`/api/employees/${id}/face`, { image: img });
