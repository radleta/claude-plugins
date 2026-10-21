# The review loop

Every review in this flow runs this loop. A **review point** is reached when the batch is
final: no question to the user is pending, every ruling is written into `idea.md`, and, from
step 3 on, `## Open Questions` is empty. There are three kinds: step 2's gate on
`## Architecture`, step 4's closing review on the finished document, and every return to step 4
after a batch of the user's rulings changed `idea.md`. A ruling that changes nothing reaches no
review point. The batch-final test gates the first pass only: re-checks run while user-owned
questions are held, because those questions have not been sent.

At each review point, with the fix-pass count at 0, send the user nothing until the loop reaches **Exit**:

1. **First pass.** Run `mermaid-check scratch/{project}/idea.md` first: reviewers may run only
   read-only `git`, so the parse check is yours. Exit `1` lists each block that fails to parse;
   fix each inline as an agent-owned finding and re-run until it exits `0`. Exit `69`, or
   `mermaid-check` absent from PATH, is not a pass: say "Mermaid check skipped" in the **Exit**
   message. Then take the next `{ITER}` and dispatch both reviewers in ONE message with
   parallel Agent calls, with no `## Your Prior Verdicts` block (tiers: `dispatch-tier-rubric`):
   - `codebase-alignment-reviewer`, prompt from
     [codebase-alignment-reviewer-prompt.md](codebase-alignment-reviewer-prompt.md);
   - `domain-reviewer`, prompt from [domain-reviewer-prompt.md](domain-reviewer-prompt.md).
2. **Route** every verdict the pass returned (§ Routing findings below). A user-owned finding is
   held as a question, unsent. An agent-owned finding is fixed inline; moving a non-blocking
   finding into `## Implementation Notes` is not a fix. After each fix, grep `idea.md` for every phrase,
   value or rule the fix replaced, and fix each other section that still carries it as part
   of the same fix, so the re-check reads one consistent document; a match inside a
   `## Decisions` line (or a legacy table row) is held as a question, not edited. When a fix adds a new state, exit
   path or contract clause, add that case in the same fix to every table and contract in
   `idea.md` that lists states or exits (exit-code tables, status contracts, rollback
   triggers, acceptance outcomes): re-check findings land mostly in text the last fix added.
   When this pass applied any fix, add 1 to the count and go to **Re-check**; when it applied
   none, go to **Exit**. Go to **Exit** instead once the count reaches 5, or once every finding
   of a re-check sits in text the previous pass's fixes added: fixes then mostly chase their own
   edits. A finding in older text keeps the loop running up to the cap. The fixes of the pass
   that stopped the loop are still applied; they are not re-checked.
3. **Re-check.** Take the next `{ITER}` and re-dispatch only the reviewers whose verdict drove a
   fix in **Route**, each with `## Your Prior Verdicts` listing its own verdict paths from this
   review point. Return to **Route** with the new verdicts. Re-checking only those reviewers
   is intended: a fix made for one reviewer reaches the other at the next review point.
4. **Exit.** The loop exits here and nowhere else: every reviewer the last pass dispatched
   returned clean, or its findings were all held, or the loop stopped early or at the cap. The
   loop's fixes, in plain language, and its held user-owned questions go to the user in one
   message, at the step that ran the loop. Only a user-owned finding reaches them as a question,
   and none is dropped.

Every pass is one review run, and each gets one line in the flow's dated idea-loop entry in
`process-notes.md`: `first` or `re-check`, the review point, its design-changing findings, its
`Owner: user` findings and how many of those the user ruled "my ruling stands", and whether its
`shape opinion held` line read anything but `none`.

**`{ITER}` is the project's running count of review runs.** Before every pass, read the highest
`iteration:` among `scratch/{project}/reviews/idea/*.md` and add 1; with no verdict on disk it
is 1:

```bash
grep -h '^iteration:' scratch/{project}/reviews/idea/*.md 2>/dev/null | awk '{print $2}' | sort -n | tail -1
```

Reading it from disk, never from memory, is what keeps a `/clear` or `/pickup` mid-brainstorm
from reusing or skipping a number. Every reviewer dispatched in one pass shares that pass's
value.

## Routing findings

Each reviewer returns two lines, `Wrote:` and `Status:`. Read every verdict body, `APPROVED`
ones included, since each carries a blocking and a non-blocking list of labelled findings
(`would-ship-bug`, `real-minor`, `nit`); the review loop is the only place main reads a
verdict.

Owner: user-decision-rubric (tests), deciding every finding's owner at every pass and when the
loop stops.

- **`design-review-methodology` findings route on `Owner` alone.** `agent`: fix it inline now,
  move the replaced text to `changelog.md`, and report the change to the user in plain
  language at the loop's **Exit**. `user`: a question to the user under `interview-methodology`, held until the loop
  exits, carrying the reviewer's quote, its consequence and your recommendation.
- **Every other finding carries no `Owner`, and you apply the rubric yourself.** A fix that is a
  kept call (chiefly `reversal`: overruling a `## Decisions` line, an epic decision, or what the
  user said) or that a test sends to the user is a question, held the same way; any other fix
  is agent-owned, and you make it inline and report it at **Exit**.
- **Non-blocking findings** never hold the loop open. One that matters to the build moves into
  `idea.md`'s `## Implementation Notes`; a `nit` is never iterated on.

The user's ruling on a question is terminal.
