import { describe, it, expect, vi } from "vitest";
import { buildEvent, postEvent } from "../../extension/src/event.js";

describe("buildEvent", () => {
  it("merges problem, code, and result into the server contract", () => {
    const event = buildEvent({
      problem: {
        slug: "two-sum",
        title: "Two Sum",
        difficulty: "Easy",
        description: "d",
        examples: ["e"],
        constraints: ["c"],
        topicTags: ["Array"],
      },
      url: "https://leetcode.com/problems/two-sum/",
      code: "class Solution {};",
      language: "cpp",
      lastResult: { statusMsg: "Accepted", totalCorrect: 5, totalTestcases: 5, runtime: "1 ms", memory: "9 MB", error: null },
    });
    expect(event).toEqual({
      slug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      description: "d",
      examples: ["e"],
      constraints: ["c"],
      topicTags: ["Array"],
      url: "https://leetcode.com/problems/two-sum/",
      code: "class Solution {};",
      language: "cpp",
      lastResult: { statusMsg: "Accepted", totalCorrect: 5, totalTestcases: 5, runtime: "1 ms", memory: "9 MB", error: null },
    });
  });

  it("defaults code/language/result to null when missing", () => {
    const event = buildEvent({
      problem: { slug: "two-sum", title: "Two Sum", difficulty: "Easy" },
      url: "https://leetcode.com/problems/two-sum/",
    });
    expect(event.code).toBe(null);
    expect(event.language).toBe(null);
    expect(event.lastResult).toBe(null);
    expect(event.examples).toEqual([]);
    expect(event.constraints).toEqual([]);
    expect(event.topicTags).toEqual([]);
  });
});

describe("postEvent", () => {
  it("POSTs JSON to the given url and resolves the response", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const payload = { slug: "two-sum" };
    await postEvent(fetchFn, "http://localhost:8765/event", payload);
    expect(fetchFn).toHaveBeenCalledWith("http://localhost:8765/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("swallows network errors so a dead server never breaks the page", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(postEvent(fetchFn, "http://localhost:8765/event", { slug: "x" })).resolves.toBe(false);
  });
});
