# LeetCode Coach — Stage 5: Visualizer Design

**Date:** 2026-06-14
**Status:** Approved
**Parent spec:** `docs/superpowers/specs/2026-06-12-leetcode-coach-design.md`

## Goal

Let the coach generate on-demand animated explanations of algorithm/data-structure flows when
the user struggles to *see* how something works — array cells lighting up, pointers sliding, a
DP grid filling, a tree/graph traversal, a recursion stack growing and unwinding. Each
animation is a **bespoke** self-contained-logic HTML file per concept, but leans on a **small
shared kit** so playback controls and styling stay consistent and reliable instead of being
rewritten from scratch every time. Files are **served by the coach server** at
`http://localhost:8765/viz/<name>` so the coach can hand the user a stable URL.

## Decisions (locked during brainstorming)

1. **Bespoke per concept.** The coach writes a fresh HTML file per concept (maximum
   flexibility), rather than choosing from a fixed template library or driving a generic
   trace player.
2. **Small shared kit.** A served `viz-kit.css` + `viz-kit.js` provides play/step/reset
   controls, common cell/pointer/grid/node/stack styling, and a stepper helper. Bespoke files
   link to the kit, so each one supplies only its own data + `render(i)` logic.
3. **Server-served.** The server exposes the viz directory via `express.static`; the coach
   shares `http://localhost:8765/viz/<name>`. (Rejected: opening `file://` paths — no stable
   URL.)

## Architecture

The reusable, buildable core is the **kit**; each concept animation is a thin bespoke file
that supplies its own data and a `render(i)` function and delegates playback and styling to the
kit. No build step — plain `<link>`/`<script>`, consistent with the rest of the project (Node
ESM, no bundler).

```
public/viz/
  viz-kit.css          # shared visual primitives (cells, pointers, grid, nodes, stack, controls)
  viz-kit.js           # global `Viz` + pure stepper state machine + DOM control bar
  two-pointer-sorted.html   # worked example (canonical skeleton)
  <slug>-<concept>.html     # future bespoke files the coach authors on demand

src/server/app.js      # adds express.static(PUBLIC_DIR) so /viz/* resolves
src/config.js          # adds PUBLIC_DIR
```

Data flow: coach writes `public/viz/<name>.html` → server serves it at `/viz/<name>.html` →
coach shares the URL → user opens it in the browser and uses play/step/reset to watch the flow.

## The kit — `public/viz/viz-kit.js`

### Pure stepper state machine (unit-testable, no DOM)

Factored like `src/sr/scheduler.js` so the logic is testable without a browser. A factory
returns a controller object holding the current frame index and play state, calling `onChange`
whenever the index changes.

```js
// createStepper({ frameCount, onChange }) -> controller
//   controller.index            // current frame, 0..frameCount-1
//   controller.isPlaying        // boolean
//   controller.next()           // advance, clamp at frameCount-1 (no wrap)
//   controller.prev()           // retreat, clamp at 0
//   controller.seek(i)          // jump to clamped i
//   controller.reset()          // index -> 0, stop playing
//   controller.tick()           // advance one frame; auto-stops playing at the last frame
//   controller.toggle()         // flip isPlaying; if starting at the last frame, reset to 0 first
```

Semantics (these are what the tests pin down):
- `frameCount` is the number of frames; valid indices are `0 .. frameCount-1`.
- `next()` past the last frame is a no-op (clamps, does not wrap). `prev()` below 0 clamps to 0.
- `seek(i)` clamps `i` into range.
- `onChange(index)` fires on every actual index change (not on no-op clamps that don't move).
- Autoplay is driven by the host (the DOM layer supplies a timer), but the *advance* decision
  lives in the stepper: a `tick()` method advances one frame and automatically stops playing
  when it reaches the last frame, so playback halts at the end rather than looping. `toggle()`
  flips `isPlaying`; starting autoplay at the last frame first resets to 0 (replay).

> Keeping `tick`/`toggle`/clamping in the pure factory (rather than buried in DOM event
> handlers) is what makes the behavior testable and keeps the DOM layer thin.

### DOM layer — `Viz.create(opts)`

A thin wrapper that renders the control bar and wires it to a stepper.

```js
Viz.create({
  mount,        // HTMLElement that receives the control bar
  frameCount,   // integer number of frames
  render,       // (index) => void, called on every frame change AND once on init
  speed = 700,  // autoplay interval in ms
}) // -> the stepper controller (so callers can drive it programmatically/tests)
```

Behavior:
- Renders a control bar (class `viz-controls`) with: reset (⏮), prev (◀), play/pause toggle
  (▶ / ⏸), next (▶▶), a frame counter (`<current+1> / <frameCount>`), and a speed control.
- Calls `render(index)` once immediately (frame 0) and again on every index change.
- Play uses `setInterval(speed)` calling `controller.tick()`; the interval is cleared when
  autoplay stops (either user pause or auto-stop at the last frame).
- Keyboard: `ArrowRight` = next, `ArrowLeft` = prev, `Space` = toggle play/pause.
- Global is exposed as `window.Viz` for plain-script bespoke files; also exported as an ES
  module named export `Viz` (and `createStepper`) so tests can import it.

## The kit — `public/viz/viz-kit.css`

A compact class set that covers every structure the parent spec lists, plus the controls:

- Arrays & DP grids: `.viz-stage`, `.viz-row`, `.viz-grid`, `.viz-cell`, and state modifiers
  `.viz-cell--active`, `.viz-cell--match`, `.viz-cell--done`.
- Pointers: `.viz-pointer` (a labeled marker that sits under/over a cell).
- Trees & graphs: `.viz-node`, `.viz-node--active`, `.viz-edge`.
- Recursion: `.viz-stack`, `.viz-frame`, `.viz-frame--active`.
- Chrome: `.viz-controls`, `.viz-note` (a caption line explaining the current step).

A clean default theme (readable colors, monospace numerals, subtle transitions on the cell
state classes so changes animate). No external fonts or CDN assets — fully local.

## Bespoke concept files

Each file is the coach's per-concept work. Canonical skeleton (also the worked example
`two-pointer-sorted.html`):

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Two pointers on a sorted array</title>
  <link rel="stylesheet" href="/viz/viz-kit.css" />
