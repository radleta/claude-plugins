---
name: scratch-issues-methodology
description: "Conventions and query cookbook for the scratch/issues/ corpus — frontmatter schema, the open|resolved lifecycle, grep/sed recipes, filing policy, triage, and resolution procedure. Use when reading, querying, triaging, filing, or resolving anything in scratch/issues/, or when tempted to build tooling for it — even for a single-file lookup, since these conventions are documented nowhere else."
user-invocable: false
---

# Scratch Issues Methodology

`scratch/issues/` is a markdown capture corpus; size varies by project. This document covers its
frontmatter schema, body template, lifecycle, query recipes, filing policy, triage, and resolution
procedure.

## What this corpus is

`scratch/issues/` is the capture half of the knowledge system's feedback loop. Two writers file
here, both through the same MCP tool:

- **`/capture-issue`** — the user-facing slash command. Classifies `kind`, extracts a title,
  structures the user's free-form description into the body fields, and calls
  `mcp__scratch-memory__write_issue`.
- **The `researcher` sub-agent, during D6 auto-heal** — when an investigation finds a wiki page
  drifted from the live codebase (misclassification), researcher files an issue itself, passing
  `related: "wiki:{domain}/{slug}"` so the issue back-links to the wiki page it healed.

A PostToolUse hook (`hooks/scratch-lint.sh`) lints every `Edit`/`Write`/`MultiEdit` to a file in this
corpus, in real time, and blocks on findings. `scratch-memory tasks lint 'scratch/issues/'` runs the
same rule set on demand, over one file or the whole directory. There is still **no** scheduled job
and **no** sweep layer at `/pickup` or `/handoff` for this corpus — those two cover the active
workstream's `tasks/` only (spec T9). The distinction matters: this corpus is guarded at edit time
and on demand, not surveyed periodically; every read that isn't one of those two triggers is still
either a human triaging by hand or an agent grepping on demand.

If a `.deduped/` (or other dot-prefixed) directory is present alongside the corpus, nothing writes
there, it has no documented meaning, and dot-directories are out of scope by this project's
conventions — ignore it by convention if you find one.

## Frontmatter schema

The MCP server (`../scratch-memory/scripts/server.mjs`) emits **10 required keys on every write**, in
the order below, plus **up to four optional epic/spike keys** appended after them when the caller
supplies them. A file with frontmatter therefore carries the 10, or the 10 plus one to four more, or
it predates the writer. The ten and their order are unchanged by the optional keys, which is why
every file written before those keys existed still passes the lint untouched.

| Key | Source | Notes |
|---|---|---|
| `tool` | Server-authored | Always the literal `write_issue`. |
| `kind` | Caller-supplied | `issue \| idea \| mixed`. Server validates against this enum. |
| `title` | Caller-supplied | ≤ 80 chars, quote-escaped by the server. |
| `slug` | Derived | Slugified title, or `slug_override` if the caller passed one; deduped with a numeric suffix on collision. |
| `status` | **Server-hardcoded** | Always written as `open`. **The server exposes no status parameter and no writer for any other value** — every `resolved` value in the corpus was set by hand-editing the file directly. There is no `resolve_issue` tool. |
| `captured` | Server-authored | `new Date().toISOString()` at write time. |
| `repo` | Server-authored | From the calling session's git context. |
| `branch` | Server-authored | Same. |
| `commit` | Server-authored | Short SHA at capture time. |
| `working_tree` | Server-authored | e.g. `clean`, `2 modified, 1 untracked`. |

Full contract (params, error codes, slug collision behavior) lives in
[`scratch-memory/mcp-tools.md`](../scratch-memory/mcp-tools.md) — this table only covers what a *reader* of
the corpus needs to know.

**The optional epic/spike keys.** All four are caller-supplied, validated server-side, and emitted
only when supplied — always after the ten required keys, in this order:

| Key | Values | Sits on |
|---|---|---|
| `role` | `epic \| spike` | an epic or a spike |
| `epic` | the slug(s) of the epic(s) this file belongs to, comma-separated | a spike — and, deliberately, an ordinary capture may also carry it |
| `spike_type` | `interview \| prototype \| research \| task` | a spike |
| `blocked_by` | the slug(s) of the spikes that must resolve before this one is workable, comma-separated | a spike |

These are **comma-separated scalars, never YAML lists**. The frontmatter parser splits each line at
the first colon and keeps the raw trimmed string, so a flow sequence would round-trip as the literal
text `[a, b]`. No space after the comma — a space is rejected, not trimmed. "No blockers" is
expressed by **omitting** `blocked_by` entirely, not by passing an empty value; the same holds for
every one of the four.

