import express from "express";
import { join } from "node:path";
import { upsertProblem } from "../db/queries.js";
import { writeSession } from "../session/sessionWriter.js";
import { PUBLIC_DIR } from "../config.js";
import { createApiRouter } from "./api.js";

export function createApp(db, sessionPath, publicDir = PUBLIC_DIR) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.use((req, res, next) => {
    const origin = req.get("Origin");
    const allowed =
      origin === "https://leetcode.com" ||
      (origin && origin.startsWith("chrome-extension://"));
    if (allowed) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.use(express.static(publicDir));

  app.use('/api', createApiRouter(db));

  app.get('/dashboard', (_req, res) => res.redirect('/dashboard/'));
  app.use('/dashboard', (_req, res) => {
    const idx = join(publicDir, 'dashboard', 'index.html');
    res.sendFile(idx, err => {
      if (err) res.status(404).send('Dashboard not built — run: cd dashboard && npm run build');
    });
  });

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
