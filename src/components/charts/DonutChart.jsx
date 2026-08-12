// src/components/charts/DonutChart.jsx
//
// Small part-to-whole breakdown (payment methods, stock health). Always
// paired with a text legend showing exact values and percentages — the
// slices alone are never the only way to read the data.
export default function DonutChart({ segments, size = 148, formatValue = (v) => String(v), centerLabel }) {
  const visible = (segments || []).filter((s) => (Number(s.value) || 0) > 0);
  const total = visible.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (total <= 0) return null;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offsetAccum = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0" role="img" aria-label="Breakdown chart">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-ink-100" strokeWidth="14" />
        {visible.map((s, i) => {
          const value = Number(s.value) || 0;
          const fraction = value / total;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const el = (
            <circle
              key={i}
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="currentColor"
              className={s.colorClassName || 'text-blue-600'}
              strokeWidth="14"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offsetAccum}
              transform="rotate(-90 50 50)"
            />
          );
          offsetAccum += dash;
          return el;
        })}
        {centerLabel && (
          <text x="50" y="53" textAnchor="middle" fill="currentColor" className="text-ink-900" style={{ fontSize: '11px', fontWeight: 700 }}>
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="w-full space-y-1.5">
        {visible.map((s, i) => {
          const value = Number(s.value) || 0;
          const pct = (value / total) * 100;
          return (
            <li key={i} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-ink-600">
                <span className={`h-2.5 w-2.5 rounded-full ${s.dotClassName || 'bg-blue-600'}`} />
                {s.label}
              </span>
              <span className="font-semibold text-ink-800">
                {formatValue(value)} <span className="font-normal text-ink-400">({pct.toFixed(0)}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
