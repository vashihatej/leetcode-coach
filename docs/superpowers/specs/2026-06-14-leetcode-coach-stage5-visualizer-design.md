# LeetCode Coach — Stage 5: Visualizer Design

**Date:** 2026-06-14
**Status:** Approved
**Parent spec:** `docs/superpowers/specs/2026-06-12-leetcode-coach-design.md`

## Goal

Let the coach generate genuinely great on-demand **motion** animations that make any concept,
logic, or whole problem legible — from easy array/two-pointer flows to hard recursive/backtracking
flows where the user needs to *see* the call tree grow and unwind, watch each line of code mutate
state, and follow how data moves. Animations interpolate smoothly between states (3Blue1Brown /
Manim-style easing and motion), adapt their representation to the problem type, and pair the visual
with a synced source-code + variable-state panel so the user sees exactly how each line affects the
data. Each animation is a **bespoke** HTML file per concept, but leans on a **shared kit** (motion
engine, controls, code/state panels, rich 2D primitives, and a locally-vendored 3D engine) so the
hard parts are reused and stay reliable. Files are **served by the coach server** at
`http://localhost:8765/viz/<name>`.

## Decisions (locked during brainstorming)

1. **Bespoke per concept.** The coach writes a fresh HTML file per concept (maximum
   flexibility), rather than choosing from a fixed template library or driving a generic
   trace player.
2. **Shared kit.** A served `viz-kit.css` + `viz-kit.js` provides the motion/timeline engine,
   playback controls, the synced code+state panels, and rich 2D rendering primitives
   (cells, pointers, grids, nodes/edges, call-tree, stack). Bespoke files supply only their own
   data, the source-code listing, and `render(index, t)`.
3. **Hybrid 2D + vendored 3D.** Default rendering is rich 2D (SVG/Canvas/CSS with smooth
   motion). A locally-vendored 3D engine (Three.js, `public/viz/vendor/three.module.js`) is
   available for concepts where real depth helps — 3D recursion trees, DP cubes, layered graph
   traversal — with orbit camera plus the same step controls. Vendored, not CDN, so everything
   runs locally.
4. **Synced code + state panel.** Every visualization shows the algorithm's source beside the
   animation, highlighting the executing line per keyframe and displaying the current variables,
   so "how each line of logic affects state" is explicit (Python-Tutor-style, but animated).
5. **Motion, not slideshow.** Transitions between keyframes are interpolated over a duration
   with easing; pointers glide, nodes appear/move, bars grow. Stepping animates the single
   transition; play runs continuous motion.
6. **No anti-spoiler restriction on visualizing.** The coach may visualize anything the user
   asks for — including the optimal solution to the current problem. (Visualizing is a teaching
   tool; the broader coaching skill still decides *when* leading the user is better than showing,
   but the visualizer itself imposes no content restriction.)
7. **Server-served.** The server exposes the viz directory via `express.static`; the coach
   shares `http://localhost:8765/viz/<name>`. (Rejected: opening `file://` paths — no stable
   URL, and ES-module/vendored imports are cleaner over http.)

## Architecture

The reusable, buildable core is the **kit**; each concept animation is a bespoke file that
supplies its own data, source listing, and a `render(index, t)` function, delegating motion,
playback, and the code/state panels to the kit. No build step — plain `<link>` + ES-module
`<script type="module">`, consistent with the rest of the project (Node ESM, no bundler).

```
public/viz/
  viz-kit.css               # rich theme: stage, cells, pointers, grid, nodes/edges,
                            #   call-tree, stack, code panel, state table, controls
  viz-kit.js                # ES module: pure stepper + pure timeline/easing core,
                            #   the Viz.create() DOM layer (motion loop, code+state panels)
  vendor/three.module.js    # locally-vendored 3D engine (no CDN)
  two-pointer-sorted.html   # worked example A: 2D motion + code/state panel (the skeleton)
  recursion-subsets.html    # worked example B: animated call tree (the "complex flow" case)
  <slug>-<concept>.html     # future bespoke files the coach authors on demand

src/server/app.js           # adds express.static(PUBLIC_DIR) so /viz/* resolves
src/config.js               # adds PUBLIC_DIR
```

Data flow: coach writes `public/viz/<name>.html` → server serves it (and the kit + vendored 3D)
under `/viz/...` → coach shares the URL → user opens it and uses play/step/scrub to watch the
flow, reading the synced code + variables alongside the motion.

## The kit — `public/viz/viz-kit.js`

Two pure cores (unit-testable, no DOM) plus a thin DOM/motion layer. The pure cores mirror the
style of `src/sr/scheduler.js`.

### Pure core 1 — stepper state machine (keyframes)

```js
// createStepper({ frameCount, onChange }) -> controller
//   controller.index        // current keyframe, 0..frameCount-1
//   controller.isPlaying     // boolean
//   controller.next()        // advance, clamp at frameCount-1 (no wrap)
//   controller.prev()        // retreat, clamp at 0
//   controller.seek(i)       // jump to clamped i
//   controller.reset()       // index -> 0, stop playing
//   controller.tick()        // advance one keyframe; auto-stops playing at the last frame
//   controller.toggle()      // flip isPlaying; if starting at the last frame, reset to 0 first
```

