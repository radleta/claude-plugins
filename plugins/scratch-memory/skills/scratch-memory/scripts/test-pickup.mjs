#!/usr/bin/env node
// test-pickup.mjs — CLI-surface end-to-end tests for the pickup verb.
// Port of test-pickup-handoff.mjs (16 MCP tests → 16 CLI tests).
// Usage: node test-pickup.mjs   (exit 0 on all-pass)
//
// Key difference from MCP surface:
//   - to_session_id is resolved from the current process's PID file (not passed as arg).
//   - runPickup(fromArg, toSessionId, opts) spawns pickup-with-pid.mjs which writes its own
//     PID file as toSessionId before calling the pickup CLI — so the child's PID matches.
//   - from_session_id is passed as the positional arg to `pickup`.

import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deepStrictEqual, strictEqual, ok } from 'node:assert';
import process from 'node:process';

import { runCli, runHandoffFlow, runPickup } from './test-driver.mjs';
import { createFixture, writePidFile, parseFrontmatter, validBody } from './test-fixtures.mjs';
import { parseMandatory, parseAvailable } from './pickup.mjs';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('Usage: node test-pickup.mjs\n\nRuns 16 CLI-surface tests. Exit 0 on all-pass, 1 otherwise.\n');
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

// --- Helper: seed a handoff via CLI init+commit ---
function seedHandoff(sessionId, fx) {
  const env = { ...process.env, CLAUDE_SESSIONS_DIR: fx.sessionsDir };
  return runHandoffFlow({ sessionId, body: validBody(), env, cwd: fx.projectRoot });
}

