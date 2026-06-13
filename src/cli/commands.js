import {
  upsertProblem,
  insertAttempt,
  listAttempts,
  setMastery,
  listMastery,
} from "../db/queries.js";
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
  insertAttempt(db, {
    problemId,
    solved: Boolean(args.solved),
    resultType: args.result ?? null,
    hintsUsed: parseHints(args.hints),
    mistakes: args.mistakes ?? null,
    finalApproach: args.approach ?? null,
  });
  const n = listAttempts(db, problemId).length;
  return `logged attempt for ${slug} (total attempts: ${n})`;
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
