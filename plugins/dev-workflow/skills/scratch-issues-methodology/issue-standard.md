# Issue Standard

Contents: Folding · Admission · Determinations · Cluster groom · Corpus sweep · Condensed-copy sites (keep in parity)

The single normative copy of how work is cut into builds and how `scratch/issues/` stays lean:
what earns a file, what a groom may propose for one already filed, and how much a build holds.
Every other site points at a section here and keeps at most a one-line condensed copy, listed in
the parity table at the bottom of this page; edit here first, then visit those rows.

Nothing here is applied mechanically. Every determination is a proposal, stated per issue with its
evidence. Its owner is `user-decision-rubric`'s: `merge`, `split`, `fold into epic`, `close`,
`delete` and an `update` that narrows or widens what the issue asks for are `corpus-calls`, ruled
by the user off a lane and, on a lane, applied on the branch and listed for veto at the merge
review; `keep`, `rename` and an `update` that only restates what holds at `HEAD` are the agent's,
applied and reported (`issue-groom-methodology` step 6).

## Folding

Folding is the default. Work joins a build that already touches its files, and the breakdown and
the groom both propose one larger build over several smaller ones.

A split is forced by exactly three conditions. They are the whole list:

- **Learning dependency** — one piece's design waits on seeing another built, and only while that
  piece's shape is still undecided.
- **Merge gate** — one piece must land on the base branch before the others can build safely.
- **Different target** — the pieces land in different repos or different deploy targets.

A build's size is never a reason to split, at planning or during the build: not its file count, not
a review limit, not a planned checkpoint. Independent acceptance plus disjoint files permits a split
and never prompts one; propose a split only when one of the three conditions holds, and name it.

Parallel builds are judged only among the next workable builds, never by predicting layers across a
whole epic. Two may run in parallel when they touch neither the same files nor the same contracts;
overlap is a fold.

**Filing just in time.** Only the next workable builds are filed. Decided work that is not
workable next waits in the not-built clause of an unticked line in its epic's `## Outcomes`, and
becomes a build issue only through the breakdown gate; new functionality a build pushes out of an
epic joins such a clause, never a filed member. Filing later builds ahead, with `blocked_by`,
happens only when the user asks. A fix for code broken today is the exception: it is filed as an
issue when found, through `## Admission`, never parked in an epic. New functionality with no epic
to hold it is offered for `/capture-issue`.

This section serves both halves. The breakdown (`discovery/breakdown-gate.md`) applies it to work
not yet filed; the groom applies it to issues already filed when it proposes folding one into
another. Splitting a filed issue is `## Determinations`' `split`, which tests subjects, not size.

## Admission

Every writer of this corpus applies this test before a new file: `/capture-issue`,
`/implement-code` Step 6d, the `researcher` filing from a wiki page, `/wrap-up`, a command running
`scratch-memory issue write --repo`, and a workstream task promoted here. An issue is filed only
when all five hold.

| Question | Asks | Fails when |
|---|---|---|
| **Actionable** | Does it name a change and where that change lands? | It describes an area of concern with no change in it, or a change with no file, component or command it lands in. |
| **New** | Does no open issue or epic already hold it? | The duplicate search below finds a match. |
| **Not workstream-owned** | Will it outlive the build or workstream that found it? | It is a step of the work in hand: it belongs in that workstream's `tasks/`, the build's run card, or the design's `idea.md`. |
| **Owns content** | Does it carry an Intent, evidence or the user's words of its own? | Everything it says, its epic or another issue already says. |
| **Current-state** | Does it state what holds now, citing tokens? | It cites line numbers, or narrates a history of revisions instead of the current state. |

