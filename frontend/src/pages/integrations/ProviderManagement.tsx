import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import AlertMessage from "../../components/AlertMessage";
import {
  getProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  getGlobalDefaults,
  upsertGlobalDefault,
  deleteGlobalDefault,
  testConnection,
} from "../../api/integrationApi";
import type {
  IntegrationProvider,
  IntegrationProviderCreate,
  GlobalDefault,
  IntegrationCategory,
} from "../../types/integration";

const CATEGORIES: { value: IntegrationCategory; label: string; icon: string }[] = [
  { value: "sms",          label: "SMS",           icon: "💬" },
  { value: "email",        label: "Email",         icon: "📧" },
  { value: "maps",         label: "Maps",          icon: "🗺️" },
  { value: "kyc",          label: "KYC",           icon: "🪪" },
  { value: "bank",         label: "Bank",          icon: "🏦" },
  { value: "notification", label: "Notifications", icon: "🔔" },
  { value: "otp",          label: "OTP",           icon: "🔐" },
  { value: "geolocation",  label: "Geolocation",   icon: "📍" },
];

const HEALTH_BADGE: Record<string, string> = {
  healthy: "success", degraded: "warning", down: "danger", unknown: "secondary",
};

const EMPTY_PROVIDER: IntegrationProviderCreate = {
  category: "sms",
  code: "",
  name: "",
  description: "",
  is_active: true,
  version: "1.0",
};

