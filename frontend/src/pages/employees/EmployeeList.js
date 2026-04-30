import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "bootstrap";
import { getAllEmployees, deleteEmployee } from "../../api/employeeApi";
import AlertMessage from "../../components/AlertMessage";
import ConfirmModal from "../../components/ConfirmModal";

function maskAadhar(num) {
  return num ? `XXXX-XXXX-${num.slice(-4)}` : "-";
}

export default function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [alert, setAlert]         = useState({ type: "", message: "" });
  const [deleteId, setDeleteId]   = useState(null);
  const navigate                  = useNavigate();

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      const res = await getAllEmployees();
      setEmployees(res.data);
    } catch (e) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  function openDeleteModal(id) {
    setDeleteId(id);
    const modal = Modal.getOrCreateInstance(document.getElementById("confirmModal"));
    modal.show();
  }

  async function handleDelete() {
    try {
      await deleteEmployee(deleteId);
      setAlert({ type: "success", message: "Employee deleted successfully." });
      fetchEmployees();
    } catch (e) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="fw-bold">Employees</h3>
        <button className="btn btn-primary" onClick={() => navigate("/employees/new")}>
          + Add Employee
        </button>
      </div>

      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-striped table-hover mb-0">
            <thead className="table-dark">
              <tr>
                <th>Photo</th>
                <th>#</th>
                <th>Name</th>
                <th>Aadhar</th>
                <th>Bank Account</th>
                <th>Hourly Rate (₹)</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan="8" className="text-center text-muted py-4">No employees found.</td></tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      {emp.photo ? (
                        <img
                          src={emp.photo}
                          alt={emp.name}
                          style={{
                            width: 42, height: 42,
                            objectFit: "cover",
                            borderRadius: "50%",
                            border: "2px solid #dee2e6",
                          }}
                        />
                      ) : (
                        <div style={{
                          width: 42, height: 42, borderRadius: "50%",
                          background: "#e9ecef", border: "2px solid #dee2e6",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 16, color: "#adb5bd", fontWeight: 600,
                        }}>
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td>{emp.id}</td>
                    <td className="fw-semibold">{emp.name}</td>
                    <td><code>{maskAadhar(emp.aadhar_number)}</code></td>
                    <td><code>{emp.bank_account_number ? "X".repeat(Math.max(0, emp.bank_account_number.length - 4)) + emp.bank_account_number.slice(-4) : "-"}</code></td>
                    <td>₹{parseFloat(emp.hourly_rate).toFixed(2)}</td>
                    <td className="text-truncate" style={{ maxWidth: 200 }}>{emp.address}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-primary me-2"
                        onClick={() => navigate(`/employees/${emp.id}/edit`)}
                      >Edit</button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => openDeleteModal(emp.id)}
                      >Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        message={`Are you sure you want to delete employee #${deleteId}? This will also remove all attendance and payslip records.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
