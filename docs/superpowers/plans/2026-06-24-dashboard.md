# Stage 6: LeetCode Coach Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local React dashboard served at `localhost:8765/dashboard` that surfaces all `coach.db` data in five interactive views: Overview, Problems, Patterns, Review Queue, and Wishlist.

**Architecture:** A separate `dashboard/` package (React 18 + Vite 5 + TypeScript) proxies `/api/*` to the existing Express server at port 8765 during development. New GET/POST/PATCH/DELETE routes in a new `src/server/api.js` Express Router read from new query functions in `src/db/queries.js`. Built output goes to `public/dashboard/` and is served by the existing `express.static` middleware plus an SPA fallback route.

**Tech Stack:** Node ESM + Express + better-sqlite3 (server); React 18 + TypeScript + Vite 5 + Tailwind CSS 3 + TanStack Query v5 + React Router v6 + Recharts 2 + lucide-react (dashboard)

## Global Constraints

- Server code uses Node ESM (`import`/`export`, `"type": "module"`)
- No bundler on server side; `dashboard/` has its own isolated `package.json` and Vite build
- All existing routes (`/event`, `/health`, `/viz/*`) must remain unchanged
- SQLite: use `better-sqlite3` synchronous API (`.prepare().run()`, `.prepare().get()`, `.prepare().all()`)
- All new DB query functions exported from `src/db/queries.js`
- Vite `base`: `/dashboard/`; build `outDir`: `../public/dashboard` (relative to `dashboard/`)
- Dark theme only; Tailwind `dark` class on `<html>`; no CDN deps in production build
- Run existing tests after every server-side task: `npm test`

---

## File Map

**Modified (server):**
- `src/db/schema.sql` — add `wishlist` table
- `src/db/queries.js` — add 12 new exported functions
- `src/server/app.js` — import and mount `/api` router; add SPA fallback for `/dashboard`

**New (server):**
- `src/server/api.js` — Express Router with 11 routes
- `tests/queries.wishlist.test.js`
- `tests/queries.dashboard.test.js`
- `tests/server.api.test.js`

**New (dashboard package):**
- `dashboard/package.json`
- `dashboard/vite.config.ts`
- `dashboard/tsconfig.json`
- `dashboard/tailwind.config.js`
- `dashboard/postcss.config.js`
- `dashboard/index.html`
- `dashboard/src/index.css`
- `dashboard/src/main.tsx`
- `dashboard/src/App.tsx`
- `dashboard/src/lib/types.ts`
- `dashboard/src/lib/api.ts`
- `dashboard/src/lib/comfort.ts`
- `dashboard/src/hooks/useStats.ts`
- `dashboard/src/hooks/useProblems.ts`
- `dashboard/src/hooks/usePatterns.ts`
- `dashboard/src/hooks/useReview.ts`
- `dashboard/src/hooks/useActivity.ts`
- `dashboard/src/hooks/useWishlist.ts`
- `dashboard/src/components/layout/Sidebar.tsx`
- `dashboard/src/components/overview/StatsBar.tsx`
- `dashboard/src/components/overview/ActivityHeatmap.tsx`
- `dashboard/src/components/overview/DueToday.tsx`
- `dashboard/src/components/overview/RecentActivity.tsx`
- `dashboard/src/components/problems/ComfortBadge.tsx`
- `dashboard/src/components/problems/AttemptDrawer.tsx`
- `dashboard/src/components/problems/ProblemTable.tsx`
- `dashboard/src/components/patterns/PatternCard.tsx`
- `dashboard/src/components/patterns/PatternProblems.tsx`
- `dashboard/src/components/patterns/PatternGrid.tsx`
- `dashboard/src/components/review/ReviewCard.tsx`
- `dashboard/src/components/wishlist/AddByUrl.tsx`
- `dashboard/src/components/wishlist/WishlistCard.tsx`
- `dashboard/src/components/wishlist/WishlistGrid.tsx`
- `dashboard/src/pages/Overview.tsx`
- `dashboard/src/pages/Problems.tsx`
- `dashboard/src/pages/Patterns.tsx`
- `dashboard/src/pages/Review.tsx`
- `dashboard/src/pages/Wishlist.tsx`

---

## Task 1: Add `wishlist` table to schema

**Files:**
- Modify: `src/db/schema.sql`

**Interfaces:**
- Produces: `wishlist` table with columns `id`, `slug`, `title`, `difficulty`, `url`, `notes`, `added_at`

- [ ] **Step 1: Add wishlist table to schema.sql**

Append to the end of `src/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT,
  difficulty TEXT,
  url TEXT,
  notes TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
npm test
```

Expected: all existing tests pass (the `CREATE TABLE IF NOT EXISTS` is idempotent on existing DBs).

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.sql
git commit -m "feat(db): add wishlist table to schema"
```

---

## Task 2: Wishlist DB queries + tests

**Files:**
- Modify: `src/db/queries.js`
- Create: `tests/queries.wishlist.test.js`

**Interfaces:**
- Produces:
  - `addToWishlist(db, { slug, title?, difficulty?, url? }) → void`
  - `listWishlist(db) → WishlistRow[]` — each row has wishlist columns + `prob_difficulty` (joined from `problems`)
  - `updateWishlistNotes(db, slug, notes) → void`
  - `removeFromWishlist(db, slug) → void`

- [ ] **Step 1: Write the failing tests**

Create `tests/queries.wishlist.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import {
  addToWishlist,
  listWishlist,
  updateWishlistNotes,
  removeFromWishlist,
} from '../src/db/queries.js';

function openMemoryDb() {
  const db = new Database(':memory:');
  db.exec(readFileSync('src/db/schema.sql', 'utf8'));
  return db;
}

