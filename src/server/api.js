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
  getPatternWiki,
  getLists,
  createList,
  getListProblems,
  bulkInsertListProblems,
  deleteList,
} from '../db/queries.js';

function parseBulkText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const patternMap = {};   // slug -> Set<string>
  const urlMap = {};       // slug -> url string
  let currentPattern = null;

  for (const line of lines) {
    if (line.startsWith('http')) {
      if (!currentPattern) continue;
      const match = line.match(/problems\/([\w-]+)/);
      if (!match) continue;
      const slug = match[1];
      if (!patternMap[slug]) { patternMap[slug] = new Set(); urlMap[slug] = line; }
      patternMap[slug].add(currentPattern);
    } else {
      currentPattern = line;
    }
  }

  return Object.entries(patternMap).map(([slug, patterns]) => ({
    slug,
    url: urlMap[slug],
    pattern_tags: [...patterns],
  }));
}

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

  router.get('/patterns/:name/wiki', (req, res) =>
    res.json(getPatternWiki(db, req.params.name) ?? null)
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

  router.get('/lists', (_req, res) => res.json(getLists(db)));

  router.post('/lists', (req, res) => {
    const { name } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ ok: false, error: 'name required' });
    try {
      const list = createList(db, name.trim());
      res.json(list);
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(409).json({ ok: false, error: 'name already exists' });
      throw e;
    }
  });

  router.get('/lists/:id/problems', (req, res) =>
    res.json(getListProblems(db, Number(req.params.id)))
  );

  router.post('/lists/:id/problems/bulk', (req, res) => {
    const { text } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ ok: false, error: 'text required' });
    const parsed = parseBulkText(text);
    if (!parsed.length) return res.status(400).json({ ok: false, error: 'no URLs found' });
    bulkInsertListProblems(db, Number(req.params.id), parsed);
    res.json({ inserted: parsed.length });
  });

  router.delete('/lists/:id', (req, res) => {
    deleteList(db, Number(req.params.id));
    res.json({ ok: true });
  });

  router.use((err, _req, res, _next) => {
    res.status(500).json({ ok: false, error: err.message });
  });

  return router;
}
