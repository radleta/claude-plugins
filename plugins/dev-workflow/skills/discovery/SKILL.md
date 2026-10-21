---
name: discovery
description: "Chart a bounded destination as an epic in the issues corpus, split its fog into decision spikes, and work them off the frontier until the route to a design is clear. Use when an idea is too big to decide in one conversation, when open captures need working into something designable, or before /brainstorming when the deciding must be broken up — even when the idea already feels ready to design."
---

# Discovery — Charting the Way to a Design

A loose idea has arrived wrapped in fog: the way from here to the **destination** is not visible
yet. Discovery is about finding that way, not charging at the
destination. It charts the way as an **epic** in the issues corpus, breaks off what will not fit in
the conversation as **spikes** — questions whose resolution is a decision, not slices of a build —
and works them off the frontier until the route is clear.

This is the stage **upstream of `/brainstorming`**: it produces decisions, never design and never
code.

<HARD-STOP priority="CRITICAL-READ-FIRST">
Discovery never invokes `/brainstorming`, never writes an `idea.md` (not even a partial one), and
never writes implementation code. It ends by handing back to the user with a recommendation for what
to run next — `/brainstorming` on every exit but one. On the early exits it recommends and then asks
how they want to proceed; it does not declare the stage unnecessary and close. The one exception is
the destination-already-reached exit, which names nothing as next, because no work is left to
design. A pre-seeded design document is a
translation step, and translation is where this pipeline measured most of its defects entering;
stage separation is why `/implement-code` does not design and this stage does not build.
</HARD-STOP>

<no-reviewer-agents>
Discovery dispatches **no reviewer sub-agents**: the user is the gate throughout, and
`## Not Yet Specified` is deliberately incomplete. The sub-agents this stage does use are `researcher`, to resolve a research spike, and the comb `intern` that
`issue-groom-methodology` § Entry: rest point dispatches.
</no-reviewer-agents>

## Invocation

`/discovery` takes an optional argument.

| Invocation | Mode | What happens |
|---|---|---|
| `/discovery` with a loose idea | **Chart** | Read [chart.md](chart.md) and follow it. |
| `/discovery {epic-slug}` | **Work** | § Mode: Work below. |

`/discovery` takes no verbs. When a word follows the epic slug, run Work mode on the epic alone and
say so; a close and groom after a build is `/close-issue {ticket} {project}`.

**Both modes run until the record stops keeping up, then stop** — charting is not exempt.

- **The record stops keeping up.** A spike's `## Resolution`, its `status` flip, and its gist in the
  epic are all written *before* the next spike is chosen; in Chart mode, every answer the grilling
  produces reaches the epic before the next question. The moment that slips, stop and write it.

That is the only stop you propose. Keep working while the record is current, however much the
session has done; the user watches the session's size and may call the stop at any point. A spike
count is not a stop: it is only a proxy for a context limit, and it fires wrong in both directions.

**At every rest point, load `issue-groom-methodology` and follow its § Entry: rest point**, which
carries the epic's changed decisions into the open issues they bind. A **rest point** is the moment
`discuss-methodology` confirms the shared conclusion on a topic, with its answers on the epic; each
spike resolution in Mode: Work; and each stop, before the session-end lint.

## Vocabulary

- **Epic** — the map. One file in the issues corpus carrying `role: epic`, holding only judgment:
  where this effort is going, what reaching it consists of, what has been decided, what is still foggy, and what has been ruled
  out. One epic has one bounded destination.
- **Spike** — a decision ticket. One file carrying `role: spike`, `epic: {slug}`, and `spike_type:`,
  belonging to one or more epics. Refer to a spike by its slug, a kebab-case title that reads at a
  glance.
- **Frontier** — the spikes that are workable right now: open, and with every blocker resolved.
  Derived by query, never stored.
- **Fog** — in-scope questions that cannot be phrased precisely yet. They live in the epic's
  `## Not Yet Specified` section and graduate into spikes as the frontier advances.
