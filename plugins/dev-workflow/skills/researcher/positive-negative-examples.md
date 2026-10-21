---
tags: [investigation, wiki, examples, admission-gate, filing-decision]
summary: "Paired positive/negative examples illustrating correct vs incorrect researcher behavior: cache-hit, capture, drift-detection, Sought-reject, and investigation-incomplete paths."
---

# Positive and Negative Examples

<!-- BEGIN:CONTENTS -->
- Background: Key Rules
- Example 1: Clear-Pass Admission → Capture (POSITIVE)
- Example 1B: Same Scenario, the Researcher Fixes the Page (NEGATIVE)
- Example 2: Design Question → No Capture, Sought Named (POSITIVE)
- Example 2B: Same Scenario, the Researcher Writes It Anyway (NEGATIVE)
- Example 3: Cache Hit (No Write, No Drift) → Prose Only (POSITIVE)
- Example 3B: Cache Hit, Trailer Incorrectly Fires (NEGATIVE)
- Example 4: Context Fill ≥80% Mid-Investigation → investigation-incomplete (POSITIVE)
- Example 4B: Context Fill ≥80%, No Trailer Fired (NEGATIVE)
<!-- END:CONTENTS -->

Paired examples showing correct (POSITIVE) vs incorrect (NEGATIVE) researcher behavior across the four primary paths. Each pair targets a specific decision point. Pages are self-contained — the admission gate and D8/D20 references are explained inline.

---

## Background: Key Rules

**Admission gate:** Before capturing anything, the researcher applies the four questions of `wiki-memory/page-standard.md` § Admission, then F3:
- **Sought — who opens this page, on work that is not the work that produced the capture?** A task outside the dispatching workstream opens it; research that answers the workstream's own question stays in `scratch/{project}/`.
- **Novel — would Claude get this wrong, or not think of it, with only the code in front of it?** The finding is not already covered accurately in the existing wiki page.
- **Enforcing — what does the reader do differently because of it?** It changes how future work proceeds — actionable, not just a label or visible fact.
- **Durable — would it need editing if the implementation changed but its purpose did not?** It states a mechanism, constraint or decision, not a roster, a count or "is now fixed".
- **F3 — Principle scope:** The finding holds as a general principle (or a well-justified instance of one), not just for this one query.

A "clear-pass" is when every check is unambiguous. A check you can only call plausible is a fail: nothing is written, and the prose names the question and why.

**D8 — bimodal return:** The researcher has two return modes:
1. **Persistence mode:** A capture or an issue file was written. Trailer fires.
2. **Ephemeral mode:** No persisted artifact. Trailer does NOT fire. Response is prose only.

**D20 — trailer schema:** When trailer fires, it appears inline at the end of the prose response:
```
Captured: <absolute-path> -> <domain>[/<slug>]    # 0+ lines, one per capture written
Issue: <absolute-path>                            # 0+ lines, one per issue file filed
Source: wiki | wiki+verified | live               # exactly 1, present whenever the trailer fires
```

---

## Example 1: Clear-Pass Admission → Capture (POSITIVE)

**Scenario:** The orchestrator dispatches researcher with: *"How does the project's EF Core query layer handle navigation property loading?"*

The researcher reads the wiki index (`billing-backend-expert/SKILL.md ## Pages`), finds a page `query-patterns.md` that cites `Data/Repositories/UserRepository.cs` via an in-body markdown link. Freshness check: the cited file's git mtime is newer than the page's `updated:` frontmatter — `stale-timestamp`. Deep verify: reads `UserRepository.cs` and confirms that `.Include()` was added but the wiki page does not mention it. This is semantic drift AND a new finding.

The researcher applies the admission gate to the `.Include()` requirement:
- Sought: the page it corrects is `query-patterns`, and any later task writing a query opens that page — clear-pass, whatever the dispatch was for.
- Admission: not in the wiki page, and actionable — future query code must use `.Include()` or get null navigation properties silently — clear-pass.
- F3: General principle across this project's data layer — clear-pass.

Both clear. Researcher writes `scratch/billing/learned/query-include-required.md` — `type: drift`, `target-domain: billing-backend-expert`, `target-page: query-patterns` — with the `.Include()` requirement and the code citation that proves it, and says in prose that the wiki page still lacks it.

**Correct trailer:**
```
Captured: /home/ubuntu/proj/scratch/billing/learned/query-include-required.md -> billing-backend-expert/query-patterns
Source: live
```

**Why POSITIVE:** Every check cleared unambiguously, and the finding left as a capture rather than a page edit. `target-page` names the page the researcher read, as a hint — `knowledge-ingestor` decides whether the capture updates that page or earns its own. `Source: live` because the wiki was stale and live investigation was needed.

---

## Example 1B: Same Scenario, the Researcher Fixes the Page (NEGATIVE)

Same facts, but the researcher decides the correction is one unambiguous line, calls
`wiki-write billing-backend-expert query-patterns --from /tmp/payload --update`, and emits:

