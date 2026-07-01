import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, "schema.sql"), "utf8");

function migrate(db) {
  // Pre-Stage-4 databases have review_queue without the reps column.
  const reviewCols = db.prepare("PRAGMA table_info(review_queue)").all();
  if (!reviewCols.some((column) => column.name === "reps")) {
    db.exec("ALTER TABLE review_queue ADD COLUMN reps INTEGER NOT NULL DEFAULT 0");
  }

  const attemptCols = db.prepare("PRAGMA table_info(attempts)").all();
  const attemptAdditions = [
    ["aha_moments", "TEXT"],
    ["confusion_points", "TEXT"],
    ["analogy_liked", "TEXT"],
    ["viz_path", "TEXT"],
  ];
  for (const [name, type] of attemptAdditions) {
    if (!attemptCols.some((column) => column.name === name)) {
      db.exec(`ALTER TABLE attempts ADD COLUMN ${name} ${type}`);
    }
  }

  const problemCols = db.prepare("PRAGMA table_info(problems)").all();
  const additions = [
    ["description", "TEXT"],
    ["examples", "TEXT"],
    ["constraints", "TEXT"],
    ["viz_path", "TEXT"],
    ["notes_path", "TEXT"],
  ];
  for (const [name, type] of additions) {
    if (!problemCols.some((column) => column.name === name)) {
      db.exec(`ALTER TABLE problems ADD COLUMN ${name} ${type}`);
    }
  }
}

export function openDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(schema);
  migrate(db);
  return db;
}
