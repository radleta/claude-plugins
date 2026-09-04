#!/usr/bin/env node
// test-write-review-enums.mjs — Zero-framework end-to-end test harness for the
// write_review MCP tool's widened phase/role enums (REVIEW_PHASES gains "plan";
// REVIEW_ROLES/STATUS_BY_REVIEW_ROLE gain step-quality, investigation-quality,
// spec-traceability). Modeled on the sibling test-write-issue.mjs.
//
// Spawns a FRESH `node server.mjs --project-root <tmpdir>` per test, so it
// exercises post-edit server.mjs code even when the session's own running MCP
// server process resolved the pre-edit file at session start.
//
// Usage: node test-write-review-enums.mjs    (no args; 14 tests run in-process; exit 0 on all-pass)

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import { deepStrictEqual, strictEqual, ok, match, fail } from 'node:assert';
import process from 'node:process';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('Usage: node test-write-review-enums.mjs\n\nRuns 14 automated tests against server.mjs. Exit 0 on all-pass, 1 otherwise.\n');
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

const SCRIPTS_DIR = fileURLToPath(new URL('.', import.meta.url));
const SERVER_PATH = fileURLToPath(new URL('./server.mjs', import.meta.url));
let passCount = 0;
let failCount = 0;
const activeDrivers = new Set();  // registered drivers; used by SIGINT guard
const activeFixtures = new Set(); // registered fixture dirs; used by SIGINT guard

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

async function createDriver(projectRoot, serverPath = SERVER_PATH) {
  const child = spawn('node', [serverPath, '--project-root', projectRoot], {
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

function createFixture() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'smcp-rev-'));
  activeFixtures.add(projectRoot);
  return {
    projectRoot,
    cleanup() {
      try { rmSync(projectRoot, { recursive: true, force: true }); } catch {}
      activeFixtures.delete(projectRoot);
    },
  };
}

