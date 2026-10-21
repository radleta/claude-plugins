#!/usr/bin/env node
// issues.mjs — issue writing shared by the MCP `write_issue` tool and the `issue write` CLI verb,
// plus the `issue close`, `mark-groomed` and `mark-refreshed` CLI verbs
//
// Exports:
//   IssueError                                           — neutral { code, name, message }; server.mjs maps it to ProtocolError
//   ISSUE_FIELDS, LENS_PATTERN, LENS_MAX_LENGTH          — write_issue's input fields and lens shape
//   deriveSlug(title)                                    — the title → slug rule
//   writeIssue({ targetRoot, contextRoot, fields, createCorpus }) → { path, kind, title, collision_note }
//   dispatch(argv)                                       — `issue write` / `close` / `mark-groomed` / `mark-refreshed` CLI entry point
//
// No side effects at load time: nothing reads argv, stdin or the filesystem until called.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { EXIT, ISSUE_CLOSED_STATUSES, ISSUE_ROLES, SPIKE_TYPES, ISSUE_SLUG_PATTERN, writeFileAtomic } from './tasks.mjs';
import { gitTopLevel, normPath, resolveRepo, ReposError } from './repos.mjs';

const ISSUES_SUBDIR = 'issues';
// The strawman lens a build issue carries into /brainstorming. Shape-checked
// only, not an enum: the lens names live in the options-rubric skill alone, so
// renaming one stays a one-file edit. The pattern admits no newline, colon or
// `---`, so a value cannot corrupt the frontmatter it lands in.
export const LENS_PATTERN = '^[a-z][a-z -]*[a-z]$';
export const LENS_MAX_LENGTH = 40;
const PLACEHOLDER = '_Not captured._';
const ESCAPE_PREFIX = 'FS_FAILURE: Refused: path escapes';

export const ISSUE_FIELDS = ['kind', 'title', 'slug_override', 'summary', 'intent', 'impact', 'prior_thinking',
  'related', 'notes', 'role', 'epic', 'spike_type', 'blocked_by', 'lens'];

// code: the JSON-RPC error code the MCP reports (-32602 invalid params, -32000 server failure).
export class IssueError extends Error {
  constructor(code, name, message) {
    super(message);
    this.code = code;
    this.name = name;
  }
}

function gitCall(cwd, args, fallback, op) {
  try {
    return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8', timeout: 2000, cwd }).trim();
  } catch (err) {
    process.stderr.write(JSON.stringify({
      ts: new Date().toISOString(),
      tool: op,
      op,
      error: err.message,
      stderr: err.stderr?.trim(),
    }) + '\n');
    return fallback;
  }
}

export function deriveSlug(title) {
  let s = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  s = s.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length === 0) return 'untitled';
  if (s.length > 40) {
    const cut = s.lastIndexOf('-', 40);
    s = cut > 0 ? s.slice(0, cut) : s.slice(0, 40);
    s = s.replace(/-+$/g, '');
    if (s.length === 0) return 'untitled';
  }
  return s;
}

// Validate one comma-separated slug list (`epic`, `blocked_by`). Every
// element is checked against ISSUE_SLUG_PATTERN — imported from tasks.mjs, so
// the writer and the corpus lint cannot disagree about the charset. An empty
// string yields one empty element and is rejected: omitting the parameter is
// how "none" is expressed.
function validateSlugList(name, value) {
  if (typeof value !== 'string') {
    throw new IssueError(-32602, `${name.toUpperCase()}_INVALID`,
      `${name.toUpperCase()}_INVALID: Invalid ${name}: must be a string`);
  }
  const elements = value.split(',');
  if (!elements.every((element) => ISSUE_SLUG_PATTERN.test(element))) {
    throw new IssueError(-32602, `${name.toUpperCase()}_INVALID`,
      `${name.toUpperCase()}_INVALID: Invalid ${name}: ${JSON.stringify(value)} (must be one or more slugs matching ${ISSUE_SLUG_PATTERN.source}, comma-separated with no spaces)`);
  }
}

