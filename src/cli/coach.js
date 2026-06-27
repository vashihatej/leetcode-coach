#!/usr/bin/env node
import { Command } from "commander";
import { openDb } from "../db/index.js";
import { DB_PATH, SESSION_PATH } from "../config.js";
import {
  cmdLogAttempt,
  cmdMastery,
  cmdSetMastery,
  cmdStatus,
  cmdReviewDue,
  cmdEnrichPattern,
  cmdPatternWikiStatus,
  cmdSetVizPath,
} from "./commands.js";

const db = openDb(DB_PATH);
const program = new Command();
program.name("coach").description("LeetCode Coach CLI");

program
  .command("status")
  .description("print the current session.md")
  .action(() => console.log(cmdStatus(db, SESSION_PATH)));

program
  .command("log-attempt")
  .requiredOption("--slug <slug>")
  .option("--solved", "mark as solved", false)
  .option("--result <type>", "brute | optimal")
  .option("--hints <list>", "comma-separated rung numbers")
  .option("--patterns <list>", "comma-separated algorithm patterns")
  .option("--instinct-fired", "user recognized the recorded pattern before coaching", false)
  .option("--mistakes <text>")
  .option("--approach <text>")
  .option("--aha <text>")
  .option("--confusion <text>")
  .option("--analogy <text>")
  .option("--viz-path <path>")
  .action((opts) => console.log(cmdLogAttempt(db, opts)));

program
  .command("mastery")
  .description("print the pattern mastery map")
  .action(() => console.log(cmdMastery(db)));

program
  .command("set-mastery")
  .requiredOption("--pattern <name>")
  .requiredOption("--level <level>", "not_started | shaky | solid")
  .action((opts) => console.log(cmdSetMastery(db, opts)));

program
  .command("review-due")
  .description("list problems due for spaced-repetition review")
  .action(() => console.log(cmdReviewDue(db)));

program
  .command("enrich-pattern")
  .description("save a wiki knowledge card for a pattern")
  .requiredOption("--pattern <name>")
  .option("--description <text>")
  .option("--signals <csv-or-json>")
  .option("--invariant <text>")
  .option("--analogy <text>")
  .option("--template <code>")
  .option("--mistakes <csv-or-json>")
  .option("--when-not <text>")
  .option("--related <csv-or-json>")
  .option("--time-complexity <text>")
  .option("--space-complexity <text>")
  .action((opts) => console.log(cmdEnrichPattern(db, opts)));

program
  .command("pattern-wiki-status")
  .description("check if a pattern has a wiki entry")
  .requiredOption("--pattern <name>")
  .action((opts) => console.log(cmdPatternWikiStatus(db, opts)));

program
  .command("set-viz-path")
  .description("attach a viz path to the most recent attempt for a problem")
  .requiredOption("--slug <slug>")
  .requiredOption("--viz-path <path>")
  .action((opts) => console.log(cmdSetVizPath(db, opts)));

program.parse();
