---
tags: [wiki-memory/verification]
summary: "wiki-health --full detects missing cross-reference pairs and downgrades state"
---

## wiki-health --full Cross-Link Requirement

`wiki-health <skill>` reports `healthy` when pages are structurally valid and internally consistent. However, `wiki-health <skill> --full` runs a deep-audit pass (Step 5b cross-link scan) that identifies missing cross-reference pairs.

**Definition:** A missing cross-link pair occurs when two pages share content signals (noun-phrase matches in headers, topic discussions) but do NOT explicitly link to each other.

**Behavior:** When cross-link pairs are missing, the state downgrades from `healthy` to `partial-migration` (exit code 4 instead of exit 0).

**Important:** This is NOT a structural error — the wiki is valid and usable. It is a content-quality recommendation: pages discussing related topics should provide explicit navigation links.

**Example:** After consolidating 9 sources into `claude-code-expert`, the newly created `builders/` and `platform-features/` subdirectories had 31 missing cross-link pairs. Adding `## See Also` sections with targeted relative links reduced the count to 0.

**Fix pattern:**
1. Run `wiki-health <skill> --full` and capture the `deep_audit.cross_references` output
2. For each missing pair `(source, target)`, add a link from source to target (or vice versa) in a `## See Also` section
3. Prefer relative markdown links: `[Page](../path/page.md)`

**When discovered:** During Phase 2 post-merge verification when `wiki-health claude-code-expert --full` returned exit 4 instead of exit 0 after consolidation completed.

**Impact:** Any step with acceptance criterion `wiki-health <skill> --full` exits 0 must resolve ALL cross-link pairs, not just structural health. Future consolidations should add explicit cross-links proactively when creating new pages in a wiki with related existing pages.
