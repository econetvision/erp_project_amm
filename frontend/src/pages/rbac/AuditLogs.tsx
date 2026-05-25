import { useEffect, useState, useCallback } from "react";
import { getAuditLogs } from "../../api/rbacApi";
import ServerPagination from "../../components/ServerPagination";
import AlertMessage from "../../components/AlertMessage";
import type { AuditLog } from "../../types/company";

const ACTION_COLORS: Record<string, string> = {
  create: "success", update: "warning", delete: "danger",
  login: "info", impersonate: "dark", default: "secondary",
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const fetch = useCallback(async () => {
    try {
      const r = await getAuditLogs({
        page, per_page: 20,
        entity_type: entityFilter || undefined,
        action: actionFilter || undefined,
      });
      setLogs(r.data.items);
      setTotal(r.data.total);
      setPages(r.data.pages);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }, [page, entityFilter, actionFilter]);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { setPage(1); }, [entityFilter, actionFilter]);

  return (
    <div>
      <h3 className="fw-bold mb-4">Audit Logs</h3>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {/* Filters */}
      <div className="row g-2 mb-3">
        <div className="col-md-3">
          <select className="form-select" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
            <option value="impersonate">Impersonate</option>
          </select>
        </div>
        <div className="col-md-3">
          <input className="form-control" placeholder="Entity type..." value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)} />
        </div>
        <div className="col-md-3">
          <span className="text-muted small lh-lg">{total} records</span>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Entity ID</th>
                  <th>Details</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="text-muted small text-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                    </td>
                    <td>
                      <span className={`badge bg-${ACTION_COLORS[log.action] || ACTION_COLORS.default}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>{log.entity_type || "—"}</td>
                    <td>{log.entity_id ?? "—"}</td>
                    <td className="text-truncate" style={{ maxWidth: 300 }}>{log.details || "—"}</td>
                    <td className="text-muted small">{log.ip_address || "—"}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted py-4">No audit logs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {pages > 1 && (
        <div className="mt-3">
          <ServerPagination page={page} pages={pages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
