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
