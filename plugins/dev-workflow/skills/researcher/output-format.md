---
page-kind: procedure
tags: [investigation, wiki, output-format, trailer-schema, D20]
summary: "Bimodal return contract and trailer schema for the researcher: Captured/Issue/Source field grammar, per-path conditions, enum definitions, and orchestrator parsing anchors. Layer 3: pure artifact-listing, no Status/Wrote classification fields."
---

# Output Format

<!-- BEGIN:CONTENTS -->
- Bimodal Return Contract
- Prose-Content Rules
- Trailer Schema
- Line-Anchor Regexes (Orchestrator Parsing)
- Enum Definitions
- Trailer-Fires-When Table
- Complete Trailer Examples
- Fields the Trailer Never Carries
<!-- END:CONTENTS -->

The researcher has two return modes (bimodal contract, D8). Which mode fires depends on whether a persistence event occurred during the dispatch. Both modes end with prose — only persistence mode appends a structured trailer.

---

## Bimodal Return Contract

| Mode | When | Output |
|------|------|--------|
| **Persistence mode** | Any artifact line was emitted: a capture was written, or an issue file was written | Prose + trailer (inline at end) |
| **Ephemeral mode** | No artifacts: pure cache hit (wiki answered fully, no drift, nothing captured) OR admission rejected (insight not worthy) | Prose only — no trailer |

---

## Prose-Content Rules

Prose is the researcher's primary channel to the caller. These rules govern what prose contains, independent of what was persisted:

1. **Prose answers the caller's question comprehensively**, independent of what was persisted. Prose content is never limited by the ephemeral/persistence mode split.
2. **Prose includes any forward-looking content** extracted to `/capture-issue` — the caller sees what was routed to the issue tracker and why.
3. **Prose includes admission rejects** that are relevant to the caller's question, each naming the question it failed and why — for **Sought**, the workstream question it answers. If an insight was not worthy of the wiki, the caller still learns from it, and learns that its omission was a judgment.
4. **Prose says when a wiki page is still wrong** — a drift capture records the correction, but the page keeps its stale claim until knowledge-ingestor files it, and the caller has to know which they are reading.
5. **Prose never defers to "see trailer for details"** — the trailer is for orchestrators. Prose must be self-contained for human readers.

---

## Trailer Schema

When persistence mode fires, the trailer appears inline at the **end** of the prose response, separated from prose by a blank line. Fields appear in this fixed order:

```
Captured: <absolute-path> -> <target-domain>[/<target-page>]
Issue: <absolute-path>
Source: wiki | wiki+verified | live
```

- `Captured:` appears **once per `learned/` capture written**, format `<absolute-path> -> <target-domain>[/<target-page>]`. The path is the capture file; the arrow names the `target-domain:` it carries and, when it carries one, the `target-page:` hint. Omit the `/<target-page>` half when the capture names no page — do not write `/(none)`. Two captures in one dispatch produce two lines. Absent when nothing was captured.
- `Issue:` appears **once per issue file written**. One `Issue:` line per issue file. Present on issue-only routes (the current-state filter extracts all forward-looking content and no current-state content survives admission) and when wiki pollution was reported (`investigation-workflow.md` § Wiki Pollution Noticed While Reading). `Issue:` is always the absolute path to the filed issue file.
- `Source:` is **always present when the trailer fires**. Values: `wiki | wiki+verified | live`. See Source enum below.
- No other lines appear between the trailer fields. In particular there is **no field naming a wiki page this dispatch wrote**, because none exists: the researcher writes captures, and the wiki changes when `knowledge-ingestor` files them.

**No `Status:` field.** No `Wrote:` field. Orchestrators compute status from the artifact lines: presence of `Captured:` = a capture is waiting for the ingestor; presence of `Issue:` without `Captured:` = issue-only; no trailer at all = nothing cleared admission. No classification step = no misclassification.

---

## Line-Anchor Regexes (Orchestrator Parsing)

Orchestrators parse the trailer using these line anchors:

| Field | Regex | Cardinality |
|-------|-------|-------------|
| `Captured:` | `^Captured: ` | 0+ |
| `Issue:` | `^Issue: ` | 0+ |
| `Source:` | `^Source: ` | exactly 1 when trailer fires |

