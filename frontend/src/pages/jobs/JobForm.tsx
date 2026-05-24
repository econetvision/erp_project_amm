import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createJob, getJob, updateJob } from "../../api/jobApi";
import { getUsers } from "../../api/authApi";
import AlertMessage from "../../components/AlertMessage";
import type { User } from "../../types/auth";

const JOB_TYPES = [
  { value: "absent_report", label: "Absent Report" },
  { value: "late_report", label: "Late Arrival Report" },
  { value: "custom", label: "Custom Report" },
];
const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const EMPTY = {
  name: "",
  type: "absent_report" as "absent_report" | "late_report" | "custom",
  frequency: "daily" as "daily" | "weekly" | "monthly",
  schedule_time: "08:00",
  schedule_day_of_week: null as number | null,
  schedule_day_of_month: null as number | null,
  delivery_channels: { email: true, in_app: true, whatsapp: false },
  recipients: [] as Array<{ type: "user" | "email"; value: string | number }>,
  filters: null as Record<string, any> | null,
  is_active: true,
};

export default function JobForm() {
  const { id }            = useParams();
  const isEdit            = Boolean(id);
  const navigate          = useNavigate();
  const [form, setForm]   = useState({ ...EMPTY });
  const [users, setUsers] = useState<User[]>([]);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    getUsers({ per_page: 100 }).then(r => setUsers(r.data.items)).catch(() => {});
    if (isEdit) {
      getJob(parseInt(id!)).then(({ data }) => {
        setForm({
          name: data.name,
          type: data.type,
          frequency: data.frequency,
          schedule_time: data.schedule_time,
          schedule_day_of_week: data.schedule_day_of_week,
          schedule_day_of_month: data.schedule_day_of_month,
          delivery_channels: data.delivery_channels,
          recipients: data.recipients,
          filters: data.filters,
          is_active: data.is_active,
        });
      }).catch((e: any) => setAlert({ type: "danger", message: e.message }));
    }
  }, [id, isEdit]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setAlert({ type: "warning", message: "Name is required" });
    setSaving(true);
    try {
      if (isEdit) {
        await updateJob(id!, form);
      } else {
        await createJob(form);
      }
      navigate("/jobs");
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setSaving(false);
    }
  }

  function toggleUserRecipient(userId: number) {
    setForm(f => {
      const exists = f.recipients.find(r => r.type === "user" && r.value === userId);
      return {
        ...f,
        recipients: exists
          ? f.recipients.filter(r => !(r.type === "user" && r.value === userId))
          : [...f.recipients, { type: "user" as const, value: userId }],
      };
    });
  }

  function addEmailRecipient() {
    if (!newEmail.includes("@")) return;
    setForm(f => ({ ...f, recipients: [...f.recipients, { type: "email" as const, value: newEmail }] }));
    setNewEmail("");
  }

  function removeRecipient(idx: number) {
    setForm(f => ({ ...f, recipients: f.recipients.filter((_, i) => i !== idx) }));
  }

  return (
    <div className="row justify-content-center">
      <div className="col-md-8">
        <h3 className="fw-bold mb-3">{isEdit ? "Edit Job Routine" : "Create Job Routine"}</h3>
        <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-primary text-white fw-semibold">Job Details</div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">Job Name *</label>
                <input className="form-control" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Daily Absent Report" />
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Report Type *</label>
                  <select className="form-select" value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                    {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Active</label>
                  <div className="form-check form-switch mt-1">
                    <input className="form-check-input" type="checkbox" checked={form.is_active}
                      onChange={() => setForm(f => ({ ...f, is_active: !f.is_active }))} />
                    <label className="form-check-label">{form.is_active ? "Active" : "Paused"}</label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Report Filters (only for type=custom) */}
          {form.type === "custom" && (
            <div className="card shadow-sm mb-4">
              <div className="card-header fw-semibold" style={{ background: "linear-gradient(135deg, #6f42c1, #d63384)", color: "white" }}>
                🔧 Custom Report Configuration
              </div>
              <div className="card-body">
                <p className="text-muted small mb-3">Configure what data to include in this custom report.</p>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Report Title</label>
                    <input className="form-control" value={form.filters?.report_title || ""}
                      onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, report_title: e.target.value } }))}
                      placeholder="e.g. Weekly Overtime Summary" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Date Range</label>
                    <select className="form-select" value={form.filters?.date_range || "last_7_days"}
                      onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, date_range: e.target.value } }))}>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="last_7_days">Last 7 Days</option>
                      <option value="last_30_days">Last 30 Days</option>
                      <option value="this_month">This Month</option>
                      <option value="last_month">Last Month</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>
                  {form.filters?.date_range === "custom" && (
                    <>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">From Date</label>
                        <input className="form-control" type="date" value={form.filters?.from_date || ""}
                          onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, from_date: e.target.value } }))} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">To Date</label>
                        <input className="form-control" type="date" value={form.filters?.to_date || ""}
                          onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, to_date: e.target.value } }))} />
                      </div>
                    </>
                  )}
                </div>

                <hr />
                <h6 className="fw-bold small mb-2">Include Sections</h6>
                <div className="row g-2">
                  {[
                    { key: "include_attendance", label: "📋 Attendance Summary", default: true },
                    { key: "include_late_arrivals", label: "⏰ Late Arrivals", default: true },
                    { key: "include_overtime", label: "⏱️ Overtime Report", default: false },
                    { key: "include_absent_list", label: "❌ Absent Employees", default: true },
                    { key: "include_payroll_summary", label: "💰 Payroll Summary", default: false },
                    { key: "include_location_stats", label: "📍 Location Statistics", default: false },
                    { key: "include_vehicle_status", label: "🚛 Vehicle Status", default: false },
                    { key: "include_employee_performance", label: "📊 Employee Performance", default: false },
                  ].map(section => (
                    <div className="col-md-6" key={section.key}>
                      <div className="form-check">
                        <input className="form-check-input" type="checkbox"
                          checked={form.filters?.[section.key] ?? section.default}
                          onChange={e => setForm(f => ({
                            ...f, filters: { ...f.filters, [section.key]: e.target.checked }
                          }))} />
                        <label className="form-check-label">{section.label}</label>
                      </div>
                    </div>
                  ))}
                </div>

                <hr />
                <h6 className="fw-bold small mb-2">Filter Employees</h6>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">Shift</label>
                    <select className="form-select form-select-sm" value={form.filters?.shift || "all"}
                      onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, shift: e.target.value } }))}>
                      <option value="all">All Shifts</option>
                      <option value="SHIFT_A">Shift A</option>
                      <option value="SHIFT_B">Shift B</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">Work Location</label>
                    <input className="form-control form-control-sm" value={form.filters?.work_location || ""}
                      onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, work_location: e.target.value } }))}
                      placeholder="All locations" />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">Output Format</label>
                    <select className="form-select form-select-sm" value={form.filters?.format || "html"}
                      onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, format: e.target.value } }))}>
                      <option value="html">HTML (Email)</option>
                      <option value="csv">CSV Attachment</option>
                      <option value="pdf">PDF Attachment</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Schedule */}
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-dark text-white fw-semibold">Schedule</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Frequency *</label>
                  <select className="form-select" value={form.frequency}
                    onChange={e => setForm(f => ({ ...f, frequency: e.target.value as any }))}>
                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Time *</label>
                  <input className="form-control" type="time" value={form.schedule_time}
                    onChange={e => setForm(f => ({ ...f, schedule_time: e.target.value }))} />
                </div>
                {form.frequency === "weekly" && (
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Day of Week</label>
                    <select className="form-select" value={form.schedule_day_of_week ?? ""}
                      onChange={e => setForm(f => ({ ...f, schedule_day_of_week: e.target.value ? parseInt(e.target.value) : null }))}>
                      <option value="">Select day</option>
                      {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                )}
                {form.frequency === "monthly" && (
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Day of Month</label>
                    <input className="form-control" type="number" min={1} max={28}
                      value={form.schedule_day_of_month ?? ""}
                      onChange={e => setForm(f => ({ ...f, schedule_day_of_month: e.target.value ? parseInt(e.target.value) : null }))} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Delivery */}
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-info text-white fw-semibold">Delivery Channels</div>
            <div className="card-body">
              <div className="d-flex gap-4 mb-3">
                {(["email", "in_app", "whatsapp"] as const).map(ch => (
                  <div className="form-check" key={ch}>
                    <input className="form-check-input" type="checkbox"
                      checked={form.delivery_channels[ch]}
                      onChange={() => setForm(f => ({
                        ...f,
                        delivery_channels: { ...f.delivery_channels, [ch]: !f.delivery_channels[ch] },
                      }))} />
                    <label className="form-check-label">
                      {ch === "email" ? "📧 Email" : ch === "in_app" ? "🔔 In-App" : "💬 WhatsApp"}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recipients */}
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-warning fw-semibold">Recipients</div>
            <div className="card-body">
              <p className="text-muted small">Select users or add email addresses to receive this report.</p>
              <div className="mb-3">
                <label className="form-label fw-semibold">Users (Admin &amp; Supervisors only)</label>
                <div className="d-flex flex-wrap gap-2">
                  {users.filter(u => u.role === "admin" || u.role === "supervisor").map(u => {
                    const selected = form.recipients.some(r => r.type === "user" && r.value === u.id);
                    return (
                      <button type="button" key={u.id}
                        className={`btn btn-sm ${selected ? "btn-primary" : "btn-outline-secondary"}`}
                        onClick={() => toggleUserRecipient(u.id)}>
                        <span className={`badge bg-${u.role === "admin" ? "danger" : "warning text-dark"} me-1`} style={{ fontSize: "0.6rem" }}>{u.role}</span>
                        {u.display_name || u.username}
                        {u.email && <span className="text-muted ms-1 small">({u.email})</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Additional Emails</label>
                <div className="input-group">
                  <input className="form-control" type="email" value={newEmail}
                    onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" />
                  <button className="btn btn-outline-primary" type="button" onClick={addEmailRecipient}>Add</button>
                </div>
              </div>
              {form.recipients.length > 0 && (
                <div>
                  <label className="form-label fw-semibold">Selected ({form.recipients.length})</label>
                  <div className="d-flex flex-wrap gap-1">
                    {form.recipients.map((r, i) => (
                      <span key={i} className="badge bg-secondary d-flex align-items-center gap-1">
                        {r.type === "user" ? `👤 ${users.find(u => u.id === r.value)?.username || r.value}` : `📧 ${r.value}`}
                        <button type="button" className="btn-close btn-close-white" style={{ fontSize: "0.5rem" }}
                          onClick={() => removeRecipient(i)} />
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="d-flex gap-2">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Update Job" : "Create Job"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => navigate("/jobs")}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