// The git state of the repo the issue was observed in.
function snapshot(contextRoot) {
  const git = (args, fallback, op) => gitCall(contextRoot, args, fallback, op);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown', 'git_branch');
  const commit = git(['rev-parse', '--short', 'HEAD'], 'unknown', 'git_commit');
  const commitSubject = git(['log', '-1', '--format=%s'], '', 'git_commit_subject');
  const statusRaw = git(['status', '--short'], 'unknown', 'git_status');
  const recentRaw = git(['log', '-n', '3', '--oneline'], '', 'git_log');
  const toplevel = git(['rev-parse', '--show-toplevel'], '', 'git_toplevel');

  let working_tree;
  if (statusRaw === 'unknown') {
    working_tree = 'unknown';
  } else if (statusRaw === '') {
    working_tree = 'clean';
  } else {
    const lines = statusRaw.split('\n').filter(Boolean);
    const untracked = lines.filter(l => l.startsWith('??')).length;
    const modified = lines.length - untracked;
    const parts = [];
    if (modified > 0) parts.push(`${modified} modified`);
    if (untracked > 0) parts.push(`${untracked} untracked`);
    working_tree = parts.join(', ');
  }

  const repo = toplevel
    ? toplevel.split(/[\\/]/).filter(Boolean).pop()
    : (contextRoot.split(/[\\/]/).filter(Boolean).pop() || 'unknown');
  const recentCommits = recentRaw ? recentRaw.split('\n').filter(Boolean).slice(0, 3) : [];
  return { branch, commit, commitSubject, working_tree, repo, recentCommits };
}

/**
 * Write one issue into <targetRoot>/scratch/issues/, recording <contextRoot>'s git state.
 * @throws {IssueError} on a validation failure (-32602) or a filesystem or escape failure (-32000)
 */