An **epic** is a file carrying `role: epic` whose body adds `## Destination` (required),
`## Decisions`, `## Not Yet Specified`, and `## Out of Scope` to the standard skeleton below. A
**spike** is a decision ticket carrying `role: spike`, its `epic`, and a `spike_type`. Both are
ordinary files in this corpus with the same slug identity, the same `open|resolved` lifecycle, and
the same lint as every other capture — nothing about them is stored anywhere else. The `discovery`
skill is the stage that creates them and works them one per session; `scratch-memory epics frontier
<epic-slug>` derives which of an epic's spikes are workable right now, and never stores that list.

### The full-schema lint

`scratch-memory tasks lint` (contract in [`scratch-memory/cli-verbs.md`](../scratch-memory/cli-verbs.md))
validates every field in both tables above, plus the body-structure rules, against any file in this
corpus that has a frontmatter block. Two rule families run: **I-rules** cover the ten required keys
and the body, and **E-rules** cover the optional epic/spike keys and the graph they describe.

**I-rules — the ten required keys and the body:**

- All 10 required keys present (I1).
- `kind` in its enum (I2) and `status` in its enum (I3).
- `captured` is ISO-8601 — a bare `YYYY-MM-DD` or the full datetime, both accepted (I4).
- `title` is 1–80 characters (I5).
- `slug` matches the filename, sans `.md` and sans any numeric collision suffix (I6).
- The `## Resolution` pairing rule, both directions: `status: resolved` requires a heading matching
  `^## Resolution\b` — bare `## Resolution` or a dated `## Resolution (YYYY-MM-DD)` both satisfy it;
  `## Proposed Resolution`, `## Update`, and `## Partial Progress` do not (I7). `status: open` with a
  matching heading is flagged as stale (I8).
- A `## Summary` section heading is present ([corpus-state.md](corpus-state.md)'s Class 2) (I9).

**E-rules — the optional epic/spike keys.** Twelve rules across three enforcement tiers. What
separates the tiers is not importance but whether a rule can fire while a legitimate edit is
half-finished: anything that can must stay off the hook, because a finding there blocks the edit.

| Tier | Rules | Where it runs | Blocks the edit? |
|---|---|---|---|
| 1 — per-file | E4, E6, E7, E8, E9, E10, E11, E12 | beside the I-rules, on the file in front of it | Yes |
| 2a — graph | E1, E2, E3 | when the linted **file** carries `role:` or `epic:`, over that epic's sibling files | Yes |
| 2b — record | E5 | the **directory** sweep only — `scratch-memory tasks lint scratch/issues/` | No — never runs on the hook |

| Rule | Checks |
|---|---|
| E1 | every slug in a spike's `blocked_by` resolves to a spike in the same epic |
| E2 | the `blocked_by` graph is acyclic — a spike listing itself is a 1-cycle and is caught here |
| E3 | every slug in a file's `epic` resolves to an existing file carrying `role: epic` |
| E4 | `role`, when present, is `epic` or `spike` |
| E5 | every resolved spike has a matching line in **either** its epic's `## Decisions` **or** its `## Out of Scope` |
| E6 | `spike_type`, when present, is one of the four types |
| E7 | `role: spike` requires a non-empty `epic` |
| E8 | `role: spike` requires a non-empty `spike_type` |
| E9 | every element of `epic` and `blocked_by` is a well-formed slug — comma-separated, no empty elements |
| E10 | a file carrying `spike_type` or `blocked_by` must carry `role: spike` |
| E11 | `role: epic` requires a `## Destination` section |
| E12 | a `spike_type: prototype` spike at `status: resolved` needs a `## Resolution` naming at least one `scratch/issues/` path or a backticked slug |

Three properties of this set are deliberate and easy to misread:

- **E5 never runs on the hook.** Between flipping a spike to `resolved` and appending its line to the
  epic, the rule is legitimately unsatisfied — on the hook it would block that very edit, every time.
  It fires only on the directory sweep, which is what a session working an epic runs at the end. That
  sweep is the only thing that catches a spike resolving without its decision being recorded.
- **E5 accepts the line under `## Out of Scope` as readily as under `## Decisions`.** A spike ruled
  past the epic's destination closes as a scope boundary, not as a step on the route; demanding its
  line under `## Decisions` would falsify the record that section exists to keep.
- **E10 deliberately does not cover `epic`.** A plain capture may carry `epic:` with no `role:`,
  because whether an ordinary capture can be promoted into a spike in place is an open question and a
  blocking rule must not foreclose it. E7 still guarantees every spike names its epic, and E3 still
  validates the reference. `write_issue`'s server-side validation mirrors the same asymmetry.

All three of corpus-state.md's documented non-conformance classes (Class 1 → I7, Class 2 → I9,
Class 3 → I8) are now automated by this lint — a reader does not need to work out which manual
checks still have to be run by hand.