Semantics the tests pin down:
- Valid indices are `0 .. frameCount-1`. `next()`/`prev()` clamp (no wrap); `seek(i)` clamps.
- `onChange(index)` fires only on a real index change (no-op clamps that don't move don't fire).
- `tick()` advances one keyframe and auto-stops playing at the last; `toggle()` flips
  `isPlaying`, and starting playback while already at the last keyframe resets to 0 first (replay).

### Pure core 2 — motion timeline / easing

```js
// easeInOutCubic(t) -> number   // t in [0,1], clamped
// sampleTimeline({ elapsed, duration }) -> { t, done }
//   t    = eased progress in [0,1] of the current transition
//   done = true once elapsed >= duration
// lerp(a, b, t) -> number       // linear interpolate (used by bespoke render for positions)
```

This is what makes motion smooth and testable: given the elapsed ms within a keyframe transition
and the transition `duration`, it returns the eased `t` the renderer should draw at. The bespoke
`render(index, t)` uses `t` (and `lerp`) to interpolate positions between keyframe `index-1` and
`index` (or to animate the entrance of keyframe `index`). Discrete renders pass `t = 1`.

### DOM / motion layer — `Viz.create(opts)`

```js
Viz.create({
  mount,            // HTMLElement that receives the control bar
  frameCount,       // integer number of keyframes
  render,           // (index, t) => void; called every animation frame during a transition
                    //   and once on init at (0, 1)
  code,             // optional: { source: string, lineForFrame: (i)=>number|number[] }
  state,            // optional: (i) => Array<[label, value]>  rows for the variable panel
  duration = 600,   // ms per keyframe transition
  three = false,    // if true, expose a Three.js scene helper to render (advanced/3D files)
}) // -> the stepper controller (so callers/tests can drive it programmatically)
```

Behavior:
- Renders a control bar (`.viz-controls`): reset (⏮), prev (◀), play/pause (▶ / ⏸), next (▶▶),
  a keyframe counter (`<index+1> / <frameCount>`), a scrubber, and a speed control.
- Drives motion with a `requestAnimationFrame` loop: on a keyframe change it animates `t` from
  0→1 over `duration` using `sampleTimeline` + easing, calling `render(index, t)` each frame; in
  play mode it chains into the next keyframe via `controller.tick()` until the end.
- If `code` is supplied, renders a source panel and highlights `lineForFrame(index)` in sync.
- If `state` is supplied, renders a variable table updated per keyframe.
- Keyboard: `ArrowRight`/`ArrowLeft` step, `Space` toggles play/pause.
- Exposed both as `window.Viz` (for convenience) and as ES-module named exports
  (`Viz`, `createStepper`, `sampleTimeline`, `easeInOutCubic`, `lerp`) so tests can import them.

## The kit — `public/viz/viz-kit.css`

A rich, readable theme (dark default, monospace numerals, GPU-friendly transforms for motion).
Class set covers every structure the parent spec lists, plus the panels:

- Layout: `.viz-app` (code | stage split), `.viz-stage`, `.viz-code`, `.viz-state`, `.viz-note`.
- Arrays & DP grids: `.viz-row`, `.viz-grid`, `.viz-cell` + `--active` / `--match` / `--done`.
- Pointers: `.viz-pointer` (labeled marker; positioned via transform for smooth glide).
- Trees / graphs / recursion: `.viz-node` + `--active`, `.viz-edge`, `.viz-tree`, `.viz-stack`,
  `.viz-frame` + `--active`.
- Code panel: `.viz-code-line` + `.viz-code-line--current` (highlighted executing line).
- Controls: `.viz-controls`, scrubber + speed.

No external fonts or CDN assets — fully local.

## Bespoke concept files

Each file is the coach's per-concept work. Canonical skeleton (worked example A,
`two-pointer-sorted.html`): rich 2D motion + synced code/state.

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Two pointers on a sorted array</title>
  <link rel="stylesheet" href="/viz/viz-kit.css" />
</head>
<body class="viz-app">
  <pre id="code" class="viz-code"></pre>
  <div class="viz-stagewrap">
    <div id="stage" class="viz-stage"></div>
    <table id="state" class="viz-state"></table>
    <div id="note" class="viz-note"></div>
    <div id="controls"></div>
  </div>

  <script type="module">
    import { Viz, lerp } from "/viz/viz-kit.js";

    const data = [1, 3, 4, 6, 8, 11], target = 10;
    const keyframes = buildKeyframes(data, target); // [{lo,hi,sum,status,line,vars,note}, ...]

    function render(i, t) {
      const prev = keyframes[Math.max(0, i - 1)], f = keyframes[i];
      // draw cells; glide the lo/hi pointer markers from prev->f using lerp(...,t);
      // apply --active/--match classes; update #note
    }

    Viz.create({
      mount: document.getElementById("controls"),
      frameCount: keyframes.length,
      render,
      code: { source: SOURCE, lineForFrame: (i) => keyframes[i].line },
      state: (i) => Object.entries(keyframes[i].vars),
    });

    const SOURCE = `lo, hi = 0, len(a)-1\nwhile lo < hi:\n  s = a[lo] + a[hi]\n  if s == target: return [lo, hi]\n  elif s < target: lo += 1\n  else: hi -= 1`;
    function buildKeyframes(a, t) { /* bespoke logic produces the keyframe list */ }
  </script>