export function writeIssue({ targetRoot, contextRoot, fields, createCorpus }) {
  const { kind, title, slug_override, summary, intent, impact, prior_thinking, related, notes,
    role, epic, spike_type, blocked_by, lens } = fields;
  // Validators (fail loudly — MCP returns error to caller):
  if (!['issue', 'idea', 'mixed'].includes(kind)) {
    throw new IssueError(-32602, 'KIND_INVALID',
      `KIND_INVALID: Invalid kind: ${JSON.stringify(kind)} (must be one of: issue, idea, mixed)`);
  }
  if (typeof title !== 'string' || title.length < 1 || title.length > 80) {
    throw new IssueError(-32602, 'TITLE_INVALID',
      'TITLE_INVALID: Invalid title: must be a non-empty string of length 1..80');
  }
  const safeTitle = title.replace(/[\r\n]+/g, ' ').trim();
  if (safeTitle.length === 0) {
    throw new IssueError(-32602, 'TITLE_INVALID',
      'TITLE_INVALID: Invalid title: became empty after whitespace normalization');
  }
  if (slug_override !== undefined) {
    if (typeof slug_override !== 'string' || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug_override)) {
      throw new IssueError(-32602, 'SLUG_OVERRIDE_INVALID',
        `SLUG_OVERRIDE_INVALID: Invalid slug_override: ${JSON.stringify(slug_override)} (must match ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$)`);
    }
  }
  for (const [name, val] of [['summary', summary], ['intent', intent], ['impact', impact], ['prior_thinking', prior_thinking], ['related', related], ['notes', notes]]) {
    if (val !== undefined && typeof val !== 'string') {
      throw new IssueError(-32602, 'FIELD_INVALID',
        `FIELD_INVALID: Invalid ${name}: must be a string`);
    }
  }

  // Epic/spike keys (D14). Shape first, then exactly two cross-field rules.
  // Only what is checkable WITHIN one call is enforced here: anything needing
  // a sibling file (the graph rules E1, E2, E3 and the decision-record rule
  // E5) stays lint-only, because the writer does not read the corpus.
  if (role !== undefined && !ISSUE_ROLES.includes(role)) {
    throw new IssueError(-32602, 'ROLE_INVALID',
      `ROLE_INVALID: Invalid role: ${JSON.stringify(role)} (must be one of: ${ISSUE_ROLES.join(', ')})`);
  }
  if (spike_type !== undefined && !SPIKE_TYPES.includes(spike_type)) {
    throw new IssueError(-32602, 'SPIKE_TYPE_INVALID',
      `SPIKE_TYPE_INVALID: Invalid spike_type: ${JSON.stringify(spike_type)} (must be one of: ${SPIKE_TYPES.join(', ')})`);
  }
  if (epic !== undefined) validateSlugList('epic', epic);
  if (blocked_by !== undefined) validateSlugList('blocked_by', blocked_by);
  if (lens !== undefined && (typeof lens !== 'string' || lens.length > LENS_MAX_LENGTH || !new RegExp(LENS_PATTERN).test(lens))) {
    throw new IssueError(-32602, 'LENS_INVALID',
      `LENS_INVALID: Invalid lens: ${JSON.stringify(lens)} (must be 2..${LENS_MAX_LENGTH} characters matching ${LENS_PATTERN})`);
  }

  // Mirrors lint rule E7: a spike names the epic it belongs to.
  if (role === 'spike' && epic === undefined) {
    throw new IssueError(-32602, 'EPIC_REQUIRED',
      'EPIC_REQUIRED: role "spike" requires epic: the slug(s) of the epic(s) this spike belongs to');
  }
  // Mirrors lint rule E10, which covers spike_type and deliberately NOT epic
  // or blocked_by. An ordinary capture may carry epic alone, since whether a
  // capture can be promoted into a spike in place is an open question the
  // design declines to foreclose; and blocked_by is no longer spike-only,
  // because any issue may wait on any other issue in the corpus. Requiring
  // spike_type here as well (lint rule E8) was considered and rejected as
  // over-strict for a two-rule mirror; E8 catches a spike missing it on the
  // first edit.
  if (spike_type !== undefined && role !== 'spike') {
    throw new IssueError(-32602, 'ROLE_SPIKE_REQUIRED',
      'ROLE_SPIKE_REQUIRED: spike_type requires role: "spike"');
  }

  const { branch, commit, commitSubject, working_tree, repo, recentCommits } = snapshot(contextRoot);

  const slug = slug_override ?? deriveSlug(safeTitle);
  const issuesDir = join(targetRoot, 'scratch', ISSUES_SUBDIR);
  const basePath = resolve(join(issuesDir, `${slug}.md`));
  let finalPath = basePath;
  let suffix = 1;
  while (existsSync(finalPath)) {
    suffix++;
    finalPath = resolve(join(issuesDir, `${slug}-${suffix}.md`));
  }
  const finalSlug = suffix === 1 ? slug : `${slug}-${suffix}`;
  const collision_note = suffix === 1 ? null : `Prior capture exists at ${basePath}`;

  // Both sides realpathed, checked before anything is created, so a symlinked scratch/ or
  // scratch/issues/ cannot carry the write out of the target.
  const expected = join(realpathSync(targetRoot), 'scratch', ISSUES_SUBDIR);
  const landsAt = (p, want) => !existsSync(p) || realpathSync(p) === want;
  if (!landsAt(dirname(issuesDir), dirname(expected)) || !landsAt(issuesDir, expected)) {
    throw new IssueError(-32000, 'FS_FAILURE', `${ESCAPE_PREFIX} ${expected}: ${finalPath}`);
  }
  if (!existsSync(issuesDir)) {
    if (!createCorpus) {
      throw new IssueError(-32000, 'CORPUS_MISSING', `CORPUS_MISSING: ${issuesDir} does not exist`);
    }
    try {
      mkdirSync(issuesDir, { recursive: true });
    } catch (err) {
      throw new IssueError(-32000, 'FS_FAILURE', 'FS_FAILURE: ' + err.message);
    }
  }

  const now = new Date();
  const escapedTitle = safeTitle.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const frontmatterLines = [
    '---',
    'tool: write_issue',
    `kind: ${kind}`,
    `title: "${escapedTitle}"`,
    `slug: ${finalSlug}`,
    'status: open',
    `captured: ${now.toISOString()}`,
    `repo: ${repo}`,
    `branch: ${branch}`,
    `commit: ${commit}`,
    `working_tree: ${working_tree}`,
  ];
  // The four optional epic/spike keys (D14), emitted only when supplied and
  // appended AFTER the ten required keys -- write_task's precedent, and what
  // keeps every existing corpus file and the lint's key-order assumption
  // untouched. Values are unquoted comma-separated scalars, never YAML lists:
  // the frontmatter parser splits each line at the first colon and stores the
  // raw string, so a flow sequence would round-trip as the literal "[a, b]".
  // A slug contains no colon, so no quoting is needed.
  if (role !== undefined) frontmatterLines.push(`role: ${role}`);
  if (epic !== undefined) frontmatterLines.push(`epic: ${epic}`);
  if (spike_type !== undefined) frontmatterLines.push(`spike_type: ${spike_type}`);
  if (blocked_by !== undefined) frontmatterLines.push(`blocked_by: ${blocked_by}`);
  if (lens !== undefined) frontmatterLines.push(`lens: ${lens}`);
  frontmatterLines.push('---', '');
  const frontmatter = frontmatterLines.join('\n');

  const headingPrefix = kind === 'issue' ? 'Issue' : kind === 'idea' ? 'Idea' : 'Feature';
  const bodyLines = [
    `# ${headingPrefix}: ${safeTitle}`,
    '',
    '## Summary',
    summary ?? PLACEHOLDER,
    '',
    '## Context',
    '',
    '### Intent',
    intent ?? PLACEHOLDER,
    '',
    `### Observed State (captured ${now.toISOString()})`,
    `- **Working directory:** ${contextRoot}`,
    `- **Repo / branch:** ${repo} / ${branch}`,
    commitSubject
      ? `- **HEAD:** ${commit} — ${commitSubject}`
      : `- **HEAD:** ${commit}`,
    `- **Working tree:** ${working_tree}`,
  ];
  if (recentCommits.length > 0) {
    bodyLines.push('- **Recent commits (last 3):**');
    for (const line of recentCommits) bodyLines.push(`  - ${line}`);
  }
  if (resolve(targetRoot) !== resolve(contextRoot)) bodyLines.push(`- **Filed into:** ${targetRoot}`);
  bodyLines.push(
    '',
    '### Prior Investigation',
    prior_thinking ?? PLACEHOLDER,
    '',
    '## Impact',
    impact ?? PLACEHOLDER,
    '',
    '## Related',
    related ?? PLACEHOLDER,
    '',
    '## Notes',
    notes ?? PLACEHOLDER,
    '',
  );
  const body = bodyLines.join('\n');

  try {
    writeFileSync(finalPath, frontmatter + body, { flag: 'wx', encoding: 'utf-8' });
  } catch (err) {
    throw new IssueError(-32000, 'FS_FAILURE', 'FS_FAILURE: ' + err.message);
  }

  return { path: finalPath, kind, title: safeTitle, collision_note };
}

