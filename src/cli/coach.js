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
  .option("--mistakes <text>")
  .option("--approach <text>")
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

program.parse();
