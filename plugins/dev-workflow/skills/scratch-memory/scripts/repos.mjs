#!/usr/bin/env node
// repos.mjs — registered repos: the three-level repos config and the `repos` CLI verb group
//
// Exports:
//   DESTINATIONS, NAME_PATTERN            — the accepted destination names and the entry-name rule
//   ReposError                            — { code: 'USER' | 'INFRA', exit, message }
//   normPath(p)                           — MSYS `/c/…` → `C:\…` on Windows; resolve otherwise
//   levelFiles(projectRoot)               — { user, project, local } file paths
//   listRepos({ projectRoot })            — merged entries, suppressed omitted, sorted, each with `ok`
//   resolveRepo(name, { projectRoot })    — { entry, exists }; throws USER for an unknown name
//   ownerOf(path, { projectRoot, entries }) — the ok entry whose root most specifically contains path, or null
//   addRepo / removeRepo / suppressRepo   — locked read-modify-write of one level
//   dispatch(argv)                        — `repos` CLI entry point
//
// No side effects at load time: nothing reads argv, stdin or the filesystem until called.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { EXIT } from './tasks.mjs';

export const DESTINATIONS = ['learned', 'docs', 'issues', 'primitive', 'code'];
export const NAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const FILE_VERSION = 1;
const LEVELS = ['user', 'project', 'local'];
const LOCAL_REL = '.claude/scratch-memory/repos.local.json';
const LOCK_STALE_MS = 60_000;
const LOCK_WAIT_MS = 5_000;

export class ReposError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.exit = code === 'USER' ? EXIT.USER_ERROR : EXIT.INFRA_ERROR;
  }
}
const userErr = (m) => new ReposError('USER', m);
const infraErr = (m) => new ReposError('INFRA', m);

// Node's realpath does not translate an MSYS drive spelling, and stdin JSON gets no MSYS argv conversion.
function nativePath(p) {
  if (process.platform === 'win32') {
    const m = p.match(/^\/([a-zA-Z])(\/.*)?$/);
    if (m) p = `${m[1].toUpperCase()}:${(m[2] ?? '/').replace(/\//g, '\\')}`;
  }
  return p;
}

export function normPath(p) {
  return resolve(nativePath(p));
}

// A registered path reaches shell commands a model writes, quoted; these characters would
// break or expand inside the quotes. `\` is the Windows separator, so it is refused only off Windows.
const SHELL_UNSAFE = process.platform === 'win32' ? /[\x00-\x1f$`"']/ : /[\x00-\x1f$`"'\\]/;

// Realpath of the nearest existing ancestor, with the missing tail re-appended.
function realish(p) {
  let cur = normPath(p);
  const tail = [];
  while (true) {
    try { return join(realpathSync(cur), ...tail); } catch {}
    const parent = dirname(cur);
    if (parent === cur) return normPath(p);
    tail.unshift(basename(cur));
    cur = parent;
  }
}

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

// The realpathed git top-level of dir, or null.
export function gitTopLevel(dir) {
  try {
    const top = execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return top ? realpathSync(normPath(top)) : null;
  } catch {
    return null;
  }
}

export function isOwnTopLevel(dir) {
  if (!isDir(dir)) return false;
  return gitTopLevel(dir) === realpathSync(normPath(dir));
}

export function levelFiles(projectRoot) {
  const userDir = process.env.SCRATCH_MEMORY_CONFIG_DIR || join(homedir(), '.claude', 'scratch-memory');
  return {
    user: join(userDir, 'repos.json'),
    project: projectRoot ? join(projectRoot, '.claude', 'scratch-memory', 'repos.json') : null,
    local: projectRoot ? join(projectRoot, '.claude', 'scratch-memory', 'repos.local.json') : null,
  };
}

function defaultProjectRoot() {
  return gitTopLevel(process.cwd());
}

function validateEntry(file, name, entry) {
  if (!NAME_PATTERN.test(name) || DESTINATIONS.includes(name)) throw infraErr(`${file}: invalid entry name ${JSON.stringify(name)}`);
  if (entry === null) return;
  if (typeof entry !== 'object' || Array.isArray(entry)) throw infraErr(`${file}: entry ${name} is not an object or null`);
  if (typeof entry.path !== 'string' || !isAbsolute(nativePath(entry.path))) throw infraErr(`${file}: entry ${name} has no absolute path`);
  if (SHELL_UNSAFE.test(entry.path)) throw infraErr(`${file}: entry ${name} has a path with a quote, \`$\`, backtick, backslash or control character`);
  if (!Array.isArray(entry.accepts) || entry.accepts.some((d) => !DESTINATIONS.includes(d))) {
    throw infraErr(`${file}: entry ${name} has an invalid accepts list`);
  }
  if (entry.description !== undefined && typeof entry.description !== 'string') throw infraErr(`${file}: entry ${name} has a non-string description`);
}

// null for a missing file; the parsed { version, repos } otherwise.
function readLevel(file) {
  if (!file || !existsSync(file)) return null;
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf-8'));
  } catch (err) {
    throw infraErr(`cannot read ${file}: ${err.message}`);
  }
  if (!data || typeof data !== 'object' || typeof data.version !== 'number') throw infraErr(`${file}: missing numeric version`);
  if (data.version > FILE_VERSION) throw infraErr(`${file}: version ${data.version} is newer than this CLI knows (${FILE_VERSION}); update scratch-memory`);
  const repos = data.repos ?? {};
  if (typeof repos !== 'object' || Array.isArray(repos)) throw infraErr(`${file}: repos is not an object`);
  for (const [name, entry] of Object.entries(repos)) validateEntry(file, name, entry);
  return { ...data, repos };
}

