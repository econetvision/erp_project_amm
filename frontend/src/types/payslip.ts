export interface Payslip {
  id: number;
  employee_id: number;
  month: number;
  year: number;
  days_worked: number;
  total_hours: number | string;
  hourly_rate: number | string;
  daily_rate: number | string;
  gross_pay: number | string;
  esi: number | string;
  pf: number | string;
  net_pay: number | string;
  generated_at: string;
}

export interface PayslipGenerateRequest {
  employee_id: number;
  month: number;
  year: number;
}
