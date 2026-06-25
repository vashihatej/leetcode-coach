import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import {
  getStats,
  listProblemsWithSummary,
  listAttemptsForProblem,
  listPatternsWithStats,
  listDueReviewsFull,
  getActivityData,
  listRecentAttempts,
  upsertProblem,
  insertAttempt,
  ensurePattern,
  recordPatternOutcome,
} from '../src/db/queries.js';

function openMemoryDb() {
  const db = new Database(':memory:');
  db.exec(readFileSync('src/db/schema.sql', 'utf8'));
  return db;
}

describe('getStats', () => {
  let db;
  beforeEach(() => { db = openMemoryDb(); });

  it('returns zeros on empty db', () => {
    const s = getStats(db);
    expect(s.total_problems).toBe(0);
    expect(s.solved_problems).toBe(0);
    expect(s.due_today).toBe(0);
    expect(s.pattern_count).toBe(0);
    expect(s.streak).toBe(0);
  });

  it('counts total problems', () => {
    upsertProblem(db, { slug: 'two-sum' });
    upsertProblem(db, { slug: 'three-sum' });
    expect(getStats(db).total_problems).toBe(2);
  });

  it('counts solved problems as distinct problem_ids', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    insertAttempt(db, { problemId: pid, solved: true });
    insertAttempt(db, { problemId: pid, solved: true });
    expect(getStats(db).solved_problems).toBe(1);
  });

  it('does not count unsolved attempts toward solved_problems', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    insertAttempt(db, { problemId: pid, solved: false });
    expect(getStats(db).solved_problems).toBe(0);
  });

  it('computes streak of 2 consecutive days', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 1)').run(pid, today + 'T12:00:00.000Z');
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 1)').run(pid, yesterday + 'T12:00:00.000Z');
    expect(getStats(db).streak).toBe(2);
  });

  it('streak stops at first gap', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    const today = new Date().toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 1)').run(pid, today + 'T12:00:00.000Z');
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 1)').run(pid, twoDaysAgo + 'T12:00:00.000Z');
    expect(getStats(db).streak).toBe(1);
  });

  it('streak is 0 when no attempts today or yesterday', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 1)').run(pid, twoDaysAgo + 'T12:00:00.000Z');
    expect(getStats(db).streak).toBe(0);
  });
});

describe('listProblemsWithSummary', () => {
  let db;
  beforeEach(() => { db = openMemoryDb(); });

  it('returns empty array when no problems', () => {
    expect(listProblemsWithSummary(db)).toEqual([]);
  });

  it('returns attempt_count', () => {
    const pid = upsertProblem(db, { slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy' });
    insertAttempt(db, { problemId: pid, solved: true });
    insertAttempt(db, { problemId: pid, solved: false });
    const rows = listProblemsWithSummary(db);
    expect(rows[0].attempt_count).toBe(2);
  });

  it('last_solved reflects most recent attempt', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    insertAttempt(db, { problemId: pid, solved: true });
    insertAttempt(db, { problemId: pid, solved: false });
    const rows = listProblemsWithSummary(db);
    expect(rows[0].last_solved).toBe(0);
  });

  it('returns null review fields when problem has no review row', () => {
    upsertProblem(db, { slug: 'two-sum' });
    const rows = listProblemsWithSummary(db);
    expect(rows[0].due_date).toBeNull();
    expect(rows[0].ease).toBeNull();
  });
});

describe('listAttemptsForProblem', () => {
  let db;
  beforeEach(() => { db = openMemoryDb(); });

  it('returns attempts ordered newest first', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    insertAttempt(db, { problemId: pid, solved: true });
    insertAttempt(db, { problemId: pid, solved: false });
    const rows = listAttemptsForProblem(db, 'two-sum');
    expect(rows).toHaveLength(2);
    expect(rows[0].solved).toBe(0);
  });

  it('returns empty array for unknown slug', () => {
    expect(listAttemptsForProblem(db, 'no-such-problem')).toEqual([]);
  });
});

describe('listDueReviewsFull', () => {
  let db;
  beforeEach(() => { db = openMemoryDb(); });

  it('includes reviews within the window', () => {
    const pid = upsertProblem(db, { slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy' });
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    db.prepare('INSERT INTO review_queue (problem_id, due_date, interval, ease, reps) VALUES (?, ?, 1, 2.5, 1)').run(pid, tomorrow);
    const today = new Date().toISOString().slice(0, 10);
    const rows = listDueReviewsFull(db, today, 7);
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe('two-sum');
  });

  it('excludes reviews beyond the window', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    db.prepare('INSERT INTO review_queue (problem_id, due_date, interval, ease, reps) VALUES (?, ?, 1, 2.5, 1)').run(pid, '2099-01-01');
    const today = new Date().toISOString().slice(0, 10);
    expect(listDueReviewsFull(db, today, 7)).toHaveLength(0);
  });
});

describe('getActivityData', () => {
  let db;
  beforeEach(() => { db = openMemoryDb(); });

  it('groups two attempts on the same day into count 2', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    const today = new Date().toISOString().slice(0, 10);
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 1)').run(pid, today + 'T10:00:00Z');
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 0)').run(pid, today + 'T14:00:00Z');
    const rows = getActivityData(db, '2020-01-01');
    const todayRow = rows.find(r => r.date === today);
    expect(todayRow?.count).toBe(2);
  });

  it('excludes attempts before the since date', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    db.prepare('INSERT INTO attempts (problem_id, date, solved) VALUES (?, ?, 1)').run(pid, '2020-01-01T00:00:00Z');
    const rows = getActivityData(db, '2024-01-01');
    expect(rows).toHaveLength(0);
  });
});

describe('listRecentAttempts', () => {
  let db;
  beforeEach(() => { db = openMemoryDb(); });

  it('returns at most limit rows', () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    for (let i = 0; i < 15; i++) {
      insertAttempt(db, { problemId: pid, solved: true });
    }
    expect(listRecentAttempts(db, 10)).toHaveLength(10);
  });

  it('includes slug and title from problems join', () => {
    const pid = upsertProblem(db, { slug: 'two-sum', title: 'Two Sum' });
    insertAttempt(db, { problemId: pid, solved: true });
    const rows = listRecentAttempts(db, 10);
    expect(rows[0].slug).toBe('two-sum');
    expect(rows[0].title).toBe('Two Sum');
  });
});
