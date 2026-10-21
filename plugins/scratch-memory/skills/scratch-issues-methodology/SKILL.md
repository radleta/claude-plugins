---
name: scratch-issues-methodology
description: "Conventions for the scratch/issues/ corpus — frontmatter, statuses, severity, queries, filing, resolution, and the issue standard (admission, groom determinations, fold-first build sizing). Use when reading, querying, filing, grooming, sizing builds from, rating or closing anything in scratch/issues/, or when tempted to build tooling for it — even for a single-file lookup."
user-invocable: false
---

# Scratch Issues Methodology

`scratch/issues/` is a markdown capture corpus; size varies by project.

## What this corpus is

`scratch/issues/` is the capture half of the knowledge system's feedback loop. Its writers file
through the `write_issue` MCP tool, or through its CLI twin `scratch-memory issue write`, which
shares the tool's validation and render:

- **`/capture-issue`** — the user-facing slash command, whose steps are § Entry: /capture-issue in
  [capture-issue-entry.md](capture-issue-entry.md). Classifies `kind`, extracts a title,
  structures the user's free-form description into the body fields, and calls
  `mcp__scratch-memory__write_issue`.
- **The `researcher` sub-agent, on a wiki page it read** — when an investigation finds
  forward-looking content sitting in a wiki page body, researcher files an issue itself, passing
  `related: "wiki:{domain}/{slug}"` so the issue back-links to that page. It does not edit the
  page: the correction leaves as a `learned/` capture (D15).
- **A session in another repo** — `/wrap-up` landing an item on a registered repo's issues
  destination, and commands that file into another repo, run `scratch-memory issue write
  --repo <name>`. The frontmatter's `repo`, `branch` and `commit` then describe the repo the
  issue was observed in, and `### Observed State` adds a `Filed into:` line naming this one.

A PostToolUse hook (`hooks/scratch-lint.sh`) lints every `Edit`/`Write`/`MultiEdit` to a file in this
corpus, in real time, and blocks on findings. `scratch-memory tasks lint 'scratch/issues/'` runs the
same rule set on demand, over one file or the whole directory. No scheduled job and no sweep at `/pickup` or `/handoff` covers this corpus; those two cover the active workstream's `tasks/` only, so this corpus is guarded at edit time and on demand, never surveyed periodically.

Ignore a `.deduped/` or other dot-prefixed directory beside the corpus: nothing writes there and it has no documented meaning.

## Frontmatter schema

The shared writer (`../scratch-memory/scripts/issues.mjs`, behind both the MCP tool and `issue write`) emits **10 required keys on every write**, in
the order below, plus **up to five optional keys** appended after them when the caller supplies
them. A file with frontmatter therefore carries the 10, or the 10 plus one to five more, or it
predates the writer. The ten and their order are unchanged by the optional keys, which is why
every file written before those keys existed still passes the lint untouched.

| Key | Source | Notes |
|---|---|---|
| `tool` | Server-authored | Always the literal `write_issue`. |
| `kind` | Caller-supplied | `issue \| idea \| mixed`. Server validates against this enum. |
| `title` | Caller-supplied | ≤ 80 chars, quote-escaped by the server. |
| `slug` | Derived | Slugified title, or `slug_override` if the caller passed one; deduped with a numeric suffix on collision. |
| `status` | **Server-hardcoded** | Always written as `open`. **The MCP server exposes no status parameter and no writer for any other value** — a non-`open` value is set by the `scratch-memory issue close` CLI verb or by hand-editing the file. There is no `resolve_issue` MCP tool. |
| `captured` | Server-authored | `new Date().toISOString()` at write time. |
| `repo` | Server-authored | From the calling session's git context. |
| `branch` | Server-authored | Same. |
| `commit` | Server-authored | Short SHA at capture time. |
| `working_tree` | Server-authored | e.g. `clean`, `2 modified, 1 untracked`. |

Full contract (params, error codes, slug collision behavior) lives in
[`scratch-memory/mcp-tools.md`](../scratch-memory/mcp-tools.md).

**The optional keys.** All five are caller-supplied, validated server-side, and emitted only when
supplied — always after the ten required keys, in this order:

