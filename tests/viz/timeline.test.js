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
