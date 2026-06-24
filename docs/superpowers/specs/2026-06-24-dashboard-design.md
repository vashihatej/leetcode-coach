# LeetCode Coach — Stage 6: Dashboard Design

**Date:** 2026-06-24
**Status:** Approved
**Parent spec:** `docs/superpowers/specs/2026-06-12-leetcode-coach-design.md`

## Goal

A local, interactive React dashboard that surfaces everything stored in `coach.db` in a
beautiful, user-friendly UI — problem history with comfort tracking, spaced-repetition
schedule, pattern mastery map, hint/clue history per attempt, a wishlist for future problems,
and activity analytics. All state lives in SQLite; the dashboard is a stateless frontend that
reads and writes through new Express API routes.

## Architecture

```
leetcode-coach/
  src/server/app.js          ← mount new /api/* router
  src/server/api.js          ← NEW: all dashboard query handlers (Express Router)
  src/db/schema.sql          ← add wishlist table
  src/db/queries.js          ← add dashboard + wishlist queries
  public/                    ← existing (viz-kit, served by Express)
  dashboard/                 ← NEW: self-contained Vite + React app
    package.json             ← React 18, Vite 5, TypeScript, Tailwind CSS, Recharts,
                             ←   TanStack Query v5, React Router v6
    vite.config.ts           ← proxy /api/* → localhost:8765
    tsconfig.json
    index.html
    src/
      main.tsx
      App.tsx
      lib/
        api.ts               ← typed fetch wrappers for every /api route
        types.ts             ← shared TypeScript types (Problem, Attempt, Pattern, etc.)
        comfort.ts           ← pure function: compute comfort from DB fields
      hooks/
        useProblems.ts       ← TanStack Query hooks
        usePatterns.ts
        useReview.ts
        useWishlist.ts
        useStats.ts
        useActivity.ts
      components/
        layout/
          Sidebar.tsx        ← nav: Overview · Problems · Patterns · Review · Wishlist
          Header.tsx         ← global breadcrumb + server status indicator
        overview/
          StatsBar.tsx       ← totals strip: problems · solved · due · patterns · streak
          ActivityHeatmap.tsx ← GitHub-style calendar grid (attempt count per day)
          DueToday.tsx       ← overdue + due-today problem cards
          RecentActivity.tsx ← last 10 attempts feed
        problems/
          ProblemTable.tsx   ← filterable + sortable table with search
          AttemptDrawer.tsx  ← slide-out: full attempt history per problem
          ComfortBadge.tsx   ← color-coded instinct/solid/learning/shaky/new
        patterns/
          PatternGrid.tsx    ← mastery card grid
          PatternCard.tsx    ← name · mastery · instinct rate · problem count
          PatternProblems.tsx ← inline expanded problem list
        review/
          ReviewQueue.tsx    ← urgency-sorted queue (overdue → due → upcoming)
          ReviewCard.tsx     ← problem · days overdue · ease bar · LeetCode link
        wishlist/
          WishlistGrid.tsx
          WishlistCard.tsx   ← title · difficulty · notes (editable) · mark done
          AddByUrl.tsx       ← URL paste input with slug extraction
```

**Dev workflow:**
1. `npm start` — Express server on port 8765
2. `cd dashboard && npm run dev` — Vite dev server on 5173, proxies `/api/*` to 8765

**Production:**
- `cd dashboard && npm run build` → outputs to `dashboard/dist/`
- Express mounts `express.static(path.join(root, 'dashboard/dist'))` at `/dashboard`
- A `GET /dashboard` → `GET /dashboard/index.html` redirect handles direct navigation

## Pages

### Overview (home)

The landing page. Four areas:

1. **Stats strip** — six counters: total problems touched · problems solved · attempts today ·
   patterns tracked · problems due today · current solve streak (consecutive days with ≥ 1 attempt).
2. **Activity heatmap** — 52-week GitHub-style grid. Each cell = one day; color intensity =
   attempt count (0 = dark base, 1–2 = light green, 3–4 = medium, 5+ = bright). Hover shows
   date + count. Powered by `/api/activity`.
3. **Due today / overdue** — cards for all problems where `due_date ≤ today`, sorted by
   days-overdue descending. Each card: title · difficulty badge · "X days overdue" · "→ LeetCode"
   link. Empty state: a green "You're caught up" banner.
