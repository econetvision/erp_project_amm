import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AlertMessage from "../../components/AlertMessage";
import {
  getProviders,
  getCompanyIntegrations,
  createCompanyIntegration,
  updateCompanyIntegration,
  deleteCompanyIntegration,
  getCompanyIntegrationCredentials,
  testConnection,
} from "../../api/integrationApi";
import CredentialFields from "../../components/integrations/CredentialFields";
import { getCompanies } from "../../api/companyApi";
import type {
  IntegrationProvider,
  CompanyIntegration,
  CompanyIntegrationCreate,
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

export default function CompanyIntegrations() {
  const { auth } = useAuth();
  const params = useParams<{ companyId?: string }>();
  const isMaster = auth?.role === "master";
  const companyId = params.companyId ? parseInt(params.companyId) : auth?.company_id;

  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [integrations, setIntegrations] = useState<CompanyIntegration[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<number>(companyId || 0);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ type: "", message: "" });

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addCategory, setAddCategory] = useState<IntegrationCategory>("sms");
  const [addProviderId, setAddProviderId] = useState<number | "">("");
  const [addDefault, setAddDefault] = useState(true);
  const [addFallback, setAddFallback] = useState(false);
  const [addPriority, setAddPriority] = useState(0);
  const [addQuotaDaily, setAddQuotaDaily] = useState<string>("");
  const [addQuotaMonthly, setAddQuotaMonthly] = useState<string>("");
  const [addRateLimit, setAddRateLimit] = useState<string>("");
  const [addCredentials, setAddCredentials] = useState<Record<string, string>>({});

  // Edit credentials
  const [editCreds, setEditCreds] = useState<number | null>(null);
  const [editCredValues, setEditCredValues] = useState<Record<string, string>>({});
  const [editCredMasked, setEditCredMasked] = useState<Record<string, string>>({});

  // Test
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const pRes = await getProviders();
      setProviders(pRes.data);
      if (isMaster) {
        const cRes = await getCompanies({ all: true });
        setCompanies(cRes.data.items.map((c: any) => ({ id: c.id, name: c.name })));
      }
      if (selectedCompany) {
        const iRes = await getCompanyIntegrations(selectedCompany);
        setIntegrations(iRes.data);
      }
    } catch {
      setAlert({ type: "danger", message: "Failed to load" });
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, isMaster]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selectedCompany) {
      getCompanyIntegrations(selectedCompany).then(r => setIntegrations(r.data)).catch(() => {});
    }
  }, [selectedCompany]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !addProviderId) return;
    const creds = Object.fromEntries(
      Object.entries(addCredentials).filter(([k, v]) => k.trim() && v.trim() !== "")
    );
    const body: CompanyIntegrationCreate = {
      provider_id: addProviderId as number,
      category: addCategory,
      is_default: addDefault,
      is_fallback: addFallback,
      priority: addPriority,
      credentials: Object.keys(creds).length > 0 ? creds : undefined,
      daily_quota: addQuotaDaily ? parseInt(addQuotaDaily) : undefined,
      monthly_quota: addQuotaMonthly ? parseInt(addQuotaMonthly) : undefined,
      rate_limit_per_min: addRateLimit ? parseInt(addRateLimit) : undefined,
    };
    try {
      await createCompanyIntegration(selectedCompany, body);
      setAlert({ type: "success", message: "Integration added" });
      setShowAdd(false);
      setAddCredentials({});
      const iRes = await getCompanyIntegrations(selectedCompany);
      setIntegrations(iRes.data);
    } catch (err: any) {
      setAlert({ type: "danger", message: err.response?.data?.detail || "Add failed" });
    }
  };

  const handleToggle = async (ci: CompanyIntegration, field: "is_enabled" | "is_default" | "is_fallback") => {
    try {
      await updateCompanyIntegration(selectedCompany, ci.id, { [field]: !ci[field] });
      const iRes = await getCompanyIntegrations(selectedCompany);
      setIntegrations(iRes.data);
    } catch (err: any) {
      setAlert({ type: "danger", message: err.response?.data?.detail || "Update failed" });
    }
  };

  const handleSaveCreds = async (integrationId: number) => {
    const creds = Object.fromEntries(
      Object.entries(editCredValues).filter(([k, v]) => k.trim() && v.trim() !== "")
    );
    try {
      await updateCompanyIntegration(selectedCompany, integrationId, {
        credentials: Object.keys(creds).length > 0 ? creds : undefined,
      });
      setAlert({ type: "success", message: "Credentials updated" });
      setEditCreds(null);
      const iRes = await getCompanyIntegrations(selectedCompany);
      setIntegrations(iRes.data);
    } catch (err: any) {
      setAlert({ type: "danger", message: err.response?.data?.detail || "Update failed" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Remove this integration?")) return;
    try {
      await deleteCompanyIntegration(selectedCompany, id);
      setAlert({ type: "success", message: "Integration removed" });
      const iRes = await getCompanyIntegrations(selectedCompany);
      setIntegrations(iRes.data);
    } catch (err: any) {
      setAlert({ type: "danger", message: err.response?.data?.detail || "Delete failed" });
    }
  };

  const handleTest = async (providerId: number) => {
    setTesting(providerId);
    setTestResult(null);
    try {
      const res = await testConnection(providerId, undefined, undefined, selectedCompany);
      setTestResult(res.data);
    } catch {
      setTestResult({ success: false, message: "Test failed" });
    } finally {
      setTesting(null);
    }
  };

  const grouped = CATEGORIES.map(c => ({
    ...c,
    items: integrations.filter(i => i.category === c.value),
  })).filter(g => g.items.length > 0);

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-0 fw-bold">🏢 Company</h4>
          <small className="text-muted">Configure providers per company</small>
        </div>
        <div className="d-flex gap-2">
          {isMaster && companies.length > 0 && (
            <select className="form-select form-select-sm" style={{ width: 200 }}
              value={selectedCompany}
              onChange={e => setSelectedCompany(parseInt(e.target.value))}>
              <option value={0}>Select Company</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {selectedCompany > 0 && (
            <button className="btn btn-sm btn-primary" onClick={() => { setShowAdd(true); setAddCredentials({}); }}>
              + Add Integration
            </button>
          )}
        </div>
      </div>

      <AlertMessage type={alert.type as any} message={alert.message} onClose={() => setAlert({ type: "", message: "" })} />

      {testResult && (
        <div className={`alert alert-${testResult.success ? "success" : "danger"} alert-dismissible`}>
          <strong>{testResult.success ? "✓ Connected" : "✗ Failed"}</strong>: {testResult.message}
          <button className="btn-close" onClick={() => setTestResult(null)} />
        </div>
      )}

      {!selectedCompany && <p className="text-center text-muted py-5">Select a company to manage integrations</p>}

      {/* ── Add Integration Form ─────────────────────────────────── */}
      {showAdd && selectedCompany > 0 && (
        <div className="card shadow-sm mb-4 border-primary">
          <div className="card-header bg-primary text-white fw-semibold d-flex justify-content-between">
            <span>Add Integration</span>
            <button className="btn btn-sm btn-outline-light" onClick={() => setShowAdd(false)}>✕</button>
          </div>
          <div className="card-body">
            <form onSubmit={handleAdd}>
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Category</label>
                  <select className="form-select" value={addCategory}
                    onChange={e => { setAddCategory(e.target.value as IntegrationCategory); setAddProviderId(""); setAddCredentials({}); }}>
                    {CATEGORIES.filter(c => providers.some(p => p.category === c.value && p.is_active))
                      .map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Provider</label>
                  <select className="form-select" value={addProviderId} required
                    onChange={e => { setAddProviderId(parseInt(e.target.value)); setAddCredentials({}); }}>
                    <option value="">Select...</option>
                    {providers.filter(p => p.category === addCategory && p.is_active).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label fw-semibold">Priority</label>
                  <input type="number" className="form-control" value={addPriority}
                    onChange={e => setAddPriority(parseInt(e.target.value) || 0)} />
                </div>
                <div className="col-md-4 d-flex align-items-end gap-3">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" checked={addDefault}
                      onChange={e => setAddDefault(e.target.checked)} id="addDef" />
                    <label className="form-check-label" htmlFor="addDef">Default</label>
                  </div>
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" checked={addFallback}
                      onChange={e => setAddFallback(e.target.checked)} id="addFb" />
                    <label className="form-check-label" htmlFor="addFb">Fallback</label>
                  </div>
                </div>
              </div>

              {/* Quotas */}
              <div className="row g-3 mt-1">
                <div className="col-md-3">
                  <label className="form-label">Daily Quota</label>
                  <input type="number" className="form-control form-control-sm" value={addQuotaDaily}
                    onChange={e => setAddQuotaDaily(e.target.value)} placeholder="Unlimited" />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Monthly Quota</label>
                  <input type="number" className="form-control form-control-sm" value={addQuotaMonthly}
                    onChange={e => setAddQuotaMonthly(e.target.value)} placeholder="Unlimited" />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Rate Limit/min</label>
                  <input type="number" className="form-control form-control-sm" value={addRateLimit}
                    onChange={e => setAddRateLimit(e.target.value)} placeholder="Unlimited" />
                </div>
              </div>

              {/* Credentials */}
              <div className="mt-3">
                <label className="form-label fw-semibold">API Keys / Credentials <small className="text-muted">(encrypted at rest)</small></label>
                <CredentialFields
                  schema={providers.find(p => p.id === addProviderId)?.config_schema}
                  values={addCredentials}
                  onChange={setAddCredentials}
                  resetKey={addProviderId}
                />
              </div>

              <div className="mt-3 text-end">
                <button type="submit" className="btn btn-success">Add Integration</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Integration list by category ─────────────────────────── */}
      {selectedCompany > 0 && grouped.length === 0 && !showAdd && (
        <div className="text-center text-muted py-5">
          <h5>No integrations configured</h5>
          <p>Click "+ Add Integration" to configure providers for this company</p>
        </div>
      )}

      {grouped.map(g => (
        <div key={g.value} className="card shadow-sm mb-4">
          <div className="card-header fw-semibold">{g.icon} {g.label}</div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Provider</th><th>Default</th><th>Fallback</th><th>Priority</th>
                    <th>Health</th><th>Credentials</th><th>Quotas</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map(ci => (
                    <React.Fragment key={ci.id}>
                      <tr>
                        <td>
                          <div className="fw-semibold">{ci.provider_name || `#${ci.provider_id}`}</div>
                          <small className="text-muted">{ci.provider_code}</small>
                        </td>
                        <td>
                          <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" checked={ci.is_default}
                              onChange={() => handleToggle(ci, "is_default")} />
                          </div>
                        </td>
                        <td>
                          <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" checked={ci.is_fallback}
                              onChange={() => handleToggle(ci, "is_fallback")} />
                          </div>
                        </td>
                        <td>{ci.priority}</td>
                        <td>
                          <span className={`badge bg-${HEALTH_BADGE[ci.health_status] || "secondary"}`}>
                            {ci.health_status}
                          </span>
                          {ci.last_health_check && (
                            <><br /><small className="text-muted">{new Date(ci.last_health_check).toLocaleString()}</small></>
                          )}
                        </td>
                        <td>
                          {ci.credentials_set ? (
                            <span className="badge bg-success">Set ✓</span>
                          ) : (
                            <span className="badge bg-warning text-dark">Not Set</span>
                          )}
                          {(isMaster || auth?.role === "admin") && (
                            <button className="btn btn-link btn-sm p-0 ms-2"
                              onClick={() => {
                                if (editCreds === ci.id) { setEditCreds(null); return; }
                                setEditCreds(ci.id);
                                setEditCredValues({});
                                setEditCredMasked({});
                                if (ci.credentials_set) {
                                  getCompanyIntegrationCredentials(selectedCompany, ci.id)
                                    .then(r => setEditCredMasked(r.data.credentials))
                                    .catch(() => {});
                                }
                              }}>
                              {editCreds === ci.id ? "Cancel" : "Edit"}
                            </button>
                          )}
                        </td>
                        <td>
                          <small>
                            {ci.daily_quota ? `${ci.daily_quota}/day` : ""}
                            {ci.monthly_quota ? ` ${ci.monthly_quota}/mo` : ""}
                            {ci.rate_limit_per_min ? ` ${ci.rate_limit_per_min}/min` : ""}
                            {!ci.daily_quota && !ci.monthly_quota && !ci.rate_limit_per_min && "Unlimited"}
                          </small>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <button className={`btn btn-outline-${ci.is_enabled ? "success" : "secondary"}`}
                              onClick={() => handleToggle(ci, "is_enabled")}>
                              {ci.is_enabled ? "Enabled" : "Disabled"}
                            </button>
                            <button className="btn btn-outline-info" disabled={testing === ci.provider_id}
                              onClick={() => handleTest(ci.provider_id)}>
                              {testing === ci.provider_id ? "…" : "🔗 Test"}
                            </button>
                            {(isMaster || auth?.role === "admin") && (
                              <button className="btn btn-outline-danger" onClick={() => handleDelete(ci.id)}>🗑️</button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {editCreds === ci.id && (
                        <tr key={`creds-${ci.id}`}>
                          <td colSpan={8} className="bg-light">
                            <div className="p-2">
                              <strong className="d-block mb-2">Update API Keys / Credentials</strong>
                              <p className="text-muted mb-2"><small>
                                Values are encrypted at rest. Leave a field blank to keep its saved value.
                              </small></p>
                              <CredentialFields
                                schema={providers.find(p => p.id === ci.provider_id)?.config_schema}
                                values={editCredValues}
                                onChange={setEditCredValues}
                                masked={editCredMasked}
                                resetKey={ci.id}
                              />
                              <button className="btn btn-sm btn-warning mt-2" onClick={() => handleSaveCreds(ci.id)}>
                                Save Credentials
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
