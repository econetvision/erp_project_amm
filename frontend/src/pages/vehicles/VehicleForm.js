import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getVehicle, createVehicle, updateVehicle } from "../../api/vehicleApi";
import AlertMessage from "../../components/AlertMessage";

const TYPES   = ["truck", "auto", "van", "bike", "other"];
const STATUSES = ["available", "maintenance"];

export default function VehicleForm() {
  const { id }           = useParams();
  const navigate         = useNavigate();
  const isEdit           = Boolean(id);
  const [alert, setAlert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm]  = useState({
    reg_number: "", type: "truck", make: "", model: "", status: "available",
  });

  useEffect(() => {
    if (!isEdit) return;
    getVehicle(id).then(({ data }) => setForm({
      reg_number: data.reg_number,
      type:       data.type,
      make:       data.make || "",
      model:      data.model || "",
      status:     data.status,
    })).catch(e => setAlert({ type: "danger", message: e.message }));
  }, [id, isEdit]);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        reg_number: form.reg_number,
        type:       form.type,
        make:       form.make || null,
        model:      form.model || null,
        ...(isEdit ? { status: form.status } : {}),
      };
      if (isEdit) {
        await updateVehicle(id, payload);
      } else {
        await createVehicle(payload);
      }
      navigate("/vehicles");
    } catch (e) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: 520 }}>
      <h4 className="mb-3">{isEdit ? "Edit Vehicle" : "Add Vehicle"}</h4>
      <AlertMessage alert={alert} onClose={() => setAlert(null)} />
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Registration Number *</label>
          <input className="form-control" name="reg_number" value={form.reg_number} onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label className="form-label">Type *</label>
          <select className="form-select" name="type" value={form.type} onChange={handleChange}>
            {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Make</label>
          <input className="form-control" name="make" value={form.make} onChange={handleChange} placeholder="e.g. Tata" />
        </div>
        <div className="mb-3">
          <label className="form-label">Model</label>
          <input className="form-control" name="model" value={form.model} onChange={handleChange} placeholder="e.g. Ace Gold" />
        </div>
        {isEdit && (
          <div className="mb-3">
            <label className="form-label">Status</label>
            <select className="form-select" name="status" value={form.status} onChange={handleChange}>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        )}
        <div className="d-flex gap-2">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Update" : "Create"}
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate("/vehicles")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
