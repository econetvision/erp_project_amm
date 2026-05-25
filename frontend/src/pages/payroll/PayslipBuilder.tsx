import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import AlertMessage from "../../components/AlertMessage";
import {
  getTemplates, getDefaultLayout, createTemplate,
  updateTemplate, deleteTemplate, duplicateTemplate,
} from "../../api/payslipTemplateApi";
import { getCompanies } from "../../api/companyApi";
import type { Company } from "../../types/company";
import type {
  PayslipTemplate, PayslipTemplateCreate, TemplateLayout,
  TemplateSection, TemplateField, SectionStyle,
} from "../../types/payslipTemplate";

/* ── constants ───────────────────────────────────────────────────── */
const SEC_ICONS: Record<string, string> = {
  header: "🏢", info: "📋", table: "📊", summary: "💰", note: "📝", footer: "✍️",
};
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const SAMPLE: Record<string, string> = {
  name: "Rajesh Kumar", id: "#1042",
  aadhar_number: "XXXX-XXXX-7890", bank_account_number: "****567890",
  shift: "Shift A — 6:30 AM to 2:00 PM", department: "Production",
  designation: "Machine Operator", work_location: "Plant A – Hyderabad",
  phone: "+91 98765 43210", email: "rajesh@example.com",
  month_year: `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`,
  generated_at: new Date().toLocaleDateString(),
  days_worked: "24 / 26 days", total_hours: "180.00 hrs",
  hourly_rate: "₹125.00 / hr", daily_rate: "₹937.50 / day",
  overtime_hours: "8.50 hrs", overtime_pay: "₹1,062.50",
  gross_pay: "₹23,562.50", esi: "- ₹176.72", pf: "- ₹2,827.50",
  professional_tax: "- ₹200.00", advance_deduction: "- ₹2,000.00",
  other_deductions: "- ₹0.00", net_pay: "₹18,358.28",
  basic_pay: "₹15,000.00", hra: "₹6,000.00", conveyance: "₹1,600.00",
  medical: "₹1,250.00", special_allowance: "₹3,500.00", bonus: "₹2,000.00",
  lta: "₹1,500.00", food_allowance: "₹500.00", tds: "- ₹500.00",
  loan_deduction: "- ₹1,000.00", insurance: "- ₹250.00", union_fee: "- ₹50.00",
};

const EXTRA_FIELDS: TemplateField[] = [
  { key: "basic_pay", label: "Basic Pay", enabled: true },
  { key: "hra", label: "HRA", enabled: true },
  { key: "conveyance", label: "Conveyance Allowance", enabled: true },
  { key: "medical", label: "Medical Allowance", enabled: true },
  { key: "special_allowance", label: "Special Allowance", enabled: true },
  { key: "bonus", label: "Bonus", enabled: true },
  { key: "lta", label: "Leave Travel Allowance", enabled: true },
  { key: "food_allowance", label: "Food Allowance", enabled: true },
  { key: "tds", label: "TDS", enabled: true },
  { key: "loan_deduction", label: "Loan Deduction", enabled: true },
  { key: "insurance", label: "Insurance Premium", enabled: true },
  { key: "union_fee", label: "Union Fee", enabled: true },
];

const DEFAULT_SEC_STYLE: SectionStyle = {
  bgColor: "#ffffff", textColor: "#212529", borderColor: "#dee2e6",
  borderWidth: 1, borderRadius: 0, headerBg: "", headerTextColor: "",
  padding: 12, stripedRows: false, rowHoverColor: "",
  colHeaderBg: "#f8f9fa", colHeaderText: "#212529",
};

