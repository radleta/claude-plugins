---
tags: [investigation, wiki, examples, 3-filter, filing-decision]
summary: "Paired positive/negative examples illustrating correct vs incorrect researcher behavior: cache-hit, live-investigation, drift-detection, borderline, and investigation-incomplete paths."
---

# Positive and Negative Examples

Paired examples showing correct (POSITIVE) vs incorrect (NEGATIVE) researcher behavior across the four primary paths. Each pair targets a specific decision point. Pages are self-contained — the 3-filter and D8/D20 references are explained inline.

---

## Background: Key Rules

**3-filter (knowledge-distillation):** Before writing anything to a wiki page, the researcher applies three filters:
- **F1 — Not-already-known:** The finding is not already covered accurately in the existing wiki page.
- **F2 — Instructive (not just descriptive):** The finding changes how future work proceeds — it is actionable, not just a label or visible fact.
- **F3 — Principle scope:** The finding holds as a general principle (or a well-justified instance of one), not just for this one query.

A "clear-pass" is when all three filters are unambiguous. A "borderline" is when one or more filters are plausible but not certain.

**D8 — bimodal return:** The researcher has two return modes:
1. **Persistence mode:** A wiki write (or fallback `learned/` file) occurred. Trailer fires.
2. **Ephemeral mode:** No persisted artifact. Trailer does NOT fire. Response is prose only.

**D20 — trailer schema:** When trailer fires, it appears inline at the end of the prose response:
```
Wiki: <domain>/<slug> (created|updated)          # 0+ lines, one per wiki page filed
Issue: <absolute-path>                            # 0+ lines, one per issue file filed
Drift: <domain>/<slug>                            # 0+ lines, drift heal applied without writing a new wiki page
AutoHeal: {category}=<domain>/<slug>->{target}    # 0+ lines, one per D6 auto-heal action
Source: wiki | wiki+verified | live               # exactly 1, present whenever the trailer fires
```

**D39 — borderline learned files:** Emitting a `learned/` borderline file does NOT trigger the trailer. The `learned/` emission is a side effect, not a persistence event from an orchestrator's perspective.

---

## Example 1: Clear-Pass 3-Filter → Wiki Write (POSITIVE)

**Scenario:** The orchestrator dispatches researcher with: *"How does the project's EF Core query layer handle navigation property loading?"*

The researcher reads the wiki index (`billing-backend-expert/SKILL.md ## Pages`), finds a page `query-patterns.md` that cites `Data/Repositories/UserRepository.cs` via an in-body markdown link. Freshness check: the cited file's git mtime is newer than the page's `updated:` frontmatter — `stale-timestamp`. Deep verify: reads `UserRepository.cs` and confirms that `.Include()` was added but the wiki page does not mention it. This is semantic drift AND a new finding.

The researcher applies 3-filter to the `.Include()` requirement:
- F1: Not in the wiki page — clear-pass.
- F2: Actionable — future query code must use `.Include()` or get null navigation properties silently — clear-pass.
- F3: General principle across this project's data layer — clear-pass.

All three clear. Researcher invokes `wiki-write billing-backend-expert query-patterns.md --update` and adds the EF Core `.Include()` requirement.

**Correct trailer:**
```
Wiki: billing-backend-expert/query-patterns (updated)
Source: live
```

**Why POSITIVE:** All 3 filters cleared unambiguously. Wiki was updated. Trailer fires with `Source: live` (wiki was stale so live investigation was needed) and one `Wiki:` line marking the page as updated.

---

## Example 1B: Same Scenario, Wrong Trailer Key (NEGATIVE)

Same facts as above, but the researcher emits:

```
Wikis: [billing-backend-expert/query-patterns (updated)]
Source: live
```

**Why NEGATIVE:** The trailer uses `Wikis:` (plural). The correct key is singular `Wiki:`. Orchestrators parse with `^Wiki: ` line-anchor regex — the plural form silently produces zero matches, breaking downstream wiki-filing extraction. Always use singular `Wiki:` with one line per wiki page filed.

---

## Example 2: Borderline 3-Filter → Learned File, No Trailer (POSITIVE)

