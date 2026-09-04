#!/usr/bin/env node
// test-write-report.mjs — Zero-framework end-to-end test harness for the write_report MCP tool.
// Usage: node test-write-report.mjs    (no args; 12 tests run in-process; exit 0 on all-pass)
//
// Modeled on the sibling test-write-task.mjs: the same hand-rolled runTest()/PASS:/FAIL:
// harness, the same signal handlers, the same createDriver() shape spawning server.mjs and
// speaking raw JSON-RPC over stdio (including callRaw()/callToolRaw(), which resolve with the
// whole frame so a test can assert on error.code and error.data.error rather than only on a
// thrown Error's message string), and the same local parseFrontmatter() helper. Every case
// drives write_report through the real server process — none imports writeReport() directly —
// so the TOOLS registry entry and the handleCall() dispatch branch are exercised too.
//
// Fixture choice: plain mkdtempSync, no git. writeReport() gathers no git state at all, so
// every case here runs against a bare temp directory.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import { deepStrictEqual, strictEqual, ok, match, fail } from 'node:assert';
import process from 'node:process';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('Usage: node test-write-report.mjs\n\nRuns 12 automated tests against server.mjs. Exit 0 on all-pass, 1 otherwise.\n');
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

function createFixture() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'smcp-rep-'));
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

function extractWrittenPath(resultText) {
  const m = resultText.match(/^Wrote: (.+)$/);
  if (!m) throw new Error(`Unexpected write_report result text: ${resultText}`);
  return m[1];
}

// The full valid-argument set, so each error case below can override exactly one field
// and leave every other validator satisfied.
const VALID_ARGS = Object.freeze({
  project: 'proj-report',
  step: 1,
  iter: 1,
  role: 'coder',
  status: 'READY_FOR_REVIEW',
  body: '## Files Changed\n- none\n',
});

