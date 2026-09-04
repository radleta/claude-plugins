#!/usr/bin/env node
// test-write-task.mjs — Zero-framework end-to-end test harness for the write_task MCP tool.
// Usage: node test-write-task.mjs    (no args; 28 tests run in-process; exit 0 on all-pass)
//
// Modeled on the sibling test-write-issue.mjs: the same hand-rolled runTest()/PASS:/FAIL:
// harness, the same signal handlers, the same createDriver() shape spawning server.mjs and
// speaking raw JSON-RPC over stdio, and the same local parseFrontmatter() helper. Every case
// drives write_task through the real server process via createDriver() — none imports
// writeTask() directly — so the TOOLS registry entry and the handleCall() dispatch branch are
// exercised, not just the handler function in isolation.
//
// Fixture choice: createNonRepoFixture() (plain mkdtempSync, no git) is the default for every
// test below, because writeTask() gathers no git state at all (unlike write_issue). WT21 is
// the sole exception — it drives `scratch-memory tasks lint` through the real CLI, and
// resolveProjectRoot() (handoff.mjs) requires a real .git boundary to walk up to, so that one
// test uses the dedicated createGitFixture() helper instead.

import { spawn, execFileSync } from 'node:child_process';
import {
  mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync,
} from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import { deepStrictEqual, strictEqual, ok, fail } from 'node:assert';
import process from 'node:process';

import { lintTaskFile, scanTasks, TASK_STATUS, MAX_BLOCKED_ON_LEN } from './tasks.mjs';
import { runCli } from './test-driver.mjs';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('Usage: node test-write-task.mjs\n\nRuns 28 automated tests against server.mjs. Exit 0 on all-pass, 1 otherwise.\n');
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

const SERVER_PATH = fileURLToPath(new URL('./server.mjs', import.meta.url));
// Mirrors server.mjs's own MAX_BODY_BYTES constant (1 MB). Duplicated, not imported — every
// case in this suite drives the tool over the wire, never by importing server internals.
const MAX_BODY_BYTES = 1_048_576;
let passCount = 0;
let failCount = 0;
const activeDrivers = new Set();  // registered drivers; used by SIGINT guard
const activeFixtures = new Set(); // registered fixtures; used by SIGINT guard

async function runTest(name, fn) {
  try {
    await fn();
    passCount++;
    process.stdout.write(`PASS: ${name}\n`);
  } catch (err) {
    failCount++;
    process.stdout.write(`FAIL: ${name}\n`);
    // err.stack's first line repeats err.message, so start slice at 1 to avoid duplicate.
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

process.on('SIGINT', () => {
  for (const d of activeDrivers) {
    try { d.kill(); } catch {}
  }
  for (const f of activeFixtures) {
    try { rmSync(f, { recursive: true, force: true }); } catch {}
  }
  process.stderr.write('HARNESS-INTERRUPTED\n');
  process.exit(130);
});

// createDriver() — spawns server.mjs and speaks JSON-RPC over stdio. Beyond
// test-write-issue.mjs's shape, this driver adds three things the write_task
// error-channel and integration tests need: (1) callRaw()/callToolRaw(), which
// resolve with the *whole* JSON-RPC frame (never reject on an error frame) so a
// test can inspect error.code/error.data directly instead of only a thrown
// Error's message string; (2) stdoutLines(), mirroring stderrLines(), capturing
// every raw stdout line (parseable or not) so stray non-JSON output is
// detectable; (3) getExitCode(), exposing the child's exit code after shutdown().
async function createDriver(projectRoot) {
  const child = spawn('node', [SERVER_PATH, '--project-root', projectRoot], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  });
  activeDrivers.add(child);

  const pending = new Map(); // id -> { resolve, timer }
  let nextId = 1;
  const stderrLog = [];
  const stdoutRawLog = [];
  let exitCode = null;
  child.on('exit', (code) => { exitCode = code; });

  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    stdoutRawLog.push(trimmed);
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return; // malformed line — retained in stdoutRawLog for the stdio-cleanliness check
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, timer } = pending.get(msg.id);
      clearTimeout(timer);
      pending.delete(msg.id);
      resolve(msg); // always resolves with the raw frame; call() below unwraps/throws
    }
  });

  const rlErr = createInterface({ input: child.stderr, crlfDelay: Infinity });
  rlErr.on('line', (line) => stderrLog.push(line));

  function callRaw(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`JSON-RPC call timed out after 10s: ${method}`));
      }, 10_000);
      pending.set(id, { resolve, timer });
      const msg = { jsonrpc: '2.0', id, method, params: params ?? {} };
      child.stdin.write(JSON.stringify(msg) + '\n');
    });
  }

  async function call(method, params) {
    const msg = await callRaw(method, params);
    if (msg.error) {
      const err = new Error(`JSON-RPC error ${msg.error.code}: ${msg.error.message}`);
      err.code = msg.error.code;
      err.data = msg.error.data;
      throw err;
    }
    return msg.result;
  }

  async function callTool(name, args) {
    return await call('tools/call', { name, arguments: args });
  }

  async function callToolRaw(name, args) {
    return await callRaw('tools/call', { name, arguments: args });
  }

  function stderrLines() {
    const snap = stderrLog.slice();
    stderrLog.length = 0;
    return snap;
  }

  function stdoutLines() {
    const snap = stdoutRawLog.slice();
    stdoutRawLog.length = 0;
    return snap;
  }

  function getExitCode() {
    return exitCode;
  }

  async function shutdown() {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        try { child.kill(); } catch {}
        resolve();
      }, 2_000);
      child.once('exit', () => {
        clearTimeout(timer);
        activeDrivers.delete(child);
        resolve();
      });
      try { child.stdin.end(); } catch {}
    });
  }

  // MCP initialize handshake — fail fast if the server doesn't respond.
  await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test-harness', version: '0' } });
  return { call, callTool, callRaw, callToolRaw, stderrLines, stdoutLines, getExitCode, shutdown, child };
}

