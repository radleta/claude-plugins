#!/usr/bin/env node
// Tests for lane.mjs. Run: node .claude/skills/lane-methodology/scripts/test-lane.mjs
// Every case builds real git repos with bare origins under one temp directory, removed on exit.

import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, symlinkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LANE = join(HERE, 'lane.mjs');
const TMP = realpathSync(mkdtempSync(join(tmpdir(), 'lane-test-')));
process.on('exit', () => rmSync(TMP, { recursive: true, force: true }));

mkdirSync(join(TMP, 'home'));
writeFileSync(join(TMP, 'gitconfig'), '[user]\n\tname = t\n\temail = t@t\n[init]\n\tdefaultBranch = main\n[advice]\n\tdetachedHead = false\n[protocol "ext"]\n\tallow = always\n');
const ENV = { ...process.env, HOME: join(TMP, 'home'), GIT_CONFIG_GLOBAL: join(TMP, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1' };

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log(`  PASS: ${name}`); } else { failed += 1; console.log(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`); }
}
const group = (name) => console.log(name);

function run(cwd, file, args, env = ENV) {
  const result = spawnSync(file, args, { cwd, env, encoding: 'utf-8' });
  return { code: result.status, out: (result.stdout || '').trim(), err: (result.stderr || '').trim() };
}
function git(cwd, ...args) {
  const result = run(cwd, 'git', args);
  if (result.code !== 0) throw new Error(`git ${args.join(' ')} in ${cwd}: ${result.err}`);
  return result.out;
}
const tryGit = (cwd, ...args) => run(cwd, 'git', args);
const lane = (cwd, ...args) => run(cwd, process.execPath, [LANE, ...args]);
const say = (result) => `exit ${result.code}: ${result.out} | ${result.err}`;
const write = (file, text) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); };
const commit = (cwd, file, text, message = `edit ${file}`) => { write(join(cwd, file), text); git(cwd, 'add', '--', file); git(cwd, 'commit', '-qm', message); };
const tip = (cwd, ref) => git(cwd, 'rev-parse', ref);
const on = (cwd) => git(cwd, 'branch', '--show-current');

/** A repo with one commit on main, pushed to a new bare origin. */
function seed(dir, origin, files) {
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  for (const [file, text] of Object.entries(files)) write(join(dir, file), text);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');
  git(TMP, 'init', '-q', '--bare', origin);
  git(dir, 'remote', 'add', 'origin', origin);
  git(dir, 'push', '-q', '-u', 'origin', 'main');
  git(dir, 'remote', 'set-head', 'origin', 'main');
}

/**
 * A checkout {case}/repo with scratch/ and, unless sub is 'absent', the extra lane repo sub/, each
 * with a bare origin. `rows` are the lane repos table's rows; `table: false` leaves it out.
 */
function scaffold(name, { sub = 'present', rows = [['sub', 'main']], table = true } = {}) {
  const dir = join(TMP, name);
  const repo = join(dir, 'repo');
  const origin = (part) => join(dir, `${part}.git`);
  const tableText = table ? `\n| Lane repo | Base |\n|---|---|\n${rows.map(([path, base]) => `| ${path} | ${base} |`).join('\n')}\n` : '';
  seed(repo, origin('code'), {
    'CLAUDE.md': `# Demo\n\n- **Lanes:** run as clone; open at build.\n${tableText}`,
    '.gitignore': 'scratch/\nsub/\nother/\nvendor/\n',
    '.subrepos': 'scratch\nsub\n',
    'app.txt': 'app\n',
  });
  seed(join(repo, 'scratch'), origin('scratch'), {
    'issues/demo.md': '---\nkind: issue\ntitle: "Demo"\nslug: demo\nstatus: open\n---\n# Issue: Demo\n\n## Summary\nMake the demo\nwork again.\n\n## Notes\n',
    'notes.md': 'notes\n',
    '.scratch-config.json': '{"projectName":"demo","archiveBranch":"archive"}\n',
  });
  seed(join(dir, 'sub-seed'), origin('sub'), { 'lib.txt': 'lib\n' });
  if (sub === 'present') git(repo, 'clone', '-q', origin('sub'), 'sub');
  return { dir, repo, scratch: join(repo, 'scratch'), sub: join(repo, 'sub'), origin };
}
const record = (s, ref = 'lane/demo') => tryGit(s.scratch, 'show', `${ref}:L-demo/README.md`).out;
const three = (s) => [s.repo, s.scratch, s.sub];

// ── usage ────────────────────────────────────────────────────────────────────────────────────
group('Usage');
{
  const s = scaffold('usage');
  let r = lane(s.repo, '--help');
  check('--help exits 0 with usage', r.code === 0 && r.out.includes('Usage:'), say(r));
  r = lane(s.repo, 'bogus');
  check('an unknown verb exits 1', r.code === 1, say(r));
  r = lane(s.repo, 'status', '--json');
  check('an unknown flag exits 1', r.code === 1, say(r));
  r = lane(s.repo, 'abandon', 'demo');
  check('abandon without --reason exits 1', r.code === 1, say(r));
  r = lane(s.repo, 'status');
  check('status off a lane prints lane: none and exits 0', r.code === 0 && r.out === 'lane: none', say(r));
  r = lane(s.repo, 'push');
  check('push off a lane exits 2', r.code === 2 && r.err.includes('not on a lane'), say(r));
  r = lane(s.repo, 'held', 'demo');
  check('held on a free issue exits 0', r.code === 0 && r.out === 'held: demo free', say(r));
  r = run(TMP, process.execPath, [LANE, 'status', '--json'], { ...ENV, GIT_CEILING_DIRECTORIES: TMP });
  check('a wrong call outside a git repo is still exit 1', r.code === 1, say(r));
  r = run(TMP, process.execPath, [LANE, 'status'], { ...ENV, GIT_CEILING_DIRECTORIES: TMP });
  check('a right call outside a git repo is exit 2', r.code === 2 && r.err.includes('not inside a git repo'), say(r));
}