4. **Recent activity** — last 10 attempts as a feed: date · problem title · solved ✓ or failed ✗ ·
   hints used count · comfort badge.

### Problems

Full problem history with filtering and per-problem drill-down.

**Table columns:** title (→ LeetCode) · difficulty · comfort badge · attempts · next review date ·
pattern tags · "+ Wishlist" button.

**Filters:** difficulty (Easy/Medium/Hard) · comfort (all levels) · pattern (multi-select) ·
review status (overdue / due today / upcoming / not scheduled).

**Global search:** fuzzy match on title and slug.

**Attempt drawer** — clicking any row opens a slide-out panel showing all attempts for that
problem, newest first:
- Per attempt: date · solved/failed · hints used (rendered as human-readable rung labels:
  "Rung 1 — which step you're stuck on", "Rung 3 — category of technique", etc.) · mistakes
  text · final approach text.
- This preserves the learning artifact: you can re-read exactly what hint unlocked the problem
  for you on a previous sitting.

### Patterns

Pattern mastery map.

Grid of cards, one per pattern. Each card:
- Pattern name
- Mastery badge (not started / shaky / solid) — color coded
- Instinct rate: `times_instinct_fired / times_seen` as a percentage + small bar
- Problem count
- Last practiced date

Click a card → inline expansion showing all problems that use this pattern, each with their
comfort badge and a LeetCode link.

### Review Queue

The spaced-repetition inbox.

Problems sorted by urgency tier:
1. **Overdue** (red) — `due_date < today`
2. **Due today** (amber) — `due_date = today`
3. **Upcoming** (muted) — next 7 days

Each card: problem title · difficulty · days overdue (or "due today") · current ease factor ·
reps count · "→ LeetCode" button · small SR progression bar (ease mapped to 1.3–3.0 range).

Empty overdue state: "Nothing overdue — great work."

### Wishlist

Future problem backlog.

- **URL paste bar** at top: accepts any `leetcode.com/problems/<slug>/...` URL. Extracts the
  slug client-side via regex, POSTs to `/api/wishlist`. Card appears immediately (optimistic UI).
- **Grid of wishlist cards**: title · difficulty (if the problem already exists in `problems`
  table, joined server-side) · LeetCode link · notes field (editable inline, PATCHed on blur) ·
  "Mark as done" button (deletes from wishlist; if problem is in history it stays there).
- **"+ Wishlist" button** on every Problems table row — for problems already scraped by the
  extension that you want to deliberately revisit.

## Data Layer

### New DB table — `wishlist`

Added to `src/db/schema.sql`:

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

An idempotent migration runs on `openDb` (same pattern as the `reps` column migration):
check if `wishlist` table exists via `sqlite_master`; if not, create it.

### New Express API — `src/server/api.js`

An Express Router, mounted in `app.js` at `/api`. The `db` instance is passed in via closure,
matching how `createApp` already works.

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/stats` | streak, total problems, solved count, due today count, pattern count |
| `GET` | `/api/problems` | all problems + last attempt + review row + pattern tags joined |
| `GET` | `/api/problems/:slug/attempts` | full attempt history for one problem |
| `GET` | `/api/patterns` | all patterns with problem count + instinct rate |
| `GET` | `/api/patterns/:name/problems` | problems for a pattern with comfort fields |
| `GET` | `/api/review/due` | due reviews joined to problems, sorted overdue → upcoming |
| `GET` | `/api/activity` | attempt counts grouped by date (ISO date → count) |
| `GET` | `/api/wishlist` | all wishlist rows, joined to problems for difficulty |
| `POST` | `/api/wishlist` | body: `{ slug, url?, title?, difficulty? }` |
| `PATCH` | `/api/wishlist/:slug` | body: `{ notes }` — update notes |
| `DELETE` | `/api/wishlist/:slug` | remove from wishlist |

No authentication, no pagination. Local only, data volume stays small.

CORS: the existing middleware only allows `leetcode.com` and `chrome-extension://` origins.
Dashboard runs on the same host, so same-origin requests need no CORS header. The middleware
is left untouched — `localhost:5173` (dev) and `/dashboard` (prod) both bypass it naturally.