| Key | Values | Sits on |
|---|---|---|
| `role` | `epic \| spike` | an epic or a spike |
| `epic` | the slug(s) of the epic(s) this file belongs to, comma-separated | a spike — and, deliberately, an ordinary capture may also carry it |
| `spike_type` | `interview \| prototype \| research \| task` | a spike |
| `blocked_by` | the slug(s) of the issues that must settle before this one is workable, comma-separated | any issue — the blocker may be any issue in this corpus, in any epic or none |
| `lens` | the strawman lens `/brainstorming` drafts the design on, a lens name from the `options-rubric` skill's `## Lenses`, stored lowercase and spaced as written there; hyphens are accepted and read as spaces | a build issue the breakdown gate filed |

A sixth optional key, **`severity`**, is not written by the server at all — it is hand-added during
triage and validated by the lint. See [Severity](#severity) below.

Another key, **`lane:`**, is hand-written too, and unvalidated: no lint rule checks it. It names the
last lane that held the issue, and stays after that lane ends, or is `none` on a `role: epic` issue
with no branch of its own. It is provenance, never the claim: the held check reads open lane
records; `lane-methodology` owns its values, who writes it, and that check.

The slug lists are **comma-separated scalars, never YAML lists**. The frontmatter parser splits
each line at the first colon and keeps the raw trimmed string, so a flow sequence would round-trip
as the literal text `[a, b]`. No space after the comma — a space is rejected, not trimmed. "No
blockers" is expressed by **omitting** `blocked_by` entirely, not by passing an empty value; the
same holds for every one of the five.

An epic or a spike (`role:`) follows [epics-and-spikes.md](epics-and-spikes.md).

**When a lint finding needs explaining, read [lint-rules.md](lint-rules.md).** It carries every
I-rule and E-rule `scratch-memory tasks lint` enforces over both tables above, the three
enforcement tiers, and the provenance and D12 exemptions.

## Body template

The server emits a fixed skeleton: an H1 prefixed by kind
([mcp-tools.md](../scratch-memory/mcp-tools.md)), then `## Summary`, `## Context` (with
`### Intent`, `### Observed State (captured {ts})`, `### Prior Investigation`), `## Impact`,
`## Related`, `## Notes`. A non-epic issue gains a hand-added `## Decisions` before `## Notes`
once a decision binds it alone: [`design-record`](../design-record/SKILL.md) lines, unstamped
and unlinted.

An omitted optional field is stamped with the server's canonical placeholder,
**`_Not captured._`** — this exact string means "the writer had nothing to say here," not "unknown"
or "missing." When hand-editing a file to add a section the server didn't stamp (e.g. filling in a
`## Resolution`), never reuse `_Not captured._` for content you're actually asserting — see
[corpus-state.md](corpus-state.md) for a worked example of the judgment this requires.

## Lifecycle

Status has **seven** values. Six are shared with the planning system a project layers on top of this
corpus, where one exists, so the two vocabularies cannot disagree; the seventh, `settled`, exists for
a shape this corpus has and a planning backlog does not.

| Status | Meaning |
|---|---|
| `open` | Needs disposition or work |
| `deferred` | Acknowledged, not now |
| `wont-fix` | Won't address |
| `fixed` | Addressed — the commit or code that closed it is cited in the body |
| `accepted` | By-design, no action |
| `moved` | Re-linked to a different epic |
| `settled` | The question was answered; the work it produced lives elsewhere |

**`settled` fits a question that was answered elsewhere.** Its commonest subject is a decision
spike: an interview, research, or prototype spike reaches a firm ruling and then hands
implementation to a later `/brainstorming` step or a separate build. That is neither `accepted`,
which asserts no action was needed when action was, nor `moved`, which points at one specific new
home when the work is usually spread across a later design. Any file may take it, an epic included
— an epic closes at whichever of the settled statuses fits the route it actually walked. A `settled` file's `## Resolution` should name where the work
went.

`resolved` is **retired**: the lint reports it as an invalid value rather than accepting it as an alias, so a file still using it surfaces instead of hiding.

**Settled** names the five that mean a disposition was reached: `wont-fix`, `fixed`, `accepted`,
`moved`, `settled`. `deferred` is deliberately not one of them — it acknowledges an issue without
deciding it, so a spike blocked behind a deferred spike is still blocked, and a deferred spike owes
its epic no decision line. E5, E12 and `epics frontier` all test settled membership rather than any
single value.

