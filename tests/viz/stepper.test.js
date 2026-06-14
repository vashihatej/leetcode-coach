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
