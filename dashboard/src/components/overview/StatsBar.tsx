import { BookOpen, CheckCircle2, Zap, Clock, Flame } from 'lucide-react';
import { useStats } from '../../hooks/useStats';

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  accent: string; // Tailwind border-left color class
}) {
  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-1 border-l-2 ${accent} transition-all hover:border-gray-600`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-xs text-gray-400">{label}</p>
        <span className="text-gray-600">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white leading-none">{value}</p>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

export default function StatsBar() {
  const { data: s } = useStats();

  const total    = s?.total_problems   ?? 0;
  const solved   = s?.solved_problems  ?? 0;
  const attempts = s?.attempts_today   ?? 0;
  const solvedTd = s?.solved_today     ?? 0;
  const failed   = attempts - solvedTd;
  const streak   = s?.streak           ?? 0;

  const solvedRatio = total > 0 ? Math.round((solved / total) * 100) : 0;

  return (
    <div className="grid grid-cols-6 gap-4 px-6 pb-6">

      {/* Total Problems */}
      <StatCard
        label="Total Problems"
        value={s?.total_problems ?? '—'}
        icon={<BookOpen size={14} />}
        accent="border-l-indigo-600"
      />

      {/* Solved all-time — with progress bar */}
      <StatCard
        label="Solved (all-time)"
        value={s?.solved_problems ?? '—'}
        icon={<CheckCircle2 size={14} />}
        accent="border-l-green-600"
        sub={
          s != null ? (
            <div>
              <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${solvedRatio}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{solvedRatio}% of total</p>
            </div>
          ) : undefined
        }
      />

      {/* Today's Activity — col-span-2, richer breakdown */}
      <div className="col-span-2 bg-gray-900 border border-gray-800 border-l-2 border-l-sky-600 rounded-xl p-4 transition-all hover:border-gray-600">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-xs text-gray-400">Today's Activity</p>
          <span className="text-gray-600"><Zap size={14} /></span>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-white leading-none">{attempts}</p>
          <p className="text-sm text-gray-400">{attempts === 1 ? 'attempt' : 'attempts'}</p>
        </div>
        {attempts > 0 && (
          <div className="flex gap-3 mt-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
              ✓ {solvedTd} solved
            </span>
            {failed > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
                ✗ {failed} not solved
              </span>
            )}
          </div>
        )}
        {attempts === 0 && (
          <p className="text-xs text-gray-500 mt-1">No attempts yet today</p>
        )}
      </div>

      {/* Due for Review */}
      <StatCard
        label="Due for Review"
        value={s?.due_today ?? '—'}
        icon={<Clock size={14} />}
        accent="border-l-amber-500"
        sub={
          s?.due_today ? (
            <p className="text-xs text-yellow-400">needs review</p>
          ) : undefined
        }
      />

      {/* Streak */}
      <StatCard
        label="Streak"
        value={
          streak > 0 ? (
            <span className="flex items-baseline gap-1">
              🔥 <span>{streak}d</span>
            </span>
          ) : (
            s != null ? `${streak}d` : '—'
          )
        }
        icon={<Flame size={14} />}
        accent="border-l-orange-500"
        sub={
          streak > 0 ? (
            <p className="text-xs text-orange-400">keep it going</p>
          ) : undefined
        }
      />

    </div>
  );
}
