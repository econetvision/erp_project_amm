import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPayslip } from "../../api/payslipApi";
import { getEmployee } from "../../api/employeeApi";
import AlertMessage from "../../components/AlertMessage";
import type { Payslip } from "../../types/payslip";
import type { Employee } from "../../types/employee";

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

const SHIFT_LABELS: Record<string, string> = {
  SHIFT_A: "Shift A — 6:30 AM to 2:00 PM",
  SHIFT_B: "Shift B — 9:00 AM to 5:00 PM",
};

export default function PayslipView() {
  const { employeeId, year, month } = useParams();
  const navigate                    = useNavigate();
  const [payslip, setPayslip]       = useState<Payslip | null>(null);
  const [employee, setEmployee]     = useState<Employee | null>(null);
  const [alert, setAlert]           = useState({ type: "", message: "" });

  useEffect(() => {
    Promise.all([
      getPayslip(employeeId!, year!, month!),
      getEmployee(employeeId!),
    ])
      .then(([ps, emp]) => {
        setPayslip(ps.data);
        setEmployee(emp.data);
      })
      .catch((e: any) => setAlert({ type: "danger", message: e.message }));
  }, [employeeId, year, month]);

  if (!payslip || !employee) return (
    <div className="text-center mt-5">
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />
      {!alert.message && <div className="spinner-border text-primary" />}
    </div>
  );

  return (
    <div className="row justify-content-center">
      <div className="col-md-7">
        <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

        <div className="card shadow" id="payslip-card">
          <div className="card-header bg-primary text-white text-center py-3">
            <h4 className="mb-0 fw-bold">PAYSLIP</h4>
            <p className="mb-0">{MONTHS[payslip.month - 1]} {payslip.year}</p>
          </div>
          <div className="card-body p-4">

            {/* Employee + Pay Period */}
            <div className="row mb-4">
              <div className="col-6">
                <h6 className="text-muted">Employee Details</h6>
                <p className="mb-1"><strong>Name:</strong> {employee.name}</p>
                <p className="mb-1"><strong>Employee ID:</strong> #{employee.id}</p>
                <p className="mb-1"><strong>Aadhar:</strong> XXXX-XXXX-{employee.aadhar_number.slice(-4)}</p>
                <p className="mb-1"><strong>Bank Account:</strong> {employee.bank_account_number}</p>
                <p className="mb-1"><strong>Shift:</strong> {SHIFT_LABELS[employee.shift] ?? employee.shift}</p>
              </div>
              <div className="col-6 text-md-end">
                <h6 className="text-muted">Pay Period</h6>
                <p className="mb-1"><strong>{MONTHS[payslip.month - 1]} {payslip.year}</strong></p>
                <p className="mb-1 text-muted small">Generated: {new Date(payslip.generated_at).toLocaleDateString()}</p>
              </div>
            </div>

            <hr />

            <table className="table table-bordered">
              <thead className="table-light">
                <tr><th>Description</th><th className="text-end">Amount</th></tr>
              </thead>

              {/* Earnings */}
              <tbody>
                <tr>
                  <td>Days Worked</td>
                  <td className="text-end">{payslip.days_worked} / 26 days</td>
                </tr>
                <tr>
                  <td>Total Hours Worked</td>
                  <td className="text-end">{parseFloat(String(payslip.total_hours)).toFixed(2)} hrs</td>
                </tr>
                <tr>
                  <td>Hourly Rate</td>
                  <td className="text-end">₹{parseFloat(String(payslip.hourly_rate)).toFixed(2)} / hr</td>
                </tr>
                <tr>
                  <td>Daily Rate</td>
                  <td className="text-end">₹{parseFloat(String(payslip.daily_rate)).toFixed(2)} / day</td>
                </tr>
                <tr className="fw-semibold">
                  <td>Gross Pay <span className="text-muted fw-normal small">(Days Worked × Daily Rate)</span></td>
                  <td className="text-end">₹{parseFloat(String(payslip.gross_pay)).toFixed(2)}</td>
                </tr>
              </tbody>

              {/* Deductions */}
              <tbody>
                <tr className="table-light">
                  <td colSpan={2} className="fw-semibold text-muted">Deductions</td>
                </tr>
                <tr className="text-danger">
                  <td>ESI (0.75%)</td>
                  <td className="text-end">- ₹{parseFloat(String(payslip.esi)).toFixed(2)}</td>
                </tr>
                <tr className="text-danger">
                  <td>PF (12%)</td>
                  <td className="text-end">- ₹{parseFloat(String(payslip.pf)).toFixed(2)}</td>
                </tr>
              </tbody>

              <tfoot>
                <tr className="table-success fw-bold fs-5">
                  <td>Net Pay</td>
                  <td className="text-end">₹{parseFloat(String(payslip.net_pay)).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            <p className="text-muted small text-center mt-3">
              Gross Pay = {payslip.days_worked} days × ₹{parseFloat(String(payslip.daily_rate)).toFixed(2)} = ₹{parseFloat(String(payslip.gross_pay)).toFixed(2)}
              &nbsp;|&nbsp;
              Net Pay = ₹{parseFloat(String(payslip.gross_pay)).toFixed(2)} − ₹{parseFloat(String(payslip.esi)).toFixed(2)} − ₹{parseFloat(String(payslip.pf)).toFixed(2)} = ₹{parseFloat(String(payslip.net_pay)).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="d-flex gap-2 mt-3">
          <button className="btn btn-primary" onClick={() => window.print()}>Print</button>
          <button className="btn btn-secondary" onClick={() => navigate("/payslips")}>Back</button>
        </div>
      </div>
    </div>
  );
}
