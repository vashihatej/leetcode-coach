import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/index.js";
import { upsertProblem } from "../src/db/queries.js";

const sample = {
  slug: "two-sum",
  title: "Two Sum",
  difficulty: "Easy",
  topicTags: ["Array", "Hash Table"],
  url: "https://leetcode.com/problems/two-sum/",
  description: "Given an array...",
  examples: ["Input: [2,7], 9"],
  constraints: ["2 <= nums.length <= 10^4"],
};

describe("upsertProblem", () => {
  it("inserts a new problem and returns its id", () => {
    const db = openDb(":memory:");
    const id = upsertProblem(db, sample);
    expect(id).toBeTypeOf("number");
    const row = db.prepare("SELECT * FROM problems WHERE id = ?").get(id);
    expect(row.slug).toBe("two-sum");
    expect(JSON.parse(row.topic_tags)).toEqual(["Array", "Hash Table"]);
    expect(row.description).toBe("Given an array...");
    expect(JSON.parse(row.examples)).toEqual(["Input: [2,7], 9"]);
    expect(JSON.parse(row.constraints)).toEqual(["2 <= nums.length <= 10^4"]);
  });

  it("updates fields and keeps the same id on repeat slug", () => {
    const db = openDb(":memory:");
    const id1 = upsertProblem(db, sample);
    const id2 = upsertProblem(db, { ...sample, title: "Two Sum (v2)" });
    expect(id2).toBe(id1);
    const row = db.prepare("SELECT title FROM problems WHERE id = ?").get(id1);
    expect(row.title).toBe("Two Sum (v2)");
  });

  it("does not erase known context when a partial event arrives", () => {
    const db = openDb(":memory:");
    const id = upsertProblem(db, sample);
    upsertProblem(db, { slug: sample.slug, title: sample.title });
    const row = db.prepare("SELECT * FROM problems WHERE id = ?").get(id);
    expect(row.description).toBe(sample.description);
    expect(JSON.parse(row.topic_tags)).toEqual(sample.topicTags);
  });
});
