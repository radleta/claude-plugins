---
summary: "convert an existing expert skill to wiki-backed format"
---

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

Before migrating a skill to wiki-backed format, run the shared 4-test heuristic +
naming heuristics + carve-outs (see [wiki-natural-heuristic.md](wiki-natural-heuristic.md)).
Methodology skills produce an over-engineered structure with the same content but more
navigation overhead — migrating them is waste.

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
| `not-a-wiki` | The folder has not declared itself and carries no structural wiki signal, so `audit` says nothing about it and writes no plan (D15/D17). For migrate this is the ordinary starting point, not an error: the skill is adopted in one pass at step 1, then re-classified — see step 1 |
| `new` | An **adoption candidate** (D17): structurally wiki-shaped, but undeclared. Audit proposes the full conformance set — `wiki: true` in `SKILL.md` frontmatter, `.mditerc`, `schema.md`, `## Pages`, `## Meta` — plus decomposition of whatever body is trapped in `SKILL.md`; no existing pages to merge against; section keep-vs-promote heuristic applied fresh |
| `partial-migration` | Audit enumerates existing sibling pages AND trapped SKILL.md body; applies page-merge intelligence (MERGE-INTO vs PROMOTE-NEW) for each body section; fixes D34 placement violation if present |
| `unhealthy` | Audit targets specific lint failures, schema violations, dangling-entry removals, tag-prefix mismatches, orphan page cleanup; body decomposition fires only if body weight also exceeds threshold (behaves as partial-migration for that component) |

---

## 8-Step Apply Sequence

### Step 1 — Check current state

```bash
wiki-health <skill>
```

If state = `healthy`: print "State: healthy — no migration needed." and exit (no-op).
Continue when state is `new`, `partial-migration`, or `unhealthy`.

**`not-a-wiki` (exit 2) — the ordinary starting point for a deliberate migration.** Since
identity became the `wiki: true` declaration (D15), a monolithic skill that has never been a
wiki reports `not-a-wiki`, and `audit` deliberately says nothing about such a folder — so step 2
would have no plan to read. Exit 2 covers two different situations; `wiki-health`'s own message
tells them apart:

- `ERROR: skill not found: {skill}` — there is nothing to migrate. Abort with that message.
- `{skill}: not-a-wiki` — the folder exists and has not declared itself. This is precisely what
  `/wiki-memory migrate <skill>` is for, and typing the command **is** the decision to adopt.
  Bring the folder into conformance in **one pass**, writing only what is missing and never
  overwriting existing body content, from the named template blocks in `protocols/init.md`:
  `### Template: SKILL.md` (the `wiki: true` declaration plus the `## Pages` / `## Meta`
  scaffold), `### Template: .mditerc`, and `### Template: schema.md`. Adoption is
  all-or-nothing — a folder that gains the declaration without the artifacts turns a silently
  ignored non-wiki into a loudly broken wiki (audit.md step 1c) — so the declaration lands
  **with** the rest, never ahead of it. If the existing `SKILL.md` opens with anything other
  than a `---` line, it has no frontmatter block to declare in: create one at the top of the
  file before adding the key, because the declaration parser reads only a block whose first
  line is line 1. Then re-run `wiki-health <skill>` and continue from
  step 2 with the state it now reports: a freshly adopted folder whose body is still monolithic
  classifies `unhealthy` or `partial-migration`, and the audit plan built from that state is
  what carries the decomposition.

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

**Caller guard — two states emit no `Plan:` line.** Audit omits it for `state = healthy`
(`State: healthy — no remediation needed.`) and for `state = not-a-wiki`
(`State: not-a-wiki — nothing to audit.`). Before reading the plan path, callers MUST check for
both prefixes — or, more robustly, guard on the **absence of a `Plan:` line** rather than on any
particular state name, which is the form that survives a third such state being added.
Unconditionally reading line 6 of audit stdout fails for either (per audit.md Step 1). Migrate
itself reaches step 2 only for a state that does produce a plan, because step 1 gates on state
first and adopts a `not-a-wiki` folder before it gets here; the guard is stated here because
migrate is the worked example other callers copy.

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

**Payload cleanup is deliberately deferred, not exempt:** unlike the `mktemp` + `trap ... EXIT` idiom used elsewhere, this directory is intentionally NOT removed at the end of Step 4 — Step 5's failure path and the Partial-run recovery section both re-read these same payload files by fixed path (`${TMPDIR:-/tmp}/wiki-migrate/{skill}/{slug}.md`) to retry a failed or interrupted write without re-generating the plan. Deleting them eagerly would break that retry path. Cleanup instead happens once the migration is confirmed complete — see Step 7.

