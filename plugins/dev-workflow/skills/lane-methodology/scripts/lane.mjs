#!/usr/bin/env node
/**
 * lane — the mechanical steps of a lane, run the same way in every lane repo.
 *
 * A lane's repos are the code repo, scratch/, and each extra lane repo the repo's CLAUDE.md lists
 * in its `| Lane repo | Base |` table. The lane-methodology pages call this script by path and
 * read its exit code; the judgment (names, conflicts, the merge review) stays on the pages.
 *
 * Usage: node lane.mjs [--verbose] <verb> | -h | --help
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRATCH_MJS = join(HERE, '..', '..', 'scratch-management', 'scratch.mjs');

const SLUG = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const SHA = /^[0-9a-f]{40}$/;
const REPO_PATH = /^[A-Za-z0-9._/@+-]+$/;
const SETTLED = ['wont-fix', 'fixed', 'accepted', 'moved', 'settled'];

const HELP = `Usage: node lane.mjs [--verbose] <verb> | -h | --help
  open <slug> [--no-launch] [--dry-run] [-- <claude args>]
  remove <slug>
  begin <slug> [--name <lane>] [--base <branch>] [--branch <name>] [--workstream <slug>] [--take-over]
  add-repo <path>
  push | catch-up | diff | log | status | held <issue>
  land <lane> [--code-landed]
  abandon <lane> --reason <text>

Each verb acts on every lane repo (the code repo, scratch/, each extra lane repo) and prints one
line per repo it acted on, plus "switched: {repo}" for each repo it switched.

Exit codes:
  0  done
  1  usage error
  2  a check failed or git refused; one line on stderr names it
  3  a merge conflict in one repo, left in progress (catch-up, land's scratch stage)
  4  the issue or lane is held elsewhere
  5  the lane name is taken
  6  land only: a base moved, so a lane branch cannot fast-forward; no base moved

Environment:
  SCRATCH_NET_TIMEOUT  Seconds each fetch or push to origin may run (default 60)`;

class Stop extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const stop = (message, code = 2) => { throw new Stop(code, message); };
const usage = (message) => { throw new Stop(1, `${message}\nRun with --help for usage.`); };

let verbose = false;
const say = (line) => console.log(line);

// ── git ──────────────────────────────────────────────────────────────────────────────────────

/**
 * A program's full path on Windows, where a bare name is looked up in the child's working
 * directory before PATH, so a lane repo carrying its own git.exe would have it run. Elsewhere the name.
 * `$PATH:name` keeps where.exe to PATH, since a bare name has it search the current directory first.
 */
const found = {};
function onPath(name) {
  if (process.platform !== 'win32') return name;
  if (!(name in found)) {
    const where = spawnSync(`${process.env.SystemRoot || 'C:\\Windows'}\\System32\\where.exe`, [`$PATH:${name}`], { encoding: 'utf-8' });
    found[name] = (where.stdout || '').split(/\r?\n/).find(Boolean) || '';
  }
  return found[name];
}

function git(cwd, args, options = {}) {
  if (verbose) console.error(`+ git -C ${cwd} ${args.join(' ')}`);
  const result = spawnSync(onPath('git') || 'git', args, { cwd, encoding: 'utf-8', shell: false, input: options.input });
  if (result.error) stop(`could not run git: ${result.error.message}`);
  return {
    ok: result.status === 0,
    out: (result.stdout || '').replace(/\s+$/, ''),
    err: (result.stderr || '').trim(),
  };
}

/** Run git and stop the run with its own message when it refuses. */
function must(cwd, args, what) {
  const result = git(cwd, args);
  if (!result.ok) stop(`${what || `git ${args.join(' ')}`} failed in ${cwd}: ${oneLine(result.err || result.out)}`);
  return result.out;
}

