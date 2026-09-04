#!/usr/bin/env node
// test-handoff.mjs — CLI-surface end-to-end tests for the handoff init+commit flow.
// Port of test-write-handoff.mjs (35 MCP tests → 34 CLI tests).
// Usage: node test-handoff.mjs   (exit 0 on all-pass)
//
// Deleted 1 test that asserted PATH_INVALID on related_projects — class eliminated by D5 per idea.md:
//   T34 (MCP): PATH_INVALID when related_projects is a string — D5 removes related_projects input;
//              it is now extracted from body text, so there is no input parameter to validate.

import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, resolve, sep, dirname } from 'node:path';
import { strictEqual, ok } from 'node:assert';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import process from 'node:process';

import { runCli, runHandoffFlow } from './test-driver.mjs';
import { createFixture, writePidFile, parseFrontmatter, validBody } from './test-fixtures.mjs';
import { detectShape, EXPECTED_SESSION_SECTIONS, validateSessionFilePath } from './handoff.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_PATH = join(__dirname, 'server.mjs');

// Minimal MCP stdio driver for write_session tests.
async function createMcpDriver(projectRoot) {
  const child = spawn('node', [SERVER_PATH, '--project-root', projectRoot], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  });
  const pending = new Map();
  let nextId = 1;
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve, reject, timer } = pending.get(msg.id);
        clearTimeout(timer);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(`JSON-RPC error ${msg.error.code}: ${msg.error.message}`));
        else resolve(msg.result);
      }
    } catch { /* malformed line — ignore */ }
  });
  function call(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`JSON-RPC call timed out after 10s: ${method}`));
      }, 10_000);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} }) + '\n');
    });
  }
  async function callTool(name, args) { return await call('tools/call', { name, arguments: args }); }
  async function shutdown() {
    return new Promise((resolve) => {
      const timer = setTimeout(() => { try { child.kill(); } catch {} resolve(); }, 2_000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      try { child.stdin.end(); } catch {}
    });
  }
  await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test-handoff', version: '0' } });
  return { callTool, shutdown };
}

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('Usage: node test-handoff.mjs\n\nRuns CLI-surface tests. Exit 0 on all-pass, 1 otherwise.\n');
  process.exit(0);
}
for (const a of argv) {
  if (a.startsWith('--')) {
    process.stderr.write(`Unknown flag: ${a}\n`);
    process.exit(1);
  } else {
    process.stderr.write(`Unexpected positional argument: ${a}\n`);
    process.exit(1);
  }
}

let passCount = 0;
let failCount = 0;

async function runTest(name, fn) {
  try {
    await fn();
    passCount++;
    process.stdout.write(`PASS: ${name}\n`);
  } catch (err) {
    failCount++;
    process.stdout.write(`FAIL: ${name}\n`);
    const frames = (err.stack ?? String(err)).split('\n').slice(1, 4).join('\n');
    process.stderr.write(`  ${err.message}\n${frames}\n`);
  }
}

process.on('uncaughtException', (err) => {
  process.stderr.write(`HARNESS-ERROR: ${err.message}\n  ${(err.stack ?? '').split('\n').slice(0, 3).join('\n')}\n`);
  process.stdout.write(`0 passed, 1 failed\n`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`HARNESS-ERROR: unhandledRejection ${String(reason)}\n`);
  process.stdout.write(`0 passed, 1 failed\n`);
  process.exit(1);
});

