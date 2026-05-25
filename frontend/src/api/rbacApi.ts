import api from "./axiosConfig";
import type { Permission, Role, RoleCreate, AuditLog } from "../types/company";
import type { PaginatedResponse } from "../types/employee";
import type { AxiosResponse } from "axios";

export const getPermissions = (
  module?: string
): Promise<AxiosResponse<Permission[]>> =>
  api.get("/api/rbac/permissions", { params: module ? { module } : {} });

export const getPermissionModules = (): Promise<AxiosResponse<string[]>> =>
  api.get("/api/rbac/permissions/modules");

export const getRoles = (): Promise<AxiosResponse<Role[]>> =>
  api.get("/api/rbac/roles");

export const createRole = (data: RoleCreate): Promise<AxiosResponse<{ id: number; name: string }>> =>
  api.post("/api/rbac/roles", data);

export const updateRole = (
  id: number, data: { name?: string; description?: string; permissions?: number[] }
): Promise<AxiosResponse<{ detail: string }>> =>
  api.put(`/api/rbac/roles/${id}`, data);

export const deleteRole = (id: number): Promise<AxiosResponse<void>> =>
  api.delete(`/api/rbac/roles/${id}`);

export const getAuditLogs = (
  params?: { page?: number; per_page?: number; entity_type?: string; action?: string }
): Promise<AxiosResponse<PaginatedResponse<AuditLog>>> =>
  api.get("/api/rbac/audit-logs", { params });
