---
summary: "shared 4-test heuristic + naming signals + carve-outs used by init and migrate to decide wiki-backed vs monolithic"
---

# Wiki-Natural Heuristic

Shared pre-check used by `init.md` and `migrate.md` before creating or migrating a
wiki-backed skill. Methodology skills produce an over-engineered structure with the same
content but more navigation overhead — applying wiki structure to them is waste. Both
call sites read this file directly (no sentinel/awk sync block — plain Read + pointer).

**This file is advice, not an identity test.** A skill is a wiki when it declares itself —
`wiki: true` in its `SKILL.md` frontmatter (D15) — and that declaration is the only identity
test any script or protocol applies. The four tests below are semantic judgment no script
evaluates; they help a person choosing a shape decide whether the wiki shape earns its
navigation overhead before `init` or `migrate` scaffolds one. Nothing here classifies a skill
that already exists, and a skill that would fail these tests but carries the declaration is a
wiki all the same.

## 4-Test Heuristic

1. **Sequential test:** Does the agent need to read the SKILL.md top-to-bottom every
   time? → methodology, SKIP
2. **Query test:** Will an agent commonly load *one specific page* to answer *one
   specific question*? → wiki-natural, proceed
3. **Growth test:** Will this content grow over time as the LLM ingests new patterns?
   → wiki-natural, proceed
4. **Decomposition test:** Does decomposing the SKILL.md into pages require splitting
   sequential narrative into out-of-order fragments? → methodology, SKIP

## Naming Heuristics

- `-expert` suffix is a soft wiki signal (but see carve-outs below)
- `-methodology`, `-rollout`, `-update` (verb-form), `-management` are strong
  methodology signals — default to SKIP/monolithic unless all 4 tests clearly pass

## Carve-Outs

None standing. `plan-expert` and `estimation-expert` were carried here as `-expert`-suffixed
skills that should stay monolithic; both are declared wikis today — each carries `wiki: true`,
a `.mditerc`, and a filed `## Pages` nav — so the carve-out no longer describes them. Check the
shape a skill actually has on disk before adding one here: a carve-out that contradicts a live
declaration sends its next reader hunting for a defect that does not exist.

## Examples of Confirmed-SKIP Skills

`handoff-methodology`, `code-change`, `analyzer-rollout`, `api-docs`, `brainstorming`,
`commit-methodology`, `doc-update`, `knowledge-capture`, `scratch-management`, `user-docs`.

## Caller Contract

This file defines the test/signal/carve-out logic only — it does NOT define the
`RESULT: SKIP-METHODOLOGY` block callers emit when a skill fails the heuristic. The
`Reason:` line is free text naming which test(s) failed; the `Action:` line is
call-site-specific (init.md proposes creating a fresh monolithic skill, migrate.md
proposes keeping the existing one unchanged) and is defined at each call site, not here.

If the skill passes (wiki-natural), the caller continues to its own numbered steps or
apply sequence — this file has no further involvement once the pre-check passes.
