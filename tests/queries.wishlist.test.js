import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import {
  addToWishlist,
  listWishlist,
  updateWishlistNotes,
  removeFromWishlist,
} from '../src/db/queries.js';

function openMemoryDb() {
  const db = new Database(':memory:');
  db.exec(readFileSync('src/db/schema.sql', 'utf8'));
  return db;
}

describe('wishlist queries', () => {
  let db;
  beforeEach(() => { db = openMemoryDb(); });

  it('adds a problem to the wishlist', () => {
    addToWishlist(db, { slug: 'two-sum', url: 'https://leetcode.com/problems/two-sum/' });
    const rows = listWishlist(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe('two-sum');
    expect(rows[0].url).toBe('https://leetcode.com/problems/two-sum/');
  });

  it('ignores duplicate slugs silently', () => {
    addToWishlist(db, { slug: 'two-sum' });
    addToWishlist(db, { slug: 'two-sum' });
    expect(listWishlist(db)).toHaveLength(1);
  });

  it('updates notes on an existing wishlist entry', () => {
    addToWishlist(db, { slug: 'two-sum' });
    updateWishlistNotes(db, 'two-sum', 'practice hash map pattern');
    const rows = listWishlist(db);
    expect(rows[0].notes).toBe('practice hash map pattern');
  });

  it('removes a problem from the wishlist', () => {
    addToWishlist(db, { slug: 'two-sum' });
    removeFromWishlist(db, 'two-sum');
    expect(listWishlist(db)).toHaveLength(0);
  });

  it('listWishlist joins prob_difficulty from problems table when slug exists', () => {
    db.prepare(
      "INSERT INTO problems (slug, title, difficulty) VALUES ('two-sum', 'Two Sum', 'Easy')"
    ).run();
    addToWishlist(db, { slug: 'two-sum' });
    const rows = listWishlist(db);
    expect(rows[0].prob_difficulty).toBe('Easy');
  });

  it('listWishlist returns prob_difficulty null when problem not in problems table', () => {
    addToWishlist(db, { slug: 'unknown-problem' });
    const rows = listWishlist(db);
    expect(rows[0].prob_difficulty).toBeNull();
  });

  it('listWishlist orders by added_at descending', () => {
    addToWishlist(db, { slug: 'two-sum' });
    addToWishlist(db, { slug: 'three-sum' });
    const rows = listWishlist(db);
    expect(rows[0].slug).toBe('three-sum');
  });
});