// --- CLI -------------------------------------------------------------------

const ISSUE_HELP = `Usage: scratch-memory issue <subcommand> [--repo <name> | --project-root <path>] [options]

Write, close and mark issues in a repo's scratch/issues/ corpus.

Issue subcommands:
  write [--json] < fields.json
      Write one issue from stdin JSON, recording the current repo as where it
      was observed.
  close <slug> --status <s> --resolution-file <path|-> [--summary-file <path|->]
      Close one issue in a single file write: replace the ## Summary body
      (when --summary-file is given), append '## Resolution (YYYY-MM-DD)' and
      the resolution body at the end of the file, and set status: <s>.
  mark-groomed <slug>...
      Append '- YYYY-MM-DD: Groomed: <sha>' as the last line of each issue's
      ## Notes, <sha> being the target repo's short HEAD.
  mark-refreshed <slug>...
      The same, writing Refreshed: in place of Groomed:.

Target: --repo <name>, a registered repo resolved as \`repos resolve\` does, so no
path passes through the shell; --project-root <path>; or the current git top level.
The target must be its own git top level and must already hold scratch/issues/.

write:
  stdin is one JSON object with write_issue's input fields:
    ${ISSUE_FIELDS.join(', ')}
  kind and title are required; an unknown key is refused. Nothing is created but
  the issue file. The issue's repo, branch and commit describe the current git
  top level; when the target differs, its Observed State adds a "Filed into:" line.
  Output: the written file's absolute path on stdout, "wrote into <target>" on
  stderr. --json prints { path, kind, title, collision_note } on stdout instead.

close:
  <s> is one of ${ISSUE_CLOSED_STATUSES.join(', ')}. The issue's current status
  must be open or deferred; any role is accepted, epics and spikes included.
  <path|-> is a file path, or - for stdin; feed - from a heredoc with a quoted
  delimiter (<<'EOF') so the shell expands nothing in the markdown. At most one
  of the two may be -, and
  an input that is empty after trim is refused. The Resolution heading's date is
  today's UTC date; the file holds the body only. A --summary-file on an issue
  with no ## Summary section is refused.
  Output: the absolute path, then '## Summary' and its body as written, or
  '## Summary: (none)' when the issue has none.

mark-groomed, mark-refreshed:
  Every slug must name an existing issue before any file is written. _Not
  captured._ as the whole ## Notes body is replaced; an issue with no ## Notes
  gets one appended. Not idempotent: each run appends another bullet.
  Output: one absolute path per file, printed as that file is written.

No verb runs lint or writes git; run \`scratch-memory tasks lint\` afterward.

Exit codes:
  0  success
  1  user error (bad field, unknown key, no stdin, missing corpus or issue, a
     status outside the accepted set, not a top level, escape, unknown repo name)
  2  environment error (unreadable stdin, write failure, unreadable repos file,
     git rev-parse failure)
`;

