export interface Employee {
  id: number;
  employee_code: string | null;
  name: string;
  gender: string | null;
  date_of_birth: string | null;
  blood_group: string | null;
  marital_status: string | null;
  emergency_contact: string | null;
  emergency_name: string | null;
  phone: string | null;
  email: string | null;
  phone_verified: string | null;
  email_verified: string | null;
  address: string;
  aadhar_number: string;
  bank_account_number: string;
  ifsc_code: string | null;
  bank_name: string | null;
  kyc_status: string | null;
  kyc_verified_name: string | null;
  hourly_rate: number | string;
  shift: string;
  photo: string | null;
  work_location_name: string | null;
  work_latitude: number | null;
  work_longitude: number | null;
  attendance_radius_m: number | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeCreate {
  name: string;
  gender?: string;
  date_of_birth?: string;
  blood_group?: string;
  marital_status?: string;
  emergency_contact?: string;
  emergency_name?: string;
  phone?: string;
  email?: string;
  address: string;
  aadhar_number: string;
  bank_account_number: string;
  ifsc_code?: string;
  hourly_rate: number;
  shift: string;
  work_location_name?: string;
  work_latitude?: number;
  work_longitude?: number;
  attendance_radius_m?: number;
}

export interface EmployeeUpdate {
  name?: string;
  gender?: string;
  date_of_birth?: string;
  blood_group?: string;
  marital_status?: string;
  emergency_contact?: string;
  emergency_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  aadhar_number?: string;
  bank_account_number?: string;
  ifsc_code?: string;
  hourly_rate?: number;
  shift?: string;
  work_location_name?: string;
  work_latitude?: number;
  work_longitude?: number;
  attendance_radius_m?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}
