import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/index.js";
import { upsertProblem, getReview, upsertReview, listDueReviews } from "../src/db/queries.js";

function seedProblem(db, slug) {
  return upsertProblem(db, { slug, title: slug, difficulty: "Easy" });
}

describe("review queries", () => {
  it("upsertReview inserts then updates the same row", () => {
    const db = openDb(":memory:");
    const pid = seedProblem(db, "two-sum");
    upsertReview(db, { problemId: pid, dueDate: "2026-06-20", interval: 6, ease: 2.5, reps: 2 });
    let row = getReview(db, pid);
    expect(row.interval).toBe(6);
    expect(row.reps).toBe(2);

    upsertReview(db, { problemId: pid, dueDate: "2026-07-01", interval: 15, ease: 2.6, reps: 3 });
    row = getReview(db, pid);
    expect(row.interval).toBe(15);
    expect(row.ease).toBeCloseTo(2.6, 5);
    const count = db.prepare("SELECT COUNT(*) c FROM review_queue WHERE problem_id = ?").get(pid).c;
    expect(count).toBe(1);
  });

  it("getReview returns undefined for an unscheduled problem", () => {
    const db = openDb(":memory:");
    const pid = seedProblem(db, "two-sum");
    expect(getReview(db, pid)).toBeUndefined();
  });

  it("listDueReviews returns only rows due on/before the date, ordered, with problem fields", () => {
    const db = openDb(":memory:");
    const a = seedProblem(db, "a-due-past");
    const b = seedProblem(db, "b-due-today");
    const c = seedProblem(db, "c-future");
    upsertReview(db, { problemId: a, dueDate: "2026-06-10", interval: 1, ease: 2.5, reps: 1 });
    upsertReview(db, { problemId: b, dueDate: "2026-06-14", interval: 1, ease: 2.5, reps: 1 });
    upsertReview(db, { problemId: c, dueDate: "2026-06-20", interval: 6, ease: 2.5, reps: 2 });

    const due = listDueReviews(db, "2026-06-14");
    expect(due.map((r) => r.slug)).toEqual(["a-due-past", "b-due-today"]);
    expect(due[0].title).toBe("a-due-past");
    expect(due[0].difficulty).toBe("Easy");
  });
});
