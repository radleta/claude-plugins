#!/usr/bin/env node
// server.mjs — scratch-memory MCP stdio server
//
// Exposes narrow write-only tools for sub-agent reports and workflow artifacts.
// Project root is resolved from --project-root if passed (local-scope
// registrations bake it), otherwise from process.cwd() at spawn time
// (user-scope registrations omit it). User scope thus serves every project
// the user opens via one ~/.claude.json entry; local scope binds to the
// project that ran `register add`.
//
// Protocol: JSON-RPC 2.0 over stdio, newline-delimited messages (MCP stdio transport).
// Zero dependencies (stdlib only) — MCP protocol is tiny and stable enough to hand-roll.

import {
  mkdirSync,
  writeFileSync,
  appendFileSync,
  existsSync,
} from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { createInterface } from 'node:readline';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// --- Module-top constants (no PROJECT_ROOT dependency) ---
const ISSUES_SUBDIR = 'issues';
const PLACEHOLDER = '_Not captured._';
const MAX_BODY_BYTES = 1_048_576; // 1 MB defensive cap for write_session body

// Sentinel for JSON-RPC protocol errors (-32602). Caught separately from
// standard Error so the dispatcher emits a proper JSON-RPC error frame
// instead of an isError:true tool result.
class ProtocolError extends Error {
  constructor(code, namedString, message) {
    super(message);
    this.code = code;
    this.namedString = namedString;
  }
}

// Detects the malformed-tool-call-XML signature in string-typed args.
// Signature: </X> immediately followed (allowing whitespace/newlines) by <parameter name="Y"> with Y !== X.
// Returns void when clean; throws ProtocolError -32602 MALFORMED_TOOL_CALL_XML when any match found.
// Call this for any MCP tool with multiple string args — the lenient-parse promotion pattern applies to all of them.
// NOTE: future multi-arg tools should call this helper as their first validation step.
function validateNoMalformedToolCallXml(args, fieldNames, toolName) { // toolName reserved for future diagnostic context
  const re = /<\/([A-Za-z_][\w-]*)>\s*<parameter\s+name="([^"]+)"\s*>/;
  const findings = []; // [{ field, embeddedArg }]
  for (const field of fieldNames) {
    const value = args?.[field];
    if (typeof value !== 'string') continue;
    let remaining = value;
    let m;
    while ((m = re.exec(remaining)) !== null) {
      const closeTag = m[1];
      const openParam = m[2];
      if (closeTag !== openParam) {
        findings.push({ field, embeddedArg: openParam });
      }
      remaining = remaining.slice(m.index + m[0].length);
    }
  }
  if (findings.length === 0) return;
  const firstField = findings[0].field;
  const firstEmbedded = findings[0].embeddedArg;
  const lostArgs = [...new Set(findings.map(f => f.embeddedArg))].join(', ');
  throw new ProtocolError(
    -32602,
    'MALFORMED_TOOL_CALL_XML',
    `MALFORMED_TOOL_CALL_XML: arg "${firstField}" contains embedded <parameter name="${firstEmbedded}"> literal — re-emit with consistent <parameter> namespace; lost args: ${lostArgs}`,
  );
}

// --- Resolve project root: --project-root arg, else cwd at spawn time ---

const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--project-root');
const rootArg = rootIdx !== -1 ? argv[rootIdx + 1] : undefined;
if (rootIdx !== -1 && !rootArg) {
  process.stderr.write('ERROR: --project-root requires a path argument\n');
  process.exit(2);
}
const PROJECT_ROOT = resolve(rootArg ?? process.cwd());
const SCRATCH_ROOT = join(PROJECT_ROOT, 'scratch');
const STATE_DIR = join(SCRATCH_ROOT, '.scratch-memory');
const AUDIT_PATH = join(STATE_DIR, 'audit.jsonl');

if (!existsSync(PROJECT_ROOT)) {
  process.stderr.write(`ERROR: project_root does not exist: ${PROJECT_ROOT}\n`);
  process.exit(2);
}

mkdirSync(STATE_DIR, { recursive: true });

