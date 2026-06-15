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

function renderCode(codeEl, source) {
  codeEl.innerHTML = "";
  const lines = source.split("\n");
  return lines.map((text) => {
    const div = document.createElement("div");
    div.className = "viz-code-line";
    div.textContent = text === "" ? " " : text;
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

const keyboardHandlers = new WeakMap();

const Viz = {
  create({
    controls,
    mount,
    frameCount,
    render,
    codeEl,
    source,
    lineForFrame,
    code,
    stateEl,
    stateRows,
    state,
    noteEl,
    note,
    duration = 600,
    three = false,
  }) {
    const controlsEl = controls || mount;
    if (!controlsEl) throw new Error("Viz.create requires controls or mount");
    if (!Number.isInteger(frameCount) || frameCount < 1) {
      throw new Error("Viz.create requires frameCount >= 1");
    }

    const codeSource = code?.source ?? source;
    const codeLineForFrame = code?.lineForFrame ?? lineForFrame;
    const rowsForFrame = state ?? stateRows;
    let codeLines = [];
    if (codeEl && codeSource != null) codeLines = renderCode(codeEl, codeSource);

    const resetBtn = createButton("⏮");
    resetBtn.setAttribute("aria-label", "Reset visualization");
    const prevBtn = createButton("◀");
    prevBtn.setAttribute("aria-label", "Previous frame");
    const playBtn = createButton("▶");
    playBtn.setAttribute("aria-label", "Play visualization");
    const nextBtn = createButton("▶▶");
    nextBtn.setAttribute("aria-label", "Next frame");

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
    speed.setAttribute("aria-label", "Animation duration");

    controlsEl.append(resetBtn, prevBtn, playBtn, nextBtn, counter, scrubber, speed);

    let rafId = null;
    let startTs = null;

    function paintPanels(i) {
      counter.textContent = `${i + 1} / ${frameCount}`;
      scrubber.value = String(i);
      playBtn.textContent = stepper.isPlaying ? "⏸" : "▶";
      playBtn.setAttribute(
        "aria-label",
        stepper.isPlaying ? "Pause visualization" : "Play visualization"
      );
      if (codeLines.length && codeLineForFrame) {
        const activeLines = codeLineForFrame(i);
        const lines = new Set(Array.isArray(activeLines) ? activeLines : [activeLines]);
        codeLines.forEach((el, idx) =>
          el.classList.toggle("viz-code-line--current", lines.has(idx)));
      }
      if (stateEl && rowsForFrame) {
        stateEl.innerHTML = "";
        for (const [k, v] of rowsForFrame(i)) {
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
      onChange: (i) => { animateTo(i); },
    });

    resetBtn.addEventListener("click", () => {
      stepper.reset();
      paintPanels(stepper.index);
      render(stepper.index, 1);
    });
    prevBtn.addEventListener("click", () => stepper.prev());
    nextBtn.addEventListener("click", () => stepper.next());
    playBtn.addEventListener("click", () => {
      stepper.toggle();
      paintPanels(stepper.index);
      if (stepper.isPlaying) animateTo(stepper.index);
    });
    scrubber.addEventListener("input", () => stepper.seek(Number(scrubber.value)));

    const doc = controlsEl.ownerDocument;
    const previousHandler = keyboardHandlers.get(doc);
    if (previousHandler) doc.removeEventListener("keydown", previousHandler);
    const keyHandler = (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        stepper.next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepper.prev();
      } else if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        stepper.toggle();
        paintPanels(stepper.index);
        if (stepper.isPlaying) animateTo(stepper.index);
      }
    };
    keyboardHandlers.set(doc, keyHandler);
    doc.addEventListener("keydown", keyHandler);

    const threeUrl = "/viz/vendor/three.module.js";
    stepper.threeReady = three
      ? three === true
        ? import(/* @vite-ignore */ threeUrl)
        : Promise.resolve(three)
      : Promise.resolve(null);
    stepper.destroy = () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      doc.removeEventListener("keydown", keyHandler);
      if (keyboardHandlers.get(doc) === keyHandler) keyboardHandlers.delete(doc);
    };

    paintPanels(0);
    render(0, 1);
    return stepper;
  },
};

export { Viz };
if (typeof window !== "undefined") window.Viz = Viz;
