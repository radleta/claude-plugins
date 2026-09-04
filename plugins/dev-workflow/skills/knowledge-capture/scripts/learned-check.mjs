#!/usr/bin/env node
/**
 * learned-check.mjs - DX tool for managing learned/ files in knowledge-capture pipeline
 *
 * Subcommands:
 *   status <path>             Show dashboard of learned file statuses
 *   pending <path>            List captured (pending ingestion) files
 *   escalated <path>          List escalated files with reasons
 *   feed-forward <path> --step N  Files targeting step N or later (status: captured)
 *   validate <path>           Check frontmatter schema validity
 *   init <path>               Create learned/ dir with a .gitkeep placeholder
 *   mark-ingested <file>      Set status: ingested + ingested-at timestamp
 *   mark-escalated <file> <reason>  Set status: escalated + escalation-reason
 *   reroute <file> <domain>   Update target-domain, reset status: captured
 *   list                      Scan scratch/*\/learned/ across all projects
 *   stats                     Aggregate counts across all projects
 *
 * Global flags: --json, --include-archived, -h/--help
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
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
const VALID_STATUSES = ['captured', 'ingested', 'escalated'];
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
  const files = gitListTree('archive', archivePath + '/');
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
    const archiveFolders = gitListTree('archive', 'scratch/');
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
  if (fields['targets-step'] && !/^\d+$/.test(fields['targets-step'])) {
    errors.push(`${filePath}: 'targets-step' must be an integer`);
  }

  return errors;
}

// ─── Exit code logic ──────────────────────────────────────────────────────

/**
 * Compute exit code from a list of parsed file records.
 * 2 if any escalated, 1 if any pending (captured), 0 if all ingested/none.
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

  const counts = { captured: 0, ingested: 0, escalated: 0, invalid: 0 };
  for (const f of files) {
    const s = f.fields.status;
    if (s === 'captured') counts.captured++;
    else if (s === 'ingested') counts.ingested++;
    else if (s === 'escalated') counts.escalated++;
    else counts.invalid++;
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
  if (counts.invalid > 0) {
    console.log(`  Invalid:   ${colors.red}${counts.invalid}${colors.reset}  (missing/unknown status)`);
  }
  console.log('');

  return computeExitCode(files);
}

function cmdPending(args, flags) {
  const path = args[0];
  if (!path) {
    writeError('pending requires <path> argument');
    process.exit(1);
  }

  const learnedDir = resolveLearnedDir(path);
  const files = scanLearnedDir(learnedDir).filter((f) => f.fields.status === 'captured');

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

  const counts = { total: 0, captured: 0, ingested: 0, escalated: 0 };
  const byProject = {};
  const byDomain = {};
  const byType = {};

  for (const f of files) {
    counts.total++;
    const s = f.fields.status;
    if (s === 'captured') counts.captured++;
    else if (s === 'ingested') counts.ingested++;
    else if (s === 'escalated') counts.escalated++;

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

// ─── Help text ────────────────────────────────────────────────────────────

const SUBCOMMAND_HELP = {
  status: `Usage: learned-check status <path>

Show a dashboard of learned file statuses in the given directory.

Arguments:
  <path>    Path to a learned/ directory

Exit codes:
  0 = all ingested (or empty)
  1 = pending files (status: captured)
  2 = escalated files present`,

  pending: `Usage: learned-check pending <path>

List files with status: captured (pending ingestion).

Arguments:
  <path>    Path to a learned/ directory

Exit codes:
  0 = no pending files
  1 = has pending files`,

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
  console.log('  pending <path>              List pending (captured) files');
  console.log('  escalated <path>            List escalated files with reasons');
  console.log('  feed-forward <path> --step N  Files targeting step >= N');
  console.log('  validate <path>             Check frontmatter schema');
  console.log('  init <path>                 Create directory + .gitkeep placeholder');
  console.log('  mark-ingested <file>        Set status: ingested');
  console.log('  mark-escalated <file> <reason>  Set status: escalated');
  console.log('  reroute <file> <domain>     Update target-domain, reset to captured');
  console.log('  list                        All files across projects');
  console.log('  stats                       Aggregate counts across projects');
  console.log('');
  console.log(`${colors.yellow}Global flags:${colors.reset}`);
  console.log('  --json               Machine-readable JSON output');
  console.log('  --include-archived   Include archive branch (list, stats)');
  console.log('  -h, --help           Show help');
  console.log('');
  console.log(`${colors.yellow}Exit codes:${colors.reset}`);
  console.log('  0 = clear (all ingested or no files)');
  console.log('  1 = pending files (status: captured)');
  console.log('  2 = escalated files present');
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

function parseArgs(argv) {
  const flags = {
    json: false,
    includeArchived: false,
    help: false,
    step: null,
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
    } else if (arg.startsWith('-')) {
      writeError(`Unknown flag: ${arg}`);
      writeError('Run "learned-check --help" for usage.');
      process.exit(1);
    } else {
      positional.push(arg);
    }
    i++;
  }

  return { flags, positional };
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
      writeError(`Unknown flag: ${arg}`);
      writeError('Run "learned-check --help" for usage.');
      process.exit(1);
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

  const { flags, positional } = parseArgs(argv.slice(startIdx + 1));
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
    case 'reroute':      exitCode = cmdReroute(positional, flags); break;
    case 'list':         exitCode = cmdList(positional, flags); break;
    case 'stats':        exitCode = cmdStats(positional, flags); break;
    default:
      writeError(`Unknown subcommand: ${subcommand}`);
      writeError('Run "learned-check --help" for usage.');
      process.exit(1);
  }

  process.exit(exitCode);
}

main();