const GIT_OPTS = Object.freeze({
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf-8',
  timeout: 2000,
  cwd: PROJECT_ROOT,
});

// Used by writeIssue for the repo state snapshot in frontmatter.
function gitCall(args, fallback, op) {
  try {
    return execFileSync('git', args, GIT_OPTS).trim();
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

// --- Frontmatter injection helper ---
// Injects `started` and `ended` into the body's frontmatter when those fields are absent or
// empty-string. When the caller provides explicit values, they are preserved verbatim.
// Returns the (possibly modified) body string and the resolved {started, ended} values.
function injectSessionTimestamps(body, ts) {
  if (!body.startsWith('---\n')) {
    // No frontmatter — body is written as-is; timestamps returned for the JSON response only.
    return { body, started: ts, ended: ts };
  }
  const endIdx = body.indexOf('\n---\n', 4);
  if (endIdx === -1) {
    return { body, started: ts, ended: ts };
  }
  const blockStr = body.slice(4, endIdx);
  const lines = blockStr.split('\n');

  let startedVal = null;
  let endedVal = null;
  let startedLineIdx = -1;
  let endedLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const colon = lines[i].indexOf(':');
    if (colon === -1) continue;
    const key = lines[i].slice(0, colon).trim();
    const val = lines[i].slice(colon + 1).trim();
    if (key === 'started') { startedVal = val; startedLineIdx = i; }
    if (key === 'ended') { endedVal = val; endedLineIdx = i; }
  }

  const resolvedStarted = (startedVal && startedVal !== '') ? startedVal : ts;
  const resolvedEnded = (endedVal && endedVal !== '') ? endedVal : ts;

  // Only rebuild the block when injection is actually needed.
  if (resolvedStarted === startedVal && resolvedEnded === endedVal) {
    return { body, started: resolvedStarted, ended: resolvedEnded };
  }

  const newLines = [...lines];
  if (startedLineIdx !== -1) {
    newLines[startedLineIdx] = `started: ${resolvedStarted}`;
  } else {
    // Insert after session_id line if present, else prepend.
    const sidIdx = newLines.findIndex(l => l.startsWith('session_id:'));
    newLines.splice(sidIdx !== -1 ? sidIdx + 1 : 0, 0, `started: ${resolvedStarted}`);
    // Recalculate ended index after insert.
    if (endedLineIdx !== -1 && endedLineIdx >= sidIdx + 1) endedLineIdx++;
  }
  const adjustedEndedIdx = newLines.findIndex(l => l.startsWith('ended:'));
  if (adjustedEndedIdx !== -1) {
    newLines[adjustedEndedIdx] = `ended: ${resolvedEnded}`;
  } else {
    // Insert ended after started.
    const sIdx = newLines.findIndex(l => l.startsWith('started:'));
    newLines.splice(sIdx !== -1 ? sIdx + 1 : newLines.length, 0, `ended: ${resolvedEnded}`);
  }

  const newBlock = newLines.join('\n');
  const newBody = '---\n' + newBlock + body.slice(endIdx);
  return { body: newBody, started: resolvedStarted, ended: resolvedEnded };
}

// --- JSON-RPC helpers ---

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const respond = (id, result) => send({ jsonrpc: '2.0', id, result });
const errorResp = (id, code, message, data) =>
  send({ jsonrpc: '2.0', id, error: data ? { code, message, data } : { code, message } });

// --- Tool definitions ---

const STATUS_BY_ROLE = {
  coder: ['READY_FOR_REVIEW', 'FIXED', 'BLOCKED'],
  completeness: ['APPROVED', 'FINDINGS'],
  quality: ['APPROVED', 'FINDINGS'],
  security: ['APPROVED', 'FINDINGS'],
};

const REVIEW_ROLES = [
  'document-quality',
  'codebase-alignment',
  'domain',
  'creative',
  'decision-traceability',
  'combinatorial-completeness',
];

const STATUS_BY_REVIEW_ROLE = {
  'document-quality': ['APPROVED', 'ISSUES_FOUND'],
  'codebase-alignment': ['APPROVED', 'ISSUES_FOUND'],
  'domain': ['APPROVED', 'ISSUES_FOUND'],
  'decision-traceability': ['APPROVED', 'ISSUES_FOUND'],
  'combinatorial-completeness': ['APPROVED', 'ISSUES_FOUND'],
  'creative': ['SUGGESTIONS', 'NO_SUGGESTIONS'],
};

const REVIEW_PHASES = ['idea', 'spec'];

const TOOLS = [
  {
    name: 'write_report',
    description:
      'Append-only write of a structured sub-agent report to scratch/{project}/steps/step-{NN}/{role}-iter{N}-{ts}.md. Used by coder and verifier sub-agents in /implement-code workflows to record output without passing content through the main session. Server adds YAML frontmatter (including a queryable "status" field) and timestamp; refuses to overwrite existing files.',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description:
            'Scratch subdirectory name, e.g. "my-feature". Must match [a-zA-Z0-9._-]+.',
        },
        step: {
          type: 'integer',
          minimum: 0,
          description: 'Plan step number. Use 0 for ad-hoc (no plan).',
        },
        iter: {
          type: 'integer',
          minimum: 1,
          description: 'Iteration number within the step (1-based).',
        },
        role: {
          type: 'string',
          enum: ['coder', 'completeness', 'quality', 'security'],
          description: 'Sub-agent role producing this report.',
        },
        status: {
          type: 'string',
          enum: [
            'READY_FOR_REVIEW',
            'FIXED',
            'BLOCKED',
            'APPROVED',
            'FINDINGS',
          ],
          description:
            'Outcome of this report. For role=coder use READY_FOR_REVIEW | FIXED | BLOCKED. For role=completeness|quality|security use APPROVED | FINDINGS. Added to frontmatter so `rg "^status: FINDINGS"` finds verdicts needing fixes.',
        },
        body: {
          type: 'string',
          description:
            'Markdown body. Server prepends YAML frontmatter (role, step, iteration, timestamp, project, status).',
        },
      },
      required: ['project', 'step', 'iter', 'role', 'status', 'body'],
    },
  },
  {
    name: 'write_review',
    description:
      'Append-only write of a structured reviewer verdict to scratch/{project}/reviews/{phase}/{role}-iter{N}-{ts}.md. Used by /brainstorming reviewer sub-agents (idea and spec review loops) to persist verdicts without passing content through the main session. Server adds YAML frontmatter (including a queryable "status" field) and timestamp; refuses to overwrite existing files. Separate tool from write_report because brainstorming has different roles (document-quality, codebase-alignment, domain, creative, decision-traceability) and statuses (APPROVED | ISSUES_FOUND | SUGGESTIONS | NO_SUGGESTIONS) than the step-based /implement-code workflow. When used alongside a domain reviewer, include the ordered expert-skill list in the `skills` parameter so the verdict filename is disambiguated (e.g. `domain-frontend-iter1-<ts>.md`).',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description:
            'Scratch subdirectory name, e.g. "my-feature". Must match [a-zA-Z0-9._-]+.',
        },
        phase: {
          type: 'string',
          enum: ['idea', 'spec'],
          description:
            'Review phase: "idea" for idea.md review loop, "spec" for spec.md review loop.',
        },
        iter: {
          type: 'integer',
          minimum: 1,
          description: 'Iteration number within the review loop (1-based).',
        },
        role: {
          type: 'string',
          enum: [
            'document-quality',
            'codebase-alignment',
            'domain',
            'creative',
            'decision-traceability',
            'combinatorial-completeness',
          ],
          description:
            'Reviewer role producing this verdict. document-quality (idea-doc or spec-doc completeness); codebase-alignment (conflicts/duplicates); domain (expert-skill-specific review); creative (alternative approaches, advisory); decision-traceability (idea→spec coverage, spec-only); combinatorial-completeness (combinatorial state coverage and reachable-state closure checks).',
        },
        status: {
          type: 'string',
          enum: ['APPROVED', 'ISSUES_FOUND', 'SUGGESTIONS', 'NO_SUGGESTIONS'],
          description:
            'Outcome of this review. For role=creative use SUGGESTIONS | NO_SUGGESTIONS. For all other roles use APPROVED | ISSUES_FOUND. Added to frontmatter so `rg "^status: ISSUES_FOUND" scratch/` lists all verdicts needing fixes.',
        },
        skills: {
          type: 'array',
          items: { type: 'string', pattern: '^[a-zA-Z0-9._-]+$' },
          description:
            'Optional ordered list of expert-skill names this reviewer was dispatched with. Used by role=domain to disambiguate multiple parallel domain reviewers (e.g. frontend vs backend-net vs infra). When provided, the first skill name is appended to the filename as a suffix: `{role}-{skill1}-iter{N}-{ts}.md`. Ignored for non-domain roles (they already have unique role labels).',
        },
        body: {
          type: 'string',
          description:
            'Markdown body. Server prepends YAML frontmatter (role, phase, iteration, timestamp, project, status, skills?).',
        },
      },
      required: ['project', 'phase', 'iter', 'role', 'status', 'body'],
    },
  },
  {
    name: 'write_issue',
    description:
      'Append-only write of a structured issue, idea, or mixed capture to scratch/issues/{slug}.md. Use to file a new capture from any sub-agent or command that identifies a problem, improvement, or observation worth tracking. Server authors the slug, timestamps, git-state snapshot, and YAML frontmatter; refuses to overwrite existing files (collision appends a numeric suffix). Even when the caller has no git context, the server collects git state directly.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['issue', 'idea', 'mixed'],
          description:
            'Classification of the capture. "issue" = defect/problem; "idea" = improvement/feature; "mixed" = both.',
        },
        title: {
          type: 'string',
          minLength: 1,
          maxLength: 80,
          description: 'Short human-readable title for the capture (1–80 characters).',
        },
        slug_override: {
          type: 'string',
          pattern: '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$',
          description:
            'Optional caller-supplied slug. When omitted, the server derives one from title. Must match ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$.',
        },
        summary: {
          type: 'string',
          description: 'One or two sentence summary of the capture.',
        },
        intent: {
          type: 'string',
          description: 'What the caller intended or was doing when the capture was made.',
        },
        impact: {
          type: 'string',
          description: 'Who or what is affected; how significant.',
        },
        prior_thinking: {
          type: 'string',
          description: 'Any investigation, hypotheses, or prior context the caller has.',
        },
        related: {
          type: 'string',
          description: 'Related files, issues, PRs, or docs (free text).',
        },
        notes: {
          type: 'string',
          description: 'Additional freeform notes.',
        },
      },
      required: ['kind', 'title'],
    },
  },
  {
    name: 'write_session',
    description:
      'Write an immutable per-session handoff file to scratch/S-{session_id}/sessions/{ts}-{hex}.md. ' +
      'Caller passes session_id (workstream identifier) and body (full markdown content). ' +
      'Server creates the sessions/ directory, writes body atomically via wx-flag exclusive-create, ' +
      'and returns {path, session_id, started, ended} — all server-derived. ' +
      'Zero body-content validation by design. Returns JSON-in-text.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          minLength: 1,
          description:
            'Caller-chosen unique identifier for the workstream. Any non-empty string —\n' +
            'UUID or meaningful slug (e.g. "handoff-sid-fix"). Opaque to the server: not\n' +
            'parsed, not normalized, not validated as UUID. Must not contain path\n' +
            'separators (\'/\' or \'\\\\\'), \'..\', a leading \'.\', newline characters, or null\n' +
            'bytes (\\0). Determines the workstream folder name as \'S-{session_id}\'\n' +
            'directly.',
        },
        body: {
          type: 'string',
          minLength: 1,
          maxLength: 1048576,
          description:
            'Full per-session markdown content (frontmatter + body sections per the\n' +
            'per-session file schema documented in handoff-methodology/SKILL.md). MCP\n' +
            'does not validate body content shape — only size. Must be a non-empty UTF-8\n' +
            'string and must not exceed 1 MB (1,048,576 bytes; the MAX_BODY_BYTES\n' +
            'constant on the server). Larger bodies fail with JSON-RPC -32602\n' +
            'BODY_TOO_LARGE.',
        },
      },
      required: ['session_id', 'body'],
      additionalProperties: false,
    },
  },
];

