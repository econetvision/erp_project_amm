import { useEffect, useState, useRef } from "react";
import AlertMessage from "../../components/AlertMessage";
import {
  getTemplates,
  getDefaultLayout,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
} from "../../api/payslipTemplateApi";
import type {
  PayslipTemplate,
  PayslipTemplateCreate,
  TemplateLayout,
  TemplateSection,
  TemplateField,
} from "../../types/payslipTemplate";

/* ── helpers ─────────────────────────────────────────────────────── */
const SECTION_ICONS: Record<string, string> = {
  header: "🏢", info: "📋", table: "📊", summary: "💰", note: "📝", footer: "✍️",
};

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

/* sample data for live preview */
const SAMPLE = {
  name: "Rajesh Kumar",
  id: 1042,
  aadhar_number: "XXXX-XXXX-7890",
  bank_account_number: "1234567890",
  shift: "Shift A — 6:30 AM to 2:00 PM",
  department: "Production",
  designation: "Machine Operator",
  work_location: "Plant A – Hyderabad",
  phone: "+91 98765 43210",
  email: "rajesh@example.com",
  month_year: `${MONTH_NAMES[new Date().getMonth()]} ${new Date().getFullYear()}`,
  generated_at: new Date().toLocaleDateString(),
  days_worked: "24 / 26 days",
  total_hours: "180.00 hrs",
  hourly_rate: "₹125.00 / hr",
  daily_rate: "₹937.50 / day",
  overtime_hours: "8.50 hrs",
  overtime_pay: "₹1,062.50",
  gross_pay: "₹23,562.50",
  esi: "- ₹176.72",
  pf: "- ₹2,827.50",
  professional_tax: "- ₹200.00",
  advance_deduction: "- ₹2,000.00",
  other_deductions: "- ₹0.00",
  net_pay: "₹18,358.28",
};

