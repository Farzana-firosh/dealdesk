/** A single-value progress ring: `value` 0–100, or null for "no data yet". */
export default function Ring({ value, label, color = 'var(--slate)', size = 76 }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <svg className="ring" viewBox="0 0 76 76" width={size} height={size} role="img" aria-label={`${label}: ${value === null ? 'no data' : `${pct}%`}`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--border-soft)" strokeWidth="7" />
      {pct > 0 && (
        <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 38 38)" />
      )}
      <text x="38" y="42" textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--text)">{value === null ? '–' : `${pct}%`}</text>
    </svg>
  );
}