An issue whose subject a commit removed closes `wont-fix`, citing that commit, not `fixed`: the work
it asked for was never done, and the commit is why it never will be.

**The closing-section rule, both directions.** I7: a file at a settled status owes a section
matching `^## Resolution\b` — bare `## Resolution` or a dated `## Resolution (YYYY-MM-DD)` both
satisfy it. I8 is the reverse: `status: open` alongside such a section is stale status. `deferred`
is exempt from I7, because it acknowledges an issue without deciding it and so has nothing to write
down yet.

The section must state concretely what landed and where — a commit SHA, a file path, a version, or
a named decision. A closing section that just says "done" loses the trail the next reader needs, and
an agent may close an issue only by citing the specific commit or current code that closed it.

| Section heading found | Reads as a closing section? |
|---|---|
| `## Resolution` (bare) | Yes — the dominant form. |
| `## Resolution (2026-07-11)` (dated) | Yes — a trailing date parenthetical is accepted. |
| `## Proposed Resolution` | **No.** This is a proposal, not a closure — a legacy heading. |
| `## Update (...)` | **No.** An amendment marker, orthogonal to status — see below. |
| `## Partial Progress (..., NOT resolved)` | **No.** Self-declares non-closure in its own heading — files carrying it are `status: open`. |

`## Update` and `## Partial Progress` are **amendment markers**, not closure markers — a file
can carry either while remaining `open`, or while already closed and picking up a later
addendum. Never infer status from the presence of an `## Update` section; always read the
`status:` frontmatter key directly.

Non-conformance classes and the audit procedure for checking your corpus against them are
documented in [corpus-state.md](corpus-state.md).

## Severity

`severity` is an optional frontmatter key with five values. **This skill is where it is defined.**
`scratch-memory tasks lint` validates against this definition rather than owning a copy, and any
project-side lint should read the vocabulary from `scratch-memory tasks schema` for the same reason.

| Severity | A defect (`kind: issue`) | An idea (`kind: idea`) |
|---|---|---|
| `blocker` | Data loss, data corruption, a security or privacy exposure, money moving wrongly, or a completely broken path with no workaround | The product cannot ship its current goal without this capability |
| `high` | A significant built feature visibly broken for a real user or staff member, with a workaround or limited blast radius | Substantial value; the goal is materially weaker without it |
| `medium` | Degraded but working; or a control that behaves correctly in test and degrades invisibly in production | Worth building; the goal survives without it |
| `low` | Cosmetic, hygiene, or internal-only with no production reach | Marginal value, or valuable far past the current goal |
| `unrated` | — | Read, but the value call needs a person and has not been made |

How to judge a value, the `unrated` rule, and the proposal note for a severity the user did not
name are in [severity.md](severity.md); read it before writing or changing a `severity:` value.

## Project-specific application

