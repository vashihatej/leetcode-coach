// Pure SM-2 scheduling. No DB, no hidden clock — the reference date is passed in
// so scheduling is deterministic and unit-testable.

export function gradeAttempt({ solved, hintsUsed = [], resultType = null }) {
  if (!solved) return 2;
  const hints = Array.isArray(hintsUsed) ? hintsUsed.length : 0;
  if (hints === 0) return resultType === "optimal" ? 5 : 4;
  return 3;
}

const EASE_FLOOR = 1.3;
const DEFAULT_EASE = 2.5;

export function nextSchedule(current, quality, today = new Date()) {
  const prevInterval = current?.interval ?? 0;
  const prevEase = current?.ease ?? DEFAULT_EASE;
  const prevReps = current?.reps ?? 0;

  let reps;
  let interval;
  if (quality < 3) {
    reps = 0;
    interval = 1;
  } else {
    if (prevReps === 0) interval = 1;
    else if (prevReps === 1) interval = 6;
    else interval = Math.round(prevInterval * prevEase);
    reps = prevReps + 1;
  }

  let ease = prevEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease < EASE_FLOOR) ease = EASE_FLOOR;

  const base = new Date(today); // clones a Date or parses an ISO string
  base.setDate(base.getDate() + interval);
  const dueDate = base.toISOString().slice(0, 10);

  return { interval, ease, reps, dueDate };
}
