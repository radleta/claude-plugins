#!/usr/bin/env node
// tasks.mjs — shared module + CLI verb group for the workstream tasks system
//
// This module owns four responsibilities: the two per-corpus lint rule sets
// (tasks + issues), the tasks/ directory scan, the `## Tasks` block renderer,
// and the `tasks` CLI dispatch (list / lint / schema / version / done).
//
// Two consumers, per spec T4's shared-module-with-two-thin-consumers contract:
//   - the `scratch-memory tasks` CLI verb group (this file's dispatch())
//   - the session-log CLI's `--with-tasks` flag, which folds a rendered
//     `## Tasks` block into the `/pickup` resume brief (Step 04a)
//
// Exports:
//   TASK_STATUS               — the T5 status enum (D10 single source)
//   TASK_OPEN_STATUSES        — statuses rendered as open rows, in render order
//   TASK_REQUIRED_KEYS        — required tasks frontmatter keys
//   ISSUE_REQUIRED_KEYS       — the 10 keys write_issue emits, in emit order
//   ISSUE_KINDS                — issues `kind` enum
// The three status lists below name no count on purpose. Each one drifted from
// its array the last time a value was added, so they describe the RULE that
// derives them and leave the arithmetic to the reader who can see the array.
//   ISSUE_STATUSES            — issues `status` enum; the other two derive from it
//   ISSUE_SETTLED_STATUSES    — those that mean a disposition was reached; `open`
//                               and `deferred` are not among them
//   ISSUE_CLOSED_STATUSES     — every value but `open`; the epic-done predicate
//   ISSUE_SEVERITIES          — issues `severity` enum (optional field)
//   ISSUE_PROVENANCE_KEYS     — the six keys required only of `tool: write_issue` files
//   ISSUE_ROLES               — issues `role` enum (epic | spike); server.mjs imports this
//   SPIKE_TYPES               — issues `spike_type` enum; server.mjs imports this
//   ISSUE_SLUG_PATTERN        — corpus slug charset, shared by the E-rules and the writer
//   MAX_TITLE_LEN              — shared title length bound (T9 / I5)
//   MAX_BLOCKED_ON_LEN          — `blocked_on` length bound (writer imports this)
//   TASK_FILE_GLOB_PREFIX       — the `t-` scanner filter prefix
//   TASKS_METHODOLOGY_VERSION   — the task methodology version groom.yaml records
//   GROOM_MARKER_FILENAME       — `groom.yaml`, the marker's basename in a workstream folder
//   writeGroomMarker(sessionDir)              — atomically write groom.yaml at the current version
//   writeEventMarks / readEventMarks          — the event groom's marks and remainder in groom.yaml
//   writeFileAtomic(path, content)            — tmp sibling + rename; the one write path for
//                                               groom.yaml, `tasks done` and the issues.mjs close verbs
//   readGroomMarker(sessionDir)               — {methodology_version, groomed} or null
//   listOrThrow(dir, predicate)               — sorted filtered listing; missing dir = []
//   isNewWorkstream(folder)                   — no sessions, no tasks, no HANDOFF.md yet
//   hasFrontmatterBlock(content)              — D12 gate: first line is `---`
//   unquote(value)                            — reverse write_issue's title escaping
//   lintTaskFile(filePath, content)           — T1-T9 rule set
//   lintIssueFile(filePath, content)          — I0-I10 + Tier 1 E-rule set
//   splitSlugList(value)                      — comma-separated scalar -> string[]
//   buildIssueIndex(files)                    — corpus-wide slug -> node index (pure)
//   buildEpicGraph(epicSlug, files)           — the one epic/member traversal (pure)
//   frontierSpikes(graph, index)              — ready spike slugs, sorted (pure)
//   buildEpicReport(epicSlug, index)          — the `epics graph` layer/cycle/progress report (pure)
//   lintBlockedByGraph(index, opts?)          — E1 + E2, corpus-wide (pure)
//   lintEpicGraph(epicSlug, files, opts?)     — E3 + optional Tier 2b (E5)
//   readIssuesCorpus(dir)                     — every `*.md` in an issues corpus as {path, content}
//   detectSchema(path)                        — 'tasks' | 'issues' | null
//   lintFile(filePath, content, schema)       — dispatch to the right rule set
//   formatWarning(filePath, problem)          — the one `WARN:` line shape
//   scanTasks(sessionDir, opts)               — the workstream tasks/ scan
//   taskAgeDays(updatedIso, now)              — UTC calendar-day age
//   renderAge(ageDays)                        — 'updated today' / 'Nd ago' / 'unknown'
//   renderTasksBlock(scan)                    — the `## Tasks` block string
//   issuesSchema()                            — the issues vocabularies as one
//                                               plain object; what `tasks schema`
//                                               prints, and the single source any
//                                               out-of-repo consumer reads
//   EXIT                                      — exit-code constants (mirrors cat-sessions.mjs:23)
//   dispatch(argv)                            — `tasks list` / `lint` / `schema` / `version` / `done` CLI entry point
//
// Everything above renderTasksBlock is a pure function or a constant, except
// writeGroomMarker and writeFileAtomic, the filesystem writes in this file. No stdout anywhere
// except inside dispatch() and its helpers, which own all I/O and stream
// discipline for the CLI surface.

import { closeSync, constants, existsSync, openSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, basename, dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseFrontmatter, resolveProjectRoot } from './handoff.mjs';

// ---------------------------------------------------------------------------
// Constants and schema (D10 — single source for the status enum and the
// schema constants both write_task's MCP validation and this lint module
// consume; server.mjs imports these rather than holding its own copies)
// ---------------------------------------------------------------------------

export const TASK_STATUS = ['open', 'blocked', 'done', 'dropped', 'promoted'];
export const TASK_OPEN_STATUSES = ['blocked', 'open'];
export const TASK_REQUIRED_KEYS = ['id', 'title', 'status', 'created', 'updated'];
export const ISSUE_REQUIRED_KEYS = [
  'tool', 'kind', 'title', 'slug', 'status', 'captured', 'repo', 'branch', 'commit', 'working_tree',
];
export const ISSUE_KINDS = ['issue', 'idea', 'mixed'];

// The status enum the backlog already governs by (scratch/backlog/CLAUDE.md's
// Status enum table), adopted here so the two documents agree. It named a count
// until `settled` was added under it, which is where every stale count in this
// file came from; the array is the authority and nothing describes it by length.
// The former `open | resolved` binary described 5 of the corpus's 28 non-open
// files; `resolved` is retired rather than aliased, because each of the five
// carried a different real disposition underneath it.
export const ISSUE_STATUSES = [
  'open', 'deferred', 'wont-fix', 'fixed', 'accepted', 'moved', 'settled',
];

// Settled = a disposition was reached. `deferred` is deliberately absent: it
// acknowledges an issue without deciding it, so a spike blocked behind a
// deferred spike is still blocked, and a deferred spike owes its epic no
// decision line. Everything that used to test `status === 'resolved'` tests
// membership here instead.
//
// The `settled` value is for the shape a decision spike actually takes: the
// question is answered and the work it produced lives somewhere else. It is
// neither `accepted` (which asserts no action was needed, and action was) nor
// `moved` (which points at one specific new home, and the work is often spread
// across a later design step). It was added after a 134-file migration filed
// seven such spikes under `accepted` and the classification was flagged as a
// poor fit by the agent making it.
export const ISSUE_SETTLED_STATUSES = ['wont-fix', 'fixed', 'accepted', 'moved', 'settled'];

// Closed = the six non-`open` values. The epic-done predicate, and the one the
// explorer derives the same way (explorer-graph.cjs). Written as MEMBERSHIP and
// never as `!== 'open'`: a status outside the enum entirely — a legacy file, a
// hand-typed value — is not open and is not closed, and testing it as closed
// would report unfinished work as done and place work waiting behind it in
// layer 0. `frontierSpikes` fails closed over the same corpus; so does this.
export const ISSUE_CLOSED_STATUSES = ISSUE_STATUSES.filter((s) => s !== 'open');

// Severity — what happens if the issue ships unfixed, never how hard it is to
// fix or how long it has sat. Optional; validated only when present. The
// rubric behind the four values lives in scratch-issues-methodology.
// Ordered most-severe first, with `unrated` last: it is not a rung on the scale
// but the explicit "a human still owes this a judgment" marker. Absence of the
// key means nobody has triaged the file at all; `unrated` means someone has, and
// the call needs a person. See scratch-issues-methodology's Severity section.
export const ISSUE_SEVERITIES = ['blocker', 'high', 'medium', 'low', 'unrated'];

// The six keys write_issue stamps from the calling session's git context.
// Required only of files that claim that writer; see the I1 comment.
export const ISSUE_PROVENANCE_KEYS = [
  'tool', 'repo', 'branch', 'commit', 'captured', 'working_tree',
];

export const MAX_TITLE_LEN = 80;
export const MAX_BLOCKED_ON_LEN = 120;
export const TASK_FILE_GLOB_PREFIX = 't-';

// Bumps only when existing task data stops conforming or groom must check
// something new; the version log lives in handoff-methodology's
// tasks-methodology.md, beside the rules it versions.
export const TASKS_METHODOLOGY_VERSION = 1;
export const GROOM_MARKER_FILENAME = 'groom.yaml';

// Epic/spike vocabulary (D13, D14). server.mjs imports ISSUE_ROLES and
// SPIKE_TYPES rather than holding its own copies -- the same single-source
// rule TASK_STATUS already follows, so the MCP schema and the lint can never
// disagree about what a valid value is.
export const ISSUE_ROLES = ['epic', 'spike'];
export const SPIKE_TYPES = ['interview', 'prototype', 'research', 'task'];

/**
 * The issues vocabularies as one plain object. D10 makes this file their single
 * source, and in-repo consumers import the constants directly; a consumer in
 * ANOTHER repository cannot, so `tasks schema` prints this and they read it from
 * the CLI instead of keeping a copy. Returns fresh arrays, so a caller mutating
 * the result cannot reach the constants.
 */
export function issuesSchema() {
  return {
    statuses: [...ISSUE_STATUSES],
    settled: [...ISSUE_SETTLED_STATUSES],
    severities: [...ISSUE_SEVERITIES],
    kinds: [...ISSUE_KINDS],
    roles: [...ISSUE_ROLES],
    spikeTypes: [...SPIKE_TYPES],
    requiredKeys: [...ISSUE_REQUIRED_KEYS],
    provenanceKeys: [...ISSUE_PROVENANCE_KEYS],
    maxTitleLen: MAX_TITLE_LEN,
  };
}

