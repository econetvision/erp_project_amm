import api from "./axiosConfig";
import type { AxiosResponse } from "axios";
import type {
  Subscription, SubscriptionDetail, SubscriptionCreate, SubscriptionUpdate, License, LicenseGrant,
} from "../types/subscription";

export const getSubscriptions = (params?: { company_id?: number }): Promise<AxiosResponse<Subscription[]>> =>
  api.get("/api/subscriptions", { params });

export const getMySubscription = (): Promise<AxiosResponse<SubscriptionDetail>> =>
  api.get("/api/subscriptions/my");

export const getSubscription = (id: number): Promise<AxiosResponse<SubscriptionDetail>> =>
  api.get(`/api/subscriptions/${id}`);

export const createSubscription = (data: SubscriptionCreate): Promise<AxiosResponse<SubscriptionDetail>> =>
  api.post("/api/subscriptions", data);

export const updateSubscription = (id: number, data: SubscriptionUpdate): Promise<AxiosResponse<SubscriptionDetail>> =>
  api.put(`/api/subscriptions/${id}`, data);

export const suspendSubscription = (id: number): Promise<AxiosResponse<SubscriptionDetail>> =>
  api.post(`/api/subscriptions/${id}/suspend`);

export const activateSubscription = (id: number): Promise<AxiosResponse<SubscriptionDetail>> =>
  api.post(`/api/subscriptions/${id}/activate`);

export const getLicenses = (params?: { company_id?: number; subscription_id?: number }): Promise<AxiosResponse<License[]>> =>
  api.get("/api/licenses", { params });

export const grantLicenses = (data: LicenseGrant): Promise<AxiosResponse<License[]>> =>
  api.post("/api/licenses", data);

export const revokeLicense = (id: number, reason: string): Promise<AxiosResponse<License>> =>
  api.post(`/api/licenses/${id}/revoke`, { reason });
