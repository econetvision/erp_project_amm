import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import type { ReactNode } from "react";
import Layout           from "./components/Layout";
import LockScreen       from "./components/LockScreen";
import Login            from "./pages/auth/Login";
import UserManagement   from "./pages/auth/UserManagement";
import EmployeeList     from "./pages/employees/EmployeeList";
import EmployeeForm     from "./pages/employees/EmployeeForm";
import AttendanceEntry  from "./pages/attendance/AttendanceEntry";
import AttendanceReport from "./pages/attendance/AttendanceReport";
import PayslipGenerate  from "./pages/payslips/PayslipGenerate";
import PayslipView      from "./pages/payslips/PayslipView";
import Dashboard        from "./pages/dashboard/Dashboard";
import VehicleList      from "./pages/vehicles/VehicleList";
import VehicleForm      from "./pages/vehicles/VehicleForm";
import AssignVehicle    from "./pages/tracking/AssignVehicle";
import LiveTracking     from "./pages/tracking/LiveTracking";
import LandingPage      from "./pages/landing/LandingPage";
import Settings         from "./pages/settings/Settings";
import JobList          from "./pages/jobs/JobList";
import JobForm          from "./pages/jobs/JobForm";
import SalaryStructures from "./pages/payroll/SalaryStructures";
import PayrollRunPage   from "./pages/payroll/PayrollRun";
import PayrollDetail    from "./pages/payroll/PayrollDetail";
import AdvancesPage     from "./pages/payroll/Advances";
import PayrollSettings  from "./pages/payroll/PayrollSettings";
import WorkLocations    from "./pages/locations/WorkLocations";
import Profile          from "./pages/profile/Profile";

// Redirect unauthenticated users to login
function RequireAuth({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(auth.role)) return <Navigate to="/attendance" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { auth, locked } = useAuth();

  // Show lock screen overlay when session is locked
  if (auth && locked) return <LockScreen />;

  return (
    <Routes>
      <Route path="/login" element={auth ? <Navigate to="/dashboard" replace /> : <Login />} />

      {/* Public landing page */}
      <Route path="/" element={<LandingPage />} />

      <Route element={<Layout />}>

        {/* Admin + Supervisor */}
        <Route path="employees" element={
          <RequireAuth roles={["admin","supervisor"]}><EmployeeList /></RequireAuth>
        } />
        <Route path="employees/new" element={
          <RequireAuth roles={["admin","supervisor"]}><EmployeeForm /></RequireAuth>
        } />
        <Route path="employees/:id/edit" element={
          <RequireAuth roles={["admin","supervisor"]}><EmployeeForm /></RequireAuth>
        } />
        <Route path="work-locations" element={
          <RequireAuth roles={["admin","supervisor"]}><WorkLocations /></RequireAuth>
        } />
        <Route path="dashboard" element={
          <RequireAuth roles={["admin","supervisor"]}><Dashboard /></RequireAuth>
        } />
        <Route path="attendance/report" element={
          <RequireAuth roles={["admin","supervisor"]}><AttendanceReport /></RequireAuth>
        } />

        {/* Admin only */}
        <Route path="payslips" element={
          <RequireAuth roles={["admin"]}><PayslipGenerate /></RequireAuth>
        } />
        <Route path="payslips/:employeeId/:year/:month" element={
          <RequireAuth roles={["admin"]}><PayslipView /></RequireAuth>
        } />
        <Route path="users" element={
          <RequireAuth roles={["admin"]}><UserManagement /></RequireAuth>
        } />
        <Route path="jobs" element={
          <RequireAuth roles={["admin"]}><JobList /></RequireAuth>
        } />
        <Route path="jobs/new" element={
          <RequireAuth roles={["admin"]}><JobForm /></RequireAuth>
        } />
        <Route path="jobs/:id/edit" element={
          <RequireAuth roles={["admin"]}><JobForm /></RequireAuth>
        } />
        <Route path="payroll/structures" element={
          <RequireAuth roles={["admin"]}><SalaryStructures /></RequireAuth>
        } />
        <Route path="payroll/runs" element={
          <RequireAuth roles={["admin"]}><PayrollRunPage /></RequireAuth>
        } />
        <Route path="payroll/runs/:id" element={
          <RequireAuth roles={["admin"]}><PayrollDetail /></RequireAuth>
        } />
        <Route path="payroll/advances" element={
          <RequireAuth roles={["admin"]}><AdvancesPage /></RequireAuth>
        } />
        <Route path="payroll/settings" element={
          <RequireAuth roles={["admin"]}><PayrollSettings /></RequireAuth>
        } />
        <Route path="vehicles/new" element={
          <RequireAuth roles={["admin"]}><VehicleForm /></RequireAuth>
        } />
        <Route path="vehicles/:id/edit" element={
          <RequireAuth roles={["admin"]}><VehicleForm /></RequireAuth>
        } />

        {/* Admin + Supervisor */}
        <Route path="vehicles" element={
          <RequireAuth roles={["admin","supervisor"]}><VehicleList /></RequireAuth>
        } />
        <Route path="tracking/assign" element={
          <RequireAuth roles={["admin","supervisor"]}><AssignVehicle /></RequireAuth>
        } />
        <Route path="tracking/live" element={
          <RequireAuth roles={["admin","supervisor"]}><LiveTracking /></RequireAuth>
        } />

        {/* All roles */}
        <Route path="attendance" element={
          <RequireAuth><AttendanceEntry /></RequireAuth>
        } />
        <Route path="profile" element={
          <RequireAuth><Profile /></RequireAuth>
        } />
        <Route path="settings" element={
          <RequireAuth><Settings /></RequireAuth>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
