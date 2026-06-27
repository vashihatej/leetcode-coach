CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT,
  difficulty TEXT,
  topic_tags TEXT,
  url TEXT,
  description TEXT,
  examples TEXT,
  constraints TEXT
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
  final_approach TEXT,
  aha_moments TEXT,
  confusion_points TEXT,
  analogy_liked TEXT,
  viz_path TEXT
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

CREATE TABLE IF NOT EXISTS pattern_wiki (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_id INTEGER UNIQUE NOT NULL REFERENCES patterns(id),
  description TEXT,
  signals TEXT,
  invariant TEXT,
  analogy TEXT,
  template_code TEXT,
  mistakes TEXT,
  when_not TEXT,
  related TEXT,
  time_complexity TEXT,
  space_complexity TEXT,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT,
  difficulty TEXT,
  url TEXT,
  notes TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS problem_lists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS list_problems (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id      INTEGER NOT NULL REFERENCES problem_lists(id) ON DELETE CASCADE,
  problem_id   INTEGER REFERENCES problems(id),
  slug         TEXT NOT NULL,
  title        TEXT,
  url          TEXT,
  difficulty   TEXT,
  pattern_tags TEXT,
  UNIQUE(list_id, slug)
);
