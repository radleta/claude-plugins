---
page-kind: procedure
tags: [investigation, workflow, wiki-first, index-first, knowledge-distillation]
summary: "Numbered 7-step investigation protocol for the researcher agent: index-read → page-drill → freshness-check → live-fallback → admission → classify → capture. Includes FSM state references and per-step decision rules."
---

# Investigation Workflow

<!-- BEGIN:CONTENTS -->
- Step 1 — Read the Index (FSM: `dispatched` → `index-read`)
- Step 2 — Drill Into Candidate Pages (FSM: `index-read` → `drilling`)
- Step 3 — Per-Page Freshness Check (FSM: `drilling` → `freshness-check`)
- Step 4 — Live Investigation on Cache Miss or Drift (FSM: `live-fallback` → `live-investigate`)
- Step 5 — Apply the Knowledge-Distillation Admission Gate (FSM: `live-investigate` → `apply-admission`)
- Step 6 — Classify the Finding (FSM: `apply-admission` → `classify`)
- Step 7 — Write the Capture (FSM: `classify` → `emit-capture`)
- Wiki Pollution Noticed While Reading
- FSM Quick Reference
<!-- END:CONTENTS -->

The researcher follows a fixed 7-step protocol in every dispatch. The steps map directly to the FSM State & Transition Matrix (spec.md §State & Transition Matrix). Each step is self-contained: a reader following this page can execute the full protocol without consulting sibling pages, though Decision Frameworks (decision-frameworks.md) contains the detailed admission routing table and classification override rules.

---

<protocol>

## Step 1 — Read the Index (FSM: `dispatched` → `index-read`)

**Action:** Read `{project}-expert/SKILL.md` (if it exists) then the matching `{domain}-expert/SKILL.md`. Locate the `## Pages` heading and enumerate listed pages.

**Why first:** Index-first navigation is a core LLM Wiki principle (llm-wiki-expert core-principles.md principle 4). Reading the index before drilling into pages avoids redundant live investigation when the answer is already synthesized.

**Branch conditions from `index-read`:**

| Condition | Next step |
|-----------|-----------|
| `{project}-expert/` folder does not exist | Silent fall-through to domain checks — no error, and nothing creates it |
| `{domain}-expert/` folder does not exist at any scope | Skip to Step 4 (live-fallback). Capture as normal, naming the absent domain in `target-domain:` — but **nothing scaffolds it**: `knowledge-ingestor` escalates a capture whose domain is not a declared wiki (`status: escalated`, and its return names `/wiki-init`), where it waits for a human. Say that in prose, so the caller does not read the capture as filed. |
| Folder exists but `SKILL.md` has no `## Pages` heading or heading is empty | Skip to Step 4 (live-fallback); do NOT re-init an existing domain |
| Folder exists with `## Pages` but no page matches the question | Skip to Step 4 (live-fallback); capture after the admission gate with no `target-page` hint |
| Folder exists with matching pages | Proceed to Step 2 (drilling) |

---

## Step 2 — Drill Into Candidate Pages (FSM: `index-read` → `drilling`)

**Action:** Read 1-3 candidate pages relevant to the investigation question. Choose pages whose `## Pages` entry summary most closely matches the question domain.

**Limit:** Read at most 3 pages. If the question requires more than 3 pages to answer from the wiki, treat it as a cache miss and proceed to Step 4.

**Special case — principle pages:** If a candidate page has no external reference — no non-empty legacy `code-cites:` value AND no external markdown link in the body (the union cite set per AD1/AD9) — it is a principle page with nothing cited to check freshness against. Skip Step 3 for that page and proceed directly to Step 4 (synthesize-from-wiki).

---

## Step 3 — Per-Page Freshness Check (FSM: `drilling` → `freshness-check`)

**Action:** For each candidate page that has at least one external reference (a non-empty legacy `code-cites:` value, an external markdown link in the body, or both — the union cite set per AD1/AD9), run:

```bash
wiki-health freshness {domain}-expert {page-slug}
```

Interpret the output status string:

