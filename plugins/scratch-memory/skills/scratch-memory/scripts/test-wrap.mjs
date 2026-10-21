#!/usr/bin/env node
// test-wrap.mjs — Tests for wrap.mjs: `wrap collect` over a fixture workstream,
// through the real scratch-memory.mjs dispatcher.
// Usage: node test-wrap.mjs   (exit 0 on all-pass)

import { deepStrictEqual, strictEqual, ok } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import process from 'node:process';

import { questionId, questionKernel } from './cat-sessions.mjs';
import { SYMLINK_TEXT } from './wrap.mjs';
import { createFixture } from './test-fixtures.mjs';
import { runCli, CLI_PATH } from './test-driver.mjs';
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('Usage: node test-wrap.mjs\n\nRuns wrap.mjs tests (TW group). Exit 0 on all-pass, 1 otherwise.\n');
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

process.on('uncaughtException', (err) => {
  process.stderr.write(`HARNESS-ERROR: ${err.message}\n`);
  process.stdout.write('0 passed, 1 failed\n');
  process.exit(1);
});

const OPEN_Q = 'Which config root wins?';
const CLOSED_Q = 'Should groom move this one?';

// Churn needs real history, so this is a git repo (createFixture), not a `.git`-file anchor.
function commit(root, path, date) {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), `// ${path}\n`, 'utf-8');
  const env = date ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : process.env;
  execFileSync('git', ['add', path], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', `add ${path}`, '--quiet'], { cwd: root, env, stdio: 'ignore' });
}

function task(dir, id, status, extra = '') {
  const fm = ['---', `id: ${id}`, `title: "Task ${id}"`, `status: ${status}`, extra,
    'created: 2026-09-01T00:00:00.000Z', 'updated: 2026-09-01T00:00:00.000Z', '---', ''].filter((l) => l !== '');
  writeFileSync(join(dir, 'tasks', `${id}-task.md`), fm.join('\n') + '\nDone when: it ships\n', 'utf-8');
}

function workstream() {
  const fx = createFixture();
  const root = fx.projectRoot;
  commit(root, 'src/old.js', '2026-08-01T00:00:00Z');
  const dir = join(root, 'scratch', 'S-ws');
  for (const sub of ['sessions', 'tasks', 'learned', 'wrap', 'drafts']) mkdirSync(join(dir, sub), { recursive: true });
  writeFileSync(join(dir, 'sessions', '2026-09-01T00-00-00-000Z-00000001.md'), [
    '---', 'session_id: ws', '---', '',
    '## Decisions made', '- Keep the loader in `src/old.js`', '',
    '## What to avoid', '- Never inline the parser in `src/changed.js`', '',
    '## Open questions raised', `- ${OPEN_Q}`, `- ${CLOSED_Q}`, '',
  ].join('\n'), 'utf-8');
  commit(root, 'src/changed.js');
  const closedId = questionId(questionKernel(CLOSED_Q));
  // The root ledger closes the question; the retired wrap/groom-closes.md is absent.
  writeFileSync(join(dir, 'groom-closes.md'), `## groom 2026-09-02T00:00:00.000Z\n- ${closedId} → RESOLVED: closed — tracked: tasks/t-aaaaa1-task.md — "Task t-aaaaa1"\n`, 'utf-8');
  task(dir, 't-aaaaa1', 'open');
  task(dir, 't-aaaaa2', 'blocked', 'blocked_on: "go-ahead"');
  task(dir, 't-aaaaa3', 'done');
  writeFileSync(join(dir, 'notes.md'), 'intro line\n# Stray notes\n', 'utf-8');
  writeFileSync(join(dir, 'drafts', 'plan.txt'), '\nfirst real line\n', 'utf-8');
  writeFileSync(join(dir, 'groom.yaml'), 'methodology_version: 1\n', 'utf-8');
  writeFileSync(join(dir, 'HANDOFF.md'), '# Handoff\n', 'utf-8');
  writeFileSync(join(dir, 'learned', 'capture.md'), '# A capture\n', 'utf-8');
  return { fx, root, dir, closedId };
}

