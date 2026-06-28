import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import type { RecentAttempt } from '../../lib/types';

const DIFF: Record<string, string> = {
  Easy: 'text-green-400', Medium: 'text-amber-400', Hard: 'text-red-400',
};

const RUNG: Record<number, string> = {
  1: "Rung 1 — which framework step you're stuck on",
  2: 'Rung 2 — leading question',
  3: 'Rung 3 — category of technique',
  4: 'Rung 4 — specific pattern named',
  5: 'Rung 5 — approach outlined in words',
};

function AttemptDetailDrawer({
  attempt,
  onClose,
}: {
  attempt: RecentAttempt | null;
  onClose: () => void;
}) {
  if (!attempt) return null;

  const hints = JSON.parse(attempt.hints_used || '[]') as number[];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[480px] bg-gray-900 border-l border-gray-800 overflow-y-auto p-6 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white">{attempt.title ?? attempt.slug}</h2>
              {attempt.url && (
                <a
                  href={attempt.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-500 hover:text-indigo-400 transition-colors"
                >
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {attempt.difficulty && (
                <span className={`text-xs ${DIFF[attempt.difficulty] ?? 'text-gray-500'}`}>
                  {attempt.difficulty}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Attempt details */}
        <div className="border border-gray-700 rounded-lg p-4 space-y-3">
          {/* Date + solved status */}
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">
              {new Date(attempt.date).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
              })}
            </span>
            <span className={attempt.solved ? 'text-green-400' : 'text-red-400'}>
              {attempt.solved ? '✓ Solved' : '✗ Not solved'}
              {attempt.result_type ? ` · ${attempt.result_type}` : ''}
            </span>
          </div>

          {/* Time spent */}
          {attempt.time_spent != null && (
            <div>
              <p className="text-xs text-gray-500">Time spent:</p>
              <p className="text-xs text-gray-300 mt-0.5">{attempt.time_spent} min</p>
            </div>
          )}

          {/* Hints used */}
          {hints.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">
                Hints used ({hints.length}):
              </p>
              <ul className="space-y-0.5">
                {hints.map(r => (
                  <li key={r} className="text-xs text-amber-400">
                    {RUNG[r] ?? `Rung ${r}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hints.length === 0 && (
            <p className="text-xs text-gray-500">No hints used</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RecentActivity() {
  const { data: attempts = [] } = useQuery({
    queryKey: ['recent-attempts'],
    queryFn: api.recentAttempts,
  });

  const [selected, setSelected] = useState<RecentAttempt | null>(null);

  return (
    <>
      <div className="px-6 mb-6">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
          Recent Attempts
        </h2>
        <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700/50">
          {attempts.map(a => {
            const hints = JSON.parse(a.hints_used || '[]') as number[];
            return (
              <div
                key={a.id}
                onClick={() => setSelected(a)}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/60 cursor-pointer rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${a.solved ? 'text-green-400' : 'text-red-400'}`}>
                    {a.solved ? '✓' : '✗'}
                  </span>
                  <span className="text-sm text-white">{a.title ?? a.slug}</span>
                  <span className={`text-xs ${DIFF[a.difficulty ?? ''] ?? 'text-gray-500'}`}>
                    {a.difficulty}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {hints.length > 0 && (
                    <span>{hints.length} hint{hints.length !== 1 ? 's' : ''}</span>
                  )}
                  <span>{new Date(a.date).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
          {attempts.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">
              No attempts yet. Start solving!
            </p>
          )}
        </div>
      </div>

      <AttemptDetailDrawer attempt={selected} onClose={() => setSelected(null)} />
    </>
  );
}
