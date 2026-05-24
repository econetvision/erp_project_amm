export interface Attendance {
  id: number;
  employee_id: number;
  date: string;
  entry_time: string;
  exit_time: string | null;
  hours_worked: number | string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyEntry {
  date: string;
  present_count: number;
  absent_count: number;
  late_count: number;
}

export interface DashboardOverview {
  month: number;
  year: number;
  total_employees: number;
  working_days: number;
  daily_entries: DailyEntry[];
}

export interface EmployeeStat {
  employee_id: number;
  name: string;
  shift: string;
  days_present: number;
  days_absent: number;
  attendance_rate: number;
  late_days: number;
  overtime_hours: number;
}

export interface DailyEmployeeStatus {
  employee_id: number;
  name: string;
  shift: string;
  status: string;
  entry_time: string | null;
  exit_time: string | null;
  hours_worked: number | null;
  is_late: boolean;
  overtime_hours: number;
}

export interface MonthlyReport {
  employee_id: number;
  employee_name: string;
  month: number;
  year: number;
  total_days: number;
  total_hours: number | string;
  records: Attendance[];
}

export interface FaceScanResult {
  employee_id: number;
  employee_name: string;
  action: string;
  attendance: Attendance;
}