// --- write_report implementation ---

function tsCompact(date) {
  // 2026-04-17T14:30:22.123Z -> 20260417T143022Z
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+/, '');
}

function tsCompactDashed(date) {
  // 2026-04-17T14:30:22.123Z -> 2026-04-17T14-30-22-123Z
  // Dashed ms-resolution format used by per-session file naming and commit-session validator.
  return date
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\./, '-');
}

function writeReport({ project, step, iter, role, status, body }) {
  if (typeof project !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(project)) {
    throw new Error(
      `Invalid project name: ${JSON.stringify(project)} (must match [a-zA-Z0-9._-]+)`
    );
  }
  if (!Number.isInteger(step) || step < 0) {
    throw new Error(`Invalid step: ${step} (must be integer >= 0)`);
  }
  if (!Number.isInteger(iter) || iter < 1) {
    throw new Error(`Invalid iter: ${iter} (must be integer >= 1)`);
  }
  const validRoles = Object.keys(STATUS_BY_ROLE);
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }
  const allowedStatuses = STATUS_BY_ROLE[role];
  if (!allowedStatuses.includes(status)) {
    throw new Error(
      `Invalid status for role=${role}: ${JSON.stringify(status)} (allowed: ${allowedStatuses.join(' | ')})`
    );
  }
  if (typeof body !== 'string') {
    throw new Error('body must be a string');
  }

  const now = new Date();
  const ts = tsCompact(now);
  const stepPad = String(step).padStart(2, '0');
  const filename = `${role}-iter${iter}-${ts}.md`;
  const stepDir = join(SCRATCH_ROOT, project, 'steps', `step-${stepPad}`);
  const filePath = resolve(join(stepDir, filename));

  // Hard boundary — refuse paths outside scratch root
  const scratchPrefix = SCRATCH_ROOT + sep;
  if (!filePath.startsWith(scratchPrefix)) {
    throw new Error(`Refused: path escapes scratch root: ${filePath}`);
  }

  mkdirSync(stepDir, { recursive: true });

  const frontmatter =
    [
      '---',
      `role: ${role}`,
      `status: ${status}`,
      `step: ${step}`,
      `iteration: ${iter}`,
      `timestamp: ${now.toISOString()}`,
      `project: ${project}`,
      '---',
      '',
    ].join('\n');

  // Append-only: 'wx' fails if file exists. Collision = caller bug.
  writeFileSync(filePath, frontmatter + body, {
    flag: 'wx',
    encoding: 'utf-8',
  });

  appendFileSync(
    AUDIT_PATH,
    JSON.stringify({
      ts: now.toISOString(),
      tool: 'write_report',
      project,
      step,
      iter,
      role,
      status,
      path: filePath,
    }) + '\n',
    'utf-8'
  );

  return filePath;
}