describe('wishlist queries', () => {
  let db;
  beforeEach(() => { db = openMemoryDb(); });

  it('adds a problem to the wishlist', () => {
    addToWishlist(db, { slug: 'two-sum', url: 'https://leetcode.com/problems/two-sum/' });
    const rows = listWishlist(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe('two-sum');
    expect(rows[0].url).toBe('https://leetcode.com/problems/two-sum/');
  });

  it('ignores duplicate slugs silently', () => {
    addToWishlist(db, { slug: 'two-sum' });
    addToWishlist(db, { slug: 'two-sum' });
    expect(listWishlist(db)).toHaveLength(1);
  });

  it('updates notes on an existing wishlist entry', () => {
    addToWishlist(db, { slug: 'two-sum' });
    updateWishlistNotes(db, 'two-sum', 'practice hash map pattern');
    const rows = listWishlist(db);
    expect(rows[0].notes).toBe('practice hash map pattern');
  });

  it('removes a problem from the wishlist', () => {
    addToWishlist(db, { slug: 'two-sum' });
    removeFromWishlist(db, 'two-sum');
    expect(listWishlist(db)).toHaveLength(0);
  });

  it('listWishlist joins prob_difficulty from problems table when slug exists', () => {
    db.prepare(
      "INSERT INTO problems (slug, title, difficulty) VALUES ('two-sum', 'Two Sum', 'Easy')"
    ).run();
    addToWishlist(db, { slug: 'two-sum' });
    const rows = listWishlist(db);
    expect(rows[0].prob_difficulty).toBe('Easy');
  });

  it('listWishlist returns prob_difficulty null when problem not in problems table', () => {
    addToWishlist(db, { slug: 'unknown-problem' });
    const rows = listWishlist(db);
    expect(rows[0].prob_difficulty).toBeNull();
  });

  it('listWishlist orders by added_at descending', () => {
    addToWishlist(db, { slug: 'two-sum' });
    addToWishlist(db, { slug: 'three-sum' });
    const rows = listWishlist(db);
    expect(rows[0].slug).toBe('three-sum');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/queries.wishlist.test.js
```

Expected: FAIL — `addToWishlist is not a function`

- [ ] **Step 3: Implement wishlist query functions**

Append to `src/db/queries.js`:

```javascript
export function addToWishlist(db, { slug, title = null, difficulty = null, url = null }) {
  db.prepare(
    `INSERT INTO wishlist (slug, title, difficulty, url)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(slug) DO NOTHING`
  ).run(slug, title, difficulty, url);
}

export function listWishlist(db) {
  return db.prepare(
    `SELECT w.*, p.difficulty as prob_difficulty
     FROM wishlist w
     LEFT JOIN problems p ON p.slug = w.slug
     ORDER BY w.added_at DESC`
  ).all();
}

export function updateWishlistNotes(db, slug, notes) {
  db.prepare('UPDATE wishlist SET notes = ? WHERE slug = ?').run(notes, slug);
}

export function removeFromWishlist(db, slug) {
  db.prepare('DELETE FROM wishlist WHERE slug = ?').run(slug);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/queries.wishlist.test.js
```

Expected: all 7 tests PASS

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/db/queries.js tests/queries.wishlist.test.js
git commit -m "feat(db): add wishlist query functions"
```

---

## Task 3: Dashboard DB queries + tests

**Files:**
- Modify: `src/db/queries.js`
- Create: `tests/queries.dashboard.test.js`

**Interfaces:**
- Produces:
  - `getStats(db) → { total_problems, solved_problems, due_today, pattern_count, streak }`
  - `listProblemsWithSummary(db) → ProblemSummaryRow[]`
  - `listAttemptsForProblem(db, slug) → AttemptRow[]`
  - `listPatternsWithStats(db) → PatternStatsRow[]`
  - `listProblemsByPattern(db, name) → ProblemSummaryRow[]`
  - `listDueReviewsFull(db, today, windowDays = 7) → ReviewRow[]`
  - `getActivityData(db, since) → { date: string, count: number }[]`
  - `listRecentAttempts(db, limit = 10) → RecentAttemptRow[]`

- [ ] **Step 1: Write the failing tests**

Create `tests/queries.dashboard.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import {
  getStats,
  listProblemsWithSummary,
  listAttemptsForProblem,
  listPatternsWithStats,
  listDueReviewsFull,
  getActivityData,
  listRecentAttempts,
  upsertProblem,
  insertAttempt,
  ensurePattern,
  recordPatternOutcome,
} from '../src/db/queries.js';

function openMemoryDb() {
  const db = new Database(':memory:');
  db.exec(readFileSync('src/db/schema.sql', 'utf8'));
  return db;
}

describe('getStats', () => {
  let db;
  beforeEach(() => { db = openMemoryDb(); });

  it('returns zeros on empty db', () => {
    const s = getStats(db);
    expect(s.total_problems).toBe(0);
    expect(s.solved_problems).toBe(0);
    expect(s.due_today).toBe(0);
    expect(s.pattern_count).toBe(0);
    expect(s.streak).toBe(0);
  });

  it('counts total problems', () => {
    upsertProblem(db, { slug: 'two-sum' });
    upsertProblem(db, { slug: 'three-sum' });
    expect(getStats(db).total_problems).toBe(2);
  });

  it('counts solved problems as distinct problem_ids', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    insertAttempt(db, { problemId: pid, solved: true });
    insertAttempt(db, { problemId: pid, solved: true });
    expect(getStats(db).solved_problems).toBe(1);
  });

  it('does not count unsolved attempts toward solved_problems', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    insertAttempt(db, { problemId: pid, solved: false });
    expect(getStats(db).solved_problems).toBe(0);
  });

  it('computes streak of 2 consecutive days', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 1)').run(pid, today + 'T12:00:00.000Z');
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 1)').run(pid, yesterday + 'T12:00:00.000Z');
    expect(getStats(db).streak).toBe(2);
  });

  it('streak stops at first gap', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    const today = new Date().toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 1)').run(pid, today + 'T12:00:00.000Z');
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 1)').run(pid, twoDaysAgo + 'T12:00:00.000Z');
    expect(getStats(db).streak).toBe(1);
  });

  it('streak is 0 when no attempts today or yesterday', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 1)').run(pid, twoDaysAgo + 'T12:00:00.000Z');
    expect(getStats(db).streak).toBe(0);
  });
});

describe('listProblemsWithSummary', () => {
  let db;
  beforeEach(() => { db = openMemoryDb(); });

  it('returns empty array when no problems', () => {
    expect(listProblemsWithSummary(db)).toEqual([]);
  });

  it('returns attempt_count', () => {
    const pid = upsertProblem(db, { slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy' });
    insertAttempt(db, { problemId: pid, solved: true });
    insertAttempt(db, { problemId: pid, solved: false });
    const rows = listProblemsWithSummary(db);
    expect(rows[0].attempt_count).toBe(2);
  });

  it('last_solved reflects most recent attempt', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    insertAttempt(db, { problemId: pid, solved: true });
    insertAttempt(db, { problemId: pid, solved: false });
    const rows = listProblemsWithSummary(db);
    expect(rows[0].last_solved).toBe(0);
  });

  it('returns null review fields when problem has no review row', () => {
    upsertProblem(db, { slug: 'two-sum' });
    const rows = listProblemsWithSummary(db);
    expect(rows[0].due_date).toBeNull();
    expect(rows[0].ease).toBeNull();
  });
});

describe('listAttemptsForProblem', () => {
  let db;
  beforeEach(() => { db = openMemoryDb(); });

  it('returns attempts ordered newest first', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    insertAttempt(db, { problemId: pid, solved: true });
    insertAttempt(db, { problemId: pid, solved: false });
    const rows = listAttemptsForProblem(db, 'two-sum');
    expect(rows).toHaveLength(2);
    expect(rows[0].solved).toBe(0);
  });

  it('returns empty array for unknown slug', () => {
    expect(listAttemptsForProblem(db, 'no-such-problem')).toEqual([]);
  });
});

describe('listDueReviewsFull', () => {
  let db;
  beforeEach(() => { db = openMemoryDb(); });

  it('includes reviews within the window', () => {
    const pid = upsertProblem(db, { slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy' });
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    db.prepare('INSERT INTO review_queue (problem_id, due_date, interval, ease, reps) VALUES (?, ?, 1, 2.5, 1)').run(pid, tomorrow);
    const today = new Date().toISOString().slice(0, 10);
    const rows = listDueReviewsFull(db, today, 7);
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe('two-sum');
  });

  it('excludes reviews beyond the window', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    db.prepare('INSERT INTO review_queue (problem_id, due_date, interval, ease, reps) VALUES (?, ?, 1, 2.5, 1)').run(pid, '2099-01-01');
    const today = new Date().toISOString().slice(0, 10);
    expect(listDueReviewsFull(db, today, 7)).toHaveLength(0);
  });
});

describe('getActivityData', () => {
  let db;
  beforeEach(() => { db = openMemoryDb(); });

  it('groups two attempts on the same day into count 2', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    const today = new Date().toISOString().slice(0, 10);
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 1)').run(pid, today + 'T10:00:00Z');
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 0)').run(pid, today + 'T14:00:00Z');
    const rows = getActivityData(db, '2020-01-01');
    const todayRow = rows.find(r => r.date === today);
    expect(todayRow?.count).toBe(2);
  });

  it('excludes attempts before the since date', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 1)').run(pid, '2020-01-01T00:00:00Z');
    const rows = getActivityData(db, '2024-01-01');
    expect(rows).toHaveLength(0);
  });
});

describe('listRecentAttempts', () => {
  let db;
  beforeEach(() => { db = openMemoryDb(); });

  it('returns at most limit rows', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    for (let i = 0; i < 15; i++) {
      insertAttempt(db, { problemId: pid, solved: true });
    }
    expect(listRecentAttempts(db, 10)).toHaveLength(10);
  });

  it('includes slug and title from problems join', () => {
    const pid = upsertProblem(db, { slug: 'two-sum', title: 'Two Sum' });
    insertAttempt(db, { problemId: pid, solved: true });
    const rows = listRecentAttempts(db, 10);
    expect(rows[0].slug).toBe('two-sum');
    expect(rows[0].title).toBe('Two Sum');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/queries.dashboard.test.js
```

Expected: FAIL — `getStats is not a function` (and similar for others)

- [ ] **Step 3: Implement the query functions**

Append to `src/db/queries.js`:

```javascript
export function getStats(db) {
  const totalProblems = db.prepare('SELECT COUNT(*) as c FROM problems').get().c;
  const solvedProblems = db.prepare(
    'SELECT COUNT(DISTINCT problem_id) as c FROM attempts WHERE solved = 1'
  ).get().c;
  const dueToday = db.prepare(
    "SELECT COUNT(*) as c FROM review_queue WHERE due_date <= date('now')"
  ).get().c;
  const patternCount = db.prepare('SELECT COUNT(*) as c FROM patterns').get().c;

  const dates = db
    .prepare("SELECT DISTINCT date(date) as day FROM attempts ORDER BY day DESC")
    .all()
    .map(r => r.day);

  let streak = 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  let expected = todayStr;
  for (const day of dates) {
    if (day === expected) {
      streak++;
      const d = new Date(expected + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      expected = d.toISOString().slice(0, 10);
    } else {
      break;
    }
  }

  return { total_problems: totalProblems, solved_problems: solvedProblems, due_today: dueToday, pattern_count: patternCount, streak };
}

export function listProblemsWithSummary(db) {
  return db.prepare(`
    SELECT
      p.id, p.slug, p.title, p.difficulty, p.topic_tags, p.url,
      (SELECT a.solved FROM attempts a WHERE a.problem_id = p.id ORDER BY a.date DESC LIMIT 1) as last_solved,
      (SELECT a.result_type FROM attempts a WHERE a.problem_id = p.id ORDER BY a.date DESC LIMIT 1) as last_result_type,
      (SELECT a.hints_used FROM attempts a WHERE a.problem_id = p.id ORDER BY a.date DESC LIMIT 1) as last_hints_used,
      (SELECT COUNT(*) FROM attempts a WHERE a.problem_id = p.id) as attempt_count,
      r.due_date,
      r.ease,
      r.reps,
      (SELECT json_group_array(pat.name)
       FROM patterns pat
       JOIN pattern_problems pp ON pp.pattern_id = pat.id
       WHERE pp.problem_id = p.id) as patterns
    FROM problems p
    LEFT JOIN review_queue r ON r.problem_id = p.id
    ORDER BY p.title
  `).all();
}

export function listAttemptsForProblem(db, slug) {
  return db.prepare(`
    SELECT a.*
    FROM attempts a
    JOIN problems p ON p.id = a.problem_id
    WHERE p.slug = ?
    ORDER BY a.date DESC
  `).all(slug);
}

export function listPatternsWithStats(db) {
  return db.prepare(`
    SELECT
      p.*,
      (SELECT COUNT(*) FROM pattern_problems pp WHERE pp.pattern_id = p.id) as problem_count,
      CASE WHEN p.times_seen > 0
        THEN ROUND(CAST(p.times_instinct_fired AS REAL) / p.times_seen, 2)
        ELSE 0
      END as instinct_rate
    FROM patterns p
    ORDER BY p.name
  `).all();
}

export function listProblemsByPattern(db, name) {
  const normalized = String(name).trim().toLowerCase();
  return db.prepare(`
    SELECT
      prob.id, prob.slug, prob.title, prob.difficulty, prob.url,
      (SELECT a.solved FROM attempts a WHERE a.problem_id = prob.id ORDER BY a.date DESC LIMIT 1) as last_solved,
      (SELECT a.hints_used FROM attempts a WHERE a.problem_id = prob.id ORDER BY a.date DESC LIMIT 1) as last_hints_used,
      (SELECT COUNT(*) FROM attempts a WHERE a.problem_id = prob.id) as attempt_count,
      r.ease,
      r.reps,
      r.due_date
    FROM problems prob
    JOIN pattern_problems pp ON pp.problem_id = prob.id
    JOIN patterns pat ON pat.id = pp.pattern_id
    LEFT JOIN review_queue r ON r.problem_id = prob.id
    WHERE pat.name = ?
    ORDER BY prob.title
  `).all(normalized);
}

export function listDueReviewsFull(db, today, windowDays = 7) {
  const end = new Date(today + 'T00:00:00Z');
  end.setUTCDate(end.getUTCDate() + windowDays);
  const windowEnd = end.toISOString().slice(0, 10);
  return db.prepare(`
    SELECT r.*, p.slug, p.title, p.difficulty, p.url
    FROM review_queue r
    JOIN problems p ON p.id = r.problem_id
    WHERE r.due_date <= ?
    ORDER BY r.due_date ASC
  `).all(windowEnd);
}

export function getActivityData(db, since) {
  return db.prepare(`
    SELECT date(date) as date, COUNT(*) as count
    FROM attempts
    WHERE date >= ?
    GROUP BY date(date)
    ORDER BY date ASC
  `).all(since);
}

export function listRecentAttempts(db, limit = 10) {
  return db.prepare(`
    SELECT
      a.id, a.date, a.solved, a.result_type, a.hints_used, a.time_spent,
      p.slug, p.title, p.difficulty, p.url,
      r.ease, r.reps
    FROM attempts a
    JOIN problems p ON p.id = a.problem_id
    LEFT JOIN review_queue r ON r.problem_id = a.problem_id
    ORDER BY a.date DESC
    LIMIT ?
  `).all(limit);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/queries.dashboard.test.js
```

Expected: all tests PASS

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/db/queries.js tests/queries.dashboard.test.js
git commit -m "feat(db): add dashboard query functions"
```

---

## Task 4: API router + server tests

**Files:**
- Create: `src/server/api.js`
- Modify: `src/server/app.js`
- Create: `tests/server.api.test.js`

**Interfaces:**
- Consumes: all functions from Task 2 and Task 3
- Produces: Express Router mounted at `/api` with 11 routes

- [ ] **Step 1: Write the failing server API tests**

Create `tests/server.api.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/server/app.js';
import { upsertProblem, insertAttempt, ensurePattern, recordPatternOutcome } from '../src/db/queries.js';

function openMemoryDb() {
  const db = new Database(':memory:');
  db.exec(readFileSync('src/db/schema.sql', 'utf8'));
  return db;
}

describe('API routes', () => {
  let app, db;
  beforeEach(() => {
    db = openMemoryDb();
    app = createApp(db, '/tmp/session.md');
  });

  it('GET /api/stats returns correct shape', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total_problems: expect.any(Number),
      solved_problems: expect.any(Number),
      due_today: expect.any(Number),
      pattern_count: expect.any(Number),
      streak: expect.any(Number),
    });
  });

  it('GET /api/problems returns array with problem shape', async () => {
    upsertProblem(db, { slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy' });
    const res = await request(app).get('/api/problems');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ slug: 'two-sum', attempt_count: 0 });
  });

  it('GET /api/problems/:slug/attempts returns attempt array', async () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    insertAttempt(db, { problemId: pid, solved: true });
    const res = await request(app).get('/api/problems/two-sum/attempts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].solved).toBe(1);
  });

  it('GET /api/patterns returns array', async () => {
    const res = await request(app).get('/api/patterns');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/patterns/:name/problems returns problems for pattern', async () => {
    const pid = upsertProblem(db, { slug: 'two-sum', title: 'Two Sum' });
    recordPatternOutcome(db, { problemId: pid, name: 'hash map', instinctFired: false });
    const res = await request(app).get('/api/patterns/hash%20map/problems');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].slug).toBe('two-sum');
  });

  it('GET /api/review/due returns array', async () => {
    const res = await request(app).get('/api/review/due');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/activity returns array', async () => {
    const res = await request(app).get('/api/activity');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/recent-attempts returns array capped at 10', async () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    for (let i = 0; i < 15; i++) insertAttempt(db, { problemId: pid, solved: true });
    const res = await request(app).get('/api/recent-attempts');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(10);
  });

  it('wishlist full CRUD cycle', async () => {
    let res = await request(app)
      .post('/api/wishlist')
      .send({ slug: 'two-sum', url: 'https://leetcode.com/problems/two-sum/' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    res = await request(app).get('/api/wishlist');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].slug).toBe('two-sum');

    res = await request(app).patch('/api/wishlist/two-sum').send({ notes: 'review this' });
    expect(res.status).toBe(200);

    res = await request(app).get('/api/wishlist');
    expect(res.body[0].notes).toBe('review this');

    res = await request(app).delete('/api/wishlist/two-sum');
    expect(res.status).toBe(200);

    res = await request(app).get('/api/wishlist');
    expect(res.body).toHaveLength(0);
  });

  it('POST /api/wishlist returns 400 when slug is missing', async () => {
    const res = await request(app).post('/api/wishlist').send({});
    expect(res.status).toBe(400);
  });

  it('existing GET /health still returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('existing POST /event still works', async () => {
    const res = await request(app).post('/event').send({ slug: 'two-sum' });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/server.api.test.js
```

Expected: FAIL — `/api/stats` returns 404

- [ ] **Step 3: Create the API router**

Create `src/server/api.js`:

```javascript
import { Router } from 'express';
import {
  getStats,
  listProblemsWithSummary,
  listAttemptsForProblem,
  listPatternsWithStats,
  listProblemsByPattern,
  listDueReviewsFull,
  getActivityData,
  listRecentAttempts,
  listWishlist,
  addToWishlist,
  updateWishlistNotes,
  removeFromWishlist,
} from '../db/queries.js';

export function createApiRouter(db) {
  const router = Router();

  router.get('/stats', (_req, res) => res.json(getStats(db)));

  router.get('/problems', (_req, res) => res.json(listProblemsWithSummary(db)));

  router.get('/problems/:slug/attempts', (req, res) =>
    res.json(listAttemptsForProblem(db, req.params.slug))
  );

  router.get('/patterns', (_req, res) => res.json(listPatternsWithStats(db)));

  router.get('/patterns/:name/problems', (req, res) =>
    res.json(listProblemsByPattern(db, decodeURIComponent(req.params.name)))
  );

  router.get('/review/due', (_req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    res.json(listDueReviewsFull(db, today, 7));
  });

  router.get('/activity', (_req, res) => {
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    res.json(getActivityData(db, since));
  });

  router.get('/recent-attempts', (_req, res) => res.json(listRecentAttempts(db, 10)));

  router.get('/wishlist', (_req, res) => res.json(listWishlist(db)));

  router.post('/wishlist', (req, res) => {
    const { slug, url, title, difficulty } = req.body || {};
    if (!slug) return res.status(400).json({ ok: false, error: 'slug required' });
    addToWishlist(db, { slug, url: url ?? null, title: title ?? null, difficulty: difficulty ?? null });
    res.json({ ok: true });
  });

  router.patch('/wishlist/:slug', (req, res) => {
    const { notes } = req.body || {};
    updateWishlistNotes(db, req.params.slug, notes ?? '');
    res.json({ ok: true });
  });

  router.delete('/wishlist/:slug', (req, res) => {
    removeFromWishlist(db, req.params.slug);
    res.json({ ok: true });
  });

  return router;
}
```

- [ ] **Step 4: Mount the router and add SPA fallback in app.js**

Edit `src/server/app.js` — add two imports at the top and mount the router + SPA fallback inside `createApp`:

```javascript
// Add to imports at top of file:
import { join } from 'node:path';
import { createApiRouter } from './api.js';
```

Inside `createApp`, after `app.use(express.static(publicDir))` and before `app.get('/health', ...)`:

```javascript
  app.use('/api', createApiRouter(db));

  app.get('/dashboard', (_req, res) => res.redirect('/dashboard/'));
  app.use('/dashboard', (_req, res) => {
    const idx = join(publicDir, 'dashboard', 'index.html');
    res.sendFile(idx, err => {
      if (err) res.status(404).send('Dashboard not built — run: cd dashboard && npm run build');
    });
  });
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test tests/server.api.test.js
```

Expected: all 12 tests PASS

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/server/api.js src/server/app.js tests/server.api.test.js
git commit -m "feat(api): add dashboard API router with 11 routes"
```

---

## Task 5: Dashboard scaffold — package, config, types, API client, comfort lib, hooks

**Files:**
- Create: `dashboard/package.json`, `dashboard/vite.config.ts`, `dashboard/tsconfig.json`
- Create: `dashboard/tailwind.config.js`, `dashboard/postcss.config.js`
- Create: `dashboard/index.html`, `dashboard/src/index.css`, `dashboard/src/main.tsx`
- Create: `dashboard/src/lib/types.ts`, `dashboard/src/lib/api.ts`, `dashboard/src/lib/comfort.ts`
- Create: `dashboard/src/hooks/useStats.ts`, `useProblems.ts`, `usePatterns.ts`, `useReview.ts`, `useActivity.ts`, `useWishlist.ts`

**Interfaces:**
- Produces: a working `npm run dev` in `dashboard/` that starts Vite on port 5173 with `/api/*` proxied to 8765

- [ ] **Step 1: Create dashboard/package.json**

```json
{
  "name": "leetcode-coach-dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.50.0",
    "lucide-react": "^0.400.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.24.0",
    "recharts": "^2.12.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.3.0"
  }
}
```

- [ ] **Step 2: Create dashboard/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/dashboard/',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8765',
    },
  },
  build: {
    outDir: '../public/dashboard',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 3: Create dashboard/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create Tailwind and PostCSS config**

`dashboard/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
};
```

`dashboard/postcss.config.js`:
```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 5: Create dashboard/index.html**

```html
<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LC Coach Dashboard</title>
  </head>
  <body class="bg-gray-950">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create dashboard/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
}
```

- [ ] **Step 7: Create dashboard/src/lib/types.ts**

```typescript
export interface Problem {
  id: number;
  slug: string;
  title: string | null;
  difficulty: string | null;
  topic_tags: string | null;
  url: string | null;
  last_solved: number | null;
  last_result_type: string | null;
  last_hints_used: string | null;
  attempt_count: number;
  due_date: string | null;
  ease: number | null;
  reps: number | null;
  patterns: string | null;
}

export interface Attempt {
  id: number;
  problem_id: number;
  date: string;
  solved: number;
  result_type: string | null;
  hints_used: string;
  time_spent: number | null;
  mistakes: string | null;
  final_approach: string | null;
}

export interface Pattern {
  id: number;
  name: string;
  mastery: 'not_started' | 'shaky' | 'solid';
  times_seen: number;
  times_instinct_fired: number;
  last_practiced: string | null;
  problem_count: number;
  instinct_rate: number;
}

export interface ReviewItem {
  id: number;
  problem_id: number;
  slug: string;
  title: string | null;
  difficulty: string | null;
  url: string | null;
  due_date: string;
  interval: number;
  ease: number;
  reps: number;
}

export interface ActivityPoint {
  date: string;
  count: number;
}

export interface Stats {
  total_problems: number;
  solved_problems: number;
  due_today: number;
  pattern_count: number;
  streak: number;
}

export interface WishlistItem {
  id: number;
  slug: string;
  title: string | null;
  difficulty: string | null;
  url: string | null;
  notes: string | null;
  added_at: string;
  prob_difficulty: string | null;
}

export interface RecentAttempt {
  id: number;
  date: string;
  solved: number;
  result_type: string | null;
  hints_used: string;
  time_spent: number | null;
  slug: string;
  title: string | null;
  difficulty: string | null;
  url: string | null;
  ease: number | null;
  reps: number | null;
}

export type ComfortLevel = 'instinct' | 'solid' | 'learning' | 'shaky' | 'new';
```

- [ ] **Step 8: Create dashboard/src/lib/api.ts**

```typescript
import type {
  Problem, Attempt, Pattern, ReviewItem, ActivityPoint,
  Stats, WishlistItem, RecentAttempt,
} from './types';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  stats: () => get<Stats>('/api/stats'),
  problems: () => get<Problem[]>('/api/problems'),
  attempts: (slug: string) => get<Attempt[]>(`/api/problems/${slug}/attempts`),
  patterns: () => get<Pattern[]>('/api/patterns'),
  patternProblems: (name: string) =>
    get<Problem[]>(`/api/patterns/${encodeURIComponent(name)}/problems`),
  reviewDue: () => get<ReviewItem[]>('/api/review/due'),
  activity: () => get<ActivityPoint[]>('/api/activity'),
  recentAttempts: () => get<RecentAttempt[]>('/api/recent-attempts'),
  wishlist: () => get<WishlistItem[]>('/api/wishlist'),
  addWishlist: (item: { slug: string; url?: string; title?: string; difficulty?: string }) =>
    post<{ ok: boolean }>('/api/wishlist', item),
  updateWishlistNotes: (slug: string, notes: string) =>
    patch<{ ok: boolean }>(`/api/wishlist/${slug}`, { notes }),
  removeWishlist: (slug: string) => del<{ ok: boolean }>(`/api/wishlist/${slug}`),
};
```

- [ ] **Step 9: Create dashboard/src/lib/comfort.ts**

```typescript
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
```

- [ ] **Step 10: Create all hooks**

`dashboard/src/hooks/useStats.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
export function useStats() {
  return useQuery({ queryKey: ['stats'], queryFn: api.stats });
}
```

`dashboard/src/hooks/useProblems.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
export function useProblems() {
  return useQuery({ queryKey: ['problems'], queryFn: api.problems });
}
```

`dashboard/src/hooks/usePatterns.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
export function usePatterns() {
  return useQuery({ queryKey: ['patterns'], queryFn: api.patterns });
}
export function usePatternProblems(name: string | null) {
  return useQuery({
    queryKey: ['pattern-problems', name],
    queryFn: () => api.patternProblems(name!),
    enabled: !!name,
  });
}
```

`dashboard/src/hooks/useReview.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
export function useReview() {
  return useQuery({ queryKey: ['review'], queryFn: api.reviewDue });
}
```

`dashboard/src/hooks/useActivity.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
export function useActivity() {
  return useQuery({ queryKey: ['activity'], queryFn: api.activity });
}
```

`dashboard/src/hooks/useWishlist.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useWishlist() {
  return useQuery({ queryKey: ['wishlist'], queryFn: api.wishlist });
}
export function useAddWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.addWishlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  });
}
export function useUpdateWishlistNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, notes }: { slug: string; notes: string }) =>
      api.updateWishlistNotes(slug, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  });
}
export function useRemoveWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.removeWishlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  });
}
```

- [ ] **Step 11: Create dashboard/src/main.tsx**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 12: Install dependencies and verify dev server starts**

```bash
cd dashboard && npm install
npm run dev
```

Expected: Vite starts on `http://localhost:5173/dashboard/` with no TypeScript errors. Stop it with Ctrl+C.