// No test reads the real user-level repos file: each run gets an empty config dir and HOME
// unless it passes its own env.
const EMPTY_CFG = mkdtempSync(join(tmpdir(), 'smcp-wrap-cfg-'));
const ENV = { ...process.env, SCRATCH_MEMORY_CONFIG_DIR: EMPTY_CFG, HOME: EMPTY_CFG };
const run = (args, opts = {}) => runCli(args, { env: ENV, ...opts });

(async () => {

  await runTest('TW1: collect writes items.json with every kind, churn, the done-task exclusion and the skips', () => {
    const { fx, root, dir, closedId } = workstream();
    try {
      const r = run(['wrap', 'collect', 'scratch/S-ws'], { cwd: root });
      strictEqual(r.exitCode, 0, r.stderr);
      const out = join(dir, 'wrap', 'items.json');
      strictEqual(r.stdout.trim(), out);
      const data = JSON.parse(readFileSync(out, 'utf-8'));

      const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf-8' }).trim();
      deepStrictEqual(data.head, { repo: head, scratch: head, repos: {} });
      deepStrictEqual([data.repos, data.learned_repo], [[], null]);
      deepStrictEqual(data.items.map((i) => [i.id, i.kind]), [
        ['d001', 'decision'], ['a001', 'avoid'], ['q001', 'question'],
        ['t-aaaaa1', 'task'], ['t-aaaaa2', 'task'], ['f001', 'file'], ['f002', 'file'],
      ]);
      const byId = Object.fromEntries(data.items.map((i) => [i.id, i]));

      deepStrictEqual(byId.d001.paths, ['src/old.js']);
      deepStrictEqual(byId.d001.churn, { status: 'untouched' });
      strictEqual(byId.d001.since, '2026-09-01T00:00:00Z');
      strictEqual(byId.d001.source, join('sessions', '2026-09-01T00-00-00-000Z-00000001.md'));
      deepStrictEqual(byId.a001.churn, { status: 'changed', changed: ['src/changed.js'] });

      strictEqual(byId.q001.text, OPEN_Q);
      strictEqual(byId.q001.qid, questionId(questionKernel(OPEN_Q)));
      strictEqual(byId.q001.age_sessions, 0);
      deepStrictEqual(byId.q001.churn, { status: 'no-path' });
      ok(!data.items.some((i) => i.qid === closedId), 'the groom-closed question is skipped');

      strictEqual(byId['t-aaaaa2'].status, 'blocked');
      strictEqual(byId['t-aaaaa2'].text, 'Task t-aaaaa2');
      strictEqual(byId['t-aaaaa2'].file, join('scratch', 'S-ws', 'tasks', 't-aaaaa2-task.md'));
      ok(byId['t-aaaaa2'].body.includes('blocked_on: "go-ahead"'));
      deepStrictEqual(data.excluded_done_tasks, [{ id: 't-aaaaa3', title: 'Task t-aaaaa3' }]);

      deepStrictEqual([byId.f001.path, byId.f001.text], [join('scratch', 'S-ws', 'drafts', 'plan.txt'), 'first real line']);
      deepStrictEqual([byId.f002.path, byId.f002.text], [join('scratch', 'S-ws', 'notes.md'), '# Stray notes']);
    } finally { fx.cleanup(); }
  });

  await runTest('TW2: a re-run overwrites items.json', () => {
    const { fx, root, dir } = workstream();
    try {
      const out = join(dir, 'wrap', 'items.json');
      writeFileSync(out, 'stale', 'utf-8');
      strictEqual(run(['wrap', 'collect', 'scratch/S-ws'], { cwd: root }).exitCode, 0);
      ok(JSON.parse(readFileSync(out, 'utf-8')).items.length > 0);
    } finally { fx.cleanup(); }
  });

  await runTest('TW3: a folder with no sessions/ exits 1 and writes nothing', () => {
    const fx = createFixture();
    try {
      mkdirSync(join(fx.projectRoot, 'scratch', 'S-empty'), { recursive: true });
      const r = run(['wrap', 'collect', 'scratch/S-empty'], { cwd: fx.projectRoot });
      strictEqual(r.exitCode, 1);
      ok(/sessions/.test(r.stderr), r.stderr);
      ok(!existsSync(join(fx.projectRoot, 'scratch', 'S-empty', 'wrap')));
    } finally { fx.cleanup(); }
  });

  await runTest('TW4: usage errors exit 1 — no argument, unknown subcommand, unknown option, a path outside scratch/', () => {
    const { fx, root } = workstream();
    try {
      for (const args of [['wrap', 'collect'], ['wrap', 'gather', 'scratch/S-ws'], ['wrap', 'collect', '--all', 'scratch/S-ws'], ['wrap', 'collect', 'src']]) {
        const r = run(args, { cwd: root });
        strictEqual(r.exitCode, 1, `${args.join(' ')}: ${r.stderr}`);
      }
    } finally { fx.cleanup(); }
  });

  await runTest('TW5: `wrap collect --help` prints the help and exits 0; after `--` it is a positional', () => {
    const { fx, root } = workstream();
    try {
      const r = run(['wrap', 'collect', '--help'], { cwd: root });
      strictEqual(r.exitCode, 0, r.stderr);
      ok(r.stdout.startsWith('Usage: scratch-memory wrap collect'), r.stdout);
      strictEqual(run(['wrap', 'collect', '--', '--help'], { cwd: root }).exitCode, 1);
    } finally { fx.cleanup(); }
  });

  await runTest('TW6: a symlinked wrap/ or items.json is refused, dangling included, and nothing is written through it', () => {
    for (const target of ['wrap', join('wrap', 'items.json')]) {
      const { fx, root, dir } = workstream();
      try {
        const outside = join(fx.sessionsDir, 'outside');
        if (target === 'wrap') {
          rmSync(join(dir, 'wrap'), { recursive: true });
          mkdirSync(outside);
          symlinkSync(outside, join(dir, 'wrap'));
        } else {
          symlinkSync(join(outside, 'items.json'), join(dir, target));
        }
        const r = run(['wrap', 'collect', 'scratch/S-ws'], { cwd: root });
        strictEqual(r.exitCode, 1, `${target}: ${r.stderr}`);
        ok(/symlink/.test(r.stderr), r.stderr);
        ok(!existsSync(join(outside, 'items.json')), `${target}: wrote through the link`);
      } finally { fx.cleanup(); }
    }
  });

  await runTest('TW7: a symlinked stray file is listed unread, and a path token outside the repo is unresolved, and a `scratch/../` token is kept normalized', () => {
    const { fx, root, dir } = workstream();
    try {
      const secret = join(fx.sessionsDir, 'secret.txt');
      writeFileSync(secret, 'TOKEN=abc\n', 'utf-8');
      symlinkSync(secret, join(dir, 'link.txt'));
      mkdirSync(join(fx.sessionsDir, 'dir'));
      symlinkSync(join(fx.sessionsDir, 'dir'), join(dir, 'linkdir'));
      const sibling = `${basename(root)}-sibling.md`;
      writeFileSync(join(root, '..', sibling), 'x', 'utf-8');
      writeFileSync(join(dir, 'sessions', '2026-09-02T00-00-00-000Z-00000002.md'), [
        '---', 'session_id: ws', '---', '', '## Decisions made', `- Read \`../${sibling}\` first`, '- Keep `scratch/../src/old.js` as is', '',
      ].join('\n'), 'utf-8');
      const r = run(['wrap', 'collect', 'scratch/S-ws'], { cwd: root });
      strictEqual(r.exitCode, 0, r.stderr);
      const data = JSON.parse(readFileSync(join(dir, 'wrap', 'items.json'), 'utf-8'));
      const files = Object.fromEntries(data.items.filter((i) => i.kind === 'file').map((i) => [i.path, i.text]));
      strictEqual(files[join('scratch', 'S-ws', 'link.txt')], SYMLINK_TEXT);
      strictEqual(files[join('scratch', 'S-ws', 'linkdir')], SYMLINK_TEXT);
      ok(!JSON.stringify(data).includes('TOKEN=abc'));
      const d = data.items.find((i) => i.text === `Read \`../${sibling}\` first`);
      deepStrictEqual([d.paths, d.paths_unresolved, d.churn], [[], [`../${sibling}`], { status: 'no-path' }]);
      const k = data.items.find((i) => i.text === 'Keep `scratch/../src/old.js` as is');
      deepStrictEqual([k.paths, k.churn], [['src/old.js'], { status: 'untouched' }]);
    } finally {
      rmSync(join(fx.projectRoot, '..', `${basename(fx.projectRoot)}-sibling.md`), { force: true });
      fx.cleanup();
    }
  });

  // A workstream plus registered repos: `ext` owns ~/.claude/skills and has a corpus, `bare` has
  // none, `gone` is deleted after registering, and the current repo registers itself.
  function registered() {
    const ws = workstream();
    const ext = createFixture();
    const bare = createFixture();
    const gone = createFixture();
    commit(ext.projectRoot, '.claude/skills/wrap-up/SKILL.md', '2026-08-01T00:00:00Z');
    mkdirSync(join(ext.projectRoot, 'scratch', 'issues'), { recursive: true });
    const home = mkdtempSync(join(tmpdir(), 'smcp-wrap-home-'));
    mkdirSync(join(home, '.claude', 'agents'), { recursive: true });
    symlinkSync(join(ext.projectRoot, '.claude', 'skills'), join(home, '.claude', 'skills'));
    const env = { ...process.env, SCRATCH_MEMORY_CONFIG_DIR: join(home, 'cfg'), HOME: home };
    for (const [name, fx] of [['ext', ext], ['bare', bare], ['gone', gone], ['self', ws.fx]]) {
      const r = runCli(['repos', 'add', name, fx.projectRoot, '--user', '--accepts', 'issues,learned'], { env, cwd: ws.root });
      strictEqual(r.exitCode, 0, r.stderr);
    }
    gone.cleanup();
    return { ...ws, ext, env, cleanup() { ws.fx.cleanup(); ext.cleanup(); bare.cleanup(); rmSync(home, { recursive: true, force: true }); } };
  }

  function collect(root, env) {
    const r = spawnSync('node', [CLI_PATH, 'wrap', 'collect', 'scratch/S-ws'], { cwd: root, env, encoding: 'utf-8' });
    strictEqual(r.status, 0, r.stderr);
    return { data: JSON.parse(readFileSync(r.stdout.trim(), 'utf-8')), stderr: r.stderr };
  }

  await runTest('TW8: items.json lists ok registered repos minus the current one, with corpus, HEAD and learned_repo; a gone repo is named once', () => {
    const t = registered();
    try {
      const { data, stderr } = collect(t.root, t.env);
      deepStrictEqual(data.repos.map((r) => [r.name, r.corpus, r.path]), [
        ['bare', false, realpathSync(data.repos[0].path)],
        ['ext', true, realpathSync(t.ext.projectRoot)],
      ]);
      deepStrictEqual(data.repos[1].accepts, ['issues', 'learned']);
      const extHead = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: t.ext.projectRoot, encoding: 'utf-8' }).trim();
      deepStrictEqual(Object.keys(data.head.repos), ['bare', 'ext']);
      strictEqual(data.head.repos.ext, extHead);
      strictEqual(data.learned_repo, 'ext');
      strictEqual(stderr.match(/registered repo gone skipped/g)?.length, 1, stderr);
      ok(!stderr.includes('self'), stderr);
    } finally { t.cleanup(); }
  });

  await runTest('TW9: a ~/.claude token a registered repo owns resolves into that repo, with churn read there; an unowned one keeps the local rewrite', () => {
    const t = registered();
    try {
      mkdirSync(join(t.root, '.claude', 'agents'), { recursive: true });
      writeFileSync(join(t.root, '.claude', 'agents', 'helper.md'), '# helper\n', 'utf-8');
      writeFileSync(join(t.dir, 'sessions', '2026-09-02T00-00-00-000Z-00000002.md'), [
        '---', 'session_id: ws', '---', '', '## Decisions made',
        '- Fix `~/.claude/skills/wrap-up/SKILL.md` stage 1',
        '- Point `~/.claude/agents/helper.md` at the new flow',
        '- Drop `~/.claude/skills/wrap-up/missing.md`', '',
      ].join('\n'), 'utf-8');
      let { data } = collect(t.root, t.env);
      const byText = (s) => data.items.find((i) => i.text.includes(s));
      deepStrictEqual([byText('stage 1').paths, byText('stage 1').repo_paths, byText('stage 1').churn],
        [[], { ext: ['.claude/skills/wrap-up/SKILL.md'] }, { status: 'untouched' }]);
      deepStrictEqual([byText('new flow').paths, byText('new flow').repo_paths], [['.claude/agents/helper.md'], undefined]);
      deepStrictEqual([byText('missing').paths_unresolved, byText('missing').churn], [['~/.claude/skills/wrap-up/missing.md'], { status: 'no-path' }]);

      writeFileSync(join(t.ext.projectRoot, '.claude/skills/wrap-up/SKILL.md'), '// edited\n', 'utf-8');
      execFileSync('git', ['commit', '-qam', 'edit'], { cwd: t.ext.projectRoot, stdio: 'ignore' });
      ({ data } = collect(t.root, t.env));
      deepStrictEqual(byText('stage 1').churn, { status: 'changed', repo_changed: { ext: ['.claude/skills/wrap-up/SKILL.md'] } });
    } finally { t.cleanup(); }
  });

  // Two sessions committed before the fork, one after: lane scope keeps only the third's items.
  function laneWorkstream() {
    const fx = createFixture();
    const root = fx.projectRoot;
    const dir = join(root, 'scratch', 'S-lane');
    mkdirSync(join(dir, 'sessions'), { recursive: true });
    const session = (n, decision) => {
      writeFileSync(join(dir, 'sessions', `2026-09-0${n}T00-00-00-000Z-0000000${n}.md`), [
        '---', 'session_id: lane', '---', '', '## Decisions made', `- ${decision}`, '',
      ].join('\n'), 'utf-8');
    };
    session(1, 'First decision');
    session(2, 'Second decision');
    execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' });
    execFileSync('git', ['commit', '-qm', 'pre-fork'], { cwd: root, stdio: 'ignore' });
    const fork = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf-8' }).trim();
    session(3, 'Third decision');
    writeFileSync(join(dir, 'lane-notes.md'), '# Lane notes\n', 'utf-8');
    execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' });
    execFileSync('git', ['commit', '-qm', 'on the lane'], { cwd: root, stdio: 'ignore' });
    return { fx, root, dir, fork };
  }

  await runTest('TW10: --since-ref keeps only items whose file changed since the ref; without it every session counts', () => {
    const { fx, root, dir, fork } = laneWorkstream();
    try {
      const out = join(dir, 'wrap', 'items.json');
      const r = run(['wrap', 'collect', 'scratch/S-lane', '--since-ref', fork], { cwd: root });
      strictEqual(r.exitCode, 0, r.stderr);
      strictEqual(r.stdout.trim(), out);
      const lane = JSON.parse(readFileSync(out, 'utf-8'));
      deepStrictEqual(lane.items.map((i) => [i.id, i.text]), [['d001', 'Third decision'], ['f001', '# Lane notes']]);
      strictEqual(lane.items[0].source, join('sessions', '2026-09-03T00-00-00-000Z-00000003.md'));

      strictEqual(run(['wrap', 'collect', 'scratch/S-lane'], { cwd: root }).exitCode, 0);
      const whole = JSON.parse(readFileSync(out, 'utf-8'));
      deepStrictEqual(whole.items.filter((i) => i.kind === 'decision').map((i) => i.text).sort(),
        ['First decision', 'Second decision', 'Third decision']);
    } finally { fx.cleanup(); }
  });

  await runTest('TW11: --since-ref with no ref, a dash-led ref or a ref that is no commit exits 1 and writes nothing', () => {
    const { fx, root, dir } = laneWorkstream();
    try {
      for (const tail of [['--since-ref'], ['--since-ref', '--output=x'], ['--since-ref', 'no-such-ref']]) {
        const r = run(['wrap', 'collect', 'scratch/S-lane', ...tail], { cwd: root });
        strictEqual(r.exitCode, 1, `${tail.join(' ')}: ${r.stderr}`);
      }
      ok(!existsSync(join(dir, 'wrap')));
    } finally { fx.cleanup(); }
  });

  process.stdout.write(`${passCount} passed, ${failCount} failed\n`);
  process.exit(failCount > 0 ? 1 : 0);
})();