**The D12 exemption:** files with no frontmatter block (first line not `---`) are skipped by every
rule above, silently, with no output of any kind. This is deliberate, not an oversight — see
[corpus-state.md](corpus-state.md)'s no-frontmatter disposition rules for why: fabricating a
`commit`/`branch`/`captured`/`working_tree` value for one of these files to make it lintable would be
worse than the gap, so the lint treats them as out of scope rather than pressuring anyone toward
that.

## Body template

The server emits a fixed section skeleton, kind-prefixed on the H1:

| kind | H1 prefix |
|---|---|
| `issue` | `# Issue: {title}` |
| `idea` | `# Idea: {title}` |
| `mixed` | `# Feature: {title}` |

Followed by, in order: `## Summary`, `## Context` (with `### Intent`, `### Observed State (captured
{ts})`, `### Prior Investigation`), `## Impact`, `## Related`, `## Notes`.

Any optional field the caller omitted is stamped with the server's canonical placeholder,
**`_Not captured._`** — this exact string means "the writer had nothing to say here," not "unknown"
or "missing." When hand-editing a file to add a section the server didn't stamp (e.g. filling in a
`## Resolution`), never reuse `_Not captured._` for content you're actually asserting — see
[corpus-state.md](corpus-state.md) for a worked example of the judgment this requires.

## Lifecycle

Status is exactly two states: **`open`** and **`resolved`**. There is no third state — see
[ruled-out.md](ruled-out.md) for why a `partial` state was proposed and rejected.

**The pairing rule:** `status: resolved` implies a closing section matching `^## Resolution\b`.

| Section heading found | Satisfies the rule? |
|---|---|
| `## Resolution` (bare) | Yes — the dominant form. |
| `## Resolution (2026-07-11)` (dated) | Yes — a trailing date parenthetical is accepted. |
| `## Proposed Resolution` | **No.** This is a proposal, not a closure — a legacy heading. |
| `## Update (...)` | **No.** An amendment marker, orthogonal to status — see below. |
| `## Partial Progress (..., NOT resolved)` | **No.** Self-declares non-closure in its own heading — files carrying it are `status: open`, not resolved. |

`## Update` and `## Partial Progress` are **amendment markers**, not closure markers — a file
can carry either while remaining `open`, or while already `resolved` and picking up a later
addendum. Never infer status from the presence of an `## Update` section; always read the
`status:` frontmatter key directly.

Non-conformance classes and the audit procedure for checking your corpus against them are
documented in [corpus-state.md](corpus-state.md).

## Query cookbook

For a single file, a plain `Read` is usually the right tool. These recipes are for corpus-wide
sweeps, where reading every file individually would be wasteful — but corpus size varies by
project, so size yours before assuming that's true for you.

**Size up your corpus:**

```bash
# File count
ls scratch/issues/*.md | wc -l

# Status split
grep -h '^status:' scratch/issues/*.md | sort | uniq -c

# Kind split
grep -h '^kind:' scratch/issues/*.md | sort | uniq -c
```

**Find, read, and check issues:**

```bash
# List open issues (filenames)
grep -l '^status: open' scratch/issues/*.md

# List by kind
grep -l '^kind: idea' scratch/issues/*.md

# All titles, for a quick scan / duplicate check before filing
grep -h '^title:' scratch/issues/*.md

# Read one section of one file without pulling in the whole body
sed -n '/^## Summary/,/^## Context/p' scratch/issues/<slug>.md

# Conformance check: resolved files missing a ## Resolution section
# — now automated by `scratch-memory tasks lint 'scratch/issues/'` (rule I7); this recipe remains
# as the tool-free equivalent.
for f in scratch/issues/*.md; do
  if grep -q '^status: resolved' "$f" && ! grep -qE '^## Resolution\b' "$f"; then
    echo "$f"
  fi
done

# Files with no frontmatter at all (predate the MCP writer)
for f in scratch/issues/*.md; do
  [ "$(head -1 "$f")" = "---" ] || echo "$f"
done
```

**Epics and spikes share this corpus, so `role:` is the excluder.** Since epics and spikes are
ordinary files here, they answer the status and kind queries above alongside ordinary captures — an
epic is `status: open` for as long as its route is unfinished. Anything that means "captures only"
has to say so:

