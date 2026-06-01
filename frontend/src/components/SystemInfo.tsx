import { useEffect, useState } from "react";
import { getHealthInfo } from "../api/healthApi";
import type { HealthInfo } from "../api/healthApi";

const FRONTEND_VERSION = process.env.REACT_APP_VERSION || "1.0.0";
const FRONTEND_BUILD_SHA = process.env.REACT_APP_BUILD_SHA || "dev";
const FRONTEND_BUILD_TIME = process.env.REACT_APP_BUILD_TIME || "unknown";

export default function SystemInfo() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getHealthInfo()
      .then((r) => setHealth(r.data))
      .catch((e) => setError(e.message));
  }, []);

  const dbOk = health?.database?.status === "ok";
  const backendOk = health?.status === "ok";

  return (
    <div className="card shadow-sm mb-4">
      <div
        className="card-header fw-semibold d-flex justify-content-between align-items-center"
        style={{ cursor: "pointer" }}
        onClick={() => setOpen(!open)}
      >
        <span>
          <i className="bi bi-hdd-rack me-2" />
          System &amp; Deployment Info
        </span>
        <div className="d-flex align-items-center gap-2">
          <span className={`badge ${backendOk ? "bg-success" : "bg-danger"}`}>
            Backend {backendOk ? "Online" : "Offline"}
          </span>
          <span className={`badge ${dbOk ? "bg-success" : "bg-danger"}`}>
            DB {dbOk ? "Connected" : "Error"}
          </span>
          <span className="text-muted" style={{ fontSize: "0.85rem" }}>
            {open ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {open && (
        <div className="card-body">
          {error && (
            <div className="alert alert-danger py-2 mb-3" role="alert">
              Could not fetch backend health: {error}
            </div>
          )}

          <div className="row g-3">
            {/* Frontend info */}
            <div className="col-md-4">
              <div className="border rounded p-3 h-100">
                <h6 className="fw-bold text-primary mb-2">
                  <i className="bi bi-window me-1" />
                  Frontend
                </h6>
                <table className="table table-sm table-borderless mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted">Version</td>
                      <td className="fw-semibold">{FRONTEND_VERSION}</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Build SHA</td>
                      <td>
                        <code>{FRONTEND_BUILD_SHA.slice(0, 8)}</code>
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">Build Time</td>
                      <td>{FRONTEND_BUILD_TIME}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Backend info */}
            <div className="col-md-4">
              <div className="border rounded p-3 h-100">
                <h6 className="fw-bold text-success mb-2">
                  <i className="bi bi-server me-1" />
                  Backend
                </h6>
                {health ? (
                  <table className="table table-sm table-borderless mb-0">
                    <tbody>
                      <tr>
                        <td className="text-muted">Version</td>
                        <td className="fw-semibold">
                          {health.backend.version}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-muted">Build SHA</td>
                        <td>
                          <code>
                            {health.backend.build_sha.slice(0, 8)}
                          </code>
                        </td>
                      </tr>
                      <tr>
                        <td className="text-muted">Build Time</td>
                        <td>{health.backend.build_time}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Server Time</td>
                        <td>
                          {new Date(health.server_time).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <span className="text-muted">Loading…</span>
                )}
              </div>
            </div>

            {/* Database info */}
            <div className="col-md-4">
              <div className="border rounded p-3 h-100">
                <h6 className="fw-bold text-warning mb-2">
                  <i className="bi bi-database me-1" />
                  Database
                </h6>
                {health ? (
                  <table className="table table-sm table-borderless mb-0">
                    <tbody>
                      <tr>
                        <td className="text-muted">Status</td>
                        <td>
                          <span
                            className={`badge ${dbOk ? "bg-success" : "bg-danger"}`}
                          >
                            {health.database.status}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="text-muted">Last Migration</td>
                        <td className="fw-semibold">
                          {health.database.last_migration || "none"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <span className="text-muted">Loading…</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
