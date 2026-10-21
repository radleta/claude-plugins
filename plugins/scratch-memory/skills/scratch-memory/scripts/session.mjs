#!/usr/bin/env node
// session.mjs — `session` CLI verb group: workstream task-data checks, the groom marker,
// and the event groom's verbs (the close ledger and the run's marks)
//
// Exports:
//   SESSION_CHECKS            — the eight finding kinds, in report order
//   SESSION_WARNINGS          — the warning kinds; printed, never counted, never an exit code
//   lintSession(sessionDir)   — {findings, warnings, data_problems, methodology_version, marker_version, version_behind}
//   sessionRadius(sessionDir) — the rows an event's new evidence reaches, with the run's marks
//   dispatch(argv)            — `session lint|mark-groomed|radius|close|mark-event-groomed` CLI entry point
//
// lintSession reads task files itself (bodies and promoted_to), because scanTasks'
// record shape is pinned by the cat-sessions json contract and must not grow.

import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, basename, dirname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseFrontmatter, resolveProjectRoot } from './handoff.mjs';
import {
  lintTaskFile,
  unquote,
  ISSUE_SLUG_PATTERN,
  readGroomMarker,
  writeGroomMarker,
  writeEventMarks,
  readEventMarks,
  GROOM_MARKER_FILENAME,
  readFileNoFollow,
  writeFileAtomic,
  listOrThrow,
  resolveInScratchSandbox,
  EXIT,
  TASKS_METHODOLOGY_VERSION,
  TASK_OPEN_STATUSES,
  TASK_FILE_GLOB_PREFIX,
} from './tasks.mjs';
import {
  assembleSessions, assembleWithMarks, readLedger, extractBody, extractSection, extractBullets,
  sortSessionFilesNewestFirst, parseFilenameTsPrefix, LEDGER_FILE,
} from './cat-sessions.mjs';
import { parseArgs, readInput } from './issues.mjs';
import { rewritePointer } from './rewrite-pointer.mjs';
import { git } from './wrap.mjs';
import { withLock } from './repos.mjs';

export const SESSION_CHECKS = [
  'task-warn',
  'missing-done-when',
  'blocked-without-blocked-on',
  'promoted-to-missing',
  'moved-to-missing-task',
  'open-question-moved',
  'blocked-on-closed-question',
  'version-behind',
];

export const SESSION_WARNINGS = ['question-shape'];

const MOVED_TO_TASK = /moved to task (t-[0-9a-f]{6})/gi;
const Q_ID = /\bq-[0-9a-f]{6}\b/g;
const TASK_ID = /\bt-[0-9a-f]{6}\b/;
const CLOSE_KINDS = ['answered', 'moot', 'tracked'];
const QUOTE_MAX = 200;

function readOrThrow(path) {
  try {
    return readFileSync(path, 'utf-8');
  } catch (err) {
    const wrapped = new Error(`Failed to read ${path}: ${err.message}`);
    wrapped.code = 'FS_READ';
    throw wrapped;
  }
}

function bodyOf(content) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---[^\n]*\n?/, '');
}

/**
 * Run the seven task-data checks on a workstream folder's task files.
 * @throws {Error} with .code 'FS_READ' when a directory or file cannot be read
 */