function mergedEntries(projectRoot) {
  const files = levelFiles(projectRoot);
  const merged = new Map();
  for (const level of LEVELS) {
    const data = readLevel(files[level]);
    if (!data) continue;
    for (const [name, entry] of Object.entries(data.repos)) {
      if (entry === null) merged.delete(name);
      else merged.set(name, { name, path: normPath(entry.path), accepts: [...entry.accepts], description: entry.description ?? null, level });
    }
  }
  return [...merged.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export function listRepos({ projectRoot = defaultProjectRoot() } = {}) {
  return mergedEntries(projectRoot).map((e) => ({ ...e, ok: isOwnTopLevel(e.path) }));
}

export function resolveRepo(name, { projectRoot = defaultProjectRoot() } = {}) {
  const entry = mergedEntries(projectRoot).find((e) => e.name === name);
  if (!entry) throw userErr(`unknown repo: ${name}`);
  const exists = isDir(entry.path);
  return { entry: { ...entry, ok: exists && isOwnTopLevel(entry.path) }, exists };
}

// `entries` lets a caller that already listed the repos skip re-listing them; an entry
// without an `ok` field is taken as ok.
export function ownerOf(path, { projectRoot, entries } = {}) {
  const target = realish(path);
  let best = null;
  let bestLen = -1;
  for (const e of entries ?? listRepos({ projectRoot })) {
    if (e.ok === false) continue;
    const root = realpathSync(e.path);
    const rel = relative(root, target);
    const inside = rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
    if (inside && root.length > bestLen) { best = e; bestLen = root.length; }
  }
  return best;
}

// --- Writing ---------------------------------------------------------------

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (err) { return err.code === 'EPERM'; }
}

// A directory lock beside the file, renamed into place with its owner file (pid, creation time)
// already inside, so a held lock is never ownerless. One whose owner is unreadable, whose pid is
// gone, or that is older than LOCK_STALE_MS is stale. Breaking and releasing both rename the lock
// aside and remove it only when its owner is still the record expected, else move it back, so
// two waiters cannot both break the same stale lock and neither can remove the other's.
export function withLock(file, fn) {
  const lockDir = `${file}.lock`;
  const ownerOf = (dir) => { try { return readFileSync(join(dir, 'owner'), 'utf-8'); } catch { return null; } };
  // Removing in place would leave an empty directory another process's rename could land on.
  const removeIfOwner = (expected) => {
    const moved = `${lockDir}.gone-${process.pid}-${randomBytes(4).toString('hex')}`;
    try { renameSync(lockDir, moved); } catch { return; }
    if (ownerOf(moved) === expected) rmSync(moved, { recursive: true, force: true });
    else try { renameSync(moved, lockDir); } catch { rmSync(moved, { recursive: true, force: true }); }
  };
  const mine = JSON.stringify({ pid: process.pid, created: Date.now() });
  const fresh = `${lockDir}.new-${process.pid}-${randomBytes(4).toString('hex')}`;
  try {
    mkdirSync(fresh);
    writeFileSync(join(fresh, 'owner'), mine, 'utf-8');
  } catch (err) {
    rmSync(fresh, { recursive: true, force: true });
    throw infraErr(`cannot create lock ${lockDir}: ${err.message}`);
  }
  const deadline = Date.now() + LOCK_WAIT_MS;
  try {
    while (true) {
      try {
        renameSync(fresh, lockDir);
        break;
      } catch (err) {
        // The holder may have released between the rename and this check; retry until the deadline.
        if (!existsSync(lockDir)) {
          if (Date.now() > deadline) throw infraErr(`cannot create lock ${lockDir}: ${err.message}`);
          continue;
        }
      }
      const seen = ownerOf(lockDir);
      let stale = true;
      try {
        const owner = JSON.parse(seen);
        stale = !pidAlive(owner.pid) || Date.now() - owner.created > LOCK_STALE_MS;
      } catch {}
      if (stale) {
        removeIfOwner(seen);
        continue;
      }
      if (Date.now() > deadline) throw infraErr(`lock ${lockDir} is held; retry, or remove it if no scratch-memory process is running`);
      sleepMs(50);
    }
  } finally {
    rmSync(fresh, { recursive: true, force: true });
  }
  try {
    return fn();
  } finally {
    removeIfOwner(mine);
  }
}

function writeAtomic(file, data) {
  const tmp = join(dirname(file), `.${basename(file)}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`);
  try {
    writeFileSync(tmp, data, { flag: 'wx', encoding: 'utf-8' });
    renameSync(tmp, file);
  } catch (err) {
    try { unlinkSync(tmp); } catch {}
    throw infraErr(`cannot write ${file}: ${err.message}`);
  }
}

function ensureLocalIgnored(projectRoot) {
  let ignored = false;
  try {
    execFileSync('git', ['-C', projectRoot, 'check-ignore', '-q', LOCAL_REL], { stdio: 'ignore' });
    ignored = true;
  } catch {}
  if (ignored) return;
  const gi = join(projectRoot, '.gitignore');
  const prior = existsSync(gi) ? readFileSync(gi, 'utf-8') : '';
  appendFileSync(gi, `${prior && !prior.endsWith('\n') ? '\n' : ''}${LOCAL_REL}\n`, 'utf-8');
}

function levelFile(level, projectRoot) {
  if (level !== 'user' && !projectRoot) throw userErr(`--project needs a git repository; run it inside one`);
  return levelFiles(projectRoot)[level];
}

// Locked read-modify-write of one level. mutate(repos) returns 'created' | 'updated' | 'unchanged'.
function mutateLevel(level, projectRoot, mutate) {
  const file = levelFile(level, projectRoot);
  mkdirSync(dirname(file), { recursive: true });
  const result = withLock(file, () => {
    const data = readLevel(file) ?? { version: FILE_VERSION, repos: {} };
    const repos = { ...data.repos };
    const change = mutate(repos);
    if (change !== 'unchanged') writeAtomic(file, JSON.stringify({ ...data, version: FILE_VERSION, repos }, null, 2) + '\n');
    return change;
  });
  if (level === 'local') ensureLocalIgnored(projectRoot);
  return result;
}

function checkName(name) {
  if (!NAME_PATTERN.test(name ?? '')) throw userErr(`invalid repo name ${JSON.stringify(name)}: use lowercase letters, digits and inner hyphens`);
  if (DESTINATIONS.includes(name)) throw userErr(`invalid repo name ${name}: it is a destination name`);
}

export function parseAccepts(value) {
  const list = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) throw userErr(`--accepts needs one or more of: ${DESTINATIONS.join(', ')}`);
  const bad = list.find((d) => !DESTINATIONS.includes(d));
  if (bad) throw userErr(`unknown destination ${bad}; use: ${DESTINATIONS.join(', ')}`);
  return [...new Set(list)];
}