const shq = (arg) => (/^[A-Za-z0-9_./:,=@+-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`);
const oneLine = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean).join('; ');
const has = (cwd, ref) => git(cwd, ['rev-parse', '--verify', '-q', `${ref}^{commit}`]).ok;
const tip = (cwd, ref) => must(cwd, ['rev-parse', '--verify', `${ref}^{commit}`]);
const short = (sha) => sha.slice(0, 7);
const isAncestor = (cwd, a, b) => git(cwd, ['merge-base', '--is-ancestor', a, b]).ok;
const currentBranch = (cwd) => git(cwd, ['branch', '--show-current']).out;
const hasOrigin = (cwd) => git(cwd, ['remote', 'get-url', 'origin']).ok;
const isLinkedWorktree = (cwd) =>
  absGit(cwd, '--git-dir') !== absGit(cwd, '--git-common-dir');
const absGit = (cwd, flag) => must(cwd, ['rev-parse', '--path-format=absolute', flag]);
const validBranch = (name) => typeof name === 'string' && name !== '' && !name.includes(',') &&
  git(process.cwd(), ['check-ref-format', '--branch', name]).ok;

/** A git repo whose top level is this directory, not a folder inside its parent's repo. */
function isRepoRoot(dir) {
  if (!existsSync(join(dir, '.git'))) return false;
  const top = git(dir, ['rev-parse', '--show-toplevel']);
  return top.ok && realpathSync(top.out) === realpathSync(dir);
}

function netTimeoutSeconds() {
  const raw = process.env.SCRATCH_NET_TIMEOUT;
  if (raw === undefined) return 60;
  // setTimeout fires at once past 2^31-1 ms, so a larger value would time out every call.
  if (!/^[1-9][0-9]*$/.test(raw) || Number(raw) > 2147483) {
    stop(`SCRATCH_NET_TIMEOUT must be a whole number of seconds from 1 to 2147483, not '${raw}'`);
  }
  return Number(raw);
}

/**
 * A fetch or push to origin, with a timeout and a non-interactive SSH. On expiry it kills the whole
 * process tree, since an ssh grandchild holding the pipes keeps the call open past a kill of git alone.
 */
function netGit(cwd, args) {
  const seconds = netTimeoutSeconds();
  if (verbose) console.error(`+ git -C ${cwd} ${args.join(' ')}`);
  const env = { ...process.env };
  if (!env.GIT_SSH_COMMAND && !git(cwd, ['config', '--get', 'core.sshCommand']).out) {
    env.GIT_SSH_COMMAND = 'ssh -o ConnectTimeout=15 -o ServerAliveInterval=15 -o BatchMode=yes';
  }
  const isWindows = process.platform === 'win32';
  return new Promise((done) => {
    const child = spawn(onPath('git') || 'git', args, { cwd, env, shell: false, detached: !isWindows, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    const killTree = () => {
      try {
        if (isWindows) spawnSync(`${process.env.SystemRoot || 'C:\\Windows'}\\System32\\taskkill.exe`, ['/T', '/F', '/PID', String(child.pid)]);
        else process.kill(-child.pid, 'SIGKILL');
      } catch { /* the tree already exited */ }
    };
    // The detached group misses a terminal Ctrl+C, so pass an interrupt on to it before exiting.
    const onSignal = (signal) => { killTree(); process.exit(signal === 'SIGINT' ? 130 : 143); };
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    const settle = (result) => {
      clearTimeout(timer);
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      done(result);
    };
    const timer = setTimeout(() => {
      killTree();
      settle({ ok: false, out: '', err: `timed out after ${seconds}s` });
    }, seconds * 1000);
    child.on('error', (error) => settle({ ok: false, out: '', err: error.message }));
    child.on('close', (code) => settle({ ok: code === 0, out: out.trim(), err: err.trim() }));
  });
}

async function fetchOrigin(dir) {
  if (!hasOrigin(dir)) return;
  const fetched = await netGit(dir, ['fetch', '-q', 'origin']);
  if (!fetched.ok) stop(`git fetch origin failed in ${dir}: ${oneLine(fetched.err)}`);
}

// ── the checkout ─────────────────────────────────────────────────────────────────────────────

/** The checkout, resolved at first use so a wrong call exits 1 wherever it is made. */
function checkout() {
  let resolved = null;
  const get = (key) => {
    if (!resolved) {
      const top = git(process.cwd(), ['rev-parse', '--show-toplevel']);
      if (!top.ok) stop('not inside a git repo');
      const root = realpathSync(top.out);
      const first = must(root, ['worktree', 'list', '--porcelain']).split('\n')[0].replace(/^worktree /, '');
      resolved = { root, scratch: join(root, 'scratch'), main: existsSync(first) ? realpathSync(first) : first };
    }
    return resolved[key];
  };
  return { get root() { return get('root'); }, get scratch() { return get('scratch'); }, get main() { return get('main'); } };
}

/** Rows of the `| Lane repo | Base |` table in CLAUDE.md, else .claude/CLAUDE.md. */
function readTable(root) {
  const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim().replace(/^`|`$/g, ''));
  const isHeader = (line) => /^\s*\|\s*Lane repo\s*\|\s*Base\s*\|\s*$/.test(line);
  const found = ['CLAUDE.md', join('.claude', 'CLAUDE.md')]
    .filter((file) => existsSync(join(root, file)))
    .map((file) => ({ file, lines: readFileSync(join(root, file), 'utf-8').split(/\r?\n/) }))
    .filter(({ lines }) => lines.some(isHeader));
  if (found.length > 1) stop('both CLAUDE.md and .claude/CLAUDE.md carry a lane repos table; keep one');
  if (!found.length) return [];
  const { file, lines } = found[0];
  if (lines.filter(isHeader).length > 1) stop(`${file} carries more than one lane repos table`);
  const rows = [];
  for (let i = lines.findIndex(isHeader) + 1; i < lines.length && lines[i].trim().startsWith('|'); i += 1) {
    if (/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) continue;
    const row = cells(lines[i]);
    if (row.length !== 2) stop(`${file}: lane repos row is not "| path | base |": ${lines[i].trim()}`);
    const [path, base] = [row[0].replace(/\/+$/, ''), row[1]];
    checkRepoPath(path, file);
    if (!validBranch(base)) stop(`${file}: lane repo ${path} has a base that is not a branch name: '${base}'`);
    const dir = repoDir(root, path);
    // By the folder itself too, so a second spelling, or another letter case where case does not count, names no repo twice.
    const same = (other) => other === dir || (existsSync(other) && existsSync(dir) && sameFolder(other, dir));
    if (same(join(root, 'scratch'))) stop(`${file}: '${path}' is scratch, which is already a lane repo`);
    if (rows.some((other) => same(join(root, other.path)))) stop(`${file}: lane repo ${path} is listed twice`);
    rows.push({ path, base });
  }
  return rows;
}

function sameFolder(a, b) {
  const [x, y] = [statSync(a, { bigint: true }), statSync(b, { bigint: true })];
  return x.dev === y.dev && x.ino === y.ino;
}

function checkRepoPath(path, where) {
  const bad = !REPO_PATH.test(path) || path.includes('..') || path.startsWith('/') || path.startsWith('-') ||
    path.split('/').some((part) => part === '' || part === '.') || /^scratch(\/|$)/i.test(path);
  if (bad) stop(`${where}: '${path}' is not a lane repo path`);
}

/**
 * Where a lane repo's path lands under a checkout root. Stops when it resolves outside that root,
 * as a symlink at the path would: every verb would otherwise branch, merge and push a repo the
 * checkout does not hold. Called for every path from the table and from a record.
 */
function repoDir(root, path) {
  const dir = join(root, path);
  // A path not there yet is judged by its nearest folder that is, since a worktree may be made at it.
  let at = dir;
  while (!existsSync(at) && dirname(at) !== at) at = dirname(at);
  const [realRoot, real] = [realpathSync(root), realpathSync(at)];
  if (!inside(realRoot, real) && !(at !== dir && real === realRoot)) stop(`lane repo ${path} leaves the checkout at ${root}`);
  return dir;
}

const inside = (parent, child) => { const rel = relative(parent, child); return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel); };

// ── the record ───────────────────────────────────────────────────────────────────────────────

function parseRecord(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([a-z_]+):[ \t]*(.*?)[ \t]*$/);
    if (pair) fields[pair[1]] = pair[2].replace(/^"(.*)"$/, '$1');
  }
  return fields;
}

const list = (value) => (value ? value.replace(/^\[|\]$/g, '').split(',').map((item) => item.trim()).filter(Boolean) : []);

/** The record's values, each checked before it reaches a command line. */
function readLane(name, text, where) {
  const fields = parseRecord(text);
  if (!fields) stop(`${where} has no frontmatter`);
  const { base, branch, fork } = fields;
  if (!validBranch(base) || !validBranch(branch)) stop(`${where}: base or branch is not a branch name`);
  if (!SHA.test(fork || '') || !SHA.test(fields.scratch_fork || '')) stop(`${where}: fork and scratch_fork must be full commit shas`);
  const extras = list(fields.extras).map((entry) => {
    const [path, extraBase, extraFork] = entry.split(':');
    checkRepoPath(path || '', where);
    if (!validBranch(extraBase) || !SHA.test(extraFork || '')) stop(`${where}: extras entry '${entry}' is not path:base:sha`);
    return { path, base: extraBase, fork: extraFork };
  });
  const pending = list(fields.pending).map((entry) => {
    const [path, pendingBase] = entry.split(':');
    checkRepoPath(path || '', where);
    if (!validBranch(pendingBase)) stop(`${where}: pending entry '${entry}' is not path:base`);
    return { path, base: pendingBase };
  });
  return { name, fields, base, branch, fork, scratchFork: fields.scratch_fork, extras, pending };
}

/** Set, or with an empty value remove, one frontmatter key; a new key goes before `before`. */
function setKey(text, key, value, before) {
  const end = text.indexOf('\n---', 3);
  let head = text.slice(0, end).split('\n');
  const at = head.findIndex((line) => line.startsWith(`${key}:`));
  const line = `${key}: ${value}`;
  if (at >= 0) head.splice(at, 1, ...(value ? [line] : []));
  else if (value) {
    const anchor = head.findIndex((entry) => entry.startsWith(`${before}:`));
    head.splice(anchor >= 0 ? anchor : head.length, 0, line);
  }
  return head.join('\n') + text.slice(end);
}

const extrasValue = (extras) => extras.map((extra) => `${extra.path}:${extra.base}:${extra.fork}`).join(',');
const pendingValue = (pending) => pending.map((entry) => `${entry.path}:${entry.base}`).join(',');

function appendLog(text, line) {
  const lines = text.split('\n');
  const start = lines.findIndex((entry) => entry.trim() === '## Log');
  if (start < 0) return `${text.replace(/\s*$/, '')}\n\n## Log\n${line}\n`;
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith('## ')) end += 1;
  while (end > start + 1 && lines[end - 1].trim() === '') end -= 1;
  lines.splice(end, 0, line);
  return lines.join('\n');
}

const today = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** On a lane (SKILL.md § Claim): scratch/ holds an L-{lane}/README.md whose branch: is the code repo's branch. */
function laneHere(co) {
  const branch = currentBranch(co.root);
  if (!branch || !existsSync(co.scratch)) return null;
  for (const folder of readdirSync(co.scratch).filter((entry) => entry.startsWith('L-')).sort()) {
    const file = join(co.scratch, folder, 'README.md');
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf-8');
    if (!SLUG.test(folder.slice(2)) || (parseRecord(text) || {}).branch !== branch) continue;
    return { ...readLane(folder.slice(2), text, `scratch/${folder}/README.md`), file };
  }
  return null;
}

