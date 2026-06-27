#!/usr/bin/env node
// Dev orchestrator — replaces concurrently for rich, prefixed logging.
import { spawn } from 'child_process';
import { createConnection } from 'net';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT     = join(dirname(fileURLToPath(import.meta.url)), '..');
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
    else if (signal && signal !== 'SIGTERM')
      emit(tag, yellow, `process received signal ${signal}`);
  });
}

// ─── Check a TCP port is listening (not an HTTP fetch) ───────────────────────
// We use TCP for Vite because the first HTTP request triggers on-demand
// compilation and can take 10-30s, making an HTTP-based readiness check
// time out even though Vite is perfectly healthy.
function tcpReady(port) {
  return new Promise(resolve => {
    const sock = createConnection({ port, host: '127.0.0.1' });
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error',   () => { sock.destroy(); resolve(false); });
  });
}

async function waitForPort(port, label, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  const slowAt   = Date.now() + 20_000;
  let warned = false;
  while (Date.now() < deadline) {
    if (await tcpReady(port)) return true;
    if (!warned && Date.now() > slowAt) {
      warned = true;
      emit('SYS', yellow,
        `${label} is slow — may be downloading iCloud-cached node_modules on first run`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

// ─── Poll /health via HTTP (confirms Express is actually handling requests) ──
async function waitForApi(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(HEALTH, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return true;
    } catch { /* not ready */ }
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

// ─── Wait for both services ───────────────────────────────────────────────────
emit('SYS', yellow, 'waiting for API and Vite...');
const [apiOk, uiOk] = await Promise.all([
  waitForApi(),
  waitForPort(UI_PORT, 'Vite'),
]);

// ─── Ready banner ─────────────────────────────────────────────────────────────
const BAR  = DIM('─'.repeat(54));
const NOTE = DIM('(first page load compiles TypeScript — takes a few seconds)');
if (apiOk && uiOk) {
  process.stdout.write('\n');
  process.stdout.write(`  ${BOLD(green('✓  All systems go — open your browser'))}\n`);
  process.stdout.write(`  ${BAR}\n`);
  process.stdout.write(`  ${cyan('Dashboard')}   →  ${BOLD(`http://localhost:${UI_PORT}/dashboard/`)}  ${green('← live HMR')}\n`);
  process.stdout.write(`  ${cyan('API Server')}  →  ${BOLD(`http://localhost:${API_PORT}`)}\n`);
  process.stdout.write(`  ${BAR}\n`);
  process.stdout.write(`  ${NOTE}\n`);
  process.stdout.write(`  ${DIM('Changes to dashboard/src/ auto-refresh the browser.')}\n`);
  process.stdout.write(`  ${DIM('Press Ctrl+C to stop all services.')}\n\n`);
} else {
  if (!apiOk) emit('SYS', red, red('API did not start within 2 min — check [API] logs above'));
  if (!uiOk)  emit('SYS', red, red('Vite did not start within 2 min — check [UI ] logs above'));
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown() {
  process.stdout.write('\n');
  emit('SYS', yellow, 'stopping all processes...');
  api.kill('SIGTERM');
  ui.kill('SIGTERM');
  setTimeout(() => process.exit(0), 700);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
