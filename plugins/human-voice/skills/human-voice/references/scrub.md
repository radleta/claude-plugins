# Scrub Rules

Contents: Step 2 — Surface the mechanical tells · Step 3 — Revise for the tells a regex can't catch · Step 4 — Match the person's actual voice · Step 5 — The structure audit and its review · What "done" looks like

The rules a draft is written and checked against. The agent that drafts and the agent that
reviews read this page. Step 1, the tier, is decided before either starts, by the table in
[SKILL.md](../SKILL.md); a `Tier 3` text takes none of these steps.

**Hard constraint: transform style, never fabricate content.** A draft uses only facts in
its sources or the user's input. Never invent an anecdote, statistic, quote, or "I remember
when…" to make text feel personal, least of all in anything sent as a real person. A
human-sounding fabrication is far worse than honest plain phrasing. When the sources give no
real hook, write the shorter, plainer draft and say what could not be grounded.

## Step 2 — Surface the mechanical tells

Write the draft first; don't self-censor mid-sentence. Then scan it for the regex-catchable
tells: filler words (delve, leverage, robust, tapestry), scaffolding phrases ("it's
important to note", "worth noting"), email openers that delay the point ("I wanted to reach
out"), labeled announcements ("One caveat: …"), negative parallelism, em-dash overuse, curly
quotes, emoji, title-case headings, transition openers, and chatbot artifacts ("Certainly!",
"I hope this helps").

The bundled `ai-lint` tool runs this scan. Take the first that your environment has, and
pass the draft's tier:

1. **CLI on PATH:**
   ```bash
   ai-lint --tier 1 draft.md          # or: cat draft.md | ai-lint --tier 1
   ai-lint --tier 2 --json draft.md   # structured output for programmatic gating
   ```
2. **No install — e.g. Claude Cowork or any packaged copy.** The `scripts/` files ship
   inside the skill folder, so run them with node from the skill's base directory:
   ```bash
   node "<skill-dir>/scripts/ai-lint.mjs" --tier 1 draft.md
   ```
3. **No tooling at all (no node, or no shell).** Do the scan yourself: read
   [signs-catalog.md](signs-catalog.md) and check the draft against every item marked 🔧,
   plus the four structural warnings below. The catalog lists every finding the linter
   reports.

The tool prints each tell with a line and column and a concrete fix, and exits `1` when
anything is found. `--tier 1` reports every em dash; at `--tier 2`, or with no flag, dashes
are judged by density. However you scan, fix what it surfaces.

It also **warns** on four structural tells that only show as a pattern across a whole
piece: few contractions against spelled-out forms ("does not", "it is"), frequent
"rather than" / "instead of", semicolons joining a claim to its reversal ("it matters to
me; to a user it's the same thing"), and section after section ending on one shape (a
shared opener, or a trailing ", and …" / ", so …" clause). Warnings never change the exit
code, because formal writing can earn every one of them; judge each against the piece.

One calibration before you fix: no single tell proves AI, and people use every one of
these. What's diagnostic is density: clusters in one passage. Scrub the clusters, and keep
a flagged word when it is the precise choice. The email openers and the chatbot artifacts
are the exception: one is enough, so delete it.

**A clean scan is necessary, not sufficient.** It catches the mechanical tells, never the
judgment-level ones in Step 3. A clean scan hands off to Step 3 and then the structure
audit. The structural warnings are no substitute for that audit: four heuristics cover only
a few of the shapes a reader hears.

## Step 3 — Revise for the tells a regex can't catch

Read the draft as the recipient and fix:

- **Hollow symmetry.** Balanced constructions that sound profound and say nothing: "It's
  not just a tool, it's a philosophy." "More than a product — a promise." Collapse them
  into one direct claim.
- **The rule of three.** Three parallel adjectives or clauses, endlessly: "fast, reliable,
  and scalable." One real detail beats three vague ones.
- **Manufactured warmth.** "I'm thrilled to share…", "I'd love to help you…" when no
  feeling is behind it. Match the real emotional register, which is often neutral.
- **Stacked reassurance.** Two or more reassurance moves stacked in the opener: "Thanks for
  flagging this, you're right, and it's not just you." It takes two or more moves; a single
  one is Manufactured warmth. Keep the one move the facts earn, then start on the point.
- **Compliment opener.** An opening line that praises the recipient or their work before
  the point: "I love what you've built at Acme." Delete it and start on the point.
- **Throat-clearing.** Openings that delay the point: "In today's fast-paced world…",
  "When it comes to X…". Start at the actual first sentence.
- **Over-hedging and over-explaining.** Restating, qualifying, summarizing. A person says
  it once and trusts the reader. Cut the recap paragraph.
- **Even rhythm.** Sentences all medium-length and evenly punctuated. People vary: a long
  winding sentence, then a short one.
- **Asserted instead of shown.** "vibrant," "rich," "meticulous" tell the reader what to
  feel. Replace with the concrete detail that earns the feeling, or cut it.
- **Generic specifics.** Real writing has texture: a name, a number, a moment, an aside. If
  any sentence could appear in anyone's draft about anything, it's filler. For a whole
  message, run the two-words test: could it go to a different recipient with two words
  changed? Then it is a template, and it needs a fact only this recipient shares.
- **More than one ask.** A message that asks for something asks for one thing, small and
  specific: "Worth a 10-minute call Thursday?" Cut the second ask or send it later.
- **Synonym cycling.** Renaming the same thing to avoid repeating a word: "the tool… the
  platform… the solution… the system." Pick one name and keep it.
- **Diff-anchored phrasing.** Describing what *changed* instead of what *is*: "The update
  lets users export" → "Users can export." Fix it in any tier.
- **Staccato drama.** A run of clipped fragments to fake intensity: "No fluff. No filler.
  Just results." One short sentence lands; a stack of them is the tell.
- **Aphorism formulas.** Manufactured profundity: "X is the Y of Z," "not a tool but a
  mirror," "the currency of trust." Delete, or replace with a concrete claim.
- **Fronted participials.** "Leveraging X, the team…", "Having done X, we…" stacked
  through the text. Recast as plain subject-verb sentences.
- **Colon-fronted clauses.** "The useful bit for us: consultants bill the same median."
  One is fine; several in one piece is a template. Recast most as a period or a comma.
- **Sheer length.** After fixing everything else, cut 20–30%. Cut whole parts before
  trimming sentences, in this order: the opener, the paragraph of credentials, the closing
  summary. Ask: would a busy person send something this long?

**Give it a spine.** A pile of co-equal points is the default shape; an argument has each
paragraph depend on the one before it. Build that dependency as you revise.

**Write it the way you'd say it.** Contractions, a sentence starting with And or But, the
occasional one-sentence paragraph, and a semicolon or a parenthesis where a person would
use one: a parenthesis holds a real aside, something the sentence reads whole without.

**`Tier 1` takes no em dash, and no parenthesis standing in for one.** Where a dash would
join two clauses, end the sentence or use a comma. A parenthesis that only does a dash's
job, setting off a clause the sentence needs, is the same tell; a real aside stays.
`ai-lint --tier 1` reports the dashes, and the cold reader checks the parentheses.

For every tell with its detection cues and fixes, see [signs-catalog.md](signs-catalog.md).
For before and after rewrites at each tier, see [examples.md](examples.md).

## Step 4 — Match the person's actual voice (Tier 1)

Removing tells makes text neutral; it does not make it the sender's. For anything sent as
a specific person:

- When the dispatch names a voice file or pastes voice rules, follow them: they are that
  person's stated style, and they outrank the defaults on this page.
- When you have samples of how they write (prior emails or messages among the sources),
  mirror their sentence length, formality, greetings, and sign-offs.
- A filler goes where a person would say one. A filler added to satisfy a style rule is
  itself a tell: "Well, that should do it" reads forced when nothing before it invites a
  pause.
- With no voice rules and no samples, default to plain, direct, and slightly informal.
- Match the channel's register, not only the person's. In Slack, texts, and DMs, people
  write fragments, lowercase openers, and minimal punctuation, and formally perfect prose
  is itself a tell there.

## Step 5 — The structure audit and its review

A skipped Step 3 looks the same as a clean one, and an author rereading its own draft is
anchored to the shape it chose. The structure audit, [structure-audit.md](structure-audit.md),
fixes both: it produces output, and a cold reader runs it. Every `Tier 1` and `Tier 2` draft
gets that cold read once Step 3 and, for `Tier 1`, Step 4 are done.
[drafter.md](drafter.md) says how the drafter dispatches the reader and what it does with
the return.

One case takes the audit as a self-check instead: a draft written inside a pipeline with
its own reviewer gate (the copy suite under `copy-reviewer`). Run the audit page on your own
draft, apply its fixes, and return what the pipeline asks for. That gate covers the piece.

A fix from an audit follows the never-fabricate constraint: apply only fixes that use facts
already in the draft or its sources. A finding you do not apply is reported, never dropped:

`Kept: {tell} "{quoted text}" — {reason}`

A reason of "the sender prefers this" holds only when the voice rules or the user's input
say so.

## What "done" looks like

- `ai-lint` at the draft's tier reports no findings on the final draft, or only ones kept
  for a stated reason.
- Step 3's revision is done: no hollow symmetry, no manufactured warmth, varied rhythm,
  concrete over asserted.
- The cold read ran and its fixes are applied or kept with a reason, or the return says the
  draft had none.
- For `Tier 1`: no em dash, and the voice plausibly belongs to the named person.