- [ ] **Step 13: Commit**

```bash
cd ..
git add dashboard/
git commit -m "feat(dashboard): scaffold Vite + React app with types, api client, hooks"
```

---

## Task 6: Layout components and routing (App, Sidebar)

**Files:**
- Create: `dashboard/src/App.tsx`
- Create: `dashboard/src/components/layout/Sidebar.tsx`
- Create: `dashboard/src/pages/Overview.tsx` (stub)
- Create: `dashboard/src/pages/Problems.tsx` (stub)
- Create: `dashboard/src/pages/Patterns.tsx` (stub)
- Create: `dashboard/src/pages/Review.tsx` (stub)
- Create: `dashboard/src/pages/Wishlist.tsx` (stub)

**Interfaces:**
- Consumes: React Router v6, TanStack Query
- Produces: working navigation between five pages (stubs), sidebar with active link highlight

- [ ] **Step 1: Create stub pages**

`dashboard/src/pages/Overview.tsx`:
```tsx
export default function Overview() {
  return <div className="p-6 text-white">Overview (coming soon)</div>;
}
```

`dashboard/src/pages/Problems.tsx`:
```tsx
export default function Problems() {
  return <div className="p-6 text-white">Problems (coming soon)</div>;
}
```

`dashboard/src/pages/Patterns.tsx`:
```tsx
export default function Patterns() {
  return <div className="p-6 text-white">Patterns (coming soon)</div>;
}
```

