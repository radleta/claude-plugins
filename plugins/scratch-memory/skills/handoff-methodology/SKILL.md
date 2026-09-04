---
name: handoff-methodology
description: 'Captures session state into per-session files, assembles the HANDOFF.md pointer via `rewrite-pointer`, and produces the resume brief at /pickup. Use when writing a handoff, picking up a prior session, handling a legacy HANDOFF.md folder, or deciding which skills to re-load — even for short sessions where /compact looks tempting.'
user-invocable: false
---

# Handoff Methodology

Backing reference for the `/handoff` and `/pickup` commands, which inline their executable mechanics; reaches context via auto-discovery or an explicit Skill load. Defines the v3 HANDOFF.md schema, per-session file schema, skills loading at /pickup, recovery procedures, local-memory boundary, and session name resolution.

## Upgrading older folders to v3

Legacy V1/V2 folders upgrade just-in-time to v3 — per-folder, no bulk sweep. For the V1-vs-V2 procedures and the `rewrite-pointer` escape hatch, Read [legacy-and-recovery.md](legacy-and-recovery.md).

## HANDOFF.md Schema (v3 — thin pointer)

`HANDOFF.md` is a **derived cache** over the immutable per-session log. Deleting it loses nothing — `scratch-memory rewrite-pointer <session-dir>` regenerates it from the `sessions/` directory. It is written mechanically — `write_session` regenerates it inline right after the session file is durably written; the `rewrite-pointer` CLI is the manual/recovery path. LLM synthesis is not involved.

**Frontmatter:**

```yaml
---
session_id: <slug>
schema_version: 3
last_pointer_rewrite: <ISO-8601-Z>
session_count: <N>
---
```

**Body sections (in order):**

| Heading | Content |
|---|---|
| `## Open questions (still open)` | Carry-forward set: still-open questions computed across the whole log per the ordering-aware algorithm (see Open-questions carry-forward). Each row: `- [q-XXXXXX] <question> → [sessions/{file}](sessions/{file}) (age: N)`. Empty list renders `none`. |
| `## Goal` | Verbatim `goal_at_time` from the newest session file. |
| `## Next best step` | Verbatim `## Next best step` body from the newest session file. |
| `## Latest summary` | Verbatim `summary:` frontmatter value from the newest session file (or the read-side derived fallback if absent). |
| `## Sessions` | One row per session, newest first. Format: `\| timestamp \| summary \| file \|`. |

**Full v3 template:**

```
---
session_id: <slug>
schema_version: 3
last_pointer_rewrite: <ISO-8601-Z>
session_count: <N>
---

## Open questions (still open)
- [q-XXXXXX] <question> → [sessions/{file}](sessions/{file}) (age: N)

## Goal
<verbatim newest goal_at_time>

## Next best step
<verbatim newest ## Next best step>

## Latest summary
<verbatim newest summary>

## Sessions
| timestamp | summary | file |
|---|---|---|
| <ts> | <summary> | [sessions/{file}](sessions/{file}) |
```

**Legacy divergence:** pre-redesign folders may have UUID frontmatter `session_id` diverging from the folder slug — see [legacy-and-recovery.md](legacy-and-recovery.md).

## Per-Session File Schema

**Path:** `sessions/{ISO-8601-timestamp-with-Z}-{8-char-shortid}.md`
Timestamps colon-replaced for filesystem compatibility (e.g., `T14:03:12Z` → `T14-03-12Z`).
**Filenames are immutable** — HANDOFF.md links depend on them. **Section headings are a versioned contract** the assembly parser depends on.

**Frontmatter:**

```yaml
---
session_id: <string — UUID pre-redesign, slug post-redesign>
started: <ISO-8601-with-Z>    # Server-injected on write — caller omits this field.
                               # The MCP write_session handler injects the server write-time
                               # ISO timestamp when this field is absent or empty-string in
                               # the caller-supplied body. Callers wanting a true session-start
                               # time may author it explicitly; the server will preserve it.
ended: <ISO-8601-with-Z>      # Server-injected on write — same semantics as started.
session_name: <slug or empty>
goal_at_time: <one-line goal as of this session>
summary: <one-line authored summary>   # composed at /handoff; read-side fallback in cat-sessions
parent_handoff_state: <path to prior HANDOFF.md, optional>
_legacy: <true if migrated, otherwise omitted>
---
```

**Body sections (in order):**

