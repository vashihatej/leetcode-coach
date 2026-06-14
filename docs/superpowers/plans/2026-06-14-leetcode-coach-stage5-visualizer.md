# LeetCode Coach Stage 5 — Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable visualization kit + two worked examples that animate any algorithm/concept with smooth motion, a synced source-code panel, and a live variable/state table — so the user can *see* how each line of logic changes state.

**Architecture:** A shared kit (`public/viz/viz-kit.js` + `viz-kit.css`) holds two pure, DOM-free cores — a frame stepper and a timeline sampler (tween/easing) — plus a thin DOM/motion layer (`Viz.create`) that wires controls, the code panel, the state table, and a per-frame `render(index, t)` callback driven by `requestAnimationFrame`. Bespoke per-concept HTML files supply their own data, source listing, and `render` function, linking to the kit. Three.js is vendored locally for true-depth 3D when a concept needs it. The Express server serves the `public/` dir via `express.static`, so the coach shares `http://localhost:8765/viz/<name>.html`.

**Tech Stack:** Node ESM, Express (existing server), vitest + jsdom (^24) for tests, vendored Three.js (0.160.0), plain SVG/Canvas/CSS for 2D motion. No build step — files are served as-is.

---

## File Structure

- `public/viz/viz-kit.js` — **Create.** The kit. Two pure cores (`createStepper`, and timeline helpers `easeInOutCubic`/`lerp`/`sampleTimeline`) + the DOM/motion layer `Viz.create`. Pure cores are exported as named exports (node-testable, no DOM); `Viz` is exported and also attached to `window` behind a guard so jsdom/browser get it without breaking node-env tests.
- `public/viz/viz-kit.css` — **Create.** Dark theme, grid layout (code panel | stage), and all reusable visual primitives (array cells, pointers, tree nodes/edges, state table, controls).
- `public/viz/vendor/three.module.js` — **Create (vendored copy).** Local Three.js so the tool runs fully offline.
- `public/viz/two-pointer-sorted.html` — **Create.** Worked example A: two-pointer on a sorted array, 2D motion + code/state panels.
- `public/viz/recursion-subsets.html` — **Create.** Worked example B: subsets via backtracking, animated recursion call tree.
- `src/config.js` — **Modify.** Add `PUBLIC_DIR`.
- `src/server/app.js` — **Modify.** Parameterize `createApp` with `publicDir` and mount `express.static`.
- `tests/viz/stepper.test.js` — **Create.** Pure stepper tests (node env).
- `tests/viz/timeline.test.js` — **Create.** Pure timeline tests (node env).
- `tests/viz/create.test.js` — **Create.** `Viz.create` DOM wiring tests (jsdom env).
- `tests/server.viz.test.js` — **Create.** Static-serving tests (supertest).
- `.claude/skills/leetcode-coaching/SKILL.md` — **Modify.** Add "Layer 3 — Visualize a flow".

---

### Task 1: Pure frame stepper

**Files:**
- Create: `public/viz/viz-kit.js`
- Test: `tests/viz/stepper.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/viz/stepper.test.js
import { describe, it, expect, vi } from "vitest";
import { createStepper } from "../../public/viz/viz-kit.js";

describe("createStepper", () => {
  it("starts at index 0 and not playing", () => {
    const s = createStepper({ frameCount: 3 });
    expect(s.index).toBe(0);
    expect(s.isPlaying).toBe(false);
  });

  it("next advances and fires onChange, clamping at the end", () => {
    const onChange = vi.fn();
    const s = createStepper({ frameCount: 2, onChange });
    expect(s.next()).toBe(1);
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(s.next()).toBe(1); // clamped
    expect(onChange).toHaveBeenCalledTimes(1); // no change => no fire
  });

  it("prev clamps at 0", () => {
    const s = createStepper({ frameCount: 3 });
    expect(s.prev()).toBe(0);
  });

  it("seek clamps and only fires onChange on a real change", () => {
    const onChange = vi.fn();
    const s = createStepper({ frameCount: 5, onChange });
    expect(s.seek(10)).toBe(4);
    expect(s.seek(4)).toBe(4); // same index, no fire
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reset returns to 0 and stops", () => {
    const s = createStepper({ frameCount: 4 });
    s.seek(3);
    s.toggle();
    s.reset();
    expect(s.index).toBe(0);
    expect(s.isPlaying).toBe(false);
  });

  it("tick advances and auto-stops at the last frame", () => {
    const s = createStepper({ frameCount: 2 });
    s.toggle(); // playing
    expect(s.tick()).toBe(1);
    expect(s.tick()).toBe(1);
    expect(s.isPlaying).toBe(false);
  });

  it("toggle flips playing and replays from 0 if at last frame", () => {
    const s = createStepper({ frameCount: 3 });
    s.seek(2);
    expect(s.toggle()).toBe(true);
    expect(s.index).toBe(0); // replay reset
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/viz/stepper.test.js --testTimeout=60000`
Expected: FAIL — cannot import `createStepper` (file does not exist).