function writeReview({ project, phase, iter, role, status, skills, body }) {
  if (typeof project !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(project)) {
    throw new Error(
      `Invalid project name: ${JSON.stringify(project)} (must match [a-zA-Z0-9._-]+)`
    );
  }
  if (!REVIEW_PHASES.includes(phase)) {
    throw new Error(
      `Invalid phase: ${JSON.stringify(phase)} (allowed: ${REVIEW_PHASES.join(' | ')})`
    );
  }
  if (!Number.isInteger(iter) || iter < 1) {
    throw new Error(`Invalid iter: ${iter} (must be integer >= 1)`);
  }
  if (!REVIEW_ROLES.includes(role)) {
    throw new Error(
      `Invalid review role: ${role} (allowed: ${REVIEW_ROLES.join(' | ')})`
    );
  }
  const allowedStatuses = STATUS_BY_REVIEW_ROLE[role];
  if (!allowedStatuses.includes(status)) {
    throw new Error(
      `Invalid status for role=${role}: ${JSON.stringify(status)} (allowed: ${allowedStatuses.join(' | ')})`
    );
  }
  if (skills !== undefined) {
    if (!Array.isArray(skills)) {
      throw new Error('skills must be an array of strings');
    }
    for (const s of skills) {
      if (typeof s !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(s)) {
        throw new Error(
          `Invalid skill name: ${JSON.stringify(s)} (must match [a-zA-Z0-9._-]+)`
        );
      }
    }
  }
  if (typeof body !== 'string') {
    throw new Error('body must be a string');
  }

  const now = new Date();
  const ts = tsCompact(now);
  const suffix =
    role === 'domain' && skills && skills.length > 0 ? `-${skills[0]}` : '';
  const filename = `${role}${suffix}-iter${iter}-${ts}.md`;
  const phaseDir = join(SCRATCH_ROOT, project, 'reviews', phase);
  const filePath = resolve(join(phaseDir, filename));

  const scratchPrefix = SCRATCH_ROOT + sep;
  if (!filePath.startsWith(scratchPrefix)) {
    throw new Error(`Refused: path escapes scratch root: ${filePath}`);
  }

  mkdirSync(phaseDir, { recursive: true });

  const frontmatterLines = [
    '---',
    `role: ${role}`,
    `status: ${status}`,
    `phase: ${phase}`,
    `iteration: ${iter}`,
    `timestamp: ${now.toISOString()}`,
    `project: ${project}`,
  ];
  if (skills && skills.length > 0) {
    frontmatterLines.push(`skills: [${skills.join(', ')}]`);
  }
  frontmatterLines.push('---', '');
  const frontmatter = frontmatterLines.join('\n');

  writeFileSync(filePath, frontmatter + body, {
    flag: 'wx',
    encoding: 'utf-8',
  });

  appendFileSync(
    AUDIT_PATH,
    JSON.stringify({
      ts: now.toISOString(),
      tool: 'write_review',
      project,
      phase,
      iter,
      role,
      status,
      skills: skills || null,
      path: filePath,
    }) + '\n',
    'utf-8'
  );

  return filePath;
}

