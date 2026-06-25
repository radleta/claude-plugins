# Audit Workflow

`/wiki-memory audit <skill>`

Consumes the `wiki-health --json` verdict and produces a remediation plan at
`${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/wiki-audit/{skill}.md`.
**Audit is strictly read-only — no skill-folder writes occur during this protocol.**

---

## Input contract

The audit protocol consumes two inputs:

**Input A — `wiki-health <skill> --json` verdict** (Data Model §1):

| Field | How used |
|-------|----------|
| `state` | drives which section-decomposition rules apply |
| `reasons[].code` | determines which action codes appear in the plan |
| `files.body_line_count` | promote-vs-keep threshold |
| `files.body_section_count` | hierarchy-bias trigger |
| `files.pages_placement` | D34 placement violation detection |
| `files.staging_dir_present` | abort guard |
| `pages.missing_summary` | PATCH candidates |
| `pages.tag_prefix_mismatches` | PATCH candidates |
| `pages.listed_but_missing` | PATCH/REMOVE candidates |
| `pages.orphan_index_md` | top-level index.md cleanup flag |

**Input B — `mdite lint --format json` output** (Step 1b):

```bash
mdite lint --format json .claude/skills/{skill}/SKILL.md
```

Captures `[{file, line, column, severity, rule, message}]` for the skill folder.
This is the second required input. Lint violations of `severity: "error"` produce a `PATCH`
action code on the offending file (added to the `## Files` table, Detail column includes the
rule name and message).

If `state = healthy`: emit one-line "State: healthy — no remediation needed." and exit.
If `files.staging_dir_present = true`: emit error "Staging dir present for {skill} — resolve
the pending staging conflict before running audit." and exit with non-zero.

---

## Step-by-step procedure

### Step 1 — Invoke wiki-health and parse verdict

```bash
wiki-health <skill> --json
```

Capture stdout as the JSON verdict. The exit code maps directly to state:
- `0` → healthy (exit audit — no-op)
- `3` → new
- `4` → partial-migration
- `5` → unhealthy

Parse all fields from Data Model §1. If `files.staging_dir_present` is `true`, abort
with an error message (staging dir conflict — cannot safely audit while a push is pending).

**Healthy-state stdout contract:** When `state = healthy`, audit emits exactly one line:

```
State: healthy — no remediation needed.
```

No plan file is written and the `Plan:` line (Step 11) is **omitted** from stdout. Callers
MUST check for the `State: healthy` prefix before attempting to read the `Plan:` line —
unconditionally reading line 6 of stdout will fail for healthy-state skills. See migrate.md
Step 2 for the caller-side guard.

### Step 1b — Run mdite lint and capture violations

```bash
mdite lint --format json .claude/skills/{skill}/SKILL.md
```

Parse the JSON array output: `[{file, line, column, severity, rule, message}]`.
Filter to `severity: "error"` entries — these become additional `PATCH` candidates in the
`## Files` table. If the lint output is empty or all entries are `severity: "warning"`,
no additional PATCH rows are added from this step. A cached lint result from a prior
`wiki-health` invocation in the same session may be reused in place of a fresh run.

### Step 1c — Enumerate required scaffold files for `state = new` (CREATE action)

This step applies **only when `state = new`**. Skip entirely for `partial-migration`,
`unhealthy`, and `healthy`.

When `state = new`, the wiki scaffold files do not yet exist on disk. The `**/*` glob
in Step 2 cannot find them, so they must be declared explicitly here. For each of the
following files that is **absent** from the skill folder, add a `CREATE` row to the plan:

| Missing file | Target path | Content template |
|--------------|-------------|-----------------|
| `.mditerc` | `.claude/skills/{skill}/.mditerc` | `protocols/init.md` — `.mditerc` template block |
| `log.md` | `.claude/skills/{skill}/log.md` | `protocols/init.md` — `log.md` template block |
| `schema.md` | `.claude/skills/{skill}/schema.md` | `protocols/init.md` — `schema.md` template block |

Additionally record two structural additions required in SKILL.md itself (not separate files):

| Missing element | Action | Detail |
|-----------------|--------|--------|
| `## Pages` heading | `CREATE` | Scaffold `## Pages` nav section per `protocols/init.md` template |
| `## Meta` heading | `CREATE` | Scaffold `## Meta` nav section per `protocols/init.md` template |

