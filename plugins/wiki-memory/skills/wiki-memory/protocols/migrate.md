# Migrate Workflow

`/wiki-memory migrate <skill>`

Fully-automatic apply path. Reads the audit plan, applies each page via `wiki-write --from --update`,
and self-verifies post-state. Replaces the prior per-domain upgrade subroutine with this
8-step apply sequence (WMF-D7). The sync invariant requiring identical subroutine copies
in multiple agent files is dissolved (Constraint I4) — `knowledge-ingestor.md` and
`post-step-updater.md` no longer carry inlined copies.

**Per-skill concurrency constraint.** `wiki-write` uses atomic-rename semantics — each page write is a single last-writer-wins atomic operation. Parallel migrations of *different* skills are safe. Never run two concurrent migrations against the *same* skill; concurrent writes to the same page race non-deterministically.

---

## Pre-check: is this skill wiki-natural? (D-IMPL-13)

Before migrating a skill to wiki-backed format, run the 4-test heuristic. Methodology
skills produce an over-engineered structure with the same content but more navigation
overhead — migrating them is waste.

**4-test heuristic:**

1. **Sequential test:** Does the agent need to read the SKILL.md top-to-bottom every
   time? → methodology, SKIP
2. **Query test:** Will an agent commonly load *one specific page* to answer *one
   specific question*? → wiki-natural, proceed
3. **Growth test:** Will this content grow over time as the LLM ingests new patterns?
   → wiki-natural, proceed
4. **Decomposition test:** Does decomposing the SKILL.md into pages require splitting
   sequential narrative into out-of-order fragments? → methodology, SKIP

**Naming heuristics:**
- `-expert` suffix is a soft wiki signal (but see carve-outs)
- `-methodology`, `-rollout`, `-update` (verb-form), `-management` are strong
  methodology signals — default to SKIP unless all 4 tests clearly pass

**Carve-outs:** `plan-expert`, `estimation-expert`, and `sdd-expert` carry `-expert`
names but are sequential procedural content — SKIP despite the suffix.

**Examples of confirmed-SKIP skills:** `handoff-methodology`, `code-change`,
`analyzer-rollout`, `api-docs`, `brainstorming`, `commit-methodology`, `doc-update`,
`knowledge-capture`, `scratch-management`, `user-docs`.

**If the skill is methodology-flavored:** stop here. Do not proceed to the 8-step
apply sequence.

```
RESULT: SKIP-METHODOLOGY
Reason: <free-text — which test(s) failed>
Action: Keep existing monolithic SKILL.md. No migration needed or desired.
```

**If the skill passes (wiki-natural):** continue to the per-state table and 8-step
apply sequence below.

---

## Per-state code paths