```
Wiki: billing-backend-expert/query-patterns (updated)
Source: live
```

**Why NEGATIVE:** Two errors, one cause. The write breaks the one-writer rule — `wiki-write` belongs
to knowledge-ingestor, never to this agent. And `Wiki:` is not a trailer
field: nothing this agent does produces a wiki page, so an orchestrator parsing `^Captured: ` sees
no artifact at all and the finding is lost. Certainty about the correction is not authority to
apply it — the capture is how a certain correction travels.

---

## Example 2: Design Question → No Capture, Sought Named (POSITIVE)

**Scenario:** `/brainstorming` dispatches researcher with: *"Which files read the `## Decisions` heading in `idea.md`, before we add a section to the template?"* The researcher greps, finds four readers, and could write them up with a verb attached ("move every reader when you rename the heading").

Sought fails: the only task that opens this is the workstream that asked, and it answers the dispatch's own question (knowledge-capture do-not-write rule 8). Durable fails too — a list of which files currently read the heading.

No `learned/` file is written. The researcher answers the question in prose and ends with a sentence such as: *"Not captured: it fails Sought — it answers this workstream's question about adding a section, and no unrelated task would open it. The reader list belongs in `idea.md`, cited from the decision it serves."* No trailer.

**Why POSITIVE:** A finding that fails an admission question is written nowhere, and the prose says which question failed and why, so the caller knows the omission was a judgment and where the finding belongs instead.

---

## Example 2B: Same Scenario, the Researcher Writes It Anyway (NEGATIVE)

Same facts, but the researcher, unsure whether a later project might care, writes `scratch/my-project/learned/research-decisions-heading-readers.md` and emits `Captured:` for it — or writes the file and stays silent about Sought.

**Why NEGATIVE:** A check you can only call plausible is a fail. Writing the file sends the workstream's own research to the ingestor, which drops it as `sought` at best and files a page nobody outside the workstream will open at worst. Staying silent about the skip leaves the caller unable to tell a judgment from an oversight.

---

## Example 3: Cache Hit (No Write, No Drift) → Prose Only (POSITIVE)

**Scenario:** The orchestrator asks: *"What pagination strategy does the DynamoDB query service use?"*

Researcher reads `dynamodb-expert/SKILL.md ## Pages`, finds `pagination-patterns.md`. The page cites `Services/QueryService.cs` via an in-body markdown link. Freshness check: git mtime on the cited file is older than the page's `updated:` timestamp — fresh. The wiki content answers the question fully.

**Researcher returns prose answer drawn from the wiki. No trailer.**

**Why POSITIVE:** Per D8, a pure cache hit (wiki content is current, nothing captured) is ephemeral mode. No trailer fires. Generating a trailer would be wrong — the orchestrator would go looking for an artifact that does not exist.

---

## Example 3B: Cache Hit, Trailer Incorrectly Fires (NEGATIVE)

Same facts, but researcher appends:

```
Captured: /home/ubuntu/proj/scratch/my-project/learned/pagination-patterns.md -> dynamodb-expert/pagination-patterns
Source: wiki
```

**Why NEGATIVE:** Nothing was written. Emitting a `Captured:` line naming a file that does not exist is false, and an orchestrator relaying it sends the user to an empty path. The cache-hit path is always ephemeral (no trailer).

---

## Example 4: Context Fill ≥80% Mid-Investigation → investigation-incomplete (POSITIVE)

**Scenario:** Researcher is doing live investigation of the order processing pipeline. After reading 8 source files, context fill is at 82%. The investigation is not complete — the researcher has intermediate notes but hasn't reached the admission stage yet.

Researcher writes a partial-notes file to `learned/` and fires the trailer:

```
Source: live
```

No `Captured:`/`Issue:` line — the partial notes are notes for the next dispatch, not a capture for the ingestor. Prose states the investigation is incomplete and points to `scratch/my-project/learned/step-03-order-pipeline-partial.md` so the next dispatch can feed-forward.

**Why POSITIVE:** The trailer has no `Status:` field, so there is no explicit `investigation-incomplete` marker — the trailer firing at all (a bare `Source: live` line with no `Captured:`/`Issue:` lines), paired with prose that says the answer is not final, is what signals a follow-up dispatch may be needed. The partial-notes path is described in prose, not in the trailer, which has no `Wrote:` field.

---

## Example 4B: Context Fill ≥80%, No Trailer Fired (NEGATIVE)

Same facts, but researcher returns prose only with no trailer and no partial notes file.

**Why NEGATIVE:** The orchestrator has no way to know the investigation was cut short. It may interpret the prose as a complete answer, miss the incomplete signal, and proceed on partial information. The context-fill-≥80% path requires the trailer to fire — even if only a bare `Source: live` line — paired with prose stating the investigation is incomplete; that combination is the orchestrator's only reliable signal that the result is incomplete. Silence (no trailer at all) is indistinguishable from a completed cache-hit answer.