### New queries — `src/db/queries.js`

- `getStats(db)` — returns aggregate counts + streak (count consecutive days backwards from
  today where at least one attempt exists, stop at first gap day)
- `listProblemsWithSummary(db)` — problems LEFT JOIN last attempt + review_queue + patterns
- `listAttemptsForProblem(db, slug)` — full attempt rows for a slug
- `listPatternsWithStats(db)` — patterns with `problem_count` and `instinct_rate`
- `listProblemsByPattern(db, name)` — problems for a pattern with comfort fields
- `listDueReviewsFull(db, today, windowDays = 7)` — problems where `due_date <= today +
  windowDays`, joined to problems, ordered by `due_date ASC` (overdue first naturally)
- `getActivityData(db, since)` — `GROUP BY date(date)` on attempts table
- `listWishlist(db)` — wishlist LEFT JOIN problems for difficulty
- `addToWishlist(db, { slug, title, difficulty, url })` — INSERT OR IGNORE
- `updateWishlistNotes(db, slug, notes)` — UPDATE notes
- `removeFromWishlist(db, slug)` — DELETE

### Comfort computation — `dashboard/src/lib/comfort.ts`

Pure function, computed client-side from fields already returned by `/api/problems`:

```
instinct  → last attempt: solved, 0 hints, ease ≥ 2.6, reps ≥ 3
solid     → last attempt: solved, ≤ 1 hint used, ease ≥ 2.0, reps ≥ 2
learning  → last attempt: solved but hints > 1, or ease < 2.0
shaky     → last attempt: not solved
new       → no attempts yet
```

Color mapping: instinct = `#22c55e` (green) · solid = `#14b8a6` (teal) · learning = `#f59e0b`
(amber) · shaky = `#ef4444` (red) · new = `#6b7280` (grey).

### Hint rung labels

`hints_used` is stored as a JSON array of rung numbers (e.g. `[1, 3]`). The dashboard maps
these to human-readable labels from the coaching skill's hint ladder:

```
1 → "Rung 1 — which framework step you're stuck on"
2 → "Rung 2 — leading question"
3 → "Rung 3 — category of technique"
4 → "Rung 4 — specific pattern named"
5 → "Rung 5 — approach outlined in words"
```

## Styling

- **Tailwind CSS** — utility-first, dark theme (`dark` class on `<html>`), consistent with
  the viz-kit dark palette.
- **Recharts** — activity heatmap, ease progress bars, instinct rate sparklines.
- **No external fonts** — system font stack only (matching the viz-kit approach of no CDN deps).
- Transitions on drawer open/close, card hover lifts, badge color transitions — all via Tailwind
  `transition` utilities.

## Testing

- `tests/server.api.test.js` — supertest against `createApp`: each GET route returns 200 + correct
  shape; POST /api/wishlist adds a row; DELETE removes it; PATCH updates notes. Uses an in-memory
  DB (same pattern as existing `tests/server.test.js`).
- `tests/queries.wishlist.test.js` — `addToWishlist`, `listWishlist`, `updateWishlistNotes`,
  `removeFromWishlist`, and idempotent insert (ON CONFLICT DO NOTHING).
- `tests/queries.dashboard.test.js` — `getStats` streak calculation; `listProblemsWithSummary`
  join shape; `getActivityData` grouping.
- Dashboard component tests are out of scope for v1 — the React components are thin wrappers over
  the API; correctness lives in the server tests.

## Scope

### In scope (Stage 6)
- Separate `dashboard/` Vite + React + TypeScript app
- All five views: Overview, Problems, Patterns, Review Queue, Wishlist
- Activity heatmap, comfort badges, attempt drawer with hint rung labels
- 10 new Express API routes in `src/server/api.js`
- `wishlist` table + migration
- New DB query functions
- Server-side API tests + wishlist query tests

### Out of scope (v2+)
- Dashboard component unit tests (Vitest + Testing Library)
- Push notifications / OS reminders for due reviews
- Export to CSV / Anki deck
- Embedded visualizer links within the dashboard (viz files are already browsable at `/viz/`)
- Mobile-responsive layout (local tool, desktop only for v1)
- Dark/light theme toggle (dark only for v1)
