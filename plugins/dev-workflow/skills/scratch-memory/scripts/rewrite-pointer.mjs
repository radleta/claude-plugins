#!/usr/bin/env node
// rewrite-pointer.mjs — rewrite-pointer verb for the scratch-memory CLI
//
// (Re)writes the thin v3 HANDOFF.md pointer from the immutable session log.
// Calls assembleSessions() from cat-sessions.mjs in-process (Apply: D002) to
// obtain the structured payload, then renders the 5-section v3 pointer and
// writes it via its OWN fsync-aware atomic-write helper (Apply: D001).
//
// The shared atomicWriteSync in handoff.mjs has no fsync and uses fixed
// .tmp-${basename} naming incompatible with the PID-liveness stale-sweep —
// it is explicitly NOT reused here (research.md Constraint 1).

import {
  openSync, writeSync, fsyncSync, closeSync,
  unlinkSync, renameSync, readdirSync, existsSync, readFileSync,
} from 'node:fs';
import { resolve, join, sep, basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { assembleSessions, relLink, EXIT } from './cat-sessions.mjs';
import { resolveProjectRoot } from './handoff.mjs';

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------
const HELP = `Usage: scratch-memory rewrite-pointer <session-dir> [options]

(Re)write the thin v3 HANDOFF.md pointer from the immutable session log.

Arguments:
  session-dir         The workstream folder (e.g. scratch/S-my-session/).
                      Must be inside the project's scratch/ directory.

Options:
  --quiet             Suppress the success status line on stderr.
                      Errors on exit-1/exit-2 paths still print to stderr.
  -h, --help          Show this help.
  --                  Stop flag parsing; subsequent tokens are positional arguments.

Exit codes:
  0    success (pointer written, or already current; status line on stderr unless --quiet)
  1    user/argument error (missing arg, invalid flag, out-of-sandbox,
       sessions/ missing or empty)
  2    infrastructure error (FS read or write failure)
  130  SIGINT (cancelled)

Status line (stderr, suppressed by --quiet):
  N sessions processed, pointer written|already current: <path>
`;

// ---------------------------------------------------------------------------
// Pointer rendering
// ---------------------------------------------------------------------------

/**
 * Render the v3 thin HANDOFF.md pointer from an assembleSessions result.
 *
 * 5 sections per spec lines 209-238:
 *   ## Open questions (still open)  — from still_open_questions[]
 *   ## Goal                         — from newest.goal
 *   ## Next best step               — from newest.next_best_step
 *   ## Latest summary               — from newest.summary
 *   ## Sessions                     — table from sessions[]
 *
 * @param {string} sessionId
 * @param {object} result  Return value of assembleSessions()
 * @returns {string}
 */
export function renderPointer(sessionId, result) {
  const now = new Date().toISOString();
  const lines = [];

  // Frontmatter
  lines.push('---');
  lines.push(`session_id: ${sessionId}`);
  lines.push(`schema_version: 3`);
  lines.push(`last_pointer_rewrite: ${now}`);
  lines.push(`session_count: ${result.session_count}`);
  lines.push('---');
  lines.push('');

  // ## Open questions (still open)
  lines.push('## Open questions (still open)');
  lines.push('');
  if (result.still_open_questions.length === 0) {
    lines.push('- none');
  } else {
    for (const q of result.still_open_questions) {
      lines.push(`- [${q.id}] ${q.text} → ${relLink(q.source_file)} (age: ${q.age_sessions})`);
    }
  }
  lines.push('');

  // ## Goal
  lines.push('## Goal');
  lines.push('');
  lines.push(result.newest.goal);
  lines.push('');

  // ## Next best step
  lines.push('## Next best step');
  lines.push('');
  lines.push(result.newest.next_best_step);
  lines.push('');

  // ## Latest summary
  lines.push('## Latest summary');
  lines.push('');
  lines.push(result.newest.summary);
  lines.push('');

  // ## Sessions table
  lines.push('## Sessions');
  lines.push('| timestamp | summary | file |');
  lines.push('|---|---|---|');
  for (const s of result.sessions) {
    const safeTs = s.ts.replace(/\|/g, '\\|');
    const safe = s.summary.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').slice(0, 200);
    lines.push(`| ${safeTs} | ${safe} | ${relLink(s.file)} |`);
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Fsync-aware atomic write helper (Apply: D001)
//
// Uses .HANDOFF-{pid}-{random}.tmp naming so the post-rename PID-liveness
// stale-sweep can parse {pid}. The tmp file lives in the SAME <session-dir>
// to avoid cross-device EXDEV on rename.
//
// State/transition (per plan spec):
//   pre-open : openSync(tmpPath, 'wx') — OUTSIDE try/finally (exclusive-create
//              is the load-bearing invariant; if open throws, fd is undefined,
//              so closeSync(undefined) is never called)
//   write    : writeSync(fd, content) — throws → unlinkSync(tmp) + re-throw ORIGINAL
//   sync     : fsyncSync(fd)          — throws → unlinkSync(tmp) + re-throw ORIGINAL
//   finally  : closeSync(fd) ALWAYS   — prevents fd leak
//   rename   : renameSync(tmp, HANDOFF.md) — atomic
//   sweep    : for each .HANDOFF-{pid}-*.tmp: parse pid, kill(pid,0) → ESRCH → unlink
// ---------------------------------------------------------------------------

/**
 * Atomically write content to targetPath via a tmp file in sessionDir.
 * @param {string} sessionDir  Directory holding the tmp file (same as target dir)
 * @param {string} targetPath  Final destination path (HANDOFF.md)
 * @param {string} content     Rendered pointer string
 */
function atomicWritePointer(sessionDir, targetPath, content) {
  const pid = process.pid;
  const random = randomBytes(4).toString('hex');
  const tmpName = `.HANDOFF-${pid}-${random}.tmp`;
  const tmpPath = join(sessionDir, tmpName);

  // OUTSIDE try/finally: exclusive-create ('wx') is the load-bearing invariant
  // for the stale-sweep — concurrent invocations generating the same name would
  // clobber each other with 'w'. If open throws, fd is undefined.
  const fd = openSync(tmpPath, 'wx');

  try {
    try {
      writeSync(fd, content);
      fsyncSync(fd);
    } catch (opErr) {
      // Unlink the partial file, then re-throw the ORIGINAL error.
      // If unlink itself fails, log a warning and re-throw the original.
      try { unlinkSync(tmpPath); } catch (unlinkErr) {
        process.stderr.write(
          `WARNING: could not remove partial tmp ${tmpPath}: ${unlinkErr.message}\n`
        );
      }
      throw opErr;
    }
  } finally {
    // closeSync ALWAYS runs — prevents fd leak.
    // Advisory: on a rare OS-level error, closeSync itself may throw, replacing
    // the already-re-thrown write/sync error. This is low-probability and
    // acceptable; the original error is already preserved in the inner catch.
    closeSync(fd);
  }

  // Atomic rename over HANDOFF.md — old file untouched if rename fails.
  renameSync(tmpPath, targetPath);

  // Post-rename PID-liveness stale-sweep.
  // For each .HANDOFF-{pid}-*.tmp remaining in sessionDir: if the owning
  // process is dead (ESRCH from kill(pid, 0)), delete the orphan.
  try {
    for (const entry of readdirSync(sessionDir)) {
      const m = entry.match(/^\.HANDOFF-(\d+)-[0-9a-f]+\.tmp$/);
      if (!m) continue;
      const stalePid = parseInt(m[1], 10);
      let alive = false;
      try {
        process.kill(stalePid, 0);
        alive = true;
      } catch (killErr) {
        // EPERM: process exists but isn't signalable by us (different UID) — treat as alive,
        // do not sweep it out from under a live concurrent writer.
        // ESRCH/other: no such process — treat as dead, safe to sweep.
        alive = killErr && killErr.code === 'EPERM';
      }
      if (!alive) {
        try { unlinkSync(join(sessionDir, entry)); } catch { /* best effort */ }
      }
    }
  } catch { /* sweep failure is non-fatal */ }
}

// ---------------------------------------------------------------------------
// rewritePointer — exit-free, throwing core
// ---------------------------------------------------------------------------

/**
 * Pointer content with the last_pointer_rewrite line removed, for comparing two
 * renders on everything except the stamp.
 */
function withoutStamp(content) {
  return content.replace(/^last_pointer_rewrite:.*$/m, '');
}

/**
 * Regenerate the v3 HANDOFF.md pointer for an already-resolved workstream dir.
 * Exit-free and side-effect-scoped: assembles the session log, renders the v3
 * pointer, atomic-writes it. Throws on failure — never calls process.exit.
 *
 * @param {string} resolvedSessionDir absolute path to S-{id}/ (caller validates sandbox)
 * @returns {{ sessionCount: number, targetPath: string, written: boolean }}
 *          written is false when the on-disk pointer already matched (no write performed)
 * @throws Error with .code 'NO_SESSIONS_DIR' | 'NO_SESSIONS' | 'FS_READ' (from
 *         assembleSessions) or .code 'POINTER_WRITE' (atomic-write failure)
 */
export function rewritePointer(resolvedSessionDir) {
  const dirBasename = basename(resolvedSessionDir);
  const sessionId = dirBasename.startsWith('S-') ? dirBasename.slice(2) : dirBasename;
  const result = assembleSessions(resolvedSessionDir, { format: 'json' }); // throws NO_SESSIONS* / FS_READ
  const rendered = renderPointer(sessionId, result);
  const targetPath = join(resolvedSessionDir, 'HANDOFF.md');

  // A rewrite that would change nothing but the stamp must not touch the file:
  // /pickup on an unchanged workstream is the common case, and a bumped timestamp
  // there is pure git noise that mixes into unrelated work. Comparing against the
  // on-disk pointer also keeps the repair path — a pointer that IS stale relative
  // to sessions/ still differs here and still gets written.
  if (existsSync(targetPath)) {
    try {
      if (withoutStamp(readFileSync(targetPath, 'utf-8')) === withoutStamp(rendered)) {
        return { sessionCount: result.session_count, targetPath, written: false };
      }
    } catch {
      // unreadable — fall through and write, same as if it were absent
    }
  }

  try {
    atomicWritePointer(resolvedSessionDir, targetPath, rendered);
  } catch (err) {
    err.code = 'POINTER_WRITE';   // unconditional tag so the CLI always prints "failed to write pointer:"
    throw err;
  }
  return { sessionCount: result.session_count, targetPath, written: true };
}

// ---------------------------------------------------------------------------
// dispatch — CLI entry point
// ---------------------------------------------------------------------------

export async function dispatch(argv) {
  // Install SIGINT handler immediately.
  // On POSIX, renameSync is atomic — if SIGINT fires after it starts, the
  // rename completes. Before rename: exit immediately; orphan tmp reclaimed
  // by the next invocation's stale-sweep.
  process.on('SIGINT', () => {
    process.exit(EXIT.CANCELLED);
  });

  try {
    // -------------------------------------------------------------------------
    // Arg parsing
    // -------------------------------------------------------------------------
    let sessionDirArg = null;
    let quiet = false;
    let stopFlags = false;

    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];

      if (a === '--') { stopFlags = true; continue; }

      if (!stopFlags && a.startsWith('-')) {
        if (a === '-h' || a === '--help') {
          process.stdout.write(HELP);
          process.exit(EXIT.SUCCESS);
        }
        if (a === '--quiet') { quiet = true; continue; }
        // Unknown flag
        process.stderr.write(`ERROR: unknown option: ${a}\n\n`);
        process.stderr.write(HELP);
        process.exit(EXIT.USER_ERROR);
      }

      // Positional argument
      if (sessionDirArg !== null) {
        process.stderr.write(
          'ERROR: too many positional arguments — rewrite-pointer takes exactly one <session-dir>\n\n'
        );
        process.stderr.write(HELP);
        process.exit(EXIT.USER_ERROR);
      }
      sessionDirArg = a;
    }

    if (sessionDirArg === null) {
      process.stderr.write('ERROR: rewrite-pointer requires <session-dir>\n\n');
      process.stderr.write(HELP);
      process.exit(EXIT.USER_ERROR);
    }

    // -------------------------------------------------------------------------
    // Project root resolution and sandbox guard
    // (mirrors cat-sessions.mjs pattern, research.md Constraint 1)
    // -------------------------------------------------------------------------
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
        `ERROR: session-dir must be inside project scratch root\n` +
        `  expected prefix: ${scratchRoot + sep}\n` +
        `  resolved: ${resolvedSessionDir}\n`
      );
      process.exit(EXIT.USER_ERROR);
    }

    // -------------------------------------------------------------------------
    // Delegate to the exit-free core, then map its thrown errors to the SAME
    // exit codes/stderr messages the inline implementation produced.
    // -------------------------------------------------------------------------
    let sessionCount, targetPath, written;
    try {
      ({ sessionCount, targetPath, written } = rewritePointer(resolvedSessionDir));
    } catch (err) {
      if (err.code === 'NO_SESSIONS_DIR' || err.code === 'NO_SESSIONS') {
        process.stderr.write(`ERROR: ${err.message}\n`);
        process.exit(EXIT.USER_ERROR);
      }
      if (err.code === 'POINTER_WRITE') {
        process.stderr.write(`ERROR: failed to write pointer: ${err.message}\n`);
        process.exit(EXIT.INFRA_ERROR);
      }
      // any other (e.g. FS_READ) → INFRA_ERROR
      process.stderr.write(`ERROR: ${err.message}\n`);
      process.exit(EXIT.INFRA_ERROR);
    }

    // Status line to stderr (suppressed by --quiet).
    // Stdout stays empty — only the pointer file itself is the output artifact.
    if (!quiet) {
      process.stderr.write(
        `${sessionCount} sessions processed, ` +
        `${written ? 'pointer written' : 'pointer already current'}: ${targetPath}\n`
      );
    }

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
// rewrite-pointer.mjs ...`), not just when imported by scratch-memory.mjs.
// Without this, direct invocation silently exits 0 with no output (issue:
// verb-modules-silent-noop-direct-invocation).
// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dispatch(process.argv.slice(2)).catch(err => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(2);
  });
}
