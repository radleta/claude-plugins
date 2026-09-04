#!/usr/bin/env node
// test-write-issue.mjs — Zero-framework end-to-end test harness for the write_issue MCP tool.
// Usage: node test-write-issue.mjs    (no args; 49 tests run in-process; exit 0 on all-pass)

import { spawn, execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import { deepStrictEqual, strictEqual, ok, match, fail } from 'node:assert';
import process from 'node:process';

// Imported, never restated: asserting the schema's enums against these is
// what proves the MCP schema and the corpus lint share one source (Contracts:
// "never duplicated -- the single-source rule the task status enum already
// follows").
import { ISSUE_ROLES, SPIKE_TYPES } from './tasks.mjs';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('Usage: node test-write-issue.mjs\n\nRuns 49 automated tests against server.mjs. Exit 0 on all-pass, 1 otherwise.\n');
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
const CLI_PATH = fileURLToPath(new URL('./scratch-memory.mjs', import.meta.url));
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

async function createDriver(projectRoot) {
  const child = spawn('node', [SERVER_PATH, '--project-root', projectRoot], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  });
  activeDrivers.add(child);

  const pending = new Map(); // id -> { resolve, timer }
  let nextId = 1;
  const stderrLog = [];

  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve, timer } = pending.get(msg.id);
        clearTimeout(timer);
        pending.delete(msg.id);
        resolve(msg); // always the raw frame; call() below unwraps/throws
      }
    } catch {
      // malformed line — ignore
    }
  });

  const rlErr = createInterface({ input: child.stderr, crlfDelay: Infinity });
  rlErr.on('line', (line) => stderrLog.push(line));

  // callRaw()/callToolRaw() resolve with the WHOLE JSON-RPC frame and never
  // reject on an error frame, so a test can assert on error.code and
  // error.data.error directly instead of only on a thrown Error's message
  // string. Ported from test-write-task.mjs:130-166.
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
  return { call, callTool, callRaw, callToolRaw, stderrLines, shutdown, child };
}

function createRealRepoFixture() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'smcp-'));
  activeFixtures.add(projectRoot);
  execFileSync('git', ['init', '--quiet'], { cwd: projectRoot, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectRoot, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: projectRoot, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'init', '--allow-empty', '--quiet'], { cwd: projectRoot, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'c2', '--allow-empty', '--quiet'], { cwd: projectRoot, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'c3', '--allow-empty', '--quiet'], { cwd: projectRoot, stdio: 'ignore' });
  return {
    projectRoot,
    cleanup() {
      try { rmSync(projectRoot, { recursive: true, force: true }); } catch {}
      activeFixtures.delete(projectRoot);
    },
  };
}

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

// --- Helper: parse frontmatter from file content ---
// Returns { fields: Record<string,string>, bodyLines: string[] }
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

