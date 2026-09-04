#!/usr/bin/env node
// pickup-with-pid.mjs — Test helper: write self-PID file then run pickup IN-PROCESS.
// Used by test-driver.mjs to simulate a real session's pickup with correct PID matching.
//
// The key design: pickup.mjs reads process.pid to locate the sessions PID file.
// By importing pickup.mjs dispatch() in THIS PROCESS after writing the PID file,
// the PIDs match because it's the same OS process.
//
// Interception: dispatch() calls process.exit() — we intercept it via a thrown sentinel
// so we can capture output before actually exiting.
//
// Args (JSON on argv[2]):
//   { fromArg, toSessionId, projectRootCwd, name? }
// Env: CLAUDE_SESSIONS_DIR must be set

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const opts = JSON.parse(process.argv[2] ?? '{}');
const { fromArg, toSessionId, projectRootCwd, name } = opts;

const sessionsDir = process.env.CLAUDE_SESSIONS_DIR;
if (!sessionsDir) {
  process.stderr.write('ERROR: CLAUDE_SESSIONS_DIR not set\n');
  // 2 = missing required env CLAUDE_SESSIONS_DIR (harness error, not user error)
  process.exit(2);
}

// Write self-PID file so pickup can find the current session
const pidObj = {
  pid: process.pid,
  sessionId: toSessionId,
  cwd: projectRootCwd || '',
  startedAt: new Date(Date.now() - 60000).toISOString(),
  updatedAt: new Date().toISOString(),
  version: '1.0.0',
  peerProtocol: '2024-11-05',
  kind: 'claude-code',
  entrypoint: 'cli',
};
if (name) pidObj.name = name;
mkdirSync(sessionsDir, { recursive: true });
writeFileSync(join(sessionsDir, `${process.pid}.json`), JSON.stringify(pidObj), 'utf-8');

// Set cwd to the project root so resolveProjectRoot() walks from there
if (projectRootCwd) process.chdir(projectRootCwd);

// Intercept process.exit so dispatch() can call it without terminating the process prematurely.
// We replace it with a function that throws a special sentinel error.
// The await below catches the sentinel and exits with the captured code.
class ExitSignal {
  constructor(code) { this.code = code; }
}
const origExit = process.exit.bind(process);
process.exit = (code) => { throw new ExitSignal(code ?? 0); };

// Override process.argv to simulate: node scratch-memory.mjs pickup <fromArg> --to-session-id <toSessionId> --json
process.argv = ['node', 'scratch-memory.mjs', 'pickup', fromArg, '--to-session-id', toSessionId, '--json'];

// Import and run pickup dispatch in-process (same PID as the session file we just wrote)
// Must use pathToFileURL on Windows — bare Windows paths fail with ERR_UNSUPPORTED_ESM_URL_SCHEME
const pickupUrl = pathToFileURL(join(__dirname, 'pickup.mjs')).href;
const { dispatch } = await import(pickupUrl);

let exitCode = 0;
try {
  await dispatch([fromArg, '--to-session-id', toSessionId, '--json']);
} catch (err) {
  if (err instanceof ExitSignal) {
    exitCode = err.code;
  } else {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    exitCode = 2;
  }
}

// Restore process.exit and exit with captured code
process.exit = origExit;
origExit(exitCode);
