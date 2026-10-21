---
name: discuss-methodology
description: "Interview the user relentlessly about a plan, decision, or design until nothing is left unasked. Use when resolving a /discovery interview spike, naming an epic's destination, stress-testing thinking, or when asked to grill someone on an idea — even when round one looks settled."
---

# Discuss — Interviewing a Decision to the Bottom

Interview the user until you reach a shared understanding. Not until you have an answer — until
there is nothing left unasked.

The unit of state is a **design tree**: every decision branches into the decisions that hang off
it. You do not know the whole tree at the start, and you are not meant to. You learn it by asking.

**No install, no tooling.** The protocol is the whole skill, so it runs anywhere Claude runs —
Claude Cowork or any packaged copy included. Where it talks about reading the filesystem or the
git history, that is one way to source a fact, available only where there is a repository to
read; without one, ask the user for the fact and carry on.

<one-round-is-the-failure priority="CRITICAL-READ-FIRST">
**One round is not a discussion.** The defect this skill exists to prevent is asking a batch of
questions, getting answers, and stopping — because the answers looked like they settled it.

They did not. An answer settles its own question and **unlocks the ones underneath it**. If you
stop at round one you have collected the user's opening position and called it a decision.

You are done when the frontier is empty, not when you have enough to act on.
</one-round-is-the-failure>

## The Question Frontier

The **question frontier** is every decision whose prerequisites are already settled: the questions
you can ask *now* without guessing at answers you have not heard yet.

Ask the whole frontier in one round. Then wait.

Each answer reshapes the tree. Settled decisions push the frontier outward and unblock questions
that depended on them. Recompute the frontier and ask the next round.

**A question whose answer depends on another question still open in this round belongs to a later
round, not this one.** Asking it now forces the user to answer twice — once on a guess, once for
real — or forces you to invent the prerequisite yourself.

## Round Format

Number every question and give your recommended answer on each, after its options. The
recommendation is not optional — an unanswered "what do you think?" costs the user a turn and
tells them nothing about what you already know.

```
## Q1. <question title>

<the question, and the context it needs>

<the lens-tagged options, if the space is enumerable>

**Recommendation.** <your recommended answer, and why>

---

## Q2. <question title>

<the question — a prose question with no enumerable space>

**Recommendation.** <your recommended direction, and why>
```

**Each question is a heading, not a bold span.** Where the `plain-english` output style is active,
it caps bold at four spans per reply and says a reply needing more structure than that needs headings; a round of three
questions that each bold a number and a title spends six spans before the answers start. Pick the heading level that sits one below whatever the reply already uses.

**Spend the bold budget on the recommendations.** `**Recommendation.**` is a lead-in that names a
block and is followed by new detail, which is the one form the output style permits, and it leaves
the question titles to headings. Four questions is therefore the practical ceiling for one round.
Past that, drop the label to a blockquote so the round stays inside the cap.

**Offer choices when the space is genuinely enumerable, and prose when it is not.** For an
enumerable question, load `options-rubric` and write the options and the recommendation by it. A
question with no pre-framed answers at all is still a question — write it as prose and recommend a
direction.

Where `AskUserQuestion` is blocked, asking in response text is the only mechanism.

## Finding Facts Is Your Job, Never the User's

Never ask the user for anything you could look up. A question that a `grep` answers is not a
decision, and putting it to the user spends their turn on your homework.

When a frontier question needs a fact from the environment — the filesystem, the git history, what
some code actually does — dispatch for it:

| Need | Dispatch |
|---|---|
| An investigation whose product is a summary, or a finding worth persisting | `researcher`, where installed; otherwise `Explore` |
| A broad sweep across many files where you only want the conclusion | `Explore` |

**Hold the round until it returns.** No question reaches the user while a dispatch runs; where the
`plain-english` output style is active, its § Decision requests owns that rule. Fold the finding in, then ask
the whole frontier as one round.

## The Decisions Are the User's

You find the facts. The user makes the calls.

<never-answer-your-own priority="CRITICAL">
**An agent that answers its own questions has broken this skill.** Recommending an answer is
required. Recording your recommendation as the decision, because the user did not push back or
because the round was going slowly, is not a shortcut — it is the failure mode, and nothing
downstream can detect it.

If the user's answer is ambiguous, ask again. If they decline to rule, record that they declined.
Never fill the gap yourself.
</never-answer-your-own>

## When You Are Done

The session ends when the frontier is empty: every branch of the design tree visited, nothing left
silently assumed.

**Then confirm.** Say what you understand the shared conclusion to be and wait for the user to
agree before acting on it. An empty frontier is your judgment that you asked everything; the
confirmation is theirs that you asked the right things.

## Where This Skill Stops

This skill produces a shared understanding. It does not record one.

The caller records the outcome in whatever artifact it owns.

## Not To Be Confused With `interview-methodology`

Both ask batched, numbered questions and never label an option ruled-out. They are not
interchangeable.

| | `discuss-methodology` | `interview-methodology` |
|---|---|---|
| Job | Open a decision and work it to the bottom | Close a decision that is already understood |
| Shape | A design tree worked over many rounds | One batch, capped at 5 questions |
| Options per question | By `options-rubric` when the space is enumerable; none for a prose question | By `options-rubric`, on every question |
| Ends when | The question frontier is empty and the user confirms | The Convergence Declaration shows no `Unlocked` entries |

Reach for `interview-methodology` when the option space is already known and the job is to pick.
Reach for this skill when the option space is what you are trying to discover.

They compose: a discussion that bottoms out on one choice among known options can close that
choice with an option batch. What does not work is starting with the option batch — that is
choosing among answers before knowing whether they are the answers.

## Anti-Patterns

1. **Don't stop after one round.** The single most likely failure. Answers unlock questions; if
   round two is empty, say so and show why, rather than never computing it.
2. **Don't ask a question whose prerequisite is still open in the same round.** It belongs to the
   next round. Asking it now makes the user answer on a guess.
3. **Don't ask the user for a fact.** Dispatch for it, and hold the round until it returns.
4. **The lenses are the search, not a count.** Write enumerable options by `options-rubric`;
   never invent an option to reach a count.
5. **Don't answer your own question.** Silence is not agreement, and a slow round is not consent.
6. **Don't pre-slice the tree.** You cannot chart branches you have not reached. Ask the frontier
   you have.
7. **Don't act on an empty frontier without confirming.** The user agreeing that you understood
   them is the exit, not your own judgment that you did.

## Pointers

- `discovery` — the stage that calls this skill for `interview` spikes and for naming a
  destination, and that owns recording the result.
- `interview-methodology` — the option-batch protocol for closing a decision whose options are
  already known. See the comparison above before choosing between them.
- `researcher` (where installed), `Explore` — the agents that find facts so the user does not have to.
