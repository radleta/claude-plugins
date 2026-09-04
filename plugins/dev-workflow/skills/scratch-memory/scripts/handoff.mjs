#!/usr/bin/env node
// handoff.mjs — handoff verb group for the scratch-memory CLI
//
// Exports:
//   dispatch(argv)                 — route handoff subcommands (commit, path, validate, list, commit-session)
//   resolveProjectRoot()           — walk cwd upward to find the .git anchor (D9)
//   parseFrontmatter()             — parse YAML frontmatter block from file content
//   parseSessionChain()            — parse session_chain YAML list from file content
//   validateSessionId()            — validate a session_id string (throws on invalid)
//   resolveSessionArg()            — resolve UUID / slug / prefix to { sessionId, folderPath, slug }
//   atomicWriteSync()              — atomic write via tmp-sibling + rename
//   detectShape()                  — four-state folder shape detection ('new'|'legacy'|'inconsistent'|'v3-pointer')
//   validateSessionFilePath()      — validate per-session file path (sandbox + basename regex)
//   tsCompact()                    — compact ISO timestamp for filenames (20260417T143022Z)
//   yamlSafeString()               — YAML-safe string quoting
//   extractGoalOneLiner()          — first non-empty line after ## Goal heading
//   appendAudit()                  — append an audit entry to audit.jsonl
//   parseRelatedProjectsFromFm()   — parse related_projects YAML list from frontmatter
//   EXPECTED_SECTIONS_V3           — v3 thin-pointer ordered section headings
//   SESSION_FILE_TEMPLATE          — per-session file template
//   EXPECTED_SESSION_SECTIONS      — per-session ordered section headings
//
// V1/V2 legacy upgrade machinery (EXPECTED_SECTIONS_V1, HANDOFF_TEMPLATE_V2) lives in
// handoff-legacy.mjs, consumed only by pickup.mjs's legacy-migration block.

import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  appendFileSync,
} from 'node:fs';
import { resolve, join, relative, sep, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// resolveProjectRoot — D9: walk cwd upward to find .git (file or dir for worktrees)
// ---------------------------------------------------------------------------

export function resolveProjectRoot() {
  let cur = process.cwd();
  while (true) {
    const candidate = join(cur, '.git');
    let found = false;
    try {
      const st = statSync(candidate);
      found = st.isFile() || st.isDirectory();
    } catch {
      // ENOENT or EACCES — keep walking
    }
    if (found) return cur;
    const parent = dirname(cur);
    if (parent === cur) {
      throw new Error(
        `Not inside a git repository (no .git found walking up from ${process.cwd()})`
      );
    }
    cur = parent;
  }
}

// getProjectRoot — call resolveProjectRoot() and exit(2) on failure.
// Replaces the 5 duplicated try/catch blocks in subcommand handlers.
function getProjectRoot() {
  try {
    return resolveProjectRoot();
  } catch (err) {
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// Ported helpers from server.mjs — verbatim (bug-for-bug compatible)
// ---------------------------------------------------------------------------

// Compact ISO timestamp for filenames: 2026-04-17T14:30:22.123Z -> 20260417T143022Z
export function tsCompact(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+/, '');
}

// Parse a YAML frontmatter block (between first and second ---) from file content.
// Returns a map of key → raw string value.
export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const block = match[1];
  const result = {};
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (key) result[key] = val;
  }
  return result;
}

// Parse session_chain YAML list from file content. Returns string[] (empty if absent or malformed).
export function parseSessionChain(content) {
  const chain = [];
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return chain;
  const lines = fmMatch[1].split('\n');
  let inChain = false;
  for (const line of lines) {
    if (/^session_chain:/.test(line)) { inChain = true; continue; }
    if (inChain) {
      const m = line.match(/^  - (.+)$/);
      if (m) chain.push(m[1].trim());
      else inChain = false;
    }
  }
  return chain;
}