// The corpus slug charset, matching writeIssue's `slug_override` rule
// (server.mjs:783). Every `epic:` and `blocked_by:` element is validated
// against it by E9, and the new write_issue parameters reuse it.
export const ISSUE_SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

// D12 gate for lintIssueFile, and half of T1's compound pass condition. A
// first-line test only — not a regex over the whole file — so a `---`
// horizontal rule further down in the body can never fake a block.
export function hasFrontmatterBlock(content) {
  const idx = content.indexOf('\n');
  const firstLine = idx === -1 ? content : content.slice(0, idx);
  return firstLine === '---';
}

// The other half of T1's compound condition: does a closing `---` line
// actually follow the opening one? parseFrontmatter() (handoff.mjs:92)
// returns {} both when there is no block at all AND when the block closes
// but is genuinely empty — those are different situations for T1 (only the
// former is "no frontmatter block"), so this presence test — mirroring
// parseFrontmatter's own block-match regex, not its key:value extraction —
// is what tells them apart without re-deriving the parser.
function hasClosingFrontmatterDelimiter(content) {
  return /^---\n[\s\S]*?\n---/.test(content);
}

// Strip one layer of surrounding double quotes and unescape `\"` and `\\`,
// reversing exactly what writeIssue() escapes on the way in (server.mjs:786,
// `title: "${escapedTitle}"` — backslashes doubled first, then quotes
// escaped). Reversing requires undoing `\"` before `\\`: an original `"`
// became `\"` and an original `\` became `\\`, and unescaping quotes first
// leaves any remaining `\\` pairs to collapse cleanly afterward. Values that
// are not double-quoted (every field besides `title` and `blocked_on`) pass
// through unchanged.
export function unquote(value) {
  if (typeof value !== 'string') return value;
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return value;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Frontmatter values cannot carry a YAML list: parseFrontmatter (handoff.mjs:92)
// splits each line at the first colon and stores the raw trimmed string, so a
// flow sequence would round-trip as the literal "[a, b]". `epic:` and
// `blocked_by:` are therefore comma-separated scalars.
//
// An absent key and an all-whitespace value both mean zero elements -- that is
// what `blocked_by` being "zero or more slugs" allows, and it keeps a
// placeholder `blocked_by:` from blocking an edit under the no-warn-tier model
// (D11/D16). Interior and trailing empties ("a,,b", "a,") survive as empty
// strings so E9 reports them rather than silently dropping them.
export function splitSlugList(value) {
  if (value === undefined) return [];
  const trimmed = value.trim();
  if (trimmed === '') return [];
  return trimmed.split(',').map((part) => part.trim());
}

// A file's slug: the frontmatter value when present (I6 already guarantees it
// matches the filename), the basename otherwise -- so a hand-made file still
// has an identity in the graph rather than an undefined one.
function slugOf(filePath, fm) {
  const declared = fm.slug === undefined ? '' : fm.slug.trim();
  return declared !== '' ? declared : basename(filePath).replace(/\.md$/, '');
}

// The text under one `## Heading`, up to the next `## ` heading or EOF.
// Returns null when the heading is absent, which callers distinguish from a
// present-but-empty section. Anchored like I7/I9, so a lookup for `Resolution`
// is never satisfied by `## Proposed Resolution`.
function sectionBody(content, heading) {
  const start = new RegExp(`^## ${escapeRegExp(heading)}\\b.*$`, 'm').exec(content);
  if (start === null) return null;
  const rest = content.slice(start.index + start[0].length);
  const next = /^## /m.exec(rest);
  return next === null ? rest : rest.slice(0, next.index);
}

// E12's two addressable forms (D20): a corpus path, or a backticked slug.
// Free prose naming an artifact in words satisfies neither -- which is the
// point, since an unaddressable artifact is exactly what D20 rejects.
const PROTOTYPE_ARTIFACT_PATH = /scratch\/issues\/[A-Za-z0-9._-]+/;
const PROTOTYPE_ARTIFACT_SLUG = /`[a-z0-9]([a-z0-9-]*[a-z0-9])?`/;

// Does `text` mention `slug` as a whole token? `\b` is wrong here: it treats
// '-' as a word boundary, so `\bfoo\b` would match inside "foo-bar" and let a
// near-miss slug satisfy E5.
function mentionsSlug(text, slug) {
  return new RegExp(`(^|[^a-z0-9-])${escapeRegExp(slug)}($|[^a-z0-9-])`).test(text);
}

// ---------------------------------------------------------------------------
// Lint rules
// ---------------------------------------------------------------------------

// Tasks corpus (T1-T9). Rules are evaluated in table order so output
// ordering is deterministic. T7 and T8 are only meaningful once the field
// they check exists — an absent `status`/`id` is already reported by
// T4/T2, so they are guarded rather than re-reporting against `undefined`.
export function lintTaskFile(filePath, content) {
  const problems = [];

  // T1
  if (!hasFrontmatterBlock(content) || !hasClosingFrontmatterDelimiter(content)) {
    problems.push('no frontmatter block');
    return problems;
  }

  const fm = parseFrontmatter(content);

  // T2
  if (!fm.id) {
    problems.push('missing required key: id');
  }

  // T3
  const titlePresent = fm.title !== undefined && unquote(fm.title).trim().length > 0;
  if (!titlePresent) {
    problems.push('missing required key: title');
  }

  // T4
  if (!fm.status) {
    problems.push('missing required key: status');
  }

  // T5
  if (!fm.created) {
    problems.push('missing required key: created');
  }

  // T6
  if (!fm.updated) {
    problems.push('missing required key: updated');
  }

  // T7
  if (fm.status && !TASK_STATUS.includes(fm.status)) {
    problems.push(`invalid status: ${fm.status} (expected one of: ${TASK_STATUS.join(', ')})`);
  }

  // T8
  if (fm.id) {
    const base = basename(filePath);
    if (!/^t-[0-9a-f]{6}$/.test(fm.id) || !base.startsWith(`${fm.id}-`)) {
      problems.push(`id ${fm.id} does not match filename prefix`);
    }
  }

  // T9
  if (fm.title !== undefined) {
    const len = unquote(fm.title).length;
    if (len < 1 || len > MAX_TITLE_LEN) {
      problems.push(`title exceeds ${MAX_TITLE_LEN} characters (${len})`);
    }
  }

  return problems;
}

// Issues corpus (I0-I9). I0's exemption (D12) short-circuits before every
// other rule, including I9 — no-frontmatter files are a standing, documented
// exception (scratch-issues-methodology/corpus-state.md), never a warning.
export function lintIssueFile(filePath, content) {
  // I0 (D12) — files predating the MCP writer carry no frontmatter at all;
  // that is a sanctioned, permanent exception, not drift, so nothing here
  // ever evaluates against them.
  if (!hasFrontmatterBlock(content)) return [];

  const problems = [];
  const fm = parseFrontmatter(content);

  // I1 — one line per missing required key, in ISSUE_REQUIRED_KEYS order.
  //
  // The provenance six are required only of files claiming the MCP writer.
  // D12's exemption was written for files with no frontmatter at all, and this
  // corpus has none: its 45 legacy files carry partial frontmatter (typically
  // title/slug/status), so the exemption caught nothing and the lint reported
  // 249 findings that could never be legitimately cleared — corpus-state.md
  // forbids fabricating a `commit` SHA, `branch`, or `captured` timestamp, and
  // names sentinel values a tradeoff rather than a fix. `tool:
  // manual-migration` files are legacy under this test too, which is the
  // honest reading: they say so themselves. `kind` stays required everywhere,
  // because it is a classification derivable by reading the file rather than
  // provenance. A reader wanting a legacy file's write date uses
  // `git log --follow`.
  const claimsWriter = fm.tool === 'write_issue';
  for (const key of ISSUE_REQUIRED_KEYS) {
    if (fm[key]) continue;
    if (!claimsWriter && ISSUE_PROVENANCE_KEYS.includes(key)) continue;
    problems.push(`missing required key: ${key}`);
  }

  // I2
  if (fm.kind && !ISSUE_KINDS.includes(fm.kind)) {
    problems.push(`invalid kind: ${fm.kind} (expected one of: ${ISSUE_KINDS.join(', ')})`);
  }

  // I3
  if (fm.status && !ISSUE_STATUSES.includes(fm.status)) {
    problems.push(`invalid status: ${fm.status} (expected one of: ${ISSUE_STATUSES.join(', ')})`);
  }

  // I4 — accept both date-only and full-datetime ISO-8601 (decisions.md's
  // "Decision required" default): the live corpus has one legitimate
  // date-only `captured` value, and date-only is still valid ISO-8601.
  if (fm.captured) {
    const isoPattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z)?$/;
    if (!isoPattern.test(fm.captured)) {
      problems.push(`captured is not ISO-8601: ${fm.captured}`);
    }
  }

  // I5
  if (fm.title !== undefined) {
    const len = unquote(fm.title).length;
    if (len < 1 || len > MAX_TITLE_LEN) {
      problems.push(`title exceeds ${MAX_TITLE_LEN} characters (${len})`);
    }
  }

  // I6 — basename-sans-.md equals slug, or matches the write_issue numeric
  // collision suffix `${slug}-\d+` (server.mjs:765-775)
  if (fm.slug) {
    const base = basename(filePath).replace(/\.md$/, '');
    const suffixPattern = new RegExp(`^${escapeRegExp(fm.slug)}-\\d+$`);
    if (base !== fm.slug && !suffixPattern.test(base)) {
      problems.push(`slug ${fm.slug} does not match filename`);
    }
  }

  // I7 / I8 — the ## Resolution pairing rule, both directions (spec T10).
  // `^## Resolution\b` matches bare `## Resolution` and dated
  // `## Resolution (2026-08-19)`; the line anchor excludes
  // `## Proposed Resolution`, and `## Update` / `## Partial Progress` never
  // satisfy it either.
  //
  // I7 requires the section on a SETTLED status only. `deferred` is exempt: it
  // acknowledges an issue without deciding it, so there is nothing to write
  // down yet. `open` is covered by I8, the reverse direction.
  const hasResolutionHeading = /^## Resolution\b/m.test(content);
  if (ISSUE_SETTLED_STATUSES.includes(fm.status) && !hasResolutionHeading) {
    problems.push(`status: ${fm.status} with no ## Resolution section`);
  }
  if (fm.status === 'open' && hasResolutionHeading) {
    problems.push('status: open with a ## Resolution section (stale status)');
  }

  // I10 — severity: optional, but a closed vocabulary when present. This lint
  // ignores unknown frontmatter keys, so severity had to be named here to be
  // checked at all.
  if (fm.severity && !ISSUE_SEVERITIES.includes(fm.severity)) {
    problems.push(`invalid severity: ${fm.severity} (expected one of: ${ISSUE_SEVERITIES.join(', ')})`);
  }

  // I9 — corpus-state.md Class 2 (missing ## Summary). Body-structure rule,
  // like I7/I8, anchored the same way: `## Summary of findings` satisfies
  // it, `## Executive Summary` does not.
  if (!/^## Summary\b/m.test(content)) {
    problems.push('no ## Summary section');
  }

  // --- Tier 1 epic/spike rules (E4, E6-E12) --------------------------------
  // D16 places these here because none can fire during a legitimate
  // intermediate state: each reads only the file in front of it, so a
  // hook-blocking finding always names a defect in the edit that just
  // happened. E1, E2, E3 and E5 need sibling files and live in lintEpicGraph.
  //
  // Enum values are reported via JSON.stringify, unlike I2/I3: those keys are
  // required, so an empty value is already an I1 finding, while these are
  // optional and a bare empty `role:` would render a message with a hole in it.
  const role = fm.role === undefined ? undefined : fm.role.trim();
  const spikeType = fm.spike_type === undefined ? undefined : fm.spike_type.trim();
  const epicList = splitSlugList(fm.epic);
  const blockedByList = splitSlugList(fm.blocked_by);

  // E4
  if (role !== undefined && !ISSUE_ROLES.includes(role)) {
    problems.push(`invalid role: ${JSON.stringify(role)} (expected one of: ${ISSUE_ROLES.join(', ')})`);
  }

  // E6 -- an EMPTY spike_type is left to E8 (on a spike) or E10 (anywhere
  // else) so the same missing value is never reported twice.
  if (spikeType !== undefined && spikeType !== '' && !SPIKE_TYPES.includes(spikeType)) {
    problems.push(`invalid spike_type: ${JSON.stringify(spikeType)} (expected one of: ${SPIKE_TYPES.join(', ')})`);
  }

  // E7
  if (role === 'spike' && epicList.length === 0) {
    problems.push('role: spike with no epic');
  }

  // E8
  if (role === 'spike' && (spikeType === undefined || spikeType === '')) {
    problems.push('role: spike with no spike_type');
  }

  // E9
  for (const [key, list] of [['epic', epicList], ['blocked_by', blockedByList]]) {
    for (const value of list) {
      if (!ISSUE_SLUG_PATTERN.test(value)) {
        problems.push(`invalid ${key} slug: ${JSON.stringify(value)}`);
      }
    }
  }

  // E10 covers `spike_type` alone. Two keys are deliberately NOT checked here:
  //   - `epic:`, because D7 lets an issue belong to more than one container and
  //     idea.md's Not Yet Specified leaves open whether an ordinary capture can
  //     be promoted into a spike in place; a hook-blocking rule must not
  //     foreclose an explicitly unspecified question.
  //   - `blocked_by:`, because it is no longer spike-only. Any issue may be
  //     blocked by any other issue in the corpus, in any epic or none, and E1
  //     (now corpus-wide, in lintBlockedByGraph) is the only rule over it.
  if (spikeType !== undefined && role !== 'spike') {
    problems.push('spike_type present without role: spike');
  }

  // E11 -- the one Tier 1 rule that COULD fire mid-authoring: write_issue
  // emits a skeleton with no ## Destination. write_issue is an MCP call and
  // fires no PostToolUse hook, so the exposure is only the hand-edit path,
  // and /discovery's rule is to write the whole epic body in one edit -- the
  // same create-then-write shape D17 already imposes on spikes.
  if (role === 'epic' && !/^## Destination\b/m.test(content)) {
    problems.push('role: epic with no ## Destination section');
  }

  // E12 (D20) -- a settled prototype spike's evidence must be addressable. A
  // missing ## Resolution is I7's finding again, so a null section here returns
  // without reporting rather than blaming the same edit twice.
  if (spikeType === 'prototype' && ISSUE_SETTLED_STATUSES.includes(fm.status)) {
    const resolution = sectionBody(content, 'Resolution');
    if (resolution !== null
      && !PROTOTYPE_ARTIFACT_PATH.test(resolution)
      && !PROTOTYPE_ARTIFACT_SLUG.test(resolution)) {
      problems.push('settled prototype spike: ## Resolution names no scratch/issues/ path or `slug`');
    }
  }

  return problems;
}

