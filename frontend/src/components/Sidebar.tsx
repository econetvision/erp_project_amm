import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import EcoNetVisionLogo from "./EcoNetVisionLogo";
import { useAuth } from "../context/AuthContext";

/* ── SVG icon helper ─────────────────────────────────────────────────── */
function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
         fill="currentColor" viewBox="0 0 16 16">
      <path d={d} />
    </svg>
  );
}

/* ── Icon paths (Bootstrap Icons) ────────────────────────────────────── */
const ICONS = {
  dashboard:  "M0 1.5A1.5 1.5 0 0 1 1.5 0h2A1.5 1.5 0 0 1 5 1.5v2A1.5 1.5 0 0 1 3.5 5h-2A1.5 1.5 0 0 1 0 3.5zM1.5 1a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5zM0 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2z",
  employees:  "M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-5.784 6A2.24 2.24 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.3 6.3 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1zM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  attendance: "M11 6.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm-3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm-5 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zM3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z",
  reports:    "M4 11a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0zm6-4a1 1 0 1 1 2 0v5a1 1 0 1 1-2 0zM7 9a1 1 0 0 1 2 0v3a1 1 0 1 1-2 0z",
  vehicles:   "M2.52 3.515A2.5 2.5 0 0 1 4.82 2h6.362c1 0 1.904.596 2.298 1.515l.792 1.848c.075.175.21.319.38.404.5.25.855.715.965 1.262l.335 1.677c.033.161.049.325.049.49v.413C16 9.952 15.952 10 15.9 10h-.254a1.5 1.5 0 0 1-2.893 0H3.246a1.5 1.5 0 0 1-2.893 0H.1A.1.1 0 0 1 0 9.9v-.413a3 3 0 0 1 .049-.49l.335-1.677c.11-.547.465-1.012.964-1.261a.8.8 0 0 0 .381-.404zM3 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2m10 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2M4.82 3a1.5 1.5 0 0 0-1.379.91l-.792 1.847a1.8 1.8 0 0 1-.853.904.8.8 0 0 0-.43.564L1.03 8.904a1 1 0 0 1-.014.023H14.984a1 1 0 0 1-.014-.023l-.336-1.679a.8.8 0 0 0-.43-.564 1.8 1.8 0 0 1-.853-.904l-.792-1.848A1.5 1.5 0 0 0 11.18 3z",
  tracking:   "M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6",
  assign:     "M12.5 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7m.5-5v1h1a.5.5 0 0 1 0 1h-1v1a.5.5 0 0 1-1 0v-1h-1a.5.5 0 0 1 0-1h1v-1a.5.5 0 0 1 1 0M2.52 3.515A2.5 2.5 0 0 1 4.82 2h6.362c1 0 1.904.596 2.298 1.515l.792 1.848c.075.175.21.319.38.404.5.25.855.715.965 1.262l.335 1.677q.05.243.049.49v.413C16 9.952 15.952 10 15.9 10h-.254a1.5 1.5 0 0 1-2.893 0H3.246a1.5 1.5 0 0 1-2.893 0H.1A.1.1 0 0 1 0 9.9v-.413q0-.248.049-.49l.335-1.677c.11-.547.465-1.012.964-1.261a.8.8 0 0 0 .381-.404l.792-1.848ZM4.82 3a1.5 1.5 0 0 0-1.379.91l-.792 1.847a1.8 1.8 0 0 1-.853.904.8.8 0 0 0-.43.564L1.03 8.904a1 1 0 0 1-.014.023h13.968a1 1 0 0 1-.014-.023l-.336-1.679a.8.8 0 0 0-.43-.564 1.8 1.8 0 0 1-.853-.904l-.792-1.848A1.5 1.5 0 0 0 11.18 3z",
  payslips:   "M4 10.781c.148 1.667 1.513 2.85 3.591 3.003V15h1.043v-1.216c2.27-.179 3.678-1.438 3.678-3.3 0-1.59-.947-2.51-2.956-3.028l-.722-.187V3.467c1.122.11 1.879.714 2.07 1.616h1.47c-.166-1.6-1.54-2.748-3.54-2.875V1H7.591v1.233c-1.939.23-3.27 1.472-3.27 3.156 0 1.454.966 2.483 2.661 2.917l.61.162v4.031c-1.149-.17-1.94-.8-2.131-1.718zm3.391-3.836c-1.043-.263-1.6-.825-1.6-1.616 0-.944.704-1.641 1.8-1.828v3.495l-.2-.05zm1.591 1.872c1.287.323 1.852.859 1.852 1.769 0 1.097-.826 1.828-2.2 1.939V8.73z",
  payroll:    "M12.136.326A1.5 1.5 0 0 1 14 1.78V3h.5A1.5 1.5 0 0 1 16 4.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 13.5v-9A1.5 1.5 0 0 1 1.5 3H2V1.78a1.5 1.5 0 0 1 1.872-1.458zM3.5 1a.5.5 0 0 0-.5.5V3h2V1.5a.5.5 0 0 0-.5-.5zm3.5.5V3h2V1.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m4 0V3h2V1.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M1 4v9.5a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5V4z",
  structures: "M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM4.5 4a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5m0 3a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5m0 3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5",
  advances:   "M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1H1zm7 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4M0 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1zm3 0a2 2 0 0 1-2 2v4a2 2 0 0 1 2 2h10a2 2 0 0 1 2-2V7a2 2 0 0 1-2-2z",
  payrollSettings: "M7.068.727c.243-.97 1.62-.97 1.864 0l.071.286a.96.96 0 0 0 1.622.434l.205-.211c.695-.719 1.888-.03 1.613.931l-.084.303a.96.96 0 0 0 1.187 1.187l.303-.084c.96-.275 1.65.918.931 1.613l-.211.205a.96.96 0 0 0 .434 1.622l.286.071c.97.243.97 1.62 0 1.864l-.286.071a.96.96 0 0 0-.434 1.622l.211.205c.719.695.03 1.888-.931 1.613l-.303-.084a.96.96 0 0 0-1.187 1.187l.084.303c.275.96-.918 1.65-1.613.931l-.205-.211a.96.96 0 0 0-1.622.434l-.071.286c-.243.97-1.62.97-1.864 0l-.071-.286a.96.96 0 0 0-1.622-.434l-.205.211c-.695.719-1.888.03-1.613-.931l.084-.303a.96.96 0 0 0-1.187-1.187l-.303.084c-.96.275-1.65-.918-.931-1.613l.211-.205a.96.96 0 0 0-.434-1.622l-.286-.071c-.97-.243-.97-1.62 0-1.864l.286-.071a.96.96 0 0 0 .434-1.622l-.211-.205c-.719-.695-.03-1.888.931-1.613l.303.084a.96.96 0 0 0 1.187-1.187l-.084-.303c-.275-.96.918-1.65 1.613-.931l.205.211a.96.96 0 0 0 1.622-.434zM12.973 8.5H8.25l-2.834 3.779A4.998 4.998 0 0 0 12.973 8.5m0-1a4.998 4.998 0 0 0-7.557-3.779l2.834 3.78zM5.048 3.967l-.087.065zm-.431.355A4.995 4.995 0 0 0 3.002 8c0 1.455.622 2.765 1.615 3.678L7.375 8z",
  users:      "M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z",
  jobs:       "M6.5 1A1.5 1.5 0 0 0 5 2.5V3H1.5A1.5 1.5 0 0 0 0 4.5v8A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 14.5 3H11v-.5A1.5 1.5 0 0 0 9.5 1zM6 2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V3H6zM1.5 4h13a.5.5 0 0 1 .5.5V7H1V4.5a.5.5 0 0 1 .5-.5M1 8h14v4.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5z",
  settings:   "M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52z",
  profile:    "M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z",
  chevronL:   "M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0",
  chevronR:   "M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708",
};

