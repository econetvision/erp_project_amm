import { Fragment, useEffect, useState } from "react";
import { getMissedAttendance } from "../../api/dashboardApi";
import type {
  MissedAttendanceResponse,
  MissedAttendanceEntry,
  MissedReason,
} from "../../types/attendance";
import AlertMessage from "../../components/AlertMessage";

type Period = "daily" | "weekly" | "monthly";

const PERIODS: { key: Period; label: string }[] = [
  { key: "daily",   label: "Daily" },
  { key: "weekly",  label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

const REASON_META: Record<MissedReason, { label: string; badge: string }> = {
  absent:     { label: "Absent",     badge: "bg-danger" },
  incomplete: { label: "No clock-out", badge: "bg-warning text-dark" },
  late:       { label: "Late",       badge: "bg-info text-dark" },
};

function fmtDate(iso: string) {
  // "2026-08-25" → "25 Aug"
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function fmtRange(start: string, end: string) {
  return start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`;
}

export default function MissedAttendancePanel({ anchorDate }: { anchorDate: string }) {
  const [period,  setPeriod]  = useState<Period>("daily");
  const [data,    setData]    = useState<MissedAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [alert,   setAlert]   = useState({ type: "", message: "" });
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await getMissedAttendance(period, anchorDate);
        if (!cancelled) {
          setData(res.data);
          setAlert({ type: "", message: "" });
        }
      } catch (e: any) {
        if (!cancelled) {
          setAlert({ type: "danger", message: e?.response?.data?.detail || e.message });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [period, anchorDate]);

  // Collapse any open row when the period changes — the ids no longer line up.
  useEffect(() => { setExpanded(null); }, [period, anchorDate]);

  function toggle(id: number) {
    setExpanded(prev => (prev === id ? null : id));
  }

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <span className="fw-semibold">
          Missed Attendance
          {data && (
            <span className="text-muted fw-normal ms-2">
              {fmtRange(data.start_date, data.end_date)} · {data.working_days} working day
              {data.working_days === 1 ? "" : "s"}
            </span>
          )}
        </span>
        <ul className="nav nav-pills nav-sm">
          {PERIODS.map(p => (
            <li className="nav-item" key={p.key}>
              <button
                type="button"
                className={`nav-link py-1 px-3 ${period === p.key ? "active" : ""}`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card-body pb-0">
        <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

        {data && (
          <div className="d-flex flex-wrap gap-3 mb-3">
            <small><span className="badge bg-danger">Absent</span> {data.total_absent}</small>
            <small><span className="badge bg-warning text-dark">No clock-out</span> {data.total_incomplete}</small>
            <small><span className="badge bg-info text-dark">Late</span> {data.total_late}</small>
            <small className="text-muted">
              {data.employees_with_misses} of {data.total_employees} employees affected
            </small>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card-body text-center text-muted py-4">
          <div className="spinner-border spinner-border-sm me-2" role="status" />
          Loading…
        </div>
      ) : !data || data.employees.length === 0 ? (
        <div className="card-body text-center text-success py-4">
          {data && data.working_days === 0
            ? "No working days in this period."
            : "Full attendance — nobody missed a day."}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-hover mb-0 align-middle">
            <thead className="table-dark">
              <tr>
                <th>Employee</th>
                <th>Code</th>
                <th>Shift</th>
                <th className="text-center">Missed</th>
                <th className="text-center">Absent</th>
                <th className="text-center">No clock-out</th>
                <th className="text-center">Late</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.employees.map((e: MissedAttendanceEntry) => (
                <Fragment key={e.employee_id}>
                  <tr>
                    <td className="fw-semibold">{e.name || "—"}</td>
                    <td className="text-muted small">{e.employee_code || "—"}</td>
                    <td>
                      <span className="badge bg-secondary">
                        {e.shift === "SHIFT_B" ? "Shift B" : "Shift A"}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-dark">{e.missed_days}</span>
                    </td>
                    <td className="text-center">{e.absent_days || "—"}</td>
                    <td className="text-center">{e.incomplete_days || "—"}</td>
                    <td className="text-center">{e.late_days || "—"}</td>
                    <td className="text-end pe-3">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => toggle(e.employee_id)}
                      >
                        {expanded === e.employee_id ? "Hide" : "Dates"}
                      </button>
                    </td>
                  </tr>
                  {expanded === e.employee_id && (
                    <tr>
                      <td colSpan={8} className="bg-light">
                        <div className="d-flex flex-wrap gap-2 py-1">
                          {e.details.map(d => (
                            <span key={`${d.date}-${d.reason}`} className="border rounded px-2 py-1 bg-white">
                              <span className={`badge ${REASON_META[d.reason].badge} me-2`}>
                                {REASON_META[d.reason].label}
                              </span>
                              <span className="small">{fmtDate(d.date)}</span>
                              {d.entry_time && (
                                <span className="small text-muted ms-2">in {d.entry_time.slice(0, 5)}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
