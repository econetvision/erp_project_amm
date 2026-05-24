export interface JobRoutine {
  id: number;
  name: string;
  type: "absent_report" | "late_report" | "custom";
  frequency: "daily" | "weekly" | "monthly";
  schedule_time: string;
  schedule_day_of_week: number | null;
  schedule_day_of_month: number | null;
  delivery_channels: { email: boolean; in_app: boolean; whatsapp: boolean };
  recipients: Array<{ type: "user" | "email"; value: string | number }>;
  filters: Record<string, any> | null;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface JobRoutineLog {
  id: number;
  job_id: number;
  executed_at: string;
  status: "success" | "failed";
  result_summary: string | null;
  error_message: string | null;
}

export interface JobDetail extends JobRoutine {
  recent_logs: JobRoutineLog[];
}

export interface JobCreate {
  name: string;
  type: "absent_report" | "late_report" | "custom";
  frequency: "daily" | "weekly" | "monthly";
  schedule_time: string;
  schedule_day_of_week?: number | null;
  schedule_day_of_month?: number | null;
  delivery_channels: { email: boolean; in_app: boolean; whatsapp: boolean };
  recipients: Array<{ type: "user" | "email"; value: string | number }>;
  filters?: Record<string, any> | null;
  is_active: boolean;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
}
