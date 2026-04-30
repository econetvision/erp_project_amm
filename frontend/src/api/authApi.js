import api from "./axiosConfig";

export const loginApi = (credentials) => api.post("/api/auth/login", credentials);
export const getUsers  = ()            => api.get("/api/auth/users");
export const createUser = (data)       => api.post("/api/auth/users", data);
export const deleteUser = (id)         => api.delete(`/api/auth/users/${id}`);
