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

export type MissedReason = "absent" | "incomplete" | "late";

export interface MissedDayDetail {
  date: string;
  reason: MissedReason;
  entry_time: string | null;
  exit_time: string | null;
}

export interface MissedAttendanceEntry {
  employee_id: number;
  employee_code: string | null;
  name: string | null;
  shift: string | null;
  missed_days: number;
  absent_days: number;
  incomplete_days: number;
  late_days: number;
  details: MissedDayDetail[];
}

export interface MissedAttendanceResponse {
  period: "daily" | "weekly" | "monthly";
  start_date: string;
  end_date: string;
  working_days: number;
  total_employees: number;
  employees_with_misses: number;
  total_absent: number;
  total_incomplete: number;
  total_late: number;
  total_missed: number;
  employees: MissedAttendanceEntry[];
}