// ── clone lane, three repos ──────────────────────────────────────────────────────────────────
group('Clone lane, three repos');
{
  const s = scaffold('clone');
  const subMain = tip(s.sub, 'main');
  const r = lane(s.repo, 'begin', 'demo');
  check('begin exits 0', r.code === 0, say(r));
  check('code, scratch and the extra repo are on lane/demo', three(s).every((dir) => on(dir) === 'lane/demo'));
  check('each has an origin upstream', three(s).every((dir) => tryGit(dir, 'rev-parse', '--abbrev-ref', '@{upstream}').out === 'origin/lane/demo'));
  check('the record at the scratch tip carries extras with the base sha', record(s).includes(`\nextras: sub:main:${subMain}\nworkstream: demo\n`), record(s));
  check('the record draws its purpose from the issue summary', record(s).includes('\nMake the demo work again.\n'), record(s));
  check('the issue carries lane: demo', tryGit(s.scratch, 'show', 'lane/demo:issues/demo.md').out.includes('\nlane: demo\n'));
  check('one line per repo and a switched line each', ['begin: . on lane/demo', 'begin: scratch on lane/demo', 'begin: sub on lane/demo', 'switched: .', 'switched: scratch', 'switched: sub'].every((line) => r.out.includes(line)), r.out);
  check('scratch main is untouched', tip(s.scratch, 'main') === tip(s.scratch, 'origin/main'));

  let v = lane(s.repo, '--verbose', 'status');
  check('status names the lane and each repo', v.code === 0 && v.out.includes('lane: demo') && v.out.includes('status: sub base main'), say(v));
  check('--verbose before the verb prints each git command on stderr', v.err.includes('+ git -C'), v.err);
  v = lane(s.repo, 'status', '--verbose');
  check('--verbose after the verb does too', v.code === 0 && v.err.includes('+ git -C'), say(v));
  check('a plain run prints no git command', !lane(s.repo, 'status').err.includes('+ git'));
  v = lane(s.repo, 'held', 'demo');
  check('held on the lane\'s own checkout exits 0', v.code === 0 && v.out.includes('this checkout'), say(v));

  group('Resume');
  git(s.repo, 'switch', '-q', 'main');
  git(s.sub, 'switch', '-q', 'main');
  v = lane(s.repo, 'begin', 'demo');
  check('begin on a held issue resumes and switches back', v.code === 0 && v.out.includes('resumed lane demo') && three(s).every((dir) => on(dir) === 'lane/demo'), say(v));

  group('Push, diff, log');
  commit(s.sub, 'new.txt', 'new\n', 'feat: sub work');
  v = lane(s.repo, 'push');
  check('push sends each lane branch to origin', v.code === 0 && tip(s.origin('sub'), 'lane/demo') === tip(s.sub, 'lane/demo'), say(v));
  v = lane(s.repo, 'diff');
  check('diff prints a command and a stat per repo, never the diff', v.code === 0 && v.out.includes('diff: . git diff main...lane/demo') && v.out.includes('diff: sub git -C sub diff main...lane/demo') && v.out.includes('new.txt') && !v.out.includes('+new'), say(v));
  v = lane(s.repo, 'log');
  check('log prints each repo\'s own commits with their paths', v.code === 0 && v.out.includes('feat: sub work') && v.out.includes('new.txt') && v.out.includes('log: scratch'), say(v));

  group('Catch-up');
  const other = join(s.dir, 'sub-seed');
  commit(other, 'base.txt', 'base\n', 'base work');
  git(other, 'push', '-q', 'origin', 'main');
  v = lane(s.repo, 'catch-up');
  check('catch-up merges the extra repo\'s base into its lane branch', v.code === 0 && existsSync(join(s.sub, 'base.txt')) && v.out.includes('catch-up: sub merged origin/main'), say(v));
  commit(s.sub, 'lib.txt', 'lane side\n');
  commit(other, 'lib.txt', 'base side\n');
  git(other, 'push', '-q', 'origin', 'main');
  v = lane(s.repo, 'catch-up');
  check('a conflict exits 3 naming the repo and the file', v.code === 3 && v.err.includes('sub') && v.err.includes('lib.txt'), say(v));
  check('and leaves MERGE_HEAD in that repo', tryGit(s.sub, 'rev-parse', '--verify', '-q', 'MERGE_HEAD').code === 0);
  v = lane(s.repo, 'catch-up');
  check('run again unresolved, it still exits 3', v.code === 3, say(v));
  write(join(s.sub, 'lib.txt'), 'both\n');
  git(s.sub, 'add', '--', 'lib.txt');
  git(s.sub, 'commit', '-q', '--no-edit');
  v = lane(s.repo, 'catch-up');
  check('resolved and committed, catch-up goes on and exits 0', v.code === 0, say(v));
}