function fail(exit, message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(exit);
}

function readStdin() {
  if (process.stdin.isTTY) fail(EXIT.USER_ERROR, 'No input on stdin: pipe one JSON object of write_issue fields');
  try {
    return readFileSync(0, 'utf-8');
  } catch (err) {
    fail(EXIT.INFRA_ERROR, `cannot read stdin: ${err.message}`);
  }
}

// The target repo for every `issue` verb: --repo <name> (resolved as `repos
// resolve` does), --project-root <path>, or the current git top level. A
// given root must be its own git top level.
function resolveTarget(rootArg, repoName) {
  if (repoName !== null) {
    try {
      rootArg = resolveRepo(repoName).entry.path;
    } catch (err) {
      if (!(err instanceof ReposError)) throw err;
      fail(err.exit, err.message);
    }
  }
  const contextTop = gitTopLevel(process.cwd());
  if (rootArg === null) {
    if (!contextTop) fail(EXIT.USER_ERROR, 'not inside a git repository; pass --project-root');
    return { target: contextTop, contextTop };
  }
  const label = repoName === null ? '--project-root' : `registered repo ${repoName}`;
  const abs = normPath(rootArg);
  let isDir = false;
  try { isDir = statSync(abs).isDirectory(); } catch {}
  if (!isDir) fail(EXIT.USER_ERROR, `${label} is not a directory: ${rootArg}`);
  const target = realpathSync(abs);
  if (gitTopLevel(target) !== target) fail(EXIT.USER_ERROR, `${label} is not the top level of a git repository: ${rootArg}`);
  return { target, contextTop };
}

