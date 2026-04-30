import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout           from "./components/Layout";
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

// Redirect unauthenticated users to login
function RequireAuth({ children, roles }) {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(auth.role)) return <Navigate to="/attendance" replace />;
  return children;
}

function AppRoutes() {
  const { auth } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={auth ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/" element={<Layout />}>
        <Route index element={
          <Navigate to={auth?.role === "worker" ? "/attendance" : "/employees"} replace />
        } />

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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
