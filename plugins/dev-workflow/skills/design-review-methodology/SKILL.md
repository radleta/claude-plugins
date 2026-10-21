---
name: design-review-methodology
description: "Design review of an idea.md on four frames: contradiction between sections, seam completeness, claim provenance and design-record form, each finding owned by the agent or the user. Use when a dispatch names /design-review-methodology or an idea.md needs its draft or closing design check — even for a first-round strawman. Code-versus-wiki review is architecture-methodology: a different test."
---

# Design Review Methodology

## Contract

This skill supplies the *frames* and the *finding format*. The `reviewer-contract`
skill supplies the *conduct*: kill mandate, quote-plus-consequence findings, no
grade, clean context, a dimensions list, and the undeliverable-vs-undecided split.
Load both.

Two deviations, stated so they are not read as drift. On every other point of
apparent difference, the reviewer contract wins.

- **Every finding blocks.** Each finding carries a `would-ship-bug` or `real-minor`
  label beside `Owner: agent | user`, never `nit`: a finding in these frames is a
  defect in the design, and the caller needs both how much it costs and who has to
  act on it.
- **No `## Dimensions Checked` or `## Undecided` heading.** This review is written
  into a per-domain verdict section that allows no heading of its own. The same
  content goes under bold labels instead: `**Frames checked:**` always, and
  `**Undecided:**` when anything qualifies under the reviewer contract's clause 6. A
  call listed under `### Agent judgments` is decided, not undecided.

## Inputs

Read `idea.md` in full, and the epic it cites on its `**Epic:**` line when it has one.
Read nothing else. A file `idea.md` cites is an origin for a claim; checking what that
file says is the codebase-alignment review's job, not this one.

The epic's `## Decisions` are the user's rulings, as are `idea.md`'s own `## Decisions`
lines (rows, in an `idea.md` written before the line form). Together they are the whole rulings list.

## Frames

Every finding belongs to exactly one frame. Walk them in this order, because a
contradiction is undeliverable and the other frames assume a coherent document.

**Frame 1: contradiction.** Any two sections of `idea.md` say incompatible things:
`## Architecture` against `## Scope`, a `## Decisions` line against `## Contracts &
Acceptance`, `### Agent judgments` against `## Constraints & Assumptions`, and every
other pair. Read the whole document for it, not only `## Architecture`. Quote both
sides; a contradiction with one quote is unlocated.

**Frame 2: seam completeness.** A seam is a place where one part of the architecture
hands something to another: a file one writes and the other reads, a field one emits
and the other routes on, a call and its return. For each seam `## Architecture` names
or implies, both sides are specified somewhere in the document: who produces, who
consumes, and the shape that crosses. A seam with an unspecified side is a finding.
The altitude check rides here: `## Architecture` stays at systems altitude, so a
paragraph of line numbers, exact wording, or field-by-field detail there is a finding
whose fix is moving it to `## Contracts & Acceptance` or `## Implementation Notes`.

**Frame 3: provenance.** Every claim in `## Architecture` traces to one of four
origins: a `## Decisions` line, an epic decision, a file the document cites, or an
entry under `### Agent judgments`. A claim with none of the four is invented filler,
and the finding names it. The usual fix is listing it as an agent judgment, which is
why a strawman with no rulings behind it passes this frame as long as its calls are
listed.

**Frame 4: form.** Load `design-record` and check `idea.md` against it: each decision is a
numbered line in its shape, a legacy table excepted; `## Architecture` opens with a flowchart when
it names a seam, and says so in one sentence when it names none; every diagram keeps
`design-record` § Diagram rules, carrying no count, step number, date, status mark, roster, colour
or before/after half, and no prose in the same section repeats it; and no section says what the
design used to be. A form finding is `real-minor` and `Owner: agent`, since the rubric decides its
fix.

**Shape is not a frame.** Whether the architecture is the right one, whether another
decomposition would serve better, whether a part should exist at all: those are the
user's calls. A verdict carrying an opinion on them has left its frames, whatever the
wording. When a claim looks wrong rather than unsourced, the review's question is only
whether it traces, contradicts, or leaves a seam open.

## Owner

Every finding carries `Owner: agent | user`, assigned by `user-decision-rubric`'s kept calls and
tests; load it for them.

- **`user`** when the fix is a kept call, chiefly `reversal`: two rulings contradict each
  other, or a ruling leaves a seam open that no agent edit can close without changing the
  ruling. Also when a test sends the fix to the user: it would change the design's scope, or
  rest on taste or a fact only the user holds that no record settles.
- **`agent`** in every other case, and whenever you cannot tell. A finding wrongly
  marked `agent` is fixed and reported to the user in plain language, where they can
  still veto it; one wrongly marked `user` costs them a turn unconditionally.

## Finding format

Findings go in an `**Issues:**` bullet list, that exact label. Each bullet carries, in
this order after any prefix the dispatching reviewer requires:

1. the frame: `contradiction`, `seam`, `provenance`, or `form`
2. the label: `would-ship-bug` when building the document as written yields a wrong
   or broken result (a contradiction the builder must pick a side of, a seam whose
   sides will not meet); `real-minor` when the build comes out right but the document
   misleads (unsourced filler, a detail at the wrong altitude)
3. `Owner: agent` or `Owner: user`
4. the quoted `idea.md` text, verbatim, with its section
5. the consequence: what the build or the user's review gets wrong because of it

**Right:**

```
- seam — would-ship-bug — Owner: agent — "the reviewer's findings are routed by main" (§ Architecture) — neither the reviewer nor main is given the field main routes on, so the builder invents one and the two sides spell it differently
```

**Wrong:**

```
- [Architecture] The routing is underspecified and could be clearer. (seam, agent)
```

Why wrong: the section comes first and there is no quote, so nobody can check it; the
frame and `Owner` trail as an afterthought; there is no label; and "could be clearer"
names no consequence.

A contradiction finding quotes both sides, each with its section, in slot 4.

**Depth does not demote.** Every finding is an `**Issues:**` bullet at every depth,
whatever non-blocking list the dispatching reviewer keeps for other skills.

**Order.** Report every finding, the most consequential first by the frame order above.

**Status.** Any finding makes the section `Issues Found`. None makes it `Approved`,
and then `**Frames checked:**` is the evidence the pass was earned.

## Frames checked

Always present, one line per frame:

```
**Frames checked:**
- contradiction — clean | 2 findings | not evaluable — {reason}
- seam — ...
- provenance — ...
- form — ...
- shape opinion held — none
```

The last line is the review attesting it stayed in frame. A frame is `not evaluable` only
when the section it reads is missing: no `## Architecture` leaves seam and provenance
nothing to check.

## Kill conditions

These are retirement tests for this skill, not conduct for a review run. The dispatching
workflow records the counts across runs, and a single review holds none of them; when
any one fires, the skill is reconsidered rather than patched. Only the first run at each
review point counts; a re-check run is logged in the dispatching
workflow's `process-notes.md` and never counted.

1. Zero design-changing findings across four runs.
2. A build whose unplanned work traces to a contradiction the review ran past.
3. More than one in three `Owner: user` findings ruled "my ruling stands".
4. A round-one review slower than redrafting the strawman.
5. Any verdict carrying a shape-quality opinion.
