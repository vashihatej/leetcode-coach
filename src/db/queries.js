export function upsertProblem(db, problem) {
  const { slug, title, difficulty, topicTags, url } = problem;
  const tags = JSON.stringify(topicTags ?? []);
  db.prepare(
    `INSERT INTO problems (slug, title, difficulty, topic_tags, url)
     VALUES (@slug, @title, @difficulty, @tags, @url)
     ON CONFLICT(slug) DO UPDATE SET
       title = excluded.title,
       difficulty = excluded.difficulty,
       topic_tags = excluded.topic_tags,
       url = excluded.url`
  ).run({ slug, title, difficulty, tags, url });
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
  db.prepare(
    "INSERT INTO patterns (name) VALUES (?) ON CONFLICT(name) DO NOTHING"
  ).run(name);
  return db.prepare("SELECT id FROM patterns WHERE name = ?").get(name).id;
}

export function setMastery(db, name, level) {
  if (!VALID_MASTERY.includes(level)) {
    throw new Error(`invalid mastery level: ${level}`);
  }
  ensurePattern(db, name);
  db.prepare(
    "UPDATE patterns SET mastery = ?, last_practiced = ? WHERE name = ?"
  ).run(level, new Date().toISOString(), name);
}

export function listMastery(db) {
  return db.prepare("SELECT * FROM patterns ORDER BY name").all();
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
