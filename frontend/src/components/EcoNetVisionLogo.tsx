export default function EcoNetVisionLogo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      {/* Outer ring */}
      <circle cx="24" cy="24" r="22" fill="none" stroke="#4ea8e8" strokeWidth="2" />

      {/* Network nodes */}
      <circle cx="24" cy="8"  r="3" fill="#4ea8e8" />
      <circle cx="40" cy="32" r="3" fill="#4ea8e8" />
      <circle cx="8"  cy="32" r="3" fill="#4ea8e8" />

      {/* Network lines */}
      <line x1="24" y1="8"  x2="40" y2="32" stroke="#4ea8e8" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="24" y1="8"  x2="8"  y2="32" stroke="#4ea8e8" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="8"  y1="32" x2="40" y2="32" stroke="#4ea8e8" strokeWidth="1.5" strokeOpacity="0.6" />

      {/* Central eye (Vision) */}
      <ellipse cx="24" cy="24" rx="8" ry="5" fill="none" stroke="#34d399" strokeWidth="1.8" />
      <circle  cx="24" cy="24" r="2.5" fill="#34d399" />

      {/* Leaf accent (Eco) */}
      <path
        d="M24 16 C28 16, 32 20, 30 25 C28 22, 24 20, 24 16Z"
        fill="#34d399"
        opacity="0.85"
      />
    </svg>
  );
}
