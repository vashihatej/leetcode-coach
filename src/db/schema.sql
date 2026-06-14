CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT,
  difficulty TEXT,
  topic_tags TEXT,
  url TEXT
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL REFERENCES problems(id),
  date TEXT NOT NULL,
  solved INTEGER NOT NULL DEFAULT 0,
  result_type TEXT,
  hints_used TEXT,
  time_spent INTEGER,
  mistakes TEXT,
  final_approach TEXT
);

CREATE TABLE IF NOT EXISTS patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  mastery TEXT NOT NULL DEFAULT 'not_started',
  times_seen INTEGER NOT NULL DEFAULT 0,
  times_instinct_fired INTEGER NOT NULL DEFAULT 0,
  last_practiced TEXT
);

CREATE TABLE IF NOT EXISTS pattern_problems (
  pattern_id INTEGER NOT NULL REFERENCES patterns(id),
  problem_id INTEGER NOT NULL REFERENCES problems(id),
  PRIMARY KEY (pattern_id, problem_id)
);

CREATE TABLE IF NOT EXISTS review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER UNIQUE NOT NULL REFERENCES problems(id),
  due_date TEXT NOT NULL,
  interval INTEGER NOT NULL DEFAULT 1,
  ease REAL NOT NULL DEFAULT 2.5,
  reps INTEGER NOT NULL DEFAULT 0
);