| Heading | Content |
|---|---|
| `## Goal` | The workstream goal — persistent across sessions, restated (and updated if the goal shifted) each session. Not a per-session snapshot; the per-session one-liner lives in `goal_at_time`. |
| `## Next best step` | This session's last view of next (preserves reasoning even after the index advances). **No working-tree assertions.** Uncommitted file counts, "the commit is still owed", and stray-file baselines all go stale when anyone commits between sessions, and the resuming agent reads them as current fact. Name the command that produces the state (`git status`, `git log --oneline {BASE}..HEAD`) instead of its output. Observed twice in this repo. |
| `## Done` | **Per-session delta**: what was accomplished this session only. Do not restate prior sessions' items — `cat-sessions` accumulates them across the whole log. |
| `## Decisions made` | **Per-session delta**: architectural and implementation decisions made this session only, with full rationale. Do not restate prior sessions' items — `cat-sessions` accumulates them across the whole log. |
| `## What to avoid` | **Per-session delta**: gotchas, dead ends, and anti-patterns discovered this session only. Do not restate prior sessions' items — `cat-sessions` accumulates them across the whole log. |
| `## Open questions raised` | **Per-session delta**: new questions surfaced this session only. Each entry is a `- ` bullet (one entry per bullet). Leave the section empty when there is nothing to raise — never a placeholder bullet such as `- none` or `- (none new …)`. |
| `## Open questions resolved` | **Per-session delta**: questions answered this session — restate the question kernel verbatim before the answer (see Open-questions carry-forward). Each entry is a `- ` bullet (one entry per bullet). Leave the section empty when there is nothing to resolve — never a placeholder bullet such as `- none` or `- N/A`. |
| `## Key files & artifacts` | Paths to source files, plans, specs, and scratch artifacts central to the workstream. |
| `## Skills used` | Flat list of skills loaded or relied on this session. |
| `## Projects` | Scratch project slugs active in this workstream (e.g. `handoff-sid-fix`). |

**Why per-session deltas:** all five list sections — `Done`, `Decisions made`, `What to avoid`, `Open questions raised`, `Open questions resolved` — are authored as per-session deltas: each session records only what happened in that session, never restating prior sessions' entries. `cat-sessions` derives the mechanical union at read time — the still-open question set via ID-based carry-forward (see [Open-questions carry-forward](#open-questions-carry-forward)) and the three cumulative lists via dedup-on-read (see [cumulative sections carry-forward](#cumulative-sections-carry-forward)) — both computed across the whole log, not authored by hand. This keeps session files small and preserves per-session attribution that a hand-maintained cumulative list would lose.

## Tasks

