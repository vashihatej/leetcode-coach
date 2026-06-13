import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/index.js";
import { upsertProblem, insertAttempt, listAttempts } from "../src/db/queries.js";

describe("attempts", () => {
  it("inserts an attempt and lists it back for a problem", () => {
    const db = openDb(":memory:");
    const problemId = upsertProblem(db, { slug: "two-sum", title: "Two Sum" });
    const id = insertAttempt(db, {
      problemId,
      solved: true,
      resultType: "optimal",
      hintsUsed: [1, 2],
      timeSpent: 600,
      mistakes: "off-by-one at first",
      finalApproach: "hash map one-pass",
    });
    expect(id).toBeTypeOf("number");
    const rows = listAttempts(db, problemId);
    expect(rows).toHaveLength(1);
    expect(rows[0].solved).toBe(1);
    expect(rows[0].result_type).toBe("optimal");
    expect(JSON.parse(rows[0].hints_used)).toEqual([1, 2]);
  });
});