**Content-template resolution rule:** Template references point to named blocks in
`protocols/init.md`. Each block is delimited by a `### Template: {name}` heading and
ends at the next `### Template:` or end-of-file. Migrate resolves these references at
apply time — audit records the reference path, not the inline content.

**files-accounted adjustment:** Each `CREATE` row (file or structural) counts as one
entry in `files-accounted` for the purpose of the Step 7 plan header. This ensures
`files-accounted` accurately reflects all work the plan directs — not only existing
disk files.

### Step 1d — Run orphan detection (DF-2)

Applies to **all states except `new`** (new-state wikis have no pre-existing pages to
orphan). For `new` state, set `orphans_json = []` and skip the mdite invocation.

```bash
# Run mdite orphan detection on the skill folder (scripts-expert: quote variables, handle missing tool)
# cd into skill_dir — mdite files accepts no positional args; abspath arg exits 1 (silently returns [])
skill_dir=".claude/skills/${skill}"
if command -v mdite >/dev/null 2>&1; then
  orphans_json=$( cd "${skill_dir}" && mdite files --orphans --format json 2>/dev/null || echo "[]" )
else
  orphans_json="[]"  # mdite not available — orphan detection skipped; log warning
fi
```

Parse `orphans_json` as a JSON array of `{file, depth, orphan}` objects. Extract the
subset where `orphan = true` — these are disk-resident files not reachable from
`SKILL.md` via the `## Pages` link chain.

**Action-code assignment for orphans:**

| Orphan condition | Assigned action | Rationale |
|------------------|-----------------|-----------|
| File is a `.md` page that passes the stale-draft heuristic (see below) | `DELETE` | Content is unambiguously stale; safe to remove |
| All other orphans | `ORPHAN-LINK` | Safer default — preserves content, surfaces for operator decision |

**Stale-draft heuristic** — assign `DELETE` only when ALL of the following hold:
1. Filename starts with `draft-` or `wip-` (explicit draft marker)
2. File body is < 10 non-blank lines (stub content)
3. File has no YAML frontmatter `summary` field (never published)
4. File mtime > 30 days AND `mdite deps --reverse {file}` returns empty (never linked from any wiki page)

If any condition fails, assign `ORPHAN-LINK` instead of `DELETE`.

**Critical:** conditions 1–3 alone are not sufficient. A file recently mtime-touched but
unlinked is likely in-flight work (condition 4 fails). A file linked nowhere but created
recently is a new page awaiting cross-references — not a stale draft (condition 4 fails).
Both conditions (age AND never-linked) must hold before assigning `DELETE`.

**When `mdite` is unavailable:** log a warning in the plan Detail column
(`mdite not found — orphan detection skipped`), assign default `KEEP` action to all
enumerated files (same behavior as pre-DF-2), and proceed. Do NOT abort.

### Step 2 — Enumerate all files in the skill folder ("all files valuable")

Glob `**/*` (excluding `scripts/` and `assets/` subdirectories) under
`.claude/skills/{skill}/`. Every file found gets an entry in the plan's `## Files` table.
**Silent drops are forbidden (WMF-D8)** — if a file is not assigned an action code, the
plan is incomplete.

**Merge in CREATE rows first (Step 1c):** For `state = new`, prepend the scaffold `CREATE`
rows enumerated in Step 1c to the `## Files` table before processing disk files. This ensures
scaffold creation appears at the top of the plan and is included in `files-accounted`.

**Apply orphan override (Step 1d):** After determining the initial action code for each disk
file (table below), check whether the file appears in the `orphans_json` from Step 1d. If it
does (i.e., it is graph-unreachable), override the action code to `ORPHAN-LINK` or `DELETE`
per the stale-draft heuristic defined in Step 1d. The orphan override takes precedence over
the initial action codes below, except for `SKILL.md`, `log.md`, `.mditerc`, and `schema.md` — these are structural/infrastructure files that are never orphanable by definition.

For each disk file, determine its initial action code:

| File | Initial action |
|------|----------------|
| `SKILL.md` | `KEEP` or `DECOMPOSE` (see Step 3) |
| `schema.md` | `KEEP` or `PATCH` (check tag prefix vs `pages.tag_prefix_mismatches`) |
| `log.md` | `APPEND` (migration log entry always appended on apply) |
| `.mditerc` | `KEEP` (entrypoint already correct means no change needed) |
| `*.md` sibling pages | one of: `KEEP`, `MERGE-INTO`, `CROSS-REFERENCE`, `PATCH` (see Step 5); override to `ORPHAN-LINK`/`DELETE` if in orphans_json |
| `{group}/index.md` | `KEEP` unless the group index is malformed (missing canonical `## Pages` hub structure), in which case assign `PATCH` |
| `{group}/*.md` pages | same page-merge evaluation as sibling pages; override to `ORPHAN-LINK`/`DELETE` if in orphans_json |

