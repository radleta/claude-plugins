#!/usr/bin/env node
// test-issue-cli.mjs — Tests for the `issue` CLI verbs (issues.mjs), through the real
// scratch-memory.mjs dispatcher: `issue write`'s guards, two-root context and stdin contract
// (IC1-IC8), and `issue close`, `mark-groomed` and `mark-refreshed` (IC9-IC15).
// The MCP write_issue tool is test-write-issue.mjs.
// Usage: node test-issue-cli.mjs   (exit 0 on all-pass)

import { deepStrictEqual, strictEqual, ok } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, existsSync, realpathSync, symlinkSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { createFixture } from './test-fixtures.mjs';
import { CLI_PATH } from './test-driver.mjs';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('Usage: node test-issue-cli.mjs\n\nRuns issue CLI verb tests (IC group). Exit 0 on all-pass, 1 otherwise.\n');
  process.exit(0);
}
if (argv.length > 0) {
  process.stderr.write(`Unexpected argument: ${argv[0]}\n`);
  process.exit(1);
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

const cfgDir = mkdtempSync(join(tmpdir(), 'smcp-issue-cfg-'));
const env = { ...process.env, SCRATCH_MEMORY_CONFIG_DIR: cfgDir };

function cli(args, { cwd, input }) {
  const r = spawnSync('node', [CLI_PATH, ...args], { cwd, env, input, encoding: 'utf-8' });
  return { stdout: r.stdout, stderr: r.stderr, exitCode: r.status };
}

function repoWithCorpus() {
  const fx = createFixture();
  mkdirSync(join(fx.projectRoot, 'scratch', 'issues'), { recursive: true });
  return fx;
}

function frontmatter(content) {
  const fm = content.split('---')[1];
  return Object.fromEntries(fm.trim().split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));
}

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
const issueFiles = (root) => (existsSync(join(root, 'scratch', 'issues')) ? readdirSync(join(root, 'scratch', 'issues')) : []);

const PAYLOAD = JSON.stringify({
  kind: 'issue',
  title: 'Upstream skill misroutes wiki pages',
  summary: 'A user-scope page lands in the wrong worktree.',
  intent: 'Filing from another repo.',
  related: 'scratch/issues/some-other.md',
});

await runTest('IC1: a registered repo receives the issue, with the calling repo as context and a Filed into line', () => {
  const first = repoWithCorpus();
  const second = createFixture();
  execFileSync('git', ['checkout', '-q', '-b', 'feature-x'], { cwd: second.projectRoot });
  const add = cli(['repos', 'add', 'first', first.projectRoot, '--user', '--accepts', 'issues'], { cwd: second.projectRoot });
  strictEqual(add.exitCode, 0, add.stderr);
  const target = JSON.parse(cli(['repos', 'resolve', 'first', '--json'], { cwd: second.projectRoot }).stdout).path;

  const r = cli(['issue', 'write', '--project-root', target], { cwd: second.projectRoot, input: PAYLOAD });
  strictEqual(r.exitCode, 0, r.stderr);
  const path = r.stdout.trim();
  strictEqual(r.stdout, `${path}\n`);
  strictEqual(path, join(realpathSync(first.projectRoot), 'scratch', 'issues', 'upstream-skill-misroutes-wiki-pages.md'));
  strictEqual(r.stderr, `wrote into ${realpathSync(first.projectRoot)}\n`);

  const content = readFileSync(path, 'utf-8');
  const fm = frontmatter(content);
  strictEqual(fm.branch, 'feature-x');
  strictEqual(fm.commit, git(second.projectRoot, 'rev-parse', '--short', 'HEAD'));
  strictEqual(fm.repo, realpathSync(second.projectRoot).split('/').pop());
  ok(content.includes(`- **Working directory:** ${realpathSync(second.projectRoot)}\n`), content);
  ok(content.includes(`- **Filed into:** ${realpathSync(first.projectRoot)}\n`), content);
  ok(content.includes('## Related\nscratch/issues/some-other.md\n'), content);
  deepStrictEqual(issueFiles(second.projectRoot), []);
  first.cleanup(); second.cleanup();
});

