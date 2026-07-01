import {
  upsertProblem,
  insertAttempt,
  listAttempts,
  setMastery,
  listMastery,
  getReview,
  upsertReview,
  listDueReviews,
  recordPatternOutcome,
  upsertPatternWiki,
  getPatternWiki,
  ensurePattern,
  getProblemForNotes,
  setProblemNotesPath,
} from "../db/queries.js";
import { gradeAttempt, nextSchedule } from "../sr/scheduler.js";
import { generateAndSaveNotes } from "../server/generate-notes.js";
import { PUBLIC_DIR, SESSION_PATH } from "../config.js";
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

function parsePatterns(patterns) {
  if (!patterns) return [];
  return [...new Set(
    String(patterns)
      .split(",")
      .map((pattern) => pattern.trim().toLowerCase())
      .filter(Boolean)
  )];
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
    ahaMoments: args.aha ?? null,
    confusionPoints: args.confusion ?? null,
    analogyLiked: args.analogy ?? null,
    vizPath: args.vizPath ?? args['viz-path'] ?? null,
  };
  insertAttempt(db, attempt);

  const patterns = parsePatterns(args.patterns);
  for (const pattern of patterns) {
    recordPatternOutcome(db, {
      problemId,
      name: pattern,
      instinctFired: Boolean(args.instinctFired),
    });
  }

  const quality = gradeAttempt(attempt);
  const next = nextSchedule(getReview(db, problemId), quality, new Date());
  upsertReview(db, { problemId, ...next });

  const n = listAttempts(db, problemId).length;
  const patternSummary = patterns.length
    ? `\npatterns: ${patterns.join(", ")} (instinct ${args.instinctFired ? "fired" : "did not fire"})`
    : "";

  let notesSummary = '';
  try {
    const notesRow = getProblemForNotes(db, slug);
    if (notesRow?.attempt) {
      const patternWikis = (JSON.parse(notesRow.problem.patterns || '[]'))
        .map(name => getPatternWiki(db, name))
        .filter(Boolean);
      let code = '';
      try {
        const session = fs.readFileSync(SESSION_PATH, 'utf8');
        const match = session.match(/```python\d*\n([\s\S]*?)```/);
        if (match) code = match[1].trim();
      } catch { /* no session.md */ }
      const notesPath = generateAndSaveNotes({
        problem: notesRow.problem,
        attempt: notesRow.attempt,
        code,
        patternWikis,
        publicDir: PUBLIC_DIR,
      });
      setProblemNotesPath(db, slug, notesPath);
      notesSummary = `\nnotes: http://localhost:8765/${notesPath}`;
    }
  } catch { /* notes generation is best-effort */ }

  return (
    `logged attempt for ${slug} (total attempts: ${n})\n` +
    `next review: ${next.dueDate} (${next.interval} days)` +
    patternSummary +
    notesSummary
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

export function cmdEnrichPattern(db, args) {
  const name = String(args.pattern || '').trim().toLowerCase();
  if (!name) throw new Error('--pattern is required');
  ensurePattern(db, name);

  function parseList(val) {
    if (!val) return null;
    try { return JSON.parse(val); } catch { /* not JSON */ }
    return val.split(',').map(s => s.trim()).filter(Boolean);
  }

  upsertPatternWiki(db, {
    patternName: name,
    description: args.description ?? null,
    signals: parseList(args.signals),
    invariant: args.invariant ?? null,
    analogy: args.analogy ?? null,
    templateCode: args.template ? args.template.replace(/\\n/g, '\n') : null,
    mistakes: parseList(args.mistakes),
    whenNot: args['when-not'] ?? null,
    related: parseList(args.related),
    timeComplexity: args['time-complexity'] ?? null,
    spaceComplexity: args['space-complexity'] ?? null,
  });

  const hasWiki = Boolean(getPatternWiki(db, name));
  return `wiki ${hasWiki ? 'saved' : 'failed'} for pattern: ${name}`;
}

export function cmdPatternWikiStatus(db, args) {
  const name = String(args.pattern || '').trim().toLowerCase();
  const wiki = getPatternWiki(db, name);
  return wiki ? `wiki exists (generated ${wiki.generated_at})` : 'no wiki yet';
}

export function cmdSetVizPath(db, args) {
  const slug = String(args.slug || '').trim();
  const vizPath = String(args.vizPath || args['viz-path'] || '').trim();
  if (!slug) throw new Error('--slug is required');
  if (!vizPath) throw new Error('--viz-path is required');

  const problemId = problemIdBySlug(db, slug);
  if (!problemId) return `no problem found for slug: ${slug}`;

  const row = db
    .prepare('SELECT id FROM attempts WHERE problem_id = ? ORDER BY date DESC, id DESC LIMIT 1')
    .get(problemId);
  if (!row) return `no attempts logged for: ${slug}`;

  db.prepare('UPDATE attempts SET viz_path = ? WHERE id = ?').run(vizPath, row.id);
  return `viz path set for ${slug} (attempt #${row.id}): ${vizPath}`;
}

export async function cmdGenerateNotes(db, args) {
  const slug = String(args.slug || '').trim();
  if (!slug) throw new Error('--slug is required');

  const row = getProblemForNotes(db, slug);
  if (!row) return `no problem found for slug: ${slug}`;
  const { problem, attempt } = row;
  if (!attempt) return `no attempts logged for: ${slug} — run log-attempt first`;

  const patterns = JSON.parse(problem.patterns || '[]');
  const patternWikis = patterns.map(name => getPatternWiki(db, name)).filter(Boolean);

  // Priority: --code-file > --code > session.md python block
  let code = '';
  if (args['code-file'] || args.codeFile) {
    try { code = fs.readFileSync(args['code-file'] ?? args.codeFile, 'utf8').trim(); } catch { /* ignore */ }
  } else if (args.code) {
    code = args.code;
  } else if (args.sessionPath) {
    try {
      const session = fs.readFileSync(args.sessionPath, 'utf8');
      const match = session.match(/```python\d*\n([\s\S]*?)```/);
      if (match) code = match[1].trim();
    } catch { /* session.md missing — proceed without code */ }
  }

  process.stderr.write(`generating notes for ${slug}...\n`);
  const notesPath = await generateAndSaveNotes({ problem, attempt, code, patternWikis, publicDir: PUBLIC_DIR });
  setProblemNotesPath(db, slug, notesPath);
  return `notes saved: http://localhost:8765/${notesPath}`;
}

function daysBetween(fromDate, toDate) {
  const ms = new Date(toDate + "T00:00:00Z") - new Date(fromDate + "T00:00:00Z");
  return Math.round(ms / 86400000);
}
