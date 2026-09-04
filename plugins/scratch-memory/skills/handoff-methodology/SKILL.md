---
name: handoff-methodology
description: 'Captures Claude Code session state into a per-session file under `scratch/S-{slug}/sessions/`, synthesizes the workstream''s HANDOFF.md index, and produces the resume brief at /pickup. Use when writing a handoff, picking up a prior session, migrating an old-shape HANDOFF.md, or deciding which mandatory or available skills to re-load on resume — even for short sessions where /compact looks tempting.'
user-invocable: false
---

# Handoff Methodology

Methodology loaded by `/handoff` and `/pickup`. Defines the v2 HANDOFF.md schema, per-session file schema, Mandatory/Available skills triage, brief format contract, recovery procedures, local-memory boundary, and session name resolution.

## Migration Notice

The old 10-section `HANDOFF.md` schema (Done this session, Decisions made, Merge Policy table, Dedup Algorithm, Answered-Question Criterion, `## Skills loaded` content rules) is replaced by the v2 schema below. Auto-migration runs on the first `/pickup` of an old-shape folder: the CLI performs a mechanical byte-copy to `sessions/{ts}-legacy.md` (with `_legacy: true` frontmatter added), writes a skeleton v2 `HANDOFF.md`, then the `handoff-manager` agent synthesizes content over the legacy file. After migration, the folder is permanently v2.

## HANDOFF.md Schema (v2)

**Frontmatter:**

```yaml
---
session_id: <string — UUID pre-redesign, slug post-redesign>
session_chain: [<UUID>, ...]   # ordered prior owners; appended on /pickup
goal: <one-line current goal>
first_written: <ISO-8601-with-Z>   # immutable; carried over from v1
last_updated: <ISO-8601-with-Z>    # bumped on every mode=synthesize write
last_synthesized: <ISO-8601-with-Z>  # used by synthesis to skip already-processed files
schema_version: 2
git_branch: <branch name>
session_name: <slug or empty>
related_projects: [<slug>, ...]
---
```

`first_written` is preserved verbatim from v1 during migration (falls back to file mtime if absent). `last_synthesized` is initialized to `now` at migration time.

**Legacy divergence:** For pre-redesign workstreams whose HANDOFF.md was written before the explicit-arg redesign (handoff-sid-fix, 2026-05-05), the frontmatter `session_id` may be a UUID while the folder slug (`S-{slug}`) is the PID-file-derived session name. These two values may diverge. Post-redesign, `session_id` in frontmatter matches the folder slug exactly — both equal the caller-supplied `session_id` argument passed to `/handoff` or `/pickup`.

**Body sections (in order):**

| Heading | Content |
|---|---|
| `## Goal` | Current 1-line direction (mirrors frontmatter `goal`). |
| `## Current state` | Synthesized "what's true now" from latest session(s). 1-3 sentences. |
| `## Next best step` | Synthesized current action handle. Imperative voice. |
| `## Active decisions` | Synthesized: latest decision per topic + supersession links. Row format: `- <short label>[: <optional one-clause rationale>] → [sessions/{file}#decisions-made](path)`. |
| `## Active what-to-avoid` | Synthesized still-relevant entries + anchors. Row format: `- <short label>[: <optional one-clause rationale>] → [sessions/{file}#what-to-avoid](path)`. |
| `## Open questions (still open)` | Synthesized; resolved questions drop out. Row format: `- <question>[: <optional one-clause hint>] → [sessions/{file}#open-questions-raised](path)`. |
| `## Skills — Mandatory` | Always-preload at `/pickup`. **Hard cap of 3.** One skill name per line, optional one-line rationale. Agent emits a `## Migration` warning in the brief if the parsed list exceeds 3. |
| `## Skills — Available` | Listed with one-line rationale; loaded at pickup via skills-router High tier (≤3). No cap on input list size — skills-router caps the output. |
| `## Projects` | Synthesized rollup: per-project status + activity summary; each entry has anchors to per-session detail. |
| `## Sessions` | Chronological table: `\| timestamp \| session_name \| goal_at_time \| done summary \| file \|`. One row per session file. |