export default function ProviderManagement() {
  const { auth } = useAuth();
  const isMaster = auth?.role === "master";

  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [defaults, setDefaults] = useState<GlobalDefault[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ type: "", message: "" });

  // Forms
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<IntegrationProvider | null>(null);
  const [form, setForm] = useState<IntegrationProviderCreate>({ ...EMPTY_PROVIDER });

  // Global default editor
  const [showDefaultEditor, setShowDefaultEditor] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState<IntegrationCategory>("sms");
  const [defaultProviderId, setDefaultProviderId] = useState<number | "">("");
  const [defaultFallbackId, setDefaultFallbackId] = useState<number | "">("");
  const [defaultCredentials, setDefaultCredentials] = useState<Record<string, string>>({});
  const [defaultEnabled, setDefaultEnabled] = useState(true);

  // Testing
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [pRes, dRes] = await Promise.all([
        getProviders(),
        isMaster ? getGlobalDefaults() : Promise.resolve({ data: [] }),
      ]);
      setProviders(pRes.data);
      if (dRes) setDefaults((dRes as any).data || []);
    } catch {
      setAlert({ type: "danger", message: "Failed to load providers" });
    } finally {
      setLoading(false);
    }
  }, [isMaster]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editTarget) {
        await updateProvider(editTarget.id, {
          name: form.name,
          description: form.description,
          is_active: form.is_active,
          version: form.version,
        });
        setAlert({ type: "success", message: "Provider updated" });
      } else {
        await createProvider(form);
        setAlert({ type: "success", message: "Provider created" });
      }
      setShowForm(false);
      setEditTarget(null);
      setForm({ ...EMPTY_PROVIDER });
      load();
    } catch (err: any) {
      setAlert({ type: "danger", message: err.response?.data?.detail || "Save failed" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this provider? All company integrations using it will also be removed.")) return;
    try {
      await deleteProvider(id);
      setAlert({ type: "success", message: "Provider deleted" });
      load();
    } catch (err: any) {
      setAlert({ type: "danger", message: err.response?.data?.detail || "Delete failed" });
    }
  };

  const handleTest = async (providerId: number) => {
    setTesting(providerId);
    setTestResult(null);
    try {
      const res = await testConnection(providerId);
      setTestResult(res.data);
    } catch {
      setTestResult({ success: false, message: "Connection test failed" });
    } finally {
      setTesting(null);
    }
  };

  const handleSaveDefault = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsertGlobalDefault({
        category: defaultCategory,
        provider_id: defaultProviderId || undefined,
        fallback_provider_id: defaultFallbackId || undefined,
        credentials: Object.keys(defaultCredentials).length > 0 ? defaultCredentials : undefined,
        is_enabled: defaultEnabled,
      });
      setAlert({ type: "success", message: `Global default for ${defaultCategory} saved` });
      setShowDefaultEditor(false);
      setDefaultCredentials({});
      load();
    } catch (err: any) {
      setAlert({ type: "danger", message: err.response?.data?.detail || "Save failed" });
    }
  };

  const openDefaultEditor = (cat: IntegrationCategory) => {
    const existing = defaults.find(d => d.category === cat);
    setDefaultCategory(cat);
    setDefaultProviderId(existing?.provider_id || "");
    setDefaultFallbackId(existing?.fallback_provider_id || "");
    setDefaultEnabled(existing?.is_enabled ?? true);
    setDefaultCredentials({});
    setShowDefaultEditor(true);
  };

  const filteredProviders = filter
    ? providers.filter(p => p.category === filter)
    : providers;

  const grouped = CATEGORIES.map(c => ({
    ...c,
    providers: filteredProviders.filter(p => p.category === c.value),
    globalDefault: defaults.find(d => d.category === c.value),
  })).filter(g => !filter || g.value === filter);

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-0 fw-bold">⚙️ Provider Management</h4>
          <small className="text-muted">Configure provider catalogue & global defaults</small>
        </div>
        <div className="d-flex gap-2">
          <select className="form-select form-select-sm" style={{ width: 160 }}
            value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
          </select>
          {isMaster && (
            <button className="btn btn-sm btn-primary" onClick={() => { setEditTarget(null); setForm({ ...EMPTY_PROVIDER }); setShowForm(true); }}>
              + Add Provider
            </button>
          )}
        </div>
      </div>

      <AlertMessage type={alert.type as any} message={alert.message} onClose={() => setAlert({ type: "", message: "" })} />

      {/* Test result toast */}
      {testResult && (
        <div className={`alert alert-${testResult.success ? "success" : "danger"} alert-dismissible`}>
          <strong>{testResult.success ? "✓ Connected" : "✗ Failed"}</strong>: {testResult.message}
          <button className="btn-close" onClick={() => setTestResult(null)} />
        </div>
      )}

      {/* ── Provider Form (Add/Edit) ─────────────────────────────── */}
      {showForm && isMaster && (
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-primary text-white fw-semibold d-flex justify-content-between">
            <span>{editTarget ? "Edit Provider" : "Add Provider"}</span>
            <button className="btn btn-sm btn-outline-light" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <div className="card-body">
            <form onSubmit={handleSave}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Category</label>
                  <select className="form-select" value={form.category} disabled={!!editTarget}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as IntegrationCategory }))}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Code</label>
                  <input className="form-control" value={form.code} required disabled={!!editTarget}
                    placeholder="e.g. twilio_sms"
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Name</label>
                  <input className="form-control" value={form.name} required
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="col-md-8">
                  <label className="form-label fw-semibold">Description</label>
                  <input className="form-control" value={form.description || ""}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="col-md-2">
                  <label className="form-label fw-semibold">Version</label>
                  <input className="form-control" value={form.version || ""}
                    onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" checked={form.is_active ?? true}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} id="provActive" />
                    <label className="form-check-label" htmlFor="provActive">Active</label>
                  </div>
                </div>
              </div>
              <div className="mt-3 text-end">
                <button type="submit" className="btn btn-success">{editTarget ? "Update" : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Global Default Editor ────────────────────────────────── */}
      {showDefaultEditor && isMaster && (
        <div className="card shadow-sm mb-4 border-warning">
          <div className="card-header bg-warning fw-semibold d-flex justify-content-between">
            <span>🌐 Global Default — {CATEGORIES.find(c => c.value === defaultCategory)?.label}</span>
            <button className="btn btn-sm btn-outline-dark" onClick={() => setShowDefaultEditor(false)}>✕</button>
          </div>
          <div className="card-body">
            <form onSubmit={handleSaveDefault}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Primary Provider</label>
                  <select className="form-select" value={defaultProviderId}
                    onChange={e => setDefaultProviderId(e.target.value ? parseInt(e.target.value) : "")}>
                    <option value="">— None —</option>
                    {providers.filter(p => p.category === defaultCategory).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Fallback Provider</label>
                  <select className="form-select" value={defaultFallbackId}
                    onChange={e => setDefaultFallbackId(e.target.value ? parseInt(e.target.value) : "")}>
                    <option value="">— None —</option>
                    {providers.filter(p => p.category === defaultCategory).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" checked={defaultEnabled}
                      onChange={e => setDefaultEnabled(e.target.checked)} id="gdEnabled" />
                    <label className="form-check-label" htmlFor="gdEnabled">Enabled</label>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-muted mb-2"><small>Enter credentials (key=value). Values are encrypted before storage.</small></p>
                <div className="row g-2">
                  {["key_1", "key_2", "key_3"].map((k, i) => (
                    <div className="col-md-4" key={i}>
                      <div className="input-group input-group-sm">
                        <input className="form-control" placeholder={`Key ${i + 1}`}
                          value={Object.keys(defaultCredentials)[i] || ""}
                          onChange={e => {
                            const entries = Object.entries(defaultCredentials);
                            const oldKey = entries[i]?.[0];
                            const val = entries[i]?.[1] || "";
                            const newCreds = { ...defaultCredentials };
                            if (oldKey) delete newCreds[oldKey];
                            if (e.target.value) newCreds[e.target.value] = val;
                            setDefaultCredentials(newCreds);
                          }} />
                        <input className="form-control" placeholder="Value" type="password"
                          value={Object.values(defaultCredentials)[i] || ""}
                          onChange={e => {
                            const key = Object.keys(defaultCredentials)[i];
                            if (key) setDefaultCredentials(c => ({ ...c, [key]: e.target.value }));
                          }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 text-end">
                <button type="submit" className="btn btn-warning">Save Default</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Category sections ────────────────────────────────────── */}
      {grouped.map(g => (
        <div key={g.value} className="card shadow-sm mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span className="fw-semibold">{g.icon} {g.label}</span>
            <div className="d-flex gap-2 align-items-center">
              {g.globalDefault && (
                <small className="text-muted">
                  Default: <strong>{g.globalDefault.provider_name || "None"}</strong>
                  {g.globalDefault.fallback_provider_name && <> | Fallback: <strong>{g.globalDefault.fallback_provider_name}</strong></>}
                </small>
              )}
              {isMaster && (
                <button className="btn btn-sm btn-outline-warning" onClick={() => openDefaultEditor(g.value)}>
                  🌐 Set Default
                </button>
              )}
            </div>
          </div>
          <div className="card-body p-0">
            {g.providers.length === 0 ? (
              <p className="text-muted text-center py-3 mb-0">No providers registered for {g.label}</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr><th>Provider</th><th>Code</th><th>Version</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {g.providers.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div className="fw-semibold">{p.name}</div>
                          {p.description && <small className="text-muted">{p.description}</small>}
                        </td>
                        <td><code>{p.code}</code></td>
                        <td>{p.version || "—"}</td>
                        <td>
                          <span className={`badge bg-${p.is_active ? "success" : "secondary"}`}>
                            {p.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-info" disabled={testing === p.id}
                              onClick={() => handleTest(p.id)}>
                              {testing === p.id ? "…" : "🔗 Test"}
                            </button>
                            {isMaster && (
                              <>
                                <button className="btn btn-outline-warning"
                                  onClick={() => {
                                    setEditTarget(p);
                                    setForm({ category: p.category, code: p.code, name: p.name, description: p.description || "", is_active: p.is_active, version: p.version || "1.0" });
                                    setShowForm(true);
                                  }}>
                                  ✏️
                                </button>
                                <button className="btn btn-outline-danger" onClick={() => handleDelete(p.id)}>🗑️</button>
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
        </div>
      ))}
    </div>
  );
}