| Status string | Meaning | Action |
|--------------|---------|--------|
| `fresh` | Wiki page is current vs cited paths | Proceed to Step 4 (synthesize-from-wiki) |
| `stale-timestamp` | A cited path changed since the wiki page was last written | Run deep verification (Step 3a) |
| `unknown` | Page has no external reference (no `code-cites:` value and no external md-link) or git metadata unavailable | Treat as fresh; proceed to Step 4 |

**Step 3a — Deep verification (on `stale-timestamp`):**

```bash
wiki-health freshness --deep {domain}-expert {page-slug}
```

| Deep result | Action |
|-------------|--------|
| `stale-semantic`, and the question needs the corrected content | Write a drift capture (path: `scratch/{project}/learned/drift-{ts}-{slug}.md`), then proceed to Step 4 (live-fallback) to gather what the page should have said, and fold it into the same capture |
| `stale-semantic`, and the answer does not depend on it | Write a drift capture, return prose with its `Captured:` line; stop |
| `fresh` (false alarm — file changed elsewhere) | The page is confirmed accurate: proceed to Step 4 (synthesize-from-wiki) |

**Drift capture frontmatter:** `type: drift`, `severity: minor|misleading`, `status: captured`, `source:` resolved from dispatcher identity (see Step 7 for source resolution rules), `target-domain:` uses the skill-folder name (e.g., `claude-code-ref-expert`).

**`severity:` is a hint, not a routing decision.** `knowledge-ingestor` corrects on evidence it can see and escalates what it cannot verify, so this field decides nothing about the page. Assign it per `knowledge-capture/SKILL.md` § Drift Severity — `minor` only under certainty, **default to `misleading` when uncertain**, and anything interpretive, multi-fact or needing judgment to correct is `misleading`. Never write `escalation-reason`; `learned-check mark-escalated` owns it. What gates the correction is the evidence you name in the capture body, so name the file or output you checked the claim against.

**The researcher never stamps `last-verified`, and nothing stamps it on the researcher's behalf.** Stamping is a wiki write, and this agent makes none (D15). Say the confirm in prose — the caller can then trust the page — and stop there. Do **not** capture it: a clean confirm is not a finding (no verb, nothing to instruct), and a capture claiming the page is right, filed as `type: drift`, sends the ingestor to a page with nothing to correct and buys a groom pass over its neighbours for no finding.

The consequence, stated rather than papered over: **a clean deep-confirm does not refresh the field.** A confirm is the one verification event with no writer downstream of it — `lint`, and the ingestor's sweep that reuses it, bump on their own clean confirms, and neither is this dispatch — so a page this agent confirms clean still reads as unverified until one of those runs. That is the price of the single-writer rule, not an oversight to route around.

A *drift* capture is different, and the difference matters: `knowledge-ingestor` corrects it in place when the evidence holds, and that corrective write carries the `last-verified` bump with it (`wiki-memory/protocols/lint.md` § Step 7). So this agent's drift path does refresh the field, one step removed; only its clean confirms do not.

---

## Step 4 — Live Investigation on Cache Miss or Drift (FSM: `live-fallback` → `live-investigate`)

**Trigger conditions:**
- No matching wiki domain or page found (Step 1 branch conditions above)
- Freshness check confirmed drift requiring live correction (Step 3a)

**Action:** Use Read, Glob, Grep to investigate the codebase directly. File-paths-not-content discipline applies: collect file paths and line references first; read content only for the specific sections needed to answer the question.