// Copies the whole scripts/ directory (so server.mjs's relative import of
// ./rewrite-pointer.mjs, and its own transitive imports, still resolve) into a
// tmpdir, then mutates the copy's REVIEW_ROLES array ONLY — appending a
// synthetic role after 'craft', while leaving STATUS_BY_REVIEW_ROLE untouched.
// This reproduces a half-edit that adds a role to one table but not the other.
function buildMutatedServerCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'smcp-mutsrv-'));
  activeFixtures.add(dir);
  cpSync(SCRIPTS_DIR, dir, { recursive: true });
  const mutatedServerPath = join(dir, 'server.mjs');
  const src = readFileSync(mutatedServerPath, 'utf-8');
  // Two-space indent matches only the REVIEW_ROLES array entry — the schema
  // enum mirror at a deeper indent level is untouched by this exact anchor.
  const anchor = "  'craft',\n";
  const idx = src.indexOf(anchor);
  if (idx === -1) {
    throw new Error('mutation anchor "  \'craft\',\\n" not found in copied server.mjs (REVIEW_ROLES entry)');
  }
  const insertAt = idx + anchor.length;
  const mutated = src.slice(0, insertAt) + "  '_orphan-role',\n" + src.slice(insertAt);
  writeFileSync(mutatedServerPath, mutated, 'utf-8');
  return {
    serverPath: mutatedServerPath,
    cleanup() {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
      activeFixtures.delete(dir);
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
  if (!m) throw new Error(`Unexpected write_review result text: ${resultText}`);
  return m[1];
}

// A body that satisfies validateReviewStatusBodyConsistency for the given
// role/status pair — used wherever a test just needs a clean successful write.
function bodyForRole(role, status) {
  if (role === 'domain') {
    return status === 'APPROVED'
      ? '## Aggregate\n**Status:** Approved\n'
      : '## Aggregate\n**Status:** Issues Found\n';
  }
  if (role === 'creative') {
    return '## Suggestions\nConsider an alternative approach.\n';
  }
  return status === 'APPROVED'
    ? '## Summary\nAll good, no issues.\n'
    : '## Issues\n- Something needs fixing.\n';
}

function defaultStatusForRole(role) {
  return role === 'creative' ? 'SUGGESTIONS' : 'APPROVED';
}

(async () => {

  // T1: New phase accepted
  await runTest('T1: new phase accepted — phase=plan, role=step-quality', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      const result = await drv.callTool('write_review', {
        project: 'proj',
        phase: 'plan',
        role: 'step-quality',
        iter: 1,
        status: 'APPROVED',
        body: bodyForRole('step-quality', 'APPROVED'),
      });
      const path = extractWrittenPath(result.content[0].text);
      ok(existsSync(path), `file exists at ${path}`);
      const expectedDir = join(fx.projectRoot, 'scratch', 'proj', 'reviews', 'plan') + sep;
      ok(path.startsWith(expectedDir), `path "${path}" is under reviews/plan/`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T2: Each new role accepted
  await runTest('T2: each new role accepted — three distinct verdict files', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      const roles = ['step-quality', 'investigation-quality', 'spec-traceability'];
      const paths = [];
      for (const role of roles) {
        const result = await drv.callTool('write_review', {
          project: 'proj',
          phase: 'plan',
          role,
          iter: 1,
          status: 'APPROVED',
          body: bodyForRole(role, 'APPROVED'),
        });
        const path = extractWrittenPath(result.content[0].text);
        ok(existsSync(path), `file exists for role ${role} at ${path}`);
        const content = readFileSync(path, 'utf-8');
        const { fields } = parseFrontmatter(content);
        strictEqual(fields.role, role, `frontmatter role matches for ${role}`);
        paths.push(path);
      }
      strictEqual(new Set(paths).size, 3, 'three distinct verdict file paths');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T3: Bogus phase still rejected
  await runTest('T3: bogus phase still rejected', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      let errMessage = null;
      try {
        await drv.callTool('write_review', {
          project: 'proj',
          phase: 'diff',
          role: 'step-quality',
          iter: 1,
          status: 'APPROVED',
          body: bodyForRole('step-quality', 'APPROVED'),
        });
        fail('expected rejection for invalid phase "diff"');
      } catch (err) {
        errMessage = err.message;
      }
      ok(errMessage !== null, 'callTool rejected for bogus phase');
      match(errMessage, /Invalid phase/);
      ok(errMessage.includes('plan'), `allowed-values list includes "plan": ${errMessage}`);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T4: Bogus role still rejected
  await runTest('T4: bogus role still rejected', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      let errMessage = null;
      try {
        await drv.callTool('write_review', {
          project: 'proj',
          phase: 'plan',
          role: 'made-up-role',
          iter: 1,
          status: 'APPROVED',
          body: '## Summary\nAll good.\n',
        });
        fail('expected rejection for invalid role "made-up-role"');
      } catch (err) {
        errMessage = err.message;
      }
      ok(errMessage !== null, 'callTool rejected for bogus role');
      match(errMessage, /Invalid review role/);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T5: Regression — existing phases
  await runTest('T5: regression — existing phases (idea/spec/draft) still write', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      const cases = [
        { phase: 'idea', role: 'document-quality' },
        { phase: 'spec', role: 'decision-traceability' },
        { phase: 'draft', role: 'craft' },
      ];
      for (const { phase, role } of cases) {
        const result = await drv.callTool('write_review', {
          project: 'proj',
          phase,
          role,
          iter: 1,
          status: 'APPROVED',
          body: bodyForRole(role, 'APPROVED'),
        });
        const path = extractWrittenPath(result.content[0].text);
        ok(existsSync(path), `file exists for phase=${phase} role=${role} at ${path}`);
      }
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T6: Regression — existing role branches
  await runTest('T6: regression — domain Aggregate branch and creative early-return branch intact', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      const domainResult = await drv.callTool('write_review', {
        project: 'proj',
        phase: 'idea',
        role: 'domain',
        iter: 1,
        status: 'APPROVED',
        body: '## Aggregate\n**Status:** Approved\n',
      });
      ok(existsSync(extractWrittenPath(domainResult.content[0].text)), 'domain Aggregate-approved write succeeds');

      const creativeResult = await drv.callTool('write_review', {
        project: 'proj',
        phase: 'idea',
        role: 'creative',
        iter: 1,
        status: 'SUGGESTIONS',
        body: '## Suggestions\nConsider caching the response.\n',
      });
      ok(existsSync(extractWrittenPath(creativeResult.content[0].text)), 'creative SUGGESTIONS write succeeds');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T7: Blocking-section direction A (must SUCCEED)
  await runTest('T7: blocking-section direction A — ISSUES_FOUND with non-empty ## Issues succeeds', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      const result = await drv.callTool('write_review', {
        project: 'proj',
        phase: 'plan',
        role: 'step-quality',
        iter: 1,
        status: 'ISSUES_FOUND',
        body: '## Issues\n- Step 3 is missing an acceptance criterion.\n',
      });
      ok(existsSync(extractWrittenPath(result.content[0].text)), 'ISSUES_FOUND with ## Issues content writes successfully');
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T8: Blocking-section direction B (must be REJECTED)
  await runTest('T8: blocking-section direction B — APPROVED with non-empty ## Issues rejected', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      let errMessage = null;
      try {
        await drv.callTool('write_review', {
          project: 'proj',
          phase: 'plan',
          role: 'step-quality',
          iter: 1,
          status: 'APPROVED',
          body: '## Issues\n- This should not be allowed alongside APPROVED.\n',
        });
        fail('expected rejection for APPROVED status with non-empty ## Issues');
      } catch (err) {
        errMessage = err.message;
      }
      ok(errMessage !== null, 'callTool rejected APPROVED with non-empty ## Issues');
      match(errMessage, /Status\/body mismatch/);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T9: Blocking-section trap (must be REJECTED)
  await runTest('T9: blocking-section trap — ISSUES_FOUND with only bold-label findings rejected', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      let errMessage = null;
      try {
        await drv.callTool('write_review', {
          project: 'proj',
          phase: 'plan',
          role: 'step-quality',
          iter: 1,
          status: 'ISSUES_FOUND',
          body: '**Per-step findings:**\n- Step 3 needs another acceptance criterion.\n',
        });
        fail('expected rejection for ISSUES_FOUND with no ## Issues heading');
      } catch (err) {
        errMessage = err.message;
      }
      ok(errMessage !== null, 'callTool rejected the bold-label-only trap body');
      match(errMessage, /body contains no non-empty blocking section/);
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T10: Two-table parity guard (MEDIUM risk mitigation)
  await runTest('T10: two-table parity guard — every listed role writes without TypeError', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      const toolsList = await drv.call('tools/list', {});
      const writeReviewTool = toolsList.tools.find((t) => t.name === 'write_review');
      ok(writeReviewTool, 'write_review tool present in tools/list');
      const roles = writeReviewTool.inputSchema.properties.role.enum;
      ok(Array.isArray(roles) && roles.length > 0, 'role enum is a non-empty array');
      for (const role of roles) {
        const status = defaultStatusForRole(role);
        let errMessage = null;
        try {
          await drv.callTool('write_review', {
            project: 'proj',
            phase: 'plan',
            role,
            iter: 1,
            status,
            body: bodyForRole(role, status),
          });
        } catch (err) {
          errMessage = err.message;
        }
        if (errMessage !== null) {
          ok(!/TypeError/.test(errMessage), `role ${role} error does not mention TypeError: ${errMessage}`);
          ok(!/Cannot read properties of undefined/.test(errMessage), `role ${role} error does not mention undefined-property-read: ${errMessage}`);
        }
      }
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T11: Schema mirror parity
  await runTest('T11: schema mirror parity — phase and role enums match runtime constants', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      const toolsList = await drv.call('tools/list', {});
      const writeReviewTool = toolsList.tools.find((t) => t.name === 'write_review');
      ok(writeReviewTool, 'write_review tool present in tools/list');
      deepStrictEqual(
        writeReviewTool.inputSchema.properties.phase.enum,
        ['idea', 'spec', 'draft', 'plan'],
        'phase enum matches REVIEW_PHASES'
      );
      deepStrictEqual(
        writeReviewTool.inputSchema.properties.role.enum,
        [
          'document-quality',
          'codebase-alignment',
          'domain',
          'creative',
          'decision-traceability',
          'combinatorial-completeness',
          'craft',
          'step-quality',
          'investigation-quality',
          'spec-traceability',
        ],
        'role enum matches REVIEW_ROLES'
      );
    } finally {
      if (drv) await drv.shutdown();
      fx.cleanup();
    }
  });

  // T12: Unguarded-lookup guard fires (MEDIUM risk, runtime half)
  await runTest('T12: unguarded-lookup guard fires for a role missing from STATUS_BY_REVIEW_ROLE', async () => {
    const mutated = buildMutatedServerCopy();
    const fxMutated = createFixture();
    const fxNormal = createFixture();
    let drvMutated;
    let drvNormal;
    try {
      drvMutated = await createDriver(fxMutated.projectRoot, mutated.serverPath);
      let mutatedErr = null;
      try {
        await drvMutated.callTool('write_review', {
          project: 'proj',
          phase: 'plan',
          role: '_orphan-role',
          iter: 1,
          status: 'APPROVED',
          body: 'x',
        });
        fail('expected rejection for a role present in REVIEW_ROLES but absent from STATUS_BY_REVIEW_ROLE');
      } catch (err) {
        mutatedErr = err.message;
      }
      ok(mutatedErr !== null, 'mutated server rejected the orphan role');
      match(mutatedErr, /no STATUS_BY_REVIEW_ROLE entry/);
      ok(!/TypeError/.test(mutatedErr), `guard message does not mention TypeError: ${mutatedErr}`);
      ok(!/Cannot read properties of undefined/.test(mutatedErr), `guard message does not mention undefined-property-read: ${mutatedErr}`);

      drvNormal = await createDriver(fxNormal.projectRoot);
      let normalErr = null;
      try {
        await drvNormal.callTool('write_review', {
          project: 'proj',
          phase: 'plan',
          role: '_orphan-role',
          iter: 1,
          status: 'APPROVED',
          body: 'x',
        });
        fail('expected rejection for an unrecognized role against the unmutated server');
      } catch (err) {
        normalErr = err.message;
      }
      ok(normalErr !== null, 'unmutated server rejected the orphan role');
      match(normalErr, /Invalid review role/);
    } finally {
      if (drvMutated) await drvMutated.shutdown();
      if (drvNormal) await drvNormal.shutdown();
      mutated.cleanup();
      fxMutated.cleanup();
      fxNormal.cleanup();
    }
  });

  // T13/T14: structured error channel. T3/T4/T8/T9/T12 above only regex-match
  // err.message; these assert the machine-readable half callers are told to
  // branch on (error.code plus error.data.error).
  await runTest('T13: validation failures are -32602 and carry the matching data.error', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      const base = { project: 'proj', phase: 'plan', role: 'step-quality', iter: 1, status: 'APPROVED' };
      const cases = [
        ['PROJECT_INVALID', { ...base, project: 'bad/proj', body: bodyForRole('step-quality', 'APPROVED') }],
        ['PHASE_INVALID', { ...base, phase: 'diff', body: bodyForRole('step-quality', 'APPROVED') }],
        ['ITER_INVALID', { ...base, iter: 0, body: bodyForRole('step-quality', 'APPROVED') }],
        ['ROLE_INVALID', { ...base, role: 'made-up-role', body: bodyForRole('step-quality', 'APPROVED') }],
        ['STATUS_INVALID', { ...base, status: 'BOGUS', body: bodyForRole('step-quality', 'APPROVED') }],
        ['SKILLS_INVALID', { ...base, skills: ['bad name'], body: bodyForRole('step-quality', 'APPROVED') }],
        ['BODY_INVALID', { ...base, body: 42 }],
        ['STATUS_BODY_MISMATCH', { ...base, body: '## Issues\n- Not allowed alongside APPROVED.\n' }],
      ];
      for (const [expected, args] of cases) {
        const msg = await drv.callToolRaw('write_review', args);
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

  await runTest('T14: filesystem branch — FS_FAILURE is -32000 with data.error', async () => {
    const fx = createFixture();
    let drv;
    try {
      drv = await createDriver(fx.projectRoot);
      // scratch/proj/reviews occupied by a regular file, so mkdirSync(phaseDir)
      // — write_review's first filesystem mutation — fails.
      mkdirSync(join(fx.projectRoot, 'scratch', 'proj'), { recursive: true });
      writeFileSync(join(fx.projectRoot, 'scratch', 'proj', 'reviews'), 'blocker', 'utf-8');

      const msg = await drv.callToolRaw('write_review', {
        project: 'proj',
        phase: 'plan',
        role: 'step-quality',
        iter: 1,
        status: 'APPROVED',
        body: bodyForRole('step-quality', 'APPROVED'),
      });
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

  process.stdout.write(`${passCount} passed, ${failCount} failed\n`);
  process.exit(failCount === 0 ? 0 : 1);
})();
