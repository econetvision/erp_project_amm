import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getSubscription, updateSubscription, suspendSubscription, activateSubscription, grantLicenses, revokeLicense,
} from "../../api/subscriptionApi";
import { getAllLocations, type WorkLocation } from "../../api/locationApi";
import AlertMessage from "../../components/AlertMessage";
import { statusBadge, seatsLabel } from "./SubscriptionList";
import type { SubscriptionDetail as Detail, SubscriptionUpdate, License, LicenseGrant } from "../../types/subscription";

function toDateInput(v: string | null | undefined): string {
  return v ? v.slice(0, 10) : "";
}

export default function SubscriptionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const subId = Number(id);
  const [sub, setSub] = useState<Detail | null>(null);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<SubscriptionUpdate>({});
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [grant, setGrant] = useState<LicenseGrant>({ subscription_id: subId, site_id: null, quantity: 1, max_users: 26, max_admins: 1, unlimited: false });
  const [revokeTarget, setRevokeTarget] = useState<License | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await getSubscription(subId);
      setSub(r.data);
      setEdit({
        plan: r.data.plan, status: r.data.status, billing_cycle: r.data.billing_cycle,
        starts_at: toDateInput(r.data.starts_at) || null, ends_at: toDateInput(r.data.ends_at) || null,
        unit_price: r.data.unit_price, currency: r.data.currency, tax_rate: r.data.tax_rate, notes: r.data.notes || "",
      });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }, [subId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getAllLocations({ active_only: true }).then(r => setLocations(r.data)).catch(() => {});
  }, []);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setSaving(true);
    try { await fn(); setAlert({ type: "success", message: ok }); await load(); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setSaving(false); }
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    run(() => updateSubscription(subId, { ...edit, starts_at: edit.starts_at || null, ends_at: edit.ends_at || null }), "Subscription updated.");
  }

  function handleGrant(e: FormEvent) {
    e.preventDefault();
    run(() => grantLicenses({ ...grant, subscription_id: subId, site_id: grant.site_id || null }),
        `${grant.quantity} licence${grant.quantity === 1 ? "" : "s"} granted.`);
  }

  function handleRevoke() {
    if (!revokeTarget) return;
    const target = revokeTarget;
    setRevokeTarget(null);
    run(() => revokeLicense(target.id, revokeReason), `Licence #${target.id} revoked.`);
    setRevokeReason("");
  }

  if (!sub) return <div className="container py-4"><AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />Loading…</div>;

  const pct = sub.capacity ? Math.min(100, Math.round(sub.seats_used / sub.capacity * 100)) : 0;
  const barColor = sub.capacity !== null && sub.seats_used >= sub.capacity ? "danger" : pct >= 80 ? "warning" : "success";

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <button className="btn btn-link btn-sm px-0" onClick={() => navigate("/master/subscriptions")}>← Subscriptions</button>
          <h4 className="mb-0">{sub.company_name} <span className={`badge bg-${statusBadge(sub.status)} ms-2`}>{sub.status}</span></h4>
        </div>
        <div className="d-flex gap-2">
          {sub.status === "suspended"
            ? <button className="btn btn-success btn-sm" disabled={saving} onClick={() => run(() => activateSubscription(subId), "Subscription activated.")}>Activate</button>
            : <button className="btn btn-outline-danger btn-sm" disabled={saving} onClick={() => run(() => suspendSubscription(subId), "Subscription suspended.")}>Suspend</button>}
        </div>
      </div>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      <div className="row g-3 mb-3">
        <div className="col-md-3"><div className="card h-100"><div className="card-body">
          <div className="text-muted small">Seats</div>
          <div className="fs-4 fw-semibold">{seatsLabel(sub.seats_used, sub.capacity)}</div>
          {sub.capacity !== null && <div className="progress" style={{ height: 6 }}><div className={`progress-bar bg-${barColor}`} style={{ width: `${pct}%` }} /></div>}
        </div></div></div>
        <div className="col-md-3"><div className="card h-100"><div className="card-body">
          <div className="text-muted small">Admins</div><div className="fs-4 fw-semibold">{sub.admins_used} / {sub.admin_cap}</div>
        </div></div></div>
        <div className="col-md-3"><div className="card h-100"><div className="card-body">
          <div className="text-muted small">Active licences</div><div className="fs-4 fw-semibold">{sub.active_licenses}</div>
        </div></div></div>
        <div className="col-md-3"><div className="card h-100"><div className="card-body">
          <div className="text-muted small">Validity</div>
          <div className={`fw-semibold ${sub.is_valid ? "text-success" : "text-danger"}`}>{sub.is_valid ? "Valid" : sub.reason}</div>
          {sub.days_to_renewal !== null && <div className="small text-muted">{sub.days_to_renewal} days to renewal</div>}
        </div></div></div>
      </div>

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card"><div className="card-header">Plan &amp; billing</div><div className="card-body">
            <form className="row g-2" onSubmit={handleSave}>
              <div className="col-6"><label className="form-label">Plan</label>
                <select className="form-select" value={edit.plan} onChange={e => setEdit(s => ({ ...s, plan: e.target.value as SubscriptionUpdate["plan"] }))}>
                  <option value="basic">Basic</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
                </select></div>
              <div className="col-6"><label className="form-label">Status</label>
                <select className="form-select" value={edit.status} onChange={e => setEdit(s => ({ ...s, status: e.target.value as SubscriptionUpdate["status"] }))}>
                  {["trial", "active", "past_due", "suspended", "cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div className="col-6"><label className="form-label">Billing cycle</label>
                <select className="form-select" value={edit.billing_cycle} onChange={e => setEdit(s => ({ ...s, billing_cycle: e.target.value as SubscriptionUpdate["billing_cycle"] }))}>
                  <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                </select></div>
              <div className="col-6"><label className="form-label">Currency</label>
                <input className="form-control" maxLength={3} value={edit.currency || ""} onChange={e => setEdit(s => ({ ...s, currency: e.target.value.toUpperCase() }))} /></div>
              <div className="col-6"><label className="form-label">Price / licence / cycle</label>
                <input type="number" min={0} step="0.01" className="form-control" value={edit.unit_price || ""} onChange={e => setEdit(s => ({ ...s, unit_price: e.target.value }))} /></div>
              <div className="col-6"><label className="form-label">GST %</label>
                <input type="number" min={0} max={100} step="0.01" className="form-control" value={edit.tax_rate || ""} onChange={e => setEdit(s => ({ ...s, tax_rate: e.target.value }))} /></div>
              <div className="col-6"><label className="form-label">Starts</label>
                <input type="date" className="form-control" value={edit.starts_at || ""} onChange={e => setEdit(s => ({ ...s, starts_at: e.target.value || null }))} /></div>
              <div className="col-6"><label className="form-label">Ends</label>
                <input type="date" className="form-control" value={edit.ends_at || ""} onChange={e => setEdit(s => ({ ...s, ends_at: e.target.value || null }))} /></div>
              <div className="col-12"><label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} value={edit.notes || ""} onChange={e => setEdit(s => ({ ...s, notes: e.target.value }))} /></div>
              <div className="col-12"><button className="btn btn-primary" disabled={saving}>Save</button></div>
            </form>
          </div></div>
        </div>

        <div className="col-lg-7">
          <div className="card mb-3"><div className="card-header">Grant licences</div><div className="card-body">
            <form className="row g-2 align-items-end" onSubmit={handleGrant}>
              <div className="col-md-4"><label className="form-label">Site</label>
                <select className="form-select" value={grant.site_id ?? ""} onChange={e => setGrant(g => ({ ...g, site_id: e.target.value ? Number(e.target.value) : null }))}>
                  <option value="">Company-wide</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                </select></div>
              <div className="col-md-2"><label className="form-label">Qty</label>
                <input type="number" min={1} max={100} className="form-control" value={grant.quantity} onChange={e => setGrant(g => ({ ...g, quantity: Number(e.target.value) }))} /></div>
              <div className="col-md-2"><label className="form-label">Seats</label>
                <input type="number" min={1} className="form-control" value={grant.max_users ?? 26} disabled={grant.unlimited} onChange={e => setGrant(g => ({ ...g, max_users: Number(e.target.value) }))} /></div>
              <div className="col-md-2"><label className="form-label">Admins</label>
                <input type="number" min={0} className="form-control" value={grant.max_admins} onChange={e => setGrant(g => ({ ...g, max_admins: Number(e.target.value) }))} /></div>
              <div className="col-md-2">
                <div className="form-check mb-2">
                  <input id="unl" type="checkbox" className="form-check-input" checked={grant.unlimited} onChange={e => setGrant(g => ({ ...g, unlimited: e.target.checked }))} />
                  <label htmlFor="unl" className="form-check-label">Unlimited</label>
                </div>
                <button className="btn btn-success w-100" disabled={saving}>Grant</button>
              </div>
            </form>
          </div></div>

          <div className="card"><div className="card-header">Licences</div>
            <div className="table-responsive"><table className="table table-sm align-middle mb-0">
              <thead><tr><th>#</th><th>Site</th><th>Seats</th><th>Admins</th><th>Status</th><th>Granted</th><th>Revoked</th><th></th></tr></thead>
              <tbody>
                {sub.licenses.length === 0 ? <tr><td colSpan={8} className="text-center text-muted py-3">No licences.</td></tr>
                : sub.licenses.map(l => (
                  <tr key={l.id} className={l.status === "revoked" ? "text-muted" : ""}>
                    <td>{l.id}</td>
                    <td>{l.site_name || "Company-wide"}</td>
                    <td>{l.max_users === null ? "∞" : l.max_users}</td>
                    <td>{l.max_admins}</td>
                    <td><span className={`badge bg-${l.status === "active" ? "success" : "secondary"}`}>{l.status}</span></td>
                    <td>{l.granted_at ? new Date(l.granted_at).toLocaleDateString() : "—"}</td>
                    <td>{l.revoked_at ? <span title={l.revoke_reason || ""}>{new Date(l.revoked_at).toLocaleDateString()}{l.revoke_reason ? ` — ${l.revoke_reason}` : ""}</span> : "—"}</td>
                    <td className="text-end">{l.status === "active" && (
                      <button className="btn btn-outline-danger btn-sm" disabled={saving} onClick={() => setRevokeTarget(l)}>Revoke</button>)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      </div>

      {revokeTarget && (
        <div className="card mt-3 border-danger"><div className="card-body">
          <div className="mb-2">Revoke licence #{revokeTarget.id} ({revokeTarget.site_name || "Company-wide"})? Existing users keep working; new users are blocked while over capacity.</div>
          <input className="form-control mb-2" placeholder="Reason (optional)" value={revokeReason} onChange={e => setRevokeReason(e.target.value)} />
          <button className="btn btn-danger me-2" onClick={handleRevoke}>Revoke</button>
          <button className="btn btn-secondary" onClick={() => setRevokeTarget(null)}>Cancel</button>
        </div></div>
      )}
    </div>
  );
}
