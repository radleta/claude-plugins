#!/usr/bin/env node
// tasks.mjs — shared module + CLI verb group for the workstream tasks system
//
// This module owns four responsibilities: the two per-corpus lint rule sets
// (tasks + issues), the tasks/ directory scan, the `## Tasks` block renderer,
// and the `tasks` CLI dispatch (list / lint).
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
//   ISSUE_STATUSES            — issues `status` enum
//   ISSUE_ROLES               — issues `role` enum (epic | spike); server.mjs imports this
//   SPIKE_TYPES               — issues `spike_type` enum; server.mjs imports this
//   ISSUE_SLUG_PATTERN        — corpus slug charset, shared by the E-rules and the writer
//   MAX_TITLE_LEN              — shared title length bound (T9 / I5)
//   MAX_BLOCKED_ON_LEN          — `blocked_on` length bound (writer imports this)
//   TASK_FILE_GLOB_PREFIX       — the `t-` scanner filter prefix
//   hasFrontmatterBlock(content)              — D12 gate: first line is `---`
//   unquote(value)                            — reverse write_issue's title escaping
//   lintTaskFile(filePath, content)           — T1-T9 rule set
//   lintIssueFile(filePath, content)          — I0-I9 + Tier 1 E-rule set
//   splitSlugList(value)                      — comma-separated scalar -> string[]
//   buildEpicGraph(epicSlug, files)           — the one epic/spike traversal (pure)
//   frontierSpikes(graph)                     — ready spike slugs, sorted (pure)
//   lintEpicGraph(epicSlug, files, opts?)     — Tier 2a (E1-E3) + optional Tier 2b (E5)
//   detectSchema(path)                        — 'tasks' | 'issues' | null
//   lintFile(filePath, content, schema)       — dispatch to the right rule set
//   formatWarning(filePath, problem)          — the one `WARN:` line shape
//   scanTasks(sessionDir, opts)               — the workstream tasks/ scan
//   taskAgeDays(updatedIso, now)              — UTC calendar-day age
//   renderAge(ageDays)                        — 'updated today' / 'Nd ago' / 'unknown'
//   renderTasksBlock(scan)                    — the `## Tasks` block string
//   EXIT                                      — exit-code constants (mirrors cat-sessions.mjs:23)
//   dispatch(argv)                            — `tasks list` / `tasks lint` CLI entry point
//
// Everything above renderTasksBlock is a pure function or a constant — no
// writes, no stdout anywhere in this file except inside dispatch() and its
// helpers, which own all I/O and stream discipline for the CLI surface.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
export const ISSUE_STATUSES = ['open', 'resolved'];
export const MAX_TITLE_LEN = 80;
export const MAX_BLOCKED_ON_LEN = 120;
export const TASK_FILE_GLOB_PREFIX = 't-';

