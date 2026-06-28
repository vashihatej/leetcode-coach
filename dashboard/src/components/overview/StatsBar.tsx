import { useStats } from '../../hooks/useStats';

function StatCard({ label, value, sub }: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

export default function StatsBar() {
  const { data: s } = useStats();

  const attempts = s?.attempts_today ?? 0;
  const solvedTd = s?.solved_today   ?? 0;
  const failed   = attempts - solvedTd;

  return (
    <div className="grid grid-cols-6 gap-4 px-6 pb-6">
      <StatCard label="Total Problems" value={s?.total_problems ?? '—'} />

      <StatCard label="Solved (all-time)" value={s?.solved_problems ?? '—'} />

      {/* Today card — shows attempts with a solved/failed breakdown */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 col-span-2">
        <p className="text-xs text-gray-400 mb-1">Today's Activity</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-white">{attempts}</p>
          <p className="text-sm text-gray-400">{attempts === 1 ? 'attempt' : 'attempts'}</p>
        </div>
        {attempts > 0 && (
          <div className="flex gap-3 mt-2">
            <span className="text-xs font-medium text-green-400">
              ✓ {solvedTd} solved
            </span>
            {failed > 0 && (
              <span className="text-xs font-medium text-red-400">
                ✗ {failed} not solved
              </span>
            )}
          </div>
        )}
        {attempts === 0 && (
          <p className="text-xs text-gray-500 mt-1">No attempts yet today</p>
        )}
      </div>

      <StatCard
        label="Due for Review"
        value={s?.due_today ?? '—'}
        sub={s?.due_today ? (
          <p className="text-xs text-yellow-400">needs review</p>
        ) : undefined}
      />

      <StatCard
        label="Streak"
        value={s != null ? `${s.streak}d` : '—'}
        sub={s?.streak ? (
          <p className="text-xs text-orange-400">🔥 keep it going</p>
        ) : undefined}
      />
    </div>
  );
}
