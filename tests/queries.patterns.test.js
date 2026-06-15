import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/index.js";
import {
  ensurePattern,
  setMastery,
  listMastery,
  recordPatternOutcome,
  listProblemPatterns,
  upsertProblem,
} from "../src/db/queries.js";

describe("patterns", () => {
  it("creates a pattern with default mastery", () => {
    const db = openDb(":memory:");
    const id = ensurePattern(db, "sliding window");
    expect(id).toBeTypeOf("number");
    const list = listMastery(db);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("sliding window");
    expect(list[0].mastery).toBe("not_started");
  });

  it("ensurePattern is idempotent on name", () => {
    const db = openDb(":memory:");
    const a = ensurePattern(db, "two pointers");
    const b = ensurePattern(db, "two pointers");
    expect(b).toBe(a);
  });

  it("setMastery updates level and last_practiced", () => {
    const db = openDb(":memory:");
    ensurePattern(db, "dynamic programming");
    setMastery(db, "dynamic programming", "shaky");
    const row = listMastery(db).find((p) => p.name === "dynamic programming");
    expect(row.mastery).toBe("shaky");
    expect(row.last_practiced).toBeTruthy();
  });

  it("links a problem and records exposure and instinct outcomes", () => {
    const db = openDb(":memory:");
    const problemId = upsertProblem(db, { slug: "two-sum", title: "Two Sum" });
    recordPatternOutcome(db, { problemId, name: "Hashing", instinctFired: true });
    recordPatternOutcome(db, { problemId, name: "hashing", instinctFired: false });

    const pattern = listMastery(db).find((row) => row.name === "hashing");
    expect(pattern.times_seen).toBe(2);
    expect(pattern.times_instinct_fired).toBe(1);
    expect(listProblemPatterns(db, problemId).map((row) => row.name)).toEqual(["hashing"]);
    expect(db.prepare("SELECT COUNT(*) count FROM pattern_problems").get().count).toBe(1);
  });
});
