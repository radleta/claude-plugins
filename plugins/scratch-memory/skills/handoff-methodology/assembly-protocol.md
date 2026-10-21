# Handoff — Assembly Protocol

Companion to [SKILL.md](SKILL.md): how `cat-sessions` assembles the resume brief and `rewrite-pointer` regenerates `HANDOFF.md` from the session log and the close ledger, the `/handoff` Step 1b disposition pass that reads it, and how the brief renders tasks. Read when changing either verb, reading their output shapes, or authoring a disposition line.

Contents: Recency ordering · Budget algorithm · Open-questions carry-forward · Handoff disposition pass (Step 1b) · Cumulative sections carry-forward · rewrite-pointer contract · cat-sessions contract · Brief rendering contract

The two CLI verbs that implement this protocol:

- **`scratch-memory cat-sessions <session-dir> [--max-chars N] [--format full|summary|json]`** — assembles a bounded brief from the session log (used by `/pickup` for the resume brief, and internally by `rewrite-pointer`).
- **`scratch-memory rewrite-pointer <session-dir>`** — (re)generates the v3 thin-pointer `HANDOFF.md` from the immutable session log and the close ledger, `groom-closes.md`. `write_session` invokes this same regeneration inline on every write, and `scratch-memory session close` after every ledger line (Invariant 3 in [SKILL.md](SKILL.md)); the CLI verb is for manual/recovery use.

## Assembly

### Recency ordering

Sessions are sorted newest-first by the ISO timestamp prefix of the session filename. Fallback: file mtime if the prefix is unparseable; if mtime values are equal (coarse-grained timestamps on FAT32 or NFS), sort by filename lexicographic order as a final tiebreaker.

### Budget algorithm (cat-sessions)

Budget B defaults to **30000 characters** (roughly ~7500 tokens). Chars, not tokens — the CLI has no tokenizer.

1. **Always-inline-newest floor:** the newest session is always fully inlined, even if its body alone exceeds B.
2. Inline older sessions in recency order, accumulating char count, as long as `cumulative + body ≤ B` (hard cap — a non-newest session is never inlined when doing so would push cumulative over B). The first older session that would exceed the cap stops inlining; to keep the included window contiguous (newest-first), all remaining older sessions are then summary-only — even if a later one would individually fit.
3. All remaining (older) sessions render as `summary + link` rows only — their full bodies are not included in the brief.

### Open-questions carry-forward

Computed across the **whole log**, independent of the budget window:

- **Input:** union of all `## Open questions raised` entries from every session.
- **Resolved set:** union of all `## Open questions resolved` entries from every session, and every close in the workstream's ledger (see Ledger closes below).
- **Still-open set (ordering-aware):** a kernel is still-open iff it was never resolved, OR its most-recent raise is chronologically newer than its most-recent resolve — so a question raised, resolved, then genuinely re-raised in a later session surfaces again.
- **Normalization:** each entry is reduced to its **question kernel** — markdown emphasis and backticks stripped, a leading `[q-<hex6>]` token removed, then the question text up to the first `?`, with any appended `→ RESOLVED:` answer removed — then trimmed, lowercased, and whitespace-collapsed. Dedup by kernel.
- **Question ID:** each kernel has a stable ID, `'q-' + sha256(kernel).hex.slice(0, 6)` — a pure function of the kernel alone, so it is computable for every existing question and never renumbers when sessions are inserted. An author may resolve a carried-forward question by ID instead of restating its kernel verbatim: `- q-<hex6> → RESOLVED: <answer>`.
- **Resolve precedence (guard → ID → kernel):** for each `## Open questions resolved` entry, three conditions are computed independently, then the entry is matched by the first that applies:
  1. **STILL-OPEN guard.** The substring from the first `→` / `->` / `RESOLVED:` delimiter to the end of the bullet — or the whole bullet, when no delimiter is present — is scanned for `STILL OPEN`, `UNRESOLVED`, or `NOT RESOLVED` (case-insensitive, hyphen/space-tolerant). A match **vetoes cancellation unconditionally**: the entry sets nothing — no resolve, no re-raise, no attribution change — regardless of whether an ID or a kernel also matches. This lets an author acknowledge a carried-forward question without answering it, without resetting its age.
  2. **ID match.** Otherwise, if the bullet contains a `q-<hex6>` token that maps to exactly one kernel across the whole log, that kernel resolves — regardless of what text the bullet also restates.
  3. **Kernel match.** Otherwise, if the bullet's own kernel exists among the raised kernels, that kernel resolves (the verbatim-restatement behavior above).

  An entry matching none of the three cancels nothing (orphan resolution — the majority case in practice). Every entry cancels **at most one** kernel: an ID match never additionally cancels the kernel its restated text would otherwise have matched.