</head>
<body>
  <h1>Two pointers — find a pair summing to target</h1>
  <div id="stage" class="viz-stage"></div>
  <div id="note" class="viz-note"></div>
  <div id="controls"></div>

  <script type="module">
    import { Viz } from "/viz/viz-kit.js";

    const data = [1, 3, 4, 6, 8, 11];
    const target = 10;
    // Precompute frames: each frame = { lo, hi, sum, status, note }
    const frames = buildFrames(data, target);

    function render(i) {
      const f = frames[i];
      // draw cells, mark f.lo/f.hi as active, f.match when found, update #note
    }

    Viz.create({ mount: document.getElementById("controls"), frameCount: frames.length, render });

    function buildFrames(arr, t) { /* ... bespoke logic ... */ }
  </script>
</body>
</html>
```

The logic (`buildFrames`, `render`) is fully bespoke; only the controls, the stepper, and the
CSS classes come from the kit.

## Server change

`src/server/app.js` mounts static serving of the public directory so the kit and concept files
resolve under `/viz/...`:

```js
import path from "node:path";
// inside createApp, after JSON + CORS middleware:
app.use(express.static(PUBLIC_DIR)); // PUBLIC_DIR contains the `viz/` folder
```

`PUBLIC_DIR` is added to `src/config.js` (`path.join(root, "public")`). `createApp` gains an
optional parameter (or imports the config) so tests can point it at the real public dir.
Static serving is added *after* the `/event` and `/health` routes are unaffected; a request for
`/viz/viz-kit.js` returns the file with the correct `Content-Type`.

## Skill integration — `.claude/skills/leetcode-coaching/SKILL.md`

Add a **Layer 3 — Visualize a flow** section:

- **When:** the user is stuck *seeing how a mechanic works* (how a pointer scan progresses, how
  a DP cell depends on its neighbors, how recursion unwinds) — not when they're stuck on the
  answer.
- **Anti-spoiler guardrail (critical):** never animate the optimal solution to the *current*
  problem. Only visualize (a) a generic, problem-independent mechanic, or (b) the user's *own*
  proposed approach — including watching their broken approach break (this dovetails with the
  Idea-Engagement Loop's "stress-test by discovery"). Visualizing must serve understanding, not
  hand over the answer.
- **How:** write a bespoke file to `public/viz/<slug>-<concept>.html` using the kit
  (`/viz/viz-kit.css`, `/viz/viz-kit.js`), then share `http://localhost:8765/viz/<slug>-<concept>`.
  Reference the worked example as the skeleton to copy.

## Testing

- `tests/viz/stepper.test.js` — the pure stepper: `next`/`prev`/`seek` clamping (no wrap),
  `reset`, `toggle` flipping play state, `tick` advancing and auto-stopping at the last frame,
  replay-from-end behavior, and that `onChange` fires only on real index changes. (Mirrors the
  scheduler's pure-function test style.)
- `tests/server.viz.test.js` — supertest against `createApp`: `GET /viz/viz-kit.js` → 200 with
  a JavaScript content-type; `GET /viz/viz-kit.css` → 200 CSS; `GET /viz/two-pointer-sorted.html`
  → 200 HTML; and that the existing `GET /health` still works (no regression from adding
  static middleware).
- The worked example `two-pointer-sorted.html` is verified visually (manual, or optional
  Playwright snapshot) — animation correctness is subjective and not asserted in unit tests.

## Scope

### In scope (Stage 5)
- `public/viz/viz-kit.js` (pure stepper + `Viz.create` DOM layer) and `public/viz/viz-kit.css`.
- `express.static` serving of `public/` + `PUBLIC_DIR` config.
- One worked example bespoke file (`two-pointer-sorted.html`) as the canonical skeleton.
- `SKILL.md` "Layer 3 — Visualize a flow" section with the anti-spoiler guardrail.
- Tests for the stepper and for static serving.

### Out of scope (v2+)
- A library of many prebuilt animations (the rejected template approach).
- A `coach viz` CLI command (the coach writes files directly).
- Recording/exporting animations (GIF/video) or screenshot capture.
- Embedding the visualizer in the (future) injected sidebar UI.
- Auto-generating animations from the user's actual submitted code.
