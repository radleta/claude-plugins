---
summary: "merge N source skills into a target wiki atomically"
---

# Consolidate Workflow

> **DISABLED:** `/wiki-memory consolidate` is disabled pending migration of the staging-based write pipeline to `wiki-write`; do not invoke until migrated. The multi-page atomic write pattern required for this migration has not yet been designed. See the wiki-investigator migration waiver decision (D-PLAN-10) for the rationale.

`/wiki-memory consolidate [--dry-run] <target-skill> <source1> [<source2> ...]`

Merge N source skills into one target wiki atomically. Handles all destructive work:
decomposes source SKILL.md bodies, routes content as pages into the target wiki, rewrites
cross-references across `.claude/`, updates plugin manifests, deletes source folders, and
self-verifies post-state. Replaces the need to run migrate individually on each source skill
when the goal is consolidation into one target.

**Cross-reference rewrite scope.** Only two categories of cross-reference are rewritten:
(a) `skills:` field array values in YAML frontmatter, and (b) `## Pages` markdown link
targets. Prose mentions of skill names inside documentation bodies are NEVER rewritten — they
retain meaningful original-name context.

**Shell entry point invariant.** Any shell script invoked by this protocol must open with
`set -euo pipefail`. All rollback steps (e.g., `git checkout`, `git rm`) run under strict
mode — any failed rollback halts with a non-zero exit rather than silently continuing.

**Pre-flight dependency guard.** Before the audit phase runs, verify that `wiki-health`
and `mdite` are on `$PATH`. This is a defense-in-depth backup to the one-time
pre-Phase-2 guard documented in the project plan — the pre-flight check does not replace it,
but it does ensure any ad-hoc invocation fails fast with a descriptive error rather than failing
mid-pipeline. **Re-entry points** (steps 5, 6, 8, 9) skip step 1 — the pre-flight guard runs
only on the initial invocation, not on retry loops started mid-pipeline.

**Per-source concurrency constraint.** Never run two concurrent consolidate operations against the same source skill. Consolidate of
different target skills can run concurrently provided their source sets do not overlap.

---

## Per-mode code paths

| Mode / condition | What consolidate does |
|---|---|
| `--dry-run` | Run audit phase only; emit Audit Report to stdout (see below); no writes, no deletes; exit 0 on success |
| Destructive run (no flag) | Run full pipeline: audit → decompose → page-router → write pages → cross-ref rewrite → manifest update → wiki-health verify → source cleanup; exit 0 on success |
| Idempotency case A — target healthy + sources absent | "no-op: target wiki already healthy, sources already absorbed"; exit 0 immediately |
| Idempotency case B — target healthy + sources still present | Unresolvable collision: target cannot be modified while sources are still live; exit 2 with message to stderr and audit report noting the collision |

The target wiki's pre-state (new / partial-migration / unhealthy / healthy) affects the
pre-flight check but does NOT alter the pipeline execution path. The pipeline operates on the
target wiki regardless of its pre-existing page count or health state — page-merge intelligence
is handled by the Decompose + Page-Router stage.

---

## 9-Step Apply Sequence

### Step 1 — Pre-flight dependency check

```bash
# Verify required binaries
for bin in wiki-health mdite; do
  command -v "$bin" >/dev/null 2>&1 || {
    echo "ERROR: missing dependency: $bin not on PATH" >&2
    exit 1
  }
done
```

Verify `wiki-health` and `mdite` are on `$PATH` (the installed binary name
is `wiki-health`, not `wiki-health.sh`). If any is missing, print
`ERROR: missing dependency: <binary> not on PATH` to stderr and exit 1 immediately.
Do not proceed to the audit phase until all dependencies are confirmed.

**Re-entry note:** This step runs only on the initial invocation. When re-entering after an
interruption at a mid-pipeline step (e.g., step 5, 6, 8, or 9), skip directly to that step —
do NOT repeat step 1 or step 2 on retry loops.

Also validate the argument list:
- Fewer than 2 positional args → print usage to stderr, exit 1
- Unknown flag token (e.g., typo of `--dry-run`) → print `ERROR: unknown option: <token>` to stderr, exit 1

### Step 2 — Check idempotency state

