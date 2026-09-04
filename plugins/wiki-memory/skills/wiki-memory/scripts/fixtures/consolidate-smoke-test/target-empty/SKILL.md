---
description: Target-empty smoke-test fixture — target wiki seed (empty hub)
version: 1.0.0
---

# Target-Empty Expert (Smoke-Test Fixture)

Target wiki seed fixture for the consolidate smoke test. Represents the **destination**
skill that receives consolidated content from source-a and source-b. Starts in the
wiki-backed hub format with an empty `## Pages` index — the consolidate operation
populates it by routing pages from the source skills.

## Role

Target hub for the smoke-test consolidate run. After a successful consolidate operation
the `## Pages` section should list all pages routed from source-a and source-b, and
the corresponding sibling page files should exist alongside this SKILL.md.

## Pages

