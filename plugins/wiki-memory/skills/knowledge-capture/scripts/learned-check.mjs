#!/usr/bin/env node
/**
 * learned-check.mjs - DX tool for managing learned/ files in knowledge-capture pipeline
 *
 * Subcommands:
 *   status <path>             Show dashboard of learned file statuses
 *   pending <path> [--type T] List captured (pending ingestion) files, optionally of one type
 *   escalated <path>          List escalated files with reasons
 *   feed-forward <path> --step N  Files targeting step N or later (status: captured)
 *   validate <path>           Check frontmatter schema validity
 *   init <path>               Create learned/ dir with a .gitkeep placeholder
 *   mark-ingested <file>      Set status: ingested + ingested-at timestamp
 *   mark-escalated <file> <reason>  Set status: escalated + escalation-reason
 *   mark-dropped <file> <reason> <note>  Set status: dropped + drop-reason + drop-note
 *   reroute <file> <domain>   Update target-domain, reset status: captured
 *   list                      Scan scratch/*\/learned/ across all projects
 *   stats                     Aggregate counts across all projects
 *   gate <path> [--type drift]  Boundary ingest step 1: check the path, count pending
 *   snapshot <learned-dir> [--repos -]  Boundary ingest step 3: lock and snapshot .claude/skills/
 *   compare <learned-dir>     Boundary ingest step 4: list paths written since, release
 *
 * Global flags: --json, --include-archived, -h/--help
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  lstatSync,
  realpathSync,
  readFileSync,
  writeFileSync,
  openSync,
  writeSync,
  closeSync,
  linkSync,
  unlinkSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

/** Write a prefixed [ERROR] line to stderr. */
function writeError(msg) {
  process.stderr.write(`[ERROR] ${msg}\n`);
}

// Schema definitions from knowledge-capture skill
const VALID_TYPES = ['research', 'decision', 'gotcha', 'pattern', 'drift'];
const VALID_SCOPES = ['project', 'user'];
const VALID_STATUSES = ['captured', 'ingested', 'escalated', 'dropped'];
const VALID_DROP_REASONS = ['sought', 'novel', 'enforcing', 'durable', 'duplicate', 'tool-output'];
const VALID_SEVERITIES = ['minor', 'misleading'];
const REQUIRED_FIELDS = ['source', 'type', 'scope', 'target-domain', 'status'];

// ─── Repo root detection ────────────────────────────────────────────────────

function findRepoRoot() {
  const cwdScratch = join(process.cwd(), 'scratch');
  if (existsSync(cwdScratch)) return process.cwd();

  let current = __dirname;
  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (basename(current) === '.claude' && existsSync(join(parent, '.git'))) return parent;
    if (parent === current) break;
    current = parent;
  }

  const claudeIdx = __dirname.indexOf('.claude');
  if (claudeIdx > 0) {
    const candidate = __dirname.substring(0, claudeIdx - 1);
    if (existsSync(join(candidate, 'scratch'))) return candidate;
  }

  return process.cwd();
}

const REPO_ROOT = findRepoRoot();
const SCRATCH_DIR = join(REPO_ROOT, 'scratch');

// ─── Frontmatter parsing ────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from markdown content.
 * Returns { fields: {}, bodyStart: number } or null if no frontmatter.
 */
function parseFrontmatter(content) {
  // Use \r?\n to handle both LF (Linux/MSYS) and CRLF (Windows) line endings
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;

  const raw = match[1];
  const fields = {};

  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.+)$/);
    if (m) {
      const key = m[1];
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      fields[key] = val;
    }
  }

  return { fields, raw, fullMatch: match[0] };
}

/**
 * Update a frontmatter field in file content.
 * If the field exists, replaces its value. If not, appends it.
 */
function updateFrontmatterField(content, field, value) {
  // \r?\n handles both LF and CRLF line endings
  const match = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)/);
  if (!match) throw new Error('No frontmatter found in file');

  const [, open, body, close] = match;
  const fieldRegex = new RegExp(`^(${field}:)\\s*.*$`, 'm');

  let newBody;
  if (fieldRegex.test(body)) {
    // Use replacer function to prevent JS replace() special patterns ($&, $', $`) from
    // corrupting frontmatter when value contains user-supplied content (e.g. escalation-reason)
    newBody = body.replace(fieldRegex, (_, prefix) => `${prefix} ${value}`);
  } else {
    newBody = body + `\n${field}: ${value}`;
  }

  return open + newBody + close + content.slice(match[0].length);
}

// ─── Git helpers ─────────────────────────────────────────────────────────────

function gitSilent(args, cwd = REPO_ROOT) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8', shell: false });
  if (result.error) return { success: false, stdout: '', stderr: result.error.message };
  return {
    success: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

/**
 * Run git in an explicit cwd and return stdout untrimmed, as a Buffer: gitSilent's
 * trim would drop the leading space of a first ` M` porcelain entry. stdin is not
 * inherited, so git never consumes the stdin `snapshot --repos -` reads.
 */
function gitRaw(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
  return { success: !result.error && result.status === 0, stdout: result.stdout || Buffer.alloc(0) };
}

/** A one-line git answer (rev-parse), without its trailing newline; null on failure. */
function gitLine(args, cwd) {
  const result = gitRaw(args, cwd);
  return result.success ? result.stdout.toString('utf-8').replace(/\r?\n$/, '') : null;
}

/**
 * Read file content from archive branch via git show.
 * Returns null if not found.
 */
function gitShowFile(ref, filePath) {
  const result = gitSilent(['show', `${ref}:${filePath}`]);
  return result.success ? result.stdout : null;
}

/**
 * List files in a path on the archive branch.
 * Returns array of filenames (not full paths).
 */
function gitListTree(ref, path) {
  const result = gitSilent(['ls-tree', '--name-only', ref, path]);
  if (!result.success || !result.stdout) return [];
  return result.stdout.split('\n').filter(Boolean);
}

// ─── File scanning ─────────────────────────────────────────────────────────

/**
 * Resolve a user-supplied path to the learned/ directory it refers to.
 * Accepts either the learned/ dir itself or a project dir containing one.
 * Anything else is returned as-is so bad input still fails the same way.
 */
function resolveLearnedDir(path) {
  const abs = resolve(path);
  if (basename(abs) === 'learned') return warnIfMissing(abs);
  const nested = join(abs, 'learned');
  if (existsSync(nested) && statSync(nested).isDirectory()) return nested;
  return warnIfMissing(abs);
}

/**
 * A missing directory scans as empty, which is indistinguishable from a real
 * empty learned/ — so a typo'd path reads as success. Say so on stderr and
 * leave the exit code alone: callers key on 0/1/2 for clear/pending/escalated,
 * and the archive gate already treats a missing learned/ as skip-not-fail.
 */
function warnIfMissing(dir) {
  if (!existsSync(dir)) {
    process.stderr.write(`[WARN] no such directory: ${dir}\n`);
  }
  return dir;
}

/**
 * Scan a learned/ directory and return parsed file data.
 */
function scanLearnedDir(dirPath) {
  if (!existsSync(dirPath) || !statSync(dirPath).isDirectory()) return [];

  const files = readdirSync(dirPath).filter((f) => f.endsWith('.md') && f !== 'README.md');
  return files.map((f) => {
    const filePath = join(dirPath, f);
    const content = readFileSync(filePath, 'utf-8');
    const fm = parseFrontmatter(content);
    const title = extractTitle(content);
    return { filePath, filename: f, content, fields: fm ? fm.fields : {}, title, hasFrontmatter: !!fm };
  });
}

/**
 * Scan archive branch for learned files in a specific project folder.
 */
function scanArchivedLearnedDir(projectFolder) {
  const archivePath = `scratch/${projectFolder}/learned`;
  // ls-tree prints paths from the repository root, so reduce each entry to its
  // basename before rebuilding it under archivePath — otherwise the prefix doubles.
  const files = gitListTree('archive', archivePath + '/').map((p) => basename(p));
  return files
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => {
      const gitPath = `${archivePath}/${f}`;
      const content = gitShowFile('archive', gitPath);
      if (!content) return null;
      const fm = parseFrontmatter(content);
      const title = extractTitle(content);
      return {
        filePath: `[archive]/${projectFolder}/learned/${f}`,
        filename: f,
        content,
        fields: fm ? fm.fields : {},
        title,
        hasFrontmatter: !!fm,
        archived: true,
      };
    })
    .filter(Boolean);
}

