import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMasterOverview, getCompaniesSummary } from "../../api/masterApi";
import AlertMessage from "../../components/AlertMessage";
import type { MasterOverview, CompanyStats } from "../../types/company";

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string }) {
  return (
    <div className="col-md-3 col-6">
      <div className={`card shadow-sm border-0 text-white bg-${color}`}>
        <div className="card-body text-center py-3">
          <div style={{ fontSize: "2.2rem", lineHeight: 1 }} className="fw-bold">{value}</div>
          <div className="small mt-1 fw-semibold">{label}</div>
        </div>
      </div>
    </div>
  );
}

export default function MasterDashboard() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<MasterOverview | null>(null);
  const [companies, setCompanies] = useState<CompanyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ type: "", message: "" });

  useEffect(() => {
    async function load() {
      try {
        const [ovRes, compRes] = await Promise.all([
          getMasterOverview(),
          getCompaniesSummary(),
        ]);
        setOverview(ovRes.data);
        setCompanies(compRes.data);
      } catch (e: any) {
        setAlert({ type: "danger", message: e.message });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold mb-0">Master Dashboard</h3>
        <span className="badge bg-dark fs-6">MASTER</span>
      </div>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {/* Summary Cards */}
      {overview && (
        <div className="row g-3 mb-4">
          <StatCard label="Total Companies" value={overview.total_companies} color="primary" icon="building" />
          <StatCard label="Active Companies" value={overview.active_companies} color="success" icon="check" />
          <StatCard label="Total Employees" value={overview.total_employees} color="info" icon="people" />
          <StatCard label="Total Users" value={overview.total_users} color="warning" icon="person" />
        </div>
      )}

      {/* Users by Role */}
      {overview && (
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="card shadow-sm">
              <div className="card-header bg-light fw-semibold">Users by Role</div>
              <div className="card-body">
                {Object.entries(overview.users_by_role).map(([role, count]) => (
                  <div key={role} className="d-flex justify-content-between align-items-center mb-2">
                    <span className={`badge bg-${role === "master" ? "dark" : role === "admin" ? "danger" : role === "supervisor" ? "warning" : "success"}`}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </span>
                    <span className="fw-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Employees per Company */}
          <div className="col-md-8">
            <div className="card shadow-sm">
              <div className="card-header bg-light fw-semibold">Employees by Company</div>
              <div className="card-body">
                {overview.employees_by_company.length === 0 ? (
                  <p className="text-muted">No data available.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover mb-0">
                      <thead>
                        <tr><th>Company</th><th className="text-end">Employees</th></tr>
                      </thead>
                      <tbody>
                        {overview.employees_by_company.map((item, i) => (
                          <tr key={i}>
                            <td>{item.company}</td>
                            <td className="text-end fw-bold">{item.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company Overview Table */}
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-primary text-white fw-semibold d-flex justify-content-between align-items-center">
          <span>Companies</span>
          <button className="btn btn-sm btn-light" onClick={() => navigate("/companies")}>
            Manage Companies
          </button>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th className="text-end">Employees</th>
                  <th className="text-end">Users</th>
                  <th className="text-end">Admins</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/companies/${c.id}`)}>
                    <td className="fw-semibold">{c.name}</td>
                    <td><code>{c.code}</code></td>
                    <td>
                      <span className={`badge bg-${c.is_active ? "success" : "secondary"}`}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-end">{c.employee_count}</td>
                    <td className="text-end">{c.user_count}</td>
                    <td className="text-end">{c.admin_count}</td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted py-4">No companies found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Audit Logs */}
      {overview && overview.recent_audit_logs.length > 0 && (
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-light fw-semibold d-flex justify-content-between align-items-center">
            <span>Recent Activity</span>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate("/audit-logs")}>
              View All
            </button>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Details</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recent_audit_logs.map((log: any) => (
                    <tr key={log.id}>
                      <td><span className="badge bg-info">{log.action}</span></td>
                      <td>{log.entity_type || "—"}</td>
                      <td className="text-truncate" style={{ maxWidth: 300 }}>{log.details || "—"}</td>
                      <td className="text-muted small">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                      </td>
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