`dashboard/src/pages/Review.tsx`:
```tsx
export default function Review() {
  return <div className="p-6 text-white">Review Queue (coming soon)</div>;
}
```

`dashboard/src/pages/Wishlist.tsx`:
```tsx
export default function Wishlist() {
  return <div className="p-6 text-white">Wishlist (coming soon)</div>;
}
```

- [ ] **Step 2: Create Sidebar**

`dashboard/src/components/layout/Sidebar.tsx`:
```tsx
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Network, CalendarCheck, Heart } from 'lucide-react';

const NAV = [
  { to: '/', label: 'Overview', Icon: LayoutDashboard },
  { to: '/problems', label: 'Problems', Icon: BookOpen },
  { to: '/patterns', label: 'Patterns', Icon: Network },
  { to: '/review', label: 'Review', Icon: CalendarCheck },
  { to: '/wishlist', label: 'Wishlist', Icon: Heart },
];

export default function Sidebar() {
  return (
    <nav className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col py-6 gap-1">
      <div className="px-4 mb-6">
        <h1 className="text-base font-bold text-white tracking-tight">LC Coach</h1>
        <p className="text-xs text-gray-500 mt-0.5">Dashboard</p>
      </div>
      {NAV.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
              isActive
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`
          }
        >
          <Icon size={15} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Create App.tsx**

