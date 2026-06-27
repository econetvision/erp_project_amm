export interface Vehicle {
  id: number;
  reg_number: string;
  type: string;
  make: string | null;
  model: string | null;
  status: string;
  tracker_imei: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleCreate {
  reg_number: string;
  type: string;
  make?: string | null;
  model?: string | null;
  tracker_imei?: string | null;
}

export interface VehicleAssignment {
  id: number;
  vehicle_id: number;
  employee_id: number;
  reg_number: string;
  employee_name: string;
  assigned_at: string;
  released_at: string | null;
  notes: string | null;
}

export interface VehicleLocation {
  vehicle_id: number;
  reg_number: string;
  type: string;
  make: string | null;
  model: string | null;
  status: string;
  employee_name: string | null;
  employee_id: number | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  recorded_at: string | null;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
  holiday_type: string;
  is_optional: boolean;
}