### Step 2a — Check tag-prefix conformance for all pre-existing pages

This step runs **after** Step 2 enumeration for `state = unhealthy` or `state = partial-migration`.
For `state = new` (no pre-existing pages), skip. For `state = healthy`, audit already exited.

**Why:** `schema.md` declares the authoritative tag prefix (e.g. `winforms-expert/<subtopic>`).
Pre-existing pages may carry an old prefix (e.g. `winforms/<subtopic>`) after a skill rename.
This mismatch silently undermines lint/query — the schema lies. Every page must be checked.

**Procedure:**

1. Read the expected tag prefix from `schema.md`. Look for the first `tags: [prefix/<subtopic>]`
   example inside a fenced YAML block. Extract the text before the first `/` in the tag value —
   that is the `{expected-prefix}`.

   Example: `tags: [winforms-expert/<subtopic>]` → `{expected-prefix}` = `winforms-expert`

   If `schema.md` contains no `tags:` example inside a fenced block (the domain author has not yet
   codified a prefix convention), **skip this step** — the prefix check requires an explicit
   declaration in schema.md.

2. For each `.md` page in the skill folder (excluding `SKILL.md`, `log.md`, `schema.md`, group
   `index.md` files), read the page's YAML frontmatter `tags:` field. Extract the prefix of each
   tag value (text before the first `/`).

3. For each page where any tag prefix ≠ `{expected-prefix}`, emit a `PATCH` row in the
   `## Files` table with:
   - Path: the page path (relative to skill folder)
   - Action: `PATCH`
   - Detail: `tag prefix {actual-prefix} → {expected-prefix}`

   Concrete example from winforms-expert migration:

   | Path | Action | Detail |
   |------|--------|--------|
   | `dual-context-form-mode-flag.md` | PATCH | tag prefix winforms → winforms-expert |
   | `form-anchor-bottom-edge-on-resize.md` | PATCH | tag prefix winforms → winforms-expert |
   | `layered-window-bounds-cache-staleness.md` | PATCH | tag prefix winforms → winforms-expert |

4. Subdir-grouped pages (e.g. `notifyicon-lifecycle/disposal.md`) follow the same rule: extract
   the prefix of each tag (text before first `/`). A tag like `winforms-expert/notifyicon-lifecycle`
   has prefix `winforms-expert` — depth beyond the first `/` does not affect the prefix check.

**Integration with Step 2 action codes:** The `PATCH` rows from Step 2a override any initial
`KEEP` action assigned to the same page in Step 2. If the page already had a `PATCH` from Step 5
merge-intelligence or orphan override, merge the Details into a single `PATCH` row for that page.

### Step 3 — Apply section keep-vs-promote heuristic to SKILL.md (WMF-D6)

This step determines whether SKILL.md needs decomposition. Evaluate the **body** of SKILL.md
(lines after YAML frontmatter, `<role>` stub, and `## Pages` + `## Meta` nav sections).

**Always-keep:** the `<role>` block and any prose BEFORE the first `## ` heading are unaffected
by this step — they stay in SKILL.md regardless of any heuristic result.

#### Step 3a — Content-class classifier (applies BEFORE length/code-block heuristic)

For each `## ` section, classify by **what the content IS** rather than by keyword matching.
Four content classes, each with a default action:

**Procedural (KEEP):** Content the agent reads at skill-load time to begin work — setup steps,
investigation protocol, configuration instructions, prerequisites. This content must be present
when the agent opens SKILL.md, so it stays inline.

- *winforms-expert example:* `## Investigation Protocol` — the agent consults this before
  writing any WinForms code. Keeping it inline means it is immediately available. Action: KEEP.
- *csharp-expert example:* `## Project Detection` — environment detection steps the agent
  needs before deciding which patterns apply. Action: KEEP.

**Lookup-time reference (PROMOTE):** Content the agent retrieves when a specific question arises —
pitfalls, gotchas, troubleshooting guides, FAQ, tips, notes. Agents look these up by name; they
do not need them at load time.