function deriveSlug(title) {
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

function writeIssue({ kind, title, slug_override, summary, intent, impact, prior_thinking, related, notes }) {
  // Validators (fail loudly — MCP returns error to caller):
  if (!['issue', 'idea', 'mixed'].includes(kind)) {
    throw new Error(`Invalid kind: ${JSON.stringify(kind)} (must be one of: issue, idea, mixed)`);
  }
  if (typeof title !== 'string' || title.length < 1 || title.length > 80) {
    throw new Error(`Invalid title: must be a non-empty string of length 1..80`);
  }
  const safeTitle = title.replace(/[\r\n]+/g, ' ').trim();
  if (safeTitle.length === 0) {
    throw new Error(`Invalid title: became empty after whitespace normalization`);
  }
  if (slug_override !== undefined) {
    if (typeof slug_override !== 'string' || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug_override)) {
      throw new Error(`Invalid slug_override: ${JSON.stringify(slug_override)} (must match ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$)`);
    }
  }
  for (const [name, val] of [['summary', summary], ['intent', intent], ['impact', impact], ['prior_thinking', prior_thinking], ['related', related], ['notes', notes]]) {
    if (val !== undefined && typeof val !== 'string') {
      throw new Error(`Invalid ${name}: must be a string`);
    }
  }

  const branch = gitCall(['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown', 'git_branch');
  const commit = gitCall(['rev-parse', '--short', 'HEAD'], 'unknown', 'git_commit');
  const commitSubject = gitCall(['log', '-1', '--format=%s'], '', 'git_commit_subject');
  const statusRaw = gitCall(['status', '--short'], 'unknown', 'git_status');
  const recentRaw = gitCall(['log', '-n', '3', '--oneline'], '', 'git_log');
  const toplevel = gitCall(['rev-parse', '--show-toplevel'], '', 'git_toplevel');

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
    : (PROJECT_ROOT.split(/[\\/]/).filter(Boolean).pop() || 'unknown');

  const recentCommits = recentRaw ? recentRaw.split('\n').filter(Boolean).slice(0, 3) : [];

  const slug = slug_override ?? deriveSlug(safeTitle);
  const issuesDir = join(SCRATCH_ROOT, ISSUES_SUBDIR);
  const basePath = resolve(join(issuesDir, `${slug}.md`));
  let finalPath = basePath;
  let suffix = 1;
  while (existsSync(finalPath)) {
    suffix++;
    finalPath = resolve(join(issuesDir, `${slug}-${suffix}.md`));
  }
  const finalSlug = suffix === 1 ? slug : `${slug}-${suffix}`;
  const collision_note = suffix === 1 ? null : `Prior capture exists at ${basePath}`;

  // Sandbox check on finalPath BEFORE any filesystem mutation.
  const scratchPrefix = SCRATCH_ROOT + sep;
  if (!finalPath.startsWith(scratchPrefix)) {
    throw new Error(`Refused: path escapes scratch root: ${finalPath}`);
  }

  mkdirSync(issuesDir, { recursive: true });

  const now = new Date();
  const escapedTitle = safeTitle.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const frontmatter = [
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
    '---',
    '',
  ].join('\n');

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
    `- **Working directory:** ${PROJECT_ROOT}`,
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

  writeFileSync(finalPath, frontmatter + body, { flag: 'wx', encoding: 'utf-8' });

  // Audit append — project is the LITERAL string "issues" (not caller-supplied; intentional deviation from write_report/write_review pattern per spec.md:85).
  appendFileSync(
    AUDIT_PATH,
    JSON.stringify({
      ts: now.toISOString(),
      tool: 'write_issue',
      status: 'captured',
      project: 'issues',
      slug: finalSlug,
      kind,
      title: safeTitle,
      path: finalPath,
    }) + '\n',
    'utf-8'
  );

  return { path: finalPath, kind, title: safeTitle, collision_note };
}

function writeSession({ session_id, body }) {
  // Validation throws — all four must occur before any filesystem mutation.
  if (typeof session_id !== 'string' || session_id.trim() === '') {
    throw new ProtocolError(-32602, 'SESSION_ID_REQUIRED',
      'SESSION_ID_REQUIRED: session_id is required and must be a non-empty string');
  }
  if (/[/\\]|\.\.|(^\.)|\0|\r|\n/.test(session_id)) {
    throw new ProtocolError(-32602, 'SESSION_ID_INVALID',
      'SESSION_ID_INVALID: session_id contains invalid characters (path separators, .., leading dot, newlines, or null bytes)');
  }
  // Additional sandbox-escape check: verify S-{session_id} path stays within SCRATCH_ROOT
  const candidatePath = join(SCRATCH_ROOT, 'S-' + session_id);
  const resolvedCandidate = resolve(candidatePath);
  const resolvedScratch = resolve(SCRATCH_ROOT);
  if (!resolvedCandidate.startsWith(resolvedScratch + sep)) {
    throw new ProtocolError(-32602, 'SESSION_ID_INVALID',
      'SESSION_ID_INVALID: session_id would resolve outside scratch root');
  }
  if (typeof body !== 'string' || body.length === 0) {
    throw new ProtocolError(-32602, 'BODY_REQUIRED',
      'BODY_REQUIRED: body is required and must be a non-empty string');
  }
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
    throw new ProtocolError(-32602, 'BODY_TOO_LARGE',
      'BODY_TOO_LARGE: body exceeds ' + MAX_BODY_BYTES + ' bytes');
  }

  // Derive workstream folder and sessions directory from caller-supplied session_id.
  const workstream_folder = join(SCRATCH_ROOT, 'S-' + session_id);
  const sessionsDir = join(workstream_folder, 'sessions');

  // Server-clock timestamp used for filename, injection, and JSON return.
  const nowIso = new Date().toISOString();

  // Inject started/ended into body frontmatter when absent or empty-string (D-1 contract).
  // Preserves caller-supplied values verbatim; single source of truth for both body and return.
  const { body: injectedBody, started, ended } = injectSessionTimestamps(body, nowIso);

  // Compute dashed timestamp (YYYY-MM-DDTHH-MM-SS-mmmZ).
  const ts = tsCompactDashed(new Date(nowIso));

  // Compute hex from process.pid via SHA-256 (deterministic per MCP server process).
  const hex = createHash('sha256').update(String(process.pid)).digest('hex').slice(0, 8);

  // Assemble filename and initial destPath.
  const filename = `${ts}-${hex}.md`;
  let destPath = join(sessionsDir, filename);

  // Belt-and-suspenders sandbox guard: session_id already validated above; this is
  // the final defense if path construction produces something unexpected (FS_FAILURE,
  // not -32602, because this path should never trigger in normal operation).
  const resolvedRoot = resolve(SCRATCH_ROOT);
  const resolved = resolve(destPath);
  if (!resolved.startsWith(resolvedRoot + sep)) {
    throw new Error('FS_FAILURE: path escapes scratch root: ' + destPath);
  }

  // Ensure sessions/ directory exists (idempotent — covers all four Workstream Collision Policy rows).
  mkdirSync(sessionsDir, { recursive: true });

  // Atomic write with collision-suffix retry (cap 100).
  let counter = 1;
  destPath = join(sessionsDir, `${ts}-${hex}.md`);
  while (counter <= 100) {
    try {
      // D22: ZERO body-content validation. write_session never inspects body shape.
      // Validation is the AGENT's job (synthesizability classification, see handoff-manager).
      // History: write_handoff (commit d25a085 → ad18ada, 2026-04-22→25) failed because
      // strict schema validation forced 2-10k token retries near context limit. Do NOT
      // reintroduce content checks here. Body integrity flows through agent's Opus
      // classification + bounded retry (D14, D25).
      writeFileSync(destPath, injectedBody, { flag: 'wx', encoding: 'utf8' });
      break;
    } catch (e) {
      if (e.code === 'EEXIST') {
        counter += 1;
        destPath = join(sessionsDir, `${ts}-${hex}-${counter}.md`);
        continue;
      }
      throw new Error('FS_FAILURE: ' + e.message);
    }
  }
  if (counter > 100) {
    throw new Error('FS_FAILURE: collision suffix exceeded 100 iterations');
  }

  // Audit log entry.
  appendFileSync(
    AUDIT_PATH,
    JSON.stringify({
      ts: new Date().toISOString(),
      tool: 'write_session',
      session_id,
      path: destPath,
      status: 'written',
    }) + '\n',
    'utf-8'
  );

  return { path: destPath, session_id, started, ended };
}