`dashboard/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Sidebar from './components/layout/Sidebar';
import Overview from './pages/Overview';
import Problems from './pages/Problems';
import Patterns from './pages/Patterns';
import Review from './pages/Review';
import Wishlist from './pages/Wishlist';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/dashboard">
        <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/problems" element={<Problems />} />
              <Route path="/patterns" element={<Patterns />} />
              <Route path="/review" element={<Review />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Verify in browser**

```bash
cd dashboard && npm run dev
```

Open `http://localhost:5173/dashboard/`. Verify:
- Sidebar shows all five nav items
- Clicking each nav item updates the URL and shows the stub page
- Active link is highlighted indigo

Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
cd ..
git add dashboard/src/
git commit -m "feat(dashboard): add routing, sidebar, stub pages"
```

---

## Task 7: Overview page

**Files:**
- Replace: `dashboard/src/pages/Overview.tsx`
- Create: `dashboard/src/components/overview/StatsBar.tsx`
- Create: `dashboard/src/components/overview/ActivityHeatmap.tsx`
- Create: `dashboard/src/components/overview/DueToday.tsx`
- Create: `dashboard/src/components/overview/RecentActivity.tsx`

**Interfaces:**
- Consumes: `useStats`, `useActivity`, `useReview`
- Produces: fully working Overview page

- [ ] **Step 1: Create StatsBar**

`dashboard/src/components/overview/StatsBar.tsx`:
```tsx
import { useStats } from '../../hooks/useStats';

