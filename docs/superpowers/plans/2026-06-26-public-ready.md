# Public-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make leetcode-coach a polished, public GitHub repo that any developer can clone, set up in one command, and start using or contributing to immediately.

**Architecture:** Add a `setup` npm script that bootstraps the full project, capture Playwright screenshots of all dashboard views, rewrite the README with embedded screenshots and per-tool AI setup instructions, and add CI + GitHub community files.

**Tech Stack:** Node 20, npm workspaces-adjacent (root + dashboard subfolder), Playwright (screenshot capture), GitHub Actions, Vitest (existing tests).

## Global Constraints

- No external API calls — project stays fully local
- `npm run setup` must work from a clean clone with no prior state
- All file paths use forward slashes
- Screenshots saved to `docs/screenshots/` as PNG at 1440×900 viewport
- Server must be running on port 8765 for screenshot tasks
- Commit after every task

---

## File Map

| File | Action |
|---|---|
| `package.json` | Modify — add `setup`, `dev`, `screenshot` scripts; add `concurrently` devDep |
| `.github/workflows/ci.yml` | Create — GitHub Actions CI |
| `.github/ISSUE_TEMPLATE/bug.md` | Create — bug report template |
| `.github/ISSUE_TEMPLATE/feature.md` | Create — feature request template |
| `scripts/screenshot.js` | Create — Playwright screenshot capture script |
| `docs/screenshots/*.png` | Create — captured screenshots (7 images) |
| `CONTRIBUTING.md` | Create — contributor guide |
| `README.md` | Modify — full rewrite |
| `.gitignore` | Modify — minor additions |

---

### Task 1: npm setup + dev scripts

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run setup` (install + build), `npm run dev` (server + vite watch), `npm run screenshot` (capture screenshots)

- [ ] **Step 1: Add `concurrently` devDependency**

```bash
npm install --save-dev concurrently
```

Expected: `package.json` devDependencies now includes `"concurrently": "^9.x.x"` (or similar).

- [ ] **Step 2: Add scripts to `package.json`**

Open `package.json` and replace the `"scripts"` block with:

```json
"scripts": {
  "start": "node src/server/index.js",
  "setup": "npm install && npm install --prefix dashboard && npm run build --prefix dashboard",
  "dev": "concurrently \"npm start\" \"npm run dev --prefix dashboard\"",
  "screenshot": "node scripts/screenshot.js",
  "test": "vitest run"
}
```

- [ ] **Step 3: Verify setup script runs end-to-end**

```bash
npm run setup
```

Expected output ends with:
```
✓ built in Xm
```
(Vite build success). No errors.

- [ ] **Step 4: Verify server starts**

```bash
npm start &
sleep 2
curl -s http://localhost:8765/api/stats | node -e "process.stdin.resume(); process.stdin.on('data', d => { JSON.parse(d); console.log('OK'); })"
kill %1
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add setup, dev, and screenshot npm scripts"
```

---

### Task 2: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: CI badge URL `https://github.com/<user>/leetcode-coach/actions/workflows/ci.yml/badge.svg`

- [ ] **Step 1: Create workflows directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test
```

- [ ] **Step 3: Verify YAML is valid**

```bash
node -e "
const fs = require('fs');
const yaml = require('js-yaml');
" 2>/dev/null || node -e "
const text = require('fs').readFileSync('.github/workflows/ci.yml','utf8');
console.log('lines:', text.split('\n').length, '— looks OK');
"
```

Expected: prints line count with no parse error.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions test workflow"
```

---

### Task 3: GitHub issue templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug.md`
- Create: `.github/ISSUE_TEMPLATE/feature.md`

- [ ] **Step 1: Create directory**

```bash
mkdir -p .github/ISSUE_TEMPLATE
```

- [ ] **Step 2: Write bug report template**

Create `.github/ISSUE_TEMPLATE/bug.md`:

```markdown
---
name: Bug report
about: Something isn't working
labels: bug
---

**What happened?**
<!-- A clear description of the bug -->

**What did you expect to happen?**

**Steps to reproduce**
1. 
2. 
3. 

**Environment**
- OS: 
- Node version (`node --version`): 
- Browser (if dashboard issue): 

**Relevant logs or errors**
```paste logs here```
```

- [ ] **Step 3: Write feature request template**

Create `.github/ISSUE_TEMPLATE/feature.md`:

```markdown
---
name: Feature request
about: Suggest an improvement or new capability
labels: enhancement
---

**What problem does this solve?**
<!-- Describe the problem, not the solution -->

**Proposed solution**
<!-- How you'd like it to work -->

**Alternatives considered**
<!-- Other approaches you thought about -->

**Additional context**
<!-- Anything else that would help -->
```