// ── a repo that is not there ─────────────────────────────────────────────────────────────────
group('A repo that is not there');
{
  const s = scaffold('absent', { sub: 'absent' });
  let r = lane(s.repo, 'begin', 'demo');
  check('begin exits 0 with the listed repo absent', r.code === 0 && r.out.includes('begin: sub pending'), say(r));
  check('the record carries pending and no extras', record(s).includes('\npending: sub:main\n') && !record(s).includes('extras:'), record(s));
  git(s.repo, 'clone', '-q', s.origin('sub'), 'sub');
  const before = [tip(s.scratch, 'HEAD'), on(s.sub), git(s.scratch, 'status', '--porcelain')].join('|');
  r = lane(s.repo, 'status');
  check('status reports it present and changes nothing', r.out.includes('pending: sub base main present') && before === [tip(s.scratch, 'HEAD'), on(s.sub), git(s.scratch, 'status', '--porcelain')].join('|'), say(r));
  const subMain = tip(s.sub, 'main');
  const recordFile = join(s.scratch, 'L-demo', 'README.md');
  const committed = readFileSync(recordFile, 'utf-8');
  writeFileSync(recordFile, `${committed}- an uncommitted line\n`);
  r = lane(s.repo, 'add-repo', 'sub');
  check('add-repo refuses while the record holds uncommitted lines', r.code === 2 && r.err.includes('has uncommitted lines') && on(s.sub) === 'main' && record(s).includes('pending: sub:main'), say(r));
  writeFileSync(recordFile, committed);
  r = lane(s.repo, 'add-repo', 'sub');
  check('add-repo puts it on lane/demo', r.code === 0 && on(s.sub) === 'lane/demo' && r.out.includes('switched: sub'), say(r));
  check('and moves it from pending to extras', record(s).includes(`\nextras: sub:main:${subMain}\n`) && !record(s).includes('pending:'), record(s));
  check('with an origin upstream', tryGit(s.sub, 'rev-parse', '--abbrev-ref', '@{upstream}').out === 'origin/lane/demo');
  r = lane(s.repo, 'add-repo', 'nope');
  check('add-repo of an unlisted path exits 2', r.code === 2, say(r));

  const t = scaffold('absent-catchup', { sub: 'absent' });
  lane(t.repo, 'begin', 'demo');
  git(t.repo, 'clone', '-q', t.origin('sub'), 'sub');
  r = lane(t.repo, 'catch-up');
  check('catch-up adds a pending repo now present', r.code === 0 && on(t.sub) === 'lane/demo' && record(t).includes('\nextras: sub:main:'), say(r));
}

// ── land ─────────────────────────────────────────────────────────────────────────────────────
function laneWork(s) {
  commit(s.repo, 'app.txt', 'app on the lane\n');
  commit(s.scratch, 'notes.md', 'notes on the lane\n');
  commit(s.sub, 'lib.txt', 'lib on the lane\n');
}
group('Land');
{
  const s = scaffold('land');
  lane(s.repo, 'begin', 'demo');
  laneWork(s);
  const originMain = tip(s.origin('code'), 'main');
  let r = lane(s.repo, 'land', 'demo');
  check('land exits 0', r.code === 0, say(r));
  check('each base is at its lane branch\'s tip', three(s).every((dir) => tip(dir, 'main') === tip(dir, 'lane/demo')));
  check('each base is checked out', three(s).every((dir) => on(dir) === 'main'));
  check('the record is on the archive branch with its closing line', /Closed: lands on main at [0-9a-f]{7} by merge/.test(record(s, 'archive')), record(s, 'archive'));
  check('the record is not on scratch main', tryGit(s.scratch, 'ls-tree', '--name-only', 'main', '--', 'L-demo').out === '');
  check('no base was pushed to origin', tip(s.origin('code'), 'main') === originMain);
  check('the lane branches were pushed', tip(s.origin('sub'), 'lane/demo') === tip(s.sub, 'lane/demo') && tip(s.origin('scratch'), 'lane/demo') === tip(s.scratch, 'lane/demo'));
  const after = three(s).map((dir) => tip(dir, 'main')).join();
  r = lane(s.repo, 'land', 'demo');
  check('a second land exits 0 and moves nothing', r.code === 0 && r.out.includes('already landed') && after === three(s).map((dir) => tip(dir, 'main')).join(), say(r));

  group('Taken name');
  r = lane(s.repo, 'begin', 'demo');
  check('begin on a landed lane\'s name exits 5', r.code === 5 && r.err.includes('taken') && on(s.repo) === 'main', say(r));
  r = lane(s.repo, 'begin', 'demo', '--name', 'demo-two');
  check('begin --name opens the lane under the picked name', r.code === 0 && three(s).every((dir) => on(dir) === 'lane/demo-two'), say(r));
}

group('Land, push refused');
{
  const s = scaffold('push-refused');
  lane(s.repo, 'begin', 'demo');
  laneWork(s);
  git(s.sub, 'remote', 'set-url', 'origin', join(s.dir, 'gone.git'));
  let r = lane(s.repo, 'land', 'demo');
  check('a refused push of a lane branch exits 2 after every base landed', r.code === 2 && r.err.includes('push of lane/demo was refused in sub') && three(s).every((dir) => tip(dir, 'main') === tip(dir, 'lane/demo')), say(r));
  git(s.sub, 'remote', 'set-url', 'origin', s.origin('sub'));
  r = lane(s.repo, 'land', 'demo');
  check('land again pushes the branch left behind and exits 0', r.code === 0 && r.out.includes('land: sub pushed lane/demo to origin') && !r.out.includes('land: . pushed') && tip(s.origin('sub'), 'lane/demo') === tip(s.sub, 'lane/demo'), say(r));
}