Milestones, release gates and tool paths are recorded in the project, never here; [severity.md](severity.md#project-specific-application) says where. Read it before recording a project ruling.

**To triage or sweep the corpus rather than read one file, read
[query-cookbook.md](query-cookbook.md).** It carries the triage steps, the sizing, finding, conformance and
epic/spike recipes, and the `scratch-memory` verbs that supersede the ones worth automating.

## Filing policy

Filing is `/capture-issue`'s job mechanically; this section is the judgment layer that command
defers to.

- **Admit before filing.** Every writer § What this corpus is lists, and every other path into this
  corpus, applies [issue-standard.md](issue-standard.md) `## Admission` before a new file: its five
  questions and its duplicate search, which turns a match into a proposed addition to that issue.
- **Kind boundaries, in prose:**
  - `issue` — a concrete, observed failure of *existing* behavior. Something that works today and
    shouldn't, or doesn't work and should.
  - `idea` — a proposed *new* capability with no current-behavior failure underlying it.
  - `mixed` — a pain point whose root cause is a missing capability: there's a real symptom, but
    the fix is "build the thing that doesn't exist yet," not "repair what's broken." Prefer `mixed`
    when the description reads as both a complaint and a feature request.
- [capture-issue-entry.md](capture-issue-entry.md) holds the executable classification steps (canonical
  examples, slug-override detection, title overflow rule) and the duplicate search's mechanics — this
  skill and `issue-standard.md` hold the policy judgment behind them.

## Promotion from a workstream task

A workstream task that outgrows its workstream arrives here via `/capture-issue` — the same command
and the same `write_issue` path documented above; promotion adds no third writer to this corpus.
After the capture, the source task in `scratch/S-*/tasks/` is hand-edited to `status: promoted` with
`promoted_to: <slug>` pointing at the new file here (see handoff-methodology's Tasks section for the
task-side half of this flow). **Nothing in this corpus records the back-link:** an issue born from a
promoted task carries no marker distinguishing it from one filed directly, so a reader of the issue
will not see where it came from unless the `/capture-issue` invocation mentioned it in the body.
A promoted capture goes through `issue-standard.md` `## Admission`, duplicate search included, like
any other filing.

## Resolution procedure

`scratch-memory issue close {slug} --status {s} --resolution-file <path|-> [--summary-file <path|->]`
applies the three steps below in one write; nothing enforces them. Feed `-` from a heredoc with a
quoted delimiter, `<<'EOF'`, so the shell expands no backtick or `$` in the body, and pick a
delimiter no body line equals.

**When.** A build issue or a plain issue closes once its work has landed, citing the commit,
whatever state any lane holding it is in. An open or deferred issue that is not an epic or a spike
closes through `/close-issue`, which applies the three steps below and grooms the issues around
it; its refusal lines in `issue-groom-methodology` § Entry: /close-issue name the other homes.
Pick the settled status by [Lifecycle](#lifecycle): `fixed` for a defect, and `fixed`, `accepted`
or `settled` as the kind of work fits.

1. Append a **dated** closing section at the end of the file: `## Resolution (YYYY-MM-DD)`.
2. In that section, state concretely what landed: which change fixed it, and where (commit SHA,
   file path, or plan reference). A closing section that just says "done" loses the trail the next
   reader needs.
3. Flip `status: open` to whichever non-`open` value fits — see [Lifecycle](#lifecycle) for the set.

Editing by hand instead, write the closing section first: I7 fires on a settled status with no
`## Resolution`, and this corpus has no warn tier, so a status flip made first is itself the edit
the lint hook rejects.

[corpus-state.md](corpus-state.md) is the audit
procedure for finding cases where the frontmatter and the closing section disagree; run it against
your own corpus rather than trusting any fixed inventory.

## Pointers

- [issue-standard.md](issue-standard.md) — the issue standard: `## Folding` (how much one build
  holds), `## Admission`, `## Determinations`, `## Cluster groom` and `## Corpus sweep`. Read it
  before filing, grooming, or cutting work into build issues.
- [severity.md](severity.md) — how to judge a `severity:` value: the reading for a defect and an
  idea, `unrated`, the proposal note, the hard cases, and what a project records instead of this
  skill. Read it before writing or changing one.
- [epics-and-spikes.md](epics-and-spikes.md) — epic and spike files, an epic's members, the
  frontier, and closing an epic. Read it before creating, linking or closing either.
- [lint-rules.md](lint-rules.md) — every I-rule and E-rule the lint enforces, the three enforcement
  tiers, and the exemptions. Read it when a finding needs explaining or a rule's placement needs
  defending.
- [query-cookbook.md](query-cookbook.md) — the triage steps, the corpus-wide grep/sed recipes and the `scratch-memory`
  verbs that replace them. Read it when sweeping the corpus rather than reading one file.
- [ruled-out.md](ruled-out.md) — every tooling proposal considered for this corpus, its verdict, and
  the evidence. Read this before proposing a script, CLI verb, or lint for `scratch/issues/`.
- [corpus-state.md](corpus-state.md) — conformance-audit procedure for `scratch/issues/`: how to
  find each non-conformance class, why it happens, and how to fix it, with a worked example and a
  dated audit of this repo's own corpus.
- [`scratch-memory/mcp-tools.md`](../scratch-memory/mcp-tools.md) — the `write_issue` tool contract (params,
  error codes, slug collision handling).
- [capture-issue-entry.md](capture-issue-entry.md) — § Entry: /capture-issue. Read it when filing.