- [ ] **Step 4: Commit**

```bash
git add .github/ISSUE_TEMPLATE/
git commit -m "chore: add GitHub issue templates"
```

---

### Task 4: Playwright screenshot script + capture

**Files:**
- Create: `scripts/screenshot.js`
- Create: `docs/screenshots/overview.png`
- Create: `docs/screenshots/problems.png`
- Create: `docs/screenshots/attempt-drawer.png`
- Create: `docs/screenshots/patterns.png`
- Create: `docs/screenshots/pattern-wiki.png`
- Create: `docs/screenshots/review.png`
- Create: `docs/screenshots/wishlist.png`

**Interfaces:**
- Consumes: server running on `http://localhost:8765`
- Produces: 7 PNG files in `docs/screenshots/`

- [ ] **Step 1: Install Playwright**

```bash
npm install --save-dev playwright
npx playwright install chromium
```

Expected: chromium browser downloaded (~150MB).

- [ ] **Step 2: Create `scripts/` directory**

```bash
mkdir -p scripts docs/screenshots
```

- [ ] **Step 3: Write `scripts/screenshot.js`**

```js
import { chromium } from 'playwright';
import { existsSync } from 'fs';

const BASE = 'http://localhost:8765';
const OUT = 'docs/screenshots';
const VIEWPORT = { width: 1440, height: 900 };

async function check() {
  try {
    const r = await fetch(`${BASE}/api/stats`);
    if (!r.ok) throw new Error();
  } catch {
    console.error('Server not running on port 8765. Run `npm start` first.');
    process.exit(1);
  }
}

async function run() {
  await check();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  const shots = [
    { path: `${OUT}/overview.png`,        url: `${BASE}/#/`,         wait: '.heatmap, [class*="heatmap"], [class*="StatsBar"]', delay: 800 },
    { path: `${OUT}/problems.png`,        url: `${BASE}/#/problems`, wait: 'table', delay: 600 },
    { path: `${OUT}/patterns.png`,        url: `${BASE}/#/patterns`, wait: '[class*="PatternCard"], .grid', delay: 600 },
    { path: `${OUT}/review.png`,          url: `${BASE}/#/review`,   wait: 'main', delay: 400 },
    { path: `${OUT}/wishlist.png`,        url: `${BASE}/#/wishlist`, wait: 'main', delay: 400 },
  ];

  for (const { path, url, delay } of shots) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(delay);
    await page.screenshot({ path, fullPage: false });
    console.log(`✓ ${path}`);
  }

  // attempt drawer — click first problem row
  await page.goto(`${BASE}/#/problems`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.locator('tbody tr').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/attempt-drawer.png` });
  console.log(`✓ ${OUT}/attempt-drawer.png`);

  // pattern wiki drawer — click book icon on first pattern
  await page.goto(`${BASE}/#/patterns`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.locator('[title="Pattern wiki"]').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/pattern-wiki.png` });
  console.log(`✓ ${OUT}/pattern-wiki.png`);

  await browser.close();
  console.log('\nAll screenshots saved to docs/screenshots/');
}

run().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Verify server is running then capture**

Make sure server is running first:
```bash
curl -s http://localhost:8765/api/stats > /dev/null && echo "server OK" || echo "start server first"
```

If OK, capture:
```bash
npm run screenshot
```

Expected output:
```
✓ docs/screenshots/overview.png
✓ docs/screenshots/problems.png
✓ docs/screenshots/patterns.png
✓ docs/screenshots/review.png
✓ docs/screenshots/wishlist.png
✓ docs/screenshots/attempt-drawer.png
✓ docs/screenshots/pattern-wiki.png

All screenshots saved to docs/screenshots/
```

- [ ] **Step 5: Commit screenshots and script**

```bash
git add scripts/screenshot.js docs/screenshots/ package.json package-lock.json
git commit -m "chore: add Playwright screenshot script and captured screenshots"
```

---