// Epic/spike vocabulary (D13, D14). server.mjs imports ISSUE_ROLES and
// SPIKE_TYPES rather than holding its own copies -- the same single-source
// rule TASK_STATUS already follows, so the MCP schema and the lint can never
// disagree about what a valid value is.
export const ISSUE_ROLES = ['epic', 'spike'];
export const SPIKE_TYPES = ['interview', 'prototype', 'research', 'task'];

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

  // I1 — one line per missing required key, in ISSUE_REQUIRED_KEYS order
  for (const key of ISSUE_REQUIRED_KEYS) {
    if (!fm[key]) {
      problems.push(`missing required key: ${key}`);
    }
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
  const hasResolutionHeading = /^## Resolution\b/m.test(content);
  if (fm.status === 'resolved' && !hasResolutionHeading) {
    problems.push('status: resolved with no ## Resolution section');
  }
  if (fm.status === 'open' && hasResolutionHeading) {
    problems.push('status: open with a ## Resolution section (stale status)');
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

  // E10 -- `epic:` is deliberately NOT checked here. D7 lets an issue belong
  // to more than one container, and idea.md's Not Yet Specified leaves open
  // whether an ordinary capture can be promoted into a spike in place; a
  // hook-blocking rule must not foreclose an explicitly unspecified question.
  for (const key of ['spike_type', 'blocked_by']) {
    if (fm[key] !== undefined && role !== 'spike') {
      problems.push(`${key} present without role: spike`);
    }
  }

  // E11 -- the one Tier 1 rule that COULD fire mid-authoring: write_issue
  // emits a skeleton with no ## Destination. write_issue is an MCP call and
  // fires no PostToolUse hook, so the exposure is only the hand-edit path,
  // and /discovery's rule is to write the whole epic body in one edit -- the
  // same create-then-write shape D17 already imposes on spikes.
  if (role === 'epic' && !/^## Destination\b/m.test(content)) {
    problems.push('role: epic with no ## Destination section');
  }

  // E12 (D20) -- a resolved prototype spike's evidence must be addressable.
  // A missing ## Resolution is already I7's finding, so a null section here
  // returns without reporting rather than blaming the same edit twice.
  if (spikeType === 'prototype' && fm.status === 'resolved') {
    const resolution = sectionBody(content, 'Resolution');
    if (resolution !== null
      && !PROTOTYPE_ARTIFACT_PATH.test(resolution)
      && !PROTOTYPE_ARTIFACT_SLUG.test(resolution)) {
      problems.push('resolved prototype spike: ## Resolution names no scratch/issues/ path or `slug`');
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
 * Resolve one epic and its members out of a supplied file set.
 *
 * @param {string} epicSlug  The epic to build the graph around.
 * @param {Array<{path: string, content: string}>} files  Candidate files. The
 *   caller decides the set; nothing is read here.
 * @returns {{epicSlug: string, epic: ({slug: string, path: string, content: string}|null), members: object[], spikes: Map<string, object>}}
 *   `epic` is null when no file in the set carries `role: epic` with this
 *   slug (E3's condition). `members` is every file claiming the epic, sorted
 *   by slug for deterministic output; `spikes` indexes the `role: spike`
 *   subset for blocker resolution.
 */
export function buildEpicGraph(epicSlug, files) {
  let epic = null;
  const members = [];

  for (const file of files) {
    if (!hasFrontmatterBlock(file.content)) continue;
    const fm = parseFrontmatter(file.content);
    const slug = slugOf(file.path, fm);
    const role = fm.role === undefined ? undefined : fm.role.trim();

    if (role === 'epic' && slug === epicSlug) {
      epic = { slug, path: file.path, content: file.content };
      continue;
    }
    if (!splitSlugList(fm.epic).includes(epicSlug)) continue;

    members.push({
      slug,
      path: file.path,
      role,
      status: fm.status === undefined ? undefined : fm.status.trim(),
      spikeType: fm.spike_type === undefined ? undefined : fm.spike_type.trim(),
      blockedBy: splitSlugList(fm.blocked_by).filter((value) => value !== ''),
    });
  }

  members.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

  const spikes = new Map();
  for (const member of members) {
    if (member.role === 'spike') spikes.set(member.slug, member);
  }

  return { epicSlug, epic, members, spikes };
}

/**
 * The ready spikes of an epic: open, and with every blocker resolved.
 *
 * An unresolvable blocker counts as UNRESOLVED, so a typo fails closed and
 * cannot promote work into the ready list. That state is already an E1
 * finding at edit time, so the frontier never has to be the thing that
 * reports it.
 *
 * @param {ReturnType<typeof buildEpicGraph>} graph
 * @returns {string[]} ready spike slugs, sorted
 */
export function frontierSpikes(graph) {
  const ready = [];
  for (const [slug, spike] of graph.spikes) {
    if (spike.status !== 'open') continue;
    const blocked = spike.blockedBy.some((target) => {
      const blocker = graph.spikes.get(target);
      return blocker === undefined || blocker.status !== 'resolved';
    });
    if (!blocked) ready.push(slug);
  }
  return ready.sort();
}

// Every distinct cycle in the blocked_by edges, each returned as a slug path
// closing on its own first element (['a','b','a']). Recursion is bounded by
// spikes-per-epic, which the sizing guidance puts near seven. Cycles are
// canonicalized by rotating the smallest slug to the front before dedup, so
// the same cycle reached from two entry points is reported once.
function findBlockedByCycles(spikes) {
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
    for (const target of [...spikes.get(slug).blockedBy].sort()) {
      if (spikes.has(target)) visit(target);
    }
    path.pop();
    onPath.delete(slug);
    done.add(slug);
  }

  for (const slug of [...spikes.keys()].sort()) visit(slug);
  return cycles;
}

/**
 * The Tier 2 graph rules for one epic.
 *
 * Tier 2a (E1, E2, E3) always runs -- D16 clears it for the edit-time hook
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

  // E1 -- a malformed blocker slug is already E9's finding, so it is skipped
  // here rather than reported a second time as unresolvable.
  for (const member of graph.members) {
    if (member.role !== 'spike') continue;
    for (const target of member.blockedBy) {
      if (!ISSUE_SLUG_PATTERN.test(target)) continue;
      if (!graph.spikes.has(target)) {
        problems.push(`${member.slug}: blocked_by ${target} does not resolve to a spike in epic ${epicSlug}`);
      }
    }
  }

  // E2
  for (const cycle of findBlockedByCycles(graph.spikes)) {
    problems.push(`blocked_by cycle in epic ${epicSlug}: ${cycle.join(' -> ')}`);
  }

  // E5 (Tier 2b) -- D24: either section satisfies it. A spike ruled past the
  // destination is closed as a scope boundary and belongs under Out of Scope,
  // NOT in Decisions, which records the route actually walked; demanding a
  // Decisions line would falsify that record. With no epic file to read, E3
  // has already reported the real problem.
  if (includeTier2b && graph.epic !== null) {
    const decisions = sectionBody(graph.epic.content, 'Decisions');
    const outOfScope = sectionBody(graph.epic.content, 'Out of Scope');
    for (const member of graph.members) {
      if (member.role !== 'spike' || member.status !== 'resolved') continue;
      const placed = (decisions !== null && mentionsSlug(decisions, member.slug))
        || (outOfScope !== null && mentionsSlug(outOfScope, member.slug));
      if (!placed) {
        problems.push(`${member.slug}: resolved with no matching line in epic ${epicSlug}'s ## Decisions or ## Out of Scope`);
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
 * still-open-block-blank-line sed-extraction hazard documented in the
 * claude-code-ref-expert wiki therefore applies to this block too: anyone
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
                        (I0-I9). A path matching neither is a user error,
                        never a silent default. Issues files with no
                        frontmatter block at all are a standing exemption
                        (D12) -- the corpus predates the MCP writer and those
                        files never produce findings.

Arguments:
  session-dir   The workstream folder for 'list' (e.g. scratch/S-my-session/).
                Must be inside the project's scratch/ directory.
  path          The file or directory for 'lint'. Must be inside the
                project's scratch/ directory. Target semantics: a missing
                DIRECTORY target (the path ends in a separator, or names no
                .md file) is zero findings and exit 0 -- a workstream with no
                tasks/ yet is the common case, not an error. A missing FILE
                target (a path naming a .md file that does not exist) is
                exit 1 -- a mistyped path stays loud.

Options:
  -h, --help    Show this help.
  --            Stop flag parsing; the next token is the positional argument
                (lets a path beginning with '-' be passed).

Output:
  lint findings go to stdout, one per line: WARN: <file-basename>: <problem>.
  Errors (argument or infrastructure) go to stderr: ERROR: <message>. Exit 1
  is overloaded: it means "findings" when stdout is non-empty and "argument
  error" when stderr is non-empty -- check the stream, not just the code.

Exit codes:
  0  success (list; lint with zero findings; lint on a missing directory target)
  1  lint findings, or a user/argument error -- see Output above for how to tell them apart
  2  infrastructure error (FS read failure)
`;

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

// Read only the files belonging to the named epics -- the epic files
// themselves plus anything claiming one of them. One directory listing, then
// a read per candidate; the set handed to the pure rules is bounded by
// spikes-per-epic rather than by corpus size, which is the cost idea.md's
// assumption audit accepted.
function readEpicSiblings(dir, epicSlugs) {
  let entryNames;
  try {
    entryNames = readdirSync(dir);
  } catch (err) {
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exit(EXIT.INFRA_ERROR);
  }

  const files = [];
  for (const name of entryNames.filter((n) => n.endsWith('.md')).sort()) {
    const fullPath = join(dir, name);
    let content;
    try {
      content = readFileSync(fullPath, 'utf-8');
    } catch (err) {
      // A file listed and then removed before its read is a race, not a
      // finding -- scanTasks tolerates the same ENOENT for the same reason.
      // Anything else is genuine infrastructure trouble and stays loud.
      if (err.code === 'ENOENT') continue;
      process.stderr.write(`ERROR: ${err.message}\n`);
      process.exit(EXIT.INFRA_ERROR);
    }
    if (!hasFrontmatterBlock(content)) continue;
    const fm = parseFrontmatter(content);
    const role = fm.role === undefined ? undefined : fm.role.trim();
    const claimsAnEpic = splitSlugList(fm.epic).some((slug) => epicSlugs.has(slug));
    const isAnEpic = role === 'epic' && epicSlugs.has(slugOf(fullPath, fm));
    if (claimsAnEpic || isAnEpic) files.push({ path: fullPath, content });
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
  if (fm.role === undefined && fm.epic === undefined) return [];

  const epicSlugs = new Set(splitSlugList(fm.epic).filter((slug) => slug !== ''));
  if (fm.role !== undefined && fm.role.trim() === 'epic') {
    epicSlugs.add(slugOf(filePath, fm));
  }
  if (epicSlugs.size === 0) return [];

  const siblings = readEpicSiblings(dirname(filePath), epicSlugs);
  const problems = [];
  for (const epicSlug of [...epicSlugs].sort()) {
    problems.push(...lintEpicGraph(epicSlug, siblings));
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