## Per-Session File Schema

**Path:** `sessions/{ISO-8601-timestamp-with-Z}-{8-char-shortid}.md`
Timestamps colon-replaced for filesystem compatibility (e.g., `T14:03:12Z` → `T14-03-12Z`).
**Filenames are immutable. Section headings are a versioned contract** — anchor links from HANDOFF.md depend on both.

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
parent_handoff_state: <path to prior HANDOFF.md, optional>
_legacy: <true if migrated, otherwise omitted>
---
```

**Body sections (in order):**

| Heading | Content |
|---|---|
| `## Goal` | What this session was pursuing (snapshot; may differ from current). |
| `## Next best step` | This session's last view of next (preserves reasoning even after the index advances). |
| `## Done` | What this session accomplished. |
| `## Decisions made` | Raw entries with full rationale. |
| `## What to avoid` | Raw entries (what we tried/learned this session). |
| `## Open questions raised` | New questions surfaced this session. |
| `## Open questions resolved` | Questions answered this session (with the answer summary). |
| `## Key files & artifacts` | Touched/created this session. |
| `## Skills used` | List with proposed tier (Mandatory/Available) per skill. |
| `## Projects` | Per-project done-list raw. |

## Mandatory / Available Skills Triage

At `/handoff` time, the author assigns each skill in `## Skills used` a tier:

**Mandatory** — skills the next session MUST have to avoid context loss. These are continuity-essentials: without them, the resumed session would lack the methodology to continue the work. **Hard cap of 3** — if more than 3 feel essential, pick the top 3 by consequence of absence.

**Available** — skills that may be useful depending on the next action. No cap on the input list. The `skills-router` agent trims the Available list to ≤3 High-tier picks at pickup time, using `## Next best step` and `## Current state` as match context.

At synthesis, `handoff-manager mode=synthesize` reads `## Skills used` from the session file, splits entries by tier label, and writes the result into `## Skills — Mandatory` and `## Skills — Available` in HANDOFF.md.

## Brief Format Contract

> **DEPRECATED — see retirement notice below.**

The Brief Format Contract (schema_version: 1, seven-section structured brief returned by `mode=resume`) is retired. `handoff-manager mode=resume` is removed. `/pickup` reads HANDOFF.md sections directly. This section is preserved for historical reference only.

## Recovery Procedures

**HANDOFF.md unexpectedly empty after `/handoff`:**
```bash
ls -t scratch/S-{id}/.bak/
cp scratch/S-{id}/.bak/HANDOFF-{ts}.md.bak scratch/S-{id}/HANDOFF.md
# Then manually dispatch: handoff-manager mode=synthesize
```

**Auto-migration produced wrong content:**
```bash
cp scratch/S-{id}/.bak/HANDOFF-{ts}.md.bak scratch/S-{id}/HANDOFF.md
rm -rf scratch/S-{id}/sessions/
# Re-run /pickup — agent re-attempts synthesis
```

**`/handoff` run before post-deploy restart** (`Agent()` dispatch fails with "Agent type 'handoff-manager' not found"): the session file at `sessions/{ts}-{shortid}.md` is already written and valid. Recovery: restart Claude Code, then manually dispatch `handoff-manager mode=synthesize` with `session_file_path` pointing at the already-written file. Do not re-run `/handoff` first — the pre-write `Read` guard aborts at step 3 (file exists) and cannot overwrite the prior file.

## Restart Caveat (handoff-manager)

**Restart IS needed for:**
- **New MCP verbs** (e.g., `write_session`): the TOOLS array in the scratch-memory MCP server is read at session start. A new verb added to `server.mjs` will not appear until Claude Code is restarted in that project.
- **New agent registration**: when `handoff-manager.md` is first deployed (or any new agent file is created), `@handoff-manager` autocomplete and `Agent({subagent_type: "handoff-manager", ...})` programmatic dispatch both read from the session-start registration index. Until restart, both paths fail with "Agent type 'handoff-manager' not found."

