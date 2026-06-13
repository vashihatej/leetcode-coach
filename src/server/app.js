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
