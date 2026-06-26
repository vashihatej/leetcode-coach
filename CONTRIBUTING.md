# Contributing to LeetCode Coach

Thanks for your interest. LeetCode Coach is intentionally local-first and Socratic — contributions that preserve those values are very welcome.

## Dev setup

```bash
git clone https://github.com/<your-fork>/leetcode-coach
cd leetcode-coach
npm run setup       # install deps + build dashboard once
npm run dev         # server on :8765 + dashboard hot-reload
npm test            # run the test suite
```

The dashboard dev server (Vite) proxies API calls to the Node server automatically. Changes to React components appear without a full rebuild.

## Project structure

| Path | What it does |
|---|---|
| `src/cli/` | CLI commands — `log-attempt`, `enrich-pattern`, `mastery`, etc. |
| `src/db/` | SQLite schema, all queries, migration helpers |
| `src/server/` | Express API + static file serving |
| `src/sr/` | SM-2 spaced repetition scheduler |
| `dashboard/` | React/Vite frontend (TypeScript, Tailwind, TanStack Query) |
| `extension/` | Chrome extension (Manifest V3 content scripts + popup) |
| `public/viz/` | Standalone animated algorithm visualizations |
| `.claude/skills/` | The coaching skill (loaded by Claude Code; adaptable to other AI tools) |
| `tests/` | Vitest integration tests against a real SQLite DB |

## What makes a good PR

- **Bug fix** with a failing test that now passes
- **New visualization** for an algorithm (see `public/viz/` for examples)
- **New CLI flag** that improves the logging experience
- **Dashboard improvement** — new page, better UX, accessibility
- **Coaching skill improvement** — better questions, new analogies, richer pattern wiki templates

## What doesn't fit

- Changing the coaching philosophy (Socratic, never-give-the-answer is intentional)
- Adding external API dependencies (local-first is a core constraint)
- Cloud sync, accounts, or any network features
- Anything that requires running more than `npm start` in production

## PR checklist

- [ ] `npm test` passes
- [ ] `npm run setup` still works from a clean clone
- [ ] README updated if the change is user-visible
- [ ] New CLI flags documented in the CLI reference section of README

## Adding a new DB column

1. Add the column to `src/db/schema.sql`
2. Add a migration in the `migrate()` function in `src/db/index.js` (use `ALTER TABLE ... ADD COLUMN`)
3. Update the relevant query in `src/db/queries.js`
4. Update the TypeScript type in `dashboard/src/lib/types.ts`

## Adding a new visualization

Visualizations live in `public/viz/`. Each is a standalone HTML file that uses the shared kit:
- CSS: `/viz/viz-kit.css`
- JS: `/viz/viz-kit.js`

Copy the structure from `public/viz/two-pointer-sorted.html` as a starting point. Wire `source`, `lineForFrame`, and `stateRows` so the executing line highlights in lockstep with the animation.
