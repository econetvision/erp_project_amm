import { useEffect, useRef, useState } from "react";import { useNavigate, useParams } from "react-router-dom";
import { createEmployee, getEmployee, updateEmployee, registerFace, lookupIfsc, verifyBank } from "../../api/employeeApi";
import AlertMessage from "../../components/AlertMessage";
import MultiStepForm from "../../components/MultiStepForm";
import ValidatedInput from "../../components/ValidatedInput";
import { useFormValidation, required, pattern, minLength, minValue } from "../../hooks/useFormValidation";

const EMPTY = { name: "", address: "", aadhar_number: "", bank_account_number: "", ifsc_code: "", hourly_rate: "", shift: "SHIFT_A", gender: "", date_of_birth: "", blood_group: "", marital_status: "", emergency_contact: "", emergency_name: "" };
const STEPS = [
  { title: "Personal Info", icon: "👤" },
  { title: "Bank Details", icon: "🏦" },
  { title: "Employment", icon: "💼" },
  { title: "Face Registration", icon: "📸" },
];

export default function EmployeeForm() {
  const { id }                = useParams();
  const isEdit                = Boolean(id);
  const navigate              = useNavigate();
  const [form, setForm]       = useState(EMPTY);
  const [alert, setAlert]     = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [step, setStep]       = useState(0);

  // Webcam state
  const videoRef              = useRef<HTMLVideoElement>(null);
  const canvasRef             = useRef<HTMLCanvasElement>(null);
  const streamRef             = useRef<MediaStream | null>(null);
  const [camOpen, setCamOpen] = useState(false);
  const [camReady, setCamReady] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [faceLoading, setFaceLoading] = useState(false);

  // Bank KYC state
  const [bankInfo, setBankInfo] = useState<{bank: string; branch: string} | null>(null);
  const [ifscLoading, setIfscLoading] = useState(false);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Form validation
  const { touch, validateAll, getFieldProps, reset } = useFormValidation({
    name: [required(), minLength(2, "Name must be at least 2 characters")],
    address: [required(), minLength(5, "Address too short")],
    aadhar_number: [required(), pattern(/^\d{12}$/, "Must be exactly 12 digits")],
    bank_account_number: [required(), pattern(/^\d{8,18}$/, "Must be 8-18 digits")],
    hourly_rate: [required(), minValue(0, "Rate cannot be negative")],
    ifsc_code: [pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC format (e.g. SBIN0001234)")],
  });

  // Attach stream after video element mounts
  useEffect(() => {
    if (camOpen && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.onloadedmetadata = () => {
        video.play().then(() => setCamReady(true)).catch(() => {});
      };
    }
    if (!camOpen) setCamReady(false);
  }, [camOpen]);

  useEffect(() => {
    if (isEdit) {
      getEmployee(id!)
        .then((res) => {
          setForm({
          ...res.data,
          hourly_rate: res.data.hourly_rate.toString(),
          ifsc_code: res.data.ifsc_code || "",
          gender: res.data.gender || "",
          date_of_birth: res.data.date_of_birth || "",
          blood_group: res.data.blood_group || "",
          marital_status: res.data.marital_status || "",
          emergency_contact: res.data.emergency_contact || "",
          emergency_name: res.data.emergency_name || "",
        });
          setSavedId(parseInt(id!));
          setKycStatus(res.data.kyc_status);
        })
        .catch((e: any) => setAlert({ type: "danger", message: e.message }));
    }
  }, [id, isEdit]);

  // Stop camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      touch(name, value, next);
      return next;
    });
  }

  async function handleIfscLookup() {
    if (!form.ifsc_code || form.ifsc_code.length !== 11) return;
    setIfscLoading(true);
    try {
      const res = await lookupIfsc(savedId || 0, form.ifsc_code);
      setBankInfo(res.data);
      setForm(f => ({ ...f, bank_name: res.data.bank }));
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setIfscLoading(false);
    }
  }

  async function handleVerifyBank() {
    if (!savedId) return;
    setVerifying(true);
    try {
      const res = await verifyBank(savedId);
      setKycStatus(res.data.kyc_status);
      setAlert({ type: res.data.kyc_status === "verified" ? "success" : "warning", message: `KYC Status: ${res.data.kyc_status}${res.data.kyc_verified_name ? ` (Name: ${res.data.kyc_verified_name})` : ''}` });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll(form)) {
      setAlert({ type: "warning", message: "Please fill in all required fields: Name, Address, Aadhar Number, Bank Account, and Hourly Rate." });
      setStep(0);
      return;
    }
    setLoading(true);
    try {
      const payload = { ...form, hourly_rate: parseFloat(form.hourly_rate) };
      if (isEdit) {
        await updateEmployee(id!, payload);
        setAlert({ type: "success", message: "Employee updated. You can now register/update the face below." });
        setStep(3);
      } else {
        const res = await createEmployee(payload);
        setSavedId(res.data.id);
        setAlert({ type: "success", message: `Employee created (ID: ${res.data.id}). Now register their face below.` });
        setForm(EMPTY);
        setStep(3);
      }
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      setCamOpen(true);   // triggers useEffect to attach stream
      setCaptured(null);
    } catch {
      setAlert({ type: "danger", message: "Cannot access camera. Please allow camera permissions." });
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCamOpen(false);
  }

  function capturePhoto() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      setAlert({ type: "warning", message: "Camera not ready. Please wait a moment and try again." });
      return;
    }

    canvas!.width  = video.videoWidth;
    canvas!.height = video.videoHeight;
    canvas!.getContext("2d")!.drawImage(video, 0, 0);
    const dataUrl = canvas!.toDataURL("image/png");  // PNG is more reliable than JPEG
    setCaptured(dataUrl);
    stopCamera();
  }

  async function handleRegisterFace() {
    if (!captured || !savedId) return;
    setFaceLoading(true);
    try {
      await registerFace(savedId, captured);
      setAlert({ type: "success", message: "Face registered successfully! Employee can now clock in/out via face scan." });
      setCaptured(null);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setFaceLoading(false);
    }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-md-8">
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">{isEdit ? "Edit Employee" : "Add New Employee"}</h5>
          </div>
          <div className="card-body">
            <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />
            <MultiStepForm steps={STEPS} current={step}
              onStepClick={i => { if (i < step || (i === 3 && savedId)) setStep(i); }}>
              <form onSubmit={handleSubmit}>

                {/* Step 0: Personal Info */}
                {step === 0 && (
                  <div>
                    <ValidatedInput label="Full Name" name="name" value={form.name}
                      onChange={handleChange} onBlur={() => touch("name", form.name)}
                      validation={getFieldProps("name")} icon="👤" required />

                    <div className="row g-3 mb-3">
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Gender</label>
                        <select className="form-select" name="gender" value={form.gender} onChange={handleChange}>
                          <option value="">— Select —</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Date of Birth</label>
                        <input type="date" className="form-control" name="date_of_birth"
                          value={form.date_of_birth} onChange={handleChange} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Blood Group</label>
                        <select className="form-select" name="blood_group" value={form.blood_group} onChange={handleChange}>
                          <option value="">— Select —</option>
                          {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                            <option key={bg} value={bg}>{bg}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Marital Status</label>
                        <select className="form-select" name="marital_status" value={form.marital_status} onChange={handleChange}>
                          <option value="">— Select —</option>
                          <option value="single">Single</option>
                          <option value="married">Married</option>
                          <option value="divorced">Divorced</option>
                          <option value="widowed">Widowed</option>
                        </select>
                      </div>
                    </div>

                    <ValidatedInput label="Address" name="address" value={form.address}
                      onChange={handleChange} onBlur={() => touch("address", form.address)}
                      validation={getFieldProps("address")} as="textarea" rows={3}
                      icon="📍" required />

                    <ValidatedInput label="Aadhar Number (12 digits)" name="aadhar_number" value={form.aadhar_number}
                      onChange={handleChange} onBlur={() => touch("aadhar_number", form.aadhar_number)}
                      validation={getFieldProps("aadhar_number")} maxLength={12}
                      icon="🪪" required hint="Enter 12-digit Aadhar number" />

                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Emergency Contact Name</label>
                        <input className="form-control" name="emergency_name" value={form.emergency_name}
                          onChange={handleChange} placeholder="e.g. Spouse or Parent name" />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Emergency Contact Phone</label>
                        <input className="form-control" name="emergency_contact" value={form.emergency_contact}
                          onChange={handleChange} placeholder="+91 9876543210" maxLength={20} />
                      </div>
                    </div>

                    <div className="d-flex justify-content-between mt-3">
                      <button type="button" className="btn btn-secondary" onClick={() => navigate("/employees")}>Cancel</button>
                      <button type="button" className="btn btn-primary"
                        disabled={!form.name || !form.address || !form.aadhar_number}
                        onClick={() => setStep(1)}>Next →</button>
                    </div>
                  </div>
                )}

                {/* Step 1: Bank Details */}
                {step === 1 && (
                  <div>
                    <ValidatedInput label="Bank Account Number" name="bank_account_number" value={form.bank_account_number}
                      onChange={handleChange} onBlur={() => touch("bank_account_number", form.bank_account_number)}
                      validation={getFieldProps("bank_account_number")} minLength={8} maxLength={18}
                      icon="🏦" required hint="8 to 18 digits" />

                    <div className="mb-3">
                      <label className="form-label fw-semibold">IFSC Code</label>
                      <div className="input-group">
                        <span className="input-group-text">🏛️</span>
                        <input className={`form-control ${getFieldProps("ifsc_code").className || ""}`}
                          name="ifsc_code" value={form.ifsc_code || ""}
                          onChange={handleChange} onBlur={() => touch("ifsc_code", form.ifsc_code)}
                          maxLength={11} placeholder="e.g. SBIN0001234"
                          style={{ textTransform: "uppercase" }} />
                        <button className="btn btn-outline-secondary" type="button"
                          onClick={handleIfscLookup} disabled={ifscLoading || !form.ifsc_code}>
                          {ifscLoading ? "Looking up…" : "Lookup"}
                        </button>
                        {getFieldProps("ifsc_code").error && <div className="invalid-feedback">{getFieldProps("ifsc_code").error}</div>}
                      </div>
                      {bankInfo && (
                        <div className="form-text text-success">
                          🏦 {bankInfo.bank} — {bankInfo.branch}
                        </div>
                      )}
                    </div>
                    {savedId && form.ifsc_code && (
                      <div className="mb-3">
                        <button className="btn btn-outline-info" type="button" onClick={handleVerifyBank} disabled={verifying}>
                          {verifying ? "Verifying…" : "🔍 Verify Bank Account"}
                        </button>
                        {kycStatus && (
                          <span className={`ms-2 badge bg-${kycStatus === "verified" ? "success" : kycStatus === "name_mismatch" ? "warning" : "secondary"}`}>
                            {kycStatus}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="d-flex justify-content-between mt-3">
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setStep(0)}>← Back</button>
                      <button type="button" className="btn btn-primary"
                        disabled={!form.bank_account_number}
                        onClick={() => setStep(2)}>Next →</button>
                    </div>
                  </div>
                )}

                {/* Step 2: Employment */}
                {step === 2 && (
                  <div>
                    <ValidatedInput label="Hourly Rate (₹)" name="hourly_rate" value={form.hourly_rate}
                      onChange={handleChange} onBlur={() => touch("hourly_rate", form.hourly_rate)}
                      validation={getFieldProps("hourly_rate")} type="number" step="0.01" min={0}
                      icon="💰" required />

                    <ValidatedInput label="Shift" name="shift" value={form.shift}
                      onChange={handleChange} as="select">
                      <option value="SHIFT_A">Shift A — 6:30 AM to 2:00 PM (break 10:30 AM, 20 min)</option>
                      <option value="SHIFT_B">Shift B — 9:00 AM to 5:00 PM (break 1:30 PM, 20 min)</option>
                    </ValidatedInput>

                    <div className="d-flex justify-content-between mt-3">
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setStep(1)}>← Back</button>
                      <button type="submit" className="btn btn-success" disabled={loading}>
                        {loading ? "Saving…" : isEdit ? "Update Employee" : "Create Employee"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Face Registration — only after save */}
                {step === 3 && (
                  <div className="text-center">
                    {!savedId ? (
                      <div className="py-4 text-muted">
                        <p>Please complete steps 1-3 and save the employee first.</p>
                        <button type="button" className="btn btn-primary" onClick={() => setStep(0)}>← Go Back</button>
                      </div>
                    ) : (
                      <>
                        <p className="text-muted">Capture a clear front-facing photo for face recognition clock in/out.</p>

                        <div style={{ display: camOpen ? "block" : "none" }} className="mb-3">
                          <video ref={videoRef} autoPlay playsInline muted
                            className="rounded border"
                            style={{ width: "100%", maxWidth: 420 }} />
                          <div className="mt-2">
                            <button className="btn btn-success me-2" type="button" onClick={capturePhoto} disabled={!camReady}>
                              {camReady ? "📸 Capture" : "Starting camera…"}
                            </button>
                            <button className="btn btn-outline-secondary" type="button" onClick={stopCamera}>
                              Cancel
                            </button>
                          </div>
                        </div>

                        {captured && (
                          <div className="mb-3">
                            <img src={captured} alt="Captured face"
                              className="rounded border mb-2"
                              style={{ width: "100%", maxWidth: 420 }} />
                            <div className="d-flex justify-content-center gap-2">
                              <button className="btn btn-primary" type="button" onClick={handleRegisterFace} disabled={faceLoading}>
                                {faceLoading ? "Registering…" : "Register Face"}
                              </button>
                              <button className="btn btn-outline-secondary" type="button" onClick={openCamera}>
                                Retake
                              </button>
                            </div>
                          </div>
                        )}

                        {!camOpen && !captured && (
                          <button className="btn btn-dark" type="button" onClick={openCamera}>
                            Open Camera
                          </button>
                        )}

                        <canvas ref={canvasRef} style={{ display: "none" }} />

                        <div className="mt-3">
                          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate("/employees")}>
                            Done — Go to Employees
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

              </form>
            </MultiStepForm>
          </div>
        </div>
      </div>
    </div>
  );
}
