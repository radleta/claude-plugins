# {Project Name} — Brainstorming

**Status:** In Progress
**History:** [`changelog.md`](./changelog.md) — every ruling, alternative, and superseded text lives there, not here. This file states the current design only.

## Problem
{Why this exists — the user's actual pain point or goal, not the solution}

## Context
{Current state, what exists today, what triggered this work}

## Constraints & Assumptions
- {constraint or assumption}

## Scope
**In:** {what we're building}
**Out:** {what we explicitly decided NOT to build, and why}

## Decisions
_One row per decision. The rationale is one sentence saying why the chosen option holds — not an argument against the options that lost. Those, and the alternatives themselves, go in `changelog.md`._

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|

## Contracts & Acceptance
_Binding for implementation. Interface contracts between the parts, at least one real-input, end-to-end acceptance outcome per major deliverable, and the test commands the build runs. Never grep counts, string-presence checks, or synthetic-input-only gates. An outcome that must be seen running in a browser is marked `verify-live:`._

### Contracts
- {unit boundary, CLI/API shape, or data format another part depends on}

### Acceptance Outcomes
- {given this real input, this observable end-to-end behavior}

### Tests
- `{command, run from the repository root}` — {what it proves}

## Open Questions
_Empty when the design is approved. The build executes decisions; it does not discover them._

- [ ] {question}

## Risks & Unknowns
- {risk or unknown}

## Failure Modes
_Known failure surfaces with planned design intent, in `category: design implication` form. Target 3–7 entries. Open uncertainties go in Risks & Unknowns._

- {failure category}: {design implication / how the design handles or accepts this}

## Implementation Notes
_What the build needs that the design should not argue: a reviewer's non-blocking note, a trap in the existing code, a seam two parts must spell the same way._

- {note}

## Must Not Appear
_Literal strings the build must not introduce, one per line, backticked. The lead greps every checkpoint's diff for each. Leave empty when there are none._

- `{literal}`

## Dependencies
- {dependency or integration point}

## Notes
{Overflow — preferences stated, edge cases, random insights}
