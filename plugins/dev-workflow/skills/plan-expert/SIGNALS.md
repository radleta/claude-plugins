---
summary: Reviewer signal list for step-quality-reviewer — fires-when patterns per artifact type, content-shape conventions, and rubber-stamp rejection rules.
tags: [plan-expert/signals]
---

# SIGNALS.md — Artifact-Required Signal List

This page defines the combinatorial signals that `step-quality-reviewer` applies when deciding whether a plan step requires an `## Artifact: <type>` declaration. Signals are guidance for an LLM reviewer's judgment, not regex patterns — the reviewer reads the step's full text and applies context to evaluate whether a signal genuinely fires.

**How the reviewer applies this page:**

1. Read the step file in full.
2. For each artifact type, evaluate the step text against the corresponding `fires-when` signals.
3. Apply the signal threshold rule (see below) to decide whether to fire the artifact-required check.
4. If the check fires and no `## Artifact:` heading is present, return `ISSUES_FOUND missing-artifact-heading`.
5. If the check fires and `## Artifact: none` is present, validate the rationale against the `## Artifact: none Rules` section in this page.

**Signal threshold:** the artifact-required check fires if EITHER (a) any single signal fires with high confidence (the step text clearly contains the pattern), OR (b) ≥2 distinct signals from any artifact type's list appear with moderate confidence. Borderline single-signal-weak-confidence cases are NOT REJECTED but emit an Implementation Note suggesting the author confirm with `## Artifact: none` + rationale.

---

## Fires-When Signals

### State-Matrix

```
artifact-type: state-matrix
fires-when (signals):
  - "modify" / "change" / "update" + reference to existing state machine, status enum, or transition logic
  - ≥2 enum/state values interact combinatorially in a single decision
  - "promotion path" / "transition" / "state change" / "demote" / "consensus stall" -style language
  - `switch` or chained `if/elif` over status enums in code touched by the step
miss-example: "Rename `getUserById` to `findUserById` — pure rename, no logic change." (Touches no state machine, no transition language, no enum logic — signal does NOT fire.)
ensures-on-fire: reviewer requires `## Artifact: state-matrix` heading on the step OR `## Artifact: none` heading with substantive rationale that addresses the firing signal
```

### Decision-Table

```
artifact-type: decision-table
fires-when (signals):
  - ≥3 distinct cases/paths/branches in the step's logic
  - N×M mapping (e.g., subtype × condition, role × permission)
  - Case-sensitivity / exact-match / fuzzy-match enumerated comparisons
  - "for each X, the system Y…" catalog-style descriptions
miss-example: "Update the loading spinner color from gray to blue." (Single outcome, no conditional branching, no N×M mapping — signal does NOT fire.)
ensures-on-fire: reviewer requires `## Artifact: decision-table` heading on the step OR `## Artifact: none` heading with substantive rationale that addresses the firing signal
```

### Method-Contract

```
artifact-type: method-contract
fires-when (signals):
  - Step synthesizes / constructs / introduces a new public method or interface
  - Description uses pre/post-condition language ("must accept", "throws when", "guarantees that")
  - Multiple distinct inputs whose combinations affect output shape
miss-example: "Delete the unused `legacyFormatDate` helper — no callers remain." (Removes a method rather than introducing one; no pre/post-condition language; no input combinations to reason about — signal does NOT fire.)
ensures-on-fire: reviewer requires `## Artifact: method-contract` heading on the step OR `## Artifact: none` heading with substantive rationale that addresses the firing signal
```

### Sequence-Diagram

```
artifact-type: sequence-diagram
fires-when (signals):
  - ≥3 actors/components/services interact (see actor definition below)
  - Async message ordering matters ("first X, then Y, then Z")
  - Distributed protocol with retries, acks, or timing constraints
actor-definition: "actor" means external system, service, or autonomous component — NOT internal function calls within a single process. A 3-layer call stack (function → module → library) within one process does NOT count as multi-actor interaction.
miss-example: "Step calls helper A which calls helper B — all within the same service, no external actors." (All calls are intra-process; no external services; no async ordering constraints — signal does NOT fire.)
ensures-on-fire: reviewer requires `## Artifact: sequence-diagram` heading on the step OR `## Artifact: none` heading with substantive rationale that addresses the firing signal
```

### Invariants

```
artifact-type: invariants
fires-when (signals):
  - "must always" / "never" / "every X has" / "the system maintains"
  - Cross-cutting property held across multiple operations
  - Data structure invariant (e.g., "this list is always sorted")