/**
 * Scan all scratch/{proj}/learned/ directories.
 */
function scanAllProjects(includeArchived = false) {
  const results = [];

  if (existsSync(SCRATCH_DIR)) {
    const projects = readdirSync(SCRATCH_DIR).filter((name) => {
      if (name.startsWith('.')) return false;
      const fullPath = join(SCRATCH_DIR, name);
      return statSync(fullPath).isDirectory();
    });

    for (const project of projects) {
      const learnedDir = join(SCRATCH_DIR, project, 'learned');
      const files = scanLearnedDir(learnedDir);
      results.push(...files.map((f) => ({ ...f, project })));
    }
  }

  if (includeArchived) {
    // Get project folders from archive branch
    const archiveFolders = gitListTree('archive', 'scratch/').map((p) => basename(p));
    for (const folder of archiveFolders) {
      const archivedFiles = scanArchivedLearnedDir(folder);
      results.push(...archivedFiles.map((f) => ({ ...f, project: folder })));
    }
  }

  return results;
}

/**
 * Extract the first ## heading from markdown as the title.
 */
function extractTitle(content) {
  const m = content.match(/^##\s+(.+)$/m);
  return m ? m[1].trim() : '(no title)';
}

/**
 * Get first N non-empty lines of body content (after frontmatter).
 */
function getBodyLines(content, count = 3) {
  const fmMatch = content.match(/^---\n[\s\S]*?\n---\n?/);
  const body = fmMatch ? content.slice(fmMatch[0].length) : content;
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('##'))
    .slice(0, count);
}

/**
 * Assert that absPath is contained within SCRATCH_DIR.
 * Blocks path traversal (e.g. ../../etc/passwd) on mutation subcommands.
 */
function assertWithinScratchDir(absPath) {
  const resolvedFile = resolve(absPath);
  const resolvedScratch = resolve(SCRATCH_DIR);
  const sep = process.platform === 'win32' ? '\\' : '/';
  if (!resolvedFile.startsWith(resolvedScratch + sep)) {
    writeError('Path traversal detected. File must be inside scratch/.');
    process.exit(1);
  }
}

// ─── Validation ───────────────────────────────────────────────────────────

/**
 * Validate frontmatter fields against schema.
 * Returns array of error strings.
 */
function validateFields(fields, filePath) {
  const errors = [];

  for (const req of REQUIRED_FIELDS) {
    if (!fields[req]) errors.push(`${filePath}: missing required field '${req}'`);
  }

  if (fields.type && !VALID_TYPES.includes(fields.type)) {
    errors.push(`${filePath}: invalid type '${fields.type}' (valid: ${VALID_TYPES.join(', ')})`);
  }
  if (fields.scope && !VALID_SCOPES.includes(fields.scope)) {
    errors.push(`${filePath}: invalid scope '${fields.scope}' (valid: ${VALID_SCOPES.join(', ')})`);
  }
  if (fields.status && !VALID_STATUSES.includes(fields.status)) {
    errors.push(`${filePath}: invalid status '${fields.status}' (valid: ${VALID_STATUSES.join(', ')})`);
  }
  if (fields.severity && !VALID_SEVERITIES.includes(fields.severity)) {
    errors.push(`${filePath}: invalid severity '${fields.severity}' (valid: ${VALID_SEVERITIES.join(', ')})`);
  }
  if (fields.severity && fields.type !== 'drift') {
    errors.push(`${filePath}: 'severity' field only valid when type=drift`);
  }
  if (fields.status === 'dropped') {
    for (const req of ['drop-reason', 'drop-note']) {
      if (!fields[req]) errors.push(`${filePath}: missing field '${req}' required when status=dropped`);
    }
    if (fields['drop-reason'] && !VALID_DROP_REASONS.includes(fields['drop-reason'])) {
      errors.push(`${filePath}: invalid drop-reason '${fields['drop-reason']}' (valid: ${VALID_DROP_REASONS.join(', ')})`);
    }
  }
  if (fields['targets-step'] && !/^\d+$/.test(fields['targets-step'])) {
    errors.push(`${filePath}: 'targets-step' must be an integer`);
  }

  return errors;
}

// ─── Exit code logic ──────────────────────────────────────────────────────

/**
 * Compute exit code from a list of parsed file records.
 * 2 if any escalated, 1 if any pending (captured), 0 if all ingested/dropped/none.
 */
function computeExitCode(files) {
  const hasEscalated = files.some((f) => f.fields.status === 'escalated');
  if (hasEscalated) return 2;
  const hasPending = files.some((f) => f.fields.status === 'captured');
  if (hasPending) return 1;
  return 0;
}

// ─── Output helpers ───────────────────────────────────────────────────────

function colorStatus(status) {
  switch (status) {
    case 'captured': return `${colors.yellow}captured${colors.reset}`;
    case 'ingested': return `${colors.green}ingested${colors.reset}`;
    case 'escalated': return `${colors.red}escalated${colors.reset}`;
    case 'dropped': return `${colors.gray}dropped${colors.reset}`;
    default: return status || '(missing)';
  }
}

// ─── Subcommand implementations ───────────────────────────────────────────

function cmdStatus(args, flags) {
  const path = args[0];
  if (!path) {
    writeError('status requires <path> argument');
    process.exit(1);
  }

  const learnedDir = resolveLearnedDir(path);
  const files = scanLearnedDir(learnedDir);

  const counts = Object.fromEntries([...VALID_STATUSES, 'invalid'].map((s) => [s, 0]));
  for (const f of files) {
    counts[VALID_STATUSES.includes(f.fields.status) ? f.fields.status : 'invalid']++;
  }

  if (flags.json) {
    console.log(JSON.stringify({ path: learnedDir, total: files.length, counts }, null, 2));
    return computeExitCode(files);
  }

  console.log('');
  console.log(`${colors.cyan}${colors.bold}Learned files status: ${learnedDir}${colors.reset}`);
  console.log('');
  console.log(`  Total:     ${files.length}`);
  console.log(`  Pending:   ${colors.yellow}${counts.captured}${colors.reset}  (status: captured)`);
  console.log(`  Ingested:  ${colors.green}${counts.ingested}${colors.reset}`);
  console.log(`  Escalated: ${colors.red}${counts.escalated}${colors.reset}`);
  console.log(`  Dropped:   ${colors.gray}${counts.dropped}${colors.reset}`);
  if (counts.invalid > 0) {
    console.log(`  Invalid:   ${colors.red}${counts.invalid}${colors.reset}  (missing/unknown status)`);
  }
  console.log('');

  return computeExitCode(files);
}

/** The files `pending` lists: status captured, of `type` when one is given. */
function capturedFiles(learnedDir, type) {
  return scanLearnedDir(learnedDir).filter(
    (f) => f.fields.status === 'captured' && (type === null || f.fields.type === type),
  );
}

