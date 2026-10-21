# Recovering a ticket from an epic

Step 1.1's third case: the prose named an epic slug but no ticket. The epic's Breakdown Gate filed a ticket and nobody carried it across the session gap, so recover it from the epic's own open build work rather than shipping a build that leaves its issue open:

```bash
scratch-memory epics graph {epic-slug} --json \
  | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).build.flat().filter(m=>m.status==='open').map(m=>'scratch/issues/'+m.slug+'.md').join('\n')"
```

`--json` is this verb's contract; never parse its text form. Then act on what came back,
and on nothing else:

- **One path** — that is the ticket, recovered rather than told; step 2's post-gate
  message says so in one line, so the user can correct you before the design is built
  against the wrong ticket.
- **Two or more** — read each one's `title:` and `## Summary`, list them, and ask the user
  which one this design is. Ask that alone and wait for the answer before the lens, so a
  lens the ticket recorded is never overridden by an answer given on a guess. List every
  path the lookup returned: the candidates are lookup results, not design options, so
  `options-rubric`'s three-option floor does not apply. Never pick: the lookup ranks
  nothing, and a wrong ticket closes work that did not ship.
  Owner: user-decision-rubric `what-to-work-on`
- **Nothing** — there is no ticket. The epic has no open build work, so there is no
  ticket this design could be closing.
