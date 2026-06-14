import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDb } from "../src/db/index.js";
import { createApp } from "../src/server/app.js";
import { PUBLIC_DIR } from "../src/config.js";

let app, db, tmp, sessionPath;

beforeAll(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "coach-viz-"));
  db = openDb(":memory:");
  sessionPath = path.join(tmp, "session.md");
  app = createApp(db, sessionPath, PUBLIC_DIR);
});

afterAll(() => {
  db.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("static viz serving", () => {
  it("serves the kit JS", async () => {
    const res = await request(app).get("/viz/viz-kit.js");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/javascript/);
  });
  it("serves the kit CSS", async () => {
    const res = await request(app).get("/viz/viz-kit.css");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/css/);
  });
  it("serves vendored three", async () => {
    const res = await request(app).get("/viz/vendor/three.module.js");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/javascript/);
  });
  it("serves an example page", async () => {
    const res = await request(app).get("/viz/two-pointer-sorted.html");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
  });
  it("keeps /health working", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });
});