/* ── Section type ────────────────────────────────────────────────────── */
interface NavSection {
  title: string;
  items: { to: string; label: string; icon: string; roles: string[] }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "MAIN",
    items: [
      { to: "/dashboard",        label: "Dashboard",   icon: "dashboard",  roles: ["admin","supervisor"] },
      { to: "/attendance",        label: "Attendance",  icon: "attendance", roles: ["admin","supervisor","worker"] },
      { to: "/attendance/report", label: "Reports",     icon: "reports",    roles: ["admin","supervisor"] },
    ],
  },
  {
    title: "WORKFORCE",
    items: [
      { to: "/employees",      label: "Employees",      icon: "employees", roles: ["admin","supervisor"] },
      { to: "/work-locations", label: "Work Locations", icon: "tracking",  roles: ["admin","supervisor"] },
      { to: "/users",          label: "Users",          icon: "users",     roles: ["admin"] },
    ],
  },
  {
    title: "PAYROLL",
    items: [
      { to: "/payslips",           label: "Payslips",    icon: "payslips",   roles: ["admin"] },
      { to: "/payroll/runs",       label: "Payroll",     icon: "payroll",    roles: ["admin"] },
      { to: "/payroll/structures", label: "Structures",  icon: "structures", roles: ["admin"] },
      { to: "/payroll/advances",   label: "Advances",    icon: "advances",   roles: ["admin"] },
      { to: "/payroll/settings",   label: "Settings",    icon: "payrollSettings", roles: ["admin"] },
    ],
  },
  {
    title: "FLEET",
    items: [
      { to: "/vehicles",        label: "Vehicles",   icon: "vehicles", roles: ["admin","supervisor"] },
      { to: "/tracking/assign", label: "Assign",     icon: "assign",   roles: ["admin","supervisor"] },
      { to: "/tracking/live",   label: "Live Track", icon: "tracking", roles: ["admin","supervisor"] },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { to: "/jobs",     label: "Jobs",     icon: "jobs",     roles: ["admin"] },
      { to: "/profile",  label: "Profile",  icon: "profile",  roles: ["admin","supervisor","worker"] },
      { to: "/settings", label: "Settings", icon: "settings", roles: ["admin","supervisor","worker"] },
    ],
  },
];

export default function Sidebar() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`erp-sidebar ${collapsed ? "erp-sidebar--collapsed" : ""}`}>
      {/* Brand */}
      <div className="erp-sidebar__brand" onClick={() => navigate("/dashboard")}
           style={{ cursor: "pointer" }}>
        <EcoNetVisionLogo size={collapsed ? 28 : 34} />
        {!collapsed && (
          <div className="erp-sidebar__brand-text">
            <span className="erp-sidebar__brand-title">ERP System</span>
            <span className="erp-sidebar__brand-sub">ECONETVISION</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="erp-sidebar__nav">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !auth || item.roles.includes(auth.role)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div className="erp-sidebar__section" key={section.title}>
              {!collapsed && (
                <div className="erp-sidebar__section-title">{section.title}</div>
              )}
              {visibleItems.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/attendance"}
                  className={({ isActive }) =>
                    `erp-sidebar__link ${isActive ? "erp-sidebar__link--active" : ""}`
                  }
                  title={collapsed ? label : undefined}
                >
                  <Icon d={(ICONS as any)[icon]} size={18} />
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button className="erp-sidebar__toggle" onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Expand" : "Collapse"}>
        <Icon d={collapsed ? ICONS.chevronR : ICONS.chevronL} size={16} />
      </button>
    </aside>
  );
}