miss-example: "Bump the `lodash` dependency to 4.17.21 to address the CVE advisory." (Dependency bump with no runtime behavioral property asserted — signal does NOT fire.)
ensures-on-fire: reviewer requires `## Artifact: invariants` heading on the step OR `## Artifact: none` heading with substantive rationale that addresses the firing signal
```

---

## Content Shape Conventions

When the reviewer validates a declared artifact's body content, the expected shape per type is:

| Artifact type | Expected body content shape |
|---|---|
| `state-matrix` | Markdown table with rows = states, columns = events (or rows = states, columns = transitions). Every cell filled — including unreachable / N/A cells marked explicitly. |
| `decision-table` | Markdown table with rows = condition combinations, columns = outcomes. Every row enumerated. |
| `method-contract` | Fenced code block (any language tag or none). Contains `requires:` / `ensures:` / optionally `invariants:` / `throws:` lines as comments. |
| `sequence-diagram` | ` ```mermaid sequenceDiagram ``` ` fenced block. Renders natively in markdown previewers. |
| `invariants` | Bulleted list of cross-cutting properties. Each bullet is a positive ("X always holds") or negative ("Y never happens") proposition. |
| `none` | Substantive rationale prose explaining why the touched code has no captured combinatorial structure. Must satisfy the criteria in `## Artifact: none Rules` below. |

Content-shape violations are reported as `type-content-mismatch`. For example: declaring `## Artifact: state-matrix` with a bulleted list in the body (invariants shape) is a mismatch — the declared type requires a markdown table, not bullets.

---

## Artifact: none Rules

### Acceptable cases (with substantive rationale)

A step may declare `## Artifact: none` when the rationale body demonstrates one of:

**(a) Signal-refusal:** The rationale cites at least one combinatorial signal pattern from `## Fires-When Signals` in this page and explains why it does NOT apply to this step (e.g., "Matches the state-machine signal because the file contains a status enum, but the state set is degenerate — single state, never transitions. No combinatorial structure to capture.").

**(b) Structurally non-combinatorial classification:** The rationale demonstrates one of the following by inspection:
- **Cosmetic / formatting / whitespace** — no logic touched.
- **Docs/comment-only** — no runtime behavior affected.
- **Config-only with no runtime branching** — the config key has a single value type and no conditional dispatch.
- **Single-purpose pure function with deterministic output and no combinatorial inputs** — the function's behavior is fully determined by one scalar input with no branching paths.

The rationale must confirm the non-combinatorial classification is established by inspection of the actual code, not asserted as a category without evidence.

### Rubber-stamp rejection cases

A step declaring `## Artifact: none` is rejected (`ISSUES_FOUND rubber-stamp-rationale`) when:

- Rationale matches neither criterion (a) nor (b) AND uses one of the rubber-stamp phrases: "pure refactor", "trivial change", "small edit", "minor tweak", "obvious".
- The step text fires combinatorial signals AND the rationale asserts "pure refactor" / "trivial change" without showing by inspection that no combinatorial structure is present.

A step is rejected with `ISSUES_FOUND weak-rationale-no-classification` when the rationale matches neither criterion (a) nor (b) AND uses no rubber-stamp phrase — the rationale simply fails to establish a non-combinatorial classification.

**Clarification:** A rationale that satisfies criterion (b) is APPROVED regardless of phrase style. A rationale like "pure refactor — config-only change with no runtime branching" satisfies criterion (b) and is APPROVED; the phrase "pure refactor" alone does not trigger rejection when the (b) classification is substantively provided.

---

## See Also

- [Artifacts](ARTIFACTS.md) — Per-type artifact templates and selection table; SIGNALS.md fires-when signals dictate when each ARTIFACTS.md type is required.
- [Step-Quality Reviewer Prompt](step-quality-reviewer-prompt.md) — Dispatch prompt that Reads SIGNALS.md at validation time and applies the rules defined here.
- [Plan Quality](PLAN-QUALITY.md) — Plan grading rubric; the spec-phase Artifact Coverage checklist there is governed by combinatorial-completeness-reviewer, while plan-step artifacts (governed by SIGNALS.md) are validated by step-quality-reviewer.