```bash
wiki-health "$target_skill" --json
```

Read the target wiki's current health state. If state is `healthy`:
- Check whether any source skill folder still exists on disk.
- If sources are ALL absent → print `no-op: target wiki already healthy, sources already absorbed` to stdout; exit 0 (Idempotency case A).
- If ANY source folder still exists → halt with exit 2 (Idempotency case B — sources not deleted, target not modified). Emit audit report noting the collision so the operator can inspect.

Continue to step 3 only when the target is not yet in a stable consolidated state.

### Step 3 — Run the audit phase

Execute the audit phase — a read-only sweep that enumerates everything that will change
before any write occurs. This step runs identically for `--dry-run` and the destructive run.

**Audit inputs:**
- Source skill folders: read all `SKILL.md` files and sibling page files
- Cross-reference inventory: `grep -rln` across `.claude/{agents,commands,skills,templates}`
  for each source skill name (matches only in `skills:` YAML arrays and `## Pages` link targets)
- Plugin manifest references: `grep -rln` across `plugin-manifests/*.json`
- Marketplace flags: read-only scan of `marketplace/` — no writes; flags surface in the audit report for explicit user decision

**Audit output:** Emit the Audit Report Contract structure to stdout (see `## Audit Report
Contract` below for the canonical format, including all six required sub-sections).

**Unresolvable collision handling:** If any collision cannot be resolved automatically (e.g.,
two sources contribute sections with identical meaning and no target-path disambiguation is
possible), the audit halts with exit 2. The collision is surfaced in the `### Page-Name
Collisions` table with `Resolution: MANUAL` in the Resolution column. The operator must
disambiguate before re-running.

**`--dry-run` exit:** After emitting the audit report (including the `ACTION REQUIRED` footer
that is part of the contract structure), exit 0. No writes occur.

### Step 4 — Decompose + Page-Router

Read each source SKILL.md body and sibling page files. Parse into page candidates. Assign
each candidate to a target subdir and filename per topic affinity rules:

**Promotion rule:** Promote a source section to its own page if it has substantive content
(≥ 3 meaningful sub-bullets or paragraphs) AND a coherent standalone topic. Fold short bridge
sections, transition prose, and references-only blocks as inline content into the nearest
topic-affinity existing page. When in doubt: merge into the nearest topic-affinity page rather
than creating a stub.

**Page-name collision resolution:** Prefix with source-skill slug (e.g., `skill-builder-patterns.md`
instead of `patterns.md`) or route to a different subdir. Resolution is recorded in the
page-routing manifest.

**Page-routing manifest:** Produced at the end of this step. Consumed by step 5 for writing.
Schema:

```json
{
  "source_skill": "<skill>",
  "target_skill": "<target>",
  "pages": [
    {
      "source_section": "## Patterns",
      "target_path": "builders/skill-patterns.md",
      "frontmatter": {
        "title": "Skill Patterns",
        "skill": "<target>",
        "tags": ["<target>/builders"]
      },
      "merge_into": null
    }
  ]
}
```

**Subdir index.md constraint:** Every page routed into a subdir MUST be referenced by a relative
markdown link in that subdir's `index.md`. The Page-Router enforces this: any page assigned to a
subdir without a corresponding `index.md` backlink entry is flagged as a routing error before the
manifest is accepted.

**index.md authoring rule (the one explicit no-new-content exception):** When the consolidate
operation creates a new subdirectory group, its `index.md` is LLM-authored synthesis. This is the
only case where new content is authored rather than preserved. Required frontmatter:

```yaml
---
tags: [<target-skill>/<group-slug>]
summary: 'Group hub for <group-name> pages'
---
```

The `## Pages` section of the new `index.md` lists relative links to all sibling pages in that
subdir. The body is a brief (1-3 sentence) synthesis of what this group covers — not copied from
any source.

**`## Pages` hub block emission:** When the page-routing manifest is finalized, the Page-Router
emits the canonical `## Pages` block for the hub SKILL.md. Sub-sectioning rule (wiki-memory 4+
groups rule):
- If the post-merge layout has ≥ 4 subdirectory groups → split into `### Topic Areas` (subdir-hub
  links) and `### Standalone Pages` (top-level leaf pages). `### Standalone Pages` is emitted ONLY
  when ≥ 1 absorbed-skill page is routed to the wiki root; omit the sub-section entirely when all
  pages land in subdirs.