- **Ledger closes:** `scratch/S-{id}/groom-closes.md` is the ledger `scratch-memory session close` appends to, for the groom sub-agent and the event groomer, which cannot write session files. One `## {event} {run}` heading per run, `{run}` an ISO UTC time, then one line per close: `- q-<hex6> → RESOLVED: closed — <answered|moot|tracked>: <cite> — "<quote>"`. A ledger line pairs with its question **by id alone**: it never goes through the kernel matcher or the STILL-OPEN guard, so a quote that says `STILL OPEN` still closes. It resolves at the position of the newest session written at or before its heading's time, so a question raised again in a later session surfaces again. A line whose id maps to no raised kernel or to more than one, or whose heading carries no time that parses, closes nothing. A workstream with no ledger assembles exactly as it would without this rule.
- **Ambiguous-ID fallback:** an ID that maps to more than one kernel (a collision) is treated as if no ID were present on that entry — resolution falls through to kernel matching rather than cancelling any of the colliding kernels.
- **Attribution:** if the kernel was never resolved, display the original text from, and link to, the **oldest** (chronologically earliest) session that raised it. If it was resolved at some point and then re-raised, attribute to the **newest** raise instead — the re-raise is the one still open.
- **Age:** each still-open entry also carries `age_sessions = session_count − attributingRaiseOrder`, where `attributingRaiseOrder` is the 1-based oldest-to-newest position of the same attributing raise used above (`firstRaise` for a never-resolved kernel, `lastRaise` for a resolved-then-re-raised one) — an integer in `[0, session_count − 1]`. A genuine re-raise resets the clock: attribution moves to the newest raise, so age is measured from there, not from the original raise.
- **Ordering:** `still_open_questions` is sorted `age_sessions` DESC (oldest first), then `id` ASC, then kernel ASC. The kernel is a sort input only and never appears in rendered or json output.
- **Safe direction:** a kernel not found in the resolved set, or resolved-then-re-raised, stays still-open — a real question is never dropped by a reword or a stale resolution.
- **Authoring note:** author each entry as a `- ` bullet (one entry per bullet); restate the question kernel (text up to the first `?`) verbatim, then the answer — e.g. `<question>? → RESOLVED: <answer>` — or resolve by ID (see Question ID above) when restating the kernel is inconvenient. To acknowledge a carried-forward question without resolving it, annotate `→ STILL OPEN` (or `UNRESOLVED` / `NOT RESOLVED`) — this is never treated as a resolution, whether or not the bullet also carries a matching ID or kernel. A resolution that matches neither an ID nor a kernel stays still-open. Leave `## Open questions raised` / `## Open questions resolved` **empty** when there is nothing to record — never author a placeholder bullet such as `- none`, `- N/A`, or `- (none new …)`; `extractBullets` filters any such bullet on read, so an authored placeholder is silently dropped rather than preserved.
- **Empty list:** renders an explicit `none` line.
- **Cap, `--format full` only:** a block whose rows total more than `--max-cumulative-chars` (default 6000), each row counted as `cumulativeBlock` counts one, is trimmed to its **newest raises, newest first** (`age_sessions` ASC, ties in the order above), stopping before the row that would pass the cap, and ends with the count line `_… N more still open (see HANDOFF.md)_`. A block within the cap prints every row in the order above. `--format summary`, `--format json` and `HANDOFF.md` are never capped or reordered.

Row format: `- [q-XXXXXX] <question> → [sessions/{file}](sessions/{file}) (age: N)`. Both `cat-sessions` (brief) and `rewrite-pointer` (pointer) render this identical shape. Path separators are normalized to `/` at the link-building chokepoint (`relLink` in `cat-sessions.mjs`; the equivalent inline form in `rewrite-pointer.mjs`) regardless of the platform-native separator `source_file` carries.