**Orchestrator-parsing note:** Orchestrators treat unknown trailer fields as optional — the line-anchor regex approach already handles this, since an unrecognized `^Key: ` line simply produces no match for known keys. Both `Captured:` and `Issue:` are optional; absence signals "not applicable." Do NOT emit a `(none)` placeholder for either — absence is the signal.

---

## Enum Definitions

### `Source` enum

```
Source ∈ { wiki, wiki+verified, live }
```

| Value | Meaning |
|-------|---------|
| `wiki` | Answer came entirely from the wiki cache. No live code exploration was needed. |
| `wiki+verified` | Answer came from wiki cache AND was confirmed accurate via a targeted live check (freshness deep-verify passed). |
| `live` | Answer required live exploration of the codebase (wiki had no matching page, or the wiki page was found to be stale). |

---

## Trailer-Fires-When Table

| Researcher path | Trailer fires? | Artifact lines emitted |
|-----------------|----------------|------------------------|
| Cache hit, nothing captured, no drift | **NO** | — |
| Admission clear-pass, capture written | **YES** | 1+ `Captured:` lines |
| Admission rejects (insight not worthy) | **NO** | — |
| Drift detected, drift capture written | **YES** | 1 `Captured:` line, `Source: wiki+verified` |
| Context fill ≥80% mid-investigation, partial notes written | **YES** | (no `Captured:`/`Issue:` lines; the partial notes are a prose-only record — `Source: live`) |
| Wiki pollution reported (issue + capture) | **YES** | 1 `Issue:` line + 1 `Captured:` line |
| Issue-only route (the current-state filter extracts everything, nothing left to capture) | **YES** | 1+ `Issue:` lines, no `Captured:` |

**Partial-notes note:** the context-fill gate's `learned/` file is notes for the next dispatch, not
a capture for the ingestor, so it gets no `Captured:` line. The prose names its path.

---

## Complete Trailer Examples

**Finding captured:**
```
Captured: /home/ubuntu/proj/scratch/billing/learned/query-include-required.md -> billing-backend-expert/query-patterns
Source: live
```

**Capture with no page hint (nothing in the domain fit):**
```
Captured: /home/ubuntu/proj/scratch/billing/learned/session-lifecycle.md -> billing-backend-expert
Source: live
```

**Drift captured (the page is still wrong until the ingestor files this):**
```
Captured: /home/ubuntu/proj/scratch/billing/learned/drift-20260910-query-patterns.md -> billing-backend-expert/query-patterns
Source: wiki+verified
```

**Context fill ≥80% mid-investigation (partial notes written):**
```
Source: live
```
*(no `Captured:`/`Issue:` lines — the partial notes are a prose-only record)*

**Two captures in one dispatch:**
```
Captured: /home/ubuntu/proj/scratch/billing/learned/auth-patterns.md -> billing-backend-expert
Captured: /home/ubuntu/proj/scratch/billing/learned/session-lifecycle.md -> billing-backend-expert/session-lifecycle
Source: live
```

**Issue-only route — the current-state filter routed all content to /capture-issue:**
```
Issue: /home/ubuntu/proj/scratch/issues/dry-run-flag-proposal.md
Source: live
```

**Wiki pollution reported — issue filed and the correction captured:**
```
Captured: /home/ubuntu/proj/scratch/billing/learned/auth-flow-forward-looking.md -> billing-backend-expert/auth-flow
Issue: /home/ubuntu/proj/scratch/issues/auth-flow-refactor.md
Source: live
```

**Ephemeral (cache hit — no trailer, prose only):**
*(no trailer block appears — response ends with the prose answer)*

---

## Fields the Trailer Never Carries

The trailer has no `Status:`, `Wrote:`, `Filing:` or `Wiki:` line. Status is computed from the artifact lines, and this agent writes no wiki pages (D15), so nothing names one.

Correct issue-only emission:
```
Issue: /home/ubuntu/proj/scratch/issues/foo.md
Source: live
```

Correct capture emission:
```
Captured: /home/ubuntu/proj/scratch/proj/learned/foo.md -> domain/slug
Source: live
```

If you find yourself reaching for `Status:` to classify an action, STOP. The schema dropped classification entirely. Emit the per-action artifact line and let orchestrators compute status from the presence/absence of `Captured:` and `Issue:` lines.
