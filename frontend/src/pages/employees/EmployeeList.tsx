import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllEmployees, deleteEmployee,
  downloadEmployeeTemplate, exportEmployees, importEmployees,
} from "../../api/employeeApi";
import type { ImportResult } from "../../api/employeeApi";
import AlertMessage from "../../components/AlertMessage";
import ConfirmModal from "../../components/ConfirmModal";
import { useAuth } from "../../context/AuthContext";
import type { Employee } from "../../types/employee";

function saveBlob(data: Blob, filename: string) {
  const url = window.URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function maskAadhar(num: string) {
  return num ? `XXXX-XXXX-${num.slice(-4)}` : "-";
}

export default function EmployeeList() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [perPage, setPerPage]     = useState(10);
  const [total, setTotal]         = useState(0);
  const [pages, setPages]         = useState(1);
  const [alert, setAlert]         = useState({ type: "", message: "" });
  const [deleteId, setDeleteId]   = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef              = useRef<HTMLInputElement>(null);
  const navigate                  = useNavigate();
  const { auth }                  = useAuth();
  // Employee edit/delete and bulk import/export follow the admin/master hierarchy;
  // supervisors can only view and add workers.
  const canManage = ["master", "admin"].includes(auth?.role || "");
  // Photos are stored as backend-relative paths (/uploads/...); prefix with the API origin.
  const apiBase = process.env.REACT_APP_API_URL || "http://localhost:8088";

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await getAllEmployees({ page, per_page: perPage, q: search || undefined });
      setEmployees(res.data.items);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }, [page, perPage, search]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { setPage(1); }, [search]);

  async function handleDelete() {
    try {
      await deleteEmployee(deleteId!);
      setAlert({ type: "success", message: "Employee deleted successfully." });
      setDeleteId(null);
      fetchEmployees();
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function handleDownloadTemplate() {
    try {
      const res = await downloadEmployeeTemplate();
      saveBlob(res.data, "employee_import_template.xlsx");
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function handleExport() {
    try {
      const res = await exportEmployees(search || undefined);
      saveBlob(res.data, `employees_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setAlert({ type: "success", message: "Employees exported." });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await importEmployees(file);
      setImportResult(res.data);
      setAlert({
        type: res.data.failed === 0 ? "success" : "warning",
        message: `Import finished: ${res.data.created} created, ${res.data.failed} failed (of ${res.data.total_rows} rows).`,
      });
      fetchEmployees();
    } catch (err: any) {
      setAlert({ type: "danger", message: err.message });
    } finally {
      setImporting(false);
    }
  }

  function getPageNumbers(): (number | "...")[] {
    const arr: (number | "...")[] = [];
    if (pages <= 7) { for (let i = 1; i <= pages; i++) arr.push(i); return arr; }
    arr.push(1);
    if (page > 3) arr.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) arr.push(i);
    if (page < pages - 2) arr.push("...");
    arr.push(pages);
    return arr;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h3 className="fw-bold mb-0">Employees</h3>
        <div className="d-flex gap-2 flex-wrap">
          {canManage && (
            <>
              <button className="btn btn-outline-secondary" onClick={handleDownloadTemplate}
                title="Download the sample Excel format for bulk import">
                📄 Sample Template
              </button>
              <button className="btn btn-outline-success" onClick={handleExport}>
                ⬇ Export Excel
              </button>
              <button className="btn btn-outline-primary" disabled={importing}
                onClick={() => fileInputRef.current?.click()}>
                {importing ? "Importing…" : "⬆ Import Excel"}
              </button>
              <input type="file" ref={fileInputRef} hidden
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleImportFile} />
            </>
          )}
          <button className="btn btn-primary" onClick={() => navigate("/employees/new")}>
            + Add Employee
          </button>
        </div>
      </div>

      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {importResult && importResult.errors.length > 0 && (
        <div className="card border-warning shadow-sm mb-3">
          <div className="card-header bg-warning-subtle d-flex justify-content-between align-items-center">
            <span className="fw-semibold">Import issues ({importResult.errors.length} rows skipped)</span>
            <button className="btn-close" onClick={() => setImportResult(null)} />
          </div>
          <div className="table-responsive" style={{ maxHeight: 240, overflowY: "auto" }}>
            <table className="table table-sm mb-0">
              <thead><tr><th style={{ width: 90 }}>Row</th><th>Problem</th></tr></thead>
              <tbody>
                {importResult.errors.map((err, i) => (
                  <tr key={i}><td>#{err.row}</td><td className="text-danger">{err.error}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="row g-2 mb-3">
        <div className="col">
          <input className="form-control" placeholder="Search by name, Aadhar, or bank account…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="col-auto">
          <select className="form-select" value={perPage} onChange={e => { setPerPage(+e.target.value); setPage(1); }}>
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-hover mb-0">
            <thead className="table-dark">
              <tr>
                <th>Photo</th>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Gender</th>
                <th>Aadhar</th>
                <th>Rate (₹)</th>
                <th>Shift</th>
                <th>KYC</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-muted py-4">No employees found.</td></tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      {emp.photo ? (
                        <img src={emp.photo.startsWith("http") ? emp.photo : `${apiBase}${emp.photo}`} alt={emp.name || "Employee"}
                          style={{ width: 42, height: 42, objectFit: "cover", borderRadius: "50%", border: "2px solid #dee2e6" }} />
                      ) : (
                        <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#e9ecef", border: "2px solid #dee2e6",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#adb5bd", fontWeight: 600 }}>
                          {(emp.name || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td><code className="text-primary fw-semibold">{emp.employee_code || `#${emp.id}`}</code></td>
                    <td className="fw-semibold">{emp.name || "—"}</td>
                    <td className="text-capitalize">{emp.gender || "—"}</td>
                    <td><code>{maskAadhar(emp.aadhar_number)}</code></td>
                    <td>₹{parseFloat(String(emp.hourly_rate)).toFixed(2)}</td>
                    <td><span className="badge bg-secondary">{emp.shift === "SHIFT_A" ? "A" : "B"}</span></td>
                    <td>
                      {emp.kyc_status === "verified" && <span className="badge bg-success">Verified</span>}
                      {emp.kyc_status === "failed" && <span className="badge bg-danger">Failed</span>}
                      {emp.kyc_status === "name_mismatch" && <span className="badge bg-warning">Mismatch</span>}
                      {(!emp.kyc_status || emp.kyc_status === "pending") && <span className="badge bg-secondary">Pending</span>}
                    </td>
                    <td>
                      {canManage ? (
                        <>
                          <button className="btn btn-sm btn-outline-primary me-1"
                            onClick={() => navigate(`/employees/${emp.id}/edit`)}>Edit</button>
                          <button className="btn btn-sm btn-outline-danger"
                            onClick={() => setDeleteId(emp.id)}>Delete</button>
                        </>
                      ) : (
                        <span className="text-muted small">View only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top">
            <small className="text-muted">
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
            </small>
            <nav>
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                  <button className="page-link" onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
                </li>
                {getPageNumbers().map((p, i) =>
                  p === "..." ? (
                    <li className="page-item disabled" key={`e${i}`}><span className="page-link">…</span></li>
                  ) : (
                    <li className={`page-item ${p === page ? "active" : ""}`} key={p}>
                      <button className="page-link" onClick={() => setPage(p)}>{p}</button>
                    </li>
                  )
                )}
                <li className={`page-item ${page === pages ? "disabled" : ""}`}>
                  <button className="page-link" onClick={() => setPage(p => Math.min(pages, p + 1))}>›</button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>

      <ConfirmModal
        show={!!deleteId}
        title="Delete Employee"
        message={`Delete employee #${deleteId}? All attendance and payslip records will be removed.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