Legacy session files lacking `summary:` are handled by a read-side derivation fallback in `cat-sessions` — see [legacy-and-recovery.md](legacy-and-recovery.md).

### Handoff disposition pass (Step 1b)

`/handoff` Step 1b runs `cat-sessions 'scratch/S-{session_id}/' --format json --with-tasks` before body composition (Step 2) and walks the returned `still_open_questions`, deciding per entry `Q` whether Step 2 authors a `## Open questions resolved` line:

| Answered this session | Moot this session | `Q.id` usable | Line authored |
|---|---|---|---|
| yes | — | yes | `q-<id> → RESOLVED: <answer>` |
| yes | — | no | `<question kernel verbatim> → RESOLVED: <answer>` |
| no | yes | yes | `q-<id> → RESOLVED: closed — <reason>` |
| no | yes | no | `<question kernel verbatim> → RESOLVED: closed — <reason>` |
| no | no | — | *(no line — still open; carry-forward is automatic)* |

**Acknowledging without resolving:** a question reviewed this session but deliberately left open (not answered, not moot) may optionally be recorded as `q-<id> → STILL OPEN — <note>` (or the kernel-verbatim form). This is never treated as a resolution and never resets the question's age — see the STILL-OPEN guard under [Open-questions carry-forward](#open-questions-carry-forward) for the engine-side mechanics. It distinguishes "reviewed and consciously left open" from a question nobody looked at this session; carry-forward remains automatic either way.

`<question kernel verbatim>` copies `Q.text` from its start up to and including the first `?` (or the whole kernel when there is none) — a `?` is never appended, since doing so to an imperative kernel produces a string the next read won't match, silently reopening the question. A carried-forward question is never restated in `## Open questions raised` — that section is a per-session delta of genuinely new questions only.

On any non-zero `cat-sessions` exit, Step 1b skips disposition and proceeds to Step 2 without failing the handoff, but names which exit occurred: exit 1 (no prior log — the expected first-handoff case) vs exit 2 (FS/infra failure — worth investigating before the next handoff). Step 1b is read-only — it writes nothing. Task writes happen in Step 1d, which also decides the line for an answered or moot question that is an action offer (see [tasks-methodology.md](tasks-methodology.md)), and the session write in Step 3.

### Cumulative sections carry-forward

`cat-sessions` computes three read-side cumulative sets — Decisions made, What to avoid, Done — from the **whole log**, the same oldest-first traversal used for open-questions accumulation, independent of the `--max-chars` budget window.

