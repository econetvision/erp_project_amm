import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getVehicle, createVehicle, updateVehicle } from "../../api/vehicleApi";
import AlertMessage from "../../components/AlertMessage";
import ValidatedInput from "../../components/ValidatedInput";
import { useFormValidation, required, pattern } from "../../hooks/useFormValidation";
import type { Vehicle } from "../../types/vehicle";

const TYPES   = ["truck", "auto", "van", "bike", "other"];
const STATUSES = ["available", "maintenance"];

export default function VehicleForm() {
  const { id }           = useParams();
  const navigate         = useNavigate();
  const isEdit           = Boolean(id);
  const [alert, setAlert] = useState<{ type: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm]  = useState({
    reg_number: "", type: "truck", make: "", model: "", status: "available", tracker_imei: "",
  });

  const { touch, validateAll, getFieldProps } = useFormValidation({
    reg_number: [required(), pattern(/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/i, "Indian format: TN01AB1234")],
    type: [required()],
    tracker_imei: [pattern(/^\d{14,20}$/, "IMEI must be 14-20 digits")],
  });

  useEffect(() => {
    if (!isEdit) return;
    getVehicle(id!).then(({ data }) => setForm({
      reg_number: data.reg_number,
      type:       data.type,
      make:       data.make || "",
      model:      data.model || "",
      status:     data.status,
      tracker_imei: data.tracker_imei || "",
    })).catch((e: any) => setAlert({ type: "danger", message: e.message }));
  }, [id, isEdit]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(f => {
      const next = { ...f, [name]: value };
      touch(name, value, next);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll(form)) return;
    setSaving(true);
    try {
      const payload = {
        reg_number: form.reg_number,
        type:       form.type,
        make:       form.make || null,
        model:      form.model || null,
        tracker_imei: form.tracker_imei || null,
        ...(isEdit ? { status: form.status } : {}),
      };
      if (isEdit) {
        await updateVehicle(id!, payload);
      } else {
        await createVehicle(payload);
      }
      navigate("/vehicles");
    } catch (e: any) {
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
        <ValidatedInput label="Registration Number" name="reg_number" value={form.reg_number}
          onChange={handleChange} onBlur={() => touch("reg_number", form.reg_number)}
          validation={getFieldProps("reg_number")} icon="🚗" required
          placeholder="e.g. TN01AB1234" hint="Indian vehicle registration format" />

        <ValidatedInput label="Type" name="type" value={form.type}
          onChange={handleChange} onBlur={() => touch("type", form.type)}
          validation={getFieldProps("type")} as="select" icon="📋" required>
          {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </ValidatedInput>

        <ValidatedInput label="Make" name="make" value={form.make}
          onChange={handleChange} icon="🏭" placeholder="e.g. Tata" />

        <ValidatedInput label="Model" name="model" value={form.model}
          onChange={handleChange} icon="📝" placeholder="e.g. Ace Gold" />

        <ValidatedInput label="Tracker IMEI" name="tracker_imei" value={form.tracker_imei}
          onChange={handleChange} onBlur={() => touch("tracker_imei", form.tracker_imei)}
          validation={getFieldProps("tracker_imei")} icon="📡"
          placeholder="e.g. 860123456789012" hint="Optional — IMEI of the installed hardware GPS tracker" />

        {isEdit && (
          <ValidatedInput label="Status" name="status" value={form.status}
            onChange={handleChange} as="select">
            {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </ValidatedInput>
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