function cmdWrite(argv) {
  let rootArg = null;
  let repoName = null;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') json = true;
    else if (a === '--project-root' || a === '--repo') {
      if (i + 1 >= argv.length) fail(EXIT.USER_ERROR, `${a} needs a value`);
      if (a === '--repo') repoName = argv[++i];
      else rootArg = argv[++i];
    } else fail(EXIT.USER_ERROR, `unexpected argument: ${a}`);
  }
  if (repoName !== null && rootArg !== null) fail(EXIT.USER_ERROR, '--repo and --project-root cannot be combined');
  const { target, contextTop } = resolveTarget(rootArg, repoName);

  const raw = readStdin();
  if (!raw.trim()) fail(EXIT.USER_ERROR, 'No input on stdin: pipe one JSON object of write_issue fields');
  let fields;
  try {
    fields = JSON.parse(raw);
  } catch (err) {
    fail(EXIT.USER_ERROR, `stdin is not JSON: ${err.message}`);
  }
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) fail(EXIT.USER_ERROR, 'stdin must be one JSON object');
  const unknown = Object.keys(fields).filter((k) => !ISSUE_FIELDS.includes(k));
  if (unknown.length) fail(EXIT.USER_ERROR, `unknown field(s): ${unknown.join(', ')}; accepted: ${ISSUE_FIELDS.join(', ')}`);

  if (!existsSync(join(target, 'scratch', ISSUES_SUBDIR))) fail(EXIT.USER_ERROR, `${join(target, 'scratch', ISSUES_SUBDIR)} does not exist; the target needs an issues corpus`);

  let result;
  try {
    result = writeIssue({ targetRoot: target, contextRoot: contextTop ?? process.cwd(), fields, createCorpus: false });
  } catch (err) {
    if (!(err instanceof IssueError)) throw err;
    const envFailure = err.code === -32000 && err.name !== 'CORPUS_MISSING' && !err.message.startsWith(ESCAPE_PREFIX);
    fail(envFailure ? EXIT.INFRA_ERROR : EXIT.USER_ERROR, err.message);
  }
  process.stdout.write(json ? JSON.stringify(result, null, 2) + '\n' : `${result.path}\n`);
  process.stderr.write(`wrote into ${target}\n`);
  process.exitCode = EXIT.SUCCESS;
}

// --- close and markers ------------------------------------------------------

const CLOSE_FROM_STATUSES = ['open', 'deferred'];

// Split argv into positionals and the values of the named `--flag <value>` options.
export function parseArgs(argv, flags) {
  const positionals = [];
  const values = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (flags.includes(a)) {
      if (i + 1 >= argv.length) fail(EXIT.USER_ERROR, `${a} needs a value`);
      if (a in values) fail(EXIT.USER_ERROR, `${a} given twice`);
      values[a] = argv[++i];
    } else if (a.startsWith('-')) fail(EXIT.USER_ERROR, `unexpected argument: ${a}`);
    else positionals.push(a);
  }
  if ('--repo' in values && '--project-root' in values) fail(EXIT.USER_ERROR, '--repo and --project-root cannot be combined');
  return { positionals, values };
}

// The existing issue file for each slug in the target's corpus, realpath-checked
// under the target's real scratch/. Every slug is checked before any is written.
function issuePaths(target, slugs) {
  const scratchReal = realpathSync(join(target, 'scratch'));
  return slugs.map((slug) => {
    if (!ISSUE_SLUG_PATTERN.test(slug)) fail(EXIT.USER_ERROR, `invalid slug: ${slug} (must match ${ISSUE_SLUG_PATTERN.source})`);
    const path = join(target, 'scratch', ISSUES_SUBDIR, `${slug}.md`);
    if (!existsSync(path)) fail(EXIT.USER_ERROR, `no issue ${slug} at ${path}`);
    if (!realpathSync(path).startsWith(scratchReal + sep)) fail(EXIT.USER_ERROR, `${ESCAPE_PREFIX} ${scratchReal}: ${path}`);
    return path;
  });
}

