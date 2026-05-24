import { useEffect, useState, useRef, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMe, updateProfile, changePassword, uploadUserPhoto } from "../../api/authApi";
import { getEmployee, patchEmployee } from "../../api/employeeApi";
import AlertMessage from "../../components/AlertMessage";
import type { User } from "../../types/auth";
import type { Employee, EmployeeUpdate } from "../../types/employee";

export default function Profile() {
  const { auth } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [alert, setAlert] = useState({ type: "", message: "" });

  // Profile form (user account)
  const [profileForm, setProfileForm] = useState({ display_name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Employee form
  const [empForm, setEmpForm] = useState<EmployeeUpdate>({});
  const [empSaving, setEmpSaving] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(false);

  // Password
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    getMe().then((res) => {
      setUser(res.data);
      setProfileForm({
        display_name: res.data.display_name || "",
        email: res.data.email || "",
        phone: res.data.phone || "",
      });
      // Fetch employee data if linked
      if (res.data.employee_id) {
        getEmployee(res.data.employee_id).then((eRes) => {
          setEmployee(eRes.data);
        }).catch(() => {});
      }
    }).catch((e: Error) => setAlert({ type: "danger", message: e.message }));
  }, []);

  const apiBase = process.env.REACT_APP_API_URL || "http://localhost:8088";
  const avatarUrl = user?.photo_path ? `${apiBase}${user.photo_path}` : null;
  const empPhotoUrl = employee?.photo ? `${apiBase}${employee.photo}` : null;

  // -- Account profile save
  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateProfile(profileForm);
      setUser(res.data);
      setAlert({ type: "success", message: "Profile updated successfully." });
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setSaving(false); }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setAlert({ type: "danger", message: "Image must be under 5 MB." }); return; }
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handlePhotoUpload() {
    if (!photoPreview) return;
    setSaving(true);
    try {
      const res = await uploadUserPhoto(photoPreview);
      setUser(res.data);
      setPhotoPreview(null);
      setAlert({ type: "success", message: "Photo updated." });
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setSaving(false); }
  }

  // -- Employee data edit
  function startEditEmployee() {
    if (!employee) return;
    setEmpForm({
      name: employee.name,
      gender: employee.gender || undefined,
      date_of_birth: employee.date_of_birth || undefined,
      blood_group: employee.blood_group || undefined,
      marital_status: employee.marital_status || undefined,
      emergency_contact: employee.emergency_contact || undefined,
      emergency_name: employee.emergency_name || undefined,
      phone: employee.phone || undefined,
      email: employee.email || undefined,
      address: employee.address || undefined,
    });
    setEditingEmployee(true);
  }

  async function handleEmployeeSave(e: FormEvent) {
    e.preventDefault();
    if (!employee) return;
    setEmpSaving(true);
    try {
      const res = await patchEmployee(employee.id, empForm);
      setEmployee(res.data);
      setEditingEmployee(false);
      setAlert({ type: "success", message: "Employee details updated." });
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setEmpSaving(false); }
  }

  // -- Password change
  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) {
      setAlert({ type: "danger", message: "New passwords do not match." }); return;
    }
    setPwSaving(true);
    try {
      await changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      setAlert({ type: "success", message: "Password changed successfully." });
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setPwSaving(false); }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-lg-10">
        <h3 className="fw-bold mb-4">👤 My Profile</h3>
        <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

        <div className="row g-4">
          {/* ── LEFT: Account Card ── */}
          <div className="col-md-4">
            <div className="card shadow-sm text-center">
              <div className="card-body py-4">
                {avatarUrl || photoPreview ? (
                  <img src={photoPreview || avatarUrl!} alt="Avatar"
                    className="rounded-circle border mb-3" style={{ width: 120, height: 120, objectFit: "cover" }} />
                ) : (
                  <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center mx-auto mb-3 text-white fw-bold"
                    style={{ width: 120, height: 120, fontSize: 42 }}>
                    {(user?.display_name || user?.username || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <h5 className="fw-bold mb-1">{user?.display_name || user?.username || "—"}</h5>
                <span className={`badge bg-${auth?.role === "admin" ? "danger" : auth?.role === "supervisor" ? "warning text-dark" : "success"} mb-2`}>
                  {auth?.role?.toUpperCase()}
                </span>
                <div className="text-muted small mb-3">@{user?.username}</div>

                <input type="file" ref={fileRef} className="d-none" accept="image/*" onChange={handleFileSelect} />
                <div className="d-flex gap-2 justify-content-center">
                  <button className="btn btn-sm btn-outline-primary" onClick={() => fileRef.current?.click()}>Change Photo</button>
                  {photoPreview && <button className="btn btn-sm btn-primary" onClick={handlePhotoUpload} disabled={saving}>Save</button>}
                </div>

                {/* Quick info */}
                <hr />
                <div className="text-start px-2">
                  {user?.employee_id && (
                    <div className="d-flex justify-content-between small mb-2">
                      <span className="text-muted">Employee ID</span>
                      <span className="fw-semibold">#{user.employee_id}</span>
                    </div>
                  )}
                  {employee?.shift && (
                    <div className="d-flex justify-content-between small mb-2">
                      <span className="text-muted">Shift</span>
                      <span className="fw-semibold">{employee.shift}</span>
                    </div>
                  )}
                  {employee?.work_location_name && (
                    <div className="d-flex justify-content-between small mb-2">
                      <span className="text-muted">Work Location</span>
                      <span className="fw-semibold">{employee.work_location_name}</span>
                    </div>
                  )}
                  {employee?.kyc_status && (
                    <div className="d-flex justify-content-between small mb-2">
                      <span className="text-muted">KYC Status</span>
                      <span className={`badge bg-${employee.kyc_status === "verified" ? "success" : "warning text-dark"}`}>{employee.kyc_status}</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between small mb-2">
                    <span className="text-muted">Member Since</span>
                    <span className="fw-semibold">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Details ── */}
          <div className="col-md-8">
            {/* Account Details */}
            <div className="card shadow-sm mb-3">
              <div className="card-header bg-primary text-white fw-semibold d-flex justify-content-between align-items-center">
                <span>Account Details</span>
              </div>
              <div className="card-body">
                <form onSubmit={handleProfileSave}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small">Display Name</label>
                      <input className="form-control form-control-sm" value={profileForm.display_name}
                        onChange={e => setProfileForm(p => ({ ...p, display_name: e.target.value }))} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small">Username</label>
                      <input className="form-control form-control-sm" value={user?.username || ""} disabled />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small">Email</label>
                      <input className="form-control form-control-sm" type="email" value={profileForm.email}
                        onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small">Phone</label>
                      <input className="form-control form-control-sm" value={profileForm.phone}
                        onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm mt-3" type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save Account"}
                  </button>
                </form>
              </div>
            </div>

            {/* Employee Details (if linked) */}
            {employee && (
              <div className="card shadow-sm mb-3">
                <div className="card-header bg-dark text-white fw-semibold d-flex justify-content-between align-items-center">
                  <span>Employee Details</span>
                  {!editingEmployee && (
                    <button className="btn btn-sm btn-outline-light" onClick={startEditEmployee}>Edit</button>
                  )}
                </div>
                <div className="card-body">
                  {editingEmployee ? (
                    <form onSubmit={handleEmployeeSave}>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label fw-semibold small">Full Name</label>
                          <input className="form-control form-control-sm" value={empForm.name || ""}
                            onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label fw-semibold small">Gender</label>
                          <select className="form-select form-select-sm" value={empForm.gender || ""}
                            onChange={e => setEmpForm(f => ({ ...f, gender: e.target.value }))}>
                            <option value="">—</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label fw-semibold small">Date of Birth</label>
                          <input className="form-control form-control-sm" type="date" value={empForm.date_of_birth || ""}
                            onChange={e => setEmpForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label fw-semibold small">Blood Group</label>
                          <select className="form-select form-select-sm" value={empForm.blood_group || ""}
                            onChange={e => setEmpForm(f => ({ ...f, blood_group: e.target.value }))}>
                            <option value="">—</option>
                            {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label fw-semibold small">Marital Status</label>
                          <select className="form-select form-select-sm" value={empForm.marital_status || ""}
                            onChange={e => setEmpForm(f => ({ ...f, marital_status: e.target.value }))}>
                            <option value="">—</option>
                            <option value="single">Single</option>
                            <option value="married">Married</option>
                            <option value="divorced">Divorced</option>
                            <option value="widowed">Widowed</option>
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-semibold small">Phone</label>
                          <input className="form-control form-control-sm" value={empForm.phone || ""}
                            onChange={e => setEmpForm(f => ({ ...f, phone: e.target.value }))} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-semibold small">Email</label>
                          <input className="form-control form-control-sm" type="email" value={empForm.email || ""}
                            onChange={e => setEmpForm(f => ({ ...f, email: e.target.value }))} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-semibold small">Emergency Contact Name</label>
                          <input className="form-control form-control-sm" value={empForm.emergency_name || ""}
                            onChange={e => setEmpForm(f => ({ ...f, emergency_name: e.target.value }))} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-semibold small">Emergency Contact Number</label>
                          <input className="form-control form-control-sm" value={empForm.emergency_contact || ""}
                            onChange={e => setEmpForm(f => ({ ...f, emergency_contact: e.target.value }))} />
                        </div>
                        <div className="col-12">
                          <label className="form-label fw-semibold small">Address</label>
                          <textarea className="form-control form-control-sm" rows={2} value={empForm.address || ""}
                            onChange={e => setEmpForm(f => ({ ...f, address: e.target.value }))} />
                        </div>
                      </div>
                      <div className="d-flex gap-2 mt-3">
                        <button className="btn btn-success btn-sm" type="submit" disabled={empSaving}>
                          {empSaving ? "Saving…" : "Save Employee Details"}
                        </button>
                        <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setEditingEmployee(false)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div className="row g-2">
                      <div className="col-md-6">
                        <table className="table table-sm table-borderless mb-0">
                          <tbody>
                            <tr><td className="text-muted" style={{ width: "40%" }}>Name</td><td className="fw-semibold">{employee.name}</td></tr>
                            <tr><td className="text-muted">Gender</td><td>{employee.gender || "—"}</td></tr>
                            <tr><td className="text-muted">Date of Birth</td><td>{employee.date_of_birth || "—"}</td></tr>
                            <tr><td className="text-muted">Blood Group</td><td>{employee.blood_group || "—"}</td></tr>
                            <tr><td className="text-muted">Marital Status</td><td>{employee.marital_status || "—"}</td></tr>
                            <tr><td className="text-muted">Phone</td>
                              <td>
                                {employee.phone || "—"}
                                {employee.phone_verified === "Y" && <span className="badge bg-success ms-1">Verified</span>}
                              </td>
                            </tr>
                            <tr><td className="text-muted">Email</td>
                              <td>
                                {employee.email || "—"}
                                {employee.email_verified === "Y" && <span className="badge bg-success ms-1">Verified</span>}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className="col-md-6">
                        <table className="table table-sm table-borderless mb-0">
                          <tbody>
                            <tr><td className="text-muted" style={{ width: "40%" }}>Emergency Name</td><td>{employee.emergency_name || "—"}</td></tr>
                            <tr><td className="text-muted">Emergency Contact</td><td>{employee.emergency_contact || "—"}</td></tr>
                            <tr><td className="text-muted">Address</td><td>{employee.address || "—"}</td></tr>
                            <tr><td className="text-muted">Aadhar</td><td>{employee.aadhar_number ? `****${employee.aadhar_number.slice(-4)}` : "—"}</td></tr>
                            <tr><td className="text-muted">Bank Account</td><td>{employee.bank_account_number ? `****${employee.bank_account_number.slice(-4)}` : "—"}</td></tr>
                            <tr><td className="text-muted">Bank / IFSC</td><td>{[employee.bank_name, employee.ifsc_code].filter(Boolean).join(" / ") || "—"}</td></tr>
                            <tr><td className="text-muted">Hourly Rate</td><td>₹{employee.hourly_rate}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Change Password */}
            <div className="card shadow-sm mb-3">
              <div className="card-header bg-warning fw-semibold">Change Password</div>
              <div className="card-body">
                <form onSubmit={handlePasswordChange}>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold small">Current Password</label>
                      <input className="form-control form-control-sm" type="password" value={pwForm.current_password}
                        onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} required autoComplete="current-password" />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold small">New Password</label>
                      <input className="form-control form-control-sm" type="password" value={pwForm.new_password}
                        onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} required minLength={4} autoComplete="new-password" />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold small">Confirm Password</label>
                      <input className={`form-control form-control-sm ${pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password ? "is-invalid" : ""}`}
                        type="password" value={pwForm.confirm_password}
                        onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))} required minLength={4} autoComplete="new-password" />
                    </div>
                  </div>
                  <button className="btn btn-warning btn-sm mt-3" type="submit" disabled={pwSaving}>
                    {pwSaving ? "Changing…" : "Change Password"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