// ---------------------------------------------------------------------------
// Epic graph (D2, D13, D15, D16, D18)
//
// One traversal, two consumers: the Tier 2 graph rules below and the
// `epics frontier` verb, which is a thin dispatch over frontierSpikes(). Both
// functions are pure -- the caller supplies the file set, so nothing in this
// section reads the filesystem (the module header's no-I/O contract).
// ---------------------------------------------------------------------------

/**
 * Index every issue in a corpus by slug — the corpus-wide node set the graph
 * rules, the frontier and `epics graph` all resolve blockers against.
 *
 * A blocker may name any issue in scratch/issues/, in any epic or none, so an
 * epic-keyed spike map cannot answer "does this target exist". This index can,
 * and it is the one frontmatter-to-node implementation: buildEpicGraph selects
 * its members out of these nodes rather than re-parsing them.
 *
 * `kind` and `title` are carried for `epics graph`'s output alone; no rule
 * reads either.
 *
 * On a duplicate slug the first file in `files` order wins, and the index says
 * nothing about it. The writer's collision walk is what keeps duplicate slugs a
 * legacy shape rather than a live one, so reporting here would blame an edit
 * for a condition it did not create — hence the bare `has` guard on Map.set
 * rather than a finding.
 *
 * @param {Array<{path: string, content: string}>} files  Candidate files; only
 *   those carrying a frontmatter block become nodes. Nothing is read here.
 * @returns {Map<string, {slug: string, path: string, role: (string|undefined), kind: (string|undefined), title: string, status: (string|undefined), spikeType: (string|undefined), epics: string[], blockedBy: string[]}>}
 *   insertion-ordered by `files` order, which callers supply sorted by path.
 */
export function buildIssueIndex(files) {
  const index = new Map();
  for (const file of files) {
    if (!hasFrontmatterBlock(file.content)) continue;
    const fm = parseFrontmatter(file.content);
    const slug = slugOf(file.path, fm);
    if (index.has(slug)) continue;
    index.set(slug, {
      slug,
      path: file.path,
      role: fm.role === undefined ? undefined : fm.role.trim(),
      kind: fm.kind === undefined ? undefined : fm.kind.trim(),
      title: fm.title === undefined ? '' : unquote(fm.title.trim()),
      status: fm.status === undefined ? undefined : fm.status.trim(),
      spikeType: fm.spike_type === undefined ? undefined : fm.spike_type.trim(),
      epics: splitSlugList(fm.epic).filter((value) => value !== ''),
      blockedBy: splitSlugList(fm.blocked_by).filter((value) => value !== ''),
    });
  }
  return index;
}

// One epic's own node and its member nodes, out of a corpus index. The epic
// stays out of its own `members`: putting it there would let it satisfy E5
// about itself, so its edges reach the graph rules through `epicNode` instead.
// Shared by buildEpicGraph and buildEpicReport so epic membership has one
// implementation.
function selectEpicMembers(epicSlug, index) {
  let epicNode = null;
  const members = [];
  for (const node of index.values()) {
    if (node.role === 'epic' && node.slug === epicSlug) {
      epicNode = node;
      continue;
    }
    if (node.epics.includes(epicSlug)) members.push(node);
  }
  members.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return { epicNode, members };
}

/**
 * Resolve one epic and its members out of a supplied file set.
 *
 * @param {string} epicSlug  The epic to build the graph around.
 * @param {Array<{path: string, content: string}>} files  Candidate files. The
 *   caller decides the set; nothing is read here.
 * @returns {{epicSlug: string, epic: ({slug: string, path: string, content: string}|null), epicNode: (object|null), members: object[], buildWork: object[], spikes: Map<string, object>}}
 *   `epic` is null when no file in the set carries `role: epic` with this
 *   slug (E3's condition), and `epicNode` is its index node — the epic's own
 *   `blocked_by` lives there, since the epic is not among its own `members`.
 *   `members` is every file claiming the epic, whatever its role, sorted by
 *   slug for deterministic output; `buildWork` is the non-spike subset in that
 *   same order, and `spikes` indexes the `role: spike` subset.
 */
export function buildEpicGraph(epicSlug, files) {
  const index = buildIssueIndex(files);
  const { epicNode, members } = selectEpicMembers(epicSlug, index);

  // E5 reads the epic's ## Decisions and ## Out of Scope, so the epic alone
  // needs its body carried alongside its node.
  const epic = epicNode === null
    ? null
    : {
      slug: epicNode.slug,
      path: epicNode.path,
      content: files.find((file) => file.path === epicNode.path).content,
    };

  const spikes = new Map();
  const buildWork = [];
  for (const member of members) {
    if (member.role === 'spike') spikes.set(member.slug, member);
    else buildWork.push(member);
  }

  return { epicSlug, epic, epicNode, members, buildWork, spikes };
}

/**
 * The ready spikes of an epic: open, and with every blocker resolved.
 *
 * An unresolvable blocker counts as UNRESOLVED, so a typo fails closed and
 * cannot promote work into the ready list. That state is already an E1
 * finding at edit time, so the frontier never has to be the thing that
 * reports it.
 *
 * The outer loop stays `graph.spikes`, so the frontier still answers "which
 * decision spikes are workable"; only the blocker lookup widens, so a spike
 * waiting on a build issue resolves to that issue instead of failing closed.
 *
 * @param {ReturnType<typeof buildEpicGraph>} graph
 * @param {ReturnType<typeof buildIssueIndex>} index  Corpus-wide blocker lookup.
 * @returns {string[]} ready spike slugs, sorted
 */
