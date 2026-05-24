import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPayrollRuns, createPayrollRun, finalizeRun, cancelRun } from "../../api/payrollApi";
import AlertMessage from "../../components/AlertMessage";
import type { PayrollRun as PR } from "../../types/payroll";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const STATUS_BADGE: Record<string, string> = { draft: "warning", processing: "info", completed: "success", cancelled: "secondary" };

export default function PayrollRunPage() {
  const navigate = useNavigate();
  const [runs, setRuns]       = useState<PR[]>([]);
  const [alert, setAlert]     = useState({ type: "", message: "" });
  const [month, setMonth]     = useState(new Date().getMonth() + 1);
  const [year, setYear]       = useState(new Date().getFullYear());
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try { const { data } = await getPayrollRuns(); setRuns(data); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const { data } = await createPayrollRun({ month, year });
      setAlert({ type: "success", message: `Payroll run created for ${MONTHS[month-1]} ${year}. ${data.employee_count} employees processed.` });
      load();
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setCreating(false); }
  }

  async function handleFinalize(id: number) {
    if (!window.confirm("Finalize this payroll run? This will deduct advances and cannot be undone.")) return;
    try {
      await finalizeRun(id);
      setAlert({ type: "success", message: "Payroll finalized." });
      load();
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  async function handleCancel(id: number) {
    if (!window.confirm("Delete this draft payroll run?")) return;
    try { await cancelRun(id); load(); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  return (
    <div>
      <h3 className="fw-bold mb-3">Payroll Runs</h3>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {/* Create new run */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-semibold">Month</label>
              <select className="form-select" value={month} onChange={e => setMonth(+e.target.value)}>
                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label fw-semibold">Year</label>
              <input className="form-control" type="number" value={year} onChange={e => setYear(+e.target.value)} min={2020} />
            </div>
            <div className="col-md-3">
              <button className="btn btn-success w-100" onClick={handleCreate} disabled={creating}>
                {creating ? "Processing…" : "🚀 Create Payroll Run"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Run history */}
      {runs.length === 0 ? (
        <div className="text-center text-muted py-5">No payroll runs yet. Create one above.</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover shadow-sm">
            <thead className="table-dark">
              <tr>
                <th>Period</th><th>Status</th><th>Employees</th>
                <th className="text-end">Gross</th><th className="text-end">Deductions</th>
                <th className="text-end">Net</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.id}>
                  <td className="fw-semibold">{MONTHS[r.month-1]} {r.year}</td>
                  <td><span className={`badge bg-${STATUS_BADGE[r.status]}`}>{r.status}</span></td>
                  <td>{r.employee_count ?? "—"}</td>
                  <td className="text-end">{r.total_gross ? `₹${parseFloat(String(r.total_gross)).toLocaleString()}` : "—"}</td>
                  <td className="text-end text-danger">{r.total_deductions ? `₹${parseFloat(String(r.total_deductions)).toLocaleString()}` : "—"}</td>
                  <td className="text-end fw-bold text-success">{r.total_net ? `₹${parseFloat(String(r.total_net)).toLocaleString()}` : "—"}</td>
                  <td className="small text-muted">{new Date(r.started_at).toLocaleDateString()}</td>
                  <td>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => navigate(`/payroll/runs/${r.id}`)}>View</button>
                      {r.status === "draft" && (
                        <>
                          <button className="btn btn-sm btn-success" onClick={() => handleFinalize(r.id)}>Finalize</button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleCancel(r.id)}>Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
