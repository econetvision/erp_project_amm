import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllEmployees } from "../../api/employeeApi";
import { generatePayslip, getEmployeePayslips } from "../../api/payslipApi";
import AlertMessage from "../../components/AlertMessage";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function PayslipGenerate() {
  const navigate              = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [empId, setEmpId]         = useState("");
  const [month, setMonth]         = useState(new Date().getMonth() + 1);
  const [year, setYear]           = useState(new Date().getFullYear());
  const [history, setHistory]     = useState([]);
  const [alert, setAlert]         = useState({ type: "", message: "" });
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    getAllEmployees()
      .then((r) => setEmployees(r.data))
      .catch((e) => setAlert({ type: "danger", message: e.message }));
  }, []);

  useEffect(() => {
    if (empId) {
      getEmployeePayslips(empId).then((r) => setHistory(r.data)).catch(() => setHistory([]));
    } else {
      setHistory([]);
    }
  }, [empId]);

  async function handleGenerate() {
    if (!empId) return setAlert({ type: "warning", message: "Please select an employee." });
    setLoading(true);
    try {
      await generatePayslip({ employee_id: parseInt(empId), month, year });
      setAlert({ type: "success", message: "Payslip generated successfully!" });
      navigate(`/payslips/${empId}/${year}/${month}`);
    } catch (e) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3 className="fw-bold mb-3">Generate Payslip</h3>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label fw-semibold">Employee</label>
              <select className="form-select" value={empId} onChange={(e) => setEmpId(e.target.value)}>
                <option value="">-- Select --</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold">Month</label>
              <select className="form-select" value={month} onChange={(e) => setMonth(+e.target.value)}>
                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label fw-semibold">Year</label>
              <input className="form-control" type="number" value={year}
                onChange={(e) => setYear(+e.target.value)} min="2000" />
            </div>
            <div className="col-md-3">
              <button className="btn btn-success w-100" onClick={handleGenerate} disabled={loading}>
                {loading ? "Generating…" : "Generate Payslip"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div className="card shadow-sm">
          <div className="card-header fw-bold">Previous Payslips</div>
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-dark">
                <tr><th>Month</th><th>Year</th><th>Hours</th><th>Rate</th><th>Gross Pay</th><th></th></tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id}>
                    <td>{MONTHS[p.month - 1]}</td>
                    <td>{p.year}</td>
                    <td>{p.total_hours}</td>
                    <td>₹{parseFloat(p.hourly_rate).toFixed(2)}</td>
                    <td className="fw-bold text-success">₹{parseFloat(p.gross_pay).toFixed(2)}</td>
                    <td>
                      <button className="btn btn-sm btn-outline-primary"
                        onClick={() => navigate(`/payslips/${p.employee_id}/${p.year}/${p.month}`)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
