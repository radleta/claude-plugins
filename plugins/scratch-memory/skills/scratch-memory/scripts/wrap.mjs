#!/usr/bin/env node
// wrap.mjs — `wrap` CLI verb group: the wrap-up skill's mechanical collect pass
//
// Exports:
//   OWNED_PATHS            — workstream entries the collect never lists as stray files
//   collectWrap(wsDir, opts) — the items.json object for one workstream folder; opts.sinceRef narrows it to a lane
//   dispatch(argv)         — `wrap collect` CLI entry point

import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseFrontmatter, resolveProjectRoot } from './handoff.mjs';
import { unquote, resolveInScratchSandbox, EXIT, TASK_OPEN_STATUSES, TASK_FILE_GLOB_PREFIX } from './tasks.mjs';
import { assembleSessions } from './cat-sessions.mjs';
import { listRepos, ownerOf, ReposError } from './repos.mjs';

export const OWNED_PATHS = ['sessions', 'tasks', 'learned', 'wrap', 'HANDOFF.md', 'groom.yaml', 'groom-closes.md'];

const STRAY_READ_BYTES = 64 * 1024;
export const SYMLINK_TEXT = '(symlink, not read)';

function infraError(message, cause) {
  const e = new Error(message);
  e.code = 'INFRA';
  e.cause = cause;
  return e;
}

export function git(dir, ...args) {
  try {
    return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    throw infraError(`git ${args.join(' ')} failed in ${dir}: ${(err.stderr || err.message).trim()}`, err);
  }
}

function read(path) {
  try {
    return readFileSync(path, 'utf-8');
  } catch (err) {
    throw infraError(`Failed to read ${path}: ${err.message}`, err);
  }
}

// Session files are named {ISO timestamp with dashes}-{suffix}.md.
function sessionDate(sourceFile) {
  const m = sourceFile?.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}T${m[2]}:${m[3]}:${m[4]}Z` : null;
}

// The registered repos a wrap-up may land in: every ok entry except the one rooted at this
// repo, whose destinations are already the local ones. A not-ok entry is named once on stderr.
function registeredRepos(repo) {
  let entries;
  try {
    entries = listRepos({ projectRoot: repo });
  } catch (err) {
    if (err instanceof ReposError) throw infraError(err.message, err);
    throw err;
  }
  const self = realpathSync(repo);
  const listed = [];
  for (const { ok, ...e } of entries) {
    if (!ok) {
      process.stderr.write(`note: registered repo ${e.name} skipped: ${e.path} is no longer a directory and git top level\n`);
      continue;
    }
    if (realpathSync(e.path) === self) continue;
    let corpus = false;
    try { corpus = statSync(join(e.path, 'scratch', 'issues')).isDirectory(); } catch {}
    listed.push({ ...e, corpus });
  }
  return listed;
}

// Backticked tokens that name a repo path or a primitive. Lessons name primitives more
// often than files: `knowledge-ingestor`, `/brainstorming`, `wiki-memory/page-standard.md`.
// A `~/.claude/…` token a registered repo owns resolves into that repo's `repo_paths`.
function pathResolver(repo, repos) {
  // The normalized repo-relative path, or null. A token resolving outside the repo is never
  // a path, and the raw token is never kept: git log would refuse `scratch/../x`.
  const inRepo = (p) => {
    const rel = relative(repo, resolve(repo, p));
    const ok = rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel) && existsSync(join(repo, rel));
    return ok ? rel.split(sep).join('/') : null;
  };
  const first = (candidates) => candidates.map(inRepo).find(Boolean);
  // A bare filename resolves only when exactly one file under .claude/ carries it.
  const byName = new Map();
  for (const f of git(repo, 'ls-files', '.claude').split('\n').filter(Boolean)) {
    const b = basename(f);
    byName.set(b, byName.has(b) ? null : f);
  }
  const external = (tok) => {
    const abs = join(homedir(), tok.slice(2).replace(/[:#].*$/, '').replace(/\/$/, ''));
    const owner = repos.length ? ownerOf(abs, { entries: repos }) : null;
    if (!owner) return null;
    if (!existsSync(abs)) return { owner };
    const rel = relative(realpathSync(owner.path), realpathSync(abs)).split(sep).join('/');
    return { owner, rel: rel || null };
  };
  return (text) => {
    const found = new Set();
    const unresolved = new Set();
    const repoPaths = {};
    for (const [, tok] of text.matchAll(/`([^`\s]+)`/g)) {
      if (/^https?:/.test(tok)) continue;
      if (tok.startsWith('~/.claude/')) {
        const ext = external(tok);
        if (ext) {
          if (ext.rel) (repoPaths[ext.owner.name] ??= new Set()).add(ext.rel);
          else unresolved.add(tok);
          continue;
        }
      }
      const cmd = tok.match(/^\/([a-z][a-z0-9-]+)$/);
      if (cmd) {
        const hit = first([`.claude/commands/${cmd[1]}.md`, `.claude/skills/${cmd[1]}`]);
        hit ? found.add(hit) : unresolved.add(tok);
        continue;
      }
      const p = tok.replace(/^~\/\.claude\//, '.claude/').replace(/[:#].*$/, '').replace(/\/$/, '');
      if (/^[a-z][a-z0-9-]+$/.test(p)) {
        const hit = first([`.claude/skills/${p}`, `.claude/agents/${p}.md`, `.claude/commands/${p}.md`]);
        if (hit) found.add(hit);
        continue; // a bare word naming no primitive is prose, not a path
      }
      if (!/[/.]/.test(p) || p === '.' || p.startsWith('/')) continue;
      const hit = first([p, `.claude/${p}`, `.claude/skills/${p}`]) ?? (p.includes('/') ? undefined : byName.get(p));
      hit ? found.add(hit) : unresolved.add(tok);
    }
    return {
      paths: [...found],
      paths_unresolved: [...unresolved],
      repo_paths: Object.fromEntries(Object.entries(repoPaths).map(([name, set]) => [name, [...set]])),
    };
  };
}

