---
name: wiki-memory
description: "Methodology and scripts for wiki-backed expert skills — the page standard every writer applies, the ingest-groom rubric, the whole-domain sweep, and the init, lint, query, audit and status protocols. Use when filing captured knowledge onto a wiki page, grooming or auditing a domain, querying an expert wiki, or creating a new one — even for a quick knowledge capture after a session."
---

The page standard and protocols every wiki writer and the `knowledge-ingestor` follow, and the
scripts that enforce them. Each wiki domain is an editable knowledge base co-located with its own
skill folder, whose SKILL.md is the navigation hub via `## Pages`; this skill is not itself a wiki.
Knowledge about how the scripts behave lives in `wiki-memory-expert`.

**In scope:**
- Wiki protocols: init, ingest-groom, sweep, lint, query, audit, status
- Wiki page management: create, update, cross-reference
- Wiki health: staleness detection, structural lint

**Out of scope:**
- Wiki foundational principles (defer to llm-wiki-expert skill)
- Thin expert skill creation (use `claude-code-expert`, `builders/skill-patterns.md`)
- Plugin publishing (use marketplace-publish)

## Protocols

Read the protocol for what you came to do. Each is the normative copy of its own procedure; this
table is a router and states no rules of its own.

| Intent | Protocol |
|---|---|
| File `learned/` captures onto pages and groom every page each one reaches | `protocols/ingest-groom.md` — also the single home of the rubric below |
| Sweep a whole domain, or run an approved sweep proposal | `protocols/sweep.md` |
| Mine the current conversation for insights and integrate them | Write each as a `learned/` capture per `knowledge-capture` § Capture Heuristic, then `/ingest` |
| Answer a question from a domain, index-first, reading only | `protocols/query.md` |
| Check structural integrity and content freshness | `protocols/lint.md` |
| Produce a conformance plan from a `wiki-health` verdict, and apply it | `protocols/audit.md` — its worked examples are `protocols/audit-examples.md`, read where `audit.md` points at one |
| Report pending captures and fleet health | `protocols/status.md` |
| Create a new wiki-backed skill folder | `protocols/init.md` |
| Decide whether a subject is wiki-natural at all | `protocols/wiki-natural-heuristic.md` |

**What binds every writer:** [`page-standard.md`](page-standard.md) — the determination table, the
evidence rule and the page rubrics. Read it before deciding what a page may hold.

**Who writes:** `knowledge-ingestor` is the agent that grooms pages. `/ingest` dispatches it on
demand; `/brainstorming`, the build's `project-lead`, `/discovery` and `/close-issue` dispatch it
at their workflow boundaries through `knowledge-capture` § Boundary Ingest. `/wiki-status`
reports without dispatching anything, and `/wiki-init` creates a domain.

**Health:** `wiki-health <skill>` classifies one domain and `--all` sweeps the fleet, writing
nothing. `--full` adds the deep-audit pass (cross-link scan and group affinity) on
structurally-healthy skills and downgrades to `partial-migration` when candidates are found; it is
also valid as `wiki-health --all --full`. `wiki-health` has no dead-link check of its own — it
delegates to `mdite` and drops the findings — so `mdite lint --entrypoint SKILL.md` inside the
domain folder is what proves links resolve. How the scripts behave inside — `wiki-write`'s modes and
refusals, what a `wiki-health` verdict does not prove, `churn-check`, `wiki-fence-migrate` and the
test suites — is [`wiki-memory-expert`](../wiki-memory-expert/SKILL.md).

## Wiki Domain Structure

A wiki-backed skill folder:

| File | Purpose |
|------|---------|
| `SKILL.md` | Navigation hub: YAML frontmatter + `## Pages` (page links + one-line summaries) |
| `schema.md` | Wiki conventions: page types, naming rules, frontmatter requirements |
| `.mditerc` | mdite config: `entrypoint: SKILL.md` |
| `*.md` | Knowledge pages — flat siblings alongside SKILL.md |

