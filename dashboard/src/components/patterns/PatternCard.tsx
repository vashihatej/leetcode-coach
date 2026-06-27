import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import type { Pattern } from '../../lib/types';

const MASTERY_COLOR: Record<string, string> = {
  'not_started': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  'not started': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  shaky: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  solid: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

const MASTERY_LABEL: Record<string, string> = {
  not_started: 'not started',
  'not started': 'not started',
  shaky: 'shaky',
  solid: 'solid',
};

export default function PatternCard({
  pattern,
  isExpanded,
  onToggle,
  onOpenWiki,
}: {
  pattern: Pattern;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenWiki: () => void;
}) {
  const masteryKey = pattern.mastery ?? 'not_started';
  const instPct = Math.round((pattern.instinct_rate ?? 0) * 100);

  return (
    <div
      className="bg-gray-800 border border-gray-700 rounded-xl p-5 cursor-pointer hover:border-indigo-500/50 transition-colors"
      onClick={onToggle}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-white truncate">{pattern.name}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${MASTERY_COLOR[masteryKey] ?? MASTERY_COLOR['not_started']}`}
            >
              {MASTERY_LABEL[masteryKey] ?? masteryKey}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>{pattern.problem_count} problem{pattern.problem_count !== 1 ? 's' : ''}</span>
            <span>{instPct}% instinct</span>
            {pattern.last_practiced && (
              <span>
                Last:{' '}
                {new Date(pattern.last_practiced).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </div>
          {/* instinct rate bar */}
          <div className="mt-3 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${instPct}%` }}
            />
          </div>
        </div>
        <div className="ml-3 flex items-center gap-2 flex-shrink-0">
          <button
            title="Pattern wiki"
            onClick={e => { e.stopPropagation(); onOpenWiki(); }}
            className="text-gray-500 hover:text-indigo-400 transition-colors"
          >
            <BookOpen size={15} />
          </button>
          <span className="text-gray-400">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        </div>
      </div>
    </div>
  );
}
