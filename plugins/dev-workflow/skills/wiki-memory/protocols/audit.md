---
summary: "consume wiki-health verdict and produce a remediation plan"
---

# Audit Workflow

`/wiki-memory audit <skill> [--fix]` · `/wiki-memory audit --all [--fix]`

Audit is the wiki maintenance command: it **reports by default and applies with `--fix`** (D12).
Either way it consumes the `wiki-health --json` verdict and produces a remediation plan at
`${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/wiki-audit/{skill}.md`.

**Detection is mechanical; fixing is an agent (D13).** Every finding in the report comes from
`wiki-health`, which is pure-read and scripted. Repair is `wiki-groomer`'s work — dispatched per
affected domain by `--fix`, and expressed as the prose catalog in `## The conformance catalog`
below rather than as fixer code. There is deliberately no mechanical fixer and no test suite for
one: the thing that repairs a wiki is an agent reading a catalog.

---

## Modes

| Mode | Invocation | What happens | What is written |
|------|------------|--------------|-----------------|
| Report (default) | `audit <skill>` | Run the detector, build the plan, print the summary | The plan file under `%TEMP%`, nothing else |
| Apply | `audit <skill> --fix` | Report, then dispatch `wiki-groomer` per affected domain, then **re-run the detector** and report what actually closed | The plan file, plus whatever the agent repairs in the skill folder |
| Fleet | `audit --all [--fix]` | The same, once per declared domain — see `## Fleet mode` | One plan file per domain with findings |

**Two properties this protocol must keep, and how it keeps them:**

- **Report mode writes nothing inside the repository.** The plan lands under
  `${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/wiki-audit/`, outside the working tree, so
  `git status --short` is unchanged by a report run. That is the whole reason for the `%TEMP%`
  destination, and why it does not contradict the pure-read contract (D2), whose subject is
  working-tree churn.
- **Two report runs over an unchanged tree produce identical reports.** Every finding is a
  `wiki-health` reason code read out of `--json`; no step asks an agent what it thinks before the
  report is printed. Anything that moves detection into judgment breaks this, so nothing may.

---

## Input contract

The audit protocol consumes two inputs:

**Input A — `wiki-health <skill> --json` verdict** (Data Model §1). **Read `--json`, not the
verbose text** — the verbose form is for a person, the JSON is the contract, and only the JSON
carries the per-signal detail the adoption report needs:

| Field | How used |
|-------|----------|
| `state` | drives which rules apply — see `## Per-state behavior summary` |
| `reasons[].code` | determines which action codes appear in the plan |
| `files.wiki_declared` | whether this folder has declared itself a wiki (D15) |
| `files.legacy_log_present` | a retired operations log is still on disk |
| `files.body_line_count` | promote-vs-keep threshold |
| `files.body_section_count` | hierarchy-bias trigger |
| `files.pages_placement` | D34 placement violation detection |
| `files.staging_dir_present` | abort guard |
| `pages.missing_summary` | PATCH candidates |
| `pages.duplicate_last_verified` | PATCH candidates — a page with an ambiguous verification date |
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

Three early exits, checked in this order:

- If `state = not-a-wiki`: **say nothing about this skill at all.** It has not declared itself and
  carries no structural signal, so it is not a wiki that is broken — it is not a wiki. Emit
  `State: not-a-wiki — nothing to audit.` for a single-skill invocation, and under `--all` omit
  the row entirely. This is the outcome that retires the false "unmigrated wiki" classifications;
  never report an undeclared, unsignalled skill as a finding of any kind.
- If `state = healthy`: emit one-line "State: healthy — no remediation needed." and exit.
- If `files.staging_dir_present = true`: emit error "Staging dir present for {skill} — resolve
  the pending staging conflict before running audit." and exit with non-zero.

---

## Step-by-step procedure

### Step 1 — Invoke wiki-health and parse verdict

```bash
wiki-health <skill> --json
```

Capture stdout as the JSON verdict. The exit code maps directly to state:
- `0` → healthy (exit audit — no-op)
- `2` → not-a-wiki (exit audit — say nothing; this is the shared "not a wiki" code, not a new one)
- `3` → new — **an adoption candidate**, see Step 1c
- `4` → partial-migration
- `5` → unhealthy

