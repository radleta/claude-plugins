---
name: agent-voice
description: >-
  Variance pass for instructions an agent runs: map the branches, prune, disclose, bound every
  step, sharpen words and pointers. Use when writing or revising anything an agent runs, and
  every file one points at — a `SKILL.md`, a `CLAUDE.md`, a dispatch prompt — hardest when steps
  finish early, rules apply unevenly, or a pointer misfires. Prose a person reads is a different
  test.
---

# Agent Voice

A document can read beautifully and still send the agent down a different path every run. This
pass is about the path.

## Branches

Three shapes, and the pass runs differently on each. Branch on shape rather than on packaging:
the packaging differs and the writing does not. Name your target's shape before Step 1.

- **Sequence** — ordered steps. Step 4's *clarity* half carries the weight, and splitting by
  sequence is available.
- **Flat reference** — rules and definitions consulted on demand. Step 4's *demand* half
  carries it. Splitting by sequence does not apply.
- **Pointer** — a context pointer with no body attached, the object Step 6 defines. That step
  alone.

Most targets are a sequence plus reference and run the whole pass. A one-branch target — a
recipe where every line applies to every run — leaves Step 3 little to move.

## Step 1 — Map the branches (the gate)

A **branch** is a distinct case the document handles, so that different runs take different
paths through it. Read the document end to end and list its branches before changing anything.

Everything downstream reads off this list. Disclosure tests against it, pointers enumerate it,
and splitting cuts along it.

**Record the test that selects, not only the name.** A document that names three tooling
environments and then says *pick whichever fits* has a branch point with no rule, and that is
where two runs part company. Where the list turns up a branch point the document never decides
— a command to probe, an ordered fallback, a condition to check — the pass gives it one.

**Done when:** the list is written down, every distinct case you met while reading end to end
appears on it, and every branch point on it either names the test that selects between its
branches or is marked as needing one.

## Step 2 — Prune

Prune before placing anything, because pruning shrinks what you then have to arrange.

1. **No-ops.** Sentence by sentence, ask whether the line changes behavior against the model's
   default. The test is model-relative, not reader-relative: a disagreement about a no-op is settled by running the document. When a sentence fails, delete the whole sentence rather than trim words from it.
   The model is the one that runs the text: the version the agent pins, or the session model
   for a main-session skill. Read its row in `claude-code-expert`
   `model-prompting/instruction-detail-by-model.md` for what that model already does. When the
   pin moves, re-run the test on the new model, since a line that steered the old one may be a
   no-op, or a misfire, on the new.
2. **Duplication.** Each meaning gets one authoritative place, so changing the behavior stays a
   one-place edit. A meaning held in two places costs maintenance and tokens, and inflates its
   apparent rank on the ladder past its real one. Repeating a *leading word* is the exception
   and the point — the second site invokes the word, and only the first site defines it. One
   definition and many invocations is the word working; two definitions is the defect.
3. **Cached lookups.** The environment is a source of truth too: `package.json` scripts, config
   files, the directory layout, `--help` output. A document restating one is a cache, and a
   cache earns its load only when the lookup is expensive. Keep what the agent cannot find by
   looking — the unwritten convention, a reason that survives question 5, the gotcha no config
   confesses. Leave one-command lookups to the environment, where they cannot go stale.
4. **Relevance.** Does the line still bear on what the document does? A line loses relevance by
   never bearing on the task, or by going stale as the behavior it describes changes. Unpruned,
   these settle as *sediment*: layers kept because adding feels safe and removing feels risky.
5. **Reasons.** Judge a reason clause by clause, not passage by passage. Delete the clause and
   ask whether the agent would handle a case the rule does not name differently.
   - **Kind 1**, yes: it stays inline beside its rule.
   - **Kind 2**, no, and its reader is a maintainer defending or dating the design: evidence,
     measurements, rejected alternatives, history, the date of a ruling. It leaves the
     instruction. With an expert wiki page behind the document, a choice's reason moves to the
     page's `## Decisions` as `X, not Y, because Z` ([`design-record`](../design-record/SKILL.md)),
     `not Y` the alternative an agent would try, the rest to `changelog.md`; the rule points
     there only for a case it leaves out for length. Evidence, measurements and history stay in
     the commit. With no wiki behind it (a dispatch prompt, or a `CLAUDE.md`, agent, command or
     skill no expert wiki backs) it is cut, and the commit is its citation.
   - **Kind 3**, no, and it has no reader, because it names no mechanism and no concrete
     consequence — nothing that breaks, nothing the agent would do wrong. This is *emphasis*:
     cut it, whether or not it says "because".

   Split a passage that mixes kinds: the kind 1 clause stays and the rest moves or goes.

**Done when:** every sentence has been asked questions 1-4, every reason clause question 5, and
every survivor has an answer you could state out loud.

## Step 3 — Place every piece on the information hierarchy

Two content types mix freely: **steps** (the ordered actions the agent performs) and
**reference** (definitions, rules, facts consulted on demand). The **ladder** ranks material by
how immediately the agent needs it:

