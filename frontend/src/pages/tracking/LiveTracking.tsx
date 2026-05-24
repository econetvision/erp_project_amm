import { useEffect, useRef, useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { getLatestLocations } from "../../api/trackingApi";
import { openTrackingSocket } from "../../api/trackingApi";
import AlertMessage from "../../components/AlertMessage";
import type { VehicleLocation } from "../../types/vehicle";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";

const MAP_CONTAINER = { width: "100%", height: "600px" };
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // India center

const TYPE_ICON: Record<string, string> = {
  truck: "🚛", auto: "🛺", van: "🚐", bike: "🏍️", other: "🚗",
};

export default function LiveTracking() {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });

  const [vehicles, setVehicles]   = useState<VehicleLocation[]>([]);
  const [selected, setSelected]   = useState<VehicleLocation | null>(null);
  const [alert, setAlert]         = useState<{ type: string; message: string } | null>(null);
  const socketsRef                = useRef<Record<number, WebSocket>>({});   // vehicle_id -> WebSocket
  const mapRef                    = useRef<any>(null);

  const onMapLoad = useCallback((map: any) => { mapRef.current = map; }, []);

  // Initial load
  async function load() {
    try {
      const { data } = await getLatestLocations();
      setVehicles(data);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  // Subscribe to live WebSocket feeds for assigned vehicles
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    // Open WS for each vehicle that has a location (assigned ones)
    vehicles.forEach(v => {
      if (socketsRef.current[v.vehicle_id]) return; // already open
      const ws = openTrackingSocket(v.vehicle_id, (update) => {
        setVehicles(prev => prev.map(veh =>
          veh.vehicle_id === update.vehicle_id
            ? { ...veh, latitude: update.latitude, longitude: update.longitude, speed: update.speed, recorded_at: update.recorded_at }
            : veh
        ));
      });
      socketsRef.current[v.vehicle_id] = ws;
    });

    return () => {
      Object.values(socketsRef.current).forEach((ws: WebSocket) => ws.close());
      socketsRef.current = {};
    };
    // eslint-disable-next-line
  }, [vehicles.length]);

  const located = vehicles.filter(v => v.latitude != null && v.longitude != null);

  if (!GOOGLE_MAPS_API_KEY) return <div className="p-4 text-center text-danger">Google Maps API key is not configured.</div>;
  if (!isLoaded) return <div className="p-4 text-center">Loading map…</div>;

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Live Vehicle Tracking</h4>
        <button className="btn btn-sm btn-outline-primary" onClick={load}>Refresh</button>
      </div>

      <AlertMessage alert={alert} onClose={() => setAlert(null)} />

      <div className="row g-3">
        {/* Sidebar */}
        <div className="col-md-3">
          <div className="card h-100">
            <div className="card-header fw-semibold">All Vehicles ({vehicles.length})</div>
            <div className="card-body p-0" style={{ overflowY: "auto", maxHeight: 560 }}>
              {vehicles.map(v => (
                <div
                  key={v.vehicle_id}
                  className={`p-2 border-bottom d-flex align-items-start gap-2 cursor-pointer ${selected?.vehicle_id === v.vehicle_id ? "bg-light" : ""}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSelected(v);
                    if (v.latitude && mapRef.current) {
                      mapRef.current.panTo({ lat: v.latitude, lng: v.longitude });
                      mapRef.current.setZoom(14);
                    }
                  }}
                >
                  <span style={{ fontSize: 22 }}>{TYPE_ICON[v.type] || "🚗"}</span>
                  <div>
                    <div className="fw-semibold small">{v.reg_number}</div>
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                      {v.employee_name || "Unassigned"}
                    </div>
                    <span className={`badge bg-${v.status === "assigned" ? "primary" : v.status === "maintenance" ? "warning" : "success"}`} style={{ fontSize: "0.65rem" }}>
                      {v.status}
                    </span>
                    {v.latitude == null && (
                      <div className="text-muted" style={{ fontSize: "0.7rem" }}>No location yet</div>
                    )}
                    {v.speed != null && (
                      <div style={{ fontSize: "0.7rem" }}>{v.speed} km/h</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="col-md-9">
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER}
            center={
              located.length > 0
                ? { lat: located[0].latitude!, lng: located[0].longitude! }
                : DEFAULT_CENTER
            }
            zoom={located.length > 0 ? 12 : 5}
            onLoad={onMapLoad}
          >
            {located.map(v => (
              <Marker
                key={v.vehicle_id}
                position={{ lat: v.latitude!, lng: v.longitude! }}
                title={`${v.reg_number} — ${v.employee_name || "Unassigned"}`}
                onClick={() => setSelected(v)}
                label={{
                  text: TYPE_ICON[v.type] || "🚗",
                  fontSize: "20px",
                  fontFamily: "Segoe UI Emoji, Apple Color Emoji, sans-serif",
                }}
              />
            ))}

            {selected?.latitude && (
              <InfoWindow
                position={{ lat: selected.latitude!, lng: selected.longitude! }}
                onCloseClick={() => setSelected(null)}
              >
                <div style={{ minWidth: 160 }}>
                  <div className="fw-bold">{selected.reg_number}</div>
                  <div>{selected.type} {selected.make ? `— ${selected.make} ${selected.model || ""}` : ""}</div>
                  <div>Driver: {selected.employee_name || "—"}</div>
                  {selected.speed != null && <div>Speed: {selected.speed} km/h</div>}
                  {selected.recorded_at && (
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                      {new Date(selected.recorded_at).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      </div>
    </div>
  );
}