export default function StatsBar() {
  const { data } = useStats();
  const stats = [
    { label: 'Problems', value: data?.total_problems ?? '—' },
    { label: 'Solved', value: data?.solved_problems ?? '—' },
    { label: 'Patterns', value: data?.pattern_count ?? '—' },
    { label: 'Due Today', value: data?.due_today ?? '—' },
    { label: 'Streak', value: data != null ? `${data.streak}d` : '—' },
  ];
  return (
    <div className="grid grid-cols-5 gap-4 px-6 pb-6">
      {stats.map(({ label, value }) => (
        <div key={label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-xs text-gray-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create ActivityHeatmap**

`dashboard/src/components/overview/ActivityHeatmap.tsx`:
```tsx
import { useMemo } from 'react';
import type { ActivityPoint } from '../../lib/types';

function intensity(count: number): string {
  if (count === 0) return 'bg-gray-800';
  if (count <= 2) return 'bg-green-900';
  if (count <= 4) return 'bg-green-700';
  return 'bg-green-500';
}

export default function ActivityHeatmap({ data }: { data: ActivityPoint[] }) {
  const weeks = useMemo(() => {
    const map = new Map(data.map(d => [d.date, d.count]));
    const today = new Date();
    const cells: { date: string; count: number }[] = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      cells.push({ date: dateStr, count: map.get(dateStr) ?? 0 });
    }
    const result: { date: string; count: number }[][] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [data]);

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map(cell => (
            <div
              key={cell.date}
              title={`${cell.date}: ${cell.count} attempt${cell.count !== 1 ? 's' : ''}`}
              className={`w-3 h-3 rounded-sm transition-colors ${intensity(cell.count)}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create DueToday**

`dashboard/src/components/overview/DueToday.tsx`:
```tsx
import { useReview } from '../../hooks/useReview';

const DIFF: Record<string, string> = {
  Easy: 'text-green-400', Medium: 'text-amber-400', Hard: 'text-red-400',
};

export default function DueToday() {
  const { data: reviews = [] } = useReview();
  const today = new Date().toISOString().slice(0, 10);
  const due = reviews.filter(r => r.due_date <= today);

  if (due.length === 0) {
    return (
      <div className="mx-6 mb-6 bg-green-900/20 border border-green-800/50 rounded-lg p-3">
        <p className="text-green-400 text-sm">✓ Nothing due — you're caught up.</p>
      </div>
    );
  }

  return (
    <div className="px-6 mb-6">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        Due for Review ({due.length})
      </h2>
      <div className="space-y-2">
        {due.map(r => {
          const days = Math.round(
            (new Date(today).getTime() - new Date(r.due_date).getTime()) / 86400000
          );
          return (
            <div
              key={r.id}
              className="flex justify-between items-center bg-red-900/10 border border-red-900/30 rounded-lg px-4 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs ${DIFF[r.difficulty ?? ''] ?? 'text-gray-400'}`}>
                  {r.difficulty}
                </span>
                <span className="text-sm text-white">{r.title ?? r.slug}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-red-400">
                  {days === 0 ? 'due today' : `${days}d overdue`}
                </span>
                <a
                  href={r.url ?? `https://leetcode.com/problems/${r.slug}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  → LeetCode
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create RecentActivity**

`dashboard/src/components/overview/RecentActivity.tsx`:
```tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

const DIFF: Record<string, string> = {
  Easy: 'text-green-400', Medium: 'text-amber-400', Hard: 'text-red-400',
};

export default function RecentActivity() {
  const { data: attempts = [] } = useQuery({
    queryKey: ['recent-attempts'],
    queryFn: api.recentAttempts,
  });

  return (
    <div className="px-6 mb-6">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        Recent Attempts
      </h2>
      <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700/50">
        {attempts.map(a => {
          const hints = JSON.parse(a.hints_used || '[]') as number[];
          return (
            <div key={a.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`text-sm ${a.solved ? 'text-green-400' : 'text-red-400'}`}>
                  {a.solved ? '✓' : '✗'}
                </span>
                <span className="text-sm text-white">{a.title ?? a.slug}</span>
                <span className={`text-xs ${DIFF[a.difficulty ?? ''] ?? 'text-gray-500'}`}>
                  {a.difficulty}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {hints.length > 0 && (
                  <span>{hints.length} hint{hints.length !== 1 ? 's' : ''}</span>
                )}
                <span>{new Date(a.date).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
        {attempts.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            No attempts yet. Start solving!
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Replace Overview page stub**

`dashboard/src/pages/Overview.tsx`:
```tsx
import StatsBar from '../components/overview/StatsBar';
import ActivityHeatmap from '../components/overview/ActivityHeatmap';
import DueToday from '../components/overview/DueToday';
import RecentActivity from '../components/overview/RecentActivity';
import { useActivity } from '../hooks/useActivity';

export default function Overview() {
  const { data: activity = [] } = useActivity();
  return (
    <div>
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-white">Overview</h1>
      </div>
      <StatsBar />
      <div className="px-6 mb-6">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
          Activity — past 52 weeks
        </h2>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <ActivityHeatmap data={activity} />
        </div>
      </div>
      <DueToday />
      <RecentActivity />
    </div>
  );
}
```

- [ ] **Step 6: Verify in browser**

Start server: `npm start` (in project root)
Start dashboard: `cd dashboard && npm run dev`
Open `http://localhost:5173/dashboard/`

Verify: stats boxes show numbers, heatmap grid renders, due section shows problems or caught-up banner, recent activity feed shows attempts. All data comes from the real DB.

- [ ] **Step 7: Commit**

```bash
cd ..
git add dashboard/src/
git commit -m "feat(dashboard): add Overview page with stats, heatmap, due today, recent activity"
```

---

## Task 8: Problems page

**Files:**
- Create: `dashboard/src/components/problems/ComfortBadge.tsx`
- Create: `dashboard/src/components/problems/AttemptDrawer.tsx`
- Create: `dashboard/src/components/problems/ProblemTable.tsx`
- Replace: `dashboard/src/pages/Problems.tsx`

**Interfaces:**
- Consumes: `useProblems`, `useAddWishlist`, `computeComfort`, `/api/problems/:slug/attempts`
- Produces: filterable problem table with attempt history drawer

- [ ] **Step 1: Create ComfortBadge**

`dashboard/src/components/problems/ComfortBadge.tsx`:
```tsx
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
```

- [ ] **Step 2: Create AttemptDrawer**

`dashboard/src/components/problems/AttemptDrawer.tsx`:
```tsx
import { useQuery } from '@tanstack/react-query';
import { X, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import type { Problem } from '../../lib/types';

const RUNG: Record<number, string> = {
  1: 'Rung 1 — which framework step you\'re stuck on',
  2: 'Rung 2 — leading question',
  3: 'Rung 3 — category of technique',
  4: 'Rung 4 — specific pattern named',
  5: 'Rung 5 — approach outlined in words',
};

export default function AttemptDrawer({
  problem,
  onClose,
}: {
  problem: Problem | null;
  onClose: () => void;
}) {
  const { data: attempts = [] } = useQuery({
    queryKey: ['attempts', problem?.slug],
    queryFn: () => api.attempts(problem!.slug),
    enabled: !!problem,
  });

  if (!problem) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[480px] bg-gray-900 border-l border-gray-800 overflow-y-auto p-6 shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white">{problem.title ?? problem.slug}</h2>
              {problem.url && (
                <a href={problem.url} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-indigo-400">
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {attempts.length} attempt{attempts.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {attempts.map(a => {
            const hints = JSON.parse(a.hints_used || '[]') as number[];
            return (
              <div key={a.id} className="border border-gray-700 rounded-lg p-4 space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">
                    {new Date(a.date).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </span>
                  <span className={a.solved ? 'text-green-400' : 'text-red-400'}>
                    {a.solved ? '✓ Solved' : '✗ Failed'}
                    {a.result_type ? ` · ${a.result_type}` : ''}
                  </span>
                </div>
                {hints.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Hints used:</p>
                    <ul className="space-y-0.5">
                      {hints.map(r => (
                        <li key={r} className="text-xs text-amber-400">
                          {RUNG[r] ?? `Rung ${r}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {a.mistakes && (
                  <div>
                    <p className="text-xs text-gray-500">Mistakes:</p>
                    <p className="text-xs text-gray-300 mt-0.5">{a.mistakes}</p>
                  </div>
                )}
                {a.final_approach && (
                  <div>
                    <p className="text-xs text-gray-500">Approach:</p>
                    <p className="text-xs text-gray-300 mt-0.5">{a.final_approach}</p>
                  </div>
                )}
              </div>
            );
          })}
          {attempts.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-10">No attempts logged yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ProblemTable**

`dashboard/src/components/problems/ProblemTable.tsx`:
```tsx
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
```

- [ ] **Step 4: Replace Problems page stub**

`dashboard/src/pages/Problems.tsx`:
```tsx
import ProblemTable from '../components/problems/ProblemTable';

export default function Problems() {
  return (
    <div>
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-xl font-bold text-white">Problems</h1>
        <p className="text-sm text-gray-400 mt-1">
          Click any row to see full attempt history.
        </p>
      </div>
      <ProblemTable />
    </div>
  );
}
```

- [ ] **Step 5: Verify in browser**

Open `http://localhost:5173/dashboard/problems`. Verify:
- Problems table renders with difficulty, comfort badge, attempt count, next review date, pattern tags
- LeetCode external link opens the problem in a new tab
- Search and difficulty filter narrow the list
- Clicking a row opens the slide-out drawer with attempt history
- Hint rungs are shown as human-readable labels
- "+" button adds to wishlist without closing the drawer

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/
git commit -m "feat(dashboard): add Problems page with attempt drawer and comfort badges"
```

---

## Task 9: Patterns page

**Files:**
- Create: `dashboard/src/components/patterns/PatternCard.tsx`
- Create: `dashboard/src/components/patterns/PatternProblems.tsx`
- Create: `dashboard/src/components/patterns/PatternGrid.tsx`
- Replace: `dashboard/src/pages/Patterns.tsx`

**Interfaces:**
- Consumes: `usePatterns`, `usePatternProblems`, `computeComfort`
- Produces: pattern mastery grid with inline expandable problem list

- [ ] **Step 1: Create PatternCard**

`dashboard/src/components/patterns/PatternCard.tsx`:
```tsx
import type { Pattern } from '../../lib/types';

const MASTERY: Record<string, string> = {
  not_started: 'bg-gray-700 text-gray-300',
  shaky: 'bg-red-900/40 text-red-400',
  solid: 'bg-green-900/40 text-green-400',
};

export default function PatternCard({
  pattern,
  isExpanded,
  onClick,
}: {
  pattern: Pattern;
  isExpanded: boolean;
  onClick: () => void;
}) {
  const pct = pattern.times_seen > 0
    ? Math.round((pattern.times_instinct_fired / pattern.times_seen) * 100)
    : 0;

  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 border rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
        isExpanded ? 'border-indigo-500 shadow-indigo-500/10' : 'border-gray-700 hover:border-gray-600'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-medium text-white capitalize text-sm">{pattern.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${MASTERY[pattern.mastery]}`}>
          {pattern.mastery.replace('_', ' ')}
        </span>
      </div>
      <div className="space-y-2 text-xs text-gray-400">
        <div className="flex justify-between">
          <span>{pattern.problem_count} problem{pattern.problem_count !== 1 ? 's' : ''}</span>
          <span>{pattern.times_seen} seen</span>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span>Instinct rate</span>
            <span className="text-white">{pct}%</span>
          </div>
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {pattern.last_practiced && (
          <p className="text-gray-600">
            Last: {new Date(pattern.last_practiced).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create PatternProblems**

`dashboard/src/components/patterns/PatternProblems.tsx`:
```tsx
import { ExternalLink } from 'lucide-react';
import { usePatternProblems } from '../../hooks/usePatterns';
import ComfortBadge from '../problems/ComfortBadge';

const DIFF: Record<string, string> = {
  Easy: 'text-green-400', Medium: 'text-amber-400', Hard: 'text-red-400',
};

export default function PatternProblems({ name }: { name: string }) {
  const { data: problems = [], isLoading } = usePatternProblems(name);

  if (isLoading) {
    return <div className="mt-2 text-xs text-gray-500 px-2">Loading…</div>;
  }

  return (
    <div className="mt-2 border border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-700/60">
      {problems.map(p => (
        <div key={p.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-800/30">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-xs shrink-0 ${DIFF[p.difficulty ?? ''] ?? 'text-gray-400'}`}>
              {p.difficulty}
            </span>
            <span className="text-sm text-white truncate">{p.title ?? p.slug}</span>
          </div>
          <div className="flex items-center gap-2 ml-2 shrink-0">
            <ComfortBadge problem={p} />
            <a
              href={p.url ?? `https://leetcode.com/problems/${p.slug}/`}
              target="_blank"
              rel="noreferrer"
              className="text-gray-500 hover:text-indigo-400 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      ))}
      {problems.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-3">No problems yet.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create PatternGrid**

`dashboard/src/components/patterns/PatternGrid.tsx`:
```tsx
import { useState } from 'react';
import { usePatterns } from '../../hooks/usePatterns';
import PatternCard from './PatternCard';
import PatternProblems from './PatternProblems';

export default function PatternGrid() {
  const { data: patterns = [], isLoading } = usePatterns();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return <div className="text-gray-400 text-sm">Loading patterns…</div>;

  if (patterns.length === 0) {
    return (
      <p className="text-gray-500 text-sm text-center py-12">
        No patterns tracked yet. Log an attempt with <code className="text-indigo-400">--patterns</code> to get started.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {patterns.map(p => (
        <div key={p.id}>
          <PatternCard
            pattern={p}
            isExpanded={expanded === p.name}
            onClick={() => setExpanded(expanded === p.name ? null : p.name)}
          />
          {expanded === p.name && <PatternProblems name={p.name} />}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Replace Patterns page stub**

`dashboard/src/pages/Patterns.tsx`:
```tsx
import PatternGrid from '../components/patterns/PatternGrid';

export default function Patterns() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-1">Patterns</h1>
      <p className="text-sm text-gray-400 mb-6">
        Click a card to see its problems. Instinct rate = how often you spotted the pattern without hints.
      </p>
      <PatternGrid />
    </div>
  );
}
```

- [ ] **Step 5: Verify in browser**

Open `http://localhost:5173/dashboard/patterns`. Verify:
- Pattern cards show mastery badge, instinct rate bar, problem count
- Clicking expands the problem list inline with comfort badges and LeetCode links
- Clicking again collapses it

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/
git commit -m "feat(dashboard): add Patterns page with mastery grid and inline problem list"
```

---

## Task 10: Review Queue page

**Files:**
- Create: `dashboard/src/components/review/ReviewCard.tsx`
- Replace: `dashboard/src/pages/Review.tsx`

**Interfaces:**
- Consumes: `useReview`
- Produces: urgency-sorted review queue (overdue / due today / upcoming)

- [ ] **Step 1: Create ReviewCard**

`dashboard/src/components/review/ReviewCard.tsx`:
```tsx
import { ExternalLink } from 'lucide-react';
import type { ReviewItem } from '../../lib/types';

const DIFF: Record<string, string> = {
  Easy: 'text-green-400', Medium: 'text-amber-400', Hard: 'text-red-400',
};

export default function ReviewCard({
  item,
  today,
}: {
  item: ReviewItem;
  today: string;
}) {
  const msPerDay = 86400000;
  const daysOverdue = Math.round(
    (new Date(today).getTime() - new Date(item.due_date).getTime()) / msPerDay
  );
  const isOverdue = daysOverdue > 0;
  const isDueToday = daysOverdue === 0;

  const easePct = Math.min(
    100,
    Math.round(((item.ease - 1.3) / (3.0 - 1.3)) * 100)
  );

  const urgencyBorder = isOverdue
    ? 'border-red-800 bg-red-900/10'
    : isDueToday
    ? 'border-amber-800 bg-amber-900/10'
    : 'border-gray-700 bg-gray-800/30';

  return (
    <div className={`border rounded-lg p-4 ${urgencyBorder}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs ${DIFF[item.difficulty ?? ''] ?? 'text-gray-400'}`}>
              {item.difficulty}
            </span>
            <span className="text-sm text-white font-medium">{item.title ?? item.slug}</span>
          </div>
          <span
            className={`text-xs ${
              isOverdue ? 'text-red-400' : isDueToday ? 'text-amber-400' : 'text-gray-400'
            }`}
          >
            {isOverdue
              ? `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`
              : isDueToday
              ? 'due today'
              : `due in ${Math.abs(daysOverdue)} day${Math.abs(daysOverdue) !== 1 ? 's' : ''}`}
          </span>
        </div>
        <a
          href={item.url ?? `https://leetcode.com/problems/${item.slug}/`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          LeetCode <ExternalLink size={11} />
        </a>
      </div>
      <div className="space-y-1.5 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>Ease</span>
          <span>{item.ease.toFixed(2)}</span>
        </div>
        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500" style={{ width: `${easePct}%` }} />
        </div>
        <div className="flex justify-between">
          <span>Interval</span>
          <span>{item.interval}d · {item.reps} rep{item.reps !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace Review page stub**

`dashboard/src/pages/Review.tsx`:
```tsx
import { useReview } from '../hooks/useReview';
import ReviewCard from '../components/review/ReviewCard';

export default function Review() {
  const { data: items = [], isLoading } = useReview();
  const today = new Date().toISOString().slice(0, 10);

  const overdue = items.filter(r => r.due_date < today);
  const dueToday = items.filter(r => r.due_date === today);
  const upcoming = items.filter(r => r.due_date > today);

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-1">Review Queue</h1>
      <p className="text-sm text-gray-400 mb-6">
        Your spaced-repetition inbox — next 7 days.
      </p>

      {overdue.length === 0 && dueToday.length === 0 && (
        <div className="mb-4 bg-green-900/20 border border-green-800/50 rounded-lg p-3">
          <p className="text-green-400 text-sm">✓ Nothing overdue — great work.</p>
        </div>
      )}

      {overdue.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">
            Overdue ({overdue.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overdue.map(r => <ReviewCard key={r.id} item={r} today={today} />)}
          </div>
        </section>
      )}

      {dueToday.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-3">
            Due Today ({dueToday.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dueToday.map(r => <ReviewCard key={r.id} item={r} today={today} />)}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Upcoming ({upcoming.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcoming.map(r => <ReviewCard key={r.id} item={r} today={today} />)}
          </div>
        </section>
      )}

      {items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">Nothing scheduled in the next 7 days.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:5173/dashboard/review`. Verify:
- Overdue problems show in red section
- Due today in amber
- Upcoming in grey
- Ease bar fills proportionally between 1.3 and 3.0
- LeetCode links open the problem

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/
git commit -m "feat(dashboard): add Review Queue page with urgency tiers and ease bars"
```

---

## Task 11: Wishlist page

**Files:**
- Create: `dashboard/src/components/wishlist/AddByUrl.tsx`
- Create: `dashboard/src/components/wishlist/WishlistCard.tsx`
- Create: `dashboard/src/components/wishlist/WishlistGrid.tsx`
- Replace: `dashboard/src/pages/Wishlist.tsx`

**Interfaces:**
- Consumes: `useWishlist`, `useAddWishlist`, `useUpdateWishlistNotes`, `useRemoveWishlist`
- Produces: wishlist with URL paste, editable notes, delete, and "+" from Problems page

- [ ] **Step 1: Create AddByUrl**

`dashboard/src/components/wishlist/AddByUrl.tsx`:
```tsx
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAddWishlist } from '../../hooks/useWishlist';

function extractSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/leetcode\.com\/problems\/([^/?#]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-z0-9-]+$/.test(trimmed)) return trimmed;
  return null;
}

export default function AddByUrl() {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const add = useAddWishlist();

  function handleAdd() {
    const slug = extractSlug(value);
    if (!slug) {
      setError('Paste a LeetCode URL (e.g. https://leetcode.com/problems/two-sum/) or a problem slug');
      return;
    }
    const url = value.trim().startsWith('http')
      ? value.trim()
      : `https://leetcode.com/problems/${slug}/`;
    add.mutate({ slug, url }, {
      onSuccess: () => { setValue(''); setError(''); },
      onError: () => setError('Failed to add — try again'),
    });
  }

  return (
    <div className="mb-6">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Paste LeetCode URL or slug…"
          value={value}
          onChange={e => { setValue(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={add.isPending}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors"
        >
          <Plus size={14} /> Add
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create WishlistCard**

`dashboard/src/components/wishlist/WishlistCard.tsx`:
```tsx
import { useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import { useRemoveWishlist, useUpdateWishlistNotes } from '../../hooks/useWishlist';
import type { WishlistItem } from '../../lib/types';

const DIFF: Record<string, string> = {
  Easy: 'text-green-400', Medium: 'text-amber-400', Hard: 'text-red-400',
};

export default function WishlistCard({ item }: { item: WishlistItem }) {
  const [notes, setNotes] = useState(item.notes ?? '');
  const remove = useRemoveWishlist();
  const updateNotes = useUpdateWishlistNotes();

  const difficulty = item.prob_difficulty ?? item.difficulty;
  const url = item.url ?? `https://leetcode.com/problems/${item.slug}/`;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3 hover:border-gray-600 transition-colors">
      <div className="flex justify-between items-start">
        <div className="min-w-0">
          {difficulty && (
            <span className={`text-xs mr-1.5 ${DIFF[difficulty] ?? 'text-gray-400'}`}>
              {difficulty}
            </span>
          )}
          <span className="text-sm text-white font-medium">{item.title ?? item.slug}</span>
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-gray-500 hover:text-indigo-400 transition-colors"
          >
            <ExternalLink size={13} />
          </a>
          <button
            onClick={() => remove.mutate(item.slug)}
            disabled={remove.isPending}
            className="text-gray-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        onBlur={() => {
          if (notes !== (item.notes ?? '')) {
            updateNotes.mutate({ slug: item.slug, notes });
          }
        }}
        placeholder="Add notes…"
        rows={2}
        className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
      />
      <p className="text-xs text-gray-600">
        Added {new Date(item.added_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create WishlistGrid**

`dashboard/src/components/wishlist/WishlistGrid.tsx`:
```tsx
import { useWishlist } from '../../hooks/useWishlist';
import WishlistCard from './WishlistCard';

export default function WishlistGrid() {
  const { data: items = [], isLoading } = useWishlist();

  if (isLoading) return <div className="text-gray-400 text-sm">Loading…</div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">Your wishlist is empty.</p>
        <p className="text-gray-600 text-xs mt-1">
          Paste a LeetCode URL above, or click + on any problem in your history.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map(item => <WishlistCard key={item.id} item={item} />)}
    </div>
  );
}
```

- [ ] **Step 4: Replace Wishlist page stub**

`dashboard/src/pages/Wishlist.tsx`:
```tsx
import AddByUrl from '../components/wishlist/AddByUrl';
import WishlistGrid from '../components/wishlist/WishlistGrid';

export default function Wishlist() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-1">Wishlist</h1>
      <p className="text-sm text-gray-400 mb-6">Problems you want to tackle next.</p>
      <AddByUrl />
      <WishlistGrid />
    </div>
  );
}
```

- [ ] **Step 5: Verify in browser**

Open `http://localhost:5173/dashboard/wishlist`. Verify:
- Pasting `https://leetcode.com/problems/longest-substring-without-repeating-characters/` and pressing Enter (or clicking Add) adds a card immediately
- Typing in the notes textarea and clicking elsewhere saves the notes
- Trash icon removes the card
- Go to Problems page, click "+" on a problem, come back to Wishlist — card appears
- If a problem is in both wishlist and DB, its difficulty shows from the join (not null)

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/
git commit -m "feat(dashboard): add Wishlist page with URL paste, notes, and delete"
```

---

## Task 12: Production build + server wiring verification

**Files:**
- No new files — verify existing `app.js` changes from Task 4 work with built output

**Interfaces:**
- Consumes: `dashboard/` build output in `public/dashboard/`
- Produces: dashboard accessible at `http://localhost:8765/dashboard/`

- [ ] **Step 1: Build the dashboard**

```bash
cd dashboard && npm run build
```

Expected: no TypeScript errors; `public/dashboard/` directory created with `index.html`, `assets/` folder.

- [ ] **Step 2: Start the server and open the production build**

```bash
cd .. && npm start
```

Open `http://localhost:8765/dashboard/` in the browser.

Verify:
- Dashboard loads (served by Express, not Vite)
- All five pages navigate correctly via the sidebar
- `/api/*` requests resolve (same origin, no proxy needed)
- `http://localhost:8765/dashboard` (without trailing slash) redirects to `/dashboard/`
- `http://localhost:8765/dashboard/problems` loads the problems page directly (SPA fallback works)
- `http://localhost:8765/health` still returns `{ ok: true }` (no regression)
- `http://localhost:8765/viz/two-pointer-sorted.html` still loads (no regression)

- [ ] **Step 3: Run full test suite one final time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Final commit**

```bash
git add public/dashboard/
git commit -m "feat(dashboard): add production build output"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Wishlist table | Task 1 |
| Wishlist queries (add/list/notes/remove) | Task 2 |
| getStats with streak | Task 3 |
| listProblemsWithSummary (last attempt + review join) | Task 3 |
| listAttemptsForProblem | Task 3 |
| listPatternsWithStats (instinct rate) | Task 3 |
| listProblemsByPattern | Task 3 |
| listDueReviewsFull (7-day window) | Task 3 |
| getActivityData | Task 3 |
| listRecentAttempts | Task 3 |
| All 11 API routes | Task 4 |
| SPA fallback + /dashboard redirect | Task 4 |
| Dashboard package scaffold | Task 5 |
| types.ts with all interfaces | Task 5 |
| api.ts with all typed fetchers | Task 5 |
| comfort.ts pure function | Task 5 |
| All 6 hooks | Task 5 |
| Sidebar + routing | Task 6 |
| StatsBar (5 counters) | Task 7 |
| ActivityHeatmap (52-week grid) | Task 7 |
| DueToday (caught-up state) | Task 7 |
| RecentActivity (last 10 attempts) | Task 7 |
| ComfortBadge (5 levels, color-coded) | Task 8 |
| AttemptDrawer (hint rung labels, mistakes, approach) | Task 8 |
| ProblemTable (search, difficulty filter, + wishlist) | Task 8 |
| PatternCard (instinct rate bar, mastery badge) | Task 9 |
| PatternProblems (inline expand with comfort) | Task 9 |
| PatternGrid | Task 9 |
| ReviewCard (urgency, ease bar, LeetCode link) | Task 10 |
| Review page (overdue/today/upcoming tiers) | Task 10 |
| AddByUrl (URL slug extraction) | Task 11 |
| WishlistCard (editable notes, delete) | Task 11 |
| WishlistGrid | Task 11 |
| Production build verification | Task 12 |

All spec requirements covered. No gaps found.

**Placeholder scan:** No TBD, TODO, or "implement later" found.

**Type consistency check:** All types match across tasks — `Problem` interface used in `ComfortBadge`, `ProblemTable`, `PatternProblems`, and `AttemptDrawer` always references the same fields. `computeComfort` uses `Pick<Problem, ...>` so it works for both full `Problem` objects (from `listProblemsWithSummary`) and the slimmer objects returned by `listProblemsByPattern`. `WishlistItem.prob_difficulty` is defined in `types.ts` (Task 5) and matched by the SQL alias `p.difficulty as prob_difficulty` (Task 2).
