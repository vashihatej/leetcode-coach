import { useState, useMemo } from 'react';
import { ExternalLink, Plus, Play, X } from 'lucide-react';
import { useProblems } from '../../hooks/useProblems';
import { useAddWishlist } from '../../hooks/useWishlist';
import { computeComfort } from '../../lib/comfort';
import type { Problem, ComfortLevel } from '../../lib/types';
import ComfortBadge from './ComfortBadge';
import AttemptDrawer from './AttemptDrawer';
import MultiSelectDropdown from './MultiSelectDropdown';

const DIFF_COLOR: Record<string, string> = {
  Easy: 'text-green-400', Medium: 'text-amber-400', Hard: 'text-red-400',
};

const COMFORT_LEVELS: ComfortLevel[] = ['instinct', 'solid', 'learning', 'shaky', 'new'];
const COMFORT_ACTIVE = 'bg-indigo-900/40 border border-indigo-700 text-indigo-300';
const COMFORT_IDLE = 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600';

export default function ProblemTable() {
  const { data: problems = [], isLoading } = useProblems();
  const addWishlist = useAddWishlist();
  const [selected, setSelected] = useState<Problem | null>(null);
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<string[]>([]);
  const [patternFilter, setPatternFilter] = useState<string[]>([]);
  const [comfortFilter, setComfortFilter] = useState<string[]>([]);

  const allPatterns = useMemo(() => {
    const set = new Set<string>();
    for (const p of problems) {
      const tags: string[] = JSON.parse(p.patterns ?? '[]');
      tags.forEach(t => set.add(t));
    }
    return [...set].sort();
  }, [problems]);

  const filtered = useMemo(() =>
    problems.filter(p => {
      const name = (p.title ?? p.slug).toLowerCase();
      const tags: string[] = JSON.parse(p.patterns ?? '[]');
      const comfort = computeComfort(p);
      return (
        (!search || name.includes(search.toLowerCase())) &&
        (!diffFilter.length || diffFilter.includes(p.difficulty ?? '')) &&
        (!patternFilter.length || tags.some(t => patternFilter.includes(t))) &&
        (!comfortFilter.length || comfortFilter.includes(comfort))
      );
    }),
    [problems, search, diffFilter, patternFilter, comfortFilter]
  );

  const hasFilters = diffFilter.length > 0 || patternFilter.length > 0 || comfortFilter.length > 0;

  function clearAll() {
    setDiffFilter([]);
    setPatternFilter([]);
    setComfortFilter([]);
  }

  function removeChip(type: 'diff' | 'pattern' | 'comfort', value: string) {
    if (type === 'diff') setDiffFilter(f => f.filter(x => x !== value));
    if (type === 'pattern') setPatternFilter(f => f.filter(x => x !== value));
    if (type === 'comfort') setComfortFilter(f => f.filter(x => x !== value));
  }

  const activeChips = [
    ...diffFilter.map(v => ({ label: v, type: 'diff' as const })),
    ...patternFilter.map(v => ({ label: v, type: 'pattern' as const })),
    ...comfortFilter.map(v => ({ label: v, type: 'comfort' as const })),
  ];

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading problems…</div>;

  return (
    <>
      <div className="p-6">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            type="text"
            placeholder="Search problems…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-40 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <MultiSelectDropdown
            label="Difficulty"
            options={['Easy', 'Medium', 'Hard']}
            selected={diffFilter}
            onChange={setDiffFilter}
          />
          <MultiSelectDropdown
            label="Patterns"
            options={allPatterns}
            selected={patternFilter}
            onChange={setPatternFilter}
          />
          {hasFilters && (
            <button
              onClick={clearAll}
              className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Comfort chip row */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-500 shrink-0">Comfort:</span>
          {COMFORT_LEVELS.map(level => (
            <button
              key={level}
              onClick={() =>
                setComfortFilter(f =>
                  f.includes(level) ? f.filter(x => x !== level) : [...f, level]
                )
              }
              className={`px-2.5 py-1 text-xs rounded-full capitalize transition-colors ${
                comfortFilter.includes(level) ? COMFORT_ACTIVE : COMFORT_IDLE
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {activeChips.map(({ label, type }) => (
              <span
                key={`${type}-${label}`}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-full"
              >
                {label}
                <button
                  onClick={() => removeChip(type, label)}
                  className="text-gray-500 hover:text-white"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Table */}
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
                const tags: string[] = JSON.parse(p.patterns ?? '[]');
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
                      <span className={`text-xs ${DIFF_COLOR[p.difficulty ?? ''] ?? 'text-gray-400'}`}>
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
                      <div className="flex items-center gap-2">
                        {p.last_viz_path && (
                          <a
                            href={`http://localhost:8765/${p.last_viz_path}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Open visualization"
                            onClick={e => e.stopPropagation()}
                            className="text-indigo-500 hover:text-indigo-300 transition-colors"
                          >
                            <Play size={13} />
                          </a>
                        )}
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
                      </div>
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
