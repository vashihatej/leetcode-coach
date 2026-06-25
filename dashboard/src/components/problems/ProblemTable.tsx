import { useState, useMemo } from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import { useProblems } from '../../hooks/useProblems';
import { useAddWishlist } from '../../hooks/useWishlist';
import type { Problem } from '../../lib/types';
import ComfortBadge from './ComfortBadge';
import AttemptDrawer from './AttemptDrawer';

const DIFF: Record<string, string> = {
  Easy: 'text-green-400', Medium: 'text-amber-400', Hard: 'text-red-400',
};

export default function ProblemTable() {
  const { data: problems = [], isLoading } = useProblems();
  const addWishlist = useAddWishlist();
  const [selected, setSelected] = useState<Problem | null>(null);
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState('');

  const filtered = useMemo(() =>
    problems.filter(p => {
      const name = (p.title ?? p.slug).toLowerCase();
      return (
        (!search || name.includes(search.toLowerCase())) &&
        (!diffFilter || p.difficulty === diffFilter)
      );
    }),
    [problems, search, diffFilter]
  );

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading problems…</div>;

  return (
    <>
      <div className="p-6">
        <div className="flex gap-3 mb-5">
          <input
            type="text"
            placeholder="Search problems…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <select
            value={diffFilter}
            onChange={e => setDiffFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">All</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/60">
              <tr className="border-b border-gray-700 text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Problem</th>
                <th className="px-4 py-3 font-medium">Difficulty</th>
                <th className="px-4 py-3 font-medium">Comfort</th>
                <th className="px-4 py-3 font-medium">Attempts</th>
                <th className="px-4 py-3 font-medium">Next Review</th>
                <th className="px-4 py-3 font-medium">Patterns</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map(p => {
                const tags = JSON.parse(p.patterns ?? '[]') as string[];
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="hover:bg-gray-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white">{p.title ?? p.slug}</span>
                        {p.url && (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-gray-500 hover:text-indigo-400 transition-colors"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${DIFF[p.difficulty ?? ''] ?? 'text-gray-400'}`}>
                        {p.difficulty ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ComfortBadge problem={p} />
                    </td>
                    <td className="px-4 py-3 text-gray-400">{p.attempt_count}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{p.due_date ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 3).map(t => (
                          <span
                            key={t}
                            className="text-xs bg-indigo-900/30 text-indigo-400 px-1.5 py-0.5 rounded"
                          >
                            {t}
                          </span>
                        ))}
                        {tags.length > 3 && (
                          <span className="text-xs text-gray-500">+{tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        title="Add to wishlist"
                        onClick={e => {
                          e.stopPropagation();
                          addWishlist.mutate({
                            slug: p.slug,
                            title: p.title ?? undefined,
                            difficulty: p.difficulty ?? undefined,
                            url: p.url ?? undefined,
                          });
                        }}
                        className="text-gray-600 hover:text-indigo-400 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-10">No problems match your filters.</p>
          )}
        </div>
      </div>
      <AttemptDrawer problem={selected} onClose={() => setSelected(null)} />
    </>
  );
}