```bash
# Open captures only — excludes epics and spikes
grep -l '^status: open' scratch/issues/*.md | xargs -r grep -L '^role:'

# Epics only
grep -l '^role: epic' scratch/issues/*.md

# Every spike of one epic — the ^epic: value is a comma-separated list, so match it as one
grep -lE '^epic: ([a-z0-9-]+,)*<epic-slug>(,[a-z0-9-]+)*$' scratch/issues/*.md

# Open spikes of one epic that are actually workable right now (blockers all resolved).
# Derived from the live files every time; nothing stores this list.
scratch-memory epics frontier <epic-slug>
```

`xargs -r` matters in the first recipe: without it, an empty result leaves `grep -L` reading stdin
instead of exiting.

Compose these with plain shell — `grep -l ... | xargs grep -l ...` for AND queries, `comm` or `diff`
on two sorted `grep -l` outputs for set operations. See [ruled-out.md](ruled-out.md).

## Filing policy

Filing is `/capture-issue`'s job mechanically; this section is the judgment layer that command
defers to.

- **Check for an existing capture first.** Before filing, scan titles (`grep -h '^title:'
  scratch/issues/*.md`) and plausible slugs for a match. A near-duplicate capture is worse than no
  capture — it splits the trail for the same underlying problem across two files that never
  reference each other.
- **Kind boundaries, in prose:**
  - `issue` — a concrete, observed failure of *existing* behavior. Something that works today and
    shouldn't, or doesn't work and should.
  - `idea` — a proposed *new* capability with no current-behavior failure underlying it.
  - `mixed` — a pain point whose root cause is a missing capability: there's a real symptom, but
    the fix is "build the thing that doesn't exist yet," not "repair what's broken." Prefer `mixed`
    when the description reads as both a complaint and a feature request.
- `.claude/commands/capture-issue.md` holds the executable classification steps (canonical examples,
  slug-override detection, title overflow rule) — this skill holds the policy judgment behind them.
  Don't duplicate the command's mechanics here; don't duplicate this skill's policy there.

## Promotion from a workstream task

A workstream task that outgrows its workstream arrives here via `/capture-issue` — the same command
and the same `write_issue` path documented above; promotion adds no third writer to this corpus.
After the capture, the source task in `scratch/S-*/tasks/` is hand-edited to `status: promoted` with
`promoted_to: <slug>` pointing at the new file here (see handoff-methodology's Tasks section for the
task-side half of this flow). **Nothing in this corpus records the back-link:** an issue born from a
promoted task carries no marker distinguishing it from one filed directly, so a reader of the issue
will not see where it came from unless the `/capture-issue` invocation mentioned it in the body.

## Triage guidance

Read status from the live files, every time — never from a maintained index; see
[ruled-out.md](ruled-out.md) for the history of the hand-built triage index this rule replaced.
**A static file cannot track a mutating corpus** — query it fresh with the cookbook above instead
of trusting anything that claims to summarize it.

To triage a batch of open issues:

1. `grep -l '^status: open' scratch/issues/*.md` for the working set.
2. Pull titles and kinds for a first pass: `grep -h '^title:\|^kind:' <files>`.
3. Read full files for anything you're about to act on — cheap if your corpus's files run short;
   use the sizing recipe above to check rather than assuming.
4. Rank by your own judgment of impact and staleness — there is no numeric priority field to sort
   on. Staleness signal: an old `captured:` date with no `## Update` section suggests nobody has
   touched it since filing; an `## Update` section with a recent date suggests it's still being
   tracked.

## Resolution procedure

Resolving an issue is an entirely manual hand-edit — no tool enforces or automates any part of it.

1. Flip `status: open` → `status: resolved` in the frontmatter.
2. Append a **dated** closing section at the end of the file: `## Resolution (YYYY-MM-DD)`.
3. In that section, state concretely what landed: which change fixed it, and where (commit SHA,
   file path, or plan reference). A closing section that just says "done" loses the trail the next
   reader needs.

Because this is unenforced, drift is expected — [corpus-state.md](corpus-state.md) is the audit
procedure for finding cases where the frontmatter and the closing section disagree; run it against
your own corpus rather than trusting any fixed inventory.

## Pointers

- [ruled-out.md](ruled-out.md) — every tooling proposal considered for this corpus, its verdict, and
  the evidence. Read this before proposing a script, CLI verb, or lint for `scratch/issues/`.
- [corpus-state.md](corpus-state.md) — conformance-audit procedure for `scratch/issues/`: how to
  find each non-conformance class, why it happens, and how to fix it, with a worked example and a
  dated audit of this repo's own corpus.
- [`scratch-memory/mcp-tools.md`](../scratch-memory/mcp-tools.md) — the `write_issue` tool contract (params,
  error codes, slug collision handling).
- [`.claude/commands/capture-issue.md`](../../commands/capture-issue.md) — the filing command's
  executable steps (classification examples, title overflow rule, slug-override detection).
