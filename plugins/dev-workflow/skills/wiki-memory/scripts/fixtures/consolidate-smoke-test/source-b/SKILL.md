---
description: Source-B smoke-test fixture — new-state skill (flat SKILL.md, no sibling pages)
version: 1.0.0
---

# Source-B Expert (Smoke-Test Fixture)

New-state skill fixture for the consolidate smoke test. Represents a skill that has **not
yet been migrated** to the wiki-backed sibling-pages format. All content lives inline in
this SKILL.md — no sibling page files, no `.mditerc`, no `## Pages` index.

The consolidate operation must handle this state: when a source skill is in new-state,
its inline content sections become candidate pages routed to the target skill.

## Patterns

Core patterns for the source-b domain:

- **Inline content is the source of truth** — all methodology lives in this file.
- **Section headers become page candidates** — the consolidate page-routing step maps
  each `##` section to a candidate target page. The LLM orchestrator decides which
  sections are substantive enough to warrant promotion to a named sibling page.
- **No cross-skill references** — new-state skills are self-contained; they do not
  reference sibling pages that don't exist yet.

## Examples

Concrete examples of new-state skill content that the consolidate operation processes:

**Example 1 — Single-section skill:**
A skill with only a `## Usage` section and a short role description. The orchestrator
may elect to inline the content into the target hub rather than create a named page,
since the volume is low.

**Example 2 — Multi-section skill (this fixture):**
A skill with `## Patterns`, `## Examples`, and `## Anti-patterns` sections. The
orchestrator routes each section as a candidate page in the target skill, producing
three sibling page files (one per section) after the consolidate run completes.

**Example 3 — Mixed inline + external references:**
A skill that references external CLI tools or APIs. These references survive the
consolidate page-routing step unchanged — the `skills:` YAML field and `## Pages`
links are the only fields subject to cross-ref rewriting per the consolidate protocol.

## Anti-patterns

Things to avoid when authoring new-state skills that will later be consolidated:

- **Don't use prose references to sibling pages that don't exist.** The consolidate
  operation's cross-ref rewrite scope covers `skills:` YAML and `## Pages` links only.
  Prose mentions of sibling pages (e.g., "see patterns.md for details") are NOT
  rewritten — they become dangling references after the merge.

- **Don't embed binary or non-markdown content inline.** The consolidate page-routing
  step operates on markdown section boundaries (`##` headings). Binary blobs, raw JSON
  blocks, or non-markdown content embedded in the skill body cannot be cleanly
  decomposed into named sibling pages.

- **Don't rely on section ordering for semantic meaning.** After consolidate routes
  sections to named pages, the ordering within the target hub's `## Pages` index is
  determined by the manifest, not by the original section order in SKILL.md.
