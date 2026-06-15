import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb } from "../src/db/index.js";

describe("review_queue reps migration", () => {
  it("a fresh db has the reps column with default 0", () => {
    const db = openDb(":memory:");
    const cols = db.prepare("PRAGMA table_info(review_queue)").all();
    const reps = cols.find((c) => c.name === "reps");
    expect(reps).toBeTruthy();
    expect(Number(reps.dflt_value)).toBe(0);
  });

  it("a fresh db stores full problem context", () => {
    const db = openDb(":memory:");
    const cols = db.prepare("PRAGMA table_info(problems)").all().map((column) => column.name);
    expect(cols).toEqual(expect.arrayContaining(["description", "examples", "constraints"]));
  });

  it("adds reps to a legacy review_queue that lacks it", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coach-mig-"));
    const dbPath = path.join(dir, "coach.db");
    try {
      // Simulate a pre-Stage-4 db: review_queue without the reps column.
      const legacy = new Database(dbPath);
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

      const db = openDb(dbPath); // should migrate in place
      try {
        const cols = db.prepare("PRAGMA table_info(review_queue)").all();
        expect(cols.some((c) => c.name === "reps")).toBe(true);
        const row = db.prepare("SELECT reps FROM review_queue WHERE problem_id = 1").get();
        expect(row.reps).toBe(0);
        const problemCols = db.prepare("PRAGMA table_info(problems)").all();
        expect(problemCols.map((column) => column.name)).toEqual(
          expect.arrayContaining(["description", "examples", "constraints"])
        );
      } finally {
        db.close();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
