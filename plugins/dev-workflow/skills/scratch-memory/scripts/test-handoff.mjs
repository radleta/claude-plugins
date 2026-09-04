#!/usr/bin/env node
// test-handoff.mjs — CLI-surface tests for the handoff verb group + v3 pointer flow.
// Usage: node test-handoff.mjs   (exit 0 on all-pass)
//
// The legacy V1/V2 `handoff commit`/`validate` write-path tests (former T1–T14, T21–T33,
// V1REG, V2REG) were removed when those paths were retired: committing/validating a non-v3
// folder is now a no-op rewrite-pointer redirect, covered by the RDR tests below. The kept
// pickup V1→V2 migration path is exercised by test-pickup.mjs.

import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, resolve, sep, dirname } from 'node:path';
import { deepStrictEqual, strictEqual, ok } from 'node:assert';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import process from 'node:process';

import { runCli } from './test-driver.mjs';
import { createFixture } from './test-fixtures.mjs';
import { detectShape, EXPECTED_SESSION_SECTIONS, validateSessionFilePath, SESSION_FILE_TEMPLATE } from './handoff.mjs';
import { assembleSessions, parseFilenameTsPrefix, sortSessionFilesNewestFirst, questionKernel, questionId, relLink, cumulativeKey, cumulativeBlock } from './cat-sessions.mjs';
import { scanTasks, renderTasksBlock, taskAgeDays, renderAge } from './tasks.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_PATH = join(__dirname, 'server.mjs');
const PICKUP_WITH_PID_PATH = join(__dirname, 'pickup-with-pid.mjs');

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

// --- Helper: build an env with CLAUDE_SESSIONS_DIR override ---
function mkEnv(sessionsDir) {
  return { ...process.env, CLAUDE_SESSIONS_DIR: sessionsDir };
}

