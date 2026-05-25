import { useEffect, useState, useCallback, type FormEvent } from "react";
import { getCompanies, createCompany, updateCompany, deleteCompany } from "../../api/companyApi";
import AlertMessage from "../../components/AlertMessage";
import ConfirmModal from "../../components/ConfirmModal";
import ServerPagination from "../../components/ServerPagination";
import type { Company, CompanyCreate } from "../../types/company";

const EMPTY: CompanyCreate = {
  name: "", code: "", address: "", city: "", state: "", country: "India",
  pincode: "", phone: "", email: "", website: "", gst_number: "", pan_number: "",
  timezone: "Asia/Kolkata", currency: "INR",
};

export default function CompanyList() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [delTarget, setDelTarget] = useState<Company | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getCompanies({ page, per_page: perPage, q: search || undefined });
      setCompanies(r.data.items);
      setTotal(r.data.total);
      setPages(r.data.pages);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search]);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { setPage(1); }, [search]);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createCompany(form);
      setAlert({ type: "success", message: `Company "${form.name}" created.` });
      setForm(EMPTY);
      setShowForm(false);
      fetch();
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setLoading(false);
    }
  }

  function openEdit(c: Company) {
    setEditTarget(c);
    setForm({
      name: c.name, code: c.code, address: c.address || "", city: c.city || "",
      state: c.state || "", country: c.country || "India", pincode: c.pincode || "",
      phone: c.phone || "", email: c.email || "", website: c.website || "",
      gst_number: c.gst_number || "", pan_number: c.pan_number || "",
      timezone: c.timezone || "Asia/Kolkata", currency: c.currency || "INR",
    });
    setShowForm(true);
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setLoading(true);
    try {
      await updateCompany(editTarget.id, form);
      setAlert({ type: "success", message: `Company "${form.name}" updated.` });
      setEditTarget(null);
      setShowForm(false);
      setForm(EMPTY);
      fetch();
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!delTarget) return;
    try {
      await deleteCompany(delTarget.id);
      setAlert({ type: "success", message: `Company "${delTarget.name}" deleted.` });
      fetch();
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setDelTarget(null);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold mb-0">Company Management</h3>
        <button className="btn btn-primary" onClick={() => {
          setShowForm(!showForm); setEditTarget(null); setForm(EMPTY);
        }}>
          {showForm ? "Cancel" : "+ New Company"}
        </button>
      </div>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {/* Create / Edit Form */}
      {showForm && (
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-primary text-white fw-semibold">
            {editTarget ? `Edit: ${editTarget.name}` : "Create New Company"}
          </div>
          <div className="card-body">
            <form onSubmit={editTarget ? handleEdit : handleCreate}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Company Name *</label>
                  <input className="form-control" value={form.name} onChange={set("name")} required />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Code *</label>
                  <input className="form-control" value={form.code} onChange={set("code")} required
                    placeholder="e.g. ACME" style={{ textTransform: "uppercase" }} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Currency</label>
                  <input className="form-control" value={form.currency} onChange={set("currency")} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Email</label>
                  <input className="form-control" type="email" value={form.email} onChange={set("email")} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Phone</label>
                  <input className="form-control" value={form.phone} onChange={set("phone")} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Website</label>
                  <input className="form-control" value={form.website} onChange={set("website")} />
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold">Address</label>
                  <textarea className="form-control" rows={2} value={form.address} onChange={set("address")} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">City</label>
                  <input className="form-control" value={form.city} onChange={set("city")} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">State</label>
                  <input className="form-control" value={form.state} onChange={set("state")} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Country</label>
                  <input className="form-control" value={form.country} onChange={set("country")} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Pincode</label>
                  <input className="form-control" value={form.pincode} onChange={set("pincode")} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">GST Number</label>
                  <input className="form-control" value={form.gst_number} onChange={set("gst_number")} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">PAN Number</label>
                  <input className="form-control" value={form.pan_number} onChange={set("pan_number")} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Timezone</label>
                  <select className="form-select" value={form.timezone} onChange={set("timezone")}>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 text-end">
                <button className="btn btn-secondary me-2" type="button" onClick={() => { setShowForm(false); setEditTarget(null); }}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {editTarget ? "Save Changes" : "Create Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-3">
        <input className="form-control" placeholder="Search companies..." value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="card shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {companies.map(c => (
                  <tr key={c.id}>
                    <td className="fw-semibold">{c.name}</td>
                    <td><code>{c.code}</code></td>
                    <td>{c.city || "—"}</td>
                    <td>
                      <span className={`badge bg-${c.is_active ? "success" : "secondary"}`}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-muted small">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(c)}>Edit</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => setDelTarget(c)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted py-4">No companies found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {pages > 1 && (
        <div className="mt-3">
          <ServerPagination page={page} pages={pages} onPageChange={setPage} />
        </div>
      )}

      <ConfirmModal
        show={!!delTarget}
        title="Delete Company"
        message={`Are you sure you want to delete "${delTarget?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}
