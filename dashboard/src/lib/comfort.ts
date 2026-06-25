import type { Problem, ComfortLevel } from './types';

export function computeComfort(problem: Pick<Problem, 'attempt_count' | 'last_solved' | 'last_hints_used' | 'ease' | 'reps'>): ComfortLevel {
  if (problem.attempt_count === 0) return 'new';
  if (!problem.last_solved) return 'shaky';

  const hints = JSON.parse(problem.last_hints_used ?? '[]') as number[];
  const ease = problem.ease ?? 2.5;
  const reps = problem.reps ?? 0;

  if (hints.length === 0 && ease >= 2.6 && reps >= 3) return 'instinct';
  if (hints.length <= 1 && ease >= 2.0 && reps >= 2) return 'solid';
  return 'learning';
}