- [ ] **Step 3: Write minimal implementation**

```js
// public/viz/viz-kit.js
export function createStepper({ frameCount, onChange = () => {} }) {
  let index = 0;
  let isPlaying = false;
  const clamp = (i) => Math.max(0, Math.min(frameCount - 1, i));
  function set(i) {
    const c = clamp(i);
    if (c !== index) {
      index = c;
      onChange(index);
    }
    return index;
  }
  return {
    get index() { return index; },
    get isPlaying() { return isPlaying; },
    next() { return set(index + 1); },
    prev() { return set(index - 1); },
    seek(i) { return set(i); },
    reset() { isPlaying = false; set(0); },
    tick() {
      if (index >= frameCount - 1) { isPlaying = false; return index; }
      return set(index + 1);
    },
    toggle() {
      if (!isPlaying && index >= frameCount - 1) { set(0); }
      isPlaying = !isPlaying;
      return isPlaying;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/viz/stepper.test.js --testTimeout=60000`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add public/viz/viz-kit.js tests/viz/stepper.test.js
git commit -m "feat(viz): add pure frame stepper core"
```

---

### Task 2: Pure timeline / tween core

**Files:**
- Modify: `public/viz/viz-kit.js` (append)
- Test: `tests/viz/timeline.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/viz/timeline.test.js
import { describe, it, expect } from "vitest";
import { easeInOutCubic, lerp, sampleTimeline } from "../../public/viz/viz-kit.js";

describe("easeInOutCubic", () => {
  it("pins endpoints and midpoint", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
  });
  it("clamps out-of-range input", () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });
});

