---
name: builder-contract
description: "Normative contract binding every builder agent and every dispatch prompt one reads: reading discipline, baseline-then-after tests, checkpoints, the destructive-git ban, the self-check, the scope and reporting rules, and the forms of `facts.md`, the coder baton and the run card. Use when writing or rewriting a builder — `coder`, `implementer`, a builder dispatch prompt — and while implementing as one, even for a one-file change, even when the deliverable is markdown. Reviewing rather than building is `reviewer-contract`: a different test."
---

# Builder Contract

The single normative copy of the contract every builder in this repo follows.
Builder agents load this skill through their `skills:` frontmatter — dispatch
prompts carry inputs and turn instructions only, never a copy of these clauses.

**Binds:** `coder`, `implementer`, and every builder agent authored after them.

**Not a substitute for the caller's own contract.** `implementer` adds turn
types, the checkpoint report, and the lead-messaging rules; `coder` adds its
prose report shape. Those live in the agent files, because they differ by
caller. Everything below is the same for both, so it lives here.

## Reading

Reading the wrong range is what produces a wrong edit. These are rules about
method, not about quantity — never trade away a file you need.

1. **Locate before you read.** `grep -n` for the symbol, heading, or path you
   are after and read the lines it returns. A read that follows a grep lands on
   the right range; a read that precedes one is a guess.
2. **Read the range, not the file, once a file is over ~800 lines.** Long files
   are searched and windowed. Short files are read whole — windowing a 200-line
   file is the opposite mistake and gives you a partial picture.
3. **Never dump a file you are about to page.** `cat`-then-window, or
   read-whole-then-read-sections, delivers the same content twice. Pick one.
4. **A file you already hold is already read.** Return to it only when something
   changed it — your own edit, or a turn boundary that says so.
5. **Search the archives, do not read them** — *except the one this turn names*.
   `learned/` files and handover batons are reference: `grep` them for the name
   you are chasing and open only what the grep hits. An artifact the dispatch
   points you at is an input, not an archive: a reviewer's verdict or a failing
   command's output is read in full, because it is the whole finding.
6. **Read your own edit back when a parser will see it** — frontmatter, a marker
   fence, a table row, anything a tool will re-read. That read is always worth
   it.

## Proving the change

Where the project has a test suite the change touches, run it **once before
changing anything** to capture the baseline, and again afterward.

- Failures present in the baseline are **pre-existing**. Record them as such;
  do not fix them.
- New failures are yours. Self-fix and re-run, **at most twice**, then report
  the work as blocked with the full output.
- **The tests `idea.md` names are the acceptance surface.** Where it names none,
  and the deliverable is prose, a skill, a command, or an agent, there is nothing
  to run. Do not invent fixtures or scaffolding for markdown: invented
  invoke-and-inspect scaffolding generates findings about the scaffolding.
- **Anchor every command on the repository root**, `git rev-parse --show-toplevel`,
  never on the current directory: a build's commands run from wherever the
  caller happened to be.
- **`BASE` is the diff reference, never `HEAD`.** The user may commit mid-build;
  the pre-build commit the caller recorded is the only fixed point, and
  `git diff {BASE}` is the whole build.

## Checkpoints

A checkpoint is a report point, not a commit. In a build, the builder stops at
each one, reports, and waits for `continue`; nothing is written to git.

- **When:** after each green run of the tests `idea.md` names, and at every
  rotation whether or not tests are green. Where nothing runs, after each
  coherent change that leaves the tree consistent.
- **What the report carries:** the checkpoint number, the files this checkpoint
  changed, and the test result as measured. The work itself is the working tree;
  `git diff {BASE}` and `git status --short` are how anyone reads it.
- **Never commit, stage, or stash.** The user reviews `git diff {BASE}` once, at
  the end, and commits on their own word with their own message and their own
  secret screening. In this checkout, shared across concurrent sessions, an agent
  commit can also record work that is not yours. Ruled 2026-09-04 after weighing
  the alternative: the reason the build once committed, a per-unit gate the user
  had already approved, no longer exists.

## Destructive git is banned

The one way in-flight work is lost is an agent running a command that rewrites
the working tree. A coder once ran `git checkout -- .` to undo its own edit and
took another unit's work with it. So, in a build and ad hoc alike:

- Never `git checkout -- <path>`, `git restore`, `git reset`, `git stash`,
  `git clean`, or `git rm` on the tree. Undo a wrong edit by editing; delete a
  file you created with `rm` on that path alone.
- Never a whole-tree operation of any kind. A file you did not touch is not
  yours to move.
- If you believe the tree needs one of these, report `BLOCKED` and say why. It is
  the user's command to run.

## Dispatching a browser pass

You dispatch exactly one agent, `chrome-browser`, and only for an acceptance
outcome `idea.md` marks `verify-live:`. Everything else the work needs, you do
yourself.

That mark is the design saying this outcome has to be seen running, and it
names what to exercise and what you should see. The other carriers need no
agent — a CLI by invoking its binary, a service by a request, a skill by
invoking it, all of them ordinary commands you already run. Only the browser
carrier is delegated, because raw browser-MCP output floods the context that
reads it.