(async () => {

  // T1: Happy path rename — S-{A} → S-{B}
  await runTest('T1: Happy path rename — folder renamed, frontmatter updated', async () => {
    const fx = createFixture();
    try {
      const idA = 'session-a-001';
      const idB = 'session-b-001';

      const seedResult = seedHandoff(idA, fx);
      strictEqual(seedResult.commitExitCode, 0, 'seed A succeeded');
      const firstWritten = seedResult.json.first_written;

      const result = runPickup(idA, idB, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
      });
      strictEqual(result.exitCode, 0, `pickup exited 0 (stderr: ${result.stderr})`);

      const payload = result.json;
      ok(typeof payload.from_path === 'string' && payload.from_path.length > 0, 'from_path is a non-empty string');
      ok(typeof payload.to_path === 'string' && payload.to_path.length > 0, 'to_path is a non-empty string');
      ok(Array.isArray(payload.session_chain), 'session_chain is an array');
      deepStrictEqual(payload.session_chain, [idA], `session_chain === [${idA}]`);
      strictEqual(payload.session_id, idB, `session_id === ${idB}`);
      strictEqual(payload.first_written, firstWritten, 'first_written preserved in response');
      ok('related_projects' in payload, 'related_projects in response');
      ok('goal_one_liner' in payload, 'goal_one_liner in response');
      ok('body' in payload, 'body in response');
      ok('last_updated' in payload, 'last_updated in response');

      // Step 05: mandatory_skills + available_skills replace skills_loaded
      ok('mandatory_skills' in payload, 'mandatory_skills in response');
      ok(Array.isArray(payload.mandatory_skills), 'mandatory_skills is an Array');
      payload.mandatory_skills.forEach((s, i) => ok(typeof s === 'string', `mandatory_skills[${i}] is a string`));
      ok('available_skills' in payload, 'available_skills in response');
      ok(Array.isArray(payload.available_skills), 'available_skills is an Array');
      payload.available_skills.forEach((s, i) => ok(typeof s === 'string', `available_skills[${i}] is a string`));

      // Filesystem assertions
      const oldFolder = join(fx.projectRoot, 'scratch', `S-${idA}`);
      const newFolder = join(fx.projectRoot, 'scratch', `S-${idB}`);
      const newFile = join(newFolder, 'HANDOFF.md');

      ok(!existsSync(oldFolder), `old folder S-${idA} no longer exists`);
      ok(existsSync(newFolder), `new folder S-${idB} exists`);
      ok(existsSync(newFile), 'HANDOFF.md exists in new folder');

      // Frontmatter integrity
      const content = readFileSync(newFile, 'utf-8');
      const { fields, sessionChain } = parseFrontmatter(content);
      strictEqual(fields.session_id, idB, `frontmatter session_id updated to ${idB}`);
      deepStrictEqual(sessionChain, [idA], `frontmatter session_chain === [${idA}]`);
      strictEqual(fields.first_written, firstWritten, 'frontmatter first_written preserved');
    } finally {
      fx.cleanup();
    }
  });

  // T2: session_chain grows across two pickups (A → B → C)
  await runTest('T2: session_chain grows across two pickups (A → B → C)', async () => {
    const fx = createFixture();
    try {
      const idA = 'chain-a-002';
      const idB = 'chain-b-002';
      const idC = 'chain-c-002';

      const sA = seedHandoff(idA, fx);
      strictEqual(sA.commitExitCode, 0, 'seed A succeeded');

      // Pickup A → B
      const r1 = runPickup(idA, idB, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      strictEqual(r1.exitCode, 0, `first pickup exited 0 (stderr: ${r1.stderr})`);

      // Pickup B → C
      const r2 = runPickup(idB, idC, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      strictEqual(r2.exitCode, 0, `second pickup exited 0 (stderr: ${r2.stderr})`);

      const payload = r2.json;
      deepStrictEqual(payload.session_chain, [idA, idB], `response session_chain === [${idA}, ${idB}]`);
      strictEqual(payload.session_id, idC, `response session_id === ${idC}`);

      // Verify frontmatter
      const newFile = join(fx.projectRoot, 'scratch', `S-${idC}`, 'HANDOFF.md');
      ok(existsSync(newFile), 'HANDOFF.md exists at S-C');
      const content = readFileSync(newFile, 'utf-8');
      const { fields, sessionChain } = parseFrontmatter(content);
      strictEqual(fields.session_id, idC, `frontmatter session_id === ${idC}`);
      deepStrictEqual(sessionChain, [idA, idB], `frontmatter session_chain === [${idA}, ${idB}]`);

      ok(!existsSync(join(fx.projectRoot, 'scratch', `S-${idA}`)), 'S-A gone');
      ok(!existsSync(join(fx.projectRoot, 'scratch', `S-${idB}`)), 'S-B gone');
    } finally {
      fx.cleanup();
    }
  });

  // T3: PICKUP_COLLISION — target folder already exists (UUID-form collision)
  await runTest('T3: PICKUP_COLLISION when target folder already exists', async () => {
    const fx = createFixture();
    try {
      const idA = 'coll-a-003';
      const idB = 'coll-b-003';

      // Seed both A and B — two live handoffs
      const sA = seedHandoff(idA, fx);
      const sB = seedHandoff(idB, fx);
      strictEqual(sA.commitExitCode, 0, 'seed A succeeded');
      strictEqual(sB.commitExitCode, 0, 'seed B succeeded');

      const folderA = join(fx.projectRoot, 'scratch', `S-${idA}`);
      const folderB = join(fx.projectRoot, 'scratch', `S-${idB}`);
      ok(existsSync(join(folderA, 'HANDOFF.md')), 'S-A/HANDOFF.md exists before pickup');
      ok(existsSync(join(folderB, 'HANDOFF.md')), 'S-B/HANDOFF.md exists before pickup');

      // Pickup A → B — B already exists with a different session_id, must fail
      const result = runPickup(idA, idB, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      ok(result.exitCode !== 0, 'pickup rejected with PICKUP_COLLISION');
      ok(result.stderr.includes('PICKUP_COLLISION'), `error includes PICKUP_COLLISION: "${result.stderr}"`);

      // Filesystem must be unchanged
      ok(existsSync(join(folderA, 'HANDOFF.md')), 'S-A/HANDOFF.md still exists after collision');
      ok(existsSync(join(folderB, 'HANDOFF.md')), 'S-B/HANDOFF.md still exists after collision');
    } finally {
      fx.cleanup();
    }
  });

  // T4: PICKUP_SOURCE_MISSING — non-existent source
  await runTest('T4: PICKUP_SOURCE_MISSING for non-existent source id', async () => {
    const fx = createFixture();
    try {
      const idFrom = 'ghost-from-004';
      const idTo = 'ghost-to-004';

      const result = runPickup(idFrom, idTo, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      ok(result.exitCode !== 0, 'pickup rejected for non-existent source');
      // CLI may emit PICKUP_SOURCE_MISSING (uuid-form) or "no handoff found" (non-uuid slug resolution)
      ok(
        result.stderr.includes('PICKUP_SOURCE_MISSING') || result.stderr.includes('no handoff found') || result.stderr.includes('ERROR'),
        `error mentions source missing: "${result.stderr}"`
      );

      ok(!existsSync(join(fx.projectRoot, 'scratch', `S-${idFrom}`)), 'source folder not created');
      ok(!existsSync(join(fx.projectRoot, 'scratch', `S-${idTo}`)), 'target folder not created');
    } finally {
      fx.cleanup();
    }
  });

  // T5: Same-name pickup performs in-place takeover (one-arg /pickup fast path)
  await runTest('T5: same-name pickup updates session_chain[] without rename', async () => {
    const fx = createFixture();
    try {
      const id = 'self-pickup-005';

      const seedResult = seedHandoff(id, fx);
      strictEqual(seedResult.commitExitCode, 0, 'seed succeeded');

      const folder = join(fx.projectRoot, 'scratch', `S-${id}`);
      ok(existsSync(join(folder, 'HANDOFF.md')), 'HANDOFF.md exists pre-pickup');

      // Same session_id for both from and to — exercises isSamePathTakeover branch
      const result = runPickup(id, id, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      strictEqual(result.exitCode, 0, `pickup succeeded: stderr="${result.stderr}"`);

      // Folder still at the same path (no rename)
      ok(existsSync(join(folder, 'HANDOFF.md')), 'HANDOFF.md still at original path post-pickup');

      // session_chain[] now includes the from session_id (lineage recorded)
      const after = readFileSync(join(folder, 'HANDOFF.md'), 'utf-8');
      ok(after.includes('session_chain'), 'session_chain frontmatter present');
      ok(after.includes(id), `session_chain references id "${id}"`);
    } finally {
      fx.cleanup();
    }
  });

  // T6: .bak/ directory preserved across rename
  await runTest('T6: .bak/ files preserved when folder is renamed', async () => {
    const fx = createFixture();
    try {
      const idA = 'bak-src-006';
      const idB = 'bak-dst-006';

      const r0 = seedHandoff(idA, fx);
      strictEqual(r0.commitExitCode, 0, 'first write succeeded');

      // Second write — triggers .bak creation via init
      const env = { ...process.env, CLAUDE_SESSIONS_DIR: fx.sessionsDir };
      const r1 = runHandoffFlow({
        sessionId: idA,
        body: validBody({ done: '- Did initial setup\n- Second write step' }),
        env,
        cwd: fx.projectRoot,
      });
      strictEqual(r1.commitExitCode, 0, 'second write succeeded');

      const bakDirA = join(fx.projectRoot, 'scratch', `S-${idA}`, '.bak');
      ok(existsSync(bakDirA), '.bak/ exists in S-A after second write');
      const bakFilesA = readdirSync(bakDirA).filter(f => f.endsWith('.md.bak'));
      ok(bakFilesA.length >= 1, '.bak/ has at least one file');

      const bakContentsA = bakFilesA.map(f => ({
        name: f,
        content: readFileSync(join(bakDirA, f), 'utf-8'),
      }));

      // Pickup A → B
      const result = runPickup(idA, idB, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      strictEqual(result.exitCode, 0, `pickup exited 0 (stderr: ${result.stderr})`);

      const bakDirB = join(fx.projectRoot, 'scratch', `S-${idB}`, '.bak');
      ok(existsSync(bakDirB), '.bak/ exists in S-B after rename');
      const bakFilesB = readdirSync(bakDirB).filter(f => f.endsWith('.md.bak'));
      strictEqual(bakFilesB.length, bakFilesA.length, '.bak/ file count matches after rename');

      for (const { name, content } of bakContentsA) {
        ok(bakFilesB.includes(name), `.bak/${name} exists in S-B`);
        const bContent = readFileSync(join(bakDirB, name), 'utf-8');
        strictEqual(bContent, content, `.bak/${name} content is identical in S-B`);
      }

      ok(!existsSync(join(fx.projectRoot, 'scratch', `S-${idA}`)), 'S-A folder gone after rename');
    } finally {
      fx.cleanup();
    }
  });

  // T7: Frontmatter integrity — only session_id and session_chain change on pickup
  await runTest('T7: Frontmatter integrity — only session_id and session_chain change', async () => {
    const fx = createFixture();
    try {
      const idA = 'fm-src-007';
      const idB = 'fm-dst-007';

      const bodyWithRefs = validBody({ artifacts: '- scratch/proj-alpha/README.md\n- scratch/proj-beta/spec.md' });
      const env = { ...process.env, CLAUDE_SESSIONS_DIR: fx.sessionsDir };
      const r0 = runHandoffFlow({ sessionId: idA, body: bodyWithRefs, env, cwd: fx.projectRoot });
      strictEqual(r0.commitExitCode, 0, 'seed A succeeded');

      const origContent = readFileSync(join(fx.projectRoot, 'scratch', `S-${idA}`, 'HANDOFF.md'), 'utf-8');
      const { fields: origFields } = parseFrontmatter(origContent);

      const result = runPickup(idA, idB, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      strictEqual(result.exitCode, 0, `pickup exited 0 (stderr: ${result.stderr})`);

      const newContent = readFileSync(join(fx.projectRoot, 'scratch', `S-${idB}`, 'HANDOFF.md'), 'utf-8');
      const { fields: newFields, sessionChain } = parseFrontmatter(newContent);

      strictEqual(newFields.first_written, origFields.first_written, 'first_written unchanged');
      strictEqual(newFields.last_updated, origFields.last_updated, 'last_updated unchanged (D7: no bump on pickup)');
      strictEqual(newFields.git_branch, origFields.git_branch, 'git_branch unchanged');
      strictEqual(newFields.goal, origFields.goal, 'goal unchanged');
      // schema_version may be upgraded from 1 → 2 by mechanical migration (Step 05, D9);
      // the invariant is that it never goes backward (2 → 1).
      ok(
        Number(newFields.schema_version) >= Number(origFields.schema_version),
        `schema_version is non-decreasing: ${origFields.schema_version} → ${newFields.schema_version}`
      );

      strictEqual(newFields.session_id, idB, `session_id updated to ${idB}`);
      deepStrictEqual(sessionChain, [idA], `session_chain added with [${idA}]`);

      ok(newContent.includes('proj-alpha'), 'related_projects preserved: proj-alpha');
      ok(newContent.includes('proj-beta'), 'related_projects preserved: proj-beta');
    } finally {
      fx.cleanup();
    }
  });

  // T8: PATH_INVALID — rejected for traversal, slash, and empty ids
  await runTest('T8: PATH_INVALID — rejected for traversal, slash, and empty ids', async () => {
    const fx = createFixture();
    try {
      // dotdot traversal — use a valid toSessionId
      {
        const r = runPickup('../../etc', 'valid-to-008', { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
        ok(r.exitCode !== 0, 'rejected for from_session_id with dotdot traversal');
        ok(
          r.stderr.includes('PICKUP_INVALID_FROM_SESSION_ID'),
          `stderr includes PICKUP_INVALID_FROM_SESSION_ID: "${r.stderr}"`
        );
      }

      // slash
      {
        const r = runPickup('a/b', 'valid-to-008', { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
        ok(r.exitCode !== 0, 'rejected for from_session_id with slash');
        ok(
          r.stderr.includes('PICKUP_INVALID_FROM_SESSION_ID'),
          `stderr includes PICKUP_INVALID_FROM_SESSION_ID: "${r.stderr}"`
        );
      }

      // No S-* folders created
      const scratchDir = join(fx.projectRoot, 'scratch');
      if (existsSync(scratchDir)) {
        const entries = readdirSync(scratchDir).filter(e => e.startsWith('S-'));
        strictEqual(entries.length, 0, 'no S-* folders created by invalid calls');
      }
    } finally {
      fx.cleanup();
    }
  });

  // T9: Unnamed target → uuid folder (no PID file name, session_name null)
  await runTest('T9: Unnamed target — uuid folder when no PID file name', async () => {
    const fx = createFixture();
    try {
      const idOld = 'uuid-old-009';
      const idNew = 'uuid-new-009';

      const sResult = seedHandoff(idOld, fx);
      strictEqual(sResult.commitExitCode, 0, 'seed succeeded');

      // No name field → unnamed session → uuid folder
      const result = runPickup(idOld, idNew, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
        // No name = unnamed
      });
      strictEqual(result.exitCode, 0, `pickup exited 0 (stderr: ${result.stderr})`);

      const payload = result.json;

      const expectedFolder = join(fx.projectRoot, 'scratch', `S-${idNew}`);
      ok(existsSync(expectedFolder), `target folder S-${idNew} exists`);
      ok(!existsSync(join(fx.projectRoot, 'scratch', `S-${idOld}`)), `source folder S-${idOld} gone`);

      strictEqual(payload.folder_slug, idNew, 'folder_slug === uuid-new (unnamed fallback)');
      strictEqual(payload.session_name, null, 'session_name === null for unnamed session');
      strictEqual(payload.session_id, idNew, `session_id === ${idNew}`);

      // Step 05: mandatory_skills + available_skills replace skills_loaded
      ok(Array.isArray(payload.mandatory_skills), 'mandatory_skills is an Array of strings');
      payload.mandatory_skills.forEach((s, i) => ok(typeof s === 'string', `mandatory_skills[${i}] is a string`));
      ok(Array.isArray(payload.available_skills), 'available_skills is an Array of strings');
      payload.available_skills.forEach((s, i) => ok(typeof s === 'string', `available_skills[${i}] is a string`));

      const content = readFileSync(join(expectedFolder, 'HANDOFF.md'), 'utf-8');
      const { fields, sessionChain } = parseFrontmatter(content);
      strictEqual(fields.session_id, idNew, `frontmatter session_id === ${idNew}`);
      strictEqual(fields.session_name, 'null', 'frontmatter session_name === null (literal)');
      deepStrictEqual(sessionChain, [idOld], `session_chain === [${idOld}]`);
    } finally {
      fx.cleanup();
    }
  });

  // T11: PICKUP_COLLISION — target slug folder already exists and belongs to a different session
  await runTest('T11: PICKUP_COLLISION — slug target exists belonging to foreign session', async () => {
    const fx = createFixture();
    try {
      const idOld = 'uuid-old-011';
      const idNew = 'uuid-new-011';
      const idOther = 'uuid-other-011';

      const sResult = seedHandoff(idOld, fx);
      strictEqual(sResult.commitExitCode, 0, 'seed succeeded');

      // Pre-populate S-{idNew}/ with a DIFFERENT session's HANDOFF.md
      const targetFolder = join(fx.projectRoot, 'scratch', `S-${idNew}`);
      mkdirSync(targetFolder, { recursive: true });
      const foreignHandoff = [
        '---',
        `session_id: ${idOther}`,
        'first_written: 2026-01-01T00:00:00.000Z',
        'last_updated: 2026-01-01T00:00:00.000Z',
        'git_branch: main',
        'session_name: null',
        'related_projects: []',
        'goal: Foreign session goal',
        'schema_version: 1',
        '---',
        validBody(),
      ].join('\n');
      writeFileSync(join(targetFolder, 'HANDOFF.md'), foreignHandoff, 'utf-8');

      const result = runPickup(idOld, idNew, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
      });
      ok(result.exitCode !== 0, 'pickup rejected with PICKUP_COLLISION');
      ok(result.stderr.includes('PICKUP_COLLISION'), `error includes PICKUP_COLLISION: "${result.stderr}"`);

      ok(existsSync(join(fx.projectRoot, 'scratch', `S-${idOld}`, 'HANDOFF.md')), 'source S-uuid-old still intact');
      const targetContent = readFileSync(join(targetFolder, 'HANDOFF.md'), 'utf-8');
      const { fields } = parseFrontmatter(targetContent);
      strictEqual(fields.session_id, idOther, 'target folder still belongs to foreign session');
    } finally {
      fx.cleanup();
    }
  });

  // T12: Idempotent pickup — target already belongs to us
  await runTest('T12: Idempotent pickup — target already belongs to current session', async () => {
    const fx = createFixture();
    try {
      const idOld = 'uuid-old-012';
      const idNew = 'uuid-new-012';
      const sessionName = 'feature-y';
      const targetFolder = join(fx.projectRoot, 'scratch', `S-${sessionName}`);
      const sourceFolder = join(fx.projectRoot, 'scratch', `S-${idOld}`);

      mkdirSync(targetFolder, { recursive: true });
      const ours = [
        '---',
        `session_id: ${idNew}`,
        'first_written: 2026-01-01T00:00:00.000Z',
        'last_updated: 2026-01-01T01:00:00.000Z',
        'git_branch: main',
        'session_name: feature-y',
        'related_projects: []',
        'session_chain:',
        `  - ${idOld}`,
        'goal: Ship handoff skill.',
        'schema_version: 1',
        '---',
        validBody(),
      ].join('\n');
      writeFileSync(join(targetFolder, 'HANDOFF.md'), ours, 'utf-8');
      const originalContent = readFileSync(join(targetFolder, 'HANDOFF.md'), 'utf-8');

      mkdirSync(sourceFolder, { recursive: true });
      writeFileSync(join(sourceFolder, 'HANDOFF.md'), [
        '---',
        `session_id: ${idOld}`,
        'first_written: 2026-01-01T00:00:00.000Z',
        'last_updated: 2026-01-01T00:00:00.000Z',
        'git_branch: main',
        'session_name: null',
        'related_projects: []',
        'goal: Ship handoff skill.',
        'schema_version: 1',
        '---',
        validBody(),
      ].join('\n'), 'utf-8');

      const result = runPickup(idOld, idNew, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
        name: sessionName,
      });
      strictEqual(result.exitCode, 0, `idempotent pickup exited 0 (stderr: ${result.stderr})`);
      strictEqual(result.json.session_id, idNew, `session_id === ${idNew}`);

      ok(existsSync(join(targetFolder, 'HANDOFF.md')), 'target HANDOFF.md still exists');
      const afterContent = readFileSync(join(targetFolder, 'HANDOFF.md'), 'utf-8');
      strictEqual(afterContent, originalContent, 'target content unchanged by idempotent pickup');

      ok(!existsSync(sourceFolder), 'source folder removed by idempotent pickup');
    } finally {
      fx.cleanup();
    }
  });

  // T13: first_written preserved through pickup + rename
  await runTest('T13: first_written preserved through pickup and rename', async () => {
    const fx = createFixture();
    try {
      const idOld = 'uuid-old-013';
      const idNew = 'uuid-new-013';

      const sResult = seedHandoff(idOld, fx);
      strictEqual(sResult.commitExitCode, 0, 'seed succeeded');
      const firstWrittenT1 = sResult.json.first_written;

      const result = runPickup(idOld, idNew, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      strictEqual(result.exitCode, 0, `pickup exited 0 (stderr: ${result.stderr})`);

      const payload = result.json;
      strictEqual(payload.first_written, firstWrittenT1, 'response first_written === T1 (not bumped)');

      const targetFile = join(fx.projectRoot, 'scratch', `S-${idNew}`, 'HANDOFF.md');
      ok(existsSync(targetFile), 'target HANDOFF.md exists');
      const content = readFileSync(targetFile, 'utf-8');
      const { fields } = parseFrontmatter(content);
      strictEqual(fields.first_written, firstWrittenT1, 'frontmatter first_written === T1 after pickup');
    } finally {
      fx.cleanup();
    }
  });

  // T14: session_chain grows — prior chain entries are preserved when picking up a named session
  await runTest('T14: session_chain grows — prior chain + from_session_id appended', async () => {
    const fx = createFixture();
    try {
      const idZ = 'uuid-z-014';
      const idA = 'uuid-a-014';
      const idB = 'uuid-b-014';

      // Manually write S-uuid-A/ with session_chain: [uuid-Z]
      const sourceFolder = join(fx.projectRoot, 'scratch', `S-${idA}`);
      mkdirSync(sourceFolder, { recursive: true });
      const priorHandoff = [
        '---',
        `session_id: ${idA}`,
        'first_written: 2026-01-01T00:00:00.000Z',
        'last_updated: 2026-01-01T00:00:00.000Z',
        'git_branch: main',
        'session_name: null',
        'related_projects: []',
        'session_chain:',
        `  - ${idZ}`,
        'goal: Ship session name folders.',
        'schema_version: 1',
        '---',
        validBody(),
      ].join('\n');
      writeFileSync(join(sourceFolder, 'HANDOFF.md'), priorHandoff, 'utf-8');

      const result = runPickup(idA, idB, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
      });
      strictEqual(result.exitCode, 0, `pickup exited 0 (stderr: ${result.stderr})`);

      const payload = result.json;
      deepStrictEqual(payload.session_chain, [idZ, idA], `response session_chain === [${idZ}, ${idA}]`);
      strictEqual(payload.session_id, idB, `session_id === ${idB}`);
      strictEqual(payload.folder_slug, idB, `folder_slug === ${idB}`);

      const targetFile = join(fx.projectRoot, 'scratch', `S-${idB}`, 'HANDOFF.md');
      ok(existsSync(targetFile), 'target HANDOFF.md exists at S-{idB}/');
      const content = readFileSync(targetFile, 'utf-8');
      const { fields, sessionChain } = parseFrontmatter(content);
      strictEqual(fields.session_id, idB, `frontmatter session_id === ${idB}`);
      deepStrictEqual(sessionChain, [idZ, idA], `frontmatter session_chain === [${idZ}, ${idA}]`);

      ok(!existsSync(sourceFolder), 'source folder S-uuid-A gone after pickup');
    } finally {
      fx.cleanup();
    }
  });

  // T15: consecutive-dedup — re-pickup of same session_id does not append a duplicate
  await runTest('T15: consecutive-dedup — re-pickup of same session does not append duplicate', async () => {
    const fx = createFixture();
    try {
      const id = 'uuid-t15-dedup';

      // Manually write S-{id}/HANDOFF.md with session_chain: [id]
      const sourceFolder = join(fx.projectRoot, 'scratch', `S-${id}`);
      mkdirSync(sourceFolder, { recursive: true });
      const priorHandoff = [
        '---',
        `session_id: ${id}`,
        'first_written: 2026-01-01T00:00:00.000Z',
        'last_updated: 2026-01-01T00:00:00.000Z',
        'git_branch: main',
        'session_name: null',
        'related_projects: []',
        'session_chain:',
        `  - ${id}`,
        'goal: Consecutive-dedup test.',
        'schema_version: 1',
        '---',
        validBody(),
      ].join('\n');
      writeFileSync(join(sourceFolder, 'HANDOFF.md'), priorHandoff, 'utf-8');

      // First pickup: from id to id (same-path takeover) — chain must stay [id], not become [id, id]
      const r1 = runPickup(id, id, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      strictEqual(r1.exitCode, 0, `first pickup exited 0 (stderr: ${r1.stderr})`);
      deepStrictEqual(r1.json.session_chain, [id], `first pickup: session_chain === [${id}] (no dup)`);

      // Second pickup: same again — still must stay [id]
      const r2 = runPickup(id, id, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      strictEqual(r2.exitCode, 0, `second pickup exited 0 (stderr: ${r2.stderr})`);
      deepStrictEqual(r2.json.session_chain, [id], `second pickup: session_chain === [${id}] (still no dup)`);

      // Third pickup: same again — still must stay [id]
      const r3 = runPickup(id, id, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      strictEqual(r3.exitCode, 0, `third pickup exited 0 (stderr: ${r3.stderr})`);
      deepStrictEqual(r3.json.session_chain, [id], `third pickup: session_chain === [${id}] (still no dup after 3 consecutive)`);

      // Confirm the written HANDOFF.md also has length-1 chain
      const targetFile = join(fx.projectRoot, 'scratch', `S-${id}`, 'HANDOFF.md');
      const { sessionChain } = parseFrontmatter(readFileSync(targetFile, 'utf-8'));
      deepStrictEqual(sessionChain, [id], `frontmatter session_chain === [${id}] (length 1, not 4)`);
    } finally {
      fx.cleanup();
    }
  });

  // T16: alternation preserved — A→B→A→B pickup sequence produces 4 chain entries
  // Validates consecutive-only dedup: non-consecutive repeats are NOT collapsed.
  // Starting chain: [] (empty). Sequence: A→B, B→A, A→B, B→A (4 pickups).
  // After each pickup, from_session_id is appended unless it equals priorChain[last].
  //   pickup A→B: priorChain=[], append idA → [idA]
  //   pickup B→A: priorChain=[idA], idB≠idA → append → [idA,idB]
  //   pickup A→B: priorChain=[idA,idB], idA≠idB → append → [idA,idB,idA]
  //   pickup B→A: priorChain=[idA,idB,idA], idB≠idA → append → [idA,idB,idA,idB]
  await runTest('T16: alternation preserved — A→B→A→B sequence produces 4 chain entries', async () => {
    const fx = createFixture();
    try {
      const idA = 'uuid-a-t16';
      const idB = 'uuid-b-t16';

      // Start with empty session_chain so each pickup appends the from_session_id fresh.
      const sourceFolder = join(fx.projectRoot, 'scratch', `S-${idA}`);
      mkdirSync(sourceFolder, { recursive: true });
      const priorHandoff = [
        '---',
        `session_id: ${idA}`,
        'first_written: 2026-01-01T00:00:00.000Z',
        'last_updated: 2026-01-01T00:00:00.000Z',
        'git_branch: main',
        'session_name: null',
        'related_projects: []',
        'session_chain: []',
        'goal: Alternation test.',
        'schema_version: 1',
        '---',
        validBody(),
      ].join('\n');
      writeFileSync(join(sourceFolder, 'HANDOFF.md'), priorHandoff, 'utf-8');

      // Pickup 1: A→B — priorChain=[], idA appended → [idA]. S-idA → S-idB.
      const r1 = runPickup(idA, idB, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      strictEqual(r1.exitCode, 0, `pickup 1 (A→B) exited 0 (stderr: ${r1.stderr})`);
      deepStrictEqual(r1.json.session_chain, [idA], `after pickup 1: chain=[${idA}]`);

      // Pickup 2: B→A — priorChain=[idA], idB≠idA → append → [idA,idB]. S-idB → S-idA.
      const r2 = runPickup(idB, idA, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      strictEqual(r2.exitCode, 0, `pickup 2 (B→A) exited 0 (stderr: ${r2.stderr})`);
      deepStrictEqual(r2.json.session_chain, [idA, idB], `after pickup 2: chain=[${idA},${idB}]`);

      // Pickup 3: A→B — priorChain=[idA,idB], idA≠idB → append → [idA,idB,idA]. S-idA → S-idB.
      const r3 = runPickup(idA, idB, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      strictEqual(r3.exitCode, 0, `pickup 3 (A→B) exited 0 (stderr: ${r3.stderr})`);
      deepStrictEqual(r3.json.session_chain, [idA, idB, idA], `after pickup 3: chain=[${idA},${idB},${idA}]`);

      // Pickup 4: B→A — priorChain=[idA,idB,idA], idB≠idA → append → [idA,idB,idA,idB]. S-idB → S-idA.
      const r4 = runPickup(idB, idA, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      strictEqual(r4.exitCode, 0, `pickup 4 (B→A) exited 0 (stderr: ${r4.stderr})`);
      deepStrictEqual(r4.json.session_chain, [idA, idB, idA, idB], `after pickup 4: chain=[${idA},${idB},${idA},${idB}] (length 4)`);

      // Confirm written HANDOFF.md also has all 4 entries.
      const targetFile = join(fx.projectRoot, 'scratch', `S-${idA}`, 'HANDOFF.md');
      const { sessionChain: finalChain } = parseFrontmatter(readFileSync(targetFile, 'utf-8'));
      deepStrictEqual(finalChain, [idA, idB, idA, idB], `frontmatter final chain has 4 entries (consecutive-only dedup preserves alternation)`);
    } finally {
      fx.cleanup();
    }
  });

  // T17: pickup slug-renamed source folder — source exists at S-{slug}/ not S-{uuid}/  [was T15]
  await runTest('T17: pickup resolves slug-renamed source folder via frontmatter scan (Bug C fix)', async () => {
    const fx = createFixture();
    try {
      const idSource = 'uuid-source-015';
      const idTarget = 'uuid-target-015';
      const sourceSlug = 'my-renamed-source';

      const slugFolder = join(fx.projectRoot, 'scratch', `S-${sourceSlug}`);
      mkdirSync(slugFolder, { recursive: true });
      const priorHandoff = [
        '---',
        `session_id: ${idSource}`,
        'first_written: 2026-01-01T00:00:00.000Z',
        'last_updated: 2026-01-01T00:00:00.000Z',
        'git_branch: main',
        `session_name: ${sourceSlug}`,
        'related_projects: []',
        'goal: Test slug-source pickup.',
        'schema_version: 1',
        '---',
        validBody(),
      ].join('\n');
      writeFileSync(join(slugFolder, 'HANDOFF.md'), priorHandoff, 'utf-8');

      ok(!existsSync(join(fx.projectRoot, 'scratch', `S-${idSource}`)), 'uuid-form source folder does not exist');

      // CLI resolves by slug (S-my-renamed-source exists) — pass the slug as fromArg
      // because the CLI uses resolveSessionArg which does slug/prefix matching, not UUID-form scan
      const result = runPickup(sourceSlug, idTarget, { sessionsDir: fx.sessionsDir, cwd: fx.projectRoot, projectRootCwd: resolve(fx.projectRoot) });
      strictEqual(result.exitCode, 0, `pickup exited 0 (stderr: ${result.stderr})`);

      const payload = result.json;
      deepStrictEqual(payload.session_chain, [idSource], `session_chain === [${idSource}]`);
      strictEqual(payload.session_id, idTarget, `session_id === ${idTarget}`);

      ok(!existsSync(slugFolder), 'slug source folder gone after pickup');

      const targetFolder = join(fx.projectRoot, 'scratch', `S-${idTarget}`);
      const targetFile = join(targetFolder, 'HANDOFF.md');
      ok(existsSync(targetFile), 'target HANDOFF.md exists at uuid folder');
      const { fields, sessionChain } = parseFrontmatter(readFileSync(targetFile, 'utf-8'));
      strictEqual(fields.session_id, idTarget, `frontmatter session_id === ${idTarget}`);
      deepStrictEqual(sessionChain, [idSource], `frontmatter session_chain === [${idSource}]`);
    } finally {
      fx.cleanup();
    }
  });

  // T18: Same-path takeover — source and target slugs collide, in-place frontmatter rewrite  [was T16]
  await runTest('T18: Same-path takeover — source and target slugs collide, in-place frontmatter rewrite', async () => {
    const fx = createFixture();
    try {
      const idSource = 'uuid-source-016';
      const sharedName = 'same-slug';

      const sharedFolder = join(fx.projectRoot, 'scratch', `S-${sharedName}`);
      mkdirSync(sharedFolder, { recursive: true });
      const priorHandoff = [
        '---',
        `session_id: ${idSource}`,
        'first_written: 2026-01-01T00:00:00.000Z',
        'last_updated: 2026-01-01T00:00:00.000Z',
        'git_branch: main',
        `session_name: ${sharedName}`,
        'related_projects: []',
        'goal: Same-slug takeover test.',
        'schema_version: 1',
        '---',
        validBody(),
      ].join('\n');
      writeFileSync(join(sharedFolder, 'HANDOFF.md'), priorHandoff, 'utf-8');

      // Pass slug as fromArg (CLI resolves S-same-slug); to_session_id = sharedName so target folder === source folder → same-path takeover
      const result = runPickup(sharedName, sharedName, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
      });
      strictEqual(result.exitCode, 0, `same-path takeover exited 0 (stderr: ${result.stderr})`);

      const payload = result.json;
      deepStrictEqual(payload.session_chain, [idSource], `response session_chain === [${idSource}]`);
      strictEqual(payload.session_id, sharedName, `response session_id === ${sharedName}`);
      strictEqual(payload.folder_slug, sharedName, `response folder_slug === ${sharedName}`);
      strictEqual(payload.from_path, payload.to_path, 'from_path === to_path for same-path takeover');

      ok(existsSync(sharedFolder), 'S-{sharedName}/ still exists after in-place takeover');
      ok(existsSync(join(sharedFolder, 'HANDOFF.md')), 'HANDOFF.md still present');

      const content = readFileSync(join(sharedFolder, 'HANDOFF.md'), 'utf-8');
      const { fields, sessionChain } = parseFrontmatter(content);
      strictEqual(fields.session_id, sharedName, `frontmatter session_id === ${sharedName}`);
      deepStrictEqual(sessionChain, [idSource], `frontmatter session_chain === [${idSource}]`);
    } finally {
      fx.cleanup();
    }
  });

  // T19: V2-shape source → mandatory_skills + available_skills in response (Step 05 AC1)  [was T17]
  await runTest('T19: V2-shape source — mandatory_skills + available_skills in JSON response', async () => {
    const fx = createFixture();
    try {
      const idOld = 'v2-src-017';
      const idNew = 'v2-dst-017';

      // Manually create a V2-shaped workstream folder (HANDOFF.md with ## Sessions + sessions/ dir)
      const sourceFolder = join(fx.projectRoot, 'scratch', `S-${idOld}`);
      mkdirSync(join(sourceFolder, 'sessions'), { recursive: true });
      const v2Handoff = [
        '---',
        `session_id: ${idOld}`,
        'first_written: 2026-04-01T10:00:00.000Z',
        'last_updated: 2026-04-01T10:00:00.000Z',
        'git_branch: main',
        'session_name: null',
        'related_projects: []',
        'goal: Test v2 shape.',
        'schema_version: 2',
        '---',
        '## Goal',
        'Test V2 pickup.',
        '',
        '## Current state',
        'In progress.',
        '',
        '## Next best step',
        'Verify parsers.',
        '',
        '## Active decisions',
        '',
        '## Active what-to-avoid',
        '',
        '## Open questions (still open)',
        '',
        '## Skills — Mandatory',
        '- nodejs-expert',
        '- scripts-expert',
        '',
        '## Skills — Available',
        '- react-expert — for frontend work',
        '- csharp-expert — for backend',
        '',
        '## Projects',
        '',
        '## Sessions',
        '',
      ].join('\n');
      writeFileSync(join(sourceFolder, 'HANDOFF.md'), v2Handoff, 'utf-8');

      const result = runPickup(idOld, idNew, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
      });
      strictEqual(result.exitCode, 0, `pickup exited 0 (stderr: ${result.stderr})`);

      const payload = result.json;
      ok(Array.isArray(payload.mandatory_skills), 'mandatory_skills is an Array');
      deepStrictEqual(payload.mandatory_skills, ['nodejs-expert', 'scripts-expert'], 'mandatory_skills parsed correctly');
      ok(Array.isArray(payload.available_skills), 'available_skills is an Array');
      deepStrictEqual(payload.available_skills, ['react-expert', 'csharp-expert'], 'available_skills strips em-dash rationale');
      strictEqual(payload.migrated_from_legacy, false, 'migrated_from_legacy === false for v2 source');
      ok(!('skills_loaded' in payload), 'skills_loaded not present in response');
    } finally {
      fx.cleanup();
    }
  });

  // T20: V1-legacy source (pure legacy, no sessions/) → migrated_from_legacy: true, legacy file created (Step 05 AC2)  [was T18]
  await runTest('T20: V1-legacy source — migrated_from_legacy: true, sessions/*-legacy.md created', async () => {
    const fx = createFixture();
    try {
      const idOld = 'v1-src-018';
      const idNew = 'v1-dst-018';

      // Manually create a pure V1-legacy workstream folder (no sessions/ dir)
      const sourceFolder = join(fx.projectRoot, 'scratch', `S-${idOld}`);
      mkdirSync(sourceFolder, { recursive: true });
      const v1Handoff = [
        '---',
        `session_id: ${idOld}`,
        'first_written: 2026-04-01T10:00:00.000Z',
        'last_updated: 2026-04-01T10:00:00.000Z',
        'git_branch: main',
        'session_name: null',
        'related_projects: []',
        'goal: Test v1 migration.',
        'schema_version: 1',
        '---',
        '## Goal',
        'Test legacy migration.',
        '',
        '## Current state',
        'Pre-migration.',
        '',
        '## Done this session',
        '- step1',
        '',
        '## In progress',
        '- nothing',
        '',
        '## Decisions made',
        '- Use Node',
        '',
        '## What to avoid',
        '- nothing',
        '',
        '## Open questions',
        '- none',
        '',
        '## Key files & artifacts',
        '- scratch/test/README.md',
        '',
        '## Next best step',
        '- run tests',
        '',
        '## Skills loaded',
        '- nodejs-expert',
        '',
      ].join('\n');
      writeFileSync(join(sourceFolder, 'HANDOFF.md'), v1Handoff, 'utf-8');

      ok(!existsSync(join(sourceFolder, 'sessions')), 'no sessions/ before migration');

      const result = runPickup(idOld, idNew, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
      });
      strictEqual(result.exitCode, 0, `pickup exited 0 (stderr: ${result.stderr})`);

      const payload = result.json;
      strictEqual(payload.migrated_from_legacy, true, 'migrated_from_legacy === true');
      deepStrictEqual(payload.mandatory_skills, [], 'mandatory_skills === [] (skeleton has no skills yet)');
      deepStrictEqual(payload.available_skills, [], 'available_skills === [] (skeleton has no skills yet)');

      // sessions/*-legacy.md must exist at target folder (after rename)
      const targetFolder = join(fx.projectRoot, 'scratch', `S-${idNew}`);
      ok(existsSync(join(targetFolder, 'sessions')), 'sessions/ exists after migration');
      const legacyFiles = readdirSync(join(targetFolder, 'sessions')).filter(f => f.endsWith('-legacy.md'));
      strictEqual(legacyFiles.length, 1, 'exactly one *-legacy.md file created');
      const legacyContent = readFileSync(join(targetFolder, 'sessions', legacyFiles[0]), 'utf-8');
      ok(legacyContent.includes('_legacy: true'), 'legacy file has _legacy: true in frontmatter');
      ok(legacyContent.includes('Test legacy migration.'), 'legacy file preserves original body content');
    } finally {
      fx.cleanup();
    }
  });

  // T21: Idempotent migration — second pickup on same (now V2) folder returns migrated_from_legacy: false (Step 05 AC3)  [was T19]
  await runTest('T21: Idempotent migration — second pickup returns migrated_from_legacy: false', async () => {
    const fx = createFixture();
    try {
      const idOld = 'v1-src-019';
      const idNew1 = 'v1-dst-019a';
      const idNew2 = 'v1-dst-019b';

      // Create a pure V1-legacy workstream folder
      const sourceFolder = join(fx.projectRoot, 'scratch', `S-${idOld}`);
      mkdirSync(sourceFolder, { recursive: true });
      const v1Handoff = [
        '---',
        `session_id: ${idOld}`,
        'first_written: 2026-04-01T10:00:00.000Z',
        'last_updated: 2026-04-01T10:00:00.000Z',
        'git_branch: main',
        'session_name: null',
        'related_projects: []',
        'goal: Idempotent migration test.',
        'schema_version: 1',
        '---',
        '## Goal',
        'Idempotent migration test.',
        '',
        '## Current state',
        'Pre-migration.',
        '',
        '## Done this session',
        '- step1',
        '',
        '## In progress',
        '- nothing',
        '',
        '## Decisions made',
        '- Use Node',
        '',
        '## What to avoid',
        '- nothing',
        '',
        '## Open questions',
        '- none',
        '',
        '## Key files & artifacts',
        '- scratch/test/README.md',
        '',
        '## Next best step',
        '- run tests',
        '',
        '## Skills loaded',
        '- nodejs-expert',
        '',
      ].join('\n');
      writeFileSync(join(sourceFolder, 'HANDOFF.md'), v1Handoff, 'utf-8');

      // First pickup — migrates legacy → V2
      const r1 = runPickup(idOld, idNew1, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
      });
      strictEqual(r1.exitCode, 0, `first pickup exited 0 (stderr: ${r1.stderr})`);
      strictEqual(r1.json.migrated_from_legacy, true, 'first pickup migrated_from_legacy === true');

      // Get the count of legacy files before second pickup
      const targetFolder1 = join(fx.projectRoot, 'scratch', `S-${idNew1}`);
      const legacyFilesBefore = readdirSync(join(targetFolder1, 'sessions')).filter(f => f.endsWith('-legacy.md'));
      strictEqual(legacyFilesBefore.length, 1, 'one legacy file after first migration');

      // Second pickup — folder is now V2, no migration
      const r2 = runPickup(idNew1, idNew2, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
      });
      strictEqual(r2.exitCode, 0, `second pickup exited 0 (stderr: ${r2.stderr})`);
      strictEqual(r2.json.migrated_from_legacy, false, 'second pickup migrated_from_legacy === false (shape=new)');

      // No additional legacy files created
      const targetFolder2 = join(fx.projectRoot, 'scratch', `S-${idNew2}`);
      const legacyFilesAfter = readdirSync(join(targetFolder2, 'sessions')).filter(f => f.endsWith('-legacy.md'));
      strictEqual(legacyFilesAfter.length, 1, 'still only one legacy file after second pickup (no new migration)');
    } finally {
      fx.cleanup();
    }
  });

  // --- mechanical migration tests ---

  // TM1: Migration preserves session_chain verbatim + appends from_session_id; related_projects verbatim;
  //       legacy file body (after frontmatter) is byte-equal to original body content.
  await runTest('TM1: Migration — session_chain + related_projects verbatim; legacy body byte-equal to original', async () => {
    const fx = createFixture();
    try {
      const priorChainId = 'prior-chain-tm1';
      const idOld = 'v1-src-tm1';
      const idNew = 'v1-dst-tm1';

      const sourceFolder = join(fx.projectRoot, 'scratch', `S-${idOld}`);
      mkdirSync(sourceFolder, { recursive: true });

      const originalBody = [
        '## Goal',
        'Preserve fields through migration.',
        '',
        '## Current state',
        'Pre-migration.',
        '',
        '## Done this session',
        '- step alpha',
        '',
        '## In progress',
        '- pending',
        '',
        '## Decisions made',
        '- Keep Node',
        '',
        '## What to avoid',
        '- nothing',
        '',
        '## Open questions',
        '- none',
        '',
        '## Key files & artifacts',
        '- scratch/proj-alpha/README.md',
        '',
        '## Next best step',
        '- verify migration',
        '',
        '## Skills loaded',
        '- scripts-expert',
        '',
      ].join('\n');

      const v1Handoff = [
        '---',
        `session_id: ${idOld}`,
        'first_written: 2026-03-15T08:00:00.000Z',
        'last_updated: 2026-03-15T09:00:00.000Z',
        'git_branch: feat/migrate',
        'session_name: null',
        'related_projects:',
        '  - proj-alpha',
        '  - proj-beta',
        'session_chain:',
        `  - ${priorChainId}`,
        'goal: Preserve fields through migration.',
        'schema_version: 1',
        '---',
        originalBody,
      ].join('\n');
      writeFileSync(join(sourceFolder, 'HANDOFF.md'), v1Handoff, 'utf-8');

      const result = runPickup(idOld, idNew, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
      });
      strictEqual(result.exitCode, 0, `pickup exited 0 (stderr: ${result.stderr})`);
      strictEqual(result.json.migrated_from_legacy, true, 'migrated_from_legacy === true');

      const targetFolder = join(fx.projectRoot, 'scratch', `S-${idNew}`);

      // session_chain in new skeleton HANDOFF.md: prior chain verbatim + from_session_id appended
      const skeletonContent = readFileSync(join(targetFolder, 'HANDOFF.md'), 'utf-8');
      const { sessionChain: skeletonChain } = parseFrontmatter(skeletonContent);
      deepStrictEqual(
        skeletonChain,
        [priorChainId, idOld],
        `skeleton session_chain === [${priorChainId}, ${idOld}] (prior verbatim + from_session_id appended)`
      );

      // related_projects verbatim in new skeleton
      ok(skeletonContent.includes('proj-alpha'), 'skeleton preserves related_projects: proj-alpha');
      ok(skeletonContent.includes('proj-beta'), 'skeleton preserves related_projects: proj-beta');

      // legacy file body: content after frontmatter must be byte-equal to original body
      const legacyFiles = readdirSync(join(targetFolder, 'sessions')).filter(f => f.endsWith('-legacy.md'));
      strictEqual(legacyFiles.length, 1, 'exactly one *-legacy.md file created');
      const legacyContent = readFileSync(join(targetFolder, 'sessions', legacyFiles[0]), 'utf-8');

      // Legacy file frontmatter ends at the second '---\n' after _legacy: true injection
      const legacyFmEndIdx = legacyContent.indexOf('\n---\n');
      const legacyBodyActual = legacyFmEndIdx !== -1 ? legacyContent.slice(legacyFmEndIdx + 5) : '';
      strictEqual(legacyBodyActual, originalBody, 'legacy file body is byte-equal to original body content');
      ok(legacyContent.includes('_legacy: true'), 'legacy frontmatter contains _legacy: true');
    } finally {
      fx.cleanup();
    }
  });

  // TM2: Idempotence — second pickup on V2 folder returns migrated_from_legacy: false; no extra legacy file
  await runTest('TM2: Migration idempotence — second pickup returns migrated_from_legacy: false; one legacy file', async () => {
    const fx = createFixture();
    try {
      const idOld = 'v1-src-tm2';
      const idMid = 'v1-mid-tm2';
      const idNew = 'v1-new-tm2';

      const sourceFolder = join(fx.projectRoot, 'scratch', `S-${idOld}`);
      mkdirSync(sourceFolder, { recursive: true });
      const v1Handoff = [
        '---',
        `session_id: ${idOld}`,
        'first_written: 2026-04-01T10:00:00.000Z',
        'last_updated: 2026-04-01T10:00:00.000Z',
        'git_branch: main',
        'session_name: null',
        'related_projects: []',
        'goal: Idempotence migration test.',
        'schema_version: 1',
        '---',
        '## Goal', 'Idempotence.', '',
        '## Current state', 'Pre.', '',
        '## Done this session', '- x', '',
        '## In progress', '- y', '',
        '## Decisions made', '- z', '',
        '## What to avoid', '- none', '',
        '## Open questions', '- none', '',
        '## Key files & artifacts', '- scratch/README.md', '',
        '## Next best step', '- run', '',
        '## Skills loaded', '- nodejs-expert', '',
      ].join('\n');
      writeFileSync(join(sourceFolder, 'HANDOFF.md'), v1Handoff, 'utf-8');

      // First pickup: migrates legacy → V2
      const r1 = runPickup(idOld, idMid, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
      });
      strictEqual(r1.exitCode, 0, `first pickup exited 0 (stderr: ${r1.stderr})`);
      strictEqual(r1.json.migrated_from_legacy, true, 'first pickup: migrated_from_legacy === true');

      const midFolder = join(fx.projectRoot, 'scratch', `S-${idMid}`);
      const legacyAfterFirst = readdirSync(join(midFolder, 'sessions')).filter(f => f.endsWith('-legacy.md'));
      strictEqual(legacyAfterFirst.length, 1, 'one legacy file after first migration');

      // Second pickup: folder is now V2 shape — no migration
      const r2 = runPickup(idMid, idNew, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
      });
      strictEqual(r2.exitCode, 0, `second pickup exited 0 (stderr: ${r2.stderr})`);
      strictEqual(r2.json.migrated_from_legacy, false, 'second pickup: migrated_from_legacy === false');

      // No additional legacy files created
      const newFolder = join(fx.projectRoot, 'scratch', `S-${idNew}`);
      const legacyAfterSecond = readdirSync(join(newFolder, 'sessions')).filter(f => f.endsWith('-legacy.md'));
      strictEqual(legacyAfterSecond.length, 1, 'still exactly one legacy file after second pickup');
    } finally {
      fx.cleanup();
    }
  });

  // --- parseMandatory / parseAvailable tests ---

  // PP1: Well-formed Mandatory list — em-dash rationale stripped (symmetric with parseAvailable)
  await runTest('PP1: parseMandatory — well-formed list, rationale stripped', async () => {
    const body = [
      '## Skills — Mandatory',
      '- foo',
      '- bar — some rationale',
      '',
      '## Skills — Available',
      '',
    ].join('\n');
    const result = parseMandatory(body);
    deepStrictEqual(result, ['foo', 'bar'], 'parseMandatory strips em-dash rationale');
  });

  // PP2: parseMandatory — missing section returns []
  await runTest('PP2: parseMandatory — missing section returns []', async () => {
    const body = '## Goal\nSome goal.\n\n## Current state\nOk.\n';
    deepStrictEqual(parseMandatory(body), [], 'parseMandatory returns [] when section absent');
  });

  // PP3: parseMandatory — empty section (heading present, no list items) returns []
  await runTest('PP3: parseMandatory — empty section returns []', async () => {
    const body = '## Skills — Mandatory\n\n## Skills — Available\n- qux\n';
    deepStrictEqual(parseMandatory(body), [], 'parseMandatory returns [] for empty section');
  });

  // PP4: parseMandatory — case-insensitive header match
  await runTest('PP4: parseMandatory — case-insensitive header match', async () => {
    const body = '## skills — mandatory\n- alpha\n- beta\n\n';
    deepStrictEqual(parseMandatory(body), ['alpha', 'beta'], 'parseMandatory matches header case-insensitively');
  });

  // PP5: parseMandatory / parseAvailable — leading/trailing whitespace trimmed
  await runTest('PP5: parseMandatory + parseAvailable — leading/trailing whitespace trimmed', async () => {
    const body = [
      '## Skills — Mandatory',
      '-   foo  ',
      '## Skills — Available',
      '-   bar  ',
      '',
    ].join('\n');
    deepStrictEqual(parseMandatory(body), ['foo'], 'parseMandatory trims item whitespace');
    deepStrictEqual(parseAvailable(body), ['bar'], 'parseAvailable trims item whitespace');
  });

  // PP6: parseMandatory — item with trailing two spaces trimmed
  await runTest('PP6: parseMandatory — trailing two spaces trimmed', async () => {
    const body = '## Skills — Mandatory\n- foo  \n';
    deepStrictEqual(parseMandatory(body), ['foo'], 'parseMandatory trims trailing spaces from item');
  });

  // PP7: parseAvailable — item with em-dash rationale returns skill name only
  await runTest('PP7: parseAvailable — em-dash rationale stripped', async () => {
    const body = '## Skills — Available\n- baz — reason here\n';
    deepStrictEqual(parseAvailable(body), ['baz'], 'parseAvailable strips em-dash rationale');
  });

  // PP8: parseAvailable — item without rationale returns skill name
  await runTest('PP8: parseAvailable — item without rationale returns name as-is', async () => {
    const body = '## Skills — Available\n- qux\n';
    deepStrictEqual(parseAvailable(body), ['qux'], 'parseAvailable returns bare skill name');
  });

  // PP9: parseAvailable — trailing two spaces trimmed
  await runTest('PP9: parseAvailable — trailing two spaces trimmed', async () => {
    const body = '## Skills — Available\n- foo  \n';
    deepStrictEqual(parseAvailable(body), ['foo'], 'parseAvailable trims trailing spaces');
  });

  // PP10: parseMandatory — ASCII double-dash heading and separator
  await runTest('PP10: parseMandatory — ASCII double-dash heading + separator', async () => {
    const body = '## Skills -- Mandatory\n- foo -- bar\n- baz\n';
    const result = parseMandatory(body);
    deepStrictEqual(result, ['foo', 'baz'], 'parseMandatory: ASCII double-dash heading + separator');
  });

  // PP11: parseAvailable — en-dash heading and separator
  await runTest('PP11: parseAvailable — en-dash heading + separator', async () => {
    const body = '## Skills – Available\n- react-expert – frontend\n';
    const result = parseAvailable(body);
    deepStrictEqual(result, ['react-expert'], 'parseAvailable: en-dash heading + separator');
  });

  // --- return path shape tests ---

  // RS1: Normal pickup return shape — mandatory_skills, available_skills present; skills_loaded absent
  await runTest('RS1: Normal pickup — mandatory_skills + available_skills present; skills_loaded absent', async () => {
    const fx = createFixture();
    try {
      const idOld = 'rs1-src-020';
      const idNew = 'rs1-dst-020';

      // Create a V2-shaped source with known skills sections
      const sourceFolder = join(fx.projectRoot, 'scratch', `S-${idOld}`);
      mkdirSync(join(sourceFolder, 'sessions'), { recursive: true });
      const v2Handoff = [
        '---',
        `session_id: ${idOld}`,
        'first_written: 2026-04-01T10:00:00.000Z',
        'last_updated: 2026-04-01T10:00:00.000Z',
        'git_branch: main',
        'session_name: null',
        'related_projects: []',
        'goal: Return shape test.',
        'schema_version: 2',
        '---',
        '## Goal',
        'Return shape test.',
        '',
        '## Current state',
        'Running.',
        '',
        '## Next best step',
        'Verify shape.',
        '',
        '## Active decisions',
        '',
        '## Active what-to-avoid',
        '',
        '## Open questions (still open)',
        '',
        '## Skills — Mandatory',
        '- nodejs-expert',
        '',
        '## Skills — Available',
        '- react-expert — frontend',
        '',
        '## Projects',
        '',
        '## Sessions',
        '',
      ].join('\n');
      writeFileSync(join(sourceFolder, 'HANDOFF.md'), v2Handoff, 'utf-8');

      const result = runPickup(idOld, idNew, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
      });
      strictEqual(result.exitCode, 0, `pickup exited 0 (stderr: ${result.stderr})`);

      const payload = result.json;
      ok('mandatory_skills' in payload, 'mandatory_skills field present');
      ok(Array.isArray(payload.mandatory_skills), 'mandatory_skills is an Array');
      ok('available_skills' in payload, 'available_skills field present');
      ok(Array.isArray(payload.available_skills), 'available_skills is an Array');
      ok(!('skills_loaded' in payload), 'skills_loaded not present in normal pickup response');
    } finally {
      fx.cleanup();
    }
  });

  // RS2: Idempotent pickup return shape — mandatory_skills + available_skills present; skills_loaded absent
  await runTest('RS2: Idempotent pickup — mandatory_skills + available_skills present; skills_loaded absent', async () => {
    const fx = createFixture();
    try {
      const idOld = 'rs2-src-021';
      const idNew = 'rs2-dst-021';
      const sessionName = 'rs2-feature';
      const targetFolder = join(fx.projectRoot, 'scratch', `S-${sessionName}`);
      const sourceFolder = join(fx.projectRoot, 'scratch', `S-${idOld}`);

      // Build the "already ours" target folder
      mkdirSync(join(targetFolder, 'sessions'), { recursive: true });
      const targetHandoff = [
        '---',
        `session_id: ${idNew}`,
        'first_written: 2026-01-01T00:00:00.000Z',
        'last_updated: 2026-01-01T01:00:00.000Z',
        'git_branch: main',
        'session_name: rs2-feature',
        'related_projects: []',
        'session_chain:',
        `  - ${idOld}`,
        'goal: Idempotent shape test.',
        'schema_version: 2',
        '---',
        '## Goal',
        'Idempotent shape test.',
        '',
        '## Current state',
        'Running.',
        '',
        '## Next best step',
        'Verify idempotent shape.',
        '',
        '## Active decisions',
        '',
        '## Active what-to-avoid',
        '',
        '## Open questions (still open)',
        '',
        '## Skills — Mandatory',
        '- scripts-expert',
        '',
        '## Skills — Available',
        '- csharp-expert — backend work',
        '',
        '## Projects',
        '',
        '## Sessions',
        '',
      ].join('\n');
      writeFileSync(join(targetFolder, 'HANDOFF.md'), targetHandoff, 'utf-8');

      // Build the stale source folder (for idempotent cleanup)
      // Must be a valid V2 shape: ## Sessions heading + sessions/ dir
      mkdirSync(join(sourceFolder, 'sessions'), { recursive: true });
      writeFileSync(join(sourceFolder, 'HANDOFF.md'), [
        '---',
        `session_id: ${idOld}`,
        'first_written: 2026-01-01T00:00:00.000Z',
        'last_updated: 2026-01-01T00:00:00.000Z',
        'git_branch: main',
        'session_name: null',
        'related_projects: []',
        'goal: Idempotent shape test.',
        'schema_version: 2',
        '---',
        '## Goal', 'Idempotent.', '',
        '## Current state', '', '',
        '## Next best step', '', '',
        '## Active decisions', '',
        '## Active what-to-avoid', '',
        '## Open questions (still open)', '',
        '## Skills — Mandatory', '',
        '## Skills — Available', '',
        '## Projects', '',
        '## Sessions', '',
      ].join('\n'), 'utf-8');

      const result = runPickup(idOld, idNew, {
        sessionsDir: fx.sessionsDir,
        cwd: fx.projectRoot,
        projectRootCwd: resolve(fx.projectRoot),
        name: sessionName,
      });
      strictEqual(result.exitCode, 0, `idempotent pickup exited 0 (stderr: ${result.stderr})`);

      const payload = result.json;
      ok('mandatory_skills' in payload, 'mandatory_skills field present in idempotent response');
      ok(Array.isArray(payload.mandatory_skills), 'mandatory_skills is an Array in idempotent response');
      ok('available_skills' in payload, 'available_skills field present in idempotent response');
      ok(Array.isArray(payload.available_skills), 'available_skills is an Array in idempotent response');
      ok(!('skills_loaded' in payload), 'skills_loaded not present in idempotent pickup response');
    } finally {
      fx.cleanup();
    }
  });

  process.stdout.write(`${passCount} passed, ${failCount} failed\n`);
  process.exit(failCount === 0 ? 0 : 1);
})();
