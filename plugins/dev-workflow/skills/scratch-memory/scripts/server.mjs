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
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
  unlinkSync,
  renameSync,
  readdirSync,
} from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { createInterface } from 'node:readline';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { rewritePointer } from './rewrite-pointer.mjs';
import {
  TASK_STATUS,
  MAX_BLOCKED_ON_LEN,
  ISSUE_ROLES,
  SPIKE_TYPES,
  ISSUE_SLUG_PATTERN,
} from './tasks.mjs';

// --- Module-top constants (no PROJECT_ROOT dependency) ---
const ISSUES_SUBDIR = 'issues';

// JSON-Schema pattern for a comma-separated slug list (`epic`, `blocked_by`):
// the slug_override pattern, comma-joined. It requires at least one element,
// so the "zero blockers" case is expressed by OMITTING the parameter rather
// than passing an empty string -- consistent with every other optional
// parameter here, all of which are emitted only when supplied. The schema is
// what conveys the format to the calling model, so it carries the pattern
// rather than leaving it to the description prose. Per-element validation
// server-side uses ISSUE_SLUG_PATTERN from tasks.mjs, so the two cannot
// disagree about the charset.
const SLUG_LIST_PATTERN = '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(,[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$';
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
  'craft',
  'step-quality',
  'investigation-quality',
  'spec-traceability',
];

const STATUS_BY_REVIEW_ROLE = {
  'document-quality': ['APPROVED', 'ISSUES_FOUND'],
  'codebase-alignment': ['APPROVED', 'ISSUES_FOUND'],
  'domain': ['APPROVED', 'ISSUES_FOUND'],
  'decision-traceability': ['APPROVED', 'ISSUES_FOUND'],
  'combinatorial-completeness': ['APPROVED', 'ISSUES_FOUND'],
  'creative': ['SUGGESTIONS', 'NO_SUGGESTIONS'],
  'craft': ['APPROVED', 'ISSUES_FOUND'],
  'step-quality': ['APPROVED', 'ISSUES_FOUND'],
  'investigation-quality': ['APPROVED', 'ISSUES_FOUND'],
  'spec-traceability': ['APPROVED', 'ISSUES_FOUND'],
};

const REVIEW_PHASES = ['idea', 'spec', 'draft', 'plan'];

