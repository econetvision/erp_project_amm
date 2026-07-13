import { useEffect, useState } from "react";
import type { ProviderConfigSchema } from "../../types/integration";

interface Props {
  /** The selected provider's config_schema (may be null for custom providers). */
  schema: ProviderConfigSchema | null | undefined;
  /** Current credential values (plain text; encrypted server-side on save). */
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  /** Masked stored values (e.g. "AC***3f") shown as placeholders when editing. */
  masked?: Record<string, string>;
  /** Changing this key resets the free-form rows (e.g. pass the provider id). */
  resetKey?: string | number;
}

/**
 * Credential editor for a provider integration.
 * When the provider declares a config_schema, renders exact labelled fields
 * (password inputs for secrets, required markers, help text). Otherwise falls
 * back to free-form key/value rows.
 */
export default function CredentialFields({ schema, values, onChange, masked, resetKey }: Props) {
  const fields = schema?.credentials && Object.keys(schema.credentials).length > 0
    ? schema.credentials
    : null;

  // Free-form fallback rows
  const [rows, setRows] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);
  useEffect(() => { setRows([{ key: "", value: "" }]); }, [resetKey]);

  const emitRows = (next: { key: string; value: string }[]) => {
    setRows(next);
    const creds: Record<string, string> = {};
    next.filter(r => r.key.trim()).forEach(r => { creds[r.key.trim()] = r.value; });
    onChange(creds);
  };

  if (fields) {
    return (
      <div className="row g-3">
        {Object.entries(fields).map(([key, spec]) => (
          <div className="col-md-4" key={key}>
            <label className="form-label fw-semibold">
              {spec.label}
              {spec.required && <span className="text-danger"> *</span>}
            </label>
            <input
              className="form-control form-control-sm"
              type={spec.secret ? "password" : "text"}
              autoComplete="new-password"
              value={values[key] || ""}
              placeholder={masked?.[key] ? `Saved: ${masked[key]}` : spec.label}
              onChange={e => onChange({ ...values, [key]: e.target.value })}
            />
            {spec.help && <small className="text-muted">{spec.help}</small>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {rows.map((r, i) => (
        <div className="row g-2 mb-2" key={i}>
          <div className="col-md-4">
            <input className="form-control form-control-sm" placeholder="Key (e.g. api_key)"
              value={r.key}
              onChange={e => {
                const next = [...rows];
                next[i] = { ...next[i], key: e.target.value };
                emitRows(next);
              }} />
          </div>
          <div className="col-md-6">
            <input className="form-control form-control-sm" placeholder="Value" type="password"
              autoComplete="new-password"
              value={r.value}
              onChange={e => {
                const next = [...rows];
                next[i] = { ...next[i], value: e.target.value };
                emitRows(next);
              }} />
          </div>
          <div className="col-md-2">
            {i === rows.length - 1 ? (
              <button type="button" className="btn btn-sm btn-outline-primary"
                onClick={() => setRows([...rows, { key: "", value: "" }])}>+</button>
            ) : (
              <button type="button" className="btn btn-sm btn-outline-danger"
                onClick={() => emitRows(rows.filter((_, j) => j !== i))}>−</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
