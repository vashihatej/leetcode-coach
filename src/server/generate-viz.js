import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

const client = new Anthropic();

const VIZ_KIT_API = `
viz-kit.js exports: { Viz, lerp, createStepper, easeInOutCubic, sampleTimeline }

Viz.create({
  controls,        // HTMLElement — the controls bar
  frameCount,      // number of frames >= 1
  render,          // (frameIndex, t) => void  — t is 0..1 eased interpolation
  codeEl,          // <pre id="code"> element
  source,          // Python source string
  lineForFrame,    // (i) => number  — 0-based line index to highlight
  stateEl,         // <div id="state"> element
  stateRows,       // (i) => [["key","val"], ...]  — variable table
  noteEl,          // <div id="note"> element
  note,            // (i) => string  — narration for frame i
  duration,        // ms per animation step (default 600)
})

lerp(a, b, t)  — linear interpolation
`;

const EXAMPLE_HTML = `<!doctype html>
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
    import { Viz, lerp } from "/viz/viz-kit.js";

    const A = [1, 3, 4, 6, 8, 11];
    const TARGET = 10;
    const CELL = 64;

    const SOURCE = [
      "def two_sum(a, target):",
      "    lo, hi = 0, len(a) - 1",
      "    while lo < hi:",
      "        s = a[lo] + a[hi]",
      "        if s == target: return (lo, hi)",
      "        elif s < target: lo += 1",
      "        else: hi -= 1",
    ].join("\\n");

    function buildFrames() {
      const frames = [];
      let lo = 0, hi = A.length - 1;
      frames.push({ lo, hi, s: null, line: 1, note: \`Initialize lo=\${lo}, hi=\${hi}\` });
      while (lo < hi) {
        const s = A[lo] + A[hi];
        frames.push({ lo, hi, s, line: 3, note: \`s = \${A[lo]}+\${A[hi]} = \${s}\` });
        if (s === TARGET) { frames.push({ lo, hi, s, line: 4, note: \`Found!\` }); break; }
        else if (s < TARGET) { frames.push({ lo, hi, s, line: 5, note: \`Sum too small, move lo right\` }); lo++; }
        else { frames.push({ lo, hi, s, line: 6, note: \`Sum too large, move hi left\` }); hi--; }
      }
      return frames;
    }

    const frames = buildFrames();
    const stage = document.getElementById("stage");

    const cellEls = A.map((v, i) => {
      const el = document.createElement("div");
      el.style.cssText = \`position:absolute;width:52px;height:52px;left:\${i*CELL}px;top:40px;background:#21262d;border:2px solid #30363d;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#e6edf3;transition:border-color .2s\`;
      el.textContent = v;
      const idx = document.createElement("div");
      idx.style.cssText = \`position:absolute;bottom:-20px;width:100%;text-align:center;font-size:11px;color:#8b949e\`;
      idx.textContent = i;
      el.appendChild(idx);
      stage.appendChild(el);
      return el;
    });

    const loMark = document.createElement("div");
    loMark.className = "viz-pointer viz-pointer--lo";
    loMark.textContent = "lo";
    loMark.style.top = "100px";
    const hiMark = document.createElement("div");
    hiMark.className = "viz-pointer viz-pointer--hi";
    hiMark.textContent = "hi";
    hiMark.style.top = "100px";
    stage.append(loMark, hiMark);

    const ptrX = (i) => i * CELL + 14;

    function render(fi, t) {
      const f = frames[fi], p = frames[Math.max(0, fi-1)];
      loMark.style.left = lerp(ptrX(p.lo), ptrX(f.lo), t) + "px";
      hiMark.style.left = lerp(ptrX(p.hi), ptrX(f.hi), t) + "px";
      cellEls.forEach((el, i) => {
        const active = i === f.lo || i === f.hi;
        el.style.borderColor = i === f.lo ? "#58a6ff" : i === f.hi ? "#bc8cff" : "#30363d";
        el.style.background = active ? "rgba(88,166,255,0.08)" : "#21262d";
      });
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
          ["lo", String(f.lo)],
          ["hi", String(f.hi)],
          ["A[lo]", String(A[f.lo])],
          ["A[hi]", String(A[f.hi])],
          ["sum", f.s != null ? String(f.s) : "—"],
        ];
      },
      noteEl: document.getElementById("note"),
      note: (i) => frames[i].note,
    });
  </script>
</body>
</html>`;

export async function generateVizHtml({ title, difficulty, description, examples, patterns, topicTags }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to a .env file in the repo root: ANTHROPIC_API_KEY=sk-ant-...');
  }
  const patternList = (() => {
    try { return JSON.parse(patterns || '[]').join(', ') || 'none'; } catch { return 'none'; }
  })();
  const exampleText = (() => {
    try { const ex = JSON.parse(examples || '[]'); return JSON.stringify(ex.slice(0, 2), null, 2); } catch { return ''; }
  })();

  const problem = [
    `Title: ${title}`,
    `Difficulty: ${difficulty || 'Unknown'}`,
    `Patterns: ${patternList}`,
    `Topic tags: ${topicTags || 'none'}`,
    description ? `\nDescription:\n${description.slice(0, 1500)}` : '',
    exampleText ? `\nExamples:\n${exampleText}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `You are generating a step-by-step algorithm visualization HTML page for a LeetCode coaching tool.

## viz-kit.js API
${VIZ_KIT_API}

## CSS classes available (from viz-kit.css)
- Body: class="viz-app"
- Pointer arrows: class="viz-pointer viz-pointer--lo" or "viz-pointer--hi"  (position:absolute, left/top in px)
- Stage: class="viz-stage" — the animation canvas
- These handle layout automatically: viz-code, viz-stagewrap, viz-state, viz-note, viz-controls

## Example visualization
${EXAMPLE_HTML}

## Problem to visualize
${problem}

## Instructions
Write a complete, self-contained HTML visualization for this problem following the exact same structure as the example. Requirements:
- Same HTML skeleton (head, body with viz-app, pre#code, viz-stagewrap, h1.viz-title, div#stage, div#note, div#state, div#controls)
- Link /viz/viz-kit.css and import from /viz/viz-kit.js
- Pick a clear, small example input (use one from the problem if available)
- Build frames that walk through the algorithm step by step
- Use lerp() for smooth pointer/element animations between frames
- lineForFrame returns 0-based index into SOURCE lines
- stateRows shows the key variables at each frame
- note gives a plain-English narration per frame
- Use inline styles on DOM elements (position:absolute, left, top, width, height, etc.)

Output ONLY the complete HTML. No markdown, no explanation. Start with <!doctype html>.`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : '';
  // Strip any accidental markdown fences
  return raw.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();
}

export async function generateAndSaveViz({ problem, publicDir }) {
  const html = await generateVizHtml({
    title: problem.title ?? problem.slug,
    difficulty: problem.difficulty,
    description: problem.description,
    examples: problem.examples,
    patterns: problem.patterns,
    topicTags: problem.topic_tags,
  });

  const filename = `${problem.slug}-visualization.html`;
  const vizDir = path.join(publicDir, 'viz');
  fs.mkdirSync(vizDir, { recursive: true });
  fs.writeFileSync(path.join(vizDir, filename), html, 'utf8');

  return `viz/${filename}`;
}
