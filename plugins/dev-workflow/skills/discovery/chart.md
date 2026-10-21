# Mode: Chart

Contents: The epic body · Steps

Run this when `/discovery` arrives with a loose idea rather than an epic slug. It names the
destination, creates the epic, maps the fog into it, and spikes what needs its own conversation.

## The epic body

An epic is created by `write_issue` like any other capture, so it arrives with the server's fixed
skeleton — `## Summary`, `## Context`, `## Impact`, `## Related`, `## Notes`. Keep `## Summary`: the
corpus lint requires it. Then add the epic's own six sections. Every decision line and diagram
below takes the form [`design-record`](../design-record/SKILL.md) gives.

```markdown
## Destination

<What reaching the end of this epic looks like: the design decision, the spec to hand to
/brainstorming, or the change this effort is finding its way to. One or two lines. Every session
orients to it before choosing a spike.>

## Architecture

<The system flowchart: the parts this epic touches and the seams between them, drawn when the epic
names a seam, with a one-sentence caption carrying the links. An epic that names no seam says so
in one sentence and draws nothing. It sits here, never inside ## Decisions, whose lint and
explorer reading a ## heading would end.>

## Outcomes

<The conditions that must be true for the Destination to be reached, one line each, as
they stand now. keeping-the-epic-current.md gives the line format and when a line is ticked.>

- [ ] <outcome>. Not built: <what the code lacks today>.
- [ ] <outcome> (ticket-slug). Not built: <what the code lacks today>.
- [x] <outcome as delivered> (ticket-slug, commit)

## Decisions

<The index: one line per decision, enough to judge relevance. A decision from a spike names its slug
and gists what that spike's ## Resolution holds, never restating it; one settled in the charting
conversation itself has no spike behind it, carries no slug, and the line is the whole record.>

- <the decision> ({spike-slug}), because <Y>
- <a decision settled in conversation, no slug>, because <Y>
- <the current decision>, not <X> (`{overridden-spike-slug}`), because <Y>

## Not Yet Specified

<In-scope fog: the suspected questions you can see coming but cannot phrase sharply yet. Graduates
into spikes as the frontier advances. Open questions only: decided work that is not built is an
outcome's not-built clause.>

## Out of Scope

<Work consciously ruled beyond the destination. Never graduates.>

- {spike-slug}: <the gist, plus why it sits past the destination>
```

<E11-blocking-rule>
**Write the whole epic body — `## Destination` included — in the same edit that first touches the
file.**

`## Destination` is required on any file carrying `role: epic`, and that rule is enforced by a
PostToolUse hook. `write_issue` is an MCP call and fires no hook, so the skeleton it emits is safe.
But the first `Edit` or `Write` you make to that file is checked, and an epic without
`## Destination` at that moment ends the turn: the hook runs *after* the tool, so your edit did
land — it exits 2 and surfaces the finding, which you must fix before continuing. Add the missing
section rather than re-issuing the edit. There is no warn tier anywhere in this corpus.
</E11-blocking-rule>

## Steps

1. **Ground the idea in the codebase, then name the destination.** Read first: find what already
   exists for this idea, what ships today, and what the relevant code actually does. Then load
   `discuss-methodology` and work its question frontier to pin down what this epic is finding
   its way to; the confirmed destination comes back here and this step writes it. The destination
   fixes the scope, so it is settled first. Bound it to one epic — an unbounded destination is what
   makes a map go stale.

   Reading before naming is what makes step 2's already-reached check possible at all. A
   destination named from the conversation alone can describe something that already ships, and
   nothing downstream will catch it.
2. **Grill again — map the fog with the user, breadth-first.** Load `discuss-methodology` a second
   time and fan out across the whole space rather than deep on any one thread, surfacing the open
   decisions and the first steps takeable now.

   **This pass happens with the user, in the conversation.** Two grilling passes precede any exit
   below, because the exit tests read what this pass surfaces. An agent that maps the fog privately
   is sizing the effort against its own guesses, and the questions it never asked are the ones that
   would have changed the size. If you are holding a list of sharp questions the user has not seen,
   you have not run this step yet — ask them.

   <D25-no-fog-exit priority="CRITICAL">
   **No exit here is reachable until step 2's grilling pass has actually happened.** These tests run
   on what the user told you, never on what you inferred alone.

   **Check first whether the destination is already reached** — the thing exists, or nothing is
   left to decide or build. That is its own exit: create no epic and no spikes, say what you found
   and on what evidence, and name **nothing** as next. `/brainstorming` designs work that is still
   ahead; naming it when there is no work sends the user to design something that already ships.

   **Then: does the route warrant an epic?** It does when the grilling showed a forcing condition
   from `scratch-issues-methodology` `issue-standard.md` `## Folding` — the route needs more than
   one build — or a question that wants its own conversation. When it showed neither, create no
   epic and no spikes. Being able to phrase several sharp questions is ambiguous evidence: most of
   them get asked in the room rather than spiked.

   **On this exit, recommend and then ask.** Say what you found, say which decisions you counted,
   recommend `/brainstorming`, and ask how they would like to proceed; the user invoked this stage,
   so the call is theirs. If they want the epic charted anyway, chart it.
   Owner: user-decision-rubric `what-to-work-on`
   </D25-no-fog-exit>

   **Create the epic the moment those exits are behind you — while the grilling is still running,
   not once it ends.** `write_issue` with `role: epic`, then one edit adding all six sections:
   Destination filled in, Architecture drawn once the conversation names a seam, Outcomes holding each condition the conversation can already state,
   Decisions holding whatever the conversation has already settled, the fog so far sketched into
   Not Yet Specified, Out of Scope holding anything already ruled past the destination. From there
   it is refined continuously — every answer lands in it as it arrives, so the grilling runs against
   a written map, not a transcript. An answer held until the grilling finishes has nowhere to live
   in the meantime. Each topic the grilling closes is a rest point (`SKILL.md` § Invocation).
3. **Create the spikes** — every question that wants its own conversation, with no `blocked_by`.
4. **Wire the edges** in a second pass.
5. **Fire the research spikes, then record what they returned.** For each `research` spike just
   created, dispatch a `researcher` agent to resolve it. These run in parallel.

   **You write the resolution, not the agent.** Take each agent's finding and apply `SKILL.md` § Mode:
   Work step 4's edits yourself — the dated `## Resolution`, the `status: settled` flip, and the epic's
   `## Decisions` line: add its gist, or rewrite the line it changes when it changes a decision
   already on the epic ([keeping-the-epic-current.md](keeping-the-epic-current.md)). `researcher`
   has `Write`/`Edit`, so say in the dispatch prompt that it is to return its finding and write
   nothing to `scratch/issues/`; two writers on one file produce a duplicated or half-applied
   resolution.

   **Relay what each agent persisted:** reproduce to the user the trailer lines its contract
   requires as you record the finding (the researcher skill's `## Dispatch Contract` § Trailer
   relay). Relay a `Captured:` line as what it is: a capture waiting for `knowledge-ingestor`, not
   a wiki page.

   A spike left resolved-in-fact but still `status: open` with no `## Resolution` passes the
   session-end lint — the decision-record rule only reads spikes already marked resolved — so
   nothing fires, and the next session re-runs research you already paid for.
6. **Stop when the record has fallen behind** (`SKILL.md` § Invocation) or the user calls the stop,
   then run the session-end lint (`SKILL.md` § Session-End Lint). Charting has no separate budget:
   while the record is current, keep going.
