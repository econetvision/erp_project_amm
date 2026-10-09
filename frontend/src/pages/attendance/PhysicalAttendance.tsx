import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getAttendanceSupervisors, setSupervisorSite } from "../../api/physicalAttendanceApi";
import type { AttendanceSupervisor } from "../../api/physicalAttendanceApi";
import { getAllLocations } from "../../api/locationApi";
import type { WorkLocation } from "../../api/locationApi";
import { createUser } from "../../api/authApi";
import AlertMessage from "../../components/AlertMessage";
import { useAuth } from "../../context/AuthContext";

type Dialog =
  | { mode: "assign"; supervisor: AttendanceSupervisor }
  | { mode: "disable"; supervisor: AttendanceSupervisor }
  | { mode: "add" }
  | null;

const EMPTY_FORM = { display_name: "", username: "", password: "" };

function label(s: AttendanceSupervisor): string {
  return s.name || s.display_name || s.username;
}

export default function PhysicalAttendance() {
  const { auth } = useAuth();
  const [supervisors, setSupervisors] = useState<AttendanceSupervisor[]>([]);
  const [locations, setLocations]     = useState<WorkLocation[]>([]);
  const [alert, setAlert]             = useState<{ type: string; message: string } | null>(null);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [dialog, setDialog]           = useState<Dialog>(null);
  const [siteId, setSiteId]           = useState("");
  const [form, setForm]               = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sup, loc] = await Promise.all([
        getAttendanceSupervisors(),
        getAllLocations({ active_only: true }),
      ]);
      setSupervisors(sup.data);
      setLocations(loc.data);
    } catch (err: any) {
      setAlert({ type: "danger", message: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function open(next: Dialog) {
    setSiteId(next && next.mode === "assign" && next.supervisor.site_id ? String(next.supervisor.site_id) : "");
    setForm(EMPTY_FORM);
    setDialog(next);
  }

  async function saveSite(e: FormEvent) {
    e.preventDefault();
    if (!dialog || dialog.mode !== "assign" || !siteId) return;
    setSaving(true);
    try {
      await setSupervisorSite(dialog.supervisor.id, Number(siteId));
      setAlert({ type: "success", message: `Physical attendance enabled for ${label(dialog.supervisor)}.` });
      setDialog(null);
      await load();
    } catch (err: any) {
      setAlert({ type: "danger", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function disable() {
    if (!dialog || dialog.mode !== "disable") return;
    setSaving(true);
    try {
      await setSupervisorSite(dialog.supervisor.id, null);
      setAlert({ type: "success", message: `Physical attendance disabled for ${label(dialog.supervisor)}.` });
      setDialog(null);
      await load();
    } catch (err: any) {
      setAlert({ type: "danger", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function addSupervisor(e: FormEvent) {
    e.preventDefault();
    if (!siteId) return;
    setSaving(true);
    try {
      const { data: created } = await createUser({
        username: form.username.trim(),
        password: form.password,
        role: "supervisor",
        display_name: form.display_name.trim() || undefined,
      });
      try {
        await setSupervisorSite(created.id, Number(siteId));
        setAlert({
          type: "success",
          message: `Supervisor ${created.username} added. They must sign in once on this web portal to set their own password before using the attendance app.`,
        });
      } catch (err: any) {
        // The account exists; only the site assignment failed. Say so, so the
        // admin retries with "Enable" instead of creating a duplicate account.
        setAlert({
          type: "warning",
          message: `Supervisor ${created.username} was created, but the site could not be assigned: ${err.message} Use Enable on their row to try again.`,
        });
      }
      setDialog(null);
      await load();
    } catch (err: any) {
      setAlert({ type: "danger", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  const enabledCount = supervisors.filter(s => s.site_id !== null).length;
  const siteSelect = (
    <div className="mb-3">
      <label className="form-label" htmlFor="paSite">Site</label>
      <select id="paSite" className="form-select" required value={siteId} onChange={e => setSiteId(e.target.value)}>
        <option value="">Select a site…</option>
        {locations.map(l => (
          <option key={l.id} value={l.id}>
            {l.location_name}{l.city ? ` — ${l.city}` : ""} ({l.allowed_radius_m} m)
          </option>
        ))}
      </select>
      <div className="form-text">Attendance can be marked only while the supervisor's phone is inside this site's radius.</div>
    </div>
  );

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Physical Attendance</h4>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          {/* Master has no company of its own, so new accounts are created from Users. */}
          {auth?.role === "admin" && (
            <button className="btn btn-primary btn-sm" onClick={() => open({ mode: "add" })}>Add supervisor</button>
          )}
        </div>
      </div>
      <AlertMessage alert={alert} onClose={() => setAlert(null)} />

      <p className="text-muted small">
        For sites where workers do not carry smartphones. An enabled supervisor uses the ERP Attendance
        app to photograph each worker; the worker is recognised by face and clocked in or out. Each
        supervisor covers one site, and scans are accepted only at that site. Workers must have a face
        registered on their employee record. {enabledCount} of {supervisors.length} supervisors enabled.
      </p>

      {locations.length === 0 && !loading && (
        <div className="alert alert-warning py-2">
          There are no active work locations. Add one under Work Locations before enabling a supervisor.
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Supervisor</th>
                <th>Username</th>
                <th>Site</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {supervisors.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted py-4">
                  {loading ? "Loading…" : "No supervisors yet."}
                </td></tr>
              )}
              {supervisors.map(s => (
                <tr key={s.id}>
                  <td>
                    {label(s)}
                    {!s.is_active && <span className="badge bg-secondary ms-2">Inactive account</span>}
                    {s.must_change_password && (
                      <div className="small text-muted">Has not yet set a password on the web portal</div>
                    )}
                  </td>
                  <td>{s.username}</td>
                  <td>{s.site_name ?? "—"}</td>
                  <td>
                    {s.site_id !== null
                      ? <span className="badge bg-success">Enabled</span>
                      : <span className="badge bg-secondary">Disabled</span>}
                  </td>
                  <td className="text-end">
                    <button className="btn btn-outline-primary btn-sm me-2" onClick={() => open({ mode: "assign", supervisor: s })}>
                      {s.site_id !== null ? "Change site" : "Enable"}
                    </button>
                    {s.site_id !== null && (
                      <button className="btn btn-outline-danger btn-sm" onClick={() => open({ mode: "disable", supervisor: s })}>
                        Disable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialog && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                {dialog.mode === "assign" && (
                  <form onSubmit={saveSite}>
                    <div className="modal-header">
                      <h5 className="modal-title">
                        {dialog.supervisor.site_id !== null ? "Change site" : "Enable physical attendance"}
                      </h5>
                      <button type="button" className="btn-close" onClick={() => setDialog(null)} />
                    </div>
                    <div className="modal-body">
                      <p className="mb-3">Supervisor: <strong>{label(dialog.supervisor)}</strong></p>
                      {siteSelect}
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={saving || !siteId}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </form>
                )}

                {dialog.mode === "disable" && (
                  <>
                    <div className="modal-header">
                      <h5 className="modal-title">Disable physical attendance</h5>
                      <button type="button" className="btn-close" onClick={() => setDialog(null)} />
                    </div>
                    <div className="modal-body">
                      {label(dialog.supervisor)} will no longer be able to mark attendance at{" "}
                      {dialog.supervisor.site_name ?? "their site"} from the attendance app. Attendance
                      already recorded is kept.
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
                      <button type="button" className="btn btn-danger" onClick={disable} disabled={saving}>
                        {saving ? "Disabling…" : "Disable"}
                      </button>
                    </div>
                  </>
                )}

                {dialog.mode === "add" && (
                  <form onSubmit={addSupervisor}>
                    <div className="modal-header">
                      <h5 className="modal-title">Add supervisor</h5>
                      <button type="button" className="btn-close" onClick={() => setDialog(null)} />
                    </div>
                    <div className="modal-body">
                      <div className="mb-3">
                        <label className="form-label" htmlFor="paName">Name</label>
                        <input id="paName" className="form-control" required maxLength={255}
                          value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label" htmlFor="paUsername">Username</label>
                        <input id="paUsername" className="form-control" required maxLength={50} autoComplete="off"
                          value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label" htmlFor="paPassword">Temporary password</label>
                        <input id="paPassword" type="password" className="form-control" required minLength={8}
                          autoComplete="new-password"
                          value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                        <div className="form-text">
                          At least 8 characters. The supervisor sets their own password at first sign-in on this web portal.
                        </div>
                      </div>
                      {siteSelect}
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={saving || !siteId}>
                        {saving ? "Adding…" : "Add supervisor"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
    </div>
  );
}
