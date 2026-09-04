#!/usr/bin/env node
// cat-sessions.mjs — cat-sessions verb for the scratch-memory CLI
//
// Reads all session files in <session-dir>/sessions/ newest-first, applies the
// char budget with the always-inline-newest floor, computes still-open open
// questions (whole-log normalized set-difference), and emits in the requested
// format.
//
// Single load-bearing implementation: cat-sessions is its CLI face;
// rewrite-pointer consumes assembleSessions() directly (in-process).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { resolveProjectRoot } from './handoff.mjs';

// ---------------------------------------------------------------------------
// Exit code constants — reference EXIT.* at every process.exit() call-site;
// no raw integer exits anywhere in this file.
// ---------------------------------------------------------------------------
export const EXIT = { SUCCESS: 0, USER_ERROR: 1, INFRA_ERROR: 2, CANCELLED: 130 };

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------
const CAT_HELP = `Usage: scratch-memory cat-sessions <session-dir> [options]

Read all session files in <session-dir>/sessions/ newest-first, apply the char-budget
trim, carry forward still-open questions (whole log), and emit in the requested format.

Arguments:
  session-dir         The workstream folder (e.g. scratch/S-my-session/).
                      Must be inside the project's scratch/ directory.

Options:
  --max-chars N             Budget in characters (default: 30000). Integer >= 1.
  --max-cumulative-chars N  Per-block char cap for the three cumulative sections
                            (Decisions/What to avoid/Done; default: 6000). Integer >= 1.
                            Applies to --format full only; --format json always emits the
                            three cumulative arrays untruncated.
  --format <fmt>      Output format: full | summary | json (default: full).
  --with-tasks        Append a \`## Tasks\` block from <session-dir>/tasks/ listing open and
                      blocked tasks with their age, a closed-task count line, and one
                      \`WARN:\` line per malformed task file. Applies to --format full and
                      --format json only; --format summary is unaffected. Malformed task
                      files never change this command's exit code.
  -h, --help          Show this help.
  --                  Stop flag parsing; subsequent tokens are positional arguments.

Exit codes:
  0  success (assembled brief written to stdout)
  1  user/argument error (missing arg, invalid flag, out-of-sandbox, sessions/ missing or empty)
  2  infrastructure error (FS read failure)
`;

// ---------------------------------------------------------------------------
// Low-level parsers (local — no coupling to handoff.mjs parsing helpers)
// ---------------------------------------------------------------------------

// Strip one layer of matching surrounding single/double quotes from a YAML scalar value
// (e.g. `'2026-08-21T10:00:00.000Z'` → `2026-08-21T10:00:00.000Z`). Both quote styles are
// valid YAML for a plain string; without this, a quoted started/ended timestamp renders
// with literal stray quotes in session headers and the pointer Sessions table.
function stripQuotes(s) {
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return s.slice(1, -1);
    }
  }
  return s;
}

/** Parse YAML-ish frontmatter. Returns { key: value } string map. Empty object on failure. */
function parseFrontmatter(content) {
  const lines = content.split('\n');
  if (lines[0] !== '---') return {};
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { close = i; break; }
  }
  if (close === -1) return {};
  const fields = {};
  for (let i = 1; i < close; i++) {
    const m = lines[i].match(/^([^:]+):\s*(.*)/);
    if (m) fields[m[1].trim()] = stripQuotes(m[2].trim());
  }
  return fields;
}

/** Extract everything after the closing --- of frontmatter. Falls back to entire content. */
function extractBody(content) {
  const idx = content.indexOf('\n---\n');
  return idx !== -1 ? content.slice(idx + 5) : content;
}

/**
 * Extract content of a named ## section from body text.
 * Matching is case-insensitive. Returns trimmed text or empty string.
 */