(async () => {

  // T1a: happy path — file + frontmatter
  await runTest('T1a: happy path — file + frontmatter', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.callTool('write_issue', {
        kind: 'issue',
        title: 'Login timeout bug',
        slug_override: 'login-timeout-bug',
        summary: 'Users see timeout on login',
        intent: 'Testing the happy path',
        impact: 'All users affected',
        prior_thinking: 'Investigated network layer',
        related: 'PR #42',
        notes: 'Seen in prod',
      });
      const payload = JSON.parse(result.content[0].text);
      const filePath = join(fx.projectRoot, 'scratch', 'issues', 'login-timeout-bug.md');
      ok(existsSync(filePath), `file exists at ${filePath}`);
      const content = readFileSync(filePath, 'utf-8');
      const { fields, bodyLines } = parseFrontmatter(content);
      // All 10 server-filled fields present
      const requiredFields = ['tool', 'kind', 'title', 'slug', 'status', 'captured', 'repo', 'branch', 'commit', 'working_tree'];
      for (const f of requiredFields) {
        ok(f in fields, `frontmatter field "${f}" present`);
      }
      strictEqual(fields.tool, 'write_issue');
      strictEqual(fields.kind, 'issue');
      strictEqual(fields.slug, 'login-timeout-bug');
      // H1 heading
      const h1 = bodyLines.find(l => l.startsWith('# '));
      strictEqual(h1, '# Issue: Login timeout bug');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T1b: happy path — audit JSONL line shape
  await runTest('T1b: happy path — audit JSONL line shape', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await drv.callTool('write_issue', {
        kind: 'idea',
        title: 'Dark mode support',
        slug_override: 'dark-mode-support',
      });
      const auditPath = join(fx.projectRoot, 'scratch', '.scratch-memory', 'audit.jsonl');
      ok(existsSync(auditPath), 'audit.jsonl exists');
      const auditLines = readFileSync(auditPath, 'utf-8').trim().split('\n').filter(Boolean);
      const issueLines = auditLines.filter(l => { try { return JSON.parse(l).tool === 'write_issue'; } catch { return false; } });
      strictEqual(issueLines.length, 1, 'exactly 1 write_issue audit line');
      const entry = JSON.parse(issueLines[0]);
      ok(typeof entry.ts === 'string' && entry.ts.includes('T'), 'ts is ISO string');
      strictEqual(entry.tool, 'write_issue');
      strictEqual(entry.status, 'captured');
      strictEqual(entry.project, 'issues');
      strictEqual(entry.slug, 'dark-mode-support');
      strictEqual(entry.kind, 'idea');
      strictEqual(entry.title, 'Dark mode support');
      ok(typeof entry.path === 'string' && entry.path.length > 0, 'path is non-empty string');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T1c: happy path — return shape
  await runTest('T1c: happy path — return shape', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.callTool('write_issue', {
        kind: 'mixed',
        title: 'Performance regression',
        slug_override: 'perf-regression',
      });
      const text = result.content[0].text;
      let payload;
      try { payload = JSON.parse(text); } catch { fail('content[0].text is not valid JSON'); }
      deepStrictEqual(Object.keys(payload).sort(), ['collision_note', 'kind', 'path', 'title']);
      ok(typeof payload.path === 'string' && payload.path.length > 0, 'path non-empty');
      strictEqual(payload.kind, 'mixed');
      strictEqual(payload.title, 'Performance regression');
      strictEqual(payload.collision_note, null);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T2: happy path — minimal (kind + title only)
  await runTest('T2: happy path — minimal (kind + title only)', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await drv.callTool('write_issue', { kind: 'issue', title: 'Minimal capture test' });
      const filePath = join(fx.projectRoot, 'scratch', 'issues', 'minimal-capture-test.md');
      ok(existsSync(filePath), 'file exists');
      const content = readFileSync(filePath, 'utf-8');
      // Six prose sections must each contain exactly _Not captured._
      const sections = ['## Summary', '### Intent', '### Prior Investigation', '## Impact', '## Related', '## Notes'];
      for (const section of sections) {
        const idx = content.indexOf(section);
        ok(idx !== -1, `section "${section}" present`);
        // Find next section or end
        const afterSection = content.slice(idx + section.length);
        ok(afterSection.includes('_Not captured._'), `_Not captured._ present after ${section}`);
      }
      // git state should be non-unknown (real repo)
      const { fields } = parseFrontmatter(content);
      ok(fields.branch !== 'unknown', 'branch is not unknown');
      ok(fields.commit !== 'unknown', 'commit is not unknown');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T3: server-derived slug — simple title
  await runTest('T3: server-derived slug — simple title', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await drv.callTool('write_issue', { kind: 'issue', title: 'Login times out on slow networks' });
      const expectedSlug = 'login-times-out-on-slow-networks';
      const filePath = join(fx.projectRoot, 'scratch', 'issues', `${expectedSlug}.md`);
      ok(existsSync(filePath), `file exists at slug "${expectedSlug}"`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T4: server-derived slug — title > 40 chars, truncates at lastIndexOf('-', 40)
  await runTest('T4: server-derived slug — title > 40 chars truncated at word boundary', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      // "user authentication fails on mobile devices in safari" → lowercase: 52 chars with hyphens
      // slug: "user-authentication-fails-on-mobile-devices-in-safari" (53 chars)
      // lastIndexOf('-', 40) → index of '-' at position of "in" segment start
      // Let's use a predictable title: "word one two three four five six seven eight"
      // → "word-one-two-three-four-five-six-seven-eight" (44 chars)
      // lastIndexOf('-', 40) = position of the last '-' before or at index 40
      // "word-one-two-three-four-five-six-seven-eight"
      //  0123456789012345678901234567890123456789012345
      // Index 40 = 'e' in "seven". last '-' at or before 40 is at 35 (before "seven").
      // So slug = "word-one-two-three-four-five-six" (32 chars)
      const title = 'word one two three four five six seven eight';
      const result = await drv.callTool('write_issue', { kind: 'issue', title });
      const payload = JSON.parse(result.content[0].text);
      ok(payload.path.endsWith('.md'), 'path ends with .md');
      const slug = payload.path.split(/[/\\]/).pop().replace(/\.md$/, '');
      ok(slug.length <= 40, `slug length ${slug.length} <= 40`);
      ok(!slug.endsWith('-'), `slug does not end with hyphen: "${slug}"`);
      ok(slug.length > 0, 'slug is non-empty');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T5: server-derived slug — degenerate input "???" → "untitled"
  await runTest('T5: server-derived slug — degenerate input "???" → "untitled"', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await drv.callTool('write_issue', { kind: 'issue', title: '???' });
      const filePath = join(fx.projectRoot, 'scratch', 'issues', 'untitled.md');
      ok(existsSync(filePath), 'file exists at slug "untitled"');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T6: server-derived slug — degenerate input variant → "untitled"
  // Note: the input '!!! @@@ ### ???' exercises the step-4 (pre-truncation empty) code path:
  // all non-alphanumeric chars normalize to hyphens, consecutive hyphens collapse, leading/trailing
  // hyphens are stripped, resulting in an empty string before truncation — so the "untitled" fallback
  // fires at step 4. The step-8 post-truncation fallback (where lastIndexOf('-', 40) returns 0 and
  // stripping the leading hyphen yields empty) is a distinct but algorithmically symmetric path.
  // Both paths converge on "untitled"; this test validates the degenerate-input variant.
  await runTest('T6: server-derived slug — degenerate input variant → "untitled"', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      // Title with only non-alphanumeric chars — all become hyphens, then collapse/strip → empty → "untitled"
      await drv.callTool('write_issue', { kind: 'issue', title: '!!! @@@ ### ???' });
      const filePath = join(fx.projectRoot, 'scratch', 'issues', 'untitled.md');
      ok(existsSync(filePath), 'file exists at slug "untitled" — exercises step-4 pre-truncation empty fallback');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T7: slug_override — happy path
  await runTest('T7: slug_override — happy path', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await drv.callTool('write_issue', { kind: 'issue', title: 'Custom slug test', slug_override: 'custom-name' });
      const filePath = join(fx.projectRoot, 'scratch', 'issues', 'custom-name.md');
      ok(existsSync(filePath), 'file exists at slug "custom-name"');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T8: slug_override — invalid format (uppercase) → error
  await runTest('T8: slug_override — invalid format (uppercase) → error', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      let threw = false;
      try {
        await drv.callTool('write_issue', { kind: 'issue', title: 'Test', slug_override: 'Bad-Slug' });
      } catch (err) {
        threw = true;
        ok(
          /slug_override|Invalid|pattern/i.test(err.message),
          `error message references slug_override/Invalid/pattern: "${err.message}"`
        );
      }
      ok(threw, 'callTool rejected with an error for invalid slug_override');
      const filePath = join(fx.projectRoot, 'scratch', 'issues', 'Bad-Slug.md');
      ok(!existsSync(filePath), 'no file written for invalid slug');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T9: slug_override — trailing hyphen rejected → error
  await runTest('T9: slug_override — trailing hyphen rejected', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      let threw = false;
      try {
        await drv.callTool('write_issue', { kind: 'issue', title: 'Test', slug_override: 'abc-' });
      } catch (err) {
        threw = true;
        ok(typeof err.message === 'string', 'error has message');
      }
      ok(threw, 'callTool rejected for trailing-hyphen slug_override');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T10a: collision auto-suffix — chain of 3 exists
  await runTest('T10a: collision auto-suffix — chain of 3 exists', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const title = 'Collision chain test alpha';
      const slug = 'collision-chain-test-alpha';
      await drv.callTool('write_issue', { kind: 'issue', title });
      await drv.callTool('write_issue', { kind: 'issue', title });
      await drv.callTool('write_issue', { kind: 'issue', title });
      const issuesDir = join(fx.projectRoot, 'scratch', 'issues');
      ok(existsSync(join(issuesDir, `${slug}.md`)), `${slug}.md exists`);
      ok(existsSync(join(issuesDir, `${slug}-2.md`)), `${slug}-2.md exists`);
      ok(existsSync(join(issuesDir, `${slug}-3.md`)), `${slug}-3.md exists`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T10b: collision auto-suffix — basepath reference semantics (INDEPENDENT fixture + driver)
  await runTest('T10b: collision auto-suffix — basepath reference semantics', async () => {
    const fx = createRealRepoFixture(); // independent fixture — NOT shared with T10a
    let drv;
    try {
      drv = await createDriver(fx.projectRoot); // independent driver
      drv.stderrLines(); // drain baseline
      const title = 'Collision chain test beta';
      const slug = 'collision-chain-test-beta';
      const expectedBaseName = `${slug}.md`;
      await drv.callTool('write_issue', { kind: 'issue', title });
      const result2 = await drv.callTool('write_issue', { kind: 'issue', title });
      const result3 = await drv.callTool('write_issue', { kind: 'issue', title });
      const payload2 = JSON.parse(result2.content[0].text);
      const payload3 = JSON.parse(result3.content[0].text);
      ok(typeof payload2.collision_note === 'string', 'call 2 collision_note is string');
      ok(typeof payload3.collision_note === 'string', 'call 3 collision_note is string');
      // collision_note must reference basePath (foo.md), NOT -2 or -3
      ok(payload2.collision_note.includes(expectedBaseName), `call 2 collision_note includes "${expectedBaseName}"`);
      ok(payload3.collision_note.includes(expectedBaseName), `call 3 collision_note includes "${expectedBaseName}"`);
      ok(!payload2.collision_note.includes('-2'), 'call 2 collision_note does not contain "-2"');
      ok(!payload3.collision_note.includes('-2'), 'call 3 collision_note does not contain "-2"');
      ok(!payload3.collision_note.includes('-3'), 'call 3 collision_note does not contain "-3"');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T11: title length — 80 chars → success
  await runTest('T11: title length — 80 chars → success', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const title = 'a'.repeat(80);
      const result = await drv.callTool('write_issue', { kind: 'issue', title });
      const payload = JSON.parse(result.content[0].text);
      ok(typeof payload.path === 'string', '80-char title succeeds');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T12: title length — 81 chars → error
  await runTest('T12: title length — 81 chars → error', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      let threw = false;
      try {
        await drv.callTool('write_issue', { kind: 'issue', title: 'a'.repeat(81) });
      } catch (err) {
        threw = true;
        ok(typeof err.message === 'string', 'error has message');
      }
      ok(threw, 'callTool rejected for 81-char title');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T13: invalid kind → error
  await runTest('T13: invalid kind → error message references allowed enum', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      let threw = false;
      try {
        await drv.callTool('write_issue', { kind: 'bug', title: 'Test' });
      } catch (err) {
        threw = true;
        ok(
          /issue|enum|kind/i.test(err.message),
          `error references "issue" or "enum" or "kind": "${err.message}"`
        );
      }
      ok(threw, 'callTool rejected for kind="bug"');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T14: invalid prose field type → error
  await runTest('T14: invalid prose field type (summary: 123) → error', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      let threw = false;
      try {
        await drv.callTool('write_issue', { kind: 'issue', title: 'Test', summary: 123 });
      } catch (err) {
        threw = true;
        ok(typeof err.message === 'string', 'error has message');
      }
      ok(threw, 'callTool rejected for summary: 123');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T15: git state — real repo
  await runTest('T15: git state — real repo has branch/commit/recent commits', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await drv.callTool('write_issue', { kind: 'issue', title: 'Git state real repo test' });
      const filePath = join(fx.projectRoot, 'scratch', 'issues', 'git-state-real-repo-test.md');
      ok(existsSync(filePath), 'file exists');
      const content = readFileSync(filePath, 'utf-8');
      const { fields } = parseFrontmatter(content);
      ok(fields.branch !== 'unknown', `branch is not unknown: "${fields.branch}"`);
      ok(fields.commit !== 'unknown', `commit is not unknown: "${fields.commit}"`);
      ok(/^[a-f0-9]+$/.test(fields.commit), `commit is hex SHA: "${fields.commit}"`);
      // Body has Recent commits bullet list with at least 1 entry
      ok(content.includes('Recent commits (last 3):'), 'body has Recent commits marker');
      const afterMarker = content.slice(content.indexOf('Recent commits (last 3):'));
      ok(afterMarker.includes('  - '), 'at least one commit bullet found');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T16: git state — non-repo
  await runTest('T16: git state — non-repo returns unknown fields + stderr JSON logs', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline — required by protocol
      await drv.callTool('write_issue', { kind: 'issue', title: 'Non-repo git state test' });
      const filePath = join(fx.projectRoot, 'scratch', 'issues', 'non-repo-git-state-test.md');
      ok(existsSync(filePath), 'file exists');
      const content = readFileSync(filePath, 'utf-8');
      const { fields } = parseFrontmatter(content);
      strictEqual(fields.branch, 'unknown', 'branch === "unknown"');
      strictEqual(fields.commit, 'unknown', 'commit === "unknown"');
      strictEqual(fields.working_tree, 'unknown', 'working_tree === "unknown"');
      // Collect stderr lines after the tool call
      const errLines = drv.stderrLines();
      ok(Array.isArray(errLines), 'stderrLines() returns array');
      const ops = new Set();
      for (const line of errLines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.op) ops.add(parsed.op);
        } catch { /* skip non-JSON lines */ }
      }
      const expectedOps = ['git_branch', 'git_commit', 'git_commit_subject', 'git_status', 'git_log'];
      for (const op of expectedOps) {
        ok(ops.has(op), `stderr contains op "${op}"`);
      }
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T17: canonical placeholder verbatim
  await runTest('T17: canonical placeholder verbatim (_Not captured._ exact bytes)', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      // First: only summary provided — other 5 sections use placeholder
      await drv.callTool('write_issue', { kind: 'issue', title: 'Placeholder test alpha', summary: 'Provided summary' });
      // Second: only notes provided — other 5 sections use placeholder
      await drv.callTool('write_issue', { kind: 'issue', title: 'Placeholder test beta', notes: 'Provided notes' });
      const file1 = join(fx.projectRoot, 'scratch', 'issues', 'placeholder-test-alpha.md');
      const file2 = join(fx.projectRoot, 'scratch', 'issues', 'placeholder-test-beta.md');
      ok(existsSync(file1), 'alpha file exists');
      ok(existsSync(file2), 'beta file exists');
      const content1 = readFileSync(file1, 'utf-8');
      const content2 = readFileSync(file2, 'utf-8');
      // Exact byte match — no smart quotes, no whitespace variation
      ok(content1.includes('_Not captured._'), 'alpha file contains _Not captured._');
      ok(content2.includes('_Not captured._'), 'beta file contains _Not captured._');
      // Verify no alternate placeholder form
      ok(!content1.includes('_Not captured._ '), 'no trailing space variant in alpha');
      ok(!content2.includes('_Not captured._ '), 'no trailing space variant in beta');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T18: audit log — N invocations
  await runTest('T18: audit log — 3 invocations produce exactly 3 write_issue lines', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await drv.callTool('write_issue', { kind: 'issue', title: 'Audit test one' });
      await drv.callTool('write_issue', { kind: 'idea', title: 'Audit test two' });
      await drv.callTool('write_issue', { kind: 'mixed', title: 'Audit test three' });
      const auditPath = join(fx.projectRoot, 'scratch', '.scratch-memory', 'audit.jsonl');
      ok(existsSync(auditPath), 'audit.jsonl exists');
      const lines = readFileSync(auditPath, 'utf-8').trim().split('\n').filter(Boolean);
      const issueLines = lines.filter(l => { try { return JSON.parse(l).tool === 'write_issue'; } catch { return false; } });
      strictEqual(issueLines.length, 3, 'exactly 3 write_issue audit lines');
      for (const line of issueLines) {
        const entry = JSON.parse(line);
        ok(typeof entry.ts === 'string', 'ts is string');
        strictEqual(entry.tool, 'write_issue');
        strictEqual(entry.status, 'captured');
        strictEqual(entry.project, 'issues');
        ok(typeof entry.slug === 'string', 'slug is string');
        ok(typeof entry.kind === 'string', 'kind is string');
        ok(typeof entry.title === 'string', 'title is string');
        ok(typeof entry.path === 'string', 'path is string');
      }
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T19: return shape — JSON-in-text has exact keys
  await runTest('T19: return shape — JSON-in-text has exactly {path, kind, title, collision_note}', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.callTool('write_issue', { kind: 'issue', title: 'Return shape test' });
      const text = result.content[0].text;
      let payload;
      try { payload = JSON.parse(text); } catch { fail('content[0].text is not valid JSON'); }
      deepStrictEqual(Object.keys(payload).sort(), ['collision_note', 'kind', 'path', 'title']);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T20: return shape — collision_note null vs string
  await runTest('T20: return shape — collision_note null on first, string on second', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const title = 'Collision note semantics test';
      const result1 = await drv.callTool('write_issue', { kind: 'issue', title });
      const result2 = await drv.callTool('write_issue', { kind: 'issue', title });
      const payload1 = JSON.parse(result1.content[0].text);
      const payload2 = JSON.parse(result2.content[0].text);
      strictEqual(payload1.collision_note, null, 'first call collision_note === null');
      ok(typeof payload2.collision_note === 'string', 'second call collision_note is string');
      ok(payload2.collision_note.includes('.md'), 'collision_note contains ".md"');
      // basePath is the path to the original (non-suffixed) file
      const slug = 'collision-note-semantics-test';
      const baseName = `${slug}.md`;
      ok(payload2.collision_note.includes(baseName), `collision_note references basePath "${baseName}"`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T21: heading prefix mapping for all three kinds
  await runTest('T21: heading prefix mapping — issue/idea/mixed → Issue/Idea/Feature', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await drv.callTool('write_issue', { kind: 'issue', title: 'Heading issue test', slug_override: 'heading-issue' });
      await drv.callTool('write_issue', { kind: 'idea', title: 'Heading idea test', slug_override: 'heading-idea' });
      await drv.callTool('write_issue', { kind: 'mixed', title: 'Heading mixed test', slug_override: 'heading-mixed' });
      const issuesDir = join(fx.projectRoot, 'scratch', 'issues');
      const contentIssue = readFileSync(join(issuesDir, 'heading-issue.md'), 'utf-8');
      const contentIdea = readFileSync(join(issuesDir, 'heading-idea.md'), 'utf-8');
      const contentMixed = readFileSync(join(issuesDir, 'heading-mixed.md'), 'utf-8');
      const h1Issue = contentIssue.split('\n').find(l => l.startsWith('# '));
      const h1Idea = contentIdea.split('\n').find(l => l.startsWith('# '));
      const h1Mixed = contentMixed.split('\n').find(l => l.startsWith('# '));
      ok(h1Issue?.startsWith('# Issue: '), `issue heading starts with "# Issue: ": "${h1Issue}"`);
      ok(h1Idea?.startsWith('# Idea: '), `idea heading starts with "# Idea: ": "${h1Idea}"`);
      ok(h1Mixed?.startsWith('# Feature: '), `mixed heading starts with "# Feature: ": "${h1Mixed}"`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // Regression tests — existing tools (R1–R3)
  // -------------------------------------------------------------------------

  // R1: write_report happy path
  await runTest('R1: write_report happy path', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.callTool('write_report', {
        project: 'demo',
        step: 1,
        iter: 1,
        role: 'quality',
        status: 'APPROVED',
        body: 'ok',
      });
      const text = result.content[0].text;
      ok(text.startsWith('Wrote: '), `return text starts with "Wrote: ": "${text}"`);
      // Verify the file actually exists at the expected location
      const stepsDir = join(fx.projectRoot, 'scratch', 'demo', 'steps', 'step-01');
      // Extract the path from the return value and check it exists
      const reportedPath = text.slice('Wrote: '.length).trim();
      ok(existsSync(reportedPath), `report file exists at reported path: ${reportedPath}`);
      ok(/quality-iter1-\d{8}T\d{6}Z\.md$/.test(reportedPath), `filename matches quality-iter1-<ts>.md: "${reportedPath}"`);
      ok(
        reportedPath.replace(/\\/g, '/').includes(stepsDir.replace(/\\/g, '/')),
        `path is under step-01 dir (normalized: ${stepsDir})`
      );
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // R2: write_review happy path
  await runTest('R2: write_review happy path', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.callTool('write_review', {
        project: 'demo',
        phase: 'idea',
        iter: 1,
        role: 'document-quality',
        status: 'APPROVED',
        body: 'ok',
      });
      const text = result.content[0].text;
      ok(text.startsWith('Wrote: '), `return text starts with "Wrote: ": "${text}"`);
      const reportedPath = text.slice('Wrote: '.length).trim();
      ok(existsSync(reportedPath), `review file exists at reported path: ${reportedPath}`);
      ok(/document-quality-iter1-\d{8}T\d{6}Z\.md$/.test(reportedPath), `filename matches document-quality-iter1-<ts>.md: "${reportedPath}"`);
      const reviewsDir = join(fx.projectRoot, 'scratch', 'demo', 'reviews', 'idea');
      ok(reportedPath.startsWith(reviewsDir) || reportedPath.replace(/\\/g, '/').includes(reviewsDir.replace(/\\/g, '/')), `path is under reviews/idea dir`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // R3: tools/list includes all three
  await runTest('R3: tools/list includes all three', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.call('tools/list', {});
      ok(Array.isArray(result.tools), 'result.tools is an Array');
      ok(result.tools.length >= 3, `tools.length >= 3 (got ${result.tools.length})`);
      const names = result.tools.map(t => t.name);
      ok(names.includes('write_report'), 'tools includes write_report');
      ok(names.includes('write_review'), 'tools includes write_review');
      ok(names.includes('write_issue'), 'tools includes write_issue');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // MCP Protocol tests (P1–P5)
  // -------------------------------------------------------------------------

  // P1: initialize handshake
  await runTest('P1: initialize handshake', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      // Issue a second initialize call to verify the response shape explicitly
      const result = await drv.call('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-harness', version: '0' },
      });
      strictEqual(result.protocolVersion, '2024-11-05', 'protocolVersion === "2024-11-05"');
      ok('tools' in result.capabilities, 'capabilities has "tools" key');
      strictEqual(result.serverInfo.name, 'scratch-memory', 'serverInfo.name === "scratch-memory"');
      ok(typeof result.serverInfo.version === 'string', 'serverInfo.version is a string');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // P2: tools/list — write_issue schema
  await runTest('P2: tools/list — write_issue schema', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.call('tools/list', {});
      const tool = result.tools.find(t => t.name === 'write_issue');
      ok(tool !== undefined, 'write_issue tool found in tools/list');
      const schema = tool.inputSchema;
      ok(Array.isArray(schema.required), 'inputSchema.required is an Array');
      ok(schema.required.includes('kind'), 'inputSchema.required contains "kind"');
      ok(schema.required.includes('title'), 'inputSchema.required contains "title"');
      deepStrictEqual(
        schema.properties.kind.enum,
        ['issue', 'idea', 'mixed'],
        'inputSchema.properties.kind.enum deepEquals ["issue","idea","mixed"]'
      );
      strictEqual(
        schema.properties.slug_override.pattern,
        '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$',
        'inputSchema.properties.slug_override.pattern matches spec'
      );
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // P3: malformed JSON-RPC input does not crash server
  await runTest('P3: malformed JSON-RPC input does not crash server', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      // Write raw garbage directly to stdin; stdin is FIFO so this is processed
      // before the ping. Server silently drops non-JSON lines and stays alive.
      // Do NOT use setTimeout/sleep — ordering is guaranteed by the FIFO nature of stdin.
      drv.child.stdin.write('not-json\n');
      // Immediately send a valid ping — server must respond normally
      const result = await drv.call('ping', {});
      deepStrictEqual(result, {}, 'ping returns empty object {}');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // P4: unknown tool name
  await runTest('P4: unknown tool name', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      let threw = false;
      try {
        await drv.callTool('no_such_tool', {});
      } catch (err) {
        threw = true;
        ok(
          err.message.includes('-32000'),
          `error message contains "-32000": "${err.message}"`
        );
      }
      ok(threw, 'callTool rejected for unknown tool name');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // P5: unknown method
  await runTest('P5: unknown method', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      let threw = false;
      try {
        await drv.call('bogus/method', {});
      } catch (err) {
        threw = true;
        ok(
          err.message.includes('-32601'),
          `error message contains "-32601": "${err.message}"`
        );
      }
      ok(threw, 'call rejected for unknown method');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // XML validation tests (X1–X3) — MALFORMED_TOOL_CALL_XML guard
  // -------------------------------------------------------------------------

  // X1: clean args pass validation (positive path)
  await runTest('X1: clean args pass validation — no MALFORMED_TOOL_CALL_XML error', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.callTool('write_issue', {
        kind: 'issue',
        title: 'Clean XML test',
        slug_override: 'clean-xml-test',
        summary: 'no embedded XML literals here',
        intent: 'Verifying that clean args pass the validator unchanged',
        impact: 'No users affected',
      });
      const payload = JSON.parse(result.content[0].text);
      ok(typeof payload.path === 'string' && payload.path.length > 0, 'path returned for clean args');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // X2: malformed args trigger rejection (negative path)
  await runTest('X2: malformed args rejected with MALFORMED_TOOL_CALL_XML', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      // Simulate the lenient-parse signature: close-tag immediately followed by parameter-open-of-different-name
      const malformed =
        'intent body text</intent>\n<parameter name="impact">impact body text</impact>\n<parameter name="related">related body text';
      let threw = false;
      try {
        await drv.callTool('write_issue', {
          kind: 'issue',
          title: 'Malformed XML test',
          intent: malformed,
        });
        fail('expected MALFORMED_TOOL_CALL_XML error to be thrown');
      } catch (err) {
        threw = true;
        match(err.message, /MALFORMED_TOOL_CALL_XML/);
        match(err.message, /lost args:/);
        match(err.message, /impact/);
        match(err.message, /related/);
      }
      ok(threw, 'callTool rejected for malformed XML arg');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // X3: legitimate prose containing </X> substrings is not false-positived
  await runTest('X3: legitimate prose with </X> substrings is not false-positived', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      // These close-tags appear in isolation — NOT followed by <parameter name="...">
      const legitimateProse =
        'We use </script> tags in HTML. Also </intent> appears in docs. Even </prior_thinking> can appear in prose.';
      const result = await drv.callTool('write_issue', {
        kind: 'issue',
        title: 'False positive guard',
        slug_override: 'false-positive-guard',
        intent: legitimateProse,
      });
      const payload = JSON.parse(result.content[0].text);
      ok(typeof payload.path === 'string' && payload.path.length > 0, 'path returned without rejection for legitimate prose');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // E1-E3: structured error channel (ProtocolError → code + error.data.error)
  // The T8/T12/T13/T14 cases above only regex-match err.message; these assert
  // the machine-readable half callers are told to branch on.
  // -------------------------------------------------------------------------

  await runTest('E1: validation failures are -32602 and carry the matching data.error', async () => {
    const fx = createNonRepoFixture(); // every case below throws before the first git call
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const cases = [
        ['KIND_INVALID', { kind: 'bug', title: 'Bad kind' }],
        ['TITLE_INVALID', { kind: 'issue', title: 'x'.repeat(81) }],
        ['SLUG_OVERRIDE_INVALID', { kind: 'issue', title: 'Bad slug', slug_override: 'Not-Valid' }],
        ['FIELD_INVALID', { kind: 'issue', title: 'Bad field', summary: 123 }],
      ];
      for (const [expected, args] of cases) {
        const msg = await drv.callToolRaw('write_issue', args);
        ok(msg.error !== undefined, `${expected}: an error frame is present`);
        strictEqual(msg.error.code, -32602, `${expected}: error.code === -32602`);
        strictEqual(msg.error.data?.error, expected,
          `error.data.error === "${expected}": ${JSON.stringify(msg.error.data)}`);
        ok(msg.error.message.startsWith(`${expected}: `),
          `error.message keeps the "${expected}: " prefix: "${msg.error.message}"`);
      }
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('E2: MALFORMED_TOOL_CALL_XML carries data.error too', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const msg = await drv.callToolRaw('write_issue', {
        kind: 'issue',
        title: 'Malformed XML structured shape',
        summary: 'Some text</summary>\n<parameter name="impact">leaked</parameter>',
      });
      ok(msg.error !== undefined, 'an error frame is present');
      strictEqual(msg.error.code, -32602, 'error.code === -32602');
      strictEqual(msg.error.data?.error, 'MALFORMED_TOOL_CALL_XML',
        `error.data.error === "MALFORMED_TOOL_CALL_XML": ${JSON.stringify(msg.error.data)}`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('E3: filesystem branch — FS_FAILURE is -32000 with data.error', async () => {
    const fx = createNonRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      // scratch/issues occupied by a regular file: existsSync(finalPath) is false
      // (so no collision suffix), the sandbox check passes, and mkdirSync then
      // fails EEXIST — the first filesystem mutation writeIssue attempts.
      mkdirSync(join(fx.projectRoot, 'scratch'), { recursive: true });
      writeFileSync(join(fx.projectRoot, 'scratch', 'issues'), 'blocker', 'utf-8');

      const msg = await drv.callToolRaw('write_issue', { kind: 'issue', title: 'FS failure path' });
      ok(msg.error !== undefined, 'an error frame is present');
      strictEqual(msg.error.code, -32000, 'error.code === -32000 for a runtime failure');
      strictEqual(msg.error.data?.error, 'FS_FAILURE',
        `error.data.error === "FS_FAILURE": ${JSON.stringify(msg.error.data)}`);
      ok(!/^FS_FAILURE:?$/.test(msg.error.message.trim()),
        `error.message still carries the native cause text: "${msg.error.message}"`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // =========================================================================
  // K -- the four optional epic/spike keys (D14). Shape validation, the two
  // cross-field rules, conditional emission after the ten required keys, and
  // the schema the calling model reads.
  // =========================================================================

  // Run `scratch-memory tasks lint` against a fixture path. Used to close
  // acceptance outcome 5 end-to-end: the writer's output must satisfy the
  // corpus lint, which is the only thing that proves the two agree.
  function runTasksLint(projectRoot, target) {
    const res = spawnSync('node', [CLI_PATH, 'tasks', 'lint', '--', target], {
      cwd: projectRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
  }

  await runTest('K1: acceptance outcome 5 — a research spike writes all 10 required keys plus its 3, and tasks lint exits 0 silently', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline

      // The epic first: E3 requires a spike's `epic` to resolve to a file
      // carrying role: epic, so the lint half of this outcome needs it present.
      await drv.callTool('write_issue', {
        kind: 'idea', title: 'Foo epic', slug_override: 'foo', role: 'epic',
      });
      const result = await drv.callTool('write_issue', {
        kind: 'issue',
        title: 'Decide the retry policy',
        slug_override: 'decide-retry-policy',
        summary: 'Which retry policy the client should use.',
        role: 'spike',
        epic: 'foo',
        spike_type: 'research',
      });

      const payload = JSON.parse(result.content[0].text);
      const filePath = join(fx.projectRoot, 'scratch', 'issues', 'decide-retry-policy.md');
      strictEqual(payload.path, filePath, 'the returned path is the spike file');
      const { fields } = parseFrontmatter(readFileSync(filePath, 'utf-8'));

      const requiredFields = ['tool', 'kind', 'title', 'slug', 'status', 'captured', 'repo', 'branch', 'commit', 'working_tree'];
      for (const f of requiredFields) ok(f in fields, `required frontmatter key "${f}" present`);
      strictEqual(fields.role, 'spike', 'role emitted');
      strictEqual(fields.epic, 'foo', 'epic emitted');
      strictEqual(fields.spike_type, 'research', 'spike_type emitted');
      ok(!('blocked_by' in fields), 'blocked_by NOT emitted — it was not supplied');

      const lint = runTasksLint(fx.projectRoot, filePath);
      strictEqual(lint.status, 0, `tasks lint exits 0 (got: ${lint.status}, stdout: ${lint.stdout}, stderr: ${lint.stderr})`);
      strictEqual(lint.stdout, '', `with no output (got: ${JSON.stringify(lint.stdout)})`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('K2: all four keys are emitted after the ten, in Contracts order, unquoted, with comma lists intact', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await drv.callTool('write_issue', {
        kind: 'issue',
        title: 'Multi-epic spike',
        slug_override: 'multi-epic-spike',
        role: 'spike',
        epic: 'alpha-epic,beta-epic',
        spike_type: 'prototype',
        blocked_by: 'first-blocker,second-blocker',
      });

      const content = readFileSync(join(fx.projectRoot, 'scratch', 'issues', 'multi-epic-spike.md'), 'utf-8');
      const keyOrder = content.split('\n---\n')[0].split('\n').slice(1).map(l => l.split(':')[0]);
      deepStrictEqual(
        keyOrder,
        ['tool', 'kind', 'title', 'slug', 'status', 'captured', 'repo', 'branch', 'commit', 'working_tree',
          'role', 'epic', 'spike_type', 'blocked_by'],
        'the four optional keys follow the ten required ones, in the Contracts table order'
      );
      // Comma-separated scalars, never a YAML flow sequence: the frontmatter
      // parser splits at the first colon and stores the raw string, so "[a, b]"
      // would round-trip as that literal.
      ok(content.includes('\nepic: alpha-epic,beta-epic\n'), `epic is an unquoted comma list (got: ${JSON.stringify(content.slice(0, 400))})`);
      ok(content.includes('\nblocked_by: first-blocker,second-blocker\n'), 'blocked_by is an unquoted comma list');
      ok(!content.includes('epic: "'), 'epic is not quoted');
      ok(!content.includes('['), 'no YAML flow sequence anywhere in the file');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('K3: a call supplying none of the four is byte-for-byte the old ten-key frontmatter', async () => {
    // The 144-existing-files invariant: /capture-issue and researcher's D6
    // auto-heal pass none of these, and their output must not move at all.
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await drv.callTool('write_issue', {
        kind: 'idea', title: 'Ordinary capture', slug_override: 'ordinary-capture',
        summary: 'Nothing epic about it.',
      });

      const content = readFileSync(join(fx.projectRoot, 'scratch', 'issues', 'ordinary-capture.md'), 'utf-8');
      const { fields } = parseFrontmatter(content);
      deepStrictEqual(
        Object.keys(fields),
        ['tool', 'kind', 'title', 'slug', 'status', 'captured', 'repo', 'branch', 'commit', 'working_tree'],
        'exactly the ten required keys, no empty optional ones'
      );
      for (const key of ['role', 'epic', 'spike_type', 'blocked_by']) {
        ok(!content.includes(`\n${key}:`), `no ${key}: line anywhere in the file`);
      }
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('K4: tools/list advertises the four keys, sourced from tasks.mjs, with required unchanged', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.call('tools/list', {});
      const schema = result.tools.find(t => t.name === 'write_issue').inputSchema;

      deepStrictEqual(schema.required, ['kind', 'title'], 'required is still exactly kind and title');
      deepStrictEqual(schema.properties.role.enum, ISSUE_ROLES, 'role.enum IS tasks.mjs ISSUE_ROLES');
      deepStrictEqual(schema.properties.spike_type.enum, SPIKE_TYPES, 'spike_type.enum IS tasks.mjs SPIKE_TYPES');
      const listPattern = '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(,[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$';
      strictEqual(schema.properties.epic.pattern, listPattern, 'epic carries the comma-joined slug pattern');
      strictEqual(schema.properties.blocked_by.pattern, listPattern, 'blocked_by carries the same pattern');
      // The schema is what conveys the format to the calling model, so the
      // "omit rather than pass empty" rule has to be in the description too.
      match(schema.properties.blocked_by.description, /[Oo]mit/);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('K5: E7 mirror — role "spike" without epic is rejected with EPIC_REQUIRED', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const msg = await drv.callToolRaw('write_issue', {
        kind: 'issue', title: 'Orphan spike', role: 'spike', spike_type: 'task',
      });
      ok(msg.error !== undefined, 'an error frame is present');
      strictEqual(msg.error.code, -32602, 'validation failures are -32602');
      strictEqual(msg.error.data?.error, 'EPIC_REQUIRED', `data.error names the rule (got: ${JSON.stringify(msg.error.data)})`);
      ok(!existsSync(join(fx.projectRoot, 'scratch', 'issues')), 'and nothing was written');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('K6: E10 mirror — spike_type or blocked_by without role "spike" is rejected with ROLE_SPIKE_REQUIRED', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      for (const extra of [{ spike_type: 'task' }, { blocked_by: 'some-spike' }, { spike_type: 'task', role: 'epic' }]) {
        const msg = await drv.callToolRaw('write_issue', {
          kind: 'issue', title: 'Stray key', ...extra,
        });
        ok(msg.error !== undefined, `an error frame for ${JSON.stringify(extra)}`);
        strictEqual(msg.error.data?.error, 'ROLE_SPIKE_REQUIRED',
          `data.error names the rule for ${JSON.stringify(extra)} (got: ${JSON.stringify(msg.error.data)})`);
      }
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('K7: the deliberate asymmetry — a spike with an epic but no spike_type is ACCEPTED at write time', async () => {
    // E8 requires spike_type in the file, but mirroring it here was rejected
    // as over-strict for a two-rule mirror; E8 catches it on the first edit.
    // This test exists so a later "hardening" of the server trips a gate
    // rather than silently reversing the decision.
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.callTool('write_issue', {
        kind: 'issue', title: 'Typeless spike', slug_override: 'typeless-spike',
        role: 'spike', epic: 'foo',
      });
      const payload = JSON.parse(result.content[0].text);
      ok(existsSync(payload.path), 'the file was written');
      const { fields } = parseFrontmatter(readFileSync(payload.path, 'utf-8'));
      strictEqual(fields.role, 'spike');
      strictEqual(fields.epic, 'foo');
      ok(!('spike_type' in fields), 'and no spike_type key was invented');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('K8: an ordinary capture may carry epic alone — the server does not foreclose in-place promotion', async () => {
    // E10 covers spike_type and blocked_by but deliberately NOT epic, so a
    // server rule requiring role: "spike" for a bare epic: would disagree with
    // the lint.
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.callTool('write_issue', {
        kind: 'issue', title: 'Capture in an epic', slug_override: 'capture-in-an-epic', epic: 'foo',
      });
      const payload = JSON.parse(result.content[0].text);
      const { fields } = parseFrontmatter(readFileSync(payload.path, 'utf-8'));
      strictEqual(fields.epic, 'foo', 'epic emitted on a capture carrying no role');
      ok(!('role' in fields), 'and no role key was invented');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('K9: an out-of-enum role or spike_type is rejected against the tasks.mjs enums', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline

      const badRole = await drv.callToolRaw('write_issue', { kind: 'issue', title: 'Bad role', role: 'story' });
      strictEqual(badRole.error?.data?.error, 'ROLE_INVALID', `got: ${JSON.stringify(badRole.error?.data)}`);
      for (const value of ISSUE_ROLES) ok(badRole.error.message.includes(value), `the message lists ${value}`);

      const badType = await drv.callToolRaw('write_issue', {
        kind: 'issue', title: 'Bad type', role: 'spike', epic: 'foo', spike_type: 'spike-solution',
      });
      strictEqual(badType.error?.data?.error, 'SPIKE_TYPE_INVALID', `got: ${JSON.stringify(badType.error?.data)}`);
      for (const value of SPIKE_TYPES) ok(badType.error.message.includes(value), `the message lists ${value}`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('K10: malformed slug lists are rejected, including the empty string — "none" is expressed by omission', async () => {
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline

      for (const bad of ['', 'Has-Caps', 'a,,b', 'a, b', '-leading', 'trailing-', 'has/slash', 'has space']) {
        const msg = await drv.callToolRaw('write_issue', {
          kind: 'issue', title: 'Bad epic list', role: 'spike', epic: bad,
        });
        strictEqual(msg.error?.data?.error, 'EPIC_INVALID',
          `epic ${JSON.stringify(bad)} is rejected (got: ${JSON.stringify(msg.error?.data)})`);
      }
      const badBlocked = await drv.callToolRaw('write_issue', {
        kind: 'issue', title: 'Bad blocker list', role: 'spike', epic: 'foo', blocked_by: '',
      });
      strictEqual(badBlocked.error?.data?.error, 'BLOCKED_BY_INVALID',
        `an empty blocked_by is rejected rather than emitted (got: ${JSON.stringify(badBlocked.error?.data)})`);

      // The valid multi-element case still passes the same validator.
      const good = await drv.callTool('write_issue', {
        kind: 'issue', title: 'Good lists', slug_override: 'good-lists',
        role: 'spike', epic: 'a1,b-2', blocked_by: 'c3',
      });
      ok(existsSync(JSON.parse(good.content[0].text).path), 'a well-formed list is accepted');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('K11: the four new args are covered by the malformed-tool-call-XML guard', async () => {
    // They are string args on a multi-arg tool, so they must be in
    // handleCall's fieldNames list — and that check runs before writeIssue's
    // own validation, so the XML error wins over EPIC_INVALID.
    const fx = createRealRepoFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const malformed =
        'foo</epic>\n<parameter name="impact">impact body text</impact>\n<parameter name="related">related body text';
      let threw = false;
      try {
        await drv.callTool('write_issue', {
          kind: 'issue', title: 'Malformed epic arg', role: 'spike', epic: malformed,
        });
        fail('expected MALFORMED_TOOL_CALL_XML error to be thrown');
      } catch (err) {
        threw = true;
        match(err.message, /MALFORMED_TOOL_CALL_XML/);
        match(err.message, /"epic"/);
        match(err.message, /lost args:/);
      }
      ok(threw, 'callTool rejected the malformed epic arg');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  process.stdout.write(`${passCount} passed, ${failCount} failed\n`);
  process.exit(failCount === 0 ? 0 : 1);
})();
