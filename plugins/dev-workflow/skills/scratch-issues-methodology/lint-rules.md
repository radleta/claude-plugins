# The Full-Schema Lint

Every rule `scratch-memory tasks lint` enforces over `scratch/issues/`, and why each one runs where
it does. The schema these rules validate is in [SKILL.md](SKILL.md); read this page when a finding
needs explaining or a rule's placement needs defending.

`scratch-memory tasks lint` (contract in [`scratch-memory/cli-verbs.md`](../scratch-memory/cli-verbs.md))
validates every field in both tables of [SKILL.md](SKILL.md)'s Frontmatter schema, plus the
body-structure rules, against any file in this corpus that has a frontmatter block. Two rule
families run: **I-rules** cover the ten required keys and the body, and **E-rules** cover the
optional epic/spike keys and the graph they describe.

**I-rules — the ten required keys and the body:**

- All 10 required keys present (I1).
- `kind` in its enum (I2) and `status` in its enum (I3).
- `captured` is ISO-8601 — a bare `YYYY-MM-DD` or the full datetime, both accepted (I4).
- `title` is 1–80 characters (I5).
- `slug` matches the filename, sans `.md` and sans any numeric collision suffix (I6).
- The `## Resolution` pairing rule, both directions: a settled status requires a heading matching
  `^## Resolution\b` (I7), and `status: open` alongside one is flagged as stale (I8). `deferred` is
  exempt from I7. See [Lifecycle](SKILL.md#lifecycle).
- A `## Summary` section heading is present ([corpus-state.md](corpus-state.md)'s Class 2) (I9).
- `severity`, when present, is one of the five values in [Severity](SKILL.md#severity) (I10).
  Absent is always fine — the field is optional, and absent is not the same as `unrated`.

**The provenance exemption (I1).** Six of the ten keys — `tool`, `repo`, `branch`, `commit`,
`captured`, `working_tree` — are demanded only of files that claim the MCP writer, meaning
`tool: write_issue` exactly. Everything else is exempt from those six and fully enforced on the
rest. The reason is in [corpus-state.md](corpus-state.md): a legacy file cannot supply a real
`commit` SHA or `captured` timestamp, fabricating one is forbidden, and a sentinel poisons a typed
field for every consumer that sorts or filters on it. D12's original exemption covered only files
with *no* frontmatter block; corpora whose legacy files carry *partial* frontmatter fell through it
and reported findings that could never be legitimately cleared. `kind` is deliberately **not** in
the exempt set: it is a classification derivable by reading the file, not provenance. A reader
wanting a legacy file's write date uses `git log --follow`.

**E-rules — the optional epic/spike keys.** Twelve rules across three enforcement tiers. What
separates the tiers is not importance but whether a rule can fire while a legitimate edit is
half-finished: anything that can must stay off the hook, because a finding there blocks the edit.

| Tier | Rules | Where it runs | Blocks the edit? |
|---|---|---|---|
| 1 — per-file | E4, E6, E7, E8, E9, E10, E11, E12 | beside the I-rules, on the file in front of it | Yes |
| 2a — graph | E1, E2, E3 | when the linted **file** carries `role:`, `epic:` or `blocked_by:`, over the whole corpus | Yes |
| 2b — record | E5, M1 | the **directory** sweep only — `scratch-memory tasks lint scratch/issues/` | No — never runs on the hook |

| Rule | Checks |
|---|---|
| E1 | every slug in a file's `blocked_by` resolves to an existing file in this corpus |
| E2 | the `blocked_by` graph over the whole corpus is acyclic — a file listing itself is a 1-cycle and is caught here |
| E3 | every slug in a file's `epic` resolves to an existing file carrying `role: epic` |
| E4 | `role`, when present, is `epic` or `spike` |
| E5 | every **settled** spike has a matching line in **either** its epic's `## Decisions` **or** its `## Out of Scope` |
| E6 | `spike_type`, when present, is one of the four types |
| E7 | `role: spike` requires a non-empty `epic` |
| E8 | `role: spike` requires a non-empty `spike_type` |
| E9 | every element of `epic` and `blocked_by` is a well-formed slug — comma-separated, no empty elements |
| E10 | a file carrying `spike_type` must carry `role: spike` |
| E11 | `role: epic` requires a `## Destination` section |
| E12 | a **settled** `spike_type: prototype` spike needs a `## Resolution` naming at least one `scratch/issues/` path or a backticked slug — including when the section is absent entirely |

The properties below are deliberate and easy to misread:

- **E5 never runs on the hook.** Between settling a spike and writing its line in the
  epic, the rule is legitimately unsatisfied — on the hook it would block that very edit, every time.
  It fires only on the directory sweep, which is what a session working an epic runs at the end. That
  sweep is the only thing that catches a spike resolving without its decision being recorded.
- **E5 accepts the line under `## Out of Scope` as readily as under `## Decisions`.** A spike ruled
  past the epic's destination closes as a scope boundary, not as a step on the route; demanding its
  line under `## Decisions` would falsify the current route that section records.
- **E10 covers `spike_type` alone.** It leaves `epic:` uncovered because whether an ordinary
  capture can be promoted into a spike in place is an open question a blocking rule must not
  foreclose, and it leaves `blocked_by:` uncovered because blocking is not a spike's private
  relationship — any issue may wait on any other. E7 still guarantees every spike names its epic,
  and E3 still validates the reference. `write_issue`'s server-side validation mirrors the same
  asymmetry.
- **E1 and E2 read the whole corpus but report narrowly.** The hook reports only edges leaving the
  file it just linted and only cycles passing through it, so a stale edge somewhere else can never
  block an unrelated edit. The directory sweep reports every edge and every cycle once, each under
  the filename that carries it. That is why a blocked issue belonging to no epic still gets its
  rules: they are keyed by the graph, not by an epic.

**M1 — Mermaid blocks, directory sweep only.** On `scratch-memory tasks lint scratch/issues/`, every
file holding a `mermaid` fence goes to `mermaid-check` (`design-record`), which parses it against
the pinned Mermaid version. A block that fails is a finding,
`WARN: {basename}: mermaid parse failure at line {line}: {message}`, `{line}` being the fence's
opening line, and fails the sweep like any other. M1 sits with E5 in tier 2b and never runs on the
hook: starting a DOM to parse diagrams on every edit would slow every save. When `mermaid-check` is
absent from PATH or exits `69`, the sweep prints `Mermaid check skipped` on stderr and leaves the
exit code alone: a skipped check is neither a finding nor a pass.

All three of corpus-state.md's non-conformance classes are automated by this lint: Class 1 → I7,
Class 2 → I9, Class 3 → I8.

**The D12 exemption:** files with no frontmatter block (first line not `---`) are skipped by every
rule above, silently, with no output of any kind. This is deliberate, not an oversight — see
[corpus-state.md](corpus-state.md)'s legacy-file disposition rules for why: fabricating a
`commit`/`branch`/`captured`/`working_tree` value for one of these files to make it lintable would be
worse than the gap, so the lint treats them as out of scope rather than pressuring anyone toward
that. The provenance exemption described under I1 above is the same rule reaching the more common
case, a legacy file carrying *partial* frontmatter.
