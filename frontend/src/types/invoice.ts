export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export interface InvoiceLine {
  id: number;
  license_id: number | null;
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  company_id: number;
  company_name: string | null;
  subscription_id: number | null;
  period_start: string;
  period_end: string;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  total: string;
  status: InvoiceStatus;
  paid_at: string | null;
  payment_ref: string | null;
  billing_snapshot: {
    name?: string | null; address?: string | null; city?: string | null;
    state?: string | null; pincode?: string | null; gst_number?: string | null;
  } | null;
  created_by: number | null;
  created_at: string | null;
  lines: InvoiceLine[];
}

export interface InvoiceGenerate {
  company_id: number;
  period_start: string;
  period_end: string;
}
