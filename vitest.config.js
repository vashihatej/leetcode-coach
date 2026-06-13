import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // This machine's security layer scans every spawned node process, so
    // vitest's collect/prepare phases take minutes and the default 5s
    // per-test timeout flakes against that. Bump it so real passes aren't
    // masked, and use threads (one reused worker) to avoid the per-fork tax.
    testTimeout: 60000,
    hookTimeout: 60000,
    pool: "threads",
  },
});