// `scratch/` paths live in the scratch subrepo, so their history is read there; a registered
// repo's paths are read in that repo the same way.
function changedSince(root, paths, since) {
  return paths.filter((p) => (p.startsWith('scratch/')
    ? git(join(root, 'scratch'), 'log', '--oneline', `--since=${since}`, '--', p.slice('scratch/'.length))
    : git(root, 'log', '--oneline', `--since=${since}`, '--', p)) !== '');
}

function churn(repo, paths, repoPaths, reposByName, since) {
  const names = Object.keys(repoPaths);
  if ((!paths.length && !names.length) || !since) return { status: 'no-path' };
  const changed = changedSince(repo, paths, since);
  const repoChanged = {};
  for (const name of names) {
    const hit = changedSince(reposByName[name].path, repoPaths[name], since);
    if (hit.length) repoChanged[name] = hit;
  }
  if (!changed.length && !Object.keys(repoChanged).length) return { status: 'untouched' };
  return { status: 'changed', ...(changed.length && { changed }), ...(Object.keys(repoChanged).length && { repo_changed: repoChanged }) };
}

// A file item needs only its first heading or line, so the read is capped.
function readHead(path) {
  const buf = Buffer.alloc(STRAY_READ_BYTES);
  let fd;
  try {
    fd = openSync(path, 'r');
    return buf.toString('utf-8', 0, readSync(fd, buf, 0, STRAY_READ_BYTES, 0));
  } catch (err) {
    throw infraError(`Failed to read ${path}: ${err.message}`, err);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function listFiles(dir, root, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    throw infraError(`Failed to read directory ${dir}: ${err.message}`, err);
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, e.name);
    if (dir === root && OWNED_PATHS.includes(e.name)) continue;
    if (e.isDirectory()) listFiles(full, root, out);
    else if (e.isFile() || e.isSymbolicLink()) out.push({ full, symlink: e.isSymbolicLink() });
  }
  return out;
}

