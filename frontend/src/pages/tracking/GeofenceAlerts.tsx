import { useCallback, useEffect, useState } from "react";
import { getGeofenceEvents } from "../../api/geofenceApi";
import type { GeofenceExitEvent } from "../../api/geofenceApi";
import AlertMessage from "../../components/AlertMessage";

// Matches the bell's poll cadence so a new exit shows up within one interval.
const REFRESH_MS = 30000;

function fmt(ts: string | null): string {
  return ts ? new Date(ts).toLocaleString() : "—";
}

function durationLabel(ev: GeofenceExitEvent): string {
  const start = new Date(ev.exited_at).getTime();
  const end = ev.returned_at ? new Date(ev.returned_at).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - start) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} h ${mins % 60} min`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function GeofenceAlerts() {
  const [events, setEvents]     = useState<GeofenceExitEvent[]>([]);
  const [alert, setAlert]       = useState<{ type: string; message: string } | null>(null);
  const [loading, setLoading]   = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo]     = useState(todayIso());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getGeofenceEvents({
        open_only: openOnly,
        date_from: openOnly ? undefined : dateFrom || undefined,
        date_to:   openOnly ? undefined : dateTo || undefined,
      });
      setEvents(data);
    } catch (err: any) {
      setAlert({ type: "danger", message: err.message });
    } finally {
      setLoading(false);
    }
  }, [openOnly, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const currentlyOut = events.filter(e => !e.returned_at);

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Work Location Alerts</h4>
        <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <AlertMessage alert={alert} onClose={() => setAlert(null)} />

      <p className="text-muted small">
        An alert is raised when a clocked-in employee stays outside every assigned work location
        for three consecutive location checks (about three minutes). The location's supervisor and
        all company admins are notified, and again when the employee returns.
      </p>

      <div className="card mb-4">
        <div className="card-body">
          <form className="row g-3 align-items-end" onSubmit={e => { e.preventDefault(); load(); }}>
            <div className="col-auto">
              <div className="form-check form-switch">
                <input
                  id="openOnly"
                  className="form-check-input"
                  type="checkbox"
                  checked={openOnly}
                  onChange={e => setOpenOnly(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="openOnly">Currently outside only</label>
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label">From</label>
              <input type="date" className="form-control" value={dateFrom} disabled={openOnly}
                onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label">To</label>
              <input type="date" className="form-control" value={dateTo} disabled={openOnly}
                onChange={e => setDateTo(e.target.value)} />
            </div>
          </form>
        </div>
      </div>

      {currentlyOut.length > 0 && (
        <div className="alert alert-danger py-2">
          <strong>{currentlyOut.length}</strong> employee{currentlyOut.length === 1 ? " is" : "s are"} currently
          away from their work location.
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Work location</th>
                <th className="text-end">Distance</th>
                <th>Left at</th>
                <th>Returned at</th>
                <th>Away for</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted py-4">
                  {loading ? "Loading…" : "No alerts for this period."}
                </td></tr>
              ) : events.map(ev => (
                <tr key={ev.id} className={ev.returned_at ? "" : "table-danger"}>
                  <td>
                    <div className="fw-semibold">{ev.employee_name || `#${ev.employee_id}`}</div>
                    {ev.employee_code && <div className="small text-muted">{ev.employee_code}</div>}
                  </td>
                  <td>{ev.location_name || "—"}</td>
                  <td className="text-end">{ev.distance_m != null ? `${Math.round(ev.distance_m)} m` : "—"}</td>
                  <td>{fmt(ev.exited_at)}</td>
                  <td>{fmt(ev.returned_at)}</td>
                  <td>{durationLabel(ev)}</td>
                  <td>
                    {ev.returned_at
                      ? <span className="badge bg-success">Returned</span>
                      : <span className="badge bg-danger">Outside</span>}
                    {ev.latitude != null && ev.longitude != null && (
                      <a
                        className="ms-2 small"
                        href={`https://www.google.com/maps?q=${ev.latitude},${ev.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >Map</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