</body>
</html>
```

Worked example B (`recursion-subsets.html`) demonstrates the **complex-flow** case the user
cares about most: an animated recursion **call tree** for generating subsets/backtracking —
nodes spawn as calls are made, the current path lights up, the tree unwinds on return, the code
panel highlights the line at each call/return, and the state panel shows the current `path` and
choices. This is the template for hard recursive problems; a 3D variant (`three: true`) can lay
the call tree out in depth when breadth gets crowded.

The logic (`buildKeyframes`, `render`, source listing) is fully bespoke; the motion engine,
controls, code/state panels, and CSS come from the kit.

## Server change

`src/server/app.js` mounts static serving of the public directory so the kit, the vendored 3D
engine, and concept files resolve under `/viz/...`:

```js
// inside createApp, after JSON + CORS middleware, leaving /event and /health intact:
app.use(express.static(PUBLIC_DIR)); // PUBLIC_DIR contains the `viz/` folder
```

`PUBLIC_DIR` is added to `src/config.js` (`path.join(root, "public")`). `createApp` takes it as
a parameter (defaulting to the config value) so tests can point at the real public dir. A request
for `/viz/viz-kit.js` returns the file with the correct `Content-Type`.

## Skill integration — `.claude/skills/leetcode-coaching/SKILL.md`

Add a **Layer 3 — Visualize a flow** section:

- **When:** the user is stuck *seeing how something works* — a pointer scan, how a DP cell
  depends on its neighbors, how recursion spawns and unwinds, or how each line of an approach
  mutates state. Also on direct request ("show me this animated", "visualize the optimal
  solution").
- **No content restriction:** visualize whatever helps, including the optimal solution to the
  current problem if asked. The broader coaching judgment about leading-vs-showing still applies
  to the *conversation*, but the visualizer tool itself is unrestricted.
- **How:** write a bespoke file to `public/viz/<slug>-<concept>.html` using the kit
  (`/viz/viz-kit.css`, `/viz/viz-kit.js`, and `/viz/vendor/three.module.js` for 3D), always
  including the synced code + state panels so the user connects each line to its effect. Pick the
  representation that fits the problem type (array row, DP grid, call tree, graph, stack; 2D by
  default, 3D when depth clarifies). Then share `http://localhost:8765/viz/<slug>-<concept>`.
  Copy from the worked examples (A for linear/2D, B for recursive/complex).

## Testing

- `tests/viz/stepper.test.js` — pure stepper: `next`/`prev`/`seek` clamping (no wrap), `reset`,
  `toggle` play-state flips, `tick` advancing + auto-stop at last frame, replay-from-end, and
  `onChange` firing only on real index changes.
- `tests/viz/timeline.test.js` — pure motion core: `easeInOutCubic` endpoints/clamping/midpoint,
  `lerp`, and `sampleTimeline` returning eased `t` and `done` correctly across elapsed/duration
  boundaries (including `elapsed >= duration` → `{ t: 1, done: true }`).
- `tests/server.viz.test.js` — supertest against `createApp`: `GET /viz/viz-kit.js` → 200 JS,
  `GET /viz/viz-kit.css` → 200 CSS, `GET /viz/vendor/three.module.js` → 200 JS,
  `GET /viz/two-pointer-sorted.html` → 200 HTML, and `GET /health` still works (no regression).
- The worked example files and overall animation quality are verified visually (manual, or
  optional Playwright) — motion/animation quality is subjective and not asserted in unit tests.

## Scope

### In scope (Stage 5)
- `public/viz/viz-kit.js` (pure stepper + pure timeline/easing cores + `Viz.create` motion/DOM
  layer with synced code + state panels) and `public/viz/viz-kit.css` (rich theme + primitives).
- Locally-vendored `public/viz/vendor/three.module.js` and a 3D-capable path in the kit.
- `express.static` serving of `public/` + `PUBLIC_DIR` config (parameterized into `createApp`).
- Two worked examples: A (2D motion two-pointer + code/state) and B (animated recursion call
  tree), as the canonical skeletons for linear vs. complex flows.
- `SKILL.md` "Layer 3 — Visualize a flow" section (no content restriction; always include the
  code/state panels; pick representation by problem type).
- Tests for the stepper, the timeline core, and static serving.

### Out of scope (v2+)
- A library of many prebuilt animations (the rejected template approach) — the kit + examples
  are the foundation; concept files are authored on demand.
- A `coach viz` CLI command (the coach writes files directly).
- Recording/exporting animations (GIF/video) or screenshot capture.
- Embedding the visualizer in the (future) injected sidebar UI.
- Auto-generating animations from the user's actual submitted code (the coach hand-authors
  keyframes + source listing per concept for now).