function cmdPending(args, flags) {
  const path = args[0];
  if (!path) {
    writeError('pending requires <path> argument');
    process.exit(2);
  }
  if (flags.type !== null && !VALID_TYPES.includes(flags.type)) {
    writeError(`invalid type '${flags.type}' (valid: ${VALID_TYPES.join(', ')})`);
    process.exit(2);
  }

  const learnedDir = resolveLearnedDir(path);
  const files = capturedFiles(learnedDir, flags.type);

  if (flags.json) {
    console.log(JSON.stringify(files.map((f) => ({ file: f.filePath, fields: f.fields, title: f.title })), null, 2));
    return files.length > 0 ? 1 : 0;
  }

  if (files.length === 0) {
    console.log(`${colors.green}No pending files.${colors.reset}`);
    return 0;
  }

  console.log('');
  console.log(`${colors.yellow}Pending files (status: captured):${colors.reset}`);
  console.log('');
  for (const f of files) {
    console.log(`  ${colors.cyan}${f.filename}${colors.reset}`);
    console.log(`    ${f.title}`);
    console.log(`    domain: ${f.fields['target-domain'] || '(none)'} | type: ${f.fields.type || '(none)'}`);
  }
  console.log('');
  return 1;
}

function cmdEscalated(args, flags) {
  const path = args[0];
  if (!path) {
    writeError('escalated requires <path> argument');
    process.exit(1);
  }

  const learnedDir = resolveLearnedDir(path);
  const files = scanLearnedDir(learnedDir).filter((f) => f.fields.status === 'escalated');

  if (flags.json) {
    console.log(JSON.stringify(files.map((f) => ({ file: f.filePath, fields: f.fields, title: f.title })), null, 2));
    return files.length > 0 ? 2 : 0;
  }

  if (files.length === 0) {
    console.log(`${colors.green}No escalated files.${colors.reset}`);
    return 0;
  }

  console.log('');
  console.log(`${colors.red}Escalated files:${colors.reset}`);
  console.log('');
  for (const f of files) {
    console.log(`  ${colors.cyan}${f.filename}${colors.reset}`);
    console.log(`    ${f.title}`);
    console.log(`    reason: ${f.fields['escalation-reason'] || '(no reason given)'}`);
    console.log(`    domain: ${f.fields['target-domain'] || '(none)'}`);
  }
  console.log('');
  return 2;
}

function cmdFeedForward(args, flags) {
  const path = args[0];
  const stepStr = flags.step;

  if (!path) {
    writeError('feed-forward requires <path> argument');
    process.exit(1);
  }
  if (!stepStr) {
    writeError('feed-forward requires --step N');
    process.exit(1);
  }

  const stepN = parseInt(stepStr, 10);
  if (isNaN(stepN) || stepN < 0) {
    writeError(`--step must be a non-negative integer, got: ${stepStr}`);
    process.exit(1);
  }

  const learnedDir = resolveLearnedDir(path);
  const files = scanLearnedDir(learnedDir).filter((f) => {
    if (f.fields.status !== 'captured') return false;
    const ts = parseInt(f.fields['targets-step'], 10);
    return !isNaN(ts) && ts >= stepN;
  });

  if (flags.json) {
    console.log(JSON.stringify(
      files.map((f) => ({
        file: f.filePath,
        title: f.title,
        fields: f.fields,
        body: f.content,
      })),
      null, 2
    ));
    return 0;
  }

  if (files.length === 0) {
    console.log(`${colors.gray}No feed-forward files for step >= ${stepN}.${colors.reset}`);
    return 0;
  }

  console.log('');
  console.log(`${colors.cyan}Feed-forward: files targeting step >= ${stepN}${colors.reset}`);
  console.log('');
  for (const f of files) {
    const bodyLines = getBodyLines(f.content, 3);
    console.log(`  ${colors.bold}${f.filename}${colors.reset}  [targets-step: ${f.fields['targets-step']}]`);
    console.log(`    ${colors.yellow}${f.title}${colors.reset}`);
    for (const line of bodyLines) {
      console.log(`    ${colors.gray}${line}${colors.reset}`);
    }
    console.log('');
  }

  return 0;
}

function cmdValidate(args, flags) {
  const path = args[0];
  if (!path) {
    writeError('validate requires <path> argument');
    process.exit(1);
  }

  const learnedDir = resolveLearnedDir(path);
  const files = scanLearnedDir(learnedDir);
  const allErrors = [];

  for (const f of files) {
    if (!f.hasFrontmatter) {
      allErrors.push(`${f.filePath}: no frontmatter found`);
      continue;
    }
    const errs = validateFields(f.fields, f.filename);
    allErrors.push(...errs);
  }

  if (flags.json) {
    console.log(JSON.stringify({ path: learnedDir, files: files.length, errors: allErrors }, null, 2));
    return allErrors.length > 0 ? 1 : 0;
  }

  if (allErrors.length === 0) {
    console.log(`${colors.green}All ${files.length} files valid.${colors.reset}`);
    return 0;
  }

  console.log('');
  console.log(`${colors.red}Validation errors (${allErrors.length}):${colors.reset}`);
  console.log('');
  for (const err of allErrors) {
    console.log(`  ${colors.red}[ERROR]${colors.reset} ${err}`);
  }
  console.log('');
  return 1;
}

function cmdInit(args, flags) {
  const path = args[0];
  if (!path) {
    writeError('init requires <path> argument');
    process.exit(1);
  }

  const learnedDir = resolve(path);
  mkdirSync(learnedDir, { recursive: true });

  // A tracked placeholder so an empty learned/ survives in git. The capture
  // format itself is documented once, in this skill's SKILL.md.
  const keepPath = join(learnedDir, '.gitkeep');
  const existed = existsSync(keepPath);
  if (!existed) writeFileSync(keepPath, '', 'utf-8');

  if (flags.json) {
    console.log(JSON.stringify({ path: learnedDir, gitkeep: keepPath, created: !existed }, null, 2));
    return 0;
  }

  console.log(`${colors.green}[OK]${colors.reset} Initialized: ${learnedDir}`);
  console.log(`     .gitkeep ${existed ? 'already present' : 'created'}: ${keepPath}`);
  return 0;
}

