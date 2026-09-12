import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getSubscriptions, createSubscription } from "../../api/subscriptionApi";
import { getCompanies } from "../../api/companyApi";
import AlertMessage from "../../components/AlertMessage";
import type { Subscription, SubscriptionCreate } from "../../types/subscription";
import type { Company } from "../../types/company";

const EMPTY: SubscriptionCreate = {
  company_id: 0, plan: "basic", status: "active", billing_cycle: "yearly",
  starts_at: null, ends_at: null, unit_price: "0", tax_rate: "18", notes: "", initial_licenses: 1,
};

export function statusBadge(status: string): string {
  return ({ active: "success", trial: "info", past_due: "warning", suspended: "danger", cancelled: "secondary" } as Record<string, string>)[status] || "secondary";
}

export function seatsLabel(used: number, cap: number | null): string {
  return cap === null ? `${used} / ∞` : `${used} / ${cap}`;
}

function fmtDate(v: string | null): string {
  return v ? new Date(v).toLocaleDateString() : "—";
}

export default function SubscriptionList() {
  const navigate = useNavigate();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SubscriptionCreate>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([getSubscriptions(), getCompanies({ all: true })]);
      setSubs(s.data);
      setCompanies(c.data.items);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const licensedIds = new Set(subs.map(s => s.company_id));
  const unlicensed = companies.filter(c => !licensedIds.has(c.id));

  function set<K extends keyof SubscriptionCreate>(field: K, value: SubscriptionCreate[K]) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.company_id) { setAlert({ type: "warning", message: "Select a company." }); return; }
    setLoading(true);
    try {
      const r = await createSubscription({ ...form, starts_at: form.starts_at || null, ends_at: form.ends_at || null });
      setAlert({ type: "success", message: `Subscription created for ${r.data.company_name}.` });
      setForm(EMPTY);
      setShowForm(false);
      navigate(`/master/subscriptions/${r.data.id}`);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Subscriptions</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(s => !s)}>
          {showForm ? "Cancel" : "+ New subscription"}
        </button>
      </div>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {showForm && (
        <div className="card mb-4">
          <div className="card-body">
            <form className="row g-3" onSubmit={handleCreate}>
              <div className="col-md-4">
                <label className="form-label">Company</label>
                <select className="form-select" value={form.company_id} onChange={e => set("company_id", Number(e.target.value))} required>
                  <option value={0}>Select…</option>
                  {unlicensed.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Plan</label>
                <select className="form-select" value={form.plan} onChange={e => set("plan", e.target.value as SubscriptionCreate["plan"])}>
                  <option value="basic">Basic</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e => set("status", e.target.value as SubscriptionCreate["status"])}>
                  <option value="trial">Trial</option><option value="active">Active</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Billing</label>
                <select className="form-select" value={form.billing_cycle} onChange={e => set("billing_cycle", e.target.value as SubscriptionCreate["billing_cycle"])}>
                  <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Licences (26 seats each)</label>
                <input type="number" min={0} max={100} className="form-control" value={form.initial_licenses}
                  onChange={e => set("initial_licenses", Number(e.target.value))} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Price per licence / cycle</label>
                <input type="number" min={0} step="0.01" className="form-control" value={form.unit_price}
                  onChange={e => set("unit_price", e.target.value)} />
              </div>
              <div className="col-md-2">
                <label className="form-label">GST %</label>
                <input type="number" min={0} max={100} step="0.01" className="form-control" value={form.tax_rate}
                  onChange={e => set("tax_rate", e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Starts</label>
                <input type="date" className="form-control" value={form.starts_at || ""} onChange={e => set("starts_at", e.target.value || null)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Ends (blank = perpetual)</label>
                <input type="date" className="form-control" value={form.ends_at || ""} onChange={e => set("ends_at", e.target.value || null)} />
              </div>
              <div className="col-12">
                <label className="form-label">Notes</label>
                <input className="form-control" value={form.notes || ""} onChange={e => set("notes", e.target.value)} />
              </div>
              <div className="col-12">
                <button className="btn btn-success" disabled={loading}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Company</th><th>Plan</th><th>Status</th><th>Licences</th>
                <th>Seats</th><th>Admins</th><th>Renews / ends</th><th>Validity</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-muted py-4">{loading ? "Loading…" : "No subscriptions yet."}</td></tr>
              ) : subs.map(s => (
                <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/master/subscriptions/${s.id}`)}>
                  <td className="fw-semibold">{s.company_name}</td>
                  <td className="text-capitalize">{s.plan}</td>
                  <td><span className={`badge bg-${statusBadge(s.status)}`}>{s.status}</span></td>
                  <td>{s.active_licenses}</td>
                  <td>{seatsLabel(s.seats_used, s.capacity)}</td>
                  <td>{s.admins_used} / {s.admin_cap}</td>
                  <td>{fmtDate(s.ends_at)}</td>
                  <td>{s.is_valid ? <span className="text-success">OK</span> : <span className="text-danger">{s.reason}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {unlicensed.length > 0 && (
        <p className="text-muted small mt-2">{unlicensed.length} compan{unlicensed.length === 1 ? "y has" : "ies have"} no subscription.</p>
      )}
    </div>
  );
}
