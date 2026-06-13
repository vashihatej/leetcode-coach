import { describe, it, expect } from "vitest";
import { parseVerdict, shouldCaptureUrl } from "../../extension/src/verdict.js";

describe("shouldCaptureUrl", () => {
  it("matches the check polling endpoint", () => {
    expect(shouldCaptureUrl("https://leetcode.com/submissions/detail/123/check/")).toBe(true);
  });
  it("ignores unrelated urls", () => {
    expect(shouldCaptureUrl("https://leetcode.com/graphql/")).toBe(false);
    expect(shouldCaptureUrl("")).toBe(false);
  });
});

describe("parseVerdict", () => {
  it("returns null until the judge state is SUCCESS", () => {
    expect(parseVerdict({ state: "PENDING" })).toBe(null);
    expect(parseVerdict(null)).toBe(null);
  });

  it("extracts an accepted run", () => {
    const v = parseVerdict({
      state: "SUCCESS",
      status_msg: "Accepted",
      total_correct: 57,
      total_testcases: 57,
      status_runtime: "3 ms",
      status_memory: "10.2 MB",
    });
    expect(v).toEqual({
      statusMsg: "Accepted",
      totalCorrect: 57,
      totalTestcases: 57,
      runtime: "3 ms",
      memory: "10.2 MB",
      error: null,
    });
  });

  it("surfaces a runtime error message", () => {
    const v = parseVerdict({
      state: "SUCCESS",
      status_msg: "Runtime Error",
      runtime_error: "IndexError: list index out of range",
    });
    expect(v.statusMsg).toBe("Runtime Error");
    expect(v.error).toBe("IndexError: list index out of range");
  });
});
