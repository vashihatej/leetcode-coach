# LeetCode Coach — Stage 4: Spaced Repetition Design

**Date:** 2026-06-13
**Status:** Approved
**Parent spec:** `docs/superpowers/specs/2026-06-12-leetcode-coach-design.md`

## Goal

Auto-schedule solved problems for spaced-repetition review using the SM-2 algorithm,
grading each attempt by how *independently* it was solved, and surface what is due via a
`coach review-due` command. This directly serves the project's core goal: independent recall
earns long intervals, while hint-assisted solves resurface quickly.

## Decisions (locked during brainstorming)

1. **Auto-grade from attempts.** Every logged attempt derives an SM-2 grade and
   schedules/reschedules the next review. No separate manual review command.
2. **Hints lower the grade.** Solved unaided earns a high grade (long interval); solved with
   hints passes but with a reduced grade (short interval); unsolved fails (resets).
3. **SM-2 (Anki-style)** with a `reps` counter column added to `review_queue` via migration.

## Grading: attempt → SM-2 quality (0–5)

A pure function maps the signals the coach already logs (`solved`, `hintsUsed`, `resultType`)
to an SM-2 quality score:

| Attempt outcome                  | Quality | Effect                       |
|----------------------------------|---------|------------------------------|
| Not solved                       | 2 (fail)| reps→0, interval→1 day       |
| Solved, no hints, optimal        | 5       | longest interval growth      |
| Solved, no hints (not optimal)   | 4       | normal growth                |
| Solved, 1–2 hint rungs           | 3       | passes; ease drops → soon    |
| Solved, 3+ hint rungs            | 3       | passes; leaned hard → soon   |

Notes:
- `hintsUsed` is the array of hint-ladder rung numbers recorded on the attempt; its `.length`
  determines the 1–2 vs 3+ bucket.
- `resultType === "optimal"` with no hints is the only path to quality 5. A missing/`brute`
  `resultType` with no hints yields quality 4.
- Quality 3 is the floor for a "pass." Any solved-with-hints attempt passes (interval grows
  minimally) rather than resetting — matching the decision that hinted solves "come back soon,"
  not "start over."

## SM-2 Scheduler — pure module `src/sr/scheduler.js`

Two pure functions, no DB and no hidden clock (the reference date is passed in), so both are
fully unit-testable.

### `gradeAttempt(attempt) → quality`

Implements the table above. Input is the attempt-shaped object
`{ solved, hintsUsed, resultType }`. Returns an integer 0–5 (in practice 2–5).

### `nextSchedule(current, quality, today) → { interval, ease, reps, dueDate }`

- `current` is `{ interval, ease, reps }` from the existing review row, or defaults
  `{ interval: 0, ease: 2.5, reps: 0 }` for a problem not yet in the queue.
- `today` is a `Date` (or ISO date string); the function derives `dueDate` from it.

Algorithm:
- **Fail (`quality < 3`):** `reps = 0`, `interval = 1`.
- **Pass (`quality >= 3`):**
  - `reps === 0` → `interval = 1`
  - `reps === 1` → `interval = 6`
  - `reps >= 2` → `interval = round(interval * ease)`
  - then `reps = reps + 1`
- **Ease update (always):**
  `ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))`, then clamp to a
  minimum of **1.3**.
- **Due date:** `dueDate = today + interval days`, formatted as a date-only ISO string
  (`YYYY-MM-DD`).

## Schema + DB

### Schema change (`src/db/schema.sql`)

Add a repetition counter to `review_queue`:

```sql
CREATE TABLE IF NOT EXISTS review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER UNIQUE NOT NULL REFERENCES problems(id),
  due_date TEXT NOT NULL,
  interval INTEGER NOT NULL DEFAULT 1,
  ease REAL NOT NULL DEFAULT 2.5,
  reps INTEGER NOT NULL DEFAULT 0
);
```

### Migration

Because an existing `coach.db` predates the `reps` column, `openDb` runs an idempotent
migration after applying `schema.sql`: check `PRAGMA table_info(review_queue)` for a `reps`
column and, if absent, run `ALTER TABLE review_queue ADD COLUMN reps INTEGER NOT NULL DEFAULT 0`.
Safe to run on every open; does nothing once the column exists.

### New queries (`src/db/queries.js`)

- `getReview(db, problemId) → row | undefined` — current review row for a problem.
- `upsertReview(db, { problemId, dueDate, interval, ease, reps })` — insert or update the
  `review_queue` row (ON CONFLICT on the unique `problem_id`).
- `listDueReviews(db, asOfDate) → rows` — reviews with `due_date <= asOfDate`, joined to
  `problems` for `slug`, `title`, `difficulty`, ordered by `due_date` ascending.

## CLI integration

### `cmdLogAttempt` (modify, `src/cli/commands.js`)

After inserting the attempt:
1. `quality = gradeAttempt(attempt)`
2. `current = getReview(db, problemId)` (or defaults if none)
3. `next = nextSchedule(current, quality, new Date())`
4. `upsertReview(db, { problemId, ...next })`
5. Append to the command's output: `next review: <dueDate> (<interval> days)`

### `cmdReviewDue` (new, `src/cli/commands.js`) + `review-due` command (`src/cli/coach.js`)

Lists problems due today or earlier. For each: `slug · title · difficulty · due <N> days ago`
(or `due today`). When nothing is due, returns `nothing due for review`.

## Coaching skill integration

A small edit to `.claude/skills/leetcode-coaching/SKILL.md`:
- **Session start:** run `coach review-due` and surface due problems to the user as suggested
  warm-ups before new work.
- **End of problem:** the existing `coach log-attempt` step now schedules the review
  automatically — no new step, just a note that scheduling is a side effect of logging.

## Testing

- `tests/sr/scheduler.test.js` — `gradeAttempt` for each outcome row; `nextSchedule` for fail
  reset, the 1d → 6d → `round(interval × ease)` progression, ease increase/decrease, ease floor
  at 1.3, and correct `dueDate` arithmetic for a fixed reference date.
- `tests/queries.review.test.js` — `upsertReview` insert then update, `getReview`,
  `listDueReviews` date filtering and ordering, and that the migration adds `reps` to a
  pre-existing review_queue without it.
- `tests/commands.test.js` (extend) — `cmdReviewDue` formatting (due list and empty case);
  `cmdLogAttempt` now creates/updates a review row and reports the next due date.

## Scope

### In scope (Stage 4)
- SM-2 scheduler pure module (grade + schedule).
- `reps` column + idempotent migration.
- Review queries (get/upsert/listDue).
- `coach review-due` command; auto-scheduling on `log-attempt`.
- Coaching skill session-start review surfacing.

### Out of scope (v2+)
- Verdict-driven auto-logging of attempts — attempts stay coach-logged so the qualitative
  fields (`hintsUsed`, `mistakes`, `finalApproach`) remain accurate.
- Review reminders / notifications / a dedicated review session mode.
- Per-pattern review scheduling (reviews are per-problem).