export function yamlSafeString(s) {
  const cleaned = s.replace(/[\r\n]/g, ' ');
  if (/^[#\[{}>|&*?!'"@`]/.test(cleaned) || cleaned.includes(':')) {
    return '"' + cleaned.replace(/"/g, '\\"') + '"';
  }
  return cleaned;
}

// Validate a session_id value. Throws on invalid with a descriptive message.
export function validateSessionId(id, fieldName) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`PICKUP_INVALID_${fieldName.toUpperCase()}: must be a non-empty string`);
  }
  if (id.includes('/') || id.includes('\\')) {
    throw new Error(`PICKUP_INVALID_${fieldName.toUpperCase()}: must not contain path separators: ${JSON.stringify(id)}`);
  }
  if (id.includes('..')) {
    throw new Error(`PICKUP_INVALID_${fieldName.toUpperCase()}: must not contain "..": ${JSON.stringify(id)}`);
  }
  if (id.startsWith('.')) {
    throw new Error(`PICKUP_INVALID_${fieldName.toUpperCase()}: must not start with ".": ${JSON.stringify(id)}`);
  }
  if (/[\r\n]/.test(id)) {
    throw new Error(`PICKUP_INVALID_${fieldName.toUpperCase()}: must not contain newline characters: ${JSON.stringify(id)}`);
  }
  if (!/^[A-Za-z0-9._-]+$/.test(id)) {
    throw new Error(`PICKUP_INVALID_${fieldName.toUpperCase()}: must contain only letters, digits, dots, underscores, and hyphens: ${JSON.stringify(id)}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers unique to the CLI (not ported from server.mjs)
// ---------------------------------------------------------------------------

// Atomic write: write to .tmp-<basename> sibling, then rename over final path.
// Atomic on same-filesystem moves (scratch/ always is).
export function atomicWriteSync(filePath, data) {
  const tmp = join(dirname(filePath), `.tmp-${basename(filePath)}`);
  writeFileSync(tmp, data, 'utf-8');
  renameSync(tmp, filePath);
}

// V3 ordered section headings — strict validation for v3 thin pointer HANDOFF.md files.
// 5 sections only (schema_version: 3 derived cache written by rewrite-pointer).
export const EXPECTED_SECTIONS_V3 = [
  '## Open questions (still open)',
  '## Goal',
  '## Next best step',
  '## Latest summary',
  '## Sessions',
];

// Per-session file template: YAML frontmatter block + 10-section body per spec Data Model.
// Written by /handoff; validated by commit-session verb.
// Note: started and ended are omitted here — server injects them on write_session call.
export const SESSION_FILE_TEMPLATE = `---
session_id: ''
session_name: ''
goal_at_time: ''
parent_handoff_state: ''
summary: ''
---
## Goal

## Next best step

## Done

## Decisions made

## What to avoid

## Open questions raised

## Open questions resolved

## Key files & artifacts

## Skills used

## Projects
`;

// Ordered section headings for per-session files — strict validation.
export const EXPECTED_SESSION_SECTIONS = [
  '## Goal',
  '## Next best step',
  '## Done',
  '## Decisions made',
  '## What to avoid',
  '## Open questions raised',
  '## Open questions resolved',
  '## Key files & artifacts',
  '## Skills used',
  '## Projects',
];

// ---------------------------------------------------------------------------
// detectShape — four-state folder shape detection.
// Returns 'new' | 'legacy' | 'inconsistent' | 'v3-pointer'.
//   'v3-pointer'  — HANDOFF.md exists, frontmatter contains schema_version: 3
//                   (checked before heading classification; v3 is a derived cache).
//   'new'         — HANDOFF.md exists, has ## Sessions heading, sessions/ exists.
//   'legacy'      — HANDOFF.md exists, no ## Sessions heading, no sessions/ subfolder.
//   'inconsistent'— any partial state (file missing, heading/folder mismatch, etc.).
// Consumed by pickup.mjs and cmdCommit branching.
// ---------------------------------------------------------------------------

export function detectShape(handoffMdPath, sessionsDirPath) {
  const handoffExists = existsSync(handoffMdPath);
  const sessionsExists = existsSync(sessionsDirPath);

  if (!handoffExists) {
    // File is absent — can't determine shape from content.
    return 'inconsistent';
  }

  let body;
  try {
    body = readFileSync(handoffMdPath, 'utf-8');
  } catch {
    return 'inconsistent';
  }

  // v3 thin pointer detection — checked before heading classification so that v3
  // pointers (which do contain ## Sessions) are not misclassified as 'new'.
  if (parseFrontmatter(body)['schema_version'] === '3') return 'v3-pointer';

  const hasSessionsHeading = /^## Sessions\s*$/m.test(body);

  if (hasSessionsHeading && sessionsExists) {
    return 'new';
  }
  if (!hasSessionsHeading && !sessionsExists) {
    return 'legacy';
  }
  // Partial state: heading present but folder absent, or folder present but heading absent.
  return 'inconsistent';
}

// ---------------------------------------------------------------------------
// validateSessionFilePath — validate a per-session file path.
// Returns { ok: true, resolvedPath } on success.
// Returns { ok: false, message } on failure.
//
// Implementation order per spec:
//   (a) path.resolve(project_root, userInput)       — normalizes any .. traversal
//   (b) startsWith sandbox check on resolved path   — canonical traversal defense
//   (c) basename regex match
// ---------------------------------------------------------------------------

export function validateSessionFilePath(userInput, projectRoot) {
  if (!userInput || typeof userInput !== 'string') {
    return { ok: false, message: 'path must be a non-empty string' };
  }

  // (a) Resolve relative paths against projectRoot — normalizes any .. segments.
  const resolvedPath = resolve(projectRoot, userInput);

  // (b) Sandbox check: resolved path must start with {projectRoot}/scratch/S-
  // per spec lines 253-257. Enforcing the S- prefix here means the guard itself
  // rejects any path outside a valid workstream folder, providing defense-in-depth
  // independent of the structural parse below.
  const scratchSPrefix = join(projectRoot, 'scratch', 'S-');
  if (!resolvedPath.startsWith(scratchSPrefix)) {
    return { ok: false, message: `path escapes scratch/S-* boundary: ${resolvedPath}` };
  }

  // Structural check: scratch/S-<slug>/sessions/<file>
  const scratchDir = join(projectRoot, 'scratch');
  const relToScratch = relative(scratchDir, resolvedPath);
  const parts = relToScratch.split(sep);
  // parts[0] = S-<slug>, parts[1] = 'sessions', parts[2] = filename
  if (parts.length !== 3 || !parts[0].startsWith('S-') || parts[1] !== 'sessions') {
    return {
      ok: false,
      message: `path must be inside scratch/S-<slug>/sessions/; got: ${resolvedPath}`,
    };
  }

  // (c) Basename must match the per-session filename pattern:
  //   YYYY-MM-DDTHH-MM-SS-mmmZ-{8-char-hex}[-legacy].md
  const fileBasename = parts[2];
  const SESSION_BASENAME_RE =
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z-[a-f0-9]{8}(-legacy)?\.md$/;
  if (!SESSION_BASENAME_RE.test(fileBasename)) {
    return {
      ok: false,
      message: `basename does not match session file pattern: ${fileBasename}`,
    };
  }

  return { ok: true, resolvedPath };
}

// Extract the body from file content (strip frontmatter if present).
function stripFrontmatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  if (match) return match[1];
  return content;
}

// Extract the first non-empty line after a section heading.
export function extractGoalOneLiner(body) {
  const sections = body.split(/^(?=## )/m);
  for (const sec of sections) {
    const lines = sec.split('\n');
    if (lines[0].trim() === '## Goal') {
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('## ')) return line;
      }
    }
  }
  return '';
}

// Get audit path for the project root.
function auditPath(projectRoot) {
  return join(projectRoot, 'scratch', '.scratch-memory', 'audit.jsonl');
}

// Append an audit entry.
export function appendAudit(projectRoot, entry) {
  const aPath = auditPath(projectRoot);
  mkdirSync(dirname(aPath), { recursive: true });
  appendFileSync(aPath, JSON.stringify(entry) + '\n', 'utf-8');
}

// Parse related_projects YAML list block from frontmatter content.
// Mirrors server.mjs mergeRelatedProjects extraction — parses "  - value" items
// under the related_projects key. Does NOT scan the body (pickup preserves
// the existing frontmatter list verbatim per D7).
export function parseRelatedProjectsFromFm(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];
  const block = fmMatch[1];
  const lines = block.split('\n');
  const result = [];
  let inList = false;
  for (const line of lines) {
    if (/^related_projects:/.test(line)) {
      inList = true;
      continue;
    }
    if (inList) {
      const m = line.match(/^  - (.+)$/);
      if (m) {
        result.push(m[1].trim());
      } else {
        inList = false;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// resolveSessionArg — shared resolution semantics (Approach C from idea.md)
//
// arg may be:
//   undefined/null/'' → hard-error (SESSION_ID_REQUIRED) — explicit arg required (D-7)
//   full UUID          → treat as session_id
//   slug               → scan scratch/S-*/HANDOFF.md frontmatter session_name
//   prefix             → match folder name S-{prefix}* — skipped entirely when exact=true
//   any string         → when allowUnresolved=true, treat as raw session_id
//
// exact=true disables the prefix-glob fallback (UUID and exact-slug matches still
// apply). A retired id that no longer names a folder then falls straight through to
// the "no handoff found matching" error instead of silently resolving to whatever
// folder happens to prefix-match it. Mutating callers (pickup) want this; read-only
// callers (handoff commit/path/validate) pass allowUnresolved:true and keep the
// prefix fallback.
//
// Returns { sessionId, folderPath, slug } on success.
// Writes to stderr and process.exit(1) on failure (0 matches or 2+ matches).
// ---------------------------------------------------------------------------

export function resolveSessionArg(arg, projectRoot, { allowUnresolved = false, fieldName = 'session_id', exact = false } = {}) {
  const scratchRoot = join(projectRoot, 'scratch');
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  // Validate arg early when present — blocks path-traversal via embedded slashes (CWE-22).
  // validateSessionId rejects '/', '\', '..', leading '.', and newlines.
  if (arg !== undefined && arg !== null && arg !== '') {
    try {
      validateSessionId(arg, fieldName);
    } catch (err) {
      process.stderr.write(`ERROR: ${err.message}\n`);
      process.exit(1);
    }
  }

  // No arg: hard-error. Explicit session_id required for all mutating operations (D-7).
  if (arg === undefined || arg === null || arg === '') {
    process.stderr.write(
      'ERROR: SESSION_ID_REQUIRED: this verb requires a session_id argument.\n' +
      '  Pass it positionally or via --session-id <id>.\n' +
      '  session_id is the slug you typed at /handoff (e.g. handoff-sid-fix);\n' +
      '  check \'scratch-memory handoff list\' for existing workstreams.\n'
    );
    process.exit(1);
  }

  // Full UUID match
  if (UUID_RE.test(arg)) {
    return resolveSessionId(arg, scratchRoot);
  }

  // Try scanning frontmatter session_name for exact slug match, then prefix glob
  let allFolders = [];
  try {
    allFolders = readdirSync(scratchRoot)
      .filter(d => d.startsWith('S-') && existsSync(join(scratchRoot, d, 'HANDOFF.md')));
  } catch {
    // scratchRoot doesn't exist yet — no sessions
  }

  // Exact slug match against folder name (S-{arg})
  const exactFolder = `S-${arg}`;
  if (allFolders.includes(exactFolder)) {
    const folderPath = join(scratchRoot, exactFolder);
    const filePath = join(folderPath, 'HANDOFF.md');
    const fm = parseFrontmatter(readFileSync(filePath, 'utf-8'));
    // Guard against YAML empty-string placeholder "''" — treat as unset.
    const rawId = fm['session_id'];
    const sessionId = (rawId && rawId !== "''") ? rawId : arg;
    return { sessionId, folderPath, slug: arg };
  }

  // Prefix glob: match S-{arg}* folders — skipped when exact=true (mutating callers
  // must not silently rename whatever folder happens to prefix-match a retired id).
  if (!exact) {
    const prefixMatches = allFolders.filter(d => d.startsWith(`S-${arg}`));
    if (prefixMatches.length === 1) {
      const folderPath = join(scratchRoot, prefixMatches[0]);
      const filePath = join(folderPath, 'HANDOFF.md');
      const fm = parseFrontmatter(readFileSync(filePath, 'utf-8'));
      // Guard against YAML empty-string placeholder "''" — treat as unset.
      const rawId2 = fm['session_id'];
      const slug = prefixMatches[0].slice(2); // strip 'S-'
      const sessionId = (rawId2 && rawId2 !== "''") ? rawId2 : slug;
      return { sessionId, folderPath, slug };
    }
    if (prefixMatches.length > 1) {
      process.stderr.write(
        `ERROR: '${arg}' matches multiple sessions — provide a longer prefix:\n` +
        prefixMatches.map(d => `  ${d}`).join('\n') + '\n'
      );
      process.exit(1);
    }
  }

  // No folder found — for allowUnresolved=true, treat arg as raw session_id
  if (allowUnresolved) {
    return resolveSessionId(arg, scratchRoot);
  }

  process.stderr.write(
    `ERROR: no handoff found matching '${arg}'\n` +
    `  Use 'scratch-memory handoff list' to see available sessions.\n`
  );
  process.exit(1);
}

// Helper: resolve a full session_id to { sessionId, folderPath, slug }.
// Checks uuid-form folder first, then scans all S-* frontmatter.
function resolveSessionId(sessionId, scratchRoot) {
  // Check uuid-form folder
  const uuidFolder = join(scratchRoot, `S-${sessionId}`);
  if (existsSync(join(uuidFolder, 'HANDOFF.md'))) {
    return { sessionId, folderPath: uuidFolder, slug: sessionId };
  }

  // Scan all S-* folders for this session_id in frontmatter
  let allFolders = [];
  try {
    allFolders = readdirSync(scratchRoot).filter(d => d.startsWith('S-'));
  } catch {
    // scratchRoot doesn't exist yet
  }
  for (const d of allFolders) {
    const filePath = join(scratchRoot, d, 'HANDOFF.md');
    if (!existsSync(filePath)) continue;
    try {
      const content = readFileSync(filePath, 'utf-8');
      const fm = parseFrontmatter(content);
      const chain = parseSessionChain(content);
      if (fm['session_id'] === sessionId || chain.includes(sessionId)) {
        const slug = d.slice(2); // strip 'S-'
        return { sessionId, folderPath: join(scratchRoot, d), slug };
      }
    } catch {
      // skip unreadable
    }
  }

  // Not found in any existing folder — return uuid-form path for init to create
  return { sessionId, folderPath: uuidFolder, slug: sessionId };
}

// ---------------------------------------------------------------------------
// cmdCommit — COMMIT phase: validate strict, regen frontmatter, atomic write
// ---------------------------------------------------------------------------

const COMMIT_HELP = `Usage: scratch-memory handoff commit [ID] [options]

For a v3 thin pointer: prints an info message to stderr and exits 0. The pointer is a
derived cache written by rewrite-pointer; committing it has no effect.

For any non-v3 (legacy V1/V2) folder: prints a signpost to stderr directing you to run
\`rewrite-pointer\` and exits 0 without mutating the file. The V1/V2 in-place write path
is retired.

Arguments:
  ID    Session ID, slug, or prefix (required)

Options:
  --json        Emit structured result on stdout
  -h, --help    Show this help

Exit codes:
  0  no-op (v3 pointer) or redirect signpost (non-v3 folder)
  1  user error (session not found, HANDOFF.md missing)
  2  infrastructure error
`;

async function cmdCommit(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(COMMIT_HELP);
    process.exit(0);
  }

  const filtered = argv.filter(a => a !== '--json');

  const unknownFlag = filtered.find(
    a => a.startsWith('-') && a !== '-h' && a !== '--help'
  );
  if (unknownFlag) {
    process.stderr.write(`ERROR: unknown option: ${unknownFlag}\n\n`);
    process.stderr.write(COMMIT_HELP);
    process.exit(1);
  }

  const positional = filtered.filter(a => !a.startsWith('-'));
  const idArg = positional[0];

  const projectRoot = getProjectRoot();

  const { folderPath } = resolveSessionArg(idArg, projectRoot, { allowUnresolved: true });
  const handoffPath = join(folderPath, 'HANDOFF.md');

  if (!existsSync(handoffPath)) {
    process.stderr.write(
      `ERROR: HANDOFF.md not found at ${handoffPath}\n` +
      `  Create the file first (e.g. write a 10-section template to that path).\n`
    );
    process.exit(1);
  }

  // Detect shape from the existing file. detectShape returns 'v3-pointer' for
  // schema_version: 3 — the only shape maintained in place; every other shape redirects.
  const sessionsDirPathForCommit = join(folderPath, 'sessions');
  const commitShape = detectShape(handoffPath, sessionsDirPathForCommit);

  // v3 thin pointer is a derived cache written by rewrite-pointer — commit is a no-op.
  if (commitShape === 'v3-pointer') {
    process.stderr.write('v3 thin pointer is a derived cache; commit is a no-op\n');
    process.exit(0);
  }

  // Legacy (V1/V2) in-place write paths are retired. A non-v3 HANDOFF.md is no longer
  // maintained — point the caller at rewrite-pointer to regenerate a v3 pointer from the
  // immutable per-session log. JIT signpost: it never mutates the artifact.
  process.stderr.write(
    `legacy HANDOFF.md is no longer maintained — run \`scratch-memory rewrite-pointer ${folderPath}\` to regenerate a v3 pointer\n`
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// cmdPath — pure read-only path resolution
// ---------------------------------------------------------------------------

const PATH_HELP = `Usage: scratch-memory handoff path [ID] [options]

Print the absolute path to the session's HANDOFF.md.
Read-only — no file operations.

Arguments:
  ID    Session ID, slug, or prefix (required)

Options:
  -h, --help    Show this help

Exit codes:
  0  success — prints path to stdout
  1  session not found
`;

async function cmdPath(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(PATH_HELP);
    process.exit(0);
  }

  const unknownFlag = argv.find(a => a.startsWith('-') && a !== '-h' && a !== '--help');
  if (unknownFlag) {
    process.stderr.write(`ERROR: unknown option: ${unknownFlag}\n\n`);
    process.stderr.write(PATH_HELP);
    process.exit(1);
  }

  const positional = argv.filter(a => !a.startsWith('-'));
  const idArg = positional[0];

  const projectRoot = getProjectRoot();

  const { folderPath } = resolveSessionArg(idArg, projectRoot, { allowUnresolved: true });
  const handoffPath = join(folderPath, 'HANDOFF.md');
  process.stdout.write(`${handoffPath}\n`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// cmdValidate — read-only schema check (strict by default; --loose for hook)
// ---------------------------------------------------------------------------

const VALIDATE_HELP = `Usage: scratch-memory handoff validate [ID] [options]

Strict mode (default): for a v3 thin pointer, validates the 5-section schema
(EXPECTED_SECTIONS_V3 order) plus required frontmatter keys. For any non-v3 (legacy
V1/V2) folder, prints a rewrite-pointer signpost to stderr and exits 0 — no validation
error is raised.

--loose (PostToolUse hook): schema-agnostic check on any file shape — file non-empty,
>=1 '## ' heading, session_id present if frontmatter exists.

Arguments:
  ID    Session ID, slug, or prefix (required)

Options:
  --loose       Loose validation (for PostToolUse hook — tolerates mid-edit states)
  --json        Emit findings array as JSON on stdout
  -h, --help    Show this help

Exit codes:
  0  clean (no findings) or non-v3 folder redirect signpost
  1  findings found
`;

async function cmdValidate(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(VALIDATE_HELP);
    process.exit(0);
  }

  const looseMode = argv.includes('--loose');
  const jsonMode = argv.includes('--json');
  const filtered = argv.filter(a => a !== '--loose' && a !== '--json');

  const unknownFlag = filtered.find(
    a => a.startsWith('-') && a !== '-h' && a !== '--help'
  );
  if (unknownFlag) {
    process.stderr.write(`ERROR: unknown option: ${unknownFlag}\n\n`);
    process.stderr.write(VALIDATE_HELP);
    process.exit(1);
  }

  const positional = filtered.filter(a => !a.startsWith('-'));
  const idArg = positional[0];

  const projectRoot = getProjectRoot();

  const { folderPath } = resolveSessionArg(idArg, projectRoot, { allowUnresolved: true });
  const handoffPath = join(folderPath, 'HANDOFF.md');

  const findings = [];

  if (!existsSync(handoffPath)) {
    findings.push(`HANDOFF.md not found at ${handoffPath}`);
    if (jsonMode) process.stdout.write(JSON.stringify({ findings }) + '\n');
    else for (const f of findings) process.stderr.write(`FINDING: ${f}\n`);
    process.exit(1);
  }

  const content = readFileSync(handoffPath, 'utf-8');

  if (looseMode) {
    // Loose checks: (a) file non-empty, (b) frontmatter parses or absent OK,
    // (c) >=1 ## heading, (d) session_id present if frontmatter exists
    if (content.trim().length === 0) {
      findings.push('file is empty');
    }
    const headingCount = (content.match(/^## /gm) || []).length;
    if (headingCount < 1) {
      findings.push('no ## headings found');
    }
    if (content.startsWith('---\n')) {
      const fm = parseFrontmatter(content);
      if (!fm['session_id']) {
        findings.push('frontmatter present but session_id missing');
      }
    }
  } else {
    // Strict checks: only v3 thin pointers are validated in place; legacy (V1/V2)
    // strict validation is retired. detectShape returns 'v3-pointer' for schema_version: 3.
    const sessionsDirPathForValidate = join(folderPath, 'sessions');
    const validateShape = detectShape(handoffPath, sessionsDirPathForValidate);

    if (validateShape !== 'v3-pointer') {
      // Non-v3 HANDOFF.md is no longer maintained — JIT signpost, never mutates the file.
      process.stderr.write(
        `legacy HANDOFF.md is no longer maintained — run \`scratch-memory rewrite-pointer ${folderPath}\` to regenerate a v3 pointer\n`
      );
      process.exit(0);
    }

    const body = stripFrontmatter(content);

    // v3 thin pointer: frontmatter required keys + exactly 5 sections in EXPECTED_SECTIONS_V3 order.
    if (!content.startsWith('---\n')) {
      findings.push('no YAML frontmatter found (run commit first)');
    } else {
      const fm = parseFrontmatter(content);
      const requiredKeys = ['session_id', 'schema_version', 'last_pointer_rewrite', 'session_count'];
      for (const key of requiredKeys) {
        if (!fm[key]) findings.push(`frontmatter missing required key: ${key}`);
      }
    }

    const headingMatches = body.match(/^## [^#]/gm) || [];
    if (headingMatches.length !== 5) {
      findings.push(`expected exactly 5 '## ' sections; found ${headingMatches.length}`);
    } else {
      // Check order
      const foundHeadings = body.match(/^## .+/gm) || [];
      for (let i = 0; i < EXPECTED_SECTIONS_V3.length; i++) {
        const found = foundHeadings[i] ? foundHeadings[i].trim() : null;
        const expected = EXPECTED_SECTIONS_V3[i];
        if (found !== expected) {
          findings.push(`section ${i + 1}: expected '${expected}', got '${found || '(missing)'}'`);
        }
      }
    }
  }

  if (findings.length > 0) {
    if (jsonMode) {
      process.stdout.write(JSON.stringify({ findings }) + '\n');
    } else {
      for (const f of findings) {
        process.stderr.write(`FINDING: ${f}\n`);
      }
    }
    process.exit(1);
  }

  process.exit(0);
}

// ---------------------------------------------------------------------------
// cmdList — list recent handoffs sorted by last_updated desc
// ---------------------------------------------------------------------------

const LIST_HELP = `Usage: scratch-memory handoff list [options]

List recent HANDOFF.md files sorted by last_updated descending.
Default limit: 10.

Options:
  --limit N     Show at most N entries (default: 10)
  --json        Emit structured JSON array on stdout
  -h, --help    Show this help

Exit codes:
  0  success (even if no handoffs found)
`;

async function cmdList(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(LIST_HELP);
    process.exit(0);
  }

  const jsonMode = argv.includes('--json');
  let limit = 10;

  // Parse --limit N
  const limitIdx = argv.indexOf('--limit');
  if (limitIdx !== -1) {
    const limitVal = argv[limitIdx + 1];
    const parsed = parseInt(limitVal, 10);
    if (isNaN(parsed) || parsed < 1) {
      process.stderr.write(`ERROR: --limit must be a positive integer, got: ${limitVal}\n`);
      process.exit(1);
    }
    limit = parsed;
  }

  const filtered = argv.filter((a, i) => {
    if (a === '--json') return false;
    if (a === '--limit') return false;
    if (i > 0 && argv[i - 1] === '--limit') return false;
    return true;
  });

  const unknownFlag = filtered.find(a => a.startsWith('-') && a !== '-h' && a !== '--help');
  if (unknownFlag) {
    process.stderr.write(`ERROR: unknown option: ${unknownFlag}\n\n`);
    process.stderr.write(LIST_HELP);
    process.exit(1);
  }

  const projectRoot = getProjectRoot();

  const scratchRoot = join(projectRoot, 'scratch');
  let folders = [];
  try {
    folders = readdirSync(scratchRoot).filter(d => {
      if (!d.startsWith('S-')) return false;
      return existsSync(join(scratchRoot, d, 'HANDOFF.md'));
    });
  } catch {
    // scratchRoot doesn't exist — no handoffs
  }

  // Read and parse each handoff
  const entries = [];
  for (const d of folders) {
    const filePath = join(scratchRoot, d, 'HANDOFF.md');
    try {
      const content = readFileSync(filePath, 'utf-8');
      const fm = parseFrontmatter(content);
      const body = stripFrontmatter(content);
      const sessionName = fm['session_name'] && fm['session_name'] !== 'null'
        ? fm['session_name']
        : d.slice(2); // strip S- prefix as fallback
      const last_updated = fm['last_updated'] || fm['last_pointer_rewrite'] || null;
      const goal = extractGoalOneLiner(body) || '(no goal set)';

      // Sort key: last_updated ISO string (lexically comparable) or mtime
      let sortKey = last_updated || '';
      if (!sortKey) {
        try {
          sortKey = new Date(statSync(filePath).mtime).toISOString();
        } catch {
          sortKey = '';
        }
      }

      entries.push({ sessionName, last_updated: last_updated || '', goal, sortKey, folder: d });
    } catch {
      // skip unreadable
    }
  }

  // Sort by sortKey descending (most recent first)
  entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  // Apply limit
  const limited = entries.slice(0, limit);

  if (jsonMode) {
    process.stdout.write(JSON.stringify(limited.map(e => ({
      session_name: e.sessionName,
      last_updated: e.last_updated,
      goal: e.goal,
      folder: e.folder,
    })), null, 2) + '\n');
    process.exit(0);
  }

  // Table format
  if (limited.length === 0) {
    process.stdout.write('(no handoffs found)\n');
    process.exit(0);
  }

  // Column widths
  const nameCol = Math.max(12, ...limited.map(e => e.sessionName.length));
  const tsCol = 24;
  const header =
    'SESSION_NAME'.padEnd(nameCol) + '  ' +
    'LAST_UPDATED'.padEnd(tsCol) + '  ' +
    'GOAL';
  process.stdout.write(header + '\n');
  process.stdout.write('-'.repeat(header.length) + '\n');
  for (const e of limited) {
    const ts = e.last_updated ? e.last_updated.slice(0, 20).replace('T', ' ') : '(unknown)';
    const goalTrunc = e.goal.length > 60 ? e.goal.slice(0, 57) + '...' : e.goal;
    process.stdout.write(
      e.sessionName.padEnd(nameCol) + '  ' +
      ts.padEnd(tsCol) + '  ' +
      goalTrunc + '\n'
    );
  }

  process.exit(0);
}

// ---------------------------------------------------------------------------
// cmdCommitSession — validate a per-session file and append audit log.
// Machine-only verb: always emits JSON to stdout (success and failure both).
// DOES NOT write the session file — the caller's Write is the sole writer.
// ---------------------------------------------------------------------------

const COMMIT_SESSION_HELP = `Usage: scratch-memory handoff commit-session {session_file_path}

Validate an existing per-session file against the required schema, compute a
SHA-256 hash, and append an audit-log entry. Does NOT write the session file.

Always emits JSON to stdout (both success and failure).

Arguments:
  session_file_path    Absolute or project-relative path to a session file
                       inside scratch/S-<slug>/sessions/

Exit codes:
  0  success — JSON { ok: true, session_file_path, sha256, audit_log_entry }
  1  any validation error or race-condition failure — JSON { ok: false, error_class, message }
`;

async function cmdCommitSession(args) {
  // (a) --help / -h short-circuit — always fires first, before any other checks.
  if (args.includes('-h') || args.includes('--help')) {
    process.stdout.write(COMMIT_SESSION_HELP);
    process.exit(0);
  }

  // (b) Unknown options check — any arg starting with '-' that is not -h/--help.
  const unknownOpt = args.find(a => a.startsWith('-') && a !== '-h' && a !== '--help');
  if (unknownOpt) {
    process.stderr.write(`ERROR: unknown option: ${unknownOpt}\n`);
    process.exit(1);
  }

  // (c) Argcount check — exactly 1 positional required.
  const positionals = args.filter(a => !a.startsWith('-'));
  if (positionals.length !== 1) {
    if (positionals.length === 0) {
      process.stderr.write(`ERROR: missing required argument: session_file_path\n`);
    } else {
      process.stderr.write(
        `ERROR: expected exactly 1 argument, got ${positionals.length}: ${positionals.join(' ')}\n`
      );
    }
    process.exit(1);
  }

  const userInput = positionals[0];
  const projectRoot = getProjectRoot();

  // (d) Validate session file path (sandbox + basename regex).
  const pathResult = validateSessionFilePath(userInput, projectRoot);
  if (!pathResult.ok) {
    process.stdout.write(
      JSON.stringify({ ok: false, error_class: 'INVALID_FILENAME', message: pathResult.message }) + '\n'
    );
    process.exit(1);
  }

  const { resolvedPath } = pathResult;

  // File existence check.
  if (!existsSync(resolvedPath)) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error_class: 'FILE_NOT_FOUND',
        message: `File not found at ${resolvedPath}`,
      }) + '\n'
    );
    process.exit(1);
  }

  // Initial SHA-256 hash — read as Buffer (no encoding) for canonical hash matching sha256sum.
  const initialContent = readFileSync(resolvedPath);
  const initialHash = createHash('sha256').update(initialContent).digest('hex');

  // Parse frontmatter and validate required keys.
  const contentStr = initialContent.toString('utf-8');
  const fm = parseFrontmatter(contentStr);
  const requiredFmKeys = ['session_id', 'started', 'session_name', 'goal_at_time'];
  const missingFmKeys = requiredFmKeys.filter(k => !fm[k]);
  if (missingFmKeys.length > 0) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error_class: 'INVALID_FRONTMATTER',
        message: `Missing required frontmatter keys: [${missingFmKeys.join(', ')}]`,
      }) + '\n'
    );
    process.exit(1);
  }

  // Validate body section headings — all EXPECTED_SESSION_SECTIONS must be present; extras tolerated.
  const body = stripFrontmatter(contentStr);
  const foundHeadings = new Set((body.match(/^## .+/gm) || []).map(h => h.trim()));
  const missingSections = EXPECTED_SESSION_SECTIONS.filter(s => !foundHeadings.has(s));
  if (missingSections.length > 0) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error_class: 'INVALID_STRUCTURE',
        message: `Missing required section(s): [${missingSections.join(', ')}]`,
      }) + '\n'
    );
    process.exit(1);
  }

  // Re-read and re-hash immediately before audit-log write — race-condition detection.
  const rereadContent = readFileSync(resolvedPath);
  const finalHash = createHash('sha256').update(rereadContent).digest('hex');
  if (finalHash !== initialHash) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error_class: 'CONCURRENT_WRITE',
        message: 'File was modified between validation and audit-log write',
      }) + '\n'
    );
    process.exit(1);
  }

  // Append audit log entry.
  const auditEntry = {
    tool: 'commit-session',
    session_file_path: resolvedPath,
    sha256: finalHash,
    timestamp: new Date().toISOString(),
  };
  appendAudit(projectRoot, auditEntry);
  const auditLogEntry = join(projectRoot, 'scratch', '.scratch-memory', 'audit.jsonl');

  // Success.
  process.stdout.write(
    JSON.stringify({
      ok: true,
      session_file_path: resolvedPath,
      sha256: finalHash,
      audit_log_entry: auditLogEntry,
    }) + '\n'
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// help text for the handoff verb group
// ---------------------------------------------------------------------------

function printHelp(out = process.stdout) {
  out.write(`Usage: scratch-memory handoff <subcommand> [options]

Manage session handoff documents (HANDOFF.md).

Subcommands:
  commit [ID] [--json]     No-op for v3 pointers; legacy folders are redirected to rewrite-pointer
  path [ID]                Print absolute path to HANDOFF.md (read-only)
  validate [ID] [--loose] [--json]   Schema validation (v3 strict; --loose for hook use)
  list [--limit N] [--json]          List recent handoffs sorted by last_updated
  commit-session {session_file_path}  Validate a per-session file + append audit log (JSON output)

Arguments:
  ID    Session ID (UUID), session slug, or prefix. Required for mutating verbs (commit, validate, path); not accepted by read-only verbs (list).

Options:
  -h, --help    Show this help

Exit codes:
  0  success
  1  user error (bad subcommand, bad option, validation failure)
  2  infrastructure error (git not found, disk error)
`);
}

// ---------------------------------------------------------------------------
// dispatch — top-level router for the handoff verb group
// ---------------------------------------------------------------------------

export async function dispatch(argv) {
  const verb = argv[0];

  if (verb === '-h' || verb === '--help') {
    printHelp(process.stdout);
    process.exit(0);
  }

  if (typeof verb === 'string' && verb.startsWith('-')) {
    process.stderr.write(`ERROR: unknown option: ${verb}\n\n`);
    printHelp(process.stderr);
    process.exit(1);
  }

  const subArgv = argv.slice(1);

  switch (verb) {
    case 'commit':
      await cmdCommit(subArgv);
      break;
    case 'path':
      await cmdPath(subArgv);
      break;
    case 'validate':
      await cmdValidate(subArgv);
      break;
    case 'list':
      await cmdList(subArgv);
      break;
    case 'commit-session':
      await cmdCommitSession(subArgv);
      break;
    default:
      if (verb) {
        process.stderr.write(`ERROR: unknown subcommand: ${verb}\n\n`);
      } else {
        process.stderr.write(`ERROR: no subcommand\n\n`);
      }
      printHelp(process.stderr);
      process.exit(1);
  }
}

export default dispatch;

// ---------------------------------------------------------------------------
// Entry-point guard — forward to dispatch() on direct invocation (`node
// handoff.mjs <subcommand> ...`), not just when imported by scratch-memory.mjs
// or the other verb modules (cat-sessions.mjs, pickup.mjs, rewrite-pointer.mjs
// all import handoff.mjs for shared helpers — their entry scripts have a
// different import.meta.url, so this guard stays inert for them). Without
// this, direct invocation silently exits 0 with no output (issue:
// verb-modules-silent-noop-direct-invocation).
// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dispatch(process.argv.slice(2)).catch(err => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(2);
  });
}
