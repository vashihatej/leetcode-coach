# LeetCode Coach

A local interview coach that combines a Claude Code coaching skill, a Chrome extension,
SQLite history and spaced repetition, and animated algorithm visualizations.

## What It Does

- Streams the current LeetCode problem statement, examples, constraints, tags, code, and latest
  verdict into `session.md`.
- Coaches from your first instinct instead of jumping to the solution.
- Uses a five-step framework: restate, examples and edges, brute force, bottleneck, pattern.
- Explains algorithms and data structures with analogy-based learning, such as stacks as plates
  or queues as checkout lines.
- Escalates hints gradually and records which hints were needed.
- Tracks pattern exposure, whether your instinct fired, mastery, attempts, and review dates.
- Serves interactive visualizations with synchronized code and state panels.

## Setup

```bash
npm install
npm test
npm start
```

The server binds to `127.0.0.1:8765` by default. Override it with `COACH_HOST` or
`COACH_PORT` only when needed.

### Chrome Extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked** and select this repository's `extension/` directory.
4. Open a LeetCode problem while `npm start` is running.

Click the extension icon to see whether the local coach server is connected. You can also inspect
the current captured session with:

```bash
node src/cli/coach.js status
```

## Coaching Skill

The reusable skill is at `.claude/skills/leetcode-coaching/SKILL.md`. Start Claude Code from
this repository and ask to work through the problem currently open in LeetCode.

The coach first asks what came to mind, classifies the idea as wrong, partially correct, or
correct, and then guides the framework one step at a time. Once the approach is understood, or
you explicitly ask to see it, the coach provides an implementation plan, Python solution,
complexity, edge cases, common mistakes, recognition signals, analogy-based explanations, and a
memory hook.

## CLI

```bash
node src/cli/coach.js status
node src/cli/coach.js mastery
node src/cli/coach.js review-due
node src/cli/coach.js set-mastery --pattern "sliding window" --level solid
node src/cli/coach.js log-attempt \
  --slug two-sum \
  --solved \
  --result optimal \
  --patterns "hashing" \
  --instinct-fired \
  --hints 1,2 \
  --approach "one-pass complement map"
```

`--instinct-fired` means the learner named the recorded pattern before the coach revealed it.
Logging an attempt automatically updates pattern metrics and schedules the next review.

## Visualizations

With the server running:

- `http://127.0.0.1:8765/viz/two-pointer-sorted.html`
- `http://127.0.0.1:8765/viz/recursion-subsets.html`

The shared kit supports play, pause, reset, stepping, scrubbing, speed adjustment, keyboard
controls, multiple highlighted code lines, synchronized state, and optional local Three.js
loading through `controller.threeReady`.

## Data

- `coach.db`: problems, attempts, patterns, pattern links, and spaced-repetition queue.
- `session.md`: current problem and editor state, overwritten by extension events.

Both files are local and ignored by Git.
