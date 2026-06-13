import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/index.js";

describe("openDb", () => {
  it("creates all expected tables", () => {
    const db = openDb(":memory:");
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);
    expect(rows).toEqual(
      expect.arrayContaining([
        "problems",
        "attempts",
        "patterns",
        "pattern_problems",
        "review_queue",
      ])
    );
  });
});
