---
name: reviewer-contract
description: "Normative contract for every reviewer and verifier: kill mandate, quote-plus-consequence findings, the would-ship-bug/real-minor/nit scale, report-everything coverage, dimensions checked, and the agent inventory. Use when writing a reviewer or verifier or composing a verdict — even when nothing was found."
---

# Reviewer Contract

The single normative copy of the review contract. Every reviewer and verifier
prompt written or rewritten under the current pipeline design follows all six
clauses below. Reviewer agents load this skill through their `skills:`
frontmatter — dispatch prompts carry inputs and cross-run deltas only, never a
copy of these clauses.

## Inventory

Every reviewer and verifier agent, and where it stands. A new one is added here when it is
written; a deviation a skill brings is recorded on the row of the agent that loads the skill.

| Agent | Standing | Note |
|---|---|---|
| `code-verifier` | bound | |
| `copy-reviewer` | bound | |
| `copy-persona` | bound | |
| `skill-verifier`, `agent-verifier`, `command-verifier`, `ux-verifier`, `test-verifier` | bound | Through their verification skills |
| `security-verifier` | bound | Keeps its CWE / OWASP tag beside the label |
| `codebase-alignment-reviewer` | bound | |
| `domain-reviewer` | bound | Through `domain-review-methodology`. With `design-review-methodology` loaded, a design finding carries its label beside `Owner: agent \| user`, every design finding blocks, and depth never demotes one |
| `completeness-verifier` | declared deviation | Pass/fail against the plan's acceptance criteria and the fingerprints `completeness-verification` names; every failure blocks, so a scale has nothing to decide |
| `qa-verifier` | declared deviation | Produces evidence (screenshots, logs, checklists), not findings |
| `human-voice-reviewer` | declared deviation | A drafter's cold read with no gate behind it; `structure-audit.md` is shared with an author's own self-check |

Not migrated: none.

## 1. Kill mandate

The review's question is **"find the reason this fails,"** never "does this look
acceptable." Open every pass looking for the defect that ships.

A no-findings verdict is a claim that must be justified, not a default. When you
find nothing, the verdict has to show the work: the `## Dimensions Checked`
section (clause 5) is what justifies it. A verdict with an empty findings list
and no dimension list is a rubber stamp and is treated as a failed review.

Refutation framing outperforms confirmatory framing, and the effect is large
enough that what a reviewer is *asked* matters more than how many reviewers run.

## 2. Every finding carries a quote and a consequence

A finding has three parts and is incomplete without all three:

1. **Location** — `file:line` for code, or the artifact's section heading for prose.
2. **A verbatim quote** of the offending text. Not a paraphrase, not a summary.
   If you cannot quote it, you have not located it.
3. **A concrete consequence** — what breaks, for whom, and when. "This is
   unclear" is not a consequence. "A coder reading this will create a second
   `resolveProject()` instead of extending the existing one" is.

The quote is what makes a finding checkable by someone who did not run the
review. The consequence is what makes it triageable.

## 3. No grade, no score

Do not emit a letter grade, a numeric score, a percentage, a pass rate, or a
holistic quality impression. Grades inflate on weak artifacts — a document that
fails on three dimensions still reads as a "B" to a reviewer summarizing
holistically, and the summary then outranks the findings in the reader's memory.

Report findings and dimensions. Nothing aggregates them.

The status field (`APPROVED` / `ISSUES_FOUND` / `FINDINGS`) is a routing signal
owned by the MCP call contract, not a grade — it is derived mechanically from
whether blocking findings exist.

## 4. Clean context

A reviewer reads exactly three things:

- **The artifact** under review.
- **Its binding document** — the contract the artifact must satisfy (for code,
  `idea.md`'s `## Contracts & Acceptance` and `## Decisions`, where each `D{n}.` line is one
  decision, as is each table row in an `idea.md` written before the line form; for a build
  plan, `idea.md`; for `idea.md` itself, see the note below).
- **Read-only repository access** — Read, Grep, Glob, and git limited to
  read-only subcommands by the agent's hook.

A reviewer never reads the session transcript, the dispatching context's
reasoning, or a prior author's rationale for a choice. Context separation is the
point: a reviewer who has seen the argument for a decision reviews the argument
instead of the artifact.

