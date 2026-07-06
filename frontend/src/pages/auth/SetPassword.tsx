import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { changePassword } from "../../api/authApi";
import EcoNetVisionLogo from "../../components/EcoNetVisionLogo";

/**
 * First-login screen for admin/supervisor accounts: the password the admin
 * assigned must be replaced by one the user creates before continuing.
 */
export default function SetPassword() {
  const { auth, login }       = useAuth();
  const navigate              = useNavigate();
  const location              = useLocation();
  // Carried over from the login form so the user doesn't retype it; lost on refresh.
  const carriedPassword: string | undefined = location.state?.currentPassword;

  const [form, setForm] = useState({
    current_password: carriedPassword ?? "",
    new_password: "",
    confirm_password: "",
  });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (form.new_password.length < 4) {
      setError("New password must be at least 4 characters");
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setError("Passwords do not match");
      return;
    }
    if (form.new_password === form.current_password) {
      setError("New password must be different from the current one");
      return;
    }
    setLoading(true);
    try {
      await changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      });
      if (auth) login({ ...auth, must_change_password: false });
      navigate(auth?.role === "worker" ? "/attendance" : "/dashboard");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center"
         style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a3a5c 100%)" }}>
      <div className="card shadow-lg" style={{ width: 380, borderRadius: 16 }}>
        <div className="card-body p-5">

          <div className="text-center mb-4">
            <EcoNetVisionLogo size={56} />
            <h5 className="fw-bold mt-2 mb-0">Create Your Password</h5>
            <p className="text-muted small mb-0">by EcoNetVision Pvt. Ltd.</p>
          </div>

          <div className="alert alert-info py-2 small">
            Welcome, <strong>{auth?.display_name || auth?.username}</strong>! Since this is
            your first login, please create your own password to continue.
          </div>

          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <form onSubmit={handleSubmit}>
            {!carriedPassword && (
              <div className="mb-3">
                <label className="form-label fw-semibold">Current Password</label>
                <input className="form-control" type="password" value={form.current_password}
                  autoComplete="current-password"
                  onChange={(e) => setForm(f => ({ ...f, current_password: e.target.value }))}
                  required autoFocus />
              </div>
            )}
            <div className="mb-3">
              <label className="form-label fw-semibold">New Password</label>
              <input className="form-control" type="password" value={form.new_password}
                autoComplete="new-password"
                onChange={(e) => setForm(f => ({ ...f, new_password: e.target.value }))}
                required autoFocus={!!carriedPassword} />
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold">Confirm New Password</label>
              <input className="form-control" type="password" value={form.confirm_password}
                autoComplete="new-password"
                onChange={(e) => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                required />
            </div>
            <button className="btn btn-primary w-100 fw-semibold" type="submit" disabled={loading}>
              {loading ? "Saving…" : "Set Password & Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
