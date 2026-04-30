import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { getDashboardOverview, getEmployeeStats } from "../../api/dashboardApi";
import { getHolidays, createHoliday, deleteHoliday } from "../../api/holidayApi";
import { useAuth } from "../../context/AuthContext";
import AlertMessage from "../../components/AlertMessage";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Holiday Panel (admin-only) ────────────────────────────────────────────────
function HolidayPanel({ year, onChanged }) {
  const [holidays, setHolidays] = useState([]);
  const [newDate,  setNewDate]  = useState("");
  const [newName,  setNewName]  = useState("");
  const [open,     setOpen]     = useState(false);

  async function load() {
    try { const r = await getHolidays(year); setHolidays(r.data); }
    catch {}
  }

  useEffect(() => { load(); }, [year]);

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await createHoliday({ date: newDate, name: newName });
      setNewDate(""); setNewName("");
      await load();
      onChanged();
    } catch {}
  }

  async function handleDelete(id) {
    try { await deleteHoliday(id); await load(); onChanged(); }
    catch {}
  }

  return (
    <div className="card shadow-sm mt-4">
      <div
        className="card-header bg-secondary text-white fw-semibold d-flex justify-content-between align-items-center"
        style={{ cursor: "pointer" }}
        onClick={() => setOpen(o => !o)}
      >
        <span>Public Holidays — {year}</span>
        <span>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="card-body">
          <form className="row g-2 mb-3" onSubmit={handleAdd}>
            <div className="col-md-3">
              <input type="date" className="form-control" value={newDate}
                onChange={e => setNewDate(e.target.value)} required />
            </div>
            <div className="col-md-5">
              <input className="form-control" placeholder="Holiday name (e.g. Diwali)"
                value={newName} onChange={e => setNewName(e.target.value)} required />
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary w-100" type="submit">Add</button>
            </div>
          </form>
          {holidays.length === 0 ? (
            <p className="text-muted small">No holidays added for {year}.</p>
          ) : (
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr><th>Date</th><th>Name</th><th></th></tr>
              </thead>
              <tbody>
                {holidays.map(h => (
                  <tr key={h.id}>
                    <td>{h.date}</td>
                    <td>{h.name}</td>
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
function SummaryCard({ label, value, colorClass, sub }) {
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
  const [overview,  setOverview]      = useState(null);
  const [empStats,  setEmpStats]      = useState([]);
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
    } catch (e) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDashboard(month, year); }, [month, year]);

  // ── Derived values ────────────────────────────────────────────────────────
  const today     = todayStr();
  const todayEntry = overview?.daily_entries?.find(e => e.date === today);
  const todayPresent = todayEntry?.present_count ?? "—";
  const todayAbsent  = todayEntry?.absent_count  ?? "—";
  const todayLate    = todayEntry?.late_count     ?? "—";
  const avgRate = empStats.length
    ? (empStats.reduce((s, e) => s + e.attendance_rate, 0) / empStats.length).toFixed(1)
    : "—";

  // Bar chart data: date labels as MM-DD
  const barData = (overview?.daily_entries ?? []).map(e => ({
    date:    e.date.slice(5),
    present: e.present_count,
    absent:  e.absent_count,
  }));

  // Horizontal bar: attendance rate by employee, sorted desc
  const rateData = [...empStats]
    .sort((a, b) => b.attendance_rate - a.attendance_rate)
    .map(e => ({ name: e.name, rate: e.attendance_rate }));

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
          {/* Daily present vs absent bar chart */}
          <div className="col-md-7">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold">Daily Attendance — {MONTHS[month - 1]} {year}</div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ paddingTop: 8 }} />
                    <Bar dataKey="present" fill="#198754" name="Present" />
                    <Bar dataKey="absent"  fill="#dc3545" name="Absent"  />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Attendance rate horizontal bar chart */}
          <div className="col-md-5">
            <div className="card shadow-sm h-100">
              <div className="card-header fw-semibold">Attendance Rate by Employee</div>
              <div className="card-body" style={{ overflowY: "auto" }}>
                {rateData.length === 0 ? (
                  <p className="text-muted small">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, rateData.length * 38)}>
                    <BarChart layout="vertical" data={rateData}
                      margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={v => `${v}%`} />
                      <ReferenceLine x={80} stroke="#ffc107" strokeDasharray="4 4"
                        label={{ value: "80%", position: "insideTopRight", fontSize: 10 }} />
                      <Bar dataKey="rate" fill="#0d6efd" name="Attendance Rate"
                        radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
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

      {/* Admin-only Holiday Panel */}
      {auth?.role === "admin" && (
        <HolidayPanel year={year} onChanged={() => fetchDashboard(month, year)} />
      )}
    </div>
  );
}