/** The lane's repos, every one of them present, for a verb that runs git in each. */
function presentRepos(co, lane) {
  const repos = laneRepos(co, lane);
  const missing = repos.find((repo) => !isRepoRoot(repo.dir));
  if (missing) stop(`lane repo ${missing.name} is not in this checkout`);
  return repos;
}

function requireLane(co) {
  const lane = laneHere(co);
  if (!lane) stop('this checkout is not on a lane');
  return lane;
}

/** The lane's repos in the one fixed order: the code repo, scratch, each extra. */
function laneRepos(co, lane) {
  return [
    { name: '.', dir: co.root, base: lane.base, fork: lane.fork },
    { name: 'scratch', dir: co.scratch, base: 'main', fork: lane.scratchFork },
    ...lane.extras.map((extra) => ({ name: extra.path, dir: repoDir(co.root, extra.path), base: extra.base, fork: extra.fork })),
  ];
}

/**
 * Every open lane: a scratch ref whose tip carries a record naming that ref as its branch. Each is
 * read, not checked: fullLane checks the one a verb acts on, so another lane's bad record stops nothing.
 */
function openLanes(co) {
  const lanes = [];
  const refs = must(co.scratch, ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes/origin']).split('\n').filter(Boolean);
  for (const ref of refs) {
    const local = ref.startsWith('refs/heads/');
    const branch = ref.replace(/^refs\/(heads|remotes\/origin)\//, '');
    if (['main', 'master', 'HEAD'].includes(branch)) continue;
    const folders = git(co.scratch, ['ls-tree', '-d', '--name-only', ref]).out.split('\n')
      .filter((entry) => entry.startsWith('L-') && SLUG.test(entry.slice(2)));
    for (const folder of folders) {
      const shown = git(co.scratch, ['show', `${ref}:${folder}/README.md`]);
      const fields = shown.ok ? parseRecord(shown.out) : null;
      if (!fields || fields.branch !== branch) continue;
      const known = lanes.find((lane) => lane.name === folder.slice(2) && lane.branch === branch);
      if (known) known.local = known.local || local;
      else lanes.push({ name: folder.slice(2), branch, fields, local, text: shown.out, where: `${ref}:${folder}/README.md` });
    }
  }
  return lanes;
}

const fullLane = (open) => ({ ...readLane(open.name, open.text, open.where), local: open.local });

/** Who holds an open lane (SKILL.md § Claim): 'here', a worktree path, or 'origin'. */
function holder(co, lane) {
  if (!lane.local) return { where: 'origin', line: `another clone or machine (origin/${lane.branch})` };
  const blocks = must(co.scratch, ['worktree', 'list', '--porcelain']).split('\n\n');
  const here = realpathSync(co.scratch);
  for (const block of blocks) {
    const path = (block.match(/^worktree (.*)$/m) || [])[1];
    if (!path || !block.split('\n').includes(`branch refs/heads/${lane.branch}`)) continue;
    if (existsSync(path) && realpathSync(path) === here) return { where: 'here' };
    return { where: 'worktree', line: `the worktree ${dirname(path)}` };
  }
  return { where: 'here' };
}

function commitRecord(co, lane, text, message, alsoPaths = []) {
  writeFileSync(lane.file, text, 'utf-8');
  const paths = [`L-${lane.name}/README.md`, ...alsoPaths];
  must(co.scratch, ['add', '--', ...paths]);
  must(co.scratch, ['commit', '-q', '-m', message, '--', ...paths]);
}

// ── shared steps ─────────────────────────────────────────────────────────────────────────────

function switchTo(repo, branch, extraArgs = []) {
  must(repo.dir, ['switch', '-q', ...extraArgs, branch], `switching ${repo.name} to ${branch}`);
  say(`switched: ${repo.name}`);
}

async function pushBranches(repos, branch, verb) {
  for (const repo of repos) {
    if (!hasOrigin(repo.dir)) { say(`${verb}: ${repo.name} no remote, nothing pushed`); continue; }
    if (!has(repo.dir, `refs/heads/${branch}`)) continue;
    // The full ref, since git reads a leading + on a bare branch name as a forced update.
    const pushed = await netGit(repo.dir, ['push', '-q', '-u', 'origin', `refs/heads/${branch}`]);
    if (!pushed.ok) stop(`push of ${branch} was refused in ${repo.name}: ${oneLine(pushed.err)}`);
    say(`${verb}: ${repo.name} pushed ${branch} to origin`);
  }
}

function warnSubrepos(co, path) {
  const file = join(co.root, '.subrepos');
  const listed = existsSync(file) && readFileSync(file, 'utf-8').split(/\r?\n/).map((line) => line.trim().replace(/\/+$/, '')).includes(path);
  if (!listed) say(`warning: ${path} is not in .subrepos, so /commit-all will not survey it`);
}

/** Stop unless an extra repo is where a lane may branch it: detached, on its base, or on `also`. */
function checkBranchable(co, entry, branch, also) {
  const dir = repoDir(co.root, entry.path);
  if (!has(dir, `refs/heads/${entry.base}`) && !has(dir, `refs/remotes/origin/${entry.base}`)) stop(`${entry.path} has no branch ${entry.base}`);
  const on = currentBranch(dir);
  if (on && on !== entry.base && on !== also) stop(`${entry.path} is on ${on}, not its base ${entry.base}; nothing was switched`);
  for (const ref of [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`]) {
    if (has(dir, ref)) return ref;
  }
  return null;
}

/** Bring into the lane each pending repo that is now in the checkout. */
async function addPending(co, lane, verb) {
  let added = false;
  for (const entry of [...lane.pending]) {
    if (!isRepoRoot(repoDir(co.root, entry.path))) continue;
    await addRepo(co, lane, entry, verb);
    added = true;
  }
  return added ? requireLane(co) : lane;
}

async function addRepo(co, lane, entry, verb) {
  const dir = repoDir(co.root, entry.path);
  // The record is committed whole below, and the page's secret screen never saw lines not yet committed.
  if (must(co.scratch, ['status', '--porcelain', '--', `L-${lane.name}/README.md`])) {
    stop(`scratch/L-${lane.name}/README.md has uncommitted lines; screen and commit them, then run ${verb} again — ${entry.path} was not added`);
  }
  if (hasOrigin(dir)) await fetchOrigin(dir);
  const taken = checkBranchable(co, entry, lane.branch, null);
  if (taken) stop(`${entry.path} already has ${taken}, which this lane did not make; nothing was switched`);
  must(dir, ['switch', '-q', '-c', lane.branch, has(dir, `refs/heads/${entry.base}`) ? entry.base : `origin/${entry.base}`], `branching ${entry.path}`);
  say(`switched: ${entry.path}`);
  if (!has(dir, `refs/heads/${entry.base}`)) must(dir, ['branch', '--track', entry.base, `origin/${entry.base}`]);
  const extra = { path: entry.path, base: entry.base, fork: tip(dir, entry.base) };
  const extras = [...lane.extras, extra];
  const pending = lane.pending.filter((other) => other.path !== entry.path);
  let text = readFileSync(lane.file, 'utf-8');
  text = setKey(text, 'pending', pendingValue(pending), 'workstream');
  text = setKey(text, 'extras', extrasValue(extras), pending.length ? 'pending' : 'workstream');
  text = appendLog(text, `- ${today()}: Added lane repo ${entry.path} on ${entry.base} at ${short(extra.fork)} — L-${lane.name}/README.md`);
  commitRecord(co, lane, text, `chore(lane): add ${entry.path} to ${lane.name}`);
  say(`${verb}: ${entry.path} on ${lane.branch} from ${entry.base} at ${short(extra.fork)}`);
  warnSubrepos(co, entry.path);
  await pushBranches([{ name: entry.path, dir }, { name: 'scratch', dir: co.scratch }], lane.branch, verb);
}

/** How a lane repo lands on its base, and where that base lives. */
function landing(co, repo) {
  if (isLinkedWorktree(repo.dir)) return { by: 'push', target: '.', baseDir: repo.dir };
  if (co.main === co.root) return { by: 'merge', baseDir: repo.dir };
  // Containment is a rule for a table row's path, so scratch and the checkout itself are joined plain.
  const mainCopy = repo.name === '.' ? co.main
    : repo.name === 'scratch' ? join(co.main, 'scratch') : repoDir(co.main, repo.name);
  if (isRepoRoot(mainCopy)) return { by: 'push', target: mainCopy, baseDir: mainCopy };
  return { by: 'merge', baseDir: repo.dir };
}

/** The base's tip where the lane lands, fetched into the clone when it lives in the main checkout's copy. */
function landingBase(repo, how) {
  if (how.target && how.target !== '.') {
    must(repo.dir, ['fetch', '-q', how.target, repo.base], `fetching ${repo.base} from ${how.target}`);
    return tip(repo.dir, 'FETCH_HEAD');
  }
  return tip(repo.dir, `refs/heads/${repo.base}`);
}

function conflictStop(repo, verb) {
  const files = git(repo.dir, ['diff', '--name-only', '--diff-filter=U']).out.split('\n').filter(Boolean);
  if (files.length) stop(`${verb}: merge conflict in ${repo.name}, left in progress: ${files.join(', ')}`, 3);
}

function mergeInto(repo, ref, label, verb) {
  if (isAncestor(repo.dir, ref, 'HEAD')) return false;
  const merged = git(repo.dir, ['merge', '--no-edit', ref]);
  if (!merged.ok) {
    conflictStop(repo, verb);
    stop(`${verb}: merge of ${label} into ${repo.name} failed: ${oneLine(merged.err || merged.out)}`);
  }
  say(`${verb}: ${repo.name} merged ${label}`);
  return true;
}

function inProgressStop(repo, verb) {
  if (!git(repo.dir, ['rev-parse', '--verify', '-q', 'MERGE_HEAD']).ok) return;
  conflictStop(repo, verb);
  stop(`${verb}: a merge is in progress in ${repo.name} with nothing left to resolve; commit it, then run ${verb} again`, 3);
}

// ── verbs ────────────────────────────────────────────────────────────────────────────────────

function issueFile(co, slug) {
  const file = join(co.scratch, 'issues', `${slug}.md`);
  if (!existsSync(file)) stop(`scratch/issues/${slug}.md does not exist; run /capture-issue first`);
  return file;
}

/** A frontmatter key's values, written inline, comma-separated, bracketed or as a `- item` list. */
function frontList(text, key) {
  const front = (text.match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || '';
  const lines = front.split(/\r?\n/);
  const at = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (at < 0) return [];
  const inline = list(lines[at].slice(key.length + 1).trim().replace(/["']/g, ''));
  if (inline.length) return inline;
  const items = [];
  for (let i = at + 1; i < lines.length && /^\s+-\s+/.test(lines[i]); i += 1) items.push(lines[i].replace(/^\s+-\s+/, '').replace(/["']/g, '').trim());
  return items;
}

/** Resume the open lane that already holds an issue, or stop naming who holds it. */
async function resume(co, held, slug, takeOver) {
  const who = holder(co, held);
  if (who.where === 'worktree' || (who.where === 'origin' && !takeOver)) {
    stop(`${slug} is held by lane ${held.name} on ${held.branch} in ${who.line}`, 4);
  }
  const repos = [
    { name: 'scratch', dir: co.scratch },
    { name: '.', dir: co.root },
    ...held.extras.map((extra) => ({ name: extra.path, dir: repoDir(co.root, extra.path) })),
  ];
  // Every check and fetch before the first switch, so a stop leaves no repo half-resumed.
  for (const repo of repos) {
    if (!isRepoRoot(repo.dir)) stop(`lane repo ${repo.name} is not in this checkout; nothing was switched`);
    if (repo.name !== '.' && repo.name !== 'scratch') await fetchOrigin(repo.dir);
    if (!hasLaneBranch(repo.dir, held.branch)) stop(`lane repo ${repo.name} has no branch ${held.branch}; nothing was switched`);
  }
  for (const repo of repos) {
    if (currentBranch(repo.dir) !== held.branch) switchTo(repo, held.branch);
  }
  say(`begin: resumed lane ${held.name} on ${held.branch}`);
}

const hasLaneBranch = (dir, branch) => has(dir, `refs/heads/${branch}`) || has(dir, `refs/remotes/origin/${branch}`);

/** The record's purpose: the first paragraph of the issue's ## Summary, else its title. */
function issueSummary(issueText, slug) {
  const lines = issueText.split(/\r?\n/);
  const para = [];
  for (let i = lines.findIndex((line) => line.trim() === '## Summary') + 1; i > 0 && i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith('## ') || (!line && para.length)) break;
    if (line) para.push(line);
  }
  return para.join(' ') || frontList(issueText, 'title').join(', ') || slug;
}

async function begin(co, args) {
  const { positional, flags } = parse(args, { value: ['--name', '--base', '--branch', '--workstream'], bool: ['--take-over'] });
  const slug = positional[0];
  if (positional.length !== 1 || !SLUG.test(slug)) usage('begin takes one issue slug');
  const name = flags['--name'] || slug;
  if (!SLUG.test(name) || name === 'none') usage(`'${name}' is not a lane name`);
  const branch = flags['--branch'] || `lane/${name}`;
  if (!validBranch(branch)) usage(`'${branch}' is not a branch name`);
  if (flags['--base'] && !validBranch(flags['--base'])) usage(`'${flags['--base']}' is not a branch name`);
  const workstream = flags['--workstream'] || name;
  if (!SLUG.test(workstream)) usage(`'${workstream}' is not a workstream name`);

  if (!isRepoRoot(co.scratch)) stop('scratch/ is not a git repo; see scratch-management, initialize');
  const table = readTable(co.root);
  await fetchOrigin(co.root);
  await fetchOrigin(co.scratch);

  const held = openLanes(co).find((lane) => lane.fields.primary === slug || list(lane.fields.folded).includes(slug));
  if (held) { await resume(co, fullLane(held), slug, flags['--take-over']); return; }
  if (flags['--take-over']) stop(`no open lane holds ${slug}, so there is nothing to take over`);

  const issue = issueFile(co, slug);
  let issueText = readFileSync(issue, 'utf-8');
  const status = frontList(issueText, 'status')[0];
  if (status !== 'open') stop(`scratch/issues/${slug}.md is ${status || 'without a status'}, not open`);
  for (const blocker of frontList(issueText, 'blocked_by')) {
    if (!SLUG.test(blocker)) stop(`scratch/issues/${slug}.md: blocked_by value '${blocker}' is not an issue slug`);
    const file = join(co.scratch, 'issues', `${blocker}.md`);
    const blockerStatus = existsSync(file) ? frontList(readFileSync(file, 'utf-8'), 'status')[0] : 'missing';
    if (!SETTLED.includes(blockerStatus)) stop(`${slug} is blocked by ${blocker}, which is ${blockerStatus}`);
  }

  const base = flags['--base'] || baseline(co.root);
  if (!validBranch(base)) stop(`the baseline '${base}' is not a branch name; pass --base`);
  if (!has(co.root, `refs/heads/${base}`)) stop(`the code repo has no local branch ${base}`);
  if (!has(co.scratch, 'refs/heads/main')) stop('scratch has no local branch main');

  const present = table.filter((entry) => isRepoRoot(repoDir(co.root, entry.path)));
  const pending = table.filter((entry) => !present.includes(entry));
  const codeBranch = currentBranch(co.root);
  const takenBy = [];
  const archive = archiveName(co);
  for (const ref of [`refs/heads/${archive}`, `refs/remotes/origin/${archive}`]) {
    if (git(co.scratch, ['ls-tree', '-d', '--name-only', ref, '--', `L-${name}`]).out) takenBy.push(`${ref} holds L-${name}`);
  }
  for (const dir of [co.scratch, co.root]) {
    for (const ref of [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`]) {
      if (has(dir, ref)) takenBy.push(`${dir === co.root ? 'the code repo' : 'scratch'} has ${ref}`);
    }
  }
  for (const entry of present) {
    await fetchOrigin(repoDir(co.root, entry.path));
    const ref = checkBranchable(co, entry, branch, codeBranch);
    if (ref) takenBy.push(`${entry.path} has ${ref}`);
  }
  if (takenBy.length) stop(`the lane name ${name} is taken: ${takenBy.join('; ')}`, 5);

  const fork = tip(co.root, `refs/heads/${base}`);
  const scratchFork = tip(co.scratch, 'refs/heads/main');
  must(co.root, ['switch', '-q', '-c', branch, base], `branching the code repo from ${base}`);
  say(`begin: . on ${branch} from ${base} at ${short(fork)}`);
  say('switched: .');
  must(co.scratch, ['switch', '-q', '-c', branch, 'main'], 'branching scratch from main');
  say(`begin: scratch on ${branch} from main at ${short(scratchFork)}`);
  say('switched: scratch');
  const extras = [];
  for (const entry of present) {
    const dir = repoDir(co.root, entry.path);
    const from = has(dir, `refs/heads/${entry.base}`) ? entry.base : `origin/${entry.base}`;
    must(dir, ['switch', '-q', '-c', branch, from], `branching ${entry.path} from ${entry.base}`);
    if (from !== entry.base) must(dir, ['branch', '--track', entry.base, from]);
    const extra = { path: entry.path, base: entry.base, fork: tip(dir, `refs/heads/${entry.base}`) };
    extras.push(extra);
    say(`begin: ${entry.path} on ${branch} from ${entry.base} at ${short(extra.fork)}`);
    say(`switched: ${entry.path}`);
    warnSubrepos(co, entry.path);
  }
  for (const entry of pending) {
    say(`begin: ${entry.path} pending, absent from this checkout`);
    warnSubrepos(co, entry.path);
  }

  // The record's epic: the open lane whose branch this lane forks from, when it is one of the issue's epics.
  const epics = frontList(issueText, 'epic');
  const epicLane = openLanes(co).find((lane) => lane.branch === base && SLUG.test(lane.fields.primary || '') && epics.includes(lane.fields.primary));
  const front = [
    `primary: ${slug}`,
    ...(epicLane ? [`epic: ${epicLane.fields.primary}`] : []),
    `base: ${base}`,
    `branch: ${branch}`,
    `fork: ${fork}`,
    `scratch_fork: ${scratchFork}`,
    ...(extras.length ? [`extras: ${extrasValue(extras)}`] : []),
    ...(pending.length ? [`pending: ${pendingValue(pending)}`] : []),
    `workstream: ${workstream}`,
    `started: ${today()}`,
    'state: open',
  ];
  const record = `---\n${front.join('\n')}\n---\n# Lane: ${name}\n\n${issueSummary(issueText, slug)}\n\n## Log\n` +
    `- ${today()}: Began on ${base} at ${short(fork)} — L-${name}/README.md\n\n## Decisions made\n\n## Rulings\n\n## Assets\n\n## Notes\n`;
  const lane = { name, file: join(co.scratch, `L-${name}`, 'README.md') };
  mkdirSync(dirname(lane.file), { recursive: true });
  issueText = setKey(issueText, 'lane', name);
  writeFileSync(issue, issueText, 'utf-8');
  commitRecord(co, lane, record, `chore(lane): begin ${name}`, [`issues/${slug}.md`]);
  say(`begin: record L-${name}/README.md committed, workstream ${workstream}`);
  await pushBranches(laneRepos(co, { base, fork, scratchFork, extras }), branch, 'begin');
}

/** The baseline SKILL.md § Identity gives when the repo's CLAUDE.md names none. */
function baseline(root) {
  const head = git(root, ['symbolic-ref', '-q', 'refs/remotes/origin/HEAD']);
  if (head.ok && head.out) return head.out.replace('refs/remotes/origin/', '');
  return has(root, 'refs/heads/main') ? 'main' : 'master';
}

async function addRepoVerb(co, args) {
  if (args.length !== 1 || args[0].startsWith('-')) usage('add-repo takes one path');
  const path = args[0].replace(/\/+$/, '');
  const lane = requireLane(co);
  if (lane.extras.some((extra) => extra.path === path)) {
    const dir = repoDir(co.root, path);
    if (currentBranch(dir) !== lane.branch) switchTo({ name: path, dir }, lane.branch);
    say(`add-repo: ${path} already on ${lane.branch}`);
    return;
  }
  const entry = lane.pending.find((other) => other.path === path) || readTable(co.root).find((other) => other.path === path);
  if (!entry) stop(`${path} is not in this lane's pending list or the lane repos table`);
  if (!isRepoRoot(repoDir(co.root, path))) stop(`${path} is not a git repo in this checkout`);
  await addRepo(co, lane, entry, 'add-repo');
}

async function push(co) {
  const lane = requireLane(co);
  await pushBranches(presentRepos(co, lane), lane.branch, 'push');
}

async function catchUp(co) {
  const lane = await addPending(co, requireLane(co), 'catch-up');
  for (const repo of presentRepos(co, lane)) {
    inProgressStop(repo, 'catch-up');
    if (currentBranch(repo.dir) !== lane.branch) stop(`${repo.name} is on ${currentBranch(repo.dir) || 'a detached HEAD'}, not ${lane.branch}`);
    await fetchOrigin(repo.dir);
    const how = landing(co, repo);
    let merged = false;
    if (how.target && how.target !== '.') {
      merged = mergeInto(repo, landingBase(repo, how), `${repo.base} of ${how.target}`, 'catch-up') || merged;
    }
    if (has(repo.dir, `refs/heads/${repo.base}`)) merged = mergeInto(repo, repo.base, repo.base, 'catch-up') || merged;
    if (has(repo.dir, `refs/remotes/origin/${repo.base}`)) merged = mergeInto(repo, `origin/${repo.base}`, `origin/${repo.base}`, 'catch-up') || merged;
    if (!merged) say(`catch-up: ${repo.name} up to date with ${repo.base}`);
  }
}

function diff(co) {
  const lane = requireLane(co);
  for (const repo of presentRepos(co, lane)) {
    // Quoted where needed: the page hands this line to the user as a command to run.
    const at = repo.name === '.' ? 'git' : `git -C ${shq(repo.name)}`;
    say(`diff: ${repo.name} ${at} diff ${shq(`${repo.base}...${lane.branch}`)}`);
    const stat = must(repo.dir, ['diff', '--stat', `${repo.base}...${lane.branch}`]);
    if (stat) say(stat);
  }
}

function log(co) {
  const lane = requireLane(co);
  for (const repo of presentRepos(co, lane)) {
    say(`log: ${repo.name} ${repo.fork}..${lane.branch}`);
    const lines = must(repo.dir, ['log', '--first-parent', '--no-merges', '--name-only', '--format=%h %s', '--end-of-options', `${repo.fork}..${lane.branch}`]);
    if (lines) say(lines);
  }
}

function status(co) {
  const lane = isRepoRoot(co.scratch) ? laneHere(co) : null;
  if (!lane) { say('lane: none'); return; }
  say(`lane: ${lane.name}`);
  say(`branch: ${lane.branch}`);
  for (const repo of laneRepos(co, lane)) {
    const on = isRepoRoot(repo.dir) ? currentBranch(repo.dir) || 'a detached HEAD' : 'absent';
    say(`status: ${repo.name} base ${repo.base} fork ${short(repo.fork)} on ${on}`);
  }
  for (const entry of lane.pending) {
    say(`pending: ${entry.path} base ${entry.base} ${isRepoRoot(repoDir(co.root, entry.path)) ? 'present' : 'absent'}`);
  }
}

async function heldVerb(co, args) {
  if (args.length !== 1 || !SLUG.test(args[0])) usage('held takes one issue slug');
  const issue = args[0];
  if (!isRepoRoot(co.scratch)) stop('scratch/ is not a git repo');
  await fetchOrigin(co.scratch);
  const lane = openLanes(co).find((open) => open.fields.primary === issue || list(open.fields.folded).includes(issue));
  if (!lane) { say(`held: ${issue} free`); return; }
  if (currentBranch(co.scratch) === lane.branch) { say(`held: ${issue} by lane ${lane.name} on ${lane.branch}, this checkout`); return; }
  const who = holder(co, lane);
  stop(`HELD: ${issue} is held by lane ${lane.name} on ${lane.branch}${who.line ? ` in ${who.line}` : ', checked out nowhere'}`, 4);
}

/**
 * The named lane for land and abandon: its record at the tip of a local scratch branch, or, once
 * archived, on the local archive branch.
 */
function findLane(co, name) {
  if (!isRepoRoot(co.scratch)) stop('scratch/ is not a git repo');
  const open = openLanes(co).filter((lane) => lane.name === name);
  const local = open.find((lane) => lane.local);
  if (local) {
    const who = holder(co, local);
    if (who.where !== 'here') stop(`lane ${name} is open in ${who.line}, not in this checkout`);
    return { ...fullLane(local), archived: false, file: join(co.scratch, `L-${name}`, 'README.md') };
  }
  const shown = git(co.scratch, ['show', `refs/heads/${archiveName(co)}:L-${name}/README.md`]);
  if (shown.ok) return { ...readLane(name, shown.out, `archive:L-${name}/README.md`), archived: true };
  if (open.length) stop(`lane ${name} is open on origin/${open[0].branch} only, not in this checkout`);
  return stop(`no lane ${name}: no local scratch branch carries L-${name}/README.md and the local archive branch does not either`);
}

/** Put an open lane's repos on the lane branch where a branch lane left them elsewhere; all are checked first. */
function holdLane(co, lane) {
  if (lane.archived) return;
  const repos = laneRepos(co, lane);
  const missing = repos.find((repo) => !isRepoRoot(repo.dir));
  if (missing) stop(`lane repo ${missing.name} is not in this checkout; nothing was switched`);
  const bare = repos.find((repo) => !hasLaneBranch(repo.dir, lane.branch));
  if (bare) stop(`lane repo ${bare.name} has no branch ${lane.branch}; nothing was switched`);
  for (const repo of repos) {
    if (currentBranch(repo.dir) !== lane.branch) switchTo(repo, lane.branch);
  }
}

/**
 * The branch `scratch archive` writes to. Stops when scratch.mjs or its config is missing: without
 * the config scratch.mjs asks for a project name on stdin and archives nothing.
 */
function archiveBranch(co) {
  if (!existsSync(SCRATCH_MJS)) stop(`scratch.mjs is missing at ${SCRATCH_MJS}`);
  if (!scratchConfig(co).projectName) {
    stop('scratch/.scratch-config.json is missing or names no project; run `scratch list` once to set it up');
  }
  return archiveName(co);
}

function scratchConfig(co) {
  try {
    const config = JSON.parse(readFileSync(join(co.scratch, '.scratch-config.json'), 'utf-8'));
    return config && typeof config === 'object' ? config : {};
  } catch { return {}; }
}

/** The archive branch's name for a read, which needs neither scratch.mjs nor a set-up config. */
const archiveName = (co) => {
  const name = scratchConfig(co).archiveBranch;
  return validBranch(name) ? name : 'archive';
};

function archiveRecord(co, lane) {
  const archive = archiveBranch(co);
  if (verbose) console.error(`+ node ${SCRATCH_MJS} archive L-${lane.name}`);
  const result = spawnSync(process.execPath, [SCRATCH_MJS, 'archive', `L-${lane.name}`], { cwd: co.root, encoding: 'utf-8' });
  const archived = git(co.scratch, ['cat-file', '-e', `refs/heads/${archive}:L-${lane.name}/README.md`]).ok &&
    !git(co.scratch, ['cat-file', '-e', `HEAD:L-${lane.name}/README.md`]).ok;
  if (result.status !== 0 || !archived) stop(`scratch archive L-${lane.name} failed: ${oneLine(`${result.stdout || ''}\n${result.stderr || ''}`.replace(/\x1b\[[0-9;]*m/g, ''))}`);
}

function landRepo(co, repo, branch, verb) {
  const how = landing(co, repo);
  if (how.by === 'merge') {
    if (git(repo.dir, ['status', '--porcelain', '--untracked-files=no']).out) stop(`${repo.name} has uncommitted changes; commit them on ${branch} first`);
    if (currentBranch(repo.dir) !== repo.base) switchTo(repo, repo.base);
    must(repo.dir, ['merge', '-q', '--ff-only', branch], `fast-forwarding ${repo.base} in ${repo.name}`);
  } else {
    const pushed = git(repo.dir, ['push', '-q', how.target, `refs/heads/${branch}:refs/heads/${repo.base}`]);
    if (!pushed.ok) {
      const out = baseCheckout(how.baseDir, repo.base);
      stop(`push of ${branch} into ${repo.base} was refused in ${repo.name}` +
        `${out ? `; the checkout with ${repo.base} out is ${out}, which may hold uncommitted changes` : ''}: ${oneLine(pushed.err)}`);
    }
  }
  say(`${verb}: ${repo.name} ${repo.base} at ${short(tip(repo.dir, branch))} by ${how.by}`);
}

function baseCheckout(dir, base) {
  const block = git(dir, ['worktree', 'list', '--porcelain']).out.split('\n\n').find((entry) => entry.split('\n').includes(`branch refs/heads/${base}`));
  return block ? (block.match(/^worktree (.*)$/m) || [])[1] : null;
}

/** Landed: the base where the lane lands already contains the lane branch. */
function isLanded(co, repo, branch) {
  const how = landing(co, repo);
  return isAncestor(repo.dir, branch, landingBase(repo, how));
}

async function land(co, args) {
  const { positional, flags } = parse(args, { bool: ['--code-landed'] });
  if (positional.length !== 1 || !SLUG.test(positional[0])) usage('land takes one lane name');
  const codeLanded = Boolean(flags['--code-landed']);
  let lane = findLane(co, positional[0]);
  holdLane(co, lane);
  if (!lane.archived) lane = { ...(await addPending(co, { ...requireLaneNamed(co, lane.name) }, 'land')), archived: false };
  const all = laneRepos(co, lane);
  const [code, scratch, ...extras] = all;
  for (const repo of all) {
    if (!isRepoRoot(repo.dir)) stop(`lane repo ${repo.name} is not in this checkout`);
  }

  // --code-landed skips the code repo's landing, not the switch a clone lane's land ends on.
  const settleCode = () => {
    if (!codeLanded || landing(co, code).by !== 'merge' || currentBranch(code.dir) !== lane.branch) return;
    if (git(code.dir, ['status', '--porcelain', '--untracked-files=no']).out) say(`land: . has uncommitted changes, left on ${lane.branch}`);
    else switchTo(code, code.base);
  };

  if (lane.archived && isLanded(co, scratch, lane.branch)) {
    settleCode();
    // The one stage left to resume: a lane branch whose push to origin was refused last time.
    const behind = all.filter((repo) => hasOrigin(repo.dir) && has(repo.dir, `refs/heads/${lane.branch}`) &&
      git(repo.dir, ['rev-parse', '--verify', '-q', `refs/remotes/origin/${lane.branch}`]).out !== tip(repo.dir, `refs/heads/${lane.branch}`));
    await pushBranches(behind, lane.branch, 'land');
    say(`land: ${lane.name} has already landed; nothing moved`);
    return;
  }

  // Stage 1: no base may have moved past its lane branch.
  const moved = [...extras, ...(codeLanded ? [] : [code]), ...(lane.archived ? [] : [scratch])].filter((repo) => {
    const base = landingBase(repo, landing(co, repo));
    return !isAncestor(repo.dir, lane.branch, base) && !isAncestor(repo.dir, base, lane.branch);
  });
  if (moved.length) {
    stop(`land: ${moved.map((repo) => `${repo.base} moved in ${repo.name}`).join('; ')}; no base moved`, 6);
  }
  if (!lane.archived) archiveBranch(co);

  // Stage 2: the extras, then the code repo.
  for (const repo of [...extras, ...(codeLanded ? [] : [code])]) {
    if (isLanded(co, repo, lane.branch)) {
      if (landing(co, repo).by === 'merge' && currentBranch(repo.dir) !== repo.base) switchTo(repo, repo.base);
      continue;
    }
    landRepo(co, repo, lane.branch, 'land');
  }

  // Stage 3: the closing line and the record's archive, on the scratch lane branch.
  if (!lane.archived) {
    let text = readFileSync(lane.file, 'utf-8');
    if (!/^- \d{4}-\d{2}-\d{2}: Closed: /m.test(text)) {
      const by = codeLanded ? `PR${lane.fields.pr ? ` ${lane.fields.pr}` : ''}` : landing(co, code).by;
      text = appendLog(text, `- ${today()}: Closed: lands on ${lane.base} at ${short(tip(code.dir, lane.branch))} by ${by} — L-${lane.name}/README.md`);
      commitRecord(co, lane, text, `chore(lane): close ${lane.name}`);
    }
    archiveRecord(co, lane);
    say(`land: record L-${lane.name} archived`);
  }

  // Stage 4: scratch, then every lane branch pushed plain.
  if (currentBranch(scratch.dir) !== lane.branch) switchTo(scratch, lane.branch);
  inProgressStop(scratch, 'land');
  const how = landing(co, scratch);
  mergeInto(scratch, landingBase(scratch, how), 'main', 'land');
  landRepo(co, scratch, lane.branch, 'land');
  settleCode();
  await pushBranches(all, lane.branch, 'land');
}

function requireLaneNamed(co, name) {
  const lane = requireLane(co);
  if (lane.name !== name) stop(`this checkout is on lane ${lane.name}, not ${name}`);
  return lane;
}

async function abandon(co, args) {
  const { positional, flags } = parse(args, { value: ['--reason'] });
  if (positional.length !== 1 || !SLUG.test(positional[0])) usage('abandon takes one lane name');
  const reason = (flags['--reason'] || '').replace(/\s+/g, ' ').trim();
  if (!reason) usage('abandon needs --reason <text>');
  const found = findLane(co, positional[0]);
  // Unlike land, abandon goes on without a lane repo that is gone: the lane still has to be droppable.
  const all = [];
  for (const repo of laneRepos(co, found)) {
    if (!isRepoRoot(repo.dir)) say(`abandon: ${repo.name} absent, skipped`);
    else if (!hasLaneBranch(repo.dir, found.branch)) say(`abandon: ${repo.name} has no branch ${found.branch}, skipped`);
    else all.push(repo);
  }
  for (const repo of found.archived ? [] : all) {
    if (currentBranch(repo.dir) !== found.branch) switchTo(repo, found.branch);
  }
  const lane = found.archived ? found : { ...requireLaneNamed(co, found.name), archived: false };
  if (!lane.archived) {
    archiveBranch(co);
    const text = readFileSync(lane.file, 'utf-8');
    // A run the archive refused already wrote the line.
    if (!/^- \d{4}-\d{2}-\d{2}: Abandoned: /m.test(text)) {
      commitRecord(co, lane, appendLog(text, `- ${today()}: Abandoned: ${reason}`), `chore(lane): abandon ${lane.name}`);
    }
    archiveRecord(co, lane);
    say(`abandon: record L-${lane.name} archived`);
  }
  await pushBranches(all, lane.branch, 'abandon');
  for (const repo of all) {
    if (landing(co, repo).by === 'merge' && currentBranch(repo.dir) === lane.branch) switchTo(repo, repo.base);
  }
  for (const entry of lane.pending) {
    if (isRepoRoot(repoDir(co.root, entry.path))) say(`abandon: ${entry.path} pending, left as it is`);
  }
}

// ── worktree lanes ───────────────────────────────────────────────────────────────────────────

function worktreePath(co, slug) {
  return join(dirname(co.main), `${basename(co.main)}-${slug}`);
}

const isWorktreeOf = (repo, path) =>
  must(repo, ['worktree', 'list', '--porcelain']).split('\n').includes(`worktree ${path}`);

function open(co, args) {
  const split = args.indexOf('--');
  const claudeArgs = split >= 0 ? args.slice(split + 1) : [];
  const { positional, flags } = parse(split >= 0 ? args.slice(0, split) : args, { bool: ['--no-launch', '--dry-run'] });
  if (positional.length !== 1 || !SLUG.test(positional[0])) usage('open takes one issue slug');
  if (flags['--no-launch'] && (flags['--dry-run'] || claudeArgs.length)) usage('--no-launch takes no --dry-run and no claude args');
  const slug = positional[0];
  const path = worktreePath(co, slug);
  // Reads the main checkout's table for its containment check alone, before anything is made.
  readTable(co.main);

  if (existsSync(path) || isSymlink(path)) {
    // A launcher only ever makes a real folder, so a symlink here was made by hand and could alias the main checkout.
    if (isSymlink(path)) stop(`${path} is a symlink — remove it, then launch again`);
    if (!isWorktreeOf(co.main, path)) stop(`${path} exists but is not a worktree of this repo — move it aside, then launch again`);
    say(`open: . worktree reused at ${path}`);
  } else {
    must(co.main, ['worktree', 'add', '-q', '--detach', path, 'HEAD'], 'git worktree add');
    say(`open: . worktree created at ${path}`);
  }
  const nested = [{ path: 'scratch', base: 'main' }, ...readTable(path)];
  for (const entry of nested) {
    // Containment is a rule for a table row's path; scratch is joined plain, as every verb reads it.
    const isScratch = entry.path === 'scratch';
    const source = isScratch ? join(co.main, 'scratch') : repoDir(co.main, entry.path);
    const target = isScratch ? join(path, 'scratch') : repoDir(path, entry.path);
    if (!isRepoRoot(source)) { say(`open: ${entry.path} absent from the main checkout, no worktree made`); continue; }
    if (existsSync(target)) { say(`open: ${entry.path} reused`); continue; }
    const at = has(source, `refs/heads/${entry.base}`) ? entry.base : 'HEAD';
    must(source, ['worktree', 'add', '-q', '--detach', target, at], `git worktree add for ${entry.path}`);
    say(`open: ${entry.path} worktree created, detached at ${at}`);
  }
  // The config is the repos' own, shared by every worktree, so this sets it in the main checkout.
  for (const dir of [path, ...nested.map((entry) => join(path, entry.path))]) {
    if (isRepoRoot(dir)) must(dir, ['config', 'receive.denyCurrentBranch', 'updateInstead'], 'setting receive.denyCurrentBranch');
  }

  const branch = currentBranch(path);
  if (flags['--no-launch']) {
    say(`worktree: ${path}`);
    say(`head: ${branch || 'detached'}`);
    return 0;
  }
  // /begin-lane puts a new, detached worktree on its lane branch; on a relaunch it would only re-run its resume.
  const command = [...claudeArgs, ...(branch ? [] : [`/begin-lane ${slug}`])];
  if (flags['--dry-run']) {
    say(['claude', ...command].map(shq).join(' '));
    return 0;
  }
  return launch(path, command);
}

const isSymlink = (path) => { try { return lstatSync(path).isSymbolicLink(); } catch { return false; } };

/** Start claude in the worktree and wait: Node cannot replace its own process as a shell's exec does. */
function launch(cwd, args) {
  let file = 'claude';
  let shell = false;
  if (process.platform === 'win32') {
    file = onPath('claude');
    if (!file) stop('claude not found on PATH');
    // A .cmd shim runs only through the shell, which then needs each argument quoted.
    shell = /\.(cmd|bat)$/i.test(file);
    if (shell) {
      // cmd.exe has no escape for a quote and expands %NAME% inside quotes, so an argument holding
      // either, or one whose trailing backslash would swallow the closing quote, cannot be passed.
      const unsafe = [file, ...args].find((arg) => /["%!\r\n]|\\$/.test(arg));
      if (unsafe !== undefined) stop(`cannot pass this argument through ${file} safely: ${JSON.stringify(unsafe)}; start claude in ${cwd} yourself`);
      file = `"${file}"`;
      args = args.map((arg) => `"${arg}"`);
    }
  }
  return new Promise((done) => {
    const child = spawn(file, args, { cwd, stdio: 'inherit', shell });
    const forward = (signal) => { try { child.kill(signal); } catch { /* it already exited */ } };
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => forward(signal));
    child.on('error', (error) => { console.error(`lane: could not start claude: ${error.message}`); done(2); });
    child.on('close', (code, signal) => done(signal ? 128 + ({ SIGINT: 2, SIGTERM: 15, SIGHUP: 1 }[signal] || 0) : code));
  });
}

/** Every git repo nested in a directory, at any depth, outermost first. */
function nestedRepos(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '.git' || entry.name === 'node_modules') continue;
    const child = join(dir, entry.name);
    if (existsSync(join(child, '.git'))) found.push(child);
    found.push(...nestedRepos(child));
  }
  return found;
}