export function addRepo({ name, path, accepts, description, level, projectRoot = defaultProjectRoot() }) {
  checkName(name);
  const abs = normPath(path);
  if (!isOwnTopLevel(abs)) throw userErr(`${path} is not the top level of a git repository`);
  const entry = { path: realpathSync(abs), accepts };
  if (SHELL_UNSAFE.test(entry.path)) throw userErr(`${entry.path} contains a quote, \`$\`, backtick, backslash or control character; registered paths cannot`);
  if (description) entry.description = description;
  return mutateLevel(level, projectRoot, (repos) => {
    const prior = repos[name];
    if (prior !== undefined && JSON.stringify(prior) === JSON.stringify(entry)) return 'unchanged';
    repos[name] = entry;
    return prior === undefined ? 'created' : 'updated';
  });
}

export function removeRepo({ name, level, projectRoot = defaultProjectRoot() }) {
  checkName(name);
  return mutateLevel(level, projectRoot, (repos) => {
    if (!(name in repos)) return 'unchanged';
    delete repos[name];
    return 'updated';
  });
}

export function suppressRepo({ name, level, projectRoot = defaultProjectRoot() }) {
  checkName(name);
  return mutateLevel(level, projectRoot, (repos) => {
    if (repos[name] === null) return 'unchanged';
    const created = !(name in repos);
    repos[name] = null;
    return created ? 'created' : 'updated';
  });
}