This is delegated **observation**, not delegated reading. The hard rule below
against re-delegating your own reading binds in full: you read the code, and
`chrome-browser` looks at the page.

**Name three things the agent cannot infer:**

- the MCP — `chrome-devtools`, because our own running app is instrumentation;
- the URL to open;
- the output path, `.chrome-devtools/{project}-{NNN}/`, `{NNN}` the checkpoint,
  so the run card can cite the evidence by path and two runs are tellable apart.
  Confirm the repo ignores that root before you dispatch. If it does not, say so
  in the run card and dispatch anyway: adding the ignore line is the user's
  call, not yours.

**Run the full pass:** the smoke floor — it loads, it is not visibly broken — plus
the behaviour this work changed. One pass by the builder that just wrote the
code is the point.

**Report what came back.** The run card's `## Verified` names the browser verdict
and the artifact paths it cites.

**Leave the environment ready, or escalate.** Probe first, and when the probe
fails — the app will not start, the shared environment is down, credentials are
missing — report `BLOCKED` and say what failed rather than finishing with the
check unrun.

**End your turn across the spawn.** The `Agent` tool has no synchronous mode, so
a child's notification reaches you only if you have ended your turn. Dispatch,
end the turn, resume when the child's return wakes you.

## Self-check

Before reporting, check your own output against the AI completeness pitfalls:
no TODO stubs, no empty catches, no "for now" shortcut, no section left as a
bare heading, and nothing described in your report that is not actually on disk.

## Hard rules

- **Change only what the request requires.** Suggest an adjacent cleanup in your
  report; do not make it. Remove an import or a variable only if your own change
  made it unused.
- **Read the code yourself; do not re-delegate your own reading.** A dispatched
  investigator returns findings you would have to re-read to act on, and its
  context dies with the dispatch while yours persists.
- **Report only what you verified.** Name the command and its result, or say
  plainly that you could not run it and why. "Should work" is not a result.
- **Contextual domain skills arrive as `/<skill-name>` directives** in the
  dispatch — load them via the Skill tool before implementing.

## `facts.md`

Maintained ground truth for the build, the coder's file. Two parts.

**`## Rulings`** — the one home for what the user ruled, in the user's words, in
the order they arrived. A ruling outranks anything in `idea.md` it contradicts.
No baton restates a ruling; it cites this section.

```markdown
## Rulings
- r-3f9a12 2026-09-04 — "keep the retry, drop the backoff table" (standing)
- r-8c01de 2026-09-05 — "which of the two config roots wins?" (pending)
```

**`## Facts`** — measurements, invariants and counts a successor would otherwise
pay to re-derive, each with the command that re-checks it. Maintained, not
appended: a later coder that falsifies an entry edits `value:` in place and adds
one `was:` line, so the wrong claim stops existing.

```markdown
### f-4821c0 domains carrying a .mditerc
value: 48
check: ls -d .claude/skills/*/ | while read d; do [ -f "$d.mditerc" ] && echo "$d"; done
note: never `git ls-files` — archived skills inflate the count
was: 51 (corrected 2026-09-04, handover/003-coder.md)
```

Five tagged prefixes and no others: `value:`, `check:`, `note:`, `see:`, `was:`.
Working-tree state is never a fact: uncommitted counts and stray-file baselines
change when a human commits between sessions, so write the `check:` command with
no `value:`. Reasoning and dead ends are not facts; they are the baton's.

## The coder baton

`handover/{NNN}-coder.md`, `{NNN}` the checkpoint just reported, zero-padded.
Frontmatter `after_checkpoint: N`, `role: coder`, `date:`, `supersedes:` naming
the fact ids you corrected. Four headings, in this order, omitting any you have
nothing to put under:

- `## Files touched` — since the last baton, and what each now does differently
- `## Tests green` — which ran and passed at this checkpoint; which are red and why
- `## Next edit` — the exact next change, file and line, and what it serves in `idea.md`
- `## Rejected paths` — what you tried that did not work, and why

Cite, do not restate: a file and a line, never a pasted paragraph. Never put a
value in a heading. Batons are an archive: a successor searches them
(`grep -n '{path}' handover/*.md`) and never reads them on onboarding, so
anything a successor needs unprompted goes in `facts.md` or `idea.md`'s
`## Implementation Notes` instead.

## The run card

`run-card.md`, one per build, the coder's file. `## Decisions made` is written
as the build goes, so a rotation never loses one; the rest is written at the end
and rewritten on every fix turn. Five headings, all present:

- `## What changed` — one line per file in `git diff --name-only {BASE}` plus
  untracked: the shape of the change, and `new` where the file was created
- `## Verified` — the test commands run and their results as measured, the files
  you read end to end, the browser verdict and its artifact paths where one ran.
  Name files individually up to four and by count above that.
- `## I did not verify` — what you judged outside scope or could not run, each
  with its reason; the honest null is one sentence saying everything the design
  claims was checked
- `## Decisions made` — every judgment where `idea.md` was silent or contradicted
  itself, each with a one-sentence reversal; rulings cite `facts.md`
- `## Doc updates` — the edits `doc-updater` made, by path, or `none`

The user reads this beside `git diff {BASE}`. `## I did not verify` and
`## Decisions made` are the parts no diff can tell them; write those to be
acted on.
