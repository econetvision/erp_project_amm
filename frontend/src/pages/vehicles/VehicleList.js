import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listVehicles, deleteVehicle } from "../../api/vehicleApi";
import AlertMessage from "../../components/AlertMessage";
import ConfirmModal from "../../components/ConfirmModal";
import { useAuth } from "../../context/AuthContext";

const STATUS_BADGE = { available: "success", assigned: "primary", maintenance: "warning" };

export default function VehicleList() {
  const { auth }                    = useAuth();
  const [vehicles, setVehicles]     = useState([]);
  const [alert, setAlert]           = useState(null);
  const [delTarget, setDelTarget]   = useState(null);

  async function load() {
    try {
      const { data } = await listVehicles();
      setVehicles(data);
    } catch (e) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    try {
      await deleteVehicle(delTarget.id);
      setAlert({ type: "success", message: `Vehicle ${delTarget.reg_number} deleted.` });
      setDelTarget(null);
      load();
    } catch (e) {
      setAlert({ type: "danger", message: e.message });
      setDelTarget(null);
    }
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Vehicles</h4>
        {auth?.role === "admin" && (
          <Link to="/vehicles/new" className="btn btn-primary btn-sm">+ Add Vehicle</Link>
        )}
      </div>

      <AlertMessage alert={alert} onClose={() => setAlert(null)} />

      <div className="table-responsive">
        <table className="table table-hover table-bordered align-middle">
          <thead className="table-dark">
            <tr>
              <th>#</th><th>Reg Number</th><th>Type</th><th>Make / Model</th><th>Status</th>
              {auth?.role === "admin" && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted">No vehicles found.</td></tr>
            )}
            {vehicles.map(v => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td className="fw-semibold">{v.reg_number}</td>
                <td className="text-capitalize">{v.type}</td>
                <td>{[v.make, v.model].filter(Boolean).join(" ") || "—"}</td>
                <td>
                  <span className={`badge bg-${STATUS_BADGE[v.status] || "secondary"}`}>
                    {v.status}
                  </span>
                </td>
                {auth?.role === "admin" && (
                  <td>
                    <Link to={`/vehicles/${v.id}/edit`} className="btn btn-sm btn-outline-secondary me-1">Edit</Link>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setDelTarget(v)}
                      disabled={v.status === "assigned"}
                      title={v.status === "assigned" ? "Release assignment first" : ""}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        show={!!delTarget}
        title="Delete Vehicle"
        message={`Delete vehicle ${delTarget?.reg_number}? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}