// --- Dispatch ---

function handleCall(name, args) {
  if (name === 'write_report') {
    const path = writeReport(args || {});
    return {
      content: [{ type: 'text', text: `Wrote: ${path}` }],
    };
  }
  if (name === 'write_review') {
    const path = writeReview(args || {});
    return {
      content: [{ type: 'text', text: `Wrote: ${path}` }],
    };
  }
  if (name === 'write_issue') {
    validateNoMalformedToolCallXml(
      args,
      ['summary', 'intent', 'impact', 'prior_thinking', 'related', 'notes'],
      'write_issue',
    );
    const result = writeIssue(args || {});
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          path: result.path,
          kind: result.kind,
          title: result.title,
          collision_note: result.collision_note,
        }),
      }],
    };
  }
  if (name === 'write_session') {
    const result = writeSession(args || {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  }
  throw new Error(`Tool not found: ${name}`);
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return; // ignore malformed input
  }

  const { id, method, params } = msg;

  try {
    switch (method) {
      case 'initialize':
        respond(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'scratch-memory', version: '0.1.0' },
        });
        break;
      case 'notifications/initialized':
        break; // no response for notifications
      case 'tools/list':
        respond(id, { tools: TOOLS });
        break;
      case 'tools/call': {
        const result = handleCall(params?.name, params?.arguments);
        respond(id, result);
        break;
      }
      case 'ping':
        respond(id, {});
        break;
      default:
        if (id !== undefined) {
          errorResp(id, -32601, `Method not found: ${method}`);
        }
    }
  } catch (e) {
    if (id !== undefined) {
      if (e instanceof ProtocolError) {
        errorResp(id, e.code, e.message, { error: e.namedString });
      } else {
        errorResp(id, -32000, e?.message || String(e));
      }
    }
  }
});

rl.on('close', () => process.exit(0));
