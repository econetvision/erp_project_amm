import api from "./axiosConfig";
import type { LoginCredentials, TokenResponse, User, UserCreate, UserUpdate, PasswordChangeRequest } from "../types/auth";
import type { PaginatedResponse } from "../types/employee";
import type { AxiosResponse } from "axios";

export const loginApi        = (credentials: LoginCredentials): Promise<AxiosResponse<TokenResponse>> => api.post("/api/auth/login", credentials);
export const getMe           = (): Promise<AxiosResponse<User>> => api.get("/api/auth/me");
export const getUsers        = (params?: { page?: number; per_page?: number; q?: string }): Promise<AxiosResponse<PaginatedResponse<User>>> => api.get("/api/auth/users", { params });
export const createUser      = (data: UserCreate): Promise<AxiosResponse<User>> => api.post("/api/auth/users", data);
export const deleteUser      = (id: number): Promise<AxiosResponse<void>> => api.delete(`/api/auth/users/${id}`);
export const updateUser      = (id: number, data: { display_name?: string; email?: string; phone?: string; role?: string; password?: string }): Promise<AxiosResponse<User>> => api.put(`/api/auth/users/${id}`, data);
export const updateProfile   = (data: UserUpdate): Promise<AxiosResponse<User>> => api.put("/api/auth/me", data);
export const changePassword  = (data: PasswordChangeRequest): Promise<AxiosResponse<{ detail: string }>> => api.put("/api/auth/me/password", data);
export const uploadUserPhoto = (image: string): Promise<AxiosResponse<User>> => api.post("/api/auth/me/photo", { image });
export const unlockSession   = (data: { password?: string; pin?: string }): Promise<AxiosResponse<{ detail: string }>> => api.post("/api/auth/unlock", data);
export const setPin          = (pin: string, current_password: string): Promise<AxiosResponse<{ detail: string }>> => api.post("/api/auth/me/pin", { pin, current_password });
export const removePin       = (): Promise<AxiosResponse<{ detail: string }>> => api.delete("/api/auth/me/pin");
export const sendVerification = (type: "email" | "phone"): Promise<AxiosResponse<{ detail: string; debug_code: string }>> => api.post("/api/auth/me/send-verification", { type });
export const verifyCode       = (type: "email" | "phone", code: string): Promise<AxiosResponse<{ detail: string }>> => api.post("/api/auth/me/verify", { type, code });