- If the group count is < 4 → emit a flat `## Pages` list without sub-sections.

The consolidate operation REPLACES the hub SKILL.md `## Pages` block wholesale — any prior
intermediate per-page links are discarded and replaced by the canonical block from the Page-Router.

### Step 5 — Stage the target skill folder

> **Migration pending (D-PLAN-10):** This step previously invoked a staging-pull tool to create a staging directory. That tool has been retired. A replacement multi-page atomic write pattern using `wiki-write` has not yet been designed. This step is a stub pending migration. Do not invoke `consolidate` until this step is replaced.

Write-staging semantics (for migration design reference): the original implementation created a staging directory at `${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/skill-staging/<target>/` with `.origin` and `.snapshot` markers. All subsequent writes targeted the staging directory; the live skill folder was only updated by the push operation in step 9. Stale staging dir recovery: if the staging dir already exists and its `.origin` marker matches the target skill, reuse it; otherwise abort and report the conflict.

**Note:** source skills are read from their live paths (not staged). Only the target wiki is
staged during the write phase. Source folders are deleted in step 9 after the target is verified
healthy.

### Step 6 — Write pages to target staging

For each entry in the page-routing manifest:

| Routing action | Staging operation |
|---|---|
| `PROMOTE` (new page, top-level) | Create `{staging}/{filename}.md` with frontmatter per manifest |
| `PROMOTE` (new page, subdir) | Create `{staging}/{group}/{filename}.md`; create or update `{staging}/{group}/index.md` with `## Pages` backlink |
| `MERGE-INTO` | Append section body to the named existing page in staging; do NOT create a new file |
| `NEW-INDEX` | Create `{staging}/{group}/index.md` as LLM-authored synthesis hub (see step 4 index.md authoring rule) |

After all pages are written, write the hub `SKILL.md` using the canonical `## Pages` block from
the Page-Router (step 4). The hub shape: YAML frontmatter → `<role>` stub → optional retained
landing prose (≤ 30 lines from pre-existing target SKILL.md content) → `## Pages` → `## Meta`.
The hub's frontmatter must carry `wiki: true` — the target wiki is a wiki because it declares
itself (D15), and a consolidation that produces an undeclared hub produces a folder every
protocol and the audit will refuse to see.

**`## Meta` entries:** always include a `schema.md` link.

**Partial-run failure (mid-page-write, before cross-ref rewrite begins):**
If a failure occurs after some pages have been written but before cross-reference rewrite starts:
- Automated (under `set -euo pipefail`): the shell exits non-zero; staged pages are present but
  no live files have changed.
- Recovery: (a) delete any target pages already written via explicit `rm` on the staging path;
  source folders are NOT deleted. (b) Re-enter from step 5 on retry.

### Step 7 — Rewrite cross-references

For each file in the cross-reference inventory from step 3:

**Rewrite rule:** Only these two categories are rewritten:
1. `skills:` YAML field array values — replace `- <source-skill>` with `- <target-skill>`
2. `## Pages` markdown link targets — replace `(<source-skill>/...` or `[<source-skill>]` links
   with the equivalent target-skill paths

Never rewrite prose mentions of source skill names. Prose retains meaningful original-name context.

**Partial-run failure (mid-cross-ref rewrite):**
Two-step rollback (both steps are REQUIRED — `git checkout` alone does not remove newly created
files):
1. Revert all cross-reference edits: `git checkout .claude/{agents,commands,templates,skills}`
   **Warning:** This reverts the full working tree of those four directories — not just the
   files the cross-ref rewrite touched. If other concurrent changes exist in those directories
   (from a different process or parallel agent), they will be discarded too. Prefer passing
   explicit file paths from the cross-reference inventory when the inventory is available.
2. Delete new target pages already written: `git rm --force <each new page path>` (or explicit
   `rm` if not yet git-tracked)

The distinction between exit code 2 and exit code 3 is preserved in rollback:
- Exit 2 (collision detected in audit) — no writes have occurred; no staging to preserve.
  Rollback is trivially complete.
