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
