import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPayrollRun, finalizeRun } from "../../api/payrollApi";
import AlertMessage from "../../components/AlertMessage";
import type { PayrollRunDetail } from "../../types/payroll";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function PayrollDetail() {
  const { id }            = useParams();
  const navigate          = useNavigate();
  const [run, setRun]     = useState<PayrollRunDetail | null>(null);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    getPayrollRun(id!)
      .then(({ data }) => setRun(data))
      .catch((e: any) => setAlert({ type: "danger", message: e.message }));
  }, [id]);

  async function handleFinalize() {
    if (!window.confirm("Finalize? This deducts advances and cannot be undone.")) return;
    try {
      await finalizeRun(id!);
      const { data } = await getPayrollRun(id!);
      setRun(data);
      setAlert({ type: "success", message: "Payroll finalized." });
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  if (!run) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="fw-bold mb-1">Payroll — {MONTHS[run.month-1]} {run.year}</h3>
          <span className={`badge bg-${run.status === "completed" ? "success" : "warning"} me-2`}>{run.status}</span>
          <span className="text-muted small">{run.employee_count} employees</span>
        </div>
        <div className="d-flex gap-2">
          {run.status === "draft" && <button className="btn btn-success" onClick={handleFinalize}>✅ Finalize</button>}
          <button className="btn btn-secondary" onClick={() => navigate("/payroll/runs")}>Back</button>
        </div>
      </div>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {/* Summary cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <div className="text-muted small">Total Gross</div>
              <div className="fs-5 fw-bold">₹{parseFloat(String(run.total_gross || 0)).toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <div className="text-muted small">Total Deductions</div>
              <div className="fs-5 fw-bold text-danger">₹{parseFloat(String(run.total_deductions || 0)).toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <div className="text-muted small">Total Net Pay</div>
              <div className="fs-5 fw-bold text-success">₹{parseFloat(String(run.total_net || 0)).toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <div className="text-muted small">Avg per Employee</div>
              <div className="fs-5 fw-bold">₹{run.employee_count ? (parseFloat(String(run.total_net || 0)) / run.employee_count).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee breakdown table */}
      <div className="card shadow-sm">
        <div className="card-header bg-dark text-white fw-semibold">Employee Breakdown</div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Employee</th><th className="text-end">Basic</th><th className="text-end">OT</th>
                <th className="text-end">Gross</th><th className="text-end">Deductions</th>
                <th className="text-end">Advance</th><th className="text-end">Net Pay</th><th></th>
              </tr>
            </thead>
            <tbody>
              {run.items.map(item => (
                <>
                  <tr key={item.id} style={{ cursor: "pointer" }} onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                    <td className="fw-semibold">{item.employee_name || `#${item.employee_id}`}</td>
                    <td className="text-end">₹{parseFloat(String(item.basic_pay)).toFixed(2)}</td>
                    <td className="text-end">{parseFloat(String(item.overtime_hours)).toFixed(1)}h / ₹{parseFloat(String(item.overtime_pay)).toFixed(2)}</td>
                    <td className="text-end">₹{parseFloat(String(item.gross_pay)).toFixed(2)}</td>
                    <td className="text-end text-danger">₹{parseFloat(String(item.total_deductions)).toFixed(2)}</td>
                    <td className="text-end text-warning">{parseFloat(String(item.advance_deduction)) > 0 ? `₹${parseFloat(String(item.advance_deduction)).toFixed(2)}` : "—"}</td>
                    <td className="text-end fw-bold text-success">₹{parseFloat(String(item.net_pay)).toFixed(2)}</td>
                    <td className="text-center">{expanded === item.id ? "▼" : "▶"}</td>
                  </tr>
                  {expanded === item.id && (
                    <tr key={`${item.id}-detail`}>
                      <td colSpan={8} className="bg-light">
                        <div className="row p-2">
                          <div className="col-md-4">
                            <strong>Days Worked:</strong> {item.days_worked}/26
                          </div>
                          <div className="col-md-4">
                            <strong className="text-success">Earnings:</strong>
                            {Object.entries(item.earnings_breakdown).length > 0 ? (
                              <ul className="list-unstyled mb-0 small">
                                {Object.entries(item.earnings_breakdown).map(([k, v]) => (
                                  <li key={k}>{k}: ₹{parseFloat(String(v)).toFixed(2)}</li>
                                ))}
                              </ul>
                            ) : <span className="text-muted small"> None</span>}
                          </div>
                          <div className="col-md-4">
                            <strong className="text-danger">Deductions:</strong>
                            <ul className="list-unstyled mb-0 small">
                              {Object.entries(item.deductions_breakdown).map(([k, v]) => (
                                <li key={k}>{k}: ₹{parseFloat(String(v)).toFixed(2)}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
