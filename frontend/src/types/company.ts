export interface Company {
  id: number;
  name: string;
  code: string;
  logo_path: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gst_number: string | null;
  pan_number: string | null;
  timezone: string | null;
  currency: string | null;
  is_active: boolean;
  theme_config: Record<string, any> | null;
  payroll_config: Record<string, any> | null;
  attendance_config: Record<string, any> | null;
  features: Record<string, boolean> | null;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyCreate {
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  website?: string;
  gst_number?: string;
  pan_number?: string;
  timezone?: string;
  currency?: string;
}

export interface CompanyUpdate {
  name?: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  website?: string;
  gst_number?: string;
  pan_number?: string;
  timezone?: string;
  currency?: string;
  is_active?: boolean;
  theme_config?: Record<string, any>;
  payroll_config?: Record<string, any>;
  attendance_config?: Record<string, any>;
  features?: Record<string, boolean>;
}

export interface CompanyStats {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  employee_count: number;
  user_count: number;
  admin_count: number;
  created_at?: string;
}

export interface Permission {
  id: number;
  code: string;
  name: string;
  module: string;
  description: string | null;
}

export interface Role {
  id: number;
  name: string;
  company_id: number | null;
  is_system: boolean;
  description: string | null;
  permissions: Permission[];
  created_at?: string;
}

export interface RoleCreate {
  name: string;
  company_id?: number;
  description?: string;
  permissions: number[];
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  company_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  ip_address: string | null;
  created_at?: string;
}

export interface MasterOverview {
  total_companies: number;
  active_companies: number;
  total_employees: number;
  total_users: number;
  users_by_role: Record<string, number>;
  employees_by_company: { company: string; count: number }[];
  recent_audit_logs: AuditLog[];
}