function lintTaskData(sessionDir, tasksDir, taskNames) {
  const findings = [];
  const add = (check, file, message) => findings.push({ check, file, message });
  const taskIds = new Set(taskNames.map((n) => n.slice(0, 8)));
  const scratchRoot = dirname(sessionDir);

  const tasks = taskNames.map((name) => {
    const content = readOrThrow(join(tasksDir, name));
    return { name, content, fm: parseFrontmatter(content) };
  });

  for (const { name, content, fm } of tasks) {
    for (const problem of lintTaskFile(join(tasksDir, name), content)) add('task-warn', name, problem);

    if (TASK_OPEN_STATUSES.includes(fm.status)) {
      const firstLine = bodyOf(content).split('\n').find((l) => l.trim() !== '') ?? '';
      if (!firstLine.trim().startsWith('Done when:')) {
        add('missing-done-when', name, `${fm.status} task body does not open with "Done when:"`);
      }
    }
    if (fm.status === 'blocked' && !unquote(fm.blocked_on ?? '').trim()) {
      add('blocked-without-blocked-on', name, 'status: blocked with no blocked_on');
    }
    const promotedTo = unquote(fm.promoted_to ?? '').trim();
    if (promotedTo && !ISSUE_SLUG_PATTERN.test(promotedTo)) {
      add('promoted-to-missing', name, 'promoted_to is malformed: not an issue slug');
    } else if (promotedTo && !existsSync(join(scratchRoot, 'issues', `${promotedTo}.md`))) {
      add('promoted-to-missing', name, `promoted_to names a missing issue: scratch/issues/${promotedTo}.md`);
    }
  }

  const sessionsDir = join(sessionDir, 'sessions');
  for (const name of listOrThrow(sessionsDir, (n) => n.endsWith('.md'))) {
    const content = readOrThrow(join(sessionsDir, name));
    for (const [, id] of content.matchAll(MOVED_TO_TASK)) {
      if (!taskIds.has(id.toLowerCase())) add('moved-to-missing-task', name, `moved to task ${id} names no task file`);
    }
  }
  // A groom's move of a question to a task is a tracked close in the ledger.
  const trackedBy = new Map(); // q-id → the task id its tracked close cites
  for (const close of readLedger(sessionDir)) {
    const taskId = close.kind === 'tracked' ? close.cite.match(TASK_ID)?.[0] : undefined;
    if (!taskId) continue;
    trackedBy.set(close.id, taskId);
    if (!taskIds.has(taskId)) add('moved-to-missing-task', LEDGER_FILE, `${close.id} is closed as tracked by ${taskId}, which names no task file`);
  }

  let stillOpen = [];
  try {
    stillOpen = assembleSessions(sessionDir).still_open_questions;
  } catch (err) {
    if (err.code !== 'NO_SESSIONS_DIR' && err.code !== 'NO_SESSIONS') throw err;
  }
  for (const q of stillOpen) {
    if (/moved to task/i.test(q.text)) {
      add('open-question-moved', basename(q.source_file), `${q.id} is still open but says moved to task`);
    }
  }
  const stillOpenIds = new Set(stillOpen.map((q) => q.id));
  for (const { name, fm } of tasks) {
    if (fm.status !== 'blocked') continue;
    for (const [qid] of unquote(fm.blocked_on ?? '').matchAll(Q_ID)) {
      // The task a tracked close names is the record of what is owed, not a stale gate.
      if (trackedBy.get(qid) === name.slice(0, 8)) continue;
      if (!stillOpenIds.has(qid)) add('blocked-on-closed-question', name, `blocked_on names ${qid}, which is no longer still open`);
    }
  }

  return findings;
}

/**
 * One warning per bullet under the newest session file's `## Open questions raised` that
 * breaks the question shape: no `?`, more than one, or no `settles when:` clause.
 */
function questionShapeWarnings(sessionDir) {
  const sessionsDir = join(sessionDir, 'sessions');
  const [newest] = sortSessionFilesNewestFirst(listOrThrow(sessionsDir, (n) => n.endsWith('.md')), sessionsDir);
  if (!newest) return [];
  const raised = extractSection(extractBody(readOrThrow(join(sessionsDir, newest))), 'Open questions raised');
  const warnings = [];
  for (const bullet of extractBullets(raised, true)) {
    const settles = bullet.search(/settles when:/i);
    const marks = (settles === -1 ? bullet : bullet.slice(0, settles)).split('?').length - 1;
    const faults = [];
    if (marks === 0) faults.push('no "?"');
    if (marks > 1) faults.push('more than one "?"');
    if (settles === -1) faults.push('no "settles when:" clause');
    if (faults.length > 0) {
      warnings.push({ check: 'question-shape', file: newest, message: `${faults.join(', ')}: ${bullet.slice(0, 60)}` });
    }
  }
  return warnings;
}

/**
 * Run the seven task-data checks and the version check on a workstream folder. The return's
 * `warnings` are the question-shape lines: printed, never findings, never in `data_problems`.
 * The data checks need task files; the version check runs either way, because a
 * folder with session history and no marker has never been groomed and is the
 * case groom exists for. A new workstream gets its marker from its first write.
 * @throws {Error} with .code 'FS_READ' when a directory or file cannot be read
 */
export function lintSession(sessionDir) {
  const marker = readGroomMarker(sessionDir);
  const tasksDir = join(sessionDir, 'tasks');
  const taskNames = listOrThrow(tasksDir, (n) => n.startsWith(TASK_FILE_GLOB_PREFIX) && n.endsWith('.md'));
  const findings = taskNames.length > 0 ? lintTaskData(sessionDir, tasksDir, taskNames) : [];

  const result = {
    findings,
    warnings: questionShapeWarnings(sessionDir),
    data_problems: findings.length,
    methodology_version: TASKS_METHODOLOGY_VERSION,
    marker_version: marker ? marker.methodology_version : null,
    version_behind: !marker || marker.methodology_version < TASKS_METHODOLOGY_VERSION,
  };
  if (result.version_behind) {
    const had = marker ? `v${marker.methodology_version}` : 'missing marker';
    findings.push({ check: 'version-behind', file: '-', message: `task methodology v${TASKS_METHODOLOGY_VERSION} is newer than this workstream's ${had}` });
  }
  return result;
}

