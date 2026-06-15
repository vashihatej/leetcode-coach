import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeSession } from "../src/session/sessionWriter.js";

const tmp = path.join(os.tmpdir(), `session-${Date.now()}.md`);
afterEach(() => fs.existsSync(tmp) && fs.unlinkSync(tmp));

describe("writeSession", () => {
  it("renders problem, code, and last result to markdown", () => {
    writeSession(tmp, {
      slug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      topicTags: ["Array", "Hash Table"],
      description: "Given an array of integers...",
      examples: ["Input: nums = [2,7], target = 9\nOutput: [0,1]"],
      constraints: ["2 <= nums.length <= 10^4"],
      url: "https://leetcode.com/problems/two-sum/",
      language: "python3",
      code: "def two_sum(nums, target):\n    pass",
      lastResult: {
        statusMsg: "Wrong Answer",
        totalCorrect: 4,
        totalTestcases: 57,
        runtime: null,
        memory: null,
        error: null,
      },
    });
    const out = fs.readFileSync(tmp, "utf8");
    expect(out).toContain("# Two Sum");
    expect(out).toContain("Easy");
    expect(out).toContain("python3");
    expect(out).toContain("def two_sum");
    expect(out).toContain("Wrong Answer");
    expect(out).toContain("4/57 testcases");
    expect(out).toContain("## Problem statement");
    expect(out).toContain("Given an array of integers...");
    expect(out).toContain("Input: nums = [2,7]");
    expect(out).toContain("2 <= nums.length");
  });

  it("renders runtime/memory and an error block from the extension verdict shape", () => {
    writeSession(tmp, {
      slug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      lastResult: {
        statusMsg: "Runtime Error",
        totalCorrect: null,
        totalTestcases: null,
        runtime: null,
        memory: null,
        error: "IndexError: list index out of range",
      },
    });
    const out = fs.readFileSync(tmp, "utf8");
    expect(out).toContain("**Runtime Error**");
    expect(out).toContain("IndexError: list index out of range");
  });

  it("handles missing code and result gracefully", () => {
    writeSession(tmp, { slug: "x", title: "X", difficulty: "Hard" });
    const out = fs.readFileSync(tmp, "utf8");
    expect(out).toContain("# X");
    expect(out).toContain("_(no code yet)_");
    expect(out).toContain("_(no run/submit yet)_");
  });
});
