import api from "./axiosConfig";
import type { AxiosResponse } from "axios";
import type { Invoice, InvoiceGenerate } from "../types/invoice";

export const getInvoices = (params?: { company_id?: number; status?: string }): Promise<AxiosResponse<Invoice[]>> =>
  api.get("/api/invoices", { params });

export const getInvoice = (id: number): Promise<AxiosResponse<Invoice>> =>
  api.get(`/api/invoices/${id}`);

export const generateInvoice = (data: InvoiceGenerate): Promise<AxiosResponse<Invoice>> =>
  api.post("/api/invoices/generate", data);

export const markInvoicePaid = (id: number, payment_ref?: string): Promise<AxiosResponse<Invoice>> =>
  api.post(`/api/invoices/${id}/mark-paid`, { payment_ref: payment_ref || null });

export const voidInvoice = (id: number): Promise<AxiosResponse<Invoice>> =>
  api.post(`/api/invoices/${id}/void`);