- *winforms-expert example:* `## Common Pitfalls` — consulted when something goes wrong, not
  proactively. Thin SKILL.md + dedicated page is better. Action: PROMOTE.
- *react-expert example:* `## Common Hooks Mistakes` — reference content, not procedural.
  Action: PROMOTE.

**Conditional / niche (PROMOTE):** Content that applies only under specific circumstances —
platform constraints, version-specific caveats, compatibility notes, "when to use" decision
guidance. Conditional content bloats SKILL.md for the majority of use cases where the condition
does not apply.

- *winforms-expert example:* `## .NET 10 and AOT Considerations` — only relevant when targeting
  AOT. Agents working on standard WinForms apps never need it. Action: PROMOTE.
- *csharp-expert example:* `## Nullable Reference Type Migration` — niche topic for projects
  enabling NRTs. Action: PROMOTE.

**End-of-work QA (PROMOTE):** Checklists, acceptance criteria, validation steps, verification
guides — content used AFTER implementation, not during. Keeping QA checklists in SKILL.md
inflates the load-time footprint for no benefit during active coding.

- *winforms-expert example:* `## Success Indicators` — reviewed after implementation is done.
  Action: PROMOTE.
- *react-expert example:* `## Quality Checklist` — post-implementation QA; not needed at
  skill-load time. Action: PROMOTE.

**When PROMOTE fires from the content-class classifier:** apply the same Step 5 page-merge
intelligence used for other promotion candidates — compare against existing pages before
creating a new one. If a matching page already exists (e.g., a "Common Pitfalls" class match
finds a pre-existing `common-pitfalls.md`), use `MERGE-INTO` rather than creating a duplicate.

**Default fallback:** sections that do not clearly fit any content class fall through to the
length/code-block heuristic in Step 3b below. When unsure, prefer Step 3b — do not force a
content-class classification on ambiguous headings.

#### Step 3b — Length/code-block heuristic (fallback for sections with no content-class match)

