import { useEffect, useState, type FormEvent } from "react";
import { getStructures, createStructure, deleteStructure } from "../../api/payrollApi";
import AlertMessage from "../../components/AlertMessage";
import type { SalaryStructure, SalaryComponentCreate } from "../../types/payroll";

const EMPTY_COMP: SalaryComponentCreate = {
  name: "", type: "earning", calculation_type: "fixed",
  amount_or_percentage: 0, is_mandatory: true, display_order: 0,
};

export default function SalaryStructures() {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [alert, setAlert]     = useState({ type: "", message: "" });
  const [showForm, setShowForm] = useState(false);
  const [name, setName]       = useState("");
  const [desc, setDesc]       = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [components, setComponents] = useState<SalaryComponentCreate[]>([
    { name: "HRA", type: "earning", calculation_type: "percentage_of_basic", amount_or_percentage: 40, is_mandatory: true, display_order: 1 },
    { name: "DA", type: "earning", calculation_type: "percentage_of_basic", amount_or_percentage: 10, is_mandatory: true, display_order: 2 },
    { name: "TA", type: "earning", calculation_type: "fixed", amount_or_percentage: 1600, is_mandatory: false, display_order: 3 },
    { name: "ESI", type: "deduction", calculation_type: "percentage_of_gross", amount_or_percentage: 0.75, is_mandatory: true, display_order: 10 },
    { name: "PF", type: "deduction", calculation_type: "percentage_of_basic", amount_or_percentage: 12, is_mandatory: true, display_order: 11 },
    { name: "Professional Tax", type: "deduction", calculation_type: "fixed", amount_or_percentage: 200, is_mandatory: true, display_order: 12 },
  ]);
  const [saving, setSaving]   = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try { const { data } = await getStructures(); setStructures(data); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createStructure({ name, description: desc || null, is_default: isDefault, components });
      setAlert({ type: "success", message: "Structure created." });
      setShowForm(false);
      setName(""); setDesc("");
      load();
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this salary structure?")) return;
    try { await deleteStructure(id); load(); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  function updateComp(idx: number, field: string, value: any) {
    setComponents(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  function addComp() {
    setComponents(prev => [...prev, { ...EMPTY_COMP, display_order: prev.length }]);
  }

  function removeComp(idx: number) {
    setComponents(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="fw-bold mb-0">Salary Structures</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Structure"}
        </button>
      </div>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {showForm && (
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-primary text-white fw-semibold">Create Salary Structure</div>
          <div className="card-body">
            <form onSubmit={handleCreate}>
              <div className="row g-3 mb-3">
                <div className="col-md-5">
                  <label className="form-label fw-semibold">Name *</label>
                  <input className="form-control" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Standard" />
                </div>
                <div className="col-md-5">
                  <label className="form-label fw-semibold">Description</label>
                  <input className="form-control" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" />
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" checked={isDefault} onChange={() => setIsDefault(!isDefault)} />
                    <label className="form-check-label">Default</label>
                  </div>
                </div>
              </div>

              <h6 className="fw-bold">Components</h6>
              <div className="table-responsive mb-3">
                <table className="table table-sm table-bordered">
                  <thead className="table-light">
                    <tr><th>Name</th><th>Type</th><th>Calc Type</th><th>Amount/%</th><th>Mandatory</th><th></th></tr>
                  </thead>
                  <tbody>
                    {components.map((c, i) => (
                      <tr key={i}>
                        <td><input className="form-control form-control-sm" value={c.name} onChange={e => updateComp(i, "name", e.target.value)} /></td>
                        <td>
                          <select className="form-select form-select-sm" value={c.type} onChange={e => updateComp(i, "type", e.target.value)}>
                            <option value="earning">Earning</option>
                            <option value="deduction">Deduction</option>
                          </select>
                        </td>
                        <td>
                          <select className="form-select form-select-sm" value={c.calculation_type} onChange={e => updateComp(i, "calculation_type", e.target.value)}>
                            <option value="fixed">Fixed</option>
                            <option value="percentage_of_basic">% of Basic</option>
                            <option value="percentage_of_gross">% of Gross</option>
                          </select>
                        </td>
                        <td><input className="form-control form-control-sm" type="number" step="0.01" value={c.amount_or_percentage} onChange={e => updateComp(i, "amount_or_percentage", parseFloat(e.target.value) || 0)} /></td>
                        <td className="text-center">
                          <input type="checkbox" className="form-check-input" checked={c.is_mandatory} onChange={() => updateComp(i, "is_mandatory", !c.is_mandatory)} />
                        </td>
                        <td><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeComp(i)}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addComp}>+ Add Component</button>
              </div>

              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create Structure"}
              </button>
            </form>
          </div>
        </div>
      )}

      {structures.length === 0 ? (
        <div className="text-center text-muted py-5">No salary structures. Create one above.</div>
      ) : (
        structures.map(s => (
          <div className="card shadow-sm mb-3" key={s.id}>
            <div className="card-header d-flex justify-content-between align-items-center" style={{ cursor: "pointer" }} onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
              <div>
                <strong>{s.name}</strong>
                {s.is_default && <span className="badge bg-success ms-2">Default</span>}
                {s.description && <span className="text-muted ms-2 small">— {s.description}</span>}
              </div>
              <div>
                <span className="badge bg-secondary me-2">{s.components.length} components</span>
                <button className="btn btn-sm btn-outline-danger" onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}>Delete</button>
              </div>
            </div>
            {expanded === s.id && (
              <div className="card-body p-0">
                <table className="table table-sm mb-0">
                  <thead className="table-light">
                    <tr><th>Component</th><th>Type</th><th>Calculation</th><th>Value</th></tr>
                  </thead>
                  <tbody>
                    {s.components.sort((a, b) => a.display_order - b.display_order).map(c => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td><span className={`badge bg-${c.type === "earning" ? "success" : "danger"}`}>{c.type}</span></td>
                        <td>{c.calculation_type.replace(/_/g, " ")}</td>
                        <td>{c.calculation_type === "fixed" ? `₹${c.amount_or_percentage}` : `${c.amount_or_percentage}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