// createNonRepoFixture() — plain mkdtempSync, no git. Copied verbatim from
// test-write-issue.mjs:164-174 (not exported there, so duplicated here per this
// file's own harness — see the file header for why this is the suite default).
function createNonRepoFixture() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'smcp-'));
  activeFixtures.add(projectRoot);
  return {
    projectRoot,
    cleanup() {
      try { rmSync(projectRoot, { recursive: true, force: true }); } catch {}
      activeFixtures.delete(projectRoot);
    },
  };
}

// createGitFixture() — a real `git init` + config + empty commit, mirroring
// test-write-issue.mjs's createRealRepoFixture() but trimmed to a single commit
// (no branch/commit history assertions need it here). Used ONLY by WT21, which
// drives `scratch-memory tasks lint` through the real CLI — resolveProjectRoot()
// requires a genuine .git boundary to walk up to, unlike every other test in this
// file, which talks to write_task directly over JSON-RPC and needs no git at all.
function createGitFixture() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'smcp-'));
  activeFixtures.add(projectRoot);
  execFileSync('git', ['init', '--quiet'], { cwd: projectRoot, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectRoot, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: projectRoot, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'init', '--allow-empty', '--quiet'], { cwd: projectRoot, stdio: 'ignore' });
  return {
    projectRoot,
    cleanup() {
      try { rmSync(projectRoot, { recursive: true, force: true }); } catch {}
      activeFixtures.delete(projectRoot);
    },
  };
}

// --- Helper: parse frontmatter from file content ---
// Returns { fields: Record<string,string>, bodyLines: string[] }
// Copied from test-write-issue.mjs:176-192 (not exported there either).
function parseFrontmatter(content) {
  const lines = content.split('\n');
  if (lines[0] !== '---') throw new Error('No opening --- in frontmatter');
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { closeIdx = i; break; }
  }
  if (closeIdx === -1) throw new Error('No closing --- in frontmatter');
  const fields = {};
  for (let i = 1; i < closeIdx; i++) {
    const m = lines[i].match(/^([^:]+):\s*(.*)/);
    if (m) fields[m[1].trim()] = m[2].trim();
  }
  return { fields, bodyLines: lines.slice(closeIdx + 1) };
}

