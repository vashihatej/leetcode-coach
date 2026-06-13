# LeetCode Coach — Stage 1: Coach Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local backend that ingests LeetCode activity events, persists them to SQLite, and maintains a live `session.md` the coach reads — plus a `coach` CLI to log attempts and inspect mastery. No browser/extension yet; everything is testable with `curl` and the CLI.

**Architecture:** A small Express server on `localhost` exposes `POST /event`. Each event upserts the problem into SQLite (`better-sqlite3`) and rewrites `session.md` (the coach's live view). A `coach` CLI reads/writes the same DB for logging attempts and querying the pattern-mastery map. Query and command logic live in pure functions that take a `db` handle (dependency injection) so they test against an in-memory database.

**Tech Stack:** Node (ESM), Express, better-sqlite3, commander (CLI), vitest + supertest (tests).

---

## File Structure

- `package.json` — project manifest, scripts, deps. ESM (`"type": "module"`).
- `src/config.js` — resolves PORT, DB_PATH, SESSION_PATH.
- `src/db/schema.sql` — SQLite DDL for all tables.
- `src/db/index.js` — `openDb(path)`: opens better-sqlite3, applies schema, returns handle.
- `src/db/queries.js` — pure query functions: `upsertProblem`, `insertAttempt`, `listAttempts`, `ensurePattern`, `setMastery`, `listMastery`.
- `src/session/sessionWriter.js` — `writeSession(filePath, event)`: renders event to markdown.
- `src/server/app.js` — `createApp(db, sessionPath)`: Express app with `POST /event` + `GET /health`.
- `src/server/index.js` — bootstraps the real DB + paths and listens on PORT.
- `src/cli/commands.js` — pure command functions returning strings: `cmdStatus`, `cmdLogAttempt`, `cmdMastery`, `cmdSetMastery`.
- `src/cli/coach.js` — `bin` entry; commander wires argv to commands and prints.
- `tests/*.test.js` — one test file per module.

---

## Task 1: Project setup

**Files:**
- Create: `package.json`
- Create: `src/config.js`
- Create: `vitest.config.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "leetcode-coach",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "coach": "src/cli/coach.js"
  },
  "scripts": {
    "start": "node src/server/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "commander": "^12.0.0",
    "express": "^4.19.0"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors. (`better-sqlite3` compiles a native binding — expect a short build.)

- [ ] **Step 3: Create `vitest.config.js`**

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
});
```

- [ ] **Step 4: Create `src/config.js`**

```js
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const PORT = Number(process.env.COACH_PORT) || 8765;
export const DB_PATH = path.join(root, "coach.db");
export const SESSION_PATH = path.join(root, "session.md");
```

- [ ] **Step 5: Verify the test runner works (no tests yet)**

Run: `npx vitest run`
Expected: exits cleanly reporting "No test files found" (exit code 0 with `--passWithNoTests` is not set, so it may report no files — that is fine for this step).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.js src/config.js
git commit -m "chore: scaffold coach-core project (Stage 1)"
```

---

## Task 2: Database schema and connection

**Files:**
- Create: `src/db/schema.sql`
- Create: `src/db/index.js`
- Test: `tests/db.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/db.test.js
import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/index.js";

describe("openDb", () => {
  it("creates all expected tables", () => {
    const db = openDb(":memory:");
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);
    expect(rows).toEqual(
      expect.arrayContaining([
        "problems",
        "attempts",
        "patterns",
        "pattern_problems",
        "review_queue",
      ])
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db.test.js`
Expected: FAIL — cannot import `openDb` (module not found).

- [ ] **Step 3: Create `src/db/schema.sql`**

```sql
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
  ease REAL NOT NULL DEFAULT 2.5
);
```

- [ ] **Step 4: Create `src/db/index.js`**

```js
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, "schema.sql"), "utf8");

export function openDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(schema);
  return db;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/db.test.js`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.sql src/db/index.js tests/db.test.js
git commit -m "feat: add sqlite schema and openDb"
```

---

## Task 3: Problem upsert query

**Files:**
- Create: `src/db/queries.js`
- Test: `tests/queries.problems.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/queries.problems.test.js
import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/index.js";
import { upsertProblem } from "../src/db/queries.js";

const sample = {
  slug: "two-sum",
  title: "Two Sum",
  difficulty: "Easy",
  topicTags: ["Array", "Hash Table"],
  url: "https://leetcode.com/problems/two-sum/",
};

describe("upsertProblem", () => {
  it("inserts a new problem and returns its id", () => {
    const db = openDb(":memory:");
    const id = upsertProblem(db, sample);
    expect(id).toBeTypeOf("number");
    const row = db.prepare("SELECT * FROM problems WHERE id = ?").get(id);
    expect(row.slug).toBe("two-sum");
    expect(JSON.parse(row.topic_tags)).toEqual(["Array", "Hash Table"]);
  });

  it("updates fields and keeps the same id on repeat slug", () => {
    const db = openDb(":memory:");
    const id1 = upsertProblem(db, sample);
    const id2 = upsertProblem(db, { ...sample, title: "Two Sum (v2)" });
    expect(id2).toBe(id1);
    const row = db.prepare("SELECT title FROM problems WHERE id = ?").get(id1);
    expect(row.title).toBe("Two Sum (v2)");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/queries.problems.test.js`
Expected: FAIL — cannot import `upsertProblem`.

- [ ] **Step 3: Create `src/db/queries.js` with `upsertProblem`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/queries.problems.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/db/queries.js tests/queries.problems.test.js
git commit -m "feat: add upsertProblem query"
```

---

## Task 4: Attempt queries

**Files:**
- Modify: `src/db/queries.js`
- Test: `tests/queries.attempts.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/queries.attempts.test.js
import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/index.js";
import { upsertProblem, insertAttempt, listAttempts } from "../src/db/queries.js";

describe("attempts", () => {
  it("inserts an attempt and lists it back for a problem", () => {
    const db = openDb(":memory:");
    const problemId = upsertProblem(db, { slug: "two-sum", title: "Two Sum" });
    const id = insertAttempt(db, {
      problemId,
      solved: true,
      resultType: "optimal",
      hintsUsed: [1, 2],
      timeSpent: 600,
      mistakes: "off-by-one at first",
      finalApproach: "hash map one-pass",
    });
    expect(id).toBeTypeOf("number");
    const rows = listAttempts(db, problemId);
    expect(rows).toHaveLength(1);
    expect(rows[0].solved).toBe(1);
    expect(rows[0].result_type).toBe("optimal");
    expect(JSON.parse(rows[0].hints_used)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/queries.attempts.test.js`
Expected: FAIL — `insertAttempt`/`listAttempts` not exported.

- [ ] **Step 3: Add `insertAttempt` and `listAttempts` to `src/db/queries.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/queries.attempts.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/db/queries.js tests/queries.attempts.test.js
git commit -m "feat: add attempt insert and list queries"
```

---

## Task 5: Pattern mastery queries

**Files:**
- Modify: `src/db/queries.js`
- Test: `tests/queries.patterns.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/queries.patterns.test.js
import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/index.js";
import { ensurePattern, setMastery, listMastery } from "../src/db/queries.js";

describe("patterns", () => {
  it("creates a pattern with default mastery", () => {
    const db = openDb(":memory:");
    const id = ensurePattern(db, "sliding window");
    expect(id).toBeTypeOf("number");
    const list = listMastery(db);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("sliding window");
    expect(list[0].mastery).toBe("not_started");
  });

  it("ensurePattern is idempotent on name", () => {
    const db = openDb(":memory:");
    const a = ensurePattern(db, "two pointers");
    const b = ensurePattern(db, "two pointers");
    expect(b).toBe(a);
  });

  it("setMastery updates level and last_practiced", () => {
    const db = openDb(":memory:");
    ensurePattern(db, "dynamic programming");
    setMastery(db, "dynamic programming", "shaky");
    const row = listMastery(db).find((p) => p.name === "dynamic programming");
    expect(row.mastery).toBe("shaky");
    expect(row.last_practiced).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/queries.patterns.test.js`
Expected: FAIL — `ensurePattern`/`setMastery`/`listMastery` not exported.

- [ ] **Step 3: Add pattern functions to `src/db/queries.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/queries.patterns.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/db/queries.js tests/queries.patterns.test.js
git commit -m "feat: add pattern mastery queries"
```

---

## Task 6: Session writer

**Files:**
- Create: `src/session/sessionWriter.js`
- Test: `tests/sessionWriter.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/sessionWriter.test.js
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeSession } from "../src/session/sessionWriter.js";

const tmp = path.join(os.tmpdir(), `session-${Date.now()}.md`);
afterEach(() => fs.existsSync(tmp) && fs.unlinkSync(tmp));

describe("writeSession", () => {
  it("renders problem, code, and last result to markdown", () => {
    writeSession(tmp, {
      slug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      topicTags: ["Array", "Hash Table"],
      url: "https://leetcode.com/problems/two-sum/",
      language: "python3",
      code: "def two_sum(nums, target):\n    pass",
      lastResult: { type: "submit", status: "Wrong Answer", details: "case 5 failed" },
    });
    const out = fs.readFileSync(tmp, "utf8");
    expect(out).toContain("# Two Sum");
    expect(out).toContain("Easy");
    expect(out).toContain("python3");
    expect(out).toContain("def two_sum");
    expect(out).toContain("Wrong Answer");
  });

  it("handles missing code and result gracefully", () => {
    writeSession(tmp, { slug: "x", title: "X", difficulty: "Hard" });
    const out = fs.readFileSync(tmp, "utf8");
    expect(out).toContain("# X");
    expect(out).toContain("_(no code yet)_");
    expect(out).toContain("_(no run/submit yet)_");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sessionWriter.test.js`
Expected: FAIL — cannot import `writeSession`.

- [ ] **Step 3: Create `src/session/sessionWriter.js`**

```js
import fs from "node:fs";

export function writeSession(filePath, event) {
  const {
    title = "(unknown)",
    difficulty = "",
    topicTags = [],
    url = "",
    language = "",
    code,
    lastResult,
  } = event;

  const tags = topicTags.length ? topicTags.join(", ") : "—";
  const codeBlock = code
    ? "```" + (language || "") + "\n" + code + "\n```"
    : "_(no code yet)_";

  let resultBlock = "_(no run/submit yet)_";
  if (lastResult) {
    const { type = "?", status = "?", details = "" } = lastResult;
    resultBlock = `**${type}** → ${status}${details ? `\n\n${details}` : ""}`;
  }

  const md = `# ${title}

- **Difficulty:** ${difficulty || "—"}
- **Tags:** ${tags}
- **URL:** ${url || "—"}
- **Language:** ${language || "—"}
- **Updated:** ${new Date().toISOString()}

## Current code

${codeBlock}

## Last result

${resultBlock}
`;

  fs.writeFileSync(filePath, md, "utf8");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sessionWriter.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/session/sessionWriter.js tests/sessionWriter.test.js
git commit -m "feat: add session.md writer"
```

---

## Task 7: Express server with POST /event

**Files:**
- Create: `src/server/app.js`
- Create: `src/server/index.js`
- Test: `tests/server.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/server.test.js
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb } from "../src/db/index.js";
import { createApp } from "../src/server/app.js";

const tmp = path.join(os.tmpdir(), `session-srv-${Date.now()}.md`);
afterEach(() => fs.existsSync(tmp) && fs.unlinkSync(tmp));

describe("POST /event", () => {
  it("persists the problem and writes session.md", async () => {
    const db = openDb(":memory:");
    const app = createApp(db, tmp);

    const res = await request(app)
      .post("/event")
      .send({
        slug: "two-sum",
        title: "Two Sum",
        difficulty: "Easy",
        topicTags: ["Array"],
        url: "https://leetcode.com/problems/two-sum/",
        language: "python3",
        code: "print(1)",
        lastResult: { type: "run", status: "Accepted" },
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const row = db.prepare("SELECT * FROM problems WHERE slug = ?").get("two-sum");
    expect(row.title).toBe("Two Sum");
    expect(fs.readFileSync(tmp, "utf8")).toContain("# Two Sum");
  });

  it("rejects an event with no slug", async () => {
    const db = openDb(":memory:");
    const app = createApp(db, tmp);
    const res = await request(app).post("/event").send({ title: "no slug" });
    expect(res.status).toBe(400);
  });

  it("GET /health returns ok", async () => {
    const db = openDb(":memory:");
    const app = createApp(db, tmp);
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server.test.js`
Expected: FAIL — cannot import `createApp`.

- [ ] **Step 3: Create `src/server/app.js`**

```js
import express from "express";
import { upsertProblem } from "../db/queries.js";
import { writeSession } from "../session/sessionWriter.js";

export function createApp(db, sessionPath) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.post("/event", (req, res) => {
    const event = req.body || {};
    if (!event.slug) {
      return res.status(400).json({ ok: false, error: "missing slug" });
    }
    upsertProblem(db, event);
    writeSession(sessionPath, event);
    res.json({ ok: true });
  });

  return app;
}
```

- [ ] **Step 4: Create `src/server/index.js`**

```js
import { openDb } from "../db/index.js";
import { createApp } from "./app.js";
import { PORT, DB_PATH, SESSION_PATH } from "../config.js";

const db = openDb(DB_PATH);
const app = createApp(db, SESSION_PATH);

app.listen(PORT, () => {
  console.log(`coach server listening on http://localhost:${PORT}`);
  console.log(`session file: ${SESSION_PATH}`);
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/server.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/app.js src/server/index.js tests/server.test.js
git commit -m "feat: add express server with POST /event"
```

---

## Task 8: Coach CLI

**Files:**
- Create: `src/cli/commands.js`
- Create: `src/cli/coach.js`
- Test: `tests/commands.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/commands.test.js
import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/index.js";
import { upsertProblem } from "../src/db/queries.js";
import {
  cmdLogAttempt,
  cmdMastery,
  cmdSetMastery,
} from "../src/cli/commands.js";

describe("cli commands", () => {
  it("cmdLogAttempt records an attempt for an existing slug", () => {
    const db = openDb(":memory:");
    upsertProblem(db, { slug: "two-sum", title: "Two Sum" });
    const out = cmdLogAttempt(db, {
      slug: "two-sum",
      solved: true,
      result: "optimal",
      hints: "1,2",
      mistakes: "off by one",
      approach: "hash map",
    });
    expect(out).toContain("logged attempt");
    const row = db.prepare("SELECT * FROM attempts").get();
    expect(row.solved).toBe(1);
    expect(JSON.parse(row.hints_used)).toEqual([1, 2]);
  });

  it("cmdSetMastery then cmdMastery shows the level", () => {
    const db = openDb(":memory:");
    cmdSetMastery(db, { pattern: "sliding window", level: "solid" });
    const out = cmdMastery(db);
    expect(out).toContain("sliding window");
    expect(out).toContain("solid");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/commands.test.js`
Expected: FAIL — cannot import command functions.

- [ ] **Step 3: Create `src/cli/commands.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/commands.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Create the CLI entry `src/cli/coach.js`**

```js
#!/usr/bin/env node
import { Command } from "commander";
import { openDb } from "../db/index.js";
import { DB_PATH, SESSION_PATH } from "../config.js";
import {
  cmdLogAttempt,
  cmdMastery,
  cmdSetMastery,
  cmdStatus,
} from "./commands.js";

const db = openDb(DB_PATH);
const program = new Command();
program.name("coach").description("LeetCode Coach CLI");

program
  .command("status")
  .description("print the current session.md")
  .action(() => console.log(cmdStatus(db, SESSION_PATH)));

program
  .command("log-attempt")
  .requiredOption("--slug <slug>")
  .option("--solved", "mark as solved", false)
  .option("--result <type>", "brute | optimal")
  .option("--hints <list>", "comma-separated rung numbers")
  .option("--mistakes <text>")
  .option("--approach <text>")
  .action((opts) => console.log(cmdLogAttempt(db, opts)));

program
  .command("mastery")
  .description("print the pattern mastery map")
  .action(() => console.log(cmdMastery(db)));

program
  .command("set-mastery")
  .requiredOption("--pattern <name>")
  .requiredOption("--level <level>", "not_started | shaky | solid")
  .action((opts) => console.log(cmdSetMastery(db, opts)));

program.parse();
```

- [ ] **Step 6: Make the CLI executable and verify it runs**

Run: `chmod +x src/cli/coach.js && node src/cli/coach.js mastery`
Expected: prints `no patterns tracked yet`.

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands.js src/cli/coach.js tests/commands.test.js
git commit -m "feat: add coach CLI (status, log-attempt, mastery, set-mastery)"
```

---

## Task 9: End-to-end smoke test and run docs

**Files:**
- Create: `README.md`
- Test: manual (curl + CLI)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all test files PASS (db, queries.problems, queries.attempts, queries.patterns, sessionWriter, server, commands).

- [ ] **Step 2: Start the server in the background**

Run: `node src/server/index.js &`
Expected: logs `coach server listening on http://localhost:8765`.

- [ ] **Step 3: Send a fake event with curl**

Run:
```bash
curl -s -X POST http://localhost:8765/event \
  -H 'Content-Type: application/json' \
  -d '{"slug":"two-sum","title":"Two Sum","difficulty":"Easy","topicTags":["Array"],"url":"https://leetcode.com/problems/two-sum/","language":"python3","code":"print(1)","lastResult":{"type":"run","status":"Accepted"}}'
```
Expected: `{"ok":true}`.

- [ ] **Step 4: Verify the session file and CLI**

Run: `node src/cli/coach.js status`
Expected: prints the rendered `# Two Sum` markdown including the code block.

Run: `node src/cli/coach.js log-attempt --slug two-sum --solved --result optimal --hints 1,2 --approach "hash map" && node src/cli/coach.js set-mastery --pattern "hashing" --level shaky && node src/cli/coach.js mastery`
Expected: confirms the logged attempt and prints `shaky  hashing` in the mastery list.

- [ ] **Step 5: Stop the background server**

Run: `kill %1` (or find the PID and `kill <pid>`).
Expected: server process stops.

- [ ] **Step 6: Create `README.md`**

```markdown
# LeetCode Coach

Local coach backend (Stage 1). See `docs/superpowers/specs/` for the design.

## Run

```bash
npm install
npm test          # run the test suite
npm start         # start the coach server on http://localhost:8765
```

## CLI

```bash
node src/cli/coach.js status         # show current session.md
node src/cli/coach.js mastery        # show pattern mastery map
node src/cli/coach.js set-mastery --pattern "sliding window" --level solid
node src/cli/coach.js log-attempt --slug two-sum --solved --result optimal --hints 1,2 --approach "hash map"
```

Events arrive at `POST /event`; the server writes `session.md` (the coach's live view)
and persists to `coach.db`.
```

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: add Stage 1 run instructions"
```

---

## Self-Review Notes

- **Spec coverage (Stage 1 portion):** server + `session.md` (Task 6,7), SQLite schema for
  problems/attempts/patterns/pattern_problems/review_queue (Task 2), `coach` CLI with
  status/log-attempt/mastery/set-mastery (Task 8). `review_queue` table is created now but its
  scheduling logic is deferred to Stage 4 by design. Visualizer (Stage 5), extension (Stage 3),
  and the coaching skill (Stage 2) are out of this plan by the agreed staging.
- **Placeholder scan:** none — every code step contains full code; every command lists expected output.
- **Type consistency:** event fields (`slug`, `title`, `difficulty`, `topicTags`, `url`,
  `language`, `code`, `lastResult{type,status,details}`) are used identically across
  `upsertProblem`, `writeSession`, and the server. Query function names
  (`upsertProblem`, `insertAttempt`, `listAttempts`, `ensurePattern`, `setMastery`,
  `listMastery`) match their imports in `app.js` and `commands.js`.
