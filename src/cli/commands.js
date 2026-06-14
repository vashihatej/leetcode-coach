import {
  upsertProblem,
  insertAttempt,
  listAttempts,
  setMastery,
  listMastery,
  getReview,
  upsertReview,
  listDueReviews,
} from "../db/queries.js";
import { gradeAttempt, nextSchedule } from "../sr/scheduler.js";
import fs from "node:fs";

function parseHints(hints) {
  if (!hints) return [];
  return String(hints)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n));
}

function problemIdBySlug(db, slug) {
  const row = db.prepare("SELECT id FROM problems WHERE slug = ?").get(slug);
  return row ? row.id : null;
}

export function cmdLogAttempt(db, args) {
  const { slug } = args;
  let problemId = problemIdBySlug(db, slug);
  if (!problemId) {
    problemId = upsertProblem(db, { slug, title: slug });
  }
  const attempt = {
    problemId,
    solved: Boolean(args.solved),
    resultType: args.result ?? null,
    hintsUsed: parseHints(args.hints),
    mistakes: args.mistakes ?? null,
    finalApproach: args.approach ?? null,
  };
  insertAttempt(db, attempt);

  const quality = gradeAttempt(attempt);
  const next = nextSchedule(getReview(db, problemId), quality, new Date());
  upsertReview(db, { problemId, ...next });

  const n = listAttempts(db, problemId).length;
  return (
    `logged attempt for ${slug} (total attempts: ${n})\n` +
    `next review: ${next.dueDate} (${next.interval} days)`
  );
}

export function cmdMastery(db) {
  const rows = listMastery(db);
  if (rows.length === 0) return "no patterns tracked yet";
  return rows
    .map((r) => `${r.mastery.padEnd(12)} ${r.name} (seen ${r.times_seen})`)
    .join("\n");
}

export function cmdSetMastery(db, args) {
  setMastery(db, args.pattern, args.level);
  return `set ${args.pattern} -> ${args.level}`;
}

export function cmdStatus(_db, sessionPath) {
  if (!fs.existsSync(sessionPath)) return "no active session (session.md not found)";
  return fs.readFileSync(sessionPath, "utf8");
}

export function cmdReviewDue(db) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = listDueReviews(db, today);
  if (rows.length === 0) return "nothing due for review";
  return rows
    .map((r) => {
      const days = daysBetween(r.due_date, today);
      const when = days <= 0 ? "due today" : `due ${days} day${days === 1 ? "" : "s"} ago`;
      return `${r.slug} · ${r.title ?? ""} · ${r.difficulty ?? "?"} · ${when}`;
    })
    .join("\n");
}

function daysBetween(fromDate, toDate) {
  const ms = new Date(toDate + "T00:00:00Z") - new Date(fromDate + "T00:00:00Z");
  return Math.round(ms / 86400000);
}
