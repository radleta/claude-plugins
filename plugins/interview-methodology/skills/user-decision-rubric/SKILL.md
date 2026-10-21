---
name: user-decision-rubric
description: "Rubric for whether a call at a workflow stop is the user's or the agent's, and how a ruling is recorded. Use when writing or editing any skill, command or agent that stops for the user, lists rulings for approval, or escalates — even when the stop site has its own owner line."
user-invocable: false
---

# User Decision Rubric

The single normative copy of who owns a call. A stop site cites this skill in one line (§ Citing
this skill) and restates no clause. Edit here first, then visit § Condensed-copy sites.

A **call** is any point where the workflow could stop and ask: a question, an approval, a
ruling-list item, an escalation, a commit, a confirmation. Agent work runs in a lane, on one
branch in each lane repo that the user reviews whole and merges (`lane-methodology`). That merge
review, and a question the user answers while present, are the only **reviewed surfaces**. A file
agents write or a line in chat is not one, an event groom's veto list apart (`corpus-calls`): the
user does not watch while agents work.

Every call has exactly one of three owners:

| Owner | Meaning |
|---|---|
| **settled** | A record already decides it. Apply the record and cite the line; there is nothing to ask. |
| **user** | § Kept calls keeps it, or a test sends it there (§ The tests). Ask (§ Asking well) and wait. |
| **agent** | Everything else. Decide, apply it on the lane, and record it where the merge review shows it (§ What an agent call obliges). |

## Check the record first

Before claiming a call as the user's or the agent's, or recommending an answer, read the records
that could already hold it, nearest first:

1. what the user said in this conversation, and the lane's ruling captures in its `learned/`
   (`source: ruling`);
2. the build's `facts.md` `## Rulings`, and `idea.md` `## Decisions` and `### Agent judgments`,
   inside a build or design;
3. the ticket's `## Decisions`, and its epic's `## Decisions`, `## Outcomes` and `## Out of Scope`;
4. the normative rule the owning skill states for the call, and the `## Decisions` section of the
   wiki page for each file the call would change;
5. `~/.claude/CLAUDE.md` and the repo `CLAUDE.md`.

A record that decides the call makes it **settled**. A record that bears on the call without
deciding it is context the recommendation carries, and the recommendation names what it read. A
call put to the user that a record already decided is the defect this section exists to stop: it
costs a turn and asks the user to rule twice.

## Kept calls

The workflow keeps these as the user's whatever the tests say. A stop site that reaches one cites
it by slug.

- **`design-approval`.** The `/brainstorming` gate before any implementation action, and the
  closing review's user-owned findings. The design binds the build and every reviewer reads it as
  the user's word. The `/brainstorming` dialogue before the gate asks only Scope and Taste calls;
  a settled call or an agent call goes to the design's `### Agent judgments`, where the approval is
  its veto. A call a kept call keeps, or that the Conflict or Undo test sends to the user, is asked
  in the dialogue as at any stop.
- **`accept-and-merge`.** The user tries the finished work after the reviewer wave, its fix turns
  and the leftover pass, reads the diff of each lane repo, and approves the merge into the
  bases. Landing a lane is this call, not a second one.
- **`corpus-calls`.** A close, a merge, a scope rewrite (a `## Summary` rewrite that narrows or
  widens the ticket included), a `blocked_by` edge, an epic `## Destination`, `## Outcomes`,
  `## Decisions` or `## Out of Scope` line, and splitting, merging, dropping, promoting, striking
  part of, or re-creating a workstream task. These set
  what the work is and where it ends. On a lane they are applied on the branch and listed in the
  merge review for veto; off a lane they are asked. An event groom's rewrite, merge,
  drop and filed issue (`handoff-methodology` `boundary-groom.md`) are applied at every event, on a lane or off one, and
  at `/pickup` and `/close-issue` are listed for veto in the reply, not asked first and not held
  for the merge review.
- **`reversal`.** Any fix, finding or edit that would reverse a ruling in `facts.md`, change an
  `idea.md` `## Decisions` line, change an epic decision, or contradict what the user said in this
  conversation. A stop at every level, in a build too: a reversed decision found only at the merge
  has a finished build on top of it.