**Restart is NOT needed for:**
- **Edits to the existing handoff-manager agent**: existing-agent edits hot-reload per project CLAUDE.md ("Edits: yes"). The next `Agent({subagent_type: "handoff-manager", ...})` dispatch picks up the change live — no restart required.

## Boundary with `local-memory`

Automated dispatches of `local-memory-updater` are **removed** (D6). With that removal, `CLAUDE.local.md` Active Projects is no longer auto-updated during `/implement-code` runs — it goes stale until the user manually invokes `Skill({skill: "local-memory"})` or the `/local-memory` command explicitly. Cross-session active-project state now lives in HANDOFF.md, discovered via `scratch-memory handoff list`. The `local-memory` skill and `local-memory-updater` agent are **preserved** — no file deletions — and remain callable for explicit use.

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
3. `HANDOFF.md` is owned by `handoff-manager` (mode=synthesize). The CLI writes only the empty skeleton during legacy migration.

   > **Exception:** when `/pickup` auto-migrates a legacy V1 folder, main session (Opus) reads `sessions/{ts}-legacy.md` and composes the synthesized sections, then writes HANDOFF.md directly. This is a documented single-path relaxation; all non-migration `/handoff` runs still go through handoff-manager.
4. Per-session files are **immutable** post-write. A post-write mtime change is a defect.
5. `S-` prefix distinguishes session-scoped folders from project-scoped folders in `scratch/`.
6. Sessions cross-cut projects; the session folder enumerates related project folders, never the reverse.

## Session Name Resolution

**Post-redesign (handoff-sid-fix, 2026-05-05):** The canonical source shifted from PID files to caller-supplied argument. The user types `session_id` at `/handoff <session_id>` and `/pickup <from_session_id>`; this value becomes the workstream label directly — no slugification, no PID-file lookup. The `session_id` is passed verbatim to `write_session({session_id, body})` via MCP, and the folder is created as `S-{session_id}` directly.

**Pre-redesign history:** PID files at `~/.claude/sessions/{pid}.json` provided the session name via the `.name` field, written by `/rename`. The server resolved the name by matching the calling PID to the correct JSON file via cwd comparison plus `.sessionId ∈ {session_id} ∪ session_chain`. When multiple PID files matched, the one with the most-recent `updatedAt` won. The slug was then normalized to `[a-z0-9-]`, max 64 chars, whitespace → `-`, leading/trailing hyphens stripped. That mechanism is preserved in Claude Code itself (the `/rename` command still writes PID files) but is no longer used by scratch-memory for workstream folder naming.

- **Known limitation:** after a process restart the `/rename`-assigned name is gone unless the user runs `/rename` again. The `session_name` field in HANDOFF.md frontmatter is the durable record — the interactive picker reads it to show a human-readable label for long-exited sessions. This limitation still applies to the `/rename` mechanism even though scratch-memory no longer reads PID files for workstream naming.

## Troubleshooting: scratch subrepo rename churn

After `/pickup`, `cd scratch && git status` shows `S-{old}/` → `S-{new}/` as a folder rename. This is expected: pickup moved the workstream folder to match the current live session. The rename is invisible to the parent repo (`scratch/` is gitignored there) and only shows in the scratch subrepo's own history. Commit via `commit-all` when ready.

## Growth Path

**Landed MCP verbs** (available in current scratch-memory server):

| Surface | Purpose | Status |
|---|---|---|
| `write_report` | Step-based coder/verifier verdict writes (`/implement-code`) | Landed |
| `write_review` | Phase-based brainstorming reviewer verdict writes | Landed |
| `write_issue` | Issue/idea captures — user-initiated via `/capture-issue`, or sub-agent-initiated by `researcher` during D6 auto-heal drift filing | Landed |
| `write_session` | Per-session file write for `/handoff` (MCP verb; session state, not code verdicts) | **Landed** |

**Future candidates:**

| Surface | Purpose |
|---|---|
| `fork_handoff` (CLI verb) | Copy (not rename) a handoff folder from one session to another, preserving the original. Verb: `/fork {from} → new-session`. Not yet implemented. |
| `mark_criterion` (MCP tool) | Flip a plan acceptance-criterion checkbox in a step file |
| `append_decision` (MCP tool) | Structured entry in a project's `decisions.md` |