const SESSION_HELP = `Usage: scratch-memory session <subcommand> <session-dir> [options]

Check a workstream's task data against the task methodology, record a groom,
and write an event groom's question closes and marks. The group reads tasks/,
groom.yaml, groom-closes.md and sessions/ files; of a session file's structure
it checks only the shape of the newest file's raised questions, as a warning,
and it never calls write_session.

Subcommands:
  lint <session-dir>          One line per finding: <check>: <file>: <message>.
                              <file> is a basename, or '-' when the finding has
                              none. Checks: task-warn, missing-done-when,
                              blocked-without-blocked-on, promoted-to-missing,
                              moved-to-missing-task, open-question-moved,
                              blocked-on-closed-question, version-behind.
                              The first seven need tasks/t-*.md files;
                              version-behind fires with or without them.
                              Warnings follow the findings in the same line
                              form and never change the exit code. One kind,
                              question-shape: a bullet under the newest session
                              file's "## Open questions raised" with no "?",
                              more than one, or no "settles when:" clause.
  mark-groomed <session-dir>  Write groom.yaml at the current task methodology
                              version and print its path. The folder must be
                              named S-<id> and its real path must lie inside
                              scratch/. Keeps the event_* keys.
  radius <session-dir> [--json] [--cap N]
                              Read-only. Print the run time, the three marks
                              (code and scratch HEAD commits, newest session
                              file), then "pending: none" or the rows an event
                              groom is dispatched on: the stored remainder that
                              is still open, then the still-open questions and
                              open or blocked tasks that the session files and
                              commits newer than the stored marks nominate, by
                              id, a shared three-word phrase or a specific
                              path. Each row: id | kind | remainder, id, phrase
                              or path | the commit sha or session file it came
                              from | that reference's evidence line. Rows past
                              --cap (default 10) follow as id=ref. Save points
                              are never rows. A commit that changes only this
                              workstream's folder or a lane record is not
                              evidence.
  close <session-dir> <q-id> --kind <answered|moot|tracked>
        --cite <file:line, sha or path> --quote-file <path|-> --event <name>
        --run <ISO UTC time>
                              Append one close line under the heading
                              "## <event> <run>" in groom-closes.md, then
                              regenerate HANDOFF.md, and print the line. The
                              quote is read from a file or from stdin (-), at
                              most ${QUOTE_MAX} characters. Refused, writing nothing,
                              unless <q-id> names exactly one still-open
                              question. A tracked close against a task cites
                              tasks/t-<6hex>-<slug>.md.
  mark-event-groomed <session-dir> --code <sha> --scratch <sha>
        --session <file> [--remainder <id=ref,id=ref,...>]
                              Store an event groom's marks and remainder in
                              groom.yaml as event_code, event_scratch,
                              event_session and event_remainder, leaving
                              methodology_version and groomed as they are, and
                              print its path. No --remainder stores an empty
                              list; each ref is a commit sha or a session file
                              name.

Arguments:
  session-dir   The workstream folder (e.g. scratch/S-my-session/). Must be an
                existing directory inside the project's scratch/ directory.

Options:
  -h, --help    Show this help.
  --            lint and mark-groomed only: stop flag parsing; the next token
                is the positional argument.

Exit codes:
  0  success (lint with no findings, warnings or not; a verb that wrote)
  1  lint findings (stdout non-empty), or a user/argument error (stderr)
  2  infrastructure error (an FS read or write failure, or for radius a git
     failure, which never reads as "nothing new"). After close, exit 2
     with the line appended means HANDOFF.md was not regenerated:
     scratch-memory rewrite-pointer recovers it.
`;

function userError(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(EXIT.USER_ERROR);
}

function resolveSessionDir(argv) {
  let stopFlags = false;
  let positional = null;
  for (const a of argv) {
    if (!stopFlags && a === '--') { stopFlags = true; continue; }
    if (!stopFlags && a.startsWith('-')) userError(`unknown option: ${a}`);
    if (positional !== null) userError('too many positional arguments');
    positional = a;
  }
  if (positional === null) userError('missing <session-dir>');
  return existingDir(positional);
}

function existingDir(positional) {
  const resolved = resolveInScratchSandbox(positional, 'session-dir');
  let isDir = false;
  try { isDir = statSync(resolved).isDirectory(); } catch {}
  if (!isDir) userError(`not a directory: ${positional}`);
  return resolved;
}

