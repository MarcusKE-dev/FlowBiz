// src/components/charts/MiniBarChart.jsx
//
// Two orientations from one component:
//   - "horizontal" — ranked comparisons (best-selling products, top
//     overstocked items). Defaults to blue: a ranking isn't inherently
//     good or bad, so it stays out of the green/red semantic pair.
//   - "vertical" — a value over time (profit trend). Defaults to
//     green/red per bar based on the sign of the value, since profit
//     being positive or negative IS the meaning here.
export default function MiniBarChart({ data, orientation = 'vertical', height = 160, formatValue = (v) => String(v), ariaLabel }) {
  if (!data || data.length === 0) return null;
  const values = data.map((d) => Number(d.value) || 0);
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);

  if (orientation === 'horizontal') {
    return (
      <div role="img" aria-label={ariaLabel || 'Bar chart'} className="space-y-2.5">
        {data.map((d, i) => {
          const value = Number(d.value) || 0;
          const widthPct = Math.max((Math.abs(value) / maxAbs) * 100, 2);
          return (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-ink-700">{d.label}</span>
                <span className="shrink-0 font-semibold text-ink-800">{formatValue(value)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-ink-100">
                <div className={`h-2 rounded-full ${d.colorClassName || 'bg-blue-600'}`} style={{ width: `${widthPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const width = Math.max(data.length * 14, 100);
  const midY = height / 2;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" role="img" aria-label={ariaLabel || 'Bar chart'}>
        <line x1="0" y1={midY} x2={width} y2={midY} stroke="currentColor" className="text-ink-100" strokeWidth="1" />
        {data.map((d, i) => {
          const value = Number(d.value) || 0;
          const gap = width / data.length;
          const barWidth = gap * 0.55;
          const x = i * gap + (gap - barWidth) / 2;
          const barHeight = (Math.abs(value) / maxAbs) * (midY - 8);
          const y = value >= 0 ? midY - barHeight : midY;
          const colorClass = d.colorClassName || (value >= 0 ? 'text-moss-600' : 'text-rust-500');
          return <rect key={i} x={x} y={y} width={barWidth} height={Math.max(barHeight, 1)} className={colorClass} fill="currentColor" rx="1.5" />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-400">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}
