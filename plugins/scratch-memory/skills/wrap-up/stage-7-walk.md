# Stage 7 — The walk

Companion to [SKILL.md](SKILL.md) § Stage 7, which walks `{W}README.md` with the user theme by
theme, writing every ruling into the matching `decision:` field as they give it. `/wrap-up` runs
off a lane, so every item lands on a base (`lane-scope.md` gives the lane run).

Owner: user-decision-rubric `corpus-calls` for a promotion that files, appends to or closes an
issue, and for a task's `drop` or `promote`

Owner: user-decision-rubric (test: Undo) for every other item

- **Promotions, question answers and question issues** — one ruling each: `approve`, `edit`
  (write their change into the file: its `## Land as`, its destination and target, or its disposition), or
  `reject`. `reject` means drop and is allowed only on a promotion whose `kind` is `decision`,
  `avoid` or `file`; a task, a question, and a pulled-out held or drop item take `approve` or
  `edit`, so every item that must leave with a disposition gets one.
- **Code, docs or primitive items** — also ask: file an issue, or make the edit now? Write their
  choice into `route: issue|edit`.
- **Block files** (`held.md`, `drops.md`, `question-closes.md`) — one ruling per block, after they
  have seen its counts per reason and spot checks. A line they pull out leaves the block: delete it
  there and write it as its own file, then rule it on its own.
  - from `held.md` or `drops.md`: `{W}held/{id}-{slug}.md` or `{W}drops/{id}-{slug}.md`, with
    promotion-file frontmatter, `destination: held` or `destination: drop`, and `target:` the file:line or the
    reason word;
  - from `question-closes.md`: `{W}questions/{qid}-{slug}.md` with `proposal: close`.
  A rejected block has every line pulled out this way and ruled one by one; the emptied block
  keeps `decision: reject`.