/* ── Component ───────────────────────────────────────────────────── */
export default function PayslipBuilder() {
  const [templates, setTemplates]   = useState<PayslipTemplate[]>([]);
  const [selected, setSelected]     = useState<PayslipTemplate | null>(null);
  const [layout, setLayout]         = useState<TemplateLayout | null>(null);
  const [defaultLayout, setDefaultLayout] = useState<TemplateLayout | null>(null);
  const [alert, setAlert]           = useState({ type: "", message: "" });
  const [saving, setSaving]         = useState(false);
  const [tab, setTab]               = useState<"design" | "branding" | "style">("design");
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName]       = useState("");
  const [newDesc, setNewDesc]       = useState("");

  /* branding state (kept separate from layout for clarity) */
  const [branding, setBranding] = useState({
    company_name: "",
    company_address: "",
    company_phone: "",
    company_email: "",
    logo_url: "",
    footer_text: "",
    signature_label: "",
  });

  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  /* ── load ──────────────────────────────────────────────────────── */
  const loadRef = useRef(false);

  useEffect(() => {
    if (loadRef.current) return;
    loadRef.current = true;
    (async () => {
      try {
        const [tpl, def] = await Promise.all([getTemplates(), getDefaultLayout()]);
        setTemplates(tpl.data);
        setDefaultLayout(def.data);
        if (tpl.data.length > 0) {
          pickTemplate(tpl.data[0]);
        }
      } catch (e: any) {
        setAlert({ type: "danger", message: e.message });
      }
    })();
  }, []);

  async function load() {
    try {
      const res = await getTemplates();
      setTemplates(res.data);
    } catch {}
  }

  function pickTemplate(t: PayslipTemplate) {
    setSelected(t);
    setLayout({ ...t.layout });
    setBranding({
      company_name:    t.company_name ?? "",
      company_address: t.company_address ?? "",
      company_phone:   t.company_phone ?? "",
      company_email:   t.company_email ?? "",
      logo_url:        t.logo_url ?? "",
      footer_text:     t.footer_text ?? "",
      signature_label: t.signature_label ?? "",
    });
  }

  /* ── save ──────────────────────────────────────────────────────── */
  async function handleSave() {
    if (!selected || !layout) return;
    setSaving(true);
    try {
      const res = await updateTemplate(selected.id, { layout, ...branding });
      setSelected(res.data);
      setAlert({ type: "success", message: "Template saved!" });
      load();
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setSaving(false);
    }
  }

  /* ── create ────────────────────────────────────────────────────── */
  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const payload: PayslipTemplateCreate = {
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        layout: defaultLayout ?? (layout as TemplateLayout),
        ...branding,
      };
      const res = await createTemplate(payload);
      setShowNewModal(false);
      setNewName("");
      setNewDesc("");
      pickTemplate(res.data);
      load();
      setAlert({ type: "success", message: "Template created!" });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  /* ── delete ────────────────────────────────────────────────────── */
  async function handleDelete(id: number) {
    if (!window.confirm("Delete this template?")) return;
    try {
      await deleteTemplate(id);
      if (selected?.id === id) { setSelected(null); setLayout(null); }
      load();
      setAlert({ type: "success", message: "Template deleted" });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  /* ── duplicate ─────────────────────────────────────────────────── */
  async function handleDuplicate(id: number) {
    try {
      const res = await duplicateTemplate(id);
      pickTemplate(res.data);
      load();
      setAlert({ type: "success", message: "Template duplicated!" });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }

  /* ── drag & drop helpers ───────────────────────────────────────── */
  function handleDragStart(idx: number) { dragItem.current = idx; }
  function handleDragEnter(idx: number) { dragOver.current = idx; }

  function handleDragEnd() {
    if (!layout || dragItem.current === null || dragOver.current === null) return;
    const sections = [...layout.sections];
    const dragged = sections.splice(dragItem.current, 1)[0];
    sections.splice(dragOver.current, 0, dragged);
    sections.forEach((s, i) => (s.order = i));
    setLayout({ ...layout, sections });
    dragItem.current = null;
    dragOver.current = null;
  }

  /* ── section toggles ───────────────────────────────────────────── */
  function toggleSection(sectionId: string) {
    if (!layout) return;
    setLayout({
      ...layout,
      sections: layout.sections.map((s) =>
        s.id === sectionId ? { ...s, enabled: !s.enabled } : s
      ),
    });
  }

  function toggleField(sectionId: string, fieldKey: string) {
    if (!layout) return;
    setLayout({
      ...layout,
      sections: layout.sections.map((s) =>
        s.id === sectionId && s.fields
          ? {
              ...s,
              fields: s.fields.map((f) =>
                f.key === fieldKey ? { ...f, enabled: !f.enabled } : f
              ),
            }
          : s
      ),
    });
  }

  function updateFieldLabel(sectionId: string, fieldKey: string, newLabel: string) {
    if (!layout) return;
    setLayout({
      ...layout,
      sections: layout.sections.map((s) =>
        s.id === sectionId && s.fields
          ? {
              ...s,
              fields: s.fields.map((f) =>
                f.key === fieldKey ? { ...f, label: newLabel } : f
              ),
            }
          : s
      ),
    });
  }

  function updateSectionLabel(sectionId: string, label: string) {
    if (!layout) return;
    setLayout({
      ...layout,
      sections: layout.sections.map((s) =>
        s.id === sectionId ? { ...s, label } : s
      ),
    });
  }

  /* ── style helpers ─────────────────────────────────────────────── */
  function updateStyle(key: keyof TemplateLayout, val: any) {
    if (!layout) return;
    setLayout({ ...layout, [key]: val });
  }

  /* ── render ────────────────────────────────────────────────────── */
  if (!layout) {
    return (
      <div>
        <div className="d-flex align-items-center gap-3 mb-4">
          <div className="rounded-circle d-flex align-items-center justify-content-center"
            style={{ width: 48, height: 48, background: "linear-gradient(135deg, #6f42c1, #d63384)", color: "white", fontSize: 22 }}>
            🎨
          </div>
          <div>
            <h3 className="fw-bold mb-0">Payslip Template Builder</h3>
            <small className="text-muted">Design custom payslip layouts with drag &amp; drop</small>
          </div>
        </div>
        <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />
        <div className="text-center py-5">
          <p className="text-muted mb-3">No templates found. Create your first template.</p>
          <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
            + Create Template
          </button>
        </div>
        {renderNewModal()}
      </div>
    );
  }

  const sortedSections = [...layout.sections].sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <div className="rounded-circle d-flex align-items-center justify-content-center"
            style={{ width: 48, height: 48, background: "linear-gradient(135deg, #6f42c1, #d63384)", color: "white", fontSize: 22 }}>
            🎨
          </div>
          <div>
            <h3 className="fw-bold mb-0">Payslip Template Builder</h3>
            <small className="text-muted">Drag sections, toggle fields, customise branding</small>
          </div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-primary btn-sm" onClick={() => setShowNewModal(true)}>
            + New Template
          </button>
          <button className="btn btn-success btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "💾 Save"}
          </button>
        </div>
      </div>

      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      <div className="row g-4">
        {/* ── LEFT: Template List + Config ────────────────────────── */}
        <div className="col-lg-5">
          {/* Template selector */}
          <div className="card shadow-sm mb-3">
            <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
              <span>📄 Templates</span>
              <span className="badge bg-secondary">{templates.length}</span>
            </div>
            <div className="list-group list-group-flush" style={{ maxHeight: 200, overflowY: "auto" }}>
              {templates.map((t) => (
                <button
                  key={t.id}
                  className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${selected?.id === t.id ? "active" : ""}`}
                  onClick={() => pickTemplate(t)}
                >
                  <div>
                    <span className="fw-semibold">{t.name}</span>
                    {t.is_default && <span className="badge bg-success ms-2">Default</span>}
                    <br />
                    <small className={selected?.id === t.id ? "text-white-50" : "text-muted"}>
                      {t.description || "No description"}
                    </small>
                  </div>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-light btn-sm" title="Duplicate"
                      onClick={(e) => { e.stopPropagation(); handleDuplicate(t.id); }}>
                      📋
                    </button>
                    <button className="btn btn-outline-danger btn-sm" title="Delete"
                      onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}>
                      🗑️
                    </button>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Config tabs */}
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item">
              <button className={`nav-link ${tab === "design" ? "active" : ""}`} onClick={() => setTab("design")}>
                📐 Sections
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${tab === "branding" ? "active" : ""}`} onClick={() => setTab("branding")}>
                🏢 Branding
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${tab === "style" ? "active" : ""}`} onClick={() => setTab("style")}>
                🎨 Style
              </button>
            </li>
          </ul>

          {tab === "design" && renderDesignTab(sortedSections)}
          {tab === "branding" && renderBrandingTab()}
          {tab === "style" && renderStyleTab()}
        </div>

        {/* ── RIGHT: Live Preview ────────────────────────────────── */}
        <div className="col-lg-7">
          <div className="card shadow-sm">
            <div className="card-header fw-semibold d-flex justify-content-between">
              <span>👁️ Live Preview</span>
              <span className="badge bg-info">
                {layout.paperSize} · {layout.orientation}
              </span>
            </div>
            <div className="card-body p-3" style={{ background: "#f8f9fa" }}>
              {renderPreview(sortedSections)}
            </div>
          </div>
        </div>
      </div>

      {renderNewModal()}
    </div>
  );

  /* ── Design tab ────────────────────────────────────────────────── */
  function renderDesignTab(sections: TemplateSection[]) {
    return (
      <div className="card shadow-sm">
        <div className="card-body p-2">
          <p className="text-muted small mb-2 px-2">
            Drag sections to reorder. Toggle visibility with the switch. Click a section to edit fields.
          </p>
          {sections.map((sec, idx) => (
            <div
              key={sec.id}
              className="border rounded p-2 mb-2"
              style={{ cursor: "grab", background: sec.enabled ? "#fff" : "#f1f1f1", opacity: sec.enabled ? 1 : 0.6 }}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <span style={{ cursor: "grab", fontSize: 16 }}>⠿</span>
                  <span>{SECTION_ICONS[sec.type] || "📄"}</span>
                  <input
                    className="form-control form-control-sm border-0 fw-semibold p-0"
                    style={{ width: "auto", maxWidth: 180, background: "transparent" }}
                    value={sec.label}
                    onChange={(e) => updateSectionLabel(sec.id, e.target.value)}
                  />
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={sec.enabled}
                    onChange={() => toggleSection(sec.id)}
                  />
                </div>
              </div>
              {/* Fields inside section */}
              {sec.enabled && sec.fields && sec.fields.length > 0 && (
                <div className="mt-2 ms-4">
                  {sec.fields.map((f) => (
                    <div key={f.key} className="d-flex align-items-center gap-2 mb-1">
                      <div className="form-check form-switch mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={f.enabled}
                          onChange={() => toggleField(sec.id, f.key)}
                        />
                      </div>
                      <input
                        className="form-control form-control-sm"
                        style={{ maxWidth: 200 }}
                        value={f.label}
                        onChange={(e) => updateFieldLabel(sec.id, f.key, e.target.value)}
                        disabled={!f.enabled}
                      />
                      <small className="text-muted font-monospace">{f.key}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Branding tab ──────────────────────────────────────────────── */
  function renderBrandingTab() {
    return (
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="mb-3">
            <label className="form-label fw-semibold small">Company Name</label>
            <input className="form-control form-control-sm" value={branding.company_name}
              onChange={(e) => setBranding({ ...branding, company_name: e.target.value })} />
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold small">Company Address</label>
            <textarea className="form-control form-control-sm" rows={2} value={branding.company_address}
              onChange={(e) => setBranding({ ...branding, company_address: e.target.value })} />
          </div>
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label fw-semibold small">Phone</label>
              <input className="form-control form-control-sm" value={branding.company_phone}
                onChange={(e) => setBranding({ ...branding, company_phone: e.target.value })} />
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold small">Email</label>
              <input className="form-control form-control-sm" value={branding.company_email}
                onChange={(e) => setBranding({ ...branding, company_email: e.target.value })} />
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold small">Logo URL</label>
            <input className="form-control form-control-sm" value={branding.logo_url}
              placeholder="https://example.com/logo.png"
              onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })} />
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold small">Footer Text</label>
            <input className="form-control form-control-sm" value={branding.footer_text}
              placeholder="This is a computer-generated payslip"
              onChange={(e) => setBranding({ ...branding, footer_text: e.target.value })} />
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold small">Signature Label</label>
            <input className="form-control form-control-sm" value={branding.signature_label}
              placeholder="Authorized Signatory"
              onChange={(e) => setBranding({ ...branding, signature_label: e.target.value })} />
          </div>
        </div>
      </div>
    );
  }

  /* ── Style tab ─────────────────────────────────────────────────── */
  function renderStyleTab() {
    return (
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label fw-semibold small">Primary Color</label>
              <div className="d-flex gap-2 align-items-center">
                <input type="color" className="form-control form-control-color"
                  value={layout!.primaryColor} onChange={(e) => updateStyle("primaryColor", e.target.value)} />
                <code className="small">{layout!.primaryColor}</code>
              </div>
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold small">Header Background</label>
              <div className="d-flex gap-2 align-items-center">
                <input type="color" className="form-control form-control-color"
                  value={layout!.headerBg} onChange={(e) => updateStyle("headerBg", e.target.value)} />
                <code className="small">{layout!.headerBg}</code>
              </div>
            </div>
          </div>
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label fw-semibold small">Header Text Color</label>
              <div className="d-flex gap-2 align-items-center">
                <input type="color" className="form-control form-control-color"
                  value={layout!.headerTextColor} onChange={(e) => updateStyle("headerTextColor", e.target.value)} />
                <code className="small">{layout!.headerTextColor}</code>
              </div>
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold small">Font Size (px)</label>
              <input type="number" className="form-control form-control-sm"
                value={layout!.fontSize} min={10} max={24}
                onChange={(e) => updateStyle("fontSize", +e.target.value)} />
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold small">Font Family</label>
            <select className="form-select form-select-sm" value={layout!.fontFamily}
              onChange={(e) => updateStyle("fontFamily", e.target.value)}>
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="'Courier New', monospace">Courier New</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="Verdana, sans-serif">Verdana</option>
              <option value="'Segoe UI', sans-serif">Segoe UI</option>
            </select>
          </div>
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label fw-semibold small">Paper Size</label>
              <select className="form-select form-select-sm" value={layout!.paperSize}
                onChange={(e) => updateStyle("paperSize", e.target.value)}>
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
                <option value="A5">A5</option>
              </select>
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold small">Orientation</label>
              <select className="form-select form-select-sm" value={layout!.orientation}
                onChange={(e) => updateStyle("orientation", e.target.value)}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
          </div>
          <hr />
          <h6 className="fw-semibold small">Toggles</h6>
          <div className="d-flex flex-wrap gap-3">
            {(["showHeader", "showFooter", "showLogo", "showSignature"] as const).map((k) => (
              <div className="form-check form-switch" key={k}>
                <input className="form-check-input" type="checkbox" checked={!!(layout as any)[k]}
                  onChange={() => updateStyle(k, !(layout as any)[k])} id={`toggle-${k}`} />
                <label className="form-check-label small" htmlFor={`toggle-${k}`}>{k.replace("show", "Show ")}</label>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Live Preview ──────────────────────────────────────────────── */
  function renderPreview(sections: TemplateSection[]) {
    const enabled = sections.filter((s) => s.enabled);
    const sty = {
      fontFamily: layout!.fontFamily,
      fontSize: layout!.fontSize,
      maxWidth: 680,
      margin: "0 auto",
      background: "#fff",
      border: "1px solid #dee2e6",
      borderRadius: 8,
      overflow: "hidden",
    };

    return (
      <div style={sty}>
        {enabled.map((sec) => {
          switch (sec.type) {
            case "header":  return renderPreviewHeader(sec);
            case "info":    return renderPreviewInfo(sec);
            case "table":   return renderPreviewTable(sec);
            case "summary": return renderPreviewSummary(sec);
            case "note":    return renderPreviewNote(sec);
            case "footer":  return renderPreviewFooter(sec);
            default:        return null;
          }
        })}
      </div>
    );
  }

  function renderPreviewHeader(sec: TemplateSection) {
    return (
      <div key={sec.id} style={{
        background: layout!.headerBg,
        color: layout!.headerTextColor,
        padding: "20px 24px",
        textAlign: "center",
      }}>
        {layout!.showLogo && branding.logo_url && (
          <img src={branding.logo_url} alt="Logo" style={{ maxHeight: 48, marginBottom: 8 }} />
        )}
        <h4 style={{ margin: 0, fontWeight: 700 }}>
          {branding.company_name || "COMPANY NAME"}
        </h4>
        {branding.company_address && (
          <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.85 }}>{branding.company_address}</p>
        )}
        <h5 style={{ margin: "12px 0 0", fontWeight: 600 }}>PAYSLIP</h5>
      </div>
    );
  }

  function renderPreviewInfo(sec: TemplateSection) {
    const fields = (sec.fields ?? []).filter((f: TemplateField) => f.enabled);
    if (fields.length === 0) return null;
    return (
      <div key={sec.id} style={{ padding: "12px 24px" }}>
        <h6 style={{ color: layout!.primaryColor, fontWeight: 600, marginBottom: 8, borderBottom: `2px solid ${layout!.primaryColor}`, paddingBottom: 4 }}>
          {sec.label}
        </h6>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
          {fields.map((f: TemplateField) => (
            <div key={f.key} style={{ fontSize: 13 }}>
              <span style={{ color: "#6c757d" }}>{f.label}: </span>
              <strong>{(SAMPLE as any)[f.key] ?? "—"}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderPreviewTable(sec: TemplateSection) {
    const fields = (sec.fields ?? []).filter((f: TemplateField) => f.enabled);
    if (fields.length === 0) return null;
    const isDeduction = sec.id === "deductions";
    return (
      <div key={sec.id} style={{ padding: "8px 24px" }}>
        <h6 style={{ color: layout!.primaryColor, fontWeight: 600, marginBottom: 8, borderBottom: `2px solid ${layout!.primaryColor}`, paddingBottom: 4 }}>
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
                  {(SAMPLE as any)[f.key] ?? "₹0.00"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderPreviewSummary(sec: TemplateSection) {
    return (
      <div key={sec.id} style={{ padding: "12px 24px" }}>
        <div style={{
          background: "#d1e7dd",
          border: "1px solid #badbcc",
          borderRadius: 6,
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 18,
          fontWeight: 700,
        }}>
          <span>{sec.label}</span>
          <span style={{ color: "#198754" }}>{SAMPLE.net_pay}</span>
        </div>
      </div>
    );
  }

  function renderPreviewNote(sec: TemplateSection) {
    return (
      <div key={sec.id} style={{ padding: "8px 24px" }}>
        <p style={{ fontSize: 11, color: "#6c757d", textAlign: "center", margin: 0 }}>
          Gross Pay = 24 days × ₹937.50 = ₹23,562.50 &nbsp;|&nbsp;
          Net Pay = ₹23,562.50 − ₹176.72 − ₹2,827.50 = ₹18,358.28
        </p>
      </div>
    );
  }

  function renderPreviewFooter(sec: TemplateSection) {
    return (
      <div key={sec.id} style={{ padding: "16px 24px", borderTop: "1px solid #dee2e6" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            {branding.footer_text && (
              <p style={{ fontSize: 11, color: "#6c757d", margin: 0 }}>{branding.footer_text}</p>
            )}
            {branding.company_phone && (
              <p style={{ fontSize: 11, color: "#6c757d", margin: "2px 0 0" }}>📞 {branding.company_phone}</p>
            )}
          </div>
          {layout!.showSignature && (
            <div style={{ textAlign: "center" }}>
              <div style={{ borderTop: "1px solid #000", width: 160, marginBottom: 4 }} />
              <small>{branding.signature_label || "Authorized Signatory"}</small>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── New Template Modal ────────────────────────────────────────── */
  function renderNewModal() {
    if (!showNewModal) return null;
    return (
      <div className="modal d-block" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setShowNewModal(false)}>
        <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">New Template</h5>
              <button className="btn-close" onClick={() => setShowNewModal(false)} />
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">Template Name *</label>
                <input className="form-control" value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Payslip - Monthly Standard" />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Description</label>
                <textarea className="form-control" rows={2} value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional description" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNewModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()}>
                Create
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
