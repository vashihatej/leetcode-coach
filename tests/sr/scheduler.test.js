import { describe, it, expect } from "vitest";
import { gradeAttempt, nextSchedule } from "../../src/sr/scheduler.js";

describe("gradeAttempt", () => {
  it("unsolved attempt fails with quality 2", () => {
    expect(gradeAttempt({ solved: false, hintsUsed: [], resultType: null })).toBe(2);
  });
  it("solved unaided + optimal earns quality 5", () => {
    expect(gradeAttempt({ solved: true, hintsUsed: [], resultType: "optimal" })).toBe(5);
  });
  it("solved unaided but not optimal earns quality 4", () => {
    expect(gradeAttempt({ solved: true, hintsUsed: [], resultType: "brute" })).toBe(4);
    expect(gradeAttempt({ solved: true, hintsUsed: [], resultType: null })).toBe(4);
  });
  it("solved with 1-2 hints earns quality 3", () => {
    expect(gradeAttempt({ solved: true, hintsUsed: [1], resultType: "optimal" })).toBe(3);
    expect(gradeAttempt({ solved: true, hintsUsed: [1, 2], resultType: null })).toBe(3);
  });
  it("solved with 3+ hints still passes at quality 3", () => {
    expect(gradeAttempt({ solved: true, hintsUsed: [1, 2, 3, 4], resultType: null })).toBe(3);
  });
});

describe("nextSchedule", () => {
  const today = new Date("2026-06-14T12:00:00Z");

  it("first pass schedules 1 day out and bumps reps to 1", () => {
    const r = nextSchedule({ interval: 0, ease: 2.5, reps: 0 }, 5, today);
    expect(r.interval).toBe(1);
    expect(r.reps).toBe(1);
    expect(r.dueDate).toBe("2026-06-15");
  });
  it("second pass schedules 6 days out", () => {
    const r = nextSchedule({ interval: 1, ease: 2.5, reps: 1 }, 4, today);
    expect(r.interval).toBe(6);
    expect(r.reps).toBe(2);
    expect(r.dueDate).toBe("2026-06-20");
  });
  it("third+ pass multiplies interval by ease and rounds", () => {
    const r = nextSchedule({ interval: 6, ease: 2.5, reps: 2 }, 4, today);
    expect(r.interval).toBe(15); // round(6 * 2.5)
    expect(r.reps).toBe(3);
  });
  it("a fail resets reps and interval to 1 day", () => {
    const r = nextSchedule({ interval: 30, ease: 2.5, reps: 5 }, 2, today);
    expect(r.interval).toBe(1);
    expect(r.reps).toBe(0);
    expect(r.dueDate).toBe("2026-06-15");
  });
  it("ease rises on quality 5 and falls on quality 3", () => {
    expect(nextSchedule({ interval: 1, ease: 2.5, reps: 1 }, 5, today).ease).toBeCloseTo(2.6, 5);
    expect(nextSchedule({ interval: 1, ease: 2.5, reps: 1 }, 3, today).ease).toBeCloseTo(2.36, 5);
  });
  it("ease never drops below the 1.3 floor", () => {
    const r = nextSchedule({ interval: 1, ease: 1.3, reps: 1 }, 2, today);
    expect(r.ease).toBe(1.3);
  });
  it("defaults a missing current row to a fresh card", () => {
    const r = nextSchedule(undefined, 5, today);
    expect(r.interval).toBe(1);
    expect(r.reps).toBe(1);
    expect(r.ease).toBeCloseTo(2.6, 5);
  });
});