function targetFrom(values) {
  const { target } = resolveTarget(values['--project-root'] ?? null, values['--repo'] ?? null);
  if (!existsSync(join(target, 'scratch', ISSUES_SUBDIR))) fail(EXIT.USER_ERROR, `${join(target, 'scratch', ISSUES_SUBDIR)} does not exist; the target needs an issues corpus`);
  return target;
}

function readIssue(path) {
  try {
    return readFileSync(path, 'utf-8');
  } catch (err) {
    fail(EXIT.INFRA_ERROR, `cannot read ${path}: ${err.message}`);
  }
}

function writeIssueFile(path, content) {
  try {
    writeFileAtomic(path, content);
  } catch (err) {
    fail(EXIT.INFRA_ERROR, `failed to write ${path}: ${err.message}`);
  }
}

// `<path|->`: a file path, or `-` for stdin. Empty after trim is a user error.
export function readInput(flag, source) {
  let text;
  if (source === '-') {
    if (process.stdin.isTTY) fail(EXIT.USER_ERROR, "no input on stdin; pipe data or pass a file path instead of '-'");
    try {
      text = readFileSync(0, 'utf-8');
    } catch (err) {
      fail(EXIT.INFRA_ERROR, `cannot read stdin: ${err.message}`);
    }
  } else {
    try {
      text = readFileSync(source, 'utf-8');
    } catch (err) {
      fail(EXIT.USER_ERROR, `${flag}: cannot read ${source}: ${err.message}`);
    }
  }
  if (text.trim() === '') fail(EXIT.USER_ERROR, `${flag} is empty`);
  return text.trim();
}

// The body range of an exact `## {heading}` section: from the end of the heading
// line to the next `## ` heading or EOF. Null when the heading is absent.
function sectionRange(content, heading) {
  const start = new RegExp(`^## ${heading}[ \\t]*$`, 'm').exec(content);
  if (start === null) return null;
  const bodyStart = start.index + start[0].length;
  const next = /^## /m.exec(content.slice(bodyStart));
  return { start: bodyStart, end: next === null ? content.length : bodyStart + next.index, last: next === null };
}