**`new` no longer means "a bare skill awaiting a scaffold".** Since identity became the `wiki: true`
declaration (D15), `new` has exactly one cause: `ADOPTION_CANDIDATE` — a skill that has not declared
itself but is structurally shaped like a wiki. A skill with no scaffold and no signal is
`not-a-wiki` and is silent. Read the state through that meaning everywhere below.

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

**`not-a-wiki` has the same shape.** It is the second state that emits one line and no
`Plan:` — `State: not-a-wiki — nothing to audit.` A caller that guards only on `State: healthy`
will read line 6 and fail here. Guard on the absence of the `Plan:` line, or on both prefixes.

### Step 1b — Run mdite lint and capture violations

```bash
mdite lint --format json .claude/skills/{skill}/SKILL.md
```

Parse the JSON array output: `[{file, line, column, severity, rule, message}]`.
Filter to `severity: "error"` entries — these become additional `PATCH` candidates in the
`## Files` table. If the lint output is empty or all entries are `severity: "warning"`,
no additional PATCH rows are added from this step. A cached lint result from a prior
`wiki-health` invocation in the same session may be reused in place of a fresh run.

### Step 1c — Report the adoption candidate and its conformance gap (`state = new`)

This step applies **only when `state = new`**, which now means exactly one thing: the verdict
carries `ADOPTION_CANDIDATE`. Skip entirely for `partial-migration`, `unhealthy`, and `healthy`.

**Report it as adoptable, never as broken.** The candidate is a skill folder that looks like a
wiki and has not said it is one. That is a question for a person, not a defect: the report names
the signals that made it a candidate and stops there. Adoption happens only under `--fix`.

`reasons[]` carries `ADOPTION_CANDIDATE` first, then one line per signal that fired. Reproduce
each in the plan verbatim — the signals are the evidence a reader confirms the candidacy on:

| Signal code | What it means |
|-------------|---------------|
| `PAGES_HEADING` | `SKILL.md` carries a `## Pages` heading |
| `LEGACY_LOG` | a retired operations log from a previous wiki generation is present |
| `MDITERC_PRESENT` | a `.mditerc` file is present |
| `SIBLING_PAGES` | three or more sibling pages carry both `tags:` and `summary:` frontmatter |

**Adoption is all-or-nothing (D17).** A confirmed candidate is brought *fully* into conformance,
never merely declared: declaring a folder a wiki while leaving it without the artifacts a wiki
needs converts a silent non-wiki into a loud broken one. For each of the following that is
**absent**, add a row to the plan:

| Missing element | Action | Target |
|-----------------|--------|--------|
| `wiki: true` in `SKILL.md` frontmatter | `PATCH` | the declaration, bare and lowercase, top-level inside the frontmatter block |
| `.mditerc` | `CREATE` | `.claude/skills/{skill}/.mditerc` — `protocols/init.md`'s `.mditerc` template block |
| `schema.md` | `CREATE` | `.claude/skills/{skill}/schema.md` — `protocols/init.md`'s `schema.md` template block |
| `## Pages` heading | `CREATE` | scaffold the nav section per `protocols/init.md`'s template |
| `## Meta` heading | `CREATE` | scaffold the nav section per `protocols/init.md`'s template |

A `LEGACY_LOG` signal additionally contributes its own row — see the catalog's
`LEGACY_LOG_PRESENT` entry, which applies to a candidate and a declared wiki alike.

**Order matters within adoption:** the declaration is the row that changes what every other
check means, so it is applied *with* the rest, never before them. See `## Applying with --fix`.

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

**Critical:** conditions 1–3 alone are not sufficient — condition 4's age AND never-linked
sub-parts must BOTH hold before assigning `DELETE`. A recently-touched-but-unlinked file is
likely in-flight work; a never-linked-but-recent file is a new page awaiting cross-references.
Either alone fails condition 4.

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
the initial action codes below, except for `SKILL.md`, `.mditerc`, and `schema.md` — these are structural/infrastructure files that are never orphanable by definition.

For each disk file, determine its initial action code:

