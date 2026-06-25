import { Router } from 'express';
import {
  getStats,
  listProblemsWithSummary,
  listAttemptsForProblem,
  listPatternsWithStats,
  listProblemsByPattern,
  listDueReviewsFull,
  getActivityData,
  listRecentAttempts,
  listWishlist,
  addToWishlist,
  updateWishlistNotes,
  removeFromWishlist,
} from '../db/queries.js';

export function createApiRouter(db) {
  const router = Router();

  router.get('/stats', (_req, res) => res.json(getStats(db)));

  router.get('/problems', (_req, res) => res.json(listProblemsWithSummary(db)));

  router.get('/problems/:slug/attempts', (req, res) =>
    res.json(listAttemptsForProblem(db, req.params.slug))
  );

  router.get('/patterns', (_req, res) => res.json(listPatternsWithStats(db)));

  router.get('/patterns/:name/problems', (req, res) =>
    res.json(listProblemsByPattern(db, req.params.name))
  );

  router.get('/review/due', (_req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    res.json(listDueReviewsFull(db, today, 7));
  });

  router.get('/activity', (_req, res) => {
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    res.json(getActivityData(db, since));
  });

  router.get('/recent-attempts', (_req, res) => res.json(listRecentAttempts(db, 10)));

  router.get('/wishlist', (_req, res) => res.json(listWishlist(db)));

  router.post('/wishlist', (req, res) => {
    const { slug, url, title, difficulty } = req.body || {};
    if (!slug) return res.status(400).json({ ok: false, error: 'slug required' });
    addToWishlist(db, { slug, url: url ?? null, title: title ?? null, difficulty: difficulty ?? null });
    res.json({ ok: true });
  });

  router.patch('/wishlist/:slug', (req, res) => {
    const { notes } = req.body || {};
    if (notes === undefined) return res.status(400).json({ ok: false, error: 'notes required' });
    updateWishlistNotes(db, req.params.slug, notes);
    res.json({ ok: true });
  });

  router.delete('/wishlist/:slug', (req, res) => {
    removeFromWishlist(db, req.params.slug);
    res.json({ ok: true });
  });

  router.use((err, _req, res, _next) => {
    res.status(500).json({ ok: false, error: err.message });
  });

  return router;
}
