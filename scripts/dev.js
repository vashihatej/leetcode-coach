#!/usr/bin/env node
// Dev orchestrator — replaces concurrently for rich, prefixed logging.
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_PORT = Number(process.env.COACH_PORT) || 8765;
const UI_PORT  = 5173;
const HEALTH   = `http://localhost:${API_PORT}/health`;

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const R = '\x1b[0m';
const BOLD    = s => `\x1b[1m${s}${R}`;
const DIM     = s => `\x1b[2m${s}${R}`;
const red     = s => `\x1b[31m${s}${R}`;
const green   = s => `\x1b[32m${s}${R}`;
const yellow  = s => `\x1b[33m${s}${R}`;
const blue    = s => `\x1b[34m${s}${R}`;
const magenta = s => `\x1b[35m${s}${R}`;
const cyan    = s => `\x1b[36m${s}${R}`;

function emit(tag, tagColor, text) {
  process.stdout.write(`${tagColor(BOLD(`[${tag}]`))} ${text}\n`);
}

// ─── Attach stdout/stderr of a child process ──────────────────────────────────
function attach(proc, tag, tagColor) {
  const flush = data =>
    data.toString()
      .split('\n')
      .map(l => l.trimEnd())
      .filter(Boolean)
      .forEach(l => emit(tag, tagColor, l));

  proc.stdout.on('data', flush);
  proc.stderr.on('data', flush);

  proc.on('error', err => {
    emit(tag, red, red(`spawn error: ${err.message}`));
  });

  proc.on('exit', (code, signal) => {
    if (code !== 0 && code !== null)
      emit(tag, red, red(`process exited with code ${code}`));
    else if (signal)
      emit(tag, yellow, `process received signal ${signal}`);
  });
}

// ─── Poll /health until API is up ────────────────────────────────────────────
async function waitForApi(url, timeoutMs = 120_000) {
  const deadline  = Date.now() + timeoutMs;
  const slowWarn  = Date.now() + 15_000;  // warn after 15s
  let warned = false;
  let attempt = 0;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* connection refused — not up yet */ }
    if (!warned && Date.now() > slowWarn) {
      warned = true;
      emit('SYS', yellow, 'still waiting — first run may be slow if node_modules are in iCloud Drive');
    }
    attempt++;
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

// ─── Startup banner ───────────────────────────────────────────────────────────
process.stdout.write('\n');
process.stdout.write(`${BOLD(blue('  ⚡ LeetCode Coach'))}  ${DIM('dev mode')}\n`);
process.stdout.write(`${DIM('  Launching API server + Vite dev server...')}\n\n`);

// ─── Spawn processes ──────────────────────────────────────────────────────────
const api = spawn('node', ['src/server/index.js'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env },
});
attach(api, 'API', blue);

const ui = spawn('npm', ['--prefix', 'dashboard', 'run', 'dev'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
});
attach(ui, 'UI ', magenta);

// ─── Wait for API to be healthy ───────────────────────────────────────────────
emit('SYS', yellow, 'polling API health...');
const ready = await waitForApi(HEALTH);

// ─── Ready banner ─────────────────────────────────────────────────────────────
const BAR = DIM('─'.repeat(54));
if (ready) {
  process.stdout.write('\n');
  process.stdout.write(`  ${BOLD(green('✓  All systems go'))}\n`);
  process.stdout.write(`  ${BAR}\n`);
  process.stdout.write(`  ${cyan('Dashboard')}   →  ${BOLD(`http://localhost:${UI_PORT}/dashboard/`)}  ${green('← HMR enabled')}\n`);
  process.stdout.write(`  ${cyan('API Server')}  →  ${BOLD(`http://localhost:${API_PORT}`)}\n`);
  process.stdout.write(`  ${cyan('Health')}      →  ${BOLD(HEALTH)}\n`);
  process.stdout.write(`  ${BAR}\n`);
  process.stdout.write(`  ${DIM('Edits in dashboard/ auto-refresh — no manual reload needed.')}\n`);
  process.stdout.write(`  ${DIM('Press Ctrl+C to stop all services.')}\n\n`);
} else {
  emit('SYS', red, red(`API did not become ready within 2 minutes — check [API] logs above`));
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown() {
  process.stdout.write('\n');
  emit('SYS', yellow, 'stopping all processes...');
  api.kill('SIGTERM');
  ui.kill('SIGTERM');
  // Give processes a moment to finish, then exit
  setTimeout(() => process.exit(0), 700);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