// A verb that writes takes only a folder named S-<id> whose real path lies inside scratch/:
// the sandbox check is lexical, and a symlinked folder could still land the write outside.
function requireWorkstream(sessionDir) {
  if (!/^S-[A-Za-z0-9._-]+$/.test(basename(sessionDir))) {
    userError(`not a workstream folder (S-<id>): ${basename(sessionDir)}`);
  }
  const projectRoot = resolveProjectRoot();
  const scratchRoot = basename(projectRoot) === 'scratch' ? projectRoot : join(projectRoot, 'scratch');
  if (!realpathSync(sessionDir).startsWith(realpathSync(scratchRoot) + sep)) {
    userError('OUT_OF_SANDBOX_PATH: session-dir resolves outside the project scratch root through a symlink');
  }
  return sessionDir;
}

// The folder check does not cover a file inside it that is itself a symlink: a verb that reads
// such a file and writes it back whole would copy the link's target into the workstream.
function requireOwnFile(sessionDir, name) {
  let isLink = false;
  try { isLink = lstatSync(join(sessionDir, name)).isSymbolicLink(); } catch {}
  if (isLink) userError(`OUT_OF_SANDBOX_PATH: ${name} is a symlink; replace it with a regular file`);
}

function cmdLint(argv) {
  const sessionDir = resolveSessionDir(argv);
  let result;
  try {
    result = lintSession(sessionDir);
  } catch (err) {
    if (err.code !== 'FS_READ') throw err;
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exit(EXIT.INFRA_ERROR);
  }
  const lines = [...result.findings, ...result.warnings];
  if (lines.length > 0) {
    process.stdout.write(lines.map((f) => `${f.check}: ${f.file}: ${f.message}`).join('\n') + '\n');
  }
  process.exitCode = result.findings.length > 0 ? EXIT.USER_ERROR : EXIT.SUCCESS;
}

function cmdMarkGroomed(argv) {
  const sessionDir = requireWorkstream(resolveSessionDir(argv));
  requireOwnFile(sessionDir, GROOM_MARKER_FILENAME);
  let path;
  try {
    path = writeGroomMarker(sessionDir);
  } catch (err) {
    process.stderr.write(`ERROR: failed to write groom.yaml: ${err.message}\n`);
    process.exit(EXIT.INFRA_ERROR);
  }
  process.stdout.write(`${path}\n`);
  process.exitCode = EXIT.SUCCESS;
}

// ---------------------------------------------------------------------------
// session radius
// ---------------------------------------------------------------------------

const RADIUS_STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'not', 'should', 'does', 'will', 'into', 'when', 'what', 'which', 'its', 'than', 'has', 'have', 'but', 'was', 'all', 'any', 'one', 'per', 'via', 'can', 'been', 'each', 'only', 'still']);
const RADIUS_SECTIONS = ['Decisions made', 'Done', 'What to avoid', 'Open questions resolved'];
const RADIUS_RANK = { id: 0, phrase: 1, path: 2 };
const SHA = /^[0-9a-f]{7,40}$/;
const SESSION_FILE_NAME = /^[A-Za-z0-9._-]+\.md$/;
const TASK_FILE_NAME = /^t-[0-9a-f]{6}-[A-Za-z0-9._-]+\.md$/;

function phrases(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9_.\-/~]+/g, ' ').split(' ').filter((w) => w.length > 2 && !RADIUS_STOP.has(w));
  const out = new Set();
  for (let i = 0; i + 2 < words.length; i++) out.add(words.slice(i, i + 3).join(' '));
  return out;
}

// A path nominates only when it is specific: two or more segments with a real leaf, or a
// file with an extension. A bare directory such as `scratch/` touches everything.
function specificPath(p) {
  const y = p.replace(/\/$/, '');
  const segs = y.split('/');
  return (segs.length >= 2 && segs.at(-1).length > 0 && !/^\.?[a-z-]+$/.test(y)) || /\.[a-z]{1,5}$/.test(y);
}