**Meta page (`schema.md`):** Write directly to `.claude/skills/{skill}/` using the Write tool. Do NOT route it through `wiki-write` — `wiki-write` is for knowledge content pages indexed under `## Pages`; Meta pages live under `## Meta`.

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

**A migrate run records itself nowhere inside the wiki.** There is no `APPEND` action and no
operations log to append to — that log was retired outright (D3), and `audit` never emits an
`APPEND` row. The record of a migration is the state-transition line step 7 prints, the plan
file retained under `%TEMP%`, and the commit that lands the run, whose diff shows every page
written and every file removed. Do not invent a per-domain provenance file to carry it: a file
that accumulates one entry per run is the retired log under a new name.

**PATCH rules — what to do per target file:**

When `PATCH` targets `schema.md`: update the tag prefix throughout (all occurrences of the old
prefix in examples or rules text) to the correct `{skill-name}/` prefix. This is the
`WMF-D13` schema correction.

When `PATCH` targets a **page** (any `.md` file other than `schema.md` and `SKILL.md`):
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
- Post-migrate canonical shape: YAML frontmatter (carrying `wiki: true`) → `<role>` stub →
  optional landing prose (retained KEEP sections, ≤30 lines) → `## Pages` → `## Meta`
- **The declaration is what makes the migrated folder a wiki (D15/D20), and its form is exact:**
  `wiki: true`, bare and lowercase, unquoted, a top-level key inside the frontmatter block whose
  first line is exactly `---`. `wiki: True`, `wiki: "true"`, `wiki: yes`, `wiki:true`, an
  indented copy and a trailing comment all fail the test `wiki-health` applies
  (`_wiki_is_declared` in `scripts/wiki-health.sh`) — and they fail it silently, since a
  rejected declaration is indistinguishable from no declaration. A skill that ends a migration
  undeclared is invisible to `/wiki-memory audit` and to every protocol that resolves a domain;
  step 6's post-state check is what catches it, because an undeclared folder cannot report
  `healthy`.
- `## Pages` placement:
  - `END` (after landing prose) when retained body > 30 non-frontmatter/non-role/non-index lines
  - `TOP` (directly after role stub) when SKILL.md becomes thin-wrapper after decomposition
- `## Pages` entries: one entry per promoted page plus all pre-existing sibling pages
  in canonical format: `- [title](file.md) — one-line summary`
  The `[title]` is derived from the page's kebab-cased filename or its canonical `#`
  heading. The post-em-dash text is derived from the page's `summary` frontmatter field
  (universally required per wiki-memory Page Conventions). The `summary` field is the
  authoritative source for `## Pages` index entry text — do not use arbitrary strings.
- `## Meta` entries: always include a `schema.md` link
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
- Migration is confirmed complete — the retry path (Step 5/8, Partial-run recovery) no longer
  applies, so clean up the per-page payload directory now. `{skill}` is the raw
  `/wiki-memory migrate <skill>` argument and is used unvalidated throughout this doc, so it
  must be validated at the point of deletion. Three distinct hazards, all reachable from an
  operator typo or a copy-pasted value:
  - An **empty** value collapses a bare `rm -rf "${TMPDIR:-/tmp}/wiki-migrate/{skill}"` to the
    staging root itself, wiping every in-flight skill's payload directory rather than one.
  - A **`/`- or `..`-bearing** value escapes the staging root entirely.
  - A value containing **`*`, `?`, or `[`** is a *pattern*, not a name, to any glob-interpreting
    matcher such as `find -name` — `-name "*"` matches and deletes every sibling staging
    directory. Note this hazard is specific to glob-interpreting matchers: a plain double-quoted
    `rm -rf` path treats those characters literally.

  Validate the token first, then delete a literal quoted path:
  ```bash
  case "{skill}" in
    ''|*[!a-z0-9-]*)
      echo "refusing payload cleanup: unsafe skill token" >&2 ;;
    *)
      rm -rf -- "${TMPDIR:-/tmp}/wiki-migrate/{skill}" ;;
  esac
  ```
  The `*[!a-z0-9-]*` arm rejects any value containing a character outside lowercase letters,
  digits, and `-`, which covers all three hazards at once without enumerating metacharacters.
  Every skill folder name in this repo already conforms to that shape. The `--` guards against
  a leading-`-` value being read as an `rm` option.
- No further action.

### Step 8 — Failure path (post-state ≠ healthy)

If `wiki-health` returns any non-healthy state (exit 2/3/4/5 — exit 2 here means the
declaration did not land, since a folder that reaches step 6 already exists):
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
