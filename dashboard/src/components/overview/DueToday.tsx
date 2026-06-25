import { useReview } from '../../hooks/useReview';

const DIFF: Record<string, string> = {
  Easy: 'text-green-400', Medium: 'text-amber-400', Hard: 'text-red-400',
};

export default function DueToday() {
  const { data: reviews = [] } = useReview();
  const today = new Date().toISOString().slice(0, 10);
  const due = reviews.filter(r => r.due_date <= today);

  if (due.length === 0) {
    return (
      <div className="mx-6 mb-6 bg-green-900/20 border border-green-800/50 rounded-lg p-3">
        <p className="text-green-400 text-sm">✓ Nothing due — you're caught up.</p>
      </div>
    );
  }

  return (
    <div className="px-6 mb-6">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        Due for Review ({due.length})
      </h2>
      <div className="space-y-2">
        {due.map(r => {
          const days = Math.round(
            (new Date(today).getTime() - new Date(r.due_date).getTime()) / 86400000
          );
          return (
            <div
              key={r.id}
              className="flex justify-between items-center bg-red-900/10 border border-red-900/30 rounded-lg px-4 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs ${DIFF[r.difficulty ?? ''] ?? 'text-gray-400'}`}>
                  {r.difficulty}
                </span>
                <span className="text-sm text-white">{r.title ?? r.slug}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-red-400">
                  {days === 0 ? 'due today' : `${days}d overdue`}
                </span>
                <a
                  href={r.url ?? `https://leetcode.com/problems/${r.slug}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  → LeetCode
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
