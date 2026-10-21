---
name: builder-contract
description: "Normative contract for every builder agent and builder dispatch prompt: reading, baseline-then-after tests, checkpoints, the destructive-git ban, reporting, and the facts.md, baton and run-card forms. Use when writing a builder or implementing as one — even a markdown-only change. Reviewing is reviewer-contract."
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
  to run: its evidence is its effect in the diff, and you invoke the primitive
  only when `### Tests` names that invocation. Do not invent fixtures or scaffolding for markdown: invented
  invoke-and-inspect scaffolding generates findings about the scaffolding.
- **Show each signal `### Signals` declares firing.** Run the code so each one
  fires, with verbose logging on for a signal at debug level. A skill's or an
  agent's signal is its effect in the diff. Signals stay *quiet by default*: the
  detail sits at debug level or behind a verbose flag, and a skill or agent never
  adds a line to its normal output. A signal that fires only in a later real run
  is listed on the run card, never claimed as shown.
- **Anchor every command on the repository root**, `git rev-parse --show-toplevel`,
  never on the current directory: a build's commands run from wherever the
  caller happened to be.
- **`BASE` is the diff reference, never `HEAD`.** The user may commit mid-build, and on a lane the coder does;
  the pre-build commit the caller recorded is the only fixed point, and
  `git diff {BASE}` is the whole build.

## Checkpoints

A checkpoint is a report point. In a build, the builder stops at each one,
reports, and waits for `continue`.

- **When:** after each green run of the tests `idea.md` names, and at every
  rotation whether or not tests are green. Where nothing runs, after each
  coherent change that leaves the tree consistent.
- **What the report carries:** the checkpoint number, the files this checkpoint
  changed, and the test result as measured. `git diff {BASE}` plus untracked
  files is how anyone reads the build.
- **On a lane, the build's coder commits each green checkpoint.** On a lane is
  `lane-methodology` § Claim's test. Commit the paths on the
  checkpoint's `Files:` line outside `scratch/`, and nothing else:
  `git add -- {paths}`, then `git commit -m "{type}({project}): checkpoint {N} — {slice}" -- {paths}`.
  Screen the added lines first as `commit-methodology` Step 2 does; a
  credential-shaped file or secret pattern is `BLOCKED`, never committed
  (`user-decision-rubric` `secret`). A checkpoint that is not green is not
  committed, and `scratch/` paths and pushes are the lead's. A path inside an
  extra lane repo (`lane-methodology` § Lane repos) is committed the same way
  with `git -C {repo}`, after `lane add-repo {path}`, called as
  `lane-methodology` § The lane script gives, when that repo is not on the
  lane branch. The user reviews the lane whole at `/end-lane`.
- **Off a lane, and for an ad-hoc builder everywhere, never commit, stage, or
  stash.** The user reviews `git diff {BASE}` once, at the end, and commits on
  their own word with their own message and their own secret screening. In a
  checkout shared across concurrent sessions, an unscoped agent commit can also
  record work that is not yours.

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

You dispatch `chrome-browser`, and only for an acceptance outcome `idea.md` marks
`verify-live:`. Your other dispatches are the two agents § Dispatching a drafter names. Everything else
the work needs, you do yourself.

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
missing, the `chrome-devtools` MCP is unreachable, or `chrome-browser` returns no
evidence — report `BLOCKED` and say what failed rather than finishing with the
check unrun. A browser check is never skipped. For the last two the reason is
exactly `chrome-devtools MCP unreachable; {N} verify-live outcomes unverified` or
`chrome-browser returned no evidence; {N} verify-live outcomes unverified`, naming
the cause that occurred, `{N}` the `verify-live:` outcomes not yet shown.

**End your turn across the spawn.** The `Agent` tool has no synchronous mode, so
a child's notification reaches you only if you have ended your turn. Dispatch,
end the turn, resume when the child's return wakes you.

## Bringing the app up

The lead's App-up Instruction arrives before each reviewer wave that screenshots the
changed pages. Start the app, or confirm it is still running and serving the current
tree (restart or rebuild it when it does not reload on its own), as you would for a
`verify-live:` pass, then probe the base URL and each route with a request. Report the
base URL and every route a changed page file renders, in the shape the instruction
gives. A probe that fails is `BLOCKED` with what failed, as § Dispatching a browser
pass says. Leave the app running: the reviewer opens it after your report. Stop an app
you started at the leftover pass; a later wave's App-up starts it again.

