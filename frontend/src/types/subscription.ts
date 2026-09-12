export type Plan = "basic" | "pro" | "enterprise";
export type SubscriptionStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";
export type BillingCycle = "monthly" | "yearly";

export interface License {
  id: number;
  subscription_id: number;
  company_id: number;
  site_id: number | null;
  site_name: string | null;
  license_key: string;
  status: "active" | "revoked";
  max_users: number | null;      // null = unlimited
  max_admins: number;
  granted_by: number | null;
  granted_at: string | null;
  revoked_by: number | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string | null;
}

export interface Subscription {
  id: number;
  company_id: number;
  company_name: string | null;
  plan: Plan;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  starts_at: string | null;
  ends_at: string | null;
  unit_price: string;            // Decimal serialised as string
  currency: string;
  tax_rate: string;
  features: Record<string, boolean> | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  // derived
  capacity: number | null;       // null = unlimited
  admin_cap: number;
  seats_used: number;
  admins_used: number;
  active_licenses: number;
  is_valid: boolean;
  reason_code: string | null;
  reason: string | null;
}

export interface SubscriptionDetail extends Subscription {
  licenses: License[];
  days_to_renewal: number | null;
}

export interface SubscriptionCreate {
  company_id: number;
  plan: Plan;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  starts_at?: string | null;
  ends_at?: string | null;
  unit_price: string;
  currency?: string | null;
  tax_rate: string;
  notes?: string | null;
  initial_licenses: number;
}

export interface SubscriptionUpdate {
  plan?: Plan;
  status?: SubscriptionStatus;
  billing_cycle?: BillingCycle;
  starts_at?: string | null;
  ends_at?: string | null;
  unit_price?: string;
  currency?: string;
  tax_rate?: string;
  notes?: string | null;
}

export interface LicenseGrant {
  subscription_id: number;
  site_id?: number | null;
  quantity: number;
  max_users?: number | null;
  max_admins: number;
  unlimited: boolean;
}
