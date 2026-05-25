import { useEffect, useState, type FormEvent } from "react";
import { getRoles, getPermissions, getPermissionModules, createRole, updateRole, deleteRole } from "../../api/rbacApi";
import AlertMessage from "../../components/AlertMessage";
import ConfirmModal from "../../components/ConfirmModal";
import { useAuth } from "../../context/AuthContext";
import type { Role, Permission } from "../../types/company";

export default function RolesPermissions() {
  const { auth } = useAuth();
  const isMaster = auth?.role === "master";
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Role | null>(null);
  const [delTarget, setDelTarget] = useState<Role | null>(null);
  const [expandedRole, setExpandedRole] = useState<number | null>(null);

  // Form
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPerms, setFormPerms] = useState<number[]>([]);

  async function load() {
    try {
      const [r, p, m] = await Promise.all([getRoles(), getPermissions(), getPermissionModules()]);
      setRoles(r.data);
      setPermissions(p.data);
      setModules(m.data);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setFormName("");
    setFormDesc("");
    setFormPerms([]);
    setShowForm(true);
  }

  function openEdit(role: Role) {
    setEditTarget(role);
    setFormName(role.name);
    setFormDesc(role.description || "");
    setFormPerms(role.permissions.map(p => p.id));
    setShowForm(true);
  }

  function togglePerm(id: number) {
    setFormPerms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  function toggleModule(module: string) {
    const modulePerms = permissions.filter(p => p.module === module).map(p => p.id);
    const allSelected = modulePerms.every(id => formPerms.includes(id));
    if (allSelected) {
      setFormPerms(prev => prev.filter(id => !modulePerms.includes(id)));
    } else {
      setFormPerms(prev => [...new Set([...prev, ...modulePerms])]);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      if (editTarget) {
        await updateRole(editTarget.id, { name: formName, description: formDesc, permissions: formPerms });
        setAlert({ type: "success", message: `Role "${formName}" updated.` });
      } else {
        await createRole({ name: formName, description: formDesc, permissions: formPerms });
        setAlert({ type: "success", message: `Role "${formName}" created.` });
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function confirmDelete() {
    if (!delTarget) return;
    try {
      await deleteRole(delTarget.id);
      setAlert({ type: "success", message: `Role "${delTarget.name}" deleted.` });
      load();
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setDelTarget(null);
    }
  }

  if (loading) return <div className="d-flex justify-content-center py-5"><div className="spinner-border text-primary" /></div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold mb-0">Roles & Permissions</h3>
        <button className="btn btn-primary" onClick={showForm ? () => setShowForm(false) : openCreate}>
          {showForm ? "Cancel" : "+ New Role"}
        </button>
      </div>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {/* Role Form */}
      {showForm && (
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-primary text-white fw-semibold">
            {editTarget ? `Edit Role: ${editTarget.name}` : "Create New Role"}
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Role Name *</label>
                  <input className="form-control" value={formName} onChange={e => setFormName(e.target.value)} required />
                </div>
                <div className="col-md-8">
                  <label className="form-label fw-semibold">Description</label>
                  <input className="form-control" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
                </div>
              </div>

              <h6 className="fw-semibold mb-2">Permissions</h6>
              {modules.map(mod => {
                const modPerms = permissions.filter(p => p.module === mod);
                const allSelected = modPerms.every(p => formPerms.includes(p.id));
                return (
                  <div key={mod} className="mb-3">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <input type="checkbox" className="form-check-input"
                        checked={allSelected} onChange={() => toggleModule(mod)} />
                      <span className="fw-semibold text-uppercase small text-primary">{mod}</span>
                    </div>
                    <div className="row g-2 ms-4">
                      {modPerms.map(p => (
                        <div className="col-md-3" key={p.id}>
                          <div className="form-check">
                            <input className="form-check-input" type="checkbox"
                              checked={formPerms.includes(p.id)}
                              onChange={() => togglePerm(p.id)} />
                            <label className="form-check-label small">{p.name}</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="text-end mt-3">
                <button className="btn btn-secondary me-2" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn btn-primary" type="submit">
                  {editTarget ? "Save Changes" : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Roles List */}
      <div className="card shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Role</th>
                  <th>Type</th>
                  <th>Permissions</th>
                  <th>Description</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {roles.map(role => (
                  <>
                    <tr key={role.id}>
                      <td className="fw-semibold">{role.name}</td>
                      <td>
                        <span className={`badge bg-${role.is_system ? "dark" : "info"}`}>
                          {role.is_system ? "System" : "Custom"}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-link p-0"
                          onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}>
                          {role.permissions.length} permissions {expandedRole === role.id ? "▲" : "▼"}
                        </button>
                      </td>
                      <td className="text-muted small">{role.description || "—"}</td>
                      <td className="text-end">
                        {(!role.is_system || isMaster) && (
                          <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(role)}>
                            Edit
                          </button>
                        )}
                        {!role.is_system && (
                          <button className="btn btn-sm btn-outline-danger" onClick={() => setDelTarget(role)}>
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedRole === role.id && (
                      <tr key={`${role.id}-perms`}>
                        <td colSpan={5} className="bg-light">
                          <div className="d-flex flex-wrap gap-1 p-2">
                            {role.permissions.map(p => (
                              <span key={p.id} className="badge bg-primary bg-opacity-25 text-primary">
                                {p.code}
                              </span>
                            ))}
                            {role.permissions.length === 0 && (
                              <span className="text-muted">No permissions assigned.</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmModal
        show={!!delTarget}
        title="Delete Role"
        message={`Delete role "${delTarget?.name}"? This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}
