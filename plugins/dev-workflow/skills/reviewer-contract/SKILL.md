---
name: reviewer-contract
description: "Normative contract every reviewer and verifier prompt follows: kill-mandate framing, quote-plus-consequence findings, the would-ship-bug/real-minor/nit severity scale, clean-context inputs, an explicit dimensions-checked-clean list, and the undeliverable-vs-undecided split. Use when writing or rewriting a reviewer or verifier agent, a reviewer prompt file, or a verification skill, and when composing a verdict body — even when the reviewer already has a working verdict format, even when the review found nothing to report."
---

# Reviewer Contract

The single normative copy of the review contract. Every reviewer and verifier
prompt written or rewritten under the current pipeline design follows all six
clauses below. Reviewer agents load this skill through their `skills:`
frontmatter — dispatch prompts carry inputs and cross-run deltas only, never a
copy of these clauses.

**Binds:** `code-verifier`, and every reviewer or verifier prompt authored
after it.

**Not yet migrated:** `codebase-alignment-reviewer`, `domain-reviewer`, and
`security-verifier`. They are scheduled for
re-derivation under this contract at the first retrospective that records a
shallow verdict. Until then they run on their incumbent prompts.

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
  `idea.md`'s `## Contracts & Acceptance` and `## Decisions`; for a build plan,
  `idea.md`; for `idea.md` itself, see the note below).
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
where verification loops burn their budget without changing what ships.

Every finding gets exactly one label. A finding you cannot label is a sign you
have not established the consequence (clause 2) — do that first.

## Verdict body shape

The dispatching agent's `<verdict-body-structure>` owns the literal headings and
the MCP `role`/`status` values. This contract owns what must be present:

- Findings, each with location, verbatim quote, concrete consequence, and — for
  reviewers that label severity — exactly one label from the scale above.
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