function cmdMarkIngested(args, flags) {
  const filePath = args[0];
  if (!filePath) {
    writeError('mark-ingested requires <file> argument');
    process.exit(1);
  }

  const absPath = resolve(filePath);
  assertWithinScratchDir(absPath);
  if (!existsSync(absPath)) {
    writeError(`File not found: ${absPath}`);
    process.exit(1);
  }

  let content = readFileSync(absPath, 'utf-8');
  if (!parseFrontmatter(content)) {
    writeError(`No frontmatter in file: ${absPath}`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  content = updateFrontmatterField(content, 'status', 'ingested');
  content = updateFrontmatterField(content, 'ingested-at', now);
  writeFileSync(absPath, content, 'utf-8');

  if (flags.json) {
    console.log(JSON.stringify({ file: absPath, status: 'ingested', 'ingested-at': now }, null, 2));
    return 0;
  }

  console.log(`${colors.green}[OK]${colors.reset} Marked ingested: ${basename(absPath)}`);
  console.log(`     ingested-at: ${now}`);
  return 0;
}

function cmdMarkEscalated(args, flags) {
  const filePath = args[0];
  const reason = args[1];

  if (!filePath) {
    writeError('mark-escalated requires <file> and <reason> arguments');
    process.exit(1);
  }
  if (!reason) {
    writeError('mark-escalated requires <reason> argument');
    process.exit(1);
  }

  const absPath = resolve(filePath);
  assertWithinScratchDir(absPath);
  if (!existsSync(absPath)) {
    writeError(`File not found: ${absPath}`);
    process.exit(1);
  }

  let content = readFileSync(absPath, 'utf-8');
  if (!parseFrontmatter(content)) {
    writeError(`No frontmatter in file: ${absPath}`);
    process.exit(1);
  }

  content = updateFrontmatterField(content, 'status', 'escalated');
  content = updateFrontmatterField(content, 'escalation-reason', reason);
  writeFileSync(absPath, content, 'utf-8');

  if (flags.json) {
    console.log(JSON.stringify({ file: absPath, status: 'escalated', 'escalation-reason': reason }, null, 2));
    return 0;
  }

  console.log(`${colors.red}[ESCALATED]${colors.reset} ${basename(absPath)}`);
  console.log(`     reason: ${reason}`);
  return 0;
}

function cmdMarkDropped(args, flags) {
  const [filePath, reason, note] = args;

  if (!filePath) {
    writeError('mark-dropped requires <file>, <reason> and <note> arguments');
    process.exit(1);
  }
  if (!VALID_DROP_REASONS.includes(reason)) {
    writeError(`Invalid drop reason '${reason ?? ''}' (valid: ${VALID_DROP_REASONS.join(', ')})`);
    process.exit(1);
  }
  if (!note || !note.trim()) {
    writeError('mark-dropped requires a non-empty <note> argument');
    process.exit(1);
  }

  const absPath = resolve(filePath);
  assertWithinScratchDir(absPath);
  if (!existsSync(absPath)) {
    writeError(`File not found: ${absPath}`);
    process.exit(1);
  }

  let content = readFileSync(absPath, 'utf-8');
  const fm = parseFrontmatter(content);
  if (!fm) {
    writeError(`No frontmatter in file: ${absPath}`);
    process.exit(1);
  }
  // Only a pending capture can be dropped; re-dropping or dropping filed work is a caller error.
  if (fm.fields.status !== 'captured') {
    writeError(`mark-dropped requires status: captured, found '${fm.fields.status || '(missing)'}': ${absPath}`);
    process.exit(1);
  }

  content = updateFrontmatterField(content, 'status', 'dropped');
  content = updateFrontmatterField(content, 'drop-reason', reason);
  // JSON string syntax is a valid YAML double-quoted scalar, so quotes and newlines stay on one line.
  content = updateFrontmatterField(content, 'drop-note', JSON.stringify(note));
  writeFileSync(absPath, content, 'utf-8');

  if (flags.json) {
    console.log(JSON.stringify({ file: absPath, status: 'dropped', 'drop-reason': reason, 'drop-note': note }, null, 2));
    return 0;
  }

  console.log(`${colors.gray}[DROPPED]${colors.reset} ${basename(absPath)}`);
  // The note is caller text; strip control characters so it cannot carry terminal escape sequences.
  console.log(`     reason: ${reason} — ${note.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')}`);
  return 0;
}

function cmdReroute(args, flags) {
  const filePath = args[0];
  const domain = args[1];

  if (!filePath) {
    writeError('reroute requires <file> and <domain> arguments');
    process.exit(1);
  }
  if (!domain) {
    writeError('reroute requires <domain> argument');
    process.exit(1);
  }

  // Basic domain name validation (no path traversal, no injection)
  if (!/^[a-zA-Z0-9_-]+$/.test(domain)) {
    writeError(`Invalid domain name '${domain}'. Use only letters, numbers, hyphens, underscores.`);
    process.exit(1);
  }

  const absPath = resolve(filePath);
  assertWithinScratchDir(absPath);
  if (!existsSync(absPath)) {
    writeError(`File not found: ${absPath}`);
    process.exit(1);
  }

  let content = readFileSync(absPath, 'utf-8');
  if (!parseFrontmatter(content)) {
    writeError(`No frontmatter in file: ${absPath}`);
    process.exit(1);
  }

  content = updateFrontmatterField(content, 'target-domain', domain);
  content = updateFrontmatterField(content, 'status', 'captured');
  writeFileSync(absPath, content, 'utf-8');

  if (flags.json) {
    console.log(JSON.stringify({ file: absPath, 'target-domain': domain, status: 'captured' }, null, 2));
    return 0;
  }

  console.log(`${colors.green}[OK]${colors.reset} Rerouted: ${basename(absPath)}`);
  console.log(`     target-domain: ${domain}`);
  console.log(`     status: captured (reset for re-ingestion)`);
  return 0;
}

function cmdList(args, flags) {
  const files = scanAllProjects(flags.includeArchived);

  if (flags.json) {
    console.log(JSON.stringify(
      files.map((f) => ({
        project: f.project,
        file: f.filePath,
        title: f.title,
        status: f.fields.status,
        type: f.fields.type,
        'target-domain': f.fields['target-domain'],
        archived: f.archived || false,
      })),
      null, 2
    ));
    return computeExitCode(files);
  }

  if (files.length === 0) {
    console.log(`${colors.gray}No learned files found in scratch/*/learned/.${colors.reset}`);
    return 0;
  }

  // Group by project
  const byProject = {};
  for (const f of files) {
    if (!byProject[f.project]) byProject[f.project] = [];
    byProject[f.project].push(f);
  }

  console.log('');
  console.log(`${colors.cyan}${colors.bold}All learned files across projects:${colors.reset}`);
  console.log('');

  for (const [project, projectFiles] of Object.entries(byProject)) {
    const archiveLabel = projectFiles[0]?.archived ? ' [archived]' : '';
    console.log(`  ${colors.bold}${project}${colors.reset}${colors.gray}${archiveLabel}${colors.reset}`);
    for (const f of projectFiles) {
      const statusStr = colorStatus(f.fields.status);
      console.log(`    ${colors.cyan}${f.filename}${colors.reset}  ${statusStr}`);
      console.log(`      ${f.title}`);
    }
    console.log('');
  }

  const exitCode = computeExitCode(files);
  return exitCode;
}

function cmdStats(args, flags) {
  const files = scanAllProjects(flags.includeArchived);

  const counts = { total: 0, ...Object.fromEntries(VALID_STATUSES.map((s) => [s, 0])) };
  const byProject = {};
  const byDomain = {};
  const byType = {};

  for (const f of files) {
    counts.total++;
    if (VALID_STATUSES.includes(f.fields.status)) counts[f.fields.status]++;

    if (!byProject[f.project]) byProject[f.project] = 0;
    byProject[f.project]++;

    const domain = f.fields['target-domain'] || '(unknown)';
    if (!byDomain[domain]) byDomain[domain] = 0;
    byDomain[domain]++;

    const type = f.fields.type || '(unknown)';
    if (!byType[type]) byType[type] = 0;
    byType[type]++;
  }

  if (flags.json) {
    console.log(JSON.stringify({ counts, byProject, byDomain, byType }, null, 2));
    return 0;
  }

  console.log('');
  console.log(`${colors.cyan}${colors.bold}Knowledge Capture Stats${colors.reset}`);
  console.log('');
  console.log(`  Total:     ${counts.total}`);
  console.log(`  Pending:   ${colors.yellow}${counts.captured}${colors.reset}`);
  console.log(`  Ingested:  ${colors.green}${counts.ingested}${colors.reset}`);
  console.log(`  Escalated: ${colors.red}${counts.escalated}${colors.reset}`);
  console.log(`  Dropped:   ${colors.gray}${counts.dropped}${colors.reset}`);
  console.log('');

  if (Object.keys(byProject).length > 0) {
    console.log(`  ${colors.bold}By Project:${colors.reset}`);
    for (const [proj, n] of Object.entries(byProject)) {
      console.log(`    ${proj}: ${n}`);
    }
    console.log('');
  }

  if (Object.keys(byDomain).length > 0) {
    console.log(`  ${colors.bold}By Domain:${colors.reset}`);
    for (const [domain, n] of Object.entries(byDomain)) {
      console.log(`    ${domain}: ${n}`);
    }
    console.log('');
  }

  if (Object.keys(byType).length > 0) {
    console.log(`  ${colors.bold}By Type:${colors.reset}`);
    for (const [type, n] of Object.entries(byType)) {
      console.log(`    ${type}: ${n}`);
    }
    console.log('');
  }

  return 0;
}

// ─── Boundary ingest: gate, snapshot, compare ─────────────────────────────
// The commands of knowledge-capture/boundary-ingest.md steps 1, 3 and 4. Their output
// lines, exit codes and on-disk formats are the ones the page's shell blocks produced,
// so callers route on them unchanged and files written by either side interoperate.

const PATH_ALLOW = /^[-A-Za-z0-9_./:\\]+$/;
const IS_WINDOWS = process.platform === 'win32';

const C_ESCAPES = { 7: '\\a', 8: '\\b', 9: '\\t', 10: '\\n', 11: '\\v', 12: '\\f', 13: '\\r', 27: '\\E', 39: "\\'", 92: '\\\\' };

/** bash 5 `printf %q` under a UTF-8 locale, whatever the caller's locale. */
function bashQuote(s) {
  if (s === '') return "''";
  if (/[\x00-\x1f\x7f]/.test(s)) {
    let out = '';
    for (const ch of s) {
      const c = ch.codePointAt(0);
      out += C_ESCAPES[c] ?? (c < 0x20 || c === 0x7f ? `\\${c.toString(8).padStart(3, '0')}` : ch);
    }
    return `$'${out}'`;
  }
  return s.replace(/[^A-Za-z0-9_./:=@%+\-~#\u0080-\u{10FFFF}]/gu, '\\$&').replace(/^[~#]/, '\\$&');
}

/**
 * One native spelling for `C:\…`, `C:/…` and, on Windows, `/c/…`. Off Windows a
 * drive-letter path becomes `/c/…`, as the shell's norm() made it.
 */
function nativePath(p) {
  const s = p.replace(/\\/g, '/');
  if (IS_WINDOWS) {
    const m = s.match(/^\/([A-Za-z])(\/.*)?$/);
    return m ? `${m[1].toUpperCase()}:${m[2] || '/'}` : s;
  }
  const m = s.match(/^([A-Za-z]):(\/.*)?$/);
  return m ? `/${m[1].toLowerCase()}${m[2] || ''}` : s;
}

/** A repo root or learned dir as the shell printed it: MSYS `/c/…` under Git Bash. */
function displayPath(p) {
  if (!IS_WINDOWS || !process.env.MSYSTEM) return p;
  const s = p.replace(/\\/g, '/');
  const m = s.match(/^([A-Za-z]):(\/.*)?$/);
  return m ? `/${m[1].toLowerCase()}${m[2] || ''}` : s;
}

/** GNU `realpath` without -e: every component but the last must exist. */
function realpathLoose(p) {
  try {
    return realpathSync(p);
  } catch {
    try {
      return join(realpathSync(dirname(p)), basename(p));
    } catch {
      return null;
    }
  }
}

/** A realpath in one comparable form: '/' separators and an upper-case drive on Windows. */
const foldPath = (p) => (IS_WINDOWS ? p.replace(/\\/g, '/').replace(/^[a-z]:/, (d) => d.toUpperCase()) : p);

/** `child` relative to `parent` ('/'-joined), or null when it is not strictly under it. */
function relativeUnder(child, parent) {
  const c = foldPath(child);
  const base = foldPath(parent).replace(/\/+$/, '');
  return c.startsWith(`${base}/`) ? c.slice(base.length + 1) : null;
}

/**
 * The first of `.claude`, `.claude/skills` and each entry directly under it that is a
 * symlink, as a '/'-joined path relative to `root`; null when none is. Lstats each
 * component at the moment of use, from the top down.
 */
function firstSymlink(root) {
  const isLink = (rel) => {
    try {
      return lstatSync(join(root, rel)).isSymbolicLink();
    } catch {
      return false;
    }
  };
  for (const rel of ['.claude', '.claude/skills']) if (isLink(rel)) return rel;
  let entries;
  try {
    entries = readdirSync(join(root, '.claude', 'skills')).sort();
  } catch {
    return null;
  }
  for (const e of entries) if (isLink(`.claude/skills/${e}`)) return `.claude/skills/${e}`;
  return null;
}

/**
 * Step 1's path checks. Returns { refusal } or { top, dir, project }: `top` is the
 * realpathed git top level of cwd, `dir` the realpathed <top>/scratch/<project>/learned.
 */
function resolveBoundaryPath(raw) {
  if (!PATH_ALLOW.test(raw)) {
    return { refusal: 'the path holds a character outside [-A-Za-z0-9_./:\\]' };
  }
  const p = nativePath(raw);
  if (`/${p}/`.includes('/../')) return { refusal: `'..' segment in ${raw}` };
  const notLearned = { refusal: `${raw} is not scratch/<project>/learned` };
  const topLine = gitLine(['rev-parse', '--show-toplevel'], process.cwd());
  const top = topLine && realpathLoose(nativePath(topLine));
  const dir = top && realpathLoose(p);
  const rel = dir && relativeUnder(dir, top);
  const m = rel && rel.match(/^scratch\/([a-zA-Z0-9_-]+)\/learned$/);
  if (!m) return notLearned;
  const link = firstSymlink(top);
  if (link) {
    return { refusal: `${bashQuote(link)} is a symlink, and git status cannot see the files behind it; run /ingest by hand` };
  }
  return { top, dir, project: m[1] };
}

function cmdGate(args, flags) {
  if (args.length !== 1) usageFail('gate', 'gate requires exactly one <path> argument');
  if (flags.type !== null && flags.type !== 'drift') {
    console.log(`refused: type '${flags.type}' is not drift`);
    return 3;
  }
  const r = resolveBoundaryPath(args[0]);
  if (r.refusal) {
    console.log(`refused: ${r.refusal}`);
    return 3;
  }
  console.log(displayPath(r.dir));
  console.log(`project: ${r.project}`);
  let count;
  try {
    count = capturedFiles(r.dir, flags.type).length;
  } catch {
    console.log('pending: ?');
    console.log('pending exit: 2');
    return 2;
  }
  const code = count > 0 ? 1 : 0;
  console.log(`pending: ${count}`);
  console.log(`pending exit: ${code}`);
  return code;
}

const LOCK_MAX_AGE_S = 7200;
const MUTEX_MAX_AGE_S = 30;
const MUTEX_WAIT_MS = 2000;
const nowSeconds = () => Math.floor(Date.now() / 1000);
const uniqueSuffix = () => `${process.pid}.${randomBytes(4).toString('hex')}`;
const sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function removeQuietly(path) {
  try {
    unlinkSync(path);
  } catch {
    // already gone: nothing to remove
  }
}

function readQuietly(path) {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
}

/** The `snapshot:` value of a lock's content, or '' when it has none. */
function lockSnapshot(buf) {
  const m = buf && buf.toString('utf-8').match(/^snapshot: (.*)$/m);
  return m ? m[1] : '';
}

/**
 * Create `lock` whole, holding `content`: a temporary file hard-linked into place,
 * which fails rather than overwrites. Where hard links are unsupported, falls back to
 * the shell's create-then-write. True when this call created the lock.
 */
function publishLock(lock, content) {
  const tmp = `${lock}.new.${uniqueSuffix()}`;
  try {
    writeFileSync(tmp, content, { flag: 'wx' });
    linkSync(tmp, lock);
    return true;
  } catch (e) {
    if (e.code !== 'EPERM' && e.code !== 'ENOTSUP') return false;
    try {
      const fd = openSync(lock, 'wx');
      try {
        writeSync(fd, content);
      } finally {
        closeSync(fd);
      }
      return true;
    } catch {
      return false;
    }
  } finally {
    removeQuietly(tmp);
  }
}

/**
 * Run `fn` holding `<lock>.mutex`, which every taker and releaser of `lock` creates first,
 * so a stale break never interleaves with another contender's publish or release. It is
 * held for milliseconds; one over 30 s old was left by a killed process and is removed.
 * Returns undefined, without running `fn`, when the mutex stays busy for 2 s or cannot
 * be created.
 */
function withMutex(lock, fn) {
  const mutex = `${lock}.mutex`;
  const deadline = Date.now() + MUTEX_WAIT_MS;
  for (;;) {
    try {
      closeSync(openSync(mutex, 'wx'));
      break;
    } catch (e) {
      // EPERM: on Windows, a mutex another process is still deleting
      if (e.code !== 'EEXIST' && e.code !== 'EPERM') return undefined;
    }
    try {
      if (nowSeconds() - lstatSync(mutex).mtimeMs / 1000 > MUTEX_MAX_AGE_S) removeQuietly(mutex);
    } catch {
      // released between the create and the stat
    }
    if (Date.now() >= deadline) return undefined;
    sleepMs(5 + Math.floor(Math.random() * 20));
  }
  try {
    return fn();
  } finally {
    removeQuietly(mutex);
  }
}

/**
 * Take the ingest lock at `lockSpelled` for the snapshot `snapSpelled`. A held lock is
 * broken only when stale: its recorded snapshot file is gone or it is over 2 h old, or,
 * with no `snapshot:` line or no numeric `created:` line, its mtime is over 2 h old.
 * Returns { ok }, { held }, or { busy } when the mutex stayed busy.
 */
function takeLock(lockSpelled, snapSpelled) {
  const lock = nativePath(lockSpelled);
  const took = withMutex(lock, () => {
    const content = `snapshot: ${snapSpelled}\ncreated: ${nowSeconds()}\n`;
    if (publishLock(lock, content)) return { ok: true };
    const read = readQuietly(lock);
    let stale = !read;
    if (read) {
      const snap = lockSnapshot(read);
      const created = read.toString('utf-8').match(/^created: ([0-9]+)$/m);
      if (!snap || !created) {
        let mtime;
        try {
          mtime = lstatSync(lock).mtimeMs / 1000;
        } catch {
          mtime = Infinity;
        }
        stale = nowSeconds() - mtime > LOCK_MAX_AGE_S;
      } else {
        stale = !existsSync(nativePath(snap)) || nowSeconds() - Number(created[1]) > LOCK_MAX_AGE_S;
      }
    }
    if (stale) {
      removeQuietly(lock);
      if (publishLock(lock, content)) return { ok: true };
    }
    return { held: lockSnapshot(readQuietly(lock)) };
  });
  return took ?? { busy: `${lockSpelled}.mutex` };
}

/** Remove each lock whose `snapshot:` line is `snapSpelled`, then the snapshot file. */
function releaseLocks(snapSpelled, lockPaths) {
  for (const l of lockPaths) {
    if (!l) continue;
    const lock = nativePath(l);
    const drop = () => {
      if (lockSnapshot(readQuietly(lock)) === snapSpelled) removeQuietly(lock);
      return true;
    };
    // A busy mutex must not keep a finished ingest's lock alive: drop it unguarded.
    if (withMutex(lock, drop) === undefined) drop();
  }
  removeQuietly(nativePath(snapSpelled));
}

/**
 * Run `release` if the process is interrupted, then exit non-zero. Handlers fire only
 * between synchronous calls, so main() defers its final exit by one tick to let a
 * signal that arrived during a spawnSync land here.
 */
function onInterrupt(release) {
  for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
    process.on(sig, () => {
      release();
      process.exit(code);
    });
  }
}

/**
 * The porcelain entries under .claude/skills/ in `cwd`, as [entry, orig] pairs:
 * `orig` is a rename's or copy's source, '' otherwise. Null when git status fails.
 */
function skillsStatus(cwd) {
  const r = gitRaw(['status', '--porcelain', '-z', '-uall', '--', '.claude/skills/'], cwd);
  if (!r.success) return null;
  const parts = [];
  let start = 0;
  for (let i = 0; i < r.stdout.length; i++) {
    if (r.stdout[i] === 0) {
      parts.push(r.stdout.subarray(start, i).toString('utf-8'));
      start = i + 1;
    }
  }
  const entries = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    const orig = /[RC]/.test(e.slice(0, 2)) ? (parts[++i] ?? '') : '';
    entries.push([e, orig]);
  }
  return entries;
}

const statusLine = (root, e, orig) => `${bashQuote(root)} ${bashQuote(e)} ${bashQuote(orig)}`;

/** The registered-repo paths on stdin (`scratch-memory repos list --json`), or null. */
function readRegisteredRepos() {
  let list;
  try {
    list = JSON.parse(readFileSync(0, 'utf-8'));
  } catch {
    return null;
  }
  if (!Array.isArray(list)) return null;
  return list
    .filter((e) => e && e.ok && Array.isArray(e.accepts) && e.accepts.includes('learned'))
    .map((e) => e.path)
    .filter((p) => typeof p === 'string' && p !== '' && !/[\t\r\n]/.test(p));
}

function cmdSnapshot(args, flags) {
  if (args.length !== 1) usageFail('snapshot', 'snapshot requires exactly one <learned-dir> argument');
  if (flags.repos !== null && flags.repos !== '-') usageFail('snapshot', `--repos takes only '-', got '${flags.repos}'`);
  const r = resolveBoundaryPath(args[0]);
  if (r.refusal) {
    console.log(`refused: ${r.refusal}`);
    return 3;
  }
  const gd = gitLine(['rev-parse', '--absolute-git-dir'], r.top);
  if (gd === null) {
    console.log('refused: git rev-parse failed');
    return 3;
  }
  const snap = `${gd}/boundary-ingest-${r.project}.before`;
  let fd;
  try {
    fd = openSync(nativePath(snap), 'wx');
  } catch {
    console.log(`refused: ${snap} exists; another ingest on ${r.project} is running, or one stopped before step 4 (remove the file only when none is running)`);
    return 3;
  }

  const locks = [];
  let done = false;
  const release = () => releaseLocks(snap, locks);
  onInterrupt(() => {
    if (!done) release();
  });
  try {
    const lines = [];
    const lock = `${gd}/boundary-ingest-skills.lock`;
    const took = takeLock(lock, snap);
    if (took.busy) {
      console.log(`refused: ${took.busy} stayed busy for 2 s; another ingest is taking or releasing the lock (remove it only when none is running)`);
      return 3;
    }
    if (!took.ok) {
      console.log(`refused: ${lock} is held by the ingest whose snapshot is ${took.held} (remove it only when none is running)`);
      return 3;
    }
    locks.push(lock);
    lines.push(`root\t.\t${lock}`);
    const own = skillsStatus(r.top);
    if (!own) {
      console.log('refused: git status failed; nothing was dispatched');
      return 3;
    }
    for (const [e, o] of own) lines.push(statusLine('.', e, o));

    const repos = flags.repos === '-' ? readRegisteredRepos() : null;
    const seen = [foldPath(r.top)];
    for (const p of repos ?? []) {
      const real = realpathLoose(nativePath(p));
      if (!real) {
        console.log(`note: skipped registered repo ${bashQuote(p)}: realpath failed`);
        continue;
      }
      if (seen.includes(foldPath(real))) continue;
      seen.push(foldPath(real));
      const root = displayPath(real);
      const link = firstSymlink(real);
      if (link) {
        console.log(`note: skipped registered repo ${bashQuote(root)}: ${bashQuote(`${root}/${link}`)} is a symlink`);
        continue;
      }
      const rgd = gitLine(['rev-parse', '--absolute-git-dir'], real);
      if (rgd === null) {
        console.log(`note: skipped registered repo ${bashQuote(root)}: git rev-parse failed`);
        continue;
      }
      const rlock = `${rgd}/boundary-ingest-skills.lock`;
      const rtook = takeLock(rlock, snap);
      if (rtook.busy) {
        console.log(`note: skipped registered repo ${bashQuote(root)}: ${bashQuote(rtook.busy)} stayed busy for 2 s`);
        continue;
      }
      if (!rtook.ok) {
        console.log(`note: skipped registered repo ${bashQuote(root)}: its ingest lock is held by the ingest whose snapshot is ${bashQuote(rtook.held)}`);
        continue;
      }
      locks.push(rlock);
      lines.push(`root\t${root}\t${rlock}`);
      const st = skillsStatus(real);
      if (!st) {
        console.log(`refused: git status failed in ${root}; nothing was dispatched`);
        return 3;
      }
      for (const [e, o] of st) lines.push(statusLine(root, e, o));
    }
    lines.push(`repos: ${repos ? 'read' : 'not-read'}`);
    writeSync(fd, `${lines.join('\n')}\n`);
    done = true;
    return 0;
  } finally {
    closeSync(fd);
    if (!done) release();
  }
}

function cmdCompare(args) {
  if (args.length !== 1) usageFail('compare', 'compare requires exactly one <learned-dir> argument');
  const r = resolveBoundaryPath(args[0]);
  if (r.refusal) {
    console.log(`aborted: ${r.refusal}`);
    return 4;
  }
  const gd = gitLine(['rev-parse', '--absolute-git-dir'], r.top);
  if (gd === null) {
    console.log('aborted: git rev-parse failed');
    return 4;
  }
  const snap = `${gd}/boundary-ingest-${r.project}.before`;
  let lines;
  try {
    if (!statSync(nativePath(snap)).isFile()) throw new Error('not a file');
    lines = readFileSync(nativePath(snap), 'utf-8').split('\n');
  } catch {
    console.log(`aborted: no snapshot at ${snap}`);
    return 4;
  }

  const roots = lines.filter((l) => l.startsWith('root\t')).map((l) => l.split('\t'));
  const release = () => releaseLocks(snap, roots.map((f) => f[2] ?? ''));
  onInterrupt(release);
  try {
    const before = new Set(lines);
    const out = [];
    for (const [, root] of roots) {
      const st = skillsStatus(root === '.' ? r.top : nativePath(root));
      if (!st) {
        console.log('aborted: git status failed');
        return 4;
      }
      for (const [e, o] of st) {
        if (before.has(statusLine(root, e, o))) continue;
        for (const q of o ? [e.slice(3), o] : [e.slice(3)]) {
          const kind = `/${q}`.includes('/scripts/') ? 'other' : q.endsWith('.md') ? 'page' : 'other';
          out.push(root === '.' ? `${kind} ${bashQuote(q)}` : `repo-${kind} ${bashQuote(root)} ${bashQuote(q)}`);
        }
      }
    }
    const sorted = out.map((l) => Buffer.from(l, 'utf-8')).sort(Buffer.compare);
    for (const l of sorted) console.log(l.toString('utf-8'));
    if (lines.includes('repos: not-read')) console.log('note: repos not read');
    return 0;
  } finally {
    release();
  }
}

// ─── Help text ────────────────────────────────────────────────────────────

const SUBCOMMAND_HELP = {
  status: `Usage: learned-check status <path>

Show a dashboard of learned file statuses in the given directory.

Arguments:
  <path>    Path to a learned/ directory

Statuses counted: captured, ingested, escalated, dropped.

Exit codes:
  0 = all ingested or dropped (or empty)
  1 = pending files (status: captured)
  2 = escalated files present`,

  pending: `Usage: learned-check pending <path> [--type <type>]

List files with status: captured (pending ingestion).

Arguments:
  <path>          Path to a learned/ directory
  --type <type>   Only files of this type: ${VALID_TYPES.join(', ')}.
                  Filters both the list and the exit code.

Exit codes:
  0 = no pending files (a missing directory counts as none)
  1 = has pending files
  2 = usage error: missing <path>, unknown --type value, or unknown flag`,

  escalated: `Usage: learned-check escalated <path>

List escalated files with their escalation reasons.

Arguments:
  <path>    Path to a learned/ directory

Exit codes:
  0 = no escalated files
  2 = has escalated files`,

  'feed-forward': `Usage: learned-check feed-forward <path> --step N

List files with targets-step >= N and status: captured.
Used to surface relevant knowledge before working on a plan step.

Arguments:
  <path>    Path to a learned/ directory
  --step N  Minimum step number (required)

Exit code: 0`,

  validate: `Usage: learned-check validate <path>

Validate frontmatter schema for all files in the directory.
Checks required fields and valid enum values.

Arguments:
  <path>    Path to a learned/ directory

Exit codes:
  0 = all valid
  1 = validation errors found`,

  init: `Usage: learned-check init <path>

Create a learned/ directory with a .gitkeep placeholder.
The capture format is documented in the knowledge-capture skill.
Idempotent: safe to run on existing directories.

Arguments:
  <path>    Path to create/initialize

Exit code: 0`,

  'mark-ingested': `Usage: learned-check mark-ingested <file>

Update a learned file's frontmatter: set status: ingested and ingested-at to current ISO timestamp.
Modifies the file in-place (preserves body).

Arguments:
  <file>    Path to a learned file (.md)

Exit code: 0`,

  'mark-escalated': `Usage: learned-check mark-escalated <file> <reason>

Update a learned file's frontmatter: set status: escalated and escalation-reason.
Modifies the file in-place (preserves body).

Arguments:
  <file>      Path to a learned file (.md)
  <reason>    Reason for escalation (quoted string)

Exit code: 0`,

  'mark-dropped': `Usage: learned-check mark-dropped <file> <reason> "<note>"

Update a pending learned file's frontmatter: set status: dropped, drop-reason and drop-note.
A dropped capture is finished work: it stays on disk so the next researcher does not re-capture it.
Modifies the file in-place (preserves body).

Arguments:
  <file>      Path to a learned file (.md) with status: captured
  <reason>    One of: ${VALID_DROP_REASONS.join(', ')}
  <note>      Short free text saying why (non-empty, quoted)

Exit codes:
  0 = marked dropped
  1 = unknown reason, empty note, missing file, or status not captured`,

  reroute: `Usage: learned-check reroute <file> <domain>

Update a learned file: set target-domain and reset status: captured for re-ingestion.
Modifies the file in-place (preserves body).

Arguments:
  <file>      Path to a learned file (.md)
  <domain>    New target domain (alphanumeric, hyphens, underscores)

Exit code: 0`,

  list: `Usage: learned-check list [--include-archived]

Scan all scratch/*/learned/ directories and list files.

Flags:
  --include-archived    Also scan archive branch via git show

Exit codes:
  0 = all clear
  1 = has pending
  2 = has escalated`,

  gate: `Usage: learned-check gate <path> [--type drift]

Boundary ingest step 1 (knowledge-capture/boundary-ingest.md). Checks that <path>
is <top>/scratch/<project>/learned, with <top> the git top level of the current
directory, and that no .claude, .claude/skills or entry under it is a symlink;
then counts the captured files, of type drift when --type drift is given.

Output on success, four lines:
  <learned-dir>
  project: <name>
  pending: <n>
  pending exit: <0|1>

Exit codes:
  0 = nothing pending
  1 = captures pending
  2 = usage error, or the directory could not be scanned (pending: ?)
  3 = refused: one line naming the check that failed`,

  snapshot: `Usage: learned-check snapshot <learned-dir> [--repos -]

Boundary ingest step 3. Repeats gate's path checks, creates
<git-dir>/boundary-ingest-<project>.before exclusively, takes
<git-dir>/boundary-ingest-skills.lock, and records git status of .claude/skills/.
With --repos -, reads \`scratch-memory repos list --json\` from stdin and does the
same in every ok registered repo that accepts learned; anything but a JSON array
on stdin records repos: not-read.

Output: nothing on success; one "note: skipped registered repo ..." line per
registered repo it skips.

Exit codes:
  0 = snapshot taken; compare releases it
  3 = refused: one line; everything this run created is released`,

  compare: `Usage: learned-check compare <learned-dir>

Boundary ingest step 4. Re-reads git status in every repo the snapshot locked and
prints, byte-sorted, one line per path whose status changed since:
  page <path>                 .md outside any scripts/ directory
  other <path>                anything else
  repo-page <root> <path>     the same, in a registered repo
  repo-other <root> <path>
then "note: repos not read" when snapshot could not read the registered repos.
Releases its locks and the snapshot file on every exit once it finds the file.

Exit codes:
  0 = compared
  4 = aborted: one line`,

  stats: `Usage: learned-check stats [--include-archived]

Show aggregate counts across all projects.
Broken down by project, domain, and type.

Flags:
  --include-archived    Also scan archive branch via git show

Exit code: 0`,
};

function showHelp() {
  console.log('');
  console.log(`${colors.cyan}${colors.bold}learned-check${colors.reset} — DX tool for knowledge-capture pipeline`);
  console.log('');
  console.log(`${colors.yellow}Usage:${colors.reset}  learned-check <subcommand> [args] [flags]`);
  console.log('');
  console.log(`${colors.yellow}Subcommands:${colors.reset}`);
  console.log('  status <path>               Dashboard of file statuses');
  console.log('  pending <path> [--type T]   List pending (captured) files');
  console.log('  escalated <path>            List escalated files with reasons');
  console.log('  feed-forward <path> --step N  Files targeting step >= N');
  console.log('  validate <path>             Check frontmatter schema');
  console.log('  init <path>                 Create directory + .gitkeep placeholder');
  console.log('  mark-ingested <file>        Set status: ingested');
  console.log('  mark-escalated <file> <reason>  Set status: escalated');
  console.log('  mark-dropped <file> <reason> <note>  Set status: dropped');
  console.log('  reroute <file> <domain>     Update target-domain, reset to captured');
  console.log('  list                        All files across projects');
  console.log('  stats                       Aggregate counts across projects');
  console.log('  gate <path> [--type drift]  Boundary ingest step 1: path gate + pending count');
  console.log('  snapshot <dir> [--repos -]  Boundary ingest step 3: lock + snapshot');
  console.log('  compare <dir>               Boundary ingest step 4: written paths + release');
  console.log('');
  console.log(`${colors.yellow}Global flags:${colors.reset}`);
  console.log('  --json               Machine-readable JSON output');
  console.log('  --include-archived   Include archive branch (list, stats)');
  console.log('  -h, --help           Show help');
  console.log('');
  console.log(`${colors.yellow}Exit codes:${colors.reset}`);
  console.log('  0 = clear (all ingested or dropped, or no files)');
  console.log('  1 = pending files (status: captured)');
  console.log('  2 = escalated files present; for pending, a usage error');
  console.log('');
  console.log(`${colors.yellow}Examples:${colors.reset}`);
  console.log('  learned-check status scratch/my-proj/learned/');
  console.log('  learned-check init scratch/new-proj/learned/');
  console.log('  learned-check feed-forward scratch/my-proj/learned/ --step 5');
  console.log('  learned-check mark-ingested scratch/my-proj/learned/step-03-gotcha.md');
  console.log('  learned-check list --include-archived');
  console.log('  learned-check stats');
  console.log('');
}

// ─── Argument parsing ─────────────────────────────────────────────────────

function parseArgs(argv, subcommand) {
  const flags = {
    json: false,
    includeArchived: false,
    help: false,
    step: null,
    type: null,
    repos: null,
  };
  const positional = [];

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--json') {
      flags.json = true;
    } else if (arg === '--include-archived') {
      flags.includeArchived = true;
    } else if (arg === '-h' || arg === '--help') {
      flags.help = true;
    } else if (arg === '--step') {
      i++;
      flags.step = argv[i] || null;
    } else if (arg.startsWith('--step=')) {
      flags.step = arg.slice('--step='.length);
    } else if ((subcommand === 'pending' || subcommand === 'gate') && arg === '--type') {
      i++;
      flags.type = argv[i] ?? '';
    } else if ((subcommand === 'pending' || subcommand === 'gate') && arg.startsWith('--type=')) {
      flags.type = arg.slice('--type='.length);
    } else if (subcommand === 'snapshot' && arg === '--repos') {
      i++;
      flags.repos = argv[i] ?? '';
    } else if (subcommand === 'snapshot' && arg.startsWith('--repos=')) {
      flags.repos = arg.slice('--repos='.length);
    } else if (arg.startsWith('-')) {
      usageFail(subcommand, `Unknown flag: ${arg}`);
    } else {
      positional.push(arg);
    }
    i++;
  }

  return { flags, positional };
}

