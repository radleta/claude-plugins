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

import { strictEqual, deepStrictEqual, ok } from 'node:assert';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
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
      write(spikeFields('a', { status: 'fixed' }), [...SPIKE_BODY, '## Resolution', 'Settled.', '']);

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

  await runTest('TF6: a blocker belonging to a different epic RESOLVES -- the lookup is corpus-wide', () => {
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      write(epicFields({ slug: 'bar' }), EPIC_BODY);
      write(spikeFields('a', { blocked_by: 'other-spike' }), SPIKE_BODY);
      write(spikeFields('other-spike', { epic: 'bar', status: 'fixed' }),
        [...SPIKE_BODY, '## Resolution', 'Settled.', '']);

      const res = runCli(['epics', 'frontier', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      strictEqual(res.stdout, 'a\n', `a's blocker is settled, in whatever epic (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TF6a: A5 -- a spike blocked by an OPEN build issue is absent, and appears once that issue settles', () => {
    const buildIssue = (over = {}) => ({ ...GOLDEN_ISSUE_FIELDS, slug: 'build-it', epic: 'foo', ...over });

    const blocked = corpusFixture();
    try {
      blocked.write(epicFields(), EPIC_BODY);
      blocked.write(spikeFields('a', { blocked_by: 'build-it' }), SPIKE_BODY);
      blocked.write(buildIssue(), ['## Summary', 'Build the thing.', '']);

      const res = runCli(['epics', 'frontier', 'foo'], { cwd: blocked.fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      strictEqual(res.stdout, '', `an open build issue blocks the spike (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      blocked.fx.cleanup();
    }

    const settled = corpusFixture();
    try {
      settled.write(epicFields(), EPIC_BODY);
      settled.write(spikeFields('a', { blocked_by: 'build-it' }), SPIKE_BODY);
      settled.write(buildIssue({ status: 'fixed' }),
        ['## Summary', 'Build the thing.', '', '## Resolution', 'Built.', '']);

      const res = runCli(['epics', 'frontier', 'foo'], { cwd: settled.fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      strictEqual(res.stdout, 'a\n',
        `the build issue settled, so the spike is workable (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      settled.fx.cleanup();
    }
  });

  await runTest('TF7: silent choice #14 -- resolved spikes, other epics\' spikes, and non-spike members are all excluded', () => {
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      write(epicFields({ slug: 'bar' }), EPIC_BODY);
      write(spikeFields('ready-one'), SPIKE_BODY);
      write(spikeFields('already-done', { status: 'fixed' }), [...SPIKE_BODY, '## Resolution', 'Settled.', '']);
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

  // -------------------------------------------------------------------------
  // TG — `epics graph`
  // -------------------------------------------------------------------------

  const buildFields = (slug, over = {}) => ({ ...GOLDEN_ISSUE_FIELDS, slug, epic: 'foo', ...over });
  const CAPTURE_BODY = ['## Summary', 'Build work.', ''];
  const RESOLVED_BODY = ['## Summary', 'Build work.', '', '## Resolution', 'Done.', ''];

  // A6's corpus: epic foo, two spikes and three build issues in a chain.
  function graphCorpus() {
    const ctx = corpusFixture();
    ctx.write(epicFields(), EPIC_BODY);
    ctx.write(spikeFields('spike-one'), SPIKE_BODY);
    ctx.write(spikeFields('spike-two', { blocked_by: 'spike-one' }), SPIKE_BODY);
    ctx.write(buildFields('build-one', { status: 'fixed' }), RESOLVED_BODY);
    ctx.write(buildFields('build-two', { blocked_by: 'build-one' }), CAPTURE_BODY);
    ctx.write(buildFields('build-three', { blocked_by: 'build-two' }), CAPTURE_BODY);
    return ctx;
  }

  await runTest('TG1: A6 -- `epics graph` prints the epic line, the decisions/build split in layers, and progress', () => {
    const { fx } = graphCorpus();
    try {
      const res = runCli(['epics', 'graph', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      const out = res.stdout;
      ok(out.startsWith('foo [open] Example issue title\n'), `the epic's own line leads (got: ${JSON.stringify(out.slice(0, 80))})`);
      ok(out.includes('blocked_by: none'), `an epic with no blockers says none (got: ${JSON.stringify(out)})`);
      ok(out.includes('decisions:') && out.includes('build:'), `both sections print (got: ${JSON.stringify(out)})`);

      const decisions = out.slice(out.indexOf('decisions:'), out.indexOf('build:'));
      ok(/layer 0:\n\s+spike-one \[open\]/.test(decisions), `an unblocked spike is layer 0 (got: ${JSON.stringify(decisions)})`);
      ok(/layer 1:\n\s+spike-two \[open\]/.test(decisions), `a spike behind an open spike is layer 1 (got: ${JSON.stringify(decisions)})`);

      const build = out.slice(out.indexOf('build:'));
      // build-one is settled, so it blocks nothing: build-two is workable now
      // and build-three sits one layer behind it.
      ok(/layer 0:\n(\s+build-\w+ .*\n)*\s+build-two \[open\]/.test(build), `build-two is layer 0 (got: ${JSON.stringify(build)})`);
      ok(/layer 1:\n\s+build-three \[open\]/.test(build), `build-three is layer 1 (got: ${JSON.stringify(build)})`);
      ok(out.includes('kind: issue'), `a build row carries its kind (got: ${JSON.stringify(build)})`);
      ok(out.trimEnd().endsWith('progress: 1/5 members closed'), `the progress line closes the report (got: ${JSON.stringify(out)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TG2: A6 -- --json emits the C11 shape and parses; --open-only hides the settled members', () => {
    const { fx } = graphCorpus();
    try {
      const res = runCli(['epics', 'graph', 'foo', '--json'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      const report = JSON.parse(res.stdout);
      strictEqual(report.epic.slug, 'foo');
      strictEqual(report.epic.status, 'open');
      strictEqual(report.epic.title, 'Example issue title');
      strictEqual(report.decisions[0][0].slug, 'spike-one');
      strictEqual(report.decisions[0][0].spike_type, 'task');
      strictEqual(report.decisions[1][0].slug, 'spike-two');
      strictEqual(report.build[1][0].kind, 'issue');
      ok(report.build[0].some(m => m.slug === 'build-one'), 'a settled member still shows by default');
      strictEqual(report.progress.closed, 1);
      strictEqual(report.progress.total, 5);
      ok(Array.isArray(report.external) && Array.isArray(report.cycles) && Array.isArray(report.unresolvable));

      const openOnly = JSON.parse(runCli(['epics', 'graph', 'foo', '--open-only', '--json'], { cwd: fx.projectRoot }).stdout);
      ok(!openOnly.build.flat().some(m => m.slug === 'build-one'), 'the settled member is hidden');
      ok(openOnly.build.flat().some(m => m.slug === 'build-two'), 'open members stay');
      strictEqual(openOnly.progress.total, 5, 'progress still counts the whole membership');
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TG2a: --open-only through the TEXT formatter -- the form a person actually types', () => {
    // TG2 exercises --open-only only alongside --json, so the text path it was
    // built for is unpinned and a formatter change breaks it silently. This
    // corpus settles every spike, so hiding the closed members empties
    // `decisions` and the `(none)` line has to carry the split.
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      write(spikeFields('spike-done', { status: 'settled' }), [...SPIKE_BODY, '## Resolution', 'Decided.', '']);
      write(buildFields('build-done', { status: 'fixed' }), RESOLVED_BODY);
      write(buildFields('build-open'), CAPTURE_BODY);

      const res = runCli(['epics', 'graph', 'foo', '--open-only'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      const out = res.stdout;
      strictEqual(out.includes('spike-done'), false, `the settled spike is hidden (got: ${JSON.stringify(out)})`);
      strictEqual(out.includes('build-done'), false, `and so is the settled build issue (got: ${JSON.stringify(out)})`);
      ok(out.includes('build-open'), `the open member stays (got: ${JSON.stringify(out)})`);
      ok(/decisions:\n\s+\(none\)/.test(out), `an emptied section still prints, as (none) (got: ${JSON.stringify(out)})`);
      // The same subtlety TG2 pins on the JSON side: --open-only is a
      // presentation filter, and an epic's progress is its whole membership or
      // it is not progress.
      ok(out.trimEnd().endsWith('progress: 2/3 members closed'),
        `progress still counts every member (got: ${JSON.stringify(out)})`);

      // Without the flag all three show, so the assertions above are about the
      // flag and not about the corpus.
      const all = runCli(['epics', 'graph', 'foo'], { cwd: fx.projectRoot }).stdout;
      ok(all.includes('spike-done') && all.includes('build-done') && all.includes('build-open'));
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TG2b: a MEMBER may name a whole epic as its blocker, and is layered behind it', () => {
    // Decision 11: a member that truly waits on another epic carries that edge
    // itself. TG6 only ever shows the epic NODE blocked by an epic, so the
    // member-to-epic direction — the one decision 11 is actually about — was
    // built by nothing.
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      write(epicFields({ slug: 'other-epic' }), EPIC_BODY);
      write(buildFields('waits-on-epic', { blocked_by: 'other-epic' }), CAPTURE_BODY);
      write(buildFields('waits-on-member', { blocked_by: 'waits-on-epic' }), CAPTURE_BODY);

      const report = JSON.parse(runCli(['epics', 'graph', 'foo', '--json'], { cwd: fx.projectRoot }).stdout);
      // The blocking epic is not a member of foo, so it belongs in `external`
      // with its own status — never silently dropped, which is what would make
      // the member below it look workable.
      deepStrictEqual(report.external, [{ slug: 'other-epic', status: 'open', epic: [] }],
        `the blocking epic is an external blocker (got: ${JSON.stringify(report.external)})`);
      deepStrictEqual(report.unresolvable, [], 'an epic is an ordinary blocker target, not a dangling one');
      // An open blocker outside the epic has no layer of its own and counts as
      // layer 0, so the member waiting on it is layer 1 — "not workable now",
      // which is the whole point. Layer 0 is therefore EMPTY here: nothing in
      // this epic can be started until another epic closes.
      deepStrictEqual(report.build[0], [], `layer 0 is empty (got: ${JSON.stringify(report.build)})`);
      strictEqual(report.build[1].map((m) => m.slug).join(','), 'waits-on-epic',
        `a member behind an open EPIC sits one layer out (got: ${JSON.stringify(report.build)})`);
      strictEqual(report.build[2].map((m) => m.slug).join(','), 'waits-on-member',
        'and the member behind THAT sits one layer further still');

      // Decision 10: an epic blocker is satisfied by the epic's own status, so
      // closing it by hand moves the member up.
      write(epicFields({ slug: 'other-epic', status: 'settled' }), [...EPIC_BODY, '## Resolution', 'Shipped.', '']);
      const after = JSON.parse(runCli(['epics', 'graph', 'foo', '--json'], { cwd: fx.projectRoot }).stdout);
      strictEqual(after.external[0].status, 'settled');
      strictEqual(after.build[0].map((m) => m.slug).join(','), 'waits-on-epic',
        'a settled epic blocks nothing');
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TG3: A7 -- cycles and external blockers print under their own sections, still exit 0', () => {
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      write(epicFields({ slug: 'baz' }), EPIC_BODY);
      write(buildFields('over-there', { epic: 'baz' }), CAPTURE_BODY);
      write(buildFields('needs-baz', { blocked_by: 'over-there' }), CAPTURE_BODY);
      write(buildFields('cyc-a', { blocked_by: 'cyc-b' }), CAPTURE_BODY);
      write(buildFields('cyc-b', { blocked_by: 'cyc-a' }), CAPTURE_BODY);

      const res = runCli(['epics', 'graph', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `a cycle is a report, not an error here (got: ${res.exitCode}, stderr: ${res.stderr})`);
      ok(res.stdout.includes('external blockers:'), `expected the section (got: ${JSON.stringify(res.stdout)})`);
      ok(res.stdout.includes('over-there [open]  epic: baz'), `the external blocker names its own epic (got: ${JSON.stringify(res.stdout)})`);
      ok(res.stdout.includes('cycles:'), `expected the section (got: ${JSON.stringify(res.stdout)})`);
      ok(/cyc-a -> cyc-b -> cyc-a/.test(res.stdout), `the cycle is spelled out (got: ${JSON.stringify(res.stdout)})`);
      ok(!/layer \d+:\n\s+cyc-a/.test(res.stdout), 'a member in a cycle gets no layer');
      ok(res.stdout.includes('progress: 0/3 members closed'), `every member is still counted (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TG4: an unresolvable blocker gets its own section rather than a phantom layer', () => {
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      write(buildFields('build-one', { blocked_by: 'no-such-slug' }), CAPTURE_BODY);

      const res = runCli(['epics', 'graph', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      ok(res.stdout.includes('unresolvable blockers:'), `expected the section (got: ${JSON.stringify(res.stdout)})`);
      ok(res.stdout.includes('build-one -> no-such-slug'), `the edge is named (got: ${JSON.stringify(res.stdout)})`);
      ok(res.stdout.includes('decisions:\n  (none)'), `an empty decisions section still prints (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TG5: an epic with no members exits 0; an unknown epic exits 1 on stderr', () => {
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);

      const empty = runCli(['epics', 'graph', 'foo'], { cwd: fx.projectRoot });
      strictEqual(empty.exitCode, 0, `an epic with no members is a clean state (got: ${empty.exitCode}, stderr: ${empty.stderr})`);
      ok(empty.stdout.includes('progress: 0/0 members closed'), `zero of zero (got: ${JSON.stringify(empty.stdout)})`);

      const missing = runCli(['epics', 'graph', 'no-such-epic'], { cwd: fx.projectRoot });
      strictEqual(missing.exitCode, 1, `expected a user error (got: ${missing.exitCode})`);
      strictEqual(missing.stdout, '', `nothing on stdout (got: ${JSON.stringify(missing.stdout)})`);
      ok(missing.stderr.startsWith('ERROR: no such epic: no-such-epic'), `the frontier's error shape (got: ${JSON.stringify(missing.stderr)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TG6: an epic\'s own blocked_by prints with each blocker\'s status', () => {
    const { fx, write } = corpusFixture();
    try {
      write(epicFields({ blocked_by: 'baz,gone' }), EPIC_BODY);
      write(epicFields({ slug: 'baz', status: 'fixed' }), [...EPIC_BODY, '## Resolution', 'Shipped.', '']);

      const res = runCli(['epics', 'graph', 'foo'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      ok(res.stdout.includes('blocked_by: baz [fixed], gone [unresolvable]'),
        `an epic-to-epic edge and a dangling one (got: ${JSON.stringify(res.stdout)})`);
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TG7: `graph --help` prints usage and exits 0; an unknown flag exits 1', () => {
    const { fx } = graphCorpus();
    try {
      for (const verb of ['graph', 'frontier']) {
        const help = runCli(['epics', verb, '--help'], { cwd: fx.projectRoot });
        strictEqual(help.exitCode, 0, `${verb} --help exits 0 (got: ${help.exitCode}, stderr: ${help.stderr})`);
        ok(help.stdout.includes('Usage: scratch-memory epics'), `${verb} --help prints usage (got: ${JSON.stringify(help.stdout)})`);
      }

      const bad = runCli(['epics', 'graph', 'foo', '--nope'], { cwd: fx.projectRoot });
      strictEqual(bad.exitCode, 1, `an unknown option is a user error (got: ${bad.exitCode})`);
      ok(bad.stderr.includes('ERROR: unknown option: --nope'), `named on stderr (got: ${JSON.stringify(bad.stderr)})`);

      const frontierFlag = runCli(['epics', 'frontier', 'foo', '--json'], { cwd: fx.projectRoot });
      strictEqual(frontierFlag.exitCode, 1, 'frontier declares no flags, so --json stays an unknown option');
    } finally {
      fx.cleanup();
    }
  });

  await runTest('TG8: a status outside the enum is neither open nor closed, and fails closed', () => {
    const { fx, write } = corpusFixture();
    try {
      write(epicFields(), EPIC_BODY);
      // Not one of the seven. A legacy file predating the enum, or a hand-typed
      // `status:`. `!== 'open'` would read it as closed, count it as done and
      // call the member waiting behind it workable now; membership in the six
      // reads it as neither, which is the direction frontierSpikes already
      // fails in over the same corpus.
      write(buildFields('build-odd', { status: 'half-done' }), CAPTURE_BODY);
      write(buildFields('build-behind', { blocked_by: 'build-odd' }), CAPTURE_BODY);

      const res = runCli(['epics', 'graph', 'foo', '--json'], { cwd: fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      const report = JSON.parse(res.stdout);
      deepStrictEqual(report.progress, { closed: 0, total: 2 },
        `an unrecognized status is not closed (got: ${JSON.stringify(report.progress)})`);
      strictEqual(report.build[0].map((m) => m.slug).join(','), 'build-odd',
        `only the odd member is workable now (got: ${JSON.stringify(report.build[0])})`);
      strictEqual(report.build[1].map((m) => m.slug).join(','), 'build-behind',
        `the member behind it is still blocked (got: ${JSON.stringify(report.build[1])})`);
    } finally {
      fx.cleanup();
    }
  });

  // The literal filter `brainstorming/ticket-recovery.md` gives step 1 to recover a ticket
  // nobody carried across the session gap. Restated here rather than imported
  // because its home is a shell one-liner in prose -- so a change to `build`'s
  // layered shape, or to what counts as open, breaks this test instead of the
  // workflow. `.flat()` is load-bearing: `build` is layers, not members.
  const recoverTickets = (report) =>
    report.build.flat().filter((m) => m.status === 'open').map((m) => `scratch/issues/${m.slug}.md`);

  await runTest('TG9: the ticket recovery lookup over --json, all three branches', () => {
    // none — the epic has closed every build issue it ever filed, so there is
    // no ticket this design could be closing and step 2 drops the line.
    const none = corpusFixture();
    try {
      none.write(epicFields(), EPIC_BODY);
      none.write(buildFields('build-done', { status: 'fixed' }), RESOLVED_BODY);
      const res = runCli(['epics', 'graph', 'foo', '--json'], { cwd: none.fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      deepStrictEqual(recoverTickets(JSON.parse(res.stdout)), [],
        'a fully closed epic recovers nothing');
    } finally {
      none.fx.cleanup();
    }

    // one — the unambiguous branch, and the only one step 2 may write without
    // asking. The path comes back repo-relative, which is the form the
    // **Ticket:** line carries.
    const one = corpusFixture();
    try {
      one.write(epicFields(), EPIC_BODY);
      one.write(buildFields('build-open'), CAPTURE_BODY);
      one.write(buildFields('build-shipped', { status: 'fixed' }), RESOLVED_BODY);
      const res = runCli(['epics', 'graph', 'foo', '--json'], { cwd: one.fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      deepStrictEqual(recoverTickets(JSON.parse(res.stdout)), ['scratch/issues/build-open.md'],
        'exactly the open build issue, and closed members excluded');
    } finally {
      one.fx.cleanup();
    }

    // two or more — the branch that must ASK. The members are layered here
    // (one blocks the other), so a lookup reading only `build[0]` would find a
    // single match and silently pick it; `.flat()` is what makes this ambiguous.
    const several = corpusFixture();
    try {
      several.write(epicFields(), EPIC_BODY);
      several.write(buildFields('build-first'), CAPTURE_BODY);
      several.write(buildFields('build-second', { blocked_by: 'build-first' }), CAPTURE_BODY);
      const res = runCli(['epics', 'graph', 'foo', '--json'], { cwd: several.fx.projectRoot });
      strictEqual(res.exitCode, 0, `expected exit 0 (got: ${res.exitCode}, stderr: ${res.stderr})`);
      const report = JSON.parse(res.stdout);
      ok(report.build.length > 1, `the corpus really is layered (got ${report.build.length} layer(s))`);
      deepStrictEqual(recoverTickets(report),
        ['scratch/issues/build-first.md', 'scratch/issues/build-second.md'],
        'both layers contribute, so the result is ambiguous and step 2 asks');
      const members = report.build.flat();
      ok(members.every((m) => !('title' in m)),
        'and no member carries a title, which is why the lookup cannot rank them');
    } finally {
      several.fx.cleanup();
    }
  });

  await runTest('TG10: 6b extracts every bare path from each **Ticket:** line shape', () => {
    // /implement-code 6b greps the line and then extracts. The line-matching
    // grep returns backticks and, on an idea.md started from the template and
    // never edited, a trailing {…} gloss -- so pasting the line closes nothing.
    const EXTRACT = String.raw`grep -o 'scratch/issues/[^` + '`' + String.raw`]*\.md'`;
    const run = (file) => spawnSync('sh', ['-c',
      String.raw`grep -m1 '^\*\*Ticket:\*\*' "$1" | ` + EXTRACT, 'sh', file],
      { encoding: 'utf-8' });

    // The instruction and the test must not drift apart: 6b is where this
    // pipeline lives, and an edit there should fail here rather than in a build.
    const cmdSrc = readFileSync(join(__dirname, '..', '..', 'implement-code-methodology', 'wrap.md'), 'utf-8');
    ok(cmdSrc.includes(String.raw`grep -m1 '^\*\*Ticket:\*\*'`) && cmdSrc.includes(EXTRACT),
      'implement-code-methodology wrap.md 6b still carries this exact pipeline');

    const fx = createAnchorFixture();
    try {
      // shape 1 — a real line, as /brainstorming writes it.
      const real = join(fx.projectRoot, 'idea-real.md');
      writeFileSync(real, [
        '**History:** [`changelog.md`](./changelog.md) — every ruling lives there.',
        '**Ticket:** `scratch/issues/build-the-thing.md`',
        '',
        '## Problem',
      ].join('\n'), 'utf-8');
      strictEqual(run(real).stdout.trim(), 'scratch/issues/build-the-thing.md',
        'a written line yields the bare path');

      // shape 2 — the untouched template line, gloss and all, read from disk
      // rather than restated, so the template's real wording is what is pinned.
      const tplSrc = readFileSync(
        join(__dirname, '..', '..', 'brainstorming', 'idea-template.md'), 'utf-8');
      const tplLine = tplSrc.split('\n').find((l) => l.startsWith('**Ticket:**'));
      ok(tplLine, 'idea-template.md still carries a **Ticket:** line');
      ok(tplLine.includes('`') && tplLine.includes('{'),
        `the template line really does carry backticks and a gloss (got: ${tplLine})`);
      const tpl = join(fx.projectRoot, 'idea-template-copy.md');
      writeFileSync(tpl, `${tplLine}\n`, 'utf-8');
      const out = run(tpl).stdout.trim();
      strictEqual(out, 'scratch/issues/{slug}.md', 'the template line yields the bare path too');
      ok(!out.includes('`') && !out.includes('drop this whole line'),
        `no backtick and no gloss survive the extraction (got: ${JSON.stringify(out)})`);

      // shape 3 — a multi-ticket line: the build's own first, then the riders.
      // 6b must print every path in line order, and /close-issue's Source grep
      // must find this idea.md from a rider's slug, not only the first.
      const multi = join(fx.projectRoot, 'idea-multi.md');
      writeFileSync(multi, [
        '**History:** none',
        '**Ticket:** `scratch/issues/build-the-thing.md`, `scratch/issues/rider-one.md`, `scratch/issues/rider-two.md`',
        '',
        '## Problem',
      ].join('\n'), 'utf-8');
      strictEqual(run(multi).stdout.trim(),
        'scratch/issues/build-the-thing.md\nscratch/issues/rider-one.md\nscratch/issues/rider-two.md',
        'a multi-path line yields every path, the build\'s own first');
      const SOURCE = String.raw`grep -l '^\*\*Ticket:\*\*.*scratch/issues/{slug}\.md'`;
      const groomSrc = readFileSync(
        join(__dirname, '..', '..', 'issue-groom-methodology', 'SKILL.md'), 'utf-8');
      ok(groomSrc.includes(SOURCE), 'issue-groom-methodology § Entry: /close-issue still carries this Source grep');
      const source = (slug) => spawnSync('sh', ['-c',
        SOURCE.replace('{slug}', slug) + ' "$1"', 'sh', multi], { encoding: 'utf-8' });
      strictEqual(source('rider-one').stdout.trim(), multi, 'the Source grep finds the idea.md from a rider slug');
      strictEqual(source('not-on-the-line').stdout.trim(), '', 'and finds nothing for a slug not on the line');

      // and the honest null: no line, no output, which 6b reads as "no ticket".
      const bare = join(fx.projectRoot, 'idea-none.md');
      writeFileSync(bare, '**History:** none\n\n## Problem\n', 'utf-8');
      strictEqual(run(bare).stdout.trim(), '', 'an idea.md with no ticket extracts nothing');
    } finally {
      fx.cleanup();
    }
  });

  process.stdout.write(`${passCount} passed, ${failCount} failed\n`);
  process.exit(failCount === 0 ? 0 : 1);
})();
