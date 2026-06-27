import { useQuery } from '@tanstack/react-query';
import { X, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import type { Problem } from '../../lib/types';

const RUNG: Record<number, string> = {
  1: "Rung 1 — which framework step you're stuck on",
  2: 'Rung 2 — leading question',
  3: 'Rung 3 — category of technique',
  4: 'Rung 4 — specific pattern named',
  5: 'Rung 5 — approach outlined in words',
};

export default function AttemptDrawer({
  problem,
  onClose,
}: {
  problem: Problem | null;
  onClose: () => void;
}) {
  const { data: attempts = [] } = useQuery({
    queryKey: ['attempts', problem?.slug],
    queryFn: () => api.attempts(problem!.slug),
    enabled: !!problem,
  });

  if (!problem) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[480px] bg-gray-900 border-l border-gray-800 overflow-y-auto p-6 shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white">{problem.title ?? problem.slug}</h2>
              {problem.url && (
                <a href={problem.url} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-indigo-400">
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {attempts.length} attempt{attempts.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {attempts.map(a => {
            const hints = JSON.parse(a.hints_used || '[]') as number[];
            return (
              <div key={a.id} className="border border-gray-700 rounded-lg p-4 space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">
                    {new Date(a.date).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </span>
                  <span className={a.solved ? 'text-green-400' : 'text-red-400'}>
                    {a.solved ? '✓ Solved' : '✗ Failed'}
                    {a.result_type ? ` · ${a.result_type}` : ''}
                  </span>
                </div>
                {hints.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Hints used:</p>
                    <ul className="space-y-0.5">
                      {hints.map(r => (
                        <li key={r} className="text-xs text-amber-400">
                          {RUNG[r] ?? `Rung ${r}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {a.mistakes && (
                  <div>
                    <p className="text-xs text-gray-500">Mistakes:</p>
                    <p className="text-xs text-gray-300 mt-0.5">{a.mistakes}</p>
                  </div>
                )}
                {a.final_approach && (
                  <div>
                    <p className="text-xs text-gray-500">Approach:</p>
                    <p className="text-xs text-gray-300 mt-0.5">{a.final_approach}</p>
                  </div>
                )}
                {a.aha_moments && (
                  <div>
                    <p className="text-xs text-gray-500">Aha moments:</p>
                    <p className="text-xs text-emerald-300 mt-0.5">{a.aha_moments}</p>
                  </div>
                )}
                {a.confusion_points && (
                  <div>
                    <p className="text-xs text-gray-500">Where I struggled:</p>
                    <p className="text-xs text-orange-300 mt-0.5">{a.confusion_points}</p>
                  </div>
                )}
                {a.analogy_liked && (
                  <div>
                    <p className="text-xs text-gray-500">Analogy that clicked:</p>
                    <p className="text-xs text-sky-300 mt-0.5 italic">{a.analogy_liked}</p>
                  </div>
                )}
                {a.viz_path && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Visualization:</p>
                    <a
                      href={`http://localhost:8765/${a.viz_path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                    >
                      {a.viz_path.split('/').pop()}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
          {attempts.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-10">No attempts logged yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