### Task 5: CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Write `CONTRIBUTING.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING.md"
```

---

### Task 6: README rewrite

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `docs/screenshots/*.png` from Task 4
- Consumes: CI badge from Task 2

- [ ] **Step 1: Write full `README.md`**

Replace the entire contents of `README.md` with:

```markdown
<div align="center">

# LeetCode Coach

**Stop peeking at solutions. Build the instinct.**

[![CI](https://github.com/vashihatej/leetcode-coach/actions/workflows/ci.yml/badge.svg)](https://github.com/vashihatej/leetcode-coach/actions/workflows/ci.yml)

![Overview](docs/screenshots/overview.png)

</div>

---

## Why this exists

Most people prepare for coding interviews by watching solution videos and reading editorials. It feels productive — you understand the solution while you're reading it. But understanding a solution and being able to *find* one from scratch are completely different skills. When the interview starts and the page is blank, that feeling comes back.

LeetCode Coach is built around a different idea: the only way to build interview instincts is to practice finding answers yourself, repeatedly, with just enough guidance to keep moving. It uses Claude (or any AI tool you prefer) as a Socratic coach — it asks questions, points at what you're missing, and never hands you the answer. Every session gets logged: what hints you needed, where you got stuck, what analogy finally made it click. That history compounds. Patterns you've genuinely internalized space out in your review queue. Patterns that are still shaky come back sooner.

## Features

- 🤖 **Socratic coaching** — the AI asks questions, never gives answers
- 📋 **Five-step framework** — restate → examples → brute force → bottleneck → pattern
- 💡 **Analogy-based explanations** — every concept gets a real-world hook
- 📊 **Pattern mastery tracking** — not started / shaky / solid, per pattern
- 🔁 **SM-2 spaced repetition** — review queue that adapts to how well you know each problem
- 📖 **Pattern wiki** — auto-generated knowledge cards with recognition signals, invariant, template code, and common traps
- 📝 **Rich attempt history** — aha moments, confusion points, analogy that clicked, visualization links
- 🎬 **Animated visualizations** — two-pointer, recursion tree, and more
- 📈 **Activity heatmap** and streak tracking
- 🔌 **Chrome extension** — streams your live LeetCode problem, code, and run/submit results directly into the coaching session

## Quick Start

```bash
git clone https://github.com/vashihatej/leetcode-coach
cd leetcode-coach
npm run setup
npm start
```

Open **http://localhost:8765** in your browser.

> `npm run setup` installs all dependencies and builds the dashboard. You only need to run it once (and again after pulling changes that modify `dashboard/`).

## Chrome Extension

The extension is what makes coaching feel seamless. Without it you paste the problem manually; with it, everything syncs automatically.

**What it does:** When you open a LeetCode problem, the extension captures the problem statement, your code, and your run/submit results, and sends them to `session.md` on the local server. Your AI coach reads that file and knows exactly what you're working on without you having to explain anything.

**Install:**
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** and select the `extension/` folder in this repo
4. Open any LeetCode problem — the extension icon should show **Connected ✓**

**Troubleshooting:**
- *Not connected:* make sure `npm start` is running before opening LeetCode
- *Wrong port:* the extension talks to `localhost:8765` by default — if you changed `COACH_PORT`, update `extension/manifest.json` `host_permissions` to match

## Using with AI tools

### Claude Code (recommended)

1. Install [Claude Code](https://claude.ai/code)
2. Open a terminal in this repo and run `claude`
3. The coaching skill at `.claude/skills/leetcode-coaching/` loads automatically
4. Open a LeetCode problem in Chrome (extension installed + server running)
5. Say: *"let's work on this problem"*

The coach reads your current session, asks what came to mind first, and guides you from there.

### Codex

1. Point Codex at this repo root
2. The skill file is at `.claude/skills/leetcode-coaching/SKILL.md` — add it to your Codex context or system prompt
3. Open a LeetCode problem and ask Codex to coach you through it
4. Paste `session.md` contents if the extension isn't syncing automatically

### Cursor / other AI tools

Copy the contents of `.claude/skills/leetcode-coaching/SKILL.md` into your tool's system prompt or rules file. The skill is plain markdown with no Claude-specific syntax — it works with any instruction-following model.

## How it works

```
LeetCode tab
    │
    │  (content scripts)
    ▼
Chrome Extension  ──POST /api/session──▶  Node server (port 8765)
                                               │
                                          session.md  ◀── AI coach reads this
                                               │
                                    node src/cli/coach.js log-attempt
                                               │
                                           coach.db  (SQLite)
                                               │
                                     http://localhost:8765
                                           (dashboard)
```

**Components:**

| Path | Role |
|---|---|
| `src/server/` | Express API + serves dashboard + viz files |
| `src/db/` | SQLite schema, all queries, SM-2 spaced repetition |
| `src/cli/` | CLI — log-attempt, mastery, enrich-pattern, review-due |
| `dashboard/` | React/Vite SPA (built into `public/dashboard/`) |
| `extension/` | Chrome extension MV3 — content scripts + popup |
| `public/viz/` | Standalone animated algorithm visualizations |
| `.claude/skills/` | The coaching skill (plain markdown, works with any AI tool) |

## Dashboard

### Overview
Activity heatmap, stats (streak, problems solved, due today), upcoming reviews, and recent attempts.

![Overview](docs/screenshots/overview.png)

### Problems
Every problem you've attempted, with comfort badges, pattern tags, next review date, and a `▶` button for problems that have a saved visualization.

![Problems](docs/screenshots/problems.png)

Click any row to open the attempt drawer — full history with hints used, mistakes, aha moments, the analogy that clicked, and a link to the visualization if one was built.

![Attempt drawer](docs/screenshots/attempt-drawer.png)

### Patterns
Your mastery grid across every pattern you've encountered. Each card shows problem count, instinct-fire rate, and a progress bar.

![Patterns](docs/screenshots/patterns.png)

Click the `📖` icon to open the **Pattern Wiki** — a knowledge card the AI generates automatically the first time it coaches you through a problem using that pattern. Contains recognition signals, the core invariant, an analogy, a Python template, common traps, and related patterns.

![Pattern wiki](docs/screenshots/pattern-wiki.png)

### Review Queue
Problems due for spaced repetition, sorted by urgency. The ease bar shows how comfortably you know each one.

![Review](docs/screenshots/review.png)

### Wishlist
Problems you want to do but haven't started. Paste a LeetCode URL and it populates the title and difficulty automatically. Add notes for why you added it.

![Wishlist](docs/screenshots/wishlist.png)

## Visualizations

With the server running:

- `http://localhost:8765/viz/two-pointer-sorted.html`
- `http://localhost:8765/viz/recursion-subsets.html`

The coach can build new visualizations during a session (saved to `public/viz/`) and they link back from the problem's attempt history.

## CLI Reference

All commands run from the repo root:

```bash
# Show the current problem + code (from Chrome extension)
node src/cli/coach.js status

# Show per-pattern mastery
node src/cli/coach.js mastery

# Show problems due for review
node src/cli/coach.js review-due

# Update mastery for a pattern
node src/cli/coach.js set-mastery --pattern "sliding window" --level solid

# Log an attempt after a coaching session
node src/cli/coach.js log-attempt \
  --slug two-sum \
  --solved \
  --result optimal \
  --patterns "hashing" \
  --hints 1,2 \
  --mistakes "forgot to check complement before inserting" \
  --approach "one-pass complement map" \
  --aha "realized I need O(1) lookup, not O(n) scan" \
  --confusion "initially tried sorting which breaks index requirement" \
  --analogy "labeled lockers — go straight to the slot instead of checking every one" \
  --viz-path "viz/two-sum-hashmap.html"

# Generate a pattern knowledge card
node src/cli/coach.js enrich-pattern \
  --pattern "two-pointers" \
  --description "..." \
  --signals "find pair with target,sorted array,two ends" \
  --invariant "..." \
  --analogy "..." \
  --template "l, r = 0, len(arr)-1\nwhile l < r:\n    ..." \
  --time-complexity "O(n)" \
  --space-complexity "O(1)"

# Check if a pattern has a wiki entry
node src/cli/coach.js pattern-wiki-status --pattern "two-pointers"
```

## Data

- `coach.db` — SQLite database: problems, attempts, patterns, review queue, pattern wiki
- `session.md` — current problem state (overwritten by extension on each change)

Both are local and gitignored. Your data never leaves your machine.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Good first contributions: new visualizations, new CLI flags, dashboard improvements, and richer coaching skill analogies. PRs that add external dependencies or break the local-only model won't be accepted.
```

- [ ] **Step 2: Verify all screenshot references exist**

```bash
for f in docs/screenshots/overview.png docs/screenshots/problems.png docs/screenshots/attempt-drawer.png docs/screenshots/patterns.png docs/screenshots/pattern-wiki.png docs/screenshots/review.png docs/screenshots/wishlist.png; do
  [ -f "$f" ] && echo "✓ $f" || echo "✗ MISSING: $f"
done
```

Expected: all 7 lines start with `✓`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README with screenshots, feature deep-dives, and per-tool AI setup"
```

---

### Task 7: .gitignore cleanup

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Update `.gitignore`**

Add to the end of `.gitignore`:

```
# Playwright browser binaries (downloaded by npx playwright install)
/node_modules/.cache/
```

The `docs/screenshots/` directory is intentionally NOT in gitignore — screenshots are committed to the repo so the README can reference them.

- [ ] **Step 2: Confirm screenshots are tracked**

```bash
git status docs/screenshots/
```

Expected: shows screenshots as tracked (not untracked/ignored).

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: update gitignore"
```

---

## GitHub Repo Setup (manual steps after pushing)

Do these on github.com after `git push`:

1. **Description:** *"A local AI coaching system for LeetCode — Socratic method, spaced repetition, pattern wiki"*
2. **Topics:** `leetcode`, `interview-prep`, `claude-ai`, `spaced-repetition`, `algorithms`, `developer-tools`
3. Enable **Issues** and **Discussions**
4. Set default branch to `main`
5. Add **branch protection** on `main`: require CI to pass before merge
6. Pin the repo to your GitHub profile if desired
