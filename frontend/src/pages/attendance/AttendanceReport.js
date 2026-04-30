import { useEffect, useState } from "react";
import { getAllEmployees } from "../../api/employeeApi";
import { getMonthlyReport } from "../../api/attendanceApi";
import { getDailySummary } from "../../api/dashboardApi";
import AlertMessage from "../../components/AlertMessage";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function exportCsv(data) {
  const rows = [
    ["Date", "Entry Time", "Exit Time", "Hours Worked"],
    ...data.records.map((r) => [r.date, r.entry_time, r.exit_time || "-", r.hours_worked || "0"]),
    ["", "", "Total Hours", data.total_hours],
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `attendance_${data.employee_name}_${data.year}_${data.month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendanceReport() {
  const [activeTab, setActiveTab]     = useState("monthly");

  // Monthly tab state
  const [employees, setEmployees]     = useState([]);
  const [empId, setEmpId]             = useState("");
  const [month, setMonth]             = useState(new Date().getMonth() + 1);
  const [year, setYear]               = useState(new Date().getFullYear());
  const [report, setReport]           = useState(null);
  const [alert, setAlert]             = useState({ type: "", message: "" });

  // Daily tab state
  const [dailyDate,    setDailyDate]  = useState(todayStr());
  const [dailySummary, setDailySummary] = useState([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  useEffect(() => {
    getAllEmployees()
      .then((r) => setEmployees(r.data))
      .catch((e) => setAlert({ type: "danger", message: e.message }));
  }, []);

  async function fetchReport() {
    if (!empId) return setAlert({ type: "warning", message: "Please select an employee." });
    try {
      const res = await getMonthlyReport(empId, month, year);
      setReport(res.data);
      setAlert({ type: "", message: "" });
    } catch (e) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function fetchDailySummary() {
    setDailyLoading(true);
    try {
      const res = await getDailySummary(dailyDate);
      setDailySummary(res.data);
      setAlert({ type: "", message: "" });
    } catch (e) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setDailyLoading(false);
    }
  }

  const statusBadge = (status) => {
    if (status === "present") return <span className="badge bg-success">Present</span>;
    if (status === "absent")  return <span className="badge bg-danger">Absent</span>;
    return <span className="badge bg-secondary">Holiday</span>;
  };

  return (
    <div>
      <h3 className="fw-bold mb-3">Attendance Reports</h3>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {/* Tab nav */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button className={`nav-link${activeTab === "monthly" ? " active" : ""}`}
            onClick={() => setActiveTab("monthly")}>
            Monthly Report
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link${activeTab === "daily" ? " active" : ""}`}
            onClick={() => setActiveTab("daily")}>
            Daily View
          </button>
        </li>
      </ul>

      {/* ── Monthly Tab ───────────────────────────────────────────────────── */}
      {activeTab === "monthly" && (
        <>
          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <div className="row g-3 align-items-end">
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Employee</label>
                  <select className="form-select" value={empId} onChange={(e) => setEmpId(e.target.value)}>
                    <option value="">-- Select --</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Month</label>
                  <select className="form-select" value={month} onChange={(e) => setMonth(+e.target.value)}>
                    {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label fw-semibold">Year</label>
                  <input className="form-control" type="number" value={year}
                    onChange={(e) => setYear(+e.target.value)} min="2000" />
                </div>
                <div className="col-md-3">
                  <button className="btn btn-primary w-100" onClick={fetchReport}>Fetch Report</button>
                </div>
              </div>
            </div>
          </div>

          {report && (
            <div className="card shadow-sm">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span className="fw-bold">{report.employee_name} — {MONTHS[report.month-1]} {report.year}</span>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => exportCsv(report)}>
                  Export CSV
                </button>
              </div>
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead className="table-dark">
                    <tr><th>Date</th><th>Entry Time</th><th>Exit Time</th><th>Hours Worked</th></tr>
                  </thead>
                  <tbody>
                    {report.records.length === 0 ? (
                      <tr><td colSpan="4" className="text-center text-muted py-3">No records found.</td></tr>
                    ) : (
                      report.records.map((r) => (
                        <tr key={r.id}>
                          <td>{r.date}</td>
                          <td>{r.entry_time}</td>
                          <td>{r.exit_time || <span className="badge bg-warning text-dark">Active</span>}</td>
                          <td>{r.hours_worked ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="table-secondary fw-bold">
                    <tr>
                      <td>Total Days: {report.total_days}</td>
                      <td></td><td></td>
                      <td>Total Hours: {report.total_hours}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Daily Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "daily" && (
        <>
          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <div className="row g-3 align-items-end">
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Date</label>
                  <input type="date" className="form-control" value={dailyDate}
                    onChange={e => setDailyDate(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <button className="btn btn-primary w-100" onClick={fetchDailySummary}
                    disabled={dailyLoading}>
                    {dailyLoading ? "Loading…" : "Fetch Daily Summary"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {dailySummary.length > 0 && (
            <div className="card shadow-sm">
              <div className="card-header fw-semibold">
                Attendance for {dailyDate} — {dailySummary.filter(e => e.status === "present").length} present,{" "}
                {dailySummary.filter(e => e.status === "absent").length} absent
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th>Employee</th>
                      <th>Shift</th>
                      <th>Status</th>
                      <th>Entry Time</th>
                      <th>Exit Time</th>
                      <th>Hours</th>
                      <th>Overtime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySummary.map(e => (
                      <tr key={e.employee_id}>
                        <td className="fw-semibold">
                          {e.name}
                          {e.is_late && (
                            <span className="badge bg-warning text-dark ms-2" style={{ fontSize: "0.65rem" }}>
                              Late
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="badge bg-secondary">
                            {e.shift === "SHIFT_A" ? "Shift A" : "Shift B"}
                          </span>
                        </td>
                        <td>{statusBadge(e.status)}</td>
                        <td>{e.entry_time ?? "—"}</td>
                        <td>{e.exit_time  ?? "—"}</td>
                        <td>{e.hours_worked != null ? Number(e.hours_worked).toFixed(2) : "—"}</td>
                        <td>
                          {e.overtime_hours > 0
                            ? <span className="text-success fw-semibold">{e.overtime_hours.toFixed(2)}</span>
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
