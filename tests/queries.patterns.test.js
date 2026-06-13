import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/index.js";
import { ensurePattern, setMastery, listMastery } from "../src/db/queries.js";

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
});
