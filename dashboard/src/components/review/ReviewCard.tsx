import { ExternalLink } from 'lucide-react';
import type { ReviewItem } from '../../lib/types';
import { classifyDueDate } from '../../lib/dates';

const DIFF: Record<string, string> = {
  Easy: 'text-green-400',
  Medium: 'text-amber-400',
  Hard: 'text-red-400',
};

function easeBarWidth(ease: number): number {
  const pct = ((ease - 1.3) / (3.0 - 1.3)) * 100;
  return Math.min(100, Math.max(0, pct));
}

function urgency(dueDateStr: string): { label: string; ring: string; labelColor: string } {
  const cls = classifyDueDate(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + 'T00:00:00');
  const diffDays = Math.abs(Math.round((due.getTime() - today.getTime()) / 86400000));

  if (cls === 'overdue') {
    return {
      label: `${diffDays} day${diffDays !== 1 ? 's' : ''} overdue`,
      ring: 'border-red-500/40',
      labelColor: 'text-red-400',
    };
  }
  if (cls === 'due-today') {
    return { label: 'Due today', ring: 'border-amber-500/40', labelColor: 'text-amber-400' };
  }
  return {
    label: `In ${diffDays} day${diffDays !== 1 ? 's' : ''}`,
    ring: 'border-gray-700',
    labelColor: 'text-gray-400',
  };
}

export default function ReviewCard({ item }: { item: ReviewItem }) {
  const { label, ring, labelColor } = urgency(item.due_date);
  const barW = easeBarWidth(item.ease);

  return (
    <div className={`bg-gray-800 border ${ring} rounded-xl p-5`}>
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-white truncate">
              {item.title ?? item.slug}
            </span>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-gray-500 hover:text-indigo-400 flex-shrink-0"
              >
                <ExternalLink size={13} />
              </a>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className={DIFF[item.difficulty ?? ''] ?? 'text-gray-400'}>
              {item.difficulty ?? '—'}
            </span>
            <span>{item.reps} rep{item.reps !== 1 ? 's' : ''}</span>
            <span className={labelColor}>{label}</span>
          </div>
        </div>
      </div>

      {/* ease bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Ease factor</span>
          <span>{item.ease.toFixed(2)}</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${barW}%` }}
          />
        </div>
      </div>
    </div>
  );
}
