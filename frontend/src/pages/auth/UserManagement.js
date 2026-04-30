import { useEffect, useState } from "react";
import { getUsers, createUser, deleteUser } from "../../api/authApi";
import { getAllEmployees } from "../../api/employeeApi";
import AlertMessage from "../../components/AlertMessage";

const EMPTY = { username: "", password: "", role: "worker", employee_id: "" };

export default function UserManagement() {
  const [users, setUsers]       = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm]         = useState(EMPTY);
  const [alert, setAlert]       = useState({ type: "", message: "" });
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    fetchUsers();
    getAllEmployees().then(r => setEmployees(r.data)).catch(() => {});
  }, []);

  async function fetchUsers() {
    try { const r = await getUsers(); setUsers(r.data); }
    catch (e) { setAlert({ type: "danger", message: e.message }); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await createUser({
        ...form,
        employee_id: form.employee_id ? parseInt(form.employee_id) : null,
      });
      setAlert({ type: "success", message: "User created successfully." });
      setForm(EMPTY);
      fetchUsers();
    } catch (e) { setAlert({ type: "danger", message: e.message }); }
    finally { setLoading(false); }
  }

  async function handleDelete(id) {
    try { await deleteUser(id); fetchUsers(); }
    catch (e) { setAlert({ type: "danger", message: e.message }); }
  }

  const ROLE_BADGE = { admin: "danger", supervisor: "warning", worker: "success" };

  return (
    <div>
      <h3 className="fw-bold mb-4">User Management</h3>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      <div className="row g-4">
        {/* Create user form */}
        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white fw-semibold">Create User</div>
            <div className="card-body">
              <form onSubmit={handleCreate}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Username</label>
                  <input className="form-control" value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Password</label>
                  <input className="form-control" type="password" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Role</label>
                  <select className="form-select" value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="admin">Admin</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="worker">Worker</option>
                  </select>
                </div>
                {form.role === "worker" && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Link to Employee</label>
                    <select className="form-select" value={form.employee_id}
                      onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} required>
                      <option value="">-- Select Employee --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button className="btn btn-primary w-100" type="submit" disabled={loading}>
                  {loading ? "Creating…" : "Create User"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Users list */}
        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-header bg-dark text-white fw-semibold">All Users</div>
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr><th>#</th><th>Username</th><th>Role</th><th>Linked Employee</th><th></th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td className="fw-semibold">{u.username}</td>
                      <td>
                        <span className={`badge bg-${ROLE_BADGE[u.role]}`}>
                          {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                      </td>
                      <td>{u.employee_id ? (employees.find(e => e.id === u.employee_id)?.name ?? `#${u.employee_id}`) : "—"}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(u.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