| State | What migrate does |
|-------|------------------|
| `healthy` | No-op — exit immediately at step 1 with "State: healthy — no migration needed." |
| `new` | Audit proposes full decomposition + wiki scaffold (.mditerc, log.md, schema.md, ## Pages, ## Meta); no existing pages to merge against; section keep-vs-promote heuristic applied fresh |
| `partial-migration` | Audit enumerates existing sibling pages AND trapped SKILL.md body; applies page-merge intelligence (MERGE-INTO vs PROMOTE-NEW) for each body section; fixes D34 placement violation if present |
| `unhealthy` | Audit targets specific lint failures, schema violations, dangling-entry removals, tag-prefix mismatches, orphan page cleanup; body decomposition fires only if body weight also exceeds threshold (behaves as partial-migration for that component) |

---

## 8-Step Apply Sequence

### Step 1 — Check current state

```bash
wiki-health <skill>
```

If state = `healthy`: print "State: healthy — no migration needed." and exit (no-op).
Continue only when state is `new`, `partial-migration`, or `unhealthy`.

### Step 2 — Materialize the audit plan

Run the `audit` protocol (read `protocols/audit.md`). The audit:
- Consumes `wiki-health <skill> --json` verdict
- Enumerates all skill-folder files ("all files valuable" — no silent drops)
- Applies keep-vs-promote heuristic, page-merge intelligence, hierarchy bias
- Writes the plan to:
  `${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/wiki-audit/{skill}.md`

The plan path is printed on the last stdout line of audit (`Plan: ...`) for programmatic
consumption. The audit plan is overwritten on each **direct** invocation — stale plans are
never reused. (The auto-chain dispatcher MAY reuse a cached plan per the freshness contract
documented in spec.md §9; see "Audit-cache reuse" below.)

**Caller guard for healthy state:** Audit omits the `Plan:` line when `state = healthy`.
Before reading the plan path, callers MUST check whether audit's first stdout line matches
`State: healthy` — if so, skip plan reading entirely. Unconditionally reading line 6 of
audit stdout will fail for healthy-state skills (per audit.md Step 1 healthy-state contract).

**Audit-cache reuse (auto-chain only):** When migrate is dispatched by the auto-chain
dispatcher (from a `WIKI_AUDIT_REQUIRED:` signal), the dispatcher may supply a cached
plan path if the plan file is newer than `max(skill-folder mtime, .mditerc mtime)`. In
that case, skip audit invocation and read the cached plan directly.

### Step 3 — Prepare per-page payloads

For each page action in the plan (DECOMPOSE, PROMOTE, SPLIT, MERGE-INTO, CROSS-REFERENCE, PATCH), pre-write a payload markdown file with the full page body:

```
${TMPDIR:-/tmp}/wiki-migrate/{skill}/{slug}.md
```

Each payload MUST begin with a YAML frontmatter block containing all required fields (`tags`, `summary`, and any per-domain required fields declared in `schema.md`). `wiki-write` writes exactly what the payload contains — the caller owns correctness.

**Meta pages (schema.md, log.md):** Write directly to `.claude/skills/{skill}/` using the Write tool. Do NOT route these through `wiki-write` — `wiki-write` is for knowledge content pages indexed under `## Pages`; Meta pages live under `## Meta`.

### Step 4 — Mechanically apply the plan

Read the plan from `${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/wiki-audit/{skill}.md`.
Apply each row in the `## Files` table and each row in the `## Section Decomposition`
table (if present) using the action code:

**Per action code — what to write:**

| Action code | Write operation |
|-------------|-----------------|
| `KEEP` | No write needed |
| `DECOMPOSE` | SKILL.md rewritten: extract each promoted/split section into its target file; rewrite SKILL.md hub with frontmatter → role stub → retained landing prose → `## Pages` → `## Meta` (write SKILL.md directly; each extracted page via `wiki-write <domain> <slug> --from <payload>`) |
| `PROMOTE` | Top-level promotions: `wiki-write <domain> <slug> --from <payload>`. Group-targeted promotions (target path `{group}/{slug}`): `mkdir -p .claude/skills/{domain-expert}/{group}/` then Write the payload directly to `.claude/skills/{domain-expert}/{group}/{slug}.md` — do NOT pass `{group}/{slug}` as the slug to `wiki-write` (`wiki-write` rejects `/` in the slug argument); then update `{group}/index.md`'s `## Pages` list. Group-subdirectory pages are not indexed by `wiki-write`; they are listed under a subgroup heading in SKILL.md's `## Pages`. |
| `SPLIT` | Create a group subdirectory with a nav hub and one page per `### ` sub-heading. All paths are group-subdirectory writes: `mkdir -p .claude/skills/{domain-expert}/{group}/` then Write `{group}/index.md` (nav hub) and each `{group}/{slug}.md` (leaf page) directly — do NOT pass `{group}/{slug}` or `{group}/index` as the slug to `wiki-write` (`wiki-write` rejects `/` in the slug argument). Add the group hub entry to SKILL.md's `## Pages` under a subgroup heading. |
| `MERGE-INTO` | Read the existing page, append section body to the payload, then `wiki-write <domain> <slug> --from <payload> --update`; do NOT create a new file |
| `CROSS-REFERENCE` | Write new page via `wiki-write <domain> <slug> --from <payload>`; update related page body with bidirectional link via `wiki-write <domain> <related-slug> --from <payload> --update` |
| `PATCH` | In-place edit — see PATCH rules below |
| `APPEND` | Append migration log entry to `log.md`: `## [{today}] migrate | {state} → healthy` (write log.md directly — it is a Meta page, not routed through `wiki-write`) |

**PATCH rules — what to do per target file:**

When `PATCH` targets `schema.md`: update the tag prefix throughout (all occurrences of the old
prefix in examples or rules text) to the correct `{skill-name}/` prefix. This is the
`WMF-D13` schema correction.

When `PATCH` targets a **page** (any `.md` file other than `schema.md`, `SKILL.md`, `log.md`):
the page's `tags:` frontmatter line must be rewritten to use the correct prefix. Apply as a
single-pass frontmatter rewrite — do not alter the body. Pseudocode:

```bash
# Read the existing page, apply tag-prefix rewrite in the payload file, then wiki-write --update.
# Replace wrong prefix (e.g. winforms/) with correct prefix (e.g. winforms-expert/)
# in the tags: frontmatter line only. Use a targeted sed on the first YAML block.
# Quote all variables; use .bak suffix for sed -i portability.
cp ".claude/skills/${skill}/${page}" "${payload_file}"
sed -i.bak "s|^\(tags:.*\)\b${old_prefix}/|\1${new_prefix}/|g" "${payload_file}"
rm -f "${payload_file}.bak"
wiki-write "${domain}" "${slug}" --from "${payload_file}" --update
```

**Also strip `updated:` frontmatter when PATCHing a page.** Per WMF-D4, page staleness is
tracked via `git log` / mtime — never via a YAML field. If the page carries an `updated:` line
in its frontmatter, remove it in the same PATCH pass:

```bash
# Remove the updated: line from the payload before wiki-write --update
sed -i.bak '/^updated:/d' "${payload_file}"
rm -f "${payload_file}.bak"
```

Apply both changes (tag-prefix rewrite + `updated:` strip) in one logical PATCH pass. The
result: the page has the correct tag prefix, no `updated:` field, and all other content is
untouched.

**SKILL.md hub rewrite rules (WMF-D9):**
- Post-migrate canonical shape: YAML frontmatter → `<role>` stub → optional landing
  prose (retained KEEP sections, ≤30 lines) → `## Pages` → `## Meta`
- `## Pages` placement:
  - `END` (after landing prose) when retained body > 30 non-frontmatter/non-role/non-index lines
  - `TOP` (directly after role stub) when SKILL.md becomes thin-wrapper after decomposition
- `## Pages` entries: one entry per promoted page plus all pre-existing sibling pages
  in canonical format: `- [title](file.md) — one-line summary`
  The `[title]` is derived from the page's kebab-cased filename or its canonical `#`
  heading. The post-em-dash text is derived from the page's `summary` frontmatter field
  (universally required per wiki-memory Page Conventions). The `summary` field is the
  authoritative source for `## Pages` index entry text — do not use arbitrary strings.
- `## Meta` entries: always include `log.md` and `schema.md` links
- **`## Pages` sub-sectioning (4+ groups rule):** Count the subdirectory groups in the
  post-migration layout. If the count is ≥ 4, split `## Pages` into:
  - `### Topic Areas` — list only group hub entries (`{group}/index.md`)
  - `### Standalone Pages` — list top-level leaf pages (not inside a subdirectory)
  If the group count is < 4, emit a flat `## Pages` list without sub-sections.
  Per wiki-memory SKILL.md Page Conventions — this rule exists to give the loading agent
  visual distinction between hubs (load to navigate) and leaves (load to read).

**Tag prefix fix (WMF-D13):**
If `schema.md` action = `PATCH` and the reason is a tag-prefix mismatch, update schema.md
(write directly — it is a Meta page) to use the correct `{skill-name}/` prefix throughout.

**DECOMPOSE backlink rule — retained landing prose → decomposed pages:**

When DECOMPOSE rewrites SKILL.md, the retained landing prose often mentions topics that are
now owned by dedicated decomposed pages. For each retained prose paragraph or list item that
mentions a topic by name (heading text, API name, pattern name), check whether a decomposed
page exists whose tag-prefix or filename matches that topic. When a match is found, append a
parenthetical link to the retained prose mention:

```
(see [disposal.md](notifyicon-lifecycle/disposal.md))
```

**Matching rule:** consider a match when the retained prose's mention string appears in:
- the target page's filename (kebab-slug), OR
- the target page's `#` H1 heading text (case-insensitive token overlap ≥ 2 distinctive words), OR
- the target page's `summary` frontmatter field

**Concrete example (winforms-expert):** SKILL.md's "Common Pitfalls" section retains these items
after decomposition:
- "Ghost icons after crash" — matches `notifyicon-lifecycle/disposal.md` (topic: disposal)
- "GDI handle exhaustion" — matches `core-principles/gdi-handles.md` (topic: gdi-handles)
- "BalloonTip on Windows 10+" — matches `notifyicon-lifecycle/balloon-notifications.md`

The rewritten SKILL.md retained landing prose should append links:

```markdown
- Ghost icons after crash (see [disposal.md](notifyicon-lifecycle/disposal.md))
- GDI handle exhaustion (see [gdi-handles.md](core-principles/gdi-handles.md))
- BalloonTip on Windows 10+ (see [balloon-notifications.md](notifyicon-lifecycle/balloon-notifications.md))
```

**Scope:** Only append backlinks where a match is confident (≥2 distinctive token overlap or
exact filename/slug match). Do NOT append links speculatively. If no match is found for a
retained mention, leave the prose unchanged.

**Extension — rule also fires after group-targeted PROMOTE and MERGE-INTO:**

When a page is placed into a group subdirectory via a group-targeted `PROMOTE` or `MERGE-INTO` (e.g.,
`contextmenu-patterns.md` → `notifyicon-lifecycle/contextmenu-patterns.md`), the rule fires
again after the move completes. Scan SKILL.md retained landing prose AND any retained pages
(pages with action `KEEP`) for mentions of the moved topic by:

- the moved page's filename (kebab-slug), OR
- the moved page's H1 heading text (case-insensitive token overlap ≥ 2 distinctive words)

When a confident match is found, append a parenthetical backlink pointing to the new path:

```
(see [contextmenu-patterns.md](notifyicon-lifecycle/contextmenu-patterns.md))
```

**Scan scope restriction:** Only scan retained content — do NOT scan pages that were themselves
modified by other actions in the same plan. If a page was the target of a group-targeted `PROMOTE`,
`MERGE-INTO`, `DECOMPOSE`, or `SPLIT` in the same migration run, skip it as a scan target.

**Concrete example (winforms-expert):** After `PROMOTE` (Target: `notifyicon-lifecycle/contextmenu-patterns.md`) moves
`contextmenu-patterns.md` to `notifyicon-lifecycle/contextmenu-patterns.md`, scan SKILL.md's
retained prose. The "AOT and ContextMenuStrip" pitfall under `## Common Pitfalls` mentions
"ContextMenu" — token overlap with `contextmenu-patterns` (kebab-slug match). Append:

```markdown
- AOT and ContextMenuStrip (see [contextmenu-patterns.md](notifyicon-lifecycle/contextmenu-patterns.md))
```

### Step 5 — Confirm all pages written

After all `wiki-write` calls in step 4 complete:

1. Enumerate every page action from the audit plan (DECOMPOSE, PROMOTE, SPLIT, MERGE-INTO, CROSS-REFERENCE, PATCH).
2. Verify each target page exists at `.claude/skills/{skill}/{slug}.md` (or `{group}/{slug}.md` for group placements).
3. If any page is missing: the `wiki-write` call for that page failed. Report the missing pages and the payload path(s) to the user — do NOT proceed to step 6.

`wiki-write` uses atomic-rename semantics — each write either lands completely or does not. There is no staging directory to clean up on failure; the payload files under `${TMPDIR:-/tmp}/wiki-migrate/{skill}/` may be reused for retry.

### Step 6 — Verify post-state

```bash
wiki-health <skill>
```

Parse the state from stdout (one-line output). Proceed to step 7 or step 8 based on result.

### Step 7 — Success path (post-state = healthy)

If `wiki-health` returns `healthy` (exit 0):
- Print state transition: `{skill}: {prior-state} → healthy`
- Migration complete. No further action.

### Step 8 — Failure path (post-state ≠ healthy)

If `wiki-health` returns any non-healthy state (exit 3/4/5):
1. Print: `Migration verification failed for {skill}: post-state = {state}`
2. Run `wiki-health <skill> --verbose` to enumerate which specific pages or schema items are unhealthy.
3. For each unhealthy item, re-run the corresponding `wiki-write` call with the corrected payload.
   Payloads are in `${TMPDIR:-/tmp}/wiki-migrate/{skill}/` — reuse or correct them as needed.
4. Verify recovery:
   ```bash
   wiki-health <skill>
   ```
   If post-state becomes healthy: print "{skill}: migration recovered — now healthy." and exit.
   If still unhealthy: print "CRITICAL: migration verification failed — manual recovery needed. Unhealthy pages listed above."
5. In all failure cases: retain the failed audit plan at
   `${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/wiki-audit/{skill}.md` for diagnosis.
   Do NOT delete it.

---

## Partial-run recovery

Steps 1–5 are designed to be safe to re-run after interruption. Each `wiki-write` call is atomic — partial runs leave successfully-written pages in place; only the missing pages need to be retried. If a partial run is detected:
- Re-enter from step 5: check which target pages exist vs. which are missing.
- For missing pages, the payload files are in `${TMPDIR:-/tmp}/wiki-migrate/{skill}/` — re-run `wiki-write` for each missing page.
- If payloads were not written (interrupted before step 3), re-enter from step 2 (re-generate plan) or step 3 (re-prepare payloads).
- If all pages are present but post-state was not verified, re-enter at step 6: re-run `wiki-health` without re-writing any pages.
