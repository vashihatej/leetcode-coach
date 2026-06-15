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
  it("allows preflight requests from LeetCode", async () => {
    const res = await request(app)
      .options("/event")
      .set("Origin", "https://leetcode.com");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://leetcode.com");
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("allows extension origins on a real POST", async () => {
    const res = await request(app)
      .post("/event")
      .set("Origin", "chrome-extension://abcdefghijklmnop")
      .send({ slug: "two-sum" });
    expect(res.headers["access-control-allow-origin"]).toBe(
      "chrome-extension://abcdefghijklmnop"
    );
    expect(res.body.ok).toBe(true);
  });

  it("does not grant CORS access to unrelated websites", async () => {
    const res = await request(app)
      .options("/event")
      .set("Origin", "https://example.com");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
