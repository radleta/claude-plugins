---
name: human-voice
description: >-
  Rewrite text to read as human and strip AI tells — puffery, hollow symmetry ("not
  just X, but Y"), filler transitions, em-dash overuse, fake warmth, robotic structure.
  Use WHENEVER text is attributed to a person or meant to persuade or connect: emails
  sent on someone's behalf, replies, messages, social/LinkedIn posts, cover letters,
  bios, blog/marketing/fundraising copy. Reach for it even when not asked to "humanize"
  and even when the draft looks fine — detected AI-ness destroys credibility in anything
  a person signs.
cowork: true
---

# Human Voice

AI text has a smell. Readers can't always name it, but they feel it — and the moment
they sense a machine wrote something a person was supposed to write, they discount the
whole thing. A heartfelt email reads as a form letter. A cover letter reads as low
effort. A blog post loses its authority. The damage isn't the words themselves; it's
the **broken attribution** — the reader expected a person and got a pattern.

This skill does two things: it decides **how hard to scrub** based on what detection
would cost, then it gives you a workflow to actually scrub. The decision matters as
much as the technique — scrubbing affect-free reference docs is wasted effort, and
over-correcting can make consistent technical writing worse.

## Step 1 — Classify the tier (the gate)

Ask one question before touching anything: **if the reader realized AI wrote this,
would the text lose value?**

| Tier | The cost of detection | Scrub intensity | What lands here |
|------|----------------------|-----------------|-----------------|
| **1 — Scrub hard** | Trust, connection, or persuasive force collapses | Maximum | Email/messages sent as the user; replies to real people; social & LinkedIn posts; cover letters; bios; **blog posts, marketing, fundraising, opinion — anything meant to move or persuade** |
| **2 — Light scrub** | Mild — reads as a bit generic, but still useful | Remove the worst tells; don't agonize | Tutorials, how-to guides, general informational prose, narrative READMEs |
| **3 — Leave it** | None — nobody cares who wrote it | Skip the scrub | API docs, code comments, commit messages, specs, config docs, structured reference |

**The key correction most people get wrong:** the trigger is *emotional and persuasive
weight*, not just authorship. A blog post isn't "documentation you can let AI-isms leak
into" — it's persuasion, and the instant a reader smells AI slop it stops persuading.
So anything carrying personal voice, emotion, or an attempt to convince belongs in
**Tier 1**, even when it's a public "product" rather than a private message.

Tier 3 is genuinely safe to leave alone: when the reader only wants correct, scannable
information and doesn't care about voice, the AI patterns (parallel structure, clear
headings, consistent phrasing) are fine — even helpful. Don't burn effort there.

If you're unsure between tiers, go up one. Under-scrubbing attributed text is the
expensive mistake.

## Step 2 — Surface the mechanical tells

Write the draft first; don't self-censor mid-sentence. Then scan it for the
regex-catchable tells: filler words (delve, leverage, robust, tapestry), scaffolding
phrases ("it's important to note", "worth noting"), negative parallelism, em-dash
overuse, curly quotes, emoji, title-case headings, transition openers, and chatbot
artifacts ("Certainly!", "I hope this helps").

**The bundled `ai-lint` tool automates this scan, but it's an optional accelerator — the
skill works fully without it.** Pick whichever fits your environment:

1. **CLI on PATH** (installed via `init-repo.sh --user-install`):
   ```bash
   ai-lint draft.md          # or: cat draft.md | ai-lint
   ai-lint --json draft.md   # structured output for programmatic gating
   ```
2. **No install — e.g. Claude Cowork or any packaged copy.** The `scripts/` files ship
   inside this skill folder, so run them directly with node (use this skill's base
   directory, given to you when the skill loaded):
   ```bash
   node "<skill-dir>/scripts/ai-lint.mjs" draft.md
   ```
3. **No tooling at all (no node).** Do the scan yourself: read
   [references/signs-catalog.md](references/signs-catalog.md) and check the draft against
   every item marked 🔧. The catalog lists exactly what the linter checks, so a careful
   manual pass reaches the same result — it just takes more attention.

Each tool prints the tell with a line/column and a concrete fix, and exits `1` when
anything is found (so it can gate a workflow). However you scan, fix what it surfaces.

**A clean scan is necessary, not sufficient.** It only catches the obvious mechanical
tells, never the judgment-level ones in Step 3. Don't stop here.

## Step 3 — Revise for the tells a regex can't catch

These are what actually make text feel human. Read the draft as the recipient and fix:

- **Hollow symmetry.** AI loves balanced constructions that sound profound and say
  nothing: "It's not just a tool, it's a philosophy." "More than a product — a promise."
  Collapse them into one direct claim.
- **The rule of three.** Three parallel adjectives or clauses, endlessly: "fast,
  reliable, and scalable." One real detail beats three vague ones.
