import { openDb } from "../db/index.js";
import { createApp } from "./app.js";
import { HOST, PORT, DB_PATH, SESSION_PATH } from "../config.js";

const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';

const db  = openDb(DB_PATH);
const app = createApp(db, SESSION_PATH);

const server = app.listen(PORT, HOST, () => {
  // Use stdout — when run via dev.js the listen callback flushes before any I/O,
  // and when run directly in a terminal stdout is a TTY (no buffering).
  process.stdout.write(`${GREEN}${BOLD}API ready${RESET}  →  ${BOLD}http://localhost:${PORT}${RESET}\n`);
  process.stdout.write(`${DIM}  DB       ${DB_PATH}${RESET}\n`);
  process.stdout.write(`${DIM}  Session  ${SESSION_PATH}${RESET}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    process.stderr.write(`${RED}${BOLD}ERROR${RESET} Port ${PORT} already in use — stop the existing server first.\n`);
  } else {
    process.stderr.write(`${RED}${BOLD}ERROR${RESET} ${err.message}\n`);
  }
  process.exit(1);
});
