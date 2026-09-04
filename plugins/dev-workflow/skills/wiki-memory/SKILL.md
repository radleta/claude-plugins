---
name: wiki-memory
description: "Wiki-backed knowledge system for expert skills — manages domain wikis with init, ingest, lint, query, show, health, audit, migrate, consolidate, and groom operations. Use when updating domain knowledge, querying experts, initializing new wiki domains, migrating or consolidating skills into a target wiki, or maintaining wiki health — even for quick knowledge captures after a session."
user-invocable: true
argument-hint: "[init|ingest|lint|query|show|health|audit|migrate|consolidate|groom]"
wiki: true
---

<role>
  <identity>Wiki domain knowledge manager for expert skills</identity>
  <purpose>Maintain wiki-backed expert skill knowledge — persistent, compounding knowledge bases built from interlinked markdown. Each wiki domain is an editable knowledge base co-located with its skill folder; SKILL.md is the navigation hub via `## Pages`.</purpose>
  <scope>
    <in-scope>
      <item>Wiki operations: init, ingest, lint, query, show, migrate</item>
      <item>Wiki page management: create, update, cross-reference</item>
      <item>Wiki health: staleness detection, structural lint</item>
    </in-scope>
    <out-of-scope>
      <item>Wiki foundational principles (defer to llm-wiki-expert skill)</item>
      <item>Thin expert skill creation (use claude-skill-builder)</item>
      <item>Plugin publishing (use marketplace-publish)</item>
    </out-of-scope>
  </scope>
</role>

## Operations

Parse `$ARGUMENTS` to determine operation, then Read the protocol file:

| Command | Action | Protocol |
|---------|--------|----------|
| `init <domain>` | Create wiki-backed skill folder via direct mkdir + Write | Read `protocols/init.md` |
| `ingest <domain>` | Extract session insights, update wiki pages + SKILL.md ## Pages | Read `protocols/ingest.md` |
| `lint <domain>` | Run structural lint + content staleness checks | Read `protocols/lint.md` |
| `query <domain> <question>` | Index-first drill, synthesize answer, assess filing value; **may write** a new wiki page when synthesis meets filing-worthiness criteria (WMF-D18) | Read `protocols/query.md` |
| `show [domain]` | List all declared wikis, or show a specific domain index + page summary | Inline below |
| `health <domain>` | Read-only diagnostic: classify a domain and report its findings; `--all` sweeps the whole fleet. Writes nothing to the working tree | Run the `wiki-health` script (`scripts/wiki-health.sh`) |
| `audit <domain> [--fix]` | Maintenance pass: reports conformance findings by default, applies them with `--fix`. The report is written to `${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/wiki-audit/{skill}.md`, outside the repo | Read `protocols/audit.md` |
| `migrate <skill-name>` | Convert existing expert skill to wiki-backed format | Read `protocols/migrate.md` |
| `consolidate <target> <source...> [--dry-run]` | **DISABLED — pending migration (D-PLAN-10).** Merge N source skills into target wiki atomically; rewrites cross-references and updates plugin manifest | Read `protocols/consolidate.md` |
| `groom <domain> [--all]` | Dispatch `wiki-groomer` agent for Tier-2 semantic maintenance (full semantic lint, contradiction scan, supersession rewrites); manual-only and never auto-runs — nothing recommends it unasked, and the `large-drift` signal reaches you only inside a `lint` or `audit` run you asked for; `--all` for a deliberate fleet-wide pass | Dispatches `wiki-groomer` agent (see `wiki-grooming` skill) |

**Health flag:** `wiki-health <skill> --full` runs a deep-audit pass (Step 5b cross-link scan + Step 6 group-affinity) on structurally-healthy skills and downgrades to `partial-migration` when candidates are found. Also valid combined with the fleet sweep as `wiki-health --all --full`, which runs the deep audit for every skill. Use this after protocol evolution or before triggering `/wiki-memory migrate` on a healthy skill.

