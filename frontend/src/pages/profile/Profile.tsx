import { useEffect, useState, useRef, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  getMe, updateProfile, changePassword, uploadUserPhoto,
  sendVerification, verifyCode, setPin, removePin,
} from "../../api/authApi";
import { getEmployee, patchEmployee } from "../../api/employeeApi";
import AlertMessage from "../../components/AlertMessage";
import type { User } from "../../types/auth";
import type { Employee, EmployeeUpdate } from "../../types/employee";

type Tab = "account" | "employee" | "password" | "security" | "notifications" | "appearance";

export default function Profile() {
  const { auth } = useAuth();
  const role = auth?.role;
  const isAdmin = role === "master" || role === "admin";

  const [user, setUser]       = useState<User | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [alert, setAlert]     = useState({ type: "", message: "" });
  const [tab, setTab]         = useState<Tab>("account");

  /* Account */
  const [profile, setProfile] = useState({ display_name: "", email: "", phone: "" });
  const [saving, setSaving]   = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Employee */
  const [empForm, setEmpForm] = useState<EmployeeUpdate>({});
  const [empSaving, setEmpSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  /* Password */
  const [pwForm, setPwForm]   = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [pwSaving, setPwSaving] = useState(false);

  /* Verification */
  const [verifying, setVerifying] = useState<"email" | "phone" | null>(null);
  const [verifyCode_, setVerifyCode_] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  /* PIN */
  const [pinForm, setPinForm] = useState({ pin: "", confirm_pin: "", current_password: "" });
  const [pinSaving, setPinSaving] = useState(false);

  /* Lock */
  const [lockTimeout, setLockTimeout] = useState(2);
  const [lockSaving, setLockSaving] = useState(false);

  /* Theme */
  const { theme, saveTheme } = useTheme();
  const [themeForm, setThemeForm] = useState({
    mode: theme.mode as "light" | "dark" | "custom",
    primaryColor: theme.primaryColor,
    accentColor: theme.accentColor,
  });
  const [themeSaving, setThemeSaving] = useState(false);

  const apiBase = process.env.REACT_APP_API_URL || "http://localhost:8088";
  const avatarUrl = user?.photo_path ? `${apiBase}${user.photo_path}` : null;

  /* ── Load ──────────────────────────────────────────────────────── */
  useEffect(() => {
    getMe().then(res => {
      setUser(res.data);
      setProfile({ display_name: res.data.display_name || "", email: res.data.email || "", phone: res.data.phone || "" });
      setLockTimeout(res.data.lock_timeout ?? 2);
      if (res.data.employee_id) {
        getEmployee(res.data.employee_id).then(e => setEmployee(e.data)).catch(() => {});
      }
    }).catch((e: Error) => setAlert({ type: "danger", message: e.message }));
  }, []);

  /* ── Account ───────────────────────────────────────────────────── */
  async function handleProfileSave(e: FormEvent) {
    e.preventDefault(); setSaving(true);
    try { const r = await updateProfile(profile); setUser(r.data); setAlert({ type: "success", message: "Profile saved." }); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setSaving(false); }
  }
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setAlert({ type: "danger", message: "Image must be under 5 MB." }); return; }
    const r = new FileReader(); r.onload = () => setPhotoPreview(r.result as string); r.readAsDataURL(f);
  }
  async function handlePhotoUpload() {
    if (!photoPreview) return; setSaving(true);
    try { const r = await uploadUserPhoto(photoPreview); setUser(r.data); setPhotoPreview(null); setAlert({ type: "success", message: "Photo updated." }); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setSaving(false); }
  }

  /* ── Verification ──────────────────────────────────────────────── */
  async function handleSendCode(type: "email" | "phone") {
    setVerifying(type); setCodeSent(false); setVerifyCode_(""); setDebugCode(null);
    try { const r = await sendVerification(type); setCodeSent(true); setDebugCode(r.data.debug_code || null);
      setAlert({ type: "info", message: `Code sent to your ${type}.` }); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); setVerifying(null); }
  }
  async function handleVerifyCode() {
    if (!verifying) return;
    try { const r = await verifyCode(verifying, verifyCode_); setAlert({ type: "success", message: r.data.detail });
      setVerifying(null); setCodeSent(false); setVerifyCode_(""); setDebugCode(null); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  /* ── Employee ──────────────────────────────────────────────────── */
  function startEdit() {
    if (!employee) return;
    setEmpForm({
      name: employee.name, gender: employee.gender || undefined,
      date_of_birth: employee.date_of_birth || undefined,
      blood_group: employee.blood_group || undefined,
      marital_status: employee.marital_status || undefined,
      emergency_contact: employee.emergency_contact || undefined,
      emergency_name: employee.emergency_name || undefined,
      phone: employee.phone || undefined, email: employee.email || undefined,
      address: employee.address || undefined,
    });
    setEditing(true);
  }
  async function handleEmpSave(e: FormEvent) {
    e.preventDefault(); if (!employee) return; setEmpSaving(true);
    try { const r = await patchEmployee(employee.id, empForm); setEmployee(r.data); setEditing(false);
      setAlert({ type: "success", message: "Employee details updated." }); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setEmpSaving(false); }
  }

  /* ── Password ──────────────────────────────────────────────────── */
  async function handlePwChange(e: FormEvent) {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) { setAlert({ type: "danger", message: "Passwords do not match." }); return; }
    setPwSaving(true);
    try { await changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      setAlert({ type: "success", message: "Password changed." }); setPwForm({ current_password: "", new_password: "", confirm_password: "" }); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setPwSaving(false); }
  }

  /* ── PIN ────────────────────────────────────────────────────────── */
  async function handleSetPin(e: FormEvent) {
    e.preventDefault();
    if (pinForm.pin !== pinForm.confirm_pin) { setAlert({ type: "danger", message: "PINs do not match." }); return; }
    if (pinForm.pin.length < 4 || pinForm.pin.length > 8) { setAlert({ type: "danger", message: "PIN must be 4–8 digits." }); return; }
    setPinSaving(true);
    try { await setPin(pinForm.pin, pinForm.current_password);
      setAlert({ type: "success", message: "PIN set." }); setPinForm({ pin: "", confirm_pin: "", current_password: "" });
      const r = await getMe(); setUser(r.data); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setPinSaving(false); }
  }
  async function handleRemovePin() {
    setPinSaving(true);
    try { await removePin(); setAlert({ type: "success", message: "PIN removed." }); const r = await getMe(); setUser(r.data); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setPinSaving(false); }
  }

  /* ── Lock ───────────────────────────────────────────────────────── */
  async function handleLockSave() {
    setLockSaving(true);
    try { const r = await updateProfile({ ...profile, lock_timeout: lockTimeout } as any); setUser(r.data);
      setAlert({ type: "success", message: `Lock timeout: ${lockTimeout} min` }); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setLockSaving(false); }
  }

  /* ── Theme ──────────────────────────────────────────────────────── */
  async function handleThemeSave() {
    setThemeSaving(true);
    try { await saveTheme(themeForm); setAlert({ type: "success", message: "Theme saved." }); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setThemeSaving(false); }
  }

  /* ── Tabs config ───────────────────────────────────────────────── */
  const tabs: { key: Tab; label: string; icon: string; show: boolean }[] = [
    { key: "account",       label: "Account",       icon: "👤", show: true },
    { key: "employee",      label: "Employee",      icon: "🪪", show: !!employee },
    { key: "password",      label: "Password",      icon: "🔑", show: true },
    { key: "security",      label: "Security",      icon: "🛡️", show: true },
    { key: "notifications", label: "Notifications", icon: "🔔", show: true },
    { key: "appearance",    label: "Appearance",     icon: "🎨", show: true },
  ];
  const visibleTabs = tabs.filter(t => t.show);

  /* ── RENDER ────────────────────────────────────────────────────── */
  return (
    <div className="row justify-content-center">
      <div className="col-lg-11">
        <h3 className="fw-bold mb-4">👤 Profile &amp; Settings</h3>
        <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

        <div className="row g-4">
          {/* LEFT — Avatar Card */}
          <div className="col-md-3">
            <div className="card shadow-sm text-center">
              <div className="card-body py-4">
                {avatarUrl || photoPreview ? (
                  <img src={photoPreview || avatarUrl!} alt="Avatar"
                    className="rounded-circle border mb-3" style={{ width: 110, height: 110, objectFit: "cover" }} />
                ) : (
                  <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center mx-auto mb-3 text-white fw-bold"
                    style={{ width: 110, height: 110, fontSize: 40 }}>
                    {(user?.display_name || user?.username || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <h5 className="fw-bold mb-1">{user?.display_name || user?.username || "—"}</h5>
                <span className={`badge bg-${role === "master" ? "dark" : role === "admin" ? "danger" : role === "supervisor" ? "warning text-dark" : "success"} mb-2`}>
                  {role?.toUpperCase()}
                </span>
                <div className="text-muted small mb-3">@{user?.username}</div>

                <input type="file" ref={fileRef} className="d-none" accept="image/*" onChange={handleFileSelect} />
                <div className="d-flex gap-2 justify-content-center">
                  <button className="btn btn-sm btn-outline-primary" onClick={() => fileRef.current?.click()}>Change Photo</button>
                  {photoPreview && <button className="btn btn-sm btn-primary" onClick={handlePhotoUpload} disabled={saving}>Save</button>}
                </div>

                <hr />
                <div className="text-start px-2">
                  {user?.employee_id && (
                    <div className="d-flex justify-content-between small mb-2">
                      <span className="text-muted">Employee ID</span><span className="fw-semibold">#{user.employee_id}</span>
                    </div>
                  )}
                  {employee?.shift && (
                    <div className="d-flex justify-content-between small mb-2">
                      <span className="text-muted">Shift</span><span className="fw-semibold">{employee.shift}</span>
                    </div>
                  )}
                  {employee?.work_location_name && (
                    <div className="d-flex justify-content-between small mb-2">
                      <span className="text-muted">Location</span><span className="fw-semibold">{employee.work_location_name}</span>
                    </div>
                  )}
                  {employee?.kyc_status && (
                    <div className="d-flex justify-content-between small mb-2">
                      <span className="text-muted">KYC</span>
                      <span className={`badge bg-${employee.kyc_status === "verified" ? "success" : "warning text-dark"}`}>{employee.kyc_status}</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between small mb-2">
                    <span className="text-muted">Since</span>
                    <span className="fw-semibold">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</span>
                  </div>
                </div>

                {/* Vertical nav */}
                <hr />
                <div className="list-group list-group-flush text-start">
                  {visibleTabs.map(t => (
                    <button key={t.key}
                      className={`list-group-item list-group-item-action py-2 ${tab === t.key ? "active" : ""}`}
                      onClick={() => setTab(t.key)}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Tab content */}
          <div className="col-md-9">
            {/* ═══ ACCOUNT ═══ */}
            {tab === "account" && (
              <div className="card shadow-sm mb-3">
                <div className="card-header bg-primary text-white fw-semibold">Account Details</div>
                <div className="card-body">
                  <form onSubmit={handleProfileSave}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold small">Display Name</label>
                        <input className="form-control form-control-sm" value={profile.display_name}
                          onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold small">Username</label>
                        <input className="form-control form-control-sm" value={user?.username || ""} disabled />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold small">Email</label>
                        <div className="input-group input-group-sm">
                          <input className="form-control" type="email" value={profile.email}
                            onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
                          <button className="btn btn-outline-secondary" type="button"
                            onClick={() => handleSendCode("email")} disabled={!profile.email || verifying === "email"}>
                            {verifying === "email" && codeSent ? "Sent" : "Verify"}
                          </button>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold small">Phone</label>
                        <div className="input-group input-group-sm">
                          <input className="form-control" value={profile.phone}
                            onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
                          <button className="btn btn-outline-secondary" type="button"
                            onClick={() => handleSendCode("phone")} disabled={!profile.phone || verifying === "phone"}>
                            {verifying === "phone" && codeSent ? "Sent" : "Verify"}
                          </button>
                        </div>
                      </div>
                    </div>
                    {verifying && codeSent && (
                      <div className="mt-3 p-3 border rounded bg-light">
                        <label className="form-label fw-semibold small">Code sent to your {verifying}</label>
                        <div className="input-group input-group-sm">
                          <input className="form-control" value={verifyCode_}
                            onChange={e => setVerifyCode_(e.target.value)} placeholder="6-digit code" maxLength={6} />
                          <button className="btn btn-success" type="button" onClick={handleVerifyCode} disabled={verifyCode_.length !== 6}>Verify</button>
                          <button className="btn btn-outline-secondary" type="button" onClick={() => { setVerifying(null); setCodeSent(false); }}>Cancel</button>
                        </div>
                        {debugCode && <small className="text-muted mt-1 d-block">Debug: <strong>{debugCode}</strong></small>}
                      </div>
                    )}
                    <button className="btn btn-primary btn-sm mt-3" type="submit" disabled={saving}>
                      {saving ? "Saving…" : "Save Account"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ═══ EMPLOYEE ═══ */}
            {tab === "employee" && employee && (
              <div className="card shadow-sm mb-3">
                <div className="card-header bg-dark text-white fw-semibold d-flex justify-content-between align-items-center">
                  <span>Employee Details</span>
                  {!editing && <button className="btn btn-sm btn-outline-light" onClick={startEdit}>Edit</button>}
                </div>
                <div className="card-body">
                  {editing ? (
                    <form onSubmit={handleEmpSave}>
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
                            <option value="">—</option><option value="male">Male</option>
                            <option value="female">Female</option><option value="other">Other</option>
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
                            <option value="">—</option><option value="single">Single</option>
                            <option value="married">Married</option><option value="divorced">Divorced</option>
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
                          <label className="form-label fw-semibold small">Emergency Name</label>
                          <input className="form-control form-control-sm" value={empForm.emergency_name || ""}
                            onChange={e => setEmpForm(f => ({ ...f, emergency_name: e.target.value }))} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-semibold small">Emergency Contact</label>
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
                          {empSaving ? "Saving…" : "Save"}
                        </button>
                        <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setEditing(false)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div className="row g-2">
                      <div className="col-md-6">
                        <table className="table table-sm table-borderless mb-0"><tbody>
                          <tr><td className="text-muted" style={{width:"40%"}}>Name</td><td className="fw-semibold">{employee.name}</td></tr>
                          <tr><td className="text-muted">Gender</td><td>{employee.gender || "—"}</td></tr>
                          <tr><td className="text-muted">DOB</td><td>{employee.date_of_birth || "—"}</td></tr>
                          <tr><td className="text-muted">Blood Group</td><td>{employee.blood_group || "—"}</td></tr>
                          <tr><td className="text-muted">Marital Status</td><td>{employee.marital_status || "—"}</td></tr>
                          <tr><td className="text-muted">Phone</td><td>{employee.phone || "—"} {employee.phone_verified === "Y" && <span className="badge bg-success ms-1">✓</span>}</td></tr>
                          <tr><td className="text-muted">Email</td><td>{employee.email || "—"} {employee.email_verified === "Y" && <span className="badge bg-success ms-1">✓</span>}</td></tr>
                        </tbody></table>
                      </div>
                      <div className="col-md-6">
                        <table className="table table-sm table-borderless mb-0"><tbody>
                          <tr><td className="text-muted" style={{width:"40%"}}>Emergency</td><td>{employee.emergency_name || "—"}</td></tr>
                          <tr><td className="text-muted">Emergency #</td><td>{employee.emergency_contact || "—"}</td></tr>
                          <tr><td className="text-muted">Address</td><td>{employee.address || "—"}</td></tr>
                          <tr><td className="text-muted">Aadhar</td><td>{employee.aadhar_number ? `****${employee.aadhar_number.slice(-4)}` : "—"}</td></tr>
                          <tr><td className="text-muted">Bank Acct</td><td>{employee.bank_account_number ? `****${employee.bank_account_number.slice(-4)}` : "—"}</td></tr>
                          <tr><td className="text-muted">Bank/IFSC</td><td>{[employee.bank_name, employee.ifsc_code].filter(Boolean).join(" / ") || "—"}</td></tr>
                          <tr><td className="text-muted">Hourly Rate</td><td>₹{employee.hourly_rate}</td></tr>
                        </tbody></table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ PASSWORD ═══ */}
            {tab === "password" && (
              <div className="card shadow-sm mb-3">
                <div className="card-header bg-warning fw-semibold">Change Password</div>
                <div className="card-body">
                  <form onSubmit={handlePwChange}>
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
                        <label className="form-label fw-semibold small">Confirm</label>
                        <input className={`form-control form-control-sm ${pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password ? "is-invalid" : ""}`}
                          type="password" value={pwForm.confirm_password}
                          onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))} required minLength={4} autoComplete="new-password" />
                        {pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password && <div className="invalid-feedback">Passwords don't match.</div>}
                      </div>
                    </div>
                    <button className="btn btn-warning btn-sm mt-3" type="submit" disabled={pwSaving}>
                      {pwSaving ? "Changing…" : "Change Password"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ═══ SECURITY ═══ */}
            {tab === "security" && (
              <>
                {/* PIN */}
                <div className="card shadow-sm mb-3">
                  <div className="card-header fw-semibold" style={{ background: "#6f42c1", color: "#fff" }}>
                    Lock PIN {user?.has_pin && <span className="badge bg-success ms-2">Active</span>}
                  </div>
                  <div className="card-body">
                    {user?.has_pin ? (
                      <div>
                        <p className="text-muted small">PIN active. Use it to unlock sessions.</p>
                        <div className="d-flex gap-2">
                          <button className="btn btn-outline-danger btn-sm" onClick={handleRemovePin} disabled={pinSaving}>Remove PIN</button>
                          <button className="btn btn-outline-primary btn-sm" onClick={() => setPinForm({ pin: "", confirm_pin: "", current_password: "" })}>Change PIN</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted small mb-2">Set a 4–8 digit PIN for quick session unlock.</p>
                    )}
                    <form onSubmit={handleSetPin} className="mt-3">
                      <div className="row g-3">
                        <div className="col-md-4">
                          <label className="form-label fw-semibold small">PIN</label>
                          <input className="form-control form-control-sm" type="password" value={pinForm.pin}
                            onChange={e => setPinForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, "").slice(0, 8) }))}
                            placeholder="••••" required minLength={4} maxLength={8} inputMode="numeric" />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label fw-semibold small">Confirm PIN</label>
                          <input className={`form-control form-control-sm ${pinForm.confirm_pin && pinForm.pin !== pinForm.confirm_pin ? "is-invalid" : ""}`}
                            type="password" value={pinForm.confirm_pin}
                            onChange={e => setPinForm(p => ({ ...p, confirm_pin: e.target.value.replace(/\D/g, "").slice(0, 8) }))}
                            placeholder="••••" required minLength={4} maxLength={8} inputMode="numeric" />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label fw-semibold small">Password</label>
                          <input className="form-control form-control-sm" type="password" value={pinForm.current_password}
                            onChange={e => setPinForm(p => ({ ...p, current_password: e.target.value }))}
                            required autoComplete="current-password" />
                        </div>
                      </div>
                      <button className="btn btn-primary btn-sm mt-3" type="submit" disabled={pinSaving}>
                        {pinSaving ? "Saving…" : user?.has_pin ? "Update PIN" : "Set PIN"}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Lock Timeout */}
                <div className="card shadow-sm mb-3">
                  <div className="card-header fw-semibold bg-primary text-white">Auto-Lock Timeout</div>
                  <div className="card-body">
                    <div className="row g-3 align-items-end">
                      <div className="col-auto">
                        <label className="form-label fw-semibold small">Minutes (1–60)</label>
                        <input type="number" className="form-control form-control-sm" style={{ width: 100 }}
                          value={lockTimeout} min={1} max={60}
                          onChange={e => setLockTimeout(Math.min(60, Math.max(1, +e.target.value)))} />
                      </div>
                      <div className="col-auto">
                        <button className="btn btn-primary btn-sm" onClick={handleLockSave} disabled={lockSaving}>
                          {lockSaving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Session info */}
                <div className="card shadow-sm mb-3">
                  <div className="card-header fw-semibold bg-secondary text-white">Session Info</div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-md-3"><div className="border rounded p-2 text-center"><small className="text-muted d-block">Token</small><span className="fw-semibold text-success">Active</span></div></div>
                      <div className="col-md-3"><div className="border rounded p-2 text-center"><small className="text-muted d-block">Lock</small><span className="fw-semibold">{lockTimeout} min</span></div></div>
                      <div className="col-md-3"><div className="border rounded p-2 text-center"><small className="text-muted d-block">Created</small><span className="fw-semibold">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</span></div></div>
                      <div className="col-md-3"><div className="border rounded p-2 text-center"><small className="text-muted d-block">Updated</small><span className="fw-semibold">{user?.updated_at ? new Date(user.updated_at).toLocaleDateString() : "—"}</span></div></div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ═══ NOTIFICATIONS ═══ */}
            {tab === "notifications" && (
              <div className="card shadow-sm mb-3">
                <div className="card-header fw-semibold" style={{ background: "#20c997", color: "#fff" }}>Notification Preferences</div>
                <div className="card-body">
                  {[
                    { id: "email", label: "Email Notifications", desc: "Receive via email" },
                    { id: "inapp", label: "In-App Notifications", desc: "Bell and popup alerts" },
                    { id: "sound", label: "Sound Alerts", desc: "Play sound for new notifications" },
                  ].map(n => (
                    <div className="form-check form-switch mb-3" key={n.id}>
                      <input className="form-check-input" type="checkbox" id={`n-${n.id}`} defaultChecked />
                      <label className="form-check-label" htmlFor={`n-${n.id}`}>
                        <strong>{n.label}</strong>
                        <div className="text-muted small">{n.desc}</div>
                      </label>
                    </div>
                  ))}
                  <p className="text-muted small mb-0">Delivery depends on admin job routine configuration.</p>
                </div>
              </div>
            )}

            {/* ═══ APPEARANCE ═══ */}
            {tab === "appearance" && (
              <div className="card shadow-sm mb-3">
                <div className="card-header fw-semibold" style={{ background: "var(--bs-primary)", color: "#fff" }}>Theme</div>
                <div className="card-body">
                  <div className="d-flex gap-2 mb-3">
                    {(["light", "dark", "custom"] as const).map(m => (
                      <button key={m}
                        className={`btn ${themeForm.mode === m ? "btn-primary" : "btn-outline-secondary"} flex-fill`}
                        onClick={() => setThemeForm(f => ({ ...f, mode: m }))} type="button">
                        {m === "light" ? "☀️ Light" : m === "dark" ? "🌙 Dark" : "🎨 Custom"}
                      </button>
                    ))}
                  </div>
                  {themeForm.mode === "custom" && (
                    <div className="row g-3 mb-3">
                      <div className="col-6">
                        <label className="form-label fw-semibold small">Primary Color</label>
                        <div className="d-flex align-items-center gap-2">
                          <input type="color" className="form-control form-control-color" value={themeForm.primaryColor}
                            onChange={e => setThemeForm(f => ({ ...f, primaryColor: e.target.value }))} />
                          <code className="small">{themeForm.primaryColor}</code>
                        </div>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold small">Accent Color</label>
                        <div className="d-flex align-items-center gap-2">
                          <input type="color" className="form-control form-control-color" value={themeForm.accentColor}
                            onChange={e => setThemeForm(f => ({ ...f, accentColor: e.target.value }))} />
                          <code className="small">{themeForm.accentColor}</code>
                        </div>
                      </div>
                    </div>
                  )}
                  <button className="btn btn-primary btn-sm" onClick={handleThemeSave} disabled={themeSaving} type="button">
                    {themeSaving ? "Saving…" : "Save Theme"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
