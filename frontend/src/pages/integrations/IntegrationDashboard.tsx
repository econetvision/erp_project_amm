import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import AlertMessage from "../../components/AlertMessage";
import ServerPagination from "../../components/ServerPagination";
import {
  getIntegrationDashboard,
  getProviderLogs,
  getProviderUsage,
} from "../../api/integrationApi";
import type {
  IntegrationDashboard as DashboardData,
  ProviderLog,
  ProviderUsage,
} from "../../types/integration";

const CATEGORY_LABELS: Record<string, string> = {
  sms: "SMS", email: "Email", maps: "Maps", kyc: "KYC",
  bank: "Bank", notification: "Notifications", otp: "OTP", geolocation: "Geolocation",
};
const CATEGORY_ICONS: Record<string, string> = {
  sms: "💬", email: "📧", maps: "🗺️", kyc: "🪪", bank: "🏦",
  notification: "🔔", otp: "🔐", geolocation: "📍",
};
const HEALTH_BADGE: Record<string, string> = {
  healthy: "success", degraded: "warning", down: "danger", unknown: "secondary",
};
const STATUS_BADGE: Record<string, string> = {
  success: "success", failed: "danger", pending: "warning", retrying: "info",
};

export default function IntegrationDashboard() {
  const { auth } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [logs, setLogs] = useState<ProviderLog[]>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPages, setLogsPages] = useState(1);
  const [logFilter, setLogFilter] = useState({ category: "", status: "" });
  const [usage, setUsage] = useState<ProviderUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [tab, setTab] = useState<"overview" | "logs" | "usage">("overview");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [dashRes] = await Promise.all([getIntegrationDashboard()]);
      setDashboard(dashRes.data);
    } catch {
      setAlert({ type: "danger", message: "Failed to load dashboard" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async (page = 1) => {
    try {
      const res = await getProviderLogs({
        page,
        per_page: 25,
        ...(logFilter.category && { category: logFilter.category }),
        ...(logFilter.status && { status: logFilter.status }),
      });
      setLogs(res.data.items);
      setLogsPage(res.data.page);
      setLogsPages(res.data.pages);
    } catch { /* */ }
  }, [logFilter]);

  const loadUsage = useCallback(async () => {
    try {
      const res = await getProviderUsage();
      setUsage(res.data);
    } catch { /* */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "logs") loadLogs(1); }, [tab, loadLogs]);
  useEffect(() => { if (tab === "usage") loadUsage(); }, [tab, loadUsage]);

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-0 fw-bold">🔌 Integration Management</h4>
          <small className="text-muted">Monitor providers, usage analytics & health</small>
        </div>
      </div>

      <AlertMessage type={alert.type as any} message={alert.message} onClose={() => setAlert({ type: "", message: "" })} />

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4">
        {(["overview", "logs", "usage"] as const).map(t => (
          <li className="nav-item" key={t}>
            <button className={`nav-link ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "overview" ? "📊 Overview" : t === "logs" ? "📋 Logs" : "📈 Usage"}
            </button>
          </li>
        ))}
      </ul>

      {/* ── Overview ─────────────────────────────────────────────── */}
      {tab === "overview" && dashboard && (
        <>
          {/* Stats cards */}
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="card text-bg-primary">
                <div className="card-body">
                  <h6 className="card-subtitle mb-1 opacity-75">Total Providers</h6>
                  <h2 className="mb-0 fw-bold">{dashboard.total_providers}</h2>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-bg-success">
                <div className="card-body">
                  <h6 className="card-subtitle mb-1 opacity-75">Active Integrations</h6>
                  <h2 className="mb-0 fw-bold">{dashboard.active_integrations}</h2>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-bg-info">
                <div className="card-body">
                  <h6 className="card-subtitle mb-1 opacity-75">Categories Active</h6>
                  <h2 className="mb-0 fw-bold">{dashboard.categories_summary.length}</h2>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-bg-danger">
                <div className="card-body">
                  <h6 className="card-subtitle mb-1 opacity-75">Recent Failures</h6>
                  <h2 className="mb-0 fw-bold">{dashboard.recent_failures.length}</h2>
                </div>
              </div>
            </div>
          </div>

          {/* Category usage summary */}
          <div className="row g-4 mb-4">
            <div className="col-lg-8">
              <div className="card shadow-sm">
                <div className="card-header fw-semibold">Category Usage (This Month)</div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr><th>Category</th><th>Requests</th><th>Success</th><th>Failed</th><th>Avg Latency</th><th>Success Rate</th></tr>
                      </thead>
                      <tbody>
                        {dashboard.categories_summary.length === 0 && (
                          <tr><td colSpan={6} className="text-center text-muted py-4">No usage data yet</td></tr>
                        )}
                        {dashboard.categories_summary.map(c => {
                          const rate = c.total_requests > 0 ? ((c.success_count / c.total_requests) * 100).toFixed(1) : "—";
                          return (
                            <tr key={c.category}>
                              <td>{CATEGORY_ICONS[c.category] || "📦"} {CATEGORY_LABELS[c.category] || c.category}</td>
                              <td className="fw-semibold">{c.total_requests.toLocaleString()}</td>
                              <td className="text-success">{c.success_count.toLocaleString()}</td>
                              <td className="text-danger">{c.failure_count.toLocaleString()}</td>
                              <td>{c.avg_latency_ms ? `${Math.round(c.avg_latency_ms)}ms` : "—"}</td>
                              <td>
                                <span className={`badge bg-${parseFloat(rate as string) >= 95 ? "success" : parseFloat(rate as string) >= 80 ? "warning" : "danger"}`}>
                                  {rate}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Provider health */}
            <div className="col-lg-4">
              <div className="card shadow-sm">
                <div className="card-header fw-semibold">Provider Health</div>
                <div className="card-body">
                  {dashboard.provider_health.length === 0 && <p className="text-muted text-center mb-0">No providers configured</p>}
                  {dashboard.provider_health.map((p, i) => (
                    <div key={i} className="d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <span className="fw-semibold">{p.provider_name}</span>
                        <br /><small className="text-muted">{CATEGORY_LABELS[p.category] || p.category}</small>
                      </div>
                      <div className="text-end">
                        <span className={`badge bg-${HEALTH_BADGE[p.health_status] || "secondary"}`}>
                          {p.health_status}
                        </span>
                        <br /><small className="text-muted">{p.companies_using} companies</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recent failures */}
          {dashboard.recent_failures.length > 0 && (
            <div className="card shadow-sm">
              <div className="card-header fw-semibold text-danger">⚠️ Recent Failures</div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead className="table-light">
                      <tr><th>Time</th><th>Provider</th><th>Category</th><th>Action</th><th>Error</th><th>Latency</th></tr>
                    </thead>
                    <tbody>
                      {dashboard.recent_failures.slice(0, 10).map(f => (
                        <tr key={f.id}>
                          <td><small>{new Date(f.created_at).toLocaleString()}</small></td>
                          <td>{f.provider_name || "—"}</td>
                          <td>{CATEGORY_LABELS[f.category] || f.category}</td>
                          <td><code>{f.action}</code></td>
                          <td><small className="text-danger">{f.error_message?.substring(0, 80)}</small></td>
                          <td>{f.latency_ms ? `${f.latency_ms}ms` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Logs ─────────────────────────────────────────────────── */}
      {tab === "logs" && (
        <div className="card shadow-sm">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span className="fw-semibold">Provider Logs</span>
            <div className="d-flex gap-2">
              <select className="form-select form-select-sm" style={{ width: 140 }}
                value={logFilter.category} onChange={e => setLogFilter(f => ({ ...f, category: e.target.value }))}>
                <option value="">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="form-select form-select-sm" style={{ width: 120 }}
                value={logFilter.status} onChange={e => setLogFilter(f => ({ ...f, status: e.target.value }))}>
                <option value="">All Status</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="retrying">Retrying</option>
              </select>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0">
                <thead className="table-light">
                  <tr><th>Time</th><th>Provider</th><th>Category</th><th>Action</th><th>Status</th><th>Latency</th><th>Retries</th><th>Error</th></tr>
                </thead>
                <tbody>
                  {logs.length === 0 && <tr><td colSpan={8} className="text-center text-muted py-4">No logs found</td></tr>}
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td><small>{new Date(l.created_at).toLocaleString()}</small></td>
                      <td>{l.provider_name || "—"}</td>
                      <td>{CATEGORY_LABELS[l.category] || l.category}</td>
                      <td><code>{l.action}</code></td>
                      <td><span className={`badge bg-${STATUS_BADGE[l.status] || "secondary"}`}>{l.status}</span></td>
                      <td>{l.latency_ms ? `${l.latency_ms}ms` : "—"}</td>
                      <td>{l.retry_count}</td>
                      <td><small className="text-danger">{l.error_message?.substring(0, 60)}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {logsPages > 1 && (
            <div className="card-footer">
              <ServerPagination page={logsPage} pages={logsPages} onPageChange={p => loadLogs(p)} />
            </div>
          )}
        </div>
      )}

      {/* ── Usage ────────────────────────────────────────────────── */}
      {tab === "usage" && (
        <div className="card shadow-sm">
          <div className="card-header fw-semibold">Daily Usage (Recent)</div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0">
                <thead className="table-light">
                  <tr><th>Date</th><th>Provider</th><th>Category</th><th>Requests</th><th>Success</th><th>Failed</th><th>Avg Latency</th></tr>
                </thead>
                <tbody>
                  {usage.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-4">No usage data</td></tr>}
                  {usage.map(u => (
                    <tr key={u.id}>
                      <td>{new Date(u.date).toLocaleDateString()}</td>
                      <td>{u.provider_name || "—"}</td>
                      <td>{CATEGORY_LABELS[u.category] || u.category}</td>
                      <td className="fw-semibold">{u.request_count}</td>
                      <td className="text-success">{u.success_count}</td>
                      <td className="text-danger">{u.failure_count}</td>
                      <td>{u.request_count > 0 ? `${Math.round(u.total_latency_ms / u.request_count)}ms` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
