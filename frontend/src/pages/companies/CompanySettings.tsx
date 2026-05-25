import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCompany, updateCompany, uploadCompanyLogo } from "../../api/companyApi";
import AlertMessage from "../../components/AlertMessage";
import { useAuth } from "../../context/AuthContext";
import type { Company, CompanyUpdate } from "../../types/company";

export default function CompanySettings() {
  const { id } = useParams<{ id: string }>();
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");

  // Form states
  const [profile, setProfile] = useState({ name: "", code: "", phone: "", email: "", website: "", address: "", city: "", state: "", pincode: "", gst_number: "", pan_number: "" });
  const [themeConfig, setThemeConfig] = useState({ primaryColor: "#0d6efd", accentColor: "#4ea8e8", mode: "light", font: "Inter" });
  const [payrollConfig, setPayrollConfig] = useState({ esi_rate: 0.75, pf_rate: 12.0, working_days: 26, overtime_multiplier: 1.5 });
  const [attendanceConfig, setAttendanceConfig] = useState({ gps_enabled: true, geofencing: true, qr_enabled: false });
  const [features, setFeatures] = useState({ payroll: true, vehicles: true, attendance_face: true, jobs: true });

  const companyId = id ? parseInt(id) : auth?.company_id;

  useEffect(() => {
    if (!companyId) return;
    async function load() {
      try {
        const r = await getCompany(companyId!);
        setCompany(r.data);
        setProfile({
          name: r.data.name, code: r.data.code, phone: r.data.phone || "",
          email: r.data.email || "", website: r.data.website || "",
          address: r.data.address || "", city: r.data.city || "",
          state: r.data.state || "", pincode: r.data.pincode || "",
          gst_number: r.data.gst_number || "", pan_number: r.data.pan_number || "",
        });
        if (r.data.theme_config) setThemeConfig({ ...themeConfig, ...r.data.theme_config });
        if (r.data.payroll_config) setPayrollConfig({ ...payrollConfig, ...r.data.payroll_config });
        if (r.data.attendance_config) setAttendanceConfig({ ...attendanceConfig, ...r.data.attendance_config });
        if (r.data.features) setFeatures({ ...features, ...r.data.features });
      } catch (e: any) {
        setAlert({ type: "danger", message: e.message });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  async function saveProfile() {
    if (!companyId) return;
    try {
      await updateCompany(companyId, profile);
      setAlert({ type: "success", message: "Company profile updated." });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function saveTheme() {
    if (!companyId) return;
    try {
      await updateCompany(companyId, { theme_config: themeConfig } as CompanyUpdate);
      setAlert({ type: "success", message: "Theme settings saved." });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function savePayroll() {
    if (!companyId) return;
    try {
      await updateCompany(companyId, { payroll_config: payrollConfig } as CompanyUpdate);
      setAlert({ type: "success", message: "Payroll settings saved." });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function saveAttendance() {
    if (!companyId) return;
    try {
      await updateCompany(companyId, { attendance_config: attendanceConfig } as CompanyUpdate);
      setAlert({ type: "success", message: "Attendance settings saved." });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function saveFeatures() {
    if (!companyId) return;
    try {
      await updateCompany(companyId, { features } as CompanyUpdate);
      setAlert({ type: "success", message: "Feature settings saved." });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!companyId || !e.target.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const r = await uploadCompanyLogo(companyId, reader.result as string);
        setCompany(r.data);
        setAlert({ type: "success", message: "Logo uploaded." });
      } catch (err: any) {
        setAlert({ type: "danger", message: err.message });
      }
    };
    reader.readAsDataURL(e.target.files[0]);
  }

  if (loading) return <div className="d-flex justify-content-center py-5"><div className="spinner-border text-primary" /></div>;
  if (!company) return <div className="alert alert-warning">Company not found.</div>;

  const TABS = [
    { key: "profile", label: "Profile" },
    { key: "theme", label: "Branding & Theme" },
    { key: "payroll", label: "Payroll Config" },
    { key: "attendance", label: "Attendance Rules" },
    { key: "features", label: "Features" },
  ];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold mb-0">Company Settings: {company.name}</h3>
        {auth?.role === "master" && (
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/companies")}>
            Back to Companies
          </button>
        )}
      </div>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        {TABS.map(t => (
          <li className="nav-item" key={t.key}>
            <button className={`nav-link ${activeTab === t.key ? "active" : ""}`}
              onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4 text-center">
                {company.logo_path ? (
                  <img src={company.logo_path} alt="Logo" className="img-fluid rounded" style={{ maxHeight: 120 }} />
                ) : (
                  <div className="bg-light rounded d-flex align-items-center justify-content-center" style={{ height: 120, width: 120, margin: "0 auto" }}>
                    <span className="text-muted">No Logo</span>
                  </div>
                )}
                <div className="mt-2">
                  <label className="btn btn-sm btn-outline-primary">
                    Upload Logo
                    <input type="file" hidden accept="image/*" onChange={handleLogoUpload} />
                  </label>
                </div>
              </div>
              <div className="col-md-8">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Name</label>
                    <input className="form-control" value={profile.name}
                      onChange={e => setProfile({ ...profile, name: e.target.value })} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold">Code</label>
                    <input className="form-control" value={profile.code}
                      onChange={e => setProfile({ ...profile, code: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Email</label>
                    <input className="form-control" value={profile.email}
                      onChange={e => setProfile({ ...profile, email: e.target.value })} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold">Phone</label>
                    <input className="form-control" value={profile.phone}
                      onChange={e => setProfile({ ...profile, phone: e.target.value })} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold">Website</label>
                    <input className="form-control" value={profile.website}
                      onChange={e => setProfile({ ...profile, website: e.target.value })} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Address</label>
                    <textarea className="form-control" rows={2} value={profile.address}
                      onChange={e => setProfile({ ...profile, address: e.target.value })} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">City</label>
                    <input className="form-control" value={profile.city}
                      onChange={e => setProfile({ ...profile, city: e.target.value })} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">State</label>
                    <input className="form-control" value={profile.state}
                      onChange={e => setProfile({ ...profile, state: e.target.value })} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Pincode</label>
                    <input className="form-control" value={profile.pincode}
                      onChange={e => setProfile({ ...profile, pincode: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">GST Number</label>
                    <input className="form-control" value={profile.gst_number}
                      onChange={e => setProfile({ ...profile, gst_number: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">PAN Number</label>
                    <input className="form-control" value={profile.pan_number}
                      onChange={e => setProfile({ ...profile, pan_number: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
            <div className="text-end mt-3">
              <button className="btn btn-primary" onClick={saveProfile}>Save Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* Theme Tab */}
      {activeTab === "theme" && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label fw-semibold">Mode</label>
                <select className="form-select" value={themeConfig.mode}
                  onChange={e => setThemeConfig({ ...themeConfig, mode: e.target.value })}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Primary Color</label>
                <div className="d-flex align-items-center gap-2">
                  <input type="color" className="form-control form-control-color" value={themeConfig.primaryColor}
                    onChange={e => setThemeConfig({ ...themeConfig, primaryColor: e.target.value })} />
                  <code>{themeConfig.primaryColor}</code>
                </div>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Accent Color</label>
                <div className="d-flex align-items-center gap-2">
                  <input type="color" className="form-control form-control-color" value={themeConfig.accentColor}
                    onChange={e => setThemeConfig({ ...themeConfig, accentColor: e.target.value })} />
                  <code>{themeConfig.accentColor}</code>
                </div>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Font</label>
                <select className="form-select" value={themeConfig.font}
                  onChange={e => setThemeConfig({ ...themeConfig, font: e.target.value })}>
                  <option value="Inter">Inter</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Open Sans">Open Sans</option>
                  <option value="Poppins">Poppins</option>
                </select>
              </div>
            </div>
            {/* Live Preview */}
            <div className="mt-4">
              <h6 className="fw-semibold">Preview</h6>
              <div className="p-3 rounded border" style={{
                backgroundColor: themeConfig.mode === "dark" ? "#1a1a2e" : "#ffffff",
                color: themeConfig.mode === "dark" ? "#e0e0e0" : "#212529",
                fontFamily: themeConfig.font,
              }}>
                <div className="d-flex align-items-center gap-3 mb-3">
                  <div className="rounded" style={{ width: 40, height: 40, backgroundColor: themeConfig.primaryColor }} />
                  <div className="rounded" style={{ width: 40, height: 40, backgroundColor: themeConfig.accentColor }} />
                  <span className="fw-bold">Sample Dashboard</span>
                </div>
                <button className="btn btn-sm me-2" style={{ backgroundColor: themeConfig.primaryColor, color: "#fff" }}>
                  Primary Button
                </button>
                <button className="btn btn-sm" style={{ backgroundColor: themeConfig.accentColor, color: "#fff" }}>
                  Accent Button
                </button>
              </div>
            </div>
            <div className="text-end mt-3">
              <button className="btn btn-primary" onClick={saveTheme}>Save Theme</button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Tab */}
      {activeTab === "payroll" && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label fw-semibold">ESI Rate (%)</label>
                <input type="number" step="0.01" className="form-control" value={payrollConfig.esi_rate}
                  onChange={e => setPayrollConfig({ ...payrollConfig, esi_rate: parseFloat(e.target.value) })} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">PF Rate (%)</label>
                <input type="number" step="0.01" className="form-control" value={payrollConfig.pf_rate}
                  onChange={e => setPayrollConfig({ ...payrollConfig, pf_rate: parseFloat(e.target.value) })} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Working Days/Month</label>
                <input type="number" className="form-control" value={payrollConfig.working_days}
                  onChange={e => setPayrollConfig({ ...payrollConfig, working_days: parseInt(e.target.value) })} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Overtime Multiplier</label>
                <input type="number" step="0.1" className="form-control" value={payrollConfig.overtime_multiplier}
                  onChange={e => setPayrollConfig({ ...payrollConfig, overtime_multiplier: parseFloat(e.target.value) })} />
              </div>
            </div>
            <div className="text-end mt-3">
              <button className="btn btn-primary" onClick={savePayroll}>Save Payroll Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === "attendance" && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" checked={attendanceConfig.gps_enabled}
                    onChange={e => setAttendanceConfig({ ...attendanceConfig, gps_enabled: e.target.checked })} />
                  <label className="form-check-label fw-semibold">GPS Attendance</label>
                </div>
              </div>
              <div className="col-md-4">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" checked={attendanceConfig.geofencing}
                    onChange={e => setAttendanceConfig({ ...attendanceConfig, geofencing: e.target.checked })} />
                  <label className="form-check-label fw-semibold">Geofencing</label>
                </div>
              </div>
              <div className="col-md-4">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" checked={attendanceConfig.qr_enabled}
                    onChange={e => setAttendanceConfig({ ...attendanceConfig, qr_enabled: e.target.checked })} />
                  <label className="form-check-label fw-semibold">QR Code Attendance</label>
                </div>
              </div>
            </div>
            <div className="text-end mt-3">
              <button className="btn btn-primary" onClick={saveAttendance}>Save Attendance Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Features Tab */}
      {activeTab === "features" && (
        <div className="card shadow-sm">
          <div className="card-body">
            <p className="text-muted mb-3">Enable or disable modules for this company.</p>
            <div className="row g-3">
              {Object.entries(features).map(([key, val]) => (
                <div className="col-md-3" key={key}>
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={val}
                      onChange={e => setFeatures({ ...features, [key]: e.target.checked })} />
                    <label className="form-check-label fw-semibold">
                      {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-end mt-3">
              <button className="btn btn-primary" onClick={saveFeatures}>Save Features</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