- **Manufactured warmth.** "I'm thrilled to share…", "I'd love to help you…" when no
  actual feeling is behind it. Match the real emotional register — often that's neutral.
- **Throat-clearing.** Openings that delay the point: "In today's fast-paced world…",
  "When it comes to X…". Start at the actual first sentence.
- **Over-hedging and over-explaining.** AI restates, qualifies, and summarizes. A person
  says it once and trusts the reader. Cut the recap paragraph.
- **Even rhythm.** AI sentences are all medium-length and evenly punctuated. Humans vary:
  a long winding sentence, then a short one. Break the metronome.
- **Asserted instead of shown.** "vibrant," "rich," "meticulous" tell the reader what to
  feel. Replace with the concrete detail that earns the feeling — or cut it.
- **Generic specifics.** Real human writing has texture: a name, a number, a moment, an
  aside. If any sentence could appear in anyone's draft about anything, it's filler.
- **Synonym cycling.** AI renames the same thing to avoid repeating a word — "the tool…
  the platform… the solution… the system." Pick one name and keep it; the variation reads
  as evasive, not elegant.
- **Diff-anchored phrasing.** Describing what *changed* instead of what *is*: "The update
  lets users export" → "Users can export." Common even in otherwise-clean reference docs,
  so fix it in any tier.
- **Staccato drama.** A run of clipped fragments to fake intensity: "No fluff. No filler.
  Just results." One short sentence lands; a stack of them is the tell. (The flip side of
  even rhythm — vary, don't swing to the other extreme.)
- **Aphorism formulas.** Manufactured profundity: "X is the Y of Z," "not a tool but a
  mirror," "the currency of trust." Delete, or replace with a concrete claim.
- **Fronted participials.** "Leveraging X, the team…", "Having done X, we…" stacked
  through the text (AI uses these 2–5× as often as people). Recast as plain
  subject-verb sentences.

**Structural audit — the reshuffle test.** Could you swap two body paragraphs without
breaking the logic? If yes, the piece is a pile of co-equal points, not an argument —
AI's default shape. Give it a spine: each paragraph should depend on the one before it.

Then apply the **read-aloud test**: would a person actually *say* this out loud to the
recipient? If a phrase only survives on paper, it's an AI tell. Rewrite it the way you'd
say it. AI also *avoids* semicolons and parentheses — a well-placed one of either reads
distinctly human, so add them where they fit.

**Then self-critique — don't skip this.** Reread the result and ask plainly: *what here
still reads as AI?* Name the two or three worst offenders specifically, then fix exactly
those. This short adversarial pass catches what a single editing sweep misses.

**Hard constraint: transform style, never fabricate content.** Humanizing changes *how*
text reads, using only facts already in the draft or the user's input. Never invent an
anecdote, statistic, quote, or "I remember when…" to make text feel personal — especially
in anything sent as a real person. A human-sounding fabrication is far worse than honest
AI phrasing.

For full detail on every tell, with detection cues and fixes, see
[references/signs-catalog.md](references/signs-catalog.md). For before/after rewrites at
each tier, see [references/examples.md](references/examples.md).

## Step 4 — Match the person's actual voice (Tier 1)

Removing AI-isms makes text *neutral*; it doesn't make it *theirs*. For anything sent as
a specific person, go further:

- If you have samples of how they write (prior emails, messages, their CLAUDE.md style
  notes), mirror their sentence length, formality, greetings, and sign-offs.
- Honor stated style rules. For example, this user (see global CLAUDE.md) wants: succinct
  but polite, no "Dear"/"I hope this finds you well" openings, no closing phrase before
  the signature, occasional fillers like "well" or "you know," sign off as "Richard."
- When you have no samples, default to plain, direct, and slightly informal — that reads
  as human far more reliably than polished-and-balanced does.

## What "done" looks like

- Tier classified, and effort matched to it (you didn't over-scrub a Tier 3 doc or
  under-scrub a Tier 1 one).
- `ai-lint` reports no findings — or only ones you've consciously kept for a reason.
- The Step 3 judgment pass is done: no hollow symmetry, no manufactured warmth, varied
  rhythm, concrete over asserted.
- For Tier 1: the voice plausibly belongs to the named human, not to "an assistant."

## Setup (optional)

`ai-lint` is an optional accelerator, not a dependency — Step 2 covers running it without
an install, or skipping it entirely.

- **Installed CLI:** the skill's `scripts/install.sh` writes a `~/.local/bin/ai-lint`
  walker wrapper; the repo's `./init-repo.sh --user-install` sweeps it in.
- **No install (Claude Cowork or any packaged copy of this skill):** the `scripts/` files
  ship inside the skill folder, so `node "<skill-dir>/scripts/ai-lint.mjs"` works wherever
  node is available — nothing to install.
- **Tests:** `node --test '.claude/skills/human-voice/scripts/*.test.mjs'`
