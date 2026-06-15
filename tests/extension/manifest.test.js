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

  it("loads tested shared runtimes before the shipped entry scripts", () => {
    const main = manifest.content_scripts.find((script) => script.world === "MAIN");
    const isolated = manifest.content_scripts.find((script) => script.world === "ISOLATED");
    expect(main.js).toEqual(["src/bridge-runtime.js", "src/page-bridge.js"]);
    expect(isolated.js).toEqual(["src/content-runtime.js", "src/content.js"]);
  });

  it("has host permission for the local coach server", () => {
    expect(manifest.host_permissions.some((h) => h.includes("localhost:8765"))).toBe(true);
  });

  it("provides the planned connection-status popup", () => {
    expect(manifest.action.default_popup).toBe("popup.html");
  });
});
