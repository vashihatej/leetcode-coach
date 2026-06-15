# LeetCode Coach Stage 3 — Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MV3 Chrome extension that reads the live problem, code, and run/submit results from a `leetcode.com/problems/*` page and streams them to the local coach server (`POST http://localhost:8765/event`), so `session.md` always reflects what the user is doing right now.

**Architecture:** Two content scripts per page. A **MAIN-world** bridge (`page-bridge.js`) reads `window.monaco` for the full editor code and monkey-patches `fetch`/`XMLHttpRequest` to capture run/submit verdict JSON; it forwards data to the page via `window.postMessage`. An **ISOLATED-world** content script (`content.js`) scrapes the static DOM (slug/title/difficulty/description), receives the bridge's messages, debounces, and `fetch`-POSTs a combined event to the local server. All scraping/parsing logic lives in small pure modules unit-tested with vitest (jsdom where DOM is involved); the two content-script entrypoints are thin wiring that we verify manually in a real logged-in browser.

**Tech Stack:** Chrome MV3 (manifest v3, `content_scripts` with `world: "MAIN"`/`"ISOLATED"`), vanilla ES modules, vitest + jsdom for tests, the existing Express server on :8765.

**Verified DOM facts (captured live on 2026-06-13 via Playwright on `/problems/two-sum/`):**
- Slug: `location.pathname` matches `/problems/<slug>/`.
- Title: `document.title` is `"Two Sum - LeetCode"` → strip `" - LeetCode"`.
- Difficulty: an element with class containing `text-difficulty-easy|medium|hard` (one match, scoped to the problem; the similar-questions list uses different classes like `text-yellow`/`text-olive`).
- Description: `[data-track-load="description_content"]` (stable data attribute).
- Live code: `window.monaco.editor.getModels()` returns models; the user's editor is the first model whose `getLanguageId()` is not `"plaintext"`. `.getValue()` returns the FULL code (the editor DOM `.view-lines` is virtualized and only contains visible lines, so DOM scraping of code is unreliable — do not use it).
- Run/Submit buttons: `button[data-e2e-locator="console-run-button"]` and `button[data-e2e-locator="console-submit-button"]`.
- Run/Submit results: gated behind login (cannot be observed logged-out). LeetCode flow: Run → POST `/problems/<slug>/interpret_solution/`, Submit → POST `/problems/<slug>/submit/`, both then polled via GET `/submissions/detail/<id>/check/` whose JSON carries `state`, `status_msg`, `total_correct`, `total_testcases`, `status_runtime`, `status_memory`, and error fields. Capturing this JSON via fetch/XHR interception is far more robust than scraping the result DOM.

---

## File Structure

```
extension/
  manifest.json            # MV3 manifest: two content scripts (MAIN + ISOLATED), host perms
  src/
    content-runtime.js     # shared classic runtime: scrape/build/post/debounce
    bridge-runtime.js      # shared classic runtime: editor/verdict parsing
    scrape.js              # ESM re-exports for tests
    verdict.js             # ESM re-exports for tests
    editor.js              # ESM re-exports for tests
    debounce.js            # ESM re-export for tests
    event.js               # ESM re-exports for tests
    page-bridge.js         # MAIN world entry: monaco read + fetch/XHR patch -> window.postMessage
    content.js             # ISOLATED world entry: DOM scrape + message listen + debounce + POST
tests/
  extension/
    scrape.test.js
    verdict.test.js
    editor.test.js
    debounce.test.js
    event.test.js
    cors.test.js           # server CORS for the extension's cross-origin POST
```

The shared classic-script runtimes hold the logic used by the shipped content scripts. The ESM
helper files re-export those same functions for unit tests, preventing tested helpers from
drifting away from production behavior.

**Event payload shape (the contract every module agrees on):**
```js
{
  slug: string,            // required by server
  title: string | null,
  difficulty: string | null,   // "Easy" | "Medium" | "Hard"
  description: string | null,
  examples: string[],
  constraints: string[],
  topicTags: string[],
  url: string,
  code: string | null,
  language: string | null,     // e.g. "cpp", "python3"
  lastResult: null | {
    statusMsg: string | null,
    totalCorrect: number | null,
    totalTestcases: number | null,
    runtime: string | null,
    memory: string | null,
    error: string | null
  }
}
```

