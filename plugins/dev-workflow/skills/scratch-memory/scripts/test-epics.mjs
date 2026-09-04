#!/usr/bin/env node
// test-epics.mjs — Tests for the `epics` CLI verb group (epics.mjs).
// Usage: node test-epics.mjs   (exit 0 on all-pass)
//
// One group, TF: `epics frontier` driven through the real scratch-memory.mjs
// dispatcher via runCli, not by importing epics.mjs's dispatch directly, so
// the `case 'epics'` switch wiring is actually exercised — importing dispatch
// would pass with the switch arm missing entirely. The one exception is the
// entry-point-guard case, which must spawn `node epics.mjs` by design.
//
// The readiness predicate itself is unit 1's (frontierSpikes over
// buildEpicGraph) and is covered by test-tasks.mjs's TE group; what these
// tests pin is this unit's surface — the wiring, the corpus read, the output
// shape, the exit codes, and the argument contract.

import { strictEqual, ok } from 'node:assert';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

import { createAnchorFixture } from './test-fixtures.mjs';
import { runCli } from './test-driver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EPICS_PATH = join(__dirname, 'epics.mjs');

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('Usage: node test-epics.mjs\n\nRuns the `epics` verb group tests (TF group). Exit 0 on all-pass, 1 otherwise.\n');
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
// Fixtures — the same frontmatter-file builder and golden field map
// test-tasks.mjs uses, so a corpus file written here is byte-shaped like one
// write_issue would emit.
// ---------------------------------------------------------------------------

