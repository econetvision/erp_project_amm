import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { unlockSession } from "../api/authApi";
import EcoNetVisionLogo from "./EcoNetVisionLogo";

export default function LockScreen() {
  const { auth, unlock, logout } = useAuth();
  const [password, setPassword] = useState("");
  const [pin, setPin]           = useState("");
  const [mode, setMode]         = useState<"password" | "pin">("password");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const hasPin = auth?.has_pin ?? false;

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = mode === "pin" ? { pin } : { password };
      await unlockSession(data);
      unlock();
    } catch (err: any) {
      setError(err.message || (mode === "pin" ? "Incorrect PIN" : "Incorrect password"));
    } finally {
      setPassword("");
      setPin("");
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center"
         style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a3a5c 100%)" }}>
      <div className="card shadow-lg" style={{ width: 400, borderRadius: 16 }}>
        <div className="card-body p-5">

          {/* Lock icon + Brand */}
          <div className="text-center mb-4">
            <EcoNetVisionLogo size={48} />
            <div className="mt-3 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#6c757d"
                   viewBox="0 0 16 16">
                <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2m3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2"/>
              </svg>
            </div>
            <h5 className="fw-bold mb-1">Screen Locked</h5>
            <p className="text-muted small mb-0">
              Logged in as <strong>{auth?.display_name || auth?.username}</strong>
            </p>
          </div>

          {/* Mode toggle (only if PIN is set) */}
          {hasPin && (
            <div className="d-flex gap-2 mb-3">
              <button className={`btn flex-fill ${mode === "password" ? "btn-primary" : "btn-outline-secondary"}`}
                type="button" onClick={() => setMode("password")}>Password</button>
              <button className={`btn flex-fill ${mode === "pin" ? "btn-primary" : "btn-outline-secondary"}`}
                type="button" onClick={() => setMode("pin")}>PIN</button>
            </div>
          )}

          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <form onSubmit={handleUnlock}>
            {mode === "password" ? (
              <div className="mb-3">
                <label className="form-label fw-semibold">Password</label>
                <input className="form-control form-control-lg" type="password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password" required autoFocus autoComplete="current-password" />
              </div>
            ) : (
              <div className="mb-3">
                <label className="form-label fw-semibold">PIN</label>
                <input className="form-control form-control-lg text-center" type="password"
                  value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="••••" required autoFocus inputMode="numeric"
                  minLength={4} maxLength={8} style={{ letterSpacing: "0.5em", fontSize: "1.5rem" }} />
              </div>
            )}
            <button className="btn btn-primary w-100 fw-semibold" type="submit" disabled={loading}>
              {loading ? (
                <><span className="spinner-border spinner-border-sm me-2" /> Unlocking…</>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                       viewBox="0 0 16 16" className="me-2" style={{ marginBottom: 2 }}>
                    <path d="M11 1a2 2 0 0 0-2 2v4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1V3a3 3 0 1 1 6 0v4h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2"/>
                  </svg>
                  Unlock
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-3">
            <button className="btn btn-link text-muted small p-0" onClick={handleLogout}>
              Sign out and switch user
            </button>
          </div>

          <div className="text-center mt-3 pt-3 border-top">
            <small className="text-muted">
              Session locked due to inactivity
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