If no arguments or unrecognized command: show this operations table and prompt for a command.

## Wiki Domain Structure

New-format wiki-backed skill (post-migration):

| File | Purpose |
|------|---------|
| `SKILL.md` | Navigation hub: YAML frontmatter + role stub + `## Pages` (page links + one-line summaries) |
| `schema.md` | Wiki conventions: page types, naming rules, frontmatter requirements |
| `.mditerc` | mdite config: `entrypoint: SKILL.md` |
| `*.md` | Knowledge pages — flat siblings alongside SKILL.md |

## Page Conventions

Every wiki page (except SKILL.md, schema.md, .mditerc, protocols/*.md) requires YAML frontmatter. Protocol files are dispatch targets — they are read by command/skill orchestrators directly, not surfaced via index navigation.

```yaml
---
tags: [domain/subtopic]
summary: "One-line description"
---
```

- **Page voice**: Pages are timeless present-tense domain knowledge. A page never refers to its own maintenance — edit history, verification events, groom passes, or the process that produced its content. That metadata lives exclusively in `last-verified:` frontmatter and in git history. Test for any sentence: would it be here if the page had been written correctly on day one? Domain history (what the SYSTEM used to do, when a gap closed, which commit landed a behavior) is content; page-maintenance history (what an editor did to this page, and when) never is. This rule binds every writer — ingest, query filing, knowledge-ingestor corrections, groom, ad-hoc fix passes.
- **tags**: `domain/subtopic` (e.g., `billing-data/dynamodb`, `mdite/config`)
- **summary**: One-line description — used in `## Pages` index entries (universally required)
- **Staleness — two distinct signals, do not conflate them**:
  - **`updated:` (edit-time) — FORBIDDEN.** Page age is read from `git log -1 --format=%ad -- <file>` or filesystem mtime, never from a YAML field. Do not add an `updated:` field to new pages — it is git-derivable and redundant.
  - **`last-verified:` (verification-time) — ALLOWED, quoted YAML string only.** Tracks when a page was last confirmed against current code/knowledge truth — a deep-confirm ran clean, or a drift correction was applied — NOT when the page text was last edited. This is NOT git-derivable: a page can be edited without being re-verified, and re-verified without being edited. `wiki-write` requires the value to be a quoted YAML string (e.g. `last-verified: "2026-07-11"`); a bare date parses as a JS `Date` in the mdite frontmatter query and silently returns `[]`. `wiki-write` never auto-quotes a bare value — it rejects the payload (exit 2) and the caller constructs the quoted form itself. Written only on substantive verification events (a clean deep-confirm, or an applied drift correction); ordinary reads and edits never bump it.
- **Per-domain fields**: `schema.md` in each skill folder is authoritative for additional required frontmatter fields beyond `summary` (e.g., domain-specific tags taxonomy, extra metadata). A domain's `schema.md` gains a `last-verified` mention only the first time a page in that domain actually receives the field (just-in-time, at the write that introduces it) — not as a pre-emptive bulk sweep across all domains.
- **Linking**: Standard markdown links (`[Page](page.md)`), not wikilinks
- **Naming**: Kebab-case filenames, descriptive, no numbering prefixes
- **`## Pages` entries**: One-line format: `- [title](file.md) — one-line summary` (no bold wrappers, no nested bullets, no multi-line descriptions). The summary text after the ` — ` separator must exactly match (whitespace-normalized) the target page's frontmatter `summary:` field — `wiki-write`'s `## Pages` updater constructs new entries this way by default (copying the payload's `summary:` field verbatim), and `wiki-health`'s `NAV_SUMMARY_MISMATCH` check catches drift when either side is later hand-edited without the other.
- **Archived pages** (AD8): a page carries `status: archived` in frontmatter if and only if it is listed under a `### Archived` subsection nested under `## Pages` (never a sibling top-level heading) — the two must always agree; a page carrying one without the other is drift. Archive-tier retirement is groom-only (see `wiki-grooming` skill Step 5a); `### Archived` entries may append " (archived)" after the title before the ` — ` separator. `wiki-health`'s `ARCHIVED_STATUS_MISMATCH` check enforces this bidirectionally.
- **`## Pages` sub-sectioning** (4+ groups rule): When a wiki has 4 or more subdirectory groups,
  split `## Pages` into two sub-sections to give the agent visual distinction between navigation
  hubs (load to navigate further) and terminal leaves (load to read final content):
  - `### Topic Areas` — list group hub pages only (e.g., `core-principles/index.md`)
  - `### Standalone Pages` — list top-level leaf pages not grouped into a subdirectory
  When the wiki has fewer than 4 subdirectory groups, keep a flat `## Pages` list (no sub-sections).
  `migrate.md` implements this rule when emitting the post-migration SKILL.md `## Pages` block.

## Show Workflow

`/wiki-memory show [domain]`

**Migration fires only on write-path operations, never read-only.** The show operation reads
both new-format and old-format sources without triggering migration.

### Show all wikis (no domain argument)

**Dual-scope glob (new-format wikis):**

1. Glob `.claude/skills/*/` (project-scoped) for skill folders whose `SKILL.md` declares itself
   a wiki: `grep -q '^wiki: true' .claude/skills/{skill}/SKILL.md` exits 0. The key must be bare,
   lowercase and unquoted, at the top level of the frontmatter block whose first line is exactly
   `---` — `wiki: True`, `wiki: "true"`, `wiki: yes`, `wiki:true`, an indented copy, and a
   trailing comment all fail the same test `wiki-health` applies (`_wiki_is_declared` in
   `scripts/wiki-health.sh`).
2. Glob `~/.claude/skills/*/` (user-scoped) for skill folders with the same declaration test.
3. Merge results from both globs; deduplicate by skill-name (same skill-name in both scopes
   keeps the project-scoped entry as primary; the user-scoped duplicate is labeled `[partial]`
   with a warning).

**Report format per wiki:**

```
{domain}: {title-from-SKILL.md-first-line} ({path})
```

If no entries found: "No wikis found. Use `/wiki-memory init <domain>` to create one."

### Show specific domain

1. Resolve wiki path via convention-based lookup: check `.claude/skills/{domain}/SKILL.md`, then `.claude/skills/{domain}-expert/SKILL.md` (project-scoped); or `~/.claude/skills/{domain}/SKILL.md`, then `~/.claude/skills/{domain}-expert/SKILL.md` (user-scoped). A candidate resolves only if its `SKILL.md` passes the same `grep -q '^wiki: true'` declaration test as step 1 above; an undeclared skill folder is not a wiki and `show` says so rather than reporting it as broken.
2. Read `SKILL.md` and display `## Pages` section + YAML frontmatter title.
3. Summary: page count, and the domain's last change date from `git log -1 --format=%ad -- .claude/skills/{domain}/`. For a health classification the user runs `/wiki-memory health {domain}` — `show` never invokes it.

## Maintaining This Skill

To refine this skill: `/skill-builder refine wiki-memory`. Uses protocol-per-file architecture — keep SKILL.md as lean orchestrator, add new operations as `protocols/*.md`.

## Foundational Principles

This skill handles wiki **operations**. For foundational wiki **principles** (compile-once, human-curates/LLM-maintains, schema evolution, index-first navigation), defer to the `llm-wiki-expert` skill.

Key principles across all operations:
- **Compile once, keep current**: Integrate knowledge during ingest, don't re-derive on query
- **Index-first navigation**: Always read index before drilling into pages
- **Schema evolves organically**: Start minimal, codify patterns after 10-20 ingests
- **Human curates, LLM maintains**: Human directs what to capture; LLM does all bookkeeping

## Gotchas

- **Slug case preservation (CLI verbatim)** — `wiki-write` CLI preserves slug case verbatim: `wikieval-T5-x` stays `wikieval-T5-x`. This is the OPPOSITE of `mcp__scratch-memory__write_issue`, which lowercases. If a downstream consumer compares slugs across both surfaces, normalize at the caller — wiki-write will not coerce case for you. See also `scratch-memory` SKILL.md gotcha for the MCP side.
- **`wiki-write --from` never deletes its payload file** — the payload is only read (copied to an internal tmpfile, then atomically renamed into place); the caller-supplied `--from` file is left on disk after a successful write, by Unix-tool design. Callers (protocols, agents, ad-hoc invocations) should write payloads under `scratch/{project}/` and explicitly clean them up after a successful write (`wiki-write ... --from "$payload" && rm -f "$payload"`), or scope the payload to a `mktemp` path with a `trap 'rm -f "$payload"' EXIT` so cleanup happens automatically. Left unmanaged, payload files accumulate as clutter on long workstreams.

## Pages

<!-- BEGIN:PAGES -->
- [Init Protocol](protocols/init.md) — create a new wiki-backed skill folder from scratch
- [Ingest Protocol](protocols/ingest.md) — extract session insights and integrate them into wiki pages
- [Lint Protocol](protocols/lint.md) — check wiki structural integrity and content freshness
- [Query Protocol](protocols/query.md) — answer questions using wiki knowledge with index-first navigation
- [Migrate Protocol](protocols/migrate.md) — convert an existing expert skill to wiki-backed format
- [Audit Protocol](protocols/audit.md) — consume wiki-health verdict and produce a remediation plan
- [Audit Worked Examples](protocols/audit-examples.md) — worked examples for audit.md's normative rules, referenced on demand to keep audit.md lean
- [Consolidate Protocol](protocols/consolidate.md) — merge N source skills into a target wiki atomically
- [Wiki-Natural Heuristic](protocols/wiki-natural-heuristic.md) — shared 4-test heuristic + naming signals + carve-outs used by init and migrate to decide wiki-backed vs monolithic
- [wiki-cites-groom-v2](wiki-cites-groom-v2.md) — Single-backtick inline code spans bypass churn-check's fence toggle, causing false MISSING hits on illustrative link syntax
- [wiki-write-test-payload-reuse](wiki-write-test-payload-reuse.md) — wiki-write test suites reuse payload files, making them incompatible with consume-on-success changes
- [consume-from-already-rejected](consume-from-already-rejected.md) — A consume-from flag for wiki-write was already proposed and explicitly rejected
- [fence-migration-line-count-interaction](fence-migration-line-count-interaction.md) — Fencing email-campaign-expert crosses wiki-health's 400-line partial-migration threshold
- [em-dash-title-separator-bug](em-dash-title-separator-bug.md) — Em dash in nav title corrupts separator search
- [region-regen-gated-by-written-slug-summary-change](region-regen-gated-by-written-slug-summary-change.md) — Fenced whole-region regeneration only runs when the written slug's own summary changed
- [unguarded-grep-capture-aborts-suite-silently](unguarded-grep-capture-aborts-suite-silently.md) — Unguarded grep captures turn test regressions into silent suite aborts
- [state-gating-check-invalidates-every-pre-invariant-test-fixture](state-gating-check-invalidates-every-pre-invariant-test-fixture.md) — A state-gating check in wiki-health.sh invalidates test fixtures that predate the invariant, requiring intent-aware fixture migration rather than blanket transforms
- [reason-token-lives-in-json-not-verbose](reason-token-lives-in-json-not-verbose.md) — A reason token appears in wiki-health.sh --json only; --verbose assertions are vacuous
- [wiki-write-clobber-guard-refuses-h2-rename](wiki-write-clobber-guard-refuses-h2-rename.md) — The no-silent-section-loss guard refuses an H2 rename, not just content loss
- [health-classification-masks-lower-findings](health-classification-masks-lower-findings.md) — wiki-health reports one classification; clearing the top finding exposes lower pre-existing findings
<!-- END:PAGES -->

## Meta

- [Schema](schema.md) — Wiki conventions and page-type definitions
