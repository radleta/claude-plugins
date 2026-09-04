---
tags: [investigation, wiki, output-format, trailer-schema, D20]
summary: "Bimodal return contract and trailer schema for the researcher: Wiki/Issue/Drift/AutoHeal/Source field grammar, per-path conditions, enum definitions, and orchestrator parsing anchors. Layer 3: pure artifact-listing, no Status/Wrote classification fields."
---

# Output Format

The researcher has two return modes (bimodal contract, D8). Which mode fires depends on whether a persistence event occurred during the dispatch. Both modes end with prose — only persistence mode appends a structured trailer.

---

## Bimodal Return Contract

| Mode | When | Output |
|------|------|--------|
| **Persistence mode** | Any artifact line was emitted: a wiki page was written, an issue file was written, a drift was detected and recorded, or a D6 auto-heal action ran | Prose + trailer (inline at end) |
| **Ephemeral mode** | No artifacts: pure cache hit (wiki answered fully, no drift, no write) OR 3-filter rejected (insight not worthy) OR borderline → `learned/` file only (D39) | Prose only — no trailer |

**D39 borderline clarification:** Writing a borderline `learned/` file is classified as a side effect, NOT a persistence event. The trailer does NOT fire for borderline paths. Orchestrators will not see a trailer — this is correct behavior.

---

## Prose-Content Rules

Prose is the researcher's primary channel to the caller. These rules govern what prose MUST contain, independent of what was persisted:

1. **Prose answers the caller's question comprehensively**, independent of what was persisted. Prose content is never limited by the ephemeral/persistence mode split.
2. **Prose MUST include any forward-looking content** extracted to `/capture-issue` — the caller sees what was routed to the issue tracker and why.
3. **Prose MUST include 3-filter rejects** that are relevant to the caller's question — if an insight was not worthy of the wiki, the caller still learns from it.
4. **Prose MUST include any D6 auto-heal actions taken** — the caller sees what content was moved from the wiki and where it was filed.
5. **Prose MUST NOT defer to "see trailer for details"** — the trailer is for orchestrators. Prose must be self-contained for human readers.

---

## Trailer Schema

When persistence mode fires, the trailer appears inline at the **end** of the prose response, separated from prose by a blank line. Fields appear in this fixed order:

```
Wiki: <domain>/<slug> (created|updated)
Issue: <absolute-path>
Drift: <domain>/<slug>
AutoHeal: {category}={domain}/{slug}->{target}
Withheld: <domain> (<one-line reason>)
Source: wiki | wiki+verified | live
```

- `Wiki:` appears **once per wiki page written**, format `<domain>/<slug> (created|updated)`. Replaces the pre-Layer-3 `Filing:` field. If two wiki pages were filed in one dispatch, two `Wiki:` lines appear. Absent entirely when no wiki pages were filed (e.g., issue-only route, drift-only, fallback learned, or investigation-incomplete without wiki write).
- `Issue:` appears **once per issue file written**. One `Issue:` line per issue file. Present on issue-only routes (Filter 4 extracts all forward-looking content and no current-state content survives 3-filter) and on D6 misclassification heal paths. `Issue:` is always the absolute path to the filed issue file.
- `Drift:` appears **when a D4 drift heal was applied to a wiki page WITHOUT writing a new wiki page**. Format `<domain>/<slug>` of the drifted wiki page. Absent when no drift was detected or when a new wiki page was also written for the corrected content. Do NOT emit `Drift: (none)` when no drift occurred — absence is the signal.
- `AutoHeal:` appears **only when a D6 auto-heal action was performed** during investigation. Absent otherwise — do NOT emit `AutoHeal: (none)` when no action ran. One `AutoHeal:` line per action; `{category}` is `drift` or `misclassification`; `{target}` is the `/capture-issue` file path for `misclassification` or literal `(none)` for `drift`. Example: `AutoHeal: drift=billing-backend-expert/query-patterns->(none)` — `billing-backend-expert/query-patterns` is the WIKI page identifier (domain + slug) where the drift was detected. The `{domain}/{slug}` slot MUST be the wiki page identifier, never the drift's content values or arbitrary text.
- `Withheld:` appears **only when the Dispatch Contract's write-path override fired** — an insight cleared the 3-filter but its subject lay plainly outside the resolved domain's scope, so filing was declined. Format `<domain> (<one-line reason>)`, where `<domain>` is the resolved domain that was NOT written to — the wiki **folder name**, never the dispatcher's raw `Project:` value. For `Project: acme-billing` the folder is `acme-billing-expert`, so `Withheld: acme-billing` is wrong. Mutually exclusive with `Wiki:` for the same insight. Absent when nothing was withheld — do NOT emit `Withheld: (none)`. See `SKILL.md` § `### Write-path authority` for when the override is permitted.
- `Source:` is **always present when the trailer fires**. Values: `wiki | wiki+verified | live`. See Source enum below.
- No other lines appear between the trailer fields.

