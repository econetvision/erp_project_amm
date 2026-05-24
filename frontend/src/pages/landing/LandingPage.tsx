import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import EcoNetVisionLogo from "../../components/EcoNetVisionLogo";

export default function LandingPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();

  return (
    <div
      className="min-vh-100 d-flex flex-column"
      style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #0d2137 100%)" }}
    >
      {/* Hero */}
      <div className="flex-grow-1 d-flex align-items-center justify-content-center text-center text-white px-3">
        <div style={{ maxWidth: 640 }}>
          <div className="mb-4">
            <EcoNetVisionLogo size={80} />
          </div>
          <h1 className="fw-bold mb-2" style={{ fontSize: "2.8rem", letterSpacing: "0.02em" }}>
            ERP System
          </h1>
          <p className="mb-1" style={{ color: "#4ea8e8", fontWeight: 600, letterSpacing: "0.12em" }}>
            BY ECONETVISION PVT. LTD.
          </p>
          <p className="lead mt-3 mb-4" style={{ color: "#c8d8f0" }}>
            Employee management, attendance with facial recognition, payslips,
            vehicle fleet &amp; live GPS tracking — all in one place.
          </p>

          <div className="d-flex justify-content-center gap-3 flex-wrap">
            {auth ? (
              <button
                className="btn btn-primary btn-lg px-5 fw-semibold"
                onClick={() => navigate(auth.role === "worker" ? "/attendance" : "/dashboard")}
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <button
                  className="btn btn-primary btn-lg px-5 fw-semibold"
                  onClick={() => navigate("/login")}
                >
                  Sign In
                </button>
                <button
                  className="btn btn-outline-light btn-lg px-4"
                  onClick={() => navigate("/login")}
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div className="container pb-5">
        <div className="row g-4 justify-content-center">
          {[
            { icon: "👥", title: "Employee Management", desc: "Manage employee records, shifts, and Aadhar/bank details." },
            { icon: "📸", title: "Face Recognition", desc: "Clock in/out with real-time facial identification." },
            { icon: "📊", title: "Analytics Dashboard", desc: "Daily attendance charts, monthly stats, and reports." },
            { icon: "💰", title: "Payslip Generation", desc: "Auto-calculated ESI, PF, and daily rate payslips." },
            { icon: "🚛", title: "Vehicle Fleet", desc: "Assign vehicles, track status, and manage maintenance." },
            { icon: "📍", title: "Live GPS Tracking", desc: "Real-time vehicle location on Google Maps." },
          ].map((f, i) => (
            <div className="col-md-4 col-sm-6" key={i}>
              <div
                className="card h-100 border-0 text-center"
                style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(6px)" }}
              >
                <div className="card-body py-4">
                  <div style={{ fontSize: "2.2rem" }}>{f.icon}</div>
                  <h6 className="fw-bold mt-2 text-white">{f.title}</h6>
                  <p className="small mb-0" style={{ color: "#a0b8d0" }}>{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-3 text-center small" style={{ color: "#6a8aaa" }}>
        <span>© {new Date().getFullYear()} EcoNetVision Pvt. Ltd. All rights reserved.</span>
        <span className="mx-2">|</span>
        <span>📞 +91 9790840313</span>
      </footer>
    </div>
  );
}
