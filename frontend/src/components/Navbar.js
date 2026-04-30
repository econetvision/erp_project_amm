import { NavLink, useNavigate } from "react-router-dom";
import EcoNetVisionLogo from "./EcoNetVisionLogo";
import { useAuth } from "../context/AuthContext";

const ROLE_BADGE = { admin: "danger", supervisor: "warning", worker: "success" };

export default function Navbar() {
  const { auth, logout } = useAuth();
  const navigate         = useNavigate();

  const links = [
    { to: "/employees",       label: "Employees",  roles: ["admin","supervisor"] },
    { to: "/dashboard",       label: "Dashboard",  roles: ["admin","supervisor"] },
    { to: "/attendance",      label: "Attendance", roles: ["admin","supervisor","worker"] },
    { to: "/attendance/report", label: "Reports",  roles: ["admin","supervisor"] },
    { to: "/vehicles",        label: "Vehicles",   roles: ["admin","supervisor"] },
    { to: "/tracking/assign", label: "Assign",     roles: ["admin","supervisor"] },
    { to: "/tracking/live",   label: "Live Track", roles: ["admin","supervisor"] },
    { to: "/payslips",        label: "Payslips",   roles: ["admin"] },
    { to: "/users",           label: "Users",      roles: ["admin"] },
  ].filter(l => !auth || l.roles.includes(auth.role));

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm">
      <div className="container-fluid">
        <span className="navbar-brand fw-bold fs-4 d-flex align-items-center gap-2">
          <EcoNetVisionLogo size={36} />
          <span className="d-flex flex-column" style={{ lineHeight: 1.1 }}>
            <span style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.02em" }}>ERP System</span>
            <span style={{ fontSize: "0.6rem", fontWeight: 400, color: "#a8d4f0", letterSpacing: "0.12em" }}>
              BY ECONETVISION
            </span>
          </span>
        </span>

        <button className="navbar-toggler" type="button"
          data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto gap-2 align-items-center">
            {links.map(({ to, label }) => (
              <li className="nav-item" key={to}>
                <NavLink
                  className={({ isActive }) =>
                    "nav-link px-3" + (isActive ? " active fw-semibold" : "")
                  }
                  to={to}
                >
                  {label}
                </NavLink>
              </li>
            ))}

            {auth && (
              <li className="nav-item d-flex align-items-center gap-2 ms-2">
                <span className={`badge bg-${ROLE_BADGE[auth.role]}`}>
                  {auth.role.charAt(0).toUpperCase() + auth.role.slice(1)}
                </span>
                <span className="text-white small">{auth.username}</span>
                <button className="btn btn-sm btn-outline-light" onClick={handleLogout}>
                  Logout
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