**No `Status:` field.** No `Wrote:` field. Both are dropped in Layer 3. Orchestrators compute status from the artifact lines: presence of `Wiki:` = wiki filed; presence of `Issue:` without `Wiki:` = issue-only; presence of `Drift:` = drift heal applied; presence of `AutoHeal:` = D6 heal ran; presence of `Withheld:` = an insight cleared the 3-filter but filing was declined (distinct from no trailer at all, which means nothing cleared the 3-filter). No classification step = no misclassification.

---

## Line-Anchor Regexes (Orchestrator Parsing)

Orchestrators parse the trailer using these line anchors:

| Field | Regex | Cardinality |
|-------|-------|-------------|
| `Wiki:` | `^Wiki: ` | 0+ |
| `Issue:` | `^Issue: ` | 0+ |
| `Drift:` | `^Drift: ` | 0+ |
| `AutoHeal:` | `^AutoHeal: ` | 0+ |
| `Withheld:` | `^Withheld: ` | 0+ |
| `Source:` | `^Source: ` | exactly 1 when trailer fires |

**Orchestrator-parsing note:** Orchestrators MUST treat unknown trailer fields as optional — the line-anchor regex approach already handles this, since an unrecognized `^Key: ` line simply produces no match for known keys. `AutoHeal:` is absent when no D6 cleanup ran; orchestrators must not require its presence. Do NOT emit `AutoHeal: (none)` to signal the no-action case — absence is the signal. Same rule applies to `Wiki:`, `Issue:`, `Drift:`, and `Withheld:` — all are optional; absence signals "not applicable."

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
| Cache hit, no write, no drift | **NO** | — |
| 3-filter clear-pass + wiki write succeeds | **YES** | 1+ `Wiki:` lines |
| 3-filter rejects (insight not worthy) | **NO** | — |
| 3-filter borderline → `learned/` file (D39) | **NO** | — |
| D4 drift detected, page rewritten with corrected content | **YES** | 1 `Drift:` line + optionally 1 `Wiki:` line if a new slug was filed |
| Context fill ≥80% mid-investigation, partial notes written | **YES** | (no Wiki/Issue/Drift lines; `learned/` write is prose-only record — Source: live) |
| `wiki-write` fails, fallback `learned/` written | **YES** | (no `Wiki:` line — the fallback `learned/` path is the prose-only record; Source: live) |
| D6 auto-heal action performed | **YES** | 1+ `AutoHeal:` lines + the underlying `Wiki:` and/or `Issue:` lines for the heal artifacts |
| Issue-only route (Filter 4 extracts everything, no wiki page filed) | **YES** | 1+ `Issue:` lines, NO `Wiki:` |

**Fallback path note:** When `wiki-write` fails and the researcher writes a fallback `learned/` file, the trailer fires with `Source: live` and no `Wiki:` line. The prose describes what happened and where the fallback was written. Orchestrators distinguish a true wiki-file write from the fallback path by checking for the presence of at least one `^Wiki: ` line: `Source: live` with zero `Wiki:` lines = fallback or issue-only path; `Source: live` with one or more `Wiki:` lines = successful wiki-page write.