- **Whole-log accumulation:** each session's `## Decisions made` / `## What to avoid` / `## Done` bullets are folded into a running set as the log is walked oldest-to-newest, regardless of whether that session's body is inlined or trimmed to summary-only in the brief.
- **Dedup key:** each bullet is reduced to a normalized key — markdown emphasis/backticks stripped, trimmed, lowercased, whitespace-collapsed, then truncated to its first 80 characters — before being folded into the set. Two bullets sharing the same 80-char-normalized prefix collapse to one entry.
- **Oldest-wins attribution:** when two bullets collide on the same key, the **first (oldest) occurrence** is kept — its text and source file are the ones that render — mirroring the oldest-wins attribution rule for still-open questions.
- **Render order:** `cumulative_done` / `cumulative_decisions` / `cumulative_avoid` are newest-first by the order of each entry's oldest occurrence — the most recently introduced surviving entries render first.
- **Per-block char cap, `--format full` only:** `cumulativeBlock` renders newest-first rows and stops before the running total would exceed `--max-cumulative-chars` (default 6000), appending a `_… N more (see sessions/)_` elision line whenever any entry is omitted. `--format json --with-history` emits `cumulative_done` / `cumulative_decisions` / `cumulative_avoid` as complete, untruncated arrays regardless of the cap, and default `--format json` leaves them out — the cap is a `full`-format rendering concern only.
- **No minimum-entries floor:** unlike the always-inline-newest floor in the [budget algorithm](#budget-algorithm-cat-sessions), the cumulative renderer guarantees nothing analogous. A cap smaller than the first row's rendered length renders **zero rows plus the elision line** — an empty-looking block despite content existing in the log.
- **`--format summary` never gains these blocks** — `summary` exists only to feed the pointer Sessions table and stays byte-stable.

### rewrite-pointer contract

`rewrite-pointer <session-dir>` renders the v3 thin pointer from the session log and the close ledger by calling the assembly module (`cat-sessions --format json`) to obtain:
- `newest.goal` → `## Goal`
- `newest.next_best_step` → `## Next best step`
- `newest.summary` → `## Latest summary`
- `still_open_questions[]` → `## Open questions (still open)` — same row format as the brief: `- [q-XXXXXX] <question> → [sessions/{file}](sessions/{file}) (age: N)` (see Row format above), every row, uncapped
- `sessions[]` → `## Sessions` table (one row per session, newest first; format: `| timestamp | summary | file |`)

Writes atomically via tmp + rename (`.HANDOFF-{pid}-{random}.tmp` in the same `<session-dir>`). On any write/sync failure, the prior `HANDOFF.md` is untouched. Post-rename stale-sweep removes orphaned tmp files from prior crashed invocations using PID-liveness check.

**Exit codes:**
- `0` — pointer written; status line on stderr: `N sessions processed, pointer written: <path>`.
- `1` — user/argument error (missing arg, empty sessions dir, out-of-sandbox path, unknown flag).
- `2` — FS write or read failure.

If `write_session` reports `pointer.written === false` (inline regeneration failed) — or a manual `rewrite-pointer` re-run exits non-zero — `/handoff` surfaces a STALE-POINTER WARNING but does NOT fail the handoff; the per-session file is already durably flushed.

### cat-sessions contract

`cat-sessions <session-dir> [--max-chars N] [--max-cumulative-chars N] [--format full|summary|json] [--with-tasks] [--with-history]`

`--max-cumulative-chars` (default 6000) is the per-block char cap for the three cumulative sections described above and for the still-open questions block (see Cap under [Open-questions carry-forward](#open-questions-carry-forward)). The cap applies to `--format full` only; `--format json` leaves the three cumulative arrays out by default and emits them untruncated under `--with-history`, so passing the flag never shrinks a JSON payload.

`--with-tasks` appends a `## Tasks` block — rendered by the same `renderTasksBlock` the standalone `scratch-memory tasks list` verb uses (see [Brief rendering contract](#brief-rendering-contract) below) — listing a workstream's open and blocked tasks. It applies to `--format full` and `--format json`; `--format summary` silently ignores it, the same way `--format json` silently ignores `--max-cumulative-chars` above — `summary` exists only to feed the pointer Sessions table and stays byte-stable regardless of either flag.

**Output formats:**
- `full` (default) — `## Open questions (still open)` block, trimmed to its newest raises with a count line when it is over the `--max-cumulative-chars` cap, then the three cumulative blocks — `## Decisions (cumulative)`, `## What to avoid (cumulative)`, `## Done (cumulative)` — each newest-first under the `--max-cumulative-chars` cap (see [Cumulative sections carry-forward](#cumulative-sections-carry-forward) above), then — only when `--with-tasks` is passed — the `## Tasks` block followed by up to two `GROOM:` lines (a data line counting `session lint`'s findings other than `version-behind`, and a version line when `groom.yaml` is missing or behind `TASKS_METHODOLOGY_VERSION`, task files or not; the data line drops its `— detail:` command when the session-dir argument holds a character outside `[A-Za-z0-9._/-]`), then newest-first inlined session bodies with header lines, then `summary + link` tail for trimmed older sessions. Used as the resume brief by `/pickup`.
- `summary` — open-questions block + one `summary + link` row per session (no full bodies, no cumulative blocks, no tasks block even with `--with-tasks`). Row source for the pointer Sessions table.
- `json` — `{ session_dir, budget_chars, cumulative_cap_chars, session_count, still_open_questions: [{id, text, source_file, age_sessions}], newest: {goal, next_best_step, summary, file}, sessions: [{ts, file, summary, inlined: bool, body?}], cumulative_done: [{text, source_file}], cumulative_decisions: [{text, source_file}], cumulative_avoid: [{text, source_file}] }`, plus — only when `--with-tasks` is passed — `tasks: [{id, title, status, blocked_on?, created, updated, age_days, file}]`, `task_warnings: [string]`, and `groom: {data_problems, methodology_version, marker_version, version_behind}`. `tasks` is the complete, unfiltered task list across every status; the `full`-format `## Tasks` block, by contrast, renders only `open`/`blocked` rows plus a closed-count summary. `body` present only for inlined sessions. `still_open_questions` is sorted `age_sessions` DESC, then `id` ASC, then kernel ASC (see Ordering above) — the kernel itself is not a field in this shape. The three `cumulative_*` arrays are always complete and untruncated, regardless of `--max-cumulative-chars` — the cap is a `full`-format render-time concern only. This whole shape is what `--with-history` prints, byte for byte, and what `assembleSessions()` returns to the in-process callers (`rewrite-pointer`, `wrap collect`, `session lint`, and through `assembleWithMarks()`, which adds each question's newest still-open mark beside it, `session close` and `session radius`).
  - **Default `json`** (no `--with-history`) is the same object trimmed to what its CLI readers use — `/handoff` Step 1b, groom and `wrap-up`, which read `still_open_questions` and `tasks`. It drops `budget_chars`, `cumulative_cap_chars` and the three `cumulative_*` arrays, and each `sessions[]` row keeps only `{ts, file, summary}`. `still_open_questions`, `newest`, the `--with-tasks` fields and the scalars are never trimmed. Session rows are kept newest-first while the printed output (`JSON.stringify(payload, null, 2) + '\n'`) stays at or under 28,000 characters (`JSON_BUDGET_CHARS`), and the rest are dropped from the oldest end. The payload always ends with `omitted: {restore_flag: "--with-history", budget_chars, cumulative: {done, decisions, avoid}, session_bodies, session_rows: {count, find}, over_budget}` — the removed array lengths, the number of bodies `--with-history` would give back, the dropped row count and the `<session-dir>/sessions/` path holding them, and `over_budget: true` when the used pieces alone exceed the budget, in which case zero rows print and the output runs over. `session_count` still counts every session.

**Contracts:**
- `requires`: `<session-dir>` provided; `<session-dir>/sessions/` exists and contains ≥1 `*.md` file.
- `ensures`: deterministic output for identical inputs; newest session body always present in `full` and `json --with-history`; the still-open set never drops a raised-and-unresolved question: `json`, `summary` and `HANDOFF.md` list every one, and a `full` block over the cap says how many it left out and where they are.
- `invariants`: read-only — never writes, never mutates session files; malformed task files (`--with-tasks` only) never change the exit code — a bad `tasks/` entry surfaces as an embedded `WARN:` line, never a failure; bounded brief (`full` size ≤ ~`B` + 4 × `C` + **tasks block** + per-session summary tail, where `B` is `--max-chars` and `C` is `--max-cumulative-chars`) regardless of session count — the tasks term is **uncapped**, linear in the number of open/blocked tasks (roughly 100 bytes per row).

**Exit codes:** `0` success; `1` user/argument error; `2` FS read failure.

### Brief rendering contract

`/pickup`'s resume brief (via `cat-sessions --with-tasks`) and the standalone `scratch-memory tasks list <session-dir>` verb both render the identical `## Tasks` block through one shared renderer, `renderTasksBlock` in `tasks.mjs`.

- **Row format:** `- [t-{6hex}] <title> (<status-clause>, <age>)`, where `<status-clause>` is `blocked on: <blocked_on>` when the task is blocked and carries a `blocked_on` value, otherwise the bare status word.
- **Ordering:** blocked tasks first, then open tasks; within each group, oldest `updated:` first (largest age first); `id` ASC as the final tiebreak.
- **Age rule:** UTC calendar-day age computed from `updated:` (see `## Age is not mtime` in [task-files.md](task-files.md)). A task updated the same UTC calendar day renders `updated today`; otherwise `updated Nd ago`; an unparseable `updated:` renders `updated unknown`.
- **Closed-count line:** when any task is `done`, `dropped`, or `promoted`, a trailing line reads `N done, N dropped, N promoted — see tasks/`.
- **Empty case:** a workstream with no open or blocked tasks — including one that has never had a `tasks/` directory at all — renders `- none`, never an empty block and never an error.
- **Warnings embedded:** one `WARN: <file-basename>: <problem>` line per malformed task file is appended after the closed-count line — the same `WARN:` shape `tasks lint` and the `scratch-lint.sh` hook emit.