// Replace a section's body, keeping one blank line before the next heading.
function replaceSection(content, range, body) {
  return content.slice(0, range.start) + `\n${body}\n${range.last ? '' : '\n'}` + content.slice(range.end);
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

// `content` with its trailing newlines replaced by exactly one blank line. A
// scan, not /\n*$/, which backtracks quadratically on a long inner run of newlines.
function endWithBlankLine(content) {
  let end = content.length;
  while (end > 0 && content[end - 1] === '\n') end--;
  return content.slice(0, end) + '\n\n';
}

function cmdClose(argv) {
  const { positionals, values } = parseArgs(argv, ['--status', '--resolution-file', '--summary-file', '--repo', '--project-root']);
  if (positionals.length !== 1) fail(EXIT.USER_ERROR, `issue close takes exactly one <slug> (got ${positionals.length})`);
  const status = values['--status'];
  if (status === undefined) fail(EXIT.USER_ERROR, `--status is required; one of ${ISSUE_CLOSED_STATUSES.join('|')}`);
  if (!ISSUE_CLOSED_STATUSES.includes(status)) fail(EXIT.USER_ERROR, `invalid --status ${status}; one of ${ISSUE_CLOSED_STATUSES.join('|')}`);
  if (values['--resolution-file'] === undefined) fail(EXIT.USER_ERROR, '--resolution-file is required');
  if (values['--resolution-file'] === '-' && values['--summary-file'] === '-') {
    fail(EXIT.USER_ERROR, 'only one of --resolution-file and --summary-file may be -');
  }

  const [path] = issuePaths(targetFrom(values), positionals);
  const content = readIssue(path);
  const lines = content.split('\n');
  const close = lines.indexOf('---', 1);
  const statusIdx = lines[0] === '---' && close !== -1 ? lines.findIndex((l, i) => i < close && /^status:/.test(l)) : -1;
  const current = statusIdx === -1 ? '(none)' : lines[statusIdx].slice('status:'.length).trim();
  if (!CLOSE_FROM_STATUSES.includes(current)) {
    fail(EXIT.USER_ERROR, `issue ${positionals[0]} has status ${current}; issue close accepts ${CLOSE_FROM_STATUSES.join('|')}`);
  }
  lines[statusIdx] = `status: ${status}`;
  let next = lines.join('\n');
  const summaryRange = sectionRange(next, 'Summary');
  if (values['--summary-file'] !== undefined && summaryRange === null) {
    fail(EXIT.USER_ERROR, `--summary-file given but ${path} has no ## Summary section`);
  }

  // Inputs are read only once the issue is known to be closable, so a refused close never drains stdin.
  const resolution = readInput('--resolution-file', values['--resolution-file']);
  const summary = values['--summary-file'] === undefined ? null : readInput('--summary-file', values['--summary-file']);
  const echo = summary ?? (summaryRange === null ? null : next.slice(summaryRange.start, summaryRange.end).trim());
  if (summary !== null) next = replaceSection(next, summaryRange, summary);
  next = endWithBlankLine(next) + `## Resolution (${todayUtc()})\n\n${resolution}\n`;

  writeIssueFile(path, next);
  process.stdout.write(`${path}\n${echo === null ? '## Summary: (none)' : `## Summary\n${echo}`}\n`);
  process.exitCode = EXIT.SUCCESS;
}

// `issue mark-groomed` / `issue mark-refreshed`: one dated `{label}: {sha}` bullet
// at the end of each file's ## Notes, the sha read from the target repo's HEAD.
function cmdMarker(label, argv) {
  const { positionals, values } = parseArgs(argv, ['--repo', '--project-root']);
  if (positionals.length === 0) fail(EXIT.USER_ERROR, 'at least one <slug> is required');
  const target = targetFrom(values);
  const paths = issuePaths(target, positionals);
  let sha;
  try {
    sha = execFileSync('git', ['-C', target, 'rev-parse', '--short', 'HEAD'], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8', timeout: 2000 }).trim();
  } catch (err) {
    fail(EXIT.INFRA_ERROR, `git rev-parse --short HEAD failed in ${target}: ${err.stderr?.trim() || err.message}`);
  }
  const bullet = `- ${todayUtc()}: ${label}: ${sha}`;
  for (const path of paths) {
    const content = readIssue(path);
    const range = sectionRange(content, 'Notes');
    let next;
    if (range === null) next = endWithBlankLine(content) + `## Notes\n\n${bullet}\n`;
    else {
      const body = content.slice(range.start, range.end);
      next = body.trim() === '' || body.trim() === PLACEHOLDER
        ? replaceSection(content, range, bullet)
        : content.slice(0, range.start) + `${body.trimEnd()}\n${bullet}\n${range.last ? '' : '\n'}` + content.slice(range.end);
    }
    writeIssueFile(path, next);
    process.stdout.write(`${path}\n`);
  }
  process.exitCode = EXIT.SUCCESS;
}

export async function dispatch(argv) {
  const sub = argv[0];
  if (sub === '-h' || sub === '--help' || argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(ISSUE_HELP);
    process.exit(EXIT.SUCCESS);
  }
  switch (sub) {
    case 'write':
      cmdWrite(argv.slice(1));
      break;
    case 'close':
      cmdClose(argv.slice(1));
      break;
    case 'mark-groomed':
      cmdMarker('Groomed', argv.slice(1));
      break;
    case 'mark-refreshed':
      cmdMarker('Refreshed', argv.slice(1));
      break;
    default:
      process.stderr.write(`ERROR: ${sub ? `unknown issue subcommand: ${sub}` : 'missing subcommand'}\n\n${ISSUE_HELP}`);
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
