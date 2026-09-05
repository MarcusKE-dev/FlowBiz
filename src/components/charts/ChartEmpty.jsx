// src/components/charts/ChartEmpty.jsx
//
// The block a chart shows instead of drawing something misleading: a
// single point rendered as a "trend", or a run of zeroes rendered as a
// line lying along the floor. Matches the NoData block the analytics
// pages already use, so a chart that opts out looks like every other
// empty section on the page.

import { Info } from 'lucide-react';

export default function ChartEmpty({ children = 'Not enough data to chart yet.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Info className="mb-2 h-6 w-6 text-ink-300" strokeWidth={1.5} />
      <p className="text-body text-ink-500">{children}</p>
    </div>
  );
}