- **Outcome** — one condition that must be true for the destination to be reached. The epic's
  `## Outcomes` section lists them, one line each, and each line states what holds now:
  unticked with what the code lacks today, ticked once its condition is met, with the ticket and
  commit that delivered it. Decided work that is not filed lives in an unticked line's not-built clause, and becomes a
  build issue only through [breakdown-gate.md](breakdown-gate.md), never a spike.

Both epics and spikes are ordinary issues in `scratch/issues/`, distinguished by `role:`. No
per-epic folder holds the epic itself. `scratch/E-{epic-slug}/` is the store behind the epic file,
for the artifacts [keeping-the-epic-current.md](keeping-the-epic-current.md) sends there, each
linked from the epic.

**Split an epic on divergence, never on size.** Two lanes belong to one epic when they converge —
when resolving a spike in one would change how you frame a spike in the other — however many
spikes that makes. Split only when the lanes never meet: splitting forks the shared context, and the
second epic re-derives what the first already learned.

## Writing the Epic

The epic's body sections and the rule for its first edit are in [chart.md](chart.md) § The epic
body.

**The epic lists no inventory of open spikes or tickets.** No count of open work, no table of what
is left, no list of tickets, no "current status" line. `## Outcomes` is not that inventory: its
lines are conditions, which stay put while tickets are cut, merged and folded, and a line names
only the ticket filed to work it or, once ticked, the ticket and commit that delivered it. Every count and every listing of spikes or
tickets is derived at read time — by grep, or by
`scratch-memory epics frontier {epic-slug}`: judgment about a moving corpus ages well, and an
inventory of it does not.

**Every write to an epic body follows
[keeping-the-epic-current.md](keeping-the-epic-current.md):** adding a line, rewriting one whose
decision changed, or removing one. Read it before the first edit that changes a decision already on
the epic or touches `## Outcomes`.

## Spikes

A spike is created by `write_issue` with the epic/spike keys:

| Key | Value |
|---|---|
| `role` | `spike` |
| `epic` | the owning epic's slug; comma-separated with no spaces if it belongs to more than one |
| `spike_type` | `interview` \| `prototype` \| `research` \| `task` |
| `blocked_by` | comma-separated slugs of the issues this one waits on — any issue in the corpus, in any epic or none; **wired in a second pass, never at creation** |

The server rejects a spike that names no epic, and rejects `spike_type` on a file that is not a
spike. Always supply `spike_type` at creation: the corpus lint requires it on every spike, and
the first hand-edit to a spike missing it lands, then fails the edit hook and ends the turn.

A spike's body is the question it resolves. The unit is a conversation: a spike is something you would
deliberately go and discuss separately; neither a decision count nor a token number sizes it.

<D17-create-before-wire>
**Create every spike first. Wire every `blocked_by` edge in a second pass.**

An edge naming a spike that does not exist yet is a blocking finding, so an edge written before its
target exists ends the turn rather than flagging it. The order is always:

1. Create the epic (`write_issue`, then the one body edit).
2. Create every spike (`write_issue`, no `blocked_by` on any of them).
3. Second pass: hand-edit `blocked_by:` into the frontmatter of each spike that has blockers.

Omit `blocked_by` entirely when nothing blocks a spike. There is no empty-string form.
</D17-create-before-wire>

## Spike Types

Every spike is one of four types, and the type *is* its resolution rule.

| Type | Resolved by | Rule |
|---|---|---|
| `interview` | The user, in live conversation, via `discuss-methodology` | The defining property is **who decides**: the user does, in exchange, and the agent never answers its own questions or stands in for the user's side. `discuss-methodology` works the **question frontier** in rounds — ask the whole frontier, let the answers unlock the next one, and continue until nothing is left unasked. One round of questions is not a resolved spike. When the user confirms the conclusion, record it as Mode: Work step 4 gives. |
| `research` | The `researcher` agent | Dispatch it; capture the finding in the spike's `## Resolution`, and relay the trailer lines it returns. |
| `task` | Work that must happen before a decision can be made | The one type that *does* rather than decides — provisioning access, moving data so its shape can be seen. It earns its place by unblocking a decision, **not by delivering the destination**. Record what was done and any facts later spikes depend on. |
| `prototype` | A cheap, rough, concrete artifact to react to | Its `## Resolution` **must name at least one artifact by path or slug** — a rule the lint enforces, because a prototype's output is the evidence its decision rests on and free prose leaves it ungreppable. |

