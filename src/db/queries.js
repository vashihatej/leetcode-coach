export function upsertProblem(db, problem) {
  const {
    slug,
    title = null,
    difficulty = null,
    topicTags = null,
    url = null,
    description = null,
    examples = null,
    constraints = null,
  } = problem;
  const tags = topicTags == null ? null : JSON.stringify(topicTags);
  const exampleJson = examples == null ? null : JSON.stringify(examples);
  const constraintJson = constraints == null ? null : JSON.stringify(constraints);
  db.prepare(
    `INSERT INTO problems
       (slug, title, difficulty, topic_tags, url, description, examples, constraints)
     VALUES
       (@slug, @title, @difficulty, @tags, @url, @description, @exampleJson, @constraintJson)
     ON CONFLICT(slug) DO UPDATE SET
       title = COALESCE(excluded.title, problems.title),
       difficulty = COALESCE(excluded.difficulty, problems.difficulty),
       topic_tags = COALESCE(excluded.topic_tags, problems.topic_tags),
       url = COALESCE(excluded.url, problems.url),
       description = COALESCE(excluded.description, problems.description),
       examples = COALESCE(excluded.examples, problems.examples),
       constraints = COALESCE(excluded.constraints, problems.constraints)`
  ).run({
    slug,
    title,
    difficulty,
    tags,
    url,
    description,
    exampleJson,
    constraintJson,
  });
  return db.prepare("SELECT id FROM problems WHERE slug = ?").get(slug).id;
}

export function insertAttempt(db, attempt) {
  const {
    problemId,
    solved = false,
    resultType = null,
    hintsUsed = [],
    timeSpent = null,
    mistakes = null,
    finalApproach = null,
  } = attempt;
  const info = db
    .prepare(
      `INSERT INTO attempts
         (problem_id, date, solved, result_type, hints_used, time_spent, mistakes, final_approach)
       VALUES (@problemId, @date, @solved, @resultType, @hintsUsed, @timeSpent, @mistakes, @finalApproach)`
    )
    .run({
      problemId,
      date: new Date().toISOString(),
      solved: solved ? 1 : 0,
      resultType,
      hintsUsed: JSON.stringify(hintsUsed),
      timeSpent,
      mistakes,
      finalApproach,
    });
  return Number(info.lastInsertRowid);
}

export function listAttempts(db, problemId) {
  return db
    .prepare("SELECT * FROM attempts WHERE problem_id = ? ORDER BY date DESC")
    .all(problemId);
}

const VALID_MASTERY = ["not_started", "shaky", "solid"];

export function ensurePattern(db, name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) throw new Error("pattern name is required");
  db.prepare(
    "INSERT INTO patterns (name) VALUES (?) ON CONFLICT(name) DO NOTHING"
  ).run(normalized);
  return db.prepare("SELECT id FROM patterns WHERE name = ?").get(normalized).id;
}

export function setMastery(db, name, level) {
  if (!VALID_MASTERY.includes(level)) {
    throw new Error(`invalid mastery level: ${level}`);
  }
  const normalized = String(name || "").trim().toLowerCase();
  ensurePattern(db, normalized);
  db.prepare(
    "UPDATE patterns SET mastery = ?, last_practiced = ? WHERE name = ?"
  ).run(level, new Date().toISOString(), normalized);
}

export function listMastery(db) {
  return db.prepare("SELECT * FROM patterns ORDER BY name").all();
}

export function recordPatternOutcome(db, { problemId, name, instinctFired = false }) {
  const patternName = String(name || "").trim().toLowerCase();
  if (!patternName) throw new Error("pattern name is required");
  const patternId = ensurePattern(db, patternName);
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO pattern_problems (pattern_id, problem_id)
       VALUES (?, ?)
       ON CONFLICT(pattern_id, problem_id) DO NOTHING`
    ).run(patternId, problemId);
    db.prepare(
      `UPDATE patterns
       SET times_seen = times_seen + 1,
           times_instinct_fired = times_instinct_fired + ?,
           last_practiced = ?
       WHERE id = ?`
    ).run(instinctFired ? 1 : 0, now, patternId);
  })();

  return patternId;
}

export function listProblemPatterns(db, problemId) {
  return db
    .prepare(
      `SELECT p.*
       FROM patterns p
       JOIN pattern_problems pp ON pp.pattern_id = p.id
       WHERE pp.problem_id = ?
       ORDER BY p.name`
    )
    .all(problemId);
}

export function getReview(db, problemId) {
  return db.prepare("SELECT * FROM review_queue WHERE problem_id = ?").get(problemId);
}

export function upsertReview(db, { problemId, dueDate, interval, ease, reps }) {
  db.prepare(
    `INSERT INTO review_queue (problem_id, due_date, interval, ease, reps)
     VALUES (@problemId, @dueDate, @interval, @ease, @reps)
     ON CONFLICT(problem_id) DO UPDATE SET
       due_date = excluded.due_date,
       interval = excluded.interval,
       ease = excluded.ease,
       reps = excluded.reps`
  ).run({ problemId, dueDate, interval, ease, reps });
}

export function listDueReviews(db, asOfDate) {
  return db
    .prepare(
      `SELECT r.*, p.slug, p.title, p.difficulty
       FROM review_queue r
       JOIN problems p ON p.id = r.problem_id
       WHERE r.due_date <= ?
       ORDER BY r.due_date ASC`
    )
    .all(asOfDate);
}