// --- CLI -------------------------------------------------------------------

const REPOS_HELP = `Usage: scratch-memory repos <subcommand> [options]

Registered repos: other git repos that can receive what a session learns. Three
files hold them, merged by name with the most specific level winning:
  user     $SCRATCH_MEMORY_CONFIG_DIR/repos.json (default ~/.claude/scratch-memory/)
  project  <repo>/.claude/scratch-memory/repos.json         (committed)
  local    <repo>/.claude/scratch-memory/repos.local.json   (gitignored)
A null entry at a more specific level hides that name from the levels below.

Subcommands:
  add <name> <path> --accepts <list> [--description <text>] <level>
                      Upsert an entry. <path> must be its own git top level.
                      <list> is comma-separated from: ${DESTINATIONS.join(', ')}.
                      Reports created, updated or unchanged on stderr.
  remove <name> <level>
                      Delete the entry at that level (unchanged when absent).
  suppress <name> <level>
                      Write a null entry at that level.
  list [--json]       Every merged entry, sorted by name, each marked ok when
                      its path is still a directory and a git top level.
  resolve <name> [--json]
                      One entry. Exits 2 when its path is no longer a
                      directory; stdout still holds the entry then.
  owner <path> [--json]
                      The ok entry whose root most specifically contains
                      <path>; nothing (null with --json) when none does.

Level (add, remove, suppress need exactly one):
  --user              The user file.
  --project           The project file of the current git repo.
  --project --local   The project-local file; valid only with --project. Any
                      write adds its .gitignore line when none covers it.

Exit codes:
  0  success
  1  user error (unknown name, bad destination, missing or conflicting level, refused path)
  2  environment error (unreadable file, version too new, a registered path that is gone)
`;

function die(err) {
  process.stderr.write(`ERROR: ${err.message}\n`);
  process.exit(err.exit ?? EXIT.INFRA_ERROR);
}

// Flags that take a value, per subcommand; everything else is a boolean flag or positional.
function parseArgs(argv, valueFlags, boolFlags) {
  const flags = {};
  const pos = [];
  let stop = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!stop && a === '--') { stop = true; continue; }
    if (!stop && a.startsWith('--')) {
      if (valueFlags.includes(a)) {
        if (i + 1 >= argv.length) throw userErr(`${a} needs a value`);
        flags[a] = argv[++i];
      } else if (boolFlags.includes(a)) flags[a] = true;
      else throw userErr(`unknown option: ${a}`);
      continue;
    }
    pos.push(a);
  }
  return { flags, pos };
}

