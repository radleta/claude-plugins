---
name: knowledge-capture
description: "Knowledge capture layer for `learned/` files — capture heuristic, frontmatter schema, file naming and slug derivation, drift severity, capture checkpoint protocol. Use when writing a learned file, dispatching knowledge-ingestor, checking learned/ status, wiring capture into a workflow command, or evaluating a discovery at a pause point — even when the exchange produced nothing significant. Ingestion-time filtering is `knowledge-distillation`: a different test."
user-invocable: false
---

# Knowledge Capture

Shared methodology for writing and routing `learned/` files during dev workflows. Loaded by brainstorming and by the build coder when a turn produces a capture.

Capture is cheap; ingestion is the quality gate. This skill owns capture. The `knowledge-distillation` skill owns the 3-filter framework applied during _ingestion_.

---

## Capture Heuristic

**Write a learned file when ANY of these are true:**

1. **Contradicts expectations** — something works differently than docs, wiki, or reasonable assumption suggests
2. **Not documented anywhere** — a fact about the codebase or technology not in wiki-memory, CLAUDE.md, or project docs
3. **Would change future work** — a pattern, constraint, or gotcha someone working here next time needs to know
4. **Corrects stale knowledge** — wiki-memory or docs say X, reality is Y (`type: drift`)

**Do NOT write a learned file when:**

1. **Obvious from the code** — "the project uses React 18" (visible in package.json)
2. **Already in the spec/plan** — a design decision already documented, not a discovery
3. **Generic knowledge Claude already has** — "use parameterized SQL to prevent injection"
4. **Transient** — "the build is broken right now because of X" (will be fixed this session)
5. **Task-specific** — "step 3 took longer than expected" (process observation, not domain knowledge)
6. **Describes what should be, not what is** — forward-looking content (proposals, defects awaiting fix, "this should be improved", architectural gaps, refactor ideas) routes to `/capture-issue` via `mcp__scratch-memory__write_issue`, not the wiki or `learned/`.

**Filter 4 — does this describe what exists (current state), not what should exist (forward-looking)?** Apply after the knowledge-distillation 3 filters. Content that fails Filter 4 is neither captured as a learned file nor written to the wiki — route to `/capture-issue` instead. The wiki captures current-state knowledge only.

**D7 dual-routing.** One observation can carry both framings: a *defect-gotcha* is a surprising current behavior that is also a defect. File both halves in the same dispatch — the current-state framing (what the code does, stated as `type: gotcha`) to the wiki, and the forward-looking framing (what should be fixed) to `/capture-issue`, carrying `related: "wiki:{domain}/{slug}"` back to the wiki half. Filter 4 does not block the wiki half, because that half's framing is explicitly current-state.

**Tiebreaker:** When a candidate matches both a "write when" and a "don't write when" rule, **the negative rule wins** — err toward not capturing, since a lean wiki with high-signal entries outperforms a bloated one. A Filter 4 failure is never captured regardless of positive signal strength, unless the same observation also describes current-state behavior as a gotcha — then file both halves per D7.

---

## Frontmatter Schema

