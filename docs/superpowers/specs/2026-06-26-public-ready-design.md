# Public-Ready Design — LeetCode Coach

**Date:** 2026-06-26  
**Status:** Approved  
**Audience:** Both users and contributors equally

---

## Goal

Make the repository ready to share publicly. Anyone should be able to clone it, run one command, and be coaching within minutes. Contributors should understand exactly how the project is structured and what kinds of PRs are welcome.

---

## Deliverables

| File | Action |
|---|---|
| `package.json` | Add `setup` and `dev` scripts |
| `README.md` | Full rewrite with embedded Playwright screenshots |
| `CONTRIBUTING.md` | New file |
| `.github/workflows/ci.yml` | New GitHub Actions workflow |
| `.github/ISSUE_TEMPLATE/bug.md` | New bug report template |
| `.github/ISSUE_TEMPLATE/feature.md` | New feature request template |
| `.gitignore` | Add `docs/screenshots/` exemption, `.github` keepable |
| `docs/screenshots/` | Playwright-captured PNGs of all dashboard views |
| `scripts/setup.sh` | (optional) called by npm setup if cross-platform handling needed |

---

## Section 1 — Setup Scripts

### `npm run setup`
Runs once after cloning. Sequence:
1. `npm install` (root dependencies)
2. `npm install --prefix dashboard` (dashboard dependencies)
3. `npm run build --prefix dashboard` (builds dashboard into `public/dashboard/`)

After this, the project is fully ready. Users never need to touch the `dashboard/` subfolder.

### `npm run dev`
For contributors developing the dashboard UI. Sequence:
1. `npm install` (root)
2. `npm install --prefix dashboard`
3. Starts the server (`npm start`) AND runs `vite dev` in the dashboard with watch mode

Implementation: use `concurrently` or two parallel npm scripts. The dashboard dev server proxies API calls to the Node server.

### Existing scripts (unchanged)
- `npm start` — starts the Express server on port 8765
- `npm test` — runs the Vitest suite

---

## Section 2 — README Structure

The README leads with the *feeling*, not a feature list. Structure:

### Hero
- Project name + tagline: *"Stop peeking at solutions. Build the instinct."*
- CI badge
- Screenshot: Overview page (activity heatmap, stats bar, due-today queue)

### Why this exists
Two paragraphs. Problem: people go blank at interviews because they've seen solutions, not built instincts. Peeking feels like progress. Solution: a local AI coach that never gives the answer — it asks questions until you find it yourself, then records what you understood and schedules review.

### Features
8–10 one-line bullets with emoji:
- Socratic coaching via Claude Code / Codex (never hands you the answer)
- Five-step framework: restate → examples → brute force → bottleneck → pattern
- Analogy-based explanations baked into every session
- Per-pattern mastery tracking (not_started / shaky / solid)
- SM-2 spaced repetition review queue
- Pattern wiki — auto-generated knowledge cards with recognition signals, invariant, template code
- Rich attempt history: aha moments, confusion points, analogy that clicked, viz links
- Animated algorithm visualizations (two-pointer, recursion tree, etc.)
- Activity heatmap and streak tracking
- Chrome extension: streams live LeetCode problem + code + verdict into session

### Quick Start
Three steps: clone → `npm run setup` → `npm start`, then open `http://localhost:8765`.

### Chrome Extension
Full section:
- What it does: streams problem statement, code, and run/submit results into `session.md` automatically so Claude always knows what you're working on
- Install steps (load unpacked from `extension/`)
- Screenshot: popup showing "Connected ✓"
- Screenshot: `session.md` auto-populated after opening a LeetCode problem
- Troubleshooting: server not running, wrong port

### Using with Claude Code / Codex / Cursor
Per-tool setup instructions:
- **Claude Code**: `claude` from repo root, skill auto-loads, say "let's work on this problem"
- **Codex**: point at repo root, skill file location, equivalent invocation
- **Cursor / other**: copy skill content into system prompt or rules file

### How it works (architecture)
Diagram of the full flow:
```
LeetCode tab → Chrome Extension → POST /api/session → session.md
                                                            ↓
                                                  Claude reads session.md
                                                  coaches via CLI skill
                                                            ↓
                                               node src/cli/coach.js log-attempt
                                                            ↓
                                                       coach.db (SQLite)
                                                            ↓
                                               http://localhost:8765 (dashboard)
```

