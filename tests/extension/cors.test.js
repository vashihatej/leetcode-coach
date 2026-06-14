import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { openDb } from "../../src/db/index.js";
import { createApp } from "../../src/server/app.js";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

let app;
beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coach-cors-"));
  const db = openDb(path.join(dir, "t.db"));
  app = createApp(db, path.join(dir, "session.md"));
});

describe("CORS", () => {
  it("answers a preflight OPTIONS on /event with permissive headers", async () => {
    const res = await request(app).options("/event");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("includes the allow-origin header on a real POST", async () => {
    const res = await request(app).post("/event").send({ slug: "two-sum" });
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.body.ok).toBe(true);
  });
});
