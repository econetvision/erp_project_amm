import { useEffect, useState, useMemo } from "react";
import { getAllEmployees } from "../../api/employeeApi";
import { getMonthlyReport } from "../../api/attendanceApi";
import { getDailySummary, getDashboardOverview } from "../../api/dashboardApi";
import AlertMessage from "../../components/AlertMessage";
import type { Employee } from "../../types/employee";
import type { MonthlyReport, DailyEmployeeStatus, DashboardOverview, DailyEntry } from "../../types/attendance";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function exportCsv(data: any) {
  const rows = [
    ["Date", "Entry Time", "Exit Time", "Hours Worked"],
    ...data.records.map((r: any) => [r.date, r.entry_time, r.exit_time || "-", r.hours_worked || "0"]),
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
  const [employees, setEmployees]     = useState<Employee[]>([]);
  const [empId, setEmpId]             = useState("");
  const [month, setMonth]             = useState(new Date().getMonth() + 1);
  const [year, setYear]               = useState(new Date().getFullYear());
  const [report, setReport]           = useState<MonthlyReport | null>(null);
  const [alert, setAlert]             = useState({ type: "", message: "" });

  // Daily tab state
  const [dailyDate,    setDailyDate]  = useState(todayStr());
  const [dailySummary, setDailySummary] = useState<DailyEmployeeStatus[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Calendar tab state
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calYear, setCalYear]   = useState(new Date().getFullYear());
  const [calData, setCalData]   = useState<DailyEntry[]>([]);
  const [calTotal, setCalTotal] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<DailyEmployeeStatus[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [calSlide, setCalSlide] = useState(0); // -1=prev, 0=current, 1=next

  useEffect(() => {
    getAllEmployees({ all: true })
      .then((r) => setEmployees(r.data.items))
      .catch((e: Error) => setAlert({ type: "danger", message: e.message }));
  }, []);

  async function fetchReport() {
    if (!empId) return setAlert({ type: "warning", message: "Please select an employee." });
    try {
      const res = await getMonthlyReport(empId, month, year);
      setReport(res.data);
      setAlert({ type: "", message: "" });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function fetchDailySummary() {
    setDailyLoading(true);
    try {
      const res = await getDailySummary(dailyDate);
      setDailySummary(res.data);
      setAlert({ type: "", message: "" });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setDailyLoading(false);
    }
  }

  async function fetchCalendar() {
    try {
      const res = await getDashboardOverview(calMonth, calYear);
      setCalData(res.data.daily_entries || []);
      setCalTotal(res.data.total_employees || 0);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function handleDayClick(dateStr: string) {
    setSelectedDay(dateStr);
    setDayLoading(true);
    try {
      const res = await getDailySummary(dateStr);
      setDayDetail(res.data);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setDayLoading(false);
    }
  }

  function getSlideMonthYear(offset: number) {
    let m = calMonth + offset;
    let y = calYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    return { m, y };
  }

  function navigateMonth(dir: -1 | 1) {
    let m = calMonth + dir;
    let y = calYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setCalMonth(m); setCalYear(y);
    setSelectedDay(null); setDayDetail([]);
  }

  useEffect(() => {
    if (activeTab === "calendar") fetchCalendar();
  }, [activeTab, calMonth, calYear]);

  // Build calendar grid helper
  function buildCalGrid(monthNum: number, yearNum: number, data: DailyEntry[]) {
    const firstDay = new Date(yearNum, monthNum - 1, 1).getDay();
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const dataMap = new Map(data.map(d => [d.date, d]));
    const weeks: (DailyEntry | null)[][] = [];
    let week: (DailyEntry | null)[] = new Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      week.push(dataMap.get(dateStr) || { date: dateStr, present_count: 0, absent_count: 0, late_count: 0 });
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }
    return weeks;
  }

  const calendarGrid = useMemo(() => buildCalGrid(calMonth, calYear, calData), [calData, calMonth, calYear]);

  const statusBadge = (status: string) => {
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
        <li className="nav-item">
          <button className={`nav-link${activeTab === "calendar" ? " active" : ""}`}
            onClick={() => setActiveTab("calendar")}>
            Calendar
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
                      <tr><td colSpan={4} className="text-center text-muted py-3">No records found.</td></tr>
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

      {/* ── Calendar Tab ──────────────────────────────────────────────────── */}
      {activeTab === "calendar" && (
        <>
          {/* Month navigation with prev/next buttons */}
          <div className="card shadow-sm mb-4">
            <div className="card-body py-2">
              <div className="d-flex justify-content-between align-items-center">
                <button className="btn btn-outline-primary btn-sm" onClick={() => navigateMonth(-1)}>
                  ◀ {MONTHS[getSlideMonthYear(-1).m - 1]} {getSlideMonthYear(-1).y}
                </button>
                <h5 className="mb-0 fw-bold">
                  📅 {MONTHS[calMonth - 1]} {calYear}
                </h5>
                <button className="btn btn-outline-primary btn-sm" onClick={() => navigateMonth(1)}>
                  {MONTHS[getSlideMonthYear(1).m - 1]} {getSlideMonthYear(1).y} ▶
                </button>
              </div>
            </div>
          </div>

          {/* Mini prev/next month calendars + main calendar */}
          <div className="row g-3 mb-3">
            {/* Previous month mini */}
            <div className="col-md-3 d-none d-md-block">
              <div className="card shadow-sm" style={{ opacity: 0.7 }}>
                <div className="card-header text-center py-1 bg-light">
                  <small className="fw-semibold">{MONTHS[getSlideMonthYear(-1).m - 1]} {getSlideMonthYear(-1).y}</small>
                </div>
                <div className="card-body p-1">
                  <table className="table table-bordered mb-0 text-center" style={{ tableLayout: "fixed", fontSize: "0.65rem" }}>
                    <thead>
                      <tr>{["S","M","T","W","T","F","S"].map((d,i) => <th key={i} className="p-0 bg-light">{d}</th>)}</tr>
                    </thead>
                    <tbody>
                      {buildCalGrid(getSlideMonthYear(-1).m, getSlideMonthYear(-1).y, []).map((week, wi) => (
                        <tr key={wi}>
                          {week.map((day, di) => (
                            <td key={di} className="p-0" style={{ height: 18 }}>
                              {day ? parseInt(day.date.slice(-2)) : ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Main calendar */}
            <div className="col-md-6">
              <div className="card shadow-sm">
                <div className="card-body p-2">
                  <table className="table table-bordered mb-0 text-center" style={{ tableLayout: "fixed" }}>
                    <thead>
                      <tr>
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                          <th key={d} className="bg-light py-2" style={{ fontSize: "0.8rem" }}>{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {calendarGrid.map((week, wi) => (
                        <tr key={wi}>
                          {week.map((day, di) => {
                            if (!day) return <td key={di} className="bg-light" style={{ height: 80 }}></td>;
                            const dayNum = parseInt(day.date.slice(-2));
                            const total = day.present_count + day.absent_count;
                            const pct = total > 0 ? Math.round((day.present_count / total) * 100) : 0;
                            const bg = total === 0
                              ? "#f8f9fa"
                              : pct >= 80 ? "#d1e7dd" : pct >= 60 ? "#fff3cd" : "#f8d7da";
                            const isSunday = di === 0;
                            const isSelected = selectedDay === day.date;
                            return (
                              <td key={di}
                                style={{
                                  height: 80, background: isSunday ? "#f0f0f0" : bg,
                                  verticalAlign: "top", padding: 4, cursor: "pointer",
                                  border: isSelected ? "2px solid #0d6efd" : undefined,
                                }}
                                onClick={() => handleDayClick(day.date)}
                              >
                                <div className="fw-bold" style={{ fontSize: "0.85rem" }}>{dayNum}</div>
                                {total > 0 && (
                                  <>
                                    <div style={{ fontSize: "0.7rem" }}>
                                      <span className="text-success">{day.present_count}P</span>
                                      {" / "}
                                      <span className="text-danger">{day.absent_count}A</span>
                                    </div>
                                    {day.late_count > 0 && (
                                      <div style={{ fontSize: "0.65rem" }} className="text-warning">{day.late_count} late</div>
                                    )}
                                  </>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="d-flex gap-3 mt-2 px-2">
                    <small><span className="d-inline-block rounded me-1" style={{ width: 12, height: 12, background: "#d1e7dd" }}></span> &ge;80% present</small>
                    <small><span className="d-inline-block rounded me-1" style={{ width: 12, height: 12, background: "#fff3cd" }}></span> 60–79%</small>
                    <small><span className="d-inline-block rounded me-1" style={{ width: 12, height: 12, background: "#f8d7da" }}></span> &lt;60%</small>
                    <small className="ms-auto text-muted">Click a day to see details</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Next month mini */}
            <div className="col-md-3 d-none d-md-block">
              <div className="card shadow-sm" style={{ opacity: 0.7 }}>
                <div className="card-header text-center py-1 bg-light">
                  <small className="fw-semibold">{MONTHS[getSlideMonthYear(1).m - 1]} {getSlideMonthYear(1).y}</small>
                </div>
                <div className="card-body p-1">
                  <table className="table table-bordered mb-0 text-center" style={{ tableLayout: "fixed", fontSize: "0.65rem" }}>
                    <thead>
                      <tr>{["S","M","T","W","T","F","S"].map((d,i) => <th key={i} className="p-0 bg-light">{d}</th>)}</tr>
                    </thead>
                    <tbody>
                      {buildCalGrid(getSlideMonthYear(1).m, getSlideMonthYear(1).y, []).map((week, wi) => (
                        <tr key={wi}>
                          {week.map((day, di) => (
                            <td key={di} className="p-0" style={{ height: 18 }}>
                              {day ? parseInt(day.date.slice(-2)) : ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Day Detail Panel */}
          {selectedDay && (
            <div className="card shadow-sm mb-3">
              <div className="card-header fw-semibold d-flex justify-content-between align-items-center bg-primary text-white">
                <span>📋 Attendance Detail — {selectedDay}</span>
                <button className="btn btn-sm btn-outline-light" onClick={() => { setSelectedDay(null); setDayDetail([]); }}>✕</button>
              </div>
              <div className="card-body">
                {dayLoading ? (
                  <div className="text-center py-3 text-muted">Loading...</div>
                ) : dayDetail.length === 0 ? (
                  <div className="text-center py-3 text-muted">No attendance data for this day.</div>
                ) : (
                  <>
                    <div className="d-flex gap-3 mb-3">
                      <span className="badge bg-success fs-6">
                        ✓ Present: {dayDetail.filter(e => e.status === "present").length}
                      </span>
                      <span className="badge bg-danger fs-6">
                        ✗ Absent: {dayDetail.filter(e => e.status === "absent").length}
                      </span>
                      <span className="badge bg-warning text-dark fs-6">
                        ⏰ Late: {dayDetail.filter(e => e.is_late).length}
                      </span>
                    </div>
                    <div className="row g-2">
                      {/* Present employees */}
                      <div className="col-md-6">
                        <h6 className="fw-bold text-success">✓ Present</h6>
                        <div className="list-group list-group-flush" style={{ maxHeight: 300, overflowY: "auto" }}>
                          {dayDetail.filter(e => e.status === "present").map(e => (
                            <div key={e.employee_id} className="list-group-item d-flex justify-content-between align-items-center py-1 px-2">
                              <div>
                                <span className="fw-semibold small">{e.name}</span>
                                {e.is_late && <span className="badge bg-warning text-dark ms-1" style={{ fontSize: "0.6rem" }}>Late</span>}
                              </div>
                              <div className="text-muted small">
                                {e.entry_time ?? "—"} – {e.exit_time ?? "—"}
                                {e.hours_worked != null && <span className="ms-2 text-primary">{Number(e.hours_worked).toFixed(1)}h</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Absent employees */}
                      <div className="col-md-6">
                        <h6 className="fw-bold text-danger">✗ Absent</h6>
                        <div className="list-group list-group-flush" style={{ maxHeight: 300, overflowY: "auto" }}>
                          {dayDetail.filter(e => e.status === "absent").map(e => (
                            <div key={e.employee_id} className="list-group-item py-1 px-2">
                              <span className="fw-semibold small">{e.name}</span>
                              <span className="badge bg-secondary ms-2" style={{ fontSize: "0.6rem" }}>{e.shift}</span>
                            </div>
                          ))}
                          {dayDetail.filter(e => e.status === "absent").length === 0 && (
                            <div className="text-muted small py-2">No absences 🎉</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