- **`base-and-history`.** A commit or push to a base (the branch a lane repo's lane forks from and lands on, scratch `main` included) other than the
  `accept-and-merge` landing and `/capture-upstream`'s one new issue file; any command that
  rewrites history or discards working state (`rebase -i`, `push --force`, `reset --hard`,
  `filter-branch`, `checkout`, `restore`, `stash` or `clean` on a shared tree); deleting work git
  does not hold, or another session's uncommitted files. Irrecoverable, and often someone else's. A
  lane branch's own commits and plain pushes are the agent's.
- **`outside-the-machine`.** Publishing, a sent message, a marketplace release, a
  stakeholder-facing report, public copy, a full sensitive identifier in anything that leaves the
  machine. The user signs it.
- **`interview`.** A `discuss-methodology` round, a `/discovery` interview spike, naming an epic's
  destination, selecting among prototypes, and the owner's positioning facts. The user deciding is
  the purpose of the step, so the agent never answers its own questions.
- **`load-bearing`.** A stop whose answer a later step reads and only the user can give. The agent
  cannot produce the yes, so moving the stop leaves the later step reading nothing, or reading an
  agent's pick as the user's. It stops on a lane and off, every time. Changing or removing one is a
  change to the skill it sits in, put to the user as `reversal` is. A stop whose purpose is the
  user answering is `interview`, not this.
- **`what-to-work-on`.** Which workstream to resume, which ticket a design is, which epic a
  multi-epic issue goes under, when nothing on disk names it. Intent only the user holds. Opening a
  lane for work already asked for is not this call: `lane-methodology` § When a lane opens decides
  it.
- **`secret`.** A credential-shaped file or secret pattern in a commit. Stop; never commit.
- **`persons-hand`.** A sign-in, 2FA or consent gate, a UAC prompt, a remote URL, a path outside
  the project, a fact the record and the environment cannot yield. Not a decision: name what is
  needed and stop, with no options and no recommendation.
- **`wiki-domain`.** Creating a new wiki domain, for a ruling no domain fits or for anything else.
  A new skill shows in every session's skill list. Offered in the batch it arrives in, the groom of
  the issues carrying it or an ingest's proposal question, never a stop of its own.
- **`quick-fix-hatch`.** Working on the base or outside a lane. Only the user calls it, in words
  asking for the work there; the agent never proposes it and no size rule picks it.

## The tests

For every call that is not settled and not kept, one question decides it:

> **Would the user's ruling, if asked, match what the agent would do from the record and the
> conventions it can read?**

Yes: the agent's. No, or the agent cannot say: ask the four tests; a call that fails none is the
agent's.

| Test | The call is the user's when | Not when |
|---|---|---|
| **Scope** | it widens, narrows or redirects what was asked: a new ticket, a new outcome, work pulled in or dropped, a different target than the request names | it fills in how to do what was asked, or fixes a nearby fault inside the design's scope |
| **Undo** | the change escapes the lane: it reaches a base, a remote, a published place, another session's files, or deletes what git does not hold; or, on the lane, undoing it would cost the user more than declining the merge, and each such on-lane change is called out at the top of the merge review's `## Decisions made` | declining the merge, or one revert on the lane, puts it back |
| **Taste** | it rests on taste, values, risk appetite or a fact only the user holds, and § Check the record first found no preference for it | a recorded preference, a repo convention or a house rule decides it |
| **Conflict** | two real targets or two conventions apply and the request names neither, or a name, value or fact would have to be invented | one reading is plainly the request's, or a second search settles it |

### The default on the lane

When the record and the tests cannot decide: **the agent's when its change lands on the lane**,
on a lane repo's lane branch, where the user merge-reviews it; **the user's otherwise**, a change landing
anywhere the user will not review when present, a line in chat included. A wrong agent call on the
lane is undone by the merge review at no cost; one off the lane has no veto point, but for the
list an event groom prints in its reply. The same split
decides a mixed list: an item whose change lands on the lane is applied and recorded, even beside
items that are the user's.

### Borderline calls, ruled

- At capture, an exact slug or title match is the same issue: adding a dated note to it is the
  agent's; widening its `## Summary` is `corpus-calls`.
- A remainder that fits an existing unticked epic outcome joins that outcome, the agent's; one that
  needs a new outcome line is `corpus-calls`.
- A project wiki's Tier C ingest on a lane is the agent's. The ingest run reads every block it is
  handed as the user's yes, so four kinds stay the user's on a lane and off: a new domain
  (`wiki-domain`); a gate escalation, a removal or rename of a page git may not hold; a `.rulings/`
  line, which would record a ruling the user never gave; and a change to a page outside the calling
  repository, which the merge review never sees.
- Archiving a scratch folder on a lane is the agent's; `--force` past the archive's refusal stays
  `base-and-history`.
- A commit stop names what makes a staged file the user's — a path the work did not change, which
  can be another session's (`base-and-history`), or a secret pattern (`secret`) — never "if
  uncertain". Every other staged file is committed.

## What an agent call obliges

An agent-owned call is not a silent pick. It obliges four things:

1. **Apply it** in the same turn, never as an "apply all?" item, since a list item is still a
   stop. Applying is doing what the user's yes would have done — the commit made, the list
   applied, the target picked — never skipping the action because no one was asked; a call whose
   yes the agent cannot produce is not the agent's, it is `load-bearing`. On a lane,
   commits on the lane's branches, and the lane branches' pushes, are the agent's. Off a
   lane, in pre-work on the base, the call lands in the session's next base commit the user
   approves, and that commit's summary lists it.
2. **Record it where the merge review shows it.** A build's call goes in `run-card.md`
   `## Decisions made` or `facts.md`; a design's in `idea.md` `## Decisions`, the replaced text in
   `changelog.md`; a corpus edit is the dated note itself; any other lane call goes in the lane
   record's `## Decisions made`. Each carries a one-sentence reversal.
3. **Clear the leftovers before the gate.** A build's leftover pass fixes reviewer nits, re-runs
   every `## I did not verify` item that can now run, rules the `## Undecided` reviewer entries this
   rubric gives to agents, fixes nearby faults inside the design's scope and files the rest, then
   runs the full build and tests. Only real decisions reach the gate.
4. **Honour the veto.** A veto or feedback at the merge review reverses the call at the agent's
   cost and is recorded as a ruling (§ Recording a ruling). A vetoed call is never re-taken on the
   same ground.

A ruling list the user receives holds only § Kept calls and calls a test sent to the user. Every
other item on it is a defect of the list.

## Recording a ruling

A ruling the user gives, at any stop, is a preference the record did not hold. Record it before the
next call of its kind:

| The ruling | Record it as |
|---|---|
| binds this build or design | `facts.md` `## Rulings`, or an `idea.md` `## Decisions` line |
| binds one epic or ticket | a `## Decisions` line on it, `X, not Y, because Z` |
| anything else: a groom, an interview, a held review question, a vetoed call, a rejected recommendation with its reason | a `learned/` capture, `type: decision`, `source: ruling`, in the shape `knowledge-capture` gives: the user's words first, the agent's decision line beneath them marked `unconfirmed`. Agents act on the words |

Where the capture sits:

- **Given in a lane:** on the lane's scratch branch, linked from the lane record's `## Rulings`;
  the merge review shows it in its own section.
- **Given in pre-work on the base:** in that session's next base commit, which the user approves.
- **Its home is user-level** (a user-level skill or wiki, a methodology that loads in every repo):
  also an upstream issue through `/capture-upstream`, carrying the user's words, filed in
  claude-code-ref's `scratch/issues/` and linked from the lane's `## Rulings`. A ruling given in a
  claude-code-ref lane that edits the ruling's home skill is an edit on that lane instead.

A ruling on a kept call is recorded where its workflow already records it, and nothing more is
written.

An issue's `lens:` key is written only from the user's own words naming that lens for that issue.
"You pick" and "approve all" are not those words: an agent's lens choice is recorded as its own
judgment where the design records judgments (`### Agent judgments`), never as the key.

## Asking well

A user-owned call is put as `options-rubric` and `interview-methodology` give: options by lens, the
recommendation last, one message holding every open call, asked after distributed work has
returned. The recommendation names the record it read (§ Check the record first). A call that does
not block the next step is asked without stopping the work (`project-lead`'s escalation). When the
record holds no frame for the work (no epic, no destination, no lens), ask the frame first and the
batch after.

## Citing this skill

A **stop site** is the step that decides to stop for a call. A page that only says how to ask, a
wrapper that loads the page owning the stop, a failure or refusal that names what is wrong, and a
hand-back that ends the run cite nothing; a no-argument prompt cites `what-to-work-on` when the
agent could otherwise pick a default.

A stop site writes one line, in one of these forms:

| Line | For |
|---|---|
| ``Owner: user-decision-rubric `{slug}` `` | a kept call |
| ``Owner: user-decision-rubric `load-bearing` — {what reads it}`` | a `load-bearing` stop, naming its reader so an editor sees the dependency |
| `Owner: user-decision-rubric (test: {Scope\|Undo\|Taste\|Conflict})` | a call a test sends to the user |
| `Owner: user-decision-rubric (tests)` | a router stop whose items are routed one by one at run time |
| `Owner: agent (user-decision-rubric)` | a call the agent applies |
| `Owner: settled ({path}:{line})` | a stop a record decides |

A stop whose owner applies for veto on a lane but asks off one states both branches, on a lane
first, then off a lane as one numbered list whose last item is the commit. A stop whose caller
commits what it writes has no commit item off a lane, and says that caller commits. A dispatch
prompt to a sub-agent with no user carries the same line, and the sub-agent returns a user-owned
call as its escalation.

## Condensed-copy sites (keep in parity)

| Site | What it carries |
|---|---|
| `lane-methodology` § When a lane opens and § Scratch commit; `begin.md`; `end.md` | the agent opens or offers a lane as the lane line says; `/begin-lane` asks nothing; `/end-lane` asks one `accept-and-merge`; scratch commits on a lane need no approval; lane pushes the agent's, base pushes `base-and-history` |
| `issue-groom-methodology` § The procedure step 6 | the list holds `corpus-calls` only; notes, links, markers and scratch commits on a lane apply and are reported |
| `scratch-issues-methodology/issue-standard.md` | `corpus-calls` as the ruled determinations |
| `brainstorming/review-loop.md` § Routing findings; `design-review-methodology` `Owner` field | a finding's owner by these tests; the agent's applied and recorded in `changelog.md` |
| `agents/project-lead.md` escalations; `project-lead-methodology/leftover-pass.md` | `reversal` and `secret` escalate; a non-blocking one leaves the build running; `## Undecided` entries ruled by the lead |
| `implement-code-methodology` | `accept-and-merge` as the one gate, through `/end-lane` |
| `knowledge-capture` § Frontmatter Schema | `source: ruling` and its shape |
| `.claude-personal/CLAUDE.md` commit rule | `base-and-history`: free commits on a lane, approval for a base |
| `.claude-personal/CLAUDE.md` Restraint: "Surface ambiguity" and "Edit only what the request directly requires" | the Conflict test and `reversal` decide an unclear call; the Scope test decides an unrequested edit |
| `commands/commit-all.md` | `base-and-history`: off a lane every commit is approved |
| `handoff-methodology/tasks-methodology.md` § Edit permissions | the user-only task edits are `corpus-calls`: applied for veto on a lane, asked off one; an event groom's rewrite, merge, drop and filed issue are applied at every event and listed for veto, in the reply at `/pickup` and `/close-issue` |
| `discuss-methodology` § The Decisions Are the User's | `interview`: the agent never answers its own questions |
| `discovery/keeping-the-epic-current.md` | outcome lines are `corpus-calls`; a remainder that fits an unticked outcome joins it, the agent's |