## Index Synthesis Protocol

This protocol is executed by `handoff-manager mode=synthesize`. Its job is to update HANDOFF.md so it reflects the new (or legacy) session file plus any superseded prior content. The agent does NOT write to session files. It writes to HANDOFF.md exactly once. (This protocol may be reached via `mode=synthesize` dispatch directly, or executed inline from `mode=resume` during legacy migration — in either case the steps and constraints are identical.)

### Inputs

- `session_file_path` — absolute path to the just-written per-session `.md` file (the file that triggers this synthesis pass)
- `handoff_md_path` — absolute path to the workstream's `HANDOFF.md` (the file this protocol writes)

### Step 1: Read both files in full.

Call `Read({file_path: session_file_path})` to load the session file. Call `Read({file_path: handoff_md_path})` to load HANDOFF.md. If either Read fails (file not found or permission error), emit `Synthesis failed: could not read <path>` and stop. Do not proceed with partial data.

### Step 2: Detect legacy.

Inspect the session file frontmatter. If the frontmatter contains `_legacy: true`, jump to the `### Legacy session translation` sub-section below before continuing. That sub-section maps the 10 v1 sections to v2 schema; after translation, return here and continue from Step 3.

### Step 3: Synthesize Active decisions / what-to-avoid / Open questions still-open.

Walk all `sessions/*.md` whose `started` frontmatter field is newer than HANDOFF.md frontmatter `last_synthesized`. If `last_synthesized` is absent from HANDOFF.md frontmatter, walk all session files in the `sessions/` folder.

**Use the `started` field (NOT the filename-embedded ISO timestamp).** Rationale: a `commit-session` retry produces a new filename timestamp but preserves the same `started` moment — using `started` avoids double-processing the same session content when filenames differ.

For each session file in the walk:

**Decisions:** A decision row in HANDOFF.md `## Active decisions` is superseded when the new session's `## Decisions made` section contains an entry whose topic label matches an existing row's label. On supersession, replace the existing row's anchor with the new session file's anchor; keep the label; update the optional one-clause rationale only if the new entry provides one. Emit format per D3:
```
- <short label>[: <optional one-clause rationale>] → [sessions/{file}#decisions-made](path)
```

**What-to-avoid:** Apply the same supersession logic to `## Active what-to-avoid` entries. Replace the anchor on label match; keep the label; update rationale only when the new entry provides one. Emit format:
```
- <short label>[: <optional one-clause rationale>] → [sessions/{file}#what-to-avoid](path)
```

**Open questions:** An open question drops from HANDOFF.md `## Open questions (still open)` if it appears in the new session's `## Open questions resolved` section. No partial supersession: an entire row is either kept as-is or removed. New questions from the new session's `## Open questions raised` are appended to HANDOFF.md `## Open questions (still open)`. Emit format:
```
- <question>[: <optional one-clause hint>] → [sessions/{file}#open-questions-raised](path)
```

### Step 4: Synthesize Projects rollup.

Aggregate per-session `## Projects` entries into HANDOFF.md `## Projects` section. For each project mentioned across session files, write a per-project line with current status and a one-sentence activity summary, each with an anchor linking to the source session file where the most recent activity appears. Format:
```
- **{project-name}**: {status} — {activity summary} → [sessions/{file}#projects](path)
```

### Step 5: Update Sessions index table.

Append a new row to the HANDOFF.md `## Sessions` table for the session file that triggered this synthesis pass. Do not add duplicate rows for session files already represented in the table. Row format:
```
| {timestamp} | {session_name} | {goal_at_time} | {done summary (≤1 sentence)} | [sessions/{file}](path) |
```

`{timestamp}` is the `started` value from the session file frontmatter. `{session_name}` is the `session_name` frontmatter field (empty string if absent). `{goal_at_time}` is the `goal_at_time` frontmatter field. `{done summary}` is a ≤1-sentence distillation of the session's `## Done` body.

### Step 6: Refresh Replace-in-place sections.