(async () => {

  // -------------------------------------------------------------------------
  // WR1-WR3: happy path
  // -------------------------------------------------------------------------

  await runTest('WR1: happy path — result text, file location, filename pattern, frontmatter', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.callTool('write_report', {
        project: 'proj-report',
        step: 3,
        iter: 2,
        role: 'quality',
        status: 'FINDINGS',
        body: '## Issues\n- Something to fix.\n',
      });
      const path = extractWrittenPath(result.content[0].text);
      ok(existsSync(path), `file exists at ${path}`);

      const expectedDir = join(fx.projectRoot, 'scratch', 'proj-report', 'steps', 'step-03');
      ok(path.startsWith(expectedDir), `written under steps/step-03: ${path}`);
      const filename = path.slice(expectedDir.length + 1);
      ok(/^quality-iter2-\d{8}T\d{6}Z\.md$/.test(filename),
        `filename matches ^quality-iter2-<compact-ts>\\.md$: "${filename}"`);

      const { fields, bodyLines } = parseFrontmatter(readFileSync(path, 'utf-8'));
      strictEqual(fields.role, 'quality');
      strictEqual(fields.status, 'FINDINGS');
      strictEqual(fields.step, '3', 'step is the raw integer, not the zero-padded directory form');
      strictEqual(fields.iteration, '2');
      strictEqual(fields.project, 'proj-report');
      ok(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(fields.timestamp), `timestamp is ISO 8601: "${fields.timestamp}"`);
      ok(bodyLines.join('\n').includes('- Something to fix.'), 'caller body is preserved verbatim');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WR2: happy path — audit JSONL line shape', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.callTool('write_report', VALID_ARGS);
      const path = extractWrittenPath(result.content[0].text);

      const auditPath = join(fx.projectRoot, 'scratch', '.scratch-memory', 'audit.jsonl');
      ok(existsSync(auditPath), 'audit.jsonl exists');
      const lines = readFileSync(auditPath, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
      const mine = lines.filter((l) => l.tool === 'write_report');
      strictEqual(mine.length, 1, 'exactly one write_report audit line');
      deepStrictEqual(Object.keys(mine[0]).sort(),
        ['iter', 'path', 'project', 'role', 'status', 'step', 'tool', 'ts']);
      strictEqual(mine[0].path, path, 'audit path matches the returned path');
      strictEqual(mine[0].status, 'READY_FOR_REVIEW', 'status is a filterable audit column');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WR3: step 0 (ad-hoc) writes to step-00, and every verifier role/status pair is accepted', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const adhoc = await drv.callTool('write_report', { ...VALID_ARGS, step: 0 });
      const adhocPath = extractWrittenPath(adhoc.content[0].text);
      ok(adhocPath.includes(join('steps', 'step-00')), `step 0 pads to step-00: ${adhocPath}`);

      const pairs = [
        ['coder', 'FIXED'], ['coder', 'BLOCKED'],
        ['completeness', 'APPROVED'], ['completeness', 'FINDINGS'],
        ['quality', 'APPROVED'], ['security', 'FINDINGS'],
      ];
      let iter = 1;
      for (const [role, status] of pairs) {
        iter++;
        const res = await drv.callTool('write_report', { ...VALID_ARGS, iter, role, status, step: 0 });
        ok(existsSync(extractWrittenPath(res.content[0].text)), `${role}/${status} accepted`);
      }
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // WR4-WR9: one validation family per test — -32602 plus data.error
  // -------------------------------------------------------------------------

  async function expectValidationError(drv, overrides, expectedName) {
    const msg = await drv.callToolRaw('write_report', { ...VALID_ARGS, ...overrides });
    ok(msg.error !== undefined, `${expectedName}: an error frame is present`);
    strictEqual(msg.error.code, -32602, `${expectedName}: error.code === -32602`);
    strictEqual(msg.error.data?.error, expectedName,
      `error.data.error === "${expectedName}": ${JSON.stringify(msg.error.data)}`);
    ok(msg.error.message.startsWith(`${expectedName}: `),
      `error.message keeps the "${expectedName}: " prefix: "${msg.error.message}"`);
    return msg;
  }

  await runTest('WR4: bad project → PROJECT_INVALID', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await expectValidationError(drv, { project: 'bad/proj' }, 'PROJECT_INVALID');
      await expectValidationError(drv, { project: '' }, 'PROJECT_INVALID');
      await expectValidationError(drv, { project: 42 }, 'PROJECT_INVALID');
      ok(!existsSync(join(fx.projectRoot, 'scratch', 'proj-report')),
        'no directory created — validation throws before any filesystem mutation');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WR5: bad step → STEP_INVALID', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await expectValidationError(drv, { step: -1 }, 'STEP_INVALID');
      await expectValidationError(drv, { step: 1.5 }, 'STEP_INVALID');
      await expectValidationError(drv, { step: '1' }, 'STEP_INVALID');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WR6: bad iter → ITER_INVALID', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await expectValidationError(drv, { iter: 0 }, 'ITER_INVALID');
      await expectValidationError(drv, { iter: 2.5 }, 'ITER_INVALID');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WR7: bad role → ROLE_INVALID', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const msg = await expectValidationError(drv, { role: 'reviewer' }, 'ROLE_INVALID');
      match(msg.error.message, /Invalid role/);
      // A write_review role is not a write_report role — the two enums are separate.
      await expectValidationError(drv, { role: 'document-quality' }, 'ROLE_INVALID');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WR8: role/status mismatch → STATUS_INVALID', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      // Verifier statuses are not interchangeable with coder statuses in either direction.
      const msg = await expectValidationError(drv, { role: 'coder', status: 'APPROVED' }, 'STATUS_INVALID');
      ok(msg.error.message.includes('READY_FOR_REVIEW'),
        `message lists the allowed statuses for the role: "${msg.error.message}"`);
      await expectValidationError(drv, { role: 'security', status: 'READY_FOR_REVIEW' }, 'STATUS_INVALID');
      await expectValidationError(drv, { role: 'quality', status: 'BOGUS' }, 'STATUS_INVALID');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WR9: bad body → BODY_INVALID', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      await expectValidationError(drv, { body: 42 }, 'BODY_INVALID');
      await expectValidationError(drv, { body: undefined }, 'BODY_INVALID');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // WR10-WR11: filesystem branch — -32000 plus data.error
  // -------------------------------------------------------------------------

  await runTest("WR10: 'wx' collision — a second identical write in the same second is FS_FAILURE", async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      // The filename carries a second-resolution timestamp, so two back-to-back writes with
      // the same project/step/iter/role collide — UNLESS the pair happens to straddle a
      // second boundary. Retry the pair (each attempt uses a fresh iter so a straddling
      // attempt leaves no file that would poison the next one) rather than sleeping.
      let collision = null;
      for (let attempt = 1; attempt <= 10 && collision === null; attempt++) {
        const args = { ...VALID_ARGS, iter: attempt, project: 'proj-collide' };
        await drv.callTool('write_report', args);
        const second = await drv.callToolRaw('write_report', args);
        if (second.error) collision = second;
      }
      ok(collision !== null, 'a same-second collision was produced within 10 attempts');
      strictEqual(collision.error.code, -32000, 'error.code === -32000 for a runtime failure');
      strictEqual(collision.error.data?.error, 'FS_FAILURE',
        `error.data.error === "FS_FAILURE": ${JSON.stringify(collision.error.data)}`);
      match(collision.error.message, /EEXIST/);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  await runTest('WR11: unwritable step directory → FS_FAILURE with data.error', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      // steps/ occupied by a regular file, so mkdirSync(stepDir) — write_report's first
      // filesystem mutation — fails before any content is written.
      mkdirSync(join(fx.projectRoot, 'scratch', 'proj-report'), { recursive: true });
      writeFileSync(join(fx.projectRoot, 'scratch', 'proj-report', 'steps'), 'blocker', 'utf-8');

      const msg = await drv.callToolRaw('write_report', VALID_ARGS);
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

  // -------------------------------------------------------------------------
  // WR12: schema registration
  // -------------------------------------------------------------------------

  await runTest('WR12: schema registration — write_report present with the documented enums', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      drv.stderrLines(); // drain baseline
      const result = await drv.call('tools/list', {});
      const tool = result.tools.find((t) => t.name === 'write_report');
      ok(tool !== undefined, 'write_report present in tools/list');
      deepStrictEqual(tool.inputSchema.properties.role.enum,
        ['coder', 'completeness', 'quality', 'security'], 'role.enum matches the documented roles');
      strictEqual(tool.inputSchema.properties.step.minimum, 0, 'step.minimum === 0 (0 means ad-hoc)');
      strictEqual(tool.inputSchema.properties.iter.minimum, 1, 'iter.minimum === 1 (1-based)');
      const stderr = drv.stderrLines();
      strictEqual(stderr.length, 0, `server stderr silent across the run: ${JSON.stringify(stderr)}`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  process.stdout.write(`${passCount} passed, ${failCount} failed\n`);
  process.exit(failCount === 0 ? 0 : 1);
})();