describe("lerp", () => {
  it("interpolates linearly", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

describe("sampleTimeline", () => {
  it("returns eased t and done flag", () => {
    expect(sampleTimeline({ elapsed: 0, duration: 100 })).toEqual({ t: 0, done: false });
    const mid = sampleTimeline({ elapsed: 50, duration: 100 });
    expect(mid.t).toBeCloseTo(0.5, 5);
    expect(mid.done).toBe(false);
    expect(sampleTimeline({ elapsed: 100, duration: 100 })).toEqual({ t: 1, done: true });
    expect(sampleTimeline({ elapsed: 150, duration: 100 })).toEqual({ t: 1, done: true });
  });
  it("treats zero duration as instantly done", () => {
    expect(sampleTimeline({ elapsed: 0, duration: 0 })).toEqual({ t: 1, done: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/viz/timeline.test.js --testTimeout=60000`
Expected: FAIL — `easeInOutCubic`/`lerp`/`sampleTimeline` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `public/viz/viz-kit.js`:

```js
export function easeInOutCubic(t) {
  t = Math.max(0, Math.min(1, t));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function sampleTimeline({ elapsed, duration }) {
  if (duration <= 0) return { t: 1, done: true };
  const raw = Math.max(0, Math.min(1, elapsed / duration));
  return { t: easeInOutCubic(raw), done: elapsed >= duration };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/viz/timeline.test.js --testTimeout=60000`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/viz/viz-kit.js tests/viz/timeline.test.js
git commit -m "feat(viz): add pure timeline tween core"
```

---

### Task 3: Viz.create DOM/motion layer

**Files:**
- Modify: `public/viz/viz-kit.js` (append)
- Test: `tests/viz/create.test.js`

This layer wires a stepper to the DOM: builds the control bar (reset/prev/play/next + counter + scrubber + speed), paints the code panel (highlighting the executing line), paints the state table, and runs the per-frame `render(index, t)` motion via `requestAnimationFrame`. `paintPanels` runs *synchronously* on every index change so panels are correct immediately (tests rely on this); `render` is the smooth-motion callback.

**Public API:**
```
Viz.create({
  controls,      // HTMLElement for the control bar
  frameCount,    // number of frames
  render,        // (index, t) => void   t in [0,1], smooth motion
  codeEl,        // optional HTMLElement for the source listing
  source,        // optional string, one line of code per text line
  lineForFrame,  // optional (index) => number  (0-based line to highlight)
  stateEl,       // optional HTMLElement for the variable table
  stateRows,     // optional (index) => Array<[key, value]>
  noteEl,        // optional HTMLElement for the caption
  note,          // optional (index) => string
  duration = 600 // ms per transition
}) => stepper
```

- [ ] **Step 1: Write the failing test**

```js
// tests/viz/create.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Viz } from "../../public/viz/viz-kit.js";

beforeEach(() => {
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  document.body.innerHTML = `
    <div id="controls"></div>
    <pre id="code"></pre>
    <div id="state"></div>
    <div id="note"></div>
    <div id="stage"></div>`;
});

function setup() {
  const render = vi.fn();
  const stepper = Viz.create({
    controls: document.getElementById("controls"),
    frameCount: 3,
    render,
    codeEl: document.getElementById("code"),
    source: "a\nb\nc",
    lineForFrame: (i) => i,
    stateEl: document.getElementById("state"),
    stateRows: (i) => [["i", String(i)]],
    noteEl: document.getElementById("note"),
    note: (i) => `note${i}`,
  });
  return { render, stepper };
}

describe("Viz.create", () => {
  it("builds controls, counter, and code lines and paints frame 0", () => {
    const { render } = setup();
    const buttons = document.querySelectorAll("#controls button");
    expect(buttons.length).toBe(4);
    expect(document.querySelector(".viz-counter").textContent).toBe("1 / 3");
    const lines = document.querySelectorAll(".viz-code-line");
    expect(lines.length).toBe(3);
    expect(lines[0].classList.contains("viz-code-line--current")).toBe(true);
    expect(document.querySelector(".viz-state-key").textContent).toBe("i");
    expect(document.getElementById("note").textContent).toBe("note0");
    expect(render).toHaveBeenCalledWith(0, 1);
  });

  it("updates panels synchronously when the index changes", () => {
    const { stepper } = setup();
    stepper.next();
    expect(document.querySelector(".viz-counter").textContent).toBe("2 / 3");
    const lines = document.querySelectorAll(".viz-code-line");
    expect(lines[1].classList.contains("viz-code-line--current")).toBe(true);
    expect(lines[0].classList.contains("viz-code-line--current")).toBe(false);
    expect(document.getElementById("note").textContent).toBe("note1");
    expect(document.querySelector(".viz-state-val").textContent).toBe("1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/viz/create.test.js --testTimeout=60000`
Expected: FAIL — `Viz` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `public/viz/viz-kit.js`:

```js
function renderCode(codeEl, source) {
  codeEl.innerHTML = "";
  const lines = source.split("\n");
  return lines.map((text) => {
    const div = document.createElement("div");
    div.className = "viz-code-line";
    div.textContent = text === "" ? " " : text;
    codeEl.appendChild(div);
    return div;
  });
}

function createButton(label) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  return b;
}

const Viz = {
  create({
    controls,
    frameCount,
    render,
    codeEl,
    source,
    lineForFrame,
    stateEl,
    stateRows,
    noteEl,
    note,
    duration = 600,
  }) {
    let codeLines = [];
    if (codeEl && source != null) codeLines = renderCode(codeEl, source);

    const resetBtn = createButton("⏮");
    const prevBtn = createButton("◀");
    const playBtn = createButton("▶");
    const nextBtn = createButton("▶▶");

    const counter = document.createElement("span");
    counter.className = "viz-counter";

    const scrubber = document.createElement("input");
    scrubber.type = "range";
    scrubber.className = "viz-scrubber";
    scrubber.min = "0";
    scrubber.max = String(frameCount - 1);
    scrubber.step = "1";

    const speed = document.createElement("input");
    speed.type = "range";
    speed.className = "viz-speed";
    speed.min = "200";
    speed.max = "1600";
    speed.step = "100";
    speed.value = String(duration);

    controls.append(resetBtn, prevBtn, playBtn, nextBtn, counter, scrubber, speed);

    let rafId = null;
    let startTs = null;
    let fromIndex = 0;

    function paintPanels(i) {
      counter.textContent = `${i + 1} / ${frameCount}`;
      scrubber.value = String(i);
      playBtn.textContent = stepper.isPlaying ? "⏸" : "▶";
      if (codeLines.length && lineForFrame) {
        const ln = lineForFrame(i);
        codeLines.forEach((el, idx) =>
          el.classList.toggle("viz-code-line--current", idx === ln));
      }
      if (stateEl && stateRows) {
        stateEl.innerHTML = "";
        for (const [k, v] of stateRows(i)) {
          const row = document.createElement("div");
          row.className = "viz-state-row";
          const key = document.createElement("span");
          key.className = "viz-state-key";
          key.textContent = k;
          const val = document.createElement("span");
          val.className = "viz-state-val";
          val.textContent = v;
          row.append(key, val);
          stateEl.appendChild(row);
        }
      }
      if (noteEl && note) noteEl.textContent = note(i);
    }

    function frame(ts) {
      if (startTs == null) startTs = ts;
      const dur = Number(speed.value);
      const { t, done } = sampleTimeline({ elapsed: ts - startTs, duration: dur });
      render(stepper.index, t);
      if (!done) {
        rafId = requestAnimationFrame(frame);
        return;
      }
      rafId = null;
      startTs = null;
      if (stepper.isPlaying) {
        const before = stepper.index;
        stepper.tick();
        if (stepper.index === before) paintPanels(before); // hit the end
      }
    }

    function animateTo(i) {
      paintPanels(i);
      if (rafId != null) cancelAnimationFrame(rafId);
      startTs = null;
      rafId = requestAnimationFrame(frame);
    }

    const stepper = createStepper({
      frameCount,
      onChange: (i) => { fromIndex = i; animateTo(i); },
    });

    resetBtn.addEventListener("click", () => stepper.reset());
    prevBtn.addEventListener("click", () => stepper.prev());
    nextBtn.addEventListener("click", () => stepper.next());
    playBtn.addEventListener("click", () => {
      stepper.toggle();
      paintPanels(stepper.index);
      if (stepper.isPlaying) animateTo(stepper.index);
    });
    scrubber.addEventListener("input", () => stepper.seek(Number(scrubber.value)));

    paintPanels(0);
    render(0, 1);
    return stepper;
  },
};

export { Viz };
if (typeof window !== "undefined") window.Viz = Viz;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/viz/create.test.js --testTimeout=60000`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add public/viz/viz-kit.js tests/viz/create.test.js
git commit -m "feat(viz): add Viz.create DOM/motion layer"
```

---

### Task 4: Kit stylesheet

**Files:**
- Create: `public/viz/viz-kit.css`

No test (pure CSS). Verified visually when the example pages load in Task 6/7.

- [ ] **Step 1: Write the stylesheet**

```css
/* public/viz/viz-kit.css */
:root {
  --bg: #0d1117;
  --panel: #161b22;
  --line: #21262d;
  --fg: #e6edf3;
  --muted: #8b949e;
  --accent: #58a6ff;
  --active: #d29922;
  --match: #3fb950;
}

* { box-sizing: border-box; }

body.viz-app {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  display: grid;
  grid-template-columns: 360px 1fr;
  grid-template-rows: 1fr auto;
  height: 100vh;
}

.viz-code {
  grid-row: 1 / 3;
  margin: 0;
  padding: 16px;
  background: var(--panel);
  border-right: 1px solid var(--line);
  overflow: auto;
  white-space: pre;
}
.viz-code-line { padding: 1px 8px; border-radius: 4px; }
.viz-code-line--current { background: rgba(210, 153, 34, 0.2); color: #fff; }

.viz-stagewrap { display: flex; flex-direction: column; min-height: 0; padding: 16px; }
.viz-title { font-size: 16px; font-weight: 600; margin: 0 0 12px; }
.viz-stage { flex: 1; position: relative; min-height: 0; }
.viz-stage--svg svg { width: 100%; height: 100%; }

/* Array cells */
.viz-cell {
  position: absolute;
  width: 56px; height: 56px;
  display: flex; align-items: center; justify-content: center;
  background: var(--line); border: 2px solid transparent; border-radius: 8px;
  font-size: 18px; transition: background 0.2s, border-color 0.2s;
}
.viz-cell-val { font-weight: 600; }
.viz-cell-idx { position: absolute; bottom: -20px; font-size: 11px; color: var(--muted); }
.viz-cell--active { border-color: var(--active); }
.viz-cell--match { border-color: var(--match); background: rgba(63, 185, 80, 0.18); }

/* Pointers */
.viz-pointer {
  position: absolute;
  font-size: 12px; font-weight: 600;
  padding: 2px 6px; border-radius: 4px;
}
.viz-pointer--lo { color: #fff; background: var(--accent); }
.viz-pointer--hi { color: #fff; background: #bc8cff; }

/* Tree (recursion) */
.viz-node { fill: var(--line); stroke: transparent; stroke-width: 2; }
.viz-node--active { fill: rgba(210, 153, 34, 0.25); stroke: var(--active); }
.viz-node-label { fill: var(--fg); font-size: 12px; text-anchor: middle; dominant-baseline: middle; }
.viz-edge { stroke: var(--muted); stroke-width: 1.5; fill: none; }

/* State table */
.viz-state {
  grid-row: 2; grid-column: 2;
  border-top: 1px solid var(--line);
  padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 6px 18px;
}
.viz-state-row { display: flex; gap: 6px; }
.viz-state-key { color: var(--muted); }
.viz-state-val { color: var(--accent); font-weight: 600; }

.viz-note { color: var(--muted); margin-top: 8px; min-height: 1.5em; }

/* Controls */
.viz-controls {
  grid-column: 1 / 3;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; background: var(--panel); border-top: 1px solid var(--line);
}
.viz-controls button {
  background: var(--line); color: var(--fg); border: none;
  border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 14px;
}
.viz-controls button:hover { background: #30363d; }
.viz-counter { color: var(--muted); min-width: 60px; }
.viz-scrubber { flex: 1; }
.viz-speed { width: 120px; }
```

- [ ] **Step 2: Commit**

```bash
git add public/viz/viz-kit.css
git commit -m "feat(viz): add kit stylesheet"
```

---

### Task 5: Vendor Three.js

**Files:**
- Create: `public/viz/vendor/three.module.js`

- [ ] **Step 1: Install three as a dev dependency**

Run: `npm install -D --cache /tmp/coach-npm-cache three@0.160.0`
Expected: `three` added to devDependencies.

- [ ] **Step 2: Copy the ESM build into the vendor dir**

Run:
```bash
mkdir -p public/viz/vendor
cp node_modules/three/build/three.module.js public/viz/vendor/three.module.js
```

- [ ] **Step 3: Verify the file exists and is non-trivial**

Run: `wc -l public/viz/vendor/three.module.js`
Expected: thousands of lines.

- [ ] **Step 4: Commit**

```bash
git add public/viz/vendor/three.module.js package.json package-lock.json
git commit -m "feat(viz): vendor three.js for local 3D"
```

---

### Task 6: Worked example A — two-pointer on a sorted array (2D motion)

**Files:**
- Create: `public/viz/two-pointer-sorted.html`

No automated test (visual). Task 8 only asserts the file is served. Verify by opening `http://localhost:8765/viz/two-pointer-sorted.html`.

- [ ] **Step 1: Write the example page**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Two Pointer — Sorted Array</title>
  <link rel="stylesheet" href="/viz/viz-kit.css" />
</head>
<body class="viz-app">
  <pre id="code" class="viz-code"></pre>
  <div class="viz-stagewrap">
    <h1 class="viz-title">Two Pointer — find a pair summing to target</h1>
    <div id="stage" class="viz-stage"></div>
    <div id="note" class="viz-note"></div>
  </div>
  <div id="state" class="viz-state"></div>
  <div id="controls" class="viz-controls"></div>

  <script type="module">
    import { Viz } from "/viz/viz-kit.js";

    const A = [1, 3, 4, 6, 8, 11];
    const TARGET = 10;
    const CELL = 64; // 56px cell + 8px gap

    const SOURCE = [
      "def two_sum(a, target):",
      "    lo, hi = 0, len(a) - 1",
      "    while lo < hi:",
      "        s = a[lo] + a[hi]",
      "        if s == target: return (lo, hi)",
      "        elif s < target: lo += 1",
      "        else: hi -= 1",
    ].join("\n");

    // Build keyframes by simulating the algorithm.
    function buildFrames() {
      const frames = [];
      let lo = 0, hi = A.length - 1;
      frames.push({ lo, hi, sum: null, line: 1, status: "start",
        note: `Pointers at both ends, target = ${TARGET}.` });
      while (lo < hi) {
        const sum = A[lo] + A[hi];
        frames.push({ lo, hi, sum, line: 3,
          status: sum === TARGET ? "match" : "check",
          note: `a[${lo}] + a[${hi}] = ${A[lo]} + ${A[hi]} = ${sum}.` });
        if (sum === TARGET) {
          frames.push({ lo, hi, sum, line: 4, status: "match",
            note: `Found it: indices (${lo}, ${hi}).` });
          break;
        } else if (sum < TARGET) {
          frames.push({ lo, hi, sum, line: 5, status: "move-lo",
            note: `${sum} < ${TARGET}: too small, move lo right.` });
          lo += 1;
        } else {
          frames.push({ lo, hi, sum, line: 6, status: "move-hi",
            note: `${sum} > ${TARGET}: too big, move hi left.` });
          hi -= 1;
        }
      }
      return frames;
    }

    const frames = buildFrames();
    const stage = document.getElementById("stage");

    const xFor = (i) => 20 + i * CELL;

    // Static cells.
    const cells = A.map((v, i) => {
      const cell = document.createElement("div");
      cell.className = "viz-cell";
      cell.style.top = "60px";
      cell.style.left = `${xFor(i)}px`;
      cell.innerHTML =
        `<span class="viz-cell-val">${v}</span><span class="viz-cell-idx">${i}</span>`;
      stage.appendChild(cell);
      return cell;
    });

    const loMark = document.createElement("div");
    loMark.className = "viz-pointer viz-pointer--lo";
    loMark.textContent = "lo";
    loMark.style.top = "20px";
    const hiMark = document.createElement("div");
    hiMark.className = "viz-pointer viz-pointer--hi";
    hiMark.textContent = "hi";
    hiMark.style.top = "20px";
    stage.append(loMark, hiMark);

    function render(i, t) {
      const f = frames[i];
      const prev = frames[Math.max(0, i - 1)];
      // Glide pointers between previous and current positions.
      const loX = lerp(xFor(prev.lo), xFor(f.lo), t);
      const hiX = lerp(xFor(prev.hi), xFor(f.hi), t);
      loMark.style.left = `${loX}px`;
      hiMark.style.left = `${hiX}px`;
      cells.forEach((cell, idx) => {
        const active = idx === f.lo || idx === f.hi;
        const match = f.status === "match" && active;
        cell.classList.toggle("viz-cell--active", active && !match);
        cell.classList.toggle("viz-cell--match", match);
      });
    }

    // lerp is exported from the kit too; import it for the render closure.
    function lerp(a, b, tt) { return a + (b - a) * tt; }

    Viz.create({
      controls: document.getElementById("controls"),
      frameCount: frames.length,
      render,
      codeEl: document.getElementById("code"),
      source: SOURCE,
      lineForFrame: (i) => frames[i].line,
      stateEl: document.getElementById("state"),
      stateRows: (i) => {
        const f = frames[i];
        return [
          ["lo", String(f.lo)],
          ["hi", String(f.hi)],
          ["a[lo]", String(A[f.lo])],
          ["a[hi]", String(A[f.hi])],
          ["sum", f.sum == null ? "—" : String(f.sum)],
          ["target", String(TARGET)],
        ];
      },
      noteEl: document.getElementById("note"),
      note: (i) => frames[i].note,
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/viz/two-pointer-sorted.html
git commit -m "feat(viz): add two-pointer worked example"
```

---

### Task 7: Worked example B — subsets via recursion (animated call tree)

**Files:**
- Create: `public/viz/recursion-subsets.html`

No automated test (visual). Verify by opening `http://localhost:8765/viz/recursion-subsets.html`.

- [ ] **Step 1: Write the example page**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Recursion — Subsets (Backtracking)</title>
  <link rel="stylesheet" href="/viz/viz-kit.css" />
</head>
<body class="viz-app">
  <pre id="code" class="viz-code"></pre>
  <div class="viz-stagewrap">
    <h1 class="viz-title">Subsets — the recursion call tree</h1>
    <div id="stage" class="viz-stage viz-stage--svg"></div>
    <div id="note" class="viz-note"></div>
  </div>
  <div id="state" class="viz-state"></div>
  <div id="controls" class="viz-controls"></div>

  <script type="module">
    import { Viz } from "/viz/viz-kit.js";

    const ARR = [1, 2, 3];
    const SVGNS = "http://www.w3.org/2000/svg";
    const HSPACE = 90, VSPACE = 90, MX = 50, MY = 40;

    const SOURCE = [
      "def subsets(arr):",
      "    res = []",
      "    def dfs(i, path):",
      "        if i == len(arr):",
      "            res.append(path[:]); return",
      "        dfs(i + 1, path)            # skip arr[i]",
      "        path.append(arr[i])",
      "        dfs(i + 1, path)            # take arr[i]",
      "        path.pop()",
      "    dfs(0, [])",
      "    return res",
    ].join("\n");

    // Build the call tree + a frame per enter/return event.
    function build() {
      const nodes = [];
      const children = new Map();
      const frames = [];
      let nextId = 0;

      function dfs(i, path, parent, depth) {
        const id = nextId++;
        const label = `dfs(${i}, [${path.join(",")}])`;
        nodes.push({ id, parent, depth, label });
        if (parent != null) {
          if (!children.has(parent)) children.set(parent, []);
          children.get(parent).push(id);
        }
        frames.push({ active: id, count: nodes.length, line: i === ARR.length ? 3 : 2,
          path: [...path], note: i === ARR.length
            ? `Base case: record subset [${path.join(",")}].`
            : `Enter dfs(i=${i}), current path [${path.join(",")}].` });
        if (i === ARR.length) {
          frames.push({ active: id, count: nodes.length, line: 4, path: [...path],
            note: `Append [${path.join(",")}] to results.` });
          return id;
        }
        dfs(i + 1, path, id, depth + 1);          // skip
        path.push(ARR[i]);
        dfs(i + 1, path, id, depth + 1);          // take
        path.pop();
        frames.push({ active: id, count: nodes.length, line: 8, path: [...path],
          note: `Backtrack out of dfs(i=${i}).` });
        return id;
      }

      dfs(0, [], null, 0);
      return { nodes, children, frames };
    }

    const { nodes, children, frames } = build();

    // Layout: leaves get sequential x; parents centered over children (post-order).
    const pos = new Map();
    let leafX = 0;
    function layout(id) {
      const kids = children.get(id) || [];
      const node = nodes[id];
      const y = MY + node.depth * VSPACE;
      if (kids.length === 0) {
        const x = MX + leafX * HSPACE;
        leafX += 1;
        pos.set(id, { x, y });
        return x;
      }
      const xs = kids.map(layout);
      const x = (Math.min(...xs) + Math.max(...xs)) / 2;
      pos.set(id, { x, y });
      return x;
    }
    layout(0);

    const stage = document.getElementById("stage");
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 720 420");
    stage.appendChild(svg);

    function render(i, t) {
      const f = frames[i];
      const visible = nodes.slice(0, f.count);
      svg.innerHTML = "";
      // Edges first.
      for (const n of visible) {
        if (n.parent == null) continue;
        const a = pos.get(n.parent), b = pos.get(n.id);
        const edge = document.createElementNS(SVGNS, "line");
        edge.setAttribute("class", "viz-edge");
        edge.setAttribute("x1", a.x); edge.setAttribute("y1", a.y);
        edge.setAttribute("x2", b.x); edge.setAttribute("y2", b.y);
        svg.appendChild(edge);
      }
      // Nodes.
      for (const n of visible) {
        const p = pos.get(n.id);
        const g = document.createElementNS(SVGNS, "g");
        const isActive = n.id === f.active;
        // Newly entered active node scales up via t.
        const scale = isActive ? 0.6 + 0.4 * t : 1;
        g.setAttribute("transform", `translate(${p.x} ${p.y}) scale(${scale})`);
        const rect = document.createElementNS(SVGNS, "rect");
        rect.setAttribute("class", isActive ? "viz-node viz-node--active" : "viz-node");
        rect.setAttribute("x", -36); rect.setAttribute("y", -16);
        rect.setAttribute("width", 72); rect.setAttribute("height", 32);
        rect.setAttribute("rx", 6);
        const label = document.createElementNS(SVGNS, "text");
        label.setAttribute("class", "viz-node-label");
        label.textContent = n.label;
        g.append(rect, label);
        svg.appendChild(g);
      }
    }

    Viz.create({
      controls: document.getElementById("controls"),
      frameCount: frames.length,
      render,
      codeEl: document.getElementById("code"),
      source: SOURCE,
      lineForFrame: (i) => frames[i].line,
      stateEl: document.getElementById("state"),
      stateRows: (i) => {
        const f = frames[i];
        return [
          ["path", `[${f.path.join(",")}]`],
          ["depth", String(nodes[f.active].depth)],
          ["calls", String(f.count)],
        ];
      },
      noteEl: document.getElementById("note"),
      note: (i) => frames[i].note,
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/viz/recursion-subsets.html
git commit -m "feat(viz): add recursion subsets worked example"
```

---

### Task 8: Serve the viz dir from the server

**Files:**
- Modify: `src/config.js`
- Modify: `src/server/app.js`
- Test: `tests/server.viz.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/server.viz.test.js
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDb } from "../src/db/index.js";
import { createApp } from "../src/server/app.js";
import { PUBLIC_DIR } from "../src/config.js";

let app, db, tmp, sessionPath;

beforeAll(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "coach-viz-"));
  db = openDb(":memory:");
  sessionPath = path.join(tmp, "session.md");
  app = createApp(db, sessionPath, PUBLIC_DIR);
});

afterAll(() => {
  db.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("static viz serving", () => {
  it("serves the kit JS", async () => {
    const res = await request(app).get("/viz/viz-kit.js");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/javascript/);
  });
  it("serves the kit CSS", async () => {
    const res = await request(app).get("/viz/viz-kit.css");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/css/);
  });
  it("serves vendored three", async () => {
    const res = await request(app).get("/viz/vendor/three.module.js");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/javascript/);
  });
  it("serves an example page", async () => {
    const res = await request(app).get("/viz/two-pointer-sorted.html");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
  });
  it("keeps /health working", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server.viz.test.js --testTimeout=60000`
Expected: FAIL — `PUBLIC_DIR` not exported / static route returns 404.

- [ ] **Step 3: Add PUBLIC_DIR to config**

In `src/config.js`, add alongside the existing exports (it already imports `path` and computes `root`):

```js
export const PUBLIC_DIR = path.join(root, "public");
```

- [ ] **Step 4: Mount express.static in createApp**

In `src/server/app.js`, change the signature and add the static mount. The current signature is `export function createApp(db, sessionPath)`; make it accept an optional `publicDir`:

```js
import express from "express";
import { PUBLIC_DIR } from "../config.js";

export function createApp(db, sessionPath, publicDir = PUBLIC_DIR) {
  const app = express();
  // ...existing CORS + json middleware unchanged...
  app.use(express.static(publicDir));
  // ...existing routes (GET /health, POST /event) unchanged...
  return app;
}
```

Place `app.use(express.static(publicDir))` after the existing middleware and before (or after) the routes — order does not matter since the paths don't collide.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/server.viz.test.js --testTimeout=60000`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/config.js src/server/app.js tests/server.viz.test.js
git commit -m "feat(viz): serve public/viz via express.static"
```

---

### Task 9: Teach the coach to use the visualizer

**Files:**
- Modify: `.claude/skills/leetcode-coaching/SKILL.md`

- [ ] **Step 1: Add a "Layer 3 — Visualize a flow" section**

Insert after the "Layer 2 — The Hint Ladder" section (before "The Idea-Engagement Loop"):

```markdown
## Layer 3 — Visualize a flow (when seeing it beats describing it)

Some things are far easier to *see* than to read about — how pointers crawl toward
each other, how a recursion tree branches and backtracks, how a DP table fills in.
When the user is stuck *understanding how something works* (not stuck finding the
idea), or when they explicitly ask to see it, build a visualization.

**No content restriction.** Unlike the hint ladder, visualizing is not a spoiler
risk in the same way — the user is trying to build a mental model. If they ask you
to animate the optimal solution to the very problem they're on, do it. The goal is
understanding, full stop.

How to build one:

1. **Pick the representation by problem type.** Array/string → animated cells with
   moving pointers. Recursion/backtracking → a call tree that grows and prunes.
   Graph/BFS/DFS → nodes lighting up in visit order. DP → a grid filling cell by
   cell. The point is the representation should match the structure the user needs
   to see.

2. **Write a bespoke page** at `public/viz/<slug>-<concept>.html`, linking the shared
   kit (`/viz/viz-kit.css` and `/viz/viz-kit.js`). Copy the structure from the worked
   examples — `public/viz/two-pointer-sorted.html` (2D motion) or
   `public/viz/recursion-subsets.html` (call tree). For true 3D, import the vendored
   engine at `/viz/vendor/three.module.js`.

3. **Always include the code panel and the state table.** The whole value is showing
   *how each line changes state* — wire `source`, `lineForFrame`, and `stateRows` so
   the executing line highlights and the variables update in lockstep with the motion.

4. **Share the URL.** The server serves it at
   `http://localhost:8765/viz/<slug>-<concept>.html`. Tell the user to open it and
   scrub or play through.

Keep it motion-first: the kit tweens between frames, so design frames as meaningful
states and let `render(index, t)` interpolate positions for smooth movement.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/leetcode-coaching/SKILL.md
git commit -m "docs(skill): add Layer 3 visualization guidance"
```

---

## Notes for the executor

- **Test runner gotcha (this machine):** vitest's collect/prepare phases take MINUTES because an EDR layer scans every spawned `node` process. Run ONE test file per invocation with `--testTimeout=60000`. Do NOT re-run the full suite repeatedly to "verify" — run only the file you just changed.
- **npm cache gotcha:** use `npm install --cache /tmp/coach-npm-cache` (the global `~/.npm` has root-owned files).
- **jsdom tests:** the vitest default environment is `node`. The `create.test.js` file needs `// @vitest-environment jsdom` as its first line. The stepper/timeline tests run in node and rely on the `if (typeof window !== "undefined")` guard so importing the kit doesn't throw.
- After all tasks: run the four viz/server test files once each, manually open both example pages in a browser to confirm the motion looks right, then finish the branch (merge to main locally, per the established stage pattern) and update the project memory to "Stage 5 complete".
```