These sections are always overwritten from the latest session (the session file that triggered this synthesis pass):

- `## Goal` — copy from latest session `## Goal` body verbatim.
- `## Next best step` — copy from latest session `## Next best step` body verbatim.
- `## Current state` — synthesize from latest session `## Done` in 1-3 sentences describing what is now true about the codebase or workstream.

Derive `## Skills — Mandatory` and `## Skills — Available`:
- Read latest session `## Skills used` section.
- For each entry, read its proposed tier label (`Mandatory` or `Available`). **If an entry has no tier label, treat it as `Available`** — same fallback as the legacy migration rule for tierless `## Skills loaded` input (see Legacy session translation sub-section below).
- Write `## Skills — Mandatory`: one skill name per line (strip rationale — only the skill name).
- Write `## Skills — Available`: one skill name per line, preserving any one-line rationale annotation after the name.

### Step 7: Validate anchors.

For each `→ sessions/{file}#section` link present anywhere in HANDOFF.md after the updates, confirm two things:
1. The file exists — Glob `sessions/` for the filename.
2. The heading exists in that file — Read the session file and search for the heading string.

On any validation failure, emit a one-line warning in agent output (not in HANDOFF.md):
```
WARN: broken anchor → {link}
```
Proceed regardless — anchor validation is best-effort. Full link-linting is scoped out per spec.

### Step 8: Update frontmatter.

Set both `last_updated` and `last_synthesized` to the current ISO 8601 timestamp with Z suffix (UTC). Preserve the following fields verbatim from the existing HANDOFF.md frontmatter — do not modify them:

- `session_chain[]`
- `related_projects[]`
- `first_written`
- `goal`
- `git_branch`
- `session_id`
- `session_name`
- `schema_version` (must remain `2`)

### Step 9: Write HANDOFF.md using the Write tool.

Call `Write({file_path: handoff_md_path, content: <updated full content>})` with the complete regenerated HANDOFF.md content (frontmatter + all body sections). Note: `atomicWriteSync` is CLI-only; the agent uses the `Write` tool directly. The agent's exclusive HANDOFF.md ownership (Key Invariant 3) plus single-pass Write semantics provides sufficient atomicity at the agent layer. Do not make a second Write call to HANDOFF.md in this synthesis pass.

### Legacy session translation

A session file with `_legacy: true` in its frontmatter represents the entire prior HANDOFF.md byte-copied from before migration. The CLI places this file at `sessions/{ts}-legacy.md` with `_legacy: true` added to the frontmatter before synthesis runs.

Treat the legacy session file as a single retroactive session. Map the 10 v1 body sections to v2 HANDOFF.md sections and per-session file schema as follows:

| v1 section | v2 HANDOFF.md target | v2 per-session target |
|---|---|---|
| `## Done this session` | (not in HANDOFF.md) | `## Done` |
| `## Decisions made` | `## Active decisions` (synthesized) | `## Decisions made` (raw) |
| `## What to avoid` | `## Active what-to-avoid` (synthesized) | `## What to avoid` (raw) |
| `## Open questions` | `## Open questions (still open)` (synthesized) | `## Open questions raised` (raw) |
| `## Key files & artifacts` | (not in HANDOFF.md directly) | `## Key files & artifacts` |
| `## Skills loaded` | split by Mandatory/Available tier → `## Skills — Mandatory` + `## Skills — Available` | `## Skills used` |

All other v1 sections (Merge Policy table, Dedup Algorithm, Answered-Question Criterion, etc.) are discarded — they were meta-instructions, not state.

For `## Skills loaded` tier assignment during migration: if the legacy file has no tier labels, treat all listed skills as `Available`. The author can promote to `Mandatory` at next `/handoff`.

After completing the mapping, return to Steps 3-8 using the translated content as the session file's contribution. The legacy session file itself is immutable — never write back to it.

## Resume Brief Protocol

This protocol is executed by `handoff-manager mode=resume`. The CLI has already done any mechanical migration. The job is to read state, run skills-router over the Available list, and emit a structured brief that pickup parses verbatim. The only output to the caller is the brief.

