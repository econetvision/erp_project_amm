import { useEffect, useState } from "react";
import AlertMessage from "../../components/AlertMessage";
import { useAuth } from "../../context/AuthContext";
import { getCompany } from "../../api/companyApi";

const SHIFTS = [
  { key: "SHIFT_A", label: "Shift A", time: "6:30 AM – 2:00 PM", break: "10:30 AM (20 min)" },
  { key: "SHIFT_B", label: "Shift B", time: "9:00 AM – 5:00 PM", break: "1:30 PM (20 min)" },
];

// System defaults — used when the company hasn't overridden them in Company Settings.
const DEFAULTS = { esi_rate: 0.75, pf_rate: 12.0, working_days: 26, overtime_multiplier: 1.5 };

export default function PayrollSettings() {
  const { auth } = useAuth();
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [cfg, setCfg] = useState(DEFAULTS);

  // Load the company's configured payroll rates so this page reflects what
  // admin/master saved in Company Settings (the same values payslips now use).
  useEffect(() => {
    if (!auth?.company_id) return;
    getCompany(auth.company_id)
      .then((res) => setCfg({ ...DEFAULTS, ...(res.data.payroll_config || {}) }))
      .catch(() => {/* keep defaults on failure */});
  }, [auth?.company_id]);

  const DEDUCTIONS = [
    { name: "ESI", rate: `${cfg.esi_rate}%`, basis: "Gross Salary", mandatory: true },
    { name: "PF", rate: `${cfg.pf_rate}%`, basis: "Gross Salary", mandatory: true },
    { name: "Professional Tax", rate: "₹200", basis: "Fixed", mandatory: true },
  ];

  return (
    <div className="row justify-content-center">
      <div className="col-lg-10">
        <div className="d-flex align-items-center gap-3 mb-4">
          <div className="rounded-circle d-flex align-items-center justify-content-center"
            style={{ width: 48, height: 48, background: "linear-gradient(135deg, #0d6efd, #6610f2)", color: "white", fontSize: 22 }}>
            💰
          </div>
          <div>
            <h3 className="fw-bold mb-0">Payroll Settings</h3>
            <small className="text-muted">Configure payroll rules, shift timings, deductions &amp; working days</small>
          </div>
        </div>
        <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

        <div className="row g-4">
          {/* Shift Configuration */}
          <div className="col-md-6">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold" style={{ background: "linear-gradient(135deg, #198754, #20c997)", color: "white" }}>
                <span className="me-2">🕐</span>Shift Configuration
              </div>
              <div className="card-body">
                {SHIFTS.map(s => (
                  <div key={s.key} className="border rounded p-3 mb-2">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <h6 className="mb-0 fw-bold">{s.label}</h6>
                      <span className="badge bg-primary">{s.key}</span>
                    </div>
                    <div className="small text-muted">
                      <div>⏰ Timing: <strong>{s.time}</strong></div>
                      <div>☕ Break: <strong>{s.break}</strong></div>
                    </div>
                  </div>
                ))}
                <p className="text-muted small mt-2 mb-0">
                  <strong>Working Days:</strong> {cfg.working_days} days/month (Sundays off)
                </p>
              </div>
            </div>
          </div>

          {/* Deduction Rules */}
          <div className="col-md-6">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold" style={{ background: "linear-gradient(135deg, #dc3545, #fd7e14)", color: "white" }}>
                <span className="me-2">📊</span>Statutory Deductions
              </div>
              <div className="card-body">
                <table className="table table-sm table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Deduction</th>
                      <th>Rate</th>
                      <th>Basis</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEDUCTIONS.map(d => (
                      <tr key={d.name}>
                        <td className="fw-semibold">{d.name}</td>
                        <td><span className="badge bg-info">{d.rate}</span></td>
                        <td className="small text-muted">{d.basis}</td>
                        <td>
                          {d.mandatory
                            ? <span className="badge bg-success">Mandatory</span>
                            : <span className="badge bg-secondary">Optional</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Payslip Calculation */}
          <div className="col-md-6">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold" style={{ background: "linear-gradient(135deg, #6f42c1, #d63384)", color: "white" }}>
                <span className="me-2">🧮</span>Payslip Calculation Formula
              </div>
              <div className="card-body">
                <div className="border rounded p-3 bg-light mb-3">
                  <div className="small">
                    <div className="mb-2"><strong>Gross Pay</strong> = Daily Rate × Days Worked</div>
                    <div className="mb-2"><strong>Daily Rate</strong> = Hourly Rate × Effective Shift Hours</div>
                    <div className="mb-2"><strong>ESI Deduction</strong> = Gross Pay × {cfg.esi_rate}%</div>
                    <div className="mb-2"><strong>PF Deduction</strong> = Gross Pay × {cfg.pf_rate}%</div>
                    <div><strong>Net Pay</strong> = Gross Pay − ESI − PF − Advances</div>
                  </div>
                </div>
                <div className="alert alert-info mb-0 py-2 small">
                  <strong>Note:</strong> When using salary structures, component-based calculation overrides the formula above.
                </div>
              </div>
            </div>
          </div>

          {/* Pay Period & Rules */}
          <div className="col-md-6">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold" style={{ background: "linear-gradient(135deg, #0d6efd, #0dcaf0)", color: "white" }}>
                <span className="me-2">📅</span>Pay Period & Rules
              </div>
              <div className="card-body">
                <table className="table table-sm table-borderless mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted">Pay Cycle</td>
                      <td className="fw-semibold">Monthly</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Working Days/Month</td>
                      <td className="fw-semibold">{cfg.working_days} days</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Weekend</td>
                      <td className="fw-semibold">Sunday (weekly off)</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Late Threshold</td>
                      <td className="fw-semibold">10 minutes after shift start</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Overtime Threshold</td>
                      <td className="fw-semibold">After shift end time</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Advance Recovery</td>
                      <td className="fw-semibold">Deducted from next payslip</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
