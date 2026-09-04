#!/usr/bin/env node
// test-tasks.mjs — Tests for the shared workstream-tasks module (tasks.mjs).
// Usage: node test-tasks.mjs   (exit 0 on all-pass)
//
// Step 01b shipped the TM group: unit tests of tasks.mjs's pure exports (the
// two per-corpus lint rule sets, the scan, and the age/render helpers), plus
// a read-only sweep of the live scratch/issues/ corpus's D12 exemption. This
// step (02b) adds the TC group: CLI verb group tests driven through the real
// scratch-memory.mjs dispatcher (D8), not by importing the tasks module's
// exported dispatch function directly, so Step 02a's switch wiring is
// actually exercised. Per D8, this same file later grows two more groups
// without moving anything: Step 05c adds TH (scratch-lint.sh hook tests) and
// TI (install-hooks idempotency tests).

import { deepStrictEqual, strictEqual, ok } from 'node:assert';
import { existsSync, mkdirSync, writeFileSync, readFileSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import process from 'node:process';

import {
  lintTaskFile,
  lintIssueFile,
  scanTasks,
  renderTasksBlock,
  taskAgeDays,
  renderAge,
  formatWarning,
  TASK_STATUS,
  ISSUE_KINDS,
  ISSUE_STATUSES,
  ISSUE_ROLES,
  SPIKE_TYPES,
  ISSUE_SLUG_PATTERN,
  splitSlugList,
  buildEpicGraph,
  frontierSpikes,
  lintEpicGraph,
} from './tasks.mjs';
import { createAnchorFixture } from './test-fixtures.mjs';
import { runCli, CLI_PATH } from './test-driver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('Usage: node test-tasks.mjs\n\nRuns tasks.mjs module unit tests (TM group). Exit 0 on all-pass, 1 otherwise.\n');
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

// ---------------------------------------------------------------------------
// Fixture-body helpers — rule cases operate on in-memory strings via direct
// import of lintTaskFile / lintIssueFile (no fixture needed, per D8's
// in-process-export precedent at test-handoff.mjs:22). Only the scan cases
// below use createAnchorFixture() and real files on disk.
// ---------------------------------------------------------------------------

// Builds a frontmatter-delimited .md file body from an ordered field map. A
// field explicitly set to `undefined` is omitted entirely — this is how the
// "missing required key" fail cases are built without hand-duplicating the
// whole frontmatter block for every rule. Shared by both corpora: the shape
// (--- key: value... --- blank body) is identical for tasks and issues.
function frontmatterFile(fields, bodyLines = []) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${value}`);
  }
  lines.push('---', '', ...bodyLines);
  return lines.join('\n');
}

const GOLDEN_TASK_ID = 't-3f9a2c';
const GOLDEN_TASK_FILENAME = `${GOLDEN_TASK_ID}-onboarding-checklist.md`;
const GOLDEN_TASK_FIELDS = {
  id: GOLDEN_TASK_ID,
  title: 'Draft the onboarding checklist',
  status: 'open',
  created: '2026-08-01T00:00:00.000Z',
  updated: '2026-08-10T00:00:00.000Z',
};

const GOLDEN_ISSUE_SLUG = 'example-issue-title';
const GOLDEN_ISSUE_FILENAME = `${GOLDEN_ISSUE_SLUG}.md`;
const GOLDEN_ISSUE_FIELDS = {
  tool: 'capture-issue',
  kind: 'issue',
  title: 'Example issue title',
  slug: GOLDEN_ISSUE_SLUG,
  status: 'open',
  captured: '2026-08-01T12:00:00.000Z',
  repo: 'claude-code-ref',
  branch: 'main',
  commit: 'abc1234',
  working_tree: 'clean',
};
const GOLDEN_SUMMARY_LINES = ['## Summary', 'Example summary body text for lint rule testing.', ''];

// A fixed reference instant for every age/ordering assertion below — never
// the real current time, so these tests are not clock-dependent.
const FIXED_NOW = new Date(Date.UTC(2026, 5, 15)); // 2026-06-15T00:00:00.000Z

(async () => {

  // ===========================================================================
  // TM — tasks.mjs module unit tests: tasks corpus (T1-T9)
  // ===========================================================================

  await runTest('TM01: T1 passes when frontmatter has an opening and closing --- delimiter', () => {
    const content = frontmatterFile(GOLDEN_TASK_FIELDS);
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    deepStrictEqual(problems, [], `expected a fully valid task file to lint clean (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM02: T1 fails when no frontmatter block is present at all', () => {
    // No leading --- at all. This is the tasks-corpus counterpart to TM20's D12
    // exemption: write_task is the only writer of the tasks corpus and always
    // emits the frontmatter block, so a task file missing one is always drift —
    // there is no exemption here the way there is for the legacy issues corpus.
    const content = 'id: t-000000\ntitle: Not a frontmatter block\nstatus: open\n';
    const problems = lintTaskFile('t-000000-no-frontmatter.md', content);
    deepStrictEqual(problems, ['no frontmatter block'], `T1 failure short-circuits every other tasks rule (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM03: T2 passes when id is present and non-empty', () => {
    const content = frontmatterFile(GOLDEN_TASK_FIELDS);
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(!problems.includes('missing required key: id'), `expected no missing-id finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM04: T2 fails when id is missing', () => {
    const content = frontmatterFile({ ...GOLDEN_TASK_FIELDS, id: undefined });
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(problems.includes('missing required key: id'), `expected missing-id finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM05: T3 passes when title is present and non-empty', () => {
    const content = frontmatterFile(GOLDEN_TASK_FIELDS);
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(!problems.includes('missing required key: title'), `expected no missing-title finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM06: T3 fails when title is missing', () => {
    const content = frontmatterFile({ ...GOLDEN_TASK_FIELDS, title: undefined });
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(problems.includes('missing required key: title'), `expected missing-title finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM07: T4 passes when status is present and non-empty', () => {
    const content = frontmatterFile(GOLDEN_TASK_FIELDS);
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(!problems.includes('missing required key: status'), `expected no missing-status finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM08: T4 fails when status is missing', () => {
    const content = frontmatterFile({ ...GOLDEN_TASK_FIELDS, status: undefined });
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(problems.includes('missing required key: status'), `expected missing-status finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM09: T5 passes when created is present and non-empty', () => {
    const content = frontmatterFile(GOLDEN_TASK_FIELDS);
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(!problems.includes('missing required key: created'), `expected no missing-created finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM10: T5 fails when created is missing', () => {
    const content = frontmatterFile({ ...GOLDEN_TASK_FIELDS, created: undefined });
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(problems.includes('missing required key: created'), `expected missing-created finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM11: T6 passes when updated is present and non-empty', () => {
    const content = frontmatterFile(GOLDEN_TASK_FIELDS);
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(!problems.includes('missing required key: updated'), `expected no missing-updated finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM12: T6 fails when updated is missing', () => {
    const content = frontmatterFile({ ...GOLDEN_TASK_FIELDS, updated: undefined });
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(problems.includes('missing required key: updated'), `expected missing-updated finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM13: T7 passes when status is one of the enum values', () => {
    const content = frontmatterFile(GOLDEN_TASK_FIELDS);
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(!problems.some(p => p.startsWith('invalid status:')), `expected no invalid-status finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM14: T7 rejects a status outside the enum', () => {
    const content = frontmatterFile({ ...GOLDEN_TASK_FIELDS, status: 'archived' });
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(problems.includes(`invalid status: archived (expected one of: ${TASK_STATUS.join(', ')})`), `expected invalid-status finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM15: T8 passes when id matches the filename prefix', () => {
    const content = frontmatterFile(GOLDEN_TASK_FIELDS);
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(!problems.some(p => p.includes('does not match filename prefix')), `expected no filename-prefix finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM16: T8 fails when id does not match the filename prefix', () => {
    const content = frontmatterFile({ ...GOLDEN_TASK_FIELDS, id: 't-abcdef' });
    const problems = lintTaskFile('t-999999-other-name.md', content);
    ok(problems.includes('id t-abcdef does not match filename prefix'), `expected filename-prefix finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM17: T9 passes when title length is within 1-80 characters', () => {
    const content = frontmatterFile(GOLDEN_TASK_FIELDS);
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(!problems.some(p => p.startsWith('title exceeds')), `expected no title-length finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM18: T9 fails when title exceeds 80 characters', () => {
    const content = frontmatterFile({ ...GOLDEN_TASK_FIELDS, title: 'A'.repeat(81) });
    const problems = lintTaskFile(GOLDEN_TASK_FILENAME, content);
    ok(problems.includes('title exceeds 80 characters (81)'), `expected title-length finding (got: ${JSON.stringify(problems)})`);
  });

  // ===========================================================================
  // TM — tasks.mjs module unit tests: issues corpus (I0-I9)
  // ===========================================================================

  await runTest('TM19: I0 passes when the first line is --- so the remaining issues rules evaluate', () => {
    const content = frontmatterFile(GOLDEN_ISSUE_FIELDS, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    deepStrictEqual(problems, [], `expected a fully valid issues file to lint clean (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM20: I0 exempts a no-frontmatter file — D12 short-circuits the whole rule set, even I1 and I9', () => {
    // Pairs with TM02: the tasks corpus gets no such exemption for the same
    // condition (no frontmatter). The asymmetry is deliberate — write_task is
    // the tasks corpus's only writer, but the issues corpus predates the MCP
    // writer, and corpus-state.md documents three such files as a standing,
    // accepted exception rather than fixable drift.
    const content = [
      '# Orphan Note',
      '',
      'This file predates the MCP writer: no frontmatter block, and no ## Summary',
      'heading either. If I0 did not exempt it, both I1 (all 10 keys missing) and',
      'I9 (no ## Summary) would fire.',
      '',
    ].join('\n');
    const problems = lintIssueFile('orphan-note.md', content);
    deepStrictEqual(problems, [], `expected the D12 exemption to return an empty array, not merely a short one (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM21: I1 passes when all 10 required keys are present and non-empty', () => {
    const content = frontmatterFile(GOLDEN_ISSUE_FIELDS, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(!problems.some(p => p.startsWith('missing required key:')), `expected no missing-key findings (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM22: I1 fails with a missing-key finding for each absent required key', () => {
    const content = frontmatterFile({ ...GOLDEN_ISSUE_FIELDS, commit: undefined }, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(problems.includes('missing required key: commit'), `expected missing-key finding for commit (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM23: I2 passes when kind is one of the enum values', () => {
    const content = frontmatterFile(GOLDEN_ISSUE_FIELDS, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(!problems.some(p => p.startsWith('invalid kind:')), `expected no invalid-kind finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM24: I2 rejects a kind outside the enum', () => {
    const content = frontmatterFile({ ...GOLDEN_ISSUE_FIELDS, kind: 'bogus' }, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(problems.includes(`invalid kind: bogus (expected one of: ${ISSUE_KINDS.join(', ')})`), `expected invalid-kind finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM25: I3 passes when status is one of the enum values', () => {
    const content = frontmatterFile(GOLDEN_ISSUE_FIELDS, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(!problems.some(p => p.startsWith('invalid status:')), `expected no invalid-status finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM26: I3 rejects a status outside the enum', () => {
    const content = frontmatterFile({ ...GOLDEN_ISSUE_FIELDS, status: 'archived' }, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(problems.includes(`invalid status: archived (expected one of: ${ISSUE_STATUSES.join(', ')})`), `expected invalid-status finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM27: I4 passes for a full ISO-8601 datetime captured value', () => {
    const content = frontmatterFile(GOLDEN_ISSUE_FIELDS, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(!problems.some(p => p.startsWith('captured is not ISO-8601:')), `expected no captured-format finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM28: I4 rejects a captured value that is not ISO-8601', () => {
    const content = frontmatterFile({ ...GOLDEN_ISSUE_FIELDS, captured: 'not-a-date' }, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(problems.includes('captured is not ISO-8601: not-a-date'), `expected captured-format finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM29: I5 passes when title length is within 1-80 characters', () => {
    const content = frontmatterFile(GOLDEN_ISSUE_FIELDS, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(!problems.some(p => p.startsWith('title exceeds')), `expected no title-length finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM30: I5 fails when title exceeds 80 characters', () => {
    const content = frontmatterFile({ ...GOLDEN_ISSUE_FIELDS, title: 'B'.repeat(81) }, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(problems.includes('title exceeds 80 characters (81)'), `expected title-length finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM31: I6 passes when the filename (sans .md) equals slug', () => {
    const content = frontmatterFile(GOLDEN_ISSUE_FIELDS, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(!problems.some(p => p.includes('does not match filename')), `expected no slug-mismatch finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM32: I6 fails when the filename does not match slug', () => {
    const content = frontmatterFile(GOLDEN_ISSUE_FIELDS, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile('totally-different-name.md', content);
    ok(problems.includes(`slug ${GOLDEN_ISSUE_SLUG} does not match filename`), `expected slug-mismatch finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM33: I7 passes for a resolved issue with a bare ## Resolution heading', () => {
    const bodyLines = [...GOLDEN_SUMMARY_LINES, '## Resolution', 'Fixed by the follow-up patch.', ''];
    const content = frontmatterFile({ ...GOLDEN_ISSUE_FIELDS, status: 'resolved' }, bodyLines);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(!problems.includes('status: resolved with no ## Resolution section'), `expected no missing-resolution finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM34: I7 passes for a resolved issue with a dated ## Resolution (YYYY-MM-DD) heading', () => {
    const bodyLines = [...GOLDEN_SUMMARY_LINES, '## Resolution (2026-08-19)', 'Fixed by the follow-up patch.', ''];
    const content = frontmatterFile({ ...GOLDEN_ISSUE_FIELDS, status: 'resolved' }, bodyLines);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(!problems.includes('status: resolved with no ## Resolution section'), `expected no missing-resolution finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM35: I7 fails for a resolved issue with no ## Resolution heading at all', () => {
    const content = frontmatterFile({ ...GOLDEN_ISSUE_FIELDS, status: 'resolved' }, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(problems.includes('status: resolved with no ## Resolution section'), `expected missing-resolution finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM36: I7 fails for a resolved issue whose only heading is ## Proposed Resolution', () => {
    const bodyLines = [...GOLDEN_SUMMARY_LINES, '## Proposed Resolution', 'A candidate fix.', ''];
    const content = frontmatterFile({ ...GOLDEN_ISSUE_FIELDS, status: 'resolved' }, bodyLines);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(problems.includes('status: resolved with no ## Resolution section'), `## Proposed Resolution must not satisfy the ^## Resolution\\b anchor (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM37: I7 fails for a resolved issue whose only heading is ## Update', () => {
    const bodyLines = [...GOLDEN_SUMMARY_LINES, '## Update', 'Still working on it.', ''];
    const content = frontmatterFile({ ...GOLDEN_ISSUE_FIELDS, status: 'resolved' }, bodyLines);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(problems.includes('status: resolved with no ## Resolution section'), `expected missing-resolution finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM38: I7 fails for a resolved issue whose only heading is ## Partial Progress', () => {
    const bodyLines = [...GOLDEN_SUMMARY_LINES, '## Partial Progress', 'Half of it is done.', ''];
    const content = frontmatterFile({ ...GOLDEN_ISSUE_FIELDS, status: 'resolved' }, bodyLines);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(problems.includes('status: resolved with no ## Resolution section'), `expected missing-resolution finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM39: I8 passes for an open issue with no ## Resolution section', () => {
    const content = frontmatterFile(GOLDEN_ISSUE_FIELDS, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(!problems.includes('status: open with a ## Resolution section (stale status)'), `expected no stale-status finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM40: I8 fails for an open issue that carries a ## Resolution section (stale status)', () => {
    const bodyLines = [...GOLDEN_SUMMARY_LINES, '## Resolution', 'Fixed already, status just never got flipped.', ''];
    const content = frontmatterFile(GOLDEN_ISSUE_FIELDS, bodyLines);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(problems.includes('status: open with a ## Resolution section (stale status)'), `expected stale-status finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM41: I9 passes when a ## Summary heading is present', () => {
    const content = frontmatterFile(GOLDEN_ISSUE_FIELDS, GOLDEN_SUMMARY_LINES);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(!problems.includes('no ## Summary section'), `expected no missing-summary finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM42: I9 fails when no ## Summary heading is present anywhere in the body', () => {
    const content = frontmatterFile(GOLDEN_ISSUE_FIELDS, ['Plain notes with no heading at all.', '']);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(problems.includes('no ## Summary section'), `expected missing-summary finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM43: I9 passes for the anchored variant ## Summary of findings', () => {
    const content = frontmatterFile(GOLDEN_ISSUE_FIELDS, ['## Summary of findings', 'Detail text.', '']);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(!problems.includes('no ## Summary section'), `## Summary of findings must satisfy the ^## Summary\\b anchor (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TM44: I9 fails for ## Executive Summary — it does not satisfy the ^## Summary anchor', () => {
    const content = frontmatterFile(GOLDEN_ISSUE_FIELDS, ['## Executive Summary', 'Detail text.', '']);
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, content);
    ok(problems.includes('no ## Summary section'), `## Executive Summary must not satisfy the ^## Summary\\b anchor (got: ${JSON.stringify(problems)})`);
  });

  // ===========================================================================
  // TM — scan cases: createAnchorFixture() + hand-written files under
  // <projectRoot>/scratch/S-fix*/tasks/
  // ===========================================================================

  await runTest('TM45: scan orders rows blocked-before-open, oldest-updated-first within a group, and ties broken by id ASC', () => {
    const fx = createAnchorFixture();
    try {
      const sessionDir = join(fx.scratchDir, 'S-fix-order');
      const tasksDir = join(sessionDir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });

      writeFileSync(join(tasksDir, 't-000001-blocked-old.md'), frontmatterFile({
        id: 't-000001', title: 'Blocked, older', status: 'blocked',
        created: '2026-05-01T00:00:00.000Z', updated: '2026-06-01T00:00:00.000Z',
      }), 'utf-8');
      writeFileSync(join(tasksDir, 't-000002-blocked-new.md'), frontmatterFile({
        id: 't-000002', title: 'Blocked, newer', status: 'blocked',
        created: '2026-05-01T00:00:00.000Z', updated: '2026-06-10T00:00:00.000Z',
      }), 'utf-8');
      writeFileSync(join(tasksDir, 't-000005-open-tie-high.md'), frontmatterFile({
        id: 't-000005', title: 'Open, tie high id', status: 'open',
        created: '2026-05-01T00:00:00.000Z', updated: '2026-06-05T00:00:00.000Z',
      }), 'utf-8');
      writeFileSync(join(tasksDir, 't-000004-open-tie-low.md'), frontmatterFile({
        id: 't-000004', title: 'Open, tie low id', status: 'open',
        created: '2026-05-01T00:00:00.000Z', updated: '2026-06-05T00:00:00.000Z',
      }), 'utf-8');

      const scan = scanTasks(sessionDir, { now: FIXED_NOW });
      deepStrictEqual(
        scan.rows.map(r => r.id),
        ['t-000001', 't-000002', 't-000004', 't-000005'],
        `blocked before open, oldest (largest age_days) first within each group, id ASC tiebreak (got: ${JSON.stringify(scan.rows.map(r => r.id))})`
      );
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TM46: taskAgeDays and renderAge compute UTC calendar-day age against an explicit now, including future-date clamping and unparseable input', () => {
    strictEqual(taskAgeDays('2026-06-15T00:00:00.000Z', FIXED_NOW), 0, 'same UTC date -> 0');
    strictEqual(renderAge(0), 'updated today');

    strictEqual(taskAgeDays('2026-06-14T00:00:00.000Z', FIXED_NOW), 1, 'one UTC day earlier -> 1');
    strictEqual(renderAge(1), 'updated 1d ago');

    strictEqual(taskAgeDays('2026-06-03T00:00:00.000Z', FIXED_NOW), 12, 'twelve UTC days earlier -> 12');
    strictEqual(renderAge(12), 'updated 12d ago');

    strictEqual(taskAgeDays('2026-06-20T00:00:00.000Z', FIXED_NOW), 0, 'future date clamps to 0, not negative');
    strictEqual(renderAge(0), 'updated today');

    strictEqual(taskAgeDays('not-a-date', FIXED_NOW), null, 'unparseable updated -> null');
    strictEqual(renderAge(null), 'updated unknown');
  });

  await runTest('TM47: scan closed counts and renderTasksBlock summarize done/dropped/promoted without listing them as rows', () => {
    const fx = createAnchorFixture();
    try {
      const sessionDir = join(fx.scratchDir, 'S-fix-closed');
      const tasksDir = join(sessionDir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });

      const closedTasks = [
        { id: 't-100001', status: 'done' },
        { id: 't-100002', status: 'done' },
        { id: 't-100003', status: 'dropped' },
        { id: 't-100004', status: 'promoted' },
      ];
      for (const t of closedTasks) {
        writeFileSync(join(tasksDir, `${t.id}-closed.md`), frontmatterFile({
          id: t.id, title: 'A closed task', status: t.status,
          created: '2026-05-01T00:00:00.000Z', updated: '2026-06-01T00:00:00.000Z',
        }), 'utf-8');
      }

      const scan = scanTasks(sessionDir, { now: FIXED_NOW });
      deepStrictEqual(scan.closed, { done: 2, dropped: 1, promoted: 1 }, `closed counts (got: ${JSON.stringify(scan.closed)})`);
      deepStrictEqual(scan.rows, [], 'no closed task appears as a row');

      const block = renderTasksBlock(scan);
      ok(block.includes('2 done, 1 dropped, 1 promoted — see tasks/'), `block includes the closed-count summary line (got: ${JSON.stringify(block)})`);
      for (const t of closedTasks) {
        ok(!block.includes(`[${t.id}]`), `closed task ${t.id} does not render as a row (got: ${JSON.stringify(block)})`);
      }
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TM48: a malformed task file contributes a WARN: line to scan.warnings and is excluded from rows', () => {
    const fx = createAnchorFixture();
    try {
      const sessionDir = join(fx.scratchDir, 'S-fix-warn');
      const tasksDir = join(sessionDir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });

      // Malformed: missing the required `status` key.
      writeFileSync(join(tasksDir, 't-bad012-broken.md'), frontmatterFile({
        id: 't-bad012', title: 'Broken task',
        created: '2026-06-01T00:00:00.000Z', updated: '2026-06-01T00:00:00.000Z',
      }), 'utf-8');
      writeFileSync(join(tasksDir, 't-c0ffee-fine.md'), frontmatterFile({
        id: 't-c0ffee', title: 'A fine task', status: 'open',
        created: '2026-06-01T00:00:00.000Z', updated: '2026-06-01T00:00:00.000Z',
      }), 'utf-8');

      const scan = scanTasks(sessionDir, { now: FIXED_NOW });
      ok(
        scan.warnings.includes(formatWarning('t-bad012-broken.md', 'missing required key: status')),
        `expected a WARN: line for the malformed file (got: ${JSON.stringify(scan.warnings)})`
      );
      ok(!scan.rows.some(r => r.id === 't-bad012'), 'malformed file (invalid status) is excluded from rows');
      ok(scan.rows.some(r => r.id === 't-c0ffee'), 'the well-formed sibling file still appears in rows');
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TM49: scan of a missing tasks/ directory returns the empty shape and renders the - none block', () => {
    const fx = createAnchorFixture();
    try {
      const sessionDir = join(fx.scratchDir, 'S-fix-missing-dir');
      // tasksDir intentionally never created.
      const scan = scanTasks(sessionDir, { now: FIXED_NOW });
      deepStrictEqual(scan, { tasks: [], rows: [], closed: { done: 0, dropped: 0, promoted: 0 }, warnings: [] });
      const block = renderTasksBlock(scan);
      ok(block.includes('- none'), `block renders the empty-state marker (got: ${JSON.stringify(block)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TM50: scan of an existing but empty tasks/ directory returns the empty shape and renders the - none block', () => {
    const fx = createAnchorFixture();
    try {
      const sessionDir = join(fx.scratchDir, 'S-fix-empty-dir');
      mkdirSync(join(sessionDir, 'tasks'), { recursive: true });
      const scan = scanTasks(sessionDir, { now: FIXED_NOW });
      deepStrictEqual(scan, { tasks: [], rows: [], closed: { done: 0, dropped: 0, promoted: 0 }, warnings: [] });
      const block = renderTasksBlock(scan);
      ok(block.includes('- none'), `block renders the empty-state marker (got: ${JSON.stringify(block)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TM51: scan record file field is exactly tasks/<basename> with forward slashes', () => {
    const fx = createAnchorFixture();
    try {
      const sessionDir = join(fx.scratchDir, 'S-fix-file-field');
      const tasksDir = join(sessionDir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, GOLDEN_TASK_FILENAME), frontmatterFile(GOLDEN_TASK_FIELDS), 'utf-8');

      const scan = scanTasks(sessionDir, { now: FIXED_NOW });
      strictEqual(scan.tasks.length, 1, 'exactly one task parsed');
      strictEqual(scan.tasks[0].file, `tasks/${GOLDEN_TASK_FILENAME}`, `file field is posix-separated (got: ${scan.tasks[0].file})`);
      ok(!scan.tasks[0].file.includes('\\'), 'file field contains no backslash');
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TM52: scanner filter ignores non-t- files and dot-prefixed tmp lookalikes', () => {
    const fx = createAnchorFixture();
    try {
      const sessionDir = join(fx.scratchDir, 'S-fix-filter');
      const tasksDir = join(sessionDir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, GOLDEN_TASK_FILENAME), frontmatterFile(GOLDEN_TASK_FIELDS), 'utf-8');
      writeFileSync(join(tasksDir, 'notes.md'), '# not a task file\n', 'utf-8');
      // The dot-prefixed shape write_task's tmp write renames from — fails the
      // t-*.md filter twice over (wrong leading character, wrong suffix).
      writeFileSync(join(tasksDir, '.t-deadbe-orphan.md.tmp'), frontmatterFile(GOLDEN_TASK_FIELDS), 'utf-8');

      const scan = scanTasks(sessionDir, { now: FIXED_NOW });
      strictEqual(scan.tasks.length, 1, `only the t-*.md file is scanned (got: ${JSON.stringify(scan.tasks.map(t => t.file))})`);
      ok(!scan.tasks.some(t => t.file.includes('notes.md')), 'notes.md is not scanned');
      ok(!scan.tasks.some(t => t.file.includes('orphan')), 'the dot-prefixed tmp lookalike is not scanned');
      strictEqual(scan.warnings.length, 0, `no warnings from the ignored files (got: ${JSON.stringify(scan.warnings)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TM53: mid-scan ENOENT — a listed entry that never existed on disk is skipped, not a scan-wide failure', () => {
    const fx = createAnchorFixture();
    try {
      const sessionDir = join(fx.scratchDir, 'S-fix-enoent');
      const tasksDir = join(sessionDir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, GOLDEN_TASK_FILENAME), frontmatterFile(GOLDEN_TASK_FIELDS), 'utf-8');

      // 't-ffffff-vanished.md' is deliberately never written — the injected
      // listing simulates a file that disappeared between the directory
      // listing and the read, deterministically and without a real race.
      const scan = scanTasks(sessionDir, {
        now: FIXED_NOW,
        entries: [GOLDEN_TASK_FILENAME, 't-ffffff-vanished.md'],
      });
      strictEqual(scan.tasks.length, 1, 'only the real file is present in the scan result');
      ok(!scan.warnings.some(w => w.includes('vanished')), `no warning is added for the phantom entry (got: ${JSON.stringify(scan.warnings)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TM54: a non-ENOENT read failure (EISDIR) re-throws with err.code === FS_READ rather than being swallowed', () => {
    const fx = createAnchorFixture();
    try {
      const sessionDir = join(fx.scratchDir, 'S-fix-eisdir');
      const tasksDir = join(sessionDir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      // A directory named like a task file: readFileSync on it throws EISDIR,
      // never ENOENT — this must re-throw, not be swallowed as a vanished file.
      mkdirSync(join(tasksDir, 't-aaaaaa-dir.md'), { recursive: true });

      let thrown = null;
      try {
        scanTasks(sessionDir, { now: FIXED_NOW });
      } catch (err) {
        thrown = err;
      }
      ok(thrown, 'scanTasks throws instead of swallowing the EISDIR failure');
      strictEqual(thrown.code, 'FS_READ', `re-thrown error carries err.code === 'FS_READ' (got: ${thrown && thrown.code})`);
    } finally {
      fx.cleanup();
    }
  });

  // ===========================================================================
  // TM — live scratch/issues/ corpus sweep, D12 exemption (read-only). This
  // repo-relative directory is absent from the marketplace-published copy of
  // these scripts, so the test is skipped (not failed) in that environment,
  // mirroring test-handoff.mjs's PAR-block existsSync skip-gate idiom.
  // ===========================================================================

  const repoRoot = join(__dirname, '..', '..', '..', '..');
  const issuesDir = join(repoRoot, 'scratch', 'issues');

  if (!existsSync(issuesDir)) {
    process.stdout.write('SKIP: TM55 — scratch/issues/ not found (marketplace-published scripts copy)\n');
  } else {
    await runTest('TM55: live scratch/issues/ corpus — the three known no-frontmatter files return [] under the committed harness (D12)', () => {
      const NO_FRONTMATTER_FILES = ['knowledge-graduation-gap.md', 'teams-shutdown-ack-orphans.md', 'test-write-session-followup.md'];
      for (const name of NO_FRONTMATTER_FILES) {
        const filePath = join(issuesDir, name);
        ok(existsSync(filePath), `expected exception file to exist: ${name}`);
        const content = readFileSync(filePath, 'utf-8');
        const problems = lintIssueFile(filePath, content);
        deepStrictEqual(problems, [], `D12 exemption holds for ${name} against real corpus data (got: ${JSON.stringify(problems)})`);
      }
    });
  }

  // ===========================================================================
  // TC — tasks CLI verb group tests (Step 02a's surface). Every case below
  // drives the real scratch-memory.mjs entry point via runCli() or a raw
  // spawnSync of the same path (D8/D16 -- this is what makes a missing
  // `case 'tasks':` in that switch fail these tests instead of passing them
  // silently). A handful of cases (TC3/TC4, TC11, TC16) spawn the CLI
  // directly with spawnSync rather than runCli(): runCli()
  // (test-driver.mjs:46) hardcodes stderr: '' on exit 0, so it cannot prove
  // stderr is genuinely empty on a success path -- only a raw spawnSync
  // capture, stdio: ['ignore','pipe','pipe'], can.
  // ===========================================================================

  await runTest('TC1: no subcommand -> exit 1, stderr contains "missing subcommand", stdout empty', () => {
    const fx = createAnchorFixture();
    try {
      const res = runCli(['tasks'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, `expected exit 1 (got: ${res.exitCode})`);
      ok(res.stderr.includes('missing subcommand'), `stderr names the missing-subcommand condition (got: ${JSON.stringify(res.stderr)})`);
      strictEqual(res.stdout, '', `stdout is empty (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC2: unknown subcommand "tasks bogus" -> exit 1, stderr names the token', () => {
    const fx = createAnchorFixture();
    try {
      const res = runCli(['tasks', 'bogus'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, `expected exit 1 (got: ${res.exitCode})`);
      ok(res.stderr.includes('bogus'), `stderr names the unknown subcommand token (got: ${JSON.stringify(res.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC3: tasks --help -> exit 0, stdout contains the usage banner, stderr genuinely empty', () => {
    const fx = createAnchorFixture();
    try {
      const result = spawnSync('node', [CLI_PATH, 'tasks', '--help'], {
        encoding: 'utf-8',
        cwd: fx.projectRoot,
        stdio: ['ignore','pipe','pipe'],
      });
      strictEqual(result.status, 0, `expected exit 0 (got: ${result.status})`);
      ok(result.stdout.includes('Usage: scratch-memory tasks'), `stdout contains the usage banner (got: ${JSON.stringify(result.stdout)})`);
      strictEqual(result.stderr, '', `stderr is genuinely empty, not merely unchecked (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC4: tasks -h -> exit 0, stdout contains the usage banner, stderr genuinely empty', () => {
    const fx = createAnchorFixture();
    try {
      const result = spawnSync('node', [CLI_PATH, 'tasks', '-h'], {
        encoding: 'utf-8',
        cwd: fx.projectRoot,
        stdio: ['ignore','pipe','pipe'],
      });
      strictEqual(result.status, 0, `expected exit 0 (got: ${result.status})`);
      ok(result.stdout.includes('Usage: scratch-memory tasks'), `stdout contains the usage banner (got: ${JSON.stringify(result.stdout)})`);
      strictEqual(result.stderr, '', `stderr is genuinely empty, not merely unchecked (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC5: tasks list with no positional -> exit 1, stderr contains "missing <session-dir>"', () => {
    const fx = createAnchorFixture();
    try {
      const res = runCli(['tasks', 'list'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, `expected exit 1 (got: ${res.exitCode})`);
      ok(res.stderr.includes('missing <session-dir>'), `stderr names the missing positional (got: ${JSON.stringify(res.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC6: tasks lint with no positional -> exit 1', () => {
    const fx = createAnchorFixture();
    try {
      const res = runCli(['tasks', 'lint'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, `expected exit 1 (got: ${res.exitCode})`);
      ok(res.stderr.includes('missing <path>'), `stderr names the missing positional (got: ${JSON.stringify(res.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC7: tasks lint on a path outside the sandbox -> exit 1, stderr names the sandbox constraint, stdout empty', () => {
    const fx = createAnchorFixture();
    try {
      const res = runCli(['tasks', 'lint', '/tmp/nowhere.md'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, `expected exit 1 (got: ${res.exitCode})`);
      ok(res.stderr.includes('OUT_OF_SANDBOX_PATH'), `stderr names the sandbox constraint (got: ${JSON.stringify(res.stderr)})`);
      strictEqual(res.stdout, '', `stdout is empty (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC8: tasks lint on a path with no /tasks/ or /issues/ segment -> exit 1, stderr contains "cannot detect schema"', () => {
    const fx = createAnchorFixture();
    try {
      const path = join(fx.scratchDir, 'notes', 'x.md');
      const res = runCli(['tasks', 'lint', path], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, `expected exit 1 (got: ${res.exitCode})`);
      ok(res.stderr.includes('cannot detect schema'), `stderr names the schema-detection failure (got: ${JSON.stringify(res.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC9: tasks lint on a clean tasks/ directory -> exit 0, empty stdout', () => {
    const fx = createAnchorFixture();
    try {
      const tasksDir = join(fx.scratchDir, 'S-fix-clean', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, GOLDEN_TASK_FILENAME), frontmatterFile(GOLDEN_TASK_FIELDS), 'utf-8');

      const res = runCli(['tasks', 'lint', tasksDir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode})`);
      strictEqual(res.stdout, '', `stdout is empty on a clean lint (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC10: tasks lint on a directory with one malformed file -> exit 1 with exactly one WARN: line', () => {
    const fx = createAnchorFixture();
    try {
      const tasksDir = join(fx.scratchDir, 'S-fix-warn', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, GOLDEN_TASK_FILENAME), frontmatterFile({ ...GOLDEN_TASK_FIELDS, title: undefined }), 'utf-8');

      const res = runCli(['tasks', 'lint', tasksDir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, `expected exit 1 (got: ${res.exitCode})`);
      const lines = res.stdout.split('\n').filter(Boolean);
      strictEqual(lines.length, 1, `exactly one WARN: line (got: ${JSON.stringify(lines)})`);
      strictEqual(lines[0], formatWarning(GOLDEN_TASK_FILENAME, 'missing required key: title'), `WARN line matches formatWarning's shape (got: ${JSON.stringify(lines[0])})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC11: D16 -- a missing DIRECTORY target is success, not failure, paired with tasks list agreeing the condition is benign', () => {
    const fx = createAnchorFixture();
    try {
      // tasks/ is intentionally never created under S-notasks -- the common
      // "workstream has no tasks yet" case (decisions.md D16).
      const sessionDir = join(fx.scratchDir, 'S-notasks');
      mkdirSync(sessionDir, { recursive: true });
      const missingTasksDir = join(sessionDir, 'tasks') + '/';

      // spawnSync (not runCli()) is required here: this is one of the exit-0
      // cases that must prove stderr is genuinely empty, and runCli()
      // (test-driver.mjs:46) hardcodes stderr: '' on every exit-0 return,
      // which would make the assertion below vacuous.
      const lintResult = spawnSync('node', [CLI_PATH, 'tasks', 'lint', missingTasksDir], {
        encoding: 'utf-8',
        cwd: fx.projectRoot,
        stdio: ['ignore','pipe','pipe'],
      });
      strictEqual(lintResult.status, 0, `missing-directory lint target is exit 0, not ENOENT (got: ${lintResult.status})`);
      strictEqual(lintResult.stdout, '', `no findings on a missing directory (got: ${JSON.stringify(lintResult.stdout)})`);
      strictEqual(lintResult.stderr, '', `no stderr output either (got: ${JSON.stringify(lintResult.stderr)})`);

      // Sibling-consistency half: tasks list on the same workstream agrees
      // the missing tasks/ is benign, not merely that lint tolerates it.
      const listResult = spawnSync('node', [CLI_PATH, 'tasks', 'list', sessionDir], {
        encoding: 'utf-8',
        cwd: fx.projectRoot,
        stdio: ['ignore','pipe','pipe'],
      });
      strictEqual(listResult.status, 0, `list on the same workstream is also exit 0 (got: ${listResult.status})`);
      ok(listResult.stdout.includes('- none'), `list renders the empty-state marker (got: ${JSON.stringify(listResult.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC12: a missing FILE target stays a loud error -- exit 1, stderr contains "no such file or directory", stdout empty', () => {
    const fx = createAnchorFixture();
    try {
      const tasksDir = join(fx.scratchDir, 'S-fix', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      const missingFile = join(tasksDir, 't-abcdef-nope.md');

      const res = runCli(['tasks', 'lint', missingFile], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, `expected exit 1 (got: ${res.exitCode})`);
      ok(res.stderr.includes('no such file or directory'), `stderr names the missing-file condition (got: ${JSON.stringify(res.stderr)})`);
      strictEqual(res.stdout, '', `stdout is empty (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC13: scanner filter through the CLI -- notes.md and the dot-prefixed tmp lookalike emit nothing', () => {
    const fx = createAnchorFixture();
    try {
      const tasksDir = join(fx.scratchDir, 'S-fix-filter', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, GOLDEN_TASK_FILENAME), frontmatterFile(GOLDEN_TASK_FIELDS), 'utf-8');
      writeFileSync(join(tasksDir, 'notes.md'), '# not a task file\n', 'utf-8');
      writeFileSync(join(tasksDir, '.t-deadbe-orphan.md.tmp'), frontmatterFile(GOLDEN_TASK_FIELDS), 'utf-8');

      const res = runCli(['tasks', 'lint', tasksDir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 -- the only scanned file is clean (got: ${res.exitCode})`);
      strictEqual(res.stdout, '', `notes.md and the dot-prefixed tmp lookalike produce zero output (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC14: piping-safe output -- ~40 malformed files produce every expected WARN: line with none truncated, exit still 1', () => {
    const fx = createAnchorFixture();
    try {
      const tasksDir = join(fx.scratchDir, 'S-fix-pipe', 'tasks');
      mkdirSync(tasksDir, { recursive: true });

      const FILE_COUNT = 40;
      const filenames = [];
      for (let i = 0; i < FILE_COUNT; i++) {
        const id = `t-${i.toString(16).padStart(6, '0')}`;
        const filename = `${id}-bad.md`;
        filenames.push(filename);
        writeFileSync(join(tasksDir, filename), frontmatterFile({
          id, status: 'open', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z',
        }), 'utf-8'); // title omitted -> T3 fires
      }

      const res = runCli(['tasks', 'lint', tasksDir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, `expected exit 1 (got: ${res.exitCode})`);
      const lines = res.stdout.split('\n').filter(Boolean);
      strictEqual(lines.length, FILE_COUNT, `every one of the ${FILE_COUNT} findings reaches stdout, none truncated (got: ${lines.length})`);
      for (const filename of filenames) {
        ok(lines.includes(formatWarning(filename, 'missing required key: title')), `missing WARN line for ${filename}`);
      }
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC15: schema auto-detection -- identical content under /tasks/ vs /issues/ produces different findings', () => {
    const fx = createAnchorFixture();
    try {
      const sameContent = frontmatterFile({
        id: 't-abc123', title: 'Same content, two schemas', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z',
      }); // status omitted -- malformed under both schemas, for different reasons

      const tasksDir = join(fx.scratchDir, 'S-fix-schema', 'tasks');
      const issuesDir = join(fx.scratchDir, 'S-fix-schema', 'issues');
      mkdirSync(tasksDir, { recursive: true });
      mkdirSync(issuesDir, { recursive: true });
      writeFileSync(join(tasksDir, 'same-content.md'), sameContent, 'utf-8');
      writeFileSync(join(issuesDir, 'same-content.md'), sameContent, 'utf-8');

      const tasksRes = runCli(['tasks', 'lint', join(tasksDir, 'same-content.md')], { cwd: fx.projectRoot });
      const issuesRes = runCli(['tasks', 'lint', join(issuesDir, 'same-content.md')], { cwd: fx.projectRoot });

      ok(tasksRes.stdout.length > 0, `tasks-schema lint produces findings (got: ${JSON.stringify(tasksRes.stdout)})`);
      ok(issuesRes.stdout.length > 0, `issues-schema lint produces findings (got: ${JSON.stringify(issuesRes.stdout)})`);
      ok(tasksRes.stdout !== issuesRes.stdout, `path drives the schema, not a default -- findings must differ (tasks: ${JSON.stringify(tasksRes.stdout)}, issues: ${JSON.stringify(issuesRes.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC16: D12 through the CLI -- a no-frontmatter issues file is exit 0, stdout empty, stderr empty', () => {
    const fx = createAnchorFixture();
    try {
      const issuesDir = join(fx.scratchDir, 'S-fix-d12', 'issues');
      mkdirSync(issuesDir, { recursive: true });
      const orphanPath = join(issuesDir, 'orphan-note.md');
      writeFileSync(orphanPath, '# Orphan Note\n\nThis file predates the MCP writer -- no frontmatter block.\n', 'utf-8');

      // spawnSync, per the runCli() gotcha noted at TC3/TC11 -- this exit-0
      // case must prove stderr is genuinely empty.
      const result = spawnSync('node', [CLI_PATH, 'tasks', 'lint', orphanPath], {
        encoding: 'utf-8',
        cwd: fx.projectRoot,
        stdio: ['ignore','pipe','pipe'],
      });
      strictEqual(result.status, 0, `expected exit 0 -- D12 exemption (got: ${result.status})`);
      strictEqual(result.stdout, '', `no findings for a D12-exempt file (got: ${JSON.stringify(result.stdout)})`);
      strictEqual(result.stderr, '', `no stderr output either (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC17: tasks list renders stdout byte-equal to renderTasksBlock(scanTasks(dir)) called in-process', () => {
    const fx = createAnchorFixture();
    try {
      const sessionDir = join(fx.scratchDir, 'S-fix-render');
      const tasksDir = join(sessionDir, 'tasks');
      mkdirSync(tasksDir, { recursive: true });

      const rows = [
        { id: 't-000001', title: 'First open', status: 'open' },
        { id: 't-000002', title: 'Second open', status: 'open' },
        { id: 't-000003', title: 'Blocked one', status: 'blocked', blocked_on: 'upstream API' },
      ];
      const closed = [
        { id: 't-000004', title: 'Done one', status: 'done' },
        { id: 't-000005', title: 'Dropped one', status: 'dropped' },
      ];
      for (const t of [...rows, ...closed]) {
        writeFileSync(join(tasksDir, `${t.id}-task.md`), frontmatterFile({
          id: t.id, title: t.title, status: t.status,
          ...(t.blocked_on ? { blocked_on: t.blocked_on } : {}),
          created: '2026-01-01T00:00:00.000Z', updated: '2026-01-05T00:00:00.000Z',
        }), 'utf-8');
      }

      const res = runCli(['tasks', 'list', sessionDir], { cwd: fx.projectRoot });
      const expected = renderTasksBlock(scanTasks(sessionDir));
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode})`);
      strictEqual(res.stdout, expected, `CLI stdout is byte-equal to the in-process renderer (got: ${JSON.stringify(res.stdout)}, expected: ${JSON.stringify(expected)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC18: tasks list on a workstream with no tasks/ directory -> exit 0, "## Tasks" and "- none"', () => {
    const fx = createAnchorFixture();
    try {
      const sessionDir = join(fx.scratchDir, 'S-fix-list-empty');
      mkdirSync(sessionDir, { recursive: true });

      const res = runCli(['tasks', 'list', sessionDir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode})`);
      ok(res.stdout.includes('## Tasks'), `stdout includes the block heading (got: ${JSON.stringify(res.stdout)})`);
      ok(res.stdout.includes('- none'), `stdout includes the empty-state marker (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TC19: direct-invocation guard -- running tasks.mjs directly matches the same command through scratch-memory.mjs', () => {
    const tasksMjsPath = join(__dirname, 'tasks.mjs');
    const scriptsDir = __dirname;
    // A deterministic out-of-sandbox path -- both invocations reject it
    // identically, which is proof enough that the entry-point guard forwards
    // argv into the same code path scratch-memory.mjs's switch reaches.
    // Without the guard, the direct invocation would silently exit 0 while
    // the indirect one exits 1, and this test would catch that divergence.
    const targetArg = '/tmp/nonexistent-tc19-direct-guard.md';

    const direct = spawnSync('node', [tasksMjsPath, 'lint', targetArg], {
      encoding: 'utf-8',
      cwd: scriptsDir,
      stdio: ['ignore','pipe','pipe'],
    });
    const indirect = runCli(['tasks', 'lint', targetArg], { cwd: scriptsDir });

    strictEqual(direct.status, indirect.exitCode, `exit codes match (direct: ${direct.status}, indirect: ${indirect.exitCode})`);
    strictEqual(direct.stdout, indirect.stdout, `stdout matches (direct: ${JSON.stringify(direct.stdout)}, indirect: ${JSON.stringify(indirect.stdout)})`);
  });

  await runTest('TC20: the dispatcher help lists the tasks verb and a "Tasks subcommands:" block', () => {
    const fx = createAnchorFixture();
    try {
      const res = runCli(['--help'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode})`);
      ok(/^  tasks\s/m.test(res.stdout), `Verb groups table lists tasks (got: ${JSON.stringify(res.stdout)})`);
      ok(res.stdout.includes('Tasks subcommands:'), `a Tasks subcommands: block is present (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  // ---------------------------------------------------------------------------
  // end TC group -- boundary marker for the Step 02b acceptance check
  // (sed -n '/TC1/,/^\/\/ ---/p' bounds the dispatcher-usage grep to exactly
  // this block).
  // ---------------------------------------------------------------------------

  // ===========================================================================
  // TH -- scratch-lint.sh hook behaviour tests (Step 05a's decision-table,
  // traversed one row/branch per case). Every case spawns the real script as
  // a subprocess with crafted stdin JSON -- spawnSync('bash', [HOOK_PATH], {
  // input: JSON.stringify(event), ... }) -- never simulated in-process, per
  // Step 05c's Actions. The two PATH-scrubbed infra cases (TH15/TH16) build a
  // synthetic PATH directory with symlinks to the real binaries, omitting
  // exactly one, rather than mutating the real PATH.
  // ===========================================================================

  const HOOK_PATH = join(__dirname, 'hooks', 'scratch-lint.sh');

  function invokeHook(event, opts = {}) {
    return spawnSync('bash', [HOOK_PATH, ...(opts.args ?? [])], {
      input: JSON.stringify(event ?? {}),
      encoding: 'utf-8',
      cwd: opts.cwd,
      env: opts.env,
    });
  }

  function isoDateDaysAgo(daysAgo) {
    return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
  }
  const TODAY = isoDateDaysAgo(0);
  const YESTERDAY = isoDateDaysAgo(1);

  // Resolve a tool's absolute path via a plain (non-interactive, non-login)
  // bash subshell -- this reflects real PATH-based resolution, not any
  // interactive-shell alias or function that might shadow the name in this
  // harness's own environment.
  function resolveToolPath(name) {
    const res = spawnSync('bash', ['-c', `command -v ${name}`], { encoding: 'utf-8' });
    const p = res.stdout.trim();
    if (!p) throw new Error(`could not resolve required tool for PATH-scrub fixture: ${name}`);
    return p;
  }

  // Every external tool the hook (or the bash process running it) can touch,
  // end to end through a clean successful run. Building a synthetic PATH
  // directory with symlinks to all of these minus one omitted name is what
  // lets TH15/TH16 simulate a missing dependency deterministically, without
  // mutating the real PATH.
  const HOOK_ENV_TOOLS = ['bash', 'cat', 'jq', 'grep', 'mktemp', 'date', 'basename', 'sed', 'rm', 'scratch-memory'];

  function makeScrubbedPathEnv(omit) {
    const dir = mkdtempSync(join(tmpdir(), 'smcp-pathscrub-'));
    for (const tool of HOOK_ENV_TOOLS) {
      if (omit.includes(tool)) continue;
      symlinkSync(resolveToolPath(tool), join(dir, tool));
    }
    return dir;
  }

  await runTest('TH1: scratch-lint.sh --help -> exit 0, stdout names Usage: scratch-lint.sh', () => {
    const result = invokeHook({}, { args: ['--help'] });
    strictEqual(result.status, 0, `expected exit 0 (got: ${result.status})`);
    ok(result.stdout.includes('Usage: scratch-lint.sh'), `stdout names the usage banner (got: ${JSON.stringify(result.stdout)})`);
  });

  await runTest('TH2: scratch-lint.sh --bogus -> exit 1, stderr contains "unknown option"', () => {
    const result = invokeHook({}, { args: ['--bogus'] });
    strictEqual(result.status, 1, `expected exit 1 (got: ${result.status})`);
    ok(result.stderr.includes('unknown option'), `stderr names the unknown-option condition (got: ${JSON.stringify(result.stderr)})`);
  });

  await runTest('TH3: non-matching tool (Read) on a real malformed task file -> exit 0, no output -- the tool gate runs before the path gate', () => {
    const fx = createAnchorFixture();
    try {
      const tasksDir = join(fx.scratchDir, 'S-fix-th3', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      const filePath = join(tasksDir, GOLDEN_TASK_FILENAME);
      writeFileSync(filePath, frontmatterFile({ ...GOLDEN_TASK_FIELDS, status: undefined, updated: `${TODAY}T00:00:00.000Z` }), 'utf-8');

      const result = invokeHook({ tool_name: 'Read', tool_input: { file_path: filePath } }, { cwd: fx.projectRoot });
      strictEqual(result.status, 0, `expected exit 0 (got: ${result.status})`);
      strictEqual(result.stdout, '', `no stdout (got: ${JSON.stringify(result.stdout)})`);
      strictEqual(result.stderr, '', `no stderr (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TH4: non-matching path (Edit on src/index.js) -> exit 0, no output', () => {
    const fx = createAnchorFixture();
    try {
      const srcDir = join(fx.projectRoot, 'src');
      mkdirSync(srcDir, { recursive: true });
      const filePath = join(srcDir, 'index.js');
      writeFileSync(filePath, '// not a scratch file\n', 'utf-8');

      const result = invokeHook({ tool_name: 'Edit', tool_input: { file_path: filePath } }, { cwd: fx.projectRoot });
      strictEqual(result.status, 0, `expected exit 0 (got: ${result.status})`);
      strictEqual(result.stdout, '', `no stdout (got: ${JSON.stringify(result.stdout)})`);
      strictEqual(result.stderr, '', `no stderr (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TH5: empty file_path -> exit 0, no output', () => {
    const result = invokeHook({ tool_name: 'Edit', tool_input: { file_path: '' } });
    strictEqual(result.status, 0, `expected exit 0 (got: ${result.status})`);
    strictEqual(result.stdout, '', `no stdout (got: ${JSON.stringify(result.stdout)})`);
    strictEqual(result.stderr, '', `no stderr (got: ${JSON.stringify(result.stderr)})`);
  });

  await runTest('TH6: matching clean tasks file (updated: today) -> exit 0, no output', () => {
    const fx = createAnchorFixture();
    try {
      const tasksDir = join(fx.scratchDir, 'S-fix-th6', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      const filePath = join(tasksDir, GOLDEN_TASK_FILENAME);
      writeFileSync(filePath, frontmatterFile({ ...GOLDEN_TASK_FIELDS, updated: `${TODAY}T00:00:00.000Z` }), 'utf-8');

      const result = invokeHook({ tool_name: 'Edit', tool_input: { file_path: filePath } }, { cwd: fx.projectRoot });
      strictEqual(result.status, 0, `expected exit 0 (got: ${result.status})`);
      strictEqual(result.stdout, '', `no stdout (got: ${JSON.stringify(result.stdout)})`);
      strictEqual(result.stderr, '', `no stderr (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TH7: matching malformed tasks file (missing status:, updated: today) -> exit 2, stderr WARN: + basename, stdout empty', () => {
    const fx = createAnchorFixture();
    try {
      const tasksDir = join(fx.scratchDir, 'S-fix-th7', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      const filePath = join(tasksDir, GOLDEN_TASK_FILENAME);
      writeFileSync(filePath, frontmatterFile({ ...GOLDEN_TASK_FIELDS, status: undefined, updated: `${TODAY}T00:00:00.000Z` }), 'utf-8');

      const result = invokeHook({ tool_name: 'Edit', tool_input: { file_path: filePath } }, { cwd: fx.projectRoot });
      strictEqual(result.status, 2, `expected exit 2 (got: ${result.status})`);
      ok(result.stderr.includes(formatWarning(filePath, 'missing required key: status')), `stderr forwards the CLI WARN: line (got: ${JSON.stringify(result.stderr)})`);
      strictEqual(result.stdout, '', `stdout empty -- the hook never writes to stdout (got: ${JSON.stringify(result.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TH8: stale updated: on an otherwise-clean tasks file -> exit 2, stderr contains "is not today"', () => {
    const fx = createAnchorFixture();
    try {
      const tasksDir = join(fx.scratchDir, 'S-fix-th8', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      const filePath = join(tasksDir, GOLDEN_TASK_FILENAME);
      writeFileSync(filePath, frontmatterFile({ ...GOLDEN_TASK_FIELDS, updated: `${YESTERDAY}T00:00:00.000Z` }), 'utf-8');

      const result = invokeHook({ tool_name: 'Edit', tool_input: { file_path: filePath } }, { cwd: fx.projectRoot });
      strictEqual(result.status, 2, `expected exit 2 (got: ${result.status})`);
      ok(result.stderr.includes('is not today'), `stderr contains the H1 stale message (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TH9: stale updated: plus a schema finding -> exit 2, stderr contains both lines with the stale line first', () => {
    const fx = createAnchorFixture();
    try {
      const tasksDir = join(fx.scratchDir, 'S-fix-th9', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      const filePath = join(tasksDir, GOLDEN_TASK_FILENAME);
      writeFileSync(filePath, frontmatterFile({ ...GOLDEN_TASK_FIELDS, title: undefined, updated: `${YESTERDAY}T00:00:00.000Z` }), 'utf-8');

      const result = invokeHook({ tool_name: 'Edit', tool_input: { file_path: filePath } }, { cwd: fx.projectRoot });
      strictEqual(result.status, 2, `expected exit 2 (got: ${result.status})`);
      const staleIdx = result.stderr.indexOf('is not today');
      const warnLine = formatWarning(filePath, 'missing required key: title');
      const warnIdx = result.stderr.indexOf(warnLine);
      ok(staleIdx !== -1, `H1 stale line present (got: ${JSON.stringify(result.stderr)})`);
      ok(warnIdx !== -1, `CLI finding line present (got: ${JSON.stringify(result.stderr)})`);
      ok(staleIdx < warnIdx, `the stale line precedes the CLI finding (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TH10: matching clean issues file -> exit 0', () => {
    const fx = createAnchorFixture();
    try {
      const issuesFxDir = join(fx.scratchDir, 'issues');
      mkdirSync(issuesFxDir, { recursive: true });
      const filePath = join(issuesFxDir, GOLDEN_ISSUE_FILENAME);
      writeFileSync(filePath, frontmatterFile(GOLDEN_ISSUE_FIELDS, GOLDEN_SUMMARY_LINES), 'utf-8');

      const result = invokeHook({ tool_name: 'Edit', tool_input: { file_path: filePath } }, { cwd: fx.projectRoot });
      strictEqual(result.status, 0, `expected exit 0 (got: ${result.status})`);
      strictEqual(result.stdout, '', `no stdout (got: ${JSON.stringify(result.stdout)})`);
      strictEqual(result.stderr, '', `no stderr (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TH11: matching malformed issues file -> exit 2 with the finding on stderr', () => {
    const fx = createAnchorFixture();
    try {
      const issuesFxDir = join(fx.scratchDir, 'issues');
      mkdirSync(issuesFxDir, { recursive: true });
      const filePath = join(issuesFxDir, GOLDEN_ISSUE_FILENAME);
      writeFileSync(filePath, frontmatterFile({ ...GOLDEN_ISSUE_FIELDS, commit: undefined }, GOLDEN_SUMMARY_LINES), 'utf-8');

      const result = invokeHook({ tool_name: 'Edit', tool_input: { file_path: filePath } }, { cwd: fx.projectRoot });
      strictEqual(result.status, 2, `expected exit 2 (got: ${result.status})`);
      ok(result.stderr.includes(formatWarning(filePath, 'missing required key: commit')), `stderr forwards the CLI finding (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TH12: issues file with no frontmatter block -> exit 0, no output (D12 through the hook)', () => {
    const fx = createAnchorFixture();
    try {
      const issuesFxDir = join(fx.scratchDir, 'issues');
      mkdirSync(issuesFxDir, { recursive: true });
      const filePath = join(issuesFxDir, 'orphan-note.md');
      writeFileSync(filePath, '# Orphan Note\n\nThis file predates the MCP writer -- no frontmatter block.\n', 'utf-8');

      const result = invokeHook({ tool_name: 'Edit', tool_input: { file_path: filePath } }, { cwd: fx.projectRoot });
      strictEqual(result.status, 0, `expected exit 0 (got: ${result.status})`);
      strictEqual(result.stdout, '', `no stdout (got: ${JSON.stringify(result.stdout)})`);
      strictEqual(result.stderr, '', `no stderr (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TH13: issues file missing a ## Summary section (I9) -> exit 2, stderr names the file and the missing section', () => {
    const fx = createAnchorFixture();
    try {
      const issuesFxDir = join(fx.scratchDir, 'issues');
      mkdirSync(issuesFxDir, { recursive: true });
      const filePath = join(issuesFxDir, GOLDEN_ISSUE_FILENAME);
      writeFileSync(filePath, frontmatterFile(GOLDEN_ISSUE_FIELDS, ['Plain notes with no heading at all.', '']), 'utf-8');

      const result = invokeHook({ tool_name: 'Edit', tool_input: { file_path: filePath } }, { cwd: fx.projectRoot });
      strictEqual(result.status, 2, `expected exit 2 (got: ${result.status})`);
      ok(result.stderr.includes(formatWarning(filePath, 'no ## Summary section')), `stderr names the file and the missing section (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TH14: H1 does not apply to the issues corpus -- an issues file whose captured: is old -> exit 0', () => {
    const fx = createAnchorFixture();
    try {
      const issuesFxDir = join(fx.scratchDir, 'issues');
      mkdirSync(issuesFxDir, { recursive: true });
      const filePath = join(issuesFxDir, GOLDEN_ISSUE_FILENAME);
      writeFileSync(filePath, frontmatterFile({ ...GOLDEN_ISSUE_FIELDS, captured: '2020-01-01T00:00:00.000Z' }, GOLDEN_SUMMARY_LINES), 'utf-8');

      const result = invokeHook({ tool_name: 'Edit', tool_input: { file_path: filePath } }, { cwd: fx.projectRoot });
      strictEqual(result.status, 0, `expected exit 0 -- the updated:-is-today rule is tasks-only (got: ${result.status})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TH15: infra branch -- scratch-memory not resolvable on PATH -> exit 1 (non-blocking), stderr names the failure', () => {
    const fx = createAnchorFixture();
    let scrubDir;
    try {
      const tasksDir = join(fx.scratchDir, 'S-fix-th15', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      const filePath = join(tasksDir, GOLDEN_TASK_FILENAME);
      writeFileSync(filePath, frontmatterFile({ ...GOLDEN_TASK_FIELDS, updated: `${TODAY}T00:00:00.000Z` }), 'utf-8');

      scrubDir = makeScrubbedPathEnv(['scratch-memory']);
      const result = invokeHook(
        { tool_name: 'Edit', tool_input: { file_path: filePath } },
        { cwd: fx.projectRoot, env: { PATH: scrubDir } }
      );
      strictEqual(result.status, 1, `expected exit 1, never 2 -- an environment gap must never block an edit (got: ${result.status})`);
      ok(result.stderr.length > 0, `stderr names the failure (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
      if (scrubDir) rmSync(scrubDir, { recursive: true, force: true });
    }
  });

  await runTest('TH16: infra branch -- jq not resolvable on PATH -> exit 1', () => {
    let scrubDir;
    try {
      scrubDir = makeScrubbedPathEnv(['jq']);
      const result = invokeHook(
        { tool_name: 'Edit', tool_input: { file_path: '/nonexistent/scratch/S-x/tasks/t-abcdef-x.md' } },
        { env: { PATH: scrubDir } }
      );
      strictEqual(result.status, 1, `expected exit 1, never 2 (got: ${result.status})`);
      ok(result.stderr.length > 0, `stderr names the failure (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      if (scrubDir) rmSync(scrubDir, { recursive: true, force: true });
    }
  });

  await runTest('TH17: unsafe path (contains ..) -> exit 1 with the refusal message, the delegate is never invoked', () => {
    const fx = createAnchorFixture();
    try {
      // Deliberately NOT path.join() -- join() normalizes ".." away, and this
      // case needs the literal ".." to reach the SAFE check.
      const filePath = `${fx.scratchDir}/S-fix-th17/tasks/../evil.md`;
      const result = invokeHook({ tool_name: 'Edit', tool_input: { file_path: filePath } }, { cwd: fx.projectRoot });
      strictEqual(result.status, 1, `expected exit 1 (got: ${result.status})`);
      ok(result.stderr.includes('refusing to lint path with unsafe characters'), `stderr contains the refusal message (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TH18: unsafe path (contains a space) -> exit 1 with the refusal message', () => {
    const fx = createAnchorFixture();
    try {
      const filePath = `${fx.scratchDir}/S-fix-th18/tasks/bad file.md`;
      const result = invokeHook({ tool_name: 'Edit', tool_input: { file_path: filePath } }, { cwd: fx.projectRoot });
      strictEqual(result.status, 1, `expected exit 1 (got: ${result.status})`);
      ok(result.stderr.includes('refusing to lint path with unsafe characters'), `stderr contains the refusal message (got: ${JSON.stringify(result.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TH19: MultiEdit on a matching malformed path -> exit 2', () => {
    const fx = createAnchorFixture();
    try {
      const tasksDir = join(fx.scratchDir, 'S-fix-th19', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      const filePath = join(tasksDir, GOLDEN_TASK_FILENAME);
      writeFileSync(filePath, frontmatterFile({ ...GOLDEN_TASK_FIELDS, status: undefined, updated: `${TODAY}T00:00:00.000Z` }), 'utf-8');

      const result = invokeHook({ tool_name: 'MultiEdit', tool_input: { file_path: filePath } }, { cwd: fx.projectRoot });
      strictEqual(result.status, 2, `expected exit 2 -- MultiEdit must reach the delegate, same as Edit/Write (got: ${result.status})`);
    } finally {
      fx.cleanup();
    }
  });

  // Exemption end-to-end (D12), against the live repo corpus -- repoRoot and
  // issuesDir are the same consts TM55 established above. Skipped (not
  // failed), mirroring TM55's existsSync skip-gate, in the
  // marketplace-published scripts copy where scratch/issues/ is absent.
  const knowledgeGraduationGapPath = join(issuesDir, 'knowledge-graduation-gap.md');
  if (!existsSync(knowledgeGraduationGapPath)) {
    process.stdout.write('SKIP: TH20 -- scratch/issues/knowledge-graduation-gap.md not found (marketplace-published scripts copy)\n');
  } else {
    await runTest('TH20: exemption end-to-end -- a real Edit event naming one of the three no-frontmatter exception files -> exit 0, no output', () => {
      const result = invokeHook({ tool_name: 'Edit', tool_input: { file_path: knowledgeGraduationGapPath } });
      strictEqual(result.status, 0, `expected exit 0 -- the D12 exemption verified across the whole chain (got: ${result.status})`);
      strictEqual(result.stdout, '', `no stdout (got: ${JSON.stringify(result.stdout)})`);
      strictEqual(result.stderr, '', `no stderr (got: ${JSON.stringify(result.stderr)})`);
    });
  }

  // ===========================================================================
  // TI -- install-hooks idempotency and preservation tests (Step 05b's
  // cmdInstallHooks() generalization). Every test in this group drives
  // runCli(['register', 'install-hooks', '--project'], { cwd: fixture.projectRoot })
  // against a createAnchorFixture() sandbox, whose .git file marker satisfies
  // the project-root walk (register.mjs's cmdInstallHooks). This group must
  // install at PROJECT scope only -- the user-scope flag writes to the real
  // developer machine's settings file, and must never appear anywhere in this
  // test group.
  // ===========================================================================

  function readInstalledSettings(fx) {
    const settingsPath = join(fx.projectRoot, '.claude', 'settings.json');
    return JSON.parse(readFileSync(settingsPath, 'utf-8'));
  }

  await runTest('TI1: fresh install -- settings.json has hooks.PostToolUse with exactly two groups, one per hook', () => {
    const fx = createAnchorFixture();
    try {
      const res = runCli(['register', 'install-hooks', '--project'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode})`);

      const settings = readInstalledSettings(fx);
      const groups = settings.hooks.PostToolUse;
      strictEqual(groups.length, 2, `exactly two matcher groups (got: ${JSON.stringify(groups)})`);

      const handoffGroup = groups.find(g => g.matcher === 'Edit|Write');
      const lintGroup = groups.find(g => g.matcher === 'Edit|Write|MultiEdit');
      ok(handoffGroup, `an Edit|Write group is present (got: ${JSON.stringify(groups)})`);
      ok(lintGroup, `an Edit|Write|MultiEdit group is present (got: ${JSON.stringify(groups)})`);
      ok(handoffGroup.hooks.some(h => h.command.includes('handoff-validate.sh')), `Edit|Write group contains handoff-validate.sh (got: ${JSON.stringify(handoffGroup.hooks)})`);
      ok(lintGroup.hooks.some(h => h.command.includes('scratch-lint.sh')), `Edit|Write|MultiEdit group contains scratch-lint.sh (got: ${JSON.stringify(lintGroup.hooks)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TI2: idempotency -- running twice writes nothing new; exactly one entry per group; file content byte-identical', () => {
    const fx = createAnchorFixture();
    try {
      const settingsPath = join(fx.projectRoot, '.claude', 'settings.json');

      const res1 = runCli(['register', 'install-hooks', '--project'], { cwd: fx.projectRoot });
      strictEqual(res1.exitCode, 0, `first run exit 0 (got: ${res1.exitCode})`);
      const content1 = readFileSync(settingsPath, 'utf-8');

      const res2 = runCli(['register', 'install-hooks', '--project'], { cwd: fx.projectRoot });
      strictEqual(res2.exitCode, 0, `second run exit 0 (got: ${res2.exitCode})`);
      const content2 = readFileSync(settingsPath, 'utf-8');

      strictEqual(content2, content1, 'settings.json is byte-identical between run 1 and run 2');

      const settings = JSON.parse(content2);
      const groups = settings.hooks.PostToolUse;
      strictEqual(groups.length, 2, `still exactly two groups (got: ${JSON.stringify(groups)})`);
      for (const g of groups) {
        strictEqual(g.hooks.length, 1, `exactly one entry in group ${g.matcher} (got: ${JSON.stringify(g.hooks)})`);
      }
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TI3: existing-entries preservation -- a third-party group and a foreign entry inside Edit|Write both survive verbatim', () => {
    const fx = createAnchorFixture();
    try {
      const settingsDir = join(fx.projectRoot, '.claude');
      mkdirSync(settingsDir, { recursive: true });
      const settingsPath = join(settingsDir, 'settings.json');
      const seeded = {
        hooks: {
          PostToolUse: [
            { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo other' }] },
            { matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'bash "/opt/other-tool/hook.sh"' }] },
          ],
        },
      };
      writeFileSync(settingsPath, JSON.stringify(seeded, null, 2) + '\n', 'utf-8');

      const res = runCli(['register', 'install-hooks', '--project'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode})`);

      const settings = readInstalledSettings(fx);
      const groups = settings.hooks.PostToolUse;
      strictEqual(groups.length, 3, `group count is three -- Bash, Edit|Write, Edit|Write|MultiEdit (got: ${JSON.stringify(groups)})`);

      const bashGroup = groups.find(g => g.matcher === 'Bash');
      ok(bashGroup, `the third-party Bash group survives (got: ${JSON.stringify(groups)})`);
      deepStrictEqual(bashGroup.hooks, [{ type: 'command', command: 'echo other' }], 'the third-party group is untouched');

      const editWriteGroup = groups.find(g => g.matcher === 'Edit|Write');
      ok(editWriteGroup.hooks.some(h => h.command === 'bash "/opt/other-tool/hook.sh"'), `the foreign entry inside Edit|Write survives verbatim (got: ${JSON.stringify(editWriteGroup.hooks)})`);
      ok(editWriteGroup.hooks.some(h => h.command.includes('handoff-validate.sh')), 'handoff-validate.sh was appended alongside the foreign entry');
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TI4: matcher separation -- the Edit|Write group matcher string is still exactly "Edit|Write" after install', () => {
    const fx = createAnchorFixture();
    try {
      const res = runCli(['register', 'install-hooks', '--project'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode})`);

      const settings = readInstalledSettings(fx);
      const groups = settings.hooks.PostToolUse;
      const handoffGroup = groups.find(g => g.hooks.some(h => h.command.includes('handoff-validate.sh')));
      ok(handoffGroup, `a group containing handoff-validate.sh exists (got: ${JSON.stringify(groups)})`);
      strictEqual(handoffGroup.matcher, 'Edit|Write', `matcher was not widened (got: ${JSON.stringify(handoffGroup.matcher)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TI5: partial pre-existing state -- scratch-lint.sh present but handoff-validate.sh absent -> both end up present with no duplicates', () => {
    const seedFx = createAnchorFixture();
    const fx = createAnchorFixture();
    try {
      // Run once on a throwaway fixture to capture the exact, platform-correct
      // scratch-lint.sh hook-entry shape cmdInstallHooks generates, instead of
      // re-deriving register.mjs's own normalizeHookPath() transform here.
      const seedRes = runCli(['register', 'install-hooks', '--project'], { cwd: seedFx.projectRoot });
      strictEqual(seedRes.exitCode, 0, `seed run exit 0 (got: ${seedRes.exitCode})`);
      const seedSettings = readInstalledSettings(seedFx);
      const lintGroupSeed = seedSettings.hooks.PostToolUse.find(g => g.matcher === 'Edit|Write|MultiEdit');
      ok(lintGroupSeed, 'seed run produced an Edit|Write|MultiEdit group');

      const settingsDir = join(fx.projectRoot, '.claude');
      mkdirSync(settingsDir, { recursive: true });
      const settingsPath = join(settingsDir, 'settings.json');
      writeFileSync(settingsPath, JSON.stringify({ hooks: { PostToolUse: [lintGroupSeed] } }, null, 2) + '\n', 'utf-8');

      const res = runCli(['register', 'install-hooks', '--project'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode})`);

      const settings = readInstalledSettings(fx);
      const groups = settings.hooks.PostToolUse;
      strictEqual(groups.length, 2, `exactly two groups (got: ${JSON.stringify(groups)})`);

      const lintGroup = groups.find(g => g.matcher === 'Edit|Write|MultiEdit');
      const handoffGroup = groups.find(g => g.matcher === 'Edit|Write');
      ok(lintGroup, 'the pre-existing lint group is still present');
      ok(handoffGroup, 'a new Edit|Write group was created for handoff-validate.sh');
      strictEqual(lintGroup.hooks.length, 1, `scratch-lint.sh is not duplicated (got: ${JSON.stringify(lintGroup.hooks)})`);
      strictEqual(handoffGroup.hooks.length, 1, `handoff-validate.sh appears exactly once (got: ${JSON.stringify(handoffGroup.hooks)})`);
    } finally {
      seedFx.cleanup();
      fx.cleanup();
    }
  });

  await runTest('TI6: early-return regression guard -- Edit|Write already contains handoff-validate.sh -> scratch-lint.sh is still installed by the same run', () => {
    const seedFx = createAnchorFixture();
    const fx = createAnchorFixture();
    try {
      const seedRes = runCli(['register', 'install-hooks', '--project'], { cwd: seedFx.projectRoot });
      strictEqual(seedRes.exitCode, 0, `seed run exit 0 (got: ${seedRes.exitCode})`);
      const seedSettings = readInstalledSettings(seedFx);
      const handoffGroupSeed = seedSettings.hooks.PostToolUse.find(g => g.matcher === 'Edit|Write');
      ok(handoffGroupSeed, 'seed run produced an Edit|Write group');

      const settingsDir = join(fx.projectRoot, '.claude');
      mkdirSync(settingsDir, { recursive: true });
      const settingsPath = join(settingsDir, 'settings.json');
      // Seed ONLY the Edit|Write group -- the first descriptor reports
      // already-present. Under the pre-refactor shape (two early returns at
      // register.mjs :403/:415) this run would have returned before the
      // second descriptor (scratch-lint.sh) was ever considered.
      writeFileSync(settingsPath, JSON.stringify({ hooks: { PostToolUse: [handoffGroupSeed] } }, null, 2) + '\n', 'utf-8');

      const res = runCli(['register', 'install-hooks', '--project'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode})`);

      const settings = readInstalledSettings(fx);
      const lintGroups = settings.hooks.PostToolUse.filter(g => g.matcher === 'Edit|Write|MultiEdit');
      strictEqual(lintGroups.length, 1, `scratch-lint.sh's own matcher group was installed by the same run (got: ${JSON.stringify(settings.hooks.PostToolUse)})`);
      strictEqual(lintGroups[0].hooks.length, 1, `exactly one hook entry in the new group (got: ${JSON.stringify(lintGroups[0].hooks)})`);
    } finally {
      seedFx.cleanup();
      fx.cleanup();
    }
  });

  // ===========================================================================
  // TE -- epic/spike rules and the epic graph (the wayfinder-import unit 1
  // surface). Tier 1 rules (E4, E6-E12) are exercised through lintIssueFile
  // like the I-rules above; the graph rules (E1, E2, E3, E5) and the frontier
  // through the pure exports; and the cmdLint wiring through the real
  // scratch-memory.mjs dispatcher, so a missing Tier 2a call in cmdLint fails
  // these tests rather than passing them silently.
  // ===========================================================================

  const epicFields = (over = {}) => ({ ...GOLDEN_ISSUE_FIELDS, slug: 'foo', role: 'epic', ...over });
  const spikeFields = (slug, over = {}) => ({
    ...GOLDEN_ISSUE_FIELDS, slug, role: 'spike', epic: 'foo', spike_type: 'task', ...over,
  });

  const epicBody = ({ destination = true, decisions = [], outOfScope = [] } = {}) => {
    const lines = ['## Summary', 'The epic.', ''];
    if (destination) lines.push('## Destination', 'Ship the thing.', '');
    return lines.concat(
      ['## Decisions', ...decisions, ''],
      ['## Not Yet Specified', ''],
      ['## Out of Scope', ...outOfScope, ''],
    );
  };
  const spikeBody = (resolution = null) => {
    const lines = ['## Summary', 'A spike.', ''];
    if (resolution !== null) lines.push('## Resolution', ...resolution, '');
    return lines;
  };

  const asFile = (fields, bodyLines) => ({
    path: `/nowhere/scratch/issues/${fields.slug}.md`,
    content: frontmatterFile(fields, bodyLines),
  });

  await runTest('TE1: a fully valid spike lints clean under the Tier 1 rules', () => {
    const fields = spikeFields('spike-a', { blocked_by: 'spike-b' });
    const problems = lintIssueFile('spike-a.md', frontmatterFile(fields, spikeBody()));
    deepStrictEqual(problems, [], `expected a valid spike to lint clean (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE2: a fully valid epic lints clean -- role: epic plus ## Destination and the retained ## Summary', () => {
    const problems = lintIssueFile('foo.md', frontmatterFile(epicFields(), epicBody()));
    deepStrictEqual(problems, [], `expected a valid epic to lint clean (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE3: an ordinary capture carrying none of the four new keys is untouched by every E-rule', () => {
    // The false-positive guard that matters most: all 144 live corpus files
    // are this shape, and a new rule firing on them would block every edit.
    const problems = lintIssueFile(GOLDEN_ISSUE_FILENAME, frontmatterFile(GOLDEN_ISSUE_FIELDS, GOLDEN_SUMMARY_LINES));
    deepStrictEqual(problems, [], `expected an ordinary capture to lint clean (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE4: I0 still short-circuits -- a no-frontmatter file reaches none of the new rules either', () => {
    const problems = lintIssueFile('orphan.md', '# Orphan\n\nrole: epic looks like frontmatter but is body text.\n');
    deepStrictEqual(problems, [], `D12 exemption covers the E-rules too (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE5: E4 rejects a role outside the enum and names the allowed values', () => {
    const problems = lintIssueFile('foo.md', frontmatterFile(epicFields({ role: 'container' }), epicBody()));
    ok(problems.includes(`invalid role: "container" (expected one of: ${ISSUE_ROLES.join(', ')})`),
      `expected an E4 finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE6: E4 reports an EMPTY role rather than silently accepting it -- no I1 backstop exists for an optional key', () => {
    const problems = lintIssueFile('foo.md', frontmatterFile({ ...GOLDEN_ISSUE_FIELDS, slug: 'foo', role: '' }, ['## Summary', 'x']));
    ok(problems.some(p => p.startsWith('invalid role: ""')),
      `expected an empty role to be reported and quoted (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE7: E6 rejects a spike_type outside the enum', () => {
    const problems = lintIssueFile('spike-a.md', frontmatterFile(spikeFields('spike-a', { spike_type: 'grilling' }), spikeBody()));
    ok(problems.includes(`invalid spike_type: "grilling" (expected one of: ${SPIKE_TYPES.join(', ')})`),
      `expected an E6 finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE8: E7 fires when role: spike carries no epic', () => {
    const problems = lintIssueFile('spike-a.md', frontmatterFile(spikeFields('spike-a', { epic: undefined }), spikeBody()));
    ok(problems.includes('role: spike with no epic'), `expected an E7 finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE9: E8 fires when role: spike carries no spike_type, and E6 does not also fire on the same empty value', () => {
    const problems = lintIssueFile('spike-a.md', frontmatterFile(spikeFields('spike-a', { spike_type: '' }), spikeBody()));
    ok(problems.includes('role: spike with no spike_type'), `expected an E8 finding (got: ${JSON.stringify(problems)})`);
    ok(!problems.some(p => p.startsWith('invalid spike_type:')),
      `E6 must not double-report the same missing value (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE10: E9 rejects a malformed slug in either epic or blocked_by, naming the key', () => {
    const problems = lintIssueFile('spike-a.md', frontmatterFile(spikeFields('spike-a', { epic: 'Foo', blocked_by: 'spike b' }), spikeBody()));
    ok(problems.includes('invalid epic slug: "Foo"'), `expected an E9 finding for epic (got: ${JSON.stringify(problems)})`);
    ok(problems.includes('invalid blocked_by slug: "spike b"'), `expected an E9 finding for blocked_by (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE11: E9 catches an interior empty element -- "a,,b" is a defect, not two slugs', () => {
    const problems = lintIssueFile('spike-a.md', frontmatterFile(spikeFields('spike-a', { blocked_by: 'spike-b,,spike-c' }), spikeBody()));
    ok(problems.includes('invalid blocked_by slug: ""'), `expected an E9 finding for the empty element (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE12: an all-whitespace blocked_by is zero blockers, not a finding -- "zero or more slugs" allows the placeholder', () => {
    const problems = lintIssueFile('spike-a.md', frontmatterFile(spikeFields('spike-a', { blocked_by: '' }), spikeBody()));
    ok(!problems.some(p => p.includes('blocked_by')),
      `an empty blocked_by must not block an edit under the no-warn-tier model (got: ${JSON.stringify(problems)})`);
    deepStrictEqual(splitSlugList(''), [], 'splitSlugList treats an empty value as zero elements');
    deepStrictEqual(splitSlugList(undefined), [], 'splitSlugList treats an absent key as zero elements');
  });

  await runTest('TE13: E10 fires once per spike-only key present without role: spike', () => {
    const fields = { ...GOLDEN_ISSUE_FIELDS, slug: 'stray', spike_type: 'task', blocked_by: 'spike-a' };
    const problems = lintIssueFile('stray.md', frontmatterFile(fields, ['## Summary', 'x']));
    ok(problems.includes('spike_type present without role: spike'), `expected an E10 finding for spike_type (got: ${JSON.stringify(problems)})`);
    ok(problems.includes('blocked_by present without role: spike'), `expected an E10 finding for blocked_by (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE14: E10 deliberately does NOT fire for a bare epic: on a non-spike -- D7 multi-membership stays open', () => {
    // idea.md's Not Yet Specified leaves open whether an ordinary capture can
    // be promoted into a spike in place. A hook-blocking rule must not
    // foreclose an explicitly unspecified question (README.md silent choice #2).
    const fields = { ...GOLDEN_ISSUE_FIELDS, slug: 'capture', epic: 'foo' };
    const problems = lintIssueFile('capture.md', frontmatterFile(fields, ['## Summary', 'x']));
    deepStrictEqual(problems, [], `a capture claiming an epic must lint clean (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE15: E11 fires when role: epic has no ## Destination section', () => {
    const problems = lintIssueFile('foo.md', frontmatterFile(epicFields(), epicBody({ destination: false })));
    ok(problems.includes('role: epic with no ## Destination section'), `expected an E11 finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE16: E12 fires when a resolved prototype spike names its artifact only in prose', () => {
    const fields = spikeFields('proto', { spike_type: 'prototype', status: 'resolved' });
    const problems = lintIssueFile('proto.md', frontmatterFile(fields, spikeBody(['We built a throwaway branch and it worked well.'])));
    ok(problems.some(p => p.startsWith('resolved prototype spike:')), `expected an E12 finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE17: E12 is satisfied by a scratch/issues/ path, and by a backticked slug', () => {
    const fields = spikeFields('proto', { spike_type: 'prototype', status: 'resolved' });
    const viaPath = lintIssueFile('proto.md', frontmatterFile(fields, spikeBody(['Output: scratch/issues/proto-result.md'])));
    ok(!viaPath.some(p => p.startsWith('resolved prototype spike:')), `a corpus path satisfies E12 (got: ${JSON.stringify(viaPath)})`);
    const viaSlug = lintIssueFile('proto.md', frontmatterFile(fields, spikeBody(['Output lives at `proto-result`.'])));
    ok(!viaSlug.some(p => p.startsWith('resolved prototype spike:')), `a backticked slug satisfies E12 (got: ${JSON.stringify(viaSlug)})`);
  });

  await runTest('TE18: E12 does not double-report when ## Resolution is missing entirely -- I7 already owns that', () => {
    const fields = spikeFields('proto', { spike_type: 'prototype', status: 'resolved' });
    const problems = lintIssueFile('proto.md', frontmatterFile(fields, spikeBody()));
    ok(problems.includes('status: resolved with no ## Resolution section'), `I7 still fires (got: ${JSON.stringify(problems)})`);
    ok(!problems.some(p => p.startsWith('resolved prototype spike:')), `E12 must stay silent (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE19: ISSUE_SLUG_PATTERN accepts a collision-suffixed slug and rejects the shapes E9 must catch', () => {
    ok(ISSUE_SLUG_PATTERN.test('login-times-out-2'), 'a numeric collision suffix is a valid slug');
    ok(!ISSUE_SLUG_PATTERN.test('-lead'), 'a leading hyphen is invalid');
    ok(!ISSUE_SLUG_PATTERN.test('trail-'), 'a trailing hyphen is invalid');
    ok(!ISSUE_SLUG_PATTERN.test('Upper'), 'uppercase is invalid');
    ok(!ISSUE_SLUG_PATTERN.test(''), 'the empty string is invalid');
  });

  // --- graph rules and the frontier (pure exports) ---------------------------

  await runTest('TE20: acceptance outcome 1 -- frontier of foo with a open, b blocked_by a, c open is [a, c]', () => {
    const files = [
      asFile(epicFields(), epicBody()),
      asFile(spikeFields('a'), spikeBody()),
      asFile(spikeFields('b', { blocked_by: 'a' }), spikeBody()),
      asFile(spikeFields('c'), spikeBody()),
    ];
    deepStrictEqual(frontierSpikes(buildEpicGraph('foo', files)), ['a', 'c'],
      'b is blocked by an open spike and must not appear');
  });

  await runTest('TE21: acceptance outcome 2 -- resolving a leaves the frontier [b, c]', () => {
    const files = [
      asFile(epicFields(), epicBody({ decisions: ['- a: settled'] })),
      asFile(spikeFields('a', { status: 'resolved' }), spikeBody(['Settled.'])),
      asFile(spikeFields('b', { blocked_by: 'a' }), spikeBody()),
      asFile(spikeFields('c'), spikeBody()),
    ];
    deepStrictEqual(frontierSpikes(buildEpicGraph('foo', files)), ['b', 'c'],
      'a is resolved so it leaves the frontier and unblocks b');
  });

  await runTest('TE22: the frontier is empty and clean when every open spike is blocked -- a stuck epic is a state, not a finding', () => {
    const files = [
      asFile(epicFields(), epicBody()),
      asFile(spikeFields('a', { blocked_by: 'b' }), spikeBody()),
      asFile(spikeFields('b', { status: 'resolved' }), spikeBody(['done'])),
      asFile(spikeFields('c', { blocked_by: 'a' }), spikeBody()),
    ];
    deepStrictEqual(frontierSpikes(buildEpicGraph('foo', files)), ['a'], 'a is unblocked once b resolves');
    const allBlocked = [
      asFile(epicFields(), epicBody()),
      asFile(spikeFields('a', { blocked_by: 'b' }), spikeBody()),
      asFile(spikeFields('b', { blocked_by: 'c' }), spikeBody()),
      asFile(spikeFields('c', { blocked_by: 'b' }), spikeBody()),
    ];
    deepStrictEqual(frontierSpikes(buildEpicGraph('foo', allBlocked)), [], 'no spike is ready');
  });

  await runTest('TE23: an unresolvable blocker fails CLOSED -- the frontier treats it as blocked, never as ready', () => {
    const files = [
      asFile(epicFields(), epicBody()),
      asFile(spikeFields('a', { blocked_by: 'no-such-slug' }), spikeBody()),
    ];
    deepStrictEqual(frontierSpikes(buildEpicGraph('foo', files)), [],
      'a typo must not promote work into the ready list');
  });

  await runTest('TE24: E1 names the spike and the blocker that does not resolve', () => {
    const files = [
      asFile(epicFields(), epicBody()),
      asFile(spikeFields('a', { blocked_by: 'no-such-slug' }), spikeBody()),
    ];
    const problems = lintEpicGraph('foo', files);
    ok(problems.includes('a: blocked_by no-such-slug does not resolve to a spike in epic foo'),
      `expected an E1 finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE25: E1 stays silent on a MALFORMED blocker slug -- E9 already reported it', () => {
    const files = [
      asFile(epicFields(), epicBody()),
      asFile(spikeFields('a', { blocked_by: 'Not A Slug' }), spikeBody()),
    ];
    const problems = lintEpicGraph('foo', files);
    ok(!problems.some(p => p.includes('blocked_by')), `one typo, one finding (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE26: acceptance outcome 4 -- a two-node cycle produces one finding naming both slugs', () => {
    const files = [
      asFile(epicFields(), epicBody()),
      asFile(spikeFields('a', { blocked_by: 'b' }), spikeBody()),
      asFile(spikeFields('b', { blocked_by: 'a' }), spikeBody()),
    ];
    const cycles = lintEpicGraph('foo', files).filter(p => p.includes('cycle'));
    strictEqual(cycles.length, 1, `the same cycle is reported once, not once per entry point (got: ${JSON.stringify(cycles)})`);
    ok(cycles[0].includes('a') && cycles[0].includes('b'), `the finding names both slugs (got: ${JSON.stringify(cycles)})`);
  });

  await runTest('TE27: E2 catches a self-block -- a slug listing itself is a one-node cycle', () => {
    const files = [
      asFile(epicFields(), epicBody()),
      asFile(spikeFields('a', { blocked_by: 'a' }), spikeBody()),
    ];
    const cycles = lintEpicGraph('foo', files).filter(p => p.includes('cycle'));
    strictEqual(cycles.length, 1, `expected exactly one cycle finding (got: ${JSON.stringify(cycles)})`);
    ok(cycles[0].includes('a -> a'), `the finding shows the self-edge (got: ${JSON.stringify(cycles)})`);
  });

  await runTest('TE28: E3 fires for every claimant when no file carries role: epic for that slug', () => {
    const files = [
      asFile(spikeFields('a'), spikeBody()),
      asFile(spikeFields('b'), spikeBody()),
    ];
    const problems = lintEpicGraph('foo', files);
    ok(problems.includes('a: epic foo does not resolve to a file carrying role: epic'),
      `expected an E3 finding for a (got: ${JSON.stringify(problems)})`);
    ok(problems.includes('b: epic foo does not resolve to a file carrying role: epic'),
      `expected an E3 finding for b (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE29: E5 does not run at Tier 2a and does run under includeTier2b -- the whole point of D16 splitting the tier', () => {
    const files = [
      asFile(epicFields(), epicBody()),
      asFile(spikeFields('a', { status: 'resolved' }), spikeBody(['Settled.'])),
    ];
    deepStrictEqual(lintEpicGraph('foo', files), [],
      'the hook path must never see E5 -- resolving a spike and placing its line are two edits');
    const tier2b = lintEpicGraph('foo', files, { includeTier2b: true });
    ok(tier2b.some(p => p.startsWith('a: resolved with no matching line')),
      `expected an E5 finding under Tier 2b (got: ${JSON.stringify(tier2b)})`);
  });

  await runTest('TE30: E5 is satisfied by a line in ## Decisions', () => {
    const files = [
      asFile(epicFields(), epicBody({ decisions: ['- a: we chose the boring option'] })),
      asFile(spikeFields('a', { status: 'resolved' }), spikeBody(['Settled.'])),
    ];
    deepStrictEqual(lintEpicGraph('foo', files, { includeTier2b: true }), [],
      'a placed stone clears E5');
  });

  await runTest('TE31: D24 -- E5 is equally satisfied by a line in ## Out of Scope', () => {
    // A spike ruled past the destination is closed as a scope boundary, not a
    // step on the route; demanding its line in ## Decisions would falsify the
    // record ## Decisions exists to keep.
    const files = [
      asFile(epicFields(), epicBody({ outOfScope: ['- a: ruled past the destination'] })),
      asFile(spikeFields('a', { status: 'resolved' }), spikeBody(['Out of scope.'])),
    ];
    deepStrictEqual(lintEpicGraph('foo', files, { includeTier2b: true }), [],
      'an out-of-scope ruling clears E5 exactly as a decision does');
  });

  await runTest('TE32: E5 matches a whole slug token -- a longer slug sharing the prefix does not satisfy the shorter one', () => {
    // The slug is deliberately realistic (kebab-case, several segments)
    // rather than a single letter: `\b` would treat '-' as a boundary and let
    // auth-retry-policy satisfy auth-retry, which is the bug mentionsSlug
    // exists to prevent.
    const files = [
      asFile(epicFields(), epicBody({ decisions: ['- auth-retry-policy: settled separately'] })),
      asFile(spikeFields('auth-retry', { status: 'resolved' }), spikeBody(['Settled.'])),
    ];
    const problems = lintEpicGraph('foo', files, { includeTier2b: true });
    ok(problems.some(p => p.startsWith('auth-retry: resolved with no matching line')),
      `a near-miss slug must not satisfy E5 (got: ${JSON.stringify(problems)})`);
  });

  await runTest('TE33: an OPEN spike never triggers E5 -- the rule is about resolution, not membership', () => {
    const files = [
      asFile(epicFields(), epicBody()),
      asFile(spikeFields('a'), spikeBody()),
    ];
    deepStrictEqual(lintEpicGraph('foo', files, { includeTier2b: true }), [], 'open spikes need no stone');
  });

  await runTest('TE34: the graph rules are pure -- they run on paths that do not exist and touch no filesystem', () => {
    // The module header's contract: everything above renderTasksBlock is a
    // pure function. asFile() paths are under /nowhere/, so any read would
    // throw ENOENT rather than returning a wrong answer quietly.
    const files = [
      { path: '/nowhere/scratch/issues/foo.md', content: frontmatterFile(epicFields(), epicBody()) },
      { path: '/nowhere/scratch/issues/a.md', content: frontmatterFile(spikeFields('a'), spikeBody()) },
    ];
    deepStrictEqual(lintEpicGraph('foo', files), [], 'no I/O, no throw');
    deepStrictEqual(frontierSpikes(buildEpicGraph('foo', files)), ['a'], 'no I/O, no throw');
  });

  // --- cmdLint wiring, through the real dispatcher ---------------------------

  const issuesFixture = () => {
    const fx = createAnchorFixture();
    const issuesDir = join(fx.scratchDir, 'issues');
    mkdirSync(issuesDir, { recursive: true });
    const write = (fields, bodyLines) =>
      writeFileSync(join(issuesDir, `${fields.slug}.md`), frontmatterFile(fields, bodyLines), 'utf-8');
    return { fx, issuesDir, write, file: (slug) => join(issuesDir, `${slug}.md`) };
  };

  await runTest('TE35: acceptance outcome 3 -- a file lint of a spike with an unresolvable blocker exits 1 and names the slug', () => {
    const { fx, write, file } = issuesFixture();
    try {
      write(epicFields(), epicBody());
      write(spikeFields('spike-a', { blocked_by: 'no-such-slug' }), spikeBody());

      const res = runCli(['tasks', 'lint', '--', file('spike-a')], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, `expected findings exit (got: ${res.exitCode}, stderr: ${res.stderr})`);
      ok(res.stdout.includes('WARN: spike-a.md:'), `the hook forwards this line shape (got: ${JSON.stringify(res.stdout)})`);
      ok(res.stdout.includes('no-such-slug'), `the finding names the unresolvable slug (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TE36: acceptance outcome 4 through the CLI -- a mutual block exits 1 with a cycle finding naming both slugs', () => {
    const { fx, write, file } = issuesFixture();
    try {
      write(epicFields(), epicBody());
      write(spikeFields('spike-a', { blocked_by: 'spike-b' }), spikeBody());
      write(spikeFields('spike-b', { blocked_by: 'spike-a' }), spikeBody());

      const res = runCli(['tasks', 'lint', '--', file('spike-a')], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, `expected findings exit (got: ${res.exitCode}, stderr: ${res.stderr})`);
      ok(res.stdout.includes('cycle'), `expected a cycle finding (got: ${JSON.stringify(res.stdout)})`);
      ok(res.stdout.includes('spike-a') && res.stdout.includes('spike-b'),
        `the finding names both slugs (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TE37: acceptance outcome 6 -- resolving without placing the stone does not block the edit, and the directory lint then reports E5', () => {
    const { fx, issuesDir, write, file } = issuesFixture();
    try {
      write(epicFields(), epicBody());
      write(spikeFields('spike-a', { status: 'resolved' }), spikeBody(['Settled.']));

      const fileRes = runCli(['tasks', 'lint', '--', file('spike-a')], { cwd: fx.projectRoot });
      strictEqual(fileRes.exitCode, 0, `the edit must not be blocked (got: ${fileRes.exitCode}, stdout: ${fileRes.stdout})`);
      strictEqual(fileRes.stdout, '', `no output on the hook path (got: ${JSON.stringify(fileRes.stdout)})`);

      const dirRes = runCli(['tasks', 'lint', issuesDir], { cwd: fx.projectRoot });
      strictEqual(dirRes.exitCode, 1, `the session-end sweep reports it (got: ${dirRes.exitCode})`);
      ok(dirRes.stdout.includes('spike-a: resolved with no matching line'),
        `the E5 finding names the spike (got: ${JSON.stringify(dirRes.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TE38: acceptance outcome 7 (D24) -- the same spike recorded under ## Out of Scope makes the directory lint exit 0', () => {
    const { fx, issuesDir, write } = issuesFixture();
    try {
      write(epicFields(), epicBody({ outOfScope: ['- spike-a: ruled past the destination'] }));
      write(spikeFields('spike-a', { status: 'resolved' }), spikeBody(['Out of scope.']));

      const res = runCli(['tasks', 'lint', issuesDir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected a clean sweep (got: ${res.exitCode}, stdout: ${res.stdout})`);
      strictEqual(res.stdout, '', `no findings (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TE39: the tasks schema is untouched by the graph wiring -- a workstream tasks/ lint runs no epic rules', () => {
    const fx = createAnchorFixture();
    try {
      const tasksDir = join(fx.scratchDir, 'S-fix-te39', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, GOLDEN_TASK_FILENAME), frontmatterFile(GOLDEN_TASK_FIELDS), 'utf-8');

      const res = runCli(['tasks', 'lint', tasksDir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stdout: ${res.stdout})`);
      strictEqual(res.stdout, '', `stdout is empty (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TE40: a directory of ordinary captures still lints clean -- the graph wiring adds no findings where no epic exists', () => {
    const { fx, issuesDir, write } = issuesFixture();
    try {
      write({ ...GOLDEN_ISSUE_FIELDS, slug: 'first-capture' }, GOLDEN_SUMMARY_LINES);
      write({ ...GOLDEN_ISSUE_FIELDS, slug: 'second-capture' }, GOLDEN_SUMMARY_LINES);

      const res = runCli(['tasks', 'lint', issuesDir], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stdout: ${res.stdout})`);
      strictEqual(res.stdout, '', `stdout is empty (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });


  process.stdout.write(`${passCount} passed, ${failCount} failed\n`);
  process.exit(failCount === 0 ? 0 : 1);
})();
