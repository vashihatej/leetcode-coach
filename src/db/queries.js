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