/* ── Component ───────────────────────────────────────────────────── */
export default function PayslipBuilder() {
  const { auth } = useAuth();
  const [templates, setTemplates] = useState<PayslipTemplate[]>([]);
  const [selected, setSelected] = useState<PayslipTemplate | null>(null);
  const [layout, setLayout] = useState<TemplateLayout | null>(null);
  const [defaultLayout, setDefaultLayout] = useState<TemplateLayout | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"canvas" | "branding" | "style">("canvas");

  // panels
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCoId, setNewCoId] = useState<number | null>(null);
  const [newDefault, setNewDefault] = useState(false);

  // field modal
  const [showField, setShowField] = useState(false);
  const [fieldTarget, setFieldTarget] = useState("");
  const [cusLabel, setCusLabel] = useState("");
  const [cusKey, setCusKey] = useState("");

  // section style editor
  const [styleSec, setStyleSec] = useState<string | null>(null);

  // branding
  const [br, setBr] = useState({
    company_name: "", company_address: "", company_phone: "",
    company_email: "", logo_url: "", footer_text: "", signature_label: "",
  });

  // drag
  const sDragFrom = useRef<number | null>(null);
  const sDragTo = useRef<number | null>(null);
  const fSec = useRef("");
  const fFrom = useRef<number | null>(null);
  const fTo = useRef<number | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [canvasDrag, setCanvasDrag] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef(false);
  const apiBase = process.env.REACT_APP_API_URL || "http://localhost:8088";

  /* ── load ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (loadRef.current) return;
    loadRef.current = true;
    (async () => {
      try {
        const [tpl, def] = await Promise.all([getTemplates(), getDefaultLayout()]);
        setTemplates(tpl.data);
        setDefaultLayout(def.data);
        if (tpl.data.length > 0) pickTemplate(tpl.data[0]);
      } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
      try {
        const c = await getCompanies();
        setCompanies((c.data as any).items || c.data || []);
      } catch {}
    })();
  }, []);

  async function reload() {
    try { const r = await getTemplates(); setTemplates(r.data); } catch {}
  }

  function pickTemplate(t: PayslipTemplate) {
    setSelected(t);
    setLayout({ ...t.layout });
    setBr({
      company_name: t.company_name ?? "", company_address: t.company_address ?? "",
      company_phone: t.company_phone ?? "", company_email: t.company_email ?? "",
      logo_url: t.logo_url ?? "", footer_text: t.footer_text ?? "",
      signature_label: t.signature_label ?? "",
    });
    setExpanded(null); setStyleSec(null);
  }

  /* helper: get company logo for selected template */
  const companyLogo = useCallback(() => {
    if (br.logo_url) return br.logo_url;
    if (selected?.company_id) {
      const co = companies.find(c => c.id === selected.company_id);
      if (co?.logo_path) return `${apiBase}${co.logo_path}`;
    }
    return "";
  }, [br.logo_url, selected, companies, apiBase]);

  /* ── CRUD ──────────────────────────────────────────────────────── */
  async function handleSave() {
    if (!selected || !layout) return;
    setSaving(true);
    try {
      const res = await updateTemplate(selected.id, { layout, ...br });
      setSelected(res.data); reload();
      setAlert({ type: "success", message: "Template saved!" });
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setSaving(false); }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const payload: PayslipTemplateCreate = {
        name: newName.trim(), description: newDesc.trim() || undefined,
        company_id: newCoId, is_default: newDefault,
        layout: defaultLayout ?? (layout as TemplateLayout), ...br,
      };
      const res = await createTemplate(payload);
      setShowNew(false); setNewName(""); setNewDesc(""); setNewCoId(null); setNewDefault(false);
      pickTemplate(res.data); reload();
      setAlert({ type: "success", message: "Template created!" });
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this template?")) return;
    try {
      await deleteTemplate(id);
      if (selected?.id === id) { setSelected(null); setLayout(null); }
      reload();
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  async function handleDuplicate(id: number) {
    try { const r = await duplicateTemplate(id); pickTemplate(r.data); reload(); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  async function handleSetDefault() {
    if (!selected) return;
    try { const r = await updateTemplate(selected.id, { is_default: true }); setSelected(r.data); reload();
      setAlert({ type: "success", message: "Set as default" }); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  async function handleAssignCo(cid: number | null) {
    if (!selected) return;
    try {
      // Also pull logo from company if available
      const co = cid ? companies.find(c => c.id === cid) : null;
      const updates: any = { company_id: cid };
      if (co) {
        if (co.logo_path && !br.logo_url) updates.logo_url = `${apiBase}${co.logo_path}`;
        if (co.name && !br.company_name) updates.company_name = co.name;
        if (co.address && !br.company_address) updates.company_address = co.address;
        if (co.phone && !br.company_phone) updates.company_phone = co.phone;
        if (co.email && !br.company_email) updates.company_email = co.email;
        setBr(prev => ({
          ...prev,
          logo_url: prev.logo_url || (co.logo_path ? `${apiBase}${co.logo_path}` : ""),
          company_name: prev.company_name || co.name || "",
          company_address: prev.company_address || co.address || "",
          company_phone: prev.company_phone || co.phone || "",
          company_email: prev.company_email || co.email || "",
        }));
      }
      const r = await updateTemplate(selected.id, updates); setSelected(r.data); reload();
      setAlert({ type: "success", message: cid ? "Assigned to company" : "Global" });
    } catch (e: any) { setAlert({ type: "danger", message: e.message }); }
  }

  /* ── Drag: sections ────────────────────────────────────────────── */
  function onSecDragEnd() {
    if (!layout || sDragFrom.current === null || sDragTo.current === null) return;
    const arr = [...layout.sections];
    const d = arr.splice(sDragFrom.current, 1)[0];
    arr.splice(sDragTo.current, 0, d);
    arr.forEach((s, i) => (s.order = i));
    setLayout({ ...layout, sections: arr });
    sDragFrom.current = null; sDragTo.current = null;
    setCanvasDrag(null);
  }

  function onFldDragEnd() {
    if (!layout || fFrom.current === null || fTo.current === null) return;
    const sid = fSec.current;
    setLayout({
      ...layout,
      sections: layout.sections.map(s => {
        if (s.id !== sid || !s.fields) return s;
        const a = [...s.fields];
        const d = a.splice(fFrom.current!, 1)[0];
        a.splice(fTo.current!, 0, d);
        return { ...s, fields: a };
      }),
    });
    fFrom.current = null; fTo.current = null;
  }

  /* ── Field / section helpers ───────────────────────────────────── */
  const mapSec = (fn: (s: TemplateSection) => TemplateSection) =>
    layout && setLayout({ ...layout, sections: layout.sections.map(fn) });

  function toggleSection(id: string) { mapSec(s => s.id === id ? { ...s, enabled: !s.enabled } : s); }
  function toggleField(sid: string, key: string) {
    mapSec(s => s.id === sid && s.fields ? { ...s, fields: s.fields.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f) } : s);
  }
  function setFieldLabel(sid: string, key: string, label: string) {
    mapSec(s => s.id === sid && s.fields ? { ...s, fields: s.fields.map(f => f.key === key ? { ...f, label } : f) } : s);
  }
  function setSecLabel(sid: string, label: string) { mapSec(s => s.id === sid ? { ...s, label } : s); }
  function removeField(sid: string, key: string) {
    mapSec(s => s.id === sid && s.fields ? { ...s, fields: s.fields.filter(f => f.key !== key) } : s);
  }
  function removeSection(sid: string) {
    if (!layout) return;
    setLayout({ ...layout, sections: layout.sections.filter(s => s.id !== sid) });
  }
  function addFieldTo(sid: string, f: TemplateField) {
    mapSec(s => s.id === sid ? { ...s, fields: [...(s.fields || []), f] } : s);
  }
  function addSection(type: "info" | "table" | "note") {
    if (!layout) return;
    const id = `custom_${Date.now()}`;
    const sec: TemplateSection = {
      id, type, label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      enabled: true, order: layout.sections.length,
      fields: type !== "note" ? [{ key: "custom_1", label: "Custom Field", enabled: true }] : undefined,
      style: { ...DEFAULT_SEC_STYLE },
    };
    setLayout({ ...layout, sections: [...layout.sections, sec] });
    setExpanded(id);
  }

  /* section style */
  function updateSecStyle(sid: string, key: keyof SectionStyle, val: any) {
    mapSec(s => s.id === sid ? { ...s, style: { ...(s.style || DEFAULT_SEC_STYLE), [key]: val } } : s);
  }

  /* column grouping */
  function toggleColGroup(sid1: string, sid2: string) {
    if (!layout) return;
    const s1 = layout.sections.find(s => s.id === sid1);
    const s2 = layout.sections.find(s => s.id === sid2);
    if (!s1 || !s2) return;
    if (s1.colGroup && s1.colGroup === s2.colGroup) {
      // ungroup
      mapSec(s => (s.id === sid1 || s.id === sid2) ? { ...s, colGroup: undefined, colWidth: undefined } : s);
    } else {
      const gid = `g_${Date.now()}`;
      mapSec(s => (s.id === sid1 || s.id === sid2) ? { ...s, colGroup: gid, colWidth: 0.5 } : s);
    }
  }

  function updateStyle(key: keyof TemplateLayout, val: any) {
    layout && setLayout({ ...layout, [key]: val });
  }

  /* ── Render ────────────────────────────────────────────────────── */
  if (!layout) {
    return (
      <div>
        {pageHeader()}
        <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />
        <div className="text-center py-5">
          <p className="text-muted">No templates. Create one to get started.</p>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Create Template</button>
        </div>
        {newModal()}{fieldModal()}{secStyleModal()}
      </div>
    );
  }

  const sorted = [...layout.sections].sort((a, b) => a.order - b.order);
  const coName = selected?.company_id ? companies.find(c => c.id === selected.company_id)?.name : null;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        {pageHeader()}
        <div className="d-flex gap-2">
          <button className="btn btn-outline-primary btn-sm" onClick={() => setShowNew(true)}>+ New</button>
          <button className="btn btn-success btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "💾 Save"}
          </button>
        </div>
      </div>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      <div className="row g-3">
        {/* ── LEFT PANEL ─────────────────────────────────────────── */}
        <div className="col-lg-5 col-xl-4">
          {/* Template list */}
          <div className="card shadow-sm mb-3">
            <div className="card-header fw-semibold d-flex justify-content-between py-2">
              <span>📄 Templates</span>
              <span className="badge bg-secondary">{templates.length}</span>
            </div>
            <div className="list-group list-group-flush" style={{ maxHeight: 150, overflowY: "auto" }}>
              {templates.map(t => (
                <button key={t.id}
                  className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2 ${selected?.id === t.id ? "active" : ""}`}
                  onClick={() => pickTemplate(t)}>
                  <div>
                    <span className="fw-semibold">{t.name}</span>
                    {t.is_default && <span className="badge bg-success ms-1">Default</span>}
                    {t.company_id && (
                      <span className={`badge ms-1 ${selected?.id === t.id ? "bg-light text-dark" : "bg-info"}`}>
                        {companies.find(c => c.id === t.company_id)?.name || `#${t.company_id}`}
                      </span>
                    )}
                  </div>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-light btn-sm" title="Duplicate"
                      onClick={e => { e.stopPropagation(); handleDuplicate(t.id); }}>📋</button>
                    <button className="btn btn-outline-danger btn-sm" title="Delete"
                      onClick={e => { e.stopPropagation(); handleDelete(t.id); }}>🗑️</button>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Company assign + default */}
          {selected && (
            <div className="card shadow-sm mb-3">
              <div className="card-body py-2">
                <div className="row g-2 align-items-center">
                  <div className="col">
                    <label className="form-label fw-semibold small mb-1">Company</label>
                    <select className="form-select form-select-sm" value={selected.company_id ?? ""}
                      onChange={e => handleAssignCo(e.target.value ? +e.target.value : null)}>
                      <option value="">🌐 Global</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.logo_path ? " 🖼️" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-auto pt-3">
                    {!selected.is_default && (
                      <button className="btn btn-outline-success btn-sm" onClick={handleSetDefault}>⭐ Default</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <ul className="nav nav-tabs mb-3">
            {([["canvas","📐 Canvas"],["branding","🏢 Branding"],["style","🎨 Global Style"]] as const).map(([k,l]) => (
              <li className="nav-item" key={k}>
                <button className={`nav-link ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</button>
              </li>
            ))}
          </ul>

          {tab === "canvas" && canvasPanel(sorted)}
          {tab === "branding" && brandingTab()}
          {tab === "style" && globalStyleTab()}
        </div>

        {/* ── RIGHT: Live Preview ────────────────────────────────── */}
        <div className="col-lg-7 col-xl-8">
          <div className="card shadow-sm">
            <div className="card-header fw-semibold d-flex justify-content-between py-2">
              <span>👁️ Live Preview</span>
              <div className="d-flex gap-2 align-items-center">
                {coName && <span className="badge bg-info">{coName}</span>}
                <span className="badge bg-secondary">{layout.paperSize}</span>
              </div>
            </div>
            <div className="card-body p-3" style={{ background: "#e9ecef", minHeight: 400 }}>
              {renderPreview(sorted)}
            </div>
          </div>
        </div>
      </div>

      {newModal()}{fieldModal()}{secStyleModal()}
    </div>
  );

  /* ── Page header ───────────────────────────────────────────────── */
  function pageHeader() {
    return (
      <div className="d-flex align-items-center gap-3">
        <div className="rounded-circle d-flex align-items-center justify-content-center"
          style={{ width: 44, height: 44, background: "linear-gradient(135deg,#6f42c1,#d63384)", color: "#fff", fontSize: 20 }}>🎨</div>
        <div>
          <h4 className="fw-bold mb-0">Payslip Template Builder</h4>
          <small className="text-muted">Canvas drag-drop · Section theming · 2-column layout</small>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     CANVAS PANEL — drag-drop sections & fields, section styling
     ═══════════════════════════════════════════════════════════════ */
  function canvasPanel(sections: TemplateSection[]) {
    return (
      <div className="card shadow-sm">
        <div className="card-body p-2">
          <p className="text-muted small mb-2 px-1">
            ⠿ Drag sections · ▶ Expand fields · 🎨 Style each section · 📊 2-column group
          </p>

          <div ref={canvasRef} style={{ minHeight: 200 }}>
            {sections.map((sec, idx) => {
              const exp = expanded === sec.id;
              const isCustom = sec.id.startsWith("custom_");
              const st = sec.style || DEFAULT_SEC_STYLE;
              const isDragging = canvasDrag === sec.id;

              return (
                <div key={sec.id}
                  className={`mb-2 rounded ${exp ? "border-primary border-2" : "border"}`}
                  style={{
                    background: sec.enabled ? st.bgColor || "#fff" : "#f1f1f1",
                    opacity: sec.enabled ? 1 : 0.5,
                    borderColor: isDragging ? "#6f42c1" : (st.borderColor || "#dee2e6"),
                    borderWidth: isDragging ? 2 : (st.borderWidth || 1),
                    borderStyle: "solid",
                    transform: isDragging ? "scale(1.02)" : undefined,
                    transition: "transform 0.15s, border-color 0.15s",
                    borderRadius: st.borderRadius || 0,
                  }}>
                  {/* Section header — draggable */}
                  <div className="d-flex align-items-center justify-content-between px-2 py-1"
                    style={{ cursor: "grab", borderBottom: exp ? "1px solid #dee2e6" : undefined }}
                    draggable
                    onDragStart={() => { sDragFrom.current = idx; setCanvasDrag(sec.id); }}
                    onDragEnter={() => { sDragTo.current = idx; }}
                    onDragEnd={onSecDragEnd}
                    onDragOver={e => e.preventDefault()}>
                    <div className="d-flex align-items-center gap-1">
                      <span style={{ fontSize: 14, color: "#999" }}>⠿</span>
                      <span style={{ fontSize: 14 }}>{SEC_ICONS[sec.type] || "📄"}</span>
                      <input className="form-control form-control-sm border-0 fw-semibold p-0"
                        style={{ width: "auto", maxWidth: 130, background: "transparent", fontSize: 13 }}
                        value={sec.label} onChange={e => setSecLabel(sec.id, e.target.value)} />
                      <span className="badge bg-light text-dark" style={{ fontSize: 9 }}>{sec.type}</span>
                      {sec.colGroup && <span className="badge bg-warning text-dark" style={{ fontSize: 9 }}>2-col</span>}
                    </div>
                    <div className="d-flex align-items-center gap-1">
                      <button className="btn btn-sm p-0" title="Section style" style={{ fontSize: 12 }}
                        onClick={e => { e.stopPropagation(); setStyleSec(sec.id); }}>🎨</button>
                      {sec.fields && (
                        <button className="btn btn-sm p-0" style={{ fontSize: 12 }}
                          onClick={e => { e.stopPropagation(); setExpanded(exp ? null : sec.id); }}>
                          {exp ? "▼" : "▶"}<small className="text-muted ms-1">{sec.fields.length}</small>
                        </button>
                      )}
                      {isCustom && (
                        <button className="btn btn-sm text-danger p-0" style={{ fontSize: 12 }}
                          onClick={() => removeSection(sec.id)}>✕</button>
                      )}
                      <div className="form-check form-switch mb-0 ms-1">
                        <input className="form-check-input" type="checkbox" style={{ fontSize: 12 }}
                          checked={sec.enabled} onChange={() => toggleSection(sec.id)} />
                      </div>
                    </div>
                  </div>

                  {/* Expanded: field list + 2-col controls */}
                  {exp && sec.enabled && (
                    <div className="px-2 py-2" style={{ background: "rgba(0,0,0,.02)" }}>
                      {/* 2-column grouping UI */}
                      <div className="mb-2">
                        <label className="form-label fw-semibold small mb-1">📊 2-Column Group</label>
                        <select className="form-select form-select-sm"
                          value={sec.colGroup ? layout!.sections.find(s => s.colGroup === sec.colGroup && s.id !== sec.id)?.id || "" : ""}
                          onChange={e => {
                            if (e.target.value) toggleColGroup(sec.id, e.target.value);
                            else if (sec.colGroup) {
                              // ungroup
                              mapSec(s => s.colGroup === sec.colGroup ? { ...s, colGroup: undefined, colWidth: undefined } : s);
                            }
                          }}>
                          <option value="">No grouping (full width)</option>
                          {sorted.filter(s => s.id !== sec.id && s.enabled && (s.type === "table" || s.type === "info")).map(s => (
                            <option key={s.id} value={s.id}>Pair with: {s.label}</option>
                          ))}
                        </select>
                        {sec.colGroup && (
                          <div className="mt-1 d-flex align-items-center gap-2">
                            <label className="form-label small mb-0">Width %</label>
                            <input type="range" className="form-range" min={30} max={70} step={5}
                              value={(sec.colWidth ?? 0.5) * 100}
                              onChange={e => mapSec(s => s.id === sec.id ? { ...s, colWidth: +e.target.value / 100 } : s)}
                              style={{ width: 100 }} />
                            <small>{Math.round((sec.colWidth ?? 0.5) * 100)}%</small>
                          </div>
                        )}
                      </div>

                      {/* Fields */}
                      {sec.fields && sec.fields.map((f, fi) => (
                        <div key={f.key}
                          className="d-flex align-items-center gap-1 mb-1 p-1 rounded"
                          style={{ cursor: "grab", background: f.enabled ? "#fff" : "#f5f5f5", border: "1px solid #e9ecef", fontSize: 12 }}
                          draggable
                          onDragStart={() => { fSec.current = sec.id; fFrom.current = fi; }}
                          onDragEnter={() => { if (fSec.current === sec.id) fTo.current = fi; }}
                          onDragEnd={onFldDragEnd} onDragOver={e => e.preventDefault()}>
                          <span style={{ color: "#bbb" }}>⠿</span>
                          <div className="form-check form-switch mb-0">
                            <input className="form-check-input" type="checkbox" style={{ fontSize: 11 }}
                              checked={f.enabled} onChange={() => toggleField(sec.id, f.key)} />
                          </div>
                          <input className="form-control form-control-sm" style={{ maxWidth: 120, fontSize: 12 }}
                            value={f.label} onChange={e => setFieldLabel(sec.id, f.key, e.target.value)}
                            disabled={!f.enabled} />
                          <code className="text-muted" style={{ fontSize: 9 }}>{f.key}</code>
                          <button className="btn btn-sm text-danger p-0 ms-auto" onClick={() => removeField(sec.id, f.key)}>✕</button>
                        </div>
                      ))}
                      {sec.fields && (
                        <button className="btn btn-sm btn-outline-primary mt-1 w-100" style={{ fontSize: 12 }}
                          onClick={() => { setFieldTarget(sec.id); setShowField(true); }}>➕ Add Field</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add section */}
          <div className="border rounded p-2 text-center mt-1">
            <div className="dropdown">
              <button className="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">➕ Add Section</button>
              <ul className="dropdown-menu">
                {(["info","table","note"] as const).map(t => (
                  <li key={t}><button className="dropdown-item" onClick={() => addSection(t)}>
                    {SEC_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     BRANDING TAB
     ═══════════════════════════════════════════════════════════════ */
  function brandingTab() {
    const co = selected?.company_id ? companies.find(c => c.id === selected.company_id) : null;
    const coLogo = co?.logo_path ? `${apiBase}${co.logo_path}` : "";

    return (
      <div className="card shadow-sm"><div className="card-body">
        {/* Auto-fill from company */}
        {co && (
          <div className="alert alert-info py-2 small mb-3">
            <strong>Company:</strong> {co.name}
            <button className="btn btn-sm btn-outline-primary ms-2" onClick={() => {
              setBr({
                company_name: co.name || "", company_address: co.address || "",
                company_phone: co.phone || "", company_email: co.email || "",
                logo_url: coLogo, footer_text: br.footer_text, signature_label: br.signature_label,
              });
            }}>Fill from Company</button>
          </div>
        )}

        {/* Logo preview */}
        <div className="mb-3 text-center p-3 border rounded" style={{ background: "#f8f9fa" }}>
          {(br.logo_url || coLogo) ? (
            <div>
              <img src={br.logo_url || coLogo} alt="Logo" style={{ maxHeight: 60, maxWidth: 200 }}
                onError={e => (e.currentTarget.style.display = "none")} />
              <div className="mt-1"><small className="text-muted">Logo Preview</small></div>
            </div>
          ) : (
            <div className="text-muted small">No logo — set URL or assign company with logo</div>
          )}
        </div>

        <div className="mb-2">
          <label className="form-label fw-semibold small">Logo URL</label>
          <input className="form-control form-control-sm" value={br.logo_url} placeholder="https://... or auto from company"
            onChange={e => setBr({...br, logo_url: e.target.value})} />
        </div>

        {([
          ["company_name","Company Name"],["company_address","Address"],
        ] as const).map(([k,l]) => (
          <div className="mb-2" key={k}>
            <label className="form-label fw-semibold small">{l}</label>
            {k === "company_address"
              ? <textarea className="form-control form-control-sm" rows={2} value={(br as any)[k]}
                  onChange={e => setBr({...br,[k]:e.target.value})} />
              : <input className="form-control form-control-sm" value={(br as any)[k]}
                  onChange={e => setBr({...br,[k]:e.target.value})} />}
          </div>
        ))}
        <div className="row g-2 mb-2">
          <div className="col-6">
            <label className="form-label fw-semibold small">Phone</label>
            <input className="form-control form-control-sm" value={br.company_phone}
              onChange={e => setBr({...br, company_phone: e.target.value})} />
          </div>
          <div className="col-6">
            <label className="form-label fw-semibold small">Email</label>
            <input className="form-control form-control-sm" value={br.company_email}
              onChange={e => setBr({...br, company_email: e.target.value})} />
          </div>
        </div>
        {([
          ["footer_text","Footer Text"],["signature_label","Signature Label"],
        ] as const).map(([k,l]) => (
          <div className="mb-2" key={k}>
            <label className="form-label fw-semibold small">{l}</label>
            <input className="form-control form-control-sm" value={(br as any)[k]}
              onChange={e => setBr({...br,[k]:e.target.value})} />
          </div>
        ))}
      </div></div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     GLOBAL STYLE TAB
     ═══════════════════════════════════════════════════════════════ */
  function globalStyleTab() {
    return (
      <div className="card shadow-sm"><div className="card-body">
        <h6 className="fw-semibold small text-muted mb-2">Colors</h6>
        <div className="row g-2 mb-3">
          {([["primaryColor","Primary"],["headerBg","Header BG"],["headerTextColor","Header Text"]] as const).map(([k,l]) => (
            <div className="col-4" key={k}>
              <label className="form-label fw-semibold small">{l}</label>
              <div className="d-flex gap-1 align-items-center">
                <input type="color" className="form-control form-control-color" style={{width:28,height:28}}
                  value={(layout as any)[k]} onChange={e => updateStyle(k as any,e.target.value)} />
                <code style={{fontSize:9}}>{(layout as any)[k]}</code>
              </div>
            </div>
          ))}
        </div>
        <h6 className="fw-semibold small text-muted mb-2">Typography</h6>
        <div className="row g-2 mb-3">
          <div className="col-6">
            <label className="form-label fw-semibold small">Font</label>
            <select className="form-select form-select-sm" value={layout!.fontFamily}
              onChange={e => updateStyle("fontFamily",e.target.value)}>
              {["Arial, sans-serif","'Times New Roman', serif","'Courier New', monospace","Georgia, serif","Verdana, sans-serif","'Segoe UI', sans-serif"].map(f =>
                <option key={f} value={f}>{f.split(",")[0].replace(/'/g,"")}</option>)}
            </select>
          </div>
          <div className="col-3">
            <label className="form-label fw-semibold small">Size</label>
            <input type="number" className="form-control form-control-sm" value={layout!.fontSize} min={10} max={24}
              onChange={e => updateStyle("fontSize",+e.target.value)} />
          </div>
          <div className="col-3">
            <label className="form-label fw-semibold small">Paper</label>
            <select className="form-select form-select-sm" value={layout!.paperSize}
              onChange={e => updateStyle("paperSize",e.target.value)}>
              {["A4","Letter","A5"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <h6 className="fw-semibold small text-muted mb-2">Toggles</h6>
        <div className="d-flex flex-wrap gap-3">
          {(["showHeader","showFooter","showLogo","showSignature"] as const).map(k => (
            <div className="form-check form-switch" key={k}>
              <input className="form-check-input" type="checkbox" checked={!!(layout as any)[k]}
                onChange={() => updateStyle(k,!(layout as any)[k])} id={`t-${k}`} />
              <label className="form-check-label small" htmlFor={`t-${k}`}>{k.replace("show","")}</label>
            </div>
          ))}
        </div>
      </div></div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     PREVIEW — canvas-rendered payslip with 2-col support
     ═══════════════════════════════════════════════════════════════ */
  function renderPreview(secs: TemplateSection[]) {
    const enabled = secs.filter(s => s.enabled);
    const logo = companyLogo();

    // Group sections by colGroup for 2-column rendering
    const rows: (TemplateSection | TemplateSection[])[] = [];
    const used = new Set<string>();
    for (const sec of enabled) {
      if (used.has(sec.id)) continue;
      if (sec.colGroup) {
        const partner = enabled.find(s => s.colGroup === sec.colGroup && s.id !== sec.id && !used.has(s.id));
        if (partner) {
          rows.push([sec, partner]);
          used.add(sec.id); used.add(partner.id);
          continue;
        }
      }
      rows.push(sec);
      used.add(sec.id);
    }

    return (
      <div style={{
        fontFamily: layout!.fontFamily, fontSize: layout!.fontSize,
        maxWidth: 720, margin: "0 auto", background: "#fff",
        border: "1px solid #bbb", borderRadius: 4, overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,.12)",
      }}>
        {rows.map((row, ri) => {
          if (Array.isArray(row)) {
            // 2-column row
            return (
              <div key={ri} style={{ display: "flex", gap: 0 }}>
                {row.map(sec => (
                  <div key={sec.id} style={{ width: `${(sec.colWidth ?? 0.5) * 100}%`, minWidth: 0 }}>
                    {renderSection(sec, logo)}
                  </div>
                ))}
              </div>
            );
          }
          return <div key={ri}>{renderSection(row, logo)}</div>;
        })}
      </div>
    );
  }

  function renderSection(sec: TemplateSection, logo: string) {
    const st = { ...DEFAULT_SEC_STYLE, ...(sec.style || {}) };
    switch (sec.type) {
      case "header":  return pvHeader(sec, st, logo);
      case "info":    return pvInfo(sec, st);
      case "table":   return pvTable(sec, st);
      case "summary": return pvSummary(sec, st);
      case "note":    return pvNote(sec, st);
      case "footer":  return pvFooter(sec, st);
      default: return null;
    }
  }

  function pvHeader(s: TemplateSection, st: SectionStyle, logo: string) {
    return (
      <div key={s.id} style={{
        background: layout!.headerBg, color: layout!.headerTextColor,
        padding: `${st.padding ?? 20}px 24px`, textAlign: "center",
        borderRadius: st.borderRadius,
      }}>
        {layout!.showLogo && logo && (
          <img src={logo} alt="Logo" style={{ maxHeight: 52, maxWidth: 200, marginBottom: 8 }}
            onError={e => (e.currentTarget.style.display = "none")} />
        )}
        <h4 style={{ margin: 0, fontWeight: 700, fontSize: "1.3em" }}>{br.company_name || "COMPANY NAME"}</h4>
        {br.company_address && <p style={{ margin: "4px 0 0", fontSize: 11, opacity: .85 }}>{br.company_address}</p>}
        {(br.company_phone || br.company_email) && (
          <p style={{ margin: "2px 0 0", fontSize: 10, opacity: .7 }}>
            {[br.company_phone, br.company_email].filter(Boolean).join(" • ")}
          </p>
        )}
        <h5 style={{ margin: "10px 0 0", fontWeight: 600, fontSize: "1.1em", letterSpacing: 2 }}>PAYSLIP</h5>
      </div>
    );
  }

  function pvInfo(s: TemplateSection, st: SectionStyle) {
    const flds = (s.fields ?? []).filter(f => f.enabled);
    if (!flds.length) return null;
    return (
      <div key={s.id} style={{
        padding: `${st.padding ?? 12}px 24px`,
        background: st.bgColor, color: st.textColor,
        border: `${st.borderWidth}px solid ${st.borderColor}`,
        borderRadius: st.borderRadius,
      }}>
        <h6 style={{
          color: st.headerBg || layout!.primaryColor,
          fontWeight: 600,
          borderBottom: `2px solid ${st.headerBg || layout!.primaryColor}`,
          paddingBottom: 4, marginBottom: 8, fontSize: 13,
        }}>{s.label}</h6>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px" }}>
          {flds.map(f => (
            <div key={f.key} style={{ fontSize: 12 }}>
              <span style={{ color: st.textColor ? `${st.textColor}99` : "#6c757d" }}>{f.label}: </span>
              <strong>{SAMPLE[f.key] ?? "—"}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function pvTable(s: TemplateSection, st: SectionStyle) {
    const flds = (s.fields ?? []).filter(f => f.enabled);
    if (!flds.length) return null;
    const isDed = s.id === "deductions" || s.label.toLowerCase().includes("deduction");
    const hdrBg = st.colHeaderBg || "#f8f9fa";
    const hdrTxt = st.colHeaderText || "#212529";

    return (
      <div key={s.id} style={{
        padding: `${st.padding ?? 8}px 24px`,
        background: st.bgColor, color: st.textColor,
        borderRadius: st.borderRadius,
      }}>
        <h6 style={{
          color: st.headerBg || layout!.primaryColor, fontWeight: 600,
          borderBottom: `2px solid ${st.headerBg || layout!.primaryColor}`,
          paddingBottom: 4, marginBottom: 8, fontSize: 13,
        }}>{s.label}</h6>
        <table style={{
          width: "100%", borderCollapse: "collapse", fontSize: 12,
          border: `${st.borderWidth}px solid ${st.borderColor}`,
          borderRadius: st.borderRadius,
        }}>
          <thead>
            <tr style={{ background: hdrBg, color: hdrTxt }}>
              <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: `2px solid ${st.borderColor}`, fontWeight: 600 }}>Description</th>
              <th style={{ padding: "6px 8px", textAlign: "right", borderBottom: `2px solid ${st.borderColor}`, fontWeight: 600 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {flds.map((f, fi) => (
              <tr key={f.key} style={{
                color: isDed ? "#dc3545" : st.textColor,
                background: st.stripedRows && fi % 2 === 1 ? `${hdrBg}66` : undefined,
              }}>
                <td style={{ padding: "5px 8px", borderBottom: `1px solid ${st.borderColor}` }}>{f.label}</td>
                <td style={{
                  padding: "5px 8px", textAlign: "right",
                  borderBottom: `1px solid ${st.borderColor}`,
                  fontWeight: f.key === "gross_pay" ? 700 : 400,
                }}>{SAMPLE[f.key] ?? "₹0.00"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function pvSummary(s: TemplateSection, st: SectionStyle) {
    return (
      <div key={s.id} style={{ padding: `${st.padding ?? 12}px 24px` }}>
        <div style={{
          background: st.bgColor !== "#ffffff" ? st.bgColor : "#d1e7dd",
          border: `${st.borderWidth || 1}px solid ${st.borderColor !== "#dee2e6" ? st.borderColor : "#badbcc"}`,
          borderRadius: st.borderRadius || 6, padding: "12px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 18, fontWeight: 700, color: st.textColor,
        }}>
          <span>{s.label}</span>
          <span style={{ color: "#198754" }}>{SAMPLE.net_pay}</span>
        </div>
      </div>
    );
  }

  function pvNote(s: TemplateSection, st: SectionStyle) {
    return (
      <div key={s.id} style={{ padding: `${st.padding ?? 8}px 24px` }}>
        <p style={{
          fontSize: 10, color: st.textColor !== "#212529" ? st.textColor : "#6c757d",
          textAlign: "center", margin: 0,
          background: st.bgColor, borderRadius: st.borderRadius,
          border: st.borderWidth ? `${st.borderWidth}px solid ${st.borderColor}` : undefined,
          padding: st.bgColor !== "#ffffff" ? "6px" : undefined,
        }}>
          Gross = 24 × ₹937.50 = ₹23,562.50 | Net = ₹23,562.50 − ₹176.72 − ₹2,827.50 = ₹18,358.28
        </p>
      </div>
    );
  }

  function pvFooter(s: TemplateSection, st: SectionStyle) {
    const logo = companyLogo();
    return (
      <div key={s.id} style={{
        padding: `${st.padding ?? 16}px 24px`,
        borderTop: `1px solid ${st.borderColor || "#dee2e6"}`,
        background: st.bgColor, color: st.textColor,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            {br.footer_text && <p style={{ fontSize: 10, color: st.textColor !== "#212529" ? st.textColor : "#6c757d", margin: 0 }}>{br.footer_text}</p>}
            {br.company_phone && <p style={{ fontSize: 10, color: st.textColor !== "#212529" ? st.textColor : "#6c757d", margin: "2px 0 0" }}>📞 {br.company_phone}</p>}
          </div>
          {layout!.showSignature && (
            <div style={{ textAlign: "center" }}>
              <div style={{ borderTop: "1px solid #000", width: 140, marginBottom: 3 }} />
              <small style={{ fontSize: 10 }}>{br.signature_label || "Authorized Signatory"}</small>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     SECTION STYLE MODAL
     ═══════════════════════════════════════════════════════════════ */
  function secStyleModal() {
    if (!styleSec || !layout) return null;
    const sec = layout.sections.find(s => s.id === styleSec);
    if (!sec) return null;
    const st = { ...DEFAULT_SEC_STYLE, ...(sec.style || {}) };
    const isTable = sec.type === "table";
    const u = (k: keyof SectionStyle, v: any) => updateSecStyle(styleSec, k, v);

    return (
      <div className="modal d-block" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setStyleSec(null)}>
        <div className="modal-dialog modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header py-2">
              <h6 className="modal-title">🎨 Style: {sec.label}</h6>
              <button className="btn-close" onClick={() => setStyleSec(null)} />
            </div>
            <div className="modal-body">
              <div className="row g-3">
                {/* Colors */}
                <div className="col-md-6">
                  <h6 className="fw-semibold small text-muted mb-2">Section Colors</h6>
                  <div className="row g-2 mb-2">
                    {([
                      ["bgColor", "Background"],
                      ["textColor", "Text"],
                      ["borderColor", "Border"],
                      ["headerBg", "Heading Color"],
                    ] as const).map(([k, l]) => (
                      <div className="col-6 d-flex align-items-center gap-2" key={k}>
                        <input type="color" className="form-control form-control-color" style={{ width: 28, height: 28 }}
                          value={(st as any)[k] || "#ffffff"}
                          onChange={e => u(k, e.target.value)} />
                        <small>{l}</small>
                      </div>
                    ))}
                  </div>

                  {isTable && (
                    <>
                      <h6 className="fw-semibold small text-muted mb-2 mt-3">Table Column Header</h6>
                      <div className="row g-2 mb-2">
                        <div className="col-6 d-flex align-items-center gap-2">
                          <input type="color" className="form-control form-control-color" style={{ width: 28, height: 28 }}
                            value={st.colHeaderBg || "#f8f9fa"} onChange={e => u("colHeaderBg", e.target.value)} />
                          <small>Header BG</small>
                        </div>
                        <div className="col-6 d-flex align-items-center gap-2">
                          <input type="color" className="form-control form-control-color" style={{ width: 28, height: 28 }}
                            value={st.colHeaderText || "#212529"} onChange={e => u("colHeaderText", e.target.value)} />
                          <small>Header Text</small>
                        </div>
                      </div>
                      <div className="form-check form-switch mb-2">
                        <input className="form-check-input" type="checkbox" id="stripedRows"
                          checked={st.stripedRows ?? false} onChange={e => u("stripedRows", e.target.checked)} />
                        <label className="form-check-label small" htmlFor="stripedRows">Striped Rows</label>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <input type="color" className="form-control form-control-color" style={{ width: 28, height: 28 }}
                          value={st.rowHoverColor || "#e8f4fd"} onChange={e => u("rowHoverColor", e.target.value)} />
                        <small>Row Hover Color</small>
                      </div>
                    </>
                  )}
                </div>

                {/* Border & Spacing */}
                <div className="col-md-6">
                  <h6 className="fw-semibold small text-muted mb-2">Border & Spacing</h6>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label small mb-1">Border Width (px)</label>
                      <input type="number" className="form-control form-control-sm"
                        value={st.borderWidth ?? 1} min={0} max={5}
                        onChange={e => u("borderWidth", +e.target.value)} />
                    </div>
                    <div className="col-6">
                      <label className="form-label small mb-1">Border Radius (px)</label>
                      <input type="number" className="form-control form-control-sm"
                        value={st.borderRadius ?? 0} min={0} max={20}
                        onChange={e => u("borderRadius", +e.target.value)} />
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label small mb-1">Padding (px)</label>
                    <input type="range" className="form-range" min={0} max={32} step={2}
                      value={st.padding ?? 12} onChange={e => u("padding", +e.target.value)} />
                    <small className="text-muted">{st.padding ?? 12}px</small>
                  </div>

                  {/* Live mini preview */}
                  <h6 className="fw-semibold small text-muted mb-2 mt-3">Preview</h6>
                  <div style={{
                    background: st.bgColor, color: st.textColor,
                    border: `${st.borderWidth}px solid ${st.borderColor}`,
                    borderRadius: st.borderRadius, padding: st.padding,
                    fontSize: 12,
                  }}>
                    {isTable ? (
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr style={{ background: st.colHeaderBg, color: st.colHeaderText }}>
                          <th style={{ padding: 4, borderBottom: `2px solid ${st.borderColor}` }}>Item</th>
                          <th style={{ padding: 4, textAlign: "right", borderBottom: `2px solid ${st.borderColor}` }}>Amount</th>
                        </tr></thead>
                        <tbody>
                          {["Basic Pay", "HRA", "PF"].map((l, i) => (
                            <tr key={l} style={{ background: st.stripedRows && i % 2 === 1 ? `${st.colHeaderBg}66` : undefined }}>
                              <td style={{ padding: 3, borderBottom: `1px solid ${st.borderColor}` }}>{l}</td>
                              <td style={{ padding: 3, textAlign: "right", borderBottom: `1px solid ${st.borderColor}` }}>₹{(i + 1) * 5000}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div>
                        <div style={{ color: st.headerBg || layout!.primaryColor, fontWeight: 600, borderBottom: `2px solid ${st.headerBg || layout!.primaryColor}`, paddingBottom: 3, marginBottom: 6, fontSize: 12 }}>
                          {sec.label}
                        </div>
                        <div>Employee Name: <strong>Sample</strong></div>
                        <div>Department: <strong>Sample</strong></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer py-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => {
                updateSecStyle(styleSec, "bgColor", DEFAULT_SEC_STYLE.bgColor!);
                updateSecStyle(styleSec, "textColor", DEFAULT_SEC_STYLE.textColor!);
                updateSecStyle(styleSec, "borderColor", DEFAULT_SEC_STYLE.borderColor!);
                updateSecStyle(styleSec, "borderWidth", DEFAULT_SEC_STYLE.borderWidth!);
                updateSecStyle(styleSec, "borderRadius", DEFAULT_SEC_STYLE.borderRadius!);
                updateSecStyle(styleSec, "padding", DEFAULT_SEC_STYLE.padding!);
                if (isTable) {
                  updateSecStyle(styleSec, "colHeaderBg", DEFAULT_SEC_STYLE.colHeaderBg!);
                  updateSecStyle(styleSec, "colHeaderText", DEFAULT_SEC_STYLE.colHeaderText!);
                  updateSecStyle(styleSec, "stripedRows", false);
                }
              }}>Reset to Default</button>
              <button className="btn btn-primary btn-sm" onClick={() => setStyleSec(null)}>Done</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     NEW TEMPLATE MODAL
     ═══════════════════════════════════════════════════════════════ */
  function newModal() {
    if (!showNew) return null;
    return (
      <div className="modal d-block" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setShowNew(false)}>
        <div className="modal-dialog" onClick={e => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header"><h5 className="modal-title">New Payslip Template</h5>
              <button className="btn-close" onClick={() => setShowNew(false)} /></div>
            <div className="modal-body">
              <div className="mb-3"><label className="form-label fw-semibold">Name *</label>
                <input className="form-control" value={newName} onChange={e => setNewName(e.target.value)} /></div>
              <div className="mb-3"><label className="form-label fw-semibold">Description</label>
                <textarea className="form-control" rows={2} value={newDesc} onChange={e => setNewDesc(e.target.value)} /></div>
              <div className="mb-3"><label className="form-label fw-semibold">Company</label>
                <select className="form-select" value={newCoId ?? ""}
                  onChange={e => setNewCoId(e.target.value ? +e.target.value : null)}>
                  <option value="">🌐 Global</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <div className="form-check"><input className="form-check-input" type="checkbox" id="ndfl"
                checked={newDefault} onChange={e => setNewDefault(e.target.checked)} />
                <label className="form-check-label" htmlFor="ndfl">Set as default</label></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()}>Create</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     ADD FIELD MODAL
     ═══════════════════════════════════════════════════════════════ */
  function fieldModal() {
    if (!showField) return null;
    const sec = layout?.sections.find(s => s.id === fieldTarget);
    const used = new Set((sec?.fields ?? []).map(f => f.key));
    const avail = EXTRA_FIELDS.filter(f => !used.has(f.key));
    return (
      <div className="modal d-block" style={{ background: "rgba(0,0,0,.4)" }} onClick={() => setShowField(false)}>
        <div className="modal-dialog" onClick={e => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header"><h5 className="modal-title">Add Field to "{sec?.label}"</h5>
              <button className="btn-close" onClick={() => setShowField(false)} /></div>
            <div className="modal-body">
              {avail.length > 0 && <>
                <h6 className="fw-semibold small text-muted mb-2">Predefined</h6>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {avail.map(f => <button key={f.key} className="btn btn-sm btn-outline-primary"
                    onClick={() => { addFieldTo(fieldTarget, { ...f }); setShowField(false); }}>+ {f.label}</button>)}
                </div><hr /></>}
              <h6 className="fw-semibold small text-muted mb-2">Custom</h6>
              <div className="row g-2">
                <div className="col-5"><input className="form-control form-control-sm" placeholder="Label"
                  value={cusLabel} onChange={e => setCusLabel(e.target.value)} /></div>
                <div className="col-4"><input className="form-control form-control-sm" placeholder="key_name"
                  value={cusKey} onChange={e => setCusKey(e.target.value.replace(/\s/g, "_").toLowerCase())} /></div>
                <div className="col-3"><button className="btn btn-sm btn-primary w-100"
                  disabled={!cusLabel.trim() || !cusKey.trim()}
                  onClick={() => {
                    addFieldTo(fieldTarget, { key: cusKey.trim(), label: cusLabel.trim(), enabled: true });
                    setCusLabel(""); setCusKey(""); setShowField(false);
                  }}>Add</button></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
