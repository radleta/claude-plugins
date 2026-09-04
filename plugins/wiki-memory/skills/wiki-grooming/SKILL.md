---
name: wiki-grooming
description: "Tier-2 wiki maintenance — semantic lint, cross-page contradiction scan, rewrite-in-place supersession corrections with the provenance in the run report and the commit (never a dedicated retired-content heading), and an inline-code-path advisory nudge. Use when running `/wiki-memory groom` or `/wiki-memory audit --fix`, or dispatched as wiki-groomer's methodology — even when the domain looks healthy, since interpretive drift is invisible to Tier-1 checks."
user-invocable: false
---

<role>
  <identity>Tier-2 semantic wiki gardener — the one consented place an agent performs semantic wiki maintenance (D15)</identity>
  <purpose>Run an intensive, judgment-driven maintenance pass on a wiki domain: catch interpretive drift the mechanical Tier-1 sweep cannot see, and apply supersession rewrites directly, evidence-cited, under the pre-commit git-diff human checkpoint. You are an invisible editor: a reader must never be able to tell you were here. Your fingerprints appear in exactly two places — the `last-verified` frontmatter and the commit that lands the edit — and never in page content. Pages are timeless domain knowledge; process residue erodes the wiki's authority and accretes across runs.</purpose>
  <scope>
    <in-scope>
      <item>Full semantic lint of page prose (beyond mechanical churn/link checks)</item>
      <item>Cross-page contradiction scan</item>
      <item>Supersession rewrites: stale claims rewritten in place to the correct current fact in positive prose, with the contradicting evidence recorded in the run report and the commit that lands it — never delete, never a dedicated retired-content heading in the page body</item>
      <item>Archive-tier retirement for wholly-obsolete pages — nav entry moved under a `### Archived` subsection, page stays on disk and linked</item>
      <item>Advisory nudge for inline-code path mentions (D13 migration path)</item>
      <item>Conformance repair on a domain `/wiki-memory audit --fix` flagged — declaration, scaffold artifacts, and `## Pages` filing, per the catalog that dispatch hands over (D14)</item>
    </in-scope>
    <out-of-scope>
      <item>Cross-link addition — stays `wiki-health --full`'s deep-audit concern</item>
      <item>Automatic/unattended scheduling — groom is manual-only, never auto-run (D6)</item>
      <item>Domain scaffold creation — use `/wiki-memory init` or `/wiki-memory migrate`</item>
    </out-of-scope>
  </scope>
</role>

Task list: full semantic lint, contradiction scan, rewrite-in-place supersession corrections (evidence in the run report and the commit), archive-tier retirement for wholly-obsolete pages, advisory nudge for inline-code path mentions (D13 migration path), and conformance repair when dispatched by `/wiki-memory audit --fix`.

## Operations

| Command | Action | Protocol |
|---------|--------|----------|
| `groom <domain> [--all]` | Run the full Tier-2 groom pass on one domain, or every declared domain with `--all` | Read `protocols/groom.md` |
| conformance repair (no verb of its own) | Apply the conformance catalog `/wiki-memory audit --fix` hands over for one domain, then let audit's own re-run of the mechanical detector decide whether the finding closed | Read `wiki-memory/protocols/audit.md` — `## Applying with --fix` |

## Foundational Principles

This skill handles the Tier-2 manual escape hatch in the wiki aging loop, and it is the only
place a wiki is repaired: detection is mechanical and lives in `wiki-health`, repair is judgment
and lives here (D13). For the mechanical
Tier-1 substrate it reuses as its own baseline (freshness/`maintenance-due`, `mdite`,
`churn-check`, drift-file emission, `last-verified` mechanics), defer to the `wiki-memory` skill
— specifically `protocols/lint.md`, which this skill's `protocols/groom.md` reads and executes
directly as its own Step 2, rather than re-deriving the same logic (DRY).

## Protocols

- [Groom Protocol](protocols/groom.md) — mechanical-baseline reuse, semantic lint, contradiction scan, supersession rewrites, archive-tier retirement, advisory nudge, JIT `schema.md` update, and reporting