### Inputs

- `from_session_id` — UUID of the session being picked up from (the session that ran `/handoff` last)
- `to_session_id` — UUID of the new session taking ownership
- `handoff_md_path` — absolute path to the workstream's `HANDOFF.md`
- `migrated_from_legacy` — optional boolean; `true` if the CLI just ran a v1-to-v2 mechanical migration before dispatching this agent

### Step 1: Read HANDOFF.md.

Call `Read({file_path: handoff_md_path})`. If Read fails (file not found or permission error), emit a brief with all sections empty and add `## Migration` section containing `read-error` as its only content, then stop. The minimal error brief still uses the 7-section format so the caller can parse it without branching.

### Step 2: Legacy synthesis if needed.

If `migrated_from_legacy=true` AND HANDOFF.md body is a skeleton (all body sections contain only the section header — no non-empty content beyond section headers), execute the Index Synthesis Protocol inline (see `## Index Synthesis Protocol` above):

1. Glob `sessions/` relative to the HANDOFF.md directory for files matching `*-legacy.md`.
2. Follow the Index Synthesis Protocol Steps 1-9 over the located `_legacy: true` session file, with `handoff_md_path` as the write target.
3. Re-read HANDOFF.md after synthesis completes before continuing to Step 3.

**Do NOT dispatch a second agent.** This must be done inline within this agent's execution to avoid a second-agent dispatch from a sub-agent context.

### Step 3: Parse Mandatory and Available skill lists.

Read `## Skills — Mandatory` from HANDOFF.md. Collect skill names, one per line (strip the `- ` prefix and any trailing rationale text). Collect the first 3 in list order; if the list exceeds 3 entries, emit a warning line in the brief's `## Migration` section:

```
WARN: Mandatory list had N entries; capped at 3
```

(Use `first 3 in list order` — preserve the ordering as written, do not rank or re-sort.)

Read `## Skills — Available` from HANDOFF.md. Collect all skill names with their associated rationale text (one skill per line). No cap on the collected list size; skills-router caps the output in Step 4.

### Step 4: Run skills-router over Available.

Call `Skill({skill: "skills-router"})` to load the skills-router skill content into context. Construct the matching context string:

```
Next best step: <body of HANDOFF.md ## Next best step>

Current state: <body of HANDOFF.md ## Current state>

Available skills: <comma-separated Available skill names>
```

Then apply skills-router's matching guidance to this intent string. Capture the `## High` section of the resulting match output; collect up to 3 skill names from that section.

If skills-router returns no `## High` section or the response shape is malformed (missing expected headers), emit an empty `## Skills-Router High Tier` section in the brief and add a warning line to the brief's `## Migration` section:

```
WARN: skills-router returned no High tier
```

### Step 5: Determine Recommended Reading.

Pick at most 2 per-session files for the new session owner to read directly. Selection criteria in order:

1. The most recent session file (highest `started` timestamp in frontmatter across all `sessions/*.md`).
2. Any session file referenced by an unresolved open question in HANDOFF.md `## Open questions (still open)` that is not already the most recent file.

If only one file qualifies, emit one path. Do not pad to 2.

### Step 6: Compose brief.

Emit the 7-section markdown brief in this exact order. The first content line of the entire brief (before any section header) must be:

```
schema_version: 1
```

Then the seven sections in order:

**`## Mandatory Skills`**
One skill name per line, prefixed `- `. Up to 3 names (from Step 3).

**`## Skills-Router High Tier`**
Skills-router High-tier names, one per line prefixed `- `. Up to 3 names (from Step 4).

**`## Available Skills`**
Full Available list — all names collected in Step 3, one per line prefixed `- `, with rationale appended if present (format: `- {name} — {rationale}`).

**`## Next Best Step`**
Verbatim copy of HANDOFF.md `## Next best step` body. Do not summarize or paraphrase.

**`## Current State Brief`**
Agent-synthesized 2-4 sentence summary of current state, derived from HANDOFF.md `## Current state` plus the most recent session file's `## Done` section.

**`## Recommended Reading`**
At most 2 paths, one per line. Format:
```
- sessions/<file>.md — <one-line reason why this file is relevant>
```

