import { NavLink, useNavigate } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import CompanySwitcher from "./CompanySwitcher";
import { useAuth } from "../context/AuthContext";

const ROLE_BADGE: Record<string, string> = { master: "dark", admin: "danger", supervisor: "warning", worker: "success" };

export default function Navbar() {
  const { auth, logout, lock } = useAuth();
  const navigate               = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="erp-topbar">
      <div className="erp-topbar__left">
        <h1 className="erp-topbar__title">
          {/* Page title filled by breadcrumb / context — static for now */}
        </h1>
      </div>

      <div className="erp-topbar__right">
        {auth && (
          <>
            {auth.role === "master" && <CompanySwitcher />}
            <NotificationBell />

            <NavLink to="/settings" className="erp-topbar__icon-btn" title="Settings">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52z"/>
              </svg>
            </NavLink>

            <button className="erp-topbar__icon-btn" onClick={lock} title="Lock Screen">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2m3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2"/>
              </svg>
            </button>

            <div className="erp-topbar__divider" />

            <div className="erp-topbar__user">
              <div className="erp-topbar__avatar">
                {(auth.display_name || auth.username).charAt(0).toUpperCase()}
              </div>
              <div className="erp-topbar__user-info">
                <span className="erp-topbar__user-name">{auth.display_name || auth.username}</span>
                <span className={`badge bg-${ROLE_BADGE[auth.role]} erp-topbar__role-badge`}>
                  {auth.role.charAt(0).toUpperCase() + auth.role.slice(1)}
                </span>
              </div>
            </div>

            <button className="erp-topbar__logout-btn" onClick={handleLogout} title="Logout">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0z"/>
                <path fillRule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708z"/>
              </svg>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