function extractSection(body, sectionName) {
  const needle = `## ${sectionName.toLowerCase()}`;
  for (const part of body.split(/^(?=## )/m)) {
    if (part.split('\n')[0].trim().toLowerCase() === needle) {
      return part.split('\n').slice(1).join('\n').trim();
    }
  }
  return '';
}

// Matches placeholder bullets like "- none", "- N/A", "- (none new — nothing surfaced)".
// Applies to every section extractBullets parses, not only open questions.
const PLACEHOLDER_BULLET = /^\(?\s*(none|n\/a|no new)\b/i;

/**
 * Extract bullet entries from section content.
 * Accepts `- `, `* `, `+ ` with up to 2 leading spaces.
 * When `allowBareEntry` is true (used only for the two open-questions sections —
 * see call sites), a non-blank line seen while no entry is open also opens an
 * entry; this tolerates authoring that omits the bullet dash (decisions.md
 * gotcha: bare `q-<id> → RESOLVED: …` lines were silently dropped before this
 * option existed). Unlike a `- ` line, a bare-opened entry does NOT accept
 * continuation lines — there is no dash to distinguish "this line wraps the
 * previous entry" from "this line is a sibling entry the author also forgot
 * to dash," so each subsequent non-blank line is treated as its own entry.
 * A `- `-opened entry is unaffected and still accepts wrapped continuation
 * lines exactly as before.
 */
function extractBullets(sectionContent, allowBareEntry = false) {
  const out = [];
  let cur = null;
  let curIsBare = false; // true when `cur` was opened by a bare line, not a `- ` bullet
  for (const line of sectionContent.split('\n')) {
    const m = line.match(/^ {0,2}(?:- |\* |\+ )(.*)$/);
    if (m) {
      if (cur !== null) out.push(cur.trim());
      cur = m[1];
      curIsBare = false;
    } else if (cur !== null && line.trim() !== '') {
      if (curIsBare) {
        out.push(cur.trim());             // bare entries don't span lines — each is its own entry
        cur = line.trim();
      } else {
        cur += ' ' + line.trim();         // continuation of the current bullet
      }
    } else if (cur !== null) {
      out.push(cur.trim());               // blank line ends the current bullet
      cur = null;
    } else if (allowBareEntry && line.trim() !== '') {
      cur = line.trim();                  // bare paragraph opens an entry (question sections only)
      curIsBare = true;
    }
  }
  if (cur !== null) out.push(cur.trim());
  return out.filter(Boolean).filter(b => !PLACEHOLDER_BULLET.test(b));
}

/**
 * Reduce a raised/resolved bullet to its comparable question kernel:
 * strip markdown emphasis, strip a leading [q-<hex6>] ID token (so pasting a
 * rendered still-open row back into ## Open questions raised reduces to the
 * same kernel as the original — idempotent under rendering), cut any appended
 * answer at the first resolution delimiter (→ / -> / RESOLVED:), then keep
 * the question sentence up to the first '?'. Trim + lowercase + collapse
 * whitespace. Returns '' when no kernel remains.
 */
export function questionKernel(text) {
  let s = text.replace(/[*_`]/g, '');                 // 1. strip emphasis/code markers
  s = s.replace(/^\[q-[0-9a-f]{6}\]\s*/, '');          // 1.5. strip a leading ID token (idempotence)
  const d = s.search(/→|->|\bRESOLVED\s*:/i);         // 2. cut appended answer
  if (d !== -1) s = s.slice(0, d);
  const q = s.indexOf('?');                            // 3. question sentence (if any)
  if (q !== -1) s = s.slice(0, q + 1);
  return s.trim().toLowerCase().replace(/\s+/g, ' ');  // 4. normalize
}

// Resolve-pass matcher constants (decisions.md §D2, §D4, §D5, §D7).
// A STILL OPEN / UNRESOLVED / NOT RESOLVED annotation on a resolved-section entry
// vetoes cancellation unconditionally — see the resolve pass in assembleSessions.
const STILL_OPEN_GUARD = /\b(STILL[\s-]*OPEN|UNRESOLVED|NOT[\s-]*RESOLVED)\b/i;
// A rendered still-open row's leading ID token, e.g. q-3f2a1b.
const ID_TOKEN = /\bq-[0-9a-f]{6}\b/;

/**
 * Derive a stable, retroactively computable ID for a question kernel:
 * 'q-' followed by the first 6 hex characters of the kernel's SHA-256 digest.
 * Pure function of kernel alone, so it is deterministic across processes and
 * machines and requires no migration — every existing question in the
 * immutable log acquires its ID at read time. Returns '' when kernel is ''.
 */
export function questionId(kernel) {
  if (!kernel) return '';
  return 'q-' + createHash('sha256').update(kernel).digest('hex').slice(0, 6);
}

/**
 * Reduce a Done/Decisions-made/What-to-avoid bullet to a dedup key for the cumulative
 * carry-forward accumulator (decisions.md D13): strip markdown emphasis/backtick markers,
 * trim, lowercase, collapse internal whitespace to single spaces, then truncate to 80
 * characters. Two bullets whose normalized forms agree on their first 80 characters are
 * treated as the same entry — a deliberate accepted false-merge (D13), not similarity
 * scoring. Pure and deterministic; independent of session order.
 */
export function cumulativeKey(text) {
  return text
    .replace(/[*_`]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

/**
 * Derive a summary for sessions missing the summary: frontmatter field.
 * 1. next-best-step content + first non-empty done line.
 * 2. Placeholder: ⚠ no summary + first ~300 chars of content.
 */
function deriveSummary(body, rawContent) {
  const nbs = extractSection(body, 'Next best step').split('\n').find(l => l.trim()) || '';
  const done = extractSection(body, 'Done').split('\n').find(l => l.trim()) || '';
  if (nbs || done) {
    return [nbs, done].filter(Boolean).join(' | ').slice(0, 500);
  }
  const preview = (rawContent || body).slice(0, 300).replace(/\s+/g, ' ').trim();
  return `⚠ no summary — see source${preview ? ': ' + preview : ''}`;
}

// ---------------------------------------------------------------------------
// File sorting
// ---------------------------------------------------------------------------

/**
 * Parse the ISO timestamp prefix from a session filename.
 * Filename format: YYYY-MM-DDTHH-MM-SS-mmmZ-{shortid}.md
 * Returns a Date, or null if unparseable.
 */
export function parseFilenameTsPrefix(filename) {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z)/);
  if (!m) return null;
  const raw = m[1];
  const tIdx = raw.indexOf('T');
  const datePart = raw.slice(0, tIdx);
  const timePart = raw.slice(tIdx + 1); // HH-MM-SS-mmmZ
  const tm = timePart.match(/^(\d{2})-(\d{2})-(\d{2})-(\d+)Z$/);
  if (!tm) return null;
  const iso = `${datePart}T${tm[1]}:${tm[2]}:${tm[3]}.${tm[4]}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Sort session filenames newest-first.
 * Primary: ts prefix (DESC).
 * Fallback: file mtime (DESC) — only when prefix is unparseable.
 * Final tiebreaker: filename lexicographic (ASC) — restores determinism on equal ts or mtime.
 */
export function sortSessionFilesNewestFirst(filenames, sessionsDir) {
  const keys = filenames.map(f => {
    const ts = parseFilenameTsPrefix(f);
    let mtime = 0;
    if (!ts) {
      try { mtime = statSync(join(sessionsDir, f)).mtimeMs; } catch { /* use 0 */ }
    }
    return { f, ts, mtime };
  });

  return keys.sort((a, b) => {
    // Both have parseable ts → compare descending; tiebreaker: filename lex ASC
    if (a.ts && b.ts) {
      const d = b.ts.getTime() - a.ts.getTime();
      if (d !== 0) return d;
      return a.f < b.f ? -1 : a.f > b.f ? 1 : 0;
    }
    // One has ts, the other doesn't → ts-file first (known timestamp)
    if (a.ts) return -1;
    if (b.ts) return 1;
    // Neither has ts → mtime descending; tiebreaker: filename lex ASC
    const md = b.mtime - a.mtime;
    if (md !== 0) return md;
    return a.f < b.f ? -1 : a.f > b.f ? 1 : 0;
  }).map(k => k.f);
}

// ---------------------------------------------------------------------------
// Core: assembleSessions
// ---------------------------------------------------------------------------

/**
 * Assemble a bounded newest-first brief from all session files in sessionDir/sessions/.
 *
 * @param {string} sessionDir  Absolute path to the S-{id}/ workstream folder.
 * @param {{ maxChars?: number, format?: 'full'|'summary'|'json', maxCumulativeChars?: number }} [opts]
 *   `maxCumulativeChars` (default 6000) is a render-time-only cap consumed by `cumulativeBlock`
 *   via `cumulative_cap_chars` below — it never truncates `cumulative_done`/`cumulative_decisions`/
 *   `cumulative_avoid` themselves (those stay complete for `--format json`; decisions.md D14).
 *   The CLI `--max-cumulative-chars` flag threads its value into this option; applies to
 *   `--format full` only, since `--format json` always emits the three arrays untruncated.
 * @returns {{
 *   session_dir: string,
 *   budget_chars: number,
 *   cumulative_cap_chars: number,
 *   session_count: number,
 *   still_open_questions: Array<{id: string, text: string, source_file: string, age_sessions: number}>,
 *   newest: {goal: string, next_best_step: string, summary: string, file: string},
 *   sessions: Array<{ts: string, file: string, summary: string, inlined: boolean, body?: string}>,
 *   cumulative_done: Array<{text: string, source_file: string}>,
 *   cumulative_decisions: Array<{text: string, source_file: string}>,
 *   cumulative_avoid: Array<{text: string, source_file: string}>
 * }}
 * @throws {Error} with .code 'NO_SESSIONS_DIR' | 'NO_SESSIONS' | 'FS_READ'
 */
export function assembleSessions(sessionDir, { maxChars = 30000, format = 'full', maxCumulativeChars = 6000 } = {}) {
  const sessionsPath = join(sessionDir, 'sessions');

  if (!existsSync(sessionsPath)) {
    const e = new Error(`NO_SESSIONS_DIR: sessions/ directory not found: ${sessionsPath}`);
    e.code = 'NO_SESSIONS_DIR';
    throw e;
  }

  let allFiles;
  try {
    allFiles = readdirSync(sessionsPath).filter(f => f.endsWith('.md'));
  } catch (fsErr) {
    const e = new Error(`FS read error listing ${sessionsPath}: ${fsErr.message}`);
    e.code = 'FS_READ';
    e.cause = fsErr;
    throw e;
  }

  if (allFiles.length === 0) {
    const e = new Error(`NO_SESSIONS: No session files (*.md) found in ${sessionsPath}`);
    e.code = 'NO_SESSIONS';
    throw e;
  }

  const sortedFiles = sortSessionFilesNewestFirst(allFiles, sessionsPath);

  // Parse all sessions (newest-first order)
  const parsed = sortedFiles.map(filename => {
    const filePath = join(sessionsPath, filename);
    let content;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch (fsErr) {
      const e = new Error(`FS read error on ${filePath}: ${fsErr.message}`);
      e.code = 'FS_READ';
      e.cause = fsErr;
      throw e;
    }
    const fm = parseFrontmatter(content);
    const body = extractBody(content);
    const summary = fm['summary'] || deriveSummary(body, content);
    const tsDate = parseFilenameTsPrefix(filename);
    const tsStr = fm['ended'] || fm['started'] || (tsDate ? tsDate.toISOString() : '');
    return { filename, body, summary, tsStr };
  });

  // Budget algorithm (state/transition table):
  //   k=0 (newest): always inline — always-inline-newest floor; cumulative += body.length
  //   k>0, not yet exhausted, and cumulative + body.length <= maxChars: inline; cumulative += body.length
  //   k>0 otherwise: summary-only row. The first skipped k>0 session latches budgetExhausted, so ALL
  //     older sessions are summary-only — the inlined window stays contiguous newest-first (no gaps).
  let cumulative = 0;
  let budgetExhausted = false;
  const sessions = parsed.map((s, i) => {
    const inlined = i === 0 || (!budgetExhausted && cumulative + s.body.length <= maxChars);
    if (i > 0 && !inlined) budgetExhausted = true;   // latch: once one older session is skipped, all older are summary-only
    if (inlined) cumulative += s.body.length;
    const entry = { ts: s.tsStr, file: join('sessions', s.filename), summary: s.summary, inlined };
    if (inlined) entry.body = s.body;
    return entry;
  });

  // Open-questions carry-forward — whole log, independent of budget window.
  // Ordering-aware (F1): a kernel is still-open iff it was never resolved OR its most-recent
  // raise is chronologically newer than its most-recent resolve — so a kernel raised, resolved,
  // then re-raised in a newer session surfaces again (safe-direction invariant: a genuinely
  // re-opened question is never dropped). Iterate oldest-first so `order` is monotonic with time.
  // Attribution: no resolve ever seen → oldest raise wins (dedup default, CAT7b). A genuine
  // re-raise (resolve seen at some point) → attribute to the newest raise.
  const kernelInfo = new Map(); // questionKernel(text) → {firstRaise, lastRaise, firstRaiseOrder, lastRaiseOrder, lastResolveOrder}
  const idIndex = new Map();    // questionId(kernel) → Set<kernel> — local; never reached from outside assembleSessions
  let order = 0;

  // Cumulative Done / Decisions made / What-to-avoid accumulation (decisions.md D12/D13).
  // Rides this same oldest-first traversal — no second pass over `parsed`. Keyed by
  // cumulativeKey(text); first sighting (oldest occurrence) wins and is never overwritten,
  // mirroring the question attribution above. This is the whole log, not the budget window:
  // it accumulates regardless of whether the session's body was inlined.
  const cumulativeDoneMap = new Map();      // cumulativeKey(text) → {text, source_file, order}
  const cumulativeDecisionsMap = new Map();
  const cumulativeAvoidMap = new Map();

  function accumulateCumulative(map, sectionContent, relFile, order) {
    for (const text of extractBullets(sectionContent)) {
      const key = cumulativeKey(text);
      if (!key) continue;
      if (!map.has(key)) map.set(key, { text, source_file: relFile, order });
    }
  }

  for (let i = parsed.length - 1; i >= 0; i--) {
    const s = parsed[i];
    const relFile = join('sessions', s.filename);
    order++;

    accumulateCumulative(cumulativeDoneMap, extractSection(s.body, 'Done'), relFile, order);
    accumulateCumulative(cumulativeDecisionsMap, extractSection(s.body, 'Decisions made'), relFile, order);
    accumulateCumulative(cumulativeAvoidMap, extractSection(s.body, 'What to avoid'), relFile, order);

    for (const text of extractBullets(extractSection(s.body, 'Open questions raised'), true)) {
      const kernel = questionKernel(text);
      if (!kernel) continue;
      let info = kernelInfo.get(kernel);
      if (!info) {
        info = { firstRaise: null, lastRaise: null, firstRaiseOrder: -1, lastRaiseOrder: -1, lastResolveOrder: -1 };
        kernelInfo.set(kernel, info);
      }
      if (info.firstRaise === null) {
        info.firstRaise = { originalText: text, sourceFile: relFile };
        info.firstRaiseOrder = order;
      }
      info.lastRaise = { originalText: text, sourceFile: relFile };
      info.lastRaiseOrder = order;

      const id = questionId(kernel);
      let idSet = idIndex.get(id);
      if (!idSet) {
        idSet = new Set();
        idIndex.set(id, idSet);
      }
      idSet.add(kernel);
    }
    // Resolve-pass matcher (decisions.md §D7): compute G, I, K independently, then branch.
    // G — guarded: STILL_OPEN_GUARD tested against the post-delimiter remainder (whole bullet
    //     if no delimiter). A guarded entry vetoes unconditionally and sets nothing (§D1).
    // I — unambiguous ID: a q-<hex6> token present, mapped by idIndex, to exactly one kernel.
    // K — kernel match: questionKernel(text) is non-empty and an existing kernelInfo key.
    // Precedence: G vetoes; otherwise I wins over K; otherwise K; otherwise the entry cancels
    // nothing (orphan resolution). At most one kernel is cancelled per entry.
    for (const text of extractBullets(extractSection(s.body, 'Open questions resolved'), true)) {
      const d = text.search(/→|->|\bRESOLVED\s*:/i);
      const remainder = d === -1 ? text : text.slice(d);
      if (STILL_OPEN_GUARD.test(remainder)) continue; // G — veto

      const idMatch = text.match(ID_TOKEN);
      const idKernels = idMatch ? idIndex.get(idMatch[0]) : undefined;
      const idKernel = idKernels && idKernels.size === 1 ? [...idKernels][0] : null; // I

      const kernel = questionKernel(text);
      const kernelMatch = kernel && kernelInfo.has(kernel) ? kernel : null; // K

      const resolvedKernel = idKernel || kernelMatch;
      if (resolvedKernel) kernelInfo.get(resolvedKernel).lastResolveOrder = order;
    }
  }

  // Sort key (decisions.md §D8, amended): age_sessions DESC, then id ASC, then kernel ASC.
  // `kernel` is the kernelInfo map key and unique by construction, which makes the key total —
  // CAT6's byte-identical assertion rests on that totality. attributingRaiseOrder is
  // deliberately not a fourth level: age_sessions is a linear function of it (session_count
  // minus it), so a level on both would just re-apply the same ordering twice.
  const stillOpenWorking = [];
  for (const [kernel, info] of kernelInfo) {
    if (info.lastRaiseOrder <= info.lastResolveOrder) continue; // resolved at or after the last raise
    const wasEverResolved = info.lastResolveOrder !== -1;
    const attribution = wasEverResolved ? info.lastRaise : info.firstRaise;
    const attributingRaiseOrder = wasEverResolved ? info.lastRaiseOrder : info.firstRaiseOrder;
    const age_sessions = parsed.length - attributingRaiseOrder;
    stillOpenWorking.push({
      kernel,
      id: questionId(kernel),
      text: attribution.originalText,
      source_file: attribution.sourceFile,
      age_sessions,
    });
  }
  stillOpenWorking.sort((a, b) => {
    if (a.age_sessions !== b.age_sessions) return b.age_sessions - a.age_sessions; // DESC
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;                                // ASC
    return a.kernel < b.kernel ? -1 : a.kernel > b.kernel ? 1 : 0;                  // ASC
  });
  const still_open_questions = stillOpenWorking.map(
    ({ id, text, source_file, age_sessions }) => ({ id, text, source_file, age_sessions }));

  // Newest-first by the `order` of the oldest occurrence (decisions.md §D14) — the arrays are
  // complete (no cap here; Step 07a's char budget applies at render time).
  function toCumulativeArray(map) {
    return [...map.values()]
      .sort((a, b) => b.order - a.order)
      .map(({ text, source_file }) => ({ text, source_file }));
  }
  const cumulative_done = toCumulativeArray(cumulativeDoneMap);
  const cumulative_decisions = toCumulativeArray(cumulativeDecisionsMap);
  const cumulative_avoid = toCumulativeArray(cumulativeAvoidMap);

  const newest = {
    goal: extractSection(parsed[0].body, 'Goal'),
    next_best_step: extractSection(parsed[0].body, 'Next best step'),
    summary: parsed[0].summary,
    file: join('sessions', parsed[0].filename),
  };

  return {
    session_dir: sessionDir,
    budget_chars: maxChars,
    cumulative_cap_chars: maxCumulativeChars,
    session_count: parsed.length,
    still_open_questions,
    newest,
    sessions,
    cumulative_done,
    cumulative_decisions,
    cumulative_avoid,
  };
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

export function relLink(path) {
  // Normalize to '/' at this chokepoint (decisions.md D9/R12 §5): join('sessions', filename)
  // uses the platform-native separator for filesystem access, so on native Windows Node
  // `path` carries '\' — left uncorrected here, the emitted markdown link is broken. The
  // replace is unconditional (not keyed on the current platform's path.sep) so the fix
  // also holds when this code runs on a non-Windows platform against a path that still
  // carries a literal backslash.
  const posixPath = String(path).replace(/\\/g, '/');
  const safe = posixPath.replace(/\|/g, '\\|');
  return `[${safe}](${safe})`;
}

function openQuestionsBlock(questions) {
  const lines = ['## Open questions (still open)', ''];
  if (questions.length === 0) {
    lines.push('- none');
  } else {
    for (const q of questions) {
      lines.push(`- [${q.id}] ${q.text} → ${relLink(q.source_file)} (age: ${q.age_sessions})`);
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * Render a cumulative block (Decisions/What-to-avoid/Done) under a per-block char cap
 * (decisions.md D14). Emits `heading`, then rows `- {text} → {relLink(source_file)}` in
 * array order (already newest-first — assembleSessions' `toCumulativeArray` ordering),
 * accumulating rendered row characters and stopping BEFORE the row that would push the
 * running total over `cap`. When any entry is omitted, appends a single elision line
 * `_… {n} more (see sessions/)_`. An empty array emits `- none`, matching
 * `openQuestionsBlock`'s convention.
 *
 * No minimum-entries floor (decisions.md §D14, amended clause; Apply: R13 §D14, R6). Unlike
 * the session-body budget algorithm, which always inlines the newest body even when it alone
 * exceeds `maxChars` (the always-inline-newest floor), this renderer makes no analogous
 * guarantee: a `cap` smaller than the first row's rendered length renders ZERO rows plus the
 * elision line — an empty-looking block despite content existing. This asymmetry is
 * deliberate: the cumulative view is a convenience over an immutable log that `source_file`
 * links back to, whereas the newest session body is the resume payload itself.
 *
 * @param {string} heading  Section heading text, without the leading `## `.
 * @param {Array<{text: string, source_file: string}>} entries  Already newest-first.
 * @param {number} cap  Max accumulated row characters (excludes the heading line itself).
 * @returns {string}
 */
export function cumulativeBlock(heading, entries, cap) {
  const lines = [`## ${heading}`, ''];
  if (entries.length === 0) {
    lines.push('- none');
    return lines.join('\n') + '\n';
  }
  let charCount = 0;
  let rendered = 0;
  for (const e of entries) {
    const row = `- ${e.text} → ${relLink(e.source_file)}`;
    const rowChars = row.length + 1; // + the newline this row occupies once joined
    if (charCount + rowChars > cap) break;
    lines.push(row);
    charCount += rowChars;
    rendered++;
  }
  const omitted = entries.length - rendered;
  if (omitted > 0) lines.push(`_… ${omitted} more (see sessions/)_`);
  return lines.join('\n') + '\n';
}

function summaryTable(sessions) {
  const rows = [
    '| timestamp | summary | file |',
    '|---|---|---|',
  ];
  for (const s of sessions) {
    const safeTs = String(s.ts).replace(/\|/g, '\\|');
    const safe = s.summary.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').slice(0, 200);
    rows.push(`| ${safeTs} | ${safe} | ${relLink(s.file)} |`);
  }
  return rows.join('\n') + '\n';
}

function formatFull(result, tasksBlock = null) {
  const out = [];
  out.push(openQuestionsBlock(result.still_open_questions));
  out.push('\n' + cumulativeBlock('Decisions (cumulative)', result.cumulative_decisions, result.cumulative_cap_chars));
  out.push('\n' + cumulativeBlock('What to avoid (cumulative)', result.cumulative_avoid, result.cumulative_cap_chars));
  out.push('\n' + cumulativeBlock('Done (cumulative)', result.cumulative_done, result.cumulative_cap_chars));
  if (tasksBlock !== null) out.push('\n' + tasksBlock);
  for (const s of result.sessions.filter(x => x.inlined)) {
    out.push('\n---\n');
    out.push(`\n### ${relLink(s.file)} — ${s.ts}\n\n`);
    out.push(s.body ?? '');
    out.push('\n');
  }
  const trimmed = result.sessions.filter(x => !x.inlined);
  if (trimmed.length > 0) {
    out.push('\n---\n\n## Session summaries (trimmed)\n\n');
    out.push(summaryTable(trimmed));
  }
  return out.join('');
}

function formatSummaryMode(result) {
  const out = [];
  out.push(openQuestionsBlock(result.still_open_questions));
  out.push('\n## Sessions\n\n');
  out.push(summaryTable(result.sessions));
  return out.join('');
}

// ---------------------------------------------------------------------------
// dispatch — CLI entry point
// ---------------------------------------------------------------------------

export async function dispatch(argv) {
  // Install SIGINT handler at the top, before any file I/O.
  // Full output is buffered in `assembled`; written in a single synchronous call.
  // SIGINT fires at any point → skip the write → exit CANCELLED (130).
  // Pipe-buffer note: worst-case output is ~80 KB (B=30000 plus three 6,000-char
  // cumulative-block caps) plus the tasks block, which is unbounded in principle but linear
  // in the number of open/blocked tasks — roughly 100 bytes per row, so a 100-task backlog
  // adds ~10 KB. This can exceed a kernel pipe buffer (commonly ~64 KB on Linux).
  // That's fine: process.stdout.write() handles chunking internally regardless of size, and
  // the exitCode/no-process.exit() pattern below (not this handler) is what prevents the
  // process from tearing down mid-flush — this handler only guards SIGINT-during-assembly.
  let assembled = null;
  process.on('SIGINT', () => {
    // assembled is null (assembly in progress) or set (write not yet issued) — skip write.
    process.exit(EXIT.CANCELLED);
  });

  try {
    // --- Arg parsing ---
    let sessionDirArg = null;
    let maxChars = 30000;
    let maxCumulativeChars = 6000;
    let format = 'full';
    let withTasks = false;
    let stopFlags = false;

    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];

      if (a === '--') { stopFlags = true; continue; }

      if (!stopFlags && a.startsWith('-')) {
        if (a === '-h' || a === '--help') {
          process.stdout.write(CAT_HELP);
          process.exit(EXIT.SUCCESS);
        }
        if (a === '--max-chars') {
          if (i + 1 >= argv.length) {
            process.stderr.write('ERROR: missing value for --max-chars\n');
            process.exit(EXIT.USER_ERROR);
          }
          const raw = argv[++i];
          const n = Number(raw);
          if (!Number.isInteger(n) || isNaN(n)) {
            process.stderr.write(`ERROR: --max-chars requires an integer, got: ${raw}\n\n`);
            process.stderr.write(CAT_HELP);
            process.exit(EXIT.USER_ERROR);
          }
          if (n < 1) {
            process.stderr.write(`ERROR: --max-chars must be >= 1, got: ${n}\n\n`);
            process.stderr.write(CAT_HELP);
            process.exit(EXIT.USER_ERROR);
          }
          maxChars = n;
          continue;
        }
        if (a === '--max-cumulative-chars') {
          if (i + 1 >= argv.length) {
            process.stderr.write('ERROR: missing value for --max-cumulative-chars\n');
            process.exit(EXIT.USER_ERROR);
          }
          const raw = argv[++i];
          const n = Number(raw);
          if (!Number.isInteger(n) || isNaN(n)) {
            process.stderr.write(`ERROR: --max-cumulative-chars requires an integer, got: ${raw}\n\n`);
            process.stderr.write(CAT_HELP);
            process.exit(EXIT.USER_ERROR);
          }
          if (n < 1) {
            process.stderr.write(`ERROR: --max-cumulative-chars must be >= 1, got: ${n}\n\n`);
            process.stderr.write(CAT_HELP);
            process.exit(EXIT.USER_ERROR);
          }
          maxCumulativeChars = n;
          continue;
        }
        if (a === '--format') {
          if (i + 1 >= argv.length) {
            process.stderr.write('ERROR: missing value for --format\n');
            process.exit(EXIT.USER_ERROR);
          }
          const val = argv[++i];
          if (val !== 'full' && val !== 'summary' && val !== 'json') {
            process.stderr.write(`ERROR: --format must be full, summary, or json, got: ${val}\n\n`);
            process.stderr.write(CAT_HELP);
            process.exit(EXIT.USER_ERROR);
          }
          format = val;
          continue;
        }
        if (a === '--with-tasks') { withTasks = true; continue; }
        // Unknown flag
        process.stderr.write(`ERROR: unknown option: ${a}\n\n`);
        process.stderr.write(CAT_HELP);
        process.exit(EXIT.USER_ERROR);
      }

      // Positional argument
      if (sessionDirArg !== null) {
        process.stderr.write(
          'ERROR: too many positional arguments — cat-sessions takes exactly one <session-dir>\n\n'
        );
        process.stderr.write(CAT_HELP);
        process.exit(EXIT.USER_ERROR);
      }
      sessionDirArg = a;
    }

    if (sessionDirArg === null) {
      process.stderr.write('ERROR: cat-sessions requires <session-dir>\n\n');
      process.stderr.write(CAT_HELP);
      process.exit(EXIT.USER_ERROR);
    }

    // --- Resolve project root and sandbox guard ---
    const projectRoot = (() => {
      try { return resolveProjectRoot(); }
      catch (err) {
        process.stderr.write(`ERROR: ${err.message}\n`);
        process.exit(EXIT.USER_ERROR);
      }
    })();

    const scratchRoot = join(projectRoot, 'scratch');
    const resolvedSessionDir = resolve(sessionDirArg);

    if (!resolvedSessionDir.startsWith(scratchRoot + sep)) {
      process.stderr.write(
        `ERROR: OUT_OF_SANDBOX_PATH: session-dir must be inside project scratch root\n` +
        `  expected prefix: ${scratchRoot + sep}\n` +
        `  resolved: ${resolvedSessionDir}\n`
      );
      process.exit(EXIT.USER_ERROR);
    }

    // --- Assemble ---
    let result;
    try {
      result = assembleSessions(resolvedSessionDir, { maxChars, format, maxCumulativeChars });
    } catch (err) {
      if (err.code === 'NO_SESSIONS_DIR' || err.code === 'NO_SESSIONS') {
        process.stderr.write(`ERROR: ${err.message}\n`);
        process.exit(EXIT.USER_ERROR);
      }
      // FS_READ or unexpected → INFRA_ERROR
      process.stderr.write(`ERROR: ${err.message}\n`);
      process.exit(EXIT.INFRA_ERROR);
    }

    // --- Tasks scan (only when requested; dynamic import keeps tasks.mjs unloaded
    // on the non-flag path, making D2's byte-identity guarantee structural) ---
    let tasksBlock = null;
    if (withTasks && format !== 'summary') {
      const tasksMod = await import('./tasks.mjs');
      let scan;
      try {
        scan = tasksMod.scanTasks(resolvedSessionDir);
      } catch (err) {
        process.stderr.write(`ERROR: ${err.message}\n`);
        process.exit(EXIT.INFRA_ERROR);
      }
      if (format === 'json') {
        result.tasks = scan.tasks;
        result.task_warnings = scan.warnings;
      } else {
        tasksBlock = tasksMod.renderTasksBlock(scan);
      }
    }

    // --- Format output (all in memory before the single synchronous write) ---
    if (format === 'json') {
      assembled = JSON.stringify(result, null, 2) + '\n';
    } else if (format === 'summary') {
      assembled = formatSummaryMode(result);
    } else {
      assembled = formatFull(result, tasksBlock);
    }

    // Single write — SIGINT handler above prevents partial output.
    // Do NOT call process.exit() here: on a pipe, process.exit() terminates before
    // stdout flushes, truncating large outputs (>64 KB JSON with full bodies).
    // Setting process.exitCode and returning lets Node drain stdout naturally.
    process.stdout.write(assembled);
    process.exitCode = EXIT.SUCCESS;

  } catch (err) {
    // Global catch for unexpected exceptions
    const isUser = err.code === 'NO_SESSIONS_DIR' || err.code === 'NO_SESSIONS';
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exit(isUser ? EXIT.USER_ERROR : EXIT.INFRA_ERROR);
  }
}

export default dispatch;

// ---------------------------------------------------------------------------
// Entry-point guard — forward to dispatch() on direct invocation (`node
// cat-sessions.mjs ...`), not just when imported by scratch-memory.mjs or
// rewrite-pointer.mjs. Without this, direct invocation silently exits 0 with
// no output (issue: verb-modules-silent-noop-direct-invocation).
// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dispatch(process.argv.slice(2)).catch(err => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(2);
  });
}