// Reverses writeTask's title/blocked_on quoting (server.mjs's escapedTitle/
// escapedBlockedOn treatment) for values with no embedded backslash or quote —
// every value this suite writes falls in that case, so a full unescape isn't needed.
function unquoteSimple(value) {
  if (typeof value === 'string' && value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

function taskFilesIn(tasksDir) {
  return readdirSync(tasksDir).filter((n) => n.startsWith('t-') && n.endsWith('.md'));
}

(async () => {

  // -------------------------------------------------------------------------
  // Unit tests (WT1-WT16)
  // -------------------------------------------------------------------------

  await runTest('WT1: happy path — return shape, file existence, filename pattern', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.callTool('write_task', { session_id: 'wt1', title: 'Happy path task' });
      const payload = JSON.parse(result.content[0].text);
      deepStrictEqual(Object.keys(payload).sort(), ['id', 'path', 'status', 'title']);
      strictEqual(payload.status, 'open', 'status defaults to open');
      strictEqual(payload.title, 'Happy path task');
      ok(existsSync(payload.path), `file exists at ${payload.path}`);
      const tasksDir = join(fx.projectRoot, 'scratch', 'S-wt1', 'tasks');
      ok(existsSync(tasksDir), 'tasks/ directory exists');
      const files = taskFilesIn(tasksDir);
      strictEqual(files.length, 1, 'exactly one t-*.md file written');
      ok(/^t-[0-9a-f]{6}-.+\.md$/.test(files[0]), `filename matches ^t-[0-9a-f]{6}-.+\\.md$: "${files[0]}"`);
      ok(/^t-[0-9a-f]{6}$/.test(payload.id), `returned id matches t-[0-9a-f]{6}: "${payload.id}"`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT2: frontmatter shape — exact keys in order, created===updated, id matches filename', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.callTool('write_task', { session_id: 'wt2', title: 'Frontmatter shape task' });
      const payload = JSON.parse(result.content[0].text);
      const content = readFileSync(payload.path, 'utf-8');
      const { fields } = parseFrontmatter(content);
      deepStrictEqual(Object.keys(fields), ['id', 'title', 'status', 'created', 'updated'],
        'frontmatter keys are exactly id, title, status, created, updated, in that order');
      ok(!('tool' in fields), 'no tool: key');
      ok(!('blocked_on' in fields), 'no blocked_on: key when not supplied');
      ok(!('promoted_to' in fields), 'no promoted_to: key');
      strictEqual(fields.created, fields.updated, 'created === updated at creation');
      strictEqual(fields.id, payload.id, 'frontmatter id (bare, unquoted) === returned id');
      const basename = payload.path.split(/[/\\]/).pop();
      ok(basename.startsWith(`${payload.id}-`), `filename "${basename}" starts with "${payload.id}-"`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT3: writer/linter agreement — lintTaskFile returns [] for every file this test writes', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const calls = [
        { session_id: 'wt3', title: 'Minimal task' },
        { session_id: 'wt3', title: 'Task with body', body: 'Some freeform notes.' },
        { session_id: 'wt3', title: 'Blocked task', status: 'blocked', blocked_on: 'waiting on review' },
      ];
      const paths = [];
      for (const args of calls) {
        const result = await drv.callTool('write_task', args);
        paths.push(JSON.parse(result.content[0].text).path);
      }
      for (const p of paths) {
        const content = readFileSync(p, 'utf-8');
        deepStrictEqual(lintTaskFile(p, content), [], `lintTaskFile([]) for ${p}`);
      }
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT4: status enum rejection — invalid status -> STATUS_INVALID, no file created', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      let threw = false;
      try {
        await drv.callTool('write_task', { session_id: 'wt4', title: 'Bad status task', status: 'in-progress' });
      } catch (err) {
        threw = true;
        ok(err.message.includes('-32602'), `error message contains "-32602": "${err.message}"`);
        ok(/STATUS_INVALID/.test(err.message), `error message references STATUS_INVALID: "${err.message}"`);
      }
      ok(threw, 'callTool rejected for status=in-progress');
      ok(!existsSync(join(fx.projectRoot, 'scratch', 'S-wt4', 'tasks')), 'no tasks/ directory created');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT5: session_id rejection — charset variants (SESSION_ID_INVALID) and empty (SESSION_ID_REQUIRED)', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const scratchRoot = join(fx.projectRoot, 'scratch');
      const before = existsSync(scratchRoot) ? readdirSync(scratchRoot).sort() : [];

      for (const bad of ['a b', '../escape', '.hidden', 'a/b']) {
        let threw = false;
        try {
          await drv.callTool('write_task', { session_id: bad, title: 'Charset rejection test' });
        } catch (err) {
          threw = true;
          ok(/SESSION_ID_INVALID/.test(err.message), `"${bad}" -> SESSION_ID_INVALID: "${err.message}"`);
        }
        ok(threw, `callTool rejected for session_id=${JSON.stringify(bad)}`);
      }

      let threwEmpty = false;
      try {
        await drv.callTool('write_task', { session_id: '', title: 'Empty session_id test' });
      } catch (err) {
        threwEmpty = true;
        ok(/SESSION_ID_REQUIRED/.test(err.message), `empty session_id -> SESSION_ID_REQUIRED: "${err.message}"`);
      }
      ok(threwEmpty, 'callTool rejected for empty session_id');

      const after = existsSync(scratchRoot) ? readdirSync(scratchRoot).sort() : [];
      deepStrictEqual(after, before, 'no new entries appeared under scratch/ from any rejected call');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT6: title length — omitted (TITLE_REQUIRED), 81 chars (TITLE_INVALID), 80 chars (ok), whitespace-only (TITLE_INVALID)', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline

      let threwRequired = false;
      try {
        await drv.callTool('write_task', { session_id: 'wt6', body: 'no title supplied' });
      } catch (err) {
        threwRequired = true;
        ok(/TITLE_REQUIRED/.test(err.message), `missing title -> TITLE_REQUIRED: "${err.message}"`);
      }
      ok(threwRequired, 'callTool rejected for missing title');

      let threwTooLong = false;
      try {
        await drv.callTool('write_task', { session_id: 'wt6', title: 'a'.repeat(81) });
      } catch (err) {
        threwTooLong = true;
        ok(/TITLE_INVALID/.test(err.message), `81-char title -> TITLE_INVALID: "${err.message}"`);
      }
      ok(threwTooLong, 'callTool rejected for 81-char title');

      const result = await drv.callTool('write_task', { session_id: 'wt6', title: 'a'.repeat(80) });
      const payload = JSON.parse(result.content[0].text);
      ok(typeof payload.path === 'string' && payload.path.length > 0, '80-char title succeeds');

      let threwWhitespace = false;
      try {
        await drv.callTool('write_task', { session_id: 'wt6', title: '          ' });
      } catch (err) {
        threwWhitespace = true;
        ok(/TITLE_INVALID/.test(err.message), `whitespace-only title -> TITLE_INVALID: "${err.message}"`);
      }
      ok(threwWhitespace, 'callTool rejected for whitespace-only title');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT7: body cap — too-large (BODY_TOO_LARGE), non-string (BODY_INVALID), small verbatim, omitted no placeholder', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline

      let threwTooLarge = false;
      try {
        await drv.callTool('write_task', { session_id: 'wt7', title: 'Oversized body task', body: 'a'.repeat(MAX_BODY_BYTES + 1) });
      } catch (err) {
        threwTooLarge = true;
        ok(/BODY_TOO_LARGE/.test(err.message), `oversized body -> BODY_TOO_LARGE: "${err.message}"`);
      }
      ok(threwTooLarge, 'callTool rejected for oversized body');

      let threwInvalid = false;
      try {
        await drv.callTool('write_task', { session_id: 'wt7', title: 'Non-string body task', body: 123 });
      } catch (err) {
        threwInvalid = true;
        ok(/BODY_INVALID/.test(err.message), `non-string body -> BODY_INVALID: "${err.message}"`);
      }
      ok(threwInvalid, 'callTool rejected for non-string body (BODY_INVALID)');

      const smallBody = 'Some freeform body content.';
      const result = await drv.callTool('write_task', { session_id: 'wt7', title: 'Small body task', body: smallBody });
      const payload = JSON.parse(result.content[0].text);
      const content = readFileSync(payload.path, 'utf-8');
      const { bodyLines } = parseFrontmatter(content);
      strictEqual(bodyLines.join('\n'), smallBody + '\n', 'body is written verbatim, immediately after the frontmatter');

      const omittedResult = await drv.callTool('write_task', { session_id: 'wt7', title: 'Omitted body task' });
      const omittedPayload = JSON.parse(omittedResult.content[0].text);
      const omittedContent = readFileSync(omittedPayload.path, 'utf-8');
      ok(!omittedContent.includes('_Not captured._'), 'omitted body produces no placeholder text anywhere');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT8: collision re-mint — 50 calls against a 16-file seeded prefix, all ids unique, no -2 suffix', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const sessionId = 'wt8';
      const tasksDir = join(fx.projectRoot, 'scratch', `S-${sessionId}`, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      const seededIds = new Set();
      for (let i = 0; i < 16; i++) {
        const hex = i.toString(16).padStart(2, '0');
        const id = `t-0000${hex}`;
        seededIds.add(id);
        writeFileSync(join(tasksDir, `${id}-seed.md`), '---\nid: ' + id + '\n---\n', 'utf-8');
      }

      // Same title on every call, deliberately — deriveSlug() is a pure function of
      // the title, so embedding a numeric counter in the title would make some
      // slugs end in a digit and produce a false "-2.md" match below that has
      // nothing to do with collision handling. A constant title also means this
      // test doubles as a 50-call version of WT13's no-clobber guarantee.
      const mintedIds = new Set();
      for (let i = 0; i < 50; i++) {
        const result = await drv.callTool('write_task', { session_id: sessionId, title: 'Collision remint test' });
        const payload = JSON.parse(result.content[0].text);
        ok(!seededIds.has(payload.id), `minted id "${payload.id}" does not equal a seeded id`);
        ok(!mintedIds.has(payload.id), `minted id "${payload.id}" is unique among this run's ids`);
        mintedIds.add(payload.id);
      }
      strictEqual(mintedIds.size, 50, 'all 50 minted ids are distinct');

      const allNames = readdirSync(tasksDir);
      ok(!allNames.some((n) => /-2\.md$/.test(n)), 'no filename ever gains a -2 suffix');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT9: blocked_on passthrough — carried when supplied, omitted entirely when not', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.callTool('write_task', {
        session_id: 'wt9', title: 'Blocked task', status: 'blocked', blocked_on: 'main rebase',
      });
      const payload = JSON.parse(result.content[0].text);
      const content = readFileSync(payload.path, 'utf-8');
      const { fields } = parseFrontmatter(content);
      strictEqual(unquoteSimple(fields.blocked_on), 'main rebase', 'blocked_on carries the supplied value');

      const noBlockedResult = await drv.callTool('write_task', { session_id: 'wt9', title: 'Unblocked task' });
      const noBlockedPayload = JSON.parse(noBlockedResult.content[0].text);
      const noBlockedContent = readFileSync(noBlockedPayload.path, 'utf-8');
      const { fields: fields2 } = parseFrontmatter(noBlockedContent);
      ok(!('blocked_on' in fields2), 'call without blocked_on omits the key entirely');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT10: blocked_on bound — 121 chars / empty / whitespace-only rejected, 120 succeeds verbatim, CR/LF-130 succeeds normalized', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline

      for (const bad of ['x'.repeat(121), '', '   ']) {
        let threw = false;
        try {
          await drv.callTool('write_task', { session_id: 'wt10', title: 'Blocked bound test', status: 'blocked', blocked_on: bad });
        } catch (err) {
          threw = true;
          ok(/BLOCKED_ON_INVALID/.test(err.message), `blocked_on=${JSON.stringify(bad)} -> BLOCKED_ON_INVALID: "${err.message}"`);
        }
        ok(threw, `callTool rejected for blocked_on=${JSON.stringify(bad)}`);
      }
      ok(!existsSync(join(fx.projectRoot, 'scratch', 'S-wt10', 'tasks')), 'no tasks/ directory created by any rejected call');

      const exact120 = 'x'.repeat(120);
      const okResult = await drv.callTool('write_task', { session_id: 'wt10', title: '120-char bound test', status: 'blocked', blocked_on: exact120 });
      const okPayload = JSON.parse(okResult.content[0].text);
      const okContent = readFileSync(okPayload.path, 'utf-8');
      const { fields: okFields } = parseFrontmatter(okContent);
      strictEqual(unquoteSimple(okFields.blocked_on), exact120, '120-char blocked_on round-trips verbatim');

      // 130 raw chars, but only over-length because of one embedded CR/LF run in the
      // middle — collapses to a single space, leaving 111 normalized chars (<=120).
      const crlfValue = 'a'.repeat(60) + '\r\n'.repeat(10) + 'b'.repeat(50);
      strictEqual(crlfValue.length, 130, 'sanity: raw blocked_on is 130 chars');
      const crlfResult = await drv.callTool('write_task', { session_id: 'wt10', title: 'CRLF bound test', status: 'blocked', blocked_on: crlfValue });
      const crlfPayload = JSON.parse(crlfResult.content[0].text);
      const crlfContent = readFileSync(crlfPayload.path, 'utf-8');
      const { fields: crlfFields } = parseFrontmatter(crlfContent);
      const expectedNormalized = 'a'.repeat(60) + ' ' + 'b'.repeat(50);
      strictEqual(expectedNormalized.length, 111, 'sanity: normalized value is 111 chars');
      strictEqual(unquoteSimple(crlfFields.blocked_on), expectedNormalized,
        'the bound is applied after CR/LF normalization, not before — the written value is the collapsed form');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT11: blocked_on bound is declared in the schema, not just enforced', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.call('tools/list', {});
      const tool = result.tools.find((t) => t.name === 'write_task');
      ok(tool !== undefined, 'write_task present in tools/list');
      strictEqual(tool.inputSchema.properties.blocked_on.maxLength, MAX_BLOCKED_ON_LEN,
        `inputSchema.properties.blocked_on.maxLength === ${MAX_BLOCKED_ON_LEN}`);
      strictEqual(tool.inputSchema.properties.blocked_on.minLength, 1,
        'inputSchema.properties.blocked_on.minLength === 1');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT12: audit line — appended on success, not appended on a failed call', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.callTool('write_task', { session_id: 'wt12', title: 'Audit line test' });
      const payload = JSON.parse(result.content[0].text);
      const auditPath = join(fx.projectRoot, 'scratch', '.scratch-memory', 'audit.jsonl');
      ok(existsSync(auditPath), 'audit.jsonl exists');
      const linesBefore = readFileSync(auditPath, 'utf-8').trim().split('\n').filter(Boolean);
      const last = JSON.parse(linesBefore[linesBefore.length - 1]);
      strictEqual(last.tool, 'write_task');
      strictEqual(last.project, 'tasks');
      strictEqual(last.path, payload.path);

      let threw = false;
      try {
        await drv.callTool('write_task', { session_id: 'wt12', title: 'Audit line test', status: 'not-a-status' });
      } catch {
        threw = true;
      }
      ok(threw, 'the second call was rejected');
      const linesAfter = readFileSync(auditPath, 'utf-8').trim().split('\n').filter(Boolean);
      strictEqual(linesAfter.length, linesBefore.length, 'no new audit line appended after a failed call');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT13: idempotency/no-clobber — two calls with the same title produce two files with distinct ids', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const title = 'Repeated title task';
      const r1 = await drv.callTool('write_task', { session_id: 'wt13', title });
      const r2 = await drv.callTool('write_task', { session_id: 'wt13', title });
      const p1 = JSON.parse(r1.content[0].text);
      const p2 = JSON.parse(r2.content[0].text);
      ok(p1.id !== p2.id, 'the two calls minted different ids');
      ok(existsSync(p1.path) && existsSync(p2.path), 'both files exist — neither overwrote the other');
      strictEqual(taskFilesIn(join(fx.projectRoot, 'scratch', 'S-wt13', 'tasks')).length, 2, 'exactly two files on disk');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT14: directory creation — a session with no sessions/ dir still succeeds and creates tasks/', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const workstreamFolder = join(fx.projectRoot, 'scratch', 'S-wt14');
      ok(!existsSync(workstreamFolder), 'workstream folder does not pre-exist');
      const result = await drv.callTool('write_task', { session_id: 'wt14', title: 'No sessions dir task' });
      const payload = JSON.parse(result.content[0].text);
      ok(existsSync(payload.path), 'file exists');
      ok(existsSync(join(workstreamFolder, 'tasks')), 'tasks/ was created');
      ok(!existsSync(join(workstreamFolder, 'sessions')), 'sessions/ was never created — not this tool\'s job');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT15: malformed-XML rejection — MALFORMED_TOOL_CALL_XML, no file created', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const malformed =
        'body text</intent>\n<parameter name="impact">impact body text</impact>\n<parameter name="related">related body text';
      let threw = false;
      try {
        await drv.callTool('write_task', { session_id: 'wt15', title: 'Malformed XML task', body: malformed });
        fail('expected MALFORMED_TOOL_CALL_XML to be thrown');
      } catch (err) {
        threw = true;
        ok(/MALFORMED_TOOL_CALL_XML/.test(err.message), `error references MALFORMED_TOOL_CALL_XML: "${err.message}"`);
      }
      ok(threw, 'callTool rejected for malformed XML in body');
      ok(!existsSync(join(fx.projectRoot, 'scratch', 'S-wt15', 'tasks')), 'no tasks/ directory created');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT16: validation order — session_id failure reported before a co-occurring title failure', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      let threw = false;
      try {
        await drv.callTool('write_task', { session_id: 'a/b', title: 'a'.repeat(81) });
      } catch (err) {
        threw = true;
        ok(/SESSION_ID_INVALID/.test(err.message), `two invalid fields -> SESSION_ID_INVALID wins: "${err.message}"`);
        ok(!/TITLE_INVALID/.test(err.message), 'TITLE_INVALID is not reported when session_id already failed');
      }
      ok(threw, 'callTool rejected');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // Atomic-publish tests (WT17-WT21)
  // -------------------------------------------------------------------------

  await runTest('WT17: no partial file is ever observable across 20 sequential writes', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const sessionId = 'wt17';
      for (let i = 0; i < 20; i++) {
        await drv.callTool('write_task', { session_id: sessionId, title: `Sequential task ${i}` });
      }
      const workstreamFolder = join(fx.projectRoot, 'scratch', `S-${sessionId}`);
      const scan = scanTasks(workstreamFolder);
      strictEqual(scan.tasks.length, 20, 'scanTasks sees all 20 tasks');
      strictEqual(scan.warnings.length, 0, 'scanTasks reports zero warnings');
      for (const t of scan.tasks) {
        for (const key of ['id', 'title', 'status', 'created', 'updated']) {
          ok(t[key] !== undefined && t[key] !== '', `record has non-empty "${key}"`);
        }
      }
      const tasksDir = join(workstreamFolder, 'tasks');
      for (const name of taskFilesIn(tasksDir)) {
        const p = join(tasksDir, name);
        deepStrictEqual(lintTaskFile(p, readFileSync(p, 'utf-8')), [], `lintTaskFile([]) for ${name}`);
      }
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT18: no tmp residue on the success path', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await drv.callTool('write_task', { session_id: 'wt18', title: 'Success path residue test' });
      const tasksDir = join(fx.projectRoot, 'scratch', 'S-wt18', 'tasks');
      const entries = readdirSync(tasksDir);
      strictEqual(entries.length, 1, 'tasks/ holds exactly one entry');
      ok(entries.filter((n) => n.startsWith('.')).length === 0, 'no dot-prefixed entry after a successful call');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT19: no tmp residue on the validation-failure path', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await drv.callTool('write_task', { session_id: 'wt19', title: 'Existing legit task' });
      const tasksDir = join(fx.projectRoot, 'scratch', 'S-wt19', 'tasks');
      const before = readdirSync(tasksDir).sort();

      let threw = false;
      try {
        await drv.callTool('write_task', { session_id: 'wt19', title: 'Second task', status: 'bogus-status' });
      } catch {
        threw = true;
      }
      ok(threw, 'the invalid second call was rejected (validation throws before any mutation)');

      const after = readdirSync(tasksDir).sort();
      deepStrictEqual(after, before, 'tasks/ is unchanged by the rejected call');
      ok(after.filter((n) => n.startsWith('.')).length === 0, 'no dot-prefixed entry after the rejected call');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT20: filesystem branch — no orphan tmp anywhere reachable after a forced FS failure', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const sessionId = 'wt20';
      const workstreamFolder = join(fx.projectRoot, 'scratch', `S-${sessionId}`);
      mkdirSync(workstreamFolder, { recursive: true });
      // A plain FILE named exactly 'tasks' blocks the writer from ever creating the
      // real tasks/ directory — readdirSync(tasksDir) fails with ENOTDIR, which the
      // handler re-throws as FS_FAILURE before any tmp file is ever written.
      writeFileSync(join(workstreamFolder, 'tasks'), 'blocker', 'utf-8');

      let threw = false;
      try {
        await drv.callTool('write_task', { session_id: sessionId, title: 'Forced FS failure task' });
      } catch (err) {
        threw = true;
        ok(err.message.includes('-32000'), `forced FS failure is -32000: "${err.message}"`);
      }
      ok(threw, 'callTool rejected for the forced filesystem failure');

      const remaining = readdirSync(workstreamFolder);
      ok(remaining.filter((n) => n.startsWith('.')).length === 0, 'no dot-prefixed entry anywhere under the workstream folder');
      ok(statSync(join(workstreamFolder, 'tasks')).isFile(), 'the blocking "tasks" file is untouched');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT21: tmp files are invisible to scanTasks() and to `tasks lint`', async () => {
    const gfx = createGitFixture(); // needs a real .git boundary for the CLI's resolveProjectRoot()
    let drv;
    try {
      drv = await createDriver(gfx.projectRoot);
      drv.stderrLines(); // drain baseline
      const sessionId = 'wt21';
      const result = await drv.callTool('write_task', { session_id: sessionId, title: 'Real task alongside orphan' });
      const payload = JSON.parse(result.content[0].text);
      const workstreamFolder = join(gfx.projectRoot, 'scratch', `S-${sessionId}`);
      const tasksDir = join(workstreamFolder, 'tasks');
      const orphanPath = join(tasksDir, '.t-deadbe-orphan.md.tmp');
      writeFileSync(orphanPath, '---\nid: t-deadbe\ntitle: "Orphan"\nstatus: open\ncreated: 2026-01-01T00:00:00.000Z\nupdated: 2026-01-01T00:00:00.000Z\n---\n', 'utf-8');

      const scan = scanTasks(workstreamFolder);
      strictEqual(scan.tasks.length, 1, 'scanTasks sees only the real task, not the orphan tmp');
      strictEqual(scan.tasks[0].id, payload.id, 'the one record scanTasks finds is the real task');
      strictEqual(scan.warnings.length, 0, 'scanTasks emits no warning for the orphan tmp');

      const lintResult = runCli(['tasks', 'lint', tasksDir], { cwd: gfx.projectRoot });
      strictEqual(lintResult.exitCode, 0, `tasks lint exits 0: stdout="${lintResult.stdout}" stderr="${lintResult.stderr}"`);
      strictEqual(lintResult.stdout.trim(), '', 'tasks lint emits no findings — the orphan is invisible to it');
    } finally {
      if (drv) await drv.shutdown();
      gfx.cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // Error-channel tests (WT22-WT24)
  // -------------------------------------------------------------------------

  await runTest('WT22: validation branch — error frame carries code -32602 and data.error, never a result', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const msg = await drv.callToolRaw('write_task', { session_id: 'wt22', title: 'a'.repeat(81) });
      strictEqual(msg.result, undefined, 'no result frame on a validation failure');
      ok(msg.error !== undefined, 'an error frame is present');
      strictEqual(msg.error.code, -32602, 'error.code === -32602');
      ok(msg.error.data && msg.error.data.error === 'TITLE_INVALID',
        `error.data.error === "TITLE_INVALID": ${JSON.stringify(msg.error.data)}`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT23: filesystem branch — FS_FAILURE error frame carries data.error AND a native-cause message', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const sessionId = 'wt23';
      const workstreamFolder = join(fx.projectRoot, 'scratch', `S-${sessionId}`);
      mkdirSync(workstreamFolder, { recursive: true });
      writeFileSync(join(workstreamFolder, 'tasks'), 'blocker', 'utf-8');

      const msg = await drv.callToolRaw('write_task', { session_id: sessionId, title: 'FS failure data.error test' });
      ok(msg.error !== undefined, 'an error frame is present');
      strictEqual(msg.error.code, -32000, 'error.code === -32000');
      ok(msg.error.data && msg.error.data.error === 'FS_FAILURE',
        `error.data.error === "FS_FAILURE": ${JSON.stringify(msg.error.data)}`);
      ok(typeof msg.error.message === 'string' && msg.error.message.length > 0,
        'error.message still carries the native cause text — the structured field adds information, it does not replace the message');
      ok(!/^FS_FAILURE$/.test(msg.error.message.trim()), 'error.message is more than just the bare named string');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT24: shared error channel — write_issue validation failure is -32602 with data.error', async () => {
    const fx = createNonRepoFixture(); // write_issue's kind validation throws before any git call, so no repo is needed
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const msg = await drv.callToolRaw('write_issue', { kind: 'bug', title: 'Invalid kind regression check' });
      ok(msg.error !== undefined, 'write_issue error frame present');
      strictEqual(msg.error.code, -32602, 'a write_issue validation failure is -32602, matching the server-wide convention');
      ok(msg.error.data && msg.error.data.error === 'KIND_INVALID',
        `error.data.error === "KIND_INVALID": ${JSON.stringify(msg.error.data)}`);
      ok(typeof msg.error.message === 'string' && msg.error.message.includes('KIND_INVALID'),
        `error.message carries the named-string prefix too: "${msg.error.message}"`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // Integration tests (WT25-WT28)
  // -------------------------------------------------------------------------

  await runTest('WT25: schema registration — required, additionalProperties, status.enum', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.call('tools/list', {});
      const tool = result.tools.find((t) => t.name === 'write_task');
      ok(tool !== undefined, 'write_task present in tools/list');
      const schema = tool.inputSchema;
      deepStrictEqual(schema.required, ['session_id', 'title'], 'required === ["session_id", "title"]');
      strictEqual(schema.additionalProperties, false, 'additionalProperties === false');
      deepStrictEqual(schema.properties.status.enum, TASK_STATUS, 'status.enum deep-equals TASK_STATUS');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT26: stdio cleanliness — stderr silent, stdout carries only well-formed JSON-RPC frames', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      drv.stdoutLines(); // drain baseline (the initialize response)

      await drv.callTool('write_task', { session_id: 'wt26', title: 'Stdio cleanliness happy path' });
      try {
        await drv.callTool('write_task', { session_id: 'wt26', title: 'Stdio cleanliness bad status', status: 'nope' });
      } catch { /* expected — the interesting assertion is what the transport carried, not this rejection */ }

      const stderrOut = drv.stderrLines();
      deepStrictEqual(stderrOut, [], `stderr carried no unexpected output: ${JSON.stringify(stderrOut)}`);

      const stdoutOut = drv.stdoutLines();
      ok(stdoutOut.length >= 2, 'stdout carried at least the two tools/call responses');
      for (const line of stdoutOut) {
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch (err) {
          fail(`stdout line is not valid JSON: "${line}" (${err.message})`);
        }
        ok(parsed.jsonrpc === '2.0', `every stdout line is a well-formed JSON-RPC frame: "${line}"`);
      }
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WT27: exit discipline — shutdown() closes stdin and the server exits 0', async () => {
    const fx = createNonRepoFixture();
    const drv = await createDriver(fx.projectRoot);
    try {
      drv.stderrLines(); // drain baseline
      await drv.callTool('write_task', { session_id: 'wt27', title: 'Exit discipline task' });
      await drv.shutdown();
      strictEqual(drv.getExitCode(), 0, 'the server process exited 0 after stdin closed (rl close -> process.exit(0))');
    } finally {
      fx.cleanup();
    }
  });

  await runTest('WT28: existing tools unaffected — write_issue and write_session still behave through the same driver', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline

      const issueResult = await drv.callTool('write_issue', { kind: 'issue', title: 'Regression guard issue', slug_override: 'regression-guard-issue' });
      const issuePayload = JSON.parse(issueResult.content[0].text);
      ok(existsSync(join(fx.projectRoot, 'scratch', 'issues', 'regression-guard-issue.md')), 'write_issue still writes to scratch/issues/');
      strictEqual(issuePayload.title, 'Regression guard issue');

      const sessionBody = '---\nsession_id: wt28\nstarted: \nended: \n---\n\n## Sessions\n\nContent.\n';
      const sessionResult = await drv.callTool('write_session', { session_id: 'wt28', body: sessionBody });
      const sessionPayload = JSON.parse(sessionResult.content[0].text);
      ok(existsSync(sessionPayload.path), 'write_session still writes its per-session file');
      strictEqual(sessionPayload.session_id, 'wt28');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  process.stdout.write(`${passCount} passed, ${failCount} failed\n`);
  process.exit(failCount === 0 ? 0 : 1);
})();
