import { useEffect, useState, useRef, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { getMe, updateProfile, changePassword, uploadUserPhoto, sendVerification, verifyCode, setPin, removePin } from "../../api/authApi";
import AlertMessage from "../../components/AlertMessage";
import type { User } from "../../types/auth";

type Tab = "profile" | "password" | "security" | "notifications" | "appearance";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "profile",       label: "Profile",       icon: "👤" },
  { key: "password",      label: "Password",      icon: "🔑" },
  { key: "security",      label: "Security",      icon: "🛡️" },
  { key: "notifications", label: "Notifications", icon: "🔔" },
  { key: "appearance",    label: "Appearance",     icon: "🎨" },
];

export default function Settings() {
  const { auth } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");

  const [user, setUser]             = useState<User | null>(null);
  const [profile, setProfile]       = useState({ display_name: "", email: "", phone: "" });
  const [pwForm, setPwForm]         = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [alert, setAlert]           = useState({ type: "", message: "" });
  const [saving, setSaving]         = useState(false);
  const [pwSaving, setPwSaving]     = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Verification state
  const [verifying, setVerifying]   = useState<"email" | "phone" | null>(null);
  const [verifyCode_, setVerifyCode_] = useState("");
  const [codeSent, setCodeSent]     = useState(false);
  const [debugCode, setDebugCode]   = useState<string | null>(null);

  // PIN state
  const [pinForm, setPinForm]       = useState({ pin: "", confirm_pin: "", current_password: "" });
  const [pinSaving, setPinSaving]   = useState(false);

  // Lock timeout state
  const [lockTimeout, setLockTimeout] = useState(2);
  const [lockSaving, setLockSaving] = useState(false);

  const { theme, saveTheme } = useTheme();
  const [themeForm, setThemeForm] = useState({
    mode: theme.mode as "light" | "dark" | "custom",
    primaryColor: theme.primaryColor,
    accentColor: theme.accentColor,
  });
  const [themeSaving, setThemeSaving] = useState(false);

  useEffect(() => {
    getMe()
      .then((res) => {
        setUser(res.data);
        setProfile({
          display_name: res.data.display_name || "",
          email: res.data.email || "",
          phone: res.data.phone || "",
        });
        setLockTimeout(res.data.lock_timeout ?? 2);
      })
      .catch((e: Error) => setAlert({ type: "danger", message: e.message }));
  }, []);

  // ── Profile ────────────────────────────────────────────
  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateProfile(profile);
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

  const apiBase = process.env.REACT_APP_API_URL || "http://localhost:8088";
  const avatarUrl = user?.photo_path ? `${apiBase}${user.photo_path}` : null;

  // ── Verification ───────────────────────────────────────
  async function handleSendCode(type: "email" | "phone") {
    setVerifying(type);
    setCodeSent(false);
    setVerifyCode_("");
    setDebugCode(null);
    try {
      const res = await sendVerification(type);
      setCodeSent(true);
      setDebugCode(res.data.debug_code || null);
      setAlert({ type: "info", message: `Verification code sent to your ${type}.` });
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); setVerifying(null); }
  }

  async function handleVerifyCode() {
    if (!verifying) return;
    try {
      const res = await verifyCode(verifying, verifyCode_);
      setAlert({ type: "success", message: res.data.detail });
      setVerifying(null); setCodeSent(false); setVerifyCode_(""); setDebugCode(null);
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  // ── Password ───────────────────────────────────────────
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

  // ── PIN ────────────────────────────────────────────────
  async function handleSetPin(e: FormEvent) {
    e.preventDefault();
    if (pinForm.pin !== pinForm.confirm_pin) {
      setAlert({ type: "danger", message: "PINs do not match." }); return;
    }
    if (pinForm.pin.length < 4 || pinForm.pin.length > 8) {
      setAlert({ type: "danger", message: "PIN must be 4–8 digits." }); return;
    }
    setPinSaving(true);
    try {
      await setPin(pinForm.pin, pinForm.current_password);
      setAlert({ type: "success", message: "PIN set successfully." });
      setPinForm({ pin: "", confirm_pin: "", current_password: "" });
      const res = await getMe(); setUser(res.data);
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setPinSaving(false); }
  }

  async function handleRemovePin() {
    setPinSaving(true);
    try {
      await removePin();
      setAlert({ type: "success", message: "PIN removed." });
      const res = await getMe(); setUser(res.data);
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setPinSaving(false); }
  }

  // ── Lock timeout ───────────────────────────────────────
  async function handleLockTimeoutSave() {
    setLockSaving(true);
    try {
      const res = await updateProfile({ ...profile, lock_timeout: lockTimeout } as any);
      setUser(res.data);
      setAlert({ type: "success", message: `Lock timeout set to ${lockTimeout} minute(s).` });
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setLockSaving(false); }
  }

  // ── Theme ──────────────────────────────────────────────
  async function handleThemeSave() {
    setThemeSaving(true);
    try {
      await saveTheme(themeForm);
      setAlert({ type: "success", message: "Theme saved." });
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setThemeSaving(false); }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-lg-9">
        <h3 className="fw-bold mb-4">Settings</h3>
        <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

        {/* Tab navigation */}
        <ul className="nav nav-tabs mb-4">
          {TABS.map((t) => (
            <li className="nav-item" key={t.key}>
              <button
                className={`nav-link ${tab === t.key ? "active fw-semibold" : ""}`}
                onClick={() => setTab(t.key)}
                type="button"
              >
                {t.icon} {t.label}
              </button>
            </li>
          ))}
        </ul>

        {/* ═══════════ PROFILE TAB ═══════════ */}
        {tab === "profile" && (
          <>
            {/* Account info card */}
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-dark text-white fw-semibold">Account Information</div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-3 text-center mb-3">
                    {avatarUrl || photoPreview ? (
                      <img src={photoPreview || avatarUrl!} alt="Avatar"
                        className="rounded-circle border" style={{ width: 100, height: 100, objectFit: "cover" }} />
                    ) : (
                      <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center mx-auto text-white fw-bold"
                        style={{ width: 100, height: 100, fontSize: 36 }}>
                        {(user?.display_name || user?.username || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="mt-2">
                      <input type="file" ref={fileRef} className="d-none" accept="image/*" onChange={handleFileSelect} />
                      <button className="btn btn-sm btn-outline-primary" onClick={() => fileRef.current?.click()}>Change Photo</button>
                      {photoPreview && <button className="btn btn-sm btn-primary ms-2" onClick={handlePhotoUpload} disabled={saving}>Save</button>}
                    </div>
                  </div>
                  <div className="col-md-9">
                    <table className="table table-sm mb-0">
                      <tbody>
                        <tr><th style={{ width: 140 }}>Username</th><td>{user?.username}</td></tr>
                        <tr><th>Role</th><td><span className={`badge bg-${auth?.role === "admin" ? "danger" : auth?.role === "supervisor" ? "warning" : "success"}`}>{auth?.role}</span></td></tr>
                        {user?.employee_id && <tr><th>Employee ID</th><td>#{user.employee_id}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile edit form */}
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-primary text-white fw-semibold">Edit Profile</div>
              <div className="card-body">
                <form onSubmit={handleProfileSave}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Display Name</label>
                    <input className="form-control" value={profile.display_name}
                      onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} placeholder="Your display name" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Email</label>
                    <div className="input-group">
                      <input className="form-control" type="email" value={profile.email}
                        onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
                      <button className="btn btn-outline-secondary" type="button"
                        onClick={() => handleSendCode("email")} disabled={!profile.email || verifying === "email"}>
                        {verifying === "email" && codeSent ? "Code Sent" : "Verify"}
                      </button>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Phone</label>
                    <div className="input-group">
                      <input className="form-control" value={profile.phone}
                        onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+91 9876543210" />
                      <button className="btn btn-outline-secondary" type="button"
                        onClick={() => handleSendCode("phone")} disabled={!profile.phone || verifying === "phone"}>
                        {verifying === "phone" && codeSent ? "Code Sent" : "Verify"}
                      </button>
                    </div>
                  </div>
                  {verifying && codeSent && (
                    <div className="mb-3 p-3 border rounded bg-light">
                      <label className="form-label fw-semibold">Enter code sent to your {verifying}</label>
                      <div className="input-group">
                        <input className="form-control" value={verifyCode_}
                          onChange={e => setVerifyCode_(e.target.value)} placeholder="6-digit code" maxLength={6} />
                        <button className="btn btn-success" type="button"
                          onClick={handleVerifyCode} disabled={verifyCode_.length !== 6}>Verify</button>
                        <button className="btn btn-outline-secondary" type="button"
                          onClick={() => { setVerifying(null); setCodeSent(false); }}>Cancel</button>
                      </div>
                      {debugCode && <small className="text-muted mt-1 d-block">Debug code: <strong>{debugCode}</strong></small>}
                    </div>
                  )}
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save Profile"}
                  </button>
                </form>
              </div>
            </div>
          </>
        )}

        {/* ═══════════ PASSWORD TAB ═══════════ */}
        {tab === "password" && (
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-warning fw-semibold">Change Password</div>
            <div className="card-body">
              <form onSubmit={handlePasswordChange}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Current Password</label>
                  <input className="form-control" type="password" value={pwForm.current_password}
                    onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))}
                    required autoComplete="current-password" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">New Password</label>
                  <input className="form-control" type="password" value={pwForm.new_password}
                    onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))}
                    required minLength={4} autoComplete="new-password" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Confirm New Password</label>
                  <input className={`form-control ${pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password ? "is-invalid" : ""}`}
                    type="password" value={pwForm.confirm_password}
                    onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))}
                    required minLength={4} autoComplete="new-password" />
                  {pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password && (
                    <div className="invalid-feedback">Passwords do not match.</div>
                  )}
                </div>
                <button className="btn btn-warning" type="submit" disabled={pwSaving}>
                  {pwSaving ? "Changing…" : "Change Password"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════ SECURITY TAB ═══════════ */}
        {tab === "security" && (
          <>
            {/* PIN Management */}
            <div className="card shadow-sm mb-4">
              <div className="card-header fw-semibold" style={{ background: "#6f42c1", color: "white" }}>
                Lock PIN {user?.has_pin && <span className="badge bg-success ms-2">Active</span>}
              </div>
              <div className="card-body">
                {user?.has_pin ? (
                  <div>
                    <p className="text-muted">You have a PIN set. You can use it to unlock the session instead of your password.</p>
                    <div className="d-flex gap-2">
                      <button className="btn btn-outline-danger" onClick={handleRemovePin} disabled={pinSaving}>
                        {pinSaving ? "Removing…" : "Remove PIN"}
                      </button>
                      <button className="btn btn-outline-primary" onClick={() => setPinForm({ pin: "", confirm_pin: "", current_password: "" })}>
                        Change PIN
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted mb-3">Set a 4–8 digit PIN to quickly unlock your session.</p>
                )}
                {(!user?.has_pin || pinForm.current_password !== undefined) && (
                  <form onSubmit={handleSetPin} className="mt-3">
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">PIN (4–8 digits)</label>
                        <input className="form-control" type="password" value={pinForm.pin}
                          onChange={e => setPinForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, "").slice(0, 8) }))}
                          placeholder="••••" required minLength={4} maxLength={8} inputMode="numeric" />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Confirm PIN</label>
                        <input className={`form-control ${pinForm.confirm_pin && pinForm.pin !== pinForm.confirm_pin ? "is-invalid" : ""}`}
                          type="password" value={pinForm.confirm_pin}
                          onChange={e => setPinForm(p => ({ ...p, confirm_pin: e.target.value.replace(/\D/g, "").slice(0, 8) }))}
                          placeholder="••••" required minLength={4} maxLength={8} inputMode="numeric" />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Current Password</label>
                        <input className="form-control" type="password" value={pinForm.current_password}
                          onChange={e => setPinForm(p => ({ ...p, current_password: e.target.value }))}
                          required autoComplete="current-password" />
                      </div>
                    </div>
                    <button className="btn btn-primary mt-3" type="submit" disabled={pinSaving}>
                      {pinSaving ? "Saving…" : user?.has_pin ? "Update PIN" : "Set PIN"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Lock Timeout */}
            <div className="card shadow-sm mb-4">
              <div className="card-header fw-semibold" style={{ background: "#0d6efd", color: "white" }}>Auto-Lock Timeout</div>
              <div className="card-body">
                <p className="text-muted">Session locks after inactivity. Choose 1–60 minutes.</p>
                <div className="row g-3 align-items-end">
                  <div className="col-auto">
                    <label className="form-label fw-semibold">Timeout (minutes)</label>
                    <input type="number" className="form-control" style={{ width: 120 }}
                      value={lockTimeout} min={1} max={60}
                      onChange={e => setLockTimeout(Math.min(60, Math.max(1, +e.target.value)))} />
                  </div>
                  <div className="col-auto">
                    <button className="btn btn-primary" onClick={handleLockTimeoutSave} disabled={lockSaving}>
                      {lockSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Session info */}
            <div className="card shadow-sm mb-4">
              <div className="card-header fw-semibold bg-secondary text-white">Session Info</div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="border rounded p-3"><small className="text-muted">Token Status</small><div className="fw-semibold text-success">Active</div></div>
                  </div>
                  <div className="col-md-6">
                    <div className="border rounded p-3"><small className="text-muted">Auto-Lock</small><div className="fw-semibold">{lockTimeout} min</div></div>
                  </div>
                  <div className="col-md-6">
                    <div className="border rounded p-3"><small className="text-muted">Account Created</small><div className="fw-semibold">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</div></div>
                  </div>
                  <div className="col-md-6">
                    <div className="border rounded p-3"><small className="text-muted">Last Updated</small><div className="fw-semibold">{user?.updated_at ? new Date(user.updated_at).toLocaleDateString() : "—"}</div></div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══════════ NOTIFICATIONS TAB ═══════════ */}
        {tab === "notifications" && (
          <div className="card shadow-sm mb-4">
            <div className="card-header fw-semibold" style={{ background: "#20c997", color: "white" }}>Notification Preferences</div>
            <div className="card-body">
              <div className="form-check form-switch mb-3">
                <input className="form-check-input" type="checkbox" id="notif-email" defaultChecked />
                <label className="form-check-label" htmlFor="notif-email">
                  <strong>Email Notifications</strong>
                  <div className="text-muted small">Receive notifications via email</div>
                </label>
              </div>
              <div className="form-check form-switch mb-3">
                <input className="form-check-input" type="checkbox" id="notif-inapp" defaultChecked />
                <label className="form-check-label" htmlFor="notif-inapp">
                  <strong>In-App Notifications</strong>
                  <div className="text-muted small">Show notification bell and popup alerts</div>
                </label>
              </div>
              <div className="form-check form-switch mb-3">
                <input className="form-check-input" type="checkbox" id="notif-sound" defaultChecked />
                <label className="form-check-label" htmlFor="notif-sound">
                  <strong>Sound Alerts</strong>
                  <div className="text-muted small">Play a sound for new notifications</div>
                </label>
              </div>
              <p className="text-muted small mt-2 mb-0">Notification delivery depends on admin job routine configuration.</p>
            </div>
          </div>
        )}

        {/* ═══════════ APPEARANCE TAB ═══════════ */}
        {tab === "appearance" && (
          <div className="card shadow-sm mb-4">
            <div className="card-header fw-semibold" style={{ background: "var(--bs-primary)", color: "white" }}>Theme</div>
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
                    <label className="form-label fw-semibold">Primary Color</label>
                    <div className="d-flex align-items-center gap-2">
                      <input type="color" className="form-control form-control-color"
                        value={themeForm.primaryColor}
                        onChange={e => setThemeForm(f => ({ ...f, primaryColor: e.target.value }))} />
                      <code>{themeForm.primaryColor}</code>
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Accent Color</label>
                    <div className="d-flex align-items-center gap-2">
                      <input type="color" className="form-control form-control-color"
                        value={themeForm.accentColor}
                        onChange={e => setThemeForm(f => ({ ...f, accentColor: e.target.value }))} />
                      <code>{themeForm.accentColor}</code>
                    </div>
                  </div>
                </div>
              )}
              <button className="btn btn-primary" onClick={handleThemeSave} disabled={themeSaving} type="button">
                {themeSaving ? "Saving…" : "Save Theme"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
