import { useMemo } from 'react';
import type { ActivityPoint } from '../../lib/types';

function intensity(count: number): string {
  if (count === 0) return 'bg-slate-700';
  if (count <= 2) return 'bg-green-900';
  if (count <= 4) return 'bg-green-700';
  return 'bg-green-500';
}

export default function ActivityHeatmap({ data }: { data: ActivityPoint[] }) {
  const weeks = useMemo(() => {
    const map = new Map(data.map(d => [d.date, d.count]));
    const today = new Date();
    const cells: { date: string; count: number }[] = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      cells.push({ date: dateStr, count: map.get(dateStr) ?? 0 });
    }
    const result: { date: string; count: number }[][] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [data]);

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
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
  );
}
