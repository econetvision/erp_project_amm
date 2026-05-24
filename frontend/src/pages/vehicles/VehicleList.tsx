import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listVehicles, deleteVehicle } from "../../api/vehicleApi";
import AlertMessage from "../../components/AlertMessage";
import ConfirmModal from "../../components/ConfirmModal";
import Pagination from "../../components/Pagination";
import { useAuth } from "../../context/AuthContext";
import type { Vehicle } from "../../types/vehicle";

const STATUS_BADGE: Record<string, string> = { available: "success", assigned: "primary", maintenance: "warning" };
const VEHICLE_ICONS: Record<string, string> = {
  bus: "🚌", truck: "🚛", car: "🚗", van: "🚐", bike: "🏍️", auto: "🛺",
  tipper: "🚜", compactor: "🗑️", loader: "🏗️", tanker: "🚒", ambulance: "🚑",
  default: "🚗",
};

function getVehicleIcon(type: string) {
  return VEHICLE_ICONS[type?.toLowerCase()] || VEHICLE_ICONS.default;
}

export default function VehicleList() {
  const { auth }                    = useAuth();
  const [vehicles, setVehicles]     = useState<Vehicle[]>([]);
  const [search, setSearch]         = useState("");
  const [alert, setAlert]           = useState<{ type: string; message: string } | null>(null);
  const [delTarget, setDelTarget]   = useState<Vehicle | null>(null);

  const filtered = vehicles.filter(v =>
    v.reg_number.toLowerCase().includes(search.toLowerCase()) ||
    (v.make || "").toLowerCase().includes(search.toLowerCase()) ||
    (v.model || "").toLowerCase().includes(search.toLowerCase())
  );

  async function load() {
    try {
      const { data } = await listVehicles();
      setVehicles(data);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    try {
      await deleteVehicle(delTarget!.id);
      setAlert({ type: "success", message: `Vehicle ${delTarget!.reg_number} deleted.` });
      setDelTarget(null);
      load();
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
      setDelTarget(null);
    }
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-2">
          <span style={{ fontSize: 28 }}>🚛</span>
          <div>
            <h4 className="mb-0 fw-bold">Vehicle Fleet</h4>
            <small className="text-muted">{vehicles.length} vehicles registered</small>
          </div>
        </div>
        <div className="d-flex gap-2">
          <Link to="/tracking/live" className="btn btn-outline-success btn-sm">📍 Live Tracking</Link>
          {auth?.role === "admin" && (
            <Link to="/vehicles/new" className="btn btn-primary btn-sm">+ Add Vehicle</Link>
          )}
        </div>
      </div>

      <AlertMessage alert={alert} onClose={() => setAlert(null)} />

      {/* Vehicle type filter icons */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {Object.entries(VEHICLE_ICONS).filter(([k]) => k !== "default").map(([type, icon]) => {
          const count = vehicles.filter(v => v.type?.toLowerCase() === type).length;
          if (count === 0) return null;
          return (
            <button key={type}
              className={`btn btn-sm ${search.toLowerCase() === type ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setSearch(search.toLowerCase() === type ? "" : type)}>
              {icon} {type.charAt(0).toUpperCase() + type.slice(1)} ({count})
            </button>
          );
        })}
        {search && (
          <button className="btn btn-sm btn-outline-danger" onClick={() => setSearch("")}>✕ Clear</button>
        )}
      </div>

      <div className="mb-3">
        <input className="form-control" placeholder="Search vehicles…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Pagination items={filtered} pageSize={10}>
      {(pageItems, pagination) => (
      <div className="table-responsive">
        <table className="table table-hover table-bordered align-middle">
          <thead className="table-dark">
            <tr>
              <th>#</th><th>Reg Number</th><th>Type</th><th>Make / Model</th><th>Status</th>
              {auth?.role === "admin" && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted">No vehicles found.</td></tr>
            )}
            {pageItems.map(v => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td className="fw-semibold">{v.reg_number}</td>
                <td>
                  <span className="me-1" style={{ fontSize: "1.2rem" }}>{getVehicleIcon(v.type)}</span>
                  <span className="text-capitalize">{v.type}</span>
                </td>
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
        {pagination}
      </div>
      )}
      </Pagination>

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