Components:
- `src/server/` — Express server, serves API + static dashboard + viz files
- `src/db/` — SQLite schema, queries, SM-2 spaced repetition
- `src/cli/` — CLI commands (log-attempt, mastery, enrich-pattern, etc.)
- `dashboard/` — React/Vite SPA (built into `public/dashboard/`)
- `extension/` — Chrome extension content scripts + popup
- `public/viz/` — standalone HTML animated visualizations
- `.claude/skills/` — the coaching skill loaded by Claude Code

### All features deep-dive
One subsection per feature with screenshot:
- Overview page (heatmap, stats, due today, recent activity)
- Problems page (table, attempt drawer, comfort badges, viz button)
- Patterns page (mastery grid, pattern wiki drawer)
- Review Queue (urgency tiers, ease bar)
- Wishlist (URL paste, inline notes, mark done)

### CLI reference
Full table of all commands with examples:
- `status`, `mastery`, `review-due`
- `log-attempt` (all flags including new ones: --aha, --confusion, --analogy, --viz-path)
- `set-mastery`, `enrich-pattern`, `pattern-wiki-status`

### Contributing
Two-sentence invite + link to CONTRIBUTING.md.

---

## Section 3 — CONTRIBUTING.md

### Dev setup
```bash
git clone <repo>
npm run setup
npm run dev      # server + dashboard hot-reload
npm test         # run the test suite
```

### Project structure
One-line description per folder:
- `src/cli/` — CLI commands
- `src/db/` — SQLite schema, queries, migrations
- `src/server/` — Express API + static file serving
- `src/sr/` — SM-2 spaced repetition scheduler
- `dashboard/` — React/Vite frontend (TypeScript, Tailwind, TanStack Query)
- `extension/` — Chrome extension (MV3 content scripts + popup)
- `public/viz/` — standalone animated algorithm visualizations
- `.claude/skills/` — coaching skill (used by Claude Code, adaptable to other AI tools)
- `tests/` — Vitest integration tests

### What makes a good PR
- Bug fix with a failing test that now passes
- New visualization for an algorithm
- New CLI flag that improves the logging experience
- Dashboard improvement (new page, better UX)
- Improving the coaching skill (better questions, new analogies)

### What doesn't fit
- Changing the coaching philosophy (Socratic method is intentional)
- Adding external API dependencies (local-first is a core constraint)
- Cloud sync or accounts (out of scope)

### PR checklist
- `npm test` passes
- `npm run setup` still works from a clean clone
- README updated if the change is user-visible
- New CLI flags documented in the CLI reference section

---

## Section 4 — GitHub Actions CI

File: `.github/workflows/ci.yml`

Triggers: push and pull_request to `main`.

Steps:
1. Checkout
2. Setup Node 20
3. `npm install`
4. `npm test`

No dashboard build in CI (build artifact, not tested there). Badge goes at top of README.

---

## Section 5 — Issue Templates

### `.github/ISSUE_TEMPLATE/bug.md`
Fields: what happened, what you expected, steps to reproduce, Node version, OS, relevant logs.
Label: `bug`

### `.github/ISSUE_TEMPLATE/feature.md`
Fields: what problem does this solve, proposed solution, alternatives considered.
Label: `enhancement`

---

## Playwright Screenshot Plan

Script at `scripts/screenshot.js`. Server must be running on 8765.

Captures (saved to `docs/screenshots/`):
1. `overview.png` — full Overview page
2. `problems.png` — Problems table
3. `attempt-drawer.png` — attempt drawer open on a problem with rich data
4. `patterns.png` — Patterns grid
5. `pattern-wiki.png` — pattern wiki drawer open (two-pointers)
6. `review.png` — Review Queue
7. `wishlist.png` — Wishlist page
8. `extension-popup.png` — (manual, can't automate Chrome extension popup)

Viewport: 1440×900. Dark theme renders correctly already.

---

## .gitignore Additions

```
docs/screenshots/
```

Screenshots are generated artifacts — they'll be committed manually after review, then removed from gitignore so they're tracked in the repo for the README to reference.

---

## GitHub Repo Setup Checklist

Steps for the user to do on github.com after pushing:
1. Set repo description: *"A local AI coaching system for LeetCode — Socratic method, spaced repetition, pattern wiki"*
2. Add topics: `leetcode`, `interview-prep`, `claude-ai`, `spaced-repetition`, `algorithms`
3. Enable Issues and Discussions
4. Set default branch to `main`
5. Add branch protection on `main`: require CI to pass before merge
6. Pin the repo to profile if desired
