#!/usr/bin/env node
// test-fixtures.mjs — Fixture helpers for CLI-surface test harnesses.
// Used by test-handoff.mjs and test-pickup.mjs.
//
// Provides:
//   createFixture()                              → { projectRoot, sessionsDir, cleanup() }
//   createAnchorFixture()                        → { projectRoot, scratchDir, cleanup() }
//   writePidFile(sessionsDir, opts)              → void
//   parseFrontmatter(content)                    → { fields, sessionChain, bodyText }
//   validBody(overrides?)                        → string

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Create a temp project fixture: mkdtemp, git init, empty commit.
 * Also creates a fresh sessionsDir for CLAUDE_SESSIONS_DIR override.
 * @returns {{ projectRoot: string, sessionsDir: string, cleanup(): void }}
 */
export function createFixture() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'smcp-cli-'));
  const sessionsDir = mkdtempSync(join(tmpdir(), 'smcp-sess-'));
  execFileSync('git', ['init', '--quiet'], { cwd: projectRoot, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectRoot, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: projectRoot, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'init', '--allow-empty', '--quiet'], { cwd: projectRoot, stdio: 'ignore' });
  return {
    projectRoot,
    sessionsDir,
    cleanup() {
      try { rmSync(projectRoot, { recursive: true, force: true }); } catch {}
      try { rmSync(sessionsDir, { recursive: true, force: true }); } catch {}
    },
  };
}

/**
 * Create a lightweight `.git`-anchor fixture: mkdtemp, an empty `.git` FILE
 * marker (no `git init`, no subprocess), and an empty `scratch/` directory.
 *
 * Choice criterion vs. createFixture(): use createAnchorFixture() when the
 * code under test only needs project-root resolution to succeed —
 * resolveProjectRoot() (handoff.mjs:45-65) only `statSync`s for a `.git`
 * file-or-directory, it never reads git state. Use createFixture() when the
 * code under test needs real git state (a real repo, a commit, `git`
 * subprocess calls to succeed).
 *
 * @returns {{ projectRoot: string, scratchDir: string, cleanup(): void }}
 */
export function createAnchorFixture() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'smcp-anchor-'));
  writeFileSync(join(projectRoot, '.git'), '', 'utf-8');
  const scratchDir = join(projectRoot, 'scratch');
  mkdirSync(scratchDir, { recursive: true });
  return {
    projectRoot,
    scratchDir,
    cleanup() {
      try { rmSync(projectRoot, { recursive: true, force: true }); } catch {}
    },
  };
}

/**
 * Write a synthetic PID file to sessionsDir mimicking ~/.claude/sessions/{pid}.json.
 * @param {string} sessionsDir
 * @param {{ pid: number, sessionId: string, cwd: string, name?: string, updatedAt?: number }} opts
 */
export function writePidFile(sessionsDir, { pid, sessionId, cwd, name, updatedAt }) {
  mkdirSync(sessionsDir, { recursive: true });
  const now = updatedAt ?? Date.now();
  const obj = {
    pid,
    sessionId,
    cwd,
    startedAt: new Date(now - 60_000).toISOString(),
    updatedAt: new Date(now).toISOString(),
    version: '1.0.0',
    peerProtocol: '2024-11-05',
    kind: 'claude-code',
    entrypoint: 'cli',
  };
  if (name !== undefined) obj.name = name;
  writeFileSync(join(sessionsDir, `${pid}.json`), JSON.stringify(obj), 'utf-8');
}

/**
 * Parse frontmatter from HANDOFF.md content.
 * @param {string} content
 * @returns {{ fields: Record<string,string>, sessionChain: string[], bodyText: string }}
 */
export function parseFrontmatter(content) {
  const lines = content.split('\n');
  if (lines[0] !== '---') throw new Error('No opening --- in frontmatter');
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { closeIdx = i; break; }
  }
  if (closeIdx === -1) throw new Error('No closing --- in frontmatter');
  const fields = {};
  const sessionChain = [];
  let inChain = false;
  for (let i = 1; i < closeIdx; i++) {
    const line = lines[i];
    if (/^session_chain:/.test(line)) { inChain = true; continue; }
    if (inChain) {
      const chainItem = line.match(/^  - (.+)$/);
      if (chainItem) { sessionChain.push(chainItem[1].trim()); continue; }
      inChain = false;
    }
    const m = line.match(/^([^:]+):\s*(.*)/);
    if (m) fields[m[1].trim()] = m[2].trim();
  }
  return { fields, sessionChain, bodyText: lines.slice(closeIdx + 1).join('\n') };
}

/**
 * Return a valid 10-section HANDOFF.md body with optional overrides.
 * @param {{ done?: string, decisions?: string, avoid?: string, artifacts?: string }} [overrides]
 * @returns {string}
 */
export function validBody(overrides) {
  const o = overrides ?? {};
  const done = o.done ?? '- Did initial setup';
  const decisions = o.decisions ?? '- Use Node stdlib';
  const avoid = o.avoid ?? '- Do not edit manually';
  const artifacts = o.artifacts ?? '- scratch/my-feature/README.md';
  return [
    '## Goal',
    'Ship handoff skill.',
    '',
    '## Current state',
    'Implementation in progress.',
    '',
    '## Done this session',
    done,
    '',
    '## In progress',
    'Writing tests.',
    '',
    '## Decisions made',
    decisions,
    '',
    '## What to avoid',
    avoid,
    '',
    '## Open questions',
    '- Should /pickup filter by git branch?',
    '',
    '## Key files & artifacts',
    artifacts,
    '',
    '## Next best step',
    'Run the test harness.',
    '',
    '## Skills loaded',
    '- nodejs-expert',
    '',
  ].join('\n');
}
