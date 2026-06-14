import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, "schema.sql"), "utf8");

function migrate(db) {
  // Pre-Stage-4 databases have review_queue without the reps column.
  const cols = db.prepare("PRAGMA table_info(review_queue)").all();
  if (!cols.some((c) => c.name === "reps")) {
    db.exec("ALTER TABLE review_queue ADD COLUMN reps INTEGER NOT NULL DEFAULT 0");
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