function levelFromFlags(flags) {
  const { '--user': u, '--project': p, '--local': l } = flags;
  if (l && !p) throw userErr('--local is valid only with --project; use --project --local');
  if (u && p) throw userErr('choose one level: --user, --project or --project --local');
  if (!u && !p) throw userErr('a level is required: --user, --project or --project --local');
  return u ? 'user' : l ? 'local' : 'project';
}

function needPositionals(pos, n, usage) {
  if (pos.length !== n) throw userErr(`usage: scratch-memory repos ${usage}`);
}

const humanLine = (e) => [e.name, e.path, e.accepts.join(','), e.level, e.ok ? 'ok' : 'not-ok', e.description ?? ''].join('\t').replace(/\t$/, '');

function run(sub, argv) {
  const LEVEL_FLAGS = ['--user', '--project', '--local'];
  switch (sub) {
    case 'add': {
      const { flags, pos } = parseArgs(argv, ['--accepts', '--description'], LEVEL_FLAGS);
      needPositionals(pos, 2, 'add <name> <path> --accepts <list> [--description <text>] <level>');
      const level = levelFromFlags(flags);
      const result = addRepo({ name: pos[0], path: pos[1], accepts: parseAccepts(flags['--accepts']), description: flags['--description'], level });
      process.stderr.write(`${result}\n`);
      return EXIT.SUCCESS;
    }
    case 'remove':
    case 'suppress': {
      const { flags, pos } = parseArgs(argv, [], LEVEL_FLAGS);
      needPositionals(pos, 1, `${sub} <name> <level>`);
      const level = levelFromFlags(flags);
      const result = (sub === 'remove' ? removeRepo : suppressRepo)({ name: pos[0], level });
      process.stderr.write(`${result}\n`);
      return EXIT.SUCCESS;
    }
    case 'list': {
      const { flags, pos } = parseArgs(argv, [], ['--json']);
      needPositionals(pos, 0, 'list [--json]');
      const entries = listRepos();
      process.stdout.write(flags['--json'] ? JSON.stringify(entries, null, 2) + '\n' : entries.map((e) => humanLine(e) + '\n').join(''));
      return EXIT.SUCCESS;
    }
    case 'resolve': {
      const { flags, pos } = parseArgs(argv, [], ['--json']);
      needPositionals(pos, 1, 'resolve <name> [--json]');
      const { entry, exists } = resolveRepo(pos[0]);
      process.stdout.write(flags['--json'] ? JSON.stringify(entry, null, 2) + '\n' : humanLine(entry) + '\n');
      if (!exists) {
        process.stderr.write(`ERROR: ${entry.name}'s path ${entry.path} is no longer a directory\n`);
        return EXIT.INFRA_ERROR;
      }
      return EXIT.SUCCESS;
    }
    case 'owner': {
      const { flags, pos } = parseArgs(argv, [], ['--json']);
      needPositionals(pos, 1, 'owner <path> [--json]');
      const entry = ownerOf(pos[0]);
      if (flags['--json']) process.stdout.write(JSON.stringify(entry, null, 2) + '\n');
      else if (entry) process.stdout.write(humanLine(entry) + '\n');
      return EXIT.SUCCESS;
    }
    default:
      throw userErr(`unknown repos subcommand: ${sub}\n\n${REPOS_HELP}`);
  }
}

export async function dispatch(argv) {
  const sub = argv[0];
  if (sub === '-h' || sub === '--help' || argv.slice(1).some((a) => a === '-h' || a === '--help')) {
    process.stdout.write(REPOS_HELP);
    process.exit(EXIT.SUCCESS);
  }
  if (!sub) {
    process.stderr.write(`ERROR: missing subcommand\n\n${REPOS_HELP}`);
    process.exit(EXIT.USER_ERROR);
  }
  try {
    process.exitCode = run(sub, argv.slice(1));
  } catch (err) {
    if (err instanceof ReposError) die(err);
    throw err;
  }
}

export default dispatch;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dispatch(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(EXIT.INFRA_ERROR);
  });
}
