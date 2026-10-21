# Epics and spikes

Companion to [SKILL.md](SKILL.md), whose Frontmatter schema defines the `role`, `epic`, `spike_type` and `blocked_by` keys these files carry.

An **epic** is a file carrying `role: epic` whose body adds `## Destination` (required),
`## Outcomes`, `## Decisions`, `## Not Yet Specified`, and `## Out of Scope` to the standard
skeleton below. A
**spike** is a decision ticket carrying `role: spike`, its `epic`, and a `spike_type`. Both are
ordinary files in this corpus with the same slug identity, the same lifecycle, and
the same lint as every other capture — nothing about them is stored anywhere else.

**An epic's members are its whole inventory, not only its spikes.** Any issue may carry `epic:`, and
every member that is not a spike is build work the epic needs to reach its destination — a build
issue is the ticket, and `scratch/{name}/` holds the design it points at. There is no separate
marker for build work: linking an issue to an epic IS the statement that it is required. Decided
work that is not filed is not a member: it sits in the not-built clause of an unticked line in the
epic's `## Outcomes`, and the progress `epics graph` derives covers filed work only. That member
progress is derived at read time and is never written into the epic; the ticks in `## Outcomes`
record which conditions are met, written at each close as `discovery/keeping-the-epic-current.md`
gives.

The `discovery` skill creates spikes and works them off the frontier. `scratch-memory epics frontier
<epic-slug>` derives which of an epic's spikes are workable right now; `scratch-memory epics graph
<epic-slug>` shows the whole membership, decision work and build work side by side, in blocker
layers. Neither stores what it derives.

**An epic closes when a person decides it.** Apply the decision with `scratch-memory issue close
{epic} --status {s} --resolution-file - <<'EOF'`, the body in that quoted heredoc, which writes the
`## Resolution` I7 requires and the settled `status:` in one write. No lint rule nudges an epic
toward closing, and no build closes the epic it was filed under — a build closes its own build issue. A quiet epic is not a finished one:
before proposing its close, check that `## Outcomes` holds no unticked line, and its `## Destination`, `## Outcomes` and
`## Decisions` against the code at `HEAD`, and cite what ships them in the `## Resolution`, since an epic whose members all closed can
still hold a decision the code contradicts.
