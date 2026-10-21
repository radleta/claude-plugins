# Task Methodology

Contents: The task test · Questions versus tasks · Done when · Fold test · Dedupe · Save points · Edit permissions · Titles · Tasks touched · Version log

Companion to [task-files.md](task-files.md), which holds the task file schema and who writes tasks. These are the rules `/handoff` Step 1d, groom ([groom.md](groom.md)) and the event groomer ([event-groom.md](event-groom.md)) apply when deciding what becomes a question or a task and how an existing row changes. Read in full before any of them writes a task or closes a question.

## The task test

An item is a task when all three hold: it names an artifact change or a concrete check that is still owed; it is more than the Next best step's own wording, though the Next best step may point to it; and what it holds is tracked nowhere else — no task, issue, or plan step already carries it. For a save point, what it holds is the session-only state, not the skill's work, which the skill's own artifacts carry ([Save points](#save-points)). A standing constraint ("never commit before review") is never a task; it belongs in `## What to avoid` or `## Decisions made`.

The task test runs before the question sort below: an action offer already tracked in an issue or plan does not become a task; its question closes as tracked when that tracker states it owes the answer ([Questions versus tasks](#questions-versus-tasks)), and stays open otherwise.

## Questions versus tasks

Every item a session leaves behind is sorted when it is raised: a question, a task, or an issue, which is anything forward-looking about the repo rather than this workstream's work and is filed with `/capture-issue`.

**A question** is a decision the user has to make. It earns a bullet under `## Open questions raised` only when all three hold: the user, not the agent, must answer it; it bears on the workstream's current `## Goal`; and no issue, task or decision already carries it. A ruling the user already gave goes under `## Decisions made`.

Rewrite anything else as an imperative naming the file and the edit, then sort it:

- **Action offer** — the work is known and only the go-ahead is missing. It becomes a `blocked` task whose `blocked_on` names the go-ahead, and the question closes as tracked by that task.
- **"Check whether X"** that the agent can run itself — an `open` task, or checked now and recorded.
- **Tracked elsewhere** — an open issue or task states that it owes the answer: the question's id is in a task's `blocked_on`, the question sits under a heading for the tracker's own open work, or it is the tracker's subject. The question closes as tracked by it. A tracker that only mentions the question, under `## Related` for example, owes nothing, and the question stays open.
- **The answer changes the work** and nothing else tracks it — it stays a question.

**The shape of a question.** One question per bullet, the kernel first, ending in `?`, then one clause starting `settles when:` that names what would close it: the ruling, the commit, the file state or the check. Two questions are two bullets. A question whose raiser cannot say what would settle it is a note for `## What to avoid` or a task to find out. `session lint` prints a `question-shape` warning for a bullet in the newest session file with no `?`, more than one, or no `settles when:` clause; the warning never stops a handoff.

**A row that breaks the shape is `malformed`**, and the sort still applies to it: a recorded decision with no `?` and a heading that introduces a list each close as moot, a bullet carrying two questions is kept until it is re-raised as two, a check the agent can run becomes a task, and a defect or a feature becomes an issue. A row raised before `settles when:` existed is not malformed for lacking it.

**A tracked close.** `/handoff` writes `q-<id> → RESOLVED: closed — moved to task t-<id>` under `## Open questions resolved`. Groom and the event groomer cannot write session files, so each writes its close to the ledger, `scratch/S-{id}/groom-closes.md`, with `scratch-memory session close … --kind tracked`, citing the task file `tasks/t-<6hex>-<slug>.md` or the issue. Before either closes a question as tracked against a task, that task's body carries the line `Waits on q-<6hex>: <the question>`, added when it is missing, so the question stays readable once it leaves the brief; `blocked_on` keeps only the id and a short gate.

Where the sort runs: new items at handoff, the still-open questions `/handoff` Step 1b answers or marks moot, the rows an event's new evidence reaches in the event groomer, and the whole still-open backlog in groom.

## Done when

Every task body opens with `Done when: <one observable state>`: a named file's content, a command's result, or the user's read of a named page. When some of a task's parts await a go-ahead, the line after `Done when:` notes the count, for example `2 parts need the user's go-ahead`. Titles never carry that count.

A task whose `Done when` sits anywhere but the first body line, such as a `## Done when` heading or a `**Done when.**` paragraph, counts as lacking the line. Add a first body line restating it, and leave the existing text in place.

## Fold test

Fold an item into an existing task only when that task cannot honestly be done while the item is undone. Sharing a file, topic, or sub-project is not enough; create a separate task instead. A task may hold any number of parts.

## Dedupe

Before creating a task, match the item on artifact path plus action against the titles and bodies of tasks of every status — never on title alone, because items are reworded every session.

- **Match on an `open` or `blocked` task** — append the item there when the fold test holds; otherwise create a task.
- **Match on a `done` or `promoted` task** — create nothing, unless this session reopened the work: then set `open` and append a dated note saying why. A save point follows [Save points](#save-points) instead.
- **Match on a `dropped` task** — append `seen again {date}` to it and create nothing.
- **A candidate match with no `Done when:` line** — read the task, add its `Done when:` line, then apply the fold test.

## Save points

A **save point** is a task that holds what a skill left mid-flight needs to resume, and that lives nowhere else. It exists because state held only in the conversation is lost at handoff, and a resumed session that does not know it was inside a skill runs outside it: it skips the skill's rounds and gates, and keeps the skill's decisions as Next best step prose instead of in the skill's artifacts. A multi-step skill, protocol, or methodology is mid-flight when its own finish condition is not yet met.

**What goes where.** First record everything the skill owns in the skill's own artifacts — an epic, a spike, an issue, `idea.md` — the way the skill records it. The save point holds only the remainder that exists nowhere but this session: the step reached, a round put to the user and still unanswered, a choice half made. For everything else it points at the artifact and does not restate it.

**Shape.** The body's first non-empty line is `Done when: <the skill's own finish condition>`, one observable state per [Done when](#done-when), for example `Done when: every spike in epic isolate-local-dev-from-production is settled`. One or more blocks follow, the newest last. Each block opens with a header line:

`Save point YYYY-MM-DD: <invocation> — <position>`

Split the header on the first ` — `. `<invocation>` is the outermost skill as a slash command with its arguments, or a bare skill name; the outer skill reloads its inner ones itself. `<position>` is the innermost position. Free text under the header holds only session-only state and pointers. Example header:

`Save point 2026-09-29: /discovery isolate-local-dev-from-production — Work mode step 3, spike environment-as-code-config-model; discuss-methodology round 2 sent, unanswered`

A save point waiting on the user's answer is best `blocked`, with `blocked_on` naming the pending answer.

**Life of one save point.** One save point serves one skill run, across as many handoffs as the run takes. At each handoff:

- the finish condition was met this session — first move anything a later session needs from the finished run into the skill's own artifacts, or into this session's `## Decisions made` when the skill created none; then set the save point `done` and add no block. A `done` save point is not a record anyone resumes from, so the Next best step names no save point path, and points at those artifacts or `## Decisions made` instead;
- an `open` or `blocked` save point's newest header names the same invocation, matched on that header and never on the title — append a new dated block to it, without running the fold test;
- otherwise — create a new save point, even when a `done` one matches the invocation. This overrides § Dedupe's "create nothing" for a `done` match: a new run of the same skill is new work.

While a save point is `open` or `blocked`, the session file's Next best step names its path, and `/pickup` resumes the skill from its newest block.

## Edit permissions

**Unattended edits** — `/handoff`, groom and the event groomer make these without asking:

- create a task;
- append a part or a dated note;
- check a part, citing the evidence;
- set `done`;
- move between `open` and `blocked`, naming the gate in `blocked_on`.

A body edited unattended is append-only: add lines, and leave existing lines as they are. The one insertion above existing lines is a missing `Done when:` line, which goes in as the first body line. In session, with the user present, rewriting a body is allowed. Set `done` with `scratch-memory tasks done 'scratch/S-{id}/' t-<6hex> --note '<evidence>'`, writing each `'` in the note as `'\''` so the single quotes stay closed; it writes the status, `updated:` and the dated note in one call. Every other change is an Edit to the task file that bumps `updated:` to a full ISO UTC timestamp of now, `YYYY-MM-DDTHH:MM:SS.sssZ`; `write_task` only creates.

**The event groomer's edits.** At `/pickup`, `/end-lane` and `/close-issue` the event groomer also rewrites a task line that is wrong against what it can see, merges duplicate tasks, drops a task whose every named subject is gone at HEAD, and files an issue for a question the tracker should hold, each on a quoted citation. It applies them at every event, on a lane and off one, and nothing is asked first: each goes on a numbered veto list with what it replaced, in the reply at `/pickup` and `/close-issue` and in the merge review at `/end-lane` ([boundary-groom.md](boundary-groom.md)). A task given its `Done when:` in a run is not set `done` or dropped in that run. Owner: user-decision-rubric `corpus-calls`

**User-only edits** — `promoted`, striking a part, re-creating a dropped item and splitting a task, and, anywhere but an event groom, `dropped` and merging tasks. `/handoff` names none of these, not even as a proposal. Groom may recommend any of them in its closing list, and `/groom` rules that list: on a lane it applies each recommended one as its own scratch commit and records it in the lane record's `## Decisions made` for veto at the merge review; off a lane, each waits for the user's word. Owner: user-decision-rubric `corpus-calls`

## Titles

A title may be edited when the work is better described another way; the id carries identity, so nothing tracks a task by its title.

## Tasks touched

The session file's `## Tasks touched` section holds one line per task the session created or changed, shaped `- t-<6hex>: <verb>`:

| Verb | Edit |
|---|---|
| `created` | a new task file |
| `appended` | a part, a dated note, or a checked part added |
| `done` | status set to `done` |
| `blocked` | status moved to `blocked` |
| `opened` | status moved to `open`, including a reopened `done` task |
| `seen-again` | `seen again {date}` appended to a `dropped` task |

Leave the section empty when no task was touched. Nothing parses it.

## Version log

`TASKS_METHODOLOGY_VERSION` in `scratch-memory`'s `scripts/tasks.mjs` is the version a workstream's `groom.yaml` is compared against. Bump it only when existing task data stops conforming, or when a rule adds a check on existing task data that only a full `/groom` can make. A rule the event groomer applies as evidence arrives, the question standard included, never bumps it, and neither does a wording edit. A bump lands in the same change as the rule it versions, with a row here.

| Version | Change |
|---|---|
| 1 | Initial rules: the task test, questions versus tasks, `Done when:`, the fold test, dedupe, edit permissions, `## Tasks touched`. |