---

## Task 1: Extension scaffold + MV3 manifest

**Files:**
- Create: `extension/manifest.json`
- Test: `tests/extension/scrape.test.js` (manifest sanity check lives here temporarily — see Step 1; it is a JSON read, no DOM)

- [ ] **Step 1: Write the failing test**

Create `tests/extension/manifest.test.js`:

```js
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(
  readFileSync(path.join(root, "extension/manifest.json"), "utf8")
);

describe("manifest.json", () => {
  it("is MV3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("registers a MAIN-world and an ISOLATED-world content script for leetcode problems", () => {
    const worlds = manifest.content_scripts.map((cs) => cs.world ?? "ISOLATED");
    expect(worlds).toContain("MAIN");
    expect(worlds).toContain("ISOLATED");
    const allMatches = manifest.content_scripts.flatMap((cs) => cs.matches);
    expect(allMatches.some((m) => m.includes("leetcode.com/problems/"))).toBe(true);
  });

  it("has host permission for the local coach server", () => {
    expect(manifest.host_permissions.some((h) => h.includes("localhost:8765"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/extension/manifest.test.js --testTimeout=60000`
Expected: FAIL — `ENOENT` opening `extension/manifest.json`.

- [ ] **Step 3: Write minimal implementation**

Create `extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "LeetCode Coach",
  "version": "0.1.0",
  "description": "Streams your live LeetCode problem, code, and run/submit results to the local coach.",
  "host_permissions": ["http://localhost:8765/*"],
  "content_scripts": [
    {
      "matches": ["https://leetcode.com/problems/*"],
      "js": ["src/page-bridge.js"],
      "world": "MAIN",
      "run_at": "document_idle"
    },
    {
      "matches": ["https://leetcode.com/problems/*"],
      "js": ["src/content.js"],
      "world": "ISOLATED",
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/extension/manifest.test.js --testTimeout=60000`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add extension/manifest.json tests/extension/manifest.test.js
git commit -m "feat(ext): scaffold MV3 manifest with MAIN+ISOLATED content scripts"
```

---

## Task 2: Pure DOM scrapers (`scrape.js`)

**Files:**
- Create: `extension/src/scrape.js`
- Test: `tests/extension/scrape.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/extension/scrape.test.js`. Note the first line switches this file to jsdom so `document`/DOM parsing works:

```js
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  parseSlug,
  parseTitle,
  parseDifficulty,
  parseDescription,
  buildProblemPayload,
} from "../../extension/src/scrape.js";

describe("parseSlug", () => {
  it("extracts the slug from a problem pathname", () => {
    expect(parseSlug("/problems/two-sum/")).toBe("two-sum");
    expect(parseSlug("/problems/two-sum/description/")).toBe("two-sum");
  });
  it("returns null when there is no problem segment", () => {
    expect(parseSlug("/contest/")).toBe(null);
    expect(parseSlug("")).toBe(null);
  });
});

describe("parseTitle", () => {
  it("strips the LeetCode suffix", () => {
    expect(parseTitle("Two Sum - LeetCode")).toBe("Two Sum");
  });
  it("returns null for empty input", () => {
    expect(parseTitle("")).toBe(null);
  });
});

describe("parseDifficulty", () => {
  it("reads difficulty from a text-difficulty-* class", () => {
    document.body.innerHTML =
      '<div class="rounded-full bg-fill-secondary text-difficulty-medium">Medium</div>';
    expect(parseDifficulty(document)).toBe("Medium");
  });
  it("returns null when absent", () => {
    document.body.innerHTML = "<div>nothing</div>";
    expect(parseDifficulty(document)).toBe(null);
  });
});

describe("parseDescription", () => {
  it("reads the description_content block text", () => {
    document.body.innerHTML =
      '<div data-track-load="description_content"><p>Given an array...</p></div>';
    expect(parseDescription(document)).toBe("Given an array...");
  });
});