**Wiki declaration.** A skill folder is a wiki domain only when its `SKILL.md` frontmatter says
`wiki: true` — bare, lowercase and unquoted, at the top level of the frontmatter block whose first
line is exactly `---`. That is the only identity test: `wiki-health` reads it
(`_wiki_is_declared` in `scripts/wiki-health.sh`) and nothing else, and a folder that does not
declare itself is not reported at all, so a malformed declaration fails silently. The declaration
key set is closed:

| Key | Required | Meaning |
|-----|----------|---------|
| `wiki: true` | yes | This skill folder is a wiki domain |
| `tags-prefix:` | no | The tag namespace this domain's pages use |
| `audit-skip:` | no | Check IDs this wiki intentionally deviates on, so the audit reports the deviation as declared rather than as a finding |

Only `wiki: true` is read today; the tag prefix is still derived from the fenced `tags:` example in
the domain's `schema.md`. Adding a key is a design change, not an implementation detail: no
free-text key, no append-shaped key, no timestamp, and no record of which maintenance has run,
because a declaration that accepts those becomes an operations log under a new name.

## Page Conventions

Every wiki page (except SKILL.md, schema.md, .mditerc, protocols/*.md) requires YAML frontmatter. Protocol files are dispatch targets — they are read by command/skill orchestrators directly, not surfaced via index navigation.

```yaml
---
tags: [domain/subtopic]
summary: "One-line description"
---
```

- **Page voice**: Pages are timeless present-tense domain knowledge. A page never refers to its own maintenance — edit history, verification events, groom passes, or the process that produced its content. That metadata lives exclusively in `last-verified:` frontmatter and in git history. Test for any sentence: would it be here if the page had been written correctly on day one? Domain history is content only where a reader still meets it: behavior the system still shows, such as a legacy format it still reads, or a decision's `not Y` (the [`design-record`](../design-record/SKILL.md) line); what the system used to do and no longer does, when a gap closed, and which commit landed a behavior are not. Page-maintenance history (what an editor did to this page, and when) never is. This rule binds every writer — ingest, query filing, the ingestor's corrections and sweeps, ad-hoc fix passes.
- **tags**: `domain/subtopic` (e.g., `billing-data/dynamodb`, `mdite/config`). `tags` and `summary` are required on every create and `--update`; `wiki-write` validates both.
- **summary**: One-line description — used in `## Pages` index entries (universally required)
- **Staleness — two distinct signals, do not conflate them**:
  - **`updated:` (edit-time) — FORBIDDEN.** Page age is read from `git log -1 --format=%ad -- <file>` or filesystem mtime, never from a YAML field. Do not add an `updated:` field to new pages — it is git-derivable and redundant.
  - **`last-verified:` (verification-time) — ALLOWED, quoted YAML string only.** Tracks when a page was last confirmed against current code/knowledge truth — a deep-confirm ran clean, or a drift correction was applied — NOT when the page text was last edited. This is NOT git-derivable: a page can be edited without being re-verified, and re-verified without being edited. `wiki-write` requires the value to be a quoted YAML string (e.g. `last-verified: "2026-07-11"`); a bare date parses as a JS `Date` in the mdite frontmatter query and silently returns `[]`. `wiki-write` never auto-quotes a bare value — it rejects the payload (exit 2) and the caller constructs the quoted form itself. Written only on substantive verification events (a clean deep-confirm, or an applied drift correction); ordinary reads and edits never bump it.
- **`page-kind:` — fleet-wide, three values, absent means `reference`.** Declares which rubric in [`page-standard`](page-standard.md) binds the page: `reference` (the full rubric), `map` (nav rules only), or `procedure` (citation of factual claims only). `wiki-write` validates it beside `tags:` and `summary:` and exits 2 on any other value — a typo must not silently fall back to `reference`, because the fallback is what the rubric binds on. The gate is skipped in `--append-section` mode along with the rest of frontmatter validation, so a page reached only that way keeps whatever kind it already stored until its next `--update`. **This field is fleet-wide and a per-domain `schema.md` cannot redefine it or its default** — unlike the per-domain fields below. Adding a value is a design change, not an implementation detail. The gate binds pages routed through `wiki-write`; `protocols/*.md` are written directly and carry the field by convention rather than by enforcement; a group `index.md` hub is written through `wiki-write {domain} {group}/index` like any page.
- **Per-domain fields**: `schema.md` in each skill folder is authoritative for additional required frontmatter fields beyond `summary` (e.g., domain-specific tags taxonomy, extra metadata). A domain's `schema.md` gains a `last-verified` mention only the first time a page in that domain actually receives the field (just-in-time, at the write that introduces it) — not as a pre-emptive bulk sweep across all domains.
- **Linking**: Standard markdown links (`[Page](page.md)`), not wikilinks
- **Citations**: the form is [`page-standard.md` `## Citations`](page-standard.md). A legacy `code-cites:` array is tolerated on an existing page and never written on a new one; churn and freshness checking read the union of it and the in-prose links (AD9).
- **Naming**: Kebab-case filenames, descriptive, no numbering prefixes
- **`## Pages` entries**: One-line format: `- [title](file.md) — one-line summary` (no bold wrappers, no nested bullets, no multi-line descriptions). The summary text after the ` — ` separator must exactly match (whitespace-normalized) the target page's frontmatter `summary:` field — `wiki-write`'s `## Pages` updater constructs new entries this way by default (copying the payload's `summary:` field verbatim), and `wiki-health`'s `NAV_SUMMARY_MISMATCH` check catches drift when either side is later hand-edited without the other. The bullets sit inside a `<!-- BEGIN:PAGES -->` / `<!-- END:PAGES -->` marker fence that `wiki-write` regenerates on every write that reaches the nav, rewriting each bullet's summary from its page — a bullet enters on a create and leaves only through `--remove`, `--rename` or `--hub-sync` ([`pages-nav`](../wiki-memory-expert/pages-nav.md)); sub-headings and `## Meta` stay outside it as human curation (convention: [`marker-fenced-regions-convention`](../claude-code-ref-expert/marker-fenced-regions-convention.md)).
- **Grouped pages**: a page at `{group}/{leaf}.md` is listed in `{group}/index.md` `## Pages` as `- [title]({leaf}.md) — {summary}`, and nowhere in `SKILL.md`. `SKILL.md` `## Pages` lists each group hub as `- [title]({group}/index.md) — {index summary}`, beside the root pages. A group index's `## Pages` list is unfenced: `wiki-write` edits it bullet by bullet on create, `--update`, `--remove` and `--rename` of a grouped page, and refuses to create a grouped page, or rename one into a group, whose index is missing or has no `## Pages` heading. `wiki-write {domain} --hub-sync` brings a domain's nav into this convention.
- **No archive**: the wiki keeps no archived pages, and git holds the history. An obsolete page is removed by the `retire` determination in [`page-standard.md`](page-standard.md); a `### Archived` section still present in a domain is groomed on contact, as `protocols/ingest-groom.md` describes.
- **`## Pages` sub-sectioning**: when a flat `## Pages` list stops reading — group hubs and
  top-level leaves blur together — split it into two sub-sections, so the agent can tell navigation
  hubs (load to navigate further) from terminal leaves (load to read final content):
  - `### Topic Areas` — list group hub pages only (e.g., `core-principles/index.md`)
  - `### Standalone Pages` — list top-level leaf pages not grouped into a subdirectory
  Otherwise keep a flat list. The choice is the ingestor's judgment, not a count. `wiki-write`
  keeps whichever layout it finds; the sub-sections are added by hand in `SKILL.md`, outside the
  fenced bullet run.

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
- **`wiki-write --from` never deletes its payload file** — the payload is only read (copied to an internal tmpfile, then atomically renamed into place); the caller-supplied `--from` file is left on disk after a successful write, by Unix-tool design. Callers (protocols, agents, ad-hoc invocations) should write payloads under `scratch/{project}/` and explicitly clean them up after a successful write (`wiki-write ... --from "$payload" && rm -f "${payload:?}"`), or scope the payload to a `mktemp` path with a `trap 'rm -f "${payload:?}"' EXIT` so cleanup happens automatically. Left unmanaged, payload files accumulate as clutter on long workstreams.
