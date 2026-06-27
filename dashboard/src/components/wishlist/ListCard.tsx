import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Trash2 } from 'lucide-react';
import { useListProblems, useDeleteList } from '../../hooks/useLists';
import type { ProblemList, ListProblem } from '../../lib/types';

interface Props {
  list: ProblemList;
}

export default function ListCard({ list }: Props) {
  const [open, setOpen] = useState(false);
  const { data: problems = [], isLoading } = useListProblems(open ? list.id : null);
  const deleteList = useDeleteList();

  // Group problems by each of their pattern tags.
  const byPattern: Record<string, ListProblem[]> = {};
  for (const p of problems) {
    const tags: string[] = JSON.parse(p.pattern_tags ?? '[]');
    const groups = tags.length ? tags : ['Uncategorized'];
    for (const tag of groups) {
      if (!byPattern[tag]) byPattern[tag] = [];
      if (!byPattern[tag].some(x => x.slug === p.slug)) byPattern[tag].push(p);
    }
  }

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-800/60 cursor-pointer hover:bg-gray-800 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown size={14} className="text-gray-400" />
            : <ChevronRight size={14} className="text-gray-400" />
          }
          <span className="text-white font-medium">{list.name}</span>
          <span className="text-xs text-gray-500">{list.problem_count} problems</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); deleteList.mutate(list.id); }}
          title="Delete list"
          className="text-gray-600 hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {open && (
        <div className="divide-y divide-gray-800/60">
          {isLoading && (
            <p className="px-4 py-3 text-xs text-gray-500">Loading…</p>
          )}
          {!isLoading && Object.entries(byPattern).map(([pattern, probs]) => (
            <div key={pattern} className="px-4 py-3">
              <p className="text-xs text-indigo-400 uppercase tracking-wider font-medium mb-2">
                {pattern}
              </p>
              <div className="flex flex-wrap gap-2">
                {probs.map(p => (
                  <a
                    key={p.slug}
                    href={p.url ?? `https://leetcode.com/problems/${p.slug}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded transition-colors"
                  >
                    {p.title ?? p.slug}
                    <ExternalLink size={10} className="text-gray-500" />
                  </a>
                ))}
              </div>
            </div>
          ))}
          {!isLoading && problems.length === 0 && (
            <p className="px-4 py-3 text-xs text-gray-500">No problems in this list.</p>
          )}
        </div>
      )}
    </div>
  );
}