| Tier | What sits here |
|---|---|
| In-file step | What the agent does, in order. The primary tier. |
| In-file reference | Consulted on demand. Often a legitimately flat peer set, which is a fine arrangement rather than a smell. |
| Disclosed reference | A separate file reached by a context pointer, loaded only when that pointer fires. |

**Branching is the disclosure test.** Inline what every branch needs; push behind a pointer
what only some branches reach. Push too little down and the top bloats; push too much and the
agent cannot find material it actually needs. Disclosure moves material rather than copying it:
what stays behind is a pointer carrying the branch condition, and nothing else.

When a disclosure would create a new file rather than fill one that exists, price the addition
with `two-loads.md` before making it.

**Sprawl** is the failure mode: a document too long even when every line is live and unique.
Attention thins across the excess. Where a
document has steps, in-file reference that should be disclosed buries them, and attending to
them turns into a coin flip. That makes disclosure a variance lever, not only a legibility one.

**Number steps only where order or completeness matters.** A numbered list earns its numbers
when doing step 3 before step 2 breaks something, or when the agent must account for every item.
A list that only restates method ("read the file, understand it, make the change, check it")
becomes one goal line with a checkable done-condition. Arithmetic over several steps moves into
a script the document runs, since a model doing it in prose drifts where a script does not.

**Co-locate once placed.** The ladder decides how far down a piece sits; co-location decides
what sits beside it. Keep a concept's definition, its rules, and its caveats under one heading,
so reading one part brings its neighbours with it. The test: the document should read like
documentation written for the agent. Scattering is distinct from duplication — duplication
repeats one meaning in two places, scattering fragments one meaning across many.

**Done when:** every piece sits on a named tier, and every disclosure choice cites a branch
from Step 1.

## Step 4 — Bound every step

Every step ends on a **completion criterion**, the condition telling the agent the work is
done. Two properties make it a lever.

**Clarity.** Can the agent tell done from not-done? A vague bound such as "understanding
reached" invites **premature completion**: ending the step before it is genuinely done,
attention slipping toward being done. Sharpen the bound, which is local and cheap. Only when it
stays irreducibly fuzzy *and* you observe the rush is splitting the sequence the remedy left. It
spends a budget, so read `two-loads.md` before making the cut.

**Demand.** How much does the criterion require? "Every modified model accounted for" forces
thorough work where "produce a change list" does not. Demand drives the digging the agent does
inside the work, latent in the wording rather than written as its own step. It is not
step-bound: "every rule applied" binds a body of flat reference exactly as "every step done"
binds a sequence, which is how an all-reference document still carries an exhaustiveness bar.

Point demand at a branch that exists. A criterion demanding thorough work on a branch the
target does not have manufactures a fruitless hunt that feels like diligence.

**Self-review, evidence step, verifier.** Three ways a document can ask for checking, and only
two survive the pass:

- A **self-review** asks the model to re-read its own output for defects ("check your work",
  "review your changes before reporting"). Current models already do this; the line is a no-op
  that spends tokens and invites a rubber stamp. Cut it.
- An **evidence step** produces something observable: run the tests, invoke the primitive, take
  the screenshot, name the command and its result in the report. Keep it; it is often the
  sharpest completion criterion a step can have.
- **Verify** and **verifier** mean a separate review in a fresh context, a sub-agent that never
  saw the work being done. Keep it. A `verify-*` name always means this.

**Done when:** every step carries a criterion you could check without rereading the step, and
the document carries one exhaustiveness bar even where it is all reference.

## Step 5 — Sharpen the language

**Reach for a leading word.** A leading word is a compact concept already living in the model's
pretraining that the agent thinks with while running the document: *lesson*, *fog of war*,
*tracer bullets*. Repeated as a token and never as a sentence, it accumulates a distributed
definition and anchors a whole region of behavior in very few tokens, by recruiting priors the
model already holds. Coining your own works when you define it clearly, but a made-up word
recruits no priors: you pay in definition tokens what a pretrained word gives free. Reach for an
existing word first.

In the body it anchors execution: the agent reaches for the same behavior every time the word
appears, and inside flat reference it focuses attention on a class of thing to look for.

**Hunt for restatements a leading word retires.** A triad spelled out at three sites, a pointer
spending a sentence gesturing at one idea. "Fast, deterministic, low-overhead" becomes *tight*.
"A loop you believe in" becomes *red*, turning a fuzzy gate into a binary observable state. Hunt
where the vocabulary is loose and stop where it is already disciplined, since hunting past that
point manufactures work that feels thorough and changes nothing.

**State the target behavior.** Steering by prohibition drags the forbidden behavior into
context and makes it *more* available: say *don't think of an elephant* and the elephant is all
there is. Write the positive, so the unwanted behavior is never spoken. A prohibition earns its
place as a hard guardrail you cannot phrase positively, and even then it carries the positive
target beside it so attention lands on what to do.

An anti-pattern or "Don't" list holds no entry that restates the body. An entry the body
already covers is cut; an entry with no home in the body becomes a positive rule there; a hard
guardrail stays, with its positive target beside it.

