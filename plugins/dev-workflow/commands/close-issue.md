---
description: "Close an open or deferred scratch/issues/ ticket, plus every other open ticket on its build's **Ticket:** line, and groom the tickets around them in the same pass — propose each Resolution, status and neighbor change, apply what you approve. Use when a ticket's work has shipped — even for one ticket with no neighbors. Grooming without closing is /groom-issues, a different test."
argument-hint: "<slug> [<project> | <from>..<to>] [--repo <name>]"
---

Load `issue-groom-methodology` with the Skill tool and follow its § Entry: /close-issue, with the arguments below. After that entry returns, when `workstream-groomer` is among this session's available agent types, load `handoff-methodology` with the Skill tool and run its `boundary-groom.md` with event `close-issue`; otherwise skip that step whole.

Arguments for the close entry: $ARGUMENTS
