import { useMemo } from 'react';
import type { ActivityPoint } from '../../lib/types';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// 14px cell + 3px gap = 17px per column
const COL_PX = 17;

function intensity(count: number): string {
  if (count === 0) return 'bg-slate-800';
  if (count <= 2) return 'bg-green-900';
  if (count <= 5) return 'bg-green-700';
  return 'bg-green-500';
}

function computeMaxStreak(cells: { date: string; count: number }[]): number {
  let max = 0;
  let cur = 0;
  for (const cell of cells) {
    if (cell.count > 0) {
      cur++;
      if (cur > max) max = cur;
    } else {
      cur = 0;
    }
  }
  return max;
}

export default function ActivityHeatmap({ data }: { data: ActivityPoint[] }) {
  const { weeks, monthLabels, totalAttempts, activeDays, maxStreak } = useMemo(() => {
    const map = new Map(data.map(d => [d.date, d.count]));
    const today = new Date();

    // 365 cells: oldest first
    const cells: { date: string; count: number; js: Date }[] = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      cells.push({
        date: d.toISOString().slice(0, 10),
        count: map.get(d.toISOString().slice(0, 10)) ?? 0,
        js: d,
      });
    }

    // Stats
    const totalAttempts = cells.reduce((sum, c) => sum + c.count, 0);
    const activeDays = cells.filter(c => c.count > 0).length;
    const maxStreak = computeMaxStreak(cells);

    // Chunk into 7-day columns (oldest week first)
    const weeks: { date: string; count: number; js: Date }[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    // Month label: show abbreviated month on the first column that contains the 1st of any month
    const monthLabels: (string | null)[] = weeks.map(week => {
      for (const c of week) if (c.js.getDate() === 1) return MONTHS[c.js.getMonth()];
      return null;
    });

    return { weeks, monthLabels, totalAttempts, activeDays, maxStreak };
  }, [data]);

  const totalWidth = weeks.length * COL_PX;

  return (
    <div>
      {/* ── Stats header ─────────────────────────────────── */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-base font-bold text-white">
          {totalAttempts} attempt{totalAttempts !== 1 ? 's' : ''} in the past year
        </span>
        <span className="text-xs text-gray-500">
          Active days: {activeDays}&nbsp;&nbsp;·&nbsp;&nbsp;Max streak: {maxStreak}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="relative select-none" style={{ minWidth: totalWidth }}>

          {/* ── Heatmap cells ────────────────────────────────── */}
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map(cell => (
                  <div
                    key={cell.date}
                    title={`${cell.date}: ${cell.count} attempt${cell.count !== 1 ? 's' : ''}`}
                    className={`w-[14px] h-[14px] rounded-sm transition-colors ${intensity(cell.count)}`}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* ── Month labels (below the grid) ────────────────── */}
          <div className="relative h-5 mt-1">
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

        </div>
      </div>
    </div>
  );
}
