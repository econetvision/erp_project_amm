import { useEffect, useState, type FormEvent } from "react";
import { getAdvances, createAdvance, deleteAdvance } from "../../api/payrollApi";
import { getAllEmployees } from "../../api/employeeApi";
import AlertMessage from "../../components/AlertMessage";
import type { Advance } from "../../types/payroll";
import type { Employee } from "../../types/employee";

export default function Advances() {
  const [advances, setAdvances]     = useState<Advance[]>([]);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [alert, setAlert]           = useState({ type: "", message: "" });
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm] = useState({ employee_id: "", amount: "", repayment_months: "1", notes: "" });

  useEffect(() => {
    load();
    getAllEmployees({ all: true }).then(r => setEmployees(r.data.items)).catch(() => {});
  }, []);

  async function load() {
    try { const { data } = await getAdvances(); setAdvances(data); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createAdvance({
        employee_id: parseInt(form.employee_id),
        amount: parseFloat(form.amount),
        disbursed_date: new Date().toISOString().split("T")[0],
        repayment_months: parseInt(form.repayment_months),
        notes: form.notes || null,
      });
      setAlert({ type: "success", message: "Advance created." });
      setForm({ employee_id: "", amount: "", repayment_months: "1", notes: "" });
      setShowForm(false);
      load();
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this advance?")) return;
    try { await deleteAdvance(id); load(); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  function empName(id: number) { return employees.find(e => e.id === id)?.name || `#${id}`; }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="fw-bold mb-0">Salary Advances</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Advance"}
        </button>
      </div>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {showForm && (
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-primary text-white fw-semibold">New Advance</div>
          <div className="card-body">
            <form onSubmit={handleCreate}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Employee *</label>
                  <select className="form-select" value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} required>
                    <option value="">-- Select --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Amount (₹) *</label>
                  <input className="form-control" type="number" step="0.01" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Repayment Months *</label>
                  <input className="form-control" type="number" min="1" max="60" value={form.repayment_months} onChange={e => setForm(f => ({ ...f, repayment_months: e.target.value }))} required />
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  <button className="btn btn-primary w-100" type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Create"}
                  </button>
                </div>
              </div>
              <div className="mt-2">
                <label className="form-label fw-semibold">Notes</label>
                <input className="form-control" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
              </div>
            </form>
          </div>
        </div>
      )}

      {advances.length === 0 ? (
        <div className="text-center text-muted py-5">No advances recorded.</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover shadow-sm">
            <thead className="table-dark">
              <tr><th>Employee</th><th className="text-end">Amount</th><th className="text-end">Monthly</th><th className="text-end">Remaining</th><th>Months</th><th>Status</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              {advances.map(a => (
                <tr key={a.id}>
                  <td className="fw-semibold">{empName(a.employee_id)}</td>
                  <td className="text-end">₹{parseFloat(String(a.amount)).toLocaleString()}</td>
                  <td className="text-end">₹{parseFloat(String(a.monthly_deduction)).toFixed(2)}</td>
                  <td className="text-end fw-bold">{parseFloat(String(a.remaining_balance)) > 0 ? `₹${parseFloat(String(a.remaining_balance)).toLocaleString()}` : "₹0"}</td>
                  <td>{a.repayment_months}</td>
                  <td><span className={`badge bg-${a.status === "active" ? "warning" : "success"}`}>{a.status}</span></td>
                  <td className="small">{a.disbursed_date}</td>
                  <td><button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(a.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
