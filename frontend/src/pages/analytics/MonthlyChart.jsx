import { useLayoutEffect, useRef, useState } from 'react';
import { formatMoney } from '../../utils/format';

// Deals won and lost per month: two series, one count axis.
const SERIES = [
  { key: 'won', label: 'Won', color: 'var(--success)' },
  { key: 'lost', label: 'Lost', color: 'var(--danger)' },
];
const H = 200;
const PAD = { top: 8, right: 4, bottom: 24, left: 28 };
const PLOT_H = H - PAD.top - PAD.bottom;
const TOOLTIP_W = 180; // matches .chart-tooltip width; keeps it inside the plot on a phone

// Width in CSS pixels, so text and bars keep their size on a phone instead of scaling down.
function useWidth(fallback) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width) || fallback));
    observer.observe(el);
    return () => observer.disconnect();
  }, [fallback]);
  return [ref, width];
}

export const monthLabel = (m, long = false) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString([], { month: long ? 'long' : 'short', ...(long && { year: 'numeric' }), timeZone: 'UTC' });

// A bar with rounded top corners, sitting on the baseline.
function bar(x, y, w, h) {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export default function MonthlyChart({ months }) {
  const [active, setActive] = useState(null);
  const [plotRef, W] = useWidth(600);
  const PLOT_W = W - PAD.left - PAD.right;

  const max = Math.max(1, ...months.flatMap((m) => SERIES.map((s) => m[s.key].count)));
  const step = Math.max(1, Math.ceil(max / 4));
  const yMax = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);
  const y = (v) => PAD.top + PLOT_H - (v / yMax) * PLOT_H;

  const groupW = PLOT_W / months.length;
  const barW = Math.min(22, groupW * 0.28);
  const GAP = 2;

  const totals = Object.fromEntries(SERIES.map((s) => [s.key, months.reduce((n, m) => n + m[s.key].count, 0)]));
  const hovered = active === null ? null : months[active];

  return (
    <div className="chart">
      <div className="chart-legend">
        {SERIES.map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.label} <b>{totals[s.key]}</b></span>
        ))}
      </div>

      <div className="chart-plot" ref={plotRef} onMouseLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Deals won and lost per month, last six months">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart-base' : 'chart-grid'} />
              <text x={PAD.left - 8} y={y(t)} className="chart-tick" textAnchor="end" dominantBaseline="middle">{t}</text>
            </g>
          ))}

          {months.map((m, i) => {
            const cx = PAD.left + groupW * i + groupW / 2;
            const x0 = cx - barW - GAP / 2;
            return (
              <g key={m.month}>
                {active === i && <rect x={PAD.left + groupW * i} y={PAD.top} width={groupW} height={PLOT_H} className="chart-hover" />}
                {SERIES.map((s, j) => {
                  const v = m[s.key].count;
                  if (!v) return null;
                  return <path key={s.key} d={bar(x0 + j * (barW + GAP), y(v), barW, y(0) - y(v))} fill={s.color} />;
                })}
                <text x={cx} y={H - 6} className="chart-tick" textAnchor="middle">{monthLabel(m.month)}</text>
                {/* the whole column is the hit target, wider than the bars */}
                <rect x={PAD.left + groupW * i} y={PAD.top} width={groupW} height={PLOT_H} fill="transparent" tabIndex={0}
                  aria-label={`${monthLabel(m.month, true)}: ${m.won.count} won, ${m.lost.count} lost`}
                  onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} />
              </g>
            );
          })}
        </svg>

        {hovered && (
          // beside the column, never over its bars: to the right in the first half, to the left after
          <div className="chart-tooltip" style={active < months.length / 2
            ? { left: Math.min(PAD.left + groupW * (active + 1) + 4, W - TOOLTIP_W) }
            : { right: Math.min(W - (PAD.left + groupW * active) + 4, W - TOOLTIP_W) }}>
            <b>{monthLabel(hovered.month, true)}</b>
            {SERIES.map((s) => (
              <div key={s.key}>
                <i style={{ background: s.color }} />{s.label}
                <span className="spacer" />
                <span>{hovered[s.key].count} · <span className="mono">{formatMoney(hovered[s.key].value)}</span></span>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="chart-table">
        <summary>View as table</summary>
        <table>
          <thead><tr><th>Month</th><th>Won</th><th>Won value</th><th>Lost</th><th>Lost value</th></tr></thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <td>{monthLabel(m.month, true)}</td>
                <td>{m.won.count}</td><td className="mono">{formatMoney(m.won.value)}</td>
                <td>{m.lost.count}</td><td className="mono">{formatMoney(m.lost.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