group('Land refused');
{
  const s = scaffold('refused');
  lane(s.repo, 'begin', 'demo');
  laneWork(s);
  git(s.sub, 'switch', '-q', 'main');
  commit(s.sub, 'diverged.txt', 'x\n');
  git(s.sub, 'switch', '-q', 'lane/demo');
  const before = three(s).map((dir) => tip(dir, 'main')).join();
  const r = lane(s.repo, 'land', 'demo');
  check('a diverged extra base exits 6', r.code === 6 && r.err.includes('sub'), say(r));
  check('and every base is where it was', before === three(s).map((dir) => tip(dir, 'main')).join());
  check('the record stays open', record(s).includes('state: open'));
}

group('PR route');
{
  const s = scaffold('pr');
  lane(s.repo, 'begin', 'demo');
  laneWork(s);
  const codeMain = tip(s.repo, 'main');
  const r = lane(s.repo, 'land', 'demo', '--code-landed');
  check('land --code-landed exits 0', r.code === 0, say(r));
  check('the extra repo and scratch landed', tip(s.sub, 'main') === tip(s.sub, 'lane/demo') && tip(s.scratch, 'main') === tip(s.scratch, 'lane/demo'));
  check('the code base is not moved, and the code repo ends on it', tip(s.repo, 'main') === codeMain && on(s.repo) === 'main' && r.out.includes('switched: .'), say(r));
  check('the closing line says PR', /Closed: lands on main at [0-9a-f]{7} by PR/.test(record(s, 'archive')), record(s, 'archive'));
  const t = scaffold('pr-dirty');
  lane(t.repo, 'begin', 'demo');
  laneWork(t);
  writeFileSync(join(t.repo, 'app.txt'), 'uncommitted\n');
  const dirty = lane(t.repo, 'land', 'demo', '--code-landed');
  check('with uncommitted changes the code repo stays on the lane branch, and land says so', dirty.code === 0 && on(t.repo) === 'lane/demo' && dirty.out.includes('land: . has uncommitted changes, left on lane/demo') && on(t.sub) === 'main', say(dirty));
}

group('Abandon');
{
  const s = scaffold('abandon', { rows: [['sub', 'main'], ['other', 'main']] });
  let r = lane(s.repo, 'begin', 'demo');
  check('begin records the absent repo as pending beside the extra', r.code === 0 && record(s).includes('\npending: other:main\n') && record(s).includes('\nextras: sub:main:'), say(r));
  laneWork(s);
  const other = join(s.repo, 'other');
  mkdirSync(other);
  git(other, 'init', '-q');
  commit(other, 'o.txt', 'o\n');
  const bases = three(s).map((dir) => tip(dir, 'main')).join();
  r = lane(s.repo, 'abandon', 'demo', '--reason', 'x');
  check('abandon exits 0', r.code === 0, say(r));
  check('every lane repo is on its base, which did not move', three(s).every((dir) => on(dir) === 'main') && bases === three(s).map((dir) => tip(dir, 'main')).join());
  check('the record is archived with its Abandoned line', record(s, 'archive').includes(': Abandoned: x'), record(s, 'archive'));
  check('a pending repo present in the checkout is untouched', on(other) === 'main' && tryGit(other, 'rev-parse', '--verify', '-q', 'lane/demo').code !== 0 && r.out.includes('abandon: other pending, left as it is'), say(r));
}