**`## Migration`**
If no migration occurred and no warnings were emitted in Steps 3-4: `none`.
If `migrated_from_legacy=true`: `completed-from-legacy`.
Plus any `WARN:` lines from Steps 3-4, one per line after the status word.

### Step 7: Return brief as agent output.

Emit only the brief text produced in Step 6. Do not add explanatory prose, preamble, or commentary outside the brief sections. The caller (`/pickup`) parses the brief verbatim using the D10 tolerant-parsing rules defined in the `## Brief Format Contract` section of this skill.

### Acceptance criterion

Any agent following only Steps 1-7 with the four variable inputs (`from_session_id`, `to_session_id`, `handoff_md_path`, `migrated_from_legacy`) must produce a brief sufficient for pickup to call `Skill()` and execute Next Best Step without requiring additional context from the user. This protocol is self-contained; the dispatch prompt supplies only the four variable inputs.

## handoff-manager Agent Tool Constraints

The `handoff-manager` agent currently has restricted tool access: `Read, Glob, Write, Skill` — **Bash is NOT in the list**. This creates a structural boundary between what the agent can dispatch.

**Hard constraint in agent body:** "Never write to `sessions/*.md`. HANDOFF.md is your only write target."

### Architectural Implications

**Current pattern (supported):**
- Agent reads session files and HANDOFF.md state via Read/Glob
- Agent synthesizes and writes to HANDOFF.md only via Write
- CLI (`scratch-memory` verbs) handles all mechanical work that requires Bash

**Proposed pattern (would require tool changes):**
- Agent dispatches Bash to call `scratch-memory` CLI verbs
- Requires: Bash added to agent's tool list (ideally hook-gated to `scratch-memory *` only)
- Requires: relaxing "never write sessions/*.md" constraint if agent gains ownership of per-session file writes

### Tool Change Impact

- **Tool grant addition:** hot-reloaded immediately on edit
- **New agent creation:** requires session restart for `@` autocomplete to index the agent
- **Existing agent tool edits:** land live (no restart needed)

### Design Decision

Per the `handoff-pickup-redesign` completion (April 2026): per-session files are **immutable post-write**, owned exclusively by the main session at write-time, and validated by the CLI. This boundary enforces a clear architectural split: the CLI handles I/O ceremony, the agent handles synthesis logic. Any redesign that moves file ownership to the agent also requires updating the body constraint and justifying the change against the immutability invariant.

## scratch-memory CLI Capability Audit

The `scratch-memory` CLI exposes the `handoff` and `pickup` verb groups for session lifecycle management. Both handle workstream folder resolution and ownership transfer.

### Current Gap — RESOLVED

**RESOLVED (handoff-sid-fix):** The architectural gap — inline `node -e` block in `/handoff` reimplementing PID resolution — is eliminated. The `/handoff` slash command now calls `write_session({session_id, body})` directly via MCP, passing the user-typed slug as `session_id`. No CLI verb delegation needed for session-path generation. The per-session file path is computed by the MCP server from the caller-supplied `session_id`; the slash command receives the path in the `write_session` return value.

### CLI verb: pickup

Call shape:
```
scratch-memory pickup <from-session-id> --to-session-id <to-session-id> [--json]
```

Both arguments are required at the CLI boundary. The `--to-session-id = from-session-id` default is implemented in the `/pickup` slash command body, not in the CLI verb itself.

**Exit code semantics:**
- **Exit 1** — application-level pickup errors: `PICKUP_COLLISION`, `PICKUP_SOURCE_MISSING`, `PICKUP_INVALID_FROM_SESSION_ID`, `PICKUP_INVALID_TO_SESSION_ID`, `SESSION_ID_REQUIRED`. These are recoverable by correcting inputs or resolving the session identity conflict.
- **Exit 2** — infrastructure error (OS-level rename failure). Not recoverable by retry.

**`--json` flag:** emits the full JSON response to stdout (see `scratch-memory` SKILL.md for the complete field list). Without `--json`, the verb prints a human-readable summary.