export function frontierSpikes(graph, index) {
  const ready = [];
  for (const [slug, spike] of graph.spikes) {
    if (spike.status !== 'open') continue;
    const blocked = spike.blockedBy.some((target) => {
      const blocker = index.get(target);
      return blocker === undefined || !ISSUE_SETTLED_STATUSES.includes(blocker.status);
    });
    if (!blocked) ready.push(slug);
  }
  return ready.sort();
}

/**
 * Everything `epics graph` prints about one epic: its blocker layers, its
 * cycles, its external blockers, its unresolvable edges and its progress.
 *
 * Every piece of graph reasoning lives here rather than in epics.mjs, so that
 * module's THIN DISPATCH contract stays literally true. epics.mjs formats this
 * and nothing more.
 *
 * "Closed" throughout is the six non-`open` statuses — the same epic-done
 * predicate the explorer uses, which counts `deferred` as done.
 *
 * @param {string} epicSlug
 * @param {ReturnType<typeof buildIssueIndex>} index
 * @returns {{epic: object, decisions: object[][], build: object[][], external: object[], cycles: string[][], unresolvable: object[], progress: {closed: number, total: number}}}
 *   `decisions` and `build` are arrays indexed by blocker layer. `epic.status`
 *   is null when no file carries `role: epic` with this slug; the CLI treats
 *   that as "no such epic" before it ever formats.
 */
export function buildEpicReport(epicSlug, index) {
  const { epicNode, members } = selectEpicMembers(epicSlug, index);
  const memberBySlug = new Map(members.map((m) => [m.slug, m]));
  const blockerLine = (target) => {
    const node = index.get(target);
    return { slug: target, status: node === undefined ? null : node.status };
  };

  // A member inside a cycle gets no layer: it is listed under `cycles`
  // instead, which is also what keeps the layer walk below terminating.
  const cycles = findBlockedByCycles(index).filter((cycle) => cycle.some((slug) => memberBySlug.has(slug)));
  const inACycle = new Set(cycles.flat());

  const unresolvable = [];
  const external = [];
  const seenExternal = new Set();
  for (const member of members) {
    for (const target of member.blockedBy) {
      const node = index.get(target);
      if (node === undefined) {
        unresolvable.push({ slug: member.slug, target });
        continue;
      }
      if (memberBySlug.has(target) || seenExternal.has(target)) continue;
      seenExternal.add(target);
      external.push({ slug: target, status: node.status, epic: node.epics });
    }
  }

  // Layer 0 is "workable now": no blocker that both resolves and is still
  // open. A member with open blockers sits one past the highest of them; an
  // open blocker outside this epic counts as layer 0, since it is work that
  // exists and is not yet done but is not this epic's to order.
  const layerOf = new Map();
  const resolveLayer = (member) => {
    if (layerOf.has(member.slug)) return layerOf.get(member.slug);
    // A blocker inside a cycle is skipped: it has no layer of its own, and
    // following it is exactly how this walk would fail to terminate.
    const openBlockers = member.blockedBy.filter((target) => {
      if (inACycle.has(target)) return false;
      const node = index.get(target);
      return node !== undefined && !ISSUE_CLOSED_STATUSES.includes(node.status);
    });
    if (openBlockers.length === 0) {
      layerOf.set(member.slug, 0);
      return 0;
    }
    let highest = 0;
    for (const target of openBlockers) {
      const blocker = memberBySlug.get(target);
      if (blocker !== undefined) highest = Math.max(highest, resolveLayer(blocker));
    }
    const layer = highest + 1;
    layerOf.set(member.slug, layer);
    return layer;
  };

  const decisions = [];
  const build = [];
  for (const member of members) {
    if (inACycle.has(member.slug)) continue;
    const layer = resolveLayer(member);
    const rows = member.role === 'spike' ? decisions : build;
    while (rows.length <= layer) rows.push([]);
    rows[layer].push(member.role === 'spike'
      ? { slug: member.slug, spike_type: member.spikeType ?? null, status: member.status, blocked_by: member.blockedBy }
      : { slug: member.slug, kind: member.kind ?? null, status: member.status, blocked_by: member.blockedBy });
  }

  return {
    epic: {
      slug: epicSlug,
      title: epicNode === null ? '' : epicNode.title,
      status: epicNode === null ? null : epicNode.status,
      blocked_by: epicNode === null ? [] : epicNode.blockedBy.map(blockerLine),
    },
    decisions,
    build,
    external,
    cycles,
    unresolvable,
    progress: {
      closed: members.filter((m) => ISSUE_CLOSED_STATUSES.includes(m.status)).length,
      total: members.length,
    },
  };
}

// Every distinct cycle in the blocked_by edges, each returned as a slug path
// closing on its own first element (['a','b','a']). The walk covers the whole
// corpus index, so recursion is bounded by the longest blocked_by chain in
// scratch/issues/ rather than by spikes-per-epic; at corpus sizes in the low
// thousands that stays far inside the stack. Cycles are canonicalized by
// rotating the smallest slug to the front before dedup, so the same cycle
// reached from two entry points is reported once.
function findBlockedByCycles(index) {
  const cycles = [];
  const reported = new Set();
  const done = new Set();
  const onPath = new Map();
  const path = [];

  function canonicalKey(cycle) {
    let smallest = 0;
    for (let i = 1; i < cycle.length; i++) {
      if (cycle[i] < cycle[smallest]) smallest = i;
    }
    return cycle.slice(smallest).concat(cycle.slice(0, smallest)).join('>');
  }

  function visit(slug) {
    if (onPath.has(slug)) {
      const cycle = path.slice(onPath.get(slug));
      const key = canonicalKey(cycle);
      if (!reported.has(key)) {
        reported.add(key);
        cycles.push([...cycle, slug]);
      }
      return;
    }
    if (done.has(slug)) return;

    onPath.set(slug, path.length);
    path.push(slug);
    for (const target of [...index.get(slug).blockedBy].sort()) {
      if (index.has(target)) visit(target);
    }
    path.pop();
    onPath.delete(slug);
    done.add(slug);
  }

  for (const slug of [...index.keys()].sort()) visit(slug);
  return cycles;
}

/**
 * E1 and E2 over the whole corpus.
 *
 * Both rules are about the blocked_by graph and nothing else, so neither is
 * keyed by an epic: a blocker may name any issue in scratch/issues/, in any
 * epic or none, and a cycle through non-spike members is as real as one
 * through spikes.
 *
 * @param {ReturnType<typeof buildIssueIndex>} index
 * @param {{scopeSlug?: string}} [opts]  `scopeSlug` is the hook's narrowing:
 *   E1 then reports only edges leaving that slug, and E2 only cycles passing
 *   through it, so a blocking finding always names a defect in the edit that
 *   just happened. Omit it — the directory sweep — to report every node's
 *   edges and every cycle, once each.
 * @returns {Array<{path: string, problem: string}>} each finding carries the
 *   path of the file that CARRIES the defect, which is what lets the sweep
 *   label it with that file rather than with whichever epic it was iterating.
 */
export function lintBlockedByGraph(index, { scopeSlug } = {}) {
  const findings = [];

  // E1 -- a malformed blocker slug is already E9's finding, so it is skipped
  // here rather than reported a second time as unresolvable.
  for (const node of index.values()) {
    if (scopeSlug !== undefined && node.slug !== scopeSlug) continue;
    for (const target of node.blockedBy) {
      if (!ISSUE_SLUG_PATTERN.test(target)) continue;
      if (!index.has(target)) {
        findings.push({
          path: node.path,
          problem: `${node.slug}: blocked_by ${target} does not resolve to an issue in scratch/issues/`,
        });
      }
    }
  }

  // E2
  for (const cycle of findBlockedByCycles(index)) {
    if (scopeSlug !== undefined && !cycle.includes(scopeSlug)) continue;
    findings.push({
      path: index.get(cycle[0]).path,
      problem: `blocked_by cycle: ${cycle.join(' -> ')}`,
    });
  }

  return findings;
}

/**
 * The Tier 2 rules that genuinely belong to one epic: E3 and E5.
 *
 * E1 and E2 live in lintBlockedByGraph instead — they are corpus-wide and an
 * epic-keyed function cannot express them.
 *
 * Tier 2a (E3) always runs -- D16 clears it for the edit-time hook
 * because D17's create-before-wire order means none of the three can fire
 * during a legitimate intermediate state. Tier 2b (E5) is opt-in because it
 * ALWAYS can: resolving a spike and recording its line in the epic are two
 * edits, and under the single-severity model either order would block one of
 * them. /discovery runs it at session end via the directory branch instead.
 *
 * @param {string} epicSlug
 * @param {Array<{path: string, content: string}>} files  Caller-supplied set.
 * @param {{includeTier2b?: boolean}} [opts]
 * @returns {string[]} one-line problems, empty when clean
 */
export function lintEpicGraph(epicSlug, files, { includeTier2b = false } = {}) {
  const graph = buildEpicGraph(epicSlug, files);
  const problems = [];

  // E3
  if (graph.epic === null) {
    for (const member of graph.members) {
      problems.push(`${member.slug}: epic ${epicSlug} does not resolve to a file carrying role: epic`);
    }
  }

  // E5 (Tier 2b) -- D24: either section satisfies it. A spike ruled past the
  // destination is closed as a scope boundary and belongs under Out of Scope,
  // NOT in Decisions, which records the current route; demanding a
  // Decisions line would falsify that record. With no epic file to read, E3
  // has already reported the real problem.
  if (includeTier2b && graph.epic !== null) {
    const decisions = sectionBody(graph.epic.content, 'Decisions');
    const outOfScope = sectionBody(graph.epic.content, 'Out of Scope');
    for (const member of graph.members) {
      if (member.role !== 'spike' || !ISSUE_SETTLED_STATUSES.includes(member.status)) continue;
      const placed = (decisions !== null && mentionsSlug(decisions, member.slug))
        || (outOfScope !== null && mentionsSlug(outOfScope, member.slug));
      if (!placed) {
        problems.push(`${member.slug}: ${member.status} with no matching line in epic ${epicSlug}'s ## Decisions or ## Out of Scope`);
      }
    }
  }

  return problems;
}

