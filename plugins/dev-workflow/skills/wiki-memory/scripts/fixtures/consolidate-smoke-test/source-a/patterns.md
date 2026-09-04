---
tags: [patterns, smoke-test, source-a]
summary: Core patterns for the source-a smoke-test fixture skill
---

# Patterns

## Pattern 1: Fixture Isolation

Smoke-test fixtures must be fully self-contained. Every file referenced by a fixture
must live within the fixture directory itself — no external dependencies, no references
to live skill directories. This ensures the smoke test produces deterministic results
regardless of the state of the live `.claude/skills/` tree.

When staging fixtures for a destructive run, the runner copies the entire fixture tree
into a `mktemp -d` temporary directory. Isolation guarantees that a mid-test failure
does not corrupt the originals stored in `scratch/wiki-fleet-conversion/smoke-test/`.

## Pattern 2: Frontmatter Completeness

Every sibling page in a wiki-backed skill must carry both `tags:` and `summary:`
frontmatter fields. The `tags` array drives wiki-memory's cross-reference resolution;
the `summary` field is consumed by the `wiki-health` classifier when checking page
completeness. Missing either field causes a `partial-migration` or `unhealthy` result
from `wiki-health`.

Authors should treat the frontmatter schema as load-bearing, not optional metadata.
Downstream tooling (mdite lint, wiki-health, consolidate manifest generation) all
read these fields deterministically.

## Pattern 3: Page-Routing Manifest

The consolidate operation generates a page-routing manifest before performing any
destructive writes. The manifest maps each source page (skill + file) to its target
destination (target skill + subdirectory + filename). Fixture smoke tests pre-bake
this manifest as a static JSON file so the runner can validate the mechanical
sub-steps (skill-edit pull, page writes, skill-edit push) without needing an LLM
orchestrator call.

A pre-baked manifest also enables deterministic diff validation: the runner can
compare actual written files against the manifest's expected output list and report
each criterion as `PASS:` or `FAIL:` with a consistent prefix format.
