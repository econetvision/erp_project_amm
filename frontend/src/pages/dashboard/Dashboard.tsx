import { useEffect, useState } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { getDashboardOverview, getEmployeeStats } from "../../api/dashboardApi";
import { getHolidays, createHoliday, deleteHoliday } from "../../api/holidayApi";
import { useAuth } from "../../context/AuthContext";
import AlertMessage from "../../components/AlertMessage";
import SystemInfo from "../../components/SystemInfo";
import type { Holiday } from "../../types/vehicle";
import type { DashboardOverview, EmployeeStat, DailyEntry } from "../../types/attendance";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Holiday Panel (admin-only) ────────────────────────────────────────────────
function HolidayPanel({ year, onChanged }: { year: number; onChanged: () => void }) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newDate,  setNewDate]  = useState("");
  const [newName,  setNewName]  = useState("");
  const [newType,  setNewType]  = useState("public");
  const [newOptional, setNewOptional] = useState(false);
  const [open,     setOpen]     = useState(false);

  async function load() {
    try { const r = await getHolidays(year); setHolidays(r.data); }
    catch {}
  }

  useEffect(() => { load(); }, [year]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createHoliday({ date: newDate, name: newName, holiday_type: newType, is_optional: newOptional });
      setNewDate(""); setNewName(""); setNewType("public"); setNewOptional(false);
      await load();
      onChanged();
    } catch {}
  }

  async function handleDelete(id: number) {
    try { await deleteHoliday(id); await load(); onChanged(); }
    catch {}
  }

  const typeBadge: Record<string, string> = { public: "danger", company: "primary", optional: "secondary" };

  return (
    <div className="card shadow-sm mt-4">
      <div
        className="card-header bg-secondary text-white fw-semibold d-flex justify-content-between align-items-center"
        style={{ cursor: "pointer" }}
        onClick={() => setOpen(o => !o)}
      >
        <span>Holidays — {year}</span>
        <span>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="card-body">
          <form className="row g-2 mb-3 align-items-end" onSubmit={handleAdd}>
            <div className="col-md-2">
              <label className="form-label small">Date</label>
              <input type="date" className="form-control form-control-sm" value={newDate}
                onChange={e => setNewDate(e.target.value)} required />
            </div>
            <div className="col-md-3">
              <label className="form-label small">Name</label>
              <input className="form-control form-control-sm" placeholder="e.g. Diwali"
                value={newName} onChange={e => setNewName(e.target.value)} required />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Type</label>
              <select className="form-select form-select-sm" value={newType}
                onChange={e => setNewType(e.target.value)}>
                <option value="public">Public</option>
                <option value="company">Company</option>
                <option value="optional">Optional</option>
              </select>
            </div>
            <div className="col-md-2 d-flex align-items-center pt-3">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked={newOptional}
                  onChange={e => setNewOptional(e.target.checked)} id="optChk" />
                <label className="form-check-label small" htmlFor="optChk">Optional</label>
              </div>
            </div>
            <div className="col-md-1">
              <button className="btn btn-primary btn-sm w-100" type="submit">Add</button>
            </div>
          </form>
          {holidays.length === 0 ? (
            <p className="text-muted small">No holidays added for {year}.</p>
          ) : (
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr><th>Date</th><th>Name</th><th>Type</th><th></th></tr>
              </thead>
              <tbody>
                {holidays.map(h => (
                  <tr key={h.id}>
                    <td>{h.date}</td>
                    <td>{h.name}</td>
                    <td>
                      <span className={`badge bg-${typeBadge[h.holiday_type] || "secondary"}`}>
                        {h.holiday_type}
                      </span>
                      {h.is_optional && <span className="badge bg-light text-dark ms-1">Optional</span>}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDelete(h.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Summary Card ──────────────────────────────────────────────────────────────
function SummaryCard({ label, value, colorClass, sub }: { label: string; value: string | number; colorClass: string; sub?: string }) {
  return (
    <div className="col-md-3 col-6">
      <div className={`card shadow-sm border-0 text-white ${colorClass}`}>
        <div className="card-body text-center py-3">
          <div className="fw-bold" style={{ fontSize: "2.2rem", lineHeight: 1 }}>{value}</div>
          <div className="small mt-1 fw-semibold">{label}</div>
          {sub && <div className="opacity-75" style={{ fontSize: "0.72rem" }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { auth }                      = useAuth();
  const now                           = new Date();
  const [month, setMonth]             = useState(now.getMonth() + 1);
  const [year,  setYear]              = useState(now.getFullYear());
  const [overview,  setOverview]      = useState<DashboardOverview | null>(null);
  const [empStats,  setEmpStats]      = useState<EmployeeStat[]>([]);
  const [loading,   setLoading]       = useState(false);
  const [alert,     setAlert]         = useState({ type: "", message: "" });

  async function fetchDashboard(m = month, y = year) {
    setLoading(true);
    try {
      const [ovRes, statRes] = await Promise.all([
        getDashboardOverview(m, y),
        getEmployeeStats(m, y),
      ]);
      setOverview(ovRes.data);
      setEmpStats(statRes.data);
      setAlert({ type: "", message: "" });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDashboard(month, year); }, [month, year]);

  // ── Derived values ────────────────────────────────────────────────────────
  const today     = todayStr();
  const todayEntry = overview?.daily_entries?.find((e: DailyEntry) => e.date === today);
  const todayPresent = todayEntry?.present_count ?? "—";
  const todayAbsent  = todayEntry?.absent_count  ?? "—";
  const todayLate    = todayEntry?.late_count     ?? "—";
  const avgRate = empStats.length
    ? (empStats.reduce((s, e) => s + e.attendance_rate, 0) / empStats.length).toFixed(1)
    : "—";

  // Bar chart data: date labels as MM-DD
  const barData = (overview?.daily_entries ?? []).map((e: DailyEntry) => ({
    date:    e.date.slice(5),
    present: e.present_count,
    absent:  e.absent_count,
  }));

  return (
    <div>
      <h3 className="fw-bold mb-4">Analytics Dashboard</h3>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {/* Controls */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-semibold">Month</label>
              <select className="form-select" value={month}
                onChange={e => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label fw-semibold">Year</label>
              <input type="number" className="form-control" value={year} min={2000}
                onChange={e => setYear(Number(e.target.value))} />
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary w-100"
                onClick={() => fetchDashboard(month, year)} disabled={loading}>
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
            {overview && (
              <div className="col-md-5 text-end text-muted small pt-2">
                {overview.total_employees} employees · {overview.working_days} working days
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="row g-3 mb-4">
        <SummaryCard label="Today Present"  value={todayPresent} colorClass="bg-success" sub="employees clocked in" />
        <SummaryCard label="Today Absent"   value={todayAbsent}  colorClass="bg-danger"  sub="not clocked in" />
        <SummaryCard label="Today Late"     value={todayLate}    colorClass="bg-warning text-dark" sub=">10 min past shift" />
        <SummaryCard label="Monthly Avg Attendance" value={avgRate === "—" ? "—" : `${avgRate}%`} colorClass="bg-primary" sub={`${MONTHS[month - 1]} ${year}`} />
      </div>

      {/* Charts row */}
      {overview && (
        <div className="row g-4 mb-4">
          {/* Daily attendance area chart */}
          <div className="col-lg-8">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold">Daily Attendance — {MONTHS[month - 1]} {year}</div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                    <defs>
                      <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#198754" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#198754" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gAbsent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#dc3545" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#dc3545" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 2px 8px rgba(0,0,0,.15)" }} />
                    <Legend wrapperStyle={{ paddingTop: 8 }} />
                    <Area type="monotone" dataKey="present" stroke="#198754" fill="url(#gPresent)" name="Present" strokeWidth={2} />
                    <Area type="monotone" dataKey="absent" stroke="#dc3545" fill="url(#gAbsent)" name="Absent" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Today's donut chart */}
          <div className="col-lg-4">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold">Today's Snapshot</div>
              <div className="card-body d-flex flex-column align-items-center justify-content-center">
                {todayEntry ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Present", value: todayEntry.present_count },
                            { name: "Absent", value: todayEntry.absent_count },
                            { name: "Late", value: todayEntry.late_count },
                          ]}
                          cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                          paddingAngle={3} dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          <Cell fill="#198754" />
                          <Cell fill="#dc3545" />
                          <Cell fill="#ffc107" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="d-flex gap-3 mt-2">
                      <small><span className="badge bg-success">Present</span> {todayEntry.present_count}</small>
                      <small><span className="badge bg-danger">Absent</span> {todayEntry.absent_count}</small>
                      <small><span className="badge bg-warning text-dark">Late</span> {todayEntry.late_count}</small>
                    </div>
                  </>
                ) : (
                  <p className="text-muted">No data for today</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee stats table */}
      {empStats.length > 0 && (
        <div className="card shadow-sm mb-4">
          <div className="card-header fw-semibold">Employee Statistics — {MONTHS[month - 1]} {year}</div>
          <div className="table-responsive">
            <table className="table table-striped table-hover mb-0">
              <thead className="table-dark">
                <tr>
                  <th>Employee</th>
                  <th>Shift</th>
                  <th>Days Present</th>
                  <th>Days Absent</th>
                  <th>Attendance Rate</th>
                  <th>Late Days</th>
                  <th>Overtime (hrs)</th>
                </tr>
              </thead>
              <tbody>
                {empStats.map(e => (
                  <tr key={e.employee_id}>
                    <td className="fw-semibold">{e.name}</td>
                    <td>
                      <span className="badge bg-secondary">
                        {e.shift === "SHIFT_A" ? "Shift A" : "Shift B"}
                      </span>
                    </td>
                    <td>{e.days_present}</td>
                    <td>{e.days_absent}</td>
                    <td>
                      <span className={`badge ${
                        e.attendance_rate >= 80 ? "bg-success"
                        : e.attendance_rate >= 60 ? "bg-warning text-dark"
                        : "bg-danger"
                      }`}>
                        {e.attendance_rate}%
                      </span>
                    </td>
                    <td>
                      {e.late_days > 0
                        ? <span className="badge bg-warning text-dark">{e.late_days}</span>
                        : 0}
                    </td>
                    <td>
                      {e.overtime_hours > 0
                        ? <span className="text-success fw-semibold">{e.overtime_hours.toFixed(2)}</span>
                        : "0.00"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* System & Deployment Info (admin/master only) */}
      {(auth?.role === "admin" || auth?.role === "master") && <SystemInfo />}

      {/* Admin-only Holiday Panel */}
      {auth?.role === "admin" && (
        <HolidayPanel year={year} onChanged={() => fetchDashboard(month, year)} />
      )}
    </div>
  );
}