await runTest('IC2: a target without scratch/issues/, a subdirectory, a non-directory and an escaping slug each exit 1 and create nothing', () => {
  const noCorpus = createFixture();
  const withCorpus = repoWithCorpus();
  const caller = createFixture();
  mkdirSync(join(withCorpus.projectRoot, 'sub', 'scratch', 'issues'), { recursive: true });
  const cases = [
    [['--project-root', noCorpus.projectRoot], PAYLOAD],
    [['--project-root', join(withCorpus.projectRoot, 'sub')], PAYLOAD],
    [['--project-root', join(withCorpus.projectRoot, 'missing')], PAYLOAD],
    [['--project-root', withCorpus.projectRoot], JSON.stringify({ kind: 'issue', title: 'Escape', slug_override: '../../escape' })],
    [['--project-root', withCorpus.projectRoot], JSON.stringify({ kind: 'issue', title: 'Escape', slug_override: 'a/b' })],
  ];
  for (const [args, input] of cases) {
    const r = cli(['issue', 'write', ...args], { cwd: caller.projectRoot, input });
    strictEqual(r.exitCode, 1, `${args.join(' ')} ${input} → ${r.exitCode} ${r.stderr}`);
    strictEqual(r.stdout, '');
  }
  strictEqual(existsSync(join(noCorpus.projectRoot, 'scratch')), false);
  deepStrictEqual(issueFiles(withCorpus.projectRoot), []);
  deepStrictEqual(readdirSync(join(withCorpus.projectRoot, 'sub', 'scratch', 'issues')), []);
  noCorpus.cleanup(); withCorpus.cleanup(); caller.cleanup();
});

await runTest('IC3: a symlinked scratch/issues/ pointing out of the target exits 1 and writes nothing through it', () => {
  const target = createFixture();
  const outside = mkdtempSync(join(tmpdir(), 'smcp-outside-'));
  mkdirSync(join(target.projectRoot, 'scratch'));
  symlinkSync(outside, join(target.projectRoot, 'scratch', 'issues'));
  const r = cli(['issue', 'write', '--project-root', target.projectRoot], { cwd: target.projectRoot, input: PAYLOAD });
  strictEqual(r.exitCode, 1, r.stderr);
  ok(r.stderr.includes('escapes'), r.stderr);
  deepStrictEqual(readdirSync(outside), []);
  rmSync(outside, { recursive: true, force: true });
  target.cleanup();
});

await runTest('IC4: stdin contract — empty input, non-JSON, an array, an unknown key and a bad kind exit 1', () => {
  const fx = repoWithCorpus();
  for (const input of ['', '   ', 'not json', '[]', JSON.stringify({ kind: 'issue', title: 'x', severity: 'high' }), JSON.stringify({ kind: 'bug', title: 'x' })]) {
    const r = cli(['issue', 'write'], { cwd: fx.projectRoot, input });
    strictEqual(r.exitCode, 1, `${input} → ${r.exitCode} ${r.stderr}`);
  }
  const unknown = cli(['issue', 'write'], { cwd: fx.projectRoot, input: JSON.stringify({ kind: 'issue', title: 'x', severity: 'high' }) });
  ok(unknown.stderr.includes('severity'), unknown.stderr);
  const empty = cli(['issue', 'write'], { cwd: fx.projectRoot, input: '' });
  ok(empty.stderr.includes('No input on stdin'), empty.stderr);
  deepStrictEqual(issueFiles(fx.projectRoot), []);
  fx.cleanup();
});