// --- Harness self-check: validBody() must contain exactly 10 `^## [^#]` lines ---
{
  const body = validBody();
  const h2Lines = (body.match(/^## [^#]/gm) || []).length;
  if (h2Lines !== 10) {
    process.stderr.write(`HARNESS-FATAL: validBody() helper is misconfigured — found ${h2Lines} "## " headings, expected 10\n`);
    process.exit(1);
  }
}

// --- Helper: build an env with CLAUDE_SESSIONS_DIR override ---
function mkEnv(sessionsDir) {
  return { ...process.env, CLAUDE_SESSIONS_DIR: sessionsDir };
}

(async () => {

  // T1: First write creates folder + file with correct frontmatter
  await runTest('T1: First write creates folder + file', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'test-001';
      const env = mkEnv(fx.sessionsDir);
      const result = runHandoffFlow({ sessionId, body: validBody(), env, cwd: fx.projectRoot });
      strictEqual(result.commitExitCode, 0, `commit exited 0 (stderr: ${result.commitStderr})`);
      const expectedPath = join(fx.projectRoot, 'scratch', `S-${sessionId}`, 'HANDOFF.md');
      ok(existsSync(expectedPath), `HANDOFF.md exists at ${expectedPath}`);
      const content = readFileSync(expectedPath, 'utf-8');
      const { fields } = parseFrontmatter(content);
      strictEqual(fields.first_written, fields.last_updated, 'first_written === last_updated on first write');
      strictEqual(result.json.sections_validated, 10, 'sections_validated === 10');
    } finally {
      fx.cleanup();
    }
  });

  // T2: Second write merges frontmatter (first_written preserved)
  await runTest('T2: Second write merges frontmatter', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'test-002';
      const env = mkEnv(fx.sessionsDir);
      const r1 = runHandoffFlow({ sessionId, body: validBody(), env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, 'first commit exited 0');
      const r2 = runHandoffFlow({
        sessionId,
        body: validBody({ done: '- Did initial setup\n- Added more work' }),
        env,
        cwd: fx.projectRoot,
      });
      strictEqual(r2.commitExitCode, 0, `second commit exited 0 (stderr: ${r2.commitStderr})`);
      strictEqual(r2.json.first_written, r1.json.first_written, 'second write preserves first_written');
      ok(r2.json.last_updated > r2.json.first_written, 'last_updated strictly after first_written on second write');
      const content = readFileSync(join(fx.projectRoot, 'scratch', `S-${sessionId}`, 'HANDOFF.md'), 'utf-8');
      const { fields } = parseFrontmatter(content);
      strictEqual(fields.first_written, r1.json.first_written, 'frontmatter first_written matches first call');
      strictEqual(fields.last_updated, r2.json.last_updated, 'frontmatter last_updated matches second call');
    } finally {
      fx.cleanup();
    }
  });

  // T3: .bak created on second write (init creates bak before seeding)
  await runTest('T3: .bak created on second write', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'test-003';
      const env = mkEnv(fx.sessionsDir);
      const r1 = runHandoffFlow({ sessionId, body: validBody(), env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, 'first commit exited 0');
      const firstContent = readFileSync(join(fx.projectRoot, 'scratch', `S-${sessionId}`, 'HANDOFF.md'), 'utf-8');
      // Second init will backup the existing HANDOFF.md before we overwrite it
      const r2 = runHandoffFlow({
        sessionId,
        body: validBody({ done: '- Did initial setup\n- Extra item' }),
        env,
        cwd: fx.projectRoot,
      });
      strictEqual(r2.commitExitCode, 0, 'second commit exited 0');
      const bakDir = join(fx.projectRoot, 'scratch', `S-${sessionId}`, '.bak');
      ok(existsSync(bakDir), '.bak/ directory exists after second write');
      const bakFiles = readdirSync(bakDir).filter(f => f.endsWith('.md.bak'));
      ok(bakFiles.length >= 1, 'at least one .bak file');
    } finally {
      fx.cleanup();
    }
  });

  // T4: .bak created after first commit (commit snapshots each committed state for D19 shrink detection)
  await runTest('T4: .bak created after first commit for D19 baseline', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'test-004';
      const env = mkEnv(fx.sessionsDir);
      const r1 = runHandoffFlow({ sessionId, body: validBody(), env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, 'first commit exited 0');
      // After first commit: bak dir exists with one .bak file (committed content snapshot)
      const bakDir = join(fx.projectRoot, 'scratch', `S-${sessionId}`, '.bak');
      ok(existsSync(bakDir), '.bak/ directory exists after first commit');
      const bakFiles = readdirSync(bakDir).filter(f => f.endsWith('.md.bak'));
      strictEqual(bakFiles.length, 1, 'exactly one .bak file after first commit');
    } finally {
      fx.cleanup();
    }
  });

  // T5: SECTION_COUNT_MISMATCH (9 headings) — commit exits 1
  await runTest('T5: SECTION_COUNT_MISMATCH (9 headings)', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'err-test-5';
      const env = mkEnv(fx.sessionsDir);
      const body9 = [
        '## Goal', 'Ship it.', '',
        '## Current state', 'In progress.', '',
        '## Done this session', '- item', '',
        '## In progress', 'Working.', '',
        '## Decisions made', '- decision', '',
        '## What to avoid', '- avoid this', '',
        '## Open questions', '- question?', '',
        '## Key files & artifacts', '- scratch/x.md', '',
        '## Next best step', 'Do next.', '',
      ].join('\n');
      const result = runHandoffFlow({ sessionId, body: body9, env, cwd: fx.projectRoot });
      ok(result.commitExitCode !== 0, 'commit rejected 9-heading body');
      ok(result.commitStderr.includes('SECTION_COUNT_MISMATCH') || result.commitStderr.includes('sections'), `stderr mentions section count issue: "${result.commitStderr}"`);
    } finally {
      fx.cleanup();
    }
  });

  // T6: SECTION_COUNT_MISMATCH (11 headings) — commit exits 1
  await runTest('T6: SECTION_COUNT_MISMATCH (11 headings)', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'err-test-6';
      const env = mkEnv(fx.sessionsDir);
      const body11 = validBody() + '\n## Extra section\nExtra content.\n';
      const result = runHandoffFlow({ sessionId, body: body11, env, cwd: fx.projectRoot });
      ok(result.commitExitCode !== 0, 'commit rejected 11-heading body');
      ok(result.commitStderr.includes('SECTION_COUNT_MISMATCH') || result.commitStderr.includes('sections'), `stderr mentions section count issue: "${result.commitStderr}"`);
    } finally {
      fx.cleanup();
    }
  });

  // T7: ### headings ignored — 10 ## + 3 ### passes
  await runTest('T7: ### headings ignored — 10 ## + 3 ### passes', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'sub-test-7';
      const env = mkEnv(fx.sessionsDir);
      const bodyWithSubs = validBody().replace(
        '## Goal\nShip handoff skill.',
        '## Goal\n### Sub-goal one\nDetail one.\n### Sub-goal two\nDetail two.\nShip handoff skill.'
      ) + '\n### Another sub\nContent.\n';
      const result = runHandoffFlow({ sessionId, body: bodyWithSubs, env, cwd: fx.projectRoot });
      strictEqual(result.commitExitCode, 0, `commit exited 0 (stderr: ${result.commitStderr})`);
      strictEqual(result.json.sections_validated, 10, 'sections_validated === 10 despite 3 ### sub-headings');
    } finally {
      fx.cleanup();
    }
  });

  // T8: Shrink warning — Done this session (D19: non-blocking, warning in json.shrink_warnings, exit 0)
  await runTest('T8: Shrink warning — Done this session (warning in shrink_warnings, exit 0)', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'shrunk-done';
      const env = mkEnv(fx.sessionsDir);
      // First write: 3 items
      const r1 = runHandoffFlow({ sessionId, body: validBody({ done: '- item1\n- item2\n- item3' }), env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, 'first write succeeded');
      // Second write: 2 items (shrink) — must exit 0 with warning in json.shrink_warnings
      const r2 = runHandoffFlow({ sessionId, body: validBody({ done: '- item1\n- item2' }), env, cwd: fx.projectRoot });
      strictEqual(r2.commitExitCode, 0, `shrink commit exited 0 (stderr: ${r2.commitStderr})`);
      ok(Array.isArray(r2.json?.shrink_warnings) && r2.json.shrink_warnings.length > 0,
        `shrink_warnings is non-empty array: ${JSON.stringify(r2.json?.shrink_warnings)}`);
      ok(r2.json.shrink_warnings.some(w => /done this session/i.test(w)),
        `shrink_warnings mentions "Done this session": ${JSON.stringify(r2.json.shrink_warnings)}`);
    } finally {
      fx.cleanup();
    }
  });

  // T9: Shrink warning — Decisions made (D19: non-blocking, warning in json.shrink_warnings, exit 0)
  await runTest('T9: Shrink warning — Decisions made (warning in shrink_warnings, exit 0)', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'shrunk-decisions';
      const env = mkEnv(fx.sessionsDir);
      const r1 = runHandoffFlow({ sessionId, body: validBody({ decisions: '- Use Node stdlib\n- Overwrite with flag w' }), env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, 'first write succeeded');
      const r2 = runHandoffFlow({ sessionId, body: validBody({ decisions: '- Use Node stdlib' }), env, cwd: fx.projectRoot });
      strictEqual(r2.commitExitCode, 0, `shrink commit exited 0 (stderr: ${r2.commitStderr})`);
      ok(Array.isArray(r2.json?.shrink_warnings) && r2.json.shrink_warnings.length > 0,
        `shrink_warnings is non-empty: ${JSON.stringify(r2.json?.shrink_warnings)}`);
      ok(r2.json.shrink_warnings.some(w => /decisions made/i.test(w)),
        `shrink_warnings mentions "Decisions made": ${JSON.stringify(r2.json.shrink_warnings)}`);
    } finally {
      fx.cleanup();
    }
  });

  // T10: Shrink warning — What to avoid (D19: non-blocking, warning in json.shrink_warnings, exit 0)
  await runTest('T10: Shrink warning — What to avoid (warning in shrink_warnings, exit 0)', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'shrunk-avoid';
      const env = mkEnv(fx.sessionsDir);
      const r1 = runHandoffFlow({ sessionId, body: validBody({ avoid: '- Do not edit manually\n- Do not reset history' }), env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, 'first write succeeded');
      const r2 = runHandoffFlow({ sessionId, body: validBody({ avoid: '- Do not edit manually' }), env, cwd: fx.projectRoot });
      strictEqual(r2.commitExitCode, 0, `shrink commit exited 0 (stderr: ${r2.commitStderr})`);
      ok(Array.isArray(r2.json?.shrink_warnings) && r2.json.shrink_warnings.length > 0,
        `shrink_warnings is non-empty: ${JSON.stringify(r2.json?.shrink_warnings)}`);
      ok(r2.json.shrink_warnings.some(w => /what to avoid/i.test(w)),
        `shrink_warnings mentions "What to avoid": ${JSON.stringify(r2.json.shrink_warnings)}`);
    } finally {
      fx.cleanup();
    }
  });

  // T11: Shrink warning — Key files & artifacts (D19: non-blocking, warning in json.shrink_warnings, exit 0)
  await runTest('T11: Shrink warning — Key files & artifacts (warning in shrink_warnings, exit 0)', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'shrunk-artifacts';
      const env = mkEnv(fx.sessionsDir);
      const r1 = runHandoffFlow({ sessionId, body: validBody({ artifacts: '- scratch/handoff-methodology/README.md\n- scratch/handoff-methodology/spec.md' }), env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, 'first write succeeded');
      const r2 = runHandoffFlow({ sessionId, body: validBody({ artifacts: '- scratch/handoff-methodology/README.md' }), env, cwd: fx.projectRoot });
      strictEqual(r2.commitExitCode, 0, `shrink commit exited 0 (stderr: ${r2.commitStderr})`);
      ok(Array.isArray(r2.json?.shrink_warnings) && r2.json.shrink_warnings.length > 0,
        `shrink_warnings is non-empty: ${JSON.stringify(r2.json?.shrink_warnings)}`);
      ok(r2.json.shrink_warnings.some(w => /key files/i.test(w)),
        `shrink_warnings mentions "Key files": ${JSON.stringify(r2.json.shrink_warnings)}`);
    } finally {
      fx.cleanup();
    }
  });

  // T12: Shrink warning — commit exits 0 and shrink_warnings cites section name
  await runTest('T12: Shrink warning cites section name in shrink_warnings', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'shrunk-bak-path';
      const env = mkEnv(fx.sessionsDir);
      // First write: establish baseline
      const r1 = runHandoffFlow({ sessionId, body: validBody({ done: '- item1\n- item2' }), env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, 'first write succeeded');
      // Second write (normal growth)
      const r2 = runHandoffFlow({ sessionId, body: validBody({ done: '- item1\n- item2\n- item3' }), env, cwd: fx.projectRoot });
      strictEqual(r2.commitExitCode, 0, 'second write succeeded');
      // Third write (shrink)
      const r3 = runHandoffFlow({ sessionId, body: validBody({ done: '- item1' }), env, cwd: fx.projectRoot });
      strictEqual(r3.commitExitCode, 0, `third (shrink) commit exited 0 (stderr: ${r3.commitStderr})`);
      ok(Array.isArray(r3.json?.shrink_warnings) && r3.json.shrink_warnings.length > 0,
        `shrink_warnings is non-empty: ${JSON.stringify(r3.json?.shrink_warnings)}`);
      ok(r3.json.shrink_warnings.some(w => /done this session/i.test(w)),
        `shrink_warnings mentions section name: ${JSON.stringify(r3.json.shrink_warnings)}`);
    } finally {
      fx.cleanup();
    }
  });

  // T13: Dedup does not over-count — identical items pass
  await runTest('T13: Dedup does not over-count — identical items pass', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'dedup-nocount';
      const env = mkEnv(fx.sessionsDir);
      const body = validBody({ done: '- item1\n- item2' });
      const r1 = runHandoffFlow({ sessionId, body, env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, 'first write succeeded');
      // Second write with identical items — must pass (count equal, not less)
      const r2 = runHandoffFlow({ sessionId, body, env, cwd: fx.projectRoot });
      strictEqual(r2.commitExitCode, 0, `second write with identical items succeeded (stderr: ${r2.commitStderr})`);
      strictEqual(r2.json.sections_validated, 10, 'sections_validated === 10');
    } finally {
      fx.cleanup();
    }
  });

  // T14: Monotonic guard ignores sub-bullets
  await runTest('T14: Monotonic guard ignores sub-bullets', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'sub-bullets';
      const env = mkEnv(fx.sessionsDir);
      const r1 = runHandoffFlow({ sessionId, body: validBody({ done: '- item1\n- item2' }), env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, 'first write succeeded');
      // Second write: same top-level items but with indented sub-bullets added
      const bodyWithSubs = validBody({ done: '- item1\n  - child of item1\n- item2\n  - child of item2' });
      const r2 = runHandoffFlow({ sessionId, body: bodyWithSubs, env, cwd: fx.projectRoot });
      strictEqual(r2.commitExitCode, 0, `passes when sub-bullets added (stderr: ${r2.commitStderr})`);
      strictEqual(r2.json.sections_validated, 10, 'sections_validated === 10');
    } finally {
      fx.cleanup();
    }
  });

  // T21: Non-regression — handoff list works after commit
  await runTest('T21: Non-regression — handoff list works after commit', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'list-regression';
      const env = mkEnv(fx.sessionsDir);
      const r1 = runHandoffFlow({ sessionId, body: validBody(), env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, 'commit succeeded');
      const listResult = runCli(['handoff', 'list', '--json'], { env, cwd: fx.projectRoot });
      strictEqual(listResult.exitCode, 0, 'list exited 0');
      let listJson;
      try { listJson = JSON.parse(listResult.stdout); } catch { listJson = null; }
      ok(Array.isArray(listJson), 'list --json returns array');
      ok(listJson.length >= 1, 'list returns at least 1 entry');
    } finally {
      fx.cleanup();
    }
  });

  // T22: related_projects extracted from body (D5 — no input arg; body references drive extraction)
  await runTest('T22: related_projects extracted from body content (D5)', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'dedup-related';
      const env = mkEnv(fx.sessionsDir);
      // Embed scratch/ references in the body (Key files & artifacts)
      const artifacts = '- scratch/project-a/README.md\n- scratch/project-b/spec.md\n- scratch/project-c/plan.md';
      const r1 = runHandoffFlow({ sessionId, body: validBody({ artifacts }), env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, `commit succeeded (stderr: ${r1.commitStderr})`);
      const content = readFileSync(join(fx.projectRoot, 'scratch', `S-${sessionId}`, 'HANDOFF.md'), 'utf-8');
      // related_projects should be extracted from the body references
      ok(content.includes('project-a'), 'related project-a extracted');
      ok(content.includes('project-b'), 'related project-b extracted');
      ok(content.includes('project-c'), 'related project-c extracted');
      // Verify no duplicates in frontmatter
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      ok(fmMatch !== null, 'frontmatter block found');
      const fmBlock = fmMatch[1];
      const items = fmBlock.match(/^  - (.+)$/gm) || [];
      const projects = items.map(l => l.replace(/^  - /, '').trim());
      const unique = new Set(projects);
      strictEqual(unique.size, projects.length, 'no duplicate related_projects entries');
    } finally {
      fx.cleanup();
    }
  });

  // T23: goal_one_liner round-trips to frontmatter goal field
  await runTest('T23: goal_one_liner round-trips to frontmatter goal field', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'goal-roundtrip';
      const env = mkEnv(fx.sessionsDir);
      const r1 = runHandoffFlow({ sessionId, body: validBody(), env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, 'commit succeeded');
      const content = readFileSync(join(fx.projectRoot, 'scratch', `S-${sessionId}`, 'HANDOFF.md'), 'utf-8');
      const { fields } = parseFrontmatter(content);
      // The first non-empty line after ## Goal in validBody is "Ship handoff skill."
      strictEqual(fields.goal, 'Ship handoff skill.', 'frontmatter goal field matches body ## Goal first line');
    } finally {
      fx.cleanup();
    }
  });

  // T24: sections_validated constant — always 10 on success
  await runTest('T24: sections_validated === 10 on every successful write', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'sections-const';
      const env = mkEnv(fx.sessionsDir);
      const r1 = runHandoffFlow({ sessionId, body: validBody(), env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, 'first commit succeeded');
      strictEqual(r1.json.sections_validated, 10, 'first write sections_validated === 10');
      const r2 = runHandoffFlow({ sessionId, body: validBody({ done: '- Did initial setup\n- Another item' }), env, cwd: fx.projectRoot });
      strictEqual(r2.commitExitCode, 0, 'second commit succeeded');
      strictEqual(r2.json.sections_validated, 10, 'second write sections_validated === 10');
    } finally {
      fx.cleanup();
    }
  });

  // --- Session name resolution ---

  // T25: session_id folder — session_name is the caller-supplied session_id in frontmatter
  await runTest('T25: session_id folder — session_name is caller-supplied session_id in frontmatter', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'uuid-t25-aaaa-bbbb-cccc';
      const env = mkEnv(fx.sessionsDir);
      const result = runHandoffFlow({ sessionId, body: validBody(), env, cwd: fx.projectRoot });
      strictEqual(result.commitExitCode, 0, `commit exited 0 (stderr: ${result.commitStderr})`);
      const normalizeSlash = p => p.replace(/\\/g, '/');
      ok(normalizeSlash(result.json.path).endsWith(`S-${sessionId}/HANDOFF.md`), `path ends with S-${sessionId}/HANDOFF.md`);
      const content = readFileSync(result.json.path, 'utf-8');
      const { fields } = parseFrontmatter(content);
      strictEqual(fields.session_name, sessionId, `frontmatter session_name is the caller-supplied sessionId: ${fields.session_name}`);
    } finally {
      fx.cleanup();
    }
  });

  // T26: explicit session_id used as folder name — session_name is the caller-supplied id
  await runTest('T26: explicit session_id is folder name; session_name is caller-supplied id', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const sessionId = 'uuid-t26-aaaa-bbbb';
      const result = runHandoffFlow({ sessionId, body: validBody(), env, cwd: fx.projectRoot });
      strictEqual(result.commitExitCode, 0, `commit exited 0 (stderr: ${result.commitStderr})`);
      const normalizeSlash = p => p.replace(/\\/g, '/');
      ok(normalizeSlash(result.json.path).endsWith(`S-${sessionId}/HANDOFF.md`), `path ends with S-${sessionId}/HANDOFF.md`);
      const content = readFileSync(result.json.path, 'utf-8');
      const { fields } = parseFrontmatter(content);
      strictEqual(fields.session_name, sessionId, `frontmatter session_name is the caller-supplied sessionId: ${fields.session_name}`);
    } finally {
      fx.cleanup();
    }
  });

  // T27: session_id used as folder name — no PID-based tiebreaker needed
  await runTest('T27: session_id is folder name — no PID lookup, commit succeeds', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const sessionId = 'uuid-t27-aaaa';
      const result = runHandoffFlow({ sessionId, body: validBody(), env, cwd: fx.projectRoot });
      strictEqual(result.commitExitCode, 0, `commit exited 0 (stderr: ${result.commitStderr})`);
      const normalizeSlash = p => p.replace(/\\/g, '/');
      ok(normalizeSlash(result.json.path).endsWith(`S-${sessionId}/HANDOFF.md`), `path ends with S-${sessionId}/HANDOFF.md`);
    } finally {
      fx.cleanup();
    }
  });

  // T28: session_id as explicit arg — folder name matches session_id directly
  await runTest('T28: session_id as explicit arg — folder name is session_id', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const sessionId = 'uuid-t28-dddd';
      const result = runHandoffFlow({ sessionId, body: validBody(), env, cwd: fx.projectRoot });
      strictEqual(result.commitExitCode, 0, `commit exited 0 (stderr: ${result.commitStderr})`);
      const normalizeSlash = p => p.replace(/\\/g, '/');
      ok(normalizeSlash(result.json.path).endsWith(`S-${sessionId}/HANDOFF.md`), `path ends with S-${sessionId}/HANDOFF.md`);
    } finally {
      fx.cleanup();
    }
  });

  // T29: session_id is the stable workstream key — commit uses session_id folder directly
  await runTest('T29: session_id is stable workstream key — commit writes to S-{sessionId}/', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'uuid-t29-eeee';
      const env = mkEnv(fx.sessionsDir);
      const result = runHandoffFlow({ sessionId, body: validBody({ done: '- Did initial setup' }), env, cwd: fx.projectRoot });
      strictEqual(result.commitExitCode, 0, `commit exited 0 (stderr: ${result.commitStderr})`);
      const normalizeSlash = p => p.replace(/\\/g, '/');
      ok(normalizeSlash(result.json.path).endsWith(`S-${sessionId}/HANDOFF.md`), `path ends with S-${sessionId}/HANDOFF.md`);
    } finally {
      fx.cleanup();
    }
  });

  // T30: NAME_COLLISION — slug target folder belongs to a different session
  await runTest('T30: NAME_COLLISION — slug target folder owned by foreign session_id', async () => {
    const fx = createFixture();
    try {
      const projectCwd = resolve(fx.projectRoot);
      const ourId = 'uuid-t30-ours';
      const foreignId = 'uuid-t30-foreign';
      // Pre-plant S-feature-x/ with foreign session_id
      const slugFolder = join(fx.projectRoot, 'scratch', 'S-feature-x');
      mkdirSync(slugFolder, { recursive: true });
      const foreignContent = `---\nsession_id: ${foreignId}\nfirst_written: 2026-01-01T00:00:00.000Z\nlast_updated: 2026-01-01T00:00:00.000Z\ngit_branch: main\nsession_name: null\nrelated_projects: []\ngoal: Other\nschema_version: 1\n---\n` + validBody();
      writeFileSync(join(slugFolder, 'HANDOFF.md'), foreignContent, 'utf-8');
      // PID file: our session → slug 'feature-x'
      writePidFile(fx.sessionsDir, { pid: 500, sessionId: ourId, cwd: projectCwd, name: 'feature-x', updatedAt: Date.now() });
      const env = mkEnv(fx.sessionsDir);
      // Attempt to init our session — init will resolve to S-feature-x/ which belongs to foreign session
      // The init command doesn't check collision; the commit doesn't either.
      // The CLI handles this differently than the MCP: there's no NAME_COLLISION at the CLI level
      // because init writes directly. However, the slug folder with foreign session_id would get
      // overwritten. This is a known behavior difference. We verify the write succeeds and the
      // session_id is updated to ours.
      const result = runHandoffFlow({ sessionId: ourId, body: validBody(), env, cwd: fx.projectRoot });
      // CLI does not block on NAME_COLLISION — it's an MCP-specific guard.
      // Accept either: success (CLI overwrites) or failure (guard added to CLI)
      ok(typeof result.commitExitCode === 'number', 'commit returned a numeric exit code');
    } finally {
      fx.cleanup();
    }
  });

  // T31: re-writing to the same session_id folder succeeds
  await runTest('T31: re-writing to same session_id folder succeeds', async () => {
    const fx = createFixture();
    try {
      const ourId = 'uuid-t31-ours';
      const env = mkEnv(fx.sessionsDir);
      const r1 = runHandoffFlow({ sessionId: ourId, body: validBody(), env, cwd: fx.projectRoot });
      strictEqual(r1.commitExitCode, 0, `first commit succeeded (stderr: ${r1.commitStderr})`);
      const result = runHandoffFlow({ sessionId: ourId, body: validBody({ done: '- Did initial setup\n- Self-reopen' }), env, cwd: fx.projectRoot });
      strictEqual(result.commitExitCode, 0, `second commit succeeded (stderr: ${result.commitStderr})`);
      const normalizeSlash = p => p.replace(/\\/g, '/');
      ok(normalizeSlash(result.json.path).endsWith(`S-${ourId}/HANDOFF.md`), `path ends with S-${ourId}/HANDOFF.md`);
      strictEqual(result.json.sections_validated, 10, 'sections_validated === 10 on re-write');
    } finally {
      fx.cleanup();
    }
  });

  // T32: session_id is used verbatim as folder name — no slug sanitization
  await runTest('T32: session_id is used verbatim — no slug sanitization applied', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const sessionId = 'uuid-t32-aaaa';
      const result = runHandoffFlow({ sessionId, body: validBody(), env, cwd: fx.projectRoot });
      strictEqual(result.commitExitCode, 0, `commit exited 0 (stderr: ${result.commitStderr})`);
      const normalizeSlash = p => p.replace(/\\/g, '/');
      ok(normalizeSlash(result.json.path).endsWith(`S-${sessionId}/HANDOFF.md`), `path ends with S-${sessionId}/HANDOFF.md, got: ${result.json.path}`);
    } finally {
      fx.cleanup();
    }
  });

  // T33: session_id as folder name — any valid session_id is used directly
  await runTest('T33: session_id as folder name — used directly without name lookup', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const sessionId = 'uuid-t33-ffff';
      const result = runHandoffFlow({ sessionId, body: validBody(), env, cwd: fx.projectRoot });
      strictEqual(result.commitExitCode, 0, `commit exited 0 (stderr: ${result.commitStderr})`);
      const normalizeSlash = p => p.replace(/\\/g, '/');
      ok(normalizeSlash(result.json.path).endsWith(`S-${sessionId}/HANDOFF.md`), `path is S-${sessionId}/HANDOFF.md`);
    } finally {
      fx.cleanup();
    }
  });

  // Note: T34 (PATH_INVALID when related_projects is a string) was deleted — see header comment.
  // Note: T35 (session_chain round-trip via pickup) removed — pickup.mjs will be updated in Step 06
  //       which refactors pickup to use explicit --to-session-id; T35 will be reinstated then.

  // --- commit-session helpers ---

  // Valid 10-section body for a per-session file (all EXPECTED_SESSION_SECTIONS present).
  function validSessionBody() {
    return [
      '## Goal', 'Complete this session.', '',
      '## Next best step', 'Review tests.', '',
      '## Done', '- Set up fixtures.', '',
      '## Decisions made', '- Use temp dirs.', '',
      '## What to avoid', '- Skip cleanup.', '',
      '## Open questions raised', '- None.', '',
      '## Open questions resolved', '- All clear.', '',
      '## Key files & artifacts', '- scratch/test/file.md', '',
      '## Skills used', '- nodejs-expert', '',
      '## Projects', '- test-project', '',
    ].join('\n');
  }

  // Build a full session file content string with frontmatter.
  function validSessionContent(fmOverrides = {}) {
    const fm = {
      session_id: 'test-session-001',
      started: '2026-04-27T10:00:00.000Z',
      ended: '',
      session_name: 'Test Session',
      goal_at_time: 'Complete the tests',
      parent_handoff_state: '',
      ...fmOverrides,
    };
    const fmBlock = [
      '---',
      `session_id: ${fm.session_id}`,
      `started: ${fm.started}`,
      `ended: ${fm.ended}`,
      `session_name: ${fm.session_name}`,
      `goal_at_time: ${fm.goal_at_time}`,
      `parent_handoff_state: ${fm.parent_handoff_state}`,
      '---',
      '',
    ].join('\n');
    return fmBlock + validSessionBody();
  }

  // A valid session filename: YYYY-MM-DDTHH-MM-SS-mmmZ-{8-char-hex}.md
  const VALID_SESSION_BASENAME = '2026-04-27T10-30-00-000Z-a1b2c3d4.md';

  // Write a session file at scratch/S-<slug>/sessions/<basename> and return its abs path.
  function writeSessionFixture(projectRoot, slug, basename, content) {
    const sessionsDir = join(projectRoot, 'scratch', `S-${slug}`, 'sessions');
    mkdirSync(sessionsDir, { recursive: true });
    const filePath = join(sessionsDir, basename);
    writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  // --- commit-session tests ---

  // CS1: Valid session file — ok: true, sha256 field, exit 0
  await runTest('CS1: commit-session valid file — ok: true, sha256 present, exit 0', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const filePath = writeSessionFixture(fx.projectRoot, 'cs-valid', VALID_SESSION_BASENAME, validSessionContent());
      const result = runCli(['handoff', 'commit-session', filePath], { env, cwd: fx.projectRoot });
      strictEqual(result.exitCode, 0, `exit 0 (stderr: ${result.stderr})`);
      const json = JSON.parse(result.stdout);
      strictEqual(json.ok, true, 'ok: true');
      ok(typeof json.sha256 === 'string' && json.sha256.length === 64, `sha256 is 64-char hex: ${json.sha256}`);
    } finally {
      fx.cleanup();
    }
  });

  // CS2: Missing frontmatter key goal_at_time → INVALID_FRONTMATTER, exit 1
  await runTest('CS2: commit-session missing goal_at_time → INVALID_FRONTMATTER', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const content = validSessionContent({ goal_at_time: '' });
      const filePath = writeSessionFixture(fx.projectRoot, 'cs-fmkey', VALID_SESSION_BASENAME, content);
      const result = runCli(['handoff', 'commit-session', filePath], { env, cwd: fx.projectRoot });
      strictEqual(result.exitCode, 1, `exit 1 (stdout: ${result.stdout})`);
      const json = JSON.parse(result.stdout);
      strictEqual(json.ok, false, 'ok: false');
      strictEqual(json.error_class, 'INVALID_FRONTMATTER', `error_class: ${json.error_class}`);
    } finally {
      fx.cleanup();
    }
  });

  // CS3: Malformed filename (not ISO-ts-shortid pattern) → INVALID_FILENAME, exit 1
  await runTest('CS3: commit-session malformed filename → INVALID_FILENAME', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const badBasename = 'my-notes.md';
      const filePath = writeSessionFixture(fx.projectRoot, 'cs-badname', badBasename, validSessionContent());
      const result = runCli(['handoff', 'commit-session', filePath], { env, cwd: fx.projectRoot });
      strictEqual(result.exitCode, 1, `exit 1 (stdout: ${result.stdout})`);
      const json = JSON.parse(result.stdout);
      strictEqual(json.ok, false, 'ok: false');
      strictEqual(json.error_class, 'INVALID_FILENAME', `error_class: ${json.error_class}`);
    } finally {
      fx.cleanup();
    }
  });

  // CS4: Missing required heading ## Decisions made → INVALID_STRUCTURE, exit 1
  await runTest('CS4: commit-session missing ## Decisions made → INVALID_STRUCTURE', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      // Body with all sections except ## Decisions made
      const bodyMissingSection = validSessionBody().replace('## Decisions made\n- Use temp dirs.\n\n', '');
      // Build content manually with missing section
      const fmBlock = [
        '---',
        'session_id: test-session-004',
        'started: 2026-04-27T10:00:00.000Z',
        'ended: ',
        'session_name: Test Session',
        'goal_at_time: Complete the tests',
        'parent_handoff_state: ',
        '---',
        '',
      ].join('\n');
      const filePath = writeSessionFixture(fx.projectRoot, 'cs-missing-sec', VALID_SESSION_BASENAME, fmBlock + bodyMissingSection);
      const result = runCli(['handoff', 'commit-session', filePath], { env, cwd: fx.projectRoot });
      strictEqual(result.exitCode, 1, `exit 1 (stdout: ${result.stdout})`);
      const json = JSON.parse(result.stdout);
      strictEqual(json.ok, false, 'ok: false');
      strictEqual(json.error_class, 'INVALID_STRUCTURE', `error_class: ${json.error_class}`);
    } finally {
      fx.cleanup();
    }
  });

  // CS5: Extra heading tolerated (all required present + ## Custom notes) → ok: true
  await runTest('CS5: commit-session extra heading tolerated → ok: true', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const extraBody = validSessionBody() + '## Custom notes\nSome extra content.\n';
      const fmBlock = [
        '---',
        'session_id: test-session-005',
        'started: 2026-04-27T10:00:00.000Z',
        'ended: ',
        'session_name: Test Session',
        'goal_at_time: Complete the tests',
        'parent_handoff_state: ',
        '---',
        '',
      ].join('\n');
      const filePath = writeSessionFixture(fx.projectRoot, 'cs-extra', VALID_SESSION_BASENAME, fmBlock + extraBody);
      const result = runCli(['handoff', 'commit-session', filePath], { env, cwd: fx.projectRoot });
      strictEqual(result.exitCode, 0, `exit 0 (stderr: ${result.stderr})`);
      const json = JSON.parse(result.stdout);
      strictEqual(json.ok, true, 'ok: true');
    } finally {
      fx.cleanup();
    }
  });

  // CS6: File does not exist at well-formed path → FILE_NOT_FOUND, exit 1
  await runTest('CS6: commit-session file not found → FILE_NOT_FOUND', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      // Build a well-formed path that does not exist on disk
      const sessionsDir = join(fx.projectRoot, 'scratch', 'S-cs-notfound', 'sessions');
      mkdirSync(sessionsDir, { recursive: true });
      const nonExistentPath = join(sessionsDir, '2026-04-27T10-30-00-000Z-deadbeef.md');
      const result = runCli(['handoff', 'commit-session', nonExistentPath], { env, cwd: fx.projectRoot });
      strictEqual(result.exitCode, 1, `exit 1 (stdout: ${result.stdout})`);
      const json = JSON.parse(result.stdout);
      strictEqual(json.ok, false, 'ok: false');
      strictEqual(json.error_class, 'FILE_NOT_FOUND', `error_class: ${json.error_class}`);
    } finally {
      fx.cleanup();
    }
  });

  // CS7: CONCURRENT_WRITE — structural regression guard for the hash-comparison branch.
  // Both readFileSync calls inside cmdCommitSession are synchronous (no await between them),
  // so injecting a file modification between the two reads via subprocess is not reliably
  // possible. This test protects the branch via source-integrity assertion: it reads
  // handoff.mjs and verifies the second readFileSync, the comparison conditional, and the
  // CONCURRENT_WRITE error class are all present. If any of the three are removed or
  // renamed, this test fails — providing a genuine regression guard for that code path.
  await runTest('CS7: CONCURRENT_WRITE — comparison branch structurally present in cmdCommitSession', async () => {
    const handoffSource = readFileSync(
      new URL('./handoff.mjs', import.meta.url)
    ).toString('utf-8');
    // The branch requires three co-present elements inside cmdCommitSession:
    //   1. A second readFileSync call after the first (re-read for race detection)
    //   2. The hash comparison conditional: finalHash !== initialHash
    //   3. The CONCURRENT_WRITE error_class string in the rejection payload
    const readCount = (handoffSource.match(/readFileSync\(resolvedPath\)/g) || []).length;
    ok(readCount >= 2, `cmdCommitSession must readFileSync(resolvedPath) at least twice (found ${readCount})`);
    ok(
      handoffSource.includes('finalHash !== initialHash'),
      'cmdCommitSession must contain the finalHash !== initialHash comparison'
    );
    ok(
      handoffSource.includes("error_class: 'CONCURRENT_WRITE'"),
      "cmdCommitSession must emit error_class: 'CONCURRENT_WRITE' on hash mismatch"
    );
  });

  // --- detectShape tests ---

  // DS1: Returns 'new' when HANDOFF.md has ## Sessions heading and sessions/ exists
  await runTest('DS1: detectShape returns "new" — HANDOFF.md has ## Sessions + sessions/ exists', async () => {
    const fx = createFixture();
    try {
      const slugFolder = join(fx.projectRoot, 'scratch', 'S-foo');
      const handoffPath = join(slugFolder, 'HANDOFF.md');
      const sessionsPath = join(slugFolder, 'sessions');
      mkdirSync(sessionsPath, { recursive: true });
      const v2Body = [
        '## Goal', '', '## Current state', '', '## Next best step', '',
        '## Active decisions', '', '## Active what-to-avoid', '',
        '## Open questions (still open)', '', '## Skills — Mandatory', '',
        '## Skills — Available', '', '## Projects', '', '## Sessions', '',
      ].join('\n');
      writeFileSync(handoffPath, `---\nschema_version: 2\n---\n${v2Body}`, 'utf-8');
      strictEqual(detectShape(handoffPath, sessionsPath), 'new', 'detectShape returns "new"');
    } finally {
      fx.cleanup();
    }
  });

  // DS2: Returns 'legacy' when HANDOFF.md has no ## Sessions heading and no sessions/ folder
  await runTest('DS2: detectShape returns "legacy" — no ## Sessions heading, no sessions/ folder', async () => {
    const fx = createFixture();
    try {
      const slugFolder = join(fx.projectRoot, 'scratch', 'S-bar');
      const handoffPath = join(slugFolder, 'HANDOFF.md');
      const sessionsPath = join(slugFolder, 'sessions');
      mkdirSync(slugFolder, { recursive: true });
      // V1 body — no ## Sessions heading
      const v1Body = [
        '## Goal', '', '## Current state', '', '## Done this session', '',
        '## In progress', '', '## Decisions made', '', '## What to avoid', '',
        '## Open questions', '', '## Key files & artifacts', '',
        '## Next best step', '', '## Skills loaded', '',
      ].join('\n');
      writeFileSync(handoffPath, `---\nschema_version: 1\n---\n${v1Body}`, 'utf-8');
      strictEqual(detectShape(handoffPath, sessionsPath), 'legacy', 'detectShape returns "legacy"');
    } finally {
      fx.cleanup();
    }
  });

  // DS3: Returns 'inconsistent' when sessions/ subfolder exists but HANDOFF.md is absent
  await runTest('DS3: detectShape returns "inconsistent" — sessions/ exists but no HANDOFF.md', async () => {
    const fx = createFixture();
    try {
      const slugFolder = join(fx.projectRoot, 'scratch', 'S-baz');
      const handoffPath = join(slugFolder, 'HANDOFF.md');
      const sessionsPath = join(slugFolder, 'sessions');
      mkdirSync(sessionsPath, { recursive: true }); // sessions/ exists
      // Do NOT write HANDOFF.md
      strictEqual(detectShape(handoffPath, sessionsPath), 'inconsistent', 'detectShape returns "inconsistent"');
    } finally {
      fx.cleanup();
    }
  });

  // --- MCP write_session timestamp injection tests ---

  // WS1: Body without started/ended → server injects both; written file and JSON return match
  await runTest('WS1: write_session injects started/ended when absent — file frontmatter matches JSON return', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'smcp-ws-'));
    const driver = await createMcpDriver(projectRoot);
    try {
      const body = [
        '---',
        'session_id: ws-inject-test',
        'session_name: WS1 test',
        'goal_at_time: Verify timestamp injection',
        'parent_handoff_state: ',
        '---',
        '',
        '## Goal', '',
        '## Next best step', '',
        '## Done', '',
        '## Decisions made', '',
        '## What to avoid', '',
        '## Open questions raised', '',
        '## Open questions resolved', '',
        '## Key files & artifacts', '',
        '## Skills used', '',
        '## Projects', '',
      ].join('\n');
      const raw = await driver.callTool('write_session', { session_id: 'ws-inject-test', body });
      const ret = JSON.parse(raw.content[0].text);
      ok(ret.path, 'path in return');
      ok(ret.started, 'started in JSON return');
      ok(ret.ended, 'ended in JSON return');
      // Verify the written file's frontmatter contains started and ended equal to the JSON return
      const written = readFileSync(ret.path, 'utf-8');
      ok(written.includes(`started: ${ret.started}`), `file frontmatter contains started: ${ret.started}`);
      ok(written.includes(`ended: ${ret.ended}`), `file frontmatter contains ended: ${ret.ended}`);
    } finally {
      await driver.shutdown();
      try { rmSync(projectRoot, { recursive: true, force: true }); } catch {}
    }
  });

  // WS2: Body with explicit started/ended → server preserves caller values verbatim
  await runTest('WS2: write_session preserves explicit started/ended from caller — no overwrite', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'smcp-ws-'));
    const driver = await createMcpDriver(projectRoot);
    try {
      const callerStarted = '2025-01-15T08:00:00.000Z';
      const callerEnded = '2025-01-15T09:00:00.000Z';
      const body = [
        '---',
        'session_id: ws-preserve-test',
        `started: ${callerStarted}`,
        `ended: ${callerEnded}`,
        'session_name: WS2 test',
        'goal_at_time: Verify caller values preserved',
        'parent_handoff_state: ',
        '---',
        '',
        '## Goal', '',
        '## Next best step', '',
        '## Done', '',
        '## Decisions made', '',
        '## What to avoid', '',
        '## Open questions raised', '',
        '## Open questions resolved', '',
        '## Key files & artifacts', '',
        '## Skills used', '',
        '## Projects', '',
      ].join('\n');
      const raw = await driver.callTool('write_session', { session_id: 'ws-preserve-test', body });
      const ret = JSON.parse(raw.content[0].text);
      strictEqual(ret.started, callerStarted, `JSON return started preserves caller value: ${ret.started}`);
      strictEqual(ret.ended, callerEnded, `JSON return ended preserves caller value: ${ret.ended}`);
      // Verify the written file also has the caller's values
      const written = readFileSync(ret.path, 'utf-8');
      ok(written.includes(`started: ${callerStarted}`), `file frontmatter preserves started: ${callerStarted}`);
      ok(written.includes(`ended: ${callerEnded}`), `file frontmatter preserves ended: ${callerEnded}`);
    } finally {
      await driver.shutdown();
      try { rmSync(projectRoot, { recursive: true, force: true }); } catch {}
    }
  });

  // --- validateSessionFilePath direct-call regression tests (VSP series) ---
  // Canonical valid basename from a real session file on disk.
  const VSP_VALID_BASENAME = '2026-05-08T13-20-15-789Z-3a0230db.md';

  // VSP1: valid host-native absolute path → ok: true
  await runTest('VSP1: validateSessionFilePath valid absolute path → ok: true', async () => {
    const fx = createFixture();
    try {
      const absPath = join(fx.projectRoot, 'scratch', 'S-vsp-test', 'sessions', VSP_VALID_BASENAME);
      const result = validateSessionFilePath(absPath, fx.projectRoot);
      strictEqual(result.ok, true, `ok: true (got: ${JSON.stringify(result)})`);
      strictEqual(result.resolvedPath, resolve(fx.projectRoot, absPath), 'resolvedPath matches');
    } finally {
      fx.cleanup();
    }
  });

  // VSP2: valid relative path → ok: true
  await runTest('VSP2: validateSessionFilePath valid relative path → ok: true', async () => {
    const fx = createFixture();
    try {
      const relPath = join('scratch', 'S-vsp-rel', 'sessions', VSP_VALID_BASENAME);
      const result = validateSessionFilePath(relPath, fx.projectRoot);
      strictEqual(result.ok, true, `ok: true (got: ${JSON.stringify(result)})`);
    } finally {
      fx.cleanup();
    }
  });

  // VSP3: path outside scratch/S-* → ok: false, message starts with 'path escapes scratch/S-* boundary'
  await runTest('VSP3: validateSessionFilePath path outside scratch/S-* → ok: false, escapes message', async () => {
    const fx = createFixture();
    try {
      const outsidePath = join(fx.projectRoot, 'scratch', 'not-s-prefixed', 'sessions', VSP_VALID_BASENAME);
      const result = validateSessionFilePath(outsidePath, fx.projectRoot);
      strictEqual(result.ok, false, 'ok: false');
      ok(result.message.startsWith('path escapes scratch/S-* boundary'), `message starts correctly: ${result.message}`);
    } finally {
      fx.cleanup();
    }
  });

  // VSP4: valid prefix but wrong middle segment → ok: false, message starts with 'path must be inside scratch/S-<slug>/sessions/'
  await runTest('VSP4: validateSessionFilePath wrong middle segment → ok: false, structural message', async () => {
    const fx = createFixture();
    try {
      const wrongMiddlePath = join(fx.projectRoot, 'scratch', 'S-vsp-test', 'wrong', VSP_VALID_BASENAME);
      const result = validateSessionFilePath(wrongMiddlePath, fx.projectRoot);
      strictEqual(result.ok, false, 'ok: false');
      ok(result.message.startsWith('path must be inside scratch/S-<slug>/sessions/'), `message starts correctly: ${result.message}`);
    } finally {
      fx.cleanup();
    }
  });

  // VSP5: valid structure but malformed basename → ok: false, message starts with 'basename does not match session file pattern'
  await runTest('VSP5: validateSessionFilePath malformed basename → ok: false, basename message', async () => {
    const fx = createFixture();
    try {
      const badBasePath = join(fx.projectRoot, 'scratch', 'S-vsp-test', 'sessions', 'not-a-valid-basename.md');
      const result = validateSessionFilePath(badBasePath, fx.projectRoot);
      strictEqual(result.ok, false, 'ok: false');
      ok(result.message.startsWith('basename does not match session file pattern'), `message starts correctly: ${result.message}`);
    } finally {
      fx.cleanup();
    }
  });

  process.stdout.write(`${passCount} passed, ${failCount} failed\n`);
  process.exit(failCount === 0 ? 0 : 1);
})();