const TOOLS = [
  {
    name: 'write_report',
    description:
      'Append-only write of a structured sub-agent report to scratch/{project}/steps/step-{NN}/{role}-iter{N}-{ts}.md. Used by verifier sub-agents in the /implement-code end-of-build wave and the standalone /verify-* commands to record output without passing content through the main session. Server adds YAML frontmatter (including a queryable "status" field) and timestamp; refuses to overwrite existing files.',
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
      'Append-only write of a structured reviewer verdict to scratch/{project}/reviews/{phase}/{role}-iter{N}-{ts}.md. Used by /brainstorming reviewer sub-agents (idea review pass), the blog-writer draft/craft review loop, and plan-phase reviewers to persist verdicts without passing content through the main session. Server adds YAML frontmatter (including a queryable "status" field) and timestamp; refuses to overwrite existing files. Separate tool from write_report because brainstorming has different roles (document-quality, codebase-alignment, domain, creative, decision-traceability) and statuses (APPROVED | ISSUES_FOUND | SUGGESTIONS | NO_SUGGESTIONS) than the step-based /implement-code workflow. When used alongside a domain reviewer, include the ordered expert-skill list in the `skills` parameter so the verdict filename is disambiguated (e.g. `domain-frontend-iter1-<ts>.md`). The server cross-validates status against the body: APPROVED with a non-empty blocking findings section (or, for role=domain, an Aggregate that does not say Approved) is rejected, as is ISSUES_FOUND with no findings section — align the body and status before calling.',
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
          enum: ['idea', 'spec', 'draft', 'plan'],
          description:
            'Review phase: "idea" for idea.md review loop, "spec" for spec.md review loop, "draft" for the blog-writer craft-review loop on a prose draft, "plan" for a plan-validation review.',
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
            'craft',
            'step-quality',
            'investigation-quality',
            'spec-traceability',
          ],
          description:
            'Reviewer role producing this verdict. document-quality (idea-doc or spec-doc completeness); codebase-alignment (conflicts/duplicates); domain (expert-skill-specific review); creative (alternative approaches, advisory); decision-traceability (idea→spec coverage, spec-only); combinatorial-completeness (combinatorial state coverage and reachable-state closure checks); craft (writing-expert craft review of a prose draft, used with phase=draft); step-quality (plan-step granularity and decision-constraining review, used with phase=plan); investigation-quality (research evidence and citation-reality review, used with phase=plan); spec-traceability (spec→plan coverage and orphan-step review, used with phase=plan).',
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
        role: {
          type: 'string',
          enum: ISSUE_ROLES,
          description:
            'Optional discovery-stage role. "epic" = a bounded destination whose body carries Destination/Decisions/Not Yet Specified/Out of Scope; "spike" = a decision ticket belonging to one or more epics. Omit for an ordinary capture. A spike must also supply epic.',
        },
        epic: {
          type: 'string',
          pattern: SLUG_LIST_PATTERN,
          description:
            'Optional. Slug(s) of the epic(s) this capture belongs to, comma-separated with no spaces (e.g. "auth-rework" or "auth-rework,billing-cleanup"). Required when role is "spike".',
        },
        spike_type: {
          type: 'string',
          enum: SPIKE_TYPES,
          description:
            'Optional. How this spike resolves: "interview" via discuss-methodology, "research" via the researcher agent, "task" as-is, "prototype" by producing an artifact its Resolution names. Requires role: "spike".',
        },
        blocked_by: {
          type: 'string',
          pattern: SLUG_LIST_PATTERN,
          description:
            'Optional. Slug(s) of the spikes that must resolve before this one, comma-separated with no spaces. Omit entirely when nothing blocks it — there is no empty-string form. Requires role: "spike".',
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
            'Caller-chosen unique identifier for the workstream. Not normalized or\n' +
            'validated as a UUID, but must match the charset ^[A-Za-z0-9._-]+$ — only\n' +
            'letters, digits, dots, underscores, or hyphens (e.g. "handoff-sid-fix").\n' +
            'Path separators, \'..\', a leading \'.\', newlines, null bytes, and shell\n' +
            'metacharacters are all rejected by this charset gate. Determines the\n' +
            'workstream folder name as \'S-{session_id}\' directly.',
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
  {
    name: 'write_task',
    description:
      'Append-only write of a new workstream task to scratch/S-{session_id}/tasks/{id}-{slug}.md. ' +
      'Server mints the id (t-XXXXXX), stamps created and updated, creates tasks/ idempotently, and ' +
      'refuses to overwrite an existing task. Mutations after creation (status changes, blocked_on ' +
      'updates, etc.) are hand Edits to the file directly — there is no update_task tool; that is ' +
      'deliberately deferred. Returns {path, id, title, status} — all server-derived. Caller class: ' +
      'main-session-invoked, ad hoc — the main session calls this directly when a work item surfaces ' +
      'in conversation. It is not gated behind a command, it is not for sub-agents, and neither ' +
      '/handoff nor /pickup ever creates tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          pattern: '^[A-Za-z0-9._-]+$',
          description:
            'Workstream identifier (the task file is written under scratch/S-{session_id}/tasks/). ' +
            'Only letters, digits, dots, underscores, or hyphens.',
        },
        title: {
          type: 'string',
          minLength: 1,
          maxLength: 80,
          description: 'Short human-readable title for the task (1–80 characters).',
        },
        body: {
          type: 'string',
          maxLength: MAX_BODY_BYTES,
          description:
            'Optional freeform markdown body for the task. Must not exceed 1 MB ' +
            '(1,048,576 bytes; the MAX_BODY_BYTES constant on the server) of UTF-8 bytes. ' +
            'Larger bodies fail with JSON-RPC -32602 BODY_TOO_LARGE.',
        },
        status: {
          type: 'string',
          enum: TASK_STATUS,
          default: 'open',
          description:
            "Task status: one of open, blocked, done, dropped, promoted. Defaults to 'open' when omitted.",
        },
        blocked_on: {
          type: 'string',
          minLength: 1,
          maxLength: MAX_BLOCKED_ON_LEN,
          description:
            'Free text describing what this task is blocked on (1–120 characters). Rendered inline ' +
            'in a one-line task row (e.g. "(blocked on: <blocked_on>, updated 3d ago)"), so the ' +
            'length is bounded to keep that row one line.',
        },
      },
      required: ['session_id', 'title'],
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
    throw new ProtocolError(-32602, 'PROJECT_INVALID',
      `PROJECT_INVALID: Invalid project name: ${JSON.stringify(project)} (must match [a-zA-Z0-9._-]+)`);
  }
  if (!Number.isInteger(step) || step < 0) {
    throw new ProtocolError(-32602, 'STEP_INVALID',
      `STEP_INVALID: Invalid step: ${step} (must be integer >= 0)`);
  }
  if (!Number.isInteger(iter) || iter < 1) {
    throw new ProtocolError(-32602, 'ITER_INVALID',
      `ITER_INVALID: Invalid iter: ${iter} (must be integer >= 1)`);
  }
  const validRoles = Object.keys(STATUS_BY_ROLE);
  if (!validRoles.includes(role)) {
    throw new ProtocolError(-32602, 'ROLE_INVALID', `ROLE_INVALID: Invalid role: ${role}`);
  }
  const allowedStatuses = STATUS_BY_ROLE[role];
  if (!allowedStatuses.includes(status)) {
    throw new ProtocolError(-32602, 'STATUS_INVALID',
      `STATUS_INVALID: Invalid status for role=${role}: ${JSON.stringify(status)} (allowed: ${allowedStatuses.join(' | ')})`);
  }
  if (typeof body !== 'string') {
    throw new ProtocolError(-32602, 'BODY_INVALID', 'BODY_INVALID: body must be a string');
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
    throw new ProtocolError(-32000, 'FS_FAILURE',
      `FS_FAILURE: Refused: path escapes scratch root: ${filePath}`);
  }

  try {
    mkdirSync(stepDir, { recursive: true });
  } catch (err) {
    throw new ProtocolError(-32000, 'FS_FAILURE', 'FS_FAILURE: ' + err.message);
  }

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
  try {
    writeFileSync(filePath, frontmatter + body, {
      flag: 'wx',
      encoding: 'utf-8',
    });
  } catch (err) {
    throw new ProtocolError(-32000, 'FS_FAILURE', 'FS_FAILURE: ' + err.message);
  }

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

