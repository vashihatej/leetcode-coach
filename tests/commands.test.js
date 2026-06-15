import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/index.js";
import { upsertProblem, upsertReview } from "../src/db/queries.js";
import {
  cmdLogAttempt,
  cmdMastery,
  cmdSetMastery,
  cmdReviewDue,
} from "../src/cli/commands.js";

describe("cli commands", () => {
  it("cmdLogAttempt records an attempt for an existing slug", () => {
    const db = openDb(":memory:");
    upsertProblem(db, { slug: "two-sum", title: "Two Sum" });
    const out = cmdLogAttempt(db, {
      slug: "two-sum",
      solved: true,
      result: "optimal",
      hints: "1,2",
      mistakes: "off by one",
      approach: "hash map",
    });
    expect(out).toContain("logged attempt");
    const row = db.prepare("SELECT * FROM attempts").get();
    expect(row.solved).toBe(1);
    expect(JSON.parse(row.hints_used)).toEqual([1, 2]);
  });

  it("cmdSetMastery then cmdMastery shows the level", () => {
    const db = openDb(":memory:");
    cmdSetMastery(db, { pattern: "sliding window", level: "solid" });
    const out = cmdMastery(db);
    expect(out).toContain("sliding window");
    expect(out).toContain("solid");
  });

  it("cmdLogAttempt schedules a review and reports the next due date", () => {
    const db = openDb(":memory:");
    upsertProblem(db, { slug: "two-sum", title: "Two Sum" });
    const out = cmdLogAttempt(db, { slug: "two-sum", solved: true, result: "optimal" });
    expect(out).toContain("next review:");
    const row = db.prepare("SELECT * FROM review_queue WHERE problem_id = 1").get();
    expect(row).toBeTruthy();
    expect(row.reps).toBe(1);
    expect(row.interval).toBe(1);
  });

  it("cmdLogAttempt records pattern linkage and whether instinct fired", () => {
    const db = openDb(":memory:");
    const problemId = upsertProblem(db, { slug: "two-sum", title: "Two Sum" });
    const out = cmdLogAttempt(db, {
      slug: "two-sum",
      solved: true,
      result: "optimal",
      patterns: "Hashing, Array",
      instinctFired: true,
    });
    expect(out).toContain("patterns: hashing, array (instinct fired)");
    const patterns = db.prepare("SELECT * FROM patterns ORDER BY name").all();
    expect(patterns.map((row) => row.name)).toEqual(["array", "hashing"]);
    expect(patterns.every((row) => row.times_seen === 1)).toBe(true);
    expect(patterns.every((row) => row.times_instinct_fired === 1)).toBe(true);
    expect(
      db.prepare("SELECT COUNT(*) count FROM pattern_problems WHERE problem_id = ?").get(problemId)
        .count
    ).toBe(2);
  });

  it("cmdReviewDue lists due problems and reports empty state", () => {
    const db = openDb(":memory:");
    expect(cmdReviewDue(db)).toContain("nothing due");

    const pid = upsertProblem(db, { slug: "two-sum", title: "Two Sum", difficulty: "Easy" });
    upsertReview(db, { problemId: pid, dueDate: "2000-01-01", interval: 1, ease: 2.5, reps: 1 });
    const out = cmdReviewDue(db);
    expect(out).toContain("two-sum");
    expect(out).toContain("Easy");
  });
});