**The duplicate search.** Before any new file, search the open and deferred issues for the subject:
their titles (`grep -h '^title:' scratch/issues/*.md`), plausible slugs (`ls scratch/issues/` for
the subject's words), and every `## Related` line naming a path the new issue would name
(`grep -lF -- '{path}' scratch/issues/*.md`). A path reaches that command line only when it passes
`issue-groom-methodology` § Inputs' path test — it matches `^[A-Za-z0-9._/@+-]+$` and does not
start with `-` — since issue text and descriptions come from writers outside the session; search a
token that fails with the Grep tool, or not at all. A match turns the filing into a proposed addition to the
matching issue: the new evidence or words as a `- YYYY-MM-DD: …` bullet under its `## Notes`, or a
rewrite of its `## Summary` when the scope widened. File nothing until the user rules; a ruling that
the match is a different subject files the new issue.

## Determinations

For an issue a groom holds, propose exactly one determination, with one line of evidence.

| Determination | When |
|---|---|
| `keep` | The issue passes `## Admission` as it stands. The default. |
| `update` | A claim in it is stale against the code at `HEAD`. Rewrite it in place to state what holds now, with no dated revision note beside it. |
| `merge` | Two open issues hold one subject. One survivor takes the content of both. |
| `split` | The issue is oversized: it holds more than one subject, each of which would close on its own. A research report filed as an issue splits too: the actionable claim stays, and the report body moves to `scratch/{project}/`. Never on size alone. |
| `rename` | The slug or title names something other than the issue's subject: a finding, a step, a superseded name. |
| `fold into epic` | A draft member of an epic. What it adds joins the not-built clause of the outcome it serves in the epic's `## Outcomes`, if the epic does not already hold it, anything of its own too large for that clause goes to the epic's store as `discovery/keeping-the-epic-current.md` gives, and the file is removed. |
| `close` | The work landed, or is dropped for cause. `scratch-issues-methodology` § Lifecycle picks the status and § Resolution procedure gives the citation and the Resolution-before-status order. |
| `delete` | A draft whose subject another issue or its epic already holds in full. |

**Decisions an issue carries** are decision lines under its `## Decisions`, in the shape
[`design-record`](../design-record/SKILL.md) gives; an `update` rewrites the line in place, and a
groom that already edits the issue's text moves it toward that page's forms as its healing rows
give.

**The draft test.** An issue is a draft only when it holds nothing its epic or another issue does
not already hold: no Intent of its own, no evidence, no prior investigation, no words from the user.
The test reads content, never `kind:`, since `kind: idea` holds captured ideas that must stay safe.
Two issues are never drafts whatever they hold: a fix for code broken today, and a build issue that
is workable next, since that is the ticket. State the test for each issue you propose to fold or
delete. Anything with content of its own stays, or merges into the issue that absorbs it.

**Removing a file.** `fold into epic`, `delete`, and a `merge` or `rename`'s originals remove the
file with no settled status. That is what separates them from `moved`, a close that re-links an
issue to a different epic. In order:

1. Repoint every inbound reference to the new home: `blocked_by` edges, `## Related` lines, epic
   lines, and members' `epic:` keys. An issue carrying `lane:` also has its
   `scratch/L-{lane}/README.md` `primary` or `folded` entry repointed, as `lane-methodology` owns
   that record's fields. Closed build artifacts that name the old slug stay as written. A slug
   folded into its epic has no new home to point at: it leaves the epic body and is recorded as
   `discovery/keeping-the-epic-current.md` gives.
2. Write the content to its home. The receiving epic or survivor gains only the content itself,
   never a note recording the fold.
3. Delete the file with `rm` in the scratch repo. The scratch commit message that deletes it names
   the slug and where its content went; that message and git history are its whole trail.

**Merge and rename survivors.** `write_issue` never overwrites, so a survivor is a new file: file it
with `write_issue`, passing `epic`, `blocked_by`, `role`, `spike_type` and `lens` at creation, carry
each original's content into its body, then hand-copy `severity` and `lane:`. A copied `severity`
brings its `Severity proposed by the agent` note with it, so a proposed value does not turn
confirmed. Then remove the originals as above.

## Cluster groom

A **cluster** is the open and deferred issues around the one a touch point holds: those whose
`## Related` files or contract overlap it. Find it with fixed-string searches of
`scratch/issues/*.md` for the touched issue's slug and for each path its `## Related` names, then a
scan of the remaining open issues' `title:` and `## Summary` for the same contract.

A touch point proposes `## Determinations` within the cluster and no wider, chiefly merges and
obsolete closes, each applied or ruled by its owner as this page's opening gives.

## Corpus sweep

On request only; just-in-time cluster grooms are how the corpus stays lean, and nothing schedules a
sweep. Dispatch one `employee` via the Agent tool with this file and the open and deferred issue
list. It walks the corpus cluster by cluster and returns, per cluster, the determination it
proposes for each issue with its evidence. It edits no file: unlike `wiki-memory`'s sweep, whose
`knowledge-ingestor` applies determinations on its own authority, this sweep only proposes. The user
rules cluster by cluster, and the session applies what is approved.

## Condensed-copy sites (keep in parity)

Every site below keeps a short copy of one rule from this page, or owns a rule this page cites
rather than restates. Changing a rule here means visiting its row.

| Site | What it keeps |
|---|---|
| `scratch-issues-methodology/SKILL.md` § Lifecycle and § Resolution procedure | **Owners, not copies:** the status choice, the `## Resolution` citation and the Resolution-before-status order, and that an issue whose subject a commit removed closes `wont-fix` citing that commit. `## Determinations`' `close` row cites them. |
| `scratch-issues-methodology/SKILL.md` § Filing policy, § Promotion from a workstream task | A pointer to `## Admission`, the line that every writer files through it, and that a promoted task goes through it. Its kind boundaries are its own. |
| `scratch-issues-methodology/capture-issue-entry.md` § Entry: /capture-issue | The duplicate search's mechanics, its path test, and the proposed-addition branch of `## Admission`. |
| `.claude/skills/implement-code-methodology/wrap.md` 6d | The duplicate search before filing, and `## Folding`'s just-in-time split between a fix (filed) and new functionality (a `Pushed out:` line, or offered for `/capture-issue`). |
| `discovery/breakdown-gate.md` | `## Folding`: a strawman cut only at a forcing condition, the forcing-condition interview question, parallel builds only among the next workable ones, and just-in-time filing with a fix filed directly. |
| `discovery/chart.md` step 2 | `## Folding` as the early-exit test: an epic is warranted by a forcing condition or a question that wants its own conversation. |
| `issue-groom-methodology/SKILL.md` | The cluster search in the comb prompt (`## Cluster groom`), with § Inputs' path test as its precondition (owner of that test, not a copy), § Entry: /close-issue's close proposal, a copy of the close citation, and step 6's owner split. |
| `user-decision-rubric` § Kept calls | **Owner, not a copy:** `corpus-calls`, the determinations this page's opening names as the user's. |
| `issue-groom-methodology/epic-groom.md` | Reshape's drop rule, a copy of the close citation; Intake's copy of `## Folding`'s just-in-time split between a fix (filed) and new functionality (an outcome's not-built clause). |
| `issue-groom-methodology/refresh.md` | The cluster proposal step, a separate proposal after the inward refresh. |
| `brainstorming/sweep.md` | The sweep: the cluster search run through the comb over the files the design will touch, and the `## Determinations` merge or obsolete close for an issue not joining the `**Ticket:**` line. |