**Context-fill gate:** If context fill reaches ≥80% mid-investigation, stop exploration. Return prose stating the investigation is incomplete, with a bare `Source: live` trailer (no `Captured:`/`Issue:` line — the trailer has no `Status:` field, so its mere presence plus incomplete-signaling prose is the orchestrator's cue). Partial notes MAY be written to `learned/` at researcher's discretion; if written, prose must reference the path so the next dispatch can feed-forward. The 80% threshold is a design decision (not a fixed framework constant) chosen to leave enough context for synthesis and output construction.

**Bash scope:** the one Bash rule is in the agent file's `<hard-rules>`.

---

## Step 5 — Apply the Knowledge-Distillation Admission Gate (FSM: `live-investigate` → `apply-admission`)

**Action:** Apply the four questions of `wiki-memory/page-standard.md` § Admission, then the principle filter, to each candidate finding. A question passes only when you can answer it in one sentence naming the file, output or commit that settles it; a question you cannot answer that way fails.

| Check | Test | Pass condition |
|--------|------|----------------|
| **Sought** | Who opens this page, on work that is not the work that produced the capture? Name the task. | Fails when the only reader you can name is the workstream that dispatched you, a later step of its epic, or "anyone changing X" where X is what that workstream is changing. Research that answers the dispatch's own question stays in `scratch/{project}/` (knowledge-capture do-not-write rule 8) |
| **Novel** | Would Claude get this wrong, or not think of it, with only the code in front of it? | Fails on general practice, documented library behavior, or anything one read of the file or one search of the repo answers. A choice this repo made passes on its reason only when the file that makes the choice does not state it |
| **Enforcing** | What does the reader do differently because of it? Name the verb. | Fails when it only describes — what the architecture is called, what a step observed, that something exists, what another project does. "Keep this as it is, because" is a verb |
| **Durable** | Would this sentence need editing if the implementation changed but its purpose did not? | Fails when it copies state — a roster, a count, a list or table of which files currently do or say X, "is now fixed", linked or not. Cite the file that owns the state instead |
| **F3 — Principle, not instance?** | Is this a repeatable pattern (not a one-off)? | Pass if it's a principle; or if it's a justified instance that IS a convention, contradicts what Claude would assume, or causes repeated failures |

**Routing:**

| Admission-gate result | Next step |
|----------------|-----------|
| All pass (clear-pass) | Step 6 (classify) |
| Any fails, or is only plausible (reject) | Return prose only, naming each failing question and why — for **Sought**, the workstream question the finding answers; no persistence; no trailer |

**Also apply knowledge-capture negative rules** (dual-filter authority — both must clear):
- "Already in the spec/plan" → skip
- "Generic knowledge Claude already has" → skip
- "Transient" → skip
- "Answers the workstream's own question" (rule 8) → skip; capture only a residue that binds a future, unrelated change
When a finding clears admission but hits a knowledge-capture negative rule, the negative rule wins.

If a current-state filter failure is detected on existing wiki content during this step, see § Wiki Pollution Noticed While Reading.

**Compression pass** (before Step 6): Collapse instances to a principle. Prefer a table row over a paragraph. Prefer a checklist item over a sentence. File the compressed form, not the raw finding.

---

## Step 6 — Classify the Finding (FSM: `apply-admission` → `classify`)

**Action:** Determine whether the finding is project-specific or domain-generic, then resolve the target scope.

**Classification rules:**

| Finding type | Indicator | Target |
|-------------|-----------|--------|
| **Project-specific** | Cites internal paths (`.claude/`, `scratch/`, project-owned files) | `.claude/skills/{domain}-expert/` (project scope) |
| **Domain-generic** | No internal path citations; applies across projects | Probe project scope first, then user scope, and name whichever holds the domain in `target-domain:`. **Nothing auto-inits at either scope** — if neither holds it, Step 1's missing-domain row applies: capture, and say in prose that the ingestor will escalate it. |

**Citation override:** If researcher's judgment suggests domain-generic but the finding cites internal paths → override to project-specific. The citation is authoritative.

Classification routes scope; it does not decide whether the finding is filed. A finding that cites `.claude/` and fails **Sought** is not project-specific knowledge, it is the workstream's research, and it stays in `scratch/{project}/`.

Classification resolves the capture's `target-domain:`, not a write destination. Whether the capture lands on an existing page or a new one is knowledge-ingestor's determination, made against `wiki-memory/page-standard.md` when it files.

---

## Step 7 — Write the Capture (FSM: `classify` → `emit-capture`)

Every finding that clears Step 5 leaves this agent the same way: as a `learned/` capture that
knowledge-ingestor files. There is no second path and no primary/fallback split — the wiki changes when the ingestor
files the capture, not when this dispatch ends.

```
scratch/{project}/learned/{slug}.md
```

Write it with `Write`, using the `knowledge-capture` schema. What each field carries:

| Field | Value |
|-------|-------|
| `type` | `research` for a finding, `drift` for a stale-page report |
| `status` | `captured` |
| `source` | resolved from dispatcher identity (table below) |
| `target-domain` | the skill-folder name Step 6 resolved, e.g. `claude-code-ref-expert` |
| `target-page` | the slug you believe the capture belongs to, when you read one that fits — a **hint**, not an instruction |

**The hint is a hint.** The ingestor reads the page you named, asks whether the capture belongs to
what its `summary:` says it is for, and makes its own determination against
`wiki-memory/page-standard.md`. Naming a page does not reserve it, and naming none is a complete
capture: omit `target-page` when nothing you read fits.

**Make no determination.** Do not write `update`, `create`, `retire`, or any other verdict about a
page into the capture or the trailer. You do not read the page standard, you do not decide what a
page may hold, and you never call `wiki-write --remove`. The evidence goes in the capture; the
judgment is the ingestor's. A capture that argues for deleting a page is a capture whose body
states what is wrong and what proves it — the ingestor draws the conclusion.

**Body:** the compressed finding in instruction form, with a `**Source:**` line per citation
linking the file and naming a stable token in the anchor text — never a line number, which the next
edit to that file invalidates (`file-paths-discipline.md` Rule 1) — plus `**Discovered:**` and
`**Impact:**`.

**Source field resolution** (for `source:` in any capture emitted this step):

| Dispatcher identity in prompt | `source:` value |
|-------------------------------|----------------|
| `/brainstorming` | `brainstorming/research` |
| `/implement-code` (with step number) | `implementation/step-NN` |
| `/implement-code` (no step number) | `implementation/ad-hoc` |
| `/plan-it` | `planning/investigation` |
| Not stated | `implementation/ad-hoc` (least-specific valid fallback) |

**Output trailer** (bimodal contract):

```
Captured: <absolute-path> -> {target-domain}/{target-page}   # 0+ lines, one per capture written
                                                             # -> {target-domain} alone when no page hint
Issue: <absolute-path>                                       # 0+ lines, one per issue file filed
Source: wiki | wiki+verified | live                          # exactly 1, present whenever the trailer fires
```

Trailer fires only on persistence events. Pure cache hits (wiki answered the question, no drift,
nothing captured) produce NO trailer — prose only.

</protocol>

---

## Wiki Pollution Noticed While Reading

A page you read during investigation can carry content that fails the current-state filter with high confidence:
forward-looking content — future-tense modals (`should`, `needs to`, `could be improved`) or
imperative cleanup framing ("fix X", "refactor Y") — sitting in the page body rather than under an
explicit `## Known Issues`, `## Future Work` or `## TODO` header, which are intentionally
forward-looking and exempt.

You do not heal it. You report it, in two artifacts:

1. **File the issue** via `mcp__scratch-memory__write_issue` with `kind: mixed`, passing
   `related: "wiki:{domain}/{slug}"` as a **parameter** (not a body field) so the rendered issue's
   `## Related` section back-links the page. This back-link is mandatory — an issue about a page
   nobody can navigate to from it is an issue nobody finds again.
2. **Write a capture** naming the page, quoting the misclassified content, and saying it belongs in
   the issue rather than the page. `target-domain` and `target-page` are the polluted page's.

Then say both in prose, and emit the `Issue:` and `Captured:` trailer lines. High-confidence only:
when you are unsure whether content is misclassified, report nothing and leave the page alone.

## FSM Quick Reference

The full State & Transition Matrix lives in spec.md §State & Transition Matrix. This table summarizes the key terminal states:

| Terminal state | Trailer fires? | Trailer content |
|---------------|---------------|-------------|
| `return-cache-hit` (pure wiki cache, nothing captured) | NO | — |
| `return-captured` (finding captured) | YES | `Captured: <path> -> {domain}/{slug}` + `Source:` |
| `return-drift-only` (drift capture, no finding) | YES | `Captured: <path> -> {domain}/{slug}` + `Source: wiki+verified` |
| `return-ephemeral` (admission reject) | NO | — |
| `return-incomplete` (context ≥80%) | YES | bare `Source: live` (no `Captured:`/`Issue:` line) |
