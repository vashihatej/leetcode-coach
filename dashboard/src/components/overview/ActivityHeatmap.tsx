import { useMemo } from 'react';
import type { ActivityPoint } from '../../lib/types';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_OF_WEEK = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const CELL  = 13;   // px
const GAP   = 3;    // px
const COL   = CELL + GAP;  // 16px per column
const DAY_W = 30;   // left gutter for day labels

// GitHub-inspired 5-level palette adapted for dark theme
function intensity(count: number): string {
  if (count === 0)  return 'bg-gray-800';
  if (count <= 2)   return 'bg-green-950 border border-green-900/40';
  if (count <= 5)   return 'bg-green-800';
  if (count <= 10)  return 'bg-green-600';
  return 'bg-green-400';
}

function localStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function computeMaxStreak(cells: { count: number }[]): number {
  let max = 0, cur = 0;
  for (const c of cells) { cur = c.count > 0 ? cur + 1 : 0; if (cur > max) max = cur; }
  return max;
}

export default function ActivityHeatmap({ data }: { data: ActivityPoint[] }) {
  const { weeks, monthLabels, totalAttempts, activeDays, maxStreak, todayStr } = useMemo(() => {
    const map = new Map(data.map(d => [d.date, d.count]));
    const today = new Date();
    const todayStr = localStr(today);

    // Align to Sunday of today's week, then go back 52 full weeks
    const endSunday = new Date(today);
    endSunday.setDate(today.getDate() - today.getDay() + 7); // next Sunday (exclusive end)
    const startSunday = new Date(endSunday);
    startSunday.setDate(endSunday.getDate() - 53 * 7);

    const cells: { date: string; count: number; js: Date }[] = [];
    const d = new Date(startSunday);
    while (d < endSunday && d <= today) {
      const ds = localStr(d);
      cells.push({ date: ds, count: map.get(ds) ?? 0, js: new Date(d) });
      d.setDate(d.getDate() + 1);
    }

    const totalAttempts = cells.reduce((s, c) => s + c.count, 0);
    const activeDays    = cells.filter(c => c.count > 0).length;
    const maxStreak     = computeMaxStreak(cells);

    // Chunk into 7-day columns (Sun–Sat)
    const weeks: { date: string; count: number; js: Date }[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    // Month label on the first column that contains the 1st of any month
    const monthLabels: (string | null)[] = weeks.map(week => {
      for (const c of week) if (c.js.getDate() === 1) return MONTHS[c.js.getMonth()];
      return null;
    });

    return { weeks, monthLabels, totalAttempts, activeDays, maxStreak, todayStr };
  }, [data]);

  const LEGEND_COUNTS = [0, 2, 5, 10, 12];

  return (
    <div>
      {/* ── Stats header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{totalAttempts}</span>
            <span className="text-sm text-gray-400 font-medium">attempts in the past year</span>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-xs">
            <span className="text-gray-500">
              Active days: <span className="text-gray-200 font-semibold">{activeDays}</span>
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-gray-500">
              Max streak: <span className="text-gray-200 font-semibold">{maxStreak}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col select-none">

          {/* Month labels row */}
          <div className="flex mb-1" style={{ paddingLeft: DAY_W }}>
            <div className="relative" style={{ width: weeks.length * COL }}>
              {monthLabels.map((label, wi) =>
                label ? (
                  <span
                    key={wi}
                    className="absolute text-[10px] text-gray-500 whitespace-nowrap"
                    style={{ left: wi * COL }}
                  >
                    {label}
                  </span>
                ) : null
              )}
              {/* invisible spacer to set height */}
              <span className="invisible text-[10px]">X</span>
            </div>
          </div>

          {/* Day labels + cells */}
          <div className="flex">
            {/* Day-of-week labels (Mon, Wed, Fri only — GitHub style) */}
            <div
              className="flex flex-col pr-2"
              style={{ width: DAY_W, gap: GAP }}
            >
              {DAYS_OF_WEEK.map((day, i) => (
                <div
                  key={day}
                  className="flex items-center text-[9px] text-gray-600"
                  style={{ height: CELL }}
                >
                  {[1, 3, 5].includes(i) ? day : ''}
                </div>
              ))}
            </div>

            {/* Heatmap cells */}
            <div className="flex" style={{ gap: GAP }}>
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
                  {week.map(cell => {
                    const isToday = cell.date === todayStr;
                    return (
                      <div
                        key={cell.date}
                        title={`${new Date(cell.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${cell.count} attempt${cell.count !== 1 ? 's' : ''}`}
                        className={[
                          'rounded-sm transition-opacity hover:opacity-80',
                          intensity(cell.count),
                          isToday ? 'ring-1 ring-indigo-400 ring-offset-1 ring-offset-gray-900' : '',
                        ].join(' ')}
                        style={{ width: CELL, height: CELL }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-1.5 mt-2" style={{ paddingLeft: DAY_W }}>
            <span className="text-[10px] text-gray-600">Less</span>
            {LEGEND_COUNTS.map((n, i) => (
              <div
                key={i}
                className={`rounded-sm ${intensity(n)}`}
                style={{ width: 10, height: 10 }}
                title={n === 0 ? 'No attempts' : `~${n} attempts`}
              />
            ))}
            <span className="text-[10px] text-gray-600">More</span>
          </div>

        </div>
      </div>
    </div>
  );
}