/**
 * pending and gate exit 1 for "captures pending", so their usage errors take 2 or a
 * caller would read a typo as pending work. snapshot and compare route a usage error
 * like their own failure (3 refused, 4 aborted). Others keep 1: status and list
 * already use 2 for escalated files.
 */
function usageExitCode(subcommand) {
  switch (subcommand) {
    case 'pending':
    case 'gate': return 2;
    case 'snapshot': return 3;
    case 'compare': return 4;
    default: return 1;
  }
}

/** Report a usage error the way the subcommand's callers route it, and exit. */
function usageFail(subcommand, msg) {
  if (subcommand === 'snapshot') console.log(`refused: ${msg}`);
  else if (subcommand === 'compare') console.log(`aborted: ${msg}`);
  else {
    writeError(msg);
    writeError('Run "learned-check --help" for usage.');
  }
  process.exit(usageExitCode(subcommand));
}

// ─── Main ─────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);

  // Top-level help with no args
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  // Handle global flags that may appear before the subcommand
  let startIdx = 0;
  const preFlags = { json: false, includeArchived: false };
  while (startIdx < argv.length && argv[startIdx].startsWith('-')) {
    const arg = argv[startIdx];
    if (arg === '--json') {
      preFlags.json = true;
    } else if (arg === '--include-archived') {
      preFlags.includeArchived = true;
    } else {
      usageFail(argv.find((a) => !a.startsWith('-')), `Unknown flag: ${arg}`);
    }
    startIdx++;
  }

  if (startIdx >= argv.length) {
    showHelp();
    process.exit(0);
  }

  const subcommand = argv[startIdx];

  // Per-subcommand help
  if (argv[startIdx + 1] === '--help' || argv[startIdx + 1] === '-h') {
    if (SUBCOMMAND_HELP[subcommand]) {
      console.log('');
      console.log(SUBCOMMAND_HELP[subcommand]);
      console.log('');
      process.exit(0);
    }
    // Unknown subcommand falls through to error below
  }

  const { flags, positional } = parseArgs(argv.slice(startIdx + 1), subcommand);
  // Merge pre-subcommand global flags
  if (preFlags.json) flags.json = true;
  if (preFlags.includeArchived) flags.includeArchived = true;

  if (flags.help) {
    if (SUBCOMMAND_HELP[subcommand]) {
      console.log('');
      console.log(SUBCOMMAND_HELP[subcommand]);
      console.log('');
      process.exit(0);
    }
  }

  let exitCode = 0;

  switch (subcommand) {
    case 'status':       exitCode = cmdStatus(positional, flags); break;
    case 'pending':      exitCode = cmdPending(positional, flags); break;
    case 'escalated':    exitCode = cmdEscalated(positional, flags); break;
    case 'feed-forward': exitCode = cmdFeedForward(positional, flags); break;
    case 'validate':     exitCode = cmdValidate(positional, flags); break;
    case 'init':         exitCode = cmdInit(positional, flags); break;
    case 'mark-ingested':   exitCode = cmdMarkIngested(positional, flags); break;
    case 'mark-escalated':  exitCode = cmdMarkEscalated(positional, flags); break;
    case 'mark-dropped':    exitCode = cmdMarkDropped(positional, flags); break;
    case 'reroute':      exitCode = cmdReroute(positional, flags); break;
    case 'list':         exitCode = cmdList(positional, flags); break;
    case 'stats':        exitCode = cmdStats(positional, flags); break;
    case 'gate':         exitCode = cmdGate(positional, flags); break;
    case 'snapshot':     exitCode = cmdSnapshot(positional, flags); break;
    case 'compare':      exitCode = cmdCompare(positional, flags); break;
    default:
      writeError(`Unknown subcommand: ${subcommand}`);
      writeError('Run "learned-check --help" for usage.');
      process.exit(1);
  }

  // setImmediate runs after the event loop's poll phase, where a signal that arrived
  // during a spawnSync is delivered, so onInterrupt() sees it before this exit.
  setImmediate(() => process.exit(exitCode));
}

// Run only when invoked as a script, so the test suite can import bashQuote.
if (process.argv[1] && realpathLoose(process.argv[1]) === realpathSync(__filename)) main();

export { bashQuote };
