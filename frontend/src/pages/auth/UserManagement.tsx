import { useEffect, useState, useCallback, type FormEvent } from "react";
import { getUsers, createUser, deleteUser, updateUser } from "../../api/authApi";
import AlertMessage from "../../components/AlertMessage";
import ConfirmModal from "../../components/ConfirmModal";
import MultiStepForm from "../../components/MultiStepForm";
import type { User } from "../../types/auth";

const EMPTY = {
  username: "", password: "", confirmPassword: "", role: "worker",
  display_name: "", email: "", phone: "", company_id: "",
};
const STEPS = [
  { title: "Account", icon: "🔑" },
  { title: "Profile", icon: "👤" },
  { title: "Review", icon: "✓" },
];

export default function UserManagement() {
  const [users, setUsers]         = useState<User[]>([]);
  const [form, setForm]           = useState(EMPTY);
  const [step, setStep]           = useState(0);
  const [alert, setAlert]         = useState({ type: "", message: "" });
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [perPage, setPerPage]     = useState(10);
  const [total, setTotal]         = useState(0);
  const [pages, setPages]         = useState(1);
  const [showForm, setShowForm]   = useState(false);
  const [delTarget, setDelTarget] = useState<User | null>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editForm, setEditForm]   = useState({ display_name: "", email: "", phone: "", role: "worker", password: "" });

  const fetchUsers = useCallback(async () => {
    try {
      const r = await getUsers({ page, per_page: perPage, q: search || undefined });
      setUsers(r.data.items);
      setTotal(r.data.total);
      setPages(r.data.pages);
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }, [page, perPage, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(1); }, [search]);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));
  }

  function canAdvance() {
    if (step === 0) {
      return form.username.length >= 3 && form.password.length >= 4
        && form.password === form.confirmPassword && form.role;
    }
    if (step === 1) {
      return form.display_name.trim().length > 0 && form.email.includes("@") && form.phone.length >= 10;
    }
    return true;
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createUser({
        username: form.username,
        password: form.password,
        role: form.role as "master" | "admin" | "supervisor" | "worker",
        company_id: form.company_id ? parseInt(form.company_id) : undefined,
        display_name: form.display_name || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
      });
      setAlert({ type: "success", message: `User "${form.username}" created successfully.` });
      setForm(EMPTY);
      setStep(0);
      setShowForm(false);
      fetchUsers();
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setLoading(false); }
  }

  async function confirmDelete() {
    if (!delTarget) return;
    try { await deleteUser(delTarget.id); fetchUsers(); setAlert({ type: "success", message: "User deleted." }); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setDelTarget(null); }
  }

  function openEdit(u: User) {
    setEditTarget(u);
    setEditForm({
      display_name: u.display_name || "",
      email: u.email || "",
      phone: u.phone || "",
      role: u.role,
      password: "",
    });
    setShowForm(false);
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setLoading(true);
    try {
      const payload: any = {};
      if (editForm.display_name) payload.display_name = editForm.display_name;
      if (editForm.email) payload.email = editForm.email;
      if (editForm.phone) payload.phone = editForm.phone;
      if (editForm.role) payload.role = editForm.role;
      if (editForm.password) payload.password = editForm.password;
      await updateUser(editTarget.id, payload);
      setAlert({ type: "success", message: `User "${editTarget.username}" updated.` });
      setEditTarget(null);
      fetchUsers();
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setLoading(false); }
  }

  const ROLE_BADGE: Record<string, string> = { master: "dark", admin: "danger", supervisor: "warning", worker: "success" };

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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold mb-0">User Management</h3>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setStep(0); setForm(EMPTY); }}>
          {showForm ? "Cancel" : "+ New User"}
        </button>
      </div>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {/* Multi-step Create Form */}
      {showForm && (
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-primary text-white fw-semibold">Create New User</div>
          <div className="card-body">
            <MultiStepForm steps={STEPS} current={step} onStepClick={i => i < step && setStep(i)}>
              <form onSubmit={handleCreate}>
                {/* Step 0: Account */}
                {step === 0 && (
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Username <span className="text-danger">*</span></label>
                      <input className="form-control" value={form.username} onChange={set("username")}
                        required minLength={3} placeholder="min 3 characters" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Role <span className="text-danger">*</span></label>
                      <select className="form-select" value={form.role} onChange={set("role")}>
                        <option value="master">Master</option>
                        <option value="admin">Admin</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="worker">Worker</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Password <span className="text-danger">*</span></label>
                      <input className="form-control" type="password" value={form.password}
                        onChange={set("password")} required minLength={4} placeholder="min 4 characters" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Confirm Password <span className="text-danger">*</span></label>
                      <input className={`form-control ${form.confirmPassword && form.password !== form.confirmPassword ? "is-invalid" : ""}`}
                        type="password" value={form.confirmPassword}
                        onChange={set("confirmPassword")} required />
                      {form.confirmPassword && form.password !== form.confirmPassword && (
                        <div className="invalid-feedback">Passwords do not match.</div>
                      )}
                    </div>
                    <div className="col-12 d-flex justify-content-end">
                      <button type="button" className="btn btn-primary" disabled={!canAdvance()}
                        onClick={() => setStep(1)}>
                        Next →
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 1: Profile */}
                {step === 1 && (
                  <div className="row g-3">
                    <div className="col-md-12">
                      <label className="form-label fw-semibold">Display Name <span className="text-danger">*</span></label>
                      <input className="form-control" value={form.display_name} onChange={set("display_name")}
                        required placeholder="Full name" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Email <span className="text-danger">*</span></label>
                      <input className="form-control" type="email" value={form.email} onChange={set("email")}
                        required placeholder="user@example.com" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Phone <span className="text-danger">*</span></label>
                      <input className="form-control" type="tel" value={form.phone} onChange={set("phone")}
                        required minLength={10} maxLength={15} placeholder="+91 1234567890" />
                    </div>
                    <div className="col-12 d-flex justify-content-between">
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setStep(0)}>← Back</button>
                      <button type="button" className="btn btn-primary" disabled={!canAdvance()}
                        onClick={() => setStep(2)}>
                        Next →
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Review */}
                {step === 2 && (
                  <div>
                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <div className="card bg-light">
                          <div className="card-body py-2">
                            <small className="text-muted">Username</small>
                            <div className="fw-semibold">{form.username}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="card bg-light">
                          <div className="card-body py-2">
                            <small className="text-muted">Role</small>
                            <div><span className={`badge bg-${ROLE_BADGE[form.role]}`}>{form.role}</span></div>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="card bg-light">
                          <div className="card-body py-2">
                            <small className="text-muted">Display Name</small>
                            <div className="fw-semibold">{form.display_name || "—"}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="card bg-light">
                          <div className="card-body py-2">
                            <small className="text-muted">Email</small>
                            <div className="fw-semibold">{form.email || "—"}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="card bg-light">
                          <div className="card-body py-2">
                            <small className="text-muted">Phone</small>
                            <div className="fw-semibold">{form.phone || "—"}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="d-flex justify-content-between">
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setStep(1)}>← Back</button>
                      <button type="submit" className="btn btn-success" disabled={loading}>
                        {loading ? "Creating…" : "✓ Create User"}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </MultiStepForm>
          </div>
        </div>
      )}

      {/* Users list with search + server-side pagination */}

      {/* Edit User Form */}
      {editTarget && (
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-warning fw-semibold d-flex justify-content-between align-items-center">
            <span>✏️ Edit User — {editTarget.username}</span>
            <button className="btn btn-sm btn-outline-dark" onClick={() => setEditTarget(null)}>✕</button>
          </div>
          <div className="card-body">
            <form onSubmit={handleEditSave}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Display Name</label>
                  <input className="form-control" value={editForm.display_name}
                    onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Role</label>
                  <select className="form-select" value={editForm.role}
                    onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="master">Master</option>
                    <option value="admin">Admin</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="worker">Worker</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Email</label>
                  <input className="form-control" type="email" value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Phone</label>
                  <input className="form-control" type="tel" value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">New Password <small className="text-muted">(leave blank to keep)</small></label>
                  <input className="form-control" type="password" value={editForm.password}
                    onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} minLength={4} placeholder="••••" />
                </div>
              </div>
              <div className="d-flex gap-2 mt-3">
                <button className="btn btn-success" type="submit" disabled={loading}>
                  {loading ? "Saving…" : "Save Changes"}
                </button>
                <button className="btn btn-outline-secondary" type="button" onClick={() => setEditTarget(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search and filter */}
      <div className="row g-2 mb-3">
        <div className="col">
          <input className="form-control" placeholder="Search users…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="col-auto">
          <select className="form-select" value={perPage} onChange={e => { setPerPage(+e.target.value); setPage(1); }}>
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
          </select>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-dark">
              <tr><th>#</th><th>Username</th><th>Display Name</th><th>Email</th><th>Phone</th><th>Role</th><th></th></tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted py-3">No users found.</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td className="fw-semibold">{u.username}</td>
                  <td>{u.display_name || "—"}</td>
                  <td>{u.email || "—"}</td>
                  <td>{u.phone || "—"}</td>
                  <td>
                    <span className={`badge bg-${ROLE_BADGE[u.role]}`}>
                      {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(u)}>Edit</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => setDelTarget(u)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
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
        show={!!delTarget}
        title="Delete User"
        message={`Delete user "${delTarget?.username}"? This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}
