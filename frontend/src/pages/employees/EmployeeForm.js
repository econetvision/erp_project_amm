import { useEffect, useRef, useState } from "react";import { useNavigate, useParams } from "react-router-dom";
import { createEmployee, getEmployee, updateEmployee, registerFace } from "../../api/employeeApi";
import AlertMessage from "../../components/AlertMessage";

const EMPTY = { name: "", address: "", aadhar_number: "", bank_account_number: "", hourly_rate: "", shift: "SHIFT_A" };

export default function EmployeeForm() {
  const { id }                = useParams();
  const isEdit                = Boolean(id);
  const navigate              = useNavigate();
  const [form, setForm]       = useState(EMPTY);
  const [alert, setAlert]     = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState(null);

  // Webcam state
  const videoRef              = useRef(null);
  const canvasRef             = useRef(null);
  const streamRef             = useRef(null);
  const [camOpen, setCamOpen] = useState(false);
  const [camReady, setCamReady] = useState(false);
  const [captured, setCaptured] = useState(null);
  const [faceLoading, setFaceLoading] = useState(false);

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
      getEmployee(id)
        .then((res) => {
          setForm({ ...res.data, hourly_rate: res.data.hourly_rate.toString() });
          setSavedId(parseInt(id));
        })
        .catch((e) => setAlert({ type: "danger", message: e.message }));
    }
  }, [id, isEdit]);

  // Stop camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, hourly_rate: parseFloat(form.hourly_rate) };
      if (isEdit) {
        await updateEmployee(id, payload);
        setAlert({ type: "success", message: "Employee updated. You can now register/update the face below." });
      } else {
        const res = await createEmployee(payload);
        setSavedId(res.data.id);
        setAlert({ type: "success", message: `Employee created (ID: ${res.data.id}). Now register their face below.` });
        setForm(EMPTY);
      }
    } catch (e) {
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

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");  // PNG is more reliable than JPEG
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
    } catch (e) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setFaceLoading(false);
    }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-md-7">
        {/* Employee Details Card */}
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">{isEdit ? "Edit Employee" : "Add New Employee"}</h5>
          </div>
          <div className="card-body">
            <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label fw-semibold">Full Name</label>
                <input className="form-control" name="name" value={form.name}
                  onChange={handleChange} required />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Address</label>
                <textarea className="form-control" name="address" value={form.address}
                  onChange={handleChange} rows={3} required />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Aadhar Number (12 digits)</label>
                <input className="form-control" name="aadhar_number" value={form.aadhar_number}
                  onChange={handleChange} maxLength={12} pattern="\d{12}"
                  title="Must be exactly 12 digits" required />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Bank Account Number (8–18 digits)</label>
                <input className="form-control" name="bank_account_number" value={form.bank_account_number}
                  onChange={handleChange} minLength={8} maxLength={18} pattern="\d{8,18}"
                  title="Must be 8 to 18 digits" required />
              </div>
              <div className="mb-4">
                <label className="form-label fw-semibold">Hourly Rate (₹)</label>
                <input className="form-control" name="hourly_rate" type="number"
                  step="0.01" min="0" value={form.hourly_rate}
                  onChange={handleChange} required />
              </div>
              <div className="mb-4">
                <label className="form-label fw-semibold">Shift</label>
                <select className="form-select" name="shift" value={form.shift} onChange={handleChange}>
                  <option value="SHIFT_A">Shift A — 6:30 AM to 2:00 PM (break 10:30 AM, 20 min)</option>
                  <option value="SHIFT_B">Shift B — 9:00 AM to 5:00 PM (break 1:30 PM, 20 min)</option>
                </select>
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Saving…" : isEdit ? "Update Employee" : "Create Employee"}
                </button>
                <button type="button" className="btn btn-secondary"
                  onClick={() => navigate("/employees")}>Cancel</button>
              </div>
            </form>
          </div>
        </div>

        {/* Face Registration Card — shown after employee is saved */}
        {savedId && (
          <div className="card shadow-sm">
            <div className="card-header bg-dark text-white">
              <h5 className="mb-0">Face Registration</h5>
            </div>
            <div className="card-body text-center">
              <p className="text-muted">Capture a clear front-facing photo for face recognition clock in/out.</p>

              {/* Live webcam — always in DOM when camOpen, stream attached via useEffect */}
              <div style={{ display: camOpen ? "block" : "none" }} className="mb-3">
                <video ref={videoRef} autoPlay playsInline muted
                  className="rounded border"
                  style={{ width: "100%", maxWidth: 420 }} />
                <div className="mt-2">
                  <button className="btn btn-success me-2" onClick={capturePhoto} disabled={!camReady}>
                    {camReady ? "📸 Capture" : "Starting camera…"}
                    </button>
                    <button className="btn btn-outline-secondary" onClick={stopCamera}>
                      Cancel
                    </button>
                  </div>
              </div>

              {/* Captured preview */}
              {captured && (
                <div className="mb-3">
                  <img src={captured} alt="Captured face"
                    className="rounded border mb-2"
                    style={{ width: "100%", maxWidth: 420 }} />
                  <div className="d-flex justify-content-center gap-2">
                    <button className="btn btn-primary" onClick={handleRegisterFace} disabled={faceLoading}>
                      {faceLoading ? "Registering…" : "Register Face"}
                    </button>
                    <button className="btn btn-outline-secondary" onClick={openCamera}>
                      Retake
                    </button>
                  </div>
                </div>
              )}

              {!camOpen && !captured && (
                <button className="btn btn-dark" onClick={openCamera}>
                  Open Camera
                </button>
              )}

              {/* Hidden canvas for capture */}
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
