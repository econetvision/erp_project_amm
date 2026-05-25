import { useEffect, useState, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, Circle, InfoWindow, Autocomplete } from "@react-google-maps/api";
import {
  getAllLocations, createLocation, updateLocation, deleteLocation,
  getLocationEmployees, assignBulk, unassignEmployee,
  WorkLocation, WorkLocationCreate, EmployeeAssignment,
} from "../../api/locationApi";
import { getAllEmployees } from "../../api/employeeApi";
import AlertMessage from "../../components/AlertMessage";
import ConfirmModal from "../../components/ConfirmModal";
import type { Employee } from "../../types/employee";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const MAP_CENTER = { lat: 12.9716, lng: 77.5946 };
const LIBRARIES: ("places")[] = ["places"];
const WORK_TYPES = [
  { value: "dump_yard", label: "Dump Yard" },
  { value: "office", label: "Office" },
  { value: "site", label: "Work Site" },
  { value: "depot", label: "Depot" },
];

const EMPTY_FORM: WorkLocationCreate = {
  location_name: "", location_code: "", address: "", city: "", state: "", pincode: "",
  latitude: 0, longitude: 0, allowed_radius_km: 10, work_type: undefined, is_active: true,
};

export default function WorkLocations() {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: LIBRARIES });

  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [search, setSearch] = useState("");
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<WorkLocationCreate>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedLoc, setSelectedLoc] = useState<WorkLocation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Assignment state
  const [assignLoc, setAssignLoc] = useState<WorkLocation | null>(null);
  const [assignments, setAssignments] = useState<EmployeeAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmps, setSelectedEmps] = useState<number[]>([]);

  // Google Places Autocomplete
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  function onAutocompleteLoad(ac: google.maps.places.Autocomplete) {
    autocompleteRef.current = ac;
  }

  function onPlaceChanged() {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.geometry?.location) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    let city = "", state = "", pincode = "";
    const components = place.address_components || [];
    for (const c of components) {
      if (c.types.includes("locality")) city = c.long_name;
      else if (c.types.includes("administrative_area_level_1")) state = c.long_name;
      else if (c.types.includes("postal_code")) pincode = c.long_name;
    }
    setForm(f => ({
      ...f,
      address: place.formatted_address || f.address || "",
      city: city || f.city || "",
      state: state || f.state || "",
      pincode: pincode || f.pincode || "",
      latitude: lat,
      longitude: lng,
    }));
    // Pan map to selected place
    if (mapRef.current) {
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(15);
    }
  }

  const fetchLocations = useCallback(async () => {
    try {
      const res = await getAllLocations({ q: search || undefined, active_only: false });
      setLocations(res.data);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }, [search]);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setAssignLoc(null);
  }

  function openEdit(loc: WorkLocation) {
    setEditId(loc.id);
    setForm({
      location_name: loc.location_name,
      location_code: loc.location_code || "",
      address: loc.address || "",
      city: loc.city || "",
      state: loc.state || "",
      pincode: loc.pincode || "",
      latitude: loc.latitude,
      longitude: loc.longitude,
      allowed_radius_km: loc.allowed_radius_km,
      work_type: loc.work_type || undefined,
      is_active: loc.is_active,
    });
    setShowForm(true);
    setAssignLoc(null);
  }

  async function handleSave() {
    if (!form.location_name) {
      setAlert({ type: "warning", message: "Location name is required." });
      return;
    }
    if (!form.latitude && !form.longitude) {
      setAlert({ type: "warning", message: "Please search an address or click on the map to set coordinates." });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await updateLocation(editId, form);
        setAlert({ type: "success", message: "Location updated." });
      } else {
        await createLocation(form);
        setAlert({ type: "success", message: "Location created." });
      }
      setShowForm(false);
      fetchLocations();
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteLocation(confirmDelete);
      setAlert({ type: "success", message: "Location deleted." });
      setConfirmDelete(null);
      fetchLocations();
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function openAssignments(loc: WorkLocation) {
    setAssignLoc(loc);
    setShowForm(false);
    try {
      const [aRes, eRes] = await Promise.all([
        getLocationEmployees(loc.id),
        getAllEmployees({ all: true }),
      ]);
      setAssignments(aRes.data);
      setEmployees(eRes.data.items);
      setSelectedEmps([]);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function handleAssign() {
    if (!assignLoc || selectedEmps.length === 0) return;
    try {
      await assignBulk({ employee_ids: selectedEmps, location_id: assignLoc.id, is_primary: true });
      setAlert({ type: "success", message: `${selectedEmps.length} employee(s) assigned.` });
      openAssignments(assignLoc);
      fetchLocations();
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function handleUnassign(assignmentId: number) {
    if (!assignLoc) return;
    try {
      await unassignEmployee(assignmentId);
      openAssignments(assignLoc);
      fetchLocations();
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  function handleMapClick(e: google.maps.MapMouseEvent) {
    if (showForm && e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setForm(f => ({ ...f, latitude: lat, longitude: lng }));

      // Reverse geocode to fill address fields
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const place = results[0];
          let city = "", state = "", pincode = "";
          for (const c of place.address_components || []) {
            if (c.types.includes("locality")) city = c.long_name;
            else if (c.types.includes("administrative_area_level_1")) state = c.long_name;
            else if (c.types.includes("postal_code")) pincode = c.long_name;
          }
          setForm(f => ({
            ...f,
            address: place.formatted_address || f.address || "",
            city: city || f.city || "",
            state: state || f.state || "",
            pincode: pincode || f.pincode || "",
          }));
        }
      });
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  }

  const assignedEmpIds = new Set(assignments.map(a => a.employee_id));
  const unassignedEmployees = employees.filter(e => !assignedEmpIds.has(e.id));

  if (!GOOGLE_MAPS_API_KEY) {
    // Fallback: render without Google Maps – manual lat/lng entry, table-only view
    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0">📍 Work Locations Management</h4>
          <button className="btn btn-primary" onClick={openCreate}>+ Add Location</button>
        </div>

        <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

        <div className="card shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="row align-items-center">
              <div className="col-md-4">
                <div className="input-group input-group-sm">
                  <span className="input-group-text">🔍</span>
                  <input className="form-control" placeholder="Search locations..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="col-md-8 text-muted small">
                Manage work locations. Set <code>REACT_APP_GOOGLE_MAPS_API_KEY</code> to enable map view.
              </div>
            </div>
          </div>
        </div>

        {/* Create/Edit form without map */}
        {showForm && (
          <div className="card shadow-sm mb-3">
            <div className="card-header bg-primary text-white">
              <h6 className="mb-0">{editId ? "✏️ Edit Location" : "➕ New Location"}</h6>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Location Name *</label>
                  <input className="form-control form-control-sm" name="location_name" value={form.location_name} onChange={handleChange} />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Code</label>
                  <input className="form-control form-control-sm" name="location_code" value={form.location_code || ""} onChange={handleChange} placeholder="e.g. DY-01" />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Type</label>
                  <select className="form-select form-select-sm" name="work_type" value={form.work_type || ""} onChange={handleChange}>
                    <option value="">— Select —</option>
                    {WORK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="col-md-12">
                  <label className="form-label fw-semibold small">Address</label>
                  <input className="form-control form-control-sm" name="address" value={form.address || ""} onChange={handleChange} placeholder="Full address" />
                </div>
                <div className="col-md-4">
                  <input className="form-control form-control-sm" name="city" placeholder="City" value={form.city || ""} onChange={handleChange} />
                </div>
                <div className="col-md-4">
                  <input className="form-control form-control-sm" name="state" placeholder="State" value={form.state || ""} onChange={handleChange} />
                </div>
                <div className="col-md-4">
                  <input className="form-control form-control-sm" name="pincode" placeholder="Pincode" value={form.pincode || ""} onChange={handleChange} />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Latitude *</label>
                  <input className="form-control form-control-sm" type="number" step="any" name="latitude" value={form.latitude} onChange={handleChange} />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Longitude *</label>
                  <input className="form-control form-control-sm" type="number" step="any" name="longitude" value={form.longitude} onChange={handleChange} />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">Radius (km)</label>
                  <input className="form-control form-control-sm" type="number" step="0.1" min="0.1" max="100" name="allowed_radius_km" value={form.allowed_radius_km} onChange={handleChange} />
                </div>
              </div>
              <div className="d-flex gap-2 align-items-center mt-3">
                <button className="btn btn-success btn-sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : editId ? "Update" : "Create"}
                </button>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                {editId && (
                  <div className="form-check form-switch ms-auto">
                    <input className="form-check-input" type="checkbox" id="activeToggle"
                      checked={form.is_active !== false}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                    <label className="form-check-label small" htmlFor="activeToggle">
                      {form.is_active !== false ? "Active" : "Inactive"}
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Assignment panel */}
        {assignLoc && (
          <div className="card shadow-sm mb-3">
            <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
              <h6 className="mb-0">👥 {assignLoc.location_name}</h6>
              <button className="btn btn-sm btn-outline-light" onClick={() => setAssignLoc(null)}>✕</button>
            </div>
            <div className="card-body">
              <h6 className="fw-bold small text-success">Assigned ({assignments.length})</h6>
              {assignments.length === 0 && <p className="text-muted small">No employees assigned yet.</p>}
              <div className="list-group list-group-flush mb-3">
                {assignments.map(a => (
                  <div key={a.id} className="list-group-item d-flex justify-content-between align-items-center px-0 py-1">
                    <span className="small">{a.employee_name}{a.is_primary && <span className="badge bg-info ms-1">Primary</span>}</span>
                    <button className="btn btn-sm btn-outline-danger py-0" onClick={() => handleUnassign(a.id)}>✕</button>
                  </div>
                ))}
              </div>
              <hr />
              <h6 className="fw-bold small text-primary">Add Employees</h6>
              <div className="border rounded p-2 mb-2" style={{ maxHeight: 180, overflowY: "auto" }}>
                {unassignedEmployees.map(emp => (
                  <div key={emp.id} className="form-check">
                    <input className="form-check-input" type="checkbox" id={`emp-${emp.id}`}
                      checked={selectedEmps.includes(emp.id)}
                      onChange={e => setSelectedEmps(prev => e.target.checked ? [...prev, emp.id] : prev.filter(x => x !== emp.id))} />
                    <label className="form-check-label small" htmlFor={`emp-${emp.id}`}>{emp.name} (ID: {emp.id})</label>
                  </div>
                ))}
                {unassignedEmployees.length === 0 && <p className="text-muted small mb-0">All employees assigned.</p>}
              </div>
              {selectedEmps.length > 0 && (
                <button className="btn btn-success btn-sm w-100" onClick={handleAssign}>✓ Assign {selectedEmps.length} Employee(s)</button>
              )}
            </div>
          </div>
        )}

        {/* Locations table */}
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>City</th>
                  <th>Type</th>
                  <th>Radius</th>
                  <th>Employees</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {locations.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted py-4">No locations found. Click "+ Add Location" to create one.</td></tr>
                )}
                {locations.map(loc => (
                  <tr key={loc.id} className={!loc.is_active ? "table-secondary" : ""}>
                    <td className="fw-semibold">{loc.location_name}</td>
                    <td><span className="badge bg-secondary">{loc.location_code || "—"}</span></td>
                    <td>{[loc.city, loc.state].filter(Boolean).join(", ") || "—"}</td>
                    <td>{loc.work_type || "—"}</td>
                    <td>{loc.allowed_radius_km} km</td>
                    <td>{loc.employee_count}</td>
                    <td><span className={`badge bg-${loc.is_active ? "success" : "warning"}`}>{loc.is_active ? "Active" : "Inactive"}</span></td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(loc)}>Edit</button>
                      <button className="btn btn-sm btn-outline-success me-1" onClick={() => openAssignments(loc)}>Assign</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => setConfirmDelete(loc.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <ConfirmModal show={confirmDelete !== null} title="Delete Location"
          message="Are you sure you want to delete this location?" confirmLabel="Delete" variant="danger"
          onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">📍 Work Locations Management</h4>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Location</button>
      </div>

      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {/* Search */}
      <div className="card shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row align-items-center">
            <div className="col-md-4">
              <div className="input-group input-group-sm">
                <span className="input-group-text">🔍</span>
                <input className="form-control" placeholder="Search locations..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="col-md-8 text-muted small">
              Manage work locations (dump yards, offices, depots). Assign employees and configure geo-fence radius for attendance validation.
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        {/* Map */}
        <div className="col-lg-7">
          <div className="card shadow-sm" style={{ height: 520 }}>
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%", borderRadius: "0.375rem" }}
                center={locations.length > 0 ? { lat: locations[0].latitude, lng: locations[0].longitude } : MAP_CENTER}
                zoom={11}
                onClick={handleMapClick}
                onLoad={(map) => { mapRef.current = map; }}
              >
                {locations.map(loc => (
                  <Marker
                    key={loc.id}
                    position={{ lat: loc.latitude, lng: loc.longitude }}
                    title={loc.location_name}
                    onClick={() => setSelectedLoc(loc)}
                    icon={loc.is_active
                      ? undefined
                      : { url: "http://maps.google.com/mapfiles/ms/icons/grey.png" }
                    }
                  />
                ))}
                {locations.map(loc => (
                  <Circle
                    key={`circle-${loc.id}`}
                    center={{ lat: loc.latitude, lng: loc.longitude }}
                    radius={loc.allowed_radius_km * 1000}
                    options={{
                      fillColor: loc.is_active ? "#4ea8e8" : "#999",
                      fillOpacity: 0.12,
                      strokeColor: loc.is_active ? "#0d6efd" : "#666",
                      strokeWeight: 1.5,
                    }}
                  />
                ))}
                {selectedLoc && (
                  <InfoWindow
                    position={{ lat: selectedLoc.latitude, lng: selectedLoc.longitude }}
                    onCloseClick={() => setSelectedLoc(null)}
                  >
                    <div>
                      <strong>{selectedLoc.location_name}</strong>
                      {selectedLoc.location_code && <span className="ms-1 text-muted">({selectedLoc.location_code})</span>}
                      {selectedLoc.city && <div className="text-muted small">{selectedLoc.city}, {selectedLoc.state}</div>}
                      <div className="small mt-1">📐 Radius: {selectedLoc.allowed_radius_km} km</div>
                      <div className="small">👥 Employees: {selectedLoc.employee_count}</div>
                      {selectedLoc.work_type && <div className="small">🏷️ Type: {selectedLoc.work_type}</div>}
                      <div className="mt-2 d-flex gap-1">
                        <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(selectedLoc)}>Edit</button>
                        <button className="btn btn-sm btn-outline-success" onClick={() => openAssignments(selectedLoc)}>Assign</button>
                      </div>
                    </div>
                  </InfoWindow>
                )}
                {showForm && form.latitude !== 0 && (
                  <>
                    <Marker
                      position={{ lat: form.latitude, lng: form.longitude }}
                      icon={{ url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png" }}
                    />
                    <Circle
                      center={{ lat: form.latitude, lng: form.longitude }}
                      radius={(form.allowed_radius_km || 10) * 1000}
                      options={{ fillColor: "#28a745", fillOpacity: 0.15, strokeColor: "#28a745", strokeWeight: 2 }}
                    />
                  </>
                )}
              </GoogleMap>
            ) : (
              <div className="d-flex align-items-center justify-content-center h-100">Loading map...</div>
            )}
          </div>
          {showForm && <p className="text-muted small mt-1">💡 Search an address or click on the map to set location coordinates automatically</p>}
        </div>

        {/* Right panel */}
        <div className="col-lg-5">
          {showForm ? (
            <div className="card shadow-sm">
              <div className="card-header bg-primary text-white">
                <h6 className="mb-0">{editId ? "✏️ Edit Location" : "➕ New Location"}</h6>
              </div>
              <div className="card-body" style={{ maxHeight: 470, overflowY: "auto" }}>
                <div className="mb-2">
                  <label className="form-label fw-semibold small">Location Name *</label>
                  <input className="form-control form-control-sm" name="location_name" value={form.location_name} onChange={handleChange} />
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label className="form-label fw-semibold small">Code</label>
                    <input className="form-control form-control-sm" name="location_code" value={form.location_code || ""} onChange={handleChange} placeholder="e.g. DY-01" />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold small">Type</label>
                    <select className="form-select form-select-sm" name="work_type" value={form.work_type || ""} onChange={handleChange}>
                      <option value="">— Select —</option>
                      {WORK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mb-2">
                  <label className="form-label fw-semibold small">Address (search or type)</label>
                  {isLoaded ? (
                    <Autocomplete
                      onLoad={onAutocompleteLoad}
                      onPlaceChanged={onPlaceChanged}
                      options={{ componentRestrictions: { country: "in" } }}
                    >
                      <input
                        className="form-control form-control-sm"
                        name="address"
                        placeholder="Search for an address..."
                        value={form.address || ""}
                        onChange={handleChange}
                      />
                    </Autocomplete>
                  ) : (
                    <input className="form-control form-control-sm" name="address" value={form.address || ""} onChange={handleChange} placeholder="Address" />
                  )}
                  <small className="text-muted">Select from suggestions to auto-fill city, state, pincode &amp; coordinates</small>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-4"><input className="form-control form-control-sm" name="city" placeholder="City" value={form.city || ""} onChange={handleChange} /></div>
                  <div className="col-4"><input className="form-control form-control-sm" name="state" placeholder="State" value={form.state || ""} onChange={handleChange} /></div>
                  <div className="col-4"><input className="form-control form-control-sm" name="pincode" placeholder="Pincode" value={form.pincode || ""} onChange={handleChange} /></div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-4">
                    <label className="form-label fw-semibold small">Latitude</label>
                    <input className="form-control form-control-sm bg-light" type="number" step="any" name="latitude" value={form.latitude} readOnly disabled />
                  </div>
                  <div className="col-4">
                    <label className="form-label fw-semibold small">Longitude</label>
                    <input className="form-control form-control-sm bg-light" type="number" step="any" name="longitude" value={form.longitude} readOnly disabled />
                  </div>
                  <div className="col-4">
                    <label className="form-label fw-semibold small">Radius (km)</label>
                    <input className="form-control form-control-sm" type="number" step="0.1" min="0.1" max="100" name="allowed_radius_km" value={form.allowed_radius_km} onChange={handleChange} />
                  </div>
                </div>
                {form.latitude === 0 && form.longitude === 0 && (
                  <div className="text-warning small mb-2">⚠️ Search an address above or click on the map to set coordinates</div>
                )}
                <div className="d-flex gap-2 align-items-center mt-3">
                  <button className="btn btn-success btn-sm" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : editId ? "Update Location" : "Create Location"}
                  </button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                  {editId && (
                    <div className="form-check form-switch ms-auto">
                      <input className="form-check-input" type="checkbox" id="activeToggle"
                        checked={form.is_active !== false}
                        onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                      <label className="form-check-label small" htmlFor="activeToggle">
                        {form.is_active !== false ? "Active" : "Inactive"}
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : assignLoc ? (
            <div className="card shadow-sm">
              <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
                <h6 className="mb-0">👥 {assignLoc.location_name}</h6>
                <button className="btn btn-sm btn-outline-light" onClick={() => setAssignLoc(null)}>✕</button>
              </div>
              <div className="card-body" style={{ maxHeight: 470, overflowY: "auto" }}>
                <h6 className="fw-bold small text-success">Assigned Employees ({assignments.length})</h6>
                {assignments.length === 0 && <p className="text-muted small">No employees assigned yet.</p>}
                <div className="list-group list-group-flush mb-3">
                  {assignments.map(a => (
                    <div key={a.id} className="list-group-item d-flex justify-content-between align-items-center px-0 py-1">
                      <span className="small">
                        {a.employee_name}
                        {a.is_primary && <span className="badge bg-info ms-1">Primary</span>}
                      </span>
                      <button className="btn btn-sm btn-outline-danger py-0" onClick={() => handleUnassign(a.id)}>✕</button>
                    </div>
                  ))}
                </div>
                <hr />
                <h6 className="fw-bold small text-primary">Add Employees</h6>
                <div className="border rounded p-2 mb-2" style={{ maxHeight: 180, overflowY: "auto" }}>
                  {unassignedEmployees.map(emp => (
                    <div key={emp.id} className="form-check">
                      <input className="form-check-input" type="checkbox" id={`emp-${emp.id}`}
                        checked={selectedEmps.includes(emp.id)}
                        onChange={e => {
                          setSelectedEmps(prev => e.target.checked ? [...prev, emp.id] : prev.filter(x => x !== emp.id));
                        }} />
                      <label className="form-check-label small" htmlFor={`emp-${emp.id}`}>
                        {emp.name} <span className="text-muted">(ID: {emp.id})</span>
                      </label>
                    </div>
                  ))}
                  {unassignedEmployees.length === 0 && <p className="text-muted small mb-0">All employees are assigned.</p>}
                </div>
                {selectedEmps.length > 0 && (
                  <button className="btn btn-success btn-sm w-100" onClick={handleAssign}>
                    ✓ Assign {selectedEmps.length} Employee(s)
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="card shadow-sm">
              <div className="card-header bg-light d-flex justify-content-between align-items-center">
                <h6 className="mb-0">📋 Locations ({locations.length})</h6>
              </div>
              <div className="list-group list-group-flush" style={{ maxHeight: 470, overflowY: "auto" }}>
                {locations.map(loc => (
                  <div key={loc.id} className={`list-group-item ${!loc.is_active ? "bg-light text-muted" : ""}`}>
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="flex-grow-1" onClick={() => setSelectedLoc(loc)} style={{ cursor: "pointer" }}>
                        <strong>{loc.location_name}</strong>
                        {loc.location_code && <span className="badge bg-secondary ms-2 small">{loc.location_code}</span>}
                        {!loc.is_active && <span className="badge bg-warning ms-1">Inactive</span>}
                        <div className="small text-muted">{[loc.city, loc.state].filter(Boolean).join(", ") || "No address"}</div>
                        <div className="small">
                          <span className="me-2">📐 {loc.allowed_radius_km} km</span>
                          <span>👥 {loc.employee_count}</span>
                          {loc.work_type && <span className="ms-2 badge bg-light text-dark">{loc.work_type}</span>}
                        </div>
                      </div>
                      <div className="d-flex flex-column gap-1 ms-2">
                        <button className="btn btn-sm btn-outline-primary py-0 px-1" onClick={() => openEdit(loc)} title="Edit">✏️</button>
                        <button className="btn btn-sm btn-outline-success py-0 px-1" onClick={() => openAssignments(loc)} title="Assign">👥</button>
                        <button className="btn btn-sm btn-outline-danger py-0 px-1" onClick={() => setConfirmDelete(loc.id)} title="Delete">🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
                {locations.length === 0 && (
                  <div className="list-group-item text-center text-muted py-4">No locations found. Click "+ Add Location" to create one.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        show={confirmDelete !== null}
        title="Delete Location"
        message="Are you sure? All employee assignments to this location will be removed."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
