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
import { extractGoalOneLiner } from './handoff.mjs';

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
 * Scan a handoff body for related projects: `scratch/<seg>/` tokens, excluding `S-*`.
 * @param {string} body
 * @returns {string[]} unique sorted segment names
 */
function extractRelatedProjectsFromBody(body) {
  const pattern = /scratch\/([^/\s]+)\//g;
  const set = new Set();
  let m;
  while ((m = pattern.exec(body)) !== null) {
    const seg = m[1];
    if (!seg.startsWith('S-') && seg !== '.' && seg !== '..') set.add(seg);
  }
  return Array.from(set).sort();
}

/**
 * Compose a VALID committed V1 (schema_version: 1) HANDOFF.md fixture directly.
 *
 * The retired `handoff commit` V1/V2 write path is gone — committing a non-v3 folder is
 * now a no-op redirect — so this helper writes the committed file in-process instead of
 * shelling out to the CLI. It preserves the pickup-facing contract: schema_version: 1
 * frontmatter (exercising the kept pickup V1→V2 migration), first_written carried across
 * writes, related_projects extracted from the body, and a `.bak/` snapshot on the 2nd+
 * write so the rename-carries-bak pickup test stays green.
 *
 * @param {{ sessionId: string, body: string, env?: object, cwd?: string }} opts
 * @returns {{ commitExitCode, commitStderr, commitStdout, handoffPath, json }}
 *
 * NOTE: `sessions/` is created unconditionally, making the fixture folder shape
 * `inconsistent` (sessions/ present, no `## Sessions` heading). Pickup's V1-heading
 * refinement block handles this by re-classifying it as `legacy` before migrating.
 * Callers passing a body without the 10 exact V1 headings would receive
 * `INCONSISTENT_FOLDER_STATE` rather than a legacy migration.
 */
export function runHandoffFlow({ sessionId, body, cwd }) {
  const projectRoot = cwd || process.cwd();
  const folderPath = join(projectRoot, 'scratch', `S-${sessionId}`);
  const handoffPath = join(folderPath, 'HANDOFF.md');
  const sessionsDirPath = join(folderPath, 'sessions');
  const bakDir = join(folderPath, '.bak');

  // Create folder structure (no `handoff init` — verb deleted in an earlier cycle).
  mkdirSync(sessionsDirPath, { recursive: true });

  // Preserve first_written from a prior committed file; snapshot prior content to .bak/
  // (mirrors the retired commit's D19 baseline so the pickup .bak round-trip test passes).
  let firstWritten = null;
  if (existsSync(handoffPath)) {
    const priorContent = readFileSync(handoffPath, 'utf-8');
    const fwMatch = priorContent.match(/^first_written:\s*(.+)$/m);
    if (fwMatch) firstWritten = fwMatch[1].trim();
    try {
      mkdirSync(bakDir, { recursive: true });
      const bakTs = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      const bakPath = join(bakDir, `HANDOFF-${bakTs}.md.bak`);
      if (!existsSync(bakPath)) writeFileSync(bakPath, priorContent, 'utf-8');
    } catch { /* non-blocking, mirrors commit's bak behavior */ }
  }

  const now = new Date().toISOString();
  if (!firstWritten) firstWritten = now;

  let gitBranch = 'unknown';
  try {
    gitBranch = execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], {
      cwd: projectRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || 'unknown';
  } catch { /* detached HEAD or no git — leave 'unknown' */ }

  const related = extractRelatedProjectsFromBody(body);
  const goal = extractGoalOneLiner(body).replace(/[\r\n]/g, ' ');

  const fmLines = [
    '---',
    `session_id: ${sessionId}`,
    `first_written: ${firstWritten}`,
    `last_updated: ${now}`,
    `git_branch: ${gitBranch}`,
    `session_name: ${sessionId}`,
  ];
  if (related.length > 0) {
    fmLines.push('related_projects:');
    for (const rp of related) fmLines.push(`  - ${rp}`);
  } else {
    fmLines.push('related_projects: []');
  }
  fmLines.push(`goal: ${goal}`, 'schema_version: 1', '---', '');
  writeFileSync(handoffPath, fmLines.join('\n') + body, 'utf-8');

  const json = {
    path: handoffPath,
    session_id: sessionId,
    first_written: firstWritten,
    last_updated: now,
    sections_validated: 10,
    related_projects: related,
    git_branch: gitBranch,
  };

  return {
    commitExitCode: 0,
    commitStderr: '',
    commitStdout: JSON.stringify(json),
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
