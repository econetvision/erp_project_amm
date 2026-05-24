import type { ReactNode } from "react";

interface Props {
  label: string;
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onBlur?: () => void;
  validation?: { className?: string; error?: string | null };
  type?: string;
  placeholder?: string;
  icon?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  minLength?: number;
  min?: number;
  step?: string;
  as?: "input" | "textarea" | "select";
  rows?: number;
  children?: ReactNode;
  hint?: string;
  style?: React.CSSProperties;
  autoComplete?: string;
}

export default function ValidatedInput({
  label, name, value, onChange, onBlur, validation, type = "text",
  placeholder, icon, required, disabled, maxLength, minLength, min, step,
  as = "input", rows, children, hint, style, autoComplete,
}: Props) {
  const cls = `form-control ${validation?.className || ""}`.trim();
  const selCls = `form-select ${validation?.className || ""}`.trim();

  const input = as === "textarea" ? (
    <textarea className={cls} name={name} value={value} onChange={onChange} onBlur={onBlur}
      placeholder={placeholder || label} required={required} disabled={disabled}
      maxLength={maxLength} minLength={minLength} rows={rows || 3} style={style} />
  ) : as === "select" ? (
    <select className={selCls} name={name} value={value} onChange={onChange} onBlur={onBlur}
      required={required} disabled={disabled} style={style}>
      {children}
    </select>
  ) : (
    <input className={cls} name={name} value={value} onChange={onChange} onBlur={onBlur}
      type={type} placeholder={placeholder || label} required={required} disabled={disabled}
      maxLength={maxLength} minLength={minLength} min={min} step={step} style={style}
      autoComplete={autoComplete} />
  );

  return (
    <div className="mb-3">
      <label className="form-label fw-semibold">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {icon ? (
        <div className="input-group">
          <span className="input-group-text">{icon}</span>
          {input}
          {validation?.error && <div className="invalid-feedback">{validation.error}</div>}
        </div>
      ) : (
        <>
          {input}
          {validation?.error && <div className="invalid-feedback">{validation.error}</div>}
        </>
      )}
      {hint && !validation?.error && <div className="form-text">{hint}</div>}
    </div>
  );
}
