import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/server/app.js';
import { upsertProblem, insertAttempt, recordPatternOutcome } from '../src/db/queries.js';

function openMemoryDb() {
  const db = new Database(':memory:');
  db.exec(readFileSync('src/db/schema.sql', 'utf8'));
  return db;
}

describe('API routes', () => {
  let app, db;
  beforeEach(() => {
    db = openMemoryDb();
    app = createApp(db, '/tmp/session.md');
  });

  it('GET /api/stats returns correct shape', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total_problems: expect.any(Number),
      solved_problems: expect.any(Number),
      attempts_today: expect.any(Number),
      due_today: expect.any(Number),
      pattern_count: expect.any(Number),
      streak: expect.any(Number),
    });
  });

  it('GET /api/problems returns array with problem shape', async () => {
    upsertProblem(db, { slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy' });
    const res = await request(app).get('/api/problems');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ slug: 'two-sum', attempt_count: 0 });
  });

  it('GET /api/problems/:slug/attempts returns attempt array', async () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    insertAttempt(db, { problemId: pid, solved: true });
    const res = await request(app).get('/api/problems/two-sum/attempts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].solved).toBe(1);
  });

  it('GET /api/patterns returns array with correct shape', async () => {
    const pid = upsertProblem(db, { slug: 'two-sum', title: 'Two Sum' });
    recordPatternOutcome(db, { problemId: pid, name: 'hash map', instinctFired: true });
    const res = await request(app).get('/api/patterns');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      name: 'hash map',
      problem_count: 1,
      instinct_rate: expect.any(Number),
    });
  });

  it('GET /api/patterns/:name/problems returns problems for pattern', async () => {
    const pid = upsertProblem(db, { slug: 'two-sum', title: 'Two Sum' });
    recordPatternOutcome(db, { problemId: pid, name: 'hash map', instinctFired: false });
    const res = await request(app).get('/api/patterns/hash%20map/problems');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].slug).toBe('two-sum');
  });

  it('GET /api/review/due returns array', async () => {
    const res = await request(app).get('/api/review/due');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/activity returns array', async () => {
    const res = await request(app).get('/api/activity');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/recent-attempts returns array capped at 10', async () => {
    const pid = upsertProblem(db, { slug: 'two-sum' });
    for (let i = 0; i < 15; i++) insertAttempt(db, { problemId: pid, solved: true });
    const res = await request(app).get('/api/recent-attempts');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(10);
  });

  it('wishlist full CRUD cycle', async () => {
    let res = await request(app)
      .post('/api/wishlist')
      .send({ slug: 'two-sum', url: 'https://leetcode.com/problems/two-sum/' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    res = await request(app).get('/api/wishlist');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].slug).toBe('two-sum');

    res = await request(app).patch('/api/wishlist/two-sum').send({ notes: 'review this' });
    expect(res.status).toBe(200);

    res = await request(app).get('/api/wishlist');
    expect(res.body[0].notes).toBe('review this');

    res = await request(app).delete('/api/wishlist/two-sum');
    expect(res.status).toBe(200);

    res = await request(app).get('/api/wishlist');
    expect(res.body).toHaveLength(0);
  });

  it('POST /api/wishlist returns 400 when slug is missing', async () => {
    const res = await request(app).post('/api/wishlist').send({});
    expect(res.status).toBe(400);
  });

  it('existing GET /health still returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('existing POST /event still works', async () => {
    const res = await request(app).post('/event').send({ slug: 'two-sum' });
    expect(res.status).toBe(200);
  });
});
