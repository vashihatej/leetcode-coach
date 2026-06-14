import express from "express";
import { upsertProblem } from "../db/queries.js";
import { writeSession } from "../session/sessionWriter.js";

export function createApp(db, sessionPath) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.use((req, res, next) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
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