- Exit 3 (post-merge wiki-health failure) — writes DID occur; staging is preserved for
  inspection. Source folders are NOT deleted. Operator diagnoses from staging + backup.

### Step 8 — Update plugin manifest

Edit `plugin-manifests/` to replace references to absorbed source skills with the target skill.
This is a single-file edit per affected manifest. Runs after cross-reference rewrite is complete.

**Partial-run failure (manifest update fails):**
Under `set -euo pipefail`, the shell halts. The manifest file is the only file affected in this
step. Recovery: restore the manifest from git checkout:
```bash
git checkout plugin-manifests/<file>.json
```
Source folders remain intact (not yet deleted). Re-enter at step 8 on retry.

### Step 9 — Verify and complete

```bash
wiki-health "$target_skill"
```

Parse the state from stdout.

**Success path (state = healthy):**
1. Carry the page-routing manifest from step 4 into this run's report, so provenance of
   source section → target page routing is traceable post-merge. Report line format:
   ```
   consolidate | <N> sources → <target>: <M> pages written
   <page-routing manifest inline or as attached reference>
   ```
   The durable record is the commit that lands the merge — its diff shows every page written
   and every source folder removed. Do not write the manifest into a file inside the wiki:
   the operations log it used to land in was retired (D3), and re-creating it under another
   name rebuilds exactly what that retirement removed.
2. Push staged target wiki to live. (**Migration pending (D-PLAN-10):** This step previously invoked a staging-push tool to atomically promote the staging directory to the live skill folder. Replacement write pattern not yet designed — see disable note at top of this file.)
3. Delete the source skill folders (irreversible). Run only after the push step exits 0.
   **Validation required:** Before executing `rm -rf`, verify `$source` is a non-empty string
   matching `[a-zA-Z0-9_-]+` (no path separators, no empty value). A missing or traversal-
   containing value would direct `rm -rf` at an unintended directory:
   ```bash
   [[ "$source" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo "ERROR: invalid source slug: $source" >&2; exit 1; }
   rm -rf ".claude/skills/$source"   # repeat for each source
   ```
4. Emit success stdout:
   ```
   Consolidated <N> sources into <target>; <M> pages written; <K> cross-references rewritten; <L> source folders deleted.
   ```
   Exit 0.

**Failure path (state ≠ healthy):**
1. Print: `Migration verification failed for <target>: post-state = <state>` to stderr
2. Print reason codes from `wiki-health <target> --verbose`
3. Source folders are NOT deleted. Staging directories remain for debug.
4. Exit 3.

Operators diagnose using the staged content and the backup at
`${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/skill-backups/<target>-<ts>/`.

---

## Exit Codes

| Code | Condition |
|---|---|
| `0` | Success: destructive run completed cleanly; OR `--dry-run` completed cleanly (audit only); OR idempotency case A (target healthy, sources already absent — no-op) |
| `1` | Fatal: invalid argument count; OR missing dependency binary (`wiki-health`, `mdite` not on `$PATH`); OR source skill not found or unreadable during `--dry-run`; OR unrecognized flag token — error format `ERROR: unknown option: <token>` to stderr |
| `2` | Audit halted: unresolvable page-name collision detected (requires manual resolution before destructive run); OR re-run with sources still present and target already healthy (idempotency case B) |
| `3` | Post-merge `wiki-health <target>` not healthy — source folders NOT deleted; staging and backups preserved for debug |

---

## Audit Report Contract

Both `--dry-run` and the destructive run's pre-write gate emit this structure to stdout.

```
## Audit Report: consolidate <target> <source...>

### Source Inventory
| Skill | State | Pages | Sibling files |
|-------|-------|-------|---------------|
...

### Page-Name Collisions
| Source skill | Section | Proposed target path | Resolution |
|---|---|---|---|
...  (empty table body if no collisions)

### Cross-Reference Inventory (.claude/)
| File | Matched skill name | Proposed replacement |
|---|---|---|
...

### Plugin Manifest References
| File | Matched skill name | Action |
|---|---|---|
...

### Marketplace Flags (read-only — requires manual user action)
| File | Matched skill name | Note |
|---|---|---|
...

### Proposed Target Wiki Structure
<tree of target skill directory after merge>

---
ACTION REQUIRED (dry-run only): Review above and run without --dry-run to proceed.
```