function firstHeadingOrLine(content) {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  return (lines.find((l) => /^#{1,6}\s/.test(l)) ?? lines[0] ?? '').slice(0, 200);
}

/**
 * Collect every item a wrap-up must sort from one workstream folder.
 * With sinceRef, an item is kept only when its session, task or folder file was added or
 * changed in the scratch repo's sinceRef..HEAD.
 * @throws {Error} .code 'NO_SESSIONS_DIR' | 'NO_SESSIONS' (user errors) or 'INFRA' | 'FS_READ'
 */
export function collectWrap(wsDir, { sinceRef = null } = {}) {
  const scratchRoot = dirname(wsDir);
  const repo = dirname(scratchRoot);
  const cat = assembleSessions(wsDir, { format: 'json' });

  const wsName = basename(wsDir);
  const touched = sinceRef === null ? null : new Set(
    git(scratchRoot, 'diff', '--name-only', '--relative', `${sinceRef}..HEAD`, '--', wsName)
      .split('\n').filter(Boolean).map((p) => p.slice(wsName.length + 1)));
  const inScope = (wsRel) => !touched || touched.has(wsRel.split(sep).join('/'));

  const repos = registeredRepos(repo);
  const reposByName = Object.fromEntries(repos.map((r) => [r.name, r]));
  const resolvePaths = pathResolver(repo, repos);
  const items = [];
  const counters = {};
  const nextId = (kind) => {
    counters[kind] = (counters[kind] ?? 0) + 1;
    return `${kind[0]}${String(counters[kind]).padStart(3, '0')}`;
  };
  const add = (kind, entry, extra = {}) => {
    if (!inScope(entry.source_file)) return;
    const since = sessionDate(entry.source_file);
    const { paths, paths_unresolved, repo_paths } = resolvePaths(entry.text);
    items.push({ id: nextId(kind), kind, text: entry.text, source: entry.source_file, since,
      paths, paths_unresolved, ...(Object.keys(repo_paths).length && { repo_paths }),
      churn: churn(repo, paths, repo_paths, reposByName, since), ...extra });
  };
  cat.cumulative_decisions.forEach((e) => add('decision', e));
  cat.cumulative_avoid.forEach((e) => add('avoid', e));
  cat.still_open_questions
    .forEach((q) => add('question', q, { qid: q.id, age_sessions: q.age_sessions }));

  const excluded_done_tasks = [];
  const tasksDir = join(wsDir, 'tasks');
  let taskNames = [];
  try {
    if (existsSync(tasksDir)) taskNames = readdirSync(tasksDir).filter((n) => n.startsWith(TASK_FILE_GLOB_PREFIX) && n.endsWith('.md')).sort();
  } catch (err) {
    throw infraError(`Failed to read directory ${tasksDir}: ${err.message}`, err);
  }
  for (const name of taskNames) {
    const file = join(tasksDir, name);
    const body = read(file);
    const fm = parseFrontmatter(body);
    const id = name.slice(0, 8);
    const text = unquote(fm.title ?? '');
    if (fm.status === 'done') excluded_done_tasks.push({ id, title: text });
    else if (TASK_OPEN_STATUSES.includes(fm.status) && inScope(relative(wsDir, file))) {
      items.push({ id, kind: 'task', status: fm.status, file: relative(repo, file), text, body });
    }
  }

  // A symlink's target may lie outside the repo, so it is listed but never read.
  for (const { full, symlink } of listFiles(wsDir, wsDir)) {
    if (!inScope(relative(wsDir, full))) continue;
    items.push({ id: nextId('file'), kind: 'file', path: relative(repo, full), text: symlink ? SYMLINK_TEXT : firstHeadingOrLine(readHead(full)) });
  }

  return {
    head: {
      repo: git(repo, 'rev-parse', '--short', 'HEAD'),
      scratch: git(scratchRoot, 'rev-parse', '--short', 'HEAD'),
      repos: Object.fromEntries(repos.map((r) => [r.name, git(r.path, 'rev-parse', '--short', 'HEAD')])),
    },
    repos,
    learned_repo: repos.length ? ownerOf(join(homedir(), '.claude', 'skills'), { entries: repos })?.name ?? null : null,
    items,
    excluded_done_tasks,
  };
}

const WRAP_HELP = `Usage: scratch-memory wrap collect <workstream-dir> [--since-ref <ref>]

Collect everything a wrap-up must sort from one workstream folder and write it to
<workstream-dir>/wrap/items.json, overwriting any earlier one. Prints that path.

Items: every cumulative decision (d001…), lesson (a001…) and still-open question
(q001…) from the session log, a question closed in the ledger groom-closes.md
being no longer open; every open or blocked task (t-xxxxxx); and every file
outside the paths the workstream's own tooling owns — sessions/, tasks/,
learned/, wrap/, HANDOFF.md, groom.yaml, groom-closes.md — as a file item
(f001…); a symlink is listed but never read. Done
tasks are listed under excluded_done_tasks. Each decision, lesson and question
carries its resolved paths and its churn since its session date: untouched,
changed, or no-path.

Registered repos (scratch-memory repos): items.json lists every ok entry except
the one rooted at this repo under "repos", each with "corpus" true when it holds
scratch/issues/, adds their HEAD shas under head.repos, and names the one that
owns ~/.claude/skills as "learned_repo" (or null). An entry that is not ok is
left out and named once on stderr. A ~/.claude/... token a listed repo owns
resolves into that item's repo_paths; any other ~/.claude/... token resolves in
this repo.

Arguments:
  workstream-dir  The workstream folder (e.g. scratch/S-my-session/). Must be an
                  existing directory inside the project's scratch/ directory,
                  holding sessions/.

Options:
  --since-ref <ref>  Lane scope: keep only items whose session file, task file or
                     folder file was added or changed in the scratch repo's
                     <ref>..HEAD. /end-lane passes the scratch lane branch's fork
                     commit. Every other field and the output path are unchanged.
  -h, --help    Show this help.
  --            Stop flag parsing; the next token is the positional argument.

Exit codes:
  0  success
  1  usage error, or a folder with no session files
  2  I/O or git failure
`;

function userError(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(EXIT.USER_ERROR);
}

// `dispatch` honors -h/--help only as the group's first token, so without this
// `wrap collect --help` reaches the flag parser and dies as an unknown option.
function wroteSubcommandHelp(argv) {
  const flags = argv.includes('--') ? argv.slice(0, argv.indexOf('--')) : argv;
  if (!flags.includes('-h') && !flags.includes('--help')) return false;
  process.stdout.write(WRAP_HELP);
  process.exitCode = EXIT.SUCCESS;
  return true;
}

function cmdCollect(argv) {
  if (wroteSubcommandHelp(argv)) return;
  let stopFlags = false;
  let positional = null;
  let sinceRef = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!stopFlags && a === '--') { stopFlags = true; continue; }
    if (!stopFlags && a === '--since-ref') {
      sinceRef = argv[++i];
      if (!sinceRef || sinceRef.startsWith('-')) userError('--since-ref needs a <ref>');
      continue;
    }
    if (!stopFlags && a.startsWith('-')) userError(`unknown option: ${a}`);
    if (positional !== null) userError('too many positional arguments');
    positional = a;
  }
  if (positional === null) userError('missing <workstream-dir>');
  const wsDir = resolveInScratchSandbox(positional, 'workstream-dir');
  let isDir = false;
  try { isDir = statSync(wsDir).isDirectory(); } catch {}
  if (!isDir) userError(`not a directory: ${positional}`);
  const projectRoot = resolveProjectRoot();
  const scratchRoot = basename(projectRoot) === 'scratch' ? projectRoot : join(projectRoot, 'scratch');
  if (dirname(wsDir) !== scratchRoot) userError(`not a workstream folder directly under scratch/: ${positional}`);
  // The sandbox check is lexical; a symlinked folder, wrap/ or items.json could still land the write outside scratch/.
  if (!realpathSync(wsDir).startsWith(realpathSync(scratchRoot) + sep)) {
    userError('OUT_OF_SANDBOX_PATH: workstream-dir resolves outside the project scratch root through a symlink');
  }
  for (const p of [join(wsDir, 'wrap'), join(wsDir, 'wrap', 'items.json')]) {
    let link = false;
    try { link = lstatSync(p).isSymbolicLink(); } catch {}
    if (link) userError(`OUT_OF_SANDBOX_PATH: ${relative(wsDir, p)} is a symlink; the collect writes only through real paths`);
  }

  if (sinceRef !== null) {
    try {
      execFileSync('git', ['-C', scratchRoot, 'rev-parse', '--verify', '-q', `${sinceRef}^{commit}`], { stdio: 'ignore' });
    } catch {
      userError(`--since-ref: not a commit in the scratch repo: ${sinceRef}`);
    }
  }

  let result;
  try {
    result = collectWrap(wsDir, { sinceRef });
  } catch (err) {
    if (err.code === 'NO_SESSIONS_DIR' || err.code === 'NO_SESSIONS') userError(err.message);
    if (err.code !== 'INFRA' && err.code !== 'FS_READ') throw err;
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exit(EXIT.INFRA_ERROR);
  }

  const out = join(wsDir, 'wrap', 'items.json');
  try {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(result, null, 2) + '\n', 'utf-8');
  } catch (err) {
    process.stderr.write(`ERROR: failed to write ${out}: ${err.message}\n`);
    process.exit(EXIT.INFRA_ERROR);
  }
  process.stdout.write(`${out}\n`);
  process.exitCode = EXIT.SUCCESS;
}

export async function dispatch(argv) {
  const verb = argv[0];
  if (verb === '-h' || verb === '--help') {
    process.stdout.write(WRAP_HELP);
    process.exit(EXIT.SUCCESS);
  }
  if (!verb) {
    process.stderr.write('ERROR: missing subcommand\n\n');
    process.stderr.write(WRAP_HELP);
    process.exit(EXIT.USER_ERROR);
  }
  if (verb !== 'collect') {
    process.stderr.write(`ERROR: unknown wrap subcommand: ${verb}\n\n`);
    process.stderr.write(WRAP_HELP);
    process.exit(EXIT.USER_ERROR);
  }
  cmdCollect(argv.slice(1));
}

export default dispatch;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dispatch(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(EXIT.INFRA_ERROR);
  });
}