(async () => {

  // ---------------------------------------------------------------------------
  // RDR — Redirect tests: commit/validate on a non-v3 folder are JIT signposts.
  // The retired V1/V2 in-place write/validate paths now print a rewrite-pointer
  // signpost to stderr, exit 0, and never mutate the artifact.
  // ---------------------------------------------------------------------------

  // RDR1: commit on a legacy (non-v3) folder → rewrite-pointer signpost, exit 0, no mutation
  await runTest("RDR1: commit on non-v3 folder prints rewrite-pointer signpost, exit 0, no mutation", async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const sessionId = "rdr-commit";
      const folderPath = join(fx.projectRoot, "scratch", `S-${sessionId}`);
      mkdirSync(folderPath, { recursive: true });
      const handoffPath = join(folderPath, "HANDOFF.md");
      const original = [
        "---",
        `session_id: ${sessionId}`,
        "schema_version: 1",
        "---",
        "## Goal",
        "Legacy goal.",
        "",
      ].join("\n");
      writeFileSync(handoffPath, original, "utf-8");
      // spawnSync (not runCli) so stderr is captured even on exit 0.
      const cliPath = join(__dirname, "scratch-memory.mjs");
      const res = spawnSync("node", [cliPath, "handoff", "commit", sessionId], {
        encoding: "utf-8", env: { ...process.env, ...env }, cwd: fx.projectRoot,
      });
      strictEqual(res.status, 0, `commit exits 0 (stderr: ${res.stderr})`);
      ok(res.stderr.includes("rewrite-pointer"), `stderr cites rewrite-pointer: "${res.stderr}"`);
      ok(res.stderr.includes("no longer maintained"), "stderr says no longer maintained");
      strictEqual(readFileSync(handoffPath, "utf-8"), original, "HANDOFF.md is not mutated by the redirect");
    } finally {
      fx.cleanup();
    }
  });

  // RDR2: validate on a v2 (new-shape, non-v3) folder → rewrite-pointer signpost, exit 0, no mutation
  await runTest("RDR2: validate on non-v3 folder prints rewrite-pointer signpost, exit 0, no mutation", async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const sessionId = "rdr-validate";
      const folderPath = join(fx.projectRoot, "scratch", `S-${sessionId}`);
      mkdirSync(join(folderPath, "sessions"), { recursive: true });
      const handoffPath = join(folderPath, "HANDOFF.md");
      const original = [
        "---",
        `session_id: ${sessionId}`,
        "schema_version: 2",
        "---",
        "## Goal",
        "Legacy v2 goal.",
        "",
        "## Sessions",
        "",
      ].join("\n");
      writeFileSync(handoffPath, original, "utf-8");
      // spawnSync (not runCli) so stderr is captured even on exit 0.
      const cliPath = join(__dirname, "scratch-memory.mjs");
      const res = spawnSync("node", [cliPath, "handoff", "validate", sessionId], {
        encoding: "utf-8", env: { ...process.env, ...env }, cwd: fx.projectRoot,
      });
      strictEqual(res.status, 0, `validate exits 0 (stderr: ${res.stderr})`);
      ok(res.stderr.includes("rewrite-pointer"), `stderr cites rewrite-pointer: "${res.stderr}"`);
      strictEqual(readFileSync(handoffPath, "utf-8"), original, "HANDOFF.md is not mutated by the redirect");
    } finally {
      fx.cleanup();
    }
  });


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

  // WS3: Durable file created and readable; response schema includes { path, session_id, started, ended }
  await runTest('WS3: write_session durable write — file exists with body content; response schema includes core fields', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'smcp-ws3-'));
    const driver = await createMcpDriver(projectRoot);
    try {
      const sessionId = 'ws3-durability';
      const body = [
        '---',
        `session_id: ${sessionId}`,
        'started: 2026-01-01T10:00:00.000Z',
        'ended: 2026-01-01T10:00:00.000Z',
        'session_name: WS3 test',
        'goal_at_time: Verify durable write',
        'parent_handoff_state: ',
        '---',
        '',
        '## Goal', 'Durability test.',
        '## Next best step', 'Confirm fsync path.',
        '## Done', '- Write completed.',
        '## Decisions made', '- Use openSync.',
        '## What to avoid', '- writeFileSync for session writes.',
        '## Open questions raised', '- None.',
        '## Open questions resolved', '- None.',
        '## Key files & artifacts', '- scratch/test.md',
        '## Skills used', '- nodejs-expert',
        '## Projects', '- handoff-cat-pickup',
      ].join('\n');
      const raw = await driver.callTool('write_session', { session_id: sessionId, body });
      const ret = JSON.parse(raw.content[0].text);
      // Response schema includes: { path, session_id, started, ended, ... } (also carries pointer — see WS4)
      ok(typeof ret.path === 'string' && ret.path.length > 0, 'path present and non-empty');
      strictEqual(ret.session_id, sessionId, 'session_id echoed correctly');
      ok(typeof ret.started === 'string' && ret.started.length > 0, 'started present');
      ok(typeof ret.ended === 'string' && ret.ended.length > 0, 'ended present');
      // File must exist (durable write succeeded — proves openSync+writeSync+fsyncSync path ran)
      ok(existsSync(ret.path), `file exists at returned path: ${ret.path}`);
      // File must contain written body content
      const written = readFileSync(ret.path, 'utf-8');
      ok(written.includes('Durability test.'), 'written file contains body content');
      ok(written.includes(`session_id: ${sessionId}`), 'written file contains session_id frontmatter');
    } finally {
      await driver.shutdown();
      try { rmSync(projectRoot, { recursive: true, force: true }); } catch {}
    }
  });

  // WS_STRUCT: Durability write sequence and partial-file cleanup structurally present in server.mjs.
  // Guards openSync→writeSync→fsyncSync→closeSync chain and unlinkSync-on-failure against regression.
  await runTest('WS_STRUCT: write_session durability sequence structurally present in server.mjs', async () => {
    const serverSource = readFileSync(new URL('./server.mjs', import.meta.url)).toString('utf-8');
    ok(serverSource.includes("openSync(destPath, 'wx')"), "exclusive-create openSync(destPath, 'wx') present");
    ok(serverSource.includes('writeSync(fd,'), 'writeSync(fd,...) present');
    ok(serverSource.includes('fsyncSync(fd)'), 'fsyncSync(fd) for durable flush present');
    ok(serverSource.includes('unlinkSync(destPath)'), 'unlinkSync(destPath) for partial-file cleanup on failure present');
    ok(serverSource.includes('closeSync(fd)'), 'closeSync(fd) in finally present');
    // EEXIST collision-suffix retry loop present
    ok(serverSource.includes("code === 'EEXIST'"), "EEXIST collision detection present");
    ok(serverSource.includes('counter += 1'), 'collision suffix counter increment present');
    // Exactly one fsyncSync call site — not applied to audit appendFileSync (D006)
    const fsyncCallCount = (serverSource.match(/fsyncSync\(/g) || []).length;
    strictEqual(fsyncCallCount, 1, `fsyncSync called exactly once — not added to audit log (found ${fsyncCallCount})`);
    // Response shape includes: { path: destPath, session_id, started, ended, pointer }
    ok(/path:?\s*(destPath|path)[\s,}]/.test(serverSource) && serverSource.includes('session_id') && serverSource.includes('started') && serverSource.includes('ended') && serverSource.includes('pointer'),
      'response shape { path, session_id, started, ended, pointer } present');
  });

  // WS4: write_session mechanically auto-regenerates the HANDOFF.md pointer —
  // no separate rewrite-pointer call required. Also proves the server.mjs →
  // rewrite-pointer.mjs import chain loads cleanly (spawned via createMcpDriver).
  await runTest('WS4: write_session auto-regenerates HANDOFF.md pointer — return has pointer.written true, file is v3', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'smcp-ws4-'));
    const driver = await createMcpDriver(projectRoot);
    try {
      const sessionId = 'ws4-auto-pointer';
      const body = [
        '---',
        `session_id: ${sessionId}`,
        'session_name: WS4 test',
        'goal_at_time: Verify auto pointer regeneration',
        'parent_handoff_state: ',
        '---',
        '',
        '## Goal', '', 'Auto-regenerate the pointer.', '',
        '## Next best step', '', 'Confirm HANDOFF.md exists.', '',
        '## Done', '',
        '## Decisions made', '',
        '## What to avoid', '',
        '## Open questions raised', '',
        '## Open questions resolved', '',
        '## Key files & artifacts', '',
        '## Skills used', '',
        '## Projects', '',
      ].join('\n');
      const raw = await driver.callTool('write_session', { session_id: sessionId, body });
      const ret = JSON.parse(raw.content[0].text);
      const workstreamFolder = join(projectRoot, 'scratch', `S-${sessionId}`);
      const pointerPath = join(workstreamFolder, 'HANDOFF.md');
      ok(existsSync(pointerPath), `HANDOFF.md exists in workstream folder: ${pointerPath}`);
      ok(ret.pointer, 'JSON return includes pointer object');
      strictEqual(ret.pointer.written, true, `pointer.written === true (got: ${JSON.stringify(ret.pointer)})`);
      ok(ret.pointer.path && ret.pointer.path.endsWith('HANDOFF.md'), `pointer.path ends with HANDOFF.md (got: ${ret.pointer.path})`);
      const content = readFileSync(pointerPath, 'utf-8');
      ok(content.includes('schema_version: 3'), 'written pointer file is v3 (schema_version: 3)');
      ok(content.includes('Auto-regenerate the pointer.'), 'pointer reflects the just-written session goal');
    } finally {
      await driver.shutdown();
      try { rmSync(projectRoot, { recursive: true, force: true }); } catch {}
    }
  });

  // WS5: write_session's positive charset gate ([A-Za-z0-9._-]) rejects a slash-free
  // shell-injection payload with SESSION_ID_INVALID (the legacy negative regex alone does
  // NOT catch quotes/semicolons/whitespace — this proves the new gate is load-bearing),
  // and confirms a normal slug still succeeds through the same gate.
  await runTest('WS5: write_session rejects shell-metacharacter session_id (charset gate) — SESSION_ID_INVALID; normal slug still succeeds', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'smcp-ws5-'));
    const driver = await createMcpDriver(projectRoot);
    try {
      const body = [
        '---',
        'session_id: ws5-injection-test',
        'session_name: WS5 test',
        'goal_at_time: Verify charset gate rejects shell metacharacters',
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
      // Slash-free injection payload — no path separators (already covered by the legacy
      // negative regex), but would break out of a single-quoted shell string if it ever
      // reached one unvalidated (e.g. via pointer.recovery).
      const injectionPayload = "x'; touch pwned; #";
      let threw = false;
      try {
        await driver.callTool('write_session', { session_id: injectionPayload, body });
      } catch (err) {
        threw = true;
        ok(err.message.includes('SESSION_ID_INVALID'), `rejected with SESSION_ID_INVALID (got: ${err.message})`);
      }
      ok(threw, 'write_session rejected the shell-metacharacter session_id');
      const rejectedFolder = join(projectRoot, 'scratch', `S-${injectionPayload}`);
      ok(!existsSync(rejectedFolder), 'no workstream folder created for the rejected session_id');
      // A normal slug must still succeed — the charset gate isn't overly restrictive.
      const raw = await driver.callTool('write_session', { session_id: 'ws5-injection-test', body });
      const ret = JSON.parse(raw.content[0].text);
      ok(ret.path, 'normal slug still succeeds — path in return');
      strictEqual(ret.session_id, 'ws5-injection-test', 'normal slug echoed correctly');
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

  // ===========================================================================
  // CAT — cat-sessions tests
  // ===========================================================================

  // Helper: create scratch/S-{slug}/sessions/ inside a fixture project root
  function setupSessionsDir(projectRoot, slug) {
    const dir = join(projectRoot, 'scratch', `S-${slug}`, 'sessions');
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  // Helper: write a session file with a timestamp-prefix filename
  function makeSession(sessionsDir, isoTs, opts = {}) {
    // Convert ISO → dashed timestamp format used in filenames
    const tsName = isoTs.replace(/:/g, '-').replace(/\.(\d+)Z$/, '-$1Z');
    const shortid = opts.shortid ?? 'deadbeef';
    const filename = opts.filename ?? `${tsName}-${shortid}.md`;
    const raised = opts.raised ?? [];
    const resolved = opts.resolved ?? [];
    const decisions = opts.decisions ?? [];
    const avoid = opts.avoid ?? [];
    const padding = opts.padding ?? '';
    const goal = opts.goal ?? 'Test goal';
    const nbs = opts.nbs ?? 'Test NBS';
    const done = opts.done ?? '';
    const fmLines = [
      '---', 'session_id: test',
      `started: ${isoTs}`, `ended: ${isoTs}`,
      'session_name: ', 'goal_at_time: Test goal',
    ];
    if (opts.summary != null) fmLines.push(`summary: ${opts.summary}`);
    fmLines.push('parent_handoff_state: ', '---');
    const bodyLines = [
      '', '## Goal', '', goal, '',
      '## Next best step', '', nbs, '',
      '## Done', '', done, '',
      '## Decisions made', '', ...decisions.map(d => `- ${d}`), '',
      '## What to avoid', '', ...avoid.map(a => `- ${a}`), '',
      '## Open questions raised', '',
      ...raised.map(q => `- ${q}`), '',
      '## Open questions resolved', '',
      ...resolved.map(q => `- ${q}`), '',
      '## Key files & artifacts', '', '## Skills used', '', '## Projects', '',
      padding,
    ];
    writeFileSync(join(sessionsDir, filename), fmLines.join('\n') + '\n' + bodyLines.join('\n'), 'utf-8');
    return filename;
  }

  // Helper: write a task file into <tasksDir> from a fields object (Step 04b, D8 —
  // test-handoff.mjs must not import test helpers from test-tasks.mjs; this mirrors
  // that file's frontmatterFile() shape independently). `fields.filename` overrides
  // the default `${id}-task.md` name; every other key becomes one `key: value`
  // frontmatter line, in the order given, skipping any explicit `undefined`.
  function makeTaskFile(tasksDir, fields) {
    const filename = fields.filename ?? `${fields.id}-task.md`;
    const lines = ['---'];
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'filename' || value === undefined) continue;
      lines.push(`${key}: ${value}`);
    }
    lines.push('---', '');
    writeFileSync(join(tasksDir, filename), lines.join('\n'), 'utf-8');
    return filename;
  }

  // CAT1: Module exports both entry points
  await runTest('CAT1: cat-sessions exports dispatch and assembleSessions', async () => {
    const mod = await import('./cat-sessions.mjs');
    strictEqual(typeof mod.dispatch, 'function', 'dispatch is a function');
    strictEqual(typeof mod.assembleSessions, 'function', 'assembleSessions is a function');
  });

  // CAT2: Newest-first ordering by ts prefix
  await runTest('CAT2: assembleSessions orders sessions newest-first by ts prefix', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-order');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'aaa00001' });
      makeSession(sd, '2026-01-03T10:00:00.000Z', { shortid: 'aaa00003' });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'aaa00002' });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-order'));
      strictEqual(result.session_count, 3, 'session_count = 3');
      ok(result.sessions[0].file.includes('2026-01-03'), `first=2026-01-03, got ${result.sessions[0].file}`);
      ok(result.sessions[1].file.includes('2026-01-02'), `second=2026-01-02, got ${result.sessions[1].file}`);
      ok(result.sessions[2].file.includes('2026-01-01'), `third=2026-01-01, got ${result.sessions[2].file}`);
    } finally { fx.cleanup(); }
  });

  // CAT3: Budget cutoff — sessions beyond maxChars are summary-only
  await runTest('CAT3: cumulative trim — older sessions become summary-only after budget exceeded', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-budget');
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'newest01', padding: 'x'.repeat(500) });
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'older001' });
      // maxChars=1: newest inlined (floor), cumulative already > 1, older is summary-only
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-budget'), { maxChars: 1 });
      strictEqual(result.sessions[0].inlined, true, 'newest always inlined');
      strictEqual(result.sessions[1].inlined, false, 'older trimmed when budget exceeded');
      ok(!('body' in result.sessions[1]), 'body absent for trimmed session');
    } finally { fx.cleanup(); }
  });

  // CAT4: Always-inline-newest floor — newest body > B still inlined whole
  await runTest('CAT4: always-inline-newest floor — newest body > budget still inlined in full', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-floor');
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'newest02', padding: 'X'.repeat(50000) });
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'older002' });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-floor'), { maxChars: 1 });
      strictEqual(result.sessions[0].inlined, true, 'newest inlined even when body > budget');
      ok('body' in result.sessions[0], 'body present for newest');
      strictEqual(result.sessions[1].inlined, false, 'older trimmed');
    } finally { fx.cleanup(); }
  });

  // CAT5: --max-chars retune changes cutoff
  await runTest('CAT5: --max-chars retune changes the inlining cutoff', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-retune');
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'r2', padding: 'A'.repeat(500) });
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'r1' });
      const dir = join(fx.projectRoot, 'scratch', 'S-cat-retune');
      const small = assembleSessions(dir, { maxChars: 1 });
      strictEqual(small.sessions[1].inlined, false, 'older trimmed at maxChars=1');
      const large = assembleSessions(dir, { maxChars: 1000000 });
      strictEqual(large.sessions[1].inlined, true, 'older inlined at maxChars=1000000');
    } finally { fx.cleanup(); }
  });

  // CAT5b: Budget hard-cap — session where cumulative < maxChars but cumulative + body > maxChars is NOT inlined (B3)
  await runTest('CAT5b: budget hard-cap — session straddling the boundary is NOT inlined', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-hardcap');
      // newest: 50 chars of padding → body ~250 chars; maxChars=300
      // middle: padding 200 chars → body ~400 chars; cumulative after newest ~250 < 300, but 250+400>300 → NOT inlined
      // oldest: also padded
      makeSession(sd, '2026-01-03T10:00:00.000Z', { shortid: 'hc03', padding: 'N'.repeat(50) });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'hc02', padding: 'M'.repeat(200) });
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'hc01', padding: 'O'.repeat(200) });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-hardcap'), { maxChars: 300 });
      // newest always inlined (floor)
      strictEqual(result.sessions[0].inlined, true, 'newest always inlined (floor)');
      const cumulativeAfterNewest = result.sessions[0].body.length;
      // confirm cumulative after newest is < maxChars (300) so the hard-cap is the operative constraint
      ok(cumulativeAfterNewest < 300, `cumulative after newest (${cumulativeAfterNewest}) < 300 (pre-add check would pass)`);
      // hard-cap: NOT inlined because cumulative + body.length > maxChars
      strictEqual(result.sessions[1].inlined, false, 'middle session NOT inlined (hard-cap)');
      strictEqual(result.sessions[2].inlined, false, 'oldest session NOT inlined');
      // Verify the constraint: sum of inlined body lengths ≤ maxChars (only 1 session inlined = floor)
      const inlinedSessions = result.sessions.filter(s => s.inlined);
      const totalInlinedChars = inlinedSessions.reduce((acc, s) => acc + s.body.length, 0);
      ok(totalInlinedChars <= 300 || inlinedSessions.length === 1,
        `sum of inlined body lengths (${totalInlinedChars}) ≤ maxChars(300), or only floor session inlined`);
    } finally { fx.cleanup(); }
  });

  // CAT-B3GAP: budget skip is monotonic — no recency-window gap
  await runTest('CAT-B3GAP: budget skip is monotonic — no recency-window gap', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-b3gap');
      // Scenario: newest and oldest bodies each fit within the budget on their own;
      // middle body is oversized and triggers a skip. Without the stop-flag latch,
      // the pre-fix code would continue past the skipped middle and inline the oldest —
      // creating a non-monotonic gap (newest+oldest inlined, middle summary-only).
      // The fix latches budgetExhausted so once any k>0 session is skipped, all older are summary-only.
      //   newest:  padding=50 → body ~268 chars; cumulative = 268
      //   middle:  padding=600 → body ~818 chars; 268+818 > 700 → skip, latch
      //   oldest:  padding=50 → body ~268 chars; 268+268 = 536 ≤ 700 (pre-fix would inline!) → latch blocks it
      makeSession(sd, '2026-01-03T10:00:00.000Z', { shortid: 'gap03', padding: 'N'.repeat(50) });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'gap02', padding: 'M'.repeat(600) });
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'gap01', padding: 'O'.repeat(50) });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-b3gap'), { maxChars: 700 });
      strictEqual(result.sessions[0].inlined, true, 'newest always inlined (floor)');
      strictEqual(result.sessions[1].inlined, false, 'middle NOT inlined — would push cumulative over cap');
      strictEqual(result.sessions[2].inlined, false, 'oldest NOT inlined — budgetExhausted latched after middle skipped, no gap');
    } finally { fx.cleanup(); }
  });

  // CAT6: Idempotent byte-identical repeat
  await runTest('CAT6: cat-sessions full output is byte-identical on two consecutive calls', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-idem');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'idem0001', summary: 'Idempotent', raised: ['q1'] });
      const r1 = runCli(['cat-sessions', 'scratch/S-cat-idem/', '--format', 'full'], { cwd: fx.projectRoot });
      const r2 = runCli(['cat-sessions', 'scratch/S-cat-idem/', '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(r1.exitCode, 0, `first run exit 0 (stderr: ${r1.stderr})`);
      strictEqual(r2.exitCode, 0, `second run exit 0`);
      strictEqual(r1.stdout, r2.stdout, 'byte-identical output on repeat');
    } finally { fx.cleanup(); }
  });

  // CAT7: Raised−resolved set-difference with case/whitespace normalization
  await runTest('CAT7: raised−resolved with case+whitespace normalization', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-qs');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'qs01',
        raised: ['Question One', 'Question Two'], resolved: [] });
      // Newer session resolves Q2 with different case/whitespace → normalized match
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'qs02',
        raised: [], resolved: ['  QUESTION  TWO  '] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-qs'));
      const soq = result.still_open_questions;
      ok(soq.some(q => q.text === 'Question One'), 'Q1 still open');
      ok(!soq.some(q => q.text.toLowerCase().includes('question two')), 'Q2 resolved');
      strictEqual(soq.length, 1, 'exactly 1 still-open');
    } finally { fx.cleanup(); }
  });

  // CAT7b: Dedup by normalized text — oldest raiser linked
  await runTest('CAT7b: duplicate raised questions deduped; oldest raiser linked', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-dedup');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'dd01', raised: ['A unique question'] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'dd02', raised: ['  A  unique  question  '] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-dedup'));
      const soq = result.still_open_questions;
      strictEqual(soq.length, 1, 'deduped to 1 entry');
      ok(soq[0].source_file.includes('2026-01-01'), `oldest raiser linked: ${soq[0].source_file}`);
      strictEqual(soq[0].text, 'A unique question', 'original text from oldest session');
    } finally { fx.cleanup(); }
  });

  // F1: re-raise-after-resolve — ordering-aware carry-forward. A kernel raised, resolved, then
  // re-raised in a newer session must surface as still-open (safe-direction invariant: a
  // genuinely re-opened question is never dropped). Attribution goes to the newest raise.
  await runTest('F1: kernel raised, resolved, then re-raised — still-open, attributed to newest raise', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'f1-reraise');
      const question = 'Should the cache be warmed on boot?';
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'f1s001', raised: [question] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'f1s002', resolved: [question] });
      makeSession(sd, '2026-01-03T10:00:00.000Z', { shortid: 'f1s003', raised: [question] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-f1-reraise'));
      const soq = result.still_open_questions;
      const match = soq.find(q => q.text === question);
      ok(match, `re-raised kernel is still-open (got: ${JSON.stringify(soq)})`);
      ok(match.source_file.includes('2026-01-03'), `attributed to the newest raise (got: ${match.source_file})`);
      strictEqual(soq.filter(q => q.text === question).length, 1, 'kernel appears exactly once (dedup preserved)');
    } finally { fx.cleanup(); }
  });

  // CAT7c: Multi-line wrapped bullet resolved by single-line twin (B4)
  await runTest('CAT7c: multi-line raised question cancelled by single-line resolved entry (B4)', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-multiline');
      // Session 1 (older): raised question spans two lines
      const multilineContent = [
        '---', 'session_id: test',
        'started: 2026-01-01T10:00:00.000Z', 'ended: 2026-01-01T10:00:00.000Z',
        'session_name: ', 'goal_at_time: Test goal', 'parent_handoff_state: ',
        '---',
        '', '## Goal', '', 'Goal text', '',
        '## Next best step', '', 'NBS', '',
        '## Done', '', '## Decisions made', '', '## What to avoid', '',
        '## Open questions raised', '',
        '- Is the multi-line question',
        '  matched by its joined form?', '',
        '## Open questions resolved', '',
        '## Key files & artifacts', '', '## Skills used', '', '## Projects', '',
      ].join('\n');
      writeFileSync(join(sd, '2026-01-01T10-00-00-000Z-ml01.md'), multilineContent, 'utf-8');
      // Session 2 (newer): resolves the joined single-line form of the same question
      makeSession(sd, '2026-01-02T10:00:00.000Z', {
        shortid: 'ml02',
        resolved: ['Is the multi-line question matched by its joined form?'],
      });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-multiline'));
      strictEqual(result.still_open_questions.length, 0,
        `multi-line raised question must be cancelled by single-line resolved twin (got ${result.still_open_questions.length} still-open)`);
    } finally { fx.cleanup(); }
  });

  // CAT8: Reworded-after-resolution stays still-open (safe over-surface)
  await runTest('CAT8: reworded question not normalized-matched stays still-open (safe over-surface)', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-reword');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'rw01',
        raised: ['Is the auth middleware correct?'] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'rw02',
        resolved: ['Is the auth middleware correct in all cases?'] }); // reworded, won't match
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-reword'));
      strictEqual(result.still_open_questions.length, 1, 'reworded stays still-open');
    } finally { fx.cleanup(); }
  });

  // CAT8b: Structured resolution (bold + carried annotation + → RESOLVED: tail) MATCHES its
  // raised question via kernel matching and drops it from still-open.
  await runTest('CAT8b: structured resolution (bold + annotation + → RESOLVED:) matches kernel, drops from still-open', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-kernel-structured');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'ks01',
        raised: ['Where is the keep-vs-remove boundary for legacy fields?'] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'ks02',
        resolved: ['**Where is the keep-vs-remove boundary for legacy fields?** (carried open from prior session) → RESOLVED: fields older than 2 releases are removed.'] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-kernel-structured'));
      strictEqual(result.still_open_questions.length, 0,
        `structured resolution must match and clear the raised question (got ${result.still_open_questions.length} still-open)`);
    } finally { fx.cleanup(); }
  });

  // CAT8c: Genuinely reworded resolution does NOT match — stays open (safe-direction invariant),
  // even under kernel matching (kernel differs, not just whole-bullet).
  await runTest('CAT8c: genuinely reworded resolution does not match kernel — stays open (safe direction)', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-kernel-reword');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'kr01',
        raised: ['Was the skill-creator tested against the new schema?'] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'kr02',
        resolved: ['**Skill-creator validation** → RESOLVED: yes, it passed the new-schema conformance suite.'] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-kernel-reword'));
      strictEqual(result.still_open_questions.length, 1,
        `reworded resolution must NOT match — question stays still-open (got ${result.still_open_questions.length})`);
    } finally { fx.cleanup(); }
  });

  // CAT8d: Plain `Q? → RESOLVED: A` matches (baseline kernel case, no markdown decoration).
  await runTest('CAT8d: plain "Q? → RESOLVED: A" matches kernel, drops from still-open', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-kernel-plain');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'kp01',
        raised: ['Should we harden rewrite-pointer against concurrent writes?'] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'kp02',
        resolved: ['Should we harden rewrite-pointer against concurrent writes? → RESOLVED: yes, added an atomic write.'] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-kernel-plain'));
      strictEqual(result.still_open_questions.length, 0,
        `plain Q? → RESOLVED: A must match (got ${result.still_open_questions.length} still-open)`);
    } finally { fx.cleanup(); }
  });

  // CAT8e: No-'?' imperative restated verbatim + → RESOLVED: matches (kernel falls back to
  // the whole cut-at-delimiter text when there is no '?' in the bullet).
  await runTest('CAT8e: no-"?" imperative restated verbatim + → RESOLVED: matches kernel', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-kernel-imperative');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'ki01',
        raised: ['Decide the carry-forward CODE vs AUTHORING split'] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'ki02',
        resolved: ['Decide the carry-forward CODE vs AUTHORING split → RESOLVED: split confirmed, code owns matching.'] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-kernel-imperative'));
      strictEqual(result.still_open_questions.length, 0,
        `no-'?' imperative restated verbatim must match (got ${result.still_open_questions.length} still-open)`);
    } finally { fx.cleanup(); }
  });

  // CAT9: Empty still-open list renders explicit "none" line
  await runTest('CAT9: empty still-open list renders "- none" line in full output', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-noneq');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'nq01',
        raised: ['A resolved question'], resolved: ['A resolved question'] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-noneq'));
      strictEqual(result.still_open_questions.length, 0, 'no still-open questions');
      const r = runCli(['cat-sessions', 'scratch/S-cat-noneq/', '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0);
      ok(r.stdout.includes('- none'), 'full output includes "- none" for empty list');
    } finally { fx.cleanup(); }
  });

  // CAT10a: full format shape
  await runTest('CAT10a: --format full has open-questions block + inlined body content', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-full');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'full01',
        raised: ['Test question'], goal: 'Full format goal content' });
      const r = runCli(['cat-sessions', 'scratch/S-cat-full/', '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
      ok(r.stdout.includes('## Open questions (still open)'), 'has open-questions block');
      ok(/^- \[q-[0-9a-f]{6}\] Test question → \[sessions\/.+\]\(sessions\/.+\) \(age: \d+\)$/m.test(r.stdout),
        `still-open row carries an ID and age annotation (got: ${r.stdout.slice(0, 300)})`);
      ok(r.stdout.includes('Full format goal content'), 'inlined body present');
    } finally { fx.cleanup(); }
  });

  // CAT10b: summary format shape
  await runTest('CAT10b: --format summary has sessions table without full bodies', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-summ');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'sum01',
        summary: 'Summary line for table', goal: 'Full body goal — should not appear in summary' });
      const r = runCli(['cat-sessions', 'scratch/S-cat-summ/', '--format', 'summary'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
      ok(r.stdout.includes('## Sessions'), 'has Sessions heading');
      ok(r.stdout.includes('| timestamp | summary | file |'), 'table header present');
      ok(r.stdout.includes('Summary line for table'), 'summary in table');
    } finally { fx.cleanup(); }
  });

  // CAT10c: json format shape — all contract keys present
  await runTest('CAT10c: --format json has all contract keys', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-json');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'json01', summary: 'JSON summary' });
      const r = runCli(['cat-sessions', 'scratch/S-cat-json/', '--format', 'json'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
      let p;
      try { p = JSON.parse(r.stdout); } catch (e) { ok(false, `stdout not valid JSON: ${e.message}`); }
      ok(p.session_dir, 'session_dir present');
      strictEqual(typeof p.budget_chars, 'number', 'budget_chars is number');
      strictEqual(typeof p.session_count, 'number', 'session_count is number');
      ok(Array.isArray(p.still_open_questions), 'still_open_questions is array');
      ok(p.newest && p.newest.file, 'newest.file present');
      ok(p.newest.goal !== undefined, 'newest.goal present');
      ok(p.newest.next_best_step !== undefined, 'newest.next_best_step present');
      ok(p.newest.summary !== undefined, 'newest.summary present');
      ok(Array.isArray(p.sessions), 'sessions is array');
      ok(Array.isArray(p.cumulative_done), 'cumulative_done is array');
      ok(Array.isArray(p.cumulative_decisions), 'cumulative_decisions is array');
      ok(Array.isArray(p.cumulative_avoid), 'cumulative_avoid is array');
    } finally { fx.cleanup(); }
  });

  // CAT11: json.body present only for inlined sessions
  await runTest('CAT11: json.body present only for inlined sessions, absent for trimmed', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-body');
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'body02', padding: 'x'.repeat(200) });
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'body01', padding: 'y'.repeat(200) });
      const r = runCli(['cat-sessions', 'scratch/S-cat-body/', '--max-chars', '1', '--format', 'json'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
      const p = JSON.parse(r.stdout);
      const inlined = p.sessions.filter(s => s.inlined);
      const trimmed = p.sessions.filter(s => !s.inlined);
      for (const s of inlined) ok('body' in s, `body present for inlined ${s.file}`);
      for (const s of trimmed) ok(!('body' in s), `body absent for trimmed ${s.file}`);
      ok(inlined.length >= 1, 'at least 1 inlined');
      ok(trimmed.length >= 1, 'at least 1 trimmed');
    } finally { fx.cleanup(); }
  });

  // CAT12: Read-side derived summary fallback (NBS + first done line)
  await runTest('CAT12: read-side derived summary from NBS + Done when summary: absent', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-drv');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'drv01',
        nbs: 'Run the migration', done: '- Setup complete' });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-drv'));
      const s = result.sessions[0].summary;
      ok(s.includes('Run the migration') || s.includes('Setup complete'),
        `derived summary contains NBS or Done: "${s}"`);
      ok(!s.startsWith('⚠'), 'not the placeholder form');
    } finally { fx.cleanup(); }
  });

  // CAT13: Placeholder summary fallback
  await runTest('CAT13: placeholder summary when NBS and Done are both empty', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-ph');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'ph01', nbs: '', done: '' });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-ph'));
      ok(result.sessions[0].summary.startsWith('⚠ no summary'), `placeholder: "${result.sessions[0].summary}"`);
    } finally { fx.cleanup(); }
  });

  // CAT14: Missing positional → exit 1
  await runTest('CAT14: missing <session-dir> → exit 1 with error to stderr', async () => {
    const fx = createFixture();
    try {
      const r = runCli(['cat-sessions'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.includes('cat-sessions requires <session-dir>'), `stderr: "${r.stderr}"`);
    } finally { fx.cleanup(); }
  });

  // CAT15: Unknown flag → exit 1
  await runTest('CAT15: unknown flag → exit 1', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-unk');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'unk01' });
      const r = runCli(['cat-sessions', 'scratch/S-cat-unk/', '--unknown-xyz'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.includes('unknown option'), `stderr: "${r.stderr}"`);
    } finally { fx.cleanup(); }
  });

  // CAT16: --format at end (no value) → exit 1, "missing value for --format"
  await runTest('CAT16: --format as last token (no value) → exit 1 with missing-value message', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-fmtv');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'fv01' });
      const r = runCli(['cat-sessions', 'scratch/S-cat-fmtv/', '--format'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.includes('missing value for --format'), `stderr: "${r.stderr}"`);
    } finally { fx.cleanup(); }
  });

  // CAT17: --format <invalid> → exit 1
  await runTest('CAT17: --format with invalid value → exit 1', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-badf');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'bf01' });
      const r = runCli(['cat-sessions', 'scratch/S-cat-badf/', '--format', 'xml'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.length > 0, 'stderr non-empty');
    } finally { fx.cleanup(); }
  });

  // CAT18: --max-chars at end (no value) → exit 1
  await runTest('CAT18: --max-chars as last token (no value) → exit 1 with missing-value message', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-mcv');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'mc01' });
      const r = runCli(['cat-sessions', 'scratch/S-cat-mcv/', '--max-chars'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.includes('missing value for --max-chars'), `stderr: "${r.stderr}"`);
    } finally { fx.cleanup(); }
  });

  // CAT19: --max-chars non-integer → exit 1
  await runTest('CAT19: --max-chars non-integer value → exit 1', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-mci');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'mi01' });
      const r = runCli(['cat-sessions', 'scratch/S-cat-mci/', '--max-chars', '3.5'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.length > 0, 'stderr non-empty');
    } finally { fx.cleanup(); }
  });

  // CAT20: --max-chars 0 (< 1) → exit 1
  await runTest('CAT20: --max-chars 0 (< 1) → exit 1', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-mc0');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'z001' });
      const r = runCli(['cat-sessions', 'scratch/S-cat-mc0/', '--max-chars', '0'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.length > 0, 'stderr non-empty');
    } finally { fx.cleanup(); }
  });

  // CAT21: Out-of-sandbox path → exit 1
  await runTest('CAT21: session-dir outside scratch/ → exit 1', async () => {
    const fx = createFixture();
    try {
      const r = runCli(['cat-sessions', '.'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.length > 0, 'stderr non-empty');
    } finally { fx.cleanup(); }
  });

  // CAT22: sessions/ directory missing → exit 1
  await runTest('CAT22: sessions/ directory missing in session-dir → exit 1', async () => {
    const fx = createFixture();
    try {
      mkdirSync(join(fx.projectRoot, 'scratch', 'S-cat-nosess'), { recursive: true });
      const r = runCli(['cat-sessions', 'scratch/S-cat-nosess/'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.length > 0, 'stderr non-empty');
    } finally { fx.cleanup(); }
  });

  // CAT23: sessions/ present but no *.md files → exit 1
  await runTest('CAT23: sessions/ exists but no *.md files → exit 1', async () => {
    const fx = createFixture();
    try {
      mkdirSync(join(fx.projectRoot, 'scratch', 'S-cat-empty', 'sessions'), { recursive: true });
      const r = runCli(['cat-sessions', 'scratch/S-cat-empty/'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.length > 0, 'stderr non-empty');
    } finally { fx.cleanup(); }
  });

  // CAT24: Files without ts prefix sort deterministically (mtime/lex fallback)
  await runTest('CAT24: files without ts prefix fall back to mtime/lex sort — no crash', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-mtime');
      const body = [
        '---', 'session_id: t', 'started: ', 'ended: ', 'session_name: ',
        'goal_at_time: ', 'parent_handoff_state: ', '---', '',
        '## Goal', '', '## Next best step', '', '## Done', '',
        '## Decisions made', '', '## What to avoid', '',
        '## Open questions raised', '', '## Open questions resolved', '',
        '## Key files & artifacts', '', '## Skills used', '', '## Projects', '',
      ].join('\n');
      writeFileSync(join(sd, 'bbb-session.md'), body, 'utf-8');
      writeFileSync(join(sd, 'aaa-session.md'), body, 'utf-8');
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-mtime'));
      strictEqual(result.session_count, 2, '2 sessions found');
      strictEqual(typeof result.sessions[0].file, 'string', 'first session has file field');
      // Output is deterministic (no crash)
      ok(result.sessions[0].file !== result.sessions[1].file, 'sessions are distinct');
    } finally { fx.cleanup(); }
  });

  // CAT25: Lexicographic tiebreaker for equal timestamp prefixes
  await runTest('CAT25: equal ts prefix → filename lex ASC as deterministic tiebreaker', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-lex');
      const ts = '2026-01-01T10-00-00-000Z';
      const body = [
        '---', 'session_id: t', 'started: 2026-01-01T10:00:00.000Z',
        'ended: 2026-01-01T10:00:00.000Z', 'session_name: ', 'goal_at_time: ',
        'parent_handoff_state: ', '---', '',
        '## Goal', '', '## Next best step', '', '## Done', '',
        '## Decisions made', '', '## What to avoid', '',
        '## Open questions raised', '', '## Open questions resolved', '',
        '## Key files & artifacts', '', '## Skills used', '', '## Projects', '',
      ].join('\n');
      writeFileSync(join(sd, `${ts}-bbb.md`), body, 'utf-8');
      writeFileSync(join(sd, `${ts}-aaa.md`), body, 'utf-8');
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-lex'));
      // Both have identical timestamps; lex ASC tiebreaker → aaa before bbb
      ok(result.sessions[0].file.includes('-aaa.md'), `first is aaa (lex tiebreaker): ${result.sessions[0].file}`);
      ok(result.sessions[1].file.includes('-bbb.md'), `second is bbb: ${result.sessions[1].file}`);
    } finally { fx.cleanup(); }
  });

  // CAT26: Smoke test on a synthetic multi-session workstream fixture
  await runTest('CAT26: smoke test on synthetic workstream fixture — exit 0, open-questions present', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-smoke');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'smoke01',
        raised: ['What is the migration cutover date?'] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'smoke02',
        raised: ['Should retries be bounded?'] });
      const r = runCli(['cat-sessions', 'scratch/S-cat-smoke/', '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
      ok(r.stdout.length > 0, 'stdout non-empty');
      ok(r.stdout.includes('## Open questions (still open)'), 'open-questions section present');
    } finally { fx.cleanup(); }
  });

  // CAT27: JSON output from a synthetic fixture passes contract
  await runTest('CAT27: synthetic fixture json has newest, still_open_questions, sessions, budget_chars', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-smoke-json');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'smoke01',
        raised: ['What is the migration cutover date?'] });
      const r = runCli(['cat-sessions', 'scratch/S-cat-smoke-json/', '--format', 'json'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
      const p = JSON.parse(r.stdout);
      ok(p.newest, 'newest present');
      ok(Array.isArray(p.still_open_questions), 'still_open_questions is array');
      ok(Array.isArray(p.sessions), 'sessions is array');
      ok(typeof p.budget_chars === 'number', 'budget_chars is number');
      ok(p.session_count >= 1, `session_count >= 1: ${p.session_count}`);
    } finally { fx.cleanup(); }
  });

  // CAT28: placeholder bullets are filtered out of raised and resolved sections
  await runTest('CAT28: placeholder bullets are filtered out of raised and resolved sections', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-placeholder');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'ph01',
        raised: ['A real question?', '(none new — nothing surfaced)'] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'ph02',
        raised: ['none'], resolved: ['N/A'] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-placeholder'));
      const soq = result.still_open_questions;
      strictEqual(soq.length, 1, `exactly 1 still-open (got ${JSON.stringify(soq)})`);
      strictEqual(soq[0].text, 'A real question?', 'the real question is the only still-open entry');
    } finally { fx.cleanup(); }
  });

  // CAT29: a question containing "none" mid-sentence is not filtered (negative test for
  // risk 4 in the README risk assessment — the placeholder regex is prefix-anchored only).
  await runTest('CAT29: a question containing "none" mid-sentence is not filtered', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-not-placeholder');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'np01',
        raised: ['Why do none of the three loaders fire?'] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-not-placeholder'));
      const soq = result.still_open_questions;
      strictEqual(soq.length, 1, `question survives as still-open (got ${JSON.stringify(soq)})`);
      strictEqual(soq[0].text, 'Why do none of the three loaders fire?', 'text preserved verbatim');
    } finally { fx.cleanup(); }
  });

  // CAT30: questionId is deterministic and shaped q-<6 hex>
  await runTest('CAT30: questionId is deterministic and shaped q-<6 hex>', async () => {
    const kernel = 'should the cache be warmed on boot?';
    const id1 = questionId(kernel);
    const id2 = questionId(kernel);
    ok(/^q-[0-9a-f]{6}$/.test(id1), `id matches /^q-[0-9a-f]{6}$/ (got ${id1})`);
    strictEqual(id1, id2, 'two calls on the same kernel return the identical string');
    strictEqual(questionId(''), '', "questionId('') === ''");
  });

  // CAT31: questionKernel strips a leading [q-xxxxxx] token
  await runTest('CAT31: questionKernel strips a leading [q-xxxxxx] token', async () => {
    const withId = questionKernel('[q-3f2a1b] Should the cache be warmed on boot? → [sessions/x.md](sessions/x.md)');
    const withoutId = questionKernel('Should the cache be warmed on boot?');
    strictEqual(withId, 'should the cache be warmed on boot?', `ID-prefixed kernel matches (got ${withId})`);
    strictEqual(withId, withoutId, 'ID-prefixed and un-prefixed forms produce the identical kernel');
  });

  // CAT32: questionKernel leaves an ID-like token mid-string intact
  await runTest('CAT32: questionKernel leaves an ID-like token mid-string intact', async () => {
    const result = questionKernel('Why does [q-3f2a1b] map to two kernels?');
    strictEqual(result, 'why does [q-3f2a1b] map to two kernels?', `mid-string ID token is not stripped (got ${result})`);
  });

  // CAT33: a re-pasted rendered row does not create a second still-open entry (D6 idempotence)
  await runTest('CAT33: a re-pasted rendered row does not create a second still-open entry', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-id-repaste');
      const question = 'Should the cache be warmed on boot?';
      const id = questionId(questionKernel(question));
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'idrp0001', raised: [question] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'idrp0002',
        raised: [`[${id}] ${question} → [sessions/idrp0001.md](sessions/idrp0001.md)`] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-id-repaste'));
      strictEqual(result.still_open_questions.length, 1,
        `re-pasted rendered row must not create a second still-open entry (got ${JSON.stringify(result.still_open_questions)})`);
    } finally { fx.cleanup(); }
  });

  // CAT34: STILL OPEN annotation does not cancel the raise (decision table row 3; D1)
  await runTest('CAT34: STILL OPEN annotation does not cancel the raise', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-still-open');
      const question = 'Should the migration retry on failure?';
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'so0001', raised: [question] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'so0002',
        resolved: [`${question} → STILL OPEN — not taken up this session`] });
      makeSession(sd, '2026-01-03T10:00:00.000Z', { shortid: 'so0003', goal: 'Unrelated work' });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-still-open'));
      const soq = result.still_open_questions;
      strictEqual(soq.length, 1, `question stays open (got ${JSON.stringify(soq)})`);
      strictEqual(soq[0].text, question, `original raised text preserved (got ${soq[0].text})`);
      ok(soq[0].source_file.includes('so0001'), `attributed to session 1's file (got ${soq[0].source_file})`);
    } finally { fx.cleanup(); }
  });

  // CAT35: UNRESOLVED and NOT RESOLVED annotations also veto, case-insensitively (row 3)
  await runTest('CAT35: UNRESOLVED and NOT RESOLVED annotations also veto, case-insensitively', async () => {
    const fx1 = createFixture();
    try {
      const sd1 = setupSessionsDir(fx1.projectRoot, 'cat-unresolved');
      const q1 = 'Does the retry loop respect backoff?';
      makeSession(sd1, '2026-01-01T10:00:00.000Z', { shortid: 'un0001', raised: [q1] });
      makeSession(sd1, '2026-01-02T10:00:00.000Z', { shortid: 'un0002',
        resolved: [`${q1} → unresolved`] });
      const r1 = assembleSessions(join(fx1.projectRoot, 'scratch', 'S-cat-unresolved'));
      strictEqual(r1.still_open_questions.length, 1,
        `UNRESOLVED (lowercase) vetoes (got ${JSON.stringify(r1.still_open_questions)})`);
    } finally { fx1.cleanup(); }

    const fx2 = createFixture();
    try {
      const sd2 = setupSessionsDir(fx2.projectRoot, 'cat-notresolved');
      const q2 = 'Is the shared cache invalidated correctly?';
      makeSession(sd2, '2026-01-01T10:00:00.000Z', { shortid: 'nr0001', raised: [q2] });
      makeSession(sd2, '2026-01-02T10:00:00.000Z', { shortid: 'nr0002',
        resolved: [`${q2} → NOT RESOLVED — deferred`] });
      const r2 = assembleSessions(join(fx2.projectRoot, 'scratch', 'S-cat-notresolved'));
      strictEqual(r2.still_open_questions.length, 1,
        `NOT RESOLVED (uppercase) vetoes (got ${JSON.stringify(r2.still_open_questions)})`);
    } finally { fx2.cleanup(); }
  });

  // CAT36: resolution by ID with no kernel restatement cancels the raise (row 6)
  await runTest('CAT36: resolution by ID with no kernel restatement cancels the raise', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-id-resolve');
      const question = 'Should the queue drain before shutdown?';
      const id = questionId(questionKernel(question));
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'idr0001', raised: [question] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'idr0002',
        resolved: [`${id} → RESOLVED: because the drain hook already flushes in-flight jobs`] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-id-resolve'));
      strictEqual(result.still_open_questions.length, 0,
        `ID-form resolution with no kernel restatement must cancel the raise (got ${JSON.stringify(result.still_open_questions)})`);
    } finally { fx.cleanup(); }
  });

  // CAT37: ID wins over a conflicting kernel match (row 5; at-most-one-kernel invariant)
  await runTest('CAT37: ID wins over a conflicting kernel match', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-id-vs-kernel');
      const q1 = 'Is the export path timezone-safe?';
      const q2 = 'Does the import job dedupe on retry?';
      const id2 = questionId(questionKernel(q2));
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'ivk0001', raised: [q1, q2] });
      // Single resolved-section bullet: carries q2's ID but restates q1's text — ID must win.
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'ivk0002',
        resolved: [`${q1} [${id2}] → RESOLVED: dedup confirmed via idempotency key`] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-id-vs-kernel'));
      const soq = result.still_open_questions;
      strictEqual(soq.length, 1, `exactly one still-open (got ${JSON.stringify(soq)})`);
      strictEqual(soq[0].text, q1,
        `q1 stays open — untouched even though its text was restated (got ${soq[0].text})`);
    } finally { fx.cleanup(); }
  });

  // CAT38: an ambiguous ID falls back to kernel matching (row 7; D5)
  await runTest('CAT38: an ambiguous ID falls back to kernel matching', async () => {
    const fx = createFixture();
    try {
      // Find a real 24-bit questionId collision between two distinct kernels — deterministic
      // and reproducible because questionId is pure. Birthday bound expects ~5,000 iterations.
      let kernelA, kernelB, sharedId;
      const seen = new Map(); // id → kernel
      for (let i = 1; i < 200000; i++) {
        const kernel = `q${i}?`;
        const id = questionId(kernel);
        const priorKernel = seen.get(id);
        if (priorKernel && priorKernel !== kernel) {
          kernelA = priorKernel;
          kernelB = kernel;
          sharedId = id;
          break;
        }
        seen.set(id, kernel);
      }
      ok(sharedId, `found a real questionId collision within 200,000 iterations (kernelA=${kernelA}, kernelB=${kernelB})`);

      const sd = setupSessionsDir(fx.projectRoot, 'cat-id-collision');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'coll0001', raised: [kernelA, kernelB] });
      // Resolve by the shared (ambiguous) ID plus a verbatim restatement of kernelB — the ID
      // must be ignored (I = false) and the kernel match does the work (row 7).
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'coll0002',
        resolved: [`${kernelB} [${sharedId}] → RESOLVED: restated verbatim, ID ambiguous`] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-id-collision'));
      const soq = result.still_open_questions;
      strictEqual(soq.length, 1, `only the non-restated kernel stays open (got ${JSON.stringify(soq)})`);
      strictEqual(soq[0].text, kernelA, `kernelA (not restated) is the still-open one (got ${soq[0].text})`);
    } finally { fx.cleanup(); }
  });

  // CAT39: an orphan resolution still cancels nothing (row 8; regression guard)
  await runTest('CAT39: an orphan resolution still cancels nothing', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-orphan');
      const question = 'Should the retry backoff be exponential?';
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'orp0001', raised: [question] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'orp0002',
        resolved: ['Some entirely different sentence → RESOLVED: yes'] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-orphan'));
      strictEqual(result.still_open_questions.length, 1,
        `orphan resolution cancels nothing — question stays open (got ${JSON.stringify(result.still_open_questions)})`);
    } finally { fx.cleanup(); }
  });

  // CAT40: age_sessions is session_count minus the attributing raise order
  await runTest('CAT40: age_sessions is session_count minus the attributing raise order', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-age');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'age0001', raised: ['Question raised in session one?'] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'age0002', raised: ['Question raised in session two?'] });
      makeSession(sd, '2026-01-03T10:00:00.000Z', { shortid: 'age0003' });
      makeSession(sd, '2026-01-04T10:00:00.000Z', { shortid: 'age0004', raised: ['Question raised in session four?'] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-age'));
      strictEqual(result.session_count, 4, `session_count is 4 (got ${result.session_count})`);
      const byText = Object.fromEntries(result.still_open_questions.map(q => [q.text, q.age_sessions]));
      strictEqual(byText['Question raised in session one?'], 3, `session-1 raise ages to 3 (got ${JSON.stringify(byText)})`);
      strictEqual(byText['Question raised in session two?'], 2, `session-2 raise ages to 2 (got ${JSON.stringify(byText)})`);
      strictEqual(byText['Question raised in session four?'], 0, `session-4 raise ages to 0 (got ${JSON.stringify(byText)})`);
    } finally { fx.cleanup(); }
  });

  // CAT41: a re-raised question ages from its newest raise (reuses the F1 fixture shape)
  await runTest('CAT41: a re-raised question ages from its newest raise', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-age-reraise');
      const question = 'Should the retry queue be persisted across restarts?';
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'agr0001', raised: [question] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'agr0002', resolved: [question] });
      makeSession(sd, '2026-01-03T10:00:00.000Z', { shortid: 'agr0003', raised: [question] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-age-reraise'));
      const match = result.still_open_questions.find(q => q.text === question);
      ok(match, `re-raised kernel is still-open (got: ${JSON.stringify(result.still_open_questions)})`);
      strictEqual(match.age_sessions, 0,
        `ages from the newest (re-)raise, not the original raise — expected 0, not 2 (got ${match.age_sessions})`);
    } finally { fx.cleanup(); }
  });

  // CAT42: still_open_questions is sorted oldest-first with a total key
  await runTest('CAT42: still_open_questions is sorted oldest-first with a total key', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-sort');
      const qAlpha = 'Question alone in session one?';
      const qTwoA = 'Question A raised in session two?';
      const qTwoB = 'Question B raised in session two?';
      const qThree = 'Question raised in session three?';
      const qFive = 'Question raised in session five?';
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'srt0001', raised: [qAlpha] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'srt0002', raised: [qTwoA, qTwoB] });
      makeSession(sd, '2026-01-03T10:00:00.000Z', { shortid: 'srt0003', raised: [qThree] });
      makeSession(sd, '2026-01-04T10:00:00.000Z', { shortid: 'srt0004' });
      makeSession(sd, '2026-01-05T10:00:00.000Z', { shortid: 'srt0005', raised: [qFive] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-sort'));
      const soq = result.still_open_questions;
      strictEqual(soq.length, 5, `all 5 raised questions are still open (got ${JSON.stringify(soq)})`);

      // Non-increasing ages across the array — oldest-first.
      for (let i = 1; i < soq.length; i++) {
        ok(soq[i - 1].age_sessions >= soq[i].age_sessions,
          `ages non-increasing at index ${i} (got ${JSON.stringify(soq.map(q => q.age_sessions))})`);
      }
      strictEqual(soq[0].text, qAlpha, `oldest raise (session one) sorts first (got ${soq[0].text})`);

      // The two same-session (tied-age) entries break the tie by id ASC.
      const idTwoA = questionId(questionKernel(qTwoA));
      const idTwoB = questionId(questionKernel(qTwoB));
      const [expectedFirst, expectedSecond] = idTwoA < idTwoB ? [qTwoA, qTwoB] : [qTwoB, qTwoA];
      const tiedPair = soq.filter(q => q.text === qTwoA || q.text === qTwoB);
      strictEqual(tiedPair.length, 2, 'both session-two questions are present');
      strictEqual(tiedPair[0].age_sessions, tiedPair[1].age_sessions, 'both session-two questions share the same age');
      strictEqual(tiedPair[0].text, expectedFirst, `tied entries break by id ASC (got ${JSON.stringify(tiedPair)})`);
      strictEqual(tiedPair[1].text, expectedSecond, `tied entries break by id ASC (got ${JSON.stringify(tiedPair)})`);

      // Public shape is exactly {id, text, source_file, age_sessions} — the kernel must not leak.
      for (const q of soq) {
        strictEqual(Object.keys(q).sort().join(','), 'age_sessions,id,source_file,text',
          `entry carries exactly the public shape (got keys: ${Object.keys(q).join(',')})`);
      }
    } finally { fx.cleanup(); }
  });

  // CAT43: cumulative_decisions accumulates across the whole log, oldest occurrence wins
  await runTest('CAT43: cumulative_decisions accumulates across the whole log, oldest occurrence wins', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-cum-accum');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'cum0001', decisions: ['Decision A'] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'cum0002', decisions: ['Decision A', 'Decision B'] });
      makeSession(sd, '2026-01-03T10:00:00.000Z', { shortid: 'cum0003', decisions: ['Decision B', 'Decision C'] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-cum-accum'));
      const cd = result.cumulative_decisions;
      strictEqual(cd.length, 3, `three distinct decisions accumulated (got ${JSON.stringify(cd)})`);
      strictEqual(cd[0].text, 'Decision C', `newest-first: C first (got ${JSON.stringify(cd)})`);
      strictEqual(cd[1].text, 'Decision B', `newest-first: B second (got ${JSON.stringify(cd)})`);
      strictEqual(cd[2].text, 'Decision A', `newest-first: A last (got ${JSON.stringify(cd)})`);
      ok(cd[2].source_file.includes('2026-01-01'), `A attributed to session 1 (got ${cd[2].source_file})`);
    } finally { fx.cleanup(); }
  });

  // CAT44: cumulative arrays dedup by normalized 80-char prefix
  await runTest('CAT44: cumulative arrays dedup by normalized 80-char prefix', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-cum-dedup');
      const base = 'Use Node stdlib for the parser because adding a dependency would break the zero-dep constraint';
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'cud0001', decisions: [base] });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'cud0002', decisions: [base + ', per D2'] });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-cum-dedup'));
      strictEqual(result.cumulative_decisions.length, 1,
        `dedup collapses shared-80-char-prefix bullets (got ${JSON.stringify(result.cumulative_decisions)})`);
      strictEqual(result.cumulative_decisions[0].text, base, 'retained text is the first (shorter) form');
    } finally { fx.cleanup(); }
  });

  // CAT45: cumulative_done and cumulative_avoid populate independently
  await runTest('CAT45: cumulative_done and cumulative_avoid populate independently', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-cum-indep');
      makeSession(sd, '2026-01-01T10:00:00.000Z', {
        shortid: 'ind0001',
        done: '- Did one thing\n- Did another thing',
        decisions: ['Decided X'],
        avoid: ['Avoid Y', 'Avoid Z'],
      });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-cum-indep'));
      strictEqual(result.cumulative_done.length, 2, `cumulative_done has 2 entries (got ${JSON.stringify(result.cumulative_done)})`);
      strictEqual(result.cumulative_decisions.length, 1, `cumulative_decisions has 1 entry (got ${JSON.stringify(result.cumulative_decisions)})`);
      strictEqual(result.cumulative_avoid.length, 2, `cumulative_avoid has 2 entries (got ${JSON.stringify(result.cumulative_avoid)})`);
      ok(!result.cumulative_done.some(e => e.text.startsWith('Decided') || e.text.startsWith('Avoid')),
        'no cross-contamination in cumulative_done');
      ok(!result.cumulative_decisions.some(e => e.text.startsWith('Did') || e.text.startsWith('Avoid')),
        'no cross-contamination in cumulative_decisions');
      ok(!result.cumulative_avoid.some(e => e.text.startsWith('Did') || e.text.startsWith('Decided')),
        'no cross-contamination in cumulative_avoid');
    } finally { fx.cleanup(); }
  });

  // CAT46: placeholder bullets never reach the cumulative arrays
  await runTest('CAT46: placeholder bullets never reach the cumulative arrays', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-cum-placeholder');
      makeSession(sd, '2026-01-01T10:00:00.000Z', {
        shortid: 'plc0001',
        decisions: ['none'],
        avoid: ['N/A'],
      });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-cum-placeholder'));
      strictEqual(result.cumulative_decisions.length, 0,
        `placeholder "none" filtered from cumulative_decisions (got ${JSON.stringify(result.cumulative_decisions)})`);
      strictEqual(result.cumulative_avoid.length, 0,
        `placeholder "N/A" filtered from cumulative_avoid (got ${JSON.stringify(result.cumulative_avoid)})`);
    } finally { fx.cleanup(); }
  });

  // CAT47: cumulative block stops before exceeding the cap and emits an elision line
  await runTest('CAT47: cumulative block stops before exceeding the cap and emits an elision line', async () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      text: `Decision number ${i}`,
      source_file: 'sessions/2026-01-01T10-00-00-000Z-cap0001.md',
    }));
    const rowChars = (e) => `- ${e.text} → ${relLink(e.source_file)}`.length + 1;
    const first4 = entries.slice(0, 4).reduce((sum, e) => sum + rowChars(e), 0);
    const first5 = first4 + rowChars(entries[4]);
    const cap = first4; // exactly enough for 4 rows; the 5th would push the running total over
    ok(first5 > cap, 'sanity: the 5th row would exceed the cap (fixture precondition)');

    const block = cumulativeBlock('Decisions (cumulative)', entries, cap);
    ok(block.startsWith('## Decisions (cumulative)'), `heading present (got: ${block.slice(0, 40)})`);
    const rows = block.split('\n').filter(l => l.startsWith('- Decision number'));
    strictEqual(rows.length, 4, `exactly 4 rows rendered (got ${rows.length}: ${JSON.stringify(rows)})`);
    ok(block.includes('_… 6 more (see sessions/)_'),
      `elision line reads "6 more" — 10 entries minus 4 rendered (got block: ${block})`);

    const renderedRowChars = rows.reduce((sum, r) => sum + r.length + 1, 0);
    ok(renderedRowChars <= cap,
      `rendered rows' accumulated length (${renderedRowChars}) stays within the cap (${cap})`);
    const elisionLine = '_… 6 more (see sessions/)_';
    ok(renderedRowChars + elisionLine.length <= cap + elisionLine.length,
      `rows + elision line character count is bounded by cap + elision line length`);
  });

  // CAT48: no elision line when everything fits
  await runTest('CAT48: no elision line when everything fits', async () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      text: `Decision number ${i}`,
      source_file: 'sessions/2026-01-01T10-00-00-000Z-cap0001.md',
    }));
    const rowChars = (e) => `- ${e.text} → ${relLink(e.source_file)}`.length + 1;
    const total = entries.reduce((sum, e) => sum + rowChars(e), 0);
    const cap = total + 1000; // generous — every row fits with room to spare

    const block = cumulativeBlock('Decisions (cumulative)', entries, cap);
    const rows = block.split('\n').filter(l => l.startsWith('- Decision number'));
    strictEqual(rows.length, 10, `all 10 rows rendered (got ${rows.length}: ${JSON.stringify(rows)})`);
    ok(!block.includes('more (see sessions/)'), `no elision line present (got block: ${block})`);
  });

  // CAT49: an empty cumulative array renders "- none"
  await runTest('CAT49: an empty cumulative array renders "- none"', async () => {
    const block = cumulativeBlock('Decisions (cumulative)', [], 6000);
    ok(block.includes('## Decisions (cumulative)'), `heading present (got: ${block})`);
    ok(block.includes('- none'), `empty array renders "- none" (got block: ${block})`);
  });

  // CAT50: --max-cumulative-chars validation — three invocations mirroring CAT18/CAT19/CAT20
  await runTest('CAT50: --max-cumulative-chars validation (missing value / non-integer / < 1) → exit 1', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-mcc');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'mcc0001' });

      const rMissing = runCli(['cat-sessions', 'scratch/S-cat-mcc/', '--max-cumulative-chars'], { cwd: fx.projectRoot });
      strictEqual(rMissing.exitCode, 1, `missing value → exit 1 (stderr: ${rMissing.stderr})`);
      ok(rMissing.stderr.includes('missing value for --max-cumulative-chars'), `stderr: "${rMissing.stderr}"`);
      strictEqual(rMissing.stdout, '', 'stdout empty on missing-value error');

      const rNonInt = runCli(['cat-sessions', 'scratch/S-cat-mcc/', '--max-cumulative-chars', 'abc'], { cwd: fx.projectRoot });
      strictEqual(rNonInt.exitCode, 1, `non-integer → exit 1 (stderr: ${rNonInt.stderr})`);
      ok(rNonInt.stderr.length > 0, 'stderr non-empty for non-integer');
      strictEqual(rNonInt.stdout, '', 'stdout empty on non-integer error');

      const rZero = runCli(['cat-sessions', 'scratch/S-cat-mcc/', '--max-cumulative-chars', '0'], { cwd: fx.projectRoot });
      strictEqual(rZero.exitCode, 1, `0 (< 1) → exit 1 (stderr: ${rZero.stderr})`);
      ok(rZero.stderr.length > 0, 'stderr non-empty for < 1');
      strictEqual(rZero.stdout, '', 'stdout empty on < 1 error');
    } finally { fx.cleanup(); }
  });

  // CAT51: --format summary is byte-identical before and after this step's blocks exist
  await runTest("CAT51: --format summary is byte-identical before and after this step's blocks exist", async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-cum-summary');
      makeSession(sd, '2026-01-01T10:00:00.000Z', {
        shortid: 'sum0001',
        decisions: ['Decision A', 'Decision B'],
      });
      const r = runCli(['cat-sessions', 'scratch/S-cat-cum-summary/', '--format', 'summary'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
      ok(!r.stdout.includes('(cumulative)'),
        `summary output contains no "(cumulative)" heading despite populated decisions (got: ${r.stdout})`);
    } finally { fx.cleanup(); }
  });

  // CAT52: quoted started/ended frontmatter values are stripped of stray quotes in the
  // rendered session header (issue: handoff-tooling-minor-polish-batch, item 4) — YAML
  // permits single- or double-quoting a plain scalar, and cat-sessions' local frontmatter
  // parser must not leak the quote characters into rendered output.
  await runTest('CAT52: quoted started/ended timestamps render without stray quotes', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-quotes');
      const isoTs = '2026-01-01T10:00:00.000Z';
      const quotedFm = [
        '---', 'session_id: test',
        `started: '${isoTs}'`, `ended: "${isoTs}"`,
        'session_name: ', 'goal_at_time: Quoted timestamp test',
        'parent_handoff_state: ', '---',
      ].join('\n');
      const body = [
        '', '## Goal', '', 'Quoted timestamp test', '',
        '## Next best step', '', 'Verify quote stripping', '',
        '## Done', '', '## Decisions made', '', '## What to avoid', '',
        '## Open questions raised', '', '## Open questions resolved', '',
        '## Key files & artifacts', '', '## Skills used', '', '## Projects', '',
      ].join('\n');
      writeFileSync(join(sd, `${isoTs.replace(/:/g, '-')}-quote001.md`), quotedFm + '\n' + body, 'utf-8');

      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-quotes'));
      strictEqual(result.sessions[0].ts, isoTs, `assembled ts is the bare ISO string, no quotes (got: ${JSON.stringify(result.sessions[0].ts)})`);

      const r = runCli(['cat-sessions', 'scratch/S-cat-quotes/', '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
      ok(r.stdout.includes(`— ${isoTs}`), `session header contains the unquoted timestamp (got: ${r.stdout})`);
      ok(!r.stdout.includes(`'${isoTs}'`) && !r.stdout.includes(`"${isoTs}"`), 'session header does not contain a quoted timestamp');
    } finally { fx.cleanup(); }
  });

  // ===========================================================================
  // CAT53-65 — `--with-tasks` (Step 04a's flag) coverage. CAT53-55 are unit
  // tests via the direct-import precedent above; CAT56+ are integration tests
  // through runCli, mirroring the CAT16-20 --max-cumulative-chars pattern
  // (decisions.md D2, D8).
  // ===========================================================================

  // CAT53: assembleSessions() must stay unaware of tasks — the scan lives in
  // dispatch(), not in the assembly core, so D2's byte-identity guarantee is
  // structural (assembleSessions never executes tasks-scan code at all).
  await runTest('CAT53: assembleSessions() is unaware of tasks — no tasks/task_warnings keys even with a populated tasks/ dir', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-notasks-aware');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'nt01' });
      const dir = join(fx.projectRoot, 'scratch', 'S-cat-notasks-aware');
      const tasksDir = join(dir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      makeTaskFile(tasksDir, { id: 't-000001', title: 'A populated task', status: 'open',
        created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' });

      const result = assembleSessions(dir);
      ok(!('tasks' in result), `no tasks key on assembleSessions() result (got keys: ${Object.keys(result)})`);
      ok(!('task_warnings' in result), `no task_warnings key on assembleSessions() result (got keys: ${Object.keys(result)})`);
    } finally { fx.cleanup(); }
  });

  // CAT54: renderer composition — one renderer, no re-wrapping in cat-sessions.mjs.
  // renderTasksBlock(scanTasks(dir)) called in-process must produce exactly the
  // substring the CLI's --with-tasks --format full output contains.
  await runTest('CAT54: renderer composition — renderTasksBlock(scanTasks(dir)) is exactly the substring in CLI --with-tasks --format full output', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-render-compose');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'rc01' });
      const dir = join(fx.projectRoot, 'scratch', 'S-cat-render-compose');
      const tasksDir = join(dir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      makeTaskFile(tasksDir, { id: 't-000001', title: 'Compose test', status: 'open',
        created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' });

      const r = runCli(['cat-sessions', 'scratch/S-cat-render-compose/', '--with-tasks', '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);

      // Captured after the CLI call (same ordering test-tasks.mjs's TC17 uses) to
      // minimize the already-negligible UTC-day-boundary timing gap between the two
      // scanTasks() calls — created/updated are fixed, same-day in both.
      const expected = renderTasksBlock(scanTasks(dir));
      ok(r.stdout.includes(expected), `CLI output contains the exact in-process rendered block (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(r.stdout)})`);
    } finally { fx.cleanup(); }
  });

  // CAT55: block boundary — renderTasksBlock ends with exactly one '\n', the same
  // trailing shape cumulativeBlock() produces, so formatFull's `'\n' + tasksBlock`
  // push yields the same blank-line separation the three cumulativeBlock pushes do.
  // Derived from an actual cumulativeBlock() call, not a hardcoded literal.
  await runTest('CAT55: rendered tasks block boundary matches cumulativeBlock\'s trailing-newline shape', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-block-boundary');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'bb01' });
      const dir = join(fx.projectRoot, 'scratch', 'S-cat-block-boundary');
      // No tasks/ directory at all — exercises renderTasksBlock's '- none' path.
      const tasksBlock = renderTasksBlock(scanTasks(dir));
      const cumulativeReference = cumulativeBlock('X', [], 6000);

      const tasksTrailing = (tasksBlock.match(/\n+$/) || [''])[0].length;
      const cumulativeTrailing = (cumulativeReference.match(/\n+$/) || [''])[0].length;
      strictEqual(tasksTrailing, cumulativeTrailing,
        `tasksBlock's trailing-newline count matches cumulativeBlock's shape (cumulative: ${cumulativeTrailing}, tasks: ${tasksTrailing})`);
      strictEqual(tasksTrailing, 1, `both end with exactly one newline (got: ${tasksTrailing})`);
    } finally { fx.cleanup(); }
  });

  // CAT56: byte-identity, full — the flag-absent path must render byte-identically
  // whether or not a tasks/ directory exists alongside sessions/ (D2). Proven
  // in-process/hermetically here by comparing the same fixture before and after a
  // tasks/ directory is populated; separately re-verified against the real
  // /tmp/cat-baseline/full.txt capture per this step's acceptance criteria.
  await runTest('CAT56: byte-identity, full — same fixture with vs. without a populated tasks/ dir, flag absent', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-byteid-full');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'bf01', decisions: ['A decision'], avoid: ['Do not do X'] });
      const relDir = 'scratch/S-cat-byteid-full/';
      const dir = join(fx.projectRoot, 'scratch', 'S-cat-byteid-full');

      const before = runCli(['cat-sessions', relDir, '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(before.exitCode, 0, `pre-tasks capture exit 0 (stderr: ${before.stderr})`);

      const tasksDir = join(dir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      makeTaskFile(tasksDir, { id: 't-000001', title: 'Should never leak', status: 'open',
        created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' });

      const after = runCli(['cat-sessions', relDir, '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(after.exitCode, 0, `post-tasks capture exit 0 (stderr: ${after.stderr})`);

      strictEqual(after.stdout, before.stdout,
        'full-format output (flag absent) is byte-identical whether or not tasks/ exists — D2 byte-identity guarantee');
    } finally { fx.cleanup(); }
  });

  // CAT57: byte-identity, summary and json — four captures pinning the summary
  // short-circuit and the json flag-absent path against a pre-tasks-dir baseline.
  await runTest('CAT57: byte-identity, summary and json — summary ±flag and json −flag all match the pre-tasks-dir bytes', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-byteid-sumjson');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'sj01', decisions: ['A decision'] });
      const relDir = 'scratch/S-cat-byteid-sumjson/';
      const dir = join(fx.projectRoot, 'scratch', 'S-cat-byteid-sumjson');

      const summaryBaseline = runCli(['cat-sessions', relDir, '--format', 'summary'], { cwd: fx.projectRoot });
      const jsonBaseline = runCli(['cat-sessions', relDir, '--format', 'json'], { cwd: fx.projectRoot });
      strictEqual(summaryBaseline.exitCode, 0, `summary baseline exit 0 (stderr: ${summaryBaseline.stderr})`);
      strictEqual(jsonBaseline.exitCode, 0, `json baseline exit 0 (stderr: ${jsonBaseline.stderr})`);

      const tasksDir = join(dir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      makeTaskFile(tasksDir, { id: 't-000001', title: 'Open one', status: 'open',
        created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' });
      makeTaskFile(tasksDir, { id: 't-000002', title: 'Blocked one', status: 'blocked', blocked_on: 'main rebase',
        created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' });

      // Capture 1: summary, no flag, tasks/ present.
      const summaryNoFlag = runCli(['cat-sessions', relDir, '--format', 'summary'], { cwd: fx.projectRoot });
      strictEqual(summaryNoFlag.exitCode, 0, `summary no-flag exit 0 (stderr: ${summaryNoFlag.stderr})`);
      strictEqual(summaryNoFlag.stdout, summaryBaseline.stdout, 'capture 1: summary (no flag, tasks present) byte-equal to the pre-tasks baseline');

      // Capture 2: summary, with flag, tasks/ present — the summary short-circuit.
      const summaryWithFlag = runCli(['cat-sessions', relDir, '--format', 'summary', '--with-tasks'], { cwd: fx.projectRoot });
      strictEqual(summaryWithFlag.exitCode, 0, `summary with-flag exit 0 (stderr: ${summaryWithFlag.stderr})`);
      strictEqual(summaryWithFlag.stdout, summaryBaseline.stdout, 'capture 2: summary (--with-tasks, tasks present) byte-equal to the pre-tasks baseline');

      // Capture 3: the two summary captures are also byte-equal to each other.
      strictEqual(summaryWithFlag.stdout, summaryNoFlag.stdout, 'capture 3: summary ±flag byte-equal to each other');

      // Capture 4: json, no flag, tasks/ present.
      const jsonNoFlag = runCli(['cat-sessions', relDir, '--format', 'json'], { cwd: fx.projectRoot });
      strictEqual(jsonNoFlag.exitCode, 0, `json no-flag exit 0 (stderr: ${jsonNoFlag.stderr})`);
      strictEqual(jsonNoFlag.stdout, jsonBaseline.stdout, 'capture 4: json (no flag, tasks present) byte-equal to the pre-tasks baseline');
    } finally { fx.cleanup(); }
  });

  // CAT58: --with-tasks flag parsing through runCli, mirroring the CAT16-20
  // --max-cumulative-chars pattern: position-independent, consumes no value, a
  // typo is rejected as an unknown flag, and `--` stops flag parsing entirely.
  await runTest('CAT58: --with-tasks flag parsing — position-independent, no value consumed, typo rejected, -- stops flag parsing', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-flag-parse');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'fp01' });
      const relDir = 'scratch/S-cat-flag-parse/';

      // Before other flags.
      const before = runCli(['cat-sessions', '--with-tasks', relDir, '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(before.exitCode, 0, `--with-tasks before other flags exits 0 (stderr: ${before.stderr})`);
      ok(before.stdout.includes('## Tasks'), '## Tasks block present when flag precedes others');

      // After other flags.
      const after = runCli(['cat-sessions', relDir, '--format', 'full', '--with-tasks'], { cwd: fx.projectRoot });
      strictEqual(after.exitCode, 0, `--with-tasks after other flags exits 0 (stderr: ${after.stderr})`);
      ok(after.stdout.includes('## Tasks'), '## Tasks block present when flag follows others');

      // Between the positional and --format.
      const between = runCli(['cat-sessions', relDir, '--with-tasks', '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(between.exitCode, 0, `--with-tasks between the positional and --format exits 0 (stderr: ${between.stderr})`);
      ok(between.stdout.includes('## Tasks'), '## Tasks block present when flag sits between the positional and --format');

      // Consumes no value — --with-tasks --format json still yields valid json with a
      // tasks key, proving --format's value was "json", not "--with-tasks".
      const noValue = runCli(['cat-sessions', relDir, '--with-tasks', '--format', 'json'], { cwd: fx.projectRoot });
      strictEqual(noValue.exitCode, 0, `--with-tasks --format json exits 0, no value consumed (stderr: ${noValue.stderr})`);
      let parsed;
      try { parsed = JSON.parse(noValue.stdout); } catch (e) { throw new Error(`stdout not valid JSON: ${e.message} (got: ${noValue.stdout})`); }
      ok('tasks' in parsed, 'parsed json has a tasks key, proving --format consumed "json" as its value');

      // Typo --with-task → unknown flag, exit 1.
      const typo = runCli(['cat-sessions', relDir, '--with-task'], { cwd: fx.projectRoot });
      strictEqual(typo.exitCode, 1, `--with-task typo exits 1 (stderr: ${typo.stderr})`);
      ok(typo.stderr.includes('unknown option'), `stderr mentions unknown option (got: ${typo.stderr})`);

      // -- stops flag parsing entirely — bare `cat-sessions -- --with-tasks` treats
      // '--with-tasks' as the <session-dir> positional (not as the flag): it resolves
      // outside the sandbox and errors OUT_OF_SANDBOX_PATH, proving the flag was never enabled.
      const stopFlags = runCli(['cat-sessions', '--', '--with-tasks'], { cwd: fx.projectRoot });
      strictEqual(stopFlags.exitCode, 1, `stop-flag-parsing case exits 1 (stderr: ${stopFlags.stderr})`);
      ok(stopFlags.stderr.includes('OUT_OF_SANDBOX_PATH'), `--with-tasks after -- is treated as the positional session-dir, not the flag (stderr: ${stopFlags.stderr})`);
    } finally { fx.cleanup(); }
  });

  // CAT59: block rendering and placement — ## Tasks appears after ## Done
  // (cumulative) and before the first ### session-body header. Index positions,
  // not a regex that could match out of order.
  await runTest('CAT59: --with-tasks --format full places ## Tasks after ## Done (cumulative) and before the first ### session header', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-block-placement');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'bp01' });
      const dir = join(fx.projectRoot, 'scratch', 'S-cat-block-placement');
      const tasksDir = join(dir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      const base = { created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' };
      makeTaskFile(tasksDir, { id: 't-000001', title: 'Open one', status: 'open', ...base });
      makeTaskFile(tasksDir, { id: 't-000002', title: 'Open two', status: 'open', ...base });
      makeTaskFile(tasksDir, { id: 't-000003', title: 'Open three', status: 'open', ...base });
      makeTaskFile(tasksDir, { id: 't-000004', title: 'Blocked one', status: 'blocked', blocked_on: 'review', ...base });
      makeTaskFile(tasksDir, { id: 't-000005', title: 'Done one', status: 'done', ...base });
      makeTaskFile(tasksDir, { id: 't-000006', title: 'Dropped one', status: 'dropped', ...base });

      const r = runCli(['cat-sessions', 'scratch/S-cat-block-placement/', '--with-tasks', '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);

      const doneIdx = r.stdout.indexOf('## Done (cumulative)');
      const tasksIdx = r.stdout.indexOf('## Tasks');
      const firstSessionHeaderIdx = r.stdout.indexOf('\n### ');
      ok(doneIdx !== -1, `## Done (cumulative) heading present (got: ${r.stdout})`);
      ok(tasksIdx !== -1, `## Tasks heading present (got: ${r.stdout})`);
      ok(firstSessionHeaderIdx !== -1, `at least one ### session header present (got: ${r.stdout})`);
      ok(doneIdx < tasksIdx, `## Tasks (index ${tasksIdx}) appears after ## Done (cumulative) (index ${doneIdx})`);
      ok(tasksIdx < firstSessionHeaderIdx, `## Tasks (index ${tasksIdx}) appears before the first ### session header (index ${firstSessionHeaderIdx})`);
    } finally { fx.cleanup(); }
  });

  // CAT60: ordering and age — blocked rows precede open rows; within each group,
  // larger age_days first; equal ages break by id ASC. Literal row strings.
  await runTest('CAT60: ordering (blocked before open, larger age first, id ASC tiebreak) and literal row/age strings', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-order-age');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'oa01' });
      const dir = join(fx.projectRoot, 'scratch', 'S-cat-order-age');
      const tasksDir = join(dir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });

      const now = new Date();
      const daysAgoIso = (n) => new Date(now.getTime() - n * 86400000).toISOString();

      makeTaskFile(tasksDir, { id: 't-000001', title: 'Blocked with reason', status: 'blocked',
        blocked_on: 'main rebase', created: daysAgoIso(10), updated: daysAgoIso(5) });
      makeTaskFile(tasksDir, { id: 't-000002', title: 'Blocked no reason', status: 'blocked',
        created: daysAgoIso(10), updated: daysAgoIso(0) });
      makeTaskFile(tasksDir, { id: 't-000004', title: 'Open tie low', status: 'open',
        created: daysAgoIso(10), updated: daysAgoIso(2) });
      makeTaskFile(tasksDir, { id: 't-000005', title: 'Open tie high', status: 'open',
        created: daysAgoIso(10), updated: daysAgoIso(2) });

      const r = runCli(['cat-sessions', 'scratch/S-cat-order-age/', '--with-tasks', '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);

      const rowLines = r.stdout.split('\n').filter(l => l.startsWith('- [t-'));
      deepStrictEqual(rowLines, [
        '- [t-000001] Blocked with reason (blocked on: main rebase, updated 5d ago)',
        '- [t-000002] Blocked no reason (blocked, updated today)',
        '- [t-000004] Open tie low (open, updated 2d ago)',
        '- [t-000005] Open tie high (open, updated 2d ago)',
      ], `row order and literal strings match (got: ${JSON.stringify(rowLines)})`);
    } finally { fx.cleanup(); }
  });

  // CAT61: json shape — tasks is complete/unfiltered, per-field shape, blocked_on
  // only on the blocked record, file is tasks/<basename> with forward slashes.
  await runTest('CAT61: --with-tasks --format json shape — tasks complete/unfiltered, per-field shape, blocked_on only on blocked, file is tasks/<basename>', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-json-shape');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'js01' });
      const dir = join(fx.projectRoot, 'scratch', 'S-cat-json-shape');
      const tasksDir = join(dir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      const base = { created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' };
      makeTaskFile(tasksDir, { id: 't-000001', title: 'Open one', status: 'open', ...base });
      makeTaskFile(tasksDir, { id: 't-000002', title: 'Blocked one', status: 'blocked', blocked_on: 'CI flake', ...base });
      makeTaskFile(tasksDir, { id: 't-000003', title: 'Done one', status: 'done', ...base });
      makeTaskFile(tasksDir, { id: 't-000004', title: 'Dropped one', status: 'dropped', ...base });
      const fileCount = 4;

      const r = runCli(['cat-sessions', 'scratch/S-cat-json-shape/', '--with-tasks', '--format', 'json'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
      const parsed = JSON.parse(r.stdout);
      ok('tasks' in parsed, 'tasks key present');
      ok('task_warnings' in parsed, 'task_warnings key present');
      strictEqual(parsed.tasks.length, fileCount, `tasks is unfiltered — count equals fixture file count (got: ${parsed.tasks.length})`);

      const byId = Object.fromEntries(parsed.tasks.map(t => [t.id, t]));
      ok('t-000003' in byId && 't-000004' in byId, 'closed tasks (done/dropped) present in the tasks array');

      for (const t of parsed.tasks) {
        for (const key of ['id', 'title', 'status', 'created', 'updated', 'age_days', 'file']) {
          ok(key in t, `task ${t.id} has key ${key} (got: ${JSON.stringify(t)})`);
        }
      }

      ok('blocked_on' in byId['t-000002'], 'blocked record carries blocked_on');
      for (const id of ['t-000001', 't-000003', 't-000004']) {
        ok(!('blocked_on' in byId[id]), `non-blocked record ${id} carries no blocked_on key`);
      }

      for (const t of parsed.tasks) {
        ok(t.file.startsWith('tasks/'), `file is tasks/<basename> (got: ${t.file})`);
        ok(!t.file.includes('\\'), `file uses forward slashes (got: ${t.file})`);
      }
    } finally { fx.cleanup(); }
  });

  // CAT62: summary exclusion — no ## Tasks heading, no t-<hex6> task-id token,
  // byte-equal to plain --format summary.
  await runTest('CAT62: --with-tasks --format summary excludes ## Tasks and any t-<hex6> token, byte-equal to plain --format summary', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-summary-exclude');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'se01' });
      const dir = join(fx.projectRoot, 'scratch', 'S-cat-summary-exclude');
      const tasksDir = join(dir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      makeTaskFile(tasksDir, { id: 't-000001', title: 'Open one', status: 'open',
        created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' });

      const plain = runCli(['cat-sessions', 'scratch/S-cat-summary-exclude/', '--format', 'summary'], { cwd: fx.projectRoot });
      const withFlag = runCli(['cat-sessions', 'scratch/S-cat-summary-exclude/', '--format', 'summary', '--with-tasks'], { cwd: fx.projectRoot });

      strictEqual(plain.exitCode, 0, `plain summary exit 0 (stderr: ${plain.stderr})`);
      strictEqual(withFlag.exitCode, 0, `--with-tasks summary exit 0 (stderr: ${withFlag.stderr})`);
      ok(!withFlag.stdout.includes('## Tasks'), `no ## Tasks heading in summary output (got: ${withFlag.stdout})`);
      // Task-ID-shaped token check, not a naive 't-' substring — the
      // grep-t-dash-false-positive wiki gotcha: "cat-sessions" itself contains
      // the bare substring 't-', so a naive check would false-positive on it.
      ok(!/\bt-[0-9a-f]{6}\b/.test(withFlag.stdout), `no t-<hex6> task-id token in summary output (got: ${withFlag.stdout})`);
      strictEqual(withFlag.stdout, plain.stdout, '--with-tasks summary byte-equal to plain summary');
    } finally { fx.cleanup(); }
  });

  // CAT63: empty and missing — both a missing tasks/ dir and an empty tasks/ dir
  // render "## Tasks" followed by a blank line and "- none".
  await runTest('CAT63: --with-tasks renders "## Tasks" + blank line + "- none" for both a missing and an empty tasks/ directory', async () => {
    const fx = createFixture();
    try {
      const sdMissing = setupSessionsDir(fx.projectRoot, 'cat-tasks-missing');
      makeSession(sdMissing, '2026-01-01T10:00:00.000Z', { shortid: 'tm01' });
      const rMissing = runCli(['cat-sessions', 'scratch/S-cat-tasks-missing/', '--with-tasks', '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(rMissing.exitCode, 0, `exit 0, no tasks/ dir at all (stderr: ${rMissing.stderr})`);
      ok(rMissing.stdout.includes('## Tasks\n\n- none'), `no tasks/ dir renders "## Tasks" + blank line + "- none" (got: ${rMissing.stdout})`);

      const sdEmpty = setupSessionsDir(fx.projectRoot, 'cat-tasks-empty');
      makeSession(sdEmpty, '2026-01-01T10:00:00.000Z', { shortid: 'te01' });
      mkdirSync(join(fx.projectRoot, 'scratch', 'S-cat-tasks-empty', 'tasks'), { recursive: true });
      const rEmpty = runCli(['cat-sessions', 'scratch/S-cat-tasks-empty/', '--with-tasks', '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(rEmpty.exitCode, 0, `exit 0, empty tasks/ dir (stderr: ${rEmpty.stderr})`);
      ok(rEmpty.stdout.includes('## Tasks\n\n- none'), `empty tasks/ dir renders "## Tasks" + blank line + "- none" (got: ${rEmpty.stdout})`);
    } finally { fx.cleanup(); }
  });

  // CAT64: malformed file — a task file missing status: produces a WARN: line
  // inside the block, is absent from the rows, and leaves the exit code at 0
  // (D11's cat-sessions clause; protects rewrite-pointer/pickup's exit-code reliance).
  await runTest('CAT64: malformed task file (missing status) produces a WARN: line, is absent from rows, exit code stays 0', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-malformed');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'mf01' });
      const dir = join(fx.projectRoot, 'scratch', 'S-cat-malformed');
      const tasksDir = join(dir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      // Malformed: missing status: — written directly (makeTaskFile always includes it).
      writeFileSync(join(tasksDir, 't-0000ff-broken.md'), [
        '---', 'id: t-0000ff', 'title: Broken task',
        'created: 2026-01-01T00:00:00.000Z', 'updated: 2026-01-01T00:00:00.000Z', '---', '',
      ].join('\n'), 'utf-8');
      makeTaskFile(tasksDir, { id: 't-000001', title: 'Fine task', status: 'open',
        created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' });

      const r = runCli(['cat-sessions', 'scratch/S-cat-malformed/', '--with-tasks', '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `malformed task file does not change the exit code (stderr: ${r.stderr})`);
      ok(r.stdout.includes('WARN: t-0000ff-broken.md: missing required key: status'),
        `WARN: line for the malformed file present inside the block (got: ${r.stdout})`);
      ok(!r.stdout.includes('[t-0000ff]'), `malformed task is absent from the rendered rows (got: ${r.stdout})`);
    } finally { fx.cleanup(); }
  });

  // CAT65: large backlog renders whole — 60 open + 15 blocked = 75 rows, uncapped
  // (D14). Exact row count, ordering across the whole set, complete last row (no
  // truncation at any buffer boundary), exit code still 0.
  await runTest('CAT65: 60 open + 15 blocked tasks render all 75 rows uncapped, no truncation, exit 0', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-large-backlog');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'lb01' });
      const dir = join(fx.projectRoot, 'scratch', 'S-cat-large-backlog');
      const tasksDir = join(dir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      const base = { created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' };

      for (let i = 0; i < 15; i++) {
        const id = `t-b${String(i).padStart(5, '0')}`;
        makeTaskFile(tasksDir, { id, title: `Blocked task ${i}`, status: 'blocked', blocked_on: 'dependency', ...base });
      }
      for (let i = 0; i < 60; i++) {
        const id = `t-a${String(i).padStart(5, '0')}`;
        makeTaskFile(tasksDir, { id, title: `Open task ${i}`, status: 'open', ...base });
      }

      const r = runCli(['cat-sessions', 'scratch/S-cat-large-backlog/', '--with-tasks', '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 with a 75-task backlog (stderr: ${r.stderr})`);

      const rowLines = r.stdout.split('\n').filter(l => l.startsWith('- [t-'));
      strictEqual(rowLines.length, 75, `exactly 75 rows rendered, uncapped (got: ${rowLines.length})`);

      // Ordering holds across the whole set: all 15 blocked rows precede all 60 open rows.
      const statuses = rowLines.map(l => (l.includes('blocked on:') || l.includes('(blocked,')) ? 'blocked' : 'open');
      const firstOpenIdx = statuses.indexOf('open');
      strictEqual(firstOpenIdx, 15, `all 15 blocked rows precede all 60 open rows (first open at index ${firstOpenIdx})`);
      ok(statuses.slice(0, 15).every(s => s === 'blocked'), 'first 15 rows are all blocked');
      ok(statuses.slice(15).every(s => s === 'open'), 'remaining 60 rows are all open');

      // Last row present and complete — no truncation at any buffer boundary.
      const expectedAge = renderAge(taskAgeDays(base.updated, new Date()));
      const lastRow = rowLines[rowLines.length - 1];
      strictEqual(lastRow, `- [t-a00059] Open task 59 (open, ${expectedAge})`,
        `last row present and complete, no truncation at any buffer boundary (got: ${JSON.stringify(lastRow)})`);
    } finally { fx.cleanup(); }
  });

  // Helper: raw session file body matching makeSession's shape, but with the given raw
  // (pre-formatted, no auto-prepended `- `) lines dropped verbatim into the raised/resolved
  // sections. Used by CAT66a/CAT66b to author bare-paragraph entries, which makeSession cannot
  // produce (it always prepends `- ` to every raised/resolved item).
  function writeRawSession(sessionsDir, isoTs, shortid, { rawRaised = [], rawResolved = [], done = '' } = {}) {
    const tsName = isoTs.replace(/:/g, '-').replace(/\.(\d+)Z$/, '-$1Z');
    const filename = `${tsName}-${shortid}.md`;
    const content = [
      '---', 'session_id: test',
      `started: ${isoTs}`, `ended: ${isoTs}`,
      'session_name: ', 'goal_at_time: Test goal', 'parent_handoff_state: ',
      '---',
      '', '## Goal', '', 'Goal text', '',
      '## Next best step', '', 'NBS', '',
      '## Done', '', done, '',
      '## Decisions made', '', '',
      '## What to avoid', '', '',
      '## Open questions raised', '',
      ...rawRaised, '',
      '## Open questions resolved', '',
      ...rawResolved, '',
      '## Key files & artifacts', '', '## Skills used', '', '## Projects', '',
    ].join('\n');
    writeFileSync(join(sessionsDir, filename), content, 'utf-8');
    return filename;
  }

  // CAT66a: a bare-paragraph resolved entry (no leading `- `) cancels a bulleted raise, by ID.
  // Regression guard for the q-cbfa2c leak (t-370d42): before the fix, extractBullets silently
  // dropped a non-blank line seen while no bullet was open, so a bare `q-<id> → RESOLVED: …`
  // line under `## Open questions resolved` never reached the resolve pass.
  await runTest('CAT66a: bare-line resolved entry (no dash) cancels a bulleted raise by ID', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-bare-resolve');
      const question = 'Should we do X?';
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'br0001', raised: [question] });
      const id = questionId(questionKernel(question));
      writeRawSession(sd, '2026-01-02T10:00:00.000Z', 'br0002', {
        rawResolved: [`${id} → RESOLVED: yes`],
      });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-bare-resolve'));
      strictEqual(result.still_open_questions.length, 0,
        `bare-line resolve by ID cancels the bulleted raise (got ${JSON.stringify(result.still_open_questions)})`);
    } finally { fx.cleanup(); }
  });

  // CAT66b: a bare-paragraph raised entry gets an ID and surfaces as still-open; a bare-line
  // placeholder ("none") is still filtered; a bare paragraph under ## Done (a cumulative
  // section, out of scope for the bare-entry fix) is still NOT collected into cumulative_done —
  // the scoping guarantee that only the two open-questions sections accept bare entries.
  await runTest('CAT66b: bare-line raised entry gets an ID; placeholder and Done-section scoping hold', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-bare-raise');
      const question = 'Should we do Y?';
      writeRawSession(sd, '2026-01-01T10:00:00.000Z', 'br0003', {
        rawRaised: [question, '', 'none'],
        done: 'A bare paragraph without a dash',
      });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-bare-raise'));
      const soq = result.still_open_questions;
      strictEqual(soq.length, 1, `exactly 1 still-open from the bare-line raise (got ${JSON.stringify(soq)})`);
      strictEqual(soq[0].text, question, 'bare-line raised text preserved verbatim');
      ok(/^q-[0-9a-f]{6}$/.test(soq[0].id), `still-open entry has a valid q-<hex6> id (got ${soq[0].id})`);
      ok(!soq.some(q => q.text === 'none'), 'bare-line placeholder "none" did not create a still-open entry');
      strictEqual(result.cumulative_done.length, 0,
        `bare paragraph under ## Done is not collected (scoping guarantee; got ${JSON.stringify(result.cumulative_done)})`);
    } finally { fx.cleanup(); }
  });

  // CAT66c: two consecutive bare-line resolved entries with no blank-line separator between
  // them each resolve their own kernel independently — regression guard for the merge bug found
  // in quality review of CAT66a/CAT66b: without a dash to mark entry boundaries, a naive
  // "non-blank line continues the open entry" rule swallowed the second bare line into the
  // first, so only the first ID ever resolved and the second silently stayed open forever.
  await runTest('CAT66c: two consecutive bare-line resolved entries (no blank line) both resolve independently', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'cat-bare-consecutive');
      const q1 = 'Should we do X?';
      const q2 = 'Should we do Z?';
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'br0004', raised: [q1, q2] });
      const id1 = questionId(questionKernel(q1));
      const id2 = questionId(questionKernel(q2));
      writeRawSession(sd, '2026-01-02T10:00:00.000Z', 'br0005', {
        // No blank line between these two — the exact shape that previously merged.
        rawResolved: [`${id1} → RESOLVED: yes`, `${id2} → RESOLVED: no`],
      });
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-cat-bare-consecutive'));
      strictEqual(result.still_open_questions.length, 0,
        `both bare-line resolves cancel independently, no leftover open question (got ${JSON.stringify(result.still_open_questions)})`);
    } finally { fx.cleanup(); }
  });

  // ===========================================================================
  // RWP — rewrite-pointer tests
  // ===========================================================================

  // RWP1: Module exports dispatch function
  await runTest('RWP1: rewrite-pointer exports dispatch function', async () => {
    const mod = await import('./rewrite-pointer.mjs');
    strictEqual(typeof mod.dispatch, 'function', 'dispatch is a function');
  });

  // RWP2: Smoke write creates HANDOFF.md with schema_version: 3
  await runTest('RWP2: smoke write creates HANDOFF.md with schema_version: 3', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'rwp-smoke');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'rw001', goal: 'Ship the feature' });
      const r = runCli(['rewrite-pointer', 'scratch/S-rwp-smoke/'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
      const pointerPath = join(fx.projectRoot, 'scratch', 'S-rwp-smoke', 'HANDOFF.md');
      ok(existsSync(pointerPath), 'HANDOFF.md created');
      const content = readFileSync(pointerPath, 'utf-8');
      ok(content.includes('schema_version: 3'), 'schema_version: 3 in frontmatter');
    } finally { fx.cleanup(); }
  });

  // RWP3: All 5 v3 sections present in written pointer
  await runTest('RWP3: all 5 v3 sections present in pointer', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'rwp-5sec');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'rs001' });
      const r = runCli(['rewrite-pointer', 'scratch/S-rwp-5sec/'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
      const content = readFileSync(join(fx.projectRoot, 'scratch', 'S-rwp-5sec', 'HANDOFF.md'), 'utf-8');
      for (const heading of [
        '## Open questions (still open)',
        '## Goal',
        '## Next best step',
        '## Latest summary',
        '## Sessions',
      ]) {
        ok(content.includes(heading), `section present: ${heading}`);
      }
    } finally { fx.cleanup(); }
  });

  // RWP4: No .HANDOFF-*.tmp left on success
  await runTest('RWP4: no .HANDOFF-*.tmp left on success', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'rwp-notmp');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'nt001' });
      const r = runCli(['rewrite-pointer', 'scratch/S-rwp-notmp/'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
      const sessionDirPath = join(fx.projectRoot, 'scratch', 'S-rwp-notmp');
      const tmps = readdirSync(sessionDirPath).filter(f => /^\.HANDOFF-\d+-[0-9a-f]+\.tmp$/.test(f));
      strictEqual(tmps.length, 0, `no .HANDOFF-*.tmp files remain (found: ${tmps.join(', ')})`);
    } finally { fx.cleanup(); }
  });

  // RWP5: Missing positional → exit 1, usage error on stderr
  await runTest('RWP5: missing <session-dir> → exit 1 with usage error on stderr', async () => {
    const fx = createFixture();
    try {
      const r = runCli(['rewrite-pointer'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.includes('rewrite-pointer requires <session-dir>'), `stderr: "${r.stderr}"`);
    } finally { fx.cleanup(); }
  });

  // RWP6: --help → usage text to stdout + exit 0
  await runTest('RWP6: --help → usage text to stdout + exit 0', async () => {
    const fx = createFixture();
    try {
      const r = runCli(['rewrite-pointer', '--help'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, 'exit 0');
      ok(r.stdout.includes('rewrite-pointer'), `stdout contains "rewrite-pointer": "${r.stdout.slice(0, 200)}"`);
    } finally { fx.cleanup(); }
  });

  // RWP7: Unknown flag → exit 1, usage error on stderr
  await runTest('RWP7: unknown flag → exit 1 with usage error on stderr', async () => {
    const fx = createFixture();
    try {
      const r = runCli(['rewrite-pointer', '--bogus'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.includes('unknown option'), `stderr mentions "unknown option": "${r.stderr}"`);
    } finally { fx.cleanup(); }
  });

  // RWP8: Status line on stderr without --quiet (uses spawnSync to capture stderr on success)
  await runTest('RWP8: status line on stderr without --quiet', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'rwp-status');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'st001' });
      const cliPath = join(__dirname, 'scratch-memory.mjs');
      const res = spawnSync('node', [cliPath, 'rewrite-pointer', 'scratch/S-rwp-status/'], {
        encoding: 'utf-8',
        cwd: fx.projectRoot,
      });
      strictEqual(res.status, 0, `exit 0 (stderr: ${res.stderr})`);
      ok(res.stderr.includes('sessions processed'), `stderr has status line: "${res.stderr}"`);
      ok(res.stderr.includes('pointer written:'), `stderr has path: "${res.stderr}"`);
      strictEqual(res.stdout, '', 'stdout is empty');
    } finally { fx.cleanup(); }
  });

  // RWP9: --quiet suppresses status line on stderr (uses spawnSync to capture stderr on success)
  await runTest('RWP9: --quiet suppresses success status line on stderr', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'rwp-quiet');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'q001' });
      const cliPath = join(__dirname, 'scratch-memory.mjs');
      const res = spawnSync('node', [cliPath, 'rewrite-pointer', 'scratch/S-rwp-quiet/', '--quiet'], {
        encoding: 'utf-8',
        cwd: fx.projectRoot,
      });
      strictEqual(res.status, 0, `exit 0 (stderr: ${res.stderr})`);
      strictEqual(res.stderr, '', `stderr empty with --quiet (got: "${res.stderr}")`);
      strictEqual(res.stdout, '', 'stdout empty');
    } finally { fx.cleanup(); }
  });

  // RWP10: Goal section populated from newest session body
  await runTest('RWP10: ## Goal populated from newest session (not an older one)', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'rwp-goal');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'g001', goal: 'Older goal content' });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'g002', goal: 'Newest goal content' });
      runCli(['rewrite-pointer', 'scratch/S-rwp-goal/'], { cwd: fx.projectRoot });
      const content = readFileSync(join(fx.projectRoot, 'scratch', 'S-rwp-goal', 'HANDOFF.md'), 'utf-8');
      ok(content.includes('Newest goal content'), 'newest goal in pointer');
    } finally { fx.cleanup(); }
  });

  // RWP11: Open questions section populated when still-open questions exist
  await runTest('RWP11: open questions populated when questions raised and not resolved', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'rwp-oq');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'oq01',
        raised: ['Is the API stable?'], resolved: [] });
      runCli(['rewrite-pointer', 'scratch/S-rwp-oq/'], { cwd: fx.projectRoot });
      const content = readFileSync(join(fx.projectRoot, 'scratch', 'S-rwp-oq', 'HANDOFF.md'), 'utf-8');
      ok(/^- \[q-[0-9a-f]{6}\] Is the API stable\? → \[sessions\/.+\]\(sessions\/.+\) \(age: \d+\)$/m.test(content),
        `pointer row carries an ID and age annotation (got: ${content})`);
      ok(!content.includes('- none'), 'no "- none" placeholder when questions exist');
    } finally { fx.cleanup(); }
  });

  // RWP12: Sessions table rows match total session count
  await runTest('RWP12: sessions table rows match total session count', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'rwp-rows');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'r001' });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'r002' });
      makeSession(sd, '2026-01-03T10:00:00.000Z', { shortid: 'r003' });
      runCli(['rewrite-pointer', 'scratch/S-rwp-rows/'], { cwd: fx.projectRoot });
      const content = readFileSync(join(fx.projectRoot, 'scratch', 'S-rwp-rows', 'HANDOFF.md'), 'utf-8');
      // Count table data rows (skip header and separator lines)
      const tableRows = content.split('\n').filter(
        l => l.startsWith('| ') && !l.includes('timestamp | summary') && !l.startsWith('|---|')
      );
      strictEqual(tableRows.length, 3, `3 session rows in table (got ${tableRows.length})`);
      ok(content.includes('session_count: 3'), 'session_count: 3 in frontmatter');
    } finally { fx.cleanup(); }
  });

  // B7: a literal `|` in the ts value and in the session filename must be escaped in the
  // Sessions table rendered by BOTH cat-sessions.mjs (--format summary) and rewrite-pointer.mjs
  // (## Sessions table in HANDOFF.md) — otherwise it breaks the markdown table into extra columns.
  await runTest('B7: pipe in ts/frontmatter and filename is escaped in both table renderers', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'b7-pipe');
      const filename = '2026-01-01T10-00-00-000Z-b7|pipe.md';
      const content = [
        '---', 'session_id: test',
        'started: 2026-01-01T10:00:00.000Z',
        'ended: 2026-01-01T10:00:00.000Z | extra-field',
        'session_name: ', 'goal_at_time: Test goal',
        'summary: B7 pipe escaping test',
        'parent_handoff_state: ', '---',
        '', '## Goal', '', 'Goal text', '',
        '## Next best step', '', 'NBS', '',
        '## Done', '', '## Decisions made', '', '## What to avoid', '',
        '## Open questions raised', '', '## Open questions resolved', '',
        '## Key files & artifacts', '', '## Skills used', '', '## Projects', '',
      ].join('\n');
      writeFileSync(join(sd, filename), content, 'utf-8');

      // Splits a rendered markdown-table row on unescaped '|' only, dropping the empty
      // leading/trailing cells produced by the row's own delimiting '|' characters.
      const splitRow = (line) => line.split(/(?<!\\)\|/).slice(1, -1);

      // --- cat-sessions --format summary ---
      const catResult = runCli(['cat-sessions', 'scratch/S-b7-pipe/', '--format', 'summary'], { cwd: fx.projectRoot });
      strictEqual(catResult.exitCode, 0, `cat-sessions exit 0 (stderr: ${catResult.stderr})`);
      const catRow = catResult.stdout.split('\n').find(l => l.startsWith('| 2026-01-01T10:00:00.000Z'));
      ok(catRow, `summary table row found (stdout: ${catResult.stdout.slice(0, 400)})`);
      ok(catRow.includes('2026-01-01T10:00:00.000Z \\| extra-field'), `ts pipe escaped in cat-sessions row: "${catRow}"`);
      ok(catRow.includes('b7\\|pipe.md'), `file-link pipe escaped in cat-sessions row: "${catRow}"`);
      strictEqual(splitRow(catRow).length, 3, `cat-sessions row splits into 3 columns on unescaped pipes: "${catRow}"`);

      // --- rewrite-pointer ## Sessions table ---
      const rwpResult = runCli(['rewrite-pointer', 'scratch/S-b7-pipe/'], { cwd: fx.projectRoot });
      strictEqual(rwpResult.exitCode, 0, `rewrite-pointer exit 0 (stderr: ${rwpResult.stderr})`);
      const pointerContent = readFileSync(join(fx.projectRoot, 'scratch', 'S-b7-pipe', 'HANDOFF.md'), 'utf-8');
      const rwpRow = pointerContent.split('\n').find(l => l.startsWith('| 2026-01-01T10:00:00.000Z'));
      ok(rwpRow, `Sessions table row found in pointer (content: ${pointerContent.slice(0, 400)})`);
      ok(rwpRow.includes('2026-01-01T10:00:00.000Z \\| extra-field'), `ts pipe escaped in rewrite-pointer row: "${rwpRow}"`);
      ok(rwpRow.includes('b7\\|pipe.md'), `file-link pipe escaped in rewrite-pointer row: "${rwpRow}"`);
      strictEqual(splitRow(rwpRow).length, 3, `rewrite-pointer row splits into 3 columns on unescaped pipes: "${rwpRow}"`);
    } finally { fx.cleanup(); }
  });

  // B8: stale-sweep must classify errors from process.kill(pid, 0) — ESRCH (no such process) is
  // dead and safe to sweep; EPERM (process exists, not signalable) must be treated as alive so a
  // live concurrent writer's tmp file is never deleted out from under it.
  await runTest('B8: stale-sweep — ESRCH-dead tmp swept, current-process (alive) tmp survives', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'b8-sweep');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'b8s001' });
      const sessionDir = join(fx.projectRoot, 'scratch', 'S-b8-sweep');

      // Pre-seed a stale tmp file naming a PID far outside any valid range — guaranteed ESRCH.
      const deadPid = 999999999;
      const deadTmpName = `.HANDOFF-${deadPid}-deadbeef.tmp`;
      writeFileSync(join(sessionDir, deadTmpName), 'stale', 'utf-8');

      // Pre-seed a tmp file naming the CURRENT test process — guaranteed alive/signalable.
      const liveTmpName = `.HANDOFF-${process.pid}-alivebee.tmp`;
      writeFileSync(join(sessionDir, liveTmpName), 'stale-but-alive', 'utf-8');

      const { rewritePointer } = await import('./rewrite-pointer.mjs');
      const result = rewritePointer(sessionDir);
      ok(result.targetPath.endsWith('HANDOFF.md'), 'pointer written');

      ok(!existsSync(join(sessionDir, deadTmpName)), 'dead-PID (ESRCH) tmp file swept');
      ok(existsSync(join(sessionDir, liveTmpName)), 'live-PID (current process) tmp file survives');
    } finally { fx.cleanup(); }
  });

  // RWP13: Recovery rebuild — delete HANDOFF.md and rerun reproduces valid pointer
  await runTest('RWP13: recovery rebuild — delete HANDOFF.md and rerun reproduces valid pointer', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'rwp-rebuild');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'rb01', goal: 'Rebuild goal content' });
      // First write
      const r1 = runCli(['rewrite-pointer', 'scratch/S-rwp-rebuild/'], { cwd: fx.projectRoot });
      strictEqual(r1.exitCode, 0, `first write exit 0 (stderr: ${r1.stderr})`);
      const pointerPath = join(fx.projectRoot, 'scratch', 'S-rwp-rebuild', 'HANDOFF.md');
      ok(existsSync(pointerPath), 'HANDOFF.md written');
      ok(readFileSync(pointerPath, 'utf-8').includes('schema_version: 3'), 'first write has schema_version: 3');
      // Delete HANDOFF.md to simulate cache loss
      rmSync(pointerPath);
      ok(!existsSync(pointerPath), 'HANDOFF.md deleted');
      // Recovery rebuild
      const r2 = runCli(['rewrite-pointer', 'scratch/S-rwp-rebuild/'], { cwd: fx.projectRoot });
      strictEqual(r2.exitCode, 0, `recovery rebuild exit 0 (stderr: ${r2.stderr})`);
      ok(existsSync(pointerPath), 'HANDOFF.md recreated from log');
      const rebuildContent = readFileSync(pointerPath, 'utf-8');
      ok(rebuildContent.includes('schema_version: 3'), 'rebuild has schema_version: 3');
      ok(rebuildContent.includes('Rebuild goal content'), 'rebuild has correct goal content');
    } finally { fx.cleanup(); }
  });

  // RWP14: pointer still-open rows carry an ID and an age annotation
  await runTest('RWP14: pointer still-open rows carry an ID and an age annotation', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'rwp-idage');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'ia01',
        raised: ['Does the pointer row carry an ID and age?'], resolved: [] });
      const r = runCli(['rewrite-pointer', 'scratch/S-rwp-idage/'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
      const content = readFileSync(join(fx.projectRoot, 'scratch', 'S-rwp-idage', 'HANDOFF.md'), 'utf-8');
      const rowLines = content.split('\n').filter(l => l.startsWith('- ['));
      ok(rowLines.length > 0, `at least one still-open row present (got: ${content})`);
      for (const line of rowLines) {
        ok(/^- \[q-[0-9a-f]{6}\] .+ → \[sessions\/.+\]\(sessions\/.+\) \(age: \d+\)$/.test(line),
          `row matches ID+age shape (got: ${line})`);
      }

      // Platform-independent tripwire (research.md Windows hazard; decisions.md D9/R12 §5):
      // hand each link-building chokepoint a backslash-separated source_file directly —
      // native Windows Node's join('sessions', filename) produces this shape, but a Linux
      // test runner never does, so the normal pipeline above can't exercise it. Assert the
      // emitted link text contains no '\' regardless of which OS runs the suite.
      const winStylePath = 'sessions\\2026-01-01-x.md';
      const brief = relLink(winStylePath);
      ok(!brief.includes('\\'), `relLink emits no backslash (got: ${brief})`);

      const { renderPointer } = await import('./rewrite-pointer.mjs');
      const pointerRendered = renderPointer('rwp-idage-synthetic', {
        session_count: 1,
        still_open_questions: [
          { id: 'q-abc123', text: 'Synthetic question', source_file: winStylePath, age_sessions: 0 },
        ],
        newest: { goal: 'g', next_best_step: 'n', summary: 's', file: winStylePath },
        sessions: [{ ts: '2026-01-01T10:00:00.000Z', file: winStylePath, summary: 's', inlined: true }],
      });
      const pointerRow = pointerRendered.split('\n').find(l => l.startsWith('- [q-abc123]'));
      ok(pointerRow && !pointerRow.includes('\\'), `renderPointer's still-open row emits no backslash (got: ${pointerRow})`);
    } finally { fx.cleanup(); }
  });

  // RWP15: pointer non-inclusion (spec T3) — rewrite-pointer calls assembleSessions
  // directly and never passes the flag, so a populated tasks/ dir must never leak a
  // t-<hex6> token or a ## Tasks heading into the regenerated pointer.
  await runTest('RWP15: pointer non-inclusion — rewrite-pointer output has no t-<hex6> token and no ## Tasks heading even with tasks/ populated', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'rwp-no-tasks');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'nt01' });
      const dir = join(fx.projectRoot, 'scratch', 'S-rwp-no-tasks');
      const tasksDir = join(dir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      makeTaskFile(tasksDir, { id: 't-000001', title: 'Should never leak into the pointer', status: 'open',
        created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z' });

      const r = runCli(['rewrite-pointer', 'scratch/S-rwp-no-tasks/'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);

      const content = readFileSync(join(dir, 'HANDOFF.md'), 'utf-8');
      // Task-ID-shaped token check, not a naive 't-' substring — the
      // grep-t-dash-false-positive wiki gotcha: "cat-sessions" itself contains the
      // bare substring 't-', so a naive check would false-positive on unrelated prose.
      ok(!/\bt-[0-9a-f]{6}\b/.test(content), `no t-<hex6> task-id token in the regenerated pointer (got: ${content})`);
      ok(!content.includes('## Tasks'), `no ## Tasks heading in the regenerated pointer (got: ${content})`);
    } finally { fx.cleanup(); }
  });

  // RWP_STRUCT: Atomic write cleanup pattern — structural regression guard
  // Verifies the write/sync failure cleanup pattern is present in source.
  // (Actual induced-failure test requires OS-level write failure injection;
  //  this guard protects the cleanup-on-failure contract via source inspection.)
  await runTest('RWP_STRUCT: atomic write cleanup pattern structurally present in rewrite-pointer.mjs', async () => {
    const rwpSource = readFileSync(new URL('./rewrite-pointer.mjs', import.meta.url)).toString('utf-8');
    ok(rwpSource.includes("openSync(tmpPath, 'wx')"), "exclusive-create openSync('wx') present");
    ok(rwpSource.includes('writeSync(fd, content)'), 'writeSync present');
    ok(rwpSource.includes('fsyncSync(fd)'), 'fsyncSync present');
    ok(rwpSource.includes('unlinkSync(tmpPath)'), 'unlinkSync for partial-file cleanup present');
    ok(rwpSource.includes('closeSync(fd)'), 'closeSync in finally present');
    ok(rwpSource.includes('renameSync(tmpPath, targetPath)'), 'renameSync for atomic swap present');
  });

  // RWP_CORE: exported rewritePointer(dir) core is callable directly (exit-free),
  // returns { sessionCount, targetPath }, and writes a valid v3 HANDOFF.md.
  await runTest('RWP_CORE: rewritePointer(dir) core — exit-free, returns sessionCount/targetPath, writes v3 pointer', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'rwp-core');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'rc001', goal: 'Core-call goal content' });
      const { rewritePointer } = await import('./rewrite-pointer.mjs');
      const resolvedSessionDir = join(fx.projectRoot, 'scratch', 'S-rwp-core');
      const result = rewritePointer(resolvedSessionDir);
      // Proves exit-free: reaching this assertion means the process did not terminate.
      strictEqual(result.sessionCount, 1, `sessionCount is 1 (got: ${JSON.stringify(result)})`);
      const expectedTargetPath = join(resolvedSessionDir, 'HANDOFF.md');
      strictEqual(result.targetPath, expectedTargetPath, `targetPath matches HANDOFF.md path (got: ${result.targetPath})`);
      ok(existsSync(expectedTargetPath), 'HANDOFF.md written to disk');
      const content = readFileSync(expectedTargetPath, 'utf-8');
      ok(content.includes('schema_version: 3'), 'schema_version: 3 in frontmatter');
      ok(content.includes('Core-call goal content'), 'goal content from the fixture session present');
    } finally { fx.cleanup(); }
  });

  // --- v3 thin pointer tests (Step 05) ---

  // Helper: build a valid v3 HANDOFF.md content string with all fields needed by
  // cmdValidate's strict frontmatter check (session_id, schema_version, last_pointer_rewrite, session_count).
  function validV3Content(sessionIdOverride) {
    const sessionId = sessionIdOverride ?? 'test-v3';
    return [
      '---',
      `session_id: ${sessionId}`,
      'schema_version: 3',
      'last_pointer_rewrite: 2026-01-01T00:00:00.000Z',
      'session_count: 1',
      '---',
      '',
      '## Open questions (still open)',
      '',
      '## Goal',
      '',
      '## Next best step',
      '',
      '## Latest summary',
      '',
      '## Sessions',
      '',
    ].join('\n');
  }

  // DS4: detectShape returns 'v3-pointer' for schema_version: 3 HANDOFF.md
  await runTest('DS4: detectShape returns "v3-pointer" for schema_version: 3', async () => {
    const fx = createFixture();
    try {
      const slugFolder = join(fx.projectRoot, 'scratch', 'S-ds4');
      const handoffPath = join(slugFolder, 'HANDOFF.md');
      const sessionsPath = join(slugFolder, 'sessions');
      mkdirSync(sessionsPath, { recursive: true });
      writeFileSync(handoffPath, validV3Content('ds4'), 'utf-8');
      strictEqual(detectShape(handoffPath, sessionsPath), 'v3-pointer', 'detectShape returns "v3-pointer"');
    } finally {
      fx.cleanup();
    }
  });

  // DS4b: detectShape returns 'v3-pointer' even when sessions/ dir does not exist
  // (v3 early-return fires before the heading/folder classification)
  await runTest('DS4b: detectShape returns "v3-pointer" even without sessions/ dir', async () => {
    const fx = createFixture();
    try {
      const slugFolder = join(fx.projectRoot, 'scratch', 'S-ds4b');
      const handoffPath = join(slugFolder, 'HANDOFF.md');
      const sessionsPath = join(slugFolder, 'sessions');
      mkdirSync(slugFolder, { recursive: true }); // no sessions/
      writeFileSync(handoffPath, validV3Content('ds4b'), 'utf-8');
      strictEqual(detectShape(handoffPath, sessionsPath), 'v3-pointer', 'v3 detection fires before sessions/ check');
    } finally {
      fx.cleanup();
    }
  });

  // DS4c: detectShape does NOT return 'v3-pointer' for schema_version: 3 in body (not frontmatter)
  // B2 regression: the old regex matched anywhere in the file; parseFrontmatter scopes to frontmatter only.
  await runTest('DS4c: detectShape ignores schema_version: 3 in body (not frontmatter)', async () => {
    const fx = createFixture();
    try {
      const slugFolder = join(fx.projectRoot, 'scratch', 'S-ds4c');
      const handoffPath = join(slugFolder, 'HANDOFF.md');
      const sessionsPath = join(slugFolder, 'sessions');
      mkdirSync(sessionsPath, { recursive: true });
      // Frontmatter has schema_version: 2; the body text contains "schema_version: 3" — must NOT match
      const legacyBody = [
        '---',
        'session_id: ds4c',
        'schema_version: 2',
        'first_written: 2026-01-01T00:00:00.000Z',
        'last_updated: 2026-01-01T00:00:00.000Z',
        'git_branch: main',
        '---',
        '',
        '## Goal',
        'Note: schema_version: 3 appears in body text but not frontmatter.',
        '',
        '## Sessions',
        '',
      ].join('\n');
      writeFileSync(handoffPath, legacyBody, 'utf-8');
      const shape = detectShape(handoffPath, sessionsPath);
      ok(shape !== 'v3-pointer', `shape must not be v3-pointer when schema_version:3 is only in body (got: ${shape})`);
    } finally {
      fx.cleanup();
    }
  });

  // V3C1: cmdCommit on a v3 thin pointer is a no-op (exit 0, no downgrade)
  // runCli captures stderr only on failure (execFileSync limitation); use spawnSync to
  // capture stderr on success and assert the no-op message is present.
  await runTest('V3C1: cmdCommit v3 thin pointer is a no-op (exit 0, no-op on stderr)', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const sessionId = 'v3-commit-test';
      const folderPath = join(fx.projectRoot, 'scratch', `S-${sessionId}`);
      mkdirSync(join(folderPath, 'sessions'), { recursive: true });
      writeFileSync(join(folderPath, 'HANDOFF.md'), validV3Content(sessionId), 'utf-8');
      const cliPath = join(__dirname, 'scratch-memory.mjs');
      const res = spawnSync('node', [cliPath, 'handoff', 'commit', sessionId], {
        encoding: 'utf-8',
        env: { ...process.env, ...env },
        cwd: fx.projectRoot,
      });
      strictEqual(res.status, 0, `exit 0 (stderr: ${res.stderr})`);
      ok(res.stderr.includes('no-op'), `stderr mentions no-op: "${res.stderr}"`);
    } finally {
      fx.cleanup();
    }
  });

  // V3C2: v3 commit no-op — schema_version: 3 preserved, no .bak written (no 3→2 downgrade)
  await runTest('V3C2: v3 commit no-op — schema_version: 3 preserved, no .bak written', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const sessionId = 'v3-nobak';
      const folderPath = join(fx.projectRoot, 'scratch', `S-${sessionId}`);
      mkdirSync(join(folderPath, 'sessions'), { recursive: true });
      const v3Content = validV3Content(sessionId);
      writeFileSync(join(folderPath, 'HANDOFF.md'), v3Content, 'utf-8');
      const result = runCli(['handoff', 'commit', sessionId], { env, cwd: fx.projectRoot });
      strictEqual(result.exitCode, 0, `exit 0 (stderr: ${result.stderr})`);
      // HANDOFF.md must still contain schema_version: 3 (no downgrade)
      const afterContent = readFileSync(join(folderPath, 'HANDOFF.md'), 'utf-8');
      ok(afterContent.includes('schema_version: 3'), 'schema_version: 3 preserved after no-op commit');
      // No .bak directory created
      const bakDir = join(folderPath, '.bak');
      ok(!existsSync(bakDir), 'no .bak directory created by v3 no-op commit');
    } finally {
      fx.cleanup();
    }
  });

  // V3V1: cmdValidate accepts v3 5-section pointer (exit 0, no findings)
  await runTest('V3V1: cmdValidate accepts v3 5-section pointer (exit 0)', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const sessionId = 'v3-validate';
      const folderPath = join(fx.projectRoot, 'scratch', `S-${sessionId}`);
      mkdirSync(join(folderPath, 'sessions'), { recursive: true });
      writeFileSync(join(folderPath, 'HANDOFF.md'), validV3Content(sessionId), 'utf-8');
      const result = runCli(['handoff', 'validate', sessionId], { env, cwd: fx.projectRoot });
      strictEqual(result.exitCode, 0, `exit 0 (stderr: ${result.stderr})`);
    } finally {
      fx.cleanup();
    }
  });

  // V3V1b: Round-trip validate — rewrite-pointer → handoff validate exits 0, zero findings (B1)
  await runTest('V3V1b: round-trip rewrite-pointer → handoff validate exits 0 (B1)', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const sessionId = 'v3-roundtrip';
      const sd = setupSessionsDir(fx.projectRoot, sessionId);
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'rtrip01', goal: 'Round-trip validate goal' });
      makeSession(sd, '2026-01-02T10:00:00.000Z', { shortid: 'rtrip02', summary: 'Second session summary' });
      // Run the real rewrite-pointer to produce a v3 HANDOFF.md from actual session files
      const rwp = runCli(['rewrite-pointer', `scratch/S-${sessionId}/`], { env, cwd: fx.projectRoot });
      strictEqual(rwp.exitCode, 0, `rewrite-pointer exit 0 (stderr: ${rwp.stderr})`);
      // handoff validate must exit 0 with zero findings on the freshly written v3 pointer
      const val = runCli(['handoff', 'validate', sessionId], { env, cwd: fx.projectRoot });
      strictEqual(val.exitCode, 0, `handoff validate exits 0 (stderr: ${val.stderr})`);
      ok(!val.stderr.includes('finding'), `no findings in stderr (got: "${val.stderr}")`);
    } finally {
      fx.cleanup();
    }
  });

  // V3V2: cmdValidate rejects a file with schema_version: 3 but 10 body sections (count mismatch)
  await runTest('V3V2: cmdValidate rejects v3 pointer with wrong section count (10 vs 5 expected)', async () => {
    const fx = createFixture();
    try {
      const env = mkEnv(fx.sessionsDir);
      const sessionId = 'v3-validate-wrong';
      const folderPath = join(fx.projectRoot, 'scratch', `S-${sessionId}`);
      mkdirSync(join(folderPath, 'sessions'), { recursive: true });
      // Build v3 frontmatter + V2 10-section body (wrong section count for v3)
      const wrongContent = [
        '---',
        `session_id: ${sessionId}`,
        'schema_version: 3',
        'first_written: 2026-01-01T00:00:00.000Z',
        'last_updated: 2026-01-01T00:00:00.000Z',
        'git_branch: main',
        '---',
        '',
        '## Goal', '',
        '## Current state', '',
        '## Next best step', '',
        '## Active decisions', '',
        '## Active what-to-avoid', '',
        '## Open questions (still open)', '',
        '## Skills — Mandatory', '',
        '## Skills — Available', '',
        '## Projects', '',
        '## Sessions', '',
      ].join('\n');
      writeFileSync(join(folderPath, 'HANDOFF.md'), wrongContent, 'utf-8');
      const result = runCli(['handoff', 'validate', sessionId], { env, cwd: fx.projectRoot });
      ok(result.exitCode !== 0, `exits non-zero for v3 with 10 sections (exitCode: ${result.exitCode})`);
    } finally {
      fx.cleanup();
    }
  });

  // SFT1: SESSION_FILE_TEMPLATE contains a `summary:` field
  await runTest('SFT1: SESSION_FILE_TEMPLATE contains a summary: field', async () => {
    ok(/(^|\n)\s*summary:/.test(SESSION_FILE_TEMPLATE), 'SESSION_FILE_TEMPLATE has a summary: line');
  });

  // V3P1: v3-pointer pickup does NOT emit missing-skills WARN
  // The WARN block in pickup.mjs is gated on `if (shape === 'new')`.
  // Step 05 makes detectShape return 'v3-pointer' for schema_version: 3 files, so the
  // gate evaluates false and the WARN is suppressed for free — no pickup.mjs change needed.
  // Uses spawnSync so stderr is captured even when the process exits 0.
  await runTest('V3P1: v3-pointer pickup does not emit missing-skills WARN on stderr', async () => {
    const fx = createFixture();
    try {
      const fromId = 'v3p1-from';
      const toId = 'v3p1-to';
      const folderPath = join(fx.projectRoot, 'scratch', `S-${fromId}`);
      mkdirSync(join(folderPath, 'sessions'), { recursive: true });
      writeFileSync(join(folderPath, 'HANDOFF.md'), validV3Content(fromId), 'utf-8');
      const optsJson = JSON.stringify({ fromArg: fromId, toSessionId: toId, projectRootCwd: resolve(fx.projectRoot) });
      const env = { ...process.env, CLAUDE_SESSIONS_DIR: fx.sessionsDir };
      const res = spawnSync('node', [PICKUP_WITH_PID_PATH, optsJson], {
        encoding: 'utf-8',
        env,
        cwd: fx.projectRoot,
      });
      strictEqual(res.status, 0, `pickup exited 0 (stderr: ${res.stderr})`);
      ok(
        !res.stderr.includes('WARN: HANDOFF.md has no Mandatory or Available skills'),
        `v3 pickup must NOT emit missing-skills WARN (got stderr: "${res.stderr}")`
      );
    } finally {
      fx.cleanup();
    }
  });

  // V2PW1: empty V2 pickup (no skills) DOES emit missing-skills WARN — regression guard
  // Ensures the WARN in pickup.mjs still fires for genuine V2 workstreams (shape 'new')
  // that were never synthesized (no Mandatory or Available skills entries).
  // Uses spawnSync so stderr is captured even when the process exits 0.
  await runTest('V2PW1: empty V2 pickup (no skills) emits missing-skills WARN on stderr', async () => {
    const fx = createFixture();
    try {
      const fromId = 'v2pw1-from';
      const toId = 'v2pw1-to';
      const folderPath = join(fx.projectRoot, 'scratch', `S-${fromId}`);
      mkdirSync(join(folderPath, 'sessions'), { recursive: true });
      // V2 shape: ## Sessions heading present, sessions/ exists, schema_version: 2 (not 3).
      // Both Skills sections are empty — triggers the WARN in pickup.mjs line 340-351.
      const v2EmptySkillsContent = [
        '---',
        `session_id: ${fromId}`,
        'schema_version: 2',
        'first_written: 2026-01-01T00:00:00.000Z',
        'last_updated: 2026-01-01T00:00:00.000Z',
        '---',
        '## Goal',
        '',
        '## Current state',
        '',
        '## Next best step',
        '',
        '## Active decisions',
        '',
        '## Active what-to-avoid',
        '',
        '## Open questions (still open)',
        '',
        '## Skills — Mandatory',
        '',
        '## Skills — Available',
        '',
        '## Projects',
        '',
        '## Sessions',
        '',
      ].join('\n');
      writeFileSync(join(folderPath, 'HANDOFF.md'), v2EmptySkillsContent, 'utf-8');
      const optsJson = JSON.stringify({ fromArg: fromId, toSessionId: toId, projectRootCwd: resolve(fx.projectRoot) });
      const env = { ...process.env, CLAUDE_SESSIONS_DIR: fx.sessionsDir };
      const res = spawnSync('node', [PICKUP_WITH_PID_PATH, optsJson], {
        encoding: 'utf-8',
        env,
        cwd: fx.projectRoot,
      });
      strictEqual(res.status, 0, `pickup exited 0 (stderr: ${res.stderr})`);
      ok(
        res.stderr.includes('WARN: HANDOFF.md has no Mandatory or Available skills'),
        `empty V2 pickup must emit missing-skills WARN (got stderr: "${res.stderr}")`
      );
    } finally {
      fx.cleanup();
    }
  });

  // ===========================================================================
  // INT — Integration / E2E tests (Step 12)
  // Full round-trips, bounded-brief, legacy regeneration, exit-code matrix,
  // piping, and SIGINT structural guard.
  // ===========================================================================

  // INT1: Full v3 round-trip — write_session (MCP) → rewrite-pointer → pickup → cat-sessions
  await runTest('INT1: Full v3 round-trip — write_session → rewrite-pointer → pickup → cat-sessions', async () => {
    const fx = createFixture();
    const driver = await createMcpDriver(fx.projectRoot);
    try {
      const fromId = 'int1-from';
      const toId = 'int1-to';
      const sessionBody = [
        '---',
        `session_id: ${fromId}`,
        'started: 2026-06-28T10:00:00.000Z',
        'ended: 2026-06-28T11:00:00.000Z',
        'session_name: INT1 round-trip test',
        'goal_at_time: Ship the integration tests',
        'parent_handoff_state: ',
        '---',
        '',
        '## Goal', 'Ship the integration tests.',
        '## Next best step', 'Verify round-trip.',
        '## Done', '- Wrote write_session call.',
        '## Decisions made', '- Use MCP driver for write_session.',
        '## What to avoid', '- Skipping assertions.',
        '## Open questions raised', '- Is the round-trip reliable?', '- Will the pointer be valid?',
        '## Open questions resolved', '',
        '## Key files & artifacts', '- scratch/S-int1-from/HANDOFF.md',
        '## Skills used', '- nodejs-expert',
        '## Projects', '- handoff-cat-pickup',
      ].join('\n');

      // Step 1: write_session via MCP
      const raw = await driver.callTool('write_session', { session_id: fromId, body: sessionBody });
      const ret = JSON.parse(raw.content[0].text);
      ok(ret.path, 'write_session returned a path');

      // Step 2: rewrite-pointer → creates v3 HANDOFF.md from session log
      const rwpResult = runCli(['rewrite-pointer', `scratch/S-${fromId}/`], { cwd: fx.projectRoot });
      strictEqual(rwpResult.exitCode, 0, `rewrite-pointer exit 0 (stderr: ${rwpResult.stderr})`);
      const handoffPath = join(fx.projectRoot, 'scratch', `S-${fromId}`, 'HANDOFF.md');
      ok(existsSync(handoffPath), 'HANDOFF.md created by rewrite-pointer');
      const handoffContent = readFileSync(handoffPath, 'utf-8');
      ok(handoffContent.includes('schema_version: 3'), 'HANDOFF.md has schema_version: 3');
      for (const heading of [
        '## Open questions (still open)', '## Goal', '## Next best step', '## Latest summary', '## Sessions',
      ]) {
        ok(handoffContent.includes(heading), `v3 section present: ${heading}`);
      }

      // Step 3: pickup folder-transfer (fromId → toId)
      const pickupResult = runCli(['pickup', fromId, '--to-session-id', toId, '--json'], { cwd: fx.projectRoot });
      strictEqual(pickupResult.exitCode, 0, `pickup exit 0 (stderr: ${pickupResult.stderr})`);
      const pickupJson = JSON.parse(pickupResult.stdout);
      ok(pickupJson.session_id === toId, `pickup session_id is toId: ${pickupJson.session_id}`);

      // Step 4: cat-sessions --format full on renamed folder
      const catFull = runCli(['cat-sessions', `scratch/S-${toId}/`, '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(catFull.exitCode, 0, `cat-sessions full exit 0 (stderr: ${catFull.stderr})`);
      ok(catFull.stdout.includes('## Open questions (still open)'), 'resume brief has open-questions block');
      ok(catFull.stdout.includes('Is the round-trip reliable?'), 'raised question appears in brief');
      ok(catFull.stdout.includes('Ship the integration tests.'), 'newest body inlined (goal text present)');

      // Step 5: cat-sessions --format json; assert all contract keys + newest inlined with body
      const catJson = runCli(['cat-sessions', `scratch/S-${toId}/`, '--format', 'json'], { cwd: fx.projectRoot });
      strictEqual(catJson.exitCode, 0, `cat-sessions json exit 0 (stderr: ${catJson.stderr})`);
      const brief = JSON.parse(catJson.stdout);
      ok(brief.newest && brief.newest.goal.includes('Ship the integration tests'), 'newest.goal populated');
      ok(Array.isArray(brief.sessions) && brief.sessions.length >= 1, 'sessions array populated');
      ok(Array.isArray(brief.still_open_questions), 'still_open_questions is array');
      ok(brief.still_open_questions.length >= 1, 'at least 1 still-open question');
      ok(brief.sessions[0].inlined === true, 'newest session inlined (always-inline-newest floor)');
      ok('body' in brief.sessions[0], 'newest session body key present');
    } finally {
      await driver.shutdown();
      fx.cleanup();
    }
  });

  // INT8: full v3 round-trip with IDs, ages and cumulative blocks — extends INT1's shape with
  // the ID/age/cumulative machinery landed in Steps 01-10 (Step 11; Tier 3, Apply: R10).
  await runTest('INT8: full v3 round-trip with IDs, ages and cumulative blocks', async () => {
    const fx = createFixture();
    const driver = await createMcpDriver(fx.projectRoot);
    try {
      const wsId = 'int8-e2e';
      const qStillOpen = 'Does the resume brief stay under the character budget?';
      const qResolvedById = 'Should the migration retry on failure?';
      const idResolved = questionId(questionKernel(qResolvedById));

      const session1Body = [
        '---',
        `session_id: ${wsId}`,
        'started: 2026-07-01T10:00:00.000Z',
        'ended: 2026-07-01T11:00:00.000Z',
        'session_name: INT8 session 1',
        'goal_at_time: Ship the e2e regression test',
        'parent_handoff_state: ',
        '---',
        '',
        '## Goal', 'Ship the e2e regression test.',
        '## Next best step', 'Add session 2.',
        '## Done', '- Wrote the INT8 session-1 fixture.',
        '## Decisions made', '- Use the MCP driver for INT8, like INT1.',
        '## What to avoid', '- Skipping the ID+age row assertions.',
        '## Open questions raised', `- ${qStillOpen}`, `- ${qResolvedById}`,
        '## Open questions resolved', '',
        '## Key files & artifacts', `- scratch/S-${wsId}/HANDOFF.md`,
        '## Skills used', '- nodejs-expert',
        '## Projects', '- handoff-carry-forward-fixes',
      ].join('\n');

      // Session 2 (later): resolves qResolvedById by ID with no kernel restatement (CAT36
      // shape), and STILL-OPEN-annotates qStillOpen verbatim — the annotation must NOT cancel
      // the raise (D1), so qStillOpen must still surface as still-open below.
      const session2Body = [
        '---',
        `session_id: ${wsId}`,
        'started: 2026-07-02T10:00:00.000Z',
        'ended: 2026-07-02T11:00:00.000Z',
        'session_name: INT8 session 2',
        'goal_at_time: Resolve one question, defer the other',
        'parent_handoff_state: ',
        '---',
        '',
        '## Goal', 'Resolve one question, defer the other.',
        '## Next best step', 'Add session 3.',
        '## Done', '- Resolved the retry question by ID.',
        '## Decisions made', '- Defer the budget question to session 3.',
        '## What to avoid', '- Assuming a STILL OPEN annotation cancels a raise.',
        '## Open questions raised', '',
        '## Open questions resolved',
        `- ${idResolved} → RESOLVED: because the drain hook already flushes in-flight jobs`,
        `- ${qStillOpen} → STILL OPEN — not taken up this session`,
        '## Key files & artifacts', `- scratch/S-${wsId}/sessions/`,
        '## Skills used', '- nodejs-expert',
        '## Projects', '- handoff-carry-forward-fixes',
      ].join('\n');

      // Session 3 (newest): unrelated wrap-up, adds one more cumulative entry per section.
      const session3Body = [
        '---',
        `session_id: ${wsId}`,
        'started: 2026-07-03T10:00:00.000Z',
        'ended: 2026-07-03T11:00:00.000Z',
        'session_name: INT8 session 3',
        'goal_at_time: Wrap up the regression fixture',
        'parent_handoff_state: ',
        '---',
        '',
        '## Goal', 'Wrap up the regression fixture.',
        '## Next best step', 'Run the corpus acceptance commands.',
        '## Done', '- Closed out the INT8 fixture.',
        '## Decisions made', "- Ship INT8 as the plan's last new test.",
        '## What to avoid', '- Editing session files after they are written.',
        '## Open questions raised', '',
        '## Open questions resolved', '',
        '## Key files & artifacts', `- scratch/S-${wsId}/HANDOFF.md`,
        '## Skills used', '- nodejs-expert',
        '## Projects', '- handoff-carry-forward-fixes',
      ].join('\n');

      for (const body of [session1Body, session2Body, session3Body]) {
        const raw = await driver.callTool('write_session', { session_id: wsId, body });
        const ret = JSON.parse(raw.content[0].text);
        ok(ret.path, `write_session returned a path (got ${JSON.stringify(ret)})`);
      }

      // rewrite-pointer → v3 HANDOFF.md
      const rwpResult = runCli(['rewrite-pointer', `scratch/S-${wsId}/`], { cwd: fx.projectRoot });
      strictEqual(rwpResult.exitCode, 0, `rewrite-pointer exit 0 (stderr: ${rwpResult.stderr})`);
      const handoffPath = join(fx.projectRoot, 'scratch', `S-${wsId}`, 'HANDOFF.md');
      const handoffContent = readFileSync(handoffPath, 'utf-8');

      // (a) exactly 5 v3 sections, schema_version: 3
      ok(handoffContent.includes('schema_version: 3'), 'pointer has schema_version: 3');
      const headingCount = (handoffContent.match(/^## /gm) || []).length;
      strictEqual(headingCount, 5, `pointer has exactly 5 ## sections (got ${headingCount})`);

      // (b) pointer still-open rows carry an ID and an age annotation
      const pointerRows = handoffContent.split('\n').filter(l => l.startsWith('- ['));
      ok(pointerRows.length > 0, `pointer has at least one still-open row (got: ${handoffContent})`);
      for (const line of pointerRows) {
        ok(/^- \[q-[0-9a-f]{6}\] .+ → \[sessions\/.+\]\(sessions\/.+\) \(age: \d+\)$/.test(line),
          `pointer row matches ID+age shape (got: ${line})`);
      }

      // (c) handoff validate exits 0 on the freshly written v3 pointer
      const val = runCli(['handoff', 'validate', wsId], { cwd: fx.projectRoot });
      strictEqual(val.exitCode, 0, `handoff validate exit 0 (stderr: ${val.stderr})`);

      // (d) full brief contains all three (cumulative) headings
      const catFull = runCli(['cat-sessions', `scratch/S-${wsId}/`, '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(catFull.exitCode, 0, `cat-sessions full exit 0 (stderr: ${catFull.stderr})`);
      for (const heading of ['## Decisions (cumulative)', '## What to avoid (cumulative)', '## Done (cumulative)']) {
        ok(catFull.stdout.includes(heading), `full brief has ${heading} heading`);
      }
      const fullRows = catFull.stdout.split('\n').filter(l => l.startsWith('- ['));
      ok(fullRows.length > 0, 'full brief has at least one still-open row');
      for (const line of fullRows) {
        ok(/^- \[q-[0-9a-f]{6}\] .+ → \[sessions\/.+\]\(sessions\/.+\) \(age: \d+\)$/.test(line),
          `full brief row matches ID+age shape (got: ${line})`);
      }

      // (e)/(f) via --format json: the ID-resolved question is gone, the STILL-OPEN one remains
      const catJson = runCli(['cat-sessions', `scratch/S-${wsId}/`, '--format', 'json'], { cwd: fx.projectRoot });
      strictEqual(catJson.exitCode, 0, `cat-sessions json exit 0 (stderr: ${catJson.stderr})`);
      const brief = JSON.parse(catJson.stdout);
      const openTexts = brief.still_open_questions.map(q => q.text);
      ok(!openTexts.includes(qResolvedById),
        `ID-resolved question absent from still-open set (got ${JSON.stringify(openTexts)})`);
      ok(openTexts.includes(qStillOpen),
        `STILL-OPEN-annotated question still present (got ${JSON.stringify(openTexts)})`);
    } finally {
      await driver.shutdown();
      fx.cleanup();
    }
  });

  // INT2: Bounded-brief — 20-session fixture; --format full output ≤ 35000 chars at B=30000
  await runTest('INT2: Bounded-brief — 20-session fixture, --format full output ≤ 35000 chars (B=30000)', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'int-bounded');
      // Create 20 sessions with ~1500-char padding → body ≈ 1700 chars each (total ~34k > B=30000)
      for (let i = 0; i < 20; i++) {
        const dayStr = String(i + 1).padStart(2, '0');
        const iso = `2026-01-${dayStr}T10:00:00.000Z`;
        makeSession(sd, iso, {
          shortid: `bound${String(i).padStart(2, '0')}`,
          summary: `Session ${i + 1} bounded-brief summary`,
          goal: `Session ${i + 1} goal`,
          nbs: `Session ${i + 1} next best step`,
          padding: 'B'.repeat(1500), // ~1500 extra chars per session
        });
      }

      // Structural check via assembleSessions API
      const result = assembleSessions(join(fx.projectRoot, 'scratch', 'S-int-bounded'), { maxChars: 30000 });
      strictEqual(result.session_count, 20, '20 sessions assembled');
      strictEqual(result.budget_chars, 30000, 'budget_chars is 30000');
      ok(result.sessions[0].inlined === true, 'newest always inlined (always-inline-newest floor)');
      const trimmedCount = result.sessions.filter(s => !s.inlined).length;
      ok(trimmedCount >= 1, `at least 1 session trimmed to summary-only (got ${trimmedCount})`);

      // Concrete char-count bound: --format full output ≤ 35000 chars (B=30000 + summary-tail overhead)
      const r = runCli(['cat-sessions', 'scratch/S-int-bounded/', '--format', 'full', '--max-chars', '30000'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `cat-sessions exit 0 (stderr: ${r.stderr})`);
      ok(
        r.stdout.length <= 35000,
        `output length ${r.stdout.length} chars must be ≤ 35000 (B=30000 + formatting overhead budget)`
      );
    } finally { fx.cleanup(); }
  });

  // INT3: Legacy-folder regeneration — sessions without summary: + old V2 HANDOFF.md → valid bounded brief
  await runTest('INT3: Legacy-folder regeneration — no summary: in sessions → valid v3 pointer via read-side derivation', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'int-legacy');
      // Sessions WITHOUT summary: → deriveSummary must compute from NBS + Done
      makeSession(sd, '2026-01-01T10:00:00.000Z', {
        shortid: 'leg01',
        nbs: 'Run legacy migration step',
        done: '- Set up legacy fixture',
        // no summary: field — read-side derivation path
      });
      makeSession(sd, '2026-01-02T10:00:00.000Z', {
        shortid: 'leg02',
        nbs: 'Verify read-side derivation works',
        done: '- Wrote legacy sessions',
        // no summary: field
      });
      // Write an old synthesized V2 HANDOFF.md (schema_version: 2, NOT v3)
      const oldHandoff = [
        '---',
        'session_id: int-legacy',
        'schema_version: 2',
        'first_written: 2026-01-01T00:00:00.000Z',
        'last_updated: 2026-01-01T00:00:00.000Z',
        '---',
        '',
        '## Goal', 'Old goal from V2 synthesis.',
        '## Current state', 'Stale — sessions added since.',
        '## Next best step', 'Migrate to v3.',
        '## Active decisions', '',
        '## Active what-to-avoid', '',
        '## Open questions (still open)', '',
        '## Skills — Mandatory', '',
        '## Skills — Available', '',
        '## Projects', '',
        '## Sessions', '',
      ].join('\n');
      writeFileSync(join(fx.projectRoot, 'scratch', 'S-int-legacy', 'HANDOFF.md'), oldHandoff, 'utf-8');

      // rewrite-pointer must produce valid v3 pointer from sessions lacking summary:
      const rwp = runCli(['rewrite-pointer', 'scratch/S-int-legacy/'], { cwd: fx.projectRoot });
      strictEqual(rwp.exitCode, 0, `rewrite-pointer exit 0 (stderr: ${rwp.stderr})`);

      const newHandoff = readFileSync(join(fx.projectRoot, 'scratch', 'S-int-legacy', 'HANDOFF.md'), 'utf-8');
      ok(newHandoff.includes('schema_version: 3'), 'HANDOFF.md upgraded to schema_version: 3');
      for (const heading of [
        '## Open questions (still open)', '## Goal', '## Next best step', '## Latest summary', '## Sessions',
      ]) {
        ok(newHandoff.includes(heading), `v3 section present: ${heading}`);
      }
      // ## Latest summary must be derived (not blank) — read-side derivation from NBS + Done
      const summaryStart = newHandoff.indexOf('## Latest summary\n');
      const summaryEnd = newHandoff.indexOf('\n## Sessions');
      const summaryContent = newHandoff.slice(summaryStart + '## Latest summary\n'.length, summaryEnd).trim();
      ok(summaryContent.length > 0, 'Latest summary has content (derived via read-side, no manual migration)');
      ok(
        summaryContent.includes('Verify read-side derivation works') || summaryContent.includes('Wrote legacy sessions'),
        `Latest summary contains NBS or Done content from newest session: "${summaryContent.slice(0, 100)}"`
      );

      // cat-sessions also produces valid bounded brief with derived summaries
      const cat = runCli(['cat-sessions', 'scratch/S-int-legacy/', '--format', 'full'], { cwd: fx.projectRoot });
      strictEqual(cat.exitCode, 0, `cat-sessions exit 0 (stderr: ${cat.stderr})`);
      ok(cat.stdout.includes('## Open questions (still open)'), 'brief has open-questions block');
      ok(
        cat.stdout.includes('Verify read-side derivation works') || cat.stdout.includes('Run legacy migration step'),
        'brief body includes NBS content from legacy sessions'
      );
    } finally { fx.cleanup(); }
  });

  // INT4: Exit-code matrix — every Decision Table row via real CLI invocation

  // INT4a: cat-sessions valid dir, ≥1 session → exit 0
  await runTest('INT4a: Decision Table — cat-sessions valid dir ≥1 session → exit 0', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'int4a');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'dt4a01' });
      const r = runCli(['cat-sessions', 'scratch/S-int4a/'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
    } finally { fx.cleanup(); }
  });

  // INT4b: cat-sessions missing positional → exit 1
  await runTest('INT4b: Decision Table — cat-sessions missing positional → exit 1', async () => {
    const fx = createFixture();
    try {
      const r = runCli(['cat-sessions'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
    } finally { fx.cleanup(); }
  });

  // INT4c: cat-sessions unknown flag → exit 1
  await runTest('INT4c: Decision Table — cat-sessions unknown flag → exit 1', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'int4c');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'dt4c01' });
      const r = runCli(['cat-sessions', 'scratch/S-int4c/', '--not-a-flag'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
    } finally { fx.cleanup(); }
  });

  // INT4d: cat-sessions invalid --format value → exit 1
  await runTest('INT4d: Decision Table — cat-sessions invalid --format value → exit 1', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'int4d');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'dt4d01' });
      const r = runCli(['cat-sessions', 'scratch/S-int4d/', '--format', 'csv'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
    } finally { fx.cleanup(); }
  });

  // INT4e: cat-sessions --max-chars 0 (< 1) → exit 1
  await runTest('INT4e: Decision Table — cat-sessions --max-chars 0 (less than 1) → exit 1', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'int4e');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'dt4e01' });
      const r = runCli(['cat-sessions', 'scratch/S-int4e/', '--max-chars', '0'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
    } finally { fx.cleanup(); }
  });

  // INT4f: cat-sessions out-of-sandbox path → exit 1, distinct stderr token
  // (OUT_OF_SANDBOX_PATH) — must not be confused with the NO_SESSIONS family below.
  await runTest('INT4f: Decision Table — cat-sessions out-of-sandbox path → exit 1', async () => {
    const fx = createFixture();
    try {
      const r = runCli(['cat-sessions', '/tmp'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.includes('OUT_OF_SANDBOX_PATH'), `stderr includes OUT_OF_SANDBOX_PATH (got: "${r.stderr}")`);
    } finally { fx.cleanup(); }
  });

  // INT4g: cat-sessions sessions/ directory absent → exit 1, distinct stderr token (NO_SESSIONS_DIR)
  await runTest('INT4g: Decision Table — cat-sessions absent sessions/ → exit 1', async () => {
    const fx = createFixture();
    try {
      mkdirSync(join(fx.projectRoot, 'scratch', 'S-int4g'), { recursive: true });
      const r = runCli(['cat-sessions', 'scratch/S-int4g/'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.includes('NO_SESSIONS_DIR'), `stderr includes NO_SESSIONS_DIR (got: "${r.stderr}")`);
    } finally { fx.cleanup(); }
  });

  // INT4h: cat-sessions empty sessions/ (no *.md files) → exit 1, distinct stderr token
  // (NO_SESSIONS) — proves "no session files" and "out-of-sandbox path" (INT4f) are no
  // longer conflated under a bare exit-1 with no distinguishing text (issue:
  // handoff-tooling-minor-polish-batch, item 3).
  await runTest('INT4h: Decision Table — cat-sessions empty sessions/ → exit 1', async () => {
    const fx = createFixture();
    try {
      mkdirSync(join(fx.projectRoot, 'scratch', 'S-int4h', 'sessions'), { recursive: true });
      const r = runCli(['cat-sessions', 'scratch/S-int4h/'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
      ok(r.stderr.includes('NO_SESSIONS'), `stderr includes NO_SESSIONS (got: "${r.stderr}")`);
      ok(!r.stderr.includes('OUT_OF_SANDBOX_PATH'), 'NO_SESSIONS stderr text is distinct from OUT_OF_SANDBOX_PATH');
    } finally { fx.cleanup(); }
  });

  // INT4i: rewrite-pointer valid dir, ≥1 session → exit 0
  await runTest('INT4i: Decision Table — rewrite-pointer valid dir ≥1 session → exit 0', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'int4i');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'dt4i01' });
      const r = runCli(['rewrite-pointer', 'scratch/S-int4i/'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `exit 0 (stderr: ${r.stderr})`);
    } finally { fx.cleanup(); }
  });

  // INT4j: rewrite-pointer missing positional → exit 1
  await runTest('INT4j: Decision Table — rewrite-pointer missing positional → exit 1', async () => {
    const fx = createFixture();
    try {
      const r = runCli(['rewrite-pointer'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
    } finally { fx.cleanup(); }
  });

  // INT4k: rewrite-pointer out-of-sandbox path → exit 1
  await runTest('INT4k: Decision Table — rewrite-pointer out-of-sandbox path → exit 1', async () => {
    const fx = createFixture();
    try {
      const r = runCli(['rewrite-pointer', '/tmp'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
    } finally { fx.cleanup(); }
  });

  // INT4l: rewrite-pointer empty sessions/ → exit 1
  await runTest('INT4l: Decision Table — rewrite-pointer empty sessions/ → exit 1', async () => {
    const fx = createFixture();
    try {
      mkdirSync(join(fx.projectRoot, 'scratch', 'S-int4l', 'sessions'), { recursive: true });
      const r = runCli(['rewrite-pointer', 'scratch/S-int4l/'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1, 'exit 1');
    } finally { fx.cleanup(); }
  });

  // INT4m: rewrite-pointer induced FS write failure → exit 2
  // Makes S-{slug}/ non-writable so openSync('wx') in atomicWritePointer fails with EACCES.
  // Skipped when running as root (chmod is ineffective for root) or filesystem ignores mode bits.
  await runTest('INT4m: Decision Table — rewrite-pointer induced FS write failure → exit 2', async () => {
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    if (isRoot) {
      process.stdout.write('(skipped: running as root; chmod does not restrict root)\n');
      return;
    }
    const fx = createFixture();
    const slug = 'int4m-fsfail';
    const sessionDir = join(fx.projectRoot, 'scratch', `S-${slug}`);
    try {
      const sd = setupSessionsDir(fx.projectRoot, slug);
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'fs4m01' });
      // assembleSessions reads sessions/ via sessionDir traversal — needs x on sessionDir.
      // atomicWritePointer creates .HANDOFF-*.tmp IN sessionDir — needs w on sessionDir.
      // Setting 0o555 (r-xr-xr-x) preserves x (traversal) but removes w (file creation).
      const { chmodSync } = await import('node:fs');
      chmodSync(sessionDir, 0o555);
      // Verify chmod took effect (skip if filesystem ignores mode bits, e.g. some Docker volumes)
      const { statSync } = await import('node:fs');
      const actualMode = statSync(sessionDir).mode & 0o777;
      if (actualMode !== 0o555) {
        process.stdout.write('(skipped: chmod did not take effect on this filesystem)\n');
        return;
      }
      const r = runCli(['rewrite-pointer', `scratch/S-${slug}/`], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 2, `exit 2 on FS write failure (stderr: ${r.stderr})`);
      // Guards the unconditional `err.code = 'POINTER_WRITE'` tag in rewritePointer(): a real
      // OS-level fs error (EACCES here) must still map to the "failed to write pointer:" prefix,
      // not fall through to the generic ERROR: {msg} branch.
      ok(r.stderr.includes('failed to write pointer:'), `stderr contains "failed to write pointer:" prefix (stderr: ${r.stderr})`);
    } finally {
      // Restore write permission so cleanup can delete the directory
      try {
        const { chmodSync: chmod2 } = await import('node:fs');
        chmod2(sessionDir, 0o755);
      } catch {}
      fx.cleanup();
    }
  });

  // INT5: Piping / machine-readable — --format json output parses correctly; exit 0 survives pipe
  await runTest('INT5: Piping — cat-sessions --format json is valid JSON, all contract keys present, exit 0', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'int5-pipe');
      makeSession(sd, '2026-01-01T10:00:00.000Z', {
        shortid: 'pipe01',
        summary: 'Piping test summary',
        raised: ['Is piping reliable?', 'Does JSON parse cleanly?'],
      });
      // Simulate pipe via spawnSync (captures stdout + exit code together, like `cmd | consumer`)
      const cliPath = join(__dirname, 'scratch-memory.mjs');
      const res = spawnSync('node', [cliPath, 'cat-sessions', 'scratch/S-int5-pipe/', '--format', 'json'], {
        encoding: 'utf-8',
        cwd: fx.projectRoot,
      });
      // Exit code must be 0 (survives to downstream consumer)
      strictEqual(res.status, 0, `exit 0 (stderr: ${res.stderr})`);
      // stdout must be valid JSON (JSON.parse equivalent of `jq -e '...'`)
      let parsed;
      try {
        parsed = JSON.parse(res.stdout);
      } catch (e) {
        ok(false, `stdout is not valid JSON: ${e.message}\nFirst 200: ${res.stdout.slice(0, 200)}`);
      }
      // Assert all as-built contract keys: .newest, .sessions, .still_open_questions, .budget_chars
      ok(parsed.newest && typeof parsed.newest.goal === 'string', 'newest.goal present');
      ok(parsed.newest && typeof parsed.newest.next_best_step === 'string', 'newest.next_best_step present');
      ok(parsed.newest && typeof parsed.newest.summary === 'string', 'newest.summary present');
      ok(parsed.newest && typeof parsed.newest.file === 'string', 'newest.file present');
      ok(Array.isArray(parsed.sessions) && parsed.sessions.length >= 1, 'sessions array populated');
      ok(Array.isArray(parsed.still_open_questions), 'still_open_questions is array');
      ok(typeof parsed.budget_chars === 'number', 'budget_chars is number');
      ok(typeof parsed.session_count === 'number', 'session_count is number');
      ok(typeof parsed.session_dir === 'string', 'session_dir is string');
      ok(Array.isArray(parsed.cumulative_done), 'cumulative_done is array');
      ok(Array.isArray(parsed.cumulative_decisions), 'cumulative_decisions is array');
      ok(Array.isArray(parsed.cumulative_avoid), 'cumulative_avoid is array');
      // Verify raised questions appear in still_open_questions
      ok(
        parsed.still_open_questions.some(q => q.text === 'Is piping reliable?'),
        'raised question "Is piping reliable?" present in still_open_questions'
      );
      // Verify stdout is non-empty (single write completed; no SIGINT truncation in this path)
      ok(res.stdout.length > 0, 'stdout non-empty');
    } finally { fx.cleanup(); }
  });

  // INT6: SIGINT — single-synchronous-write guard: structural assertions + behavioral invariant
  //
  // RATIONALE for not asserting exit 130 deterministically:
  // The single-synchronous-write guard works as follows in cat-sessions.mjs:
  //   1. `assembled = null` before assembly (write is gated)
  //   2. SIGINT handler registered BEFORE any file I/O
  //   3. Assembly runs and `assembled` is set to the complete string
  //   4. `process.stdout.write(assembled)` — SINGLE write call (not split)
  //   5. process.exitCode = EXIT.SUCCESS
  //
  // If SIGINT fires at step 3 (during assembly): assembled is null → handler exits 130 → stdout empty.
  // If SIGINT fires at step 4+: write already complete → handler exits 130 → stdout has full JSON.
  // In either case: stdout is empty OR contains a complete, parseable JSON document.
  //
  // Deterministic timing is not possible because assembly of small fixtures completes in <5ms —
  // a SIGINT sent 10ms after spawn arrives AFTER the write in most cases. This is expected:
  // the invariant "no partial output" holds in BOTH the race-lost and race-won scenarios.
  await runTest('INT6: SIGINT — single-write guard structurally correct and no partial output', async () => {
    // --- Structural assertions (source invariants) ---
    const catSource = readFileSync(new URL('./cat-sessions.mjs', import.meta.url)).toString('utf-8');
    ok(catSource.includes('let assembled = null'), 'assembled initialized to null before assembly');
    ok(catSource.includes("process.exit(EXIT.CANCELLED)"), 'SIGINT handler calls process.exit');
    ok(catSource.includes('process.stdout.write(assembled)'), 'single stdout write uses assembled variable');
    // SIGINT handler must be registered BEFORE the try block inside dispatch that starts file I/O.
    // Note: helper functions before dispatch may contain their own try/catch blocks — use the
    // try block that appears AFTER the SIGINT handler, which is the dispatch-level try.
    const sigintIdx = catSource.indexOf("process.on('SIGINT'");
    ok(sigintIdx !== -1, "SIGINT handler registered via process.on('SIGINT', ...)");
    const tryAfterSigint = catSource.indexOf('try {', sigintIdx);
    ok(tryAfterSigint !== -1 && sigintIdx < tryAfterSigint, 'SIGINT handler registered before the try block inside dispatch (before file I/O begins)');

    // --- Behavioral invariant: stdout is empty OR valid JSON, never partial ---
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'int6-sigint');
      // Large body: assembly slightly longer than trivial, but still fast (< pipe buffer limit)
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'sig01', padding: 'S'.repeat(20000) });
      const cliPath = join(__dirname, 'scratch-memory.mjs');
      const child = spawn('node', [cliPath, 'cat-sessions', 'scratch/S-int6-sigint/', '--format', 'json'], {
        cwd: fx.projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.setEncoding('utf-8');
      child.stderr.setEncoding('utf-8');
      let stdoutData = '';
      child.stdout.on('data', d => { stdoutData += d; });
      const exitCodePromise = new Promise((res) => {
        child.on('exit', (code) => res(code ?? -1));
        child.on('error', () => res(-1));
      });
      // Send SIGINT after a short delay — may arrive before or after the single write
      setTimeout(() => { try { child.kill('SIGINT'); } catch {} }, 10);
      const exitCode = await exitCodePromise;
      // Invariant: if stdout has any content, it must be a complete, parseable JSON document
      if (stdoutData.length > 0) {
        let parsed;
        try {
          parsed = JSON.parse(stdoutData);
        } catch (e) {
          ok(false, `SIGINT produced partial JSON (invariant violation): ${e.message}\nFirst 200: ${stdoutData.slice(0, 200)}`);
        }
        ok(parsed !== undefined, 'non-empty stdout is valid JSON (complete single write)');
      }
      // Either outcome is valid — the test asserts the invariant, not the timing
      ok(true, `SIGINT invariant holds: exit ${exitCode}, stdout is ${stdoutData.length > 0 ? 'complete JSON' : 'empty'}`);
    } finally { fx.cleanup(); }
  });

  // INT7: Bounded brief with heavy cumulative content — 20-session fixture (same shape as INT2)
  // but every session also carries 15 decisions, 15 done items, and 15 avoid items, so the
  // cumulative sets are large. INT2's fixture has empty cumulative sections and cannot catch
  // runaway cumulative rendering; this asserts the three capped blocks keep --format full
  // bounded even under a heavy cumulative log.
  await runTest('INT7: bounded brief with heavy cumulative content — 20-session fixture, --format full output ≤ 55000 chars', async () => {
    const fx = createFixture();
    try {
      const sd = setupSessionsDir(fx.projectRoot, 'int-cum-heavy');
      for (let i = 0; i < 20; i++) {
        const dayStr = String(i + 1).padStart(2, '0');
        const iso = `2026-01-${dayStr}T10:00:00.000Z`;
        const decisions = Array.from({ length: 15 }, (_, j) =>
          `Session ${i + 1} decision ${j + 1} with enough detail to matter`);
        const avoid = Array.from({ length: 15 }, (_, j) =>
          `Session ${i + 1} avoid item ${j + 1} describing a gotcha worth remembering`);
        const done = Array.from({ length: 15 }, (_, j) =>
          `- Session ${i + 1} done item ${j + 1} completed work description`).join('\n');
        makeSession(sd, iso, {
          shortid: `heavy${String(i).padStart(2, '0')}`,
          summary: `Session ${i + 1} heavy-cumulative summary`,
          goal: `Session ${i + 1} goal`,
          nbs: `Session ${i + 1} next best step`,
          padding: 'B'.repeat(1500), // ~1500 extra chars per session, same as INT2
          decisions,
          avoid,
          done,
        });
      }

      const r = runCli(['cat-sessions', 'scratch/S-int-cum-heavy/', '--format', 'full', '--max-chars', '30000'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 0, `cat-sessions exit 0 (stderr: ${r.stderr})`);
      ok(
        r.stdout.length <= 55000,
        `output length ${r.stdout.length} chars must be ≤ 55000 ` +
        `(INT2's 35000-char ceiling for the same session shape + 3 × 6000-char cumulative caps and headings)`
      );
    } finally { fx.cleanup(); }
  });

  // INT9: Direct invocation guard — `node cat-sessions.mjs ...` (bypassing scratch-memory.mjs
  // entirely) must forward to dispatch() and produce real output/errors, not silently exit 0
  // with nothing on stdout (issue: verb-modules-silent-noop-direct-invocation).
  await runTest('INT9: direct invocation of cat-sessions.mjs produces real output, not silent exit 0', async () => {
    const fx = createFixture();
    try {
      const catSessionsPath = join(__dirname, 'cat-sessions.mjs');

      // No args: must be a real usage error (exit 1, non-empty stderr naming the problem) —
      // not a silent exit 0 with empty output, which is what direct invocation did before
      // the entry-point guard existed.
      const errRun = spawnSync('node', [catSessionsPath], { cwd: fx.projectRoot, encoding: 'utf-8' });
      strictEqual(errRun.status, 1, `direct invocation with no args exits 1 (got ${errRun.status})`);
      ok(
        errRun.stderr.includes('cat-sessions requires <session-dir>'),
        `stderr names the missing arg (got: "${errRun.stderr}")`
      );

      // Valid args: must produce real stdout — proves the guard forwards process.argv.slice(2)
      // in the same shape dispatch() expects (matching scratch-memory.mjs's own call).
      const sd = setupSessionsDir(fx.projectRoot, 'int9');
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'dt9a01', goal: 'INT9 direct-invoke goal' });
      const okRun = spawnSync('node', [catSessionsPath, 'scratch/S-int9/'], { cwd: fx.projectRoot, encoding: 'utf-8' });
      strictEqual(okRun.status, 0, `direct invocation with valid args exits 0 (stderr: ${okRun.stderr})`);
      ok(okRun.stdout.includes('INT9 direct-invoke goal'), 'direct invocation stdout contains the session goal');
    } finally { fx.cleanup(); }
  });

  // LST1: FIX 2 — handoff list on a v3-pointer folder no longer shows "(unknown)"; last_updated
  // falls back to last_pointer_rewrite for the sort key, --json field, and human LAST_UPDATED column.
  await runTest('LST1: handoff list on a v3 pointer — no "(unknown)", --json last_updated === last_pointer_rewrite', async () => {
    const fx = createFixture();
    try {
      const sessionId = 'lst1-v3';
      const sd = setupSessionsDir(fx.projectRoot, sessionId);
      makeSession(sd, '2026-01-01T10:00:00.000Z', { shortid: 'lst1sess', goal: 'FIX 2 list test', nbs: 'Verify list output' });
      const rwp = runCli(['rewrite-pointer', `scratch/S-${sessionId}/`], { cwd: fx.projectRoot });
      strictEqual(rwp.exitCode, 0, `rewrite-pointer exit 0 (stderr: ${rwp.stderr})`);

      const handoffContent = readFileSync(join(fx.projectRoot, 'scratch', `S-${sessionId}`, 'HANDOFF.md'), 'utf-8');
      const rewriteMatch = handoffContent.match(/^last_pointer_rewrite:\s*(.+)$/m);
      ok(rewriteMatch, 'pointer has a last_pointer_rewrite value to compare against');
      const lastPointerRewrite = rewriteMatch[1].trim();

      const human = runCli(['handoff', 'list'], { cwd: fx.projectRoot });
      strictEqual(human.exitCode, 0, `handoff list exit 0 (stderr: ${human.stderr})`);
      ok(!human.stdout.includes('(unknown)'), `human-mode row does not contain "(unknown)" (got: "${human.stdout}")`);

      const jsonResult = runCli(['handoff', 'list', '--json'], { cwd: fx.projectRoot });
      strictEqual(jsonResult.exitCode, 0, `handoff list --json exit 0 (stderr: ${jsonResult.stderr})`);
      const entries = JSON.parse(jsonResult.stdout);
      const entry = entries.find(e => e.folder === `S-${sessionId}`);
      ok(entry, `entry for S-${sessionId} present in --json output`);
      strictEqual(entry.last_updated, lastPointerRewrite, '--json last_updated === pointer last_pointer_rewrite');
    } finally {
      fx.cleanup();
    }
  });

  // ===========================================================================
  // PAR — Docs-parity tests: the /handoff command's Step 2 section list and the
  // handoff-methodology SKILL.md's Per-Session File Schema table must both match
  // EXPECTED_SESSION_SECTIONS (heading text and order) — this is the code-is-canonical
  // contract documented in SKILL.md's Sync Map. Both doc files live outside this
  // scripts dir and are absent from the marketplace-published copy of these scripts;
  // in that environment PAR1/PAR2 are skipped (not failed) so the suite stays green.
  // ===========================================================================

  const parRepoRoot = join(__dirname, '..', '..', '..', '..');
  const parHandoffCmdPath = join(parRepoRoot, '.claude', 'commands', 'handoff.md');
  const parPickupCmdPath = join(parRepoRoot, '.claude', 'commands', 'pickup.md');
  const parSkillMdPath = join(parRepoRoot, '.claude', 'skills', 'handoff-methodology', 'SKILL.md');

  // Slice `source` to the lines between the first line matching `headingRe` and the
  // next `## `-level heading (or EOF). Returns null if no line matches `headingRe`.
  function extractSection(source, headingRe) {
    const lines = source.split('\n');
    const startIdx = lines.findIndex(l => headingRe.test(l));
    if (startIdx === -1) return null;
    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (/^##\s+/.test(lines[i])) { endIdx = i; break; }
    }
    return lines.slice(startIdx, endIdx).join('\n');
  }

  // Same as extractSection, but bounds the slice at the next heading of level 1-3
  // (`#`, `##`, or `###`) rather than level-2 only. Needed for SKILL.md's `### `-level
  // subsections (e.g. "### Handoff disposition pass (Step 1b)"), where extractSection's
  // level-2-only terminator would run past sibling `### ` subsections to the next real
  // `## ` heading, pulling in unrelated content.
  function extractSectionAnyLevel(source, headingRe) {
    const lines = source.split('\n');
    const startIdx = lines.findIndex(l => headingRe.test(l));
    if (startIdx === -1) return null;
    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (/^#{1,3}\s+/.test(lines[i])) { endIdx = i; break; }
    }
    return lines.slice(startIdx, endIdx).join('\n');
  }

  if (!existsSync(parHandoffCmdPath) || !existsSync(parPickupCmdPath) || !existsSync(parSkillMdPath)) {
    process.stdout.write('SKIP: PAR1, PAR2, PAR3, PAR4, PAR5, PAR6, PAR7 — /handoff command, /pickup command, or handoff-methodology SKILL.md not found (marketplace-published scripts copy)\n');
  } else {
    // PAR1: /handoff Step 2 numbered section list matches EXPECTED_SESSION_SECTIONS
    await runTest('PAR1: /handoff Step 2 numbered section list matches EXPECTED_SESSION_SECTIONS', async () => {
      const cmdSource = readFileSync(parHandoffCmdPath, 'utf-8');
      const step2 = extractSection(cmdSource, /^##\s+Step 2\b/);
      ok(step2, 'command file has a ## Step 2 section');
      const headings = [];
      for (const line of step2.split('\n')) {
        const m = line.match(/^\d+\.\s+`(## .+?)`/);
        if (m) headings.push(m[1]);
      }
      deepStrictEqual(headings, EXPECTED_SESSION_SECTIONS, `Step 2 headings match EXPECTED_SESSION_SECTIONS (got: ${JSON.stringify(headings)})`);
    });

    // PAR2: SKILL.md Per-Session File Schema table matches EXPECTED_SESSION_SECTIONS
    await runTest('PAR2: handoff-methodology SKILL.md Per-Session File Schema table matches EXPECTED_SESSION_SECTIONS', async () => {
      const skillSource = readFileSync(parSkillMdPath, 'utf-8');
      const section = extractSection(skillSource, /^##\s+Per-Session File Schema\b/);
      ok(section, 'SKILL.md has a ## Per-Session File Schema section');
      const headings = [];
      for (const line of section.split('\n')) {
        const m = line.match(/^\|\s*`(## .+?)`\s*\|/);
        if (m) headings.push(m[1]);
      }
      deepStrictEqual(headings, EXPECTED_SESSION_SECTIONS, `Per-Session File Schema table headings match EXPECTED_SESSION_SECTIONS (got: ${JSON.stringify(headings)})`);
    });

    // PAR3: Done / Decisions made / What to avoid are documented as per-session deltas
    // in both normative copies (D12) — the cumulative→delta contract redefinition.
    await runTest('PAR3: Done / Decisions made / What to avoid are documented as per-session deltas in both normative copies', async () => {
      const cmdSource = readFileSync(parHandoffCmdPath, 'utf-8');
      const skillSource = readFileSync(parSkillMdPath, 'utf-8');
      const step2 = extractSection(cmdSource, /^##\s+Step 2\b/);
      ok(step2, 'command file has a ## Step 2 section');
      const schema = extractSection(skillSource, /^##\s+Per-Session File Schema\b/);
      ok(schema, 'SKILL.md has a ## Per-Session File Schema section');

      const headings = ['## Done', '## Decisions made', '## What to avoid'];
      for (const heading of headings) {
        const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const itemLine = step2.split('\n').find(l => new RegExp(`^\\d+\\.\\s+\`${escaped}\``).test(l));
        ok(itemLine, `/handoff Step 2 has a numbered item for ${heading}`);
        ok(/delta/i.test(itemLine), `${heading} Step 2 item mentions "delta" (got: ${itemLine})`);
        ok(!/cumulative/i.test(itemLine), `${heading} Step 2 item does not mention "cumulative" (got: ${itemLine})`);

        const rowLine = schema.split('\n').find(l => new RegExp(`^\\|\\s*\`${escaped}\`\\s*\\|`).test(l));
        ok(rowLine, `SKILL.md Per-Session File Schema table has a row for ${heading}`);
        ok(/delta/i.test(rowLine), `${heading} schema row mentions "delta" (got: ${rowLine})`);
        ok(!/cumulative/i.test(rowLine), `${heading} schema row does not mention "cumulative" (got: ${rowLine})`);
      }
    });

    // PAR4: /handoff grants cat-sessions and carries a Step 1b disposition pass (D16).
    await runTest('PAR4: /handoff grants cat-sessions and carries a Step 1b disposition pass', async () => {
      const cmdSource = readFileSync(parHandoffCmdPath, 'utf-8');
      const skillSource = readFileSync(parSkillMdPath, 'utf-8');

      const allowedToolsLine = cmdSource.split('\n').find(l => l.startsWith('allowed-tools:'));
      ok(allowedToolsLine, '/handoff has an allowed-tools: line');
      ok(allowedToolsLine.includes('scratch-memory cat-sessions'), `allowed-tools: grants scratch-memory cat-sessions (got: ${allowedToolsLine})`);

      const step1b = extractSection(cmdSource, /^##\s+Step 1b\b/);
      ok(step1b, 'command file has a ## Step 1b section');
      ok(step1b.includes('--format json'), 'Step 1b section contains --format json');
      ok(step1b.includes('RESOLVED: closed —'), 'Step 1b section contains the literal "RESOLVED: closed —"');
      ok(step1b.includes('exited 1'), 'Step 1b section contains the "exited 1" skip-note branch');
      ok(step1b.includes('exited 2'), 'Step 1b section contains the "exited 2" skip-note branch');
      ok(step1b.includes('STILL OPEN'), 'Step 1b section contains the STILL-OPEN acknowledgment guard');

      const skillStep1b = extractSectionAnyLevel(skillSource, /^###\s+Handoff disposition pass \(Step 1b\)/);
      ok(skillStep1b, 'SKILL.md has a ### Handoff disposition pass (Step 1b) section');
      ok(skillStep1b.includes('STILL OPEN'), 'SKILL.md Step 1b mirror section contains the STILL-OPEN acknowledgment guard');
    });

    // PAR5: /pickup carries a non-blocking stale-question triage nudge (D17).
    await runTest('PAR5: /pickup carries a non-blocking stale-question triage nudge', async () => {
      const cmdSource = readFileSync(parPickupCmdPath, 'utf-8');

      const step6a = extractSection(cmdSource, /^##\s+Step 6a\b/);
      ok(step6a, 'command file has a ## Step 6a section');
      ok(step6a.includes('age:'), 'Step 6a section contains the token "age:"');
      ok(step6a.includes('3'), 'Step 6a section contains the threshold "3"');
      ok(step6a.includes('TRIAGE:'), 'Step 6a section contains the string "TRIAGE:"');
      ok(/non-blocking/.test(step6a), 'Step 6a section contains the word "non-blocking"');

      ok(!cmdSource.includes('AskUserQuestion'), '/pickup does not contain "AskUserQuestion"');
    });

    // PAR6 and PAR7 assert on handoff-methodology/SKILL.md content that plan step 08b
    // writes (the ## Tasks section, the amended cat-sessions contract, and the Sync Map
    // row for Step 1c). Both are written here in step 06 — the same step that makes the
    // command edits — per decisions.md D-Sync-Map-obligation / session-tasks spec.md's
    // Documentation & Sync Map section: the pairing must be visible at the moment the
    // contract changes, not deferred to the docs step. Expect PAR6 and PAR7 red until
    // step 08b lands; step 08b's acceptance criteria require PAR1-PAR7 all green.

    // PAR6: /pickup requests tasks in the brief and the skill documents the flag.
    await runTest('PAR6: /pickup requests tasks in the brief and the skill documents the flag', async () => {
      const pickupSource = readFileSync(parPickupCmdPath, 'utf-8');
      const skillSource = readFileSync(parSkillMdPath, 'utf-8');

      const step6 = extractSection(pickupSource, /^##\s+Step 6\b/);
      ok(step6, '/pickup has a ## Step 6 section');
      ok(step6.includes('--with-tasks'), `Step 6 section contains --with-tasks (got: ${step6})`);
      ok(step6.includes('## Tasks'), 'Step 6 section contains the literal "## Tasks"');
      ok(step6.includes('WARN:'), 'Step 6 section contains the literal "WARN:"');

      const catContract = extractSectionAnyLevel(skillSource, /^###\s+cat-sessions contract\b/);
      ok(catContract, 'SKILL.md has a ### cat-sessions contract section');
      ok(catContract.includes('--with-tasks'), 'cat-sessions contract documents --with-tasks');
      ok(catContract.includes('tasks'), 'cat-sessions contract documents the tasks json field');
      ok(catContract.includes('task_warnings'), 'cat-sessions contract documents the task_warnings json field');
    });

    // PAR7: /handoff carries the Step 1c lint and the Sync Map names it.
    await runTest('PAR7: /handoff carries the Step 1c lint and the Sync Map names it', async () => {
      const handoffSource = readFileSync(parHandoffCmdPath, 'utf-8');
      const skillSource = readFileSync(parSkillMdPath, 'utf-8');

      const allowedToolsLine = handoffSource.split('\n').find(l => l.startsWith('allowed-tools:'));
      ok(allowedToolsLine, '/handoff has an allowed-tools: line');
      ok(allowedToolsLine.includes('scratch-memory tasks'), `allowed-tools: grants scratch-memory tasks (got: ${allowedToolsLine})`);

      ok(/^##\s+Step 1c\b/m.test(handoffSource), '/handoff has a ## Step 1c heading');

      const step1c = extractSection(handoffSource, /^##\s+Step 1c\b/);
      ok(step1c, 'command file has a ## Step 1c section');
      ok(step1c.includes('tasks lint'), 'Step 1c section contains "tasks lint"');
      ok(step1c.includes('read-only'), 'Step 1c section contains "read-only"');
      ok(step1c.includes('exit 1'), 'Step 1c section contains the "exit 1" token');
      ok(step1c.includes('exit 2'), 'Step 1c section contains the "exit 2" token');

      const syncMap = extractSection(skillSource, /^##\s+Sync Map\b/);
      ok(syncMap, 'SKILL.md has a ## Sync Map section');
      ok(syncMap.includes('Step 1c'), 'Sync Map names Step 1c');

      // Guard assertion: the cheapest possible regression test for an accidental
      // renumber — assert the full ## Step heading order in /handoff.
      const stepHeadings = handoffSource
        .split('\n')
        .filter(l => /^##\s+Step\b/.test(l))
        .map(l => l.match(/^##\s+(Step\s*\S*)/)[1]);
      deepStrictEqual(
        stepHeadings,
        ['Step 1', 'Step 1b', 'Step 1c', 'Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 6'],
        `/handoff Step heading order (got: ${JSON.stringify(stepHeadings)})`
      );
    });
  }

  process.stdout.write(`${passCount} passed, ${failCount} failed\n`);
  process.exit(failCount === 0 ? 0 : 1);
})();