function remove(co, args) {
  if (args.length !== 1 || !SLUG.test(args[0])) usage('remove takes one issue slug');
  const path = worktreePath(co, args[0]);
  if (isSymlink(path)) stop(`${path} is a symlink — remove it by hand`);
  if (!existsSync(path) || !isWorktreeOf(co.main, path)) stop(`${path} is not a worktree of this repo`);
  if (`${realpathSync(process.cwd())}${sep}`.startsWith(`${realpathSync(path)}${sep}`)) stop(`Run remove from outside ${path}`);
  const scratch = join(path, 'scratch');
  for (const folder of existsSync(scratch) ? readdirSync(scratch).filter((entry) => entry.startsWith('L-')) : []) {
    if (existsSync(join(scratch, folder, 'README.md'))) stop(`The lane is still open (scratch/${folder}/README.md) — run /end-lane first`);
  }
  // Every check runs before any removal: removing the code worktree deletes the repos nested in it unchecked.
  const nested = nestedRepos(path);
  for (const repo of [path, ...nested]) {
    // A nested repo may be anyone's: its own config must not get to name a program for git to run.
    const state = git(repo, ['-c', 'core.fsmonitor=false', 'status', '--porcelain']);
    if (!state.ok || state.out) stop(`${repo} has uncommitted changes, or git could not read it — nothing removed`);
    // A worktree's commits live in the main checkout's repo; a nested clone's die with it.
    if (!isLinkedWorktree(repo) && git(repo, ['-c', 'core.fsmonitor=false', 'log', '--branches', '--not', '--remotes', '--oneline']).out) {
      stop(`${repo} has commits on no remote — nothing removed`);
    }
  }
  for (const repo of nested.reverse()) {
    if (!isLinkedWorktree(repo)) continue;
    must(repo, ['worktree', 'remove', repo], `removing ${repo}`);
    say(`remove: ${relative(path, repo)} worktree removed`);
  }
  must(co.main, ['worktree', 'remove', path], `removing ${path}`);
  say(`remove: . worktree removed at ${path}; branches kept`);
}