The `---` separator and `ACTION REQUIRED` footer are part of the emitted audit report structure
when `--dry-run` is active. In destructive run mode, the footer is omitted and the pipeline
proceeds directly to step 4.

**Sub-sections required:** Source Inventory, Page-Name Collisions, Cross-Reference Inventory,
Plugin Manifest References, Marketplace Flags, Proposed Target Wiki Structure. All six must be
present even if their table bodies are empty.

**Marketplace Flags:** The `marketplace/` subrepo cross-references are NOT auto-rewritten by
consolidate (separate git history; published artifact). They are flagged here for explicit user
decision. The operator must manually update `marketplace/` after Phase 2 completes.

**Proposed Target Wiki Structure note:** informational only. The authoritative post-merge
structure is defined by the page-routing manifest (step 4), not the audit tree.

---

## Rollback Reference: All 4 Mid-Pipeline Failure Points

| Failure point | Automated (set -euo pipefail) | Manual operator recovery |
|---|---|---|
| **Page write partial** (step 6, before cross-ref rewrite) | Shell exits non-zero; staged pages present; no live files changed | (a) Delete staged pages: `rm` on staging path; (b) source folders NOT deleted; (c) re-enter at step 5 |
| **Cross-ref rewrite partial** (step 7) | Shell exits non-zero; some live `.claude/` files may be partially edited | (a) `git checkout .claude/{agents,commands,templates,skills}` — reverts edits (**directory-wide**: discards any concurrent unrelated changes in those dirs; prefer explicit file paths from the cross-reference inventory when available); (b) `git rm --force <each new page>` or explicit `rm` — removes new files (BOTH steps required; `git checkout` does not remove new files) |
| **Manifest update fails** (step 8) | Shell exits non-zero; manifest file partially written | `git checkout plugin-manifests/<file>.json`; source folders NOT deleted |
| **wiki-health verify fails** (step 9) | Exit 3 emitted; push step not called yet OR staging preserved | Source folders NOT deleted; staging (if present) + backup remain for debug |

**Exit code distinction:**
- Exit 2 (collision in audit): no writes occurred; no staging to preserve.
- Exit 3 (post-merge health failure): writes occurred; staging and source folders preserved.

---

## Success Stdout Template

Smoke tests and caller log-parsers assert this line is present on exit 0 (destructive run):

```
Consolidated <N> sources into <target>; <M> pages written; <K> cross-references rewritten; <L> source folders deleted.
```

Example:
```
Consolidated 9 sources into claude-code-expert; 22 pages written; 63 cross-references rewritten; 9 source folders deleted.
```

---

## Partial-Run Recovery

Steps 1–9 are designed to be safe to re-run after interruption. Recovery entry points:

- **Interrupted before step 5 (before staging):** Re-run from the beginning. Audit is read-only
  and safe to repeat. No state was modified.
- **Interrupted during step 6 (page writes):** The staging dir exists. Verify the staging directory is present for the target skill. Re-enter at step 6 — the page-routing manifest produced in
  step 4 is available at `{staging}/.page-routing-manifest.json`. Do NOT re-run step 4
  (Decompose + Page-Router); that would regenerate and overwrite the existing manifest. Use the
  manifest already present in the staging directory.
- **Interrupted after push (step 9) succeeded but source deletion did not run:** The staging
  dir is absent (push deletes it on success). The target wiki is live with merged content.
  Re-run consolidate — step 2 detects target is healthy + sources still present → exits 2
  (idempotency case B). The operator must manually delete the remaining source folders after
  confirming the target is correct, OR re-run without `--dry-run` using a force-cleanup flag
  (not currently implemented — manual deletion is the recovery path).
- **If the staging dir is absent and post-state was not verified:** Re-enter at step 9 — run
  `wiki-health <target>` to verify post-state without re-staging or re-pushing.

---

## See Also

- `protocols/migrate.md` — per-skill single-source migration (the structural template for this document)