// A session file as evidence: its decision, done, avoid, resolved and next-step lines, and
// every specific backticked path in its body. Null when the file is gone.
function sessionEvidence(sessionDir, name) {
  const path = join(sessionDir, 'sessions', name);
  if (!existsSync(path)) return null;
  const body = extractBody(readOrThrow(path));
  const lines = RADIUS_SECTIONS.flatMap((h) => extractBullets(extractSection(body, h), true));
  lines.push(...extractSection(body, 'Next best step').split('\n').map((l) => l.trim()).filter(Boolean));
  const paths = (body.match(/`[^`\n]+`/g) ?? []).map((x) => x.slice(1, -1)).filter((x) => /[/.]/.test(x) && specificPath(x));
  return { ref: name, lines, paths: [...new Set(paths)] };
}

// A repo's non-merge commits in `range` as evidence, newest first. A commit counts only
// when it changes a path outside this workstream's folder and outside every lane record,
// and it nominates only through its subject and those paths. `--relative` prints paths from
// `repo` itself, so the filter and a path nomination hold when `repo` sits below its git root.
function commitEvidence(repo, scratchPrefix, wsName, range) {
  // quotePath off keeps a non-ASCII path as written, so the own-folder test below still sees it.
  const out = git(repo, '-c', 'core.quotePath=false', 'log', '--no-merges', '--name-only', '--relative', '--format=%x1e%H%x1f%s', ...range);
  const own = new RegExp(`^${scratchPrefix}(${wsName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|L-[^/]+)/`);
  // Split only where a record header follows, so a separator byte inside a subject stays in it.
  return out.split(/\x1e(?=[0-9a-f]{40}\x1f)/).filter(Boolean).flatMap((record) => {
    const [head, ...rest] = record.split('\n');
    const [sha, subject] = head.split('\x1f');
    // Git still C-quotes a path holding a quote, a backslash or a control character.
    const paths = rest.filter(Boolean).filter((p) => !own.test(p.replace(/^"/, '')));
    return paths.length > 0 ? [{ ref: sha, lines: [subject], paths }] : [];
  });
}

function commitResolves(repo, sha) {
  try {
    git(repo, 'cat-file', '-e', `${sha}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

// How one piece of evidence nominates a row: its id, a shared three-word phrase, or a path.
function nominate(row, source) {
  const byId = source.lines.find((l) => l.includes(row.id));
  if (byId) return { by: 'id', ref: source.ref, evidence: byId };
  const own = phrases(row.match);
  const byPhrase = source.lines.find((l) => [...phrases(l)].some((p) => own.has(p)));
  if (byPhrase) return { by: 'phrase', ref: source.ref, evidence: byPhrase };
  const byPath = source.paths.find((p) => row.match.includes(p));
  if (byPath) return { by: 'path', ref: source.ref, evidence: byPath };
  return null;
}

/**
 * The rows an event groom is dispatched on. Reads git and the workstream; writes nothing.
 * `pending` is empty when nothing is newer than the stored marks, or when the new evidence
 * and the stored remainder leave no row.
 * @throws {Error} .code 'INFRA' on a git failure, 'FS_READ' on a read failure,
 *                 'NO_SESSIONS_DIR' | 'NO_SESSIONS' (user errors)
 */
export function sessionRadius(sessionDir, { cap = 10, now = new Date() } = {}) {
  const scratchRoot = dirname(sessionDir);
  const codeRepo = dirname(scratchRoot);
  const wsName = basename(sessionDir);
  const { assembled, still_open_marks } = assembleWithMarks(sessionDir);
  const sessionsDir = join(sessionDir, 'sessions');
  // Only names the write tools could have produced are read, here and for the rows below: a
  // name reaches the output, and from there a shell.
  const sessionFiles = sortSessionFilesNewestFirst(listOrThrow(sessionsDir, (n) => SESSION_FILE_NAME.test(n)), sessionsDir);
  if (sessionFiles.length === 0) throw Object.assign(new Error(`NO_SESSIONS: no session file with a plain name in ${sessionsDir}`), { code: 'NO_SESSIONS' });
  const marks = { code: git(codeRepo, 'rev-parse', 'HEAD'), scratch: git(scratchRoot, 'rev-parse', 'HEAD'), session: sessionFiles[0] };
  const result = { run: now.toISOString(), marks, pending: [], past_cap: [], dropped: [] };

  // A scratch/ the code repo tracks in place has no commits of its own: the code pass reads
  // them, under the same `scratch/` prefix, and a second pass would read each one unfiltered.
  const scratchInPlace = git(scratchRoot, 'rev-parse', '--show-prefix') !== '';
  const stored = readEventMarks(sessionDir);
  // A stamp is held to what mark-event-groomed writes: `HEAD` resolves too, and would make every
  // range empty, and a session name no file carries would hide every later file.
  const stamp = stored && SHA.test(stored.code) && SHA.test(stored.scratch) && sessionFiles.includes(stored.session)
    && commitResolves(codeRepo, stored.code) && commitResolves(scratchRoot, stored.scratch) ? stored : null;
  let newSessions, codeRange, scratchRange;
  if (stamp) {
    newSessions = sessionFiles.filter((f) => f > stamp.session);
    codeRange = [`${stamp.code}..HEAD`];
    scratchRange = [`${stamp.scratch}..HEAD`];
  } else {
    // First run: the newest session file and the commits dated since the session before it.
    newSessions = [sessionFiles[0]];
    const since = sessionFiles[1] && parseFilenameTsPrefix(sessionFiles[1]);
    codeRange = scratchRange = since ? [`--since=${since.toISOString()}`] : null;
  }
  const evidence = [
    ...newSessions.map((f) => sessionEvidence(sessionDir, f)),
    ...(codeRange ? commitEvidence(codeRepo, 'scratch/', wsName, codeRange) : []),
    ...(scratchRange && !scratchInPlace ? commitEvidence(scratchRoot, '', wsName, scratchRange) : []),
  ];
  if (evidence.length === 0) return result;

  // Open rows. A save point is never one: /pickup resumes from it in the same turn.
  const rows = new Map();
  for (const q of assembled.still_open_questions) {
    if (!SESSION_FILE_NAME.test(basename(q.source_file))) continue;
    const mark = still_open_marks.get(q.id);
    rows.set(q.id, { id: q.id, kind: 'question', text: q.text, source_file: q.source_file, age_sessions: q.age_sessions,
      ...(mark && { still_open: { text: mark.text, date: mark.date } }), match: q.text });
  }
  const tasksDir = join(sessionDir, 'tasks');
  for (const name of listOrThrow(tasksDir, (n) => TASK_FILE_NAME.test(n))) {
    const content = readOrThrow(join(tasksDir, name));
    const fm = parseFrontmatter(content);
    if (!TASK_OPEN_STATUSES.includes(fm.status) || /^Save point /m.test(content)) continue;
    rows.set(name.slice(0, 8), { id: name.slice(0, 8), kind: 'task', file: join('tasks', name), status: fm.status, title: unquote(fm.title ?? ''), match: content });
  }

  // The stored remainder that is still open leads, each row with its stored reference's
  // evidence read again; a reference that no longer resolves leaves the line out. groom.yaml
  // arrives by merge and hand edit too, so a stored reference that is neither a sha nor a
  // bare file name is dropped here: it would be joined onto sessions/ and printed for a shell.
  const pending = [];
  const taken = new Set();
  for (const { id, ref } of stored?.remainder ?? []) {
    const row = rows.get(id);
    if (!row || taken.has(id)) continue;
    if (!(SHA.test(ref) || SESSION_FILE_NAME.test(ref))) { result.dropped.push(id); continue; }
    taken.add(id);
    let source = null;
    if (ref.endsWith('.md')) source = sessionEvidence(sessionDir, ref);
    else {
      const repo = [codeRepo, scratchRoot].find((r) => commitResolves(r, ref));
      if (repo) source = { ref, lines: [git(repo, 'log', '-1', '--format=%s', ref)], paths: git(repo, '-c', 'core.quotePath=false', 'show', '--name-only', '--relative', '--format=', ref).split('\n').filter(Boolean) };
    }
    const hit = source && (nominate(row, source) ?? (ref.endsWith('.md') ? null : { evidence: source.lines[0] }));
    pending.push({ ...row, by: 'remainder', ref, ...(hit && { evidence: hit.evidence }) });
  }

  // Then the rows the new evidence nominates: id hits, phrase hits, path hits; within a
  // rank tasks before questions, oldest question first.
  const nominated = [];
  for (const row of rows.values()) {
    if (taken.has(row.id)) continue;
    let best = null;
    for (const source of evidence) {
      const hit = nominate(row, source);
      if (hit && (!best || RADIUS_RANK[hit.by] < RADIUS_RANK[best.by])) best = hit;
    }
    if (best) nominated.push({ ...row, ...best });
  }
  nominated.sort((a, b) => RADIUS_RANK[a.by] - RADIUS_RANK[b.by]
    || (a.kind === 'task' ? 0 : 1) - (b.kind === 'task' ? 0 : 1)
    || (b.age_sessions ?? 0) - (a.age_sessions ?? 0));
  // Rows that name each other's id are one unit, their partners' partners included: placed
  // together at the strongest member, never split by the cap.
  const partners = (x) => nominated.filter((y) => y !== x && (x.match.includes(y.id) || y.match.includes(x.id)));
  for (const x of nominated) {
    if (taken.has(x.id)) continue;
    const unit = [x];
    for (const y of unit) unit.push(...partners(y).filter((z) => !unit.includes(z)));
    for (const y of unit) {
      taken.add(y.id);
      pending.push({ ...y, pair: partners(y).map((z) => z.id) });
    }
  }

  let cut = Math.min(cap, pending.length);
  while (cut < pending.length && pending.slice(0, cut).some((row) => row.pair?.includes(pending[cut].id))) cut++;
  const strip = ({ match, ...row }) => row;
  result.pending = pending.slice(0, cut).map(strip);
  result.past_cap = pending.slice(cut).map(({ id, ref }) => ({ id, ref }));
  return result;
}

function cmdRadius(argv) {
  const json = argv.includes('--json');
  const { positionals, values } = parseArgs(argv.filter((a) => a !== '--json'), ['--cap']);
  if (positionals.length !== 1) userError(`session radius takes exactly one <session-dir> (got ${positionals.length})`);
  const cap = values['--cap'] === undefined ? 10 : Number(values['--cap']);
  if (!Number.isInteger(cap) || cap < 1) userError(`--cap requires an integer >= 1, got: ${values['--cap']}`);
  const sessionDir = existingDir(positionals[0]);
  let r, dropped;
  try {
    ({ dropped, ...r } = sessionRadius(sessionDir, { cap }));
  } catch (err) {
    if (err.code === 'NO_SESSIONS_DIR' || err.code === 'NO_SESSIONS') userError(err.message);
    if (err.code !== 'INFRA' && err.code !== 'FS_READ') throw err;
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exit(EXIT.INFRA_ERROR);
  }
  if (dropped.length > 0) process.stderr.write(`WARN: groom.yaml stores a remainder reference that is not a sha or a session file name for ${dropped.join(', ')}; dropped\n`);
  if (json) {
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  } else {
    const lines = [`run: ${r.run}`, `code: ${r.marks.code}`, `scratch: ${r.marks.scratch}`, `session: ${r.marks.session}`];
    if (r.pending.length === 0) lines.push('pending: none');
    else {
      lines.push(`pending: ${r.pending.length}`);
      for (const row of r.pending) {
        lines.push(`${row.id} | ${row.kind} | ${row.by} | ${row.ref} | ${row.evidence ?? ''}`.trimEnd());
        if (row.still_open) lines.push(`  still-open mark ${row.still_open.date}: ${row.still_open.text}`);
      }
      if (r.past_cap.length > 0) lines.push('past cap:', ...r.past_cap.map(({ id, ref }) => `${id}=${ref}`));
    }
    process.stdout.write(lines.join('\n') + '\n');
  }
  process.exitCode = EXIT.SUCCESS;
}

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function cmdClose(argv) {
  const { positionals, values } = parseArgs(argv, ['--kind', '--cite', '--quote-file', '--event', '--run']);
  if (positionals.length !== 2) userError(`session close takes <session-dir> <q-id> (got ${positionals.length} positional arguments)`);
  for (const flag of ['--kind', '--cite', '--quote-file', '--event', '--run']) {
    if (values[flag] === undefined) userError(`${flag} is required`);
  }
  const sessionDir = requireWorkstream(existingDir(positionals[0]));
  const id = positionals[1];
  const { '--kind': kind, '--cite': cite, '--event': event, '--run': run } = values;
  if (!/^q-[0-9a-f]{6}$/.test(id)) userError(`not a question id (q-<6hex>): ${id}`);
  if (!CLOSE_KINDS.includes(kind)) userError(`--kind must be one of ${CLOSE_KINDS.join('|')}, got: ${kind}`);
  if (!ISO_UTC.test(run) || isNaN(Date.parse(run))) userError(`--run must be an ISO UTC time, got: ${run}`);
  if (!/^[a-z][a-z-]*$/.test(event)) userError(`--event must be a lowercase name, got: ${event}`);
  if (cite.trim() === '' || /[\r\n]/.test(cite) || cite.includes(' — "')) userError('--cite must be one line naming a file:line, a sha or a path');
  const quote = readInput('--quote-file', values['--quote-file']).replace(/\s+/g, ' ');
  if (quote.length > QUOTE_MAX) userError(`the quote is ${quote.length} characters; the limit is ${QUOTE_MAX}`);

  requireOwnFile(sessionDir, LEDGER_FILE);
  const ledgerPath = join(sessionDir, LEDGER_FILE);
  const line = `- ${id} → RESOLVED: closed — ${kind}: ${cite.trim()} — "${quote}"`;
  let pointerError = null;
  let refusal = null;
  try {
    const heading = `## ${event} ${run}`;
    // The append rewrites the file whole, so two closes that overlap would otherwise lose one.
    // The still-open test and the pointer regeneration sit under the same lock: a second close
    // of one id is refused, and the last pointer written saw every line.
    withLock(ledgerPath, () => {
      const { assembled, ambiguous_ids } = assembleWithMarks(sessionDir);
      if (ambiguous_ids.has(id)) refusal = `${id} maps to more than one question`;
      else if (!assembled.still_open_questions.some((q) => q.id === id)) refusal = `${id} is not a still-open question`;
      if (refusal) return;
      let before = '';
      try {
        before = readFileNoFollow(ledgerPath);
      } catch (err) {
        if (err.code !== 'ENOENT') throw Object.assign(new Error(`Failed to read ${ledgerPath}: ${err.message}`), { code: 'FS_READ' });
      }
      const lastHeading = before.split('\n').filter((l) => l.startsWith('## ')).pop();
      const lead = before === '' || before.endsWith('\n') ? before : before + '\n';
      writeFileAtomic(ledgerPath, lead + (lastHeading === heading ? '' : `${lead === '' ? '' : '\n'}${heading}\n`) + line + '\n');
      try { rewritePointer(sessionDir); } catch (err) { pointerError = err; }
    });
  } catch (err) {
    if (err.code === 'NO_SESSIONS_DIR' || err.code === 'NO_SESSIONS') userError(err.message);
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exit(EXIT.INFRA_ERROR);
  }
  if (refusal) userError(refusal);
  if (pointerError) {
    process.stderr.write(`ERROR: the close is written to ${ledgerPath}, but HANDOFF.md was not regenerated: ${pointerError.message}\n  recover with: scratch-memory rewrite-pointer <session-dir>\n`);
    process.exit(EXIT.INFRA_ERROR);
  }
  process.stdout.write(`${line}\n`);
  process.exitCode = EXIT.SUCCESS;
}

function cmdMarkEventGroomed(argv) {
  const { positionals, values } = parseArgs(argv, ['--code', '--scratch', '--session', '--remainder']);
  if (positionals.length !== 1) userError(`session mark-event-groomed takes exactly one <session-dir> (got ${positionals.length})`);
  const sessionDir = requireWorkstream(existingDir(positionals[0]));
  for (const flag of ['--code', '--scratch']) {
    if (!SHA.test(values[flag] ?? '')) userError(`${flag} must be a commit sha, got: ${values[flag]}`);
  }
  if (!SESSION_FILE_NAME.test(values['--session'] ?? '')) userError(`--session must be a session file name, got: ${values['--session']}`);
  const remainder = (values['--remainder'] ?? '').split(',').filter(Boolean).map((pair) => {
    const m = pair.match(/^([qt]-[0-9a-f]{6})=(.+)$/);
    if (!m || !(SHA.test(m[2]) || SESSION_FILE_NAME.test(m[2]))) userError(`--remainder entries are <row id>=<sha or session file>, got: ${pair}`);
    return { id: m[1], ref: m[2] };
  });
  requireOwnFile(sessionDir, GROOM_MARKER_FILENAME);
  let path;
  try {
    path = writeEventMarks(sessionDir, { code: values['--code'], scratch: values['--scratch'], session: values['--session'], remainder });
  } catch (err) {
    process.stderr.write(`ERROR: failed to write groom.yaml: ${err.message}\n`);
    process.exit(EXIT.INFRA_ERROR);
  }
  process.stdout.write(`${path}\n`);
  process.exitCode = EXIT.SUCCESS;
}

export async function dispatch(argv) {
  const verb = argv[0];
  if (verb === '-h' || verb === '--help') {
    process.stdout.write(SESSION_HELP);
    process.exit(EXIT.SUCCESS);
  }
  if (!verb) {
    process.stderr.write('ERROR: missing subcommand\n\n');
    process.stderr.write(SESSION_HELP);
    process.exit(EXIT.USER_ERROR);
  }
  switch (verb) {
    case 'lint':
      cmdLint(argv.slice(1));
      break;
    case 'mark-groomed':
      cmdMarkGroomed(argv.slice(1));
      break;
    case 'radius':
      cmdRadius(argv.slice(1));
      break;
    case 'close':
      cmdClose(argv.slice(1));
      break;
    case 'mark-event-groomed':
      cmdMarkEventGroomed(argv.slice(1));
      break;
    default:
      process.stderr.write(`ERROR: unknown session subcommand: ${verb}\n\n`);
      process.stderr.write(SESSION_HELP);
      process.exit(EXIT.USER_ERROR);
  }
}

export default dispatch;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dispatch(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(EXIT.INFRA_ERROR);
  });
}
