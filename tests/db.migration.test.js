import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { openDb } from "../src/db/index.js";

describe("review_queue reps migration", () => {
  it("a fresh db has the reps column with default 0", () => {
    const db = openDb(":memory:");
    const cols = db.prepare("PRAGMA table_info(review_queue)").all();
    const reps = cols.find((c) => c.name === "reps");
    expect(reps).toBeTruthy();
    expect(Number(reps.dflt_value)).toBe(0);
  });

  it("adds reps to a legacy review_queue that lacks it", () => {
    // Simulate a pre-Stage-4 db: review_queue without the reps column.
    const path = `/tmp/coach-migration-${Date.now()}.db`;
    const legacy = new Database(path);
    legacy.exec(`CREATE TABLE problems (id INTEGER PRIMARY KEY, slug TEXT);
      CREATE TABLE review_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        problem_id INTEGER UNIQUE NOT NULL,
        due_date TEXT NOT NULL,
        interval INTEGER NOT NULL DEFAULT 1,
        ease REAL NOT NULL DEFAULT 2.5
      );
      INSERT INTO problems (id, slug) VALUES (1, 'two-sum');
      INSERT INTO review_queue (problem_id, due_date) VALUES (1, '2026-06-14');`);
    legacy.close();

    const db = openDb(path); // should migrate in place
    const cols = db.prepare("PRAGMA table_info(review_queue)").all();
    expect(cols.some((c) => c.name === "reps")).toBe(true);
    const row = db.prepare("SELECT reps FROM review_queue WHERE problem_id = 1").get();
    expect(row.reps).toBe(0);
  });
});
