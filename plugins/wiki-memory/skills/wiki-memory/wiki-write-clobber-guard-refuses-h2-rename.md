---
tags: [wiki-memory/wiki-write]
summary: "The no-silent-section-loss guard refuses an H2 rename, not just content loss"
last-verified: "2026-08-25"
---

## `wiki-write --update`'s No-Silent-Section-Loss Guard Refuses an H2 *Rename*, Not Just Content Loss

The guard (`wiki-write.sh`, the `REPLACE -eq 0` branch) keys both sides on H2 heading
**text**: it builds a `heading -> body-non-whitespace-count` map for the existing page and
for the payload, then walks the existing page's H2s. A heading whose text changed has no
key in the payload map at all, so it trips the **MISSING** leg — the same leg that fires
when a section is genuinely dropped. The guard never compares bodies positionally, so it
cannot distinguish "section deleted" from "section kept, heading reworded", and the body's
survival buys nothing.

This collides head-on with rewrite-in-place corrections (AD6, `protocols/lint.md:274`),
which routinely have to reword a page's `##` heading because the heading is where the stale
claim is stated most plainly. A single-H2 page is the worst case: the payload is the whole
corrected page, nothing is lost, and the write is still refused.

`--replace` is the guard's documented escape hatch, but it disables all three legs for the
entire write — trading a false refusal for no content check at all. The way to keep the
guard meaningful is to split the write: pass 1 is a `--update` carrying the corrected body
under the **existing** heading text, so the guard actually evaluates body preservation and
the `## Pages` nav resync fires on the changed `summary:`; pass 2 rewrites the one heading
line. Both passes are journalled, and the content check is never skipped.

**Discovered:** During step 12a's AD6 correction of `mdite-expert/wiki-aging-loop.md`, whose
required heading rewrite was refused by the guard on a payload that preserved every byte of
the page's content.
**Impact:** Any AD6 rewrite-in-place, groom supersession rewrite, or `knowledge-ingestor`
auto-correction that touches an H2 heading hits this. Step prose that prescribes a plain
`wiki-write --update` and simultaneously forbids `--replace` is unsatisfiable in one write
whenever the heading itself carries the stale claim.