`scratch/S-{slug}/tasks/t-{6hex}-{title-slug}.md` — one file per workstream work item, written exclusively by the `write_task` MCP tool (`scratch-memory`'s [mcp-tools.md](../scratch-memory/mcp-tools.md), `## Tool: write_task`). This section covers the file schema, who writes tasks, how `/pickup`'s resume brief renders them, the mutable-zone carve-out this directory needs on Invariant 4, the questions-versus-tasks boundary, the manual promotion flow to `scratch/issues/`, and why age is computed from frontmatter rather than mtime.

### File schema

**Path:** `scratch/S-{session_id}/tasks/t-{6hex}-{title-slug}.md` — `t-{6hex}` is the server-minted id (e.g. `t-3f9a2c`), followed by a `-` and the title's `deriveSlug()`-derived slug.

**Frontmatter:**

| Key | Optionality | Notes |
|---|---|---|
| `id` | required | `t-` + 6 hex chars — see ID minting below |
| `title` | required | 1–80 characters |
| `status` | required | one of `open \| blocked \| done \| dropped \| promoted` |
| `created` | required | server-stamped ISO-8601 timestamp at creation |
| `updated` | required | server-stamped at creation, hand-bumped on every subsequent edit (see Age is not mtime below) |
| `blocked_on` | optional | 1–120 characters; meaningful only when `status: blocked` |
| `promoted_to` | optional | issue slug; added by hand only after manual promotion (see Manual promotion flow below) — never a `write_task` parameter |

**Body:** optional freeform markdown, ≤ 1 MB (`MAX_BODY_BYTES`).

**ID minting — mint-once random, never content-hashed.** `id` is a random 6-hex string minted once at creation and never recomputed. Contrast the `q-` question IDs documented in [Open-questions carry-forward](#open-questions-carry-forward) above, which *are* hashed — `'q-' + sha256(kernel).hex.slice(0, 6)` — a pure function of the question text. The reason for the difference: questions have no file to anchor identity to (a question's only durable existence is text buried inside a session file's body), so hashing the kernel is what makes the id reproducible across reads. A task, by contrast, *is* a file — the filename already anchors identity — so hashing would buy nothing and would break the moment the title changed (spec T2).

### Who writes tasks

The main session is the **only** writer of `tasks/`. `write_task` is called ad hoc by the main session directly when a work item surfaces in conversation — there is no command gate, and no `/capture-task` command exists yet (it is a growth-path candidate, not built). Neither `/handoff` nor `/pickup` ever creates a task. Sub-agents do not write tasks — a sub-agent needing to persist structured output uses `write_report`, `write_review`, or `write_issue` instead.

This is **Invariant 2** ("main session is the only writer for its own folder") applied to the new `tasks/` directory.

Exactly as for `write_session`, Invariant 2 is enforced here by **caller-wiring convention**, not by a code-level ownership check on `session_id`. Say this plainly, because it is the assumption most likely to mislead a reader: `write_task`'s only gates are the `session_id` charset check and the scratch-sandbox containment check — nothing on the server validates that the calling session actually owns the workstream named in `session_id`. A reader who assumes otherwise would be wrong, and that wrong assumption is exactly what this paragraph exists to prevent (decisions.md D15).

### Brief rendering contract

`/pickup`'s resume brief (via `cat-sessions --with-tasks`) and the standalone `scratch-memory tasks list <session-dir>` verb both render the identical `## Tasks` block through one shared renderer, `renderTasksBlock` in `tasks.mjs` — see the `--with-tasks` flag in [cat-sessions contract](#cat-sessions-contract) below, and the Sync Map row that ties the two together.

- **Row format:** `- [t-{6hex}] <title> (<status-clause>, <age>)`, where `<status-clause>` is `blocked on: <blocked_on>` when the task is blocked and carries a `blocked_on` value, otherwise the bare status word.
- **Ordering:** blocked tasks first, then open tasks; within each group, oldest `updated:` first (largest age first); `id` ASC as the final tiebreak.
- **Age rule:** UTC calendar-day age computed from `updated:` (see Age is not mtime below). A task updated the same UTC calendar day renders `updated today`; otherwise `updated Nd ago`; an unparseable `updated:` renders `updated unknown`.
- **Closed-count line:** when any task is `done`, `dropped`, or `promoted`, a trailing line reads `N done, N dropped, N promoted — see tasks/`.
- **Empty case:** a workstream with no open or blocked tasks — including one that has never had a `tasks/` directory at all — renders `- none`, never an empty block and never an error.
- **Warnings embedded:** one `WARN: <file-basename>: <problem>` line per malformed task file is appended after the closed-count line — the same `WARN:` shape `tasks lint` and the `scratch-lint.sh` hook emit.

### Mutable-zone carve-out on Invariant 4

Invariant 4 below says per-session files are immutable and a post-write mtime change is a defect. As written, that invariant already scopes to files under `sessions/`, so the new sibling `tasks/` directory does not strictly need an exemption — the carve-out added to Invariant 4's text is **defensive documentation**, not a weakening of the immutability guarantee. It exists so a reader who lands on Invariant 4 first sees the boundary stated rather than having to infer the scope from the wording. `sessions/` immutability is untouched, and `HANDOFF.md` remains a derived cache (Invariant 3).

### Questions versus tasks

Questions and tasks are two independent machineries answering two different needs. A **question** is a decision needing an answer — it lives inside a session file's `## Open questions raised` / `## Open questions resolved` sections and is carried forward by the whole-log algorithm in [Open-questions carry-forward](#open-questions-carry-forward) above. A **task** is a work item — it lives in its own file under `tasks/` and is mutated by hand-editing that file directly.

The practical test: if the next action on it is "find out," it's a question; if the next action is "do," it's a task. The two machineries are independent — a question is never auto-converted into a task, and a task is never auto-converted into a question. An author who wants both must create both by hand.

### Manual promotion flow

A task that outgrows its workstream is promoted to a standalone issue via a manual two-step (decisions.md D5):

1. Run `/capture-issue` to file the issue in `scratch/issues/`.
2. Hand-edit the task's frontmatter: set `status: promoted` and add `promoted_to: <issue-slug>`.

`capture-issue.md` has no write-back mechanism to the source task and gains none — the two invocations are genuinely separate. The `scratch-lint.sh` hook lints the hand-edit like any other `tasks/` edit (its T7 rule validates `status` against the enum, which includes `promoted`). The window between step 1 and step 2 — where the issue exists but the task still reads `open` — is accepted, not guarded against.

### Age is not mtime

A task's rendered age is computed from its `updated:` frontmatter value, never from the file's filesystem mtime. Git does not preserve mtimes across a clone, checkout, or worktree creation — every task's age would silently reset to "just modified" the moment a workstream folder is cloned or checked out fresh, which is precisely the drift this rule exists to prevent. `updated:` is bumped by hand on every edit that should reset the age clock, and the `scratch-lint.sh` hook's H1 rule mechanically guards this — it requires `updated:` to equal today's UTC date on any hook-observed edit to a `tasks/` file, catching the case where an editor forgets to bump it.

## Skills Loading at /pickup

The v3 flow carries no Mandatory/Available tiering — the tier system was retired with the synthesized index and the handoff-manager agent (its last consumers). `## Skills used` is a flat list.

At `/pickup`, the resume brief reads `## Skills used` from the newest session file (via `cat-sessions`) and applies pushy-load judgment against `## Next best step` and recent state: load each skill whose description plausibly applies to the upcoming work, preferring a false-positive over a false-negative. Hard cap: 5 skills.

## Stale-Question Triage Nudge at /pickup

`/pickup` Step 6a scans the `## Open questions (still open)` block assembled in Step 6 for rows whose `(age: N)` annotation — the `age_sessions` field from the `cat-sessions` json contract, rendered inline in `full` — has `N >= 3`. When one or more rows meet that threshold, Step 6a prints exactly one `TRIAGE:` line naming the count before Step 7 runs; when none do, it prints nothing.

The nudge is deliberately **non-blocking**: it never awaits a response and never opens an interactive question prompt, so it cannot stall an unattended resume that goes straight to Step 8's NBS execution. The actual disposition — answering or closing a stale question — happens later, at the next `/handoff`'s Step 1b (see [Handoff disposition pass (Step 1b)](#handoff-disposition-pass-step-1b)), which is the write path where a disposition can be recorded. See decisions.md D17 for the rejected interview-based alternatives.

## Recovery Procedures

`HANDOFF.md` is a derived cache — any corrupt/missing pointer is rebuilt by re-running `scratch-memory rewrite-pointer <session-dir>`. For the full recovery runbook (stale-pointer warning, legacy folder, full rebuild), see [legacy-and-recovery.md](legacy-and-recovery.md).

## Boundary with `local-memory`

Automated dispatches of `local-memory-updater` are **removed** (decision D6 of the lean-handoff redesign). With that removal, `CLAUDE.local.md` Active Projects is no longer auto-updated during `/implement-code` runs — it goes stale until the user manually invokes `Skill({skill: "local-memory"})` or the `/local-memory` command explicitly. Cross-session active-project state now lives in HANDOFF.md, discovered via `scratch-memory handoff list`. The `local-memory` skill and `local-memory-updater` agent were archived to `.claude-archive/` on 2026-09-04 (`scratch/issues/cut-local-memory.md`); nothing updates `CLAUDE.local.md` Active Projects now.

| Concern | `local-memory` | `handoff-methodology` |
|---|---|---|
| **Granularity** | Per-project, across all sessions | Per-session, across projects |
| **Storage** | `CLAUDE.local.md` (auto-loaded) | `scratch/S-{slug}/HANDOFF.md` + `sessions/*.md` |
| **Fidelity** | Terse — 6–8 lines per project | Hi-fi — indexed + per-session detail |
| **Auto-updated?** | No longer automatic (D6) | On every `/handoff` |

**Rule:** `/handoff` never modifies `CLAUDE.local.md`. `/local-memory` never touches `scratch/S-*/`. The two skills' trigger phrases are disjoint.

## Invariants

1. One workstream = one `scratch/S-{slug-or-uuid}/` folder = one `HANDOFF.md`.
2. Main session is the only writer for its own folder.
3. `HANDOFF.md` is a **derived cache**, regenerated automatically by `write_session` immediately after the session file is durably written — no separate agent step. The `rewrite-pointer` CLI verb is the manual/recovery path. No agent or LLM synthesizes the body. The per-session log in `sessions/` is the immutable source of truth; `HANDOFF.md` is always reconstructable from it.
4. Per-session files under `sessions/` are **immutable** post-write. A post-write mtime change to a `sessions/` file is a defect. **`tasks/` is a documented mutable zone** — task files (see `## Tasks` above) are hand-edited after creation (status changes, `blocked_on` updates, promotion), so post-write mutation there is expected behavior, not a defect. This clause is defensive documentation, not a weakening: Invariant 4 as originally scoped only ever covered `sessions/`, so `tasks/` never technically violated it — naming the boundary here means a reader lands on the answer instead of having to infer it from the wording.
5. `S-` prefix distinguishes session-scoped folders from project-scoped folders in `scratch/`.
6. Sessions cross-cut projects; the session folder enumerates related project folders, never the reverse.

## Session Name Resolution

**Post-redesign (handoff-sid-fix, 2026-05-05):** The canonical source shifted from PID files to caller-supplied argument. The user types `session_id` at `/handoff <session_id>` and `/pickup <from_session_id>`; this value becomes the workstream label directly — no slugification, no PID-file lookup. The `session_id` is passed verbatim to `write_session({session_id, body})` via MCP, and the folder is created as `S-{session_id}` directly.

For the pre-redesign PID-file naming mechanism and its restart limitation, see [legacy-and-recovery.md](legacy-and-recovery.md).

## Troubleshooting: scratch subrepo rename churn

After `/pickup`, `cd scratch && git status` shows `S-{old}/` → `S-{new}/` as a folder rename. This is expected: pickup moved the workstream folder to match the current live session. The rename is invisible to the parent repo (`scratch/` is gitignored there) and only shows in the scratch subrepo's own history. Commit via `commit-all` when ready.

## Growth Path

`write_session` is the landed MCP verb for this flow (per-session file write + inline pointer regeneration). The other scratch-memory verbs (`write_report`, `write_review`, `write_issue`) and the full verb inventory live in the `scratch-memory` SKILL.

Future candidates (not implemented): `fork_handoff` CLI verb (copy — not rename — a workstream folder to a new session, preserving the original), `mark_criterion`, `append_decision`.

## Assembly Protocol

`HANDOFF.md` is assembled mechanically — no LLM synthesis involved. The two CLI verbs that implement this protocol are:

- **`scratch-memory cat-sessions <session-dir> [--max-chars N] [--format full|summary|json]`** — assembles a bounded brief from the session log (used by `/pickup` for the resume brief, and internally by `rewrite-pointer`).
- **`scratch-memory rewrite-pointer <session-dir>`** — (re)generates the v3 thin-pointer `HANDOFF.md` from the immutable session log. `write_session` invokes this same regeneration inline on every write (see Invariant 3); the CLI verb is for manual/recovery use.

### Recency ordering

Sessions are sorted newest-first by the ISO timestamp prefix of the session filename. Filenames are immutable and timestamp-prefixed, so this ordering is stable and deterministic. Fallback: file mtime if the prefix is unparseable; if mtime values are equal (FAT32 / NFS with coarse-grained timestamps), sort by filename lexicographic order as a final tiebreaker.

### Budget algorithm (cat-sessions)

Budget B defaults to **30000 characters** (roughly ~7500 tokens). Chars, not tokens — the CLI has no tokenizer.

1. **Always-inline-newest floor:** the newest session is always fully inlined, even if its body alone exceeds B.
2. Inline older sessions in recency order, accumulating char count, as long as `cumulative + body ≤ B` (hard cap — a non-newest session is never inlined when doing so would push cumulative over B). The first older session that would exceed the cap stops inlining; to keep the included window contiguous (newest-first), all remaining older sessions are then summary-only — even if a later one would individually fit.
3. All remaining (older) sessions render as `summary + link` rows only — their full bodies are not included in the brief.

This guarantees current truth (newest session) is always present while bounding the output for a near-full context.

### Open-questions carry-forward

Computed across the **whole log**, independent of the budget window:

- **Input:** union of all `## Open questions raised` entries from every session.
- **Resolved set:** union of all `## Open questions resolved` entries from every session.
- **Still-open set (ordering-aware):** a kernel is still-open iff it was never resolved, OR its most-recent raise is chronologically newer than its most-recent resolve. This means a question that was raised, resolved, then genuinely re-raised in a later session surfaces again instead of staying suppressed — a plain raised-minus-resolved set difference would wrongly hide it.
- **Normalization:** each entry is reduced to its **question kernel** — markdown emphasis and backticks stripped, a leading `[q-<hex6>]` token removed, then the question text up to the first `?`, with any appended `→ RESOLVED:` answer removed — then trimmed, lowercased, and whitespace-collapsed. Dedup by kernel.
- **Question ID:** each kernel has a stable ID, `'q-' + sha256(kernel).hex.slice(0, 6)` — a pure function of the kernel alone, so it is retroactively computable for every existing question and never renumbers when sessions are inserted. An author may resolve a carried-forward question by ID instead of restating its kernel verbatim: `- q-<hex6> → RESOLVED: <answer>`.
- **Resolve precedence (guard → ID → kernel):** for each `## Open questions resolved` entry, three conditions are computed independently, then the entry is matched by the first that applies:
  1. **STILL-OPEN guard.** The substring from the first `→` / `->` / `RESOLVED:` delimiter to the end of the bullet — or the whole bullet, when no delimiter is present — is scanned for `STILL OPEN`, `UNRESOLVED`, or `NOT RESOLVED` (case-insensitive, hyphen/space-tolerant). A match **vetoes cancellation unconditionally**: the entry sets nothing — no resolve, no re-raise, no attribution change — regardless of whether an ID or a kernel also matches. This lets an author acknowledge a carried-forward question without answering it, without resetting its age.
  2. **ID match.** Otherwise, if the bullet contains a `q-<hex6>` token that maps to exactly one kernel across the whole log, that kernel resolves — regardless of what text the bullet also restates.
  3. **Kernel match.** Otherwise, if the bullet's own kernel exists among the raised kernels, that kernel resolves (the verbatim-restatement behavior above).

  An entry matching none of the three cancels nothing (orphan resolution — the majority case in practice). Every entry cancels **at most one** kernel: an ID match never additionally cancels the kernel its restated text would otherwise have matched.
- **Ambiguous-ID fallback:** an ID that maps to more than one kernel (a collision) is treated as if no ID were present on that entry — resolution falls through to kernel matching rather than cancelling any of the colliding kernels. A collision costs only the ID as a usable handle for that entry; a question already reachable by kernel match remains resolvable, and nothing is ever silently cancelled by an ambiguous ID.
- **Attribution:** if the kernel was never resolved, display the original text from, and link to, the **oldest** (chronologically earliest) session that raised it. If it was resolved at some point and then re-raised, attribute to the **newest** raise instead — the re-raise is the one still open.
- **Age:** each still-open entry also carries `age_sessions = session_count − attributingRaiseOrder`, where `attributingRaiseOrder` is the 1-based oldest-to-newest position of the same attributing raise used above (`firstRaise` for a never-resolved kernel, `lastRaise` for a resolved-then-re-raised one) — an integer in `[0, session_count − 1]`. A genuine re-raise resets the clock: attribution moves to the newest raise, so age is measured from there, not from the original raise.
- **Ordering:** `still_open_questions` is sorted `age_sessions` DESC (oldest first), then `id` ASC, then kernel ASC. `attributingRaiseOrder` is deliberately not a sort level of its own — it is a linear function of `age_sessions`, so a level on both would just re-apply the same ordering twice. The kernel is unique per entry by construction, which makes the key total (no two entries can tie on all three levels); it is a sort input only and never appears in rendered or json output.
- **Safe direction:** a kernel not found in the resolved set, or resolved-then-re-raised, stays still-open — a real question is never dropped by a reword or a stale resolution.
- **Authoring note:** author each entry as a `- ` bullet (one entry per bullet); restate the question kernel (text up to the first `?`) verbatim, then the answer — e.g. `<question>? → RESOLVED: <answer>` — or resolve by ID (see Question ID above) when restating the kernel is inconvenient. To acknowledge a carried-forward question without resolving it, annotate `→ STILL OPEN` (or `UNRESOLVED` / `NOT RESOLVED`) — this is never treated as a resolution, whether or not the bullet also carries a matching ID or kernel. A resolution that matches neither an ID nor a kernel stays still-open. Leave `## Open questions raised` / `## Open questions resolved` **empty** when there is nothing to record — never author a placeholder bullet such as `- none`, `- N/A`, or `- (none new …)`; `extractBullets` filters any such bullet on read, so an authored placeholder is silently dropped rather than preserved.
- **Empty list:** renders an explicit `none` line.

Row format: `- [q-XXXXXX] <question> → [sessions/{file}](sessions/{file}) (age: N)`. Both `cat-sessions` (brief) and `rewrite-pointer` (pointer) render this identical shape (decisions.md D9). Path separators are normalized to `/` at the link-building chokepoint (`relLink` in `cat-sessions.mjs`; the equivalent inline form in `rewrite-pointer.mjs`) regardless of the platform-native separator `source_file` carries.

Legacy session files lacking `summary:` are handled by a read-side derivation fallback in `cat-sessions` — see [legacy-and-recovery.md](legacy-and-recovery.md).

### Handoff disposition pass (Step 1b)

`/handoff` Step 1b runs `cat-sessions 'scratch/S-{session_id}/' --format json` before body composition (Step 2) and walks the returned `still_open_questions`, deciding per entry `Q` whether Step 2 authors a `## Open questions resolved` line:

| Answered this session | Moot this session | `Q.id` usable | Line authored |
|---|---|---|---|
| yes | — | yes | `q-<id> → RESOLVED: <answer>` |
| yes | — | no | `<question kernel verbatim> → RESOLVED: <answer>` |
| no | yes | yes | `q-<id> → RESOLVED: closed — <reason>` |
| no | yes | no | `<question kernel verbatim> → RESOLVED: closed — <reason>` |
| no | no | — | *(no line — still open; carry-forward is automatic)* |

**Acknowledging without resolving:** a question reviewed this session but deliberately left open (not answered, not moot) may optionally be recorded as `q-<id> → STILL OPEN — <note>` (or the kernel-verbatim form). This is never treated as a resolution and never resets the question's age — see the STILL-OPEN guard under [Open-questions carry-forward](#open-questions-carry-forward) for the engine-side mechanics. It distinguishes "reviewed and consciously left open" from a question nobody looked at this session; carry-forward remains automatic either way.

`<question kernel verbatim>` copies `Q.text` from its start up to and including the first `?` (or the whole kernel when there is none) — a `?` is never appended, since doing so to an imperative kernel produces a string the next read won't match, silently reopening the question. A carried-forward question is never restated in `## Open questions raised` — that section is a per-session delta of genuinely new questions only.

On any non-zero `cat-sessions` exit, Step 1b skips disposition and proceeds to Step 2 without failing the handoff, but names which exit occurred: exit 1 (no prior log — the expected first-handoff case) vs exit 2 (FS/infra failure — worth investigating before the next handoff), per decisions.md D16. Step 1b is read-only — it writes nothing; the only write in `/handoff` remains the Step 3 `write_session` call.

### Cumulative sections carry-forward

`cat-sessions` computes three read-side cumulative sets — Decisions made, What to avoid, Done — from the **whole log**, the same oldest-first traversal used for open-questions accumulation, independent of the `--max-chars` budget window (decisions.md D12).

- **Whole-log accumulation:** each session's `## Decisions made` / `## What to avoid` / `## Done` bullets are folded into a running set as the log is walked oldest-to-newest, regardless of whether that session's body is inlined or trimmed to summary-only in the brief.
- **Dedup key:** each bullet is reduced to a normalized key — markdown emphasis/backticks stripped, trimmed, lowercased, whitespace-collapsed, then truncated to its first 80 characters — before being folded into the set (decisions.md D13). Two bullets sharing the same 80-char-normalized prefix collapse to one entry.
- **Oldest-wins attribution:** when two bullets collide on the same key, the **first (oldest) occurrence** is kept — its text and source file are the ones that render — mirroring the oldest-wins attribution rule for still-open questions.
- **Render order:** `cumulative_done` / `cumulative_decisions` / `cumulative_avoid` are newest-first by the order of each entry's oldest occurrence — the most recently introduced surviving entries render first (decisions.md D14).
- **Per-block char cap, `--format full` only:** `cumulativeBlock` renders newest-first rows and stops before the running total would exceed `--max-cumulative-chars` (default 6000), appending a `_… N more (see sessions/)_` elision line whenever any entry is omitted. `--format json` emits `cumulative_done` / `cumulative_decisions` / `cumulative_avoid` as complete, untruncated arrays regardless of the cap — the cap is a `full`-format rendering concern only.
- **No minimum-entries floor:** unlike the always-inline-newest floor in the [budget algorithm](#budget-algorithm-cat-sessions), the cumulative renderer guarantees nothing analogous. A cap smaller than the first row's rendered length renders **zero rows plus the elision line** — an empty-looking block despite content existing in the log. This asymmetry is deliberate (decisions.md D14, amended): the cumulative view is a convenience over an immutable log that `source_file` links back to, whereas the newest session body is the resume payload itself.
- **`--format summary` never gains these blocks** (decisions.md D15) — `summary` exists only to feed the pointer Sessions table and stays byte-stable.

### rewrite-pointer contract

`rewrite-pointer <session-dir>` renders the v3 thin pointer by calling the assembly module (`cat-sessions --format json`) to obtain:
- `newest.goal` → `## Goal`
- `newest.next_best_step` → `## Next best step`
- `newest.summary` → `## Latest summary`
- `still_open_questions[]` → `## Open questions (still open)` — same row format as the brief: `- [q-XXXXXX] <question> → [sessions/{file}](sessions/{file}) (age: N)` (see Row format above)
- `sessions[]` → `## Sessions` table (one row per session, newest first; format: `| timestamp | summary | file |`)

Writes atomically via tmp + rename (`.HANDOFF-{pid}-{random}.tmp` in the same `<session-dir>`). On any write/sync failure, the prior `HANDOFF.md` is untouched. Post-rename stale-sweep removes orphaned tmp files from prior crashed invocations using PID-liveness check.

**Exit codes:**
- `0` — pointer written; status line on stderr: `N sessions processed, pointer written: <path>`.
- `1` — user/argument error (missing arg, empty sessions dir, out-of-sandbox path, unknown flag).
- `2` — FS write or read failure.

If `write_session` reports `pointer.written === false` (inline regeneration failed) — or a manual `rewrite-pointer` re-run exits non-zero — `/handoff` surfaces a STALE-POINTER WARNING but does NOT fail the handoff; the per-session file is already durably flushed.

### cat-sessions contract

`cat-sessions <session-dir> [--max-chars N] [--max-cumulative-chars N] [--format full|summary|json] [--with-tasks]`

`--max-cumulative-chars` (default 6000) is the per-block char cap for the three cumulative sections described below. The cap applies to `--format` full only; `--format json` always emits the three cumulative arrays untruncated, so a caller who passes the flag expecting a smaller JSON payload is silently ignored (decisions.md D14, amended).

`--with-tasks` appends a `## Tasks` block — rendered by the same `renderTasksBlock` the standalone `scratch-memory tasks list` verb uses (see `## Tasks` above) — listing a workstream's open and blocked tasks. It applies to `--format full` and `--format json`; `--format summary` silently ignores it, the same way `--format json` silently ignores `--max-cumulative-chars` above — `summary` exists only to feed the pointer Sessions table and stays byte-stable regardless of either flag (decisions.md D15).

**Output formats:**
- `full` (default) — `## Open questions (still open)` block, then the three cumulative blocks — `## Decisions (cumulative)`, `## What to avoid (cumulative)`, `## Done (cumulative)` — each newest-first under the `--max-cumulative-chars` cap (see [Cumulative sections carry-forward](#cumulative-sections-carry-forward) below), then — only when `--with-tasks` is passed — the `## Tasks` block, then newest-first inlined session bodies with header lines, then `summary + link` tail for trimmed older sessions. Used as the resume brief by `/pickup`.
- `summary` — open-questions block + one `summary + link` row per session (no full bodies, no cumulative blocks, no tasks block even with `--with-tasks` — decisions.md D15). Row source for the pointer Sessions table.
- `json` — `{ session_dir, budget_chars, cumulative_cap_chars, session_count, still_open_questions: [{id, text, source_file, age_sessions}], newest: {goal, next_best_step, summary, file}, sessions: [{ts, file, summary, inlined: bool, body?}], cumulative_done: [{text, source_file}], cumulative_decisions: [{text, source_file}], cumulative_avoid: [{text, source_file}] }`, plus — only when `--with-tasks` is passed — `tasks: [{id, title, status, blocked_on?, created, updated, age_days, file}]` and `task_warnings: [string]`. `tasks` is the complete, unfiltered task list across every status; the `full`-format `## Tasks` block, by contrast, renders only `open`/`blocked` rows plus a closed-count summary. `body` present only for inlined sessions. `still_open_questions` is sorted `age_sessions` DESC, then `id` ASC, then kernel ASC (see Ordering above) — the kernel itself is not a field in this shape. The three `cumulative_*` arrays are always complete and untruncated, regardless of `--max-cumulative-chars` — the cap is a `full`-format render-time concern only. Consumed programmatically by `rewrite-pointer` and `/pickup`.

**Contracts:**
- `requires`: `<session-dir>` provided; `<session-dir>/sessions/` exists and contains ≥1 `*.md` file.
- `ensures`: deterministic output for identical inputs; newest session body always present in `full`/`json`; still-open block never drops a raised-and-unresolved question.
- `invariants`: read-only — never writes, never mutates session files; malformed task files (`--with-tasks` only) never change the exit code — a bad `tasks/` entry surfaces as an embedded `WARN:` line, never a failure; bounded brief (`full` size ≤ ~`B` + 3 × `C` + **tasks block** + per-session summary tail, where `B` is `--max-chars` and `C` is `--max-cumulative-chars`) regardless of session count — the tasks term is **uncapped in v1**, linear in the number of open/blocked tasks (roughly 100 bytes per row), deliberately: consistent with T8's no-thresholds/no-policy stance, the documented escape hatch — a cap mirroring `--max-cumulative-chars` — is named but not yet built (decisions.md D14).

**Exit codes:** `0` success; `1` user/argument error; `2` FS read failure.

## scratch-memory CLI Capability Audit

The `scratch-memory` CLI exposes the `handoff` and `pickup` verb groups for session lifecycle management. Both handle workstream folder resolution and ownership transfer.

`scratch-memory handoff list` prints the workstream inventory newest-first (consumed by `/pickup`'s interactive picker). `handoff commit` / `handoff validate` on a non-v3 folder print a JIT signpost pointing at `rewrite-pointer` and exit 0 without mutating the artifact. Only the `pickup` verb contract is detailed below.

### CLI verb: pickup

Call shape:
```
scratch-memory pickup <from-session-id> --to-session-id <to-session-id> [--json]
```

Both arguments are required at the CLI boundary. The `--to-session-id = from-session-id` default is implemented in the `/pickup` slash command body, not in the CLI verb itself.

**Exit code semantics:**
- **Exit 1** — application-level pickup errors: `PICKUP_COLLISION`, `PICKUP_SOURCE_MISSING`, `PICKUP_INVALID_FROM_SESSION_ID`, `PICKUP_INVALID_TO_SESSION_ID`, `SESSION_ID_REQUIRED`, `PICKUP_IDEMPOTENT_SOURCE_NOT_EMPTY`. These are recoverable by correcting inputs or resolving the session identity conflict. `PICKUP_IDEMPOTENT_SOURCE_NOT_EMPTY` fires on the idempotent-repickup path when the source folder's `sessions/` still holds real session files — a reused slug could otherwise have its data silently deleted by the stale-source cleanup; resolve the slug conflict manually rather than retrying. `PICKUP_SOURCE_MISSING` fires specifically for a UUID-shaped from-id that resolves to no folder; a plain-slug miss instead surfaces the resolver's `no handoff found matching '<arg>'` error (from `resolveSessionArg` in `handoff.mjs`) — two different error paths for "source not found" depending on whether the from-id looked like a UUID or a slug. `resolveSessionArg` resolves pickup's `<from-session-id>` via UUID or exact-slug match only (`exact: true`) — the prefix-glob fallback available to the read-only verbs (`handoff list`/`path`/`validate`) is disabled for pickup, so a retired id that merely prefixes a live folder name (e.g. after a rename to `S-<id>-2`) now errors instead of silently resolving to that folder.
- **Exit 2** — infrastructure error (OS-level rename failure). Not recoverable by retry. If the rename fails after the source file's frontmatter was already rewritten to claim the target `session_id`, pickup best-effort restores the source file to its pre-pickup content before exiting, so the folder isn't left claiming an owner it doesn't physically have.

On a v3 source folder, pickup regenerates the target's v3 pointer after a successful rename/takeover (best-effort; on regeneration failure the pointer remains ownership-claiming but non-v3 until `rewrite-pointer` is run manually). Legacy (V1) folders keep the documented V1→V2 two-hop — pickup does not jump a legacy source straight to v3.

**`--json` flag:** emits the full JSON response to stdout (see `scratch-memory`'s [cli-verbs.md](../scratch-memory/cli-verbs.md) for the complete field list). Without `--json`, the verb prints a human-readable summary.

## Sync Map

The executable mechanics are inlined in the commands (hot-path token savings); this skill is the reference. These pairs must move together — drift here has caused real breakage before:

| Contract | Normative copies |
|---|---|
| 10 per-session section headings | `EXPECTED_SESSION_SECTIONS` in `scratch-memory/scripts/handoff.mjs` ↔ `/handoff` Step 2 list ↔ Per-Session File Schema table here (enforced by PAR tests in `test-handoff.mjs`) |
| Section semantics (cumulative vs delta) | `/handoff` Step 2 descriptions ↔ Per-Session File Schema table here (enforced by PAR3 in `test-handoff.mjs`) |
| Open-question disposition pass (decision table, kernel-fallback rule, exit-code skip notes, STILL-OPEN acknowledgment) | `/handoff` Step 1b ↔ Handoff disposition pass (Step 1b) here (enforced by PAR4 in `test-handoff.mjs`) |
| pickup exit-1 error codes | `/pickup` Step 5 ↔ `### CLI verb: pickup` here ↔ `pickup.mjs` |
| Skills loading (flat list, cap 5) | `/pickup` Step 7 ↔ `## Skills Loading at /pickup` here |
| Resolve-pass matcher (guard → ID → kernel precedence) | `cat-sessions.mjs`'s resolve pass inside `assembleSessions` ↔ `### Open-questions carry-forward` here |
| `--max-cumulative-chars` flag: default (6000), validation, `--format full` only scope | `CAT_HELP` in `cat-sessions.mjs` ↔ `### cat-sessions contract` here ↔ `### Cumulative sections carry-forward` here |
| Stale-question triage nudge (non-blocking, `age_sessions >= 3` threshold) | `/pickup` Step 6a ↔ `## Stale-Question Triage Nudge at /pickup` here ↔ `age_sessions` field in `### cat-sessions contract` here (enforced by PAR5 in `test-handoff.mjs`) |
| Still-open question row format (`[q-XXXXXX]` id, kernel text, session link, `(age: N)` annotation; blank line follows the heading before the first row) | `openQuestionsBlock` in `cat-sessions.mjs` ↔ `### Open-questions carry-forward` here (enforced by CAT10a in `test-handoff.mjs`) |
| `cat-sessions --format json` output shape (never truncated, unlike the capped `full` format) | `assembleSessions`'s return shape in `cat-sessions.mjs` ↔ `json` bullet under `### cat-sessions contract` here (enforced by CAT10c in `test-handoff.mjs`) |
| Tasks row format, ordering, and age rule | `renderTasksBlock` in `scratch-memory/scripts/tasks.mjs` ↔ `/pickup` Step 6 ↔ `## Tasks` here (enforced by PAR6 in `test-handoff.mjs`) |
| Handoff tasks-lint pass (read-only, non-blocking, exit-code notes) | `/handoff` Step 1c ↔ `## Tasks` here ↔ `scratch-memory tasks lint` (enforced by PAR7 in `test-handoff.mjs`) |
