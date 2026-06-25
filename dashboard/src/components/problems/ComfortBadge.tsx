import { computeComfort } from '../../lib/comfort';
import type { Problem, ComfortLevel } from '../../lib/types';

const LABEL: Record<ComfortLevel, string> = {
  instinct: 'Instinct', solid: 'Solid', learning: 'Learning', shaky: 'Shaky', new: 'New',
};
const COLOR: Record<ComfortLevel, string> = {
  instinct: 'bg-green-500/20 text-green-400 border-green-500/30',
  solid: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  learning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  shaky: 'bg-red-500/20 text-red-400 border-red-500/30',
  new: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function ComfortBadge({
  problem,
}: {
  problem: Pick<Problem, 'attempt_count' | 'last_solved' | 'last_hints_used' | 'ease' | 'reps'>;
}) {
  const level = computeComfort(problem);
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${COLOR[level]}`}>
      {LABEL[level]}
    </span>
  );
}
