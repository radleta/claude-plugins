---
description: "Manage wiki-backed domain knowledge — init, ingest, lint, query, show, health, audit, migrate, consolidate, and groom domains"
argument-hint: "[init|ingest|lint|query|show|health|audit|migrate|consolidate|groom] [domain] [args]"
---

Use the Skill tool to load the `wiki-memory` skill, then execute the requested operation.

The skill parses the first word as the operation and dispatches accordingly:

| Command | Example |
|---------|---------|
| `init <domain>` | `/wiki-memory init billing-data` |
| `ingest <domain>` | `/wiki-memory ingest billing-data` |
| `lint <domain>` | `/wiki-memory lint billing-data` |
| `query <domain> <question>` | `/wiki-memory query billing-data "How does DynamoDB indexing work?"` |
| `show [domain]` | `/wiki-memory show` or `/wiki-memory show billing-data` |
| `health <skill> [--all]` (read-only) | `/wiki-memory health winforms-expert` — invoke `wiki-health <skill>`; returns one-line state (`healthy`/`not-a-wiki`/`new`/`partial-migration`/`unhealthy`); writes nothing to the working tree; no LLM cost. A skill that has not declared itself with `wiki: true` reports `not-a-wiki`, and `--all` omits it from the fleet sweep entirely |
| `audit <skill> [--fix] [--all]` (read-only; mutating with `--fix`) | `/wiki-memory audit winforms-expert` — run `wiki-health <skill> --json` → walk `protocols/audit.md` consuming the JSON verdict → print the six-line summary (`state`, `triggers`, `files-accounted`, `pages-current`, `pages-proposed`, `Plan:`) and write the plan outside the repository, so a report run leaves `git status` unchanged. A `healthy` or `not-a-wiki` skill emits a single line and no plan. `--fix` prints the report first, then dispatches `wiki-groomer` per affected domain to apply the conformance catalog, then re-runs the detector — the second report, not the agent's word, is what closes a finding. `--all` covers every declared domain |
| `migrate <skill>` (mutating) | `/wiki-memory migrate winforms-expert` — run the 8-step apply sequence from `protocols/migrate.md`; report the state transition on success; report failure details and retain the audit plan for diagnosis if post-state ≠ healthy |
| `consolidate <target> <source...> [--dry-run]` (mutating) | **DISABLED — pending migration (D-PLAN-10).** `/wiki-memory consolidate csharp-expert winforms-expert cominterop-expert` — merge N source skills into target wiki atomically; rewrites cross-references and updates plugin manifest |
| `groom <domain> [--all]` (mutating) | `/wiki-memory groom winforms-expert` — dispatches the `wiki-groomer` agent for Tier-2 semantic maintenance (full semantic lint, contradiction scan, supersession rewrites); manual-only and never auto-runs — nothing recommends it unasked, and the `large-drift` signal reaches you only inside a `lint` or `audit` run you asked for; `--all` runs a deliberate fleet-wide pass across every declared domain |

If no arguments or unrecognized command: show the operations table and prompt for a command.

**Groom dispatch discipline:** when dispatching `wiki-groomer` for the `groom` row above, the
dispatch prompt carries context only — domain name, current HEAD/commit state, the escalation
`learned/drift-*.md` path when resuming a prior escalation, and any known steady-state signals
this session has already confirmed (so the agent doesn't waste a pass re-flagging them).
Methodology comes from the wiki-grooming skill; the dispatch prompt adds context, never rules —
do not paraphrase or restate the protocol's editorial rules in the dispatch. A loose paraphrase
competes with the protocol for authority, and the looser authority wins. The `audit --fix`
dispatch is a different prompt with its own rules — `protocols/audit.md`'s `## Applying with
--fix` requires that one to carry the domain's findings and the conformance catalog verbatim —
so follow that protocol there, not this paragraph.

$ARGUMENTS
