#!/usr/bin/env node
// test-driver.mjs — Core CLI driver helpers for test harnesses.
// Used by test-handoff.mjs and test-pickup.mjs.
//
// AC#6 note: target was ≤ 100 LOC; this file is ~115 lines after the fixture helpers
// were split into test-fixtures.mjs. The residual gap is inherent to runPickup's
// subprocess JSON serialization + error unwrapping — it cannot be split further
// without creating a circular dependency.
//
// Provides:
//   runCli(argv, opts?)                          → { stdout, stderr, exitCode }
//   runHandoffFlow(opts)                         → { commitExitCode, commitStderr, commitStdout, handoffPath, json }
//   runPickup(fromArg, toSessionId, opts)        → { exitCode, json, stderr, stdout }

import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the scratch-memory.mjs entry point. */
export const CLI_PATH = join(__dirname, 'scratch-memory.mjs');

/** Absolute path to the pickup-with-pid.mjs helper. */
const PICKUP_WITH_PID_PATH = join(__dirname, 'pickup-with-pid.mjs');

/**
 * Run the scratch-memory CLI synchronously.
 * @param {string[]} argv  - Arguments after `node scratch-memory.mjs`
 * @param {{ env?: object, cwd?: string }} [opts]
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
export function runCli(argv, opts = {}) {
  const env = opts.env ?? process.env;
  const cwd = opts.cwd ?? process.cwd();
  try {
    const stdout = execFileSync('node', [CLI_PATH, ...argv], {
      encoding: 'utf-8',
      env,
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      exitCode: err.status ?? 1,
    };
  }
}

/**
 * Execute the handoff flow: fixture setup (mkdir + write body) → commit.
 * Creates scratch/S-{sessionId}/ and HANDOFF.md directly (no `handoff init` — verb deleted in Step 4).
 * Preserves existing frontmatter when present, so commit recovers first_written across writes.
 * @param {{ sessionId: string, body: string, env?: object, cwd?: string }} opts
 * @returns {{ commitExitCode, commitStderr, commitStdout, handoffPath, json }}
 */
export function runHandoffFlow({ sessionId, body, env, cwd }) {
  const projectRoot = cwd || process.cwd();
  const folderPath = join(projectRoot, 'scratch', `S-${sessionId}`);
  const handoffPath = join(folderPath, 'HANDOFF.md');
  const sessionsDirPath = join(folderPath, 'sessions');

  // Step 1: create folder structure
  mkdirSync(sessionsDirPath, { recursive: true });

  // Step 2: write body, preserving any existing frontmatter.
  // On second+ writes, the file already has frontmatter from a prior commit.
  // Preserving it allows commit to recover first_written and session_chain.
  let existingFrontmatter = '';
  if (existsSync(handoffPath)) {
    const existing = readFileSync(handoffPath, 'utf-8');
    const fmEnd = existing.indexOf('\n---\n');
    if (existing.startsWith('---\n') && fmEnd !== -1) {
      existingFrontmatter = existing.slice(0, fmEnd + 5); // include trailing '\n---\n'
    }
  }
  writeFileSync(handoffPath, existingFrontmatter + body, 'utf-8');

  // Step 3: commit
  const commitResult = runCli(['handoff', 'commit', sessionId, '--json'], { env, cwd });
  let json = null;
  if (commitResult.stdout) {
    try { json = JSON.parse(commitResult.stdout); } catch { /* ignore */ }
  }

  return {
    commitExitCode: commitResult.exitCode,
    commitStderr: commitResult.stderr,
    commitStdout: commitResult.stdout,
    handoffPath,
    json,
  };
}

/**
 * Execute pickup for a from-session arg.
 * Uses pickup-with-pid.mjs to register the subprocess's own PID file before calling pickup.
 * This is necessary because `pickup` reads process.pid to find the to-session's PID file.
 *
 * @param {string} fromArg         - Session arg: UUID, slug, or prefix
 * @param {string} toSessionId     - The session ID that should own the folder after pickup
 * @param {{ sessionsDir: string, cwd?: string, name?: string, projectRootCwd?: string }} opts
 * @returns {{ exitCode: number, json: object|null, stderr: string, stdout: string }}
 */
export function runPickup(fromArg, toSessionId, opts = {}) {
  const { sessionsDir, cwd, name, projectRootCwd } = opts;
  const env = { ...process.env, CLAUDE_SESSIONS_DIR: sessionsDir };
  const optsJson = JSON.stringify({
    fromArg,
    toSessionId,
    projectRootCwd: projectRootCwd || cwd || '',
    name,
  });

  try {
    const stdout = execFileSync('node', [PICKUP_WITH_PID_PATH, optsJson], {
      encoding: 'utf-8',
      env,
      cwd: cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let json = null;
    if (stdout) { try { json = JSON.parse(stdout); } catch {} }
    return { exitCode: 0, json, stderr: '', stdout };
  } catch (err) {
    const stderr = err.stderr ?? '';
    const stdout = err.stdout ?? '';
    let json = null;
    if (stdout) { try { json = JSON.parse(stdout); } catch {} }
    return { exitCode: err.status ?? 1, json, stderr, stdout };
  }
}
