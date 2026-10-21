# {Project Name} — Brainstorming

**Status:** In Progress
**History:** [`changelog.md`](./changelog.md) — every ruling, alternative, and superseded text lives there, not here. This file states the current design only.
**Ticket:** `scratch/issues/{slug}.md` {the build issue this design was invoked for, then each issue the step 1 sweep added, every path backticked and comma-separated on this one line — drop this whole line when there is none; `/implement-code` Step 1 greps this exact prefix for its held check and 6b to find every ticket, and `/close-issue` greps it to find the build that closes them}

## Problem
{Why this exists — the user's actual pain point or goal, not the solution}

## Context
{Current state, what exists today, what triggered this work}

## Architecture
_The parts, how they connect, and the seams between them, at systems altitude. Opens with the system flowchart, drawn as [`design-record`](../design-record/SKILL.md) gives, when the design names a seam; one with no seam of its own says so in one sentence. Then as few paragraphs as the design allows. Every claim here traces to a `## Decisions` line, an epic decision, a cited file, or an entry under `### Agent judgments`._

{the system flowchart, its one-sentence caption, then the parts and seams the picture does not show}

### Agent judgments
_Every call the agent made where no ruling and no finding decided it: one sentence stating the call, then one sentence starting "Reverse by". When the user rules on one, it leaves this list and becomes a `## Decisions` line in the user's words. One the user never objects to stands._

- {the call}. Reverse by {the alternative}.

## Constraints & Assumptions
- {constraint or assumption}

## Scope
**In:** {what we're building}
**Out:** {what we explicitly decided NOT to build, and why}

## Decisions
_One numbered decision line each, in the shape [`design-record`](../design-record/SKILL.md) gives. The `because` clause is one sentence saying why the chosen option holds — not an argument against the options that lost. Those, and the alternatives themselves beyond the one an agent would try, go in `changelog.md`. A line picked from options ends with the lens it was picked on and the strongest losing lens, in parentheses._

- D1. {the choice}, not {the alternative an agent would try}, because {why it holds} (picked on {lens}; strongest losing lens: {lens}).

## Contracts & Acceptance
_Binding for implementation. Interface contracts between the parts, at least one real-input, end-to-end acceptance outcome per major deliverable, the test commands the build runs, and the signals it emits. Never grep counts, string-presence checks, or synthetic-input-only gates. An outcome that must be seen running in a browser is marked `verify-live:`._

### Contracts
- {unit boundary, CLI/API shape, or data format another part depends on}

### Acceptance Outcomes
- {given this real input, this observable end-to-end behavior}

### Tests
- `{command, run from the repository root}` — {what it proves}

### Signals
- {one signal the built thing emits while it runs, and the acceptance outcome it shows; when the `Signals tier:` judgment says none, replace this bullet with the plain line `None`}

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