await runTest('IC5: with no --project-root the current top level is target and context, from a subdirectory, with no Filed into line', () => {
  const fx = repoWithCorpus();
  mkdirSync(join(fx.projectRoot, 'deep', 'er'), { recursive: true });
  const r = cli(['issue', 'write', '--json'], { cwd: join(fx.projectRoot, 'deep', 'er'), input: JSON.stringify({ kind: 'idea', title: 'Local idea', slug_override: 'local-idea' }) });
  strictEqual(r.exitCode, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  deepStrictEqual(Object.keys(result).sort(), ['collision_note', 'kind', 'path', 'title']);
  strictEqual(result.path, join(realpathSync(fx.projectRoot), 'scratch', 'issues', 'local-idea.md'));
  const content = readFileSync(result.path, 'utf-8');
  ok(!content.includes('Filed into'), content);
  // A second write collides and says so.
  const again = JSON.parse(cli(['issue', 'write', '--json'], { cwd: fx.projectRoot, input: JSON.stringify({ kind: 'idea', title: 'Local idea', slug_override: 'local-idea' }) }).stdout);
  ok(again.path.endsWith('local-idea-2.md'));
  ok(again.collision_note.includes('local-idea.md'));
  fx.cleanup();
});

await runTest('IC6: outside a git repository with no --project-root exits 1; unknown flags and subcommands exit 1; --help exits 0', () => {
  const plain = mkdtempSync(join(tmpdir(), 'smcp-plain-'));
  strictEqual(cli(['issue', 'write'], { cwd: plain, input: PAYLOAD }).exitCode, 1);
  strictEqual(cli(['issue', 'write', '--bogus'], { cwd: plain, input: PAYLOAD }).exitCode, 1);
  strictEqual(cli(['issue', 'read'], { cwd: plain, input: '' }).exitCode, 1);
  const h = cli(['issue', '--help'], { cwd: plain, input: '' });
  strictEqual(h.exitCode, 0);
  ok(h.stdout.includes('related'));
  rmSync(plain, { recursive: true, force: true });
});

await runTest('IC8: --repo <name> files into the registered repo like --project-root; an unknown name or both flags exit 1', () => {
  const first = repoWithCorpus();
  const second = createFixture();
  strictEqual(cli(['repos', 'add', 'byname', first.projectRoot, '--user', '--accepts', 'issues'], { cwd: second.projectRoot }).exitCode, 0);
  const r = cli(['issue', 'write', '--repo', 'byname'], { cwd: second.projectRoot, input: PAYLOAD });
  strictEqual(r.exitCode, 0, r.stderr);
  strictEqual(r.stdout.trim(), join(realpathSync(first.projectRoot), 'scratch', 'issues', 'upstream-skill-misroutes-wiki-pages.md'));
  ok(readFileSync(r.stdout.trim(), 'utf-8').includes(`- **Filed into:** ${realpathSync(first.projectRoot)}\n`));
  const unknown = cli(['issue', 'write', '--repo', 'no-such-repo'], { cwd: second.projectRoot, input: PAYLOAD });
  strictEqual(unknown.exitCode, 1);
  ok(unknown.stderr.includes('unknown repo'), unknown.stderr);
  strictEqual(cli(['issue', 'write', '--repo', 'byname', '--project-root', first.projectRoot], { cwd: second.projectRoot, input: PAYLOAD }).exitCode, 1);
  deepStrictEqual(issueFiles(first.projectRoot), ['upstream-skill-misroutes-wiki-pages.md']);
  first.cleanup(); second.cleanup();
});

// --- issue close / mark-groomed / mark-refreshed ---------------------------

const today = () => new Date().toISOString().slice(0, 10);

// A repo holding one issue per slug, written by `issue write`, so each starts
// `open` with `_Not captured._` Notes. `extra` is appended to every body.
function closeFixture(slugs, { role, extra = '' } = {}) {
  const fx = repoWithCorpus();
  const paths = {};
  for (const slug of slugs) {
    const fields = { kind: 'issue', title: `Issue ${slug}`, slug_override: slug, summary: 'Old summary.' };
    if (role) fields.role = role;
    const r = cli(['issue', 'write'], { cwd: fx.projectRoot, input: JSON.stringify(fields) });
    strictEqual(r.exitCode, 0, r.stderr);
    paths[slug] = r.stdout.trim();
    if (extra) writeFileSync(paths[slug], readFileSync(paths[slug], 'utf-8') + extra, 'utf-8');
  }
  const file = (name, text) => { const p = join(fx.projectRoot, name); writeFileSync(p, text, 'utf-8'); return p; };
  return { fx, paths, file };
}

const lintCorpus = (root) => cli(['tasks', 'lint', 'scratch/issues/'], { cwd: root });

await runTest('IC9: issue close writes Summary, a dated Resolution at the end and the status in one call, echoes the Summary, and the corpus lints clean', () => {
  const { fx, paths, file } = closeFixture(['alpha']);
  const before = readFileSync(paths.alpha, 'utf-8');
  const r = cli(['issue', 'close', 'alpha', '--status', 'fixed', '--resolution-file', file('r.md', 'Fixed by the build.\n'), '--summary-file', file('s.md', 'New summary.\n')], { cwd: fx.projectRoot });
  strictEqual(r.exitCode, 0, r.stderr);
  strictEqual(r.stdout, `${paths.alpha}\n## Summary\nNew summary.\n`);
  const after = readFileSync(paths.alpha, 'utf-8');
  ok(after.includes('\nstatus: fixed\n') && !after.includes('status: open'), after);
  ok(after.includes('## Summary\nNew summary.\n\n## Context') && !after.includes('Old summary.'), after);
  ok(after.endsWith(`\n## Notes\n_Not captured._\n\n## Resolution (${today()})\n\nFixed by the build.\n`), after);
  for (const key of ['commit', 'captured', 'working_tree']) {
    const line = before.split('\n').find((l) => l.startsWith(`${key}:`));
    ok(after.includes(`\n${line}\n`), `${key}: unchanged`);
  }
  const lint = lintCorpus(fx.projectRoot);
  strictEqual(lint.exitCode, 0, lint.stdout + lint.stderr);
  deepStrictEqual(issueFiles(fx.projectRoot), ['alpha.md'], 'no tmp residue');
  fx.cleanup();
});

await runTest('IC10: --resolution-file - reads stdin and yields the same file as a path', () => {
  const { fx, paths, file } = closeFixture(['alpha']);
  const twin = join(fx.projectRoot, 'scratch', 'issues', 'beta.md');
  writeFileSync(twin, readFileSync(paths.alpha, 'utf-8'), 'utf-8');
  const viaFile = cli(['issue', 'close', 'alpha', '--status', 'fixed', '--resolution-file', file('r.md', 'Done.\n'), '--summary-file', file('s.md', 'S.\n')], { cwd: fx.projectRoot });
  const viaStdin = cli(['issue', 'close', 'beta', '--status', 'fixed', '--resolution-file', '-', '--summary-file', file('s.md', 'S.\n')], { cwd: fx.projectRoot, input: 'Done.\n' });
  strictEqual(viaFile.exitCode, 0, viaFile.stderr);
  strictEqual(viaStdin.exitCode, 0, viaStdin.stderr);
  strictEqual(readFileSync(twin, 'utf-8'), readFileSync(paths.alpha, 'utf-8'));
  fx.cleanup();
});

await runTest('IC11: an epic settles and lints clean; an open issue defers with a Resolution; a fixed issue exits 1 naming open|deferred, unchanged', () => {
  const epic = closeFixture(['the-epic'], { role: 'epic', extra: '\n## Destination\nWhere it ends.\n' });
  const r = cli(['issue', 'close', 'the-epic', '--status', 'settled', '--resolution-file', epic.file('r.md', 'Settled.')], { cwd: epic.fx.projectRoot });
  strictEqual(r.exitCode, 0, r.stderr);
  strictEqual(r.stdout, `${epic.paths['the-epic']}\n## Summary\nOld summary.\n`);
  ok(readFileSync(epic.paths['the-epic'], 'utf-8').includes('\nstatus: settled\n'));
  const lint = lintCorpus(epic.fx.projectRoot);
  strictEqual(lint.exitCode, 0, lint.stdout + lint.stderr);
  epic.fx.cleanup();

  const { fx, paths, file } = closeFixture(['later', 'done-already']);
  const d = cli(['issue', 'close', 'later', '--status', 'deferred', '--resolution-file', file('r.md', 'Not now.')], { cwd: fx.projectRoot });
  strictEqual(d.exitCode, 0, d.stderr);
  const later = readFileSync(paths.later, 'utf-8');
  ok(later.includes('\nstatus: deferred\n') && later.endsWith(`## Resolution (${today()})\n\nNot now.\n`), later);
  // A deferred issue may still close to a settled value.
  strictEqual(cli(['issue', 'close', 'later', '--status', 'wont-fix', '--resolution-file', file('r.md', 'No.')], { cwd: fx.projectRoot }).exitCode, 0);

  writeFileSync(paths['done-already'], readFileSync(paths['done-already'], 'utf-8').replace('status: open', 'status: fixed'), 'utf-8');
  const before = readFileSync(paths['done-already'], 'utf-8');
  const refused = cli(['issue', 'close', 'done-already', '--status', 'fixed', '--resolution-file', file('r.md', 'Again.')], { cwd: fx.projectRoot });
  strictEqual(refused.exitCode, 1, refused.stderr);
  ok(refused.stderr.includes('open|deferred'), refused.stderr);
  strictEqual(refused.stdout, '');
  strictEqual(readFileSync(paths['done-already'], 'utf-8'), before);
  // The status is checked before any input is read, so a bad input never hides it.
  for (const resolutionArgs of [['--resolution-file', file('e.md', '  \n')], ['--resolution-file', '-']]) {
    const masked = cli(['issue', 'close', 'done-already', '--status', 'fixed', ...resolutionArgs], { cwd: fx.projectRoot, input: '' });
    strictEqual(masked.exitCode, 1, masked.stderr);
    ok(masked.stderr.includes('open|deferred'), `the status refusal comes first (got: ${masked.stderr})`);
  }
  strictEqual(readFileSync(paths['done-already'], 'utf-8'), before);
  fx.cleanup();
});

await runTest('IC12: issue close refuses bad input with exit 1 and no write', () => {
  const { fx, paths, file } = closeFixture(['alpha']);
  const noSummary = join(fx.projectRoot, 'scratch', 'issues', 'bare.md');
  writeFileSync(noSummary, readFileSync(paths.alpha, 'utf-8').replace('## Summary\nOld summary.\n\n', ''), 'utf-8');
  const before = readFileSync(paths.alpha, 'utf-8');
  const bareBefore = readFileSync(noSummary, 'utf-8');
  const r = file('r.md', 'Body.');
  const cases = [
    [['alpha', '--status', 'open', '--resolution-file', r], 'invalid --status'],
    [['alpha', '--resolution-file', r], '--status is required'],
    [['alpha', '--status', 'fixed'], '--resolution-file is required'],
    [['alpha', '--status', 'fixed', '--resolution-file', file('e.md', '  \n')], 'is empty'],
    [['alpha', '--status', 'fixed', '--resolution-file', '-', '--summary-file', '-'], 'only one'],
    [['alpha', '--status', 'fixed', '--resolution-file', join(fx.projectRoot, 'missing.md')], 'cannot read'],
    [['no-such', '--status', 'fixed', '--resolution-file', r], 'no issue no-such'],
    [['../alpha', '--status', 'fixed', '--resolution-file', r], 'invalid slug'],
    [['bare', '--status', 'fixed', '--resolution-file', r, '--summary-file', r], 'no ## Summary'],
  ];
  for (const [args, needle] of cases) {
    const res = cli(['issue', 'close', ...args], { cwd: fx.projectRoot, input: '' });
    strictEqual(res.exitCode, 1, `${args.join(' ')} -> ${res.exitCode} ${res.stderr}`);
    ok(res.stderr.includes(needle), `${args.join(' ')}: stderr names ${needle} (got: ${res.stderr})`);
    strictEqual(res.stdout, '');
  }
  strictEqual(readFileSync(paths.alpha, 'utf-8'), before);
  strictEqual(readFileSync(noSummary, 'utf-8'), bareBefore);
  // With no ## Summary and no --summary-file, the echo says so.
  const none = cli(['issue', 'close', 'bare', '--status', 'fixed', '--resolution-file', r], { cwd: fx.projectRoot });
  strictEqual(none.exitCode, 0, none.stderr);
  strictEqual(none.stdout, `${noSummary}\n## Summary: (none)\n`);
  fx.cleanup();
});

await runTest('IC13: mark-groomed marks every named issue at the repo HEAD; mark-refreshed appends its own bullet; a marker lands inside ## Notes, before a Resolution', () => {
  const { fx, paths, file } = closeFixture(['alpha', 'beta']);
  const sha = git(fx.projectRoot, 'rev-parse', '--short', 'HEAD');
  const g = cli(['issue', 'mark-groomed', 'alpha', 'beta'], { cwd: fx.projectRoot });
  strictEqual(g.exitCode, 0, g.stderr);
  strictEqual(g.stdout, `${paths.alpha}\n${paths.beta}\n`);
  for (const p of [paths.alpha, paths.beta]) {
    ok(readFileSync(p, 'utf-8').endsWith(`\n## Notes\n- ${today()}: Groomed: ${sha}\n`), readFileSync(p, 'utf-8'));
  }
  strictEqual(cli(['issue', 'mark-refreshed', 'alpha'], { cwd: fx.projectRoot }).exitCode, 0);
  ok(readFileSync(paths.alpha, 'utf-8').endsWith(`\n## Notes\n- ${today()}: Groomed: ${sha}\n- ${today()}: Refreshed: ${sha}\n`));

  strictEqual(cli(['issue', 'close', 'beta', '--status', 'fixed', '--resolution-file', file('r.md', 'Done.')], { cwd: fx.projectRoot }).exitCode, 0);
  strictEqual(cli(['issue', 'mark-groomed', 'beta'], { cwd: fx.projectRoot }).exitCode, 0);
  const beta = readFileSync(paths.beta, 'utf-8');
  ok(beta.includes(`\n## Notes\n- ${today()}: Groomed: ${sha}\n- ${today()}: Groomed: ${sha}\n\n## Resolution (`), beta);
  const lint = lintCorpus(fx.projectRoot);
  strictEqual(lint.exitCode, 0, lint.stdout + lint.stderr);

  // No ## Notes: one is appended.
  writeFileSync(paths.alpha, readFileSync(paths.alpha, 'utf-8').replace(/\n## Notes\n[\s\S]*$/, '\n'), 'utf-8');
  strictEqual(cli(['issue', 'mark-groomed', 'alpha'], { cwd: fx.projectRoot }).exitCode, 0);
  ok(readFileSync(paths.alpha, 'utf-8').endsWith(`\n\n## Notes\n\n- ${today()}: Groomed: ${sha}\n`), readFileSync(paths.alpha, 'utf-8'));
  fx.cleanup();
});

await runTest('IC14: a marker run with one unknown slug writes nothing; --project-root targets another repo; a repo with no commit exits 2', () => {
  const { fx, paths } = closeFixture(['alpha']);
  const before = readFileSync(paths.alpha, 'utf-8');
  const bad = cli(['issue', 'mark-groomed', 'alpha', 'missing'], { cwd: fx.projectRoot });
  strictEqual(bad.exitCode, 1, bad.stderr);
  strictEqual(bad.stdout, '');
  strictEqual(readFileSync(paths.alpha, 'utf-8'), before);
  strictEqual(cli(['issue', 'mark-groomed'], { cwd: fx.projectRoot }).exitCode, 1);

  const caller = createFixture();
  const other = cli(['issue', 'mark-refreshed', 'alpha', '--project-root', fx.projectRoot], { cwd: caller.projectRoot });
  strictEqual(other.exitCode, 0, other.stderr);
  ok(readFileSync(paths.alpha, 'utf-8').includes(`Refreshed: ${git(fx.projectRoot, 'rev-parse', '--short', 'HEAD')}`));

  const empty = mkdtempSync(join(tmpdir(), 'smcp-nocommit-'));
  execFileSync('git', ['init', '--quiet'], { cwd: empty });
  mkdirSync(join(empty, 'scratch', 'issues'), { recursive: true });
  writeFileSync(join(empty, 'scratch', 'issues', 'alpha.md'), before, 'utf-8');
  const noHead = cli(['issue', 'mark-groomed', 'alpha'], { cwd: empty });
  strictEqual(noHead.exitCode, 2, noHead.stderr);
  ok(noHead.stderr.includes('rev-parse'), noHead.stderr);
  strictEqual(readFileSync(join(empty, 'scratch', 'issues', 'alpha.md'), 'utf-8'), before);
  rmSync(empty, { recursive: true, force: true });
  fx.cleanup(); caller.cleanup();
});

// util-linux `script` gives the child a pseudo-terminal; its flags differ on macOS and it is absent on Git Bash.
if (process.platform === 'linux' && spawnSync('script', ['--version']).status === 0) {
  await runTest('IC15: issue close --resolution-file - with a TTY on stdin exits 1 with "no input on stdin", never a blocking read', () => {
    const { fx, paths } = closeFixture(['alpha']);
    const before = readFileSync(paths.alpha, 'utf-8');
    const r = spawnSync('script', ['-qec', `node "${CLI_PATH}" issue close alpha --status fixed --resolution-file -`, '/dev/null'], { cwd: fx.projectRoot, env, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
    strictEqual(r.status, 1, r.stdout + r.stderr);
    ok(r.stdout.includes('no input on stdin'), r.stdout);
    strictEqual(readFileSync(paths.alpha, 'utf-8'), before);
    fx.cleanup();
  });

  await runTest('IC7: a TTY on stdin exits 1 with "No input on stdin"', () => {
    const fx = repoWithCorpus();
    const r = spawnSync('script', ['-qec', `node "${CLI_PATH}" issue write`, '/dev/null'], { cwd: fx.projectRoot, env, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    strictEqual(r.status, 1, r.stdout + r.stderr);
    ok(r.stdout.includes('No input on stdin'), r.stdout);
    deepStrictEqual(issueFiles(fx.projectRoot), []);
    fx.cleanup();
  });
}

rmSync(cfgDir, { recursive: true, force: true });
process.stdout.write(`${passCount} passed, ${failCount} failed\n`);
process.exit(failCount ? 1 : 0);
