export interface SalaryComponent {
  id: number;
  structure_id: number;
  name: string;
  type: "earning" | "deduction";
  calculation_type: "fixed" | "percentage_of_basic" | "percentage_of_gross";
  amount_or_percentage: number;
  is_mandatory: boolean;
  display_order: number;
}

export interface SalaryComponentCreate {
  name: string;
  type: "earning" | "deduction";
  calculation_type: "fixed" | "percentage_of_basic" | "percentage_of_gross";
  amount_or_percentage: number;
  is_mandatory: boolean;
  display_order: number;
}

export interface SalaryStructure {
  id: number;
  name: string;
  description: string | null;
  is_default: boolean;
  components: SalaryComponent[];
  created_at: string;
}

export interface EmployeeSalary {
  id: number;
  employee_id: number;
  structure_id: number;
  basic_pay: number;
  effective_from: string;
  effective_to: string | null;
}

export interface Advance {
  id: number;
  employee_id: number;
  amount: number;
  disbursed_date: string;
  repayment_months: number;
  monthly_deduction: number;
  remaining_balance: number;
  status: "active" | "repaid";
  notes: string | null;
  created_at: string;
}

export interface PayrollItem {
  id: number;
  run_id: number;
  employee_id: number;
  basic_pay: number;
  earnings_breakdown: Record<string, number>;
  deductions_breakdown: Record<string, number>;
  days_worked: number;
  overtime_hours: number;
  overtime_pay: number;
  gross_pay: number;
  total_deductions: number;
  advance_deduction: number;
  net_pay: number;
  status: string;
  employee_name?: string;
}

export interface PayrollRun {
  id: number;
  month: number;
  year: number;
  status: "draft" | "processing" | "completed" | "cancelled";
  run_by: number | null;
  started_at: string;
  completed_at: string | null;
  total_gross: number | null;
  total_net: number | null;
  total_deductions: number | null;
  employee_count: number | null;
}

export interface PayrollRunDetail extends PayrollRun {
  items: PayrollItem[];
}
