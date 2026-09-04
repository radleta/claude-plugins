---
tags: [wiki-memory/nav-regeneration]
summary: "Em dash in nav title corrupts separator search"
last-verified: "2026-08-25"
---

## A Decorated Nav Title Containing an Em Dash Corrupts the Nav Separator Search

`wiki-write.sh`'s `## Pages` nav-summary transforms locate the ` — ` separator between a
bullet's decorated title/link and its summary by finding the separator's **first occurrence in
the whole bullet line**. If the decorated title itself contains an em dash — a real, currently
existing case — `claude-code-ref-expert/SKILL.md` carries this entry:

```markdown
- [local-memory vs handoff — Clear Boundary](local-memory-boundary.md) — Relationship between...
```

The first ` — ` in the line is inside the title (`handoff — Clear`), not the real separator
after the closing `)`. A resync that finds the separator this way truncates the line at the
title's internal dash, destroying the markdown link — the bracket-close-then-parenthesized-path
sequence — entirely.

**This is pre-existing in the per-entry resync transform** (`wiki-write.sh`, the `_NAV_MODE ==
"resync"` branch, unchanged by this step) — verified independently on an **unfenced** fixture
with completely unmodified code — this fixture entry:

```markdown
- [title — Sub](t.md) — summary
```

becomes `- [title — Relationship between...` after a resync, i.e. the link syntax is gone. The
bug has apparently never fired on `local-memory-boundary` in the live fleet because no `--update` has
targeted that specific slug since the entry's title was last written with an embedded dash.

**Step 08's new whole-region regenerator (`_wiki_regen_pages_fences`) does NOT have this bug** —
it was caught during this step's own verification (Row 3 / claude-code-ref-expert invariant
checks) and fixed before completion: the separator search is scoped to the substring strictly
after the link's closing `)` (via a literal, non-glob suffix match on the matched link-tail text —
bracket-close, then the parenthesized path), not the whole line. But because whole-region
regeneration rewrites **every** entry in a touched region on every write (not just the entry being
written), it exercises this class of bug far more often than the old per-entry patch did — the old
code only corrupted an entry if that exact slug was the one being `--update`d; the new code
touches every co-located entry, including ones with no relation to the write.

**Discovered:** During step 8 (`marker-fenced-regions-convention` rollout, whole-region
regeneration in `wiki-write.sh`) verification against the real `claude-code-ref-expert` domain.
Reproduced independently on the pre-existing, unmodified resync branch via an isolated unfenced
fixture to confirm the root cause predates this step.

**Impact:** The old per-entry resync branch (`wiki-write.sh`, unfenced fallback, D9) still has
this defect and was deliberately left unchanged per this step's scope (must-preserve list). Any
future `--update` on an unfenced domain — or a fenced domain if a page is ever un-fenced — whose
nav title contains an em dash will still corrupt that link. A related decorator-preservation
defect was also caught in the same pass: naively taking "everything after the closing `)`" as the
new nav text (rather than searching within it for the real separator) drops the `(archived)`
suffix (AD8) entirely — fixed the same way, by isolating the decorator as the text strictly
before the separator's first occurrence within the post-link substring.