// ── entry ────────────────────────────────────────────────────────────────────────────────────

function parse(args, spec) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if ((spec.value || []).includes(arg)) {
      if (i + 1 >= args.length) usage(`${arg} needs a value`);
      flags[arg] = args[i += 1];
    } else if ((spec.bool || []).includes(arg)) flags[arg] = true;
    else if (arg.startsWith('-')) usage(`unknown flag: ${arg}`);
    else positional.push(arg);
  }
  return { positional, flags };
}

const none = (verb, args) => { if (args.length) usage(`${verb} takes no arguments`); };

async function main() {
  let args = process.argv.slice(2);
  const split = args.indexOf('--');
  const own = split >= 0 ? args.slice(0, split) : args;
  if (own.includes('-h') || own.includes('--help')) { console.log(HELP); return 0; }
  if (own.includes('--verbose')) {
    verbose = true;
    args = [...own.filter((arg) => arg !== '--verbose'), ...(split >= 0 ? args.slice(split) : [])];
  }
  const [verb, ...rest] = args;
  if (!verb) usage('no verb given');
  const verbs = {
    open: (co) => open(co, rest),
    remove: (co) => remove(co, rest),
    begin: (co) => begin(co, rest),
    'add-repo': (co) => addRepoVerb(co, rest),
    push: (co) => (none('push', rest), push(co)),
    'catch-up': (co) => (none('catch-up', rest), catchUp(co)),
    diff: (co) => (none('diff', rest), diff(co)),
    log: (co) => (none('log', rest), log(co)),
    status: (co) => (none('status', rest), status(co)),
    held: (co) => heldVerb(co, rest),
    land: (co) => land(co, rest),
    abandon: (co) => abandon(co, rest),
  };
  if (!Object.hasOwn(verbs, verb)) usage(`unknown verb: ${verb}`);
  return (await verbs[verb](checkout())) || 0;
}

main().then((code) => process.exit(code), (error) => {
  console.error(error instanceof Stop ? `lane: ${error.message}` : `lane: ${error && error.stack ? error.stack : error}`);
  process.exit(error instanceof Stop ? error.code : 2);
});
