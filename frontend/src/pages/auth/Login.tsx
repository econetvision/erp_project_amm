import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { loginApi } from "../../api/authApi";
import EcoNetVisionLogo from "../../components/EcoNetVisionLogo";

export default function Login() {
  const { login }             = useAuth();
  const navigate              = useNavigate();
  const [form, setForm]       = useState({ username: "", password: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await loginApi(form);
      login(res.data);
      // Redirect based on role
      if (res.data.role === "worker") {
        navigate("/attendance");
      } else {
        navigate("/dashboard");
      }
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

          {/* Logo + Brand */}
          <div className="text-center mb-4">
            <EcoNetVisionLogo size={56} />
            <h5 className="fw-bold mt-2 mb-0">ERP System</h5>
            <p className="text-muted small mb-0">by EcoNetVision Pvt. Ltd.</p>
          </div>

          <h6 className="text-center text-muted mb-4">Sign in to your account</h6>

          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-semibold">Username</label>
              <input className="form-control" value={form.username} autoComplete="username"
                onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                required autoFocus />
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold">Password</label>
              <input className="form-control" type="password" value={form.password} autoComplete="current-password"
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                required />
            </div>
            <button className="btn btn-primary w-100 fw-semibold" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/* Role hint */}
          <div className="mt-4 pt-3 border-top">
            <p className="text-muted small text-center mb-2">Default credentials</p>
            <div className="d-flex justify-content-center gap-3 small text-muted">
              <span><strong>admin</strong> / admin123</span>
              <span><strong>supervisor</strong> / admin123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
