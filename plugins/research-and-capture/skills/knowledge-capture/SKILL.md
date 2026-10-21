---
name: knowledge-capture
description: "Knowledge capture layer for `learned/` files — capture heuristic, frontmatter schema, slug derivation, drift severity, capture checkpoint, boundary ingest. Use when writing a learned file, checking learned/ status, running a boundary ingest, or evaluating a discovery at a pause — even when nothing seems worth capturing. Ingestion-time admission is wiki-memory's page standard: a different test."
user-invocable: false
---

# Knowledge Capture

Shared methodology for writing and routing `learned/` files during dev workflows. Loaded by brainstorming and by the build coder when a turn produces a capture, and by every workflow that runs `## Boundary Ingest`.

Capture is cheap; ingestion is the quality gate. This skill owns capture. The admission gate applied during _ingestion_ is [`wiki-memory/page-standard.md` `## Admission`](../wiki-memory/page-standard.md#admission), the single normative copy; `knowledge-distillation` owns how an admitted claim is stated.

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
7. **Copies state the file already owns** — a roster, a count, which files currently do X, "is
   now fixed". Cite the file in the capture's `**Source:**` line instead of restating it; open
   work is `/capture-issue`.
8. **Answers the workstream's own question** — research done to make this workstream's decision:
   what an upstream project does, which files read a heading you are adding, what the transcripts
   showed before you changed the rule. It lives in `idea.md` or the epic, cited from the decision.
   Capture only a residue that binds a future, unrelated change.

**Close-time exception.** Do-NOT rules 2, 7 and 8 do not apply to the shipped decisions and the shipped
system flowchart that `/close-issue`'s promotion step writes (`source: close-issue`): a decision
that shipped keeps its reason on the wiki even though `idea.md` states it, and the flowchart is the
project overview's picture of what shipped.

**Ruling captures.** A ruling the user gives that `user-decision-rubric` § Recording a ruling sends
to `learned/` is captured whatever this heuristic says, with `type: decision` and `source: ruling`:
the user's words are the record, so the Do-NOT rules, the four questions below and the body's
`**Impact:**` line do not gate it. Its body is § Ruling Body, not the template.

**Before writing, ask the four questions in `wiki-memory/page-standard.md` § Admission.** Write
the capture only when you can answer each in one sentence naming what settles it; a question you
cannot answer that way fails, and the finding stays in the project's files. The ingestor asks the
same four again at HEAD; a capture it drops costs one file in `scratch/`, but a capture that reaches
a page costs every reader who opens it. You decide nothing about shape — bullet, section or page is
the ingestor's call — so name the subject you think the finding belongs to in `target-page:` as a
hint and stop there.

**The current-state filter — does this describe what exists (current state), not what should exist (forward-looking)?** Apply after the four questions. Content that fails it is neither captured as a learned file nor written to the wiki — route to `/capture-issue` instead. The wiki captures current-state knowledge only.

**D7 dual-routing.** One observation can carry both framings: a *defect-gotcha* is a surprising current behavior that is also a defect. File both halves in the same dispatch — the current-state framing (what the code does, stated as `type: gotcha`) as a `learned/` capture for the ingestor, and the forward-looking framing (what should be fixed) to `/capture-issue`, carrying `related: "wiki:{domain}/{slug}"` back to the page the capture targets. The current-state filter does not block the capture half, because that half's framing is explicitly current-state.

**Tiebreaker:** When a candidate matches both a "write when" and a "don't write when" rule, **the negative rule wins** — err toward not capturing, since a lean wiki with high-signal entries outperforms a bloated one. A current-state filter failure is never captured regardless of positive signal strength, unless the same observation also describes current-state behavior as a gotcha — then file both halves per D7.

---

## Frontmatter Schema

| Field | Type | Required | Allowed Values |
|---|---|---|---|
| `source` | string | yes | `brainstorming/research`, `brainstorming/decisions`, `planning/investigation`, `implementation/step-NN`, `implementation/ad-hoc`, `wrap-up`, `close-issue`, `ruling` |
| `type` | enum | yes | `research`, `decision`, `gotcha`, `pattern`, `drift` |
| `scope` | enum | yes | `project`, `user` |
| `target-domain` | string | yes | wiki domain name (e.g., `billing-expert`, `dynamodb`) |
| `target-page` | string | no | page slug within the domain, optional one subdir segment (e.g. `backend/v1-controllers`); absent → slug derived from the learned filename per [Slug derivation](#slug-derivation) |
| `status` | enum | yes | `captured`, `ingested`, `escalated`, `dropped` |
| `escalation-reason` | string | no | **written only by `learned-check mark-escalated`**, never at capture time; the CLI accepts any reason text. The ingestor writes `cannot-verify` when nothing it can reach settles a claim and `sources-disagree` when two things it can see disagree and neither supersedes the other; a schema failure such as an empty slug carries the error as its reason |
| `ingested-at` | ISO 8601 | no | timestamp — populated when `status: ingested` |
| `drop-reason` | enum | yes, for `status: dropped` | `sought`, `novel`, `enforcing`, `durable`, `duplicate`, `tool-output` — **written only by `learned-check mark-dropped`**, never at capture time |
| `drop-note` | quoted string | yes, for `status: dropped` | short free text saying why the capture was not filed — written by `mark-dropped` beside `drop-reason` |
| `targets-step` | integer | no | plan step number — for feed-forward surfacing |
| `severity` | enum | yes, for `type: drift` | `minor`, `misleading` — **only for `type: drift`**; the capturer's hint about how much the staleness hurts, and nothing routes on it (see `## Drift Severity`) |

---

## File Body Template

```markdown
## [Title: What Was Learned]

[Body: what was discovered, where it applies, what to do differently]

**Source:** [optional — where the claim came from, as a markdown link in prose]
**Discovered:** [context — which phase/step, what triggered the discovery]
**Impact:** [the task, in work unrelated to this workstream, that opens this and acts differently — if the only task you can name is this workstream's, do not write the capture. A `source: close-issue` decision names whoever would change that choice and what they would otherwise try; its flowchart names who opens the project overview and what it shows them. A `type: drift` capture names the page whose readers the stale claim misleads instead: it passes Sought on the page it corrects]
```

### Ruling Body

A `source: ruling` capture keeps the user's words first, verbatim, and the agent's reading second,
marked unconfirmed, so a paraphrase never becomes authority unreviewed:

```markdown
## [The call the ruling settles]

> [the user's words, verbatim]

**Decision (unconfirmed):** X, not Y, because Z — the agent's reading of the words above.
**Given:** [YYYY-MM-DD, and the stop it answered: a groom, an interview, a veto at a merge review]
```

Agents act on the quoted words, not on the decision line.

**`**Source:**` is optional and capture never rejects an uncited file.** Capture is cheap; a
discovery you cannot yet attribute is still worth writing down. But the ingestor copies this body
verbatim into a wiki page, so a citation written here beside its claim survives ingestion and
lands where the page convention already puts citations — which is the one thing you cannot add
later without re-deriving where the claim came from. Three forms count, per
[`page-standard.md`](../wiki-memory/page-standard.md) `## Citations`: a code path as
``[`file.ext` `theTokenYouMean`](../../relative/path/to/file.ext)`` — the file in the link, a
stable token in the anchor text and **never a line number**, which goes stale on any edit to the
file — an external source with the date you observed it, or the commit or issue that settled the
decision. A bare path in a code span is not a citation any tooling can see.

---

## Knowledge Type Taxonomy

| Type | Description | Typical Source Phase |
|---|---|---|
| `research` | Factual findings about the codebase or technology | Brainstorming investigation, planning investigation |
| `decision` | Why a specific approach was chosen — **only decisions that emerged during implementation**, not spec decisions, except a shipped decision the close step writes (`source: close-issue`) and a user's ruling (`source: ruling`) | Implementation, debugging, `/close-issue`, any stop the user rules at |
| `gotcha` | Counter-intuitive behavior or surprising constraint | Implementation, debugging |
| `pattern` | Reusable approach that worked well and should be standardized | Implementation, post-implementation review |
| `drift` | Wiki or doc content found to be out of sync with code | Any phase that reads wiki/docs and finds staleness |

> **`decision` clarification:** Capture only decisions that _emerged during work_ and weren't anticipated. Spec decisions already documented in idea.md or spec.md belong in the spec, not in `learned/`, until the build ships: `/close-issue` then writes each shipped decision whose reason the shipped file does not state as a `decision` capture with `source: close-issue`.

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
| Close-time decision | `decision-{kebab-title}.md`, `target-page:` set | `decision-ingest-runs-at-close.md` |
| Close-time flowchart | `overview-{project}.md`, `target-page: overview` | `overview-knowledge-capture-pipeline.md` |
| User's ruling | `ruling-{kebab-title}.md` | `ruling-lane-pushes-stay-plain.md` |

All files live in `scratch/[proj]/learned/`.

### Slug derivation

How a file with no `target-page:` derives its page slug from the prefixes in the table above is in
[`slug-derivation.md`](slug-derivation.md). Read it when resolving a learned file's slug.

---

## Drift Severity

Only applies to `type: drift` files. `severity` is **a hint, not a routing key**. It tells whoever
scans the queue how much the staleness hurts; it decides nothing. `knowledge-ingestor` corrects on
evidence it can see and escalates what it cannot verify, so a `misleading` file gets corrected
when the evidence is there, and a `minor` one gets escalated when it is not.

| Severity | When |
|---|---|
| `minor` | A single mechanically-verifiable fact with direct contradicting evidence (commit SHA, dead path) whose correction is deterministic |
| `misleading` | Anything interpretive, multi-fact, or where the correction itself requires judgment |

**Default to `misleading` when uncertain** — the honest label for a claim you could not settle
yourself is the one that says a reader will have to think.

**Never write `escalation-reason` at capture time.** `learned-check mark-escalated` is its only
writer; the ingestor's two values and the schema-error case are described in the schema above.

**Source field for drift files:** Use the `source` value for the phase where the drift was
discovered (e.g., `implementation/step-03`, `brainstorming/research`). Drift can be discovered in
any phase — there is no dedicated drift source value.

---

## File Lifecycle

1. A workflow step writes the file as `status: captured`, then immediately runs
   `learned-check validate <learned-dir>` and fixes anything it reports.
2. `learned-check status <path>` reports counts by status.
3. `knowledge-ingestor` processes captured files at workflow boundaries
   (`## Boundary Ingest`).
4. Ingested files become `status: ingested`, with `ingested-at` stamped.
5. Files the ingestor could not settle become `status: escalated`, with
   `escalation-reason` set to `cannot-verify` or `sources-disagree`, and wait for
   a person. `/wiki-status` lists them with their reasons.
6. Files the ingestor turns away whole under the admission rubric become `status: dropped`, with
   `drop-reason` and `drop-note` set. A dropped file is finished work and stays on disk so the next
   researcher does not capture it again; a capture filed only in part ends `ingested`.

## CLI

The `learned-check` commands, their exit codes, and the status writers only the ingestor calls are
in [`learned-check-cli.md`](learned-check-cli.md). Read it when running `learned-check` beyond the
`validate` of `## File Lifecycle` step 1, or when reading one of its exit codes.

---

## Boundary Ingest

The ingest a workflow runs over `learned/` at its boundary — steps 1-4, the output to the caller,
non-page paths, and the proposal wrap — is in [`boundary-ingest.md`](boundary-ingest.md). Read it
when a caller says to follow § Boundary Ingest; "§ Boundary Ingest step N" names that file's step N.

---

## Capture Checkpoint

At each pause point in brainstorming or investigation, run this gate. Use the values defined in `## Frontmatter Schema` — do not invent new `source` or `type` values. The checkpoint adds a layer on top of `## Capture Heuristic`; it does not replace it.

IF this exchange surfaced a fact about the existing codebase or domain that holds true regardless of whether this project proceeds,
AND you can name a task, in work unrelated to this workstream, that opens it and acts differently — the **Sought** answer the `**Impact:**` line carries; a `type: drift` capture answers with the page it corrects,
AND the fact passes the capture heuristic including every negative rule →
  write a learned file, run `learned-check validate scratch/{project}/learned/` and fix anything it reports (`## File Lifecycle` step 1), then emit: `**Capture checkpoint:** Wrote learned file at scratch/{project}/learned/{name}.md — {topic}`
ELSE →
  emit: `**Capture checkpoint:** No discoveries to capture.`

**Emit one of the two lines every time.** The "no discoveries" branch is an affirmative statement that the exchange was evaluated and held nothing durable — without it, the evaluation is silently skipped, that being the path of least output. Both branches carry the same bold `**Capture checkpoint:**` prefix so the pattern stays recognizable in conversation history.

**Done when** every pause point in the exchange has one checkpoint line in the transcript, each line names either a written file path or no discoveries, and `learned-check validate` is clean for every file the checkpoint wrote.
