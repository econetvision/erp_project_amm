import api from "./axiosConfig";
import type { Notification } from "../types/job";
import type { AxiosResponse } from "axios";

export const getNotifications = (unreadOnly: boolean = false): Promise<AxiosResponse<Notification[]>> =>
  api.get("/api/notifications", { params: { unread_only: unreadOnly } });
export const getUnreadCount   = (): Promise<AxiosResponse<{ count: number }>> => api.get("/api/notifications/unread-count");
export const markRead         = (id: number): Promise<AxiosResponse<Notification>> => api.patch(`/api/notifications/${id}/read`);
export const markAllRead      = (): Promise<AxiosResponse<void>> => api.patch("/api/notifications/read-all");
