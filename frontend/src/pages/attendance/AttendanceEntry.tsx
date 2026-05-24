import { useEffect, useRef, useState } from "react";
import { getAllEmployees } from "../../api/employeeApi";
import { clockIn, clockOut, getTodayStatus, faceScan } from "../../api/attendanceApi";
import AlertMessage from "../../components/AlertMessage";
import type { Employee } from "../../types/employee";
import type { Attendance, FaceScanResult } from "../../types/attendance";

function todayStr()   { return new Date().toISOString().split("T")[0]; }
function nowTimeStr() { return new Date().toTimeString().slice(0, 5); }

export default function AttendanceEntry() {
  const [activeTab, setActiveTab] = useState("face");
  const [alert, setAlert]         = useState({ type: "", message: "" });

  // ── Face Scan tab state ────────────────────────────────────────────────────
  const videoRef                    = useRef<HTMLVideoElement>(null);
  const canvasRef                   = useRef<HTMLCanvasElement>(null);
  const streamRef                   = useRef<MediaStream | null>(null);
  const [camOpen, setCamOpen]       = useState(false);
  const [camReady, setCamReady]     = useState(false);
  const [scanning, setScanning]     = useState(false);
  const [scanResult, setScanResult] = useState<FaceScanResult | null>(null);

  // ── Manual tab state ───────────────────────────────────────────────────────
  const [employees, setEmployees]     = useState<Employee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState("");
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [loadingMan, setLoadingMan]   = useState(false);
  // "idle" → camera step ("capture") → submit step ("confirm") → done
  const [manStep, setManStep]         = useState("idle");  // idle | capture | confirm
  const [manAction, setManAction]     = useState<string | null>(null);    // "clock_in" | "clock_out"
  const [manPhoto, setManPhoto]       = useState<string | null>(null);

  const manVideoRef                     = useRef<HTMLVideoElement>(null);
  const manCanvasRef                    = useRef<HTMLCanvasElement>(null);
  const manStreamRef                    = useRef<MediaStream | null>(null);
  const [manCamOpen, setManCamOpen]     = useState(false);
  const [manCamReady, setManCamReady]   = useState(false);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    getAllEmployees({ all: true })
      .then((r) => setEmployees(r.data.items))
      .catch((e: Error) => setAlert({ type: "danger", message: e.message }));
    return () => { stopStream(); stopManStream(); };
  }, []);

  useEffect(() => {
    if (selectedEmp) {
      getTodayStatus(selectedEmp)
        .then((r) => setTodayRecord(r.data))
        .catch(() => setTodayRecord(null));
    } else {
      setTodayRecord(null);
      resetManualFlow();
    }
  }, [selectedEmp]);

  // Attach face-scan stream
  useEffect(() => {
    if (camOpen && streamRef.current && videoRef.current) {
      const v = videoRef.current;
      v.srcObject = streamRef.current;
      v.onloadedmetadata = () => v.play().then(() => setCamReady(true)).catch(() => {});
    }
    if (!camOpen) setCamReady(false);
  }, [camOpen]);

  // Attach manual stream
  useEffect(() => {
    if (manCamOpen && manStreamRef.current && manVideoRef.current) {
      const v = manVideoRef.current;
      v.srcObject = manStreamRef.current;
      v.onloadedmetadata = () => v.play().then(() => setManCamReady(true)).catch(() => {});
    }
    if (!manCamOpen) setManCamReady(false);
  }, [manCamOpen]);

  // ── Face Scan tab helpers ──────────────────────────────────────────────────
  async function openCamera() {
    setScanResult(null);
    setAlert({ type: "", message: "" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      setCamOpen(true);
    } catch {
      setAlert({ type: "danger", message: "Cannot access camera. Please allow camera permissions." });
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOpen(false);
  }

  async function handleFaceScan() {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video?.videoWidth) {
      setAlert({ type: "warning", message: "Camera not ready. Please wait and try again." });
      return;
    }
    canvas!.width  = video.videoWidth;
    canvas!.height = video.videoHeight;
    canvas!.getContext("2d")!.drawImage(video, 0, 0);
    stopStream();
    setScanning(true);
    try {
      const res = await faceScan(canvas!.toDataURL("image/png"));
      setScanResult(res.data);
      setAlert({
        type: "success",
        message: res.data.action === "clock_in"
          ? `\u2705 Welcome ${res.data.employee_name}! Clocked IN at ${res.data.attendance.entry_time}`
          : `\uD83D\uDC4B Goodbye ${res.data.employee_name}! Clocked OUT at ${res.data.attendance.exit_time} \u2014 ${res.data.attendance.hours_worked} hrs worked`,
      });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setScanning(false);
    }
  }

  // ── Manual tab helpers ─────────────────────────────────────────────────────
  function resetManualFlow() {
    stopManStream();
    setManStep("idle");
    setManAction(null);
    setManPhoto(null);
  }

  async function openManCamera(action: string) {
    setManPhoto(null);
    setManAction(action);
    setAlert({ type: "", message: "" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      manStreamRef.current = stream;
      setManCamOpen(true);
      setManStep("capture");
    } catch {
      setAlert({ type: "danger", message: "Cannot access camera. Please allow camera permissions." });
    }
  }

  function stopManStream() {
    manStreamRef.current?.getTracks().forEach((t) => t.stop());
    manStreamRef.current = null;
    setManCamOpen(false);
  }

  function captureManPhoto() {
    const video = manVideoRef.current, canvas = manCanvasRef.current;
    if (!video?.videoWidth) {
      setAlert({ type: "warning", message: "Camera not ready. Please wait and try again." });
      return;
    }
    canvas!.width  = video.videoWidth;
    canvas!.height = video.videoHeight;
    canvas!.getContext("2d")!.drawImage(video, 0, 0);
    setManPhoto(canvas!.toDataURL("image/png"));
    stopManStream();
    setManStep("confirm");
  }

  async function handleClockIn() {
    setLoadingMan(true);
    try {
      const res = await clockIn({
        employee_id: parseInt(selectedEmp),
        date:        todayStr(),
        entry_time:  nowTimeStr(),
        image:       manPhoto,
      });
      setTodayRecord(res.data);
      setAlert({ type: "success", message: `Clocked in at ${res.data.entry_time}` });
      resetManualFlow();
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
      resetManualFlow();
    } finally {
      setLoadingMan(false);
    }
  }

  async function handleClockOut() {
    setLoadingMan(true);
    try {
      const res = await clockOut(todayRecord!.id, {
        exit_time: nowTimeStr(),
        image:     manPhoto,
      });
      setTodayRecord(res.data);
      setAlert({ type: "success", message: `Clocked out at ${res.data.exit_time} \u2014 ${res.data.hours_worked} hrs` });
      resetManualFlow();
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
      resetManualFlow();
    } finally {
      setLoadingMan(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="row justify-content-center">
      <div className="col-md-7">
        <h3 className="fw-bold mb-3">Attendance Entry</h3>
        <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button className={`nav-link ${activeTab === "face" ? "active" : ""}`}
              onClick={() => { setActiveTab("face"); stopStream(); setScanResult(null); }}>
              Face Scan
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${activeTab === "manual" ? "active" : ""}`}
              onClick={() => { setActiveTab("manual"); stopStream(); }}>
              Manual
            </button>
          </li>
        </ul>

        {/* ── FACE SCAN TAB ── */}
        {activeTab === "face" && (
          <div className="card shadow-sm">
            <div className="card-body text-center p-4">
              <p className="text-muted">Stand in front of the camera. The system will identify you and clock in or out automatically.</p>

              <div style={{ display: camOpen ? "block" : "none" }} className="mb-3">
                <video ref={videoRef} autoPlay playsInline muted
                  className="rounded border w-100" style={{ maxWidth: 420 }} />
                <div className="mt-3">
                  <button className="btn btn-success btn-lg me-2"
                    onClick={handleFaceScan} disabled={scanning || !camReady}>
                    {scanning ? "Identifying…" : camReady ? "📸 Scan Face" : "Starting camera…"}
                  </button>
                  <button className="btn btn-outline-secondary" onClick={stopStream}>Cancel</button>
                </div>
              </div>

              {!camOpen && !scanning && (
                <button className="btn btn-dark btn-lg" onClick={openCamera}>Open Camera</button>
              )}

              {scanning && (
                <div className="mt-3">
                  <div className="spinner-border text-primary me-2" />
                  <span>Identifying face…</span>
                </div>
              )}

              {scanResult && (
                <div className={`alert mt-3 ${scanResult.action === "clock_in" ? "alert-success" : "alert-info"}`}>
                  <h5>{scanResult.employee_name}</h5>
                  {scanResult.action === "clock_in" ? (
                    <p className="mb-0">Clocked <strong>IN</strong> at {scanResult.attendance.entry_time}</p>
                  ) : (
                    <>
                      <p className="mb-0">Clocked <strong>OUT</strong> at {scanResult.attendance.exit_time}</p>
                      <p className="mb-0">Hours worked: <strong>{scanResult.attendance.hours_worked}</strong></p>
                    </>
                  )}
                  <button className="btn btn-sm btn-outline-dark mt-2" onClick={openCamera}>Scan Another</button>
                </div>
              )}
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>
          </div>
        )}

        {/* ── MANUAL TAB ── */}
        {activeTab === "manual" && (
          <div className="card shadow-sm">
            <div className="card-body">

              {/* Step 1 — Select employee */}
              <div className="mb-3">
                <label className="form-label fw-semibold">Select Employee</label>
                <select className="form-select" value={selectedEmp}
                  onChange={(e) => { setSelectedEmp(e.target.value); resetManualFlow(); }}>
                  <option value="">-- Select --</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              {selectedEmp && <p className="text-muted mb-3"><strong>Date:</strong> {todayStr()}</p>}

              {/* Completed for today */}
              {todayRecord?.exit_time && (
                <div className="alert alert-success">
                  <div>Entry: <strong>{todayRecord.entry_time}</strong></div>
                  <div>Exit: <strong>{todayRecord.exit_time}</strong></div>
                  <div>Hours: <strong>{todayRecord.hours_worked} hrs</strong></div>
                </div>
              )}

              {/* Step 2 — Camera capture */}
              {manStep === "capture" && (
                <div className="text-center">
                  <p className="text-muted fw-semibold mb-2">
                    Look at the camera to verify your identity before{" "}
                    {manAction === "clock_in" ? "clocking in" : "clocking out"}.
                  </p>
                  <div style={{ display: manCamOpen ? "block" : "none" }} className="mb-3">
                    <video ref={manVideoRef} autoPlay playsInline muted
                      className="rounded border w-100" style={{ maxWidth: 420 }} />
                    <div className="mt-2 d-flex justify-content-center gap-2">
                      <button className="btn btn-success" onClick={captureManPhoto} disabled={!manCamReady}>
                        {manCamReady ? "📸 Capture" : "Starting camera…"}
                      </button>
                      <button className="btn btn-outline-secondary" onClick={resetManualFlow}>Cancel</button>
                    </div>
                  </div>
                  <canvas ref={manCanvasRef} style={{ display: "none" }} />
                </div>
              )}

              {/* Step 3 — Confirm captured photo */}
              {manStep === "confirm" && manPhoto && (
                <div className="text-center">
                  <p className="fw-semibold mb-2">Confirm your photo to proceed:</p>
                  <img src={manPhoto} alt="Captured"
                    className="rounded border mb-3" style={{ width: "100%", maxWidth: 320 }} />
                  <div className="d-flex justify-content-center gap-2">
                    <button
                      className={`btn ${manAction === "clock_in" ? "btn-success" : "btn-danger"} px-4`}
                      onClick={manAction === "clock_in" ? handleClockIn : handleClockOut}
                      disabled={loadingMan}
                    >
                      {loadingMan ? "Processing…" : manAction === "clock_in" ? "Confirm Clock In" : "Confirm Clock Out"}
                    </button>
                    <button className="btn btn-outline-secondary" onClick={() => openManCamera(manAction!)}>
                      Retake
                    </button>
                    <button className="btn btn-outline-danger" onClick={resetManualFlow}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Step 1 actions — show clock in/out buttons only in idle step */}
              {manStep === "idle" && selectedEmp && !todayRecord && (
                <button className="btn btn-success w-100" onClick={() => openManCamera("clock_in")}>
                  Clock In
                </button>
              )}
              {manStep === "idle" && todayRecord && !todayRecord.exit_time && (
                <>
                  <div className="alert alert-info mb-3">
                    Clocked in at <strong>{todayRecord.entry_time}</strong>
                  </div>
                  <button className="btn btn-danger w-100" onClick={() => openManCamera("clock_out")}>
                    Clock Out
                  </button>
                </>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
