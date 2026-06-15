import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb } from "../src/db/index.js";
import { createApp } from "../src/server/app.js";

const tmp = path.join(os.tmpdir(), `session-srv-${Date.now()}.md`);
afterEach(() => fs.existsSync(tmp) && fs.unlinkSync(tmp));

describe("POST /event", () => {
  it("persists the problem and writes session.md", async () => {
    const db = openDb(":memory:");
    const app = createApp(db, tmp);

    const res = await request(app)
      .post("/event")
      .send({
        slug: "two-sum",
        title: "Two Sum",
        difficulty: "Easy",
        topicTags: ["Array"],
        description: "Given an array...",
        examples: ["Input: [2,7], target = 9"],
        constraints: ["2 <= nums.length <= 10^4"],
        url: "https://leetcode.com/problems/two-sum/",
        language: "python3",
        code: "print(1)",
        lastResult: {
          statusMsg: "Accepted",
          totalCorrect: 57,
          totalTestcases: 57,
          runtime: "3 ms",
          memory: "10.2 MB",
          error: null,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const row = db.prepare("SELECT * FROM problems WHERE slug = ?").get("two-sum");
    expect(row.title).toBe("Two Sum");
    expect(row.description).toBe("Given an array...");
    const session = fs.readFileSync(tmp, "utf8");
    expect(session).toContain("# Two Sum");
    expect(session).toContain("2 <= nums.length <= 10^4");
  });

  it("rejects an event with no slug", async () => {
    const db = openDb(":memory:");
    const app = createApp(db, tmp);
    const res = await request(app).post("/event").send({ title: "no slug" });
    expect(res.status).toBe(400);
  });

  it("GET /health returns ok", async () => {
    const db = openDb(":memory:");
    const app = createApp(db, tmp);
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