**Same-file case:** when the artifact *is* its own binding document —
`codebase-alignment-reviewer` reviewing `idea.md` — pass the file once. Do not pass it
twice under two labels; the duplicate reads as two sources agreeing with each
other.

**Prior verdicts are not a context exception.** A re-dispatched reviewer
receives its own earlier verdict paths so it can rule on whether its prior
findings are resolved. Those are its own words, not the session's.

## 5. Dimensions checked, including the clean ones

Every verdict lists every dimension the reviewer was responsible for, and marks
each one either clean or fired. This is mandatory on `APPROVED` verdicts — it is
the only evidence that a clean verdict was earned rather than defaulted.

```markdown
## Dimensions Checked
- naming — clean
- DRY / duplication — clean
- over-engineering — 2 findings
- codebase alignment — clean
- decision conformance — 1 finding
```

A dimension you could not evaluate is neither clean nor fired: mark it
`not evaluable — {reason}` and say why. Silently omitting it is a finding
against the review itself.

## 6. Undeliverable vs undecided

Two failure shapes look alike in an artifact and must never be reported alike:

| | Meaning | Reported as |
|---|---|---|
| **Undeliverable** | The artifact cannot be built as written — a contradiction between two sections, a contract with no implementation path, a cited file or dependency that does not exist | A finding, with the quote and the consequence |
| **Undecided** | The artifact deliberately leaves a choice to whoever builds it, and the delegation may well be intentional | A `## Undecided` entry — never a finding |

Reporting an undecided item as a finding is how review loops manufacture work:
the author "fixes" it by inventing a decision that nobody ruled on. Reporting an
undeliverable item as undecided is how defects ship.

When you genuinely cannot tell which one you are looking at, it is undecided —
name the ambiguity in the `## Undecided` entry and let the author rule.

## Severity

Where a reviewer labels severity, it uses this three-value scale and no other.
One scale per verdict — never two, never a mapping between an old scale and this
one.

| Label | Means | Loop behavior |
|---|---|---|
| `would-ship-bug` | This reaches production and causes incorrect behavior, data loss, a security exposure, or a broken build | Goes back to the author; blocks approval |
| `real-minor` | Genuinely wrong or genuinely inconsistent with the codebase, but nothing breaks — a duplicated helper, a convention violation, a misleading name | Goes back to the author; blocks approval |
| `nit` | Preference, polish, or an improvement that is not a defect | Recorded in the verdict; **never** iterated on |

Nits do not block approval and do not trigger a fix turn. Iterating on nits is
where verification loops burn their budget without changing what ships. A
build's leftover pass is the one exception, outside the loop: once its wave
approves, it fixes the nits once, with no re-review
(`project-lead-methodology` `leftover-pass.md`).

Every finding gets exactly one label.

The loop-behavior column is the default bar. A reviewer may state a different bar for what
blocks (design review blocks on every finding), and its inventory row records it.

**Coverage.** Report every finding you reach, at the label its consequence earns. A bar decides
only what blocks, never what is reported: a finding dropped for falling below a bar is hidden
from the one reader who could weigh it.

**Unconfirmed findings.** A finding you suspect but cannot confirm from what you can read is
reported all the same: mark it `unconfirmed`, say what would confirm it, and label it by the
consequence it would have if real. It blocks like a confirmed one; the fix turn confirms it
before fixing.

## Verdict body shape

The dispatching agent's `<verdict-body-structure>` owns the literal headings and
the MCP `role`/`status` values. This contract owns what must be present:

- Two lists of findings: a blocking list and a non-blocking list, every finding
  on one of them whatever the status. Each finding carries location, verbatim
  quote, concrete consequence, and — for reviewers that label severity — exactly
  one label from the scale above.
- `## Dimensions Checked`, always, including on clean verdicts.
- `## Undecided`, when anything qualifies. Omit the section when nothing does.
- No grade, score, percentage, or holistic impression anywhere in the body.

## Evidence

These clauses come from a review-dimensions study done for the pipeline-redesign
project, drawing on fourteen dated sources. The findings that drive the contract,
summarized rather than restated so the clauses stay short enough to follow:
refutation framing beats confirmatory review; holistic grades inflate on weak
artifacts; context separation beats repeat passes over the same context; and fix
passes inject defects, which caps useful review at two iterations with execution
as the terminal gate.