// ── failure modes ────────────────────────────────────────────────────────────────────────────
group('Failure modes');
{
  let s = scaffold('bad-row', { rows: [['../x', 'main']] });
  let r = lane(s.repo, 'begin', 'demo');
  check('a path that leaves the checkout exits 2 before any repo is touched', r.code === 2 && three(s).every((dir) => on(dir) === 'main'), say(r));

  for (const [name, path] of [['dot-row', './sub'], ['dots-row', 'a..b'], ['scratch-row', './scratch'], ['scratch-case-row', 'Scratch/x']]) {
    s = scaffold(name, { rows: [['sub', 'main'], [path, 'main']] });
    r = lane(s.repo, 'begin', 'demo');
    check(`a row whose path is ${path} exits 2 before any repo is touched`, r.code === 2 && r.err.includes('not a lane repo path') && three(s).every((dir) => on(dir) === 'main'), say(r));
  }

  s = scaffold('bad-neighbour');
  git(s.scratch, 'switch', '-q', '-c', 'lane/other');
  commit(s.scratch, 'L-other/README.md', '---\nprimary: other\nbase: main\nbranch: lane/other\nextras: not-an-entry\n---\n');
  git(s.scratch, 'switch', '-q', 'main');
  r = lane(s.repo, 'held', 'demo');
  const began = lane(s.repo, 'begin', 'demo');
  check('another lane\'s malformed record stops neither held nor begin', r.code === 0 && began.code === 0 && on(s.sub) === 'lane/demo', `${say(r)} / ${say(began)}`);
  rmSync(s.sub, { recursive: true, force: true });
  r = lane(s.repo, 'catch-up');
  check('catch-up with a lane repo gone exits 2 naming it', r.code === 2 && r.err.includes('lane repo sub is not in this checkout'), say(r));

  s = scaffold('odd-branch');
  lane(s.repo, 'begin', 'demo', '--branch', 'lane/de;mo');
  r = lane(s.repo, 'diff');
  check('diff quotes a branch that holds a shell metacharacter', r.code === 0 && r.out.includes("diff: sub git -C sub diff 'main...lane/de;mo'"), say(r));

  s = scaffold('symlink-parent', { rows: [['link/sub', 'main']] });
  mkdirSync(join(s.dir, 'out'));
  symlinkSync(join(s.dir, 'out'), join(s.repo, 'link'));
  r = lane(s.repo, 'begin', 'demo');
  check('a listed path not there yet, under a symlink out of the checkout, exits 2 before any repo is touched', r.code === 2 && r.err.includes('leaves the checkout') && on(s.repo) === 'main' && on(s.scratch) === 'main', say(r));

  s = scaffold('bad-epic');
  git(s.scratch, 'switch', '-q', '-c', 'lane/big');
  commit(s.scratch, 'L-big/README.md', '---\nprimary: big;id\nbase: main\nbranch: lane/big\n---\n');
  git(s.scratch, 'switch', '-q', 'main');
  commit(s.scratch, 'issues/demo.md', '---\nslug: demo\nstatus: open\nepic: big;id\n---\n## Summary\nx\n');
  for (const dir of [s.repo, s.sub]) git(dir, 'branch', '-q', 'lane/big');
  r = lane(s.repo, 'begin', 'demo', '--base', 'lane/big');
  check('a primary that is not a slug is never written as the record\'s epic', !record(s).includes('epic:') && !record(s).includes('big;id'), `${say(r)} / ${record(s)}`);

  s = scaffold('bad-blocker');
  commit(s.scratch, 'issues/demo.md', '---\nslug: demo\nstatus: open\nblocked_by: ../../notes\n---\n');
  r = lane(s.repo, 'begin', 'demo');
  check('a blocked_by value that is not a slug exits 2', r.code === 2 && r.err.includes('not an issue slug'), say(r));

  s = scaffold('key-order', { sub: 'absent', rows: [['sub', 'main'], ['other', 'main']] });
  lane(s.repo, 'begin', 'demo');
  git(s.repo, 'clone', '-q', s.origin('sub'), 'sub');
  lane(s.repo, 'add-repo', 'sub');
  check('add-repo writes extras before the pending key that stays', /\nextras: sub:main:[0-9a-f]{40}\npending: other:main\nworkstream: /.test(record(s)), record(s));
  git(s.sub, 'switch', '-q', 'main');
  git(s.sub, 'branch', '-q', '-D', 'lane/demo');
  git(s.sub, 'update-ref', '-d', 'refs/remotes/origin/lane/demo');
  r = lane(s.repo, 'abandon', 'demo', '--reason', 'x');
  check('abandon skips a repo that has no lane branch', r.code === 0 && r.out.includes('abandon: sub has no branch lane/demo, skipped') && on(s.repo) === 'main', say(r));

  s = scaffold('both');
  mkdirSync(join(s.repo, '.claude'));
  writeFileSync(join(s.repo, '.claude', 'CLAUDE.md'), '| Lane repo | Base |\n|---|---|\n| sub | main |\n');
  r = lane(s.repo, 'begin', 'demo');
  check('a table in both CLAUDE.md files exits 2', r.code === 2 && r.err.includes('both') && on(s.repo) === 'main', say(r));

  s = scaffold('elsewhere');
  git(s.sub, 'switch', '-q', '-c', 'feature');
  r = lane(s.repo, 'begin', 'demo');
  check('a listed repo on another branch exits 2 naming it', r.code === 2 && r.err.includes('sub is on feature') && on(s.repo) === 'main' && on(s.scratch) === 'main', say(r));

  s = scaffold('closed');
  commit(s.scratch, 'issues/demo.md', '---\nslug: demo\nstatus: fixed\n---\n');
  r = lane(s.repo, 'begin', 'demo');
  check('an issue that is not open exits 2', r.code === 2 && r.err.includes('not open'), say(r));
  r = lane(s.repo, 'begin', 'missing');
  check('a missing issue exits 2', r.code === 2 && r.err.includes('capture-issue'), say(r));

  s = scaffold('blocked');
  commit(s.scratch, 'issues/demo.md', '---\nslug: demo\nstatus: open\nblocked_by: first\n---\n');
  commit(s.scratch, 'issues/first.md', '---\nslug: first\nstatus: deferred\n---\n');
  r = lane(s.repo, 'begin', 'demo');
  check('an unsettled blocker exits 2', r.code === 2 && r.err.includes('blocked by first'), say(r));

  s = scaffold('no-scratch-mjs');
  const copy = join(s.dir, 'skills', 'lane-methodology', 'scripts', 'lane.mjs');
  mkdirSync(dirname(copy), { recursive: true });
  cpSync(LANE, copy);
  r = run(s.repo, process.execPath, [copy, 'begin', 'demo']);
  check('begin needs no scratch.mjs', r.code === 0 && on(s.sub) === 'lane/demo', say(r));
  laneWork(s);
  const codeMain = tip(s.repo, 'main');
  r = run(s.repo, process.execPath, [copy, 'land', 'demo']);
  check('scratch.mjs missing beside the skill exits 2 before anything moves', r.code === 2 && r.err.includes('scratch.mjs') && tip(s.repo, 'main') === codeMain && tip(s.sub, 'main') !== tip(s.sub, 'lane/demo'), say(r));

  s = scaffold('symlink', { sub: 'absent' });
  const outside = join(s.dir, 'outside');
  git(s.dir, 'clone', '-q', s.origin('sub'), 'outside');
  symlinkSync(outside, s.sub);
  r = lane(s.repo, 'begin', 'demo');
  check('a listed path that is a symlink out of the checkout exits 2 before any repo is touched', r.code === 2 && r.err.includes('leaves the checkout') && on(s.repo) === 'main' && on(outside) === 'main', say(r));
  r = lane(s.repo, 'open', 'demo', '--no-launch');
  check('open refuses it too and makes no worktree', r.code === 2 && r.err.includes('leaves the checkout') && !existsSync(join(s.dir, 'repo-demo')), say(r));

  s = scaffold('symlink-pending', { sub: 'absent' });
  lane(s.repo, 'begin', 'demo');
  git(s.dir, 'clone', '-q', s.origin('sub'), 'outside');
  symlinkSync(join(s.dir, 'outside'), s.sub);
  r = lane(s.repo, 'catch-up');
  const r2 = lane(s.repo, 'add-repo', 'sub');
  check('a pending path that turns up as a symlink out of the checkout is refused by catch-up and add-repo', r.code === 2 && r2.code === 2 && r.err.includes('leaves the checkout') && tryGit(join(s.dir, 'outside'), 'rev-parse', '--verify', '-q', 'lane/demo').code !== 0 && record(s).includes('pending: sub:main'), `${say(r)} / ${say(r2)}`);

  s = scaffold('resume-missing');
  lane(s.repo, 'begin', 'demo');
  git(s.repo, 'switch', '-q', 'main');
  git(s.scratch, 'switch', '-q', 'main');
  rmSync(s.sub, { recursive: true, force: true });
  r = lane(s.repo, 'begin', 'demo');
  check('a resume with a lane repo gone exits 2 with nothing switched', r.code === 2 && r.err.includes('sub is not in this checkout') && on(s.repo) === 'main' && on(s.scratch) === 'main', say(r));
  r = lane(s.repo, 'land', 'demo');
  check('land of it exits 2 with nothing switched', r.code === 2 && on(s.repo) === 'main' && on(s.scratch) === 'main', say(r));
  r = lane(s.repo, 'abandon', 'demo', '--reason', 'sub is gone');
  check('abandon goes on without the repo that is gone', r.code === 0 && r.out.includes('abandon: sub absent, skipped') && on(s.repo) === 'main' && on(s.scratch) === 'main' && record(s, 'archive').includes('Abandoned: sub is gone'), say(r));

  s = scaffold('symlink-main');
  const wt2 = join(s.dir, 'wt2');
  git(s.repo, 'worktree', 'add', '-q', '--detach', wt2, 'HEAD');
  git(wt2, 'clone', '-q', s.origin('scratch'), 'scratch');
  git(wt2, 'clone', '-q', s.origin('sub'), 'sub');
  git(s.dir, 'clone', '-q', s.origin('sub'), 'outside');
  rmSync(s.sub, { recursive: true, force: true });
  symlinkSync(join(s.dir, 'outside'), s.sub);
  lane(wt2, 'begin', 'demo');
  commit(join(wt2, 'sub'), 'lib.txt', 'lib on the lane\n');
  const outsideMain = tip(join(s.dir, 'outside'), 'main');
  r = lane(wt2, 'catch-up');
  const landed = lane(wt2, 'land', 'demo');
  check('a symlink at the main checkout\'s copy is refused by catch-up and land', r.code === 2 && landed.code === 2 && r.err.includes('leaves the checkout') && landed.err.includes('leaves the checkout') && tip(join(s.dir, 'outside'), 'main') === outsideMain && on(join(wt2, 'sub')) === 'lane/demo', `${say(r)} / ${say(landed)}`);
  check('and land moved no base', tip(s.repo, 'main') === tip(s.repo, 'origin/main'));

  s = scaffold('scratch-symlink');
  git(s.dir, 'clone', '-q', s.origin('scratch'), 'scratch-elsewhere');
  rmSync(s.scratch, { recursive: true, force: true });
  symlinkSync(join(s.dir, 'scratch-elsewhere'), s.scratch);
  r = lane(s.repo, 'begin', 'demo');
  check('a clone checkout whose scratch/ is a symlink out of it begins', r.code === 0 && three(s).every((dir) => on(dir) === 'lane/demo'), say(r));
  r = lane(s.repo, 'catch-up');
  check('catches up', r.code === 0, say(r));
  r = lane(s.repo, 'abandon', 'demo', '--reason', 'x');
  check('and abandons, every repo back on its base', r.code === 0 && three(s).every((dir) => on(dir) === 'main') && record(s, 'archive').includes('Abandoned: x'), say(r));

  s = scaffold('abandon-refused');
  lane(s.repo, 'begin', 'demo');
  git(s.scratch, 'mv', '.scratch-config.json', 'config.bak');
  git(s.scratch, 'commit', '-qm', 'hide the config');
  r = lane(s.repo, 'abandon', 'demo', '--reason', 'x');
  check('abandon the archive would refuse exits 2 with no line written', r.code === 2 && !record(s).includes('Abandoned:') && on(s.repo) === 'lane/demo', say(r));
  git(s.scratch, 'mv', 'config.bak', '.scratch-config.json');
  git(s.scratch, 'commit', '-qm', 'restore the config');
  r = lane(s.repo, 'abandon', 'demo', '--reason', 'x');
  check('run again it archives the record with one Abandoned line', r.code === 0 && record(s, 'archive').split('Abandoned: x').length === 2, say(r));

  s = scaffold('no-config');
  lane(s.repo, 'begin', 'demo');
  laneWork(s);
  git(s.scratch, 'rm', '-q', '.scratch-config.json');
  git(s.scratch, 'commit', '-qm', 'drop the config');
  r = lane(s.repo, 'land', 'demo');
  check('a scratch with no config exits 2 before anything moves', r.code === 2 && r.err.includes('.scratch-config.json') && tip(s.sub, 'main') !== tip(s.sub, 'lane/demo'), say(r));

  s = scaffold('hang');
  lane(s.repo, 'begin', 'demo');
  git(s.sub, 'remote', 'set-url', 'origin', 'ext::sleep 30');
  const started = Date.now();
  r = run(s.repo, process.execPath, [LANE, 'push'], { ...ENV, SCRATCH_NET_TIMEOUT: '1' });
  check('a network call that hangs times out with exit 2', r.code === 2 && r.err.includes('timed out after 1s') && Date.now() - started < 15000, say(r));
}

