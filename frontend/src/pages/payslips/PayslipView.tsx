import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPayslip } from "../../api/payslipApi";
import { getEmployee } from "../../api/employeeApi";
import { getTemplates } from "../../api/payslipTemplateApi";
import AlertMessage from "../../components/AlertMessage";
import type { Payslip } from "../../types/payslip";
import type { Employee } from "../../types/employee";
import type { PayslipTemplate, TemplateSection, TemplateField } from "../../types/payslipTemplate";

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

const SHIFT_LABELS: Record<string, string> = {
  SHIFT_A: "Shift A — 6:30 AM to 2:00 PM",
  SHIFT_B: "Shift B — 9:00 AM to 5:00 PM",
};

const fmt = (v: any) => parseFloat(String(v ?? 0)).toFixed(2);

export default function PayslipView() {
  const { employeeId, year, month } = useParams();
  const navigate                    = useNavigate();
  const [payslip, setPayslip]       = useState<Payslip | null>(null);
  const [employee, setEmployee]     = useState<Employee | null>(null);
  const [template, setTemplate]     = useState<PayslipTemplate | null>(null);
  const [alert, setAlert]           = useState({ type: "", message: "" });

  useEffect(() => {
    Promise.all([
      getPayslip(employeeId!, year!, month!),
      getEmployee(employeeId!),
      getTemplates().catch(() => ({ data: [] as PayslipTemplate[] })),
    ])
      .then(([ps, emp, tpls]) => {
        setPayslip(ps.data);
        setEmployee(emp.data);
        const def = tpls.data.find((t: PayslipTemplate) => t.is_default) ?? tpls.data[0] ?? null;
        setTemplate(def);
      })
      .catch((e: any) => setAlert({ type: "danger", message: e.message }));
  }, [employeeId, year, month]);

  if (!payslip || !employee) return (
    <div className="text-center mt-5">
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />
      {!alert.message && <div className="spinner-border text-primary" />}
    </div>
  );

  /* build a lookup for field values */
  const fieldValues: Record<string, string> = {
    name: employee.name,
    id: `#${employee.id}`,
    aadhar_number: `XXXX-XXXX-${employee.aadhar_number?.slice(-4) ?? "****"}`,
    bank_account_number: employee.bank_account_number ?? "—",
    shift: SHIFT_LABELS[employee.shift] ?? employee.shift,
    department: (employee as any).department ?? "—",
    designation: (employee as any).designation ?? "—",
    work_location: (employee as any).work_location ?? "—",
    phone: (employee as any).phone ?? "—",
    email: (employee as any).email ?? "—",
    month_year: `${MONTHS[payslip.month - 1]} ${payslip.year}`,
    generated_at: new Date(payslip.generated_at).toLocaleDateString(),
    days_worked: `${payslip.days_worked} / 26 days`,
    total_hours: `${fmt(payslip.total_hours)} hrs`,
    hourly_rate: `₹${fmt(payslip.hourly_rate)} / hr`,
    daily_rate: `₹${fmt(payslip.daily_rate)} / day`,
    overtime_hours: "—",
    overtime_pay: "—",
    gross_pay: `₹${fmt(payslip.gross_pay)}`,
    esi: `- ₹${fmt(payslip.esi)}`,
    pf: `- ₹${fmt(payslip.pf)}`,
    professional_tax: "—",
    advance_deduction: "—",
    other_deductions: "—",
    net_pay: `₹${fmt(payslip.net_pay)}`,
  };

  /* ── template-based render ─────────────────────────────────────── */
  if (template) {
    const ly = template.layout;
    const sections = [...ly.sections].sort((a, b) => a.order - b.order).filter((s) => s.enabled);

    return (
      <div className="row justify-content-center">
        <div className="col-md-8">
          <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />
          <div style={{
            fontFamily: ly.fontFamily,
            fontSize: ly.fontSize,
            background: "#fff",
            border: "1px solid #dee2e6",
            borderRadius: 8,
            overflow: "hidden",
            maxWidth: 720,
            margin: "0 auto",
          }} id="payslip-card">
            {sections.map((sec) => renderTemplateSection(sec, ly, template))}
          </div>
          <div className="d-flex gap-2 mt-3">
            <button className="btn btn-primary" onClick={() => window.print()}>Print</button>
            <button className="btn btn-secondary" onClick={() => navigate("/payslips")}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── fallback: original hardcoded layout ───────────────────────── */
  return (
    <div className="row justify-content-center">
      <div className="col-md-7">
        <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />
        <div className="card shadow" id="payslip-card">
          <div className="card-header bg-primary text-white text-center py-3">
            <h4 className="mb-0 fw-bold">PAYSLIP</h4>
            <p className="mb-0">{MONTHS[payslip.month - 1]} {payslip.year}</p>
          </div>
          <div className="card-body p-4">
            <div className="row mb-4">
              <div className="col-6">
                <h6 className="text-muted">Employee Details</h6>
                <p className="mb-1"><strong>Name:</strong> {employee.name}</p>
                <p className="mb-1"><strong>Employee ID:</strong> #{employee.id}</p>
                <p className="mb-1"><strong>Aadhar:</strong> XXXX-XXXX-{employee.aadhar_number?.slice(-4)}</p>
                <p className="mb-1"><strong>Bank Account:</strong> {employee.bank_account_number}</p>
                <p className="mb-1"><strong>Shift:</strong> {SHIFT_LABELS[employee.shift] ?? employee.shift}</p>
              </div>
              <div className="col-6 text-md-end">
                <h6 className="text-muted">Pay Period</h6>
                <p className="mb-1"><strong>{MONTHS[payslip.month - 1]} {payslip.year}</strong></p>
                <p className="mb-1 text-muted small">Generated: {new Date(payslip.generated_at).toLocaleDateString()}</p>
              </div>
            </div>
            <hr />
            <table className="table table-bordered">
              <thead className="table-light">
                <tr><th>Description</th><th className="text-end">Amount</th></tr>
              </thead>
              <tbody>
                <tr><td>Days Worked</td><td className="text-end">{payslip.days_worked} / 26 days</td></tr>
                <tr><td>Total Hours Worked</td><td className="text-end">{fmt(payslip.total_hours)} hrs</td></tr>
                <tr><td>Hourly Rate</td><td className="text-end">₹{fmt(payslip.hourly_rate)} / hr</td></tr>
                <tr><td>Daily Rate</td><td className="text-end">₹{fmt(payslip.daily_rate)} / day</td></tr>
                <tr className="fw-semibold">
                  <td>Gross Pay <span className="text-muted fw-normal small">(Days Worked × Daily Rate)</span></td>
                  <td className="text-end">₹{fmt(payslip.gross_pay)}</td>
                </tr>
              </tbody>
              <tbody>
                <tr className="table-light"><td colSpan={2} className="fw-semibold text-muted">Deductions</td></tr>
                <tr className="text-danger"><td>ESI (0.75%)</td><td className="text-end">- ₹{fmt(payslip.esi)}</td></tr>
                <tr className="text-danger"><td>PF (12%)</td><td className="text-end">- ₹{fmt(payslip.pf)}</td></tr>
              </tbody>
              <tfoot>
                <tr className="table-success fw-bold fs-5">
                  <td>Net Pay</td><td className="text-end">₹{fmt(payslip.net_pay)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="text-muted small text-center mt-3">
              Gross Pay = {payslip.days_worked} days × ₹{fmt(payslip.daily_rate)} = ₹{fmt(payslip.gross_pay)}
              &nbsp;|&nbsp;
              Net Pay = ₹{fmt(payslip.gross_pay)} − ₹{fmt(payslip.esi)} − ₹{fmt(payslip.pf)} = ₹{fmt(payslip.net_pay)}
            </p>
          </div>
        </div>
        <div className="d-flex gap-2 mt-3">
          <button className="btn btn-primary" onClick={() => window.print()}>Print</button>
          <button className="btn btn-secondary" onClick={() => navigate("/payslips")}>Back</button>
        </div>
      </div>
    </div>
  );

  /* ── section renderers ─────────────────────────────────────────── */
  function renderTemplateSection(sec: TemplateSection, ly: any, tpl: PayslipTemplate) {
    switch (sec.type) {
      case "header":  return renderTplHeader(sec, ly, tpl);
      case "info":    return renderTplInfo(sec, ly);
      case "table":   return renderTplTable(sec, ly);
      case "summary": return renderTplSummary(sec, ly);
      case "note":    return renderTplNote(sec);
      case "footer":  return renderTplFooter(sec, ly, tpl);
      default:        return null;
    }
  }

  function renderTplHeader(sec: TemplateSection, ly: any, tpl: PayslipTemplate) {
    return (
      <div key={sec.id} style={{ background: ly.headerBg, color: ly.headerTextColor, padding: "20px 24px", textAlign: "center" }}>
        {ly.showLogo && tpl.logo_url && (
          <img src={tpl.logo_url} alt="Logo" style={{ maxHeight: 48, marginBottom: 8 }} />
        )}
        <h4 style={{ margin: 0, fontWeight: 700 }}>{tpl.company_name || "PAYSLIP"}</h4>
        {tpl.company_address && <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.85 }}>{tpl.company_address}</p>}
        <h5 style={{ margin: "12px 0 0", fontWeight: 600 }}>PAYSLIP — {MONTHS[payslip!.month - 1]} {payslip!.year}</h5>
      </div>
    );
  }

  function renderTplInfo(sec: TemplateSection, ly: any) {
    const fields = (sec.fields ?? []).filter((f: TemplateField) => f.enabled);
    if (!fields.length) return null;
    return (
      <div key={sec.id} style={{ padding: "12px 24px" }}>
        <h6 style={{ color: ly.primaryColor, fontWeight: 600, marginBottom: 8, borderBottom: `2px solid ${ly.primaryColor}`, paddingBottom: 4 }}>
          {sec.label}
        </h6>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
          {fields.map((f: TemplateField) => (
            <div key={f.key} style={{ fontSize: 13 }}>
              <span style={{ color: "#6c757d" }}>{f.label}: </span>
              <strong>{fieldValues[f.key] ?? "—"}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderTplTable(sec: TemplateSection, ly: any) {
    const fields = (sec.fields ?? []).filter((f: TemplateField) => f.enabled);
    if (!fields.length) return null;
    const isDeduction = sec.id === "deductions";
    return (
      <div key={sec.id} style={{ padding: "8px 24px" }}>
        <h6 style={{ color: ly.primaryColor, fontWeight: 600, marginBottom: 8, borderBottom: `2px solid ${ly.primaryColor}`, paddingBottom: 4 }}>
          {sec.label}
        </h6>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8f9fa" }}>
              <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Description</th>
              <th style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #dee2e6" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f: TemplateField) => (
              <tr key={f.key} style={{ color: isDeduction ? "#dc3545" : undefined }}>
                <td style={{ padding: "5px 8px", borderBottom: "1px solid #f0f0f0" }}>{f.label}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #f0f0f0", fontWeight: f.key === "gross_pay" ? 600 : 400 }}>
                  {fieldValues[f.key] ?? "₹0.00"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderTplSummary(sec: TemplateSection, ly: any) {
    return (
      <div key={sec.id} style={{ padding: "12px 24px" }}>
        <div style={{
          background: "#d1e7dd", border: "1px solid #badbcc", borderRadius: 6,
          padding: "12px 16px", display: "flex", justifyContent: "space-between",
          alignItems: "center", fontSize: 18, fontWeight: 700,
        }}>
          <span>{sec.label}</span>
          <span style={{ color: "#198754" }}>₹{fmt(payslip!.net_pay)}</span>
        </div>
      </div>
    );
  }

  function renderTplNote(_sec: TemplateSection) {
    return (
      <div key={_sec.id} style={{ padding: "8px 24px" }}>
        <p style={{ fontSize: 11, color: "#6c757d", textAlign: "center", margin: 0 }}>
          Gross Pay = {payslip!.days_worked} days × ₹{fmt(payslip!.daily_rate)} = ₹{fmt(payslip!.gross_pay)}
          &nbsp;|&nbsp;
          Net Pay = ₹{fmt(payslip!.gross_pay)} − ₹{fmt(payslip!.esi)} − ₹{fmt(payslip!.pf)} = ₹{fmt(payslip!.net_pay)}
        </p>
      </div>
    );
  }

  function renderTplFooter(sec: TemplateSection, ly: any, tpl: PayslipTemplate) {
    return (
      <div key={sec.id} style={{ padding: "16px 24px", borderTop: "1px solid #dee2e6" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            {tpl.footer_text && <p style={{ fontSize: 11, color: "#6c757d", margin: 0 }}>{tpl.footer_text}</p>}
            {tpl.company_phone && <p style={{ fontSize: 11, color: "#6c757d", margin: "2px 0 0" }}>📞 {tpl.company_phone}</p>}
          </div>
          {ly.showSignature && (
            <div style={{ textAlign: "center" }}>
              <div style={{ borderTop: "1px solid #000", width: 160, marginBottom: 4 }} />
              <small>{tpl.signature_label || "Authorized Signatory"}</small>
            </div>
          )}
        </div>
      </div>
    );
  }
}