**Emphasis markers need a consequence.** Caps (`CRITICAL`, `MUST`, `NEVER`), `IMPORTANT`,
`HARD-STOP`, emoji and stacked exclamation marks stay only where they guard a failure that has
happened, and the text names what breaks when the rule is skipped. Otherwise the marker goes
and the sentence stays. An exact output string may keep `EXACTLY`.

Grade every leading word against Step 2's no-op test. *Be thorough* loses to a model that is
already thorough-ish. The fix is the concrete behavior the word reached for (*read every
changed file in full*, *trace each changed function's callers*), never a stronger adjective,
which fails the same test the same way.

**Done when:** every rule states a target behavior, each surviving prohibition carries its
positive target beside it, every surviving emphasis marker names its consequence, every
leading word beats the default, and the restatement hunt has produced either a collapse or a
stated reason the vocabulary is already disciplined.

## Step 6 — Sharpen the pointer

A **context pointer** is a reference held in the agent's context that names out-of-context
material and encodes the condition for reaching it. A skill's `description` is one. A line in
`AGENTS.md` naming a doc is the same object.

**The pointer's wording, not its target, decides when the agent reaches the material, and how
reliably.** A must-have target behind a weakly worded pointer is a variance bug. Sharpen the
wording first, and inline the material only when sharpening fails.

A pointer does two jobs: state what the material is, and list the branches that should trigger
reaching it. Every word of an always-loaded pointer spends *context load* on every turn, so it
earns harder pruning than the body:

- Front-load the leading word. In a pointer it anchors invocation: when the same word lives in
  your prompts, your docs, and your codebase, the agent links that shared language to the
  material and reaches it more reliably. Invocation is usually where the larger gain sits.
- One trigger per branch. Synonyms that rename a single branch are one branch written twice —
  a list of packagings is the common case — so collapse them and keep the genuinely distinct
  ones.
- State identity as a closure, not a list. An enumeration of packagings under-covers by
  construction: you are always one packaging behind. Name the class, then add the clause that
  closes it — *and every file one points at*, *and anything reached from one* — so the pointer
  stays true when the next packaging appears. Literal packagings are the one exception to the
  collapse above: keep at most three, and keep them in the identity clause beside the class name
  rather than in the trigger list, chosen as the tokens a discovery pass is likeliest to match
  on.
- Carry a suppression clause. A pointer listing only what should reach it has no way to say
  what should not, and a false fire spends a whole document on a turn with no use for it. Name
  the nearest neighbour the pointer must not reach and say it is a different test.
- Cut identity the body already carries.

**Done when:** the pointer front-loads a leading word, carries exactly one trigger per Step 1
branch, and names one thing it should not reach.

## Step 7 — Diff against the document you started with

Steps 2 through 6 all write. Writing is where a revision pass reintroduces the defects it
exists to remove, and none of them are visible from the new text alone: they are visible only
beside the old. Diff the finished document against the pre-edit copy and check three things.

1. **Every disclosure moved, none copied.** Material pushed behind a pointer must be gone from
   where it was. Count the lines present in both the parent and the child and state the number.
   Text living in both is the copy defect.
2. **You changed how the document instructs, not what it instructs.** A revision pass has no
   mandate to add rules, and none to drop them either. Adding is the obvious direction, but a
   rule can leave the same way: deleted outright, or replaced by a vaguer instruction that
   sounds like a rule and binds nothing.
3. **Every pointer aimed at what you moved still lands.** Disclosure breaks inbound references by
   construction: anything citing the material by filename, heading, or line number now points at
   the wrong place. Search the surrounding corpus for the moved headings, not only the moved file.

**Done when:** the diff has been read end to end, and checks 1 and 3 each have a number
attached rather than a verdict. Check 2 produces two lists, written out: every rule the
finished document carries that the original did not, and every rule the original carried that
the finished document no longer does. On a pass that only changed *how*, both lists are empty,
and an empty list written out is a fine result. An absent list is not a check, and a check
reported as passed is not evidence that it ran.

## What "done" looks like

**These conditions bind this pass, not the document you are revising.** They are checks you
run and never rules you write into the target. A revision pass that transcribes its own closure conditions into the document it is revising has added rules nobody decided on.

Each step's **Done when** is checked at that step. This list carries only the conditions that
span the whole document, which no per-step bar can reach:

- The Step 1 branch list is still true of the document you now have. Editing changes what the
  document handles, so re-read the finished document against the list before you stop.
- No meaning this pass introduced has two homes. Disclosure splits material and Step 5 collapses
  restatements; both write new text, and new text is where a second home appears.
- The pointer's triggers still match the branch list after the edits.

## Pointers

- `two-loads.md` — context load and cognitive load, and when a cut earns one.
- `human-voice` — the companion pass for text a person signs. Different lane, different test.
- `plain-english` output style — the terminal-reply lane. A rule belongs there only when it must
  fire without being asked for; a rule that survives being looked up belongs in a skill.