---

## Complete Trailer Examples

**Wiki write succeeded:**
```
Wiki: billing-backend-expert/query-patterns (updated)
Source: live
```

**Wiki-write failed, fallback learned file written (no Wiki: line):**
```
Source: live
```
*(no `Wiki:` line — prose describes the fallback path)*

**Drift detected (page rewritten, no new slug):**
```
Drift: billing-backend-expert/query-patterns
Source: wiki+verified
```

**Context fill ≥80% mid-investigation (partial notes written):**
```
Source: live
```
*(no Wiki/Issue/Drift lines — `learned/` write is prose-only record)*

**Multiple wiki pages filed in one dispatch:**
```
Wiki: billing-backend-expert/auth-patterns (created)
Wiki: billing-backend-expert/session-lifecycle (updated)
Source: live
```

**Issue-only route — Filter 4 routed all content to /capture-issue:**
```
Issue: /home/ubuntu/proj/scratch/issues/dry-run-flag-proposal.md
Source: live
```

**D6 misclassification heal — wiki page updated + issue filed:**
```
Wiki: billing-backend-expert/auth-flow (updated)
Issue: /home/ubuntu/proj/scratch/issues/auth-flow-refactor.md
AutoHeal: misclassification=billing-backend-expert/auth-flow->/home/ubuntu/proj/scratch/issues/auth-flow-refactor.md
Source: live
```

**Ephemeral (cache hit — no trailer, prose only):**
*(no trailer block appears — response ends with the prose answer)*

---

## AutoHeal Field Examples

The `{domain}/{slug}` portion of `AutoHeal:` always identifies the WIKI page where the drift or misclassification was detected — never the content values that drifted.

**Correct — drift case:**
```
AutoHeal: drift=billing-backend-expert/query-patterns->(none)
```
- `billing-backend-expert/query-patterns` = the wiki page's `{domain}/{slug}`
- `(none)` is literal, signaling no separate file was emitted for the drift target

**Correct — misclassification case:**
```
Wiki: billing-backend-expert/auth-flow (updated)
Issue: /home/ubuntu/proj/scratch/issues/auth-flow-refactor.md
AutoHeal: misclassification=billing-backend-expert/auth-flow->/home/ubuntu/proj/scratch/issues/auth-flow-refactor.md
Source: live
```
- `billing-backend-expert/auth-flow` = the wiki page where misclassified forward-looking content was removed
- `/home/ubuntu/proj/scratch/issues/auth-flow-refactor.md` = the `/capture-issue` file where that content was rehomed
- `Wiki:` and `Issue:` lines appear alongside `AutoHeal:` — they are the artifact lines for the heal actions

**Incorrect — drift values in slot:**
```
AutoHeal: drift=phantomFunction/5000->(none)
```
This is wrong. `phantomFunction` and `5000` are drift content (a fictional function name and a stale port number), not a wiki page identifier. The slot must be `{wiki-domain}/{wiki-slug}`.

---

## Anti-Pattern: Status/Wrote/Filing Fields (deprecated)

The pre-Layer-3 schema used `Status:`, `Wrote:`, and `Filing:` fields. All three are DROPPED. Do NOT emit:

```
Wrote: /home/ubuntu/proj/scratch/issues/foo.md   ← WRONG: dropped field
Status: filed                                    ← WRONG: dropped field
Status: issue-only                               ← WRONG: dropped field
Filing: domain/slug (created)                    ← WRONG: renamed to `Wiki:`
```

Correct issue-only emission:
```
Issue: /home/ubuntu/proj/scratch/issues/foo.md
Source: live
```

Correct wiki-write emission:
```
Wiki: domain/slug (created)
Source: live
```

If you find yourself reaching for `Status:` to classify an action, STOP. The schema dropped classification entirely. Emit the per-action artifact line and let orchestrators compute status from the presence/absence of `Wiki:`, `Issue:`, `Drift:`, and `AutoHeal:` lines.
