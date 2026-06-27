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
    ahaMoments = null,
    confusionPoints = null,
    analogyLiked = null,
    vizPath = null,
  } = attempt;
  const info = db
    .prepare(
      `INSERT INTO attempts
         (problem_id, date, solved, result_type, hints_used, time_spent, mistakes, final_approach,
          aha_moments, confusion_points, analogy_liked, viz_path)
       VALUES (@problemId, @date, @solved, @resultType, @hintsUsed, @timeSpent, @mistakes, @finalApproach,
               @ahaMoments, @confusionPoints, @analogyLiked, @vizPath)`
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
      ahaMoments,
      confusionPoints,
      analogyLiked,
      vizPath,
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

export function addToWishlist(db, { slug, title = null, difficulty = null, url = null }) {
  db.prepare(
    `INSERT INTO wishlist (slug, title, difficulty, url)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(slug) DO NOTHING`
  ).run(slug, title, difficulty, url);
}

export function listWishlist(db) {
  return db.prepare(
    `SELECT w.*, p.difficulty as prob_difficulty
     FROM wishlist w
     LEFT JOIN problems p ON p.slug = w.slug
     ORDER BY w.added_at DESC, w.id DESC`
  ).all();
}

export function updateWishlistNotes(db, slug, notes) {
  db.prepare('UPDATE wishlist SET notes = ? WHERE slug = ?').run(notes, slug);
}

export function removeFromWishlist(db, slug) {
  db.prepare('DELETE FROM wishlist WHERE slug = ?').run(slug);
}

export function getStats(db) {
  const totalProblems = db.prepare('SELECT COUNT(*) as c FROM problems').get().c;
  const solvedProblems = db.prepare(
    'SELECT COUNT(DISTINCT problem_id) as c FROM attempts WHERE solved = 1'
  ).get().c;
  const attemptsToday = db.prepare(
    "SELECT COUNT(*) as c FROM attempts WHERE date(date) = date('now')"
  ).get().c;
  const dueToday = db.prepare(
    "SELECT COUNT(*) as c FROM review_queue WHERE due_date <= date('now')"
  ).get().c;
  const patternCount = db.prepare('SELECT COUNT(*) as c FROM patterns').get().c;

  const dates = db
    .prepare("SELECT DISTINCT date(date) as day FROM attempts ORDER BY day DESC")
    .all()
    .map(r => r.day);

  let streak = 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  let expected = todayStr;
  for (const day of dates) {
    if (day === expected) {
      streak++;
      const d = new Date(expected + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      expected = d.toISOString().slice(0, 10);
    } else {
      break;
    }
  }

  return { total_problems: totalProblems, solved_problems: solvedProblems, attempts_today: attemptsToday, due_today: dueToday, pattern_count: patternCount, streak };
}

export function listProblemsWithSummary(db) {
  return db.prepare(`
    SELECT
      p.id, p.slug, p.title, p.difficulty, p.topic_tags, p.url,
      (SELECT a.solved FROM attempts a WHERE a.problem_id = p.id ORDER BY a.date DESC, a.id DESC LIMIT 1) as last_solved,
      (SELECT a.result_type FROM attempts a WHERE a.problem_id = p.id ORDER BY a.date DESC, a.id DESC LIMIT 1) as last_result_type,
      (SELECT a.hints_used FROM attempts a WHERE a.problem_id = p.id ORDER BY a.date DESC, a.id DESC LIMIT 1) as last_hints_used,
      (SELECT a.viz_path FROM attempts a WHERE a.problem_id = p.id AND a.viz_path IS NOT NULL ORDER BY a.date DESC, a.id DESC LIMIT 1) as last_viz_path,
      (SELECT COUNT(*) FROM attempts a WHERE a.problem_id = p.id) as attempt_count,
      r.due_date,
      r.ease,
      r.reps,
      (SELECT json_group_array(pat.name)
       FROM patterns pat
       JOIN pattern_problems pp ON pp.pattern_id = pat.id
       WHERE pp.problem_id = p.id) as patterns
    FROM problems p
    LEFT JOIN review_queue r ON r.problem_id = p.id
    ORDER BY p.title
  `).all();
}

export function listAttemptsForProblem(db, slug) {
  return db.prepare(`
    SELECT a.*
    FROM attempts a
    JOIN problems p ON p.id = a.problem_id
    WHERE p.slug = ?
    ORDER BY a.date DESC, a.id DESC
  `).all(slug);
}

export function listPatternsWithStats(db) {
  return db.prepare(`
    SELECT
      p.*,
      (SELECT COUNT(*) FROM pattern_problems pp WHERE pp.pattern_id = p.id) as problem_count,
      CASE WHEN p.times_seen > 0
        THEN ROUND(CAST(p.times_instinct_fired AS REAL) / p.times_seen, 2)
        ELSE 0
      END as instinct_rate
    FROM patterns p
    ORDER BY p.name
  `).all();
}

export function listProblemsByPattern(db, name) {
  const normalized = String(name).trim().toLowerCase();
  return db.prepare(`
    SELECT
      prob.id, prob.slug, prob.title, prob.difficulty, prob.url,
      (SELECT a.solved FROM attempts a WHERE a.problem_id = prob.id ORDER BY a.date DESC, a.id DESC LIMIT 1) as last_solved,
      (SELECT a.result_type FROM attempts a WHERE a.problem_id = prob.id ORDER BY a.date DESC, a.id DESC LIMIT 1) as last_result_type,
      (SELECT a.hints_used FROM attempts a WHERE a.problem_id = prob.id ORDER BY a.date DESC, a.id DESC LIMIT 1) as last_hints_used,
      (SELECT COUNT(*) FROM attempts a WHERE a.problem_id = prob.id) as attempt_count,
      r.ease,
      r.reps,
      r.due_date
    FROM problems prob
    JOIN pattern_problems pp ON pp.problem_id = prob.id
    JOIN patterns pat ON pat.id = pp.pattern_id
    LEFT JOIN review_queue r ON r.problem_id = prob.id
    WHERE pat.name = ?
    ORDER BY prob.title
  `).all(normalized);
}

export function listDueReviewsFull(db, today, windowDays = 7) {
  const end = new Date(today + 'T00:00:00Z');
  end.setUTCDate(end.getUTCDate() + windowDays);
  const windowEnd = end.toISOString().slice(0, 10);
  return db.prepare(`
    SELECT r.*, p.slug, p.title, p.difficulty, p.url
    FROM review_queue r
    JOIN problems p ON p.id = r.problem_id
    WHERE r.due_date <= ?
    ORDER BY r.due_date ASC
  `).all(windowEnd);
}

export function getActivityData(db, since) {
  return db.prepare(`
    SELECT date(date) as date, COUNT(*) as count
    FROM attempts
    WHERE date(date) >= ?
    GROUP BY date(date)
    ORDER BY date ASC
  `).all(since);
}

export function upsertPatternWiki(db, { patternName, description, signals, invariant, analogy, templateCode, mistakes, whenNot, related, timeComplexity, spaceComplexity }) {
  const row = db.prepare('SELECT id FROM patterns WHERE name = ?').get(String(patternName).trim().toLowerCase());
  if (!row) throw new Error(`pattern not found: ${patternName}`);
  db.prepare(`
    INSERT INTO pattern_wiki
      (pattern_id, description, signals, invariant, analogy, template_code, mistakes, when_not, related, time_complexity, space_complexity)
    VALUES
      (@patternId, @description, @signals, @invariant, @analogy, @templateCode, @mistakes, @whenNot, @related, @timeComplexity, @spaceComplexity)
    ON CONFLICT(pattern_id) DO UPDATE SET
      description = excluded.description,
      signals = excluded.signals,
      invariant = excluded.invariant,
      analogy = excluded.analogy,
      template_code = excluded.template_code,
      mistakes = excluded.mistakes,
      when_not = excluded.when_not,
      related = excluded.related,
      time_complexity = excluded.time_complexity,
      space_complexity = excluded.space_complexity,
      generated_at = datetime('now')
  `).run({
    patternId: row.id,
    description: description ?? null,
    signals: signals ? JSON.stringify(signals) : null,
    invariant: invariant ?? null,
    analogy: analogy ?? null,
    templateCode: templateCode ?? null,
    mistakes: mistakes ? JSON.stringify(mistakes) : null,
    whenNot: whenNot ?? null,
    related: related ? JSON.stringify(related) : null,
    timeComplexity: timeComplexity ?? null,
    spaceComplexity: spaceComplexity ?? null,
  });
}

export function getPatternWiki(db, patternName) {
  return db.prepare(`
    SELECT w.*
    FROM pattern_wiki w
    JOIN patterns p ON p.id = w.pattern_id
    WHERE p.name = ?
  `).get(String(patternName).trim().toLowerCase());
}

export function listRecentAttempts(db, limit = 10) {
  return db.prepare(`
    SELECT
      a.id, a.date, a.solved, a.result_type, a.hints_used, a.time_spent,
      p.slug, p.title, p.difficulty, p.url,
      r.ease, r.reps
    FROM attempts a
    JOIN problems p ON p.id = a.problem_id
    LEFT JOIN review_queue r ON r.problem_id = a.problem_id
    ORDER BY a.date DESC, a.id DESC
    LIMIT ?
  `).all(limit);
}

export function getLists(db) {
  return db.prepare(`
    SELECT pl.id, pl.name, pl.created_at,
           COUNT(lp.id) AS problem_count
    FROM problem_lists pl
    LEFT JOIN list_problems lp ON lp.list_id = pl.id
    GROUP BY pl.id
    ORDER BY pl.created_at DESC
  `).all();
}

export function createList(db, name) {
  const result = db.prepare('INSERT INTO problem_lists (name) VALUES (?)').run(name);
  return { id: result.lastInsertRowid, name };
}

export function getListProblems(db, listId) {
  return db.prepare(
    'SELECT * FROM list_problems WHERE list_id = ? ORDER BY id'
  ).all(listId);
}

export function bulkInsertListProblems(db, listId, problems) {
  const upsertLP = db.prepare(`
    INSERT INTO list_problems (list_id, slug, url, pattern_tags, title, difficulty, problem_id)
    VALUES (@listId, @slug, @url, @patternTags, @title, @difficulty, @problemId)
    ON CONFLICT(list_id, slug) DO UPDATE SET
      pattern_tags = excluded.pattern_tags,
      title = excluded.title,
      difficulty = excluded.difficulty,
      problem_id = excluded.problem_id
  `);
  const upsertW = db.prepare(`
    INSERT OR IGNORE INTO wishlist (slug, url) VALUES (@slug, @url)
  `);
  const lookupProblem = db.prepare('SELECT id, title, difficulty FROM problems WHERE slug = ?');
  const run = db.transaction((probs) => {
    for (const p of probs) {
      const existing = lookupProblem.get(p.slug);
      upsertLP.run({
        listId,
        slug: p.slug,
        url: p.url,
        patternTags: JSON.stringify(p.pattern_tags),
        title: existing?.title ?? null,
        difficulty: existing?.difficulty ?? null,
        problemId: existing?.id ?? null,
      });
      upsertW.run({ slug: p.slug, url: p.url ?? null });
    }
  });
  run(problems);
}

export function deleteList(db, listId) {
  db.prepare('DELETE FROM problem_lists WHERE id = ?').run(listId);
}
