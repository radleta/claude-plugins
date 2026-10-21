---
name: options-rubric
description: "Lens rubric for options put to the user: lenses, price lines, the recommendation. Use when writing the options for any question to the user, recommending one, or choosing the lens a design strawman is drafted on — even for one question with two obvious answers. Running the batch protocol is interview-methodology, and opening an undecided question is discuss-methodology: different tests."
---

# Options Rubric

A **lens** is one value an option can optimize. Options are generated lens by lens, so each one
serves a different value instead of varying one value measure, and the recommendation is written
after the options it weighs, because the tokens above it shape it.

## Lenses

This section is the single normative copy of the lens vocabulary. Every other file points here
and restates no lens name, value, distinction or firing test.

**Fixed lenses** run on every question, in this order:

| Lens | Optimizes |
|---|---|
| literal ask | what the user said, taken at their word |
| simplest | the least to build and to understand now |
| codebase fit | what the repository already does: its patterns, names and homes |
| long-term investment | what pays off over the life of the thing: one home per meaning, structure later work builds on |

**Situational lenses** run only when their test fires:

| Lens | Optimizes | Fires when the decision |
|---|---|---|
| reversible | the cheapest to undo | is expensive to undo: a rename, a published artifact, a schema or data format, pushed commits |
| defer | building nothing until it is needed | has no current dependent and a trigger that would reopen it can be named; the option is not viable without that trigger |
| operator experience | what a person or agent sees and does while running the thing | changes what a person or agent sees or does while running the thing: output, prompts, hook behaviour |
| context cost | the least an agent loads | changes what an agent loads every time: skill length, always-loaded files, dispatch prompts |

Three pairs collapse easily:

- **reversible** is cost to undo, where **simplest** is cost to do.
- **literal ask** is what the user said, where **codebase fit** is what the repo does.
- **defer** builds nothing, where **simplest** builds the least.

## Generating the options

1. **Run the lenses in order:** the fixed lenses, then each situational lens whose test fires.
   Name the lens, then write the option that lens produces for this decision. Done when every
   lens in the run has a drafted option or a stated reason it produced nothing viable.
2. **Draft every lens before presenting any.** An option presented before the others are drafted
   anchors the rest.
3. **Prune.** An option you would rule out is dropped, never listed with a ruled-out label: the
   user may pick any listed option, and then the design carries the flaw you saw. Options that
   converged on the same design become one option carrying every lens that produced it.
4. **Write out the convergence.** When pruning merged or dropped anything, say so in one line
   naming the lenses: "Simplest and codebase fit converged on Option B; defer produced nothing
   viable." Silence reads as a search that never ran.

Three viable options is the floor, with no ceiling. Fewer than three is correct only when the
convergence line accounts for the lenses that were lost; the floor is pressure to search, never a
reason to pad the list.

**Each listed option carries its lens tag and one price line**, "wins on X, pays in Y":

```
- Option B (simplest, codebase fit): <the option>. Wins on <X>, pays in <Y>.
```

## The recommendation

The recommendation comes after every option and the convergence line, never before them. It
names:

- the option and the lens it was picked on,
- why this decision needs that lens's value,
- the strongest losing lens and what it would have given.

```
**Recommendation:** Option B, on simplest: <why this decision needs that value>. Strongest losing
lens: long-term investment, which would have given <what>.
```

The recommendation is argued in prose. A numeric score ("simplest=8, total=17/20") hides the
reason the lens won, so it never appears.

`interview-methodology` § Examples, Example 1, is a filled-in batch in this shape: lens tags,
price lines, a convergence line, and a recommendation last naming the strongest losing lens.

## Choosing a strawman lens

The one form of the lens question, asked when a design strawman is about to be drafted and no
lens is recorded for it. The options are the fixed lenses plus each situational lens whose test
fires for this work, each argued as the design that lens would produce for this work, in the
display shape above. The recommendation follows them. "You pick" is a valid answer: unless the
caller says otherwise, choose the lens yourself and record it as your judgment, never as the
user's ruling and never as an issue's `lens:` key, which only the user's own words naming that
lens for that issue write (`user-decision-rubric` § Recording a ruling).