// ── worktree lane ────────────────────────────────────────────────────────────────────────────
group('Worktree lane');
{
  const s = scaffold('sp ace');
  const wt = join(s.dir, 'repo-demo');
  const parts = [wt, join(wt, 'scratch'), join(wt, 'sub')];
  let r = lane(s.repo, 'open', 'demo', '--no-launch');
  check('open --no-launch exits 0 and prints the sibling path, space kept', r.code === 0 && r.out.includes(`worktree: ${wt}`) && r.out.includes('head: detached'), say(r));
  check('code, scratch and the extra repo are each a detached worktree', parts.every((dir) => on(dir) === '' && git(dir, 'rev-parse', '--git-dir') !== git(dir, 'rev-parse', '--git-common-dir')));
  check('each a worktree of the main checkout\'s repo', git(join(wt, 'sub'), 'rev-parse', '--path-format=absolute', '--git-common-dir') === join(s.sub, '.git') && git(join(wt, 'scratch'), 'rev-parse', '--path-format=absolute', '--git-common-dir') === join(s.scratch, '.git'));
  check('scratch is detached at the scratch main', tip(join(wt, 'scratch'), 'HEAD') === tip(s.scratch, 'main'));
  check('updateInstead is set in all three repos', three(s).every((dir) => git(dir, 'config', 'receive.denyCurrentBranch') === 'updateInstead'));
  r = lane(s.repo, 'open', 'demo', '--no-launch');
  check('a second open reuses it', r.code === 0 && r.out.includes('worktree reused') && r.out.includes(`worktree: ${wt}`), say(r));
  r = lane(s.repo, 'open', 'demo', '--dry-run', '--', '--continue');
  check('open --dry-run prints the claude command ending in /begin-lane', r.code === 0 && r.out.endsWith("claude --continue '/begin-lane demo'"), say(r));
  mkdirSync(join(TMP, 'bin'), { recursive: true });
  writeFileSync(join(TMP, 'bin', 'claude'), '#!/bin/sh\necho "stub $(pwd) $*"\nexit 7\n');
  chmodSync(join(TMP, 'bin', 'claude'), 0o755);
  r = run(s.repo, process.execPath, [LANE, 'open', 'demo'], { ...ENV, PATH: `${join(TMP, 'bin')}:${process.env.PATH}` });
  check('open starts claude in the worktree with /begin-lane and returns its exit code', r.code === 7 && r.out.includes(`stub ${wt} /begin-lane demo`), say(r));

  r = lane(wt, 'begin', 'demo');
  check('begin in the worktree puts all three on lane/demo', r.code === 0 && parts.every((dir) => on(dir) === 'lane/demo'), say(r));
  r = lane(s.repo, 'open', 'demo', '--no-launch');
  check('open on a begun lane prints its branch', r.out.includes('head: lane/demo'), say(r));

  group('Held elsewhere');
  r = lane(s.repo, 'held', 'demo');
  check('held from the main checkout exits 4 naming the worktree', r.code === 4 && r.err.includes(`HELD: demo is held by lane demo on lane/demo`) && r.err.includes(wt), say(r));
  r = lane(s.repo, 'begin', 'demo');
  check('begin from the main checkout exits 4', r.code === 4 && on(s.repo) === 'main', say(r));
  r = lane(s.repo, 'land', 'demo');
  check('land from a checkout that does not hold the lane exits 2', r.code === 2 && r.err.includes(wt), say(r));
  r = lane(s.repo, 'abandon', 'demo', '--reason', 'x');
  check('abandon from there exits 2', r.code === 2, say(r));

  group('Land resumed');
  laneWork({ repo: wt, scratch: parts[1], sub: parts[2] });
  writeFileSync(join(s.scratch, 'notes.md'), 'another session\n');
  const scratchMain = tip(s.scratch, 'main');
  r = lane(wt, 'land', 'demo');
  check('a scratch push refused by a dirty base checkout exits 2 naming it', r.code === 2 && r.err.includes(s.scratch), say(r));
  check('with the extra repo and the code landed', tip(s.repo, 'main') === tip(s.repo, 'lane/demo') && tip(s.sub, 'main') === tip(s.sub, 'lane/demo'));
  check('the main checkout\'s files updated by the push', readFileSync(join(s.repo, 'app.txt'), 'utf-8') === 'app on the lane\n' && readFileSync(join(s.sub, 'lib.txt'), 'utf-8') === 'lib on the lane\n');
  check('the record archived and scratch main unmoved', record(s, 'archive').includes('Closed: lands on main') && tip(s.scratch, 'main') === scratchMain);
  writeFileSync(join(s.scratch, 'notes.md'), 'notes\n');
  commit(s.scratch, 'cleared.md', 'moved main\n');
  r = lane(wt, 'land', 'demo');
  check('once clean, land merges the moved scratch main, lands scratch and exits 0', r.code === 0 && r.out.includes('land: scratch merged main') && tip(s.scratch, 'main') === tip(s.scratch, 'lane/demo') && existsSync(join(s.scratch, 'cleared.md')), say(r));
  check('each worktree stays on its lane branch', parts.every((dir) => on(dir) === 'lane/demo'));
  r = lane(wt, 'land', 'demo');
  check('land again exits 0 having moved nothing', r.code === 0 && r.out.includes('already landed'), say(r));

  group('Remove');
  r = run(wt, process.execPath, [LANE, 'remove', 'demo']);
  check('remove from inside the worktree exits 2', r.code === 2 && r.err.includes('from outside'), say(r));
  const vendor = join(wt, 'vendor');
  mkdirSync(vendor);
  git(vendor, 'init', '-q');
  commit(vendor, 'v.txt', 'v\n');
  r = lane(s.repo, 'remove', 'demo');
  check('remove refuses while a nested clone holds a commit on no remote', r.code === 2 && r.err.includes(`${vendor} has commits on no remote`) && existsSync(join(wt, 'sub')), say(r));
  rmSync(vendor, { recursive: true, force: true });
  const sample = join(wt, 'sample');
  git(wt, 'clone', '-q', s.origin('sub'), 'sample');
  writeFileSync(join(s.dir, 'hook.sh'), `#!/bin/sh\ntouch '${join(s.dir, 'hook-ran')}'\n`);
  chmodSync(join(s.dir, 'hook.sh'), 0o755);
  git(sample, 'config', 'core.fsmonitor', `'${join(s.dir, 'hook.sh')}'`);
  write(git(wt, 'rev-parse', '--path-format=absolute', '--git-path', 'info/exclude'), 'sample/\n');
  git(sample, 'status', '--porcelain');
  const hookWorks = existsSync(join(s.dir, 'hook-ran'));
  rmSync(join(s.dir, 'hook-ran'), { force: true });
  writeFileSync(join(sample, 'wip.txt'), 'wip\n');
  r = lane(s.repo, 'remove', 'demo');
  check('remove runs no program a nested repo\'s config names', r.code === 2 && r.err.includes(`${sample} has uncommitted changes`) && hookWorks && !existsSync(join(s.dir, 'hook-ran')), say(r));
  rmSync(sample, { recursive: true, force: true });
  writeFileSync(join(wt, 'sub', 'wip.txt'), 'wip\n');
  r = lane(s.repo, 'remove', 'demo');
  check('remove refuses a dirty extra worktree', r.code === 2 && r.err.includes(`${join(wt, 'sub')} has uncommitted changes`), say(r));
  rmSync(join(wt, 'sub', 'wip.txt'));
  r = lane(s.repo, 'remove', 'demo');
  check('clean, remove takes down all three worktrees', r.code === 0 && !existsSync(wt) && three(s).every((dir) => !git(dir, 'worktree', 'list', '--porcelain').includes(wt)), say(r));
  check('and keeps the branches', three(s).every((dir) => tryGit(dir, 'rev-parse', '--verify', '-q', 'lane/demo').code === 0));
  r = lane(s.repo, 'remove', 'demo');
  check('remove of no worktree exits 2', r.code === 2 && r.err.includes('is not a worktree of this repo'), say(r));

  group('Open refusals');
  mkdirSync(join(s.dir, 'repo-squat'));
  r = lane(s.repo, 'open', 'squat', '--no-launch');
  check('a path that is not a registered worktree exits 2', r.code === 2 && r.err.includes('not a worktree of this repo'), say(r));
  r = lane(s.repo, 'open', 'Bad_Slug', '--no-launch');
  check('a bad slug exits 1', r.code === 1, say(r));

  const u = scaffold('open-scratch-symlink');
  git(u.dir, 'clone', '-q', u.origin('scratch'), 'scratch-elsewhere');
  rmSync(u.scratch, { recursive: true, force: true });
  symlinkSync(join(u.dir, 'scratch-elsewhere'), u.scratch);
  r = lane(u.repo, 'open', 'demo', '--no-launch');
  check('open accepts a main checkout whose scratch/ is a symlink out of it', r.code === 0 && on(join(u.dir, 'repo-demo', 'scratch')) === '' && existsSync(join(u.dir, 'repo-demo', 'scratch', 'issues')), say(r));

  const t = scaffold('open-record');
  lane(t.repo, 'open', 'demo', '--no-launch');
  lane(join(t.dir, 'repo-demo'), 'begin', 'demo');
  r = lane(t.repo, 'remove', 'demo');
  check('remove refuses while the lane record is open', r.code === 2 && r.err.includes('still open (scratch/L-demo/README.md)'), say(r));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