**Scenario:** Researcher investigated the auth middleware chain and found that handlers execute in insertion order. F1 passes (not in wiki). F2 is borderline — it's actionable for middleware configuration, but the codebase might already have a test that enforces order. F3 is borderline — it may be Express-framework behavior, not a project-specific insight.

Filters mixed → borderline path. Researcher writes:
```
scratch/my-project/learned/research-borderline-20260513T1422-auth-middleware-order.md
```

**Researcher response ends with prose only.** No trailer.

**Why POSITIVE:** Per D39, emitting a `learned/` file from the borderline path is a side effect, not a persistence event. The trailer does NOT fire. If the researcher had fired a trailer here, it would incorrectly signal to the orchestrator that a wiki page was filed.

---

## Example 2B: Borderline Path, Wrong Trailer Fires (NEGATIVE)

Same facts, but researcher emits:

```
Wiki: my-project-expert/auth-middleware-order (created)
Source: live
```

**Why NEGATIVE:** The `learned/` borderline file is NOT a wiki filing event. Emitting a `Wiki:` line here is wrong — orchestrators interpret `Wiki:` as confirmation that a wiki page was written. The correct behavior is prose-only (no trailer) for the borderline path. The `learned/` file silently accumulates for ingestion later; it does not trigger a filing signal.

---

## Example 3: Cache Hit (No Write, No Drift) → Prose Only (POSITIVE)

**Scenario:** The orchestrator asks: *"What pagination strategy does the DynamoDB query service use?"*

Researcher reads `dynamodb-expert/SKILL.md ## Pages`, finds `pagination-patterns.md`. The page cites `Services/QueryService.cs` via an in-body markdown link. Freshness check: git mtime on the cited file is older than the page's `updated:` timestamp — fresh. The wiki content answers the question fully.

**Researcher returns prose answer drawn from the wiki. No trailer.**

**Why POSITIVE:** Per D8, a pure cache hit (wiki content is current, no persistence event) is ephemeral mode. No trailer fires. Generating a trailer would be wrong — the orchestrator would try to parse `Wiki:` lines that don't exist or represent nothing new.

---

## Example 3B: Cache Hit, Trailer Incorrectly Fires (NEGATIVE)

Same facts, but researcher appends:

```
Wiki: dynamodb-expert/pagination-patterns (updated)
Source: wiki
```

**Why NEGATIVE:** No write occurred. Emitting a `Wiki:` line for a page that was only read (not written) is false. It implies a wiki page was persisted. Orchestrators may count this as a real filing, polluting the audit trail. The cache-hit path is always ephemeral (no trailer).

---

## Example 4: Context Fill ≥80% Mid-Investigation → investigation-incomplete (POSITIVE)

**Scenario:** Researcher is doing live investigation of the order processing pipeline. After reading 8 source files, context fill is at 82%. The investigation is not complete — the researcher has intermediate notes but hasn't reached the 3-filter stage yet.

Researcher writes a partial-notes file to `learned/` and fires the trailer:

```
Source: live
```

No `Wiki:`/`Issue:`/`Drift:` line (no wiki page was written — only a partial notes file). Prose states the investigation is incomplete and points to `scratch/my-project/learned/step-03-order-pipeline-partial.md` so the next dispatch can feed-forward.

**Why POSITIVE:** Layer 3 dropped the `Status:` field, so there is no explicit `investigation-incomplete` marker — the trailer firing at all (a bare `Source: live` line with no `Wiki:`/`Issue:`/`Drift:` lines), paired with prose that says the answer is not final, is what signals a follow-up dispatch may be needed. The partial-notes path is described in prose, not in the trailer, because `Wrote:` was dropped along with `Status:`.

---

## Example 4B: Context Fill ≥80%, No Trailer Fired (NEGATIVE)

Same facts, but researcher returns prose only with no trailer and no partial notes file.

**Why NEGATIVE:** The orchestrator has no way to know the investigation was cut short. It may interpret the prose as a complete answer, miss the incomplete signal, and proceed on partial information. The context-fill-≥80% path requires the trailer to fire — even if only a bare `Source: live` line — paired with prose stating the investigation is incomplete; that combination is the orchestrator's only reliable signal that the result is incomplete. Silence (no trailer at all) is indistinguishable from a completed cache-hit answer.