<D11-user-selects>
Where a prototype spike produces more than one candidate, **the user selects.** Selecting among
prototypes is the decision the spike exists to put to the user.
</D11-user-selects>

Resolve prototype spikes early where you can. An epic whose later spikes rest on assumptions the
earlier ones invalidated is the stale-epic failure mode, and an early concrete artifact is the
countermeasure.

## Ask, Spike, or Fog?

**The deliverable is an uncovered map of the fog, not a list of spikes.** Charting is a conversation
that maintains an epic: a question asked and answered in the room is fog lifted, and the epic records
it. A spike is one tool, for the part of the fog that will not fit in the conversation you are in.
Reaching for one is a late and deliberate conclusion, never an early or light one.

The test is whether you can state the question **precisely now**, not whether you can answer it now —
and then whether answering it needs a conversation of its own.

- **Ask it now** — the default for a sharp question. You are already in the conversation; the answer
  becomes a line in `## Decisions` and the fog it covered is gone.
- **Spike it** only on an isolation signal: it needs preparation that does not exist yet, it would
  derail the current thread, or it wants judgment unanchored by a decision just made.
- **Leave it as fog** when you cannot yet phrase it that sharply at all. Fog is coarser than a
  spike: one question there may graduate into several spikes, or none, once the frontier reaches
  it, so leave a deliberate gap dim rather than slicing it into spike-sized pieces.

`## Not Yet Specified` holds fog only: open questions. It excludes decisions, which belong in
`## Decisions`; decided work that is not built, which is an unticked outcome's not-built clause;
what is already a live spike or a filed issue; and what is out of scope.

## Out of Scope Is Not Fog

Fog gathers only *toward* the destination: work beyond it is out of scope, never fog, and scope, not
sharpness, decides which. A spike that turns out to sit past the destination — mis-scoped in while
charting, or exposed by another resolution — is resolved with its line under `## Out of Scope`, not
`## Decisions`, which records the current route. Out-of-scope work never graduates; it returns only
if the destination is redrawn, and then as a fresh effort, not a resumption.

## Mode: Work

1. **Load the epic.** Read its body — the low-resolution view. Do not read every spike.
2. **Choose one spike.** If the user named one, use it. Otherwise take the frontier:

   ```bash
   scratch-memory epics frontier {epic-slug}
   ```

   It writes one ready spike slug per line and exits 0. **Empty output at exit 0 means every open
   spike is blocked** — a clean state, not an error. Say so and stop; there is nothing workable
   until a blocker resolves. Exit 1 means the slug names no epic, which is a mistyped argument
   worth surfacing, not an empty frontier.

   **If the epic has no open spikes at all, the epic is clear** of decision work; unticked
   outcomes may remain. Run the session-end lint and its ingest first: a spike resolved in an
   earlier session without its epic line never reaches the frontier, and the lint's E5 is what
   catches it.

   **Then read [breakdown-gate.md](breakdown-gate.md) and run it.** It is a conversation with the
   user and it files the next workable builds; neither happens if you read straight to the stop.
   Only once its step 3 is on disk do you report that no spikes remain, name `/brainstorming` as
   the next command for each build filed, and stop — without invoking it. Never report the epic
   done while `## Outcomes` holds an unticked line.

   **Once a spike is chosen**, run `lane-methodology` § Held check on it, loading that skill for it,
   then `/refresh-issue {slug}`.
3. **Resolve it** per its type's rule above. Read related and resolved spikes on demand; that detail
   is not preloaded.