| File | Initial action |
|------|----------------|
| `SKILL.md` | `KEEP` or `DECOMPOSE` (see Step 3) |
| `schema.md` | `KEEP` or `PATCH` (check tag prefix vs `pages.tag_prefix_mismatches`) |
| `log.md` | `DELETE` — a retired operations log (D3); see the catalog's `LEGACY_LOG_PRESENT` entry |
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

2. For each `.md` page in the skill folder (excluding `SKILL.md`, `schema.md`, group
   `index.md` files), read the page's YAML frontmatter `tags:` field. Extract the prefix of each
   tag value (text before the first `/`).

3. For each page where any tag prefix ≠ `{expected-prefix}`, emit a `PATCH` row in the
   `## Files` table with:
   - Path: the page path (relative to skill folder)
   - Action: `PATCH`
   - Detail: `tag prefix {actual-prefix} → {expected-prefix}`

   Worked example: see [`audit-examples.md#step-2a-tag-prefix-patch-example`](audit-examples.md#step-2a-tag-prefix-patch-example).

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

| Class | Action | Definition |
|-------|--------|------------|
| **Procedural** | KEEP | Content the agent reads at skill-load time to begin work — setup steps, investigation protocol, configuration instructions, prerequisites. Must be present when the agent opens SKILL.md, so it stays inline. |
| **Lookup-time reference** | PROMOTE | Content the agent retrieves when a specific question arises — pitfalls, gotchas, troubleshooting guides, FAQ, tips, notes. Agents look these up by name; not needed at load time. |
| **Conditional / niche** | PROMOTE | Content that applies only under specific circumstances — platform constraints, version-specific caveats, compatibility notes, "when to use" decision guidance. Bloats SKILL.md for the majority of use cases where the condition doesn't apply. |
| **End-of-work QA** | PROMOTE | Checklists, acceptance criteria, validation steps, verification guides — content used AFTER implementation, not during. Inflates load-time footprint for no active-coding benefit. |

Worked examples (one winforms-expert/react-expert/csharp-expert illustration per class): see
[`audit-examples.md#step-3a-content-class-examples`](audit-examples.md#step-3a-content-class-examples).

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
candidate against existing sibling pages using the same three overlap signals Step 5b
defines below (tag overlap, code-block fingerprint, semantic relatedness — see Step 5b's
"Signals to check" for the full definitions, including the ≥80% token-overlap threshold
for code-block fingerprint). Applied here to candidate-vs-existing-page, rather than
Step 5b's existing-page-vs-existing-page.

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

3. **Semantic relatedness** (judgment): would a reader of page A benefit from page B's content?
   Use heading text and page body as evidence. Heading-text similarity (same domain term, same
   pattern name, same concept) is one input to this judgment — but it is not a standalone signal.
   Fold heading similarity into this holistic assessment.

Edge cases for signals 2 and 3 (what does NOT count as a match): see
[`audit-examples.md#step-5b-signal-edge-cases`](audit-examples.md#step-5b-signal-edge-cases).

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

Worked example: see [`audit-examples.md#step-5b-cross-link-example`](audit-examples.md#step-5b-cross-link-example).

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

Worked example (12-candidate ranking walkthrough): see
[`audit-examples.md#step-5b-saturation-cap-example`](audit-examples.md#step-5b-saturation-cap-example).

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

**Do NOT propose group membership solely because of:**
- **Slug-prefix coincidence** — the candidate's slug happens to share a directory-name token
  with the group (e.g. "decision-tree") without the candidate actually covering that group's
  sub-domain.
- **Same tag, orthogonal concerns** — the candidate shares a tag prefix with the group while
  addressing an unrelated aspect of that domain.

Worked anti-pattern illustrations + a full group-affinity walkthrough: see
[`audit-examples.md#step-6-group-affinity-examples`](audit-examples.md#step-6-group-affinity-examples).

**When a candidate fits an existing group:** change the action from `PROMOTE` to `PROMOTE`
with `Target: {group}/{slug}.md` in the Section Decomposition table. Emit a note in the
Detail column explaining the group-affinity rationale.

### Step 7 — Build plan header (5-line summary)

Emit five fields verbatim (no extra prose):

```
state: {state from verdict}
triggers: {comma-separated reason codes from verdict}
files-accounted: {count of all files enumerated in Step 2}
pages-current: {count of existing *.md sibling pages excluding SKILL.md and schema.md}
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
| `DELETE` | File removed — an orphan matching the stale-draft heuristic (Step 1d), or a retired operations log |
| `PATCH` | In-place fix: tag prefix, frontmatter (including the `wiki: true` declaration), dangling entry removal |

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
the skill folder (e.g., `LOCALAPPDATA=C:\Users\...` and the project on `D:\`), a system-temp-dir
placement for `$TMP_PLAN` could land on a different volume than `${AUDIT_DIR}`, making `mv`
non-atomic — this is exactly why the write pattern above already creates `TMP_PLAN` inside
`${AUDIT_DIR}` (same volume as the destination) instead of using the system temp dir.

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

**This six-line block is a caller contract and does not move.** It is emitted first, in this
order, in every mode. `--fix` appends its dispatch and re-run output *after* it (Steps 12–13),
and `--all` emits one such block per domain with findings — so a caller reading the sixth line of
a single-skill invocation reads the same thing it always did. Anything added to audit's stdout is
added below these six lines, never above or between them.

---

## The conformance catalog

This is the normative statement of what a conforming wiki looks like, keyed on the exact reason
codes `wiki-health` emits. It is prose on purpose (D13): `--fix` hands it to `wiki-groomer`
verbatim, and there is no mechanical fixer that implements it. **Code strings below match
`wiki-health`'s output exactly — do not paraphrase a code.**

### Identity and adoption

| Finding | What conformance is | Repair |
|---------|--------------------|--------|
| `ADOPTION_CANDIDATE` | The folder declares itself: `wiki: true` in `SKILL.md` frontmatter | Add the declaration **together with** every artifact below that is missing. The key is bare, lowercase and unquoted, a top-level key inside the frontmatter block whose first line is exactly `---`; `wiki: True`, `wiki: "true"`, `wiki: yes`, `wiki:true`, an indented copy and a trailing comment are all rejected by the reader |
| `MDITERC_MISSING` | A `.mditerc` exists | Create it from `protocols/init.md`'s template. The declaration replaced `.mditerc` as the *identity* test; `.mditerc` remains a required conformance artifact |
| `ENTRYPOINT_WRONG` | `.mditerc` carries `entrypoint: SKILL.md` | Correct the entrypoint line |
| `NO_PAGES_HEADING` | `SKILL.md` has a `## Pages` nav section | Scaffold it per `protocols/init.md` and file every knowledge page into it |
| `NO_META_HEADING` | `SKILL.md` has a non-empty `## Meta` section | Scaffold it. **A `## Meta` emptied by removing its last entry is a finding, not a fix** — a domain whose only Meta entry is removed needs the `- [Schema](schema.md) — Wiki conventions and page-type definitions` line, not a deleted heading |

**Adoption is all-or-nothing.** Applying only the declaration to a candidate is the one repair
that leaves the domain worse than it started: an undeclared folder is silently ignored, while a
declared folder missing its artifacts is reported `unhealthy`. Apply the whole set in one pass.

### Retired mechanisms

| Finding | What conformance is | Repair |
|---------|--------------------|--------|
| `LEGACY_LOG_PRESENT` | No operations log on disk. It was retired outright (D3) — `git log` reconstructs everything it held | Delete the file. Then remove its `## Meta` link in the same pass: a deleted target with a surviving relative link fails `mdite lint` and lands the domain back on `MDITE_LINT_FAILURE`. The two edits are one repair, never two |
| `FORBIDDEN_UPDATED_FIELD` | No `updated:` key in page frontmatter — page age is git-derived | Remove the key |
| `DUPLICATE_LAST_VERIFIED` | At most one `last-verified:` key per frontmatter block | Keep the later date, remove the rest. Never guess: if the two dates disagree about what was verified, escalate rather than pick |

### Pages and navigation

| Finding | What conformance is | Repair |
|---------|--------------------|--------|
| `MISSING_SUMMARY` | Every page carries `tags:` and `summary:` | Add the missing field on the page, then re-run `wiki-write --update` on it so the nav entry regenerates and the two agree |
| `TAG_PREFIX_MISMATCH` | Every page's tag prefix matches the one `schema.md`'s fenced `tags:` example declares | Correct the page's tag. If the schema's example is the wrong one, correct the schema instead — and know that removing or unfencing that example does not fix the finding, it disables the check |
| `LISTED_PAGE_MISSING` | Every `## Pages` entry resolves to a file | Restore the page, or drop the entry by regenerating the nav — see the fence rule |
| `ORPHAN_PAGE` | Every page on disk is reachable from `SKILL.md` | File it via `wiki-write` so the nav regenerates, or link it from its group hub's `index.md` (a page body, not a fenced region) |
| `ORPHAN_INDEX_MD` | No top-level `index.md` beside a `## Pages` section | Fold its content into `SKILL.md` and remove it |
| `NAV_SUMMARY_MISMATCH` | A nav entry's text after the ` — ` separator equals the target page's `summary:` | See the fence rule below — this one is never repaired by hand |
| `ARCHIVED_STATUS_MISMATCH` | `status: archived` in frontmatter and a listing under `### Archived` always agree | Add whichever half is missing, or remove both |
| `MISSING_PAGES_FENCE`, `UNBALANCED_PAGES_FENCE` | Every `## Pages` bullet run sits inside `<!-- BEGIN:PAGES -->` / `<!-- END:PAGES -->` | See the fence rule below |

**The fence rule, and it overrides every repair above it.** `SKILL.md`'s `## Pages` bullet run is
a machine-owned region regenerated wholesale by `wiki-write` and delimited by
`<!-- BEGIN:PAGES -->` / `<!-- END:PAGES -->`. **Never hand-edit inside that fence**, including to
repair a finding this catalog names. So: **any repair that changes a `## Pages` bullet is made by
re-running `wiki-write` on the page, never by editing the bullet** — that covers
`MISSING_SUMMARY`, `LISTED_PAGE_MISSING`, `ORPHAN_PAGE` and `NAV_SUMMARY_MISMATCH` alike.

Two of them have no other route at all:

- `NAV_SUMMARY_MISMATCH` — the nav text and the page's `summary:` must agree, and each is written
  by a different hand. Change the page's `summary:` and re-run `wiki-write --update` on it so the
  nav regenerates from the new value. Editing either side alone manufactures the mismatch it was
  meant to clear.
- `MISSING_PAGES_FENCE` / `UNBALANCED_PAGES_FENCE` — the fence itself is malformed; regenerate the
  region with its owning tool.

What is **not** fenced, and may be edited directly: `## Meta`, the `### Topic Areas` /
`### Standalone Pages` / `### Archived` sub-headings, and everything outside the bullet runs. That
is why `ARCHIVED_STATUS_MISMATCH` is repairable by hand and `NAV_SUMMARY_MISMATCH` is not.

If a repair cannot be made without opening a fence, **stop and report it**. An unrepaired finding
that is honestly reported is a good outcome; a hand-edited fence is not.

### Structure

| Finding | What conformance is | Repair |
|---------|--------------------|--------|
| `MDITE_LINT_FAILURE` | `mdite lint` exits 0 for the domain | Fix the reported violations — most often a link whose target moved or was deleted |
| `BODY_WEIGHT_EXCEEDED`, `EXCESSIVE_BODY_SECTIONS` | `SKILL.md` is a navigation hub, not the content | Decompose per Steps 3–6 above. This is the heaviest repair in the catalog and the one most worth confirming with the user first |
| `STAGING_DIR_PRESENT` | No staging directory pending | **Not a repair.** Audit aborts on this (Step 1); a human resolves the pending push |

---

## Applying with `--fix`

`--fix` does not change how anything is detected. It adds three things after the report: a
dispatch, a bounded one, and a second mechanical pass that decides what actually closed.

### Step 12 — Dispatch `wiki-groomer` per affected domain

1. **Print the report first, always.** `--fix` never suppresses the report mode's output; a user
   who sees nothing before the writes begin cannot stop them.
2. **One dispatch per domain with findings, and none for a domain without.** A domain whose state
   is `healthy` or `not-a-wiki` is never dispatched for. Two domains are never merged into one
   dispatch — the agent's context is per domain, and so is the repair.
3. **The dispatch prompt carries context and the catalog, never a paraphrase of either:** the
   domain name, its `wiki-health --json` findings for this run, the plan path, and
   `## The conformance catalog` verbatim. Do not restate the catalog's rules in your own words in
   the prompt — a loose paraphrase competes with the protocol for authority, and the looser
   authority wins.
4. **The dispatch ceiling is 10 domains per run.** Order the affected domains alphabetically and
   dispatch the first 10. This is deterministic, so the same tree defers the same domains.
5. **Report every deferred domain by name — never truncate silently.** Under the ceiling, print:

   ```
   Deferred: {N} domain(s) over the 10-per-run dispatch ceiling — {comma-separated names}
   Re-run `/wiki-memory audit --all --fix` to continue.
   ```

   A run that repaired 10 of 30 domains and said so is a good run. A run that repaired 10 of 30
   and reported success is a broken one.

### Step 13 — Re-run the detector; the second report closes the finding

After every dispatch returns, re-run `wiki-health <skill> --json` for each domain dispatched and
diff the reason codes against the first run.

**The agent's report is not evidence a finding closed.** An agent can return success over an
unchanged file, and only the mechanical detector can tell the difference. A finding is closed when
and only when it is absent from the second verdict.

Emit, per domain:

```
{skill}: {N} finding(s) → {M} remaining   [closed: CODE, CODE | still open: CODE]
```

A finding still open after a dispatch is reported, not retried in a loop. Re-dispatching the same
agent against the same unchanged finding is how a fix loop spins; a human reads the second report
and decides.

---

## Fleet mode (`--all`)

`audit --all` runs the whole protocol once per **declared** domain — every skill folder whose
`SKILL.md` carries `wiki: true`. Three properties, all of which follow from the detector:

- **Undeclared skills are absent, not passed.** A `not-a-wiki` state produces no row, no finding,
  and no mention. A fleet of declared domains plus a hundred deliberately monolithic skills
  reports on the declared domains alone.
- **Adoption candidates appear as candidates.** An undeclared folder with a structural signal is
  listed under `ADOPTION_CANDIDATE` with its signals, in its own section of the report, separate
  from the domains that are broken. Being adoptable is not being unhealthy.
- **One plan file per domain with findings**, at the same per-skill `%TEMP%` path. Domains with no
  findings write no plan.

Emit a fleet summary after the per-domain rows:

```
Fleet audit: {N} declared domains — {N} healthy, {N} with findings, {N} adoption candidates.
```

---

## Action code reference summary

The full action-code list with meanings is defined once, in Step 8's `## Files` table
action-code list above (`KEEP`, `CREATE`, `DECOMPOSE`, `PROMOTE`, `SPLIT`, `MERGE-INTO`,
`CROSS-REFERENCE`, `ORPHAN-LINK`, `DELETE`, `PATCH`) — not repeated here.
All codes are planning-time only in report mode — audit itself writes no skill-folder file in
either mode. Under `--fix` they are the instructions `wiki-groomer` applies, and the agent is
what writes.

---

## Per-state behavior summary

| State | What audit focuses on |
|-------|----------------------|
| `not-a-wiki` | **Nothing.** Undeclared and no structural signal — audit says nothing about it, and `--all` omits the row |
| `new` | An **adoption candidate** (`ADOPTION_CANDIDATE`): reported with its signals as adoptable, never as broken. Step 1c lists the full conformance gap — declaration plus any missing artifact — because adoption is all-or-nothing (D17). Promotion candidates receive `PROMOTE` where there are no pages to merge against; orphan detection is skipped |
| `partial-migration` | Enumerates existing sibling pages AND trapped SKILL.md body; applies merge intelligence; fixes D34 placement violation if present; Step 1d orphan detection runs |
| `unhealthy` | Targets lint failures, schema violations, dangling entries, tag-prefix mismatches, a retired operations log still on disk, and duplicate `last-verified` keys; **Step 1d orphan detection runs** and overrides `KEEP` with `ORPHAN-LINK`/`DELETE` for graph-unreachable files; body decomposition only if body weight also exceeds threshold |
| `healthy` | Exit immediately — no plan generated |

---

## Example plan output

A full worked example of the plan file shape (5-line header + `## Files` table + `## Section
Decomposition` table) is available on demand: see
[`audit-examples.md#example-plan-output`](audit-examples.md#example-plan-output).