// Given one file's path, which corpus does it belong to? Normalizes `\` to
// `/` first (the same unconditional chokepoint style as relLink's), then
// matches on `/tasks/` or `/issues/`. A directory path gets a trailing `/`
// appended before matching, so `scratch/issues` and `scratch/issues/` both
// resolve. Returns null on no match — a user error at the CLI boundary
// (Step 02a), never a silent default.
export function detectSchema(path) {
  const normalized = String(path).replace(/\\/g, '/');
  const withTrailingSlash = normalized.endsWith('/') ? normalized : `${normalized}/`;
  if (withTrailingSlash.includes('/tasks/')) return 'tasks';
  if (withTrailingSlash.includes('/issues/')) return 'issues';
  return null;
}

// Dispatches to the two rule functions by schema. Kept as two separate
// functions above rather than one parameterized walker — the two rule sets
// share only the required-key loop shape, and merging them would couple two
// schemas that evolve independently.
export function lintFile(filePath, content, schema) {
  if (schema === 'tasks') return lintTaskFile(filePath, content);
  if (schema === 'issues') return lintIssueFile(filePath, content);
  return [];
}

// The one `WARN:` line shape every consumer emits (D11 — single severity).
// The CLI (Step 02a), the `--with-tasks` block (Step 04a), and the hook's
// re-emitted lines (Step 05a) all produce byte-identical strings because
// they all call this — there is no level token, since D11 has no tiers.
export function formatWarning(filePath, problem) {
  return `WARN: ${basename(filePath)}: ${problem}`;
}

// ---------------------------------------------------------------------------
// Groom marker
// ---------------------------------------------------------------------------

/**
 * Read a file without following a symlink at its last segment: a file a verb reads and then
 * rewrites whole would otherwise copy a link's target. Throws as readFileSync does, and
 * ELOOP on a link. Windows has no O_NOFOLLOW; the read follows there.
 */
export function readFileNoFollow(path) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    return readFileSync(fd, 'utf-8');
  } finally {
    closeSync(fd);
  }
}

// groom.yaml's `key: value` lines as an object, in file order. Absent or unreadable is {}.
function markerFields(sessionDir) {
  let content;
  try {
    content = readFileNoFollow(join(sessionDir, GROOM_MARKER_FILENAME));
  } catch {
    return {};
  }
  const fields = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([a-z_]+):\s*(.*?)\s*$/);
    if (m) fields[m[1]] = m[2];
  }
  return fields;
}

function writeMarkerFields(sessionDir, fields) {
  const markerPath = join(sessionDir, GROOM_MARKER_FILENAME);
  writeFileAtomic(markerPath, Object.entries(fields).map(([k, v]) => `${k}: ${v}\n`).join(''));
  return markerPath;
}

/**
 * Write `<sessionDir>/groom.yaml` at TASKS_METHODOLOGY_VERSION via tmp + rename,
 * so a reader never sees a partial marker. Keys it does not own, the event groom's
 * `event_*` marks, are kept. Throws on any filesystem failure, after removing its
 * own tmp file.
 * @returns {string} the marker path
 */
export function writeGroomMarker(sessionDir) {
  const { methodology_version, groomed, ...kept } = markerFields(sessionDir);
  return writeMarkerFields(sessionDir, { methodology_version: TASKS_METHODOLOGY_VERSION, groomed: new Date().toISOString(), ...kept });
}

/**
 * Store an event groom's marks and remainder in groom.yaml, leaving every other key.
 * @param {{code: string, scratch: string, session: string, remainder: Array<{id: string, ref: string}>}} marks
 * @returns {string} the marker path
 */
export function writeEventMarks(sessionDir, { code, scratch, session, remainder }) {
  return writeMarkerFields(sessionDir, {
    ...markerFields(sessionDir),
    event_code: code,
    event_scratch: scratch,
    event_session: session,
    event_remainder: remainder.map(({ id, ref }) => `${id}=${ref}`).join(','),
  });
}

/**
 * The marks the last completed event groom stored, or null when it stored none.
 * @returns {{code: string, scratch: string, session: string, remainder: Array<{id: string, ref: string}>} | null}
 */
export function readEventMarks(sessionDir) {
  const f = markerFields(sessionDir);
  if (!f.event_code || !f.event_scratch || !f.event_session) return null;
  const remainder = (f.event_remainder ?? '').split(',').filter(Boolean).map((pair) => {
    const i = pair.indexOf('=');
    return { id: pair.slice(0, i), ref: pair.slice(i + 1) };
  });
  return { code: f.event_code, scratch: f.event_scratch, session: f.event_session, remainder };
}

/**
 * Write `content` to `path` via a dot-prefixed `.tmp` sibling and a rename, so a
 * reader never sees a partial file. The tmp name ends in `.tmp`, never `.md`,
 * so a corpus scan or lint sweep never reads a leftover. Throws on any
 * filesystem failure, after removing its own tmp file.
 */
export function writeFileAtomic(path, content) {
  const tmpPath = join(dirname(path), `.${basename(path)}-${process.pid}-${randomBytes(4).toString('hex')}.tmp`);
  try {
    writeFileSync(tmpPath, content, { flag: 'wx', encoding: 'utf-8' });
    renameSync(tmpPath, path);
  } catch (err) {
    try { unlinkSync(tmpPath); } catch {}
    throw err;
  }
}

/**
 * Read `<sessionDir>/groom.yaml`. Returns null when the file is absent or
 * unparseable: a missing or non-integer methodology_version, or no groomed value.
 * @returns {{methodology_version: number, groomed: string} | null}
 */
export function readGroomMarker(sessionDir) {
  const fields = markerFields(sessionDir);
  if (!/^[1-9]\d*$/.test(fields.methodology_version ?? '') || !fields.groomed) return null;
  return { methodology_version: Number(fields.methodology_version), groomed: fields.groomed };
}

/**
 * List `dir`'s entries that pass `predicate`, sorted. A missing directory is empty.
 * @throws {Error} with .code 'FS_READ' when the directory exists but cannot be read
 */
export function listOrThrow(dir, predicate) {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir).filter(predicate).sort();
  } catch (err) {
    const wrapped = new Error(`Failed to read directory ${dir}: ${err.message}`);
    wrapped.code = 'FS_READ';
    throw wrapped;
  }
}

/**
 * True when `folder` holds no `sessions/*.md`, no `tasks/t-*.md` and no HANDOFF.md.
 * Such a workstream has no history older than the current task methodology, so
 * its first durable write stamps groom.yaml. HANDOFF.md alone marks a folder
 * hand-written before the per-session log, which is history groom must see.
 * @throws {Error} with .code 'FS_READ' on any read error other than ENOENT
 */
