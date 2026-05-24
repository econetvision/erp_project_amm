import type { ReactNode } from "react";

interface Step {
  title: string;
  icon?: string;
}

interface MultiStepFormProps {
  steps: Step[];
  current: number;
  onStepClick?: (index: number) => void;
  children: ReactNode;
}

export default function MultiStepForm({ steps, current, onStepClick, children }: MultiStepFormProps) {
  return (
    <div>
      {/* Step indicator */}
      <div className="d-flex align-items-center mb-4 px-2">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={i} className="d-flex align-items-center" style={{ flex: i < steps.length - 1 ? 1 : undefined }}>
              <div
                className="d-flex align-items-center gap-2"
                style={{ cursor: onStepClick && (done || active) ? "pointer" : "default" }}
                onClick={() => onStepClick && (done || active) && onStepClick(i)}
              >
                <div
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.8rem", fontWeight: 600,
                    background: done ? "#198754" : active ? "#0d6efd" : "#e9ecef",
                    color: done || active ? "#fff" : "#6c757d",
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                >
                  {done ? "✓" : step.icon || i + 1}
                </div>
                <span
                  className="d-none d-md-inline"
                  style={{
                    fontSize: "0.8rem", fontWeight: active ? 600 : 400, whiteSpace: "nowrap",
                    color: active ? "#0d6efd" : done ? "#198754" : "#6c757d",
                  }}
                >
                  {step.title}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  style={{
                    flex: 1, height: 2, margin: "0 8px",
                    background: done ? "#198754" : "#e9ecef",
                    transition: "background 0.2s",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Step content */}
      {children}
    </div>
  );
}
