export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  username: string;
  company_id: number | null;
  employee_id: number | null;
  email: string | null;
  display_name: string | null;
  lock_timeout: number | null;
  has_pin?: boolean;
  theme_preference?: { mode: string; primaryColor: string; accentColor: string } | null;
  impersonated?: boolean;
}

export interface User {
  id: number;
  username: string;
  role: string;
  company_id: number | null;
  employee_id: number | null;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  photo_path: string | null;
  has_pin: boolean;
  lock_timeout: number | null;
  is_active?: boolean;
  theme_preference?: { mode: string; primaryColor: string; accentColor: string } | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserCreate {
  username: string;
  password: string;
  role: "master" | "admin" | "supervisor" | "worker";
  company_id?: number | null;
  email?: string;
  display_name?: string;
  phone?: string;
}

export interface UserUpdate {
  display_name?: string;
  email?: string;
  phone?: string;
  theme_preference?: { mode: string; primaryColor: string; accentColor: string } | null;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

export interface AuthContextType {
  auth: TokenResponse | null;
  locked: boolean;
  login: (data: TokenResponse) => void;
  logout: () => void;
  lock: () => void;
  unlock: () => void;
  switchCompany: (companyId: number) => void;
}
