---
name: human-voice
description: "Gate for text a person will read: sets its tier and how it gets drafted free of AI tells — puffery, hollow symmetry, filler transitions, em-dash overuse, fake warmth. Use before writing an email, reply, post, cover letter, bio or marketing copy, or a README, PR description, user doc, changelog or stakeholder update — even when not asked to \"humanize\" and you could write it yourself."
distilled-from: https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing
distilled-on: 2026-07-07
---

# Human Voice

Text a person will read is written by a drafter: a sub-agent that holds the scrub rules and
none of this session's habits. This page classifies the text, routes it to the drafter, and
states the prompt the drafter takes and what it returns. The rules themselves are in
[references/scrub.md](references/scrub.md), which the drafter and its reviewer read. Two
more pages serve a reader of that page and nobody else:
[references/signs-catalog.md](references/signs-catalog.md) when a tell needs its detection
cues and fixes, and [references/examples.md](references/examples.md) when a rewrite needs a
before and after at its tier.

## Classify the tier

Ask one question: **if the reader realized AI wrote this, would the text lose value?**

| Tier | The cost of detection | Scrub intensity | What lands here |
|------|----------------------|-----------------|-----------------|
| **1 — Scrub hard** | Trust, connection, or persuasive force collapses | Maximum | Email and messages sent as the user; replies to real people; social and LinkedIn posts; cover letters; bios; blog posts, marketing, fundraising, opinion: anything meant to move or persuade |
| **2 — Light scrub** | Mild: reads as a bit generic, but still useful | Remove the worst tells | Tutorials, how-to guides, user docs, narrative READMEs, PR descriptions, stakeholder updates, changelogs, general informational prose |
| **3 — Leave it** | None: nobody cares who wrote it | None | API reference, code comments, commit messages, specs, config docs, structured reference |

The trigger is emotional and persuasive weight, not authorship alone: a blog post is a
public product and still `Tier 1`, because it stops persuading once it reads as generated.
Unsure between two tiers, go up one.

`Tier 3` text is yours to write, and the rest of this page does not apply to it.

## Route the draft

Two kinds of reader skip this section, because they are already past it: one sent here by
[references/drafter.md](references/drafter.md) or
[references/structure-audit.md](references/structure-audit.md), and an agent whose own
instructions send it straight to a page under `references/`.

Everyone else with `Tier 1` or `Tier 2` text to write takes the first rung that matches:

1. **An agent whose name ends in `human-voice-drafter` is in your dispatch tool's list.**
   Dispatch it with the prompt below. A drafter that returns that it could not find its
   page counts as no such agent.
2. **You have a dispatch tool (Agent, Task) and no such agent.** Dispatch a
   `general-purpose` agent with the same prompt, opened by one line: `Read {absolute path
   of this skill's references/drafter.md} in full first; it is your whole definition for
   this task.` When it returns that it could not open the page, take rung 3. A caller
   whose own instructions name the agents it may dispatch does what those instructions
   say here, in place of this rung.
3. **You have no dispatch tool.**
   - A sub-agent reads [references/drafter.md](references/drafter.md) and drafts by it.
   - A top-level session asks its user first, and writes nothing until the answer: "No
     drafting agent is available here, so I would write this myself, and the draft would be
     shaped by this session's output style and its other rules. Go ahead?" On a yes it
     reads [references/drafter.md](references/drafter.md) and drafts by it. On a no it
     writes nothing.

## The dispatch prompt

Labeled parts and nothing else. The drafter has no conversation behind it, so everything it
needs is in these parts.

```
Tier: 1 | 2
Reader: {who reads it}
Channel: {email, PR description, README, LinkedIn post, ...}
Shape: {length and parts wanted}
Sources: {file paths, or the facts pasted in}
Voice: {path to a voice file, or the rules pasted in}   # optional
Out: {file to write}                                    # optional
Revise: {draft path or pasted draft}                    # optional; with exactly one of the two below
Change: {your own change}
Findings: {a reviewer's return, unedited}
```

- `Voice:` goes in when the text is sent as a person and your instructions name that
  person's voice file or state their style. Omitted, the drafter falls back on its own default.
- `Out:` omitted, or not writable, the draft comes back as the body of the return.
- `Revise:` with `Change:` is a new draft and gets its own cold read. `Revise:` with
  `Findings:` applies a reviewer's findings and dispatches no reviewer.

## The return

```
Draft: {path, or the draft itself when no file was written}
Audit: {the reviewer's last return, unedited; absent with the block below}
Kept: {tell} "{quoted text}" — {reason}          # one line per finding not applied
Ungrounded: {what the sources did not support}    # or "none"
## Needs structure review                         # only when a cold read was due and none ran
Load the human-voice skill and follow its rule for this block, or pass the block up unchanged.
{the dispatch prompt, part for part, with Out: or the draft itself}
```

**Show the draft as written**, with its `Audit:`, its `Kept:` lines, and its `Ungrounded:`
line when that is not `none`. The draft is the drafter's: a change you or the user want
goes back as a new dispatch with `Revise:` and `Change:`.

## A `## Needs structure review` block

The block means the draft has had no cold read, because its drafter could not dispatch one.
Whoever receives it, at any layer:

1. **With a dispatch tool:** dispatch the reviewer, an agent whose name ends in
   `human-voice-reviewer`, or with no such agent a `general-purpose` agent whose prompt
   opens with `Read {absolute path of this skill's references/structure-audit.md} in full
   first; it is your whole definition for this task.` (a caller whose own instructions
   name the agents it may dispatch does what they say in place of that second form). Its
   prompt is four labeled parts and nothing else, taken from the block: `Draft:`, `Tier:`,
   `Channel:`, and `Recipient:` (the block's `Reader:`). A named reviewer that returns that it could not find its page
   counts as no such agent. A `general-purpose` reviewer that returns that it could not
   open the page leaves you with no dispatch tool: step 4.
2. A return with no table row and no `fail` line is the draft's `Audit:`; show the draft.
   Otherwise dispatch the drafter again with the block's parts plus `Revise:` (the draft)
   and `Findings:` (the reviewer's return, unedited). That pass returns the findings as its
   `Audit:` and no block.
3. After that `Revise:` pass, dispatch the reviewer once more on the revised draft, and
   send a return with any table row or any `fail` line back the same way. Never a third
   review of one draft.
4. **With no dispatch tool:** pass the block up unchanged, at the end of your own return.

## Setup

`ai-lint` is the linter the drafter runs. It is an accelerator, not a dependency:
[references/scrub.md](references/scrub.md) Step 2 covers running it without an install, or
scanning by hand with no tooling at all.

- **Installed CLI:** the skill's `scripts/install.sh` writes a `~/.local/bin/ai-lint`
  walker wrapper.
- **No install (Claude Cowork or any packaged copy of this skill):** the `scripts/` files
  ship inside the skill folder, so `node "<skill-dir>/scripts/ai-lint.mjs"` works wherever
  node is available. A packaged copy carries no agents, so a draft there takes rung 2 or 3.
- **POSIX wrapper:** `scripts/ai-lint.sh` is the thin bash wrapper the installer points
  `~/.local/bin/ai-lint` at; it forwards arguments to `ai-lint.mjs`.
- **Tests:** from the skill folder, `node --test 'scripts/*.test.mjs'`
