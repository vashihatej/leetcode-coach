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
      url: "https://leetcode.com/problems/two-sum/",
      language: "python3",
      code: "def two_sum(nums, target):\n    pass",
      lastResult: { type: "submit", status: "Wrong Answer", details: "case 5 failed" },
    });
    const out = fs.readFileSync(tmp, "utf8");
    expect(out).toContain("# Two Sum");
    expect(out).toContain("Easy");
    expect(out).toContain("python3");
    expect(out).toContain("def two_sum");
    expect(out).toContain("Wrong Answer");
  });

  it("handles missing code and result gracefully", () => {
    writeSession(tmp, { slug: "x", title: "X", difficulty: "Hard" });
    const out = fs.readFileSync(tmp, "utf8");
    expect(out).toContain("# X");
    expect(out).toContain("_(no code yet)_");
    expect(out).toContain("_(no run/submit yet)_");
  });
});
