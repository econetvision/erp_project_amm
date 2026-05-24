import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getJobs, deleteJob, runJobNow, updateJob } from "../../api/jobApi";
import AlertMessage from "../../components/AlertMessage";
import Pagination from "../../components/Pagination";
import type { JobRoutine } from "../../types/job";

const TYPE_LABELS: Record<string, string> = {
  absent_report: "📋 Absent Report",
  late_report: "⏰ Late Arrivals",
  custom: "🔧 Custom",
};
const FREQ_LABELS: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function JobList() {
  const navigate = useNavigate();
  const [jobs, setJobs]     = useState<JobRoutine[]>([]);
  const [alert, setAlert]   = useState({ type: "", message: "" });
  const [running, setRunning] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try { const { data } = await getJobs(); setJobs(data); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  async function handleToggle(job: JobRoutine) {
    try {
      await updateJob(job.id, { is_active: !job.is_active });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, is_active: !j.is_active } : j));
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  async function handleRun(id: number) {
    setRunning(id);
    try {
      const { data } = await runJobNow(id);
      setAlert({ type: data.status === "success" ? "success" : "warning", message: data.result_summary || data.error_message || "Job executed" });
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setRunning(null); }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this job?")) return;
    try { await deleteJob(id); setJobs(prev => prev.filter(j => j.id !== id)); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  function scheduleLabel(j: JobRoutine) {
    let s = `${FREQ_LABELS[j.frequency]} at ${j.schedule_time}`;
    if (j.frequency === "weekly" && j.schedule_day_of_week != null) s += ` (${DAY_NAMES[j.schedule_day_of_week]})`;
    if (j.frequency === "monthly" && j.schedule_day_of_month != null) s += ` (Day ${j.schedule_day_of_month})`;
    return s;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="fw-bold mb-0">Job Routines</h3>
        <button className="btn btn-primary" onClick={() => navigate("/jobs/new")}>+ New Job</button>
      </div>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {jobs.length === 0 ? (
        <div className="text-center text-muted py-5">No job routines configured yet.</div>
      ) : (
        <Pagination items={jobs} pageSize={9}>
        {(pageItems, pagination) => (
        <>
        <div className="row g-3">
          {pageItems.map(j => (
            <div className="col-md-6 col-lg-4" key={j.id}>
              <div className={`card shadow-sm h-100 ${!j.is_active ? "opacity-50" : ""}`}>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h6 className="fw-bold mb-0">{j.name}</h6>
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" checked={j.is_active}
                        onChange={() => handleToggle(j)} title="Toggle active" />
                    </div>
                  </div>
                  <div className="mb-2">
                    <span className="badge bg-info me-1">{TYPE_LABELS[j.type]}</span>
                    <span className="badge bg-secondary">{scheduleLabel(j)}</span>
                  </div>
                  <div className="small text-muted mb-2">
                    Channels: {j.delivery_channels.email && "📧 Email "}{j.delivery_channels.in_app && "🔔 In-App "}{j.delivery_channels.whatsapp && "💬 WhatsApp"}
                  </div>
                  <div className="small text-muted mb-3">
                    Recipients: {j.recipients.length} configured
                  </div>
                  <div className="d-flex gap-1">
                    <button className="btn btn-sm btn-outline-success" onClick={() => handleRun(j.id)}
                      disabled={running === j.id}>{running === j.id ? "Running…" : "▶ Run Now"}</button>
                    <button className="btn btn-sm btn-outline-primary" onClick={() => navigate(`/jobs/${j.id}/edit`)}>Edit</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(j.id)}>Delete</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {pagination}
        </>
        )}
        </Pagination>
      )}
    </div>
  );
}
