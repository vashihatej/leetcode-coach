import { useMemo } from 'react';
import type { ActivityPoint } from '../../lib/types';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// w-3 = 12px cell + gap-1 = 4px → 16px per column
const COL_PX = 16;

function intensity(count: number): string {
  if (count === 0) return 'bg-slate-700';
  if (count <= 2) return 'bg-green-900';
  if (count <= 4) return 'bg-green-700';
  return 'bg-green-500';
}

export default function ActivityHeatmap({ data }: { data: ActivityPoint[] }) {
  const { weeks, monthLabels, weekLabels } = useMemo(() => {
    const map = new Map(data.map(d => [d.date, d.count]));
    const today = new Date();
    const curMonth = today.getMonth();
    const curYear  = today.getFullYear();

    // 365 cells: oldest first
    const cells: { date: string; count: number; js: Date }[] = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      cells.push({ date: d.toISOString().slice(0, 10), count: map.get(d.toISOString().slice(0, 10)) ?? 0, js: d });
    }

    // Chunk into 7-day columns (oldest week first)
    const weeks: { date: string; count: number; js: Date }[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    // Month label: show abbreviated month on the first column that contains the 1st of any month
    const monthLabels: (string | null)[] = weeks.map(week => {
      for (const c of week) if (c.js.getDate() === 1) return MONTHS[c.js.getMonth()];
      return null;
    });

    // Week-of-month labels: only for columns overlapping the current month
    const weekLabels: (string | null)[] = [];
    let weekNum = 1;
    for (const week of weeks) {
      const inCur = week.some(c => c.js.getMonth() === curMonth && c.js.getFullYear() === curYear);
      weekLabels.push(inCur ? `W${weekNum++}` : null);
    }

    return { weeks, monthLabels, weekLabels };
  }, [data]);

  const totalWidth = weeks.length * COL_PX;

  return (
    <div className="overflow-x-auto">
      <div className="relative select-none" style={{ minWidth: totalWidth }}>

        {/* ── Month labels ─────────────────────────────────── */}
        <div className="relative h-5 mb-1">
          {monthLabels.map((label, wi) =>
            label ? (
              <span
                key={wi}
                className="absolute text-gray-400 whitespace-nowrap leading-none"
                style={{ left: wi * COL_PX, fontSize: 10, top: 2 }}
              >
                {label}
              </span>
            ) : null
          )}
        </div>

        {/* ── Heatmap cells ────────────────────────────────── */}
        <div className="flex gap-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map(cell => (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${cell.count} attempt${cell.count !== 1 ? 's' : ''}`}
                  className={`w-3 h-3 rounded-sm transition-colors ${intensity(cell.count)}`}
                />
              ))}
            </div>
          ))}
        </div>

        {/* ── Week-of-month labels (current month only) ───── */}
        <div className="relative h-5 mt-1">
          {weekLabels.map((label, wi) =>
            label ? (
              <span
                key={wi}
                className="absolute text-indigo-400 whitespace-nowrap leading-none font-medium"
                style={{ left: wi * COL_PX, fontSize: 10, top: 3 }}
              >
                {label}
              </span>
            ) : null
          )}
          {weekLabels.some(Boolean) && (
            <span
              className="absolute text-gray-500 whitespace-nowrap leading-none"
              style={{ left: 0, fontSize: 9, top: 13 }}
            >
              ↑ current month
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
