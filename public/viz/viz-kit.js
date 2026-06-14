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
      onChange: (i) => { animateTo(i); },
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