| Field | Type | Required | Allowed Values |
|---|---|---|---|
| `source` | string | yes | `brainstorming/research`, `brainstorming/decisions`, `planning/investigation`, `implementation/step-NN`, `implementation/ad-hoc` |
| `type` | enum | yes | `research`, `decision`, `gotcha`, `pattern`, `drift` |
| `scope` | enum | yes | `project`, `user` |
| `target-domain` | string | yes | wiki domain name (e.g., `billing-expert`, `dynamodb`) |
| `target-page` | string | no | page slug within the domain, optional one subdir segment (e.g. `backend/v1-controllers`); absent → slug derived from the learned filename per [Slug derivation](#slug-derivation) |
| `status` | enum | yes | `captured`, `ingested`, `escalated` |
| `escalation-reason` | string | no | free text — populated at emission time when `severity: misleading` (not when `status: escalated`, which happens later during ingestion); cites the D16 rationale (interpretive / multi-fact / judgment-required / uncertain-default) |
| `ingested-at` | ISO 8601 | no | timestamp — populated when `status: ingested` |
| `targets-step` | integer | no | plan step number — for feed-forward surfacing |
| `severity` | enum | yes, for `type: drift` | `minor`, `misleading` — **only for `type: drift`**; routing-authoritative (see `## Drift Severity`) |

---

## File Body Template

```markdown
## [Title: What Was Learned]

[Body: what was discovered, where it applies, what to do differently]

**Discovered:** [context — which phase/step, what triggered the discovery]
**Impact:** [scope of effect — who/what is affected going forward]
```

---

## Knowledge Type Taxonomy

| Type | Description | Typical Source Phase |
|---|---|---|
| `research` | Factual findings about the codebase or technology | Brainstorming investigation, planning investigation |
| `decision` | Why a specific approach was chosen — **only decisions that emerged during implementation**, not spec decisions | Implementation, debugging |
| `gotcha` | Counter-intuitive behavior or surprising constraint | Implementation, debugging |
| `pattern` | Reusable approach that worked well and should be standardized | Implementation, post-implementation review |
| `drift` | Wiki or doc content found to be out of sync with code | Any phase that reads wiki/docs and finds staleness |

> **`decision` clarification:** Capture only decisions that _emerged during work_ and weren't anticipated. Spec decisions already documented in idea.md or spec.md belong in the spec, not in `learned/`.

---

## File Naming Conventions

| Source Phase | Pattern | Example |
|---|---|---|
| Brainstorming research | `research-{topic}.md` | `research-auth-middleware-chain.md` |
| Brainstorming decision | `decision-{topic}.md` | `decision-event-driven-rationale.md` |
| Planning investigation | `research-{topic}.md` | `research-existing-retry-patterns.md` |
| Implementation per-step | `step-{NN}-{topic}.md` | `step-03-efcore-include-gotcha.md` |
| Ad-hoc implementation | `impl-{topic}.md` | `impl-api-returns-204-not-200.md` |
| Drift detection | `drift-{page-name}.md` | `drift-auth-middleware-docs.md` |

All files live in `scratch/[proj]/learned/`.

### Slug derivation

When a learned file has no `target-page:` field, its wiki page slug is derived
from its filename: **strip one leading capture prefix, then drop `.md`.** The
prefixes are exactly the patterns in the table above — that table is the only
list; do not maintain a second copy here or in any consuming agent.

Four rules govern the edge cases:

- **Strip at most one prefix.** `research-drift-foo.md` derives `drift-foo`, not
  `foo`. Repeated stripping mangles a topic that legitimately opens with a
  prefix word.
- **The number segment goes with `step-`.** `step-{NN}-` is one prefix, so
  `step-03-efcore-include-gotcha.md` derives `efcore-include-gotcha`. Digits
  elsewhere in the topic survive: `impl-api-returns-204-not-200.md` derives
  `api-returns-204-not-200`.
- **`drift-` is stripped like the rest.** `drift-{page-name}.md` names the page
  it corrects, so the remainder already *is* the intended slug. No special case.
- **An empty remainder is an error, not a slug.** `research-.md` yields nothing
  to name a page with — escalate via
  `learned-check mark-escalated <file> "empty slug after prefix strip"` and skip
  the file rather than writing a page named for its prefix.

A file with no recognized prefix passes through unchanged (`some-topic.md` →
`some-topic`). `target-page:`, when present, wins outright and is used verbatim,
subject to the format validation the ingesting agent applies.

---

## Drift Severity

Only applies to `type: drift` files. `severity` is **routing-authoritative**: `knowledge-ingestor`'s mechanical routing (`.claude/agents/knowledge-ingestor.md`, Process / Outcome-1) reads this field directly to decide the outcome. A detector's `severity` assignment IS the routing decision, not an informational hint for a human reviewer to interpret.

| Severity | When | Routing |
|---|---|---|
| `minor` | A single mechanically-verifiable fact with direct contradicting evidence (commit SHA, dead path) whose correction is deterministic | `knowledge-ingestor` auto-corrects the wiki page |
| `misleading` | Anything interpretive, multi-fact, or where the correction itself requires judgment | `knowledge-ingestor` marks the file `escalated` (`mark-escalated`) — no wiki edit |

**Default to `misleading` when uncertain:** a detector assigns `severity: minor` only under certainty — this is the loop's safety boundary, since `minor` authorizes an unattended write. When it is unclear which side is correct, or the correction itself requires judgment, assign `misleading` and escalate.

**`escalation-reason` guidance:** every detector emitting `severity: misleading` (sweep, researcher live-correct, groom) SHOULD populate the optional `escalation-reason` field at emission time with one of `interpretive`, `multi-fact`, `judgment-required`, or `uncertain-default` — so the escalated queue is triageable by a human reviewer or by `wiki-groomer`.

**Source field for drift files:** Use the `source` value for the phase where the drift was discovered (e.g., `implementation/step-03`, `brainstorming/research`). Drift can be discovered in any phase — there is no dedicated drift source value.

---

## File Lifecycle

1. A workflow step writes the file as `status: captured`, then immediately runs
   `learned-check validate <learned-dir>` and fixes anything it reports.
2. `learned-check status <path>` reports counts by status.
3. `knowledge-ingestor` processes captured files at workflow boundaries.
4. Ingested files become `status: ingested`, with `ingested-at` stamped.
5. Ambiguous files become `status: escalated`, with `escalation-reason`
   populated, and wait for a human or `wiki-groomer`.

## CLI

`learned-check` takes the `learned/` directory, or the project directory holding
one — both resolve to the same place.

```bash
learned-check status scratch/my-proj/learned/                # dashboard
learned-check pending scratch/my-proj/learned/               # captured files
learned-check escalated scratch/my-proj/learned/             # escalated, with reasons
learned-check validate scratch/my-proj/learned/              # schema check
learned-check feed-forward scratch/my-proj/learned/ --step 5 # files targeting step >= 5
learned-check init scratch/new-proj/learned/                 # create dir + .gitkeep
```

Exit codes: `0` clear, `1` pending files present, `2` escalated files present.

**Validate in the turn that writes the file, not at the boundary.** `validate`
takes a directory, so run it on `learned/` right after writing. Every schema
error it reports is one edit while you still hold the context that produced the
file. `validate` exits 1 on schema errors — distinct from the `1` in the exit
table above, which means pending files — and writes no status of its own.

Left unvalidated, the file reaches `knowledge-ingestor` at the boundary instead,
which cannot route a file missing `target-domain` and escalates it. The finding
then waits for a human rather than reaching its wiki, and the turn that could
have fixed it in one edit is long gone. That is how a build's best discovery
gets lost.

---

## Capture Checkpoint

At each pause point in brainstorming or investigation, run this gate. Use the values defined in `## Frontmatter Schema` — do not invent new `source` or `type` values. The checkpoint adds a layer on top of `## Capture Heuristic`; it does not replace it.

IF this exchange surfaced a fact about the existing codebase or domain that holds true regardless of whether this project proceeds,
AND the fact passes the capture heuristic including every negative rule →
  write a learned file, run `learned-check validate scratch/{project}/learned/` and fix anything it reports (`## File Lifecycle` step 1), then emit: `**Capture checkpoint:** Wrote learned file at scratch/{project}/learned/{name}.md — {topic}`
ELSE →
  emit: `**Capture checkpoint:** No discoveries to capture.`

**Emit one of the two lines every time.** The "no discoveries" branch is an affirmative statement that the exchange was evaluated and held nothing durable — without it, the evaluation is silently skipped, that being the path of least output. Both branches carry the same bold `**Capture checkpoint:**` prefix so the pattern stays recognizable in conversation history.

**Done when** every pause point in the exchange has one checkpoint line in the transcript, each line names either a written file path or no discoveries, and `learned-check validate` is clean for every file the checkpoint wrote.