**Promote a section when ANY of these is true:**
- Section body ≥ 20 lines (section weight justifies a dedicated nav target)
- Section body contains one or more fenced code blocks (` ``` ` or ` ~~~ `)
- Section body contains one or more nested `### ` sub-headings

**Keep inline (do not promote) only when ALL of these are true:**
- Section body < 20 lines
- Section body contains no fenced code blocks
- Section body contains no nested `### ` sub-headings

**Ambiguous range (15–25 lines, 0–1 code blocks, 0–2 nested `### ` sub-headings):** bias
toward PROMOTE. Sections inside this range are borderline; over-promotion is cheap to undo
manually if needed. Sections clearly outside this range (either very small or very large)
follow the deterministic thresholds above without bias.

For each `## ` section in SKILL.md body, record: section title, line count, action
(`KEEP` or `PROMOTE`), and target filename (if `PROMOTE`).

**Split-into-group heuristic (WMF-D12):**
When a section has ≥ 3 nested `### ` sub-headings:
- Action: `SPLIT`
- Target: `{parent-slug}/` subdirectory with one page per `### ` plus
  `{parent-slug}/index.md` as the group navigation page

If SKILL.md body weight ≤ 30 non-frontmatter/non-role/non-index lines AND no sections
qualify for promotion → SKILL.md action is `KEEP` (thin-wrapper, no decomposition needed).

**SKILL.md hub placement rationale:** >30 lines body weight → hub at END because the agent
reads SKILL.md top-down; substantive prose should precede the page index. Thin-wrapper
SKILL.md → hub at TOP so the page index is immediately visible.

If SKILL.md needs any promotion → SKILL.md action is `DECOMPOSE`.

### Step 4 — Determine SKILL.md hub placement (WMF-D9)

After decomposition, assess the canonical `## Pages` placement:

| Condition | Placement | Rule |
|-----------|-----------|------|
| Body weight > 30 lines of non-frontmatter/non-role/non-index content AFTER decomposition | `END` | D34 content-heavy case: `## Pages` goes after remaining landing prose |
| Thin-wrapper (≤ 30 lines of non-promoted content after decomposition) | `TOP` | `## Pages` appears directly after role stub |

If `files.pages_placement` from the verdict is `top` but body weight exceeds threshold
(D34 violation), flag this as a `D34_PLACEMENT_VIOLATION` fix in the plan.

### Step 5 — Page-merge intelligence for promotion candidates (WMF-D8)

For each section that will be promoted (action = `PROMOTE` or `SPLIT`), compare the
candidate against existing sibling pages using three overlap signals:

1. **Tag overlap** (mechanical): does the candidate's likely tag prefix match an existing page's tags?
2. **Code-block fingerprint** (mechanical): does the candidate share identical or near-identical code
   samples with an existing page? (Same ≥80% non-trivial token overlap rule as Step 5b.)
3. **Semantic relatedness** (judgment): would a reader of the candidate page benefit from the existing
   page, or vice versa? Use heading text, body concepts, and domain terminology as evidence. Heading
   similarity is input to this judgment — not a standalone signal.

Three outcomes:

| Outcome | Trigger | Action code |
|---------|---------|-------------|
| No overlap on all three signals | Candidate introduces new content | `PROMOTE` → new page at `{slug}.md` |
| Substantial overlap (2+ signals match) | Candidate duplicates or supersedes existing page | `MERGE-INTO {existing-page.md}` → integrate into existing page |
| Related but distinct (1 signal matches) | Candidate is related but not duplicative | `CROSS-REFERENCE {existing-page.md}` → new page + bidirectional link added to both |

When `state = new` (no existing sibling pages): all candidates receive `PROMOTE` (no
pages to merge against).

When `state = partial-migration` or `unhealthy`: apply merge intelligence against every
existing `.md` sibling in the skill folder.

### Step 5b — Pairwise existing-page cross-link scan

After Step 5 (which evaluates promotion candidates against existing pages), scan **all existing
pages pairwise** for cross-link opportunities. This catches related-but-distinct pages that do not
currently link to each other — a class of missing link the migration machinery cannot discover
from promotion candidates alone.

**When this step runs:** For `state = partial-migration` or `unhealthy`. For `state = new`,
there are no pre-existing pages; skip. For `state = healthy`, audit already exited.

**Signals to check between each page pair (A, B):**

1. **Tag overlap** (mechanical): any tag value in A's frontmatter appears in B's frontmatter (or
   the prefix matches). Tag overlap is a strong shared-identity signal — tags are deliberately
   declared, so overlap is intentional.

2. **Code-block fingerprint** (mechanical): A and B share an identical or near-identical code
   snippet. Requires ≥80% lexical overlap of non-trivial tokens — shared import lines, common DSL
   boilerplate, or framework scaffolding do not count.

   *Anti-example:* Two pages each containing a `csproj` snippet with `<TargetFramework>` are NOT
   near-identical — one may be a NuGet packaging guide and the other a multi-target build setup.
   Code-block fingerprint fires only when the surrounding code logic (not just framework boilerplate)
   overlaps substantially.

3. **Semantic relatedness** (judgment): would a reader of page A benefit from page B's content?
   Use heading text and page body as evidence. Heading-text similarity (same domain term, same
   pattern name, same concept) is one input to this judgment — but it is not a standalone signal.
   Fold heading similarity into this holistic assessment.

   *Not a separate signal:* heading-text similarity alone should not emit `CROSS-REFERENCE`.
   It must combine with substantive content overlap to clear the "reader benefit" bar.

**Action-code assignment (any of the three signals above counts):**

| Signal count | Condition | Action code | Emitted for |
|---|---|---|---|
| 0 signals match | No overlap | none — skip | — |
| 1+ signals match | Related but distinct | `CROSS-REFERENCE` | both pages |
| 1+ signals match AND pages already link | Already cross-linked | none — skip | — |

**3-signal summary:** tag overlap (mechanical) + code-block fingerprint (mechanical) +
semantic relatedness (judgment). Any one signal is sufficient to emit `CROSS-REFERENCE`.
The judgment signal requires a holistic "reader benefit" assessment — do not emit
`CROSS-REFERENCE` on superficial heading-text coincidence alone.

Emit a `CROSS-REFERENCE` row in `## Files` for **both** pages in the pair with:
- Detail: `bidirectional link to {related-page-slug}`

**Deduplication:** If a page pair already has `[text](link)` in either page's body pointing to the
other, skip — the cross-link already exists.

**Concrete example (winforms-expert):** `core-principles/gdi-handles.md` describes the
clone-and-destroy pattern. `notifyicon-lifecycle/icon-updates.md` and
`gdi-icon-rendering/circle-icon.md` both use the pattern (code-block fingerprint match).
None of the three currently link to each other. Step 5b should emit:

| Path | Action | Detail |
|------|--------|--------|
| `core-principles/gdi-handles.md` | CROSS-REFERENCE | bidirectional link to notifyicon-lifecycle/icon-updates.md |
| `notifyicon-lifecycle/icon-updates.md` | CROSS-REFERENCE | bidirectional link to core-principles/gdi-handles.md |
| `core-principles/gdi-handles.md` | CROSS-REFERENCE | bidirectional link to gdi-icon-rendering/circle-icon.md |
| `gdi-icon-rendering/circle-icon.md` | CROSS-REFERENCE | bidirectional link to core-principles/gdi-handles.md |

#### Saturation cap — top-5 per page

After the pairwise pass collects all candidate pairs, aggregate per page and retain only the
**top 5** cross-references per page. If a page accumulates more than 5 outbound
`CROSS-REFERENCE` candidates, rank them by relationship strength and discard the rest.
Ties broken by alphabetical slug (deterministic).

**Relationship-strength ranking** (descending priority — keep strongest first):

| Tier | Condition | Strength |
|---|---|---|
| Strongest | Shared tag AND shared code-block fingerprint | Highest — emit first |
| Strong | Shared code-block fingerprint only | High |
| Medium | Shared headline concept / domain term (semantic relatedness judgment) | Medium |
| Weak | Incidental terminology overlap only | Discard unconditionally |

Aggregate per page across tiers: keep strongest → strong → medium candidates until the top-5
cap is reached. Discard all weak candidates regardless of total count. Ties within a tier are
broken by alphabetical slug.

**Asymmetric inclusion is acceptable:** the cap is per page, not per pair. Page A may appear
in `CROSS-REFERENCE` rows for pages B, C, D, E, F (5 outbound), while page F's own top-5 may
not include A because F has stronger pairings elsewhere. This is by design — saturation is
judged independently per page.

**Concrete example — GDI-rendering pages:**

Suppose `gdi-icon-rendering/circle-icon.md` (A) has 12 candidate cross-references after the
pairwise pass. Ranked by tier:

| Candidate | Tier | Keep? |
|---|---|---|
| A → `core-principles/gdi-handles.md` | Strongest (tag + code) | yes |
| A → `gdi-icon-rendering/square-icon.md` | Strong (code only) | yes |
| A → `notifyicon-lifecycle/icon-updates.md` | Strong (code only) | yes |
| A → `rendering-patterns/clip-region.md` | Medium (semantic) | yes |
| A → `rendering-patterns/double-buffer.md` | Medium (semantic) | yes (5th) |
| A → 7 remaining pages | Weak | no |

Result: page A emits exactly 5 `CROSS-REFERENCE` rows. Each referenced page independently
applies its own top-5 cap.

**Integration with Step 2 action codes:** `CROSS-REFERENCE` from Step 5b overrides `KEEP` for
the affected pages. If a page already has a `CROSS-REFERENCE` from Step 5 promotion candidates,
append the additional bidirectional link Detail rather than creating a duplicate row.

### Step 6 — Apply hierarchy bias rules (WMF-D12, WMF-D16)

After all section actions are determined, check for hierarchy opportunities:

- If `pages-proposed` would reach 10–12 pages → emit `CONSIDER_HIERARCHICAL_GROUPING`
  soft advisory (not a blocker; reviewer decides whether to act on it).
- If a `## ` section has ≥ 3 nested `### ` sub-headings → action is `SPLIT`
  (mandatory, not advisory).

**Group-affinity check for top-level PROMOTE candidates:**

For each candidate whose current action is `PROMOTE` (targeting a flat top-level slug rather
than a `{group}/` path), judge whether the candidate semantically fits an existing subdirectory
group. Propose a `{group}/{slug}.md` destination when sibling pages in the group share a
cohesive domain concept that a reader would navigate **as a group** — the candidate belongs
inside that group because it covers the same sub-domain, not merely because it shares a tag
prefix or slug prefix.

**Anti-examples — do NOT propose group membership for these patterns:**

[a] **Slug-prefix coincidence**: pages under `decision-trees/` (csharp-expert) share the
directory name token "decision-tree" in their slugs. A new candidate tagged
`csharp-expert/null-handling` should NOT be filed into `decision-trees/` solely because
its slug contains "null-handling" and `decision-trees/null-handling.md` exists. The slug
prefix is a filing convention — `null-handling` under `decision-trees/` and a new
`null-handling-advanced.md` at top level address different navigation needs.

[b] **Same tag, orthogonal concerns**: pages tagged `react/hooks` may cover `useState` rules
(state management) and `useEffect` dependency arrays (side-effect management). A new
candidate also tagged `react/hooks` about `useReducer` patterns does NOT automatically
belong in an existing `hooks/` group — the shared tag reflects domain category, not
navigational grouping. Assess whether a reader navigating the group would expect to find
all three pages there together.

**When a candidate fits an existing group:** change the action from `PROMOTE` to `PROMOTE`
with `Target: {group}/{slug}.md` in the Section Decomposition table. Emit a note in the
Detail column explaining the group-affinity rationale.

Concrete example — `contextmenu-patterns.md` (about ContextMenuStrip for NotifyIcon):
- `notifyicon-lifecycle/` group contains pages about NotifyIcon creation, lifecycle, disposal.
- The candidate covers ContextMenuStrip *for* NotifyIcon — same component, same lifecycle context.
  A reader navigating `notifyicon-lifecycle/` would expect to find it there.
- Action: `PROMOTE`, Target: `notifyicon-lifecycle/contextmenu-patterns.md`
- Detail: `group-affinity: candidate covers NotifyIcon sub-domain, fits notifyicon-lifecycle/`

### Step 7 — Build plan header (5-line summary)

Emit five fields verbatim (no extra prose):

```
state: {state from verdict}
triggers: {comma-separated reason codes from verdict}
files-accounted: {count of all files enumerated in Step 2}
pages-current: {count of existing *.md sibling pages excluding SKILL.md, log.md, schema.md}
pages-proposed: {pages-current +/- net change from decomposition actions}
```

### Step 8 — Build `## Files` table

One row per file enumerated in Step 2. Column order: `Path | Action | Detail`.
Detail column carries the reasoning string (e.g., `512 lines / 11 sections after ## Meta →
per section-decomposition table`, `fix tag prefix winforms → winforms-expert`, etc.).
Use the full set of action codes:

| Action code | Meaning |
|-------------|---------|
| `KEEP` | No change needed |
| `CREATE` | Scaffold file created from template (Step 1c; `state=new` only) |
| `DECOMPOSE` | SKILL.md broken into multiple pages (see Section Decomposition table) |
| `PROMOTE` | Section promoted to standalone page (top-level or into a group — Target column carries the destination path) |
| `SPLIT` | Section split into subdirectory group (`{group}/index.md` + per-`### ` pages) |
| `MERGE-INTO` | Content integrated into an existing sibling page |
| `CROSS-REFERENCE` | New page created + bidirectional link added to related page |
| `ORPHAN-LINK` | Orphan file linked from `## Pages` for operator visibility (Step 1d) |
| `DELETE` | Orphan file removed — stale-draft heuristic matched (Step 1d) |
| `PATCH` | In-place fix: tag prefix, frontmatter, dangling entry removal |
| `APPEND` | Append-only write: migration log entry in log.md |

### Step 9 — Build `## Section Decomposition` table (only when SKILL.md action = DECOMPOSE)

One row per `## ` section in SKILL.md body. Column order:
`Section | Lines | Action | Target`.

- `Section`: the `## ` heading text
- `Lines`: body line count for that section
- `Action`: one of `KEEP`, `PROMOTE`, `SPLIT`, `MERGE-INTO`, `CROSS-REFERENCE`
- `Target`: filename or subdirectory path (e.g., `architecture.md`,
  `layered-windows/`, `SKILL.md landing prose`)

Sections kept inline → Target = `SKILL.md landing prose`.
Sections split → Target = `{group}/` (subdirectory path).

### Step 10 — Write plan to stable runtime path (atomic write)

Target path: `${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/wiki-audit/{skill}.md`

Write pattern — write to co-located temp file then rename:
```bash
AUDIT_DIR="${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/wiki-audit"
mkdir -p "$AUDIT_DIR"
TMP_PLAN="${AUDIT_DIR}/.${skill}.md.tmp"
# write plan content to $TMP_PLAN
mv "$TMP_PLAN" "${AUDIT_DIR}/${skill}.md"
```

Same-volume rename is atomic on POSIX and on Windows/MSYS when source and destination
share a volume. **Cross-volume caveat:** When `LOCALAPPDATA` is on a different volume than
the skill folder (e.g., `LOCALAPPDATA=C:\Users\...` and the project on `D:\`), the system
temp dir for `$TMP_PLAN` may be on a different volume than `${AUDIT_DIR}`, making the
`mv` non-atomic. In cross-volume scenarios, create `TMP_PLAN` inside `${AUDIT_DIR}`
(same volume as the destination) rather than in the system temp dir:

```bash
TMP_PLAN="${AUDIT_DIR}/.${skill}.md.tmp"   # same dir = same volume = atomic mv
```

The plan is **overwritten on each run** — no cruft accumulation (WMF-D5).

### Step 11 — Emit stdout summary

Print to stdout (for user-facing invocations and caller parsing):

```
state: {state}
triggers: {comma-separated reason codes}
files-accounted: {N}
pages-current: {N}
pages-proposed: {N}
Plan: ${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/wiki-audit/{skill}.md
```

The 6th line `Plan:` gives the stable path for callers (migrate protocol, CI tooling) to
locate the plan without re-parsing.

---

## Action code reference summary

| Code | Read-only? | Meaning |
|------|-----------|---------|
| `KEEP` | yes | File or section unchanged |
| `CREATE` | yes | File does not yet exist; migrate creates it from the referenced template (scaffold files for `state=new` only) |
| `DECOMPOSE` | yes | SKILL.md will be broken into pages (see Section Decomposition table) |
| `PROMOTE` | yes | Body section → standalone page; Target column carries destination (top-level `{slug}.md` or group path `{group}/{slug}.md`) |
| `SPLIT` | yes | Body section with ≥3 `### ` → `{group}/` subdirectory |
| `MERGE-INTO` | yes | Candidate content absorbed into named existing page |
| `CROSS-REFERENCE` | yes | New page + bidirectional link to named related page (also: existing-page pair emitted by Step 5b) |
| `ORPHAN-LINK` | yes | File is graph-unreachable (orphan); migrate adds a `## Pages` link so operator can decide to keep or remove |
| `DELETE` | yes | Orphan file matches stale-draft heuristic; migrate removes the file (see Step 1d conditions) |
| `PATCH` | yes | In-place correction (tag prefix, missing frontmatter, dangling entry) |
| `APPEND` | yes | Append-only addition (log entry) |

All codes are planning-time only — the audit protocol writes NO skill-folder files.

---

## Per-state behavior summary

| State | What audit focuses on |
|-------|----------------------|
| `new` | Full decomposition of SKILL.md body + **CREATE-driven scaffold** (.mditerc, log.md, schema.md, `## Pages`, `## Meta`) emitted by Step 1c; all promotion candidates receive `PROMOTE` (no existing pages to merge against); orphan detection skipped (no pre-existing pages) |
| `partial-migration` | Enumerates existing sibling pages AND trapped SKILL.md body; applies merge intelligence; fixes D34 placement violation if present; Step 1d orphan detection runs |
| `unhealthy` | Targets lint failures, schema violations, dangling entries, tag-prefix mismatches; **Step 1d orphan detection runs** and overrides `KEEP` with `ORPHAN-LINK`/`DELETE` for graph-unreachable files; body decomposition only if body weight also exceeds threshold |
| `healthy` | Exit immediately — no plan generated |

---

## Example plan output

```markdown
state: partial-migration
triggers: BODY_WEIGHT_EXCEEDED, D34_PLACEMENT_VIOLATION
files-accounted: 12
pages-current: 6
pages-proposed: 14

## Files

| Path | Action | Detail |
|------|--------|--------|
| SKILL.md | DECOMPOSE | 512 lines / 11 sections after ## Meta → per section-decomposition table |
| schema.md | PATCH | fix tag prefix winforms → winforms-expert |
| log.md | APPEND | migration log entry |
| .mditerc | KEEP | entrypoint already correct |
| bounds-cache.md | MERGE-INTO | substantial overlap with new bounds-cache section |
| form-anchor-bottom-edge-on-resize.md | KEEP | standalone page, no overlap |

## Section Decomposition

| Section | Lines | Action | Target |
|---------|-------|--------|--------|
| ## Overview | 8 | KEEP | SKILL.md landing prose |
| ## Architecture | 45 | PROMOTE | architecture.md |
| ## Configuration | 62 | PROMOTE | configuration.md |
| ## Event Handling | 38 | PROMOTE | event-handling.md |
| ## Layered Windows | 120 | SPLIT | layered-windows/ (group index + 3 pages) |
```
