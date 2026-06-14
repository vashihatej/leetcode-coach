# Stage 4: Spaced Repetition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-schedule solved problems for SM-2 spaced-repetition review, grading each attempt by how independently it was solved, surfaced via `coach review-due`.

**Architecture:** A pure scheduler module (`src/sr/scheduler.js`) converts an attempt into an SM-2 quality score and computes the next interval/ease/reps/due-date — no DB, no hidden clock. The DB layer gains a `reps` column (with an idempotent migration) and three review queries. `coach log-attempt` calls the scheduler after recording an attempt; `coach review-due` lists what's due.

**Tech Stack:** Node ESM, better-sqlite3, commander, vitest. Tests run via `npm test` (vitest.config.js already sets `testTimeout: 60000` + `pool: threads` — this machine's process-spawn scanning makes runs slow but green).

**Spec:** `docs/superpowers/specs/2026-06-13-leetcode-coach-stage4-spaced-repetition-design.md`

---

## File Structure

- **Create** `src/sr/scheduler.js` — pure SM-2: `gradeAttempt`, `nextSchedule`. No imports from DB.
- **Create** `tests/sr/scheduler.test.js` — unit tests for both functions.
- **Modify** `src/db/schema.sql` — add `reps` column to `review_queue`.
- **Modify** `src/db/index.js` — run an idempotent `reps`-column migration in `openDb`.
- **Create** `tests/db.migration.test.js` — migration adds `reps` to a legacy table.
- **Modify** `src/db/queries.js` — add `getReview`, `upsertReview`, `listDueReviews`.
- **Create** `tests/queries.review.test.js` — review query tests.
- **Modify** `src/cli/commands.js` — `cmdLogAttempt` schedules; add `cmdReviewDue`.
- **Modify** `src/cli/coach.js` — register the `review-due` command.
- **Modify** `tests/commands.test.js` — extend for scheduling + `cmdReviewDue`.
- **Modify** `.claude/skills/leetcode-coaching/SKILL.md` — surface due reviews at session start.

---

## Task 1: SM-2 scheduler pure module

**Files:**
- Create: `src/sr/scheduler.js`
- Test: `tests/sr/scheduler.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/sr/scheduler.test.js`:

```js
import { describe, it, expect } from "vitest";
import { gradeAttempt, nextSchedule } from "../../src/sr/scheduler.js";

describe("gradeAttempt", () => {
  it("unsolved attempt fails with quality 2", () => {
    expect(gradeAttempt({ solved: false, hintsUsed: [], resultType: null })).toBe(2);
  });
  it("solved unaided + optimal earns quality 5", () => {
    expect(gradeAttempt({ solved: true, hintsUsed: [], resultType: "optimal" })).toBe(5);
  });
  it("solved unaided but not optimal earns quality 4", () => {
    expect(gradeAttempt({ solved: true, hintsUsed: [], resultType: "brute" })).toBe(4);
    expect(gradeAttempt({ solved: true, hintsUsed: [], resultType: null })).toBe(4);
  });
  it("solved with 1-2 hints earns quality 3", () => {
    expect(gradeAttempt({ solved: true, hintsUsed: [1], resultType: "optimal" })).toBe(3);
    expect(gradeAttempt({ solved: true, hintsUsed: [1, 2], resultType: null })).toBe(3);
  });
  it("solved with 3+ hints still passes at quality 3", () => {
    expect(gradeAttempt({ solved: true, hintsUsed: [1, 2, 3, 4], resultType: null })).toBe(3);
  });
});

describe("nextSchedule", () => {
  const today = new Date("2026-06-14T12:00:00Z");

  it("first pass schedules 1 day out and bumps reps to 1", () => {
    const r = nextSchedule({ interval: 0, ease: 2.5, reps: 0 }, 5, today);
    expect(r.interval).toBe(1);
    expect(r.reps).toBe(1);
    expect(r.dueDate).toBe("2026-06-15");
  });
  it("second pass schedules 6 days out", () => {
    const r = nextSchedule({ interval: 1, ease: 2.5, reps: 1 }, 4, today);
    expect(r.interval).toBe(6);
    expect(r.reps).toBe(2);
    expect(r.dueDate).toBe("2026-06-20");
  });
  it("third+ pass multiplies interval by ease and rounds", () => {
    const r = nextSchedule({ interval: 6, ease: 2.5, reps: 2 }, 4, today);
    expect(r.interval).toBe(15); // round(6 * 2.5)
    expect(r.reps).toBe(3);
  });
  it("a fail resets reps and interval to 1 day", () => {
    const r = nextSchedule({ interval: 30, ease: 2.5, reps: 5 }, 2, today);
    expect(r.interval).toBe(1);
    expect(r.reps).toBe(0);
    expect(r.dueDate).toBe("2026-06-15");
  });
  it("ease rises on quality 5 and falls on quality 3", () => {
    expect(nextSchedule({ interval: 1, ease: 2.5, reps: 1 }, 5, today).ease).toBeCloseTo(2.6, 5);
    expect(nextSchedule({ interval: 1, ease: 2.5, reps: 1 }, 3, today).ease).toBeCloseTo(2.36, 5);
  });
  it("ease never drops below the 1.3 floor", () => {
    const r = nextSchedule({ interval: 1, ease: 1.3, reps: 1 }, 2, today);
    expect(r.ease).toBe(1.3);
  });
  it("defaults a missing current row to a fresh card", () => {
    const r = nextSchedule(undefined, 5, today);
    expect(r.interval).toBe(1);
    expect(r.reps).toBe(1);
    expect(r.ease).toBeCloseTo(2.6, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/sr/scheduler.test.js`
Expected: FAIL — `Failed to load .../src/sr/scheduler.js` (module does not exist).

- [ ] **Step 3: Write the implementation**

Create `src/sr/scheduler.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/sr/scheduler.test.js`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sr/scheduler.js tests/sr/scheduler.test.js
git commit -m "feat(sr): SM-2 scheduler with attempt grading"
```

---

## Task 2: reps column + idempotent migration

**Files:**
- Modify: `src/db/schema.sql:37-43`
- Modify: `src/db/index.js:9-15`
- Test: `tests/db.migration.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/db.migration.test.js`:

```js
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { openDb } from "../src/db/index.js";

describe("review_queue reps migration", () => {
  it("a fresh db has the reps column with default 0", () => {
    const db = openDb(":memory:");
    const cols = db.prepare("PRAGMA table_info(review_queue)").all();
    const reps = cols.find((c) => c.name === "reps");
    expect(reps).toBeTruthy();
    expect(Number(reps.dflt_value)).toBe(0);
  });

  it("adds reps to a legacy review_queue that lacks it", () => {
    // Simulate a pre-Stage-4 db: review_queue without the reps column.
    const path = `/tmp/coach-migration-${Date.now()}.db`;
    const legacy = new Database(path);
    legacy.exec(`CREATE TABLE problems (id INTEGER PRIMARY KEY, slug TEXT);
      CREATE TABLE review_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        problem_id INTEGER UNIQUE NOT NULL,
        due_date TEXT NOT NULL,
        interval INTEGER NOT NULL DEFAULT 1,
        ease REAL NOT NULL DEFAULT 2.5
      );
      INSERT INTO problems (id, slug) VALUES (1, 'two-sum');
      INSERT INTO review_queue (problem_id, due_date) VALUES (1, '2026-06-14');`);
    legacy.close();

    const db = openDb(path); // should migrate in place
    const cols = db.prepare("PRAGMA table_info(review_queue)").all();
    expect(cols.some((c) => c.name === "reps")).toBe(true);
    const row = db.prepare("SELECT reps FROM review_queue WHERE problem_id = 1").get();
    expect(row.reps).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db.migration.test.js`
Expected: FAIL — fresh db has no `reps` column (first test fails finding it).

- [ ] **Step 3: Add the column to the schema**

In `src/db/schema.sql`, replace the `review_queue` table (lines 37-43) with:

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

- [ ] **Step 4: Add the migration to openDb**

Replace the contents of `src/db/index.js` with:

```js
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, "schema.sql"), "utf8");

function migrate(db) {
  // Pre-Stage-4 databases have review_queue without the reps column.
  const cols = db.prepare("PRAGMA table_info(review_queue)").all();
  if (!cols.some((c) => c.name === "reps")) {
    db.exec("ALTER TABLE review_queue ADD COLUMN reps INTEGER NOT NULL DEFAULT 0");
  }
}

export function openDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(schema);
  migrate(db);
  return db;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/db.migration.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.sql src/db/index.js tests/db.migration.test.js
git commit -m "feat(db): add reps column to review_queue with migration"
```

---

## Task 3: review queries

**Files:**
- Modify: `src/db/queries.js` (append new functions)
- Test: `tests/queries.review.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/queries.review.test.js`:

```js
import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/index.js";
import { upsertProblem, getReview, upsertReview, listDueReviews } from "../src/db/queries.js";

function seedProblem(db, slug) {
  return upsertProblem(db, { slug, title: slug, difficulty: "Easy" });
}

describe("review queries", () => {
  it("upsertReview inserts then updates the same row", () => {
    const db = openDb(":memory:");
    const pid = seedProblem(db, "two-sum");
    upsertReview(db, { problemId: pid, dueDate: "2026-06-20", interval: 6, ease: 2.5, reps: 2 });
    let row = getReview(db, pid);
    expect(row.interval).toBe(6);
    expect(row.reps).toBe(2);

    upsertReview(db, { problemId: pid, dueDate: "2026-07-01", interval: 15, ease: 2.6, reps: 3 });
    row = getReview(db, pid);
    expect(row.interval).toBe(15);
    expect(row.ease).toBeCloseTo(2.6, 5);
    const count = db.prepare("SELECT COUNT(*) c FROM review_queue WHERE problem_id = ?").get(pid).c;
    expect(count).toBe(1);
  });

  it("getReview returns undefined for an unscheduled problem", () => {
    const db = openDb(":memory:");
    const pid = seedProblem(db, "two-sum");
    expect(getReview(db, pid)).toBeUndefined();
  });

  it("listDueReviews returns only rows due on/before the date, ordered, with problem fields", () => {
    const db = openDb(":memory:");
    const a = seedProblem(db, "a-due-past");
    const b = seedProblem(db, "b-due-today");
    const c = seedProblem(db, "c-future");
    upsertReview(db, { problemId: a, dueDate: "2026-06-10", interval: 1, ease: 2.5, reps: 1 });
    upsertReview(db, { problemId: b, dueDate: "2026-06-14", interval: 1, ease: 2.5, reps: 1 });
    upsertReview(db, { problemId: c, dueDate: "2026-06-20", interval: 6, ease: 2.5, reps: 2 });

    const due = listDueReviews(db, "2026-06-14");
    expect(due.map((r) => r.slug)).toEqual(["a-due-past", "b-due-today"]);
    expect(due[0].title).toBe("a-due-past");
    expect(due[0].difficulty).toBe("Easy");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/queries.review.test.js`
Expected: FAIL — `getReview is not a function` (not yet exported).

- [ ] **Step 3: Add the queries**

Append to `src/db/queries.js`:

```js
export function getReview(db, problemId) {
  return db.prepare("SELECT * FROM review_queue WHERE problem_id = ?").get(problemId);
}

export function upsertReview(db, { problemId, dueDate, interval, ease, reps }) {
  db.prepare(
    `INSERT INTO review_queue (problem_id, due_date, interval, ease, reps)
     VALUES (@problemId, @dueDate, @interval, @ease, @reps)
     ON CONFLICT(problem_id) DO UPDATE SET
       due_date = excluded.due_date,
       interval = excluded.interval,
       ease = excluded.ease,
       reps = excluded.reps`
  ).run({ problemId, dueDate, interval, ease, reps });
}

export function listDueReviews(db, asOfDate) {
  return db
    .prepare(
      `SELECT r.*, p.slug, p.title, p.difficulty
       FROM review_queue r
       JOIN problems p ON p.id = r.problem_id
       WHERE r.due_date <= ?
       ORDER BY r.due_date ASC`
    )
    .all(asOfDate);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/queries.review.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/db/queries.js tests/queries.review.test.js
git commit -m "feat(db): review queue get/upsert/listDue queries"
```

---

## Task 4: CLI — schedule on log-attempt + review-due command

**Files:**
- Modify: `src/cli/commands.js`
- Modify: `src/cli/coach.js:5-10,40` (import + register command)
- Modify: `tests/commands.test.js`

- [ ] **Step 1: Write the failing tests**

Append these tests inside the `describe("cli commands", ...)` block in `tests/commands.test.js`, and add `cmdReviewDue` to the import from `../src/cli/commands.js`:

```js
  it("cmdLogAttempt schedules a review and reports the next due date", () => {
    const db = openDb(":memory:");
    upsertProblem(db, { slug: "two-sum", title: "Two Sum" });
    const out = cmdLogAttempt(db, { slug: "two-sum", solved: true, result: "optimal" });
    expect(out).toContain("next review:");
    const row = db.prepare("SELECT * FROM review_queue WHERE problem_id = 1").get();
    expect(row).toBeTruthy();
    expect(row.reps).toBe(1);
    expect(row.interval).toBe(1);
  });

  it("cmdReviewDue lists due problems and reports empty state", () => {
    const db = openDb(":memory:");
    expect(cmdReviewDue(db)).toContain("nothing due");

    const pid = upsertProblem(db, { slug: "two-sum", title: "Two Sum", difficulty: "Easy" });
    upsertReview(db, { problemId: pid, dueDate: "2000-01-01", interval: 1, ease: 2.5, reps: 1 });
    const out = cmdReviewDue(db);
    expect(out).toContain("two-sum");
    expect(out).toContain("Easy");
  });
```

Also add `upsertReview` to the imports from `../src/db/queries.js` in that test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/commands.test.js`
Expected: FAIL — `cmdReviewDue is not a function` and no `next review:` in output.

- [ ] **Step 3: Update commands.js**

In `src/cli/commands.js`, update the imports at the top to add the new query + scheduler:

```js
import {
  upsertProblem,
  insertAttempt,
  listAttempts,
  setMastery,
  listMastery,
  getReview,
  upsertReview,
  listDueReviews,
} from "../db/queries.js";
import { gradeAttempt, nextSchedule } from "../sr/scheduler.js";
import fs from "node:fs";
```

Replace `cmdLogAttempt` with a version that schedules after recording:

```js
export function cmdLogAttempt(db, args) {
  const { slug } = args;
  let problemId = problemIdBySlug(db, slug);
  if (!problemId) {
    problemId = upsertProblem(db, { slug, title: slug });
  }
  const attempt = {
    problemId,
    solved: Boolean(args.solved),
    resultType: args.result ?? null,
    hintsUsed: parseHints(args.hints),
    mistakes: args.mistakes ?? null,
    finalApproach: args.approach ?? null,
  };
  insertAttempt(db, attempt);

  const quality = gradeAttempt(attempt);
  const next = nextSchedule(getReview(db, problemId), quality, new Date());
  upsertReview(db, { problemId, ...next });

  const n = listAttempts(db, problemId).length;
  return (
    `logged attempt for ${slug} (total attempts: ${n})\n` +
    `next review: ${next.dueDate} (${next.interval} days)`
  );
}
```

Add `cmdReviewDue` at the end of the file:

```js
export function cmdReviewDue(db) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = listDueReviews(db, today);
  if (rows.length === 0) return "nothing due for review";
  return rows
    .map((r) => {
      const days = daysBetween(r.due_date, today);
      const when = days <= 0 ? "due today" : `due ${days} day${days === 1 ? "" : "s"} ago`;
      return `${r.slug} · ${r.title ?? ""} · ${r.difficulty ?? "?"} · ${when}`;
    })
    .join("\n");
}

function daysBetween(fromDate, toDate) {
  const ms = new Date(toDate + "T00:00:00Z") - new Date(fromDate + "T00:00:00Z");
  return Math.round(ms / 86400000);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/commands.test.js`
Expected: PASS (4 tests — 2 original + 2 new).

- [ ] **Step 5: Register the command in coach.js**

In `src/cli/coach.js`, add `cmdReviewDue` to the import block (lines 5-10):

```js
import {
  cmdLogAttempt,
  cmdMastery,
  cmdSetMastery,
  cmdStatus,
  cmdReviewDue,
} from "./commands.js";
```

And register the command (after the `set-mastery` command block, before `program.parse()`):

```js
program
  .command("review-due")
  .description("list problems due for spaced-repetition review")
  .action(() => console.log(cmdReviewDue(db)));
```

- [ ] **Step 6: Smoke-test the CLI end to end**

Run:

```bash
node src/cli/coach.js log-attempt --slug two-sum --solved --result optimal
node src/cli/coach.js review-due
```

Expected: the first prints `logged attempt for two-sum ...` and `next review: <date> (1 days)`; the second prints `nothing due for review` (the new review is 1 day out, not yet due). This confirms wiring against the real `coach.db`.

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands.js src/cli/coach.js tests/commands.test.js
git commit -m "feat(cli): auto-schedule reviews on log-attempt and add review-due"
```

---

## Task 5: Coaching skill — surface due reviews at session start

**Files:**
- Modify: `.claude/skills/leetcode-coaching/SKILL.md`

This task has no automated test (the skill is prose guidance for the coach). Verification is reading the edited section back.

- [ ] **Step 1: Locate the session-start section**

Run: `grep -n "session start\|session-start\|review\|log-attempt\|end of problem\|end-of-problem" .claude/skills/leetcode-coaching/SKILL.md`
Expected: prints the line numbers of the session-start load step and the end-of-problem logging step.

- [ ] **Step 2: Add the review surfacing to the session-start step**

In the session-start section (where the skill already loads memory + DB mastery), add this guidance verbatim:

```markdown
- Run `coach review-due`. If anything is listed, offer those problems as warm-ups before new
  work — they are scheduled because recall is due. Don't force them; suggest and let the user choose.
```

- [ ] **Step 3: Note scheduling as a side effect of logging**

In the end-of-problem logging section (where the skill already calls `coach log-attempt`), add this guidance verbatim:

```markdown
- Logging the attempt also schedules the next spaced-repetition review automatically (SM-2,
  graded by independence: unaided solves wait longer, hinted solves return sooner, unsolved
  resets to tomorrow). No separate command is needed — just log accurate `--solved`/`--hints`.
```

- [ ] **Step 4: Verify the edits**

Run: `grep -n "review-due\|spaced-repetition" .claude/skills/leetcode-coaching/SKILL.md`
Expected: both new blocks appear.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/leetcode-coaching/SKILL.md
git commit -m "docs(skill): surface due reviews and note auto-scheduling"
```

---

## Final verification

- [ ] Run the Stage 4 test files together in one invocation (avoids paying the per-file spawn tax repeatedly):

```bash
npx vitest run tests/sr/scheduler.test.js tests/db.migration.test.js tests/queries.review.test.js tests/commands.test.js
```

Expected: all pass (12 + 2 + 3 + 4 = 21 tests).

- [ ] Then finish the branch via superpowers:finishing-a-development-branch.