Inside a wave that includes `ux-verifier`, a fix turn is not `FIXED` until the running
app serves the fix, whichever verdict drove it: restart or rebuild it when it does not
reload on its own, then probe again.
Put a `Route:` line above your four lines for each route the fix added.

## Dispatching a drafter

Human-read prose the work writes (a README section, user docs, a PR description, a plugin
page `/marketplace-refresh` rewrites) is `Tier 1` or `Tier 2` text: load `human-voice` and follow its routing, and write the text yourself when that skill is not installed.
That routing has you dispatch `human-voice-drafter`, and `human-voice-reviewer` when a return
ends in a `## Needs structure review` block; it authorizes those two agents and no other. With `human-voice` installed, a dispatch tool and no agent whose name ends in
`human-voice-drafter`, or one that returns that it could not find its page, write none of that prose and report `BLOCKED`, naming the agent and what it returned:
the routing's `general-purpose` rung is not yours, and the user decides what happens next. The
same holds for a `## Needs structure review` block when no agent's name ends in
`human-voice-reviewer`: report `BLOCKED`, with the block unchanged. Code
comments, commit messages, `scratch/` files and wiki pages are not this prose. End your turn
across the spawn, as for a browser pass.

## Hard rules

- **Change only what the request requires.** Suggest an adjacent cleanup in your
  report; do not make it. Remove an import or a variable only if your own change
  made it unused.
- **Read the code yourself; do not re-delegate your own reading.** A dispatched
  investigator returns findings you would have to re-read to act on, and its
  context dies with the dispatch while yours persists.
- **Report only what you verified.** Name the command and its result, or say
  plainly that you could not run it and why. "Should work" is not a result, and
  nothing goes in a report that is not on disk.
- **Contextual domain skills arrive as `/<skill-name>` directives** in the
  dispatch — load them via the Skill tool before implementing.
- **Before changing any file under `.claude/`, load `agent-voice`, then
  `claude-code-expert`, and read the page it routes you to — even for a
  one-line change.** Those skills hold the house conventions these files follow.

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
note: counts skill folders on disk, so a gitignored local skill counts too
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
  untracked: the shape of the change, and `new` where the file was created. A
  file that list misses — outside the repo, gitignored, or in a nested subrepo —
  gets a line too, by its full path, when a relayed ruling had you edit it. An
  observability record edit or its `CLAUDE.md` pointer line that `idea.md` lists
  is yours, and gets a line here; a record held as a wiki page changes instead
  through a `learned/` capture you write before your last checkpoint, so the
  lead's end ingest files it
- `## Verified` — evidence only, something observable: the test commands run and
  their results as measured, the source files you read end to end before changing
  them, the browser verdict and its artifact paths where one ran.
  Name files individually up to four and by count above that. Each signal shown
  firing is one entry starting `Signal fired:`, ending `(caught a defect)` when it
  exposed a fault you then fixed during the build
- `## I did not verify` — what you judged outside scope or could not run, each
  with its reason; the honest null is one sentence saying everything the design
  claims was checked. Each `## Accepted by design` bullet of the security verdict
  the lead names goes here too, its reason "accepted by `idea.md` § Failure Modes".
  When the `Signals tier:` judgment is not none: the production read path the
  `### Signals` entries name, never a credential or connection string, or `none`
  when no entry names a record, and each
  signal that fires only in a later real run as one entry starting `Signal later:`
- `## Decisions made` — every judgment where `idea.md` was silent or contradicted
  itself, each with a one-sentence reversal; rulings cite `facts.md`
- `## Doc updates` — the edits `doc-updater` made, by path, or `none`

A build that changes a skill, command or agent carries a sixth, `## Tier check`,
which the lead writes last and the coder leaves as it finds it.

The user reads this beside `git diff {BASE}`, and on a lane the merge review
shows `## Decisions made`, `## I did not verify` and `## Tier check` above the
diffs. Those are the parts no diff can tell them; write them to be acted on.