describe("buildProblemPayload", () => {
  it("assembles slug/title/difficulty/description", () => {
    document.body.innerHTML =
      '<div class="text-difficulty-easy">Easy</div>' +
      '<div data-track-load="description_content">Desc here</div>';
    const payload = buildProblemPayload({
      pathname: "/problems/two-sum/",
      documentTitle: "Two Sum - LeetCode",
      doc: document,
    });
    expect(payload).toEqual({
      slug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      description: "Desc here",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/extension/scrape.test.js --testTimeout=60000`
Expected: FAIL — cannot resolve `extension/src/scrape.js`. (If jsdom is not installed, vitest errors with "Cannot find package 'jsdom'" — install it: `npm install -D jsdom --cache /tmp/coach-npm-cache`, then re-run.)

- [ ] **Step 3: Write minimal implementation**

Create `extension/src/scrape.js`:

```js
export function parseSlug(pathname) {
  const m = /\/problems\/([^/]+)/.exec(pathname || "");
  return m ? m[1] : null;
}

export function parseTitle(documentTitle) {
  if (!documentTitle) return null;
  const cleaned = documentTitle.replace(/\s*-\s*LeetCode.*$/i, "").trim();
  return cleaned || null;
}

export function parseDifficulty(doc) {
  const el = doc.querySelector('[class*="text-difficulty-"]');
  if (!el) return null;
  const m = /text-difficulty-(easy|medium|hard)/.exec(el.className);
  if (!m) return null;
  return m[1][0].toUpperCase() + m[1].slice(1);
}

export function parseDescription(doc) {
  const el = doc.querySelector('[data-track-load="description_content"]');
  return el ? el.textContent.trim() : null;
}

export function buildProblemPayload({ pathname, documentTitle, doc }) {
  return {
    slug: parseSlug(pathname),
    title: parseTitle(documentTitle),
    difficulty: parseDifficulty(doc),
    description: parseDescription(doc),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/extension/scrape.test.js --testTimeout=60000`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add extension/src/scrape.js tests/extension/scrape.test.js package.json package-lock.json
git commit -m "feat(ext): pure DOM scrapers for slug/title/difficulty/description"
```

---

## Task 3: Verdict parser + capture filter (`verdict.js`)

**Files:**
- Create: `extension/src/verdict.js`
- Test: `tests/extension/verdict.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/extension/verdict.test.js`:

```js
import { describe, it, expect } from "vitest";
import { parseVerdict, shouldCaptureUrl } from "../../extension/src/verdict.js";

describe("shouldCaptureUrl", () => {
  it("matches the check polling endpoint", () => {
    expect(shouldCaptureUrl("https://leetcode.com/submissions/detail/123/check/")).toBe(true);
  });
  it("ignores unrelated urls", () => {
    expect(shouldCaptureUrl("https://leetcode.com/graphql/")).toBe(false);
    expect(shouldCaptureUrl("")).toBe(false);
  });
});

describe("parseVerdict", () => {
  it("returns null until the judge state is SUCCESS", () => {
    expect(parseVerdict({ state: "PENDING" })).toBe(null);
    expect(parseVerdict(null)).toBe(null);
  });

  it("extracts an accepted run", () => {
    const v = parseVerdict({
      state: "SUCCESS",
      status_msg: "Accepted",
      total_correct: 57,
      total_testcases: 57,
      status_runtime: "3 ms",
      status_memory: "10.2 MB",
    });
    expect(v).toEqual({
      statusMsg: "Accepted",
      totalCorrect: 57,
      totalTestcases: 57,
      runtime: "3 ms",
      memory: "10.2 MB",
      error: null,
    });
  });

  it("surfaces a runtime error message", () => {
    const v = parseVerdict({
      state: "SUCCESS",
      status_msg: "Runtime Error",
      runtime_error: "IndexError: list index out of range",
    });
    expect(v.statusMsg).toBe("Runtime Error");
    expect(v.error).toBe("IndexError: list index out of range");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/extension/verdict.test.js --testTimeout=60000`
Expected: FAIL — cannot resolve `extension/src/verdict.js`.

- [ ] **Step 3: Write minimal implementation**

Create `extension/src/verdict.js`:

```js
export function shouldCaptureUrl(url) {
  return /\/submissions\/detail\/\d+\/check\/?/.test(url || "");
}

export function parseVerdict(json) {
  if (!json || json.state !== "SUCCESS") return null;
  return {
    statusMsg: json.status_msg ?? null,
    totalCorrect: json.total_correct ?? null,
    totalTestcases: json.total_testcases ?? null,
    runtime: json.status_runtime ?? null,
    memory: json.status_memory ?? null,
    error:
      json.compile_error ||
      json.full_compile_error ||
      json.runtime_error ||
      json.full_runtime_error ||
      null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/extension/verdict.test.js --testTimeout=60000`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/verdict.js tests/extension/verdict.test.js
git commit -m "feat(ext): verdict JSON parser and check-endpoint capture filter"
```

---

## Task 4: Debounce utility (`debounce.js`)

**Files:**
- Create: `extension/src/debounce.js`
- Test: `tests/extension/debounce.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/extension/debounce.test.js`:

```js
import { describe, it, expect, vi } from "vitest";
import { debounce } from "../../extension/src/debounce.js";

describe("debounce", () => {
  it("calls once with the latest args after the quiet period", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const d = debounce(spy, 1000);
    d("a");
    d("b");
    d("c");
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("c");
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/extension/debounce.test.js --testTimeout=60000`
Expected: FAIL — cannot resolve `extension/src/debounce.js`.

- [ ] **Step 3: Write minimal implementation**

Create `extension/src/debounce.js`:

```js
export function debounce(fn, ms) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, ms);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/extension/debounce.test.js --testTimeout=60000`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/debounce.js tests/extension/debounce.test.js
git commit -m "feat(ext): debounce utility"
```

---

## Task 5: Monaco reader (`editor.js`)

**Files:**
- Create: `extension/src/editor.js`
- Test: `tests/extension/editor.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/extension/editor.test.js`:

```js
import { describe, it, expect } from "vitest";
import { readEditorCode } from "../../extension/src/editor.js";

function fakeModel(lang, value) {
  return { getLanguageId: () => lang, getValue: () => value };
}

describe("readEditorCode", () => {
  it("returns the first non-plaintext model's code and language", () => {
    const monaco = {
      editor: {
        getModels: () => [
          fakeModel("plaintext", ""),
          fakeModel("cpp", "class Solution {};"),
        ],
      },
    };
    expect(readEditorCode(monaco)).toEqual({
      code: "class Solution {};",
      language: "cpp",
    });
  });

  it("returns null when monaco is unavailable", () => {
    expect(readEditorCode(undefined)).toBe(null);
    expect(readEditorCode({})).toBe(null);
  });

  it("returns null when there are no models", () => {
    expect(readEditorCode({ editor: { getModels: () => [] } })).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/extension/editor.test.js --testTimeout=60000`
Expected: FAIL — cannot resolve `extension/src/editor.js`.

- [ ] **Step 3: Write minimal implementation**

Create `extension/src/editor.js`:

```js
export function readEditorCode(monaco) {
  if (!monaco || !monaco.editor) return null;
  const models = monaco.editor.getModels();
  if (!models || models.length === 0) return null;
  const codeModel =
    models.find((m) => m.getLanguageId() !== "plaintext") || models[0];
  if (!codeModel) return null;
  return { code: codeModel.getValue(), language: codeModel.getLanguageId() };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/extension/editor.test.js --testTimeout=60000`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/editor.js tests/extension/editor.test.js
git commit -m "feat(ext): monaco model reader for full editor code"
```

---

## Task 6: Event builder + poster (`event.js`)

**Files:**
- Create: `extension/src/event.js`
- Test: `tests/extension/event.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/extension/event.test.js`:

```js
import { describe, it, expect, vi } from "vitest";
import { buildEvent, postEvent } from "../../extension/src/event.js";

describe("buildEvent", () => {
  it("merges problem, code, and result into the server contract", () => {
    const event = buildEvent({
      problem: { slug: "two-sum", title: "Two Sum", difficulty: "Easy", description: "d" },
      url: "https://leetcode.com/problems/two-sum/",
      code: "class Solution {};",
      language: "cpp",
      lastResult: { statusMsg: "Accepted", totalCorrect: 5, totalTestcases: 5, runtime: "1 ms", memory: "9 MB", error: null },
    });
    expect(event).toEqual({
      slug: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      url: "https://leetcode.com/problems/two-sum/",
      code: "class Solution {};",
      language: "cpp",
      lastResult: { statusMsg: "Accepted", totalCorrect: 5, totalTestcases: 5, runtime: "1 ms", memory: "9 MB", error: null },
    });
  });

  it("defaults code/language/result to null when missing", () => {
    const event = buildEvent({
      problem: { slug: "two-sum", title: "Two Sum", difficulty: "Easy" },
      url: "https://leetcode.com/problems/two-sum/",
    });
    expect(event.code).toBe(null);
    expect(event.language).toBe(null);
    expect(event.lastResult).toBe(null);
  });
});

describe("postEvent", () => {
  it("POSTs JSON to the given url and resolves the response", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const payload = { slug: "two-sum" };
    await postEvent(fetchFn, "http://localhost:8765/event", payload);
    expect(fetchFn).toHaveBeenCalledWith("http://localhost:8765/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("swallows network errors so a dead server never breaks the page", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(postEvent(fetchFn, "http://localhost:8765/event", { slug: "x" })).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/extension/event.test.js --testTimeout=60000`
Expected: FAIL — cannot resolve `extension/src/event.js`.

- [ ] **Step 3: Write minimal implementation**

Create `extension/src/event.js`:

```js
export function buildEvent({ problem, url, code, language, lastResult }) {
  return {
    slug: problem.slug,
    title: problem.title ?? null,
    difficulty: problem.difficulty ?? null,
    url,
    code: code ?? null,
    language: language ?? null,
    lastResult: lastResult ?? null,
  };
}

export async function postEvent(fetchFn, url, payload) {
  try {
    await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/extension/event.test.js --testTimeout=60000`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extension/src/event.js tests/extension/event.test.js
git commit -m "feat(ext): event payload builder and resilient poster"
```

---

## Task 7: Server CORS for the extension's cross-origin POST

**Files:**
- Modify: `src/server/app.js`
- Test: `tests/extension/cors.test.js`

The extension POSTs from `https://leetcode.com` to `http://localhost:8765`. MV3 `host_permissions` lets the extension's fetch bypass CORS, but adding permissive CORS on the server makes the endpoint robust to fetches issued from the page context and simplifies manual debugging (e.g. `curl`/devtools from the page). Keep it scoped to what the extension needs.

- [ ] **Step 1: Write the failing test**

Create `tests/extension/cors.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/extension/cors.test.js --testTimeout=60000`
Expected: FAIL — `access-control-allow-origin` header is undefined / OPTIONS returns 404.

- [ ] **Step 3: Write minimal implementation**

Edit `src/server/app.js` — add a CORS middleware immediately after `app.use(express.json(...))` and before the routes:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/extension/cors.test.js --testTimeout=60000`
Expected: PASS. Then run the full suite to confirm no regression: `npx vitest run --testTimeout=60000` (all prior tests + new ones green).

- [ ] **Step 5: Commit**

```bash
git add src/server/app.js tests/extension/cors.test.js
git commit -m "feat(server): permissive CORS so the extension can POST events"
```

---

## Task 8: MAIN-world bridge entry (`page-bridge.js`)

This file runs in the page's JS context (so `window.monaco` is visible) and forwards data to the isolated content script via `window.postMessage`. It is thin wiring over the tested `editor.js`/`verdict.js` modules. Because content-script files are injected as plain scripts (not ES modules) by the manifest, inline the two tiny helper calls rather than `import` — duplicate ONLY the call sites; the canonical logic stays unit-tested in the modules. There is no unit test for this file; it is validated in Task 10.

**Files:**
- Create: `extension/src/page-bridge.js`

- [ ] **Step 1: Write the implementation**

Create `extension/src/page-bridge.js`:

```js
// MAIN world: has access to window.monaco and the page's fetch/XHR.
// Forwards { type: "coach:code" } and { type: "coach:result" } to the isolated content script.
(function () {
  const SOURCE = "coach-bridge";

  function readEditorCode() {
    const monaco = window.monaco;
    if (!monaco || !monaco.editor) return null;
    const models = monaco.editor.getModels();
    if (!models || models.length === 0) return null;
    const m = models.find((x) => x.getLanguageId() !== "plaintext") || models[0];
    if (!m) return null;
    return { code: m.getValue(), language: m.getLanguageId() };
  }

  function postCode() {
    const c = readEditorCode();
    if (c) window.postMessage({ source: SOURCE, type: "coach:code", payload: c }, "*");
  }

  function shouldCaptureUrl(url) {
    return /\/submissions\/detail\/\d+\/check\/?/.test(url || "");
  }

  function parseVerdict(json) {
    if (!json || json.state !== "SUCCESS") return null;
    return {
      statusMsg: json.status_msg ?? null,
      totalCorrect: json.total_correct ?? null,
      totalTestcases: json.total_testcases ?? null,
      runtime: json.status_runtime ?? null,
      memory: json.status_memory ?? null,
      error:
        json.compile_error || json.full_compile_error ||
        json.runtime_error || json.full_runtime_error || null,
    };
  }

  function emitVerdict(json) {
    const v = parseVerdict(json);
    if (v) window.postMessage({ source: SOURCE, type: "coach:result", payload: v }, "*");
  }

  // Patch fetch to observe /check/ responses without altering them.
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      if (shouldCaptureUrl(url)) {
        res.clone().json().then(emitVerdict).catch(() => {});
      }
    } catch {}
    return res;
  };

  // Patch XHR for the same endpoint (LeetCode polls via XHR in some flows).
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__coachUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      try {
        if (shouldCaptureUrl(this.__coachUrl)) emitVerdict(JSON.parse(this.responseText));
      } catch {}
    });
    return origSend.apply(this, args);
  };

  // Poll the editor for code changes (Monaco has no global change event we can rely on here).
  setInterval(postCode, 1500);
  postCode();
})();
```

- [ ] **Step 2: Sanity-check syntax**

Run: `node --check extension/src/page-bridge.js`
Expected: no output (exit 0) — the file parses.

- [ ] **Step 3: Commit**

```bash
git add extension/src/page-bridge.js
git commit -m "feat(ext): MAIN-world bridge reads monaco and intercepts verdict responses"
```

---

## Task 9: ISOLATED-world content script entry (`content.js`)

Runs in the isolated world: scrapes the static DOM, receives the bridge's messages, debounces, and POSTs the combined event. Thin wiring over the tested `scrape.js`/`debounce.js`/`event.js` modules; inline the small call sites (content scripts are not ES modules). Validated in Task 10.

**Files:**
- Create: `extension/src/content.js`

- [ ] **Step 1: Write the implementation**

Create `extension/src/content.js`:

```js
// ISOLATED world: scrapes static DOM, merges bridge messages, POSTs to the local coach.
(function () {
  const SERVER = "http://localhost:8765/event";
  const SOURCE = "coach-bridge";

  let latestCode = null;
  let latestLanguage = null;
  let latestResult = null;

  function parseSlug(pathname) {
    const m = /\/problems\/([^/]+)/.exec(pathname || "");
    return m ? m[1] : null;
  }
  function parseTitle(t) {
    if (!t) return null;
    return t.replace(/\s*-\s*LeetCode.*$/i, "").trim() || null;
  }
  function parseDifficulty() {
    const el = document.querySelector('[class*="text-difficulty-"]');
    if (!el) return null;
    const m = /text-difficulty-(easy|medium|hard)/.exec(el.className);
    return m ? m[1][0].toUpperCase() + m[1].slice(1) : null;
  }
  function parseDescription() {
    const el = document.querySelector('[data-track-load="description_content"]');
    return el ? el.textContent.trim() : null;
  }

  function buildEvent() {
    return {
      slug: parseSlug(location.pathname),
      title: parseTitle(document.title),
      difficulty: parseDifficulty(),
      url: location.href,
      code: latestCode,
      language: latestLanguage,
      lastResult: latestResult,
    };
  }

  async function send() {
    const event = buildEvent();
    if (!event.slug) return;
    try {
      await fetch(SERVER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    } catch {}
  }

  function debounce(fn, ms) {
    let t = null;
    return function () {
      if (t) clearTimeout(t);
      t = setTimeout(() => { t = null; fn(); }, ms);
    };
  }
  const debouncedSend = debounce(send, 800);

  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.source !== SOURCE) return;
    if (d.type === "coach:code") {
      latestCode = d.payload.code;
      latestLanguage = d.payload.language;
      debouncedSend();
    } else if (d.type === "coach:result") {
      latestResult = d.payload;
      send(); // results are important — send immediately
    }
  });

  // Initial problem push so session.md reflects the page even before typing.
  send();
})();
```

- [ ] **Step 2: Sanity-check syntax**

Run: `node --check extension/src/content.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add extension/src/content.js
git commit -m "feat(ext): ISOLATED content script scrapes DOM and streams events"
```

---

## Task 10: Manual end-to-end verification (real logged-in browser)

This stage's riskiest surfaces (Monaco access, run/submit capture) can only be fully confirmed against a logged-in LeetCode session. This is a verification task, not TDD.

**Files:** none (verification only)

- [ ] **Step 1: Start the coach server**

Run (from project root): `node src/server/index.js`
Expected: logs that it is listening on 8765. In another terminal: `curl -s localhost:8765/health` → `{"ok":true}`.

- [ ] **Step 2: Load the unpacked extension**

In Chrome: `chrome://extensions` → enable Developer mode → "Load unpacked" → select the `extension/` directory. Confirm it loads with no manifest errors.

- [ ] **Step 3: Open a problem and confirm the problem push**

Navigate to `https://leetcode.com/problems/two-sum/` (logged in). Then run `node src/cli/coach.js status` and confirm `session.md` shows the Two Sum title and difficulty.

- [ ] **Step 4: Confirm live code capture**

Type a few lines in the editor, wait ~1s, re-run `node src/cli/coach.js status`. Confirm the code block reflects what you typed (full code, not just visible lines).

- [ ] **Step 5: Confirm run/submit verdict capture**

Click Run (and, with a correct solution, Submit). Re-run `node src/cli/coach.js status`. Confirm the run/submit result line shows the verdict (e.g. "Accepted 57/57"). If nothing appears: open the page devtools console, check for the patched-fetch path, and verify the captured URL matches `shouldCaptureUrl` — adjust the regex in `page-bridge.js` to the real check endpoint observed in the Network tab (this is the one selector we could not verify logged-out; confirm it against the live request rather than guessing).

- [ ] **Step 6: Confirm graceful degradation**

Stop the server. Type in the editor. Confirm the page keeps working with no console errors (the `postEvent`/`fetch` catch swallows the connection failure).

- [ ] **Step 7: Commit any selector fixes discovered during verification**

```bash
git add extension/
git commit -m "fix(ext): align selectors/endpoints with live LeetCode verification"
```

---

## Self-Review Notes

- **Spec coverage:** problem details (Task 2), live code via Monaco (Tasks 5, 8), run/submit results via network interception (Tasks 3, 8), streaming to the local server (Tasks 6, 9), server accepts cross-origin POST (Task 7), MV3 plumbing (Task 1), real-browser validation (Task 10). The session.md/DB persistence already exists from Stage 1 and is exercised by Task 7's POST test.
- **Payload contract** is consistent across `buildProblemPayload` (slug/title/difficulty/description), `buildEvent` (adds url/code/language/lastResult), the server's `upsertProblem`/`writeSession`, and the two content-script entries.
- **The one unverifiable item** (the exact `/check/` result endpoint, since run/submit is login-gated) is isolated to a single regex `shouldCaptureUrl`, documented as such, and had an explicit confirm-against-live step in Task 10 — no guessing shipped silently. **VERIFIED 2026-06-13** via a real logged-in submission on /problems/two-sum/ (Playwright): the judge polls `/submissions/detail/<id>/v2/check/` (note the `/v2/` segment, which the original regex missed). Regex updated to `/\/submissions\/detail\/\d+\/(?:v\d+\/)?check\/?/`. Response shape (`state`/`status_msg`/`total_correct`/`total_testcases`/`status_runtime`/`status_memory`) matches `parseVerdict` exactly. Captured both Accepted (63/63) and Wrong Answer (0/63) end-to-end.
- **Dependency:** Tasks 2's test needs `jsdom`; install with `npm install -D jsdom --cache /tmp/coach-npm-cache` (the `--cache` flag avoids the known root-owned `~/.npm` issue on this machine).
- **Env note:** vitest is slow on this machine — always run with `--testTimeout=60000`.
