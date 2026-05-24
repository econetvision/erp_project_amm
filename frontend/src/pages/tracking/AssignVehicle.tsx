import { useEffect, useState } from "react";
import { listVehicles, listAssignments, assignVehicle, releaseVehicle } from "../../api/vehicleApi";
import { getAllEmployees } from "../../api/employeeApi";
import AlertMessage from "../../components/AlertMessage";
import ConfirmModal from "../../components/ConfirmModal";
import type { Vehicle, VehicleAssignment } from "../../types/vehicle";
import type { Employee } from "../../types/employee";

export default function AssignVehicle() {
  const [vehicles,    setVehicles]    = useState<Vehicle[]>([]);
  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);
  const [alert,       setAlert]       = useState<{ type: string; message: string } | null>(null);
  const [releasing,   setReleasing]   = useState<VehicleAssignment | null>(null);
  const [form, setForm] = useState({ vehicle_id: "", employee_id: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [v, e, a] = await Promise.all([listVehicles(), getAllEmployees({ all: true }), listAssignments(true)]);
      setVehicles(v.data);
      setEmployees(e.data.items);
      setAssignments(a.data);
    } catch (err: any) {
      setAlert({ type: "danger", message: err.message });
    }
  }

  useEffect(() => { load(); }, []);

  const available = vehicles.filter(v => v.status === "available");

  // Employees without an active assignment
  const assignedEmpIds = new Set(assignments.map(a => a.employee_id));
  const freeEmployees  = employees.filter(e => !assignedEmpIds.has(e.id));

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await assignVehicle({
        vehicle_id:  parseInt(form.vehicle_id),
        employee_id: parseInt(form.employee_id),
        notes:       form.notes || null,
      });
      setForm({ vehicle_id: "", employee_id: "", notes: "" });
      setAlert({ type: "success", message: "Vehicle assigned successfully." });
      load();
    } catch (err: any) {
      setAlert({ type: "danger", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleRelease() {
    try {
      await releaseVehicle(releasing!.id);
      setAlert({ type: "success", message: `Vehicle ${releasing!.reg_number} released.` });
      setReleasing(null);
      load();
    } catch (err: any) {
      setAlert({ type: "danger", message: err.message });
      setReleasing(null);
    }
  }

  return (
    <div className="container py-4">
      <h4 className="mb-3">Vehicle Assignments</h4>
      <AlertMessage alert={alert} onClose={() => setAlert(null)} />

      {/* Assign form */}
      <div className="card mb-4">
        <div className="card-header fw-semibold">Assign Vehicle to Employee</div>
        <div className="card-body">
          <form onSubmit={handleAssign} className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Vehicle</label>
              <select className="form-select" value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))} required>
                <option value="">— select vehicle —</option>
                {available.map(v => (
                  <option key={v.id} value={v.id}>{v.reg_number} ({v.type})</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Employee</label>
              <select className="form-select" value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} required>
                <option value="">— select employee —</option>
                {freeEmployees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Notes</label>
              <input className="form-control" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="col-12">
              <button className="btn btn-primary btn-sm" type="submit" disabled={saving || !form.vehicle_id || !form.employee_id}>
                {saving ? "Assigning…" : "Assign"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Active assignments table */}
      <h5>Active Assignments</h5>
      <div className="table-responsive">
        <table className="table table-hover table-bordered align-middle">
          <thead className="table-dark">
            <tr><th>Vehicle</th><th>Employee</th><th>Assigned At</th><th>Notes</th><th>Action</th></tr>
          </thead>
          <tbody>
            {assignments.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted">No active assignments.</td></tr>
            )}
            {assignments.map(a => (
              <tr key={a.id}>
                <td className="fw-semibold">{a.reg_number}</td>
                <td>{a.employee_name}</td>
                <td>{new Date(a.assigned_at).toLocaleString()}</td>
                <td>{a.notes || "—"}</td>
                <td>
                  <button className="btn btn-sm btn-outline-warning" onClick={() => setReleasing(a)}>
                    Release
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        show={!!releasing}
        title="Release Vehicle"
        message={`Release ${releasing?.reg_number} from ${releasing?.employee_name}?`}
        onConfirm={handleRelease}
        onCancel={() => setReleasing(null)}
      />
    </div>
  );
}