function frontmatterFile(fields, bodyLines = []) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${value}`);
  }
  lines.push('---', '', ...bodyLines);
  return lines.join('\n');
}

const GOLDEN_ISSUE_FIELDS = {
  tool: 'capture-issue',
  kind: 'issue',
  title: 'Example issue title',
  slug: 'example-issue-title',
  status: 'open',
  captured: '2026-08-01T12:00:00.000Z',
  repo: 'claude-code-ref',
  branch: 'main',
  commit: 'abc1234',
  working_tree: 'clean',
};

const epicFields = (over = {}) => ({ ...GOLDEN_ISSUE_FIELDS, slug: 'foo', role: 'epic', ...over });
const spikeFields = (slug, over = {}) => ({
  ...GOLDEN_ISSUE_FIELDS, slug, role: 'spike', epic: 'foo', spike_type: 'task', ...over,
});

const EPIC_BODY = [
  '## Summary', 'The epic.', '',
  '## Destination', 'Ship the thing.', '',
  '## Decisions', '',
  '## Not Yet Specified', '',
  '## Out of Scope', '',
];
const SPIKE_BODY = ['## Summary', 'A spike.', ''];

// A corpus fixture: a temp project root with scratch/issues/ and a writer.
// createAnchorFixture (not createFixture) because the code under test only
// needs project-root resolution to succeed — it never reads git state.
function corpusFixture() {
  const fx = createAnchorFixture();
  const issuesDir = join(fx.scratchDir, 'issues');
  mkdirSync(issuesDir, { recursive: true });
  const write = (fields, bodyLines) =>
    writeFileSync(join(issuesDir, `${fields.slug}.md`), frontmatterFile(fields, bodyLines), 'utf-8');
  return { fx, issuesDir, write };
}

// The three-spike corpus idea.md's acceptance outcomes 1 and 2 are stated
// over: epic `foo`; spikes `a` (open), `b` (open, blocked_by: a), `c` (open).
function acceptanceCorpus() {
  const ctx = corpusFixture();
  ctx.write(epicFields(), EPIC_BODY);
  ctx.write(spikeFields('a'), SPIKE_BODY);
  ctx.write(spikeFields('b', { blocked_by: 'a' }), SPIKE_BODY);
  ctx.write(spikeFields('c'), SPIKE_BODY);
  return ctx;
}

(async () => {
  // =========================================================================
  // TF -- `epics frontier` (the wayfinder-import unit 2 surface).
  // =========================================================================

  await runTest('TF1: acceptance outcome 1 -- frontier writes the two unblocked spikes and not the blocked one, exit 0', () => {
    const { fx } = acceptanceCorpus();
    try {
      const res = runCli(['epics', 'frontier', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      strictEqual(res.stdout, 'a\nc\n', `a and c, not b (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF2: acceptance outcome 2 -- resolving `a` drops it from the frontier and admits `b`', () => {
    const { fx, write } = acceptanceCorpus();
    try {
      write(spikeFields('a', { status: 'resolved' }), [...SPIKE_BODY, '## Resolution', 'Settled.', '']);

      const res = runCli(['epics', 'frontier', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      strictEqual(res.stdout, 'b\nc\n', `a absent, b and c present (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF3: deferred note N2 -- an epic whose every open spike is blocked writes nothing and exits 0', () => {
    // All-blocked with no lint violations is a clean state, not an error:
    // conventional listing-verb behaviour, and D6 makes the user the gate so
    // no automation can misread the empty result.
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      write(spikeFields('a', { blocked_by: 'b' }), SPIKE_BODY);
      write(spikeFields('b', { blocked_by: 'c' }), SPIKE_BODY);
      write(spikeFields('c', { blocked_by: 'a' }), SPIKE_BODY);

      const res = runCli(['epics', 'frontier', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `all-blocked is exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      strictEqual(res.stdout, '', `and writes nothing at all (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF4: an epic with no spikes at all writes nothing and exits 0', () => {
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);

      const res = runCli(['epics', 'frontier', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      strictEqual(res.stdout, '', `no output (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF5: silent choice #15 -- a spike whose blocker resolves to nothing is blocked, not ready', () => {
    // Fails closed: a typo must never promote work into the ready list. The
    // state is already an E1 finding at edit time, so the frontier does not
    // have to be the thing that reports it.
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      write(spikeFields('a', { blocked_by: 'no-such-slug' }), SPIKE_BODY);
      write(spikeFields('c'), SPIKE_BODY);

      const res = runCli(['epics', 'frontier', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      strictEqual(res.stdout, 'c\n', `only c is ready (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF6: a blocker belonging to a different epic does not resolve, so the spike stays blocked', () => {
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      write(epicFields({ slug: 'bar' }), EPIC_BODY);
      write(spikeFields('a', { blocked_by: 'other-spike' }), SPIKE_BODY);
      write(spikeFields('other-spike', { epic: 'bar', status: 'resolved' }),
        [...SPIKE_BODY, '## Resolution', 'Settled.', '']);

      const res = runCli(['epics', 'frontier', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      strictEqual(res.stdout, '', `a is blocked by a slug outside its epic (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF7: silent choice #14 -- resolved spikes, other epics\' spikes, and non-spike members are all excluded', () => {
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      write(epicFields({ slug: 'bar' }), EPIC_BODY);
      write(spikeFields('ready-one'), SPIKE_BODY);
      write(spikeFields('already-done', { status: 'resolved' }), [...SPIKE_BODY, '## Resolution', 'Settled.', '']);
      write(spikeFields('elsewhere', { epic: 'bar' }), SPIKE_BODY);
      // An ordinary capture that claims the epic but carries no role: D7 and
      // idea.md's Not Yet Specified leave in-place promotion open, so E10
      // permits this file -- and it must not appear on the frontier.
      write({ ...GOLDEN_ISSUE_FIELDS, slug: 'plain-capture', epic: 'foo' }, ['## Summary', 'A capture.', '']);

      const res = runCli(['epics', 'frontier', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      strictEqual(res.stdout, 'ready-one\n', `only the open spike of this epic (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF8: a spike belonging to two epics appears on both frontiers', () => {
    // D7: the `epic` key holds one or more ids, so membership is many-to-many.
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      write(epicFields({ slug: 'bar' }), EPIC_BODY);
      write(spikeFields('shared', { epic: 'foo,bar' }), SPIKE_BODY);

      const fooRes = runCli(['epics', 'frontier', 'foo'], { cwd: fx.projectRoot });
      strictEqual(fooRes.exitCode, 0, `expected exit 0 (got: ${fooRes.exitCode}, stderr: ${fooRes.stderr})`);
      strictEqual(fooRes.stdout, 'shared\n', `listed under foo (got: ${JSON.stringify(fooRes.stdout)})`);

      const barRes = runCli(['epics', 'frontier', 'bar'], { cwd: fx.projectRoot });
      strictEqual(barRes.exitCode, 0, `expected exit 0 (got: ${barRes.exitCode}, stderr: ${barRes.stderr})`);
      strictEqual(barRes.stdout, 'shared\n', `and under bar (got: ${JSON.stringify(barRes.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF9: silent choice #16 -- output is bare slugs, one per line, sorted, newline-terminated', () => {
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      for (const slug of ['zeta-spike', 'alpha-spike', 'mid-spike']) {
        write(spikeFields(slug), SPIKE_BODY);
      }

      const res = runCli(['epics', 'frontier', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      strictEqual(res.stdout, 'alpha-spike\nmid-spike\nzeta-spike\n',
        `sorted bare slugs, trailing newline, nothing else on the line (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF10: the three no-frontmatter corpus files are tolerated, not a crash', () => {
    // D12's standing exemption: 3 live files predate the MCP writer.
    const { fx, issuesDir, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      write(spikeFields('a'), SPIKE_BODY);
      writeFileSync(join(issuesDir, 'pre-mcp-note.md'), '# Just a heading\n\nNo frontmatter here.\n', 'utf-8');

      const res = runCli(['epics', 'frontier', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      strictEqual(res.stdout, 'a\n', `the frontier is unaffected (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF11: a slug naming no epic file is a loud user error, not an empty success', () => {
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      write(spikeFields('a'), SPIKE_BODY);

      const res = runCli(['epics', 'frontier', 'typo-slug'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, `expected a user error (got: ${res.exitCode}, stdout: ${res.stdout})`);
      strictEqual(res.stdout, '', `nothing on stdout (got: ${JSON.stringify(res.stdout)})`);
      ok(res.stderr.includes('no such epic: typo-slug'), `the error names the slug (got: ${JSON.stringify(res.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF12: a spike-slug argument is a user error too -- role: epic is what the argument names', () => {
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      write(spikeFields('a'), SPIKE_BODY);

      const res = runCli(['epics', 'frontier', 'a'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, `expected a user error (got: ${res.exitCode}, stdout: ${res.stdout})`);
      ok(res.stderr.includes('no such epic: a'), `the error names the slug (got: ${JSON.stringify(res.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF13: a project with no scratch/issues/ directory at all is the same user error, not a crash', () => {
    const fx = createAnchorFixture();
    try {
      const res = runCli(['epics', 'frontier', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 1, `expected a user error (got: ${res.exitCode}, stdout: ${res.stdout})`);
      ok(res.stderr.includes('no such epic: foo'), `the error names the slug (got: ${JSON.stringify(res.stderr)})`);
      ok(!res.stderr.includes('ENOENT'), `the missing directory is not surfaced as an FS failure (got: ${JSON.stringify(res.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF14: a slug outside the corpus charset is rejected before anything is read', () => {
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);

      for (const bad of ['../../etc/passwd', 'has/slash', 'Has-Caps', '-leading-hyphen']) {
        const res = runCli(['epics', 'frontier', '--', bad], { cwd: fx.projectRoot });
        strictEqual(res.exitCode, 1, `expected a user error for ${JSON.stringify(bad)} (got: ${res.exitCode})`);
        ok(res.stderr.includes('MALFORMED_SLUG'), `the error names the guard (got: ${JSON.stringify(res.stderr)})`);
        strictEqual(res.stdout, '', `nothing on stdout for ${JSON.stringify(bad)} (got: ${JSON.stringify(res.stdout)})`);
      }
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF15: `--` stops flag parsing and the next token is taken as the slug', () => {
    const { fx } = acceptanceCorpus();
    try {
      const res = runCli(['epics', 'frontier', '--', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      strictEqual(res.stdout, 'a\nc\n', `same result as without the stop flag (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF16: an unknown option, a missing slug, and a second positional are each user errors', () => {
    const { fx } = acceptanceCorpus();
    try {
      const unknownOpt = runCli(['epics', 'frontier', '--json', 'foo'], { cwd: fx.projectRoot });
      strictEqual(unknownOpt.exitCode, 1, `unknown option (got: ${unknownOpt.exitCode})`);
      ok(unknownOpt.stderr.includes('unknown option: --json'), `names the option (got: ${JSON.stringify(unknownOpt.stderr)})`);

      const missing = runCli(['epics', 'frontier'], { cwd: fx.projectRoot });
      strictEqual(missing.exitCode, 1, `missing slug (got: ${missing.exitCode})`);
      ok(missing.stderr.includes('missing <epic-slug>'), `names the argument (got: ${JSON.stringify(missing.stderr)})`);

      const extra = runCli(['epics', 'frontier', 'foo', 'bar'], { cwd: fx.projectRoot });
      strictEqual(extra.exitCode, 1, `too many positionals (got: ${extra.exitCode})`);
      ok(extra.stderr.includes('too many positional arguments'), `names the problem (got: ${JSON.stringify(extra.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF17: a missing subcommand and an unknown subcommand are user errors carrying the help text', () => {
    const { fx } = acceptanceCorpus();
    try {
      const none = runCli(['epics'], { cwd: fx.projectRoot });
      strictEqual(none.exitCode, 1, `missing subcommand (got: ${none.exitCode})`);
      ok(none.stderr.includes('missing subcommand'), `names the problem (got: ${JSON.stringify(none.stderr)})`);
      ok(none.stderr.includes('Usage: scratch-memory epics'), `and carries the help (got: ${JSON.stringify(none.stderr)})`);

      const bogus = runCli(['epics', 'summarize', 'foo'], { cwd: fx.projectRoot });
      strictEqual(bogus.exitCode, 1, `unknown subcommand (got: ${bogus.exitCode})`);
      ok(bogus.stderr.includes('unknown epics subcommand: summarize'), `names it (got: ${JSON.stringify(bogus.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF18: `epics --help` writes usage to stdout and exits 0', () => {
    const { fx } = acceptanceCorpus();
    try {
      for (const flag of ['-h', '--help']) {
        const res = runCli(['epics', flag], { cwd: fx.projectRoot });
        strictEqual(res.exitCode, 0, `${flag} exits 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
        ok(res.stdout.includes('Usage: scratch-memory epics'), `${flag} prints usage (got: ${JSON.stringify(res.stdout)})`);
        ok(res.stdout.includes('frontier <epic-slug>'), `${flag} documents the subcommand (got: ${JSON.stringify(res.stdout)})`);
      }
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF19: the top-level help lists the epics verb group', () => {
    const res = runCli(['--help']);
    strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
    ok(/^\s{2}epics\s+frontier/m.test(res.stdout), `an epics row under Verb groups (got: ${JSON.stringify(res.stdout)})`);
  });

  await runTest('TF20: the entry-point guard -- direct `node epics.mjs` runs the verb instead of silently exiting 0', () => {
    // Without the guard this exits 0 with no output, which is
    // indistinguishable from an epic with no ready spikes (issue:
    // verb-modules-silent-noop-direct-invocation).
    const { fx } = acceptanceCorpus();
    try {
      const res = spawnSync('node', [EPICS_PATH, 'frontier', 'foo'], {
        cwd: fx.projectRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
      });
      strictEqual(res.status, 0, `expected exit 0 (got: ${res.status}, stderr: ${res.stderr})`);
      strictEqual(res.stdout, 'a\nc\n', `the same frontier the dispatcher produces (got: ${JSON.stringify(res.stdout)})`);

      const help = spawnSync('node', [EPICS_PATH, '--help'], {
        cwd: fx.projectRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
      });
      strictEqual(help.status, 0, `direct --help exits 0 (got: ${help.status}, stderr: ${help.stderr})`);
      ok(help.stdout.includes('Usage: scratch-memory epics'), `and prints usage (got: ${JSON.stringify(help.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  process.stdout.write(`${passCount} passed, ${failCount} failed\n`);
  process.exit(failCount === 0 ? 0 : 1);
})();
