export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  username: string;
  employee_id: number | null;
  email: string | null;
  display_name: string | null;
  lock_timeout: number | null;
  has_pin?: boolean;
  theme_preference?: { mode: string; primaryColor: string; accentColor: string } | null;
}

export interface User {
  id: number;
  username: string;
  role: string;
  employee_id: number | null;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  photo_path: string | null;
  has_pin: boolean;
  lock_timeout: number | null;
  theme_preference?: { mode: string; primaryColor: string; accentColor: string } | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserCreate {
  username: string;
  password: string;
  role: "admin" | "supervisor" | "worker";
  employee_id: number | null;
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
}
