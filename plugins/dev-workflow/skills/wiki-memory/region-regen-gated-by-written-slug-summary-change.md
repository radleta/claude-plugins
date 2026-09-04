---
source: implementation/step-09
type: gotcha
scope: project
target-domain: wiki-memory
status: captured
tags: [wiki-memory/testing]
summary: "Fenced whole-region regeneration only runs when the written slug's own summary changed"
---

## Fenced Whole-Region Regeneration Only Runs When the Written Slug's OWN Summary Changed

`wiki-write.sh`'s fenced path is described as "strictly stronger than a
per-entry patch: every entry in a touched region is repaired". That is true of
the regeneration pass itself, but the pass is **gated** by an earlier,
deliberately unlocked pre-check that most readers never connect to it.

For `action=updated`, `wiki-write.sh:1274-1275` compares the payload's
`summary:` against the bullet already on disk for **that one slug** and sets
`_NAV_MODE="skip"` when they match. `skip` bypasses the entire nav block
(`:1279`), so the fence probe, the region regenerator, and the nav mutex never
run at all. Consequences, both empirically verified:

- **A content-only `--update` repairs nothing.** Change a page's body but not
  its `summary:`, and sibling entries in the same fenced region stay drifted —
  even though the whole-region rewrite would have fixed them had it run.
- **A repeated identical `--update` is not "idempotent via the `cmp -s`
  guard".** The second run short-circuits at the pre-check and emits **no**
  message at all. The `already current; nav unchanged` info line belongs to the
  `cmp -s` guards *inside* the nav block (`:1472` fenced, `:1513` unfenced),
  which an idempotent repeat never reaches. Those guards are reachable only via
  a genuine race, a bullet carrying no ` — ` separator, or a bullet sitting
  outside every fence in an otherwise-fenced domain.

So drift repair on sibling entries is a **side effect of a write that was
already going to touch the nav**, not an independent sweep. Nothing in
`wiki-write` proactively reconciles a fenced region; `wiki-health` remains the
only thing that reports drift nobody's write happened to pass over.

**Discovered:** Writing Group 11's fenced-regeneration and idempotency
assertions in step 09. The plan step predicted the second run would emit
`already current; nav unchanged`; tracing why it does not exposed the gate.
**Impact:** Anyone reasoning about how quickly fenced-region drift heals, or
writing tests against the regeneration path, must drive it with a payload whose
summary actually differs — a same-summary write exercises none of it.