4. **Record the resolution.** Two edits:
   - Settle the spike with `scratch-memory issue close {spike} --status settled --resolution-file - <<'EOF'`,
     the heredoc holding the `## Resolution` body: its decision as one decision line
     ([`design-record`](../design-record/SKILL.md)), then the evidence it rests on; keep the
     delimiter quoted, so the shell expands no backtick or `$` in the body, and pick one no body
     line equals. The verb writes the dated heading and the status in one write,
     and fires no edit hook, so the session-end lint below is what checks the result.
   - By hand, in the epic's `## Decisions` — or `## Out of Scope` if the spike turned out to sit past the
     destination — add its decision line in the `design-record` shape, or rewrite the line it changes when it changes a decision already
     on the epic ([keeping-the-epic-current.md](keeping-the-epic-current.md)).
5. **Clear the fog the answer lifted.** Graduate any fog in `## Not Yet Specified` that is now
   sharp into fresh spikes (create-then-wire), and delete it from the section so it lives
   only as its new spikes. When the answer decides work to build, write it into `## Outcomes` as
   [keeping-the-epic-current.md](keeping-the-epic-current.md) gives; an unticked outcome is filed
   only through the breakdown gate. If the answer invalidates other spikes, update or resolve them. This
   is a rest point: its walk reshapes the open issues the answer's decision lines bind.
6. **Take the next spike, or stop.** Unless the record has fallen behind or the user has called
   the stop, return to step 2 and work the next frontier spike. When you do stop, run the stop's rest-point
   walk, then **run the session-end lint**.

## Session-End Lint

Before ending any discovery session, in either mode:

```bash
scratch-memory tasks lint scratch/issues/
```

**This is the only thing that makes the decision-record rule fire**: it runs in this directory
sweep and never on the edit-time hook.

A finding naming a resolved spike with no matching line is fixed by writing that line as Mode: Work
step 4 gives, never suppressed: a spike that resolves with no line leaves the epic stating a route the
corpus has already moved past.

**Then, when this session relayed a `Captured:` line, read [ingest-drift.md](ingest-drift.md) and
run it** before the breakdown gate or the stop. A session with no `Captured:` line, or with no drift
pending, dispatches nothing and says nothing about ingest.

## Pointers

- [breakdown-gate.md](breakdown-gate.md) — the one breakdown procedure: the strawman, the three
  questions, and the next workable build issues they produce. Reached from Mode: Work when the epic
  has no open spikes left, and from `issue-groom-methodology`'s epic groom step 5 after
  `/close-issue`.
- [keeping-the-epic-current.md](keeping-the-epic-current.md) — how every epic line is added,
  rewritten, ticked or removed, and the `## Outcomes` line format; read before any edit that
  changes a decision already on the epic or touches `## Outcomes`.
- [ingest-drift.md](ingest-drift.md) — the session-end drift ingest, for a session that relayed a
  `Captured:` line.
- [process-flow.md](process-flow.md) — both modes drawn as one graph.
- `issue-groom-methodology` — the epic groom (Intake, Rewire, Reshape, Fold back, Next-workable
  breakdown) that `/close-issue` runs after a build, and § Entry: rest point, the walk every rest point runs.
- `scratch-issues-methodology` — the corpus this stage writes into, and `issue-standard.md`, whose
  `## Folding` is the test the early exit and the breakdown gate apply.
- `scratch-memory` — the `write_issue` tool contract and the `epics` / `tasks` CLI verb groups.
  `epics graph {epic-slug}` prints an epic's members in blocker layers; when the `visual-companion`
  CLI is on PATH, see it drawn: register `scratch/issues/` with it, open
  `/{hash}/_explore?epic={epic-slug}`, and stay in its read-only pane, since a click on the Files view's `## Outcomes` checkboxes ticks a line
  with no ticket or commit behind it.
- `discuss-methodology` — the round-based interview this stage runs for every `interview` spike and
  for naming a destination. Its **question frontier** ranges over decisions inside one
  conversation; this stage's **spike frontier** ranges over spikes across sessions. Same idea, two
  granularities — say which one you mean.
- `interview-methodology` — the option-batch protocol, for a discussion that has bottomed out on one
  enumerable choice; not this stage's interview tool.
- `/brainstorming` — the next stage, and the only thing this one hands off to.