export function isNewWorkstream(folder) {
  if (listOrThrow(join(folder, 'sessions'), (n) => n.endsWith('.md')).length > 0) return false;
  if (listOrThrow(join(folder, 'tasks'), (n) => n.startsWith(TASK_FILE_GLOB_PREFIX) && n.endsWith('.md')).length > 0) return false;
  const pointerPath = join(folder, 'HANDOFF.md');
  try {
    statSync(pointerPath);
    return false;
  } catch (err) {
    if (err.code === 'ENOENT') return true;
    const wrapped = new Error(`Failed to read ${pointerPath}: ${err.message}`);
    wrapped.code = 'FS_READ';
    throw wrapped;
  }
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

function emptyScan() {
  return { tasks: [], rows: [], closed: { done: 0, dropped: 0, promoted: 0 }, warnings: [] };
}

/**
 * Scan a workstream's tasks/ directory: lint every `t-*.md` file, parse what
 * is present into a task record, and produce both the complete record array
 * and the render-ready open-rows subset.
 *
 * @param {string} sessionDir  The workstream folder (e.g. scratch/S-x/).
 * @param {object} [opts]
 * @param {Date} [opts.now]  Pins the age math for deterministic tests.
 *   Production callers omit it (defaults to the real current time).
 * @param {string[]|null} [opts.entries]  Replaces the directory listing so
 *   the mid-scan-ENOENT path (a listed file that vanishes before its read)
 *   can be exercised deterministically, without a real filesystem race.
 *   Production callers omit it (the real directory listing is used).
 * @returns {{tasks: object[], rows: object[], closed: {done: number, dropped: number, promoted: number}, warnings: string[]}}
 */
export function scanTasks(sessionDir, { now = new Date(), entries = null } = {}) {
  const tasksDir = join(sessionDir, 'tasks');

  let dirEntries;
  if (entries !== null) {
    dirEntries = entries;
  } else {
    if (!existsSync(tasksDir)) {
      return emptyScan();
    }
    try {
      dirEntries = readdirSync(tasksDir);
    } catch (err) {
      const wrapped = new Error(`Failed to read tasks directory: ${tasksDir}: ${err.message}`);
      wrapped.code = 'FS_READ';
      throw wrapped;
    }
  }

  // Only 't-'-prefixed, '.md'-suffixed entries are ever read (spec
  // Contracts, write_task's write-atomicity clause) — the dot-prefixed tmp
  // file write_task renames from fails this filter twice over (wrong
  // leading character, wrong suffix), so it is structurally invisible here,
  // not merely absent by timing. Sorted ASC so both the warning order and
  // the id-ASC sort tiebreak are stable across filesystems.
  const taskFileNames = dirEntries
    .filter((name) => name.startsWith(TASK_FILE_GLOB_PREFIX) && name.endsWith('.md'))
    .sort();

  const tasks = [];
  const warnings = [];
  const closed = { done: 0, dropped: 0, promoted: 0 };

  for (const entryName of taskFileNames) {
    const fullPath = join(tasksDir, entryName);
    let content;
    try {
      // Encoding is load-bearing: without it readFileSync returns a Buffer,
      // and hasFrontmatterBlock/lintTaskFile/unquote are all string-regex
      // operations that throw on a Buffer.
      content = readFileSync(fullPath, 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') continue; // vanished between listing and read — skip, never abort the scan
      const wrapped = new Error(`Failed to read task file: ${fullPath}: ${err.message}`);
      wrapped.code = 'FS_READ';
      throw wrapped;
    }

    for (const problem of lintTaskFile(fullPath, content)) {
      warnings.push(formatWarning(fullPath, problem));
    }

    const fm = parseFrontmatter(content);
    const status = fm.status;
    const record = {
      id: fm.id,
      title: fm.title !== undefined ? unquote(fm.title) : undefined,
      status,
      ...(fm.blocked_on ? { blocked_on: unquote(fm.blocked_on) } : {}),
      created: fm.created,
      updated: fm.updated,
      age_days: taskAgeDays(fm.updated, now),
      file: `tasks/${entryName}`,
    };
    tasks.push(record);

    if (status === 'done' || status === 'dropped' || status === 'promoted') {
      closed[status]++;
    }
  }

  const statusOrder = { blocked: 0, open: 1 };
  const rows = tasks
    .filter((t) => TASK_OPEN_STATUSES.includes(t.status))
    .sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      // Unparseable `updated:` sorts last within its group (age treated as -1).
      const ageA = a.age_days === null ? -1 : a.age_days;
      const ageB = b.age_days === null ? -1 : b.age_days;
      if (ageA !== ageB) return ageB - ageA; // larger age_days (oldest) first
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  return { tasks, rows, closed, warnings };
}

// UTC calendar-day age of an `updated:` timestamp — same predicate Step 05a's
// H1 hook rule enforces ("today" means same UTC date, not "within 24h").
export function taskAgeDays(updatedIso, now) {
  const parsed = Date.parse(updatedIso);
  if (Number.isNaN(parsed)) return null;
  const up = new Date(parsed);
  const diffDays = Math.round(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      Date.UTC(up.getUTCFullYear(), up.getUTCMonth(), up.getUTCDate())) /
      86400000
  );
  // A future-dated `updated:` clamps to 0 rather than rendering a negative age.
  return Math.max(0, diffDays);
}

export function renderAge(ageDays) {
  if (ageDays === 0) return 'updated today';
  if (ageDays === null) return 'updated unknown';
  return `updated ${ageDays}d ago`;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/**
 * Render the `## Tasks` block. One renderer for both consumers (D2 + T4) —
 * the `tasks list` CLI verb (Step 02a) and the session-log CLI's
 * `--with-tasks` flag (Step 04a) must never be able to drift apart.
 *
 * The blank line between the heading and the first row is deliberate
 * (sibling-block parity with the other derived blocks) — the
 * sed-extraction hazard documented in the claude-code-ref-expert wiki's
 * handoff/cat-sessions-section-format page therefore applies to this block too: anyone
 * sed-extracting `## Tasks` must expect the blank line and bound extraction
 * to the next `## `-level heading rather than to the first blank line.
 */
export function renderTasksBlock(scan) {
  const lines = ['## Tasks', ''];

  if (scan.rows.length === 0) {
    lines.push('- none');
  } else {
    for (const t of scan.rows) {
      const cleanTitle = String(t.title ?? '').replace(/[\r\n]+/g, ' ');
      const hasBlockedOn = t.status === 'blocked' && !!t.blocked_on;
      const statusClause = hasBlockedOn
        ? `blocked on: ${String(t.blocked_on).replace(/[\r\n]+/g, ' ')}`
        : t.status;
      lines.push(`- [${t.id}] ${cleanTitle} (${statusClause}, ${renderAge(t.age_days)})`);
    }
  }

  const { done, dropped, promoted } = scan.closed;
  if (done + dropped + promoted > 0) {
    lines.push('');
    lines.push(`${done} done, ${dropped} dropped, ${promoted} promoted — see tasks/`);
  }

  if (scan.warnings.length > 0) {
    lines.push('');
    for (const w of scan.warnings) lines.push(w);
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------
//
// `tasks list <session-dir>` prints the `## Tasks` block for a workstream —
// the same renderer the `/pickup` resume brief uses (spec T4, D2). `tasks
// lint <path>` lints a file or a directory with the rule set auto-detected
// from the path. Both take exactly one positional argument and share the
// same scratch-sandbox containment check `cat-sessions` applies.

// Exit-code constants — reference EXIT.* at every process.exit() call-site;
// no raw integer exits anywhere below. Kept as a literal here rather than
// imported from cat-sessions.mjs (mirroring cat-sessions.mjs:23's contract
// by reference, not by import) — tasks.mjs must not depend on
// cat-sessions.mjs, since Step 04a makes the edge point the other way
// (cat-sessions.mjs importing from tasks.mjs).
export const EXIT = { SUCCESS: 0, USER_ERROR: 1, INFRA_ERROR: 2 };

const TASKS_HELP = `Usage: scratch-memory tasks <subcommand> [options]

Lint and inspect workstream task files (scratch/S-*/tasks/) and the
scratch/issues/ corpus, sharing one rule engine and one '## Tasks' block
renderer with the /pickup resume brief.

Subcommands:
  list <session-dir>   Print the '## Tasks' block for a workstream (the same
                        renderer the /pickup resume brief uses).
  lint <path>           Lint a file or a directory (non-recursive, sorted by
                        basename) with the rule set auto-detected from the
                        path: a /tasks/ segment lints the tasks rules
                        (T1-T9), a /issues/ segment lints the issues rules
                        (I0-I10). A path matching neither is a user error,
                        never a silent default. Two standing exemptions cover
                        files predating the MCP writer: one for a file with no
                        frontmatter block at all (D12), and one narrower --
                        the six provenance keys are demanded only of files
                        carrying 'tool: write_issue'. Neither ever produces a
                        finding, and nothing is backfilled to satisfy them.
  done <session-dir> <task-id> --note <text>
                        Close one workstream task: set status: done, stamp
                        updated: with a full ISO UTC timestamp, and append
                        '- YYYY-MM-DD: <text>' as the last body line. Every
                        other line is left as it is. Accepts a task whose
                        status is open or blocked; any other status, including
                        done (a re-close), is exit 1. Prints the task's
                        absolute path, then its 'Done when:' line, or
                        'Done when: (none)'. Runs no lint and no git.
  version               Print TASKS_METHODOLOGY_VERSION, the task methodology
                        version a workstream's groom.yaml is compared against.
  schema [--json]       Print the issues vocabularies -- statuses, the settled
                        subset, severities, kinds, roles, spike types, the
                        required and provenance key lists, and the title
                        bound. This file is their single source (D10); a
                        consumer in another repository reads them here instead
                        of keeping a copy that can silently diverge. Defaults
                        to JSON; --json is accepted and is the same output.

Arguments:
  session-dir   The workstream folder for 'list' and 'done' (e.g.
                scratch/S-my-session/). Must be inside the project's scratch/
                directory; for 'done' it must also be named S-<id>.
  task-id       The task's id for 'done', t- plus 6 hex digits. Exactly one
                <session-dir>/tasks/<task-id>-*.md must exist.
  path          The file or directory for 'lint'. Must be inside the
                project's scratch/ directory. Target semantics: a missing
                DIRECTORY target (the path ends in a separator, or names no
                .md file) is zero findings and exit 0 -- a workstream with no
                tasks/ yet is the common case, not an error. A missing FILE
                target (a path naming a .md file that does not exist) is
                exit 1 -- a mistyped path stays loud.

Options:
  --note <text> Required for 'done': the dated note. A newline in it becomes
                a space.
  -h, --help    Show this help.
  --            Stop flag parsing; the next token is the positional argument
                (lets a path beginning with '-' be passed).

Output:
  lint findings go to stdout, one per line: WARN: <file-basename>: <problem>.
  Errors (argument or infrastructure) go to stderr: ERROR: <message>. Exit 1
  is overloaded: it means "findings" when stdout is non-empty and "argument
  error" when stderr is non-empty -- check the stream, not just the code.
  A directory sweep of scratch/issues/ also parses every mermaid block with
  mermaid-check; when that validator is absent or exits 69 it prints
  "Mermaid check skipped" on stderr and leaves the exit code alone.

Exit codes:
  0  success (list; schema; version; done; lint with zero findings; lint on a missing directory target)
  1  lint findings, or a user/argument error -- see Output above for how to tell them apart
  2  infrastructure error (FS read failure; a write failure for done)
`;

// `schema` — print the vocabularies as JSON on stdout. No positional, and
// `--json` is accepted only so a caller can be explicit; the output does not
// vary, because a second format would be a second thing to keep in step.
function cmdSchema(argv) {
  for (const a of argv) {
    if (a !== '--json') {
      process.stderr.write(`ERROR: unknown option: ${a}\n`);
      process.exit(EXIT.USER_ERROR);
    }
  }
  process.stdout.write(JSON.stringify(issuesSchema(), null, 2) + '\n');
}

// `version` — print the methodology version integer. Takes no arguments.
function cmdVersion(argv) {
  if (argv.length > 0) {
    process.stderr.write(`ERROR: unexpected argument: ${argv[0]}\n`);
    process.exit(EXIT.USER_ERROR);
  }
  process.stdout.write(`${TASKS_METHODOLOGY_VERSION}\n`);
}

// Parse a single positional argument, honoring `--` as a stop-flags token
// (cat-sessions.mjs:639) so a path beginning with '-' is still reachable.
// Shared by `list` and `lint` — both take exactly one positional and define
// no flags of their own besides `--`.
function parseSinglePositional(argv) {
  let stopFlags = false;
  let positional = null;
  for (const a of argv) {
    if (!stopFlags && a === '--') { stopFlags = true; continue; }
    if (!stopFlags && a.startsWith('-')) {
      return { positional: null, error: `unknown option: ${a}` };
    }
    if (positional !== null) {
      return { positional: null, error: 'too many positional arguments' };
    }
    positional = a;
  }
  return { positional, error: null };
}

// Resolve a positional path argument and enforce the scratch-sandbox
// containment `cat-sessions` applies (cat-sessions.mjs:732-742): the
// resolved path must fall inside <project-root>/scratch/. Shared by `list`
// and `lint` (Actions: "same sandbox containment check as list"). Exits
// USER_ERROR — writing only to stderr — on any failure, so callers can treat
// the return value as always resolved.
export function resolveInScratchSandbox(rawArg, argLabel) {
  let projectRoot;
  try {
    projectRoot = resolveProjectRoot();
  } catch (err) {
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exit(EXIT.USER_ERROR);
  }

  // `scratch/` is itself a git repo in this layout, so resolveProjectRoot()
  // returns the scratch subrepo whenever cwd is inside it — and joining
  // 'scratch' onto that yields `scratch/scratch/`, which no real path matches.
  // When the walk already landed on the scratch directory, it IS the sandbox.
  const scratchRoot =
    basename(projectRoot) === 'scratch' ? projectRoot : join(projectRoot, 'scratch');
  const resolvedPath = resolve(rawArg);

  if (!resolvedPath.startsWith(scratchRoot + sep)) {
    process.stderr.write(
      `ERROR: OUT_OF_SANDBOX_PATH: ${argLabel} must be inside project scratch root\n` +
      `  expected prefix: ${scratchRoot + sep}\n` +
      `  resolved: ${resolvedPath}\n`
    );
    process.exit(EXIT.USER_ERROR);
  }

  return resolvedPath;
}

// tasks list <session-dir>
async function cmdList(argv) {
  const { positional, error } = parseSinglePositional(argv);
  if (error) {
    process.stderr.write(`ERROR: ${error}\n`);
    process.exit(EXIT.USER_ERROR);
  }
  if (positional === null) {
    process.stderr.write('ERROR: missing <session-dir>\n');
    process.exit(EXIT.USER_ERROR);
  }

  const resolvedDir = resolveInScratchSandbox(positional, 'session-dir');

  // A missing tasks/ directory is not an error — scanTasks already returns
  // the empty scan for it, and renderTasksBlock renders the '- none' block.
  // This matters because /handoff Step 1c (and any mid-session use) must
  // tolerate a workstream that has never had a task.
  let scan;
  try {
    scan = scanTasks(resolvedDir);
  } catch (err) {
    if (err.code === 'FS_READ') {
      process.stderr.write(`ERROR: ${err.message}\n`);
      process.exit(EXIT.INFRA_ERROR);
    }
    throw err;
  }

  // process.exitCode (not process.exit()) so stdout drains fully on a pipe
  // before the process tears down — the same discipline `lint` follows below.
  process.stdout.write(renderTasksBlock(scan));
  process.exitCode = EXIT.SUCCESS;
}

// Read the issues corpus as the `{path, content}` set the pure graph functions
// take. Every `*.md` is handed over rather than pre-filtered by frontmatter:
// the pure traversal already decides membership, and doing it here would be a
// second implementation of that predicate. The unfiltered read is also what
// lets a blocker resolve to any issue in the corpus, in any epic or none.
//
// A missing corpus directory returns the empty set rather than failing. At the
// hook that is the safer half of the choice -- a deleted-directory race must
// not block an edit -- and `epics frontier` falls through it to the same "no
// such epic" error a mistyped slug gets. Every other readdir failure is loud.
//
// Lives here beside the other I/O; epics.mjs imports it the way it already
// imports buildEpicGraph.
export function readIssuesCorpus(dir) {
  let entryNames;
  try {
    entryNames = readdirSync(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exit(EXIT.INFRA_ERROR);
  }

  const files = [];
  for (const name of entryNames.filter((n) => n.endsWith('.md')).sort()) {
    const fullPath = join(dir, name);
    try {
      // Encoding is load-bearing: without it readFileSync returns a Buffer,
      // and the graph's helpers are string operations that throw on one.
      files.push({ path: fullPath, content: readFileSync(fullPath, 'utf-8') });
    } catch (err) {
      // A file listed and then removed before its read is a race, not a
      // finding -- scanTasks tolerates the same ENOENT for the same reason.
      // Anything else is genuine infrastructure trouble and stays loud.
      if (err.code === 'ENOENT') continue;
      process.stderr.write(`ERROR: ${err.message}\n`);
      process.exit(EXIT.INFRA_ERROR);
    }
  }
  return files;
}

// D19's Tier 2a invocation. `tasks lint {file}` runs the graph rules itself:
// scratch-lint.sh's `*/scratch/issues/*.md` path gate already covers every
// epic and spike and it already delegates here, so routing the graph rules
// through this call needs no bash-side frontmatter parsing and no second
// delegate call -- which is why the hook is not modified at all.
//
// This function owns the I/O the pure rules refuse to do. Tier 2b is NOT
// requested: this is the hook's path, and E5 always fires during a legitimate
// intermediate state (D16).
function lintFileEpicGraphs(filePath, content) {
  if (!hasFrontmatterBlock(content)) return [];
  const fm = parseFrontmatter(content);
  // `blocked_by:` alone gives a file graph edges, so it opens this gate on its
  // own. A file carrying none of the three has no edges and no epic, and
  // returns before anything is read.
  if (fm.role === undefined && fm.epic === undefined && fm.blocked_by === undefined) return [];

  const epicSlugs = new Set(splitSlugList(fm.epic).filter((slug) => slug !== ''));
  if (fm.role !== undefined && fm.role.trim() === 'epic') {
    epicSlugs.add(slugOf(filePath, fm));
  }

  const corpus = readIssuesCorpus(dirname(filePath));
  const index = buildIssueIndex(corpus);
  const problems = [];

  // The corpus-wide pass runs ONCE, outside the per-epic loop and regardless
  // of whether this file claims an epic at all: it is keyed by the index and a
  // slug, never by an epic, so a file belonging to no epic still gets its rules
  // and a file claiming two epics reports one finding rather than two.
  // scopeSlug is the narrowing that keeps a stale edge elsewhere in the corpus
  // from blocking this edit.
  for (const finding of lintBlockedByGraph(index, { scopeSlug: slugOf(filePath, fm) })) {
    problems.push(finding.problem);
  }

  // An empty epicSlugs set skips only this loop.
  for (const epicSlug of [...epicSlugs].sort()) {
    problems.push(...lintEpicGraph(epicSlug, corpus));
  }
  return problems;
}

// Tier 2b (E5) runs ONLY here (D16). The directory branch is /discovery's
// session-end sweep, where a spike and its epic have both settled, so the
// intermediate state that makes E5 unfit for the hook cannot be observed.
// No I/O: the caller already read every file for the per-file rules.
function lintDirectoryEpicGraphs(dir, files) {
  const epicSlugs = new Set();
  for (const file of files) {
    if (!hasFrontmatterBlock(file.content)) continue;
    const fm = parseFrontmatter(file.content);
    if (fm.role !== undefined && fm.role.trim() === 'epic') {
      epicSlugs.add(slugOf(file.path, fm));
    }
    for (const slug of splitSlugList(fm.epic)) {
      if (slug !== '') epicSlugs.add(slug);
    }
  }

  const warnings = [];

  // The corpus-wide pass runs outside the per-epic loop, over every file the
  // sweep read — which is what reaches a file belonging to no epic, the exact
  // shape the per-epic loop below cannot see. Each finding is labeled with the
  // path of the file that carries the defect, not with the epic.
  for (const finding of lintBlockedByGraph(buildIssueIndex(files))) {
    warnings.push(formatWarning(finding.path, finding.problem));
  }

  for (const epicSlug of [...epicSlugs].sort()) {
    // Findings name their own subject spike, so the file label is the epic
    // they belong to -- a synthesized `{slug}.md` when the missing epic file
    // is the very thing being reported (E3). buildEpicGraph resolves that
    // rather than a second copy of the "is this the epic file" predicate.
    const label = buildEpicGraph(epicSlug, files).epic?.path ?? join(dir, `${epicSlug}.md`);
    for (const problem of lintEpicGraph(epicSlug, files, { includeTier2b: true })) {
      warnings.push(formatWarning(label, problem));
    }
  }
  return warnings;
}

// M1 runs ONLY here, on the sweep: a DOM startup per edit would slow the
// per-file hook. Each file holding a mermaid fence goes to `mermaid-check`
// on PATH. An absent validator, or its exit 69, is a stderr note and never
// a finding, so a skipped check neither passes nor fails the sweep.
const MERMAID_FENCE = /^ {0,3}(`{3,}|~{3,})\s*mermaid/m;
function lintDirectoryMermaid(files) {
  const paths = files
    .filter((f) => hasFrontmatterBlock(f.content) && MERMAID_FENCE.test(f.content))
    .map((f) => f.path);
  if (paths.length === 0) return [];
  // No shell: a file name reaches mermaid-check as one argument, never as
  // cmd.exe syntax. Where PATH holds no runnable mermaid-check (a Windows
  // install has only the extensionless bash wrapper), the spawn fails and the
  // check reads as skipped.
  const r = spawnSync('mermaid-check', paths, { encoding: 'utf-8' });
  if (r.status !== 0 && r.status !== 1) {
    process.stderr.write('Mermaid check skipped\n');
    return [];
  }
  const warnings = [];
  for (const line of r.stdout.split('\n')) {
    const path = paths.find((p) => line.startsWith(`${p}:`));
    if (!path) continue;
    const m = /^(\d+): (.*)$/.exec(line.slice(path.length + 1));
    if (m) warnings.push(formatWarning(path, `mermaid parse failure at line ${m[1]}: ${m[2]}`));
  }
  return warnings;
}

// tasks lint <path>
async function cmdLint(argv) {
  const { positional, error } = parseSinglePositional(argv);
  if (error) {
    process.stderr.write(`ERROR: ${error}\n`);
    process.exit(EXIT.USER_ERROR);
  }
  if (positional === null) {
    process.stderr.write('ERROR: missing <path>\n');
    process.exit(EXIT.USER_ERROR);
  }

  const resolvedPath = resolveInScratchSandbox(positional, 'path');

  // Never guess a default schema — a wrong schema would emit a full page of
  // bogus findings.
  const schema = detectSchema(resolvedPath);
  if (schema === null) {
    process.stderr.write(
      `ERROR: cannot detect schema from path: ${positional} (expected a path under /tasks/ or /issues/)\n`
    );
    process.exit(EXIT.USER_ERROR);
  }

  // statSync answers what the target IS. A missing target (ENOENT) falls
  // through to the D16 target-semantics branch below, which answers a
  // different question — what the argument's own shape (trailing separator,
  // .md suffix) says the target WAS MEANT TO BE. The two checks must not be
  // collapsed into one (decisions.md D16).
  let stat;
  try {
    stat = statSync(resolvedPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      process.stderr.write(`ERROR: ${err.message}\n`);
      process.exit(EXIT.INFRA_ERROR);
    }

    // D16: a missing DIRECTORY target (trailing separator, or no .md
    // suffix) is zero findings / exit 0 / no output at all — mirroring
    // `list`'s treatment of the identical real-world condition, a
    // workstream with no tasks/ yet, which is the common case, not an
    // error. A missing FILE target (a path naming a .md file that isn't
    // there) stays a loud USER_ERROR — a mistyped path is a real mistake.
    // Do not "fix" the directory half back into an error later.
    const endsWithSep = positional.endsWith('/') || positional.endsWith('\\');
    const looksLikeFile = !endsWithSep && positional.endsWith('.md');
    if (!looksLikeFile) {
      process.exitCode = EXIT.SUCCESS;
      return;
    }
    process.stderr.write(`ERROR: no such file or directory: ${positional}\n`);
    process.exit(EXIT.USER_ERROR);
  }

  const warnings = [];

  if (stat.isFile()) {
    let content;
    try {
      // Encoding is load-bearing: without it readFileSync returns a Buffer,
      // and lintFile's helpers are string-regex operations that throw on one.
      content = readFileSync(resolvedPath, 'utf-8');
    } catch (err) {
      process.stderr.write(`ERROR: ${err.message}\n`);
      process.exit(EXIT.INFRA_ERROR);
    }
    for (const problem of lintFile(resolvedPath, content, schema)) {
      warnings.push(formatWarning(resolvedPath, problem));
    }
    if (schema === 'issues') {
      for (const problem of lintFileEpicGraphs(resolvedPath, content)) {
        warnings.push(formatWarning(resolvedPath, problem));
      }
    }
  } else if (stat.isDirectory()) {
    let entryNames;
    try {
      entryNames = readdirSync(resolvedPath);
    } catch (err) {
      process.stderr.write(`ERROR: ${err.message}\n`);
      process.exit(EXIT.INFRA_ERROR);
    }

    // Non-recursive; sorted ASC for deterministic output. The tasks schema
    // reads only `t-*.md` (matching scanTasks' filter — write_task's
    // dot-prefixed tmp is invisible here too); the issues schema reads
    // every `*.md`.
    const names = entryNames
      .filter((name) => (schema === 'tasks'
        ? name.startsWith(TASK_FILE_GLOB_PREFIX) && name.endsWith('.md')
        : name.endsWith('.md')))
      .sort();

    // Contents are retained for the issues schema so the graph rules run
    // over the set already in hand rather than reading the directory twice.
    const scanned = [];
    for (const name of names) {
      const fullPath = join(resolvedPath, name);
      let content;
      try {
        content = readFileSync(fullPath, 'utf-8');
      } catch (err) {
        // A read failure on one file (EACCES, EISDIR) is an infrastructure
        // condition, not a schema finding — do not swallow it into a WARN
        // line; Step 05a's hook maps the two to different hook exits.
        process.stderr.write(`ERROR: ${err.message}\n`);
        process.exit(EXIT.INFRA_ERROR);
      }
      for (const problem of lintFile(fullPath, content, schema)) {
        warnings.push(formatWarning(fullPath, problem));
      }
      if (schema === 'issues') scanned.push({ path: fullPath, content });
    }
    if (schema === 'issues') {
      warnings.push(...lintDirectoryEpicGraphs(resolvedPath, scanned));
      warnings.push(...lintDirectoryMermaid(scanned));
    }
  } else {
    process.stderr.write(`ERROR: not a file or directory: ${resolvedPath}\n`);
    process.exit(EXIT.INFRA_ERROR);
  }

  // Single buffered write — scratch/issues/ is 128 files today and a bad run
  // could emit hundreds of lines; one process.stdout.write call plus the
  // exitCode discipline below is what keeps output from truncating past the
  // pipe buffer (cat-sessions.mjs:613-626, :766-772).
  if (warnings.length > 0) {
    process.stdout.write(warnings.join('\n') + '\n');
  }
  // Do not call process.exit() on this path — it can terminate before
  // stdout flushes on a pipe. Setting process.exitCode and returning lets
  // Node drain stdout naturally.
  process.exitCode = warnings.length > 0 ? EXIT.USER_ERROR : EXIT.SUCCESS;
}

const DONE_USAGE = 'usage: scratch-memory tasks done <session-dir> <task-id> --note <text>';
const TASK_ID_PATTERN = /^t-[0-9a-f]{6}$/;
const DONE_FROM_STATUSES = ['open', 'blocked'];

function fail(exit, message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(exit);
}

// tasks done <session-dir> <task-id> --note <text>
// Line-level edit: only `status:` and `updated:` change in the frontmatter, and
// the note is appended as the last body line, so every other line is untouched.
function cmdDone(argv) {
  const positionals = [];
  let note = null;
  let stopFlags = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!stopFlags && a === '--') { stopFlags = true; continue; }
    if (!stopFlags && a === '--note') {
      if (i + 1 >= argv.length) fail(EXIT.USER_ERROR, '--note needs a value');
      note = argv[++i];
      continue;
    }
    if (!stopFlags && a.startsWith('-')) fail(EXIT.USER_ERROR, `unknown option: ${a}`);
    positionals.push(a);
  }
  if (positionals.length < 2) {
    fail(EXIT.USER_ERROR, `${DONE_USAGE} (missing ${positionals.length === 0 ? '<session-dir>' : '<task-id>'})`);
  }
  if (positionals.length > 2) fail(EXIT.USER_ERROR, `${DONE_USAGE} (too many positional arguments)`);
  const [dirArg, taskId] = positionals;

  const sessionDir = resolveInScratchSandbox(dirArg, 'session-dir');
  let isDir = false;
  try { isDir = statSync(sessionDir).isDirectory(); } catch {}
  if (!isDir) fail(EXIT.USER_ERROR, `not a directory: ${dirArg}`);
  if (!/^S-[A-Za-z0-9._-]+$/.test(basename(sessionDir))) {
    fail(EXIT.USER_ERROR, `not a workstream folder (S-<id>): ${dirArg}`);
  }
  // The sandbox check is lexical; a symlinked folder could still land the write outside scratch/.
  const projectRoot = resolveProjectRoot();
  const scratchRoot = basename(projectRoot) === 'scratch' ? projectRoot : join(projectRoot, 'scratch');
  if (!realpathSync(sessionDir).startsWith(realpathSync(scratchRoot) + sep)) {
    fail(EXIT.USER_ERROR, `OUT_OF_SANDBOX_PATH: session-dir resolves outside the project scratch root: ${dirArg}`);
  }

  if (!TASK_ID_PATTERN.test(taskId)) fail(EXIT.USER_ERROR, `invalid task id: ${taskId} (must match ${TASK_ID_PATTERN.source})`);
  const noteText = (note ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (noteText === '') fail(EXIT.USER_ERROR, `--note is required and must be non-empty; ${DONE_USAGE}`);

  const tasksDir = join(sessionDir, 'tasks');
  let matches;
  try {
    matches = listOrThrow(tasksDir, (name) => name.startsWith(`${taskId}-`) && name.endsWith('.md'));
  } catch (err) {
    fail(EXIT.INFRA_ERROR, err.message);
  }
  if (matches.length === 0) fail(EXIT.USER_ERROR, `no task ${taskId} in ${sessionDir}`);
  if (matches.length > 1) {
    fail(EXIT.USER_ERROR, `task id ${taskId} matches ${matches.length} files:\n${matches.map((m) => `  ${join(tasksDir, m)}`).join('\n')}`);
  }
  const taskPath = join(tasksDir, matches[0]);
  // The session-dir check does not cover a tasks/ or task file that is itself a symlink out of scratch/.
  if (!realpathSync(taskPath).startsWith(realpathSync(scratchRoot) + sep)) {
    fail(EXIT.USER_ERROR, `OUT_OF_SANDBOX_PATH: task file resolves outside the project scratch root: ${taskPath}`);
  }

  let content;
  try {
    content = readFileSync(taskPath, 'utf-8');
  } catch (err) {
    fail(EXIT.INFRA_ERROR, `cannot read ${taskPath}: ${err.message}`);
  }
  const lines = content.split('\n');
  const close = lines.indexOf('---', 1);
  if (!hasFrontmatterBlock(content) || close === -1) fail(EXIT.USER_ERROR, `no frontmatter block in ${taskPath}`);
  const doneWhen = lines.slice(close + 1).find((l) => l.startsWith('Done when:')) ?? 'Done when: (none)';

  const statusIdx = lines.findIndex((l, i) => i < close && /^status:/.test(l));
  const status = statusIdx === -1 ? '(none)' : unquote(lines[statusIdx].slice('status:'.length).trim());
  if (!DONE_FROM_STATUSES.includes(status)) {
    fail(EXIT.USER_ERROR, `task ${taskId} has status ${status}; tasks done accepts ${DONE_FROM_STATUSES.join('|')}`);
  }

  const now = new Date();
  lines[statusIdx] = 'status: done';
  const updatedIdx = lines.findIndex((l, i) => i < close && /^updated:/.test(l));
  if (updatedIdx === -1) lines.splice(close, 0, `updated: ${now.toISOString()}`);
  else lines[updatedIdx] = `updated: ${now.toISOString()}`;
  let next = lines.join('\n');
  if (!next.endsWith('\n')) next += '\n';
  next += `- ${now.toISOString().slice(0, 10)}: ${noteText}\n`;

  try {
    writeFileAtomic(taskPath, next);
  } catch (err) {
    fail(EXIT.INFRA_ERROR, `failed to write ${taskPath}: ${err.message}`);
  }

  process.stdout.write(`${taskPath}\n${doneWhen}\n`);
  process.exitCode = EXIT.SUCCESS;
}

// dispatch — top-level router for the `tasks` verb group.
export async function dispatch(argv) {
  const verb = argv[0];

  if (verb === '-h' || verb === '--help') {
    process.stdout.write(TASKS_HELP);
    process.exit(EXIT.SUCCESS);
  }

  if (!verb) {
    process.stderr.write('ERROR: missing subcommand\n\n');
    process.stderr.write(TASKS_HELP);
    process.exit(EXIT.USER_ERROR);
  }

  const subArgv = argv.slice(1);

  switch (verb) {
    case 'list':
      await cmdList(subArgv);
      break;
    case 'lint':
      await cmdLint(subArgv);
      break;
    case 'schema':
      cmdSchema(subArgv);
      break;
    case 'version':
      cmdVersion(subArgv);
      break;
    case 'done':
      cmdDone(subArgv);
      break;
    default:
      process.stderr.write(`ERROR: unknown tasks subcommand: ${verb}\n\n`);
      process.stderr.write(TASKS_HELP);
      process.exit(EXIT.USER_ERROR);
  }
}

export default dispatch;

// ---------------------------------------------------------------------------
// Entry-point guard — forward to dispatch() on direct invocation (`node
// tasks.mjs ...`), not just when imported by scratch-memory.mjs. Without
// this, direct invocation silently exits 0 with no output (issue:
// verb-modules-silent-noop-direct-invocation).
// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dispatch(process.argv.slice(2)).catch(err => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(2);
  });
}
