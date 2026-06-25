import { ExternalLink } from 'lucide-react';
import { usePatternProblems } from '../../hooks/usePatterns';
import ComfortBadge from '../problems/ComfortBadge';

const DIFF: Record<string, string> = {
  Easy: 'text-green-400',
  Medium: 'text-amber-400',
  Hard: 'text-red-400',
};

export default function PatternProblems({ patternName }: { patternName: string }) {
  const { data: problems = [], isLoading } = usePatternProblems(patternName);

  if (isLoading) {
    return <p className="text-xs text-gray-500 px-5 pb-4">Loading…</p>;
  }

  if (problems.length === 0) {
    return <p className="text-xs text-gray-500 px-5 pb-4">No problems yet.</p>;
  }

  return (
    <div className="border-t border-gray-700 mt-4 pt-3 space-y-2">
      {problems.map(p => (
        <div key={p.id} className="flex items-center gap-3 px-1 py-1">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm text-white truncate">{p.title ?? p.slug}</span>
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-gray-500 hover:text-indigo-400 flex-shrink-0"
              >
                <ExternalLink size={11} />
              </a>
            )}
          </div>
          <span className={`text-xs ${DIFF[p.difficulty ?? ''] ?? 'text-gray-400'} flex-shrink-0`}>
            {p.difficulty ?? '—'}
          </span>
          <ComfortBadge problem={p} />
        </div>
      ))}
    </div>
  );
}
