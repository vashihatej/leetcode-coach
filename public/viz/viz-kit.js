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