// Status/body cross-validation for write_review: a reviewer that claims
// APPROVED while its body carries findings (or vice versa) is rejected at the
// write boundary, so main-session routing can trust the status field.
function reviewSectionHasContent(body, heading) {
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === heading) {
      for (let j = i + 1; j < lines.length; j++) {
        const t = lines[j].trim();
        if (t.startsWith('## ')) break;
        if (t !== '') return true;
      }
    }
  }
  return false;
}

const REVIEW_BLOCKING_SECTIONS = Object.freeze([
  '## Issues',
  '## Traceability Gaps',
  '## Orphaned Spec Decisions',
  '## Skill Coverage Delta',
  '## Scope / Constraint / Success Criteria Delta',
  '## Failure Modes Delta',
  '## Deferred Notes Delta',
]);

function validateReviewStatusBodyConsistency(role, status, body) {
  if (role === 'creative') return; // advisory statuses; no blocking sections
  if (role === 'domain') {
    // Domain verdicts signal via the mandatory ## Aggregate section.
    let aggStatus = null;
    const aggIdx = body.search(/^##\s+Aggregate\b.*$/m);
    if (aggIdx !== -1) {
      const rest = body.slice(aggIdx);
      const nextH2 = rest.slice(2).search(/^##\s/m);
      const section = nextH2 === -1 ? rest : rest.slice(0, nextH2 + 2);
      const m = section.match(/\*\*Status:\*\*\s*(Approved|Issues Found)/i);
      if (m) aggStatus = m[1].toLowerCase();
    }
    if (status === 'APPROVED' && aggStatus !== 'approved') {
      throw new ProtocolError(-32602, 'STATUS_BODY_MISMATCH',
        'STATUS_BODY_MISMATCH: Status/body mismatch: status=APPROVED requires a `## Aggregate` section with `**Status:** Approved` (a missing or malformed Aggregate must be written as ISSUES_FOUND per the fail-safe).');
    }
    if (status === 'ISSUES_FOUND' && aggStatus === 'approved') {
      throw new ProtocolError(-32602, 'STATUS_BODY_MISMATCH',
        'STATUS_BODY_MISMATCH: Status/body mismatch: status=ISSUES_FOUND but `## Aggregate` says `**Status:** Approved`. Align the Aggregate section and the status parameter.');
    }
    return;
  }
  const nonEmpty = REVIEW_BLOCKING_SECTIONS.filter((h) =>
    reviewSectionHasContent(body, h)
  );
  if (status === 'APPROVED' && nonEmpty.length > 0) {
    throw new ProtocolError(-32602, 'STATUS_BODY_MISMATCH',
      `STATUS_BODY_MISMATCH: Status/body mismatch: status=APPROVED but body contains non-empty blocking section(s): ${nonEmpty.join(', ')}. Remove the findings or set status=ISSUES_FOUND.`);
  }
  if (status === 'ISSUES_FOUND' && nonEmpty.length === 0) {
    throw new ProtocolError(-32602, 'STATUS_BODY_MISMATCH',
      `STATUS_BODY_MISMATCH: Status/body mismatch: status=ISSUES_FOUND but body contains no non-empty blocking section (expected at least one of: ${REVIEW_BLOCKING_SECTIONS.join(', ')}).`);
  }
}

function writeReview({ project, phase, iter, role, status, skills, body }) {
  if (typeof project !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(project)) {
    throw new ProtocolError(-32602, 'PROJECT_INVALID',
      `PROJECT_INVALID: Invalid project name: ${JSON.stringify(project)} (must match [a-zA-Z0-9._-]+)`);
  }
  if (!REVIEW_PHASES.includes(phase)) {
    throw new ProtocolError(-32602, 'PHASE_INVALID',
      `PHASE_INVALID: Invalid phase: ${JSON.stringify(phase)} (allowed: ${REVIEW_PHASES.join(' | ')})`);
  }
  if (!Number.isInteger(iter) || iter < 1) {
    throw new ProtocolError(-32602, 'ITER_INVALID',
      `ITER_INVALID: Invalid iter: ${iter} (must be integer >= 1)`);
  }
  if (!REVIEW_ROLES.includes(role)) {
    throw new ProtocolError(-32602, 'ROLE_INVALID',
      `ROLE_INVALID: Invalid review role: ${role} (allowed: ${REVIEW_ROLES.join(' | ')})`);
  }
  const allowedStatuses = STATUS_BY_REVIEW_ROLE[role];
  if (!allowedStatuses) {
    throw new ProtocolError(-32602, 'ROLE_INVALID',
      `ROLE_INVALID: Unknown review role has no STATUS_BY_REVIEW_ROLE entry: ${role}`);
  }
  if (!allowedStatuses.includes(status)) {
    throw new ProtocolError(-32602, 'STATUS_INVALID',
      `STATUS_INVALID: Invalid status for role=${role}: ${JSON.stringify(status)} (allowed: ${allowedStatuses.join(' | ')})`);
  }
  if (skills !== undefined) {
    if (!Array.isArray(skills)) {
      throw new ProtocolError(-32602, 'SKILLS_INVALID',
        'SKILLS_INVALID: skills must be an array of strings');
    }
    for (const s of skills) {
      if (typeof s !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(s)) {
        throw new ProtocolError(-32602, 'SKILLS_INVALID',
          `SKILLS_INVALID: Invalid skill name: ${JSON.stringify(s)} (must match [a-zA-Z0-9._-]+)`);
      }
    }
  }
  if (typeof body !== 'string') {
    throw new ProtocolError(-32602, 'BODY_INVALID', 'BODY_INVALID: body must be a string');
  }

  validateReviewStatusBodyConsistency(role, status, body);

  const now = new Date();
  const ts = tsCompact(now);
  const suffix =
    role === 'domain' && skills && skills.length > 0 ? `-${skills[0]}` : '';
  const filename = `${role}${suffix}-iter${iter}-${ts}.md`;
  const phaseDir = join(SCRATCH_ROOT, project, 'reviews', phase);
  const filePath = resolve(join(phaseDir, filename));

  const scratchPrefix = SCRATCH_ROOT + sep;
  if (!filePath.startsWith(scratchPrefix)) {
    throw new ProtocolError(-32000, 'FS_FAILURE',
      `FS_FAILURE: Refused: path escapes scratch root: ${filePath}`);
  }

  try {
    mkdirSync(phaseDir, { recursive: true });
  } catch (err) {
    throw new ProtocolError(-32000, 'FS_FAILURE', 'FS_FAILURE: ' + err.message);
  }

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

  try {
    writeFileSync(filePath, frontmatter + body, {
      flag: 'wx',
      encoding: 'utf-8',
    });
  } catch (err) {
    throw new ProtocolError(-32000, 'FS_FAILURE', 'FS_FAILURE: ' + err.message);
  }

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

// Validate one comma-separated slug list (`epic`, `blocked_by`). Every
// element is checked against ISSUE_SLUG_PATTERN — imported from tasks.mjs, so
// the writer and the corpus lint cannot disagree about the charset. An empty
// string yields one empty element and is rejected: omitting the parameter is
// how "none" is expressed.
function validateSlugList(name, value) {
  if (typeof value !== 'string') {
    throw new ProtocolError(-32602, `${name.toUpperCase()}_INVALID`,
      `${name.toUpperCase()}_INVALID: Invalid ${name}: must be a string`);
  }
  const elements = value.split(',');
  if (!elements.every((element) => ISSUE_SLUG_PATTERN.test(element))) {
    throw new ProtocolError(-32602, `${name.toUpperCase()}_INVALID`,
      `${name.toUpperCase()}_INVALID: Invalid ${name}: ${JSON.stringify(value)} (must be one or more slugs matching ${ISSUE_SLUG_PATTERN.source}, comma-separated with no spaces)`);
  }
}

function writeIssue({ kind, title, slug_override, summary, intent, impact, prior_thinking, related, notes,
  role, epic, spike_type, blocked_by }) {
  // Validators (fail loudly — MCP returns error to caller):
  if (!['issue', 'idea', 'mixed'].includes(kind)) {
    throw new ProtocolError(-32602, 'KIND_INVALID',
      `KIND_INVALID: Invalid kind: ${JSON.stringify(kind)} (must be one of: issue, idea, mixed)`);
  }
  if (typeof title !== 'string' || title.length < 1 || title.length > 80) {
    throw new ProtocolError(-32602, 'TITLE_INVALID',
      'TITLE_INVALID: Invalid title: must be a non-empty string of length 1..80');
  }
  const safeTitle = title.replace(/[\r\n]+/g, ' ').trim();
  if (safeTitle.length === 0) {
    throw new ProtocolError(-32602, 'TITLE_INVALID',
      'TITLE_INVALID: Invalid title: became empty after whitespace normalization');
  }
  if (slug_override !== undefined) {
    if (typeof slug_override !== 'string' || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug_override)) {
      throw new ProtocolError(-32602, 'SLUG_OVERRIDE_INVALID',
        `SLUG_OVERRIDE_INVALID: Invalid slug_override: ${JSON.stringify(slug_override)} (must match ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$)`);
    }
  }
  for (const [name, val] of [['summary', summary], ['intent', intent], ['impact', impact], ['prior_thinking', prior_thinking], ['related', related], ['notes', notes]]) {
    if (val !== undefined && typeof val !== 'string') {
      throw new ProtocolError(-32602, 'FIELD_INVALID',
        `FIELD_INVALID: Invalid ${name}: must be a string`);
    }
  }

  // Epic/spike keys (D14). Shape first, then exactly two cross-field rules.
  // The server enforces only what is checkable WITHIN one call: anything
  // needing a sibling file (the graph rules E1, E2, E3 and the decision-record
  // rule E5) stays lint-only, because the server cannot see the corpus.
  if (role !== undefined && !ISSUE_ROLES.includes(role)) {
    throw new ProtocolError(-32602, 'ROLE_INVALID',
      `ROLE_INVALID: Invalid role: ${JSON.stringify(role)} (must be one of: ${ISSUE_ROLES.join(', ')})`);
  }
  if (spike_type !== undefined && !SPIKE_TYPES.includes(spike_type)) {
    throw new ProtocolError(-32602, 'SPIKE_TYPE_INVALID',
      `SPIKE_TYPE_INVALID: Invalid spike_type: ${JSON.stringify(spike_type)} (must be one of: ${SPIKE_TYPES.join(', ')})`);
  }
  if (epic !== undefined) validateSlugList('epic', epic);
  if (blocked_by !== undefined) validateSlugList('blocked_by', blocked_by);

  // Mirrors lint rule E7: a spike names the epic it belongs to.
  if (role === 'spike' && epic === undefined) {
    throw new ProtocolError(-32602, 'EPIC_REQUIRED',
      'EPIC_REQUIRED: role "spike" requires epic: the slug(s) of the epic(s) this spike belongs to');
  }
  // Mirrors lint rule E10, which covers spike_type and blocked_by but
  // deliberately NOT epic -- an ordinary capture may carry epic alone, since
  // whether a capture can be promoted into a spike in place is an open
  // question the design declines to foreclose. Requiring spike_type here as
  // well (lint rule E8) was considered and rejected as over-strict for a
  // two-rule mirror; E8 catches a spike missing it on the first edit.
  if ((spike_type !== undefined || blocked_by !== undefined) && role !== 'spike') {
    throw new ProtocolError(-32602, 'ROLE_SPIKE_REQUIRED',
      'ROLE_SPIKE_REQUIRED: spike_type and blocked_by require role: "spike"');
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
    throw new ProtocolError(-32000, 'FS_FAILURE',
      `FS_FAILURE: Refused: path escapes scratch root: ${finalPath}`);
  }

  try {
    mkdirSync(issuesDir, { recursive: true });
  } catch (err) {
    throw new ProtocolError(-32000, 'FS_FAILURE', 'FS_FAILURE: ' + err.message);
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

  try {
    writeFileSync(finalPath, frontmatter + body, { flag: 'wx', encoding: 'utf-8' });
  } catch (err) {
    throw new ProtocolError(-32000, 'FS_FAILURE', 'FS_FAILURE: ' + err.message);
  }

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

// writeTask({ session_id, title, body?, status?, blocked_on? }) -> { path, id, title, status }
//
// The plan's only writer for scratch/S-{session_id}/tasks/ (D4). Mirrors
// write_issue's conventions selectively: reuses deriveSlug()/MAX_BODY_BYTES/
// the malformed-XML guard (in the dispatch branch)/the sandbox-prefix check/
// the literal-project audit line, but skips git-state gathering entirely
// (the task schema has no repo/branch/commit/working_tree fields), handles
// id collision by re-minting rather than by a numeric filename suffix (a
// suffix would break the id-matches-filename-prefix lint rule, T8), and
// publishes via tmp+rename rather than a direct wx write, because the
// readers of tasks/ (tasks list/lint, --with-tasks, the PostToolUse hook)
// are separate OS processes that can be reading while a write is in flight.
function writeTask({ session_id, title, body, status, blocked_on }) {
  // All validation throws before any filesystem mutation. Order: session_id
  // -> title -> body -> status -> blocked_on -> filesystem (Step 03b pins
  // this order for the two-invalid-fields case).
  if (typeof session_id !== 'string' || session_id.trim() === '') {
    throw new ProtocolError(-32602, 'SESSION_ID_REQUIRED',
      'SESSION_ID_REQUIRED: session_id is required and must be a non-empty string');
  }
  if (/[/\\]|\.\.|(^\.)|\0|\r|\n/.test(session_id)) {
    throw new ProtocolError(-32602, 'SESSION_ID_INVALID',
      'SESSION_ID_INVALID: session_id contains invalid characters (path separators, .., leading dot, newlines, or null bytes)');
  }
  // Positive charset gate mirrors writeSession's (server.mjs's own
  // SESSION_ID_INVALID gate above it) -- proves the server self-safe
  // regardless of caller, since session_id flows into path construction below.
  if (!/^[A-Za-z0-9._-]+$/.test(session_id)) {
    throw new ProtocolError(-32602, 'SESSION_ID_INVALID',
      'SESSION_ID_INVALID: session_id must contain only letters, digits, dots, underscores, or hyphens');
  }
  const workstreamFolder = join(SCRATCH_ROOT, 'S-' + session_id);
  const resolvedWorkstream = resolve(workstreamFolder);
  const resolvedScratch = resolve(SCRATCH_ROOT);
  if (!resolvedWorkstream.startsWith(resolvedScratch + sep)) {
    throw new ProtocolError(-32602, 'SESSION_ID_INVALID',
      'SESSION_ID_INVALID: session_id would resolve outside scratch root');
  }

  if (typeof title !== 'string') {
    throw new ProtocolError(-32602, 'TITLE_REQUIRED',
      'TITLE_REQUIRED: title is required and must be a string');
  }
  if (title.length < 1 || title.length > 80) {
    throw new ProtocolError(-32602, 'TITLE_INVALID',
      'TITLE_INVALID: title must be a string of length 1..80');
  }
  const safeTitle = title.replace(/[\r\n]+/g, ' ').trim();
  if (safeTitle.length === 0) {
    throw new ProtocolError(-32602, 'TITLE_INVALID',
      'TITLE_INVALID: title became empty after whitespace normalization');
  }

  if (body !== undefined) {
    if (typeof body !== 'string') {
      throw new ProtocolError(-32602, 'BODY_INVALID', 'BODY_INVALID: body must be a string');
    }
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      throw new ProtocolError(-32602, 'BODY_TOO_LARGE',
        'BODY_TOO_LARGE: body exceeds ' + MAX_BODY_BYTES + ' bytes');
    }
  }

  let resolvedStatus = 'open';
  if (status !== undefined) {
    if (typeof status !== 'string' || !TASK_STATUS.includes(status)) {
      throw new ProtocolError(-32602, 'STATUS_INVALID',
        `STATUS_INVALID: status must be one of: ${TASK_STATUS.join(', ')}`);
    }
    resolvedStatus = status;
  }

  // Validated AFTER CR/LF normalization, not before: a value only over-length
  // because of embedded newlines should pass, since the newlines never
  // survive into the rendered one-line brief row either way.
  let safeBlockedOn;
  if (blocked_on !== undefined) {
    if (typeof blocked_on !== 'string') {
      throw new ProtocolError(-32602, 'BLOCKED_ON_INVALID', 'BLOCKED_ON_INVALID: blocked_on must be a string');
    }
    safeBlockedOn = blocked_on.replace(/[\r\n]+/g, ' ').trim();
    if (safeBlockedOn.length < 1 || safeBlockedOn.length > MAX_BLOCKED_ON_LEN) {
      throw new ProtocolError(-32602, 'BLOCKED_ON_INVALID',
        `BLOCKED_ON_INVALID: blocked_on must be 1..${MAX_BLOCKED_ON_LEN} characters after whitespace normalization`);
    }
  }

  // --- Filesystem ---
  const tasksDir = join(workstreamFolder, 'tasks');
  const slug = deriveSlug(safeTitle);

  // Sandbox check on tasksDir BEFORE any filesystem mutation -- mkdirSync
  // below is this function's first mutation, so this mirrors writeIssue's
  // finalPath-then-mkdirSync ordering (:836-842). workstreamFolder was
  // already proven inside SCRATCH_ROOT above (the session_id resolve
  // check), so this is a second, defense-in-depth confirmation rather than
  // the only line of defense.
  const scratchPrefix = SCRATCH_ROOT + sep;
  if (!resolve(tasksDir).startsWith(scratchPrefix)) {
    throw new ProtocolError(-32000, 'FS_FAILURE',
      `Refused: path escapes scratch root: ${tasksDir}`);
  }

  // Collision is checked against existing ids, not existing filenames: two
  // tasks with different titles produce different filenames even when their
  // ids collide, so an existsSync(finalPath) test alone would miss it and
  // emit a file that violates the T8 lint rule the moment a second file
  // claims the same prefix. Tolerates a not-yet-created tasks/ directory
  // (ENOENT) as an empty listing -- it is valid to create a task for a
  // workstream that has no sessions/ (or tasks/) yet.
  let existingIds;
  try {
    existingIds = new Set(
      readdirSync(tasksDir)
        .filter((name) => name.startsWith('t-') && name.endsWith('.md'))
        .map((name) => name.slice(0, 8))
    );
  } catch (err) {
    if (err.code === 'ENOENT') {
      existingIds = new Set();
    } else {
      throw new ProtocolError(-32000, 'FS_FAILURE', 'FS_FAILURE: ' + err.message);
    }
  }

  mkdirSync(tasksDir, { recursive: true });

  const now = new Date();
  const nowIso = now.toISOString();
  const escapedTitle = safeTitle.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const escapedBlockedOn = safeBlockedOn !== undefined
    ? safeBlockedOn.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    : undefined;

  // Mint + publish loop, one 100-attempt bound covering both cases: a
  // directory-scan collision (checked against existingIds above) and the
  // belt-and-braces existsSync recheck immediately before the rename below.
  // renameSync overwrites its destination silently, so the never-clobber
  // guarantee an old wx-on-final write would have given has to come from the
  // id re-mint check plus this recheck instead. Atomic *visibility* (a
  // concurrent reader sees either no file or the complete file, never a
  // partial write) was chosen over wx-on-final *exclusivity* because the
  // concurrency that actually exists here is many readers (tasks list/lint,
  // --with-tasks, the PostToolUse hook) and exactly one writer -- this
  // process handles JSON-RPC frames sequentially, so a collision surviving
  // both checks is unreachable in practice; the bound exists so a bug here
  // can never hang the server.
  let id, finalPath;
  let attempts = 0;
  while (true) {
    attempts++;
    if (attempts > 100) {
      throw new ProtocolError(-32000, 'FS_FAILURE',
        'FS_FAILURE: could not mint a unique task id after 100 attempts');
    }

    const candidateId = 't-' + randomBytes(3).toString('hex');
    if (existingIds.has(candidateId)) continue;

    const candidateFinalPath = resolve(join(tasksDir, `${candidateId}-${slug}.md`));
    // Sandbox-prefix check on the fully-constructed candidate path, before
    // this candidate's tmp-file write below. tasksDir itself was already
    // sandbox-checked above (before mkdirSync, this function's first
    // mutation) -- this is defense-in-depth confirming the minted id and
    // derived slug (which deriveSlug guarantees is free of '/', '\', '..')
    // didn't somehow escape it too.
    if (!candidateFinalPath.startsWith(scratchPrefix)) {
      throw new ProtocolError(-32000, 'FS_FAILURE',
        `Refused: path escapes scratch root: ${candidateFinalPath}`);
    }

    // Frontmatter: exactly the task schema keys, in order -- id, title,
    // status, created, updated, and blocked_on only when provided. No
    // tool: key (the task schema has none) and no promoted_to: key (set by
    // hand at promotion time, D5, never by the writer).
    const frontmatterLines = [
      '---',
      `id: ${candidateId}`,
      `title: "${escapedTitle}"`,
      `status: ${resolvedStatus}`,
      `created: ${nowIso}`,
      `updated: ${nowIso}`,
    ];
    if (escapedBlockedOn !== undefined) {
      frontmatterLines.push(`blocked_on: "${escapedBlockedOn}"`);
    }
    frontmatterLines.push('---', '');
    // Frontmatter only when body is omitted -- no placeholder sections; the
    // task body is freeform per spec, unlike write_issue's fixed skeleton.
    // frontmatterLines.join('\n') already ends in a single '\n' (its last
    // element is ''), so the frontmatter-only case is correct as-is. When
    // body IS supplied, normalize its trailing newlines to exactly one --
    // otherwise a caller-supplied body with no trailing '\n' (the common
    // case) would leave the file with none at all, violating the "ending in
    // a single trailing newline" contract this step's Actions list states.
    const content = frontmatterLines.join('\n') + (body ? body.replace(/\n*$/, '\n') : '');

    // Publish via tmp + rename, same directory (renameSync is only atomic
    // within one filesystem). The tmp name is dot-prefixed AND does not
    // start with 't-', so it fails every reader's `t-*.md` filter twice
    // over -- structurally invisible to scanners by construction, not
    // merely absent by timing (test-tasks.mjs's scanner-filter coverage is
    // the assertion that keeps this true).
    const candidateTmpPath = join(tasksDir, `.${candidateId}-${slug}.md.tmp`);
    try {
      writeFileSync(candidateTmpPath, content, { flag: 'wx', encoding: 'utf-8' });
    } catch (err) {
      throw new ProtocolError(-32000, 'FS_FAILURE', 'FS_FAILURE: ' + err.message);
    }

    if (existsSync(candidateFinalPath)) {
      try { unlinkSync(candidateTmpPath); } catch {}
      existingIds.add(candidateId);
      continue;
    }

    try {
      renameSync(candidateTmpPath, candidateFinalPath);
    } catch (err) {
      try { unlinkSync(candidateTmpPath); } catch {}
      throw new ProtocolError(-32000, 'FS_FAILURE', 'FS_FAILURE: ' + err.message);
    }

    id = candidateId;
    finalPath = candidateFinalPath;
    break;
  }

  // Audit append AFTER the rename succeeds, so an audited task is always a
  // published task. project is the LITERAL string "tasks" -- never
  // caller-supplied -- matching write_issue's documented deviation at :846
  // (no fsync here either; the audit log is advisory, not authoritative).
  appendFileSync(
    AUDIT_PATH,
    JSON.stringify({
      ts: now.toISOString(),
      tool: 'write_task',
      status: 'created',
      project: 'tasks',
      session_id,
      id,
      title: safeTitle,
      path: finalPath,
    }) + '\n',
    'utf-8'
  );

  return { path: finalPath, id, title: safeTitle, status: resolvedStatus };
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
  // Positive charset gate: makes the server self-safe regardless of caller. session_id
  // flows verbatim into pointer.recovery's shell-command string on pointer-write failure
  // (see below) — restricting to [A-Za-z0-9._-] proves that string injection-free without
  // relying on any caller-side gate (e.g. the /handoff command's own charset check).
  if (!/^[A-Za-z0-9._-]+$/.test(session_id)) {
    throw new ProtocolError(-32602, 'SESSION_ID_INVALID',
      'SESSION_ID_INVALID: session_id must contain only letters, digits, dots, underscores, or hyphens');
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
    throw new ProtocolError(-32000, 'FS_FAILURE', 'FS_FAILURE: path escapes scratch root: ' + destPath);
  }

  // Ensure sessions/ directory exists (idempotent — covers all four Workstream Collision Policy rows).
  mkdirSync(sessionsDir, { recursive: true });

  // Atomic write with collision-suffix retry (cap 100).
  let counter = 1;
  destPath = join(sessionsDir, `${ts}-${hex}.md`);
  while (counter <= 100) {
    // openSync with 'wx' — OUTSIDE the write try/finally so EEXIST can retry the suffix loop.
    // D22: ZERO body-content validation. write_session never inspects body shape.
    // Validation is the caller's job; the per-session log is the immutable source of truth
    // and HANDOFF.md is a derived cache regenerated by rewrite-pointer.
    // History: write_handoff (commit d25a085 → ad18ada, 2026-04-22→25) failed because
    // strict schema validation forced 2-10k token retries near context limit. Do NOT
    // reintroduce content checks here. Body integrity flows through agent's Opus
    // classification + bounded retry (D14, D25).
    // D006: keep flag:'wx'; no tmp+rename — preserves exclusive-create / collision-safe guarantee.
    let fd;
    try {
      fd = openSync(destPath, 'wx');
    } catch (e) {
      if (e.code === 'EEXIST') {
        counter += 1;
        destPath = join(sessionsDir, `${ts}-${hex}-${counter}.md`);
        continue;
      }
      throw new ProtocolError(-32000, 'FS_FAILURE', 'FS_FAILURE: ' + e.message);
    }
    // fd held — write, fsync for durability, then always close in finally.
    // On write/sync failure: unlink the partial file to prevent a stale wx path from
    // blocking future retries, then re-throw as FS_FAILURE (spec line 155).
    try {
      writeSync(fd, injectedBody, null, 'utf8');
      fsyncSync(fd);
    } catch (writeErr) {
      try { unlinkSync(destPath); } catch (unlinkErr) {
        process.stderr.write(`write_session: unlink after write failure: ${unlinkErr.message}\n`);
      }
      throw new ProtocolError(-32000, 'FS_FAILURE', 'FS_FAILURE: ' + writeErr.message);
    } finally {
      closeSync(fd);
    }
    break;
  }
  if (counter > 100) {
    throw new ProtocolError(-32000, 'FS_FAILURE', 'FS_FAILURE: collision suffix exceeded 100 iterations');
  }

  // Audit log entry.
  // No fsync here — the crash window between the durable session file and the audit entry
  // is intentional per D006: the audit log is advisory, not authoritative.
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

  // Regenerate the derived HANDOFF.md pointer mechanically so callers can never
  // drop it. Non-fatal: the session file is the source of truth; a pointer
  // failure is surfaced in the return for recovery but does not fail the write.
  let pointer;
  try {
    const { targetPath } = rewritePointer(workstream_folder);
    pointer = { written: true, path: targetPath };
  } catch (err) {
    process.stderr.write(`write_session: pointer regeneration failed (non-fatal): ${err.message}\n`);
    pointer = {
      written: false,
      error: err.message,
      recovery: `scratch-memory rewrite-pointer 'scratch/S-${session_id}/'`,
    };
  }

  return { path: destPath, session_id, started, ended, pointer };
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
      ['summary', 'intent', 'impact', 'prior_thinking', 'related', 'notes',
        'role', 'epic', 'spike_type', 'blocked_by'],
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
  if (name === 'write_task') {
    validateNoMalformedToolCallXml(args, ['title', 'body', 'blocked_on'], 'write_task');
    const result = writeTask(args || {});
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
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
