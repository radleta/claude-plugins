---
tags: [investigation, wiki, decision-frameworks, admission-gate, classification, drift, knowledge-routing]
summary: "Admission routing decision table, cross-filter precedence rules, knowledge-category priority ranking, classification override rules, drift handling, source enum resolution, and the type taxonomy with its decision boundary table, for researcher captures."
---

# Decision Frameworks

<!-- BEGIN:CONTENTS -->
- 1. Admission Routing Decision Table
- 2. Verb-Attachment Test (the second half of admission)
- 3. F3 Exception Criteria
- 4. Compression Pass
- 5. Knowledge-Category Priority Ranking
- 6. Classification Override Rules (D14, D29)
- 7. Drift Handling (D21)
- 8. Source Enum Resolution
- 9. Cross-Filter Precedence Rule (Inter-Filter Tiebreaker)
- 10. Type Taxonomy and Decision Boundary Table
- Quick Reference: Researcher Routing Checklist
<!-- END:CONTENTS -->

This page is the researcher's routing authority. It documents every decision the researcher must make during a dispatch: when to capture, what to capture, how to classify, and how to handle edge cases. What a wiki page then becomes is not among them — that determination belongs to `knowledge-ingestor` (D15). Each section is self-contained — a researcher mid-dispatch can navigate here without consulting sibling pages.

---

## 1. Admission Routing Decision Table

The admission gate is applied after live investigation produces a candidate insight: the four questions of `wiki-memory/page-standard.md` § Admission, then F3. Every check must return PASS for the insight to earn a capture. PASS means you can answer the question in one sentence naming the file, output or commit that settles it; a question you cannot answer that way is a FAIL, and so is a check that is only plausible. There is no borderline file: a finding that fails any check is written nowhere, and your prose names the question it failed and why — for **Sought**, the workstream question the finding answers.

| Check | Name | Pass condition | Fail condition |
|--------|------|---------------|----------------|
| **S** | Sought — who opens this page, on work that is not the work that produced the capture? | You can name a task in work unrelated to the dispatching workstream that opens it and acts differently | The only reader is the dispatching workstream, a later step of its epic, or "anyone changing X" where X is what that workstream is changing — research that answers the dispatch's own question stays in `scratch/{project}/` |
| **N** | Novel — would Claude get this wrong, or not think of it, with only the code in front of it? | Claude wouldn't reliably know this for the current project or domain without the wiki; a choice this repo made passes on its reason only when the file that makes the choice does not state it | Generic knowledge Claude has from training (e.g., "SQL injection requires parameterized queries"), or anything one read of the file or one search of the repo answers |
| **E** | Enforcing — what does the reader do differently because of it? | The insight has a verb attached — it can be written as an instruction (see §Verb-Attachment Test) | Purely descriptive — describes state without instructing ("the project uses React 18"), or what another project does |
| **D** | Durable — would this sentence need editing if the implementation changed but its purpose did not? | A mechanism, a constraint, a failure mode, a decision and why | Copies state the file already owns — a roster, a count, a list or table of which files currently do or say X, linked or not, "is now fixed"; cite the file instead |
| **F3** | Principle vs instance? | General principle extractable from the instance; OR the instance itself IS the convention, contradicts reasonable assumptions, or causes repeated failures (see §F3 Exception Criteria) | Pure instance with no generalizable value; single case with no broader pattern |

**Routing outcomes:**

| S, N, E, D | F3 | Action |
|----|----|--------|
| all PASS | PASS | **Write a `learned/` capture** (clear-pass path) |
| S FAIL (the workstream's own question) | — | Skip — the answer lives in `scratch/{project}/`, cited from the decision it served |
| N FAIL (already known) | — | Skip — Claude already knows; capture nothing |
| E FAIL (no verb) | — | Skip — purely descriptive; not actionable |
| D FAIL (copies state) | — | Skip — cite the owning file; open work goes to `/capture-issue` |
| all PASS | FAIL | Borderline — evaluate §F3 Exception Criteria; if not met, skip; if met, file |
| Any check only plausible | — | FAIL — capture nothing; say in prose which question you could not settle and why |

**Load skill:** When admission is uncertain, load the `knowledge-distillation` skill via the Skill tool for the full framework text. The normative copy of the four questions is `.claude/skills/wiki-memory/page-standard.md` § Admission.

**The current-state filter** — forward-looking content routes to /capture-issue, not wiki. See knowledge-capture/SKILL.md § Capture Heuristic for the canonical rule and Tiebreaker.

**D7 carve-out:** A defect-gotcha (gotcha that includes a defect observation) writes BOTH a capture with `type: gotcha` (current-state framing) AND a `/capture-issue` with forward-looking framing in the same dispatch. The capture is NOT blocked by the current-state filter because its half describes current-state behavior; the filter is satisfied by that framing. The rule is `knowledge-capture/SKILL.md` § Capture Heuristic (**D7 dual-routing**).

---

## 2. Verb-Attachment Test (the second half of admission)

**Core test:** "Can this insight be written as an instruction? Does it have a verb?"

- **Include column (PASS):** Contains an instruction verb — "always use", "never write", "must call", "require", "prefer", "avoid". Example: *"Always call `.Include()` explicitly — EF Core never auto-loads navigation properties."*
- **Exclude column (FAIL):** Purely descriptive — no actionable instruction. Example: *"The project uses EF Core 8.0."* (Observable state; Claude can see it in the project file.)

**Borderline signal:** When you can only write the insight as a description and adding a verb would be forced or trivial, admission fails. Do not manufacture a verb to salvage a weak insight.

---

## 3. F3 Exception Criteria

F3's default behavior is to prefer principles over instances. The exception criteria allow an instance to earn filing even when it doesn't generalize:

1. **The instance IS the convention** — the specific casing, naming, enum value, or configuration that applies everywhere in this project.
2. **Contradicts reasonable assumptions** — an engineer new to this project would assume X; the actual behavior is Y, and acting on the wrong assumption causes breakage.
3. **Causes repeated failures** — this exact instance is responsible for recurring bugs or gotchas.

If none of the three criteria are met, the instance fails F3 and should not be filed as a standalone page. Consider whether a compression pass (§Compression Pass) reveals a principle the instance represents.

---

## 4. Compression Pass

**When:** Fires between the admission gate and classification. Run this pass before writing the capture body.

**Rule:** Before filing, compress: collapse multiple instances to the principle they represent; prefer a table row over a paragraph; prefer a checklist item over a sentence.

**Protocol:**
1. Write the insight as a plain sentence.
2. Ask: does this sentence compress to a table row? If yes, write the table.
3. Ask: does this paragraph compress to a checklist item? If yes, write the checklist.
4. Ask: do these three examples collapse to one principle? If yes, file the principle, not the examples.

**Output of the compression pass** is the capture body — the compressed form is what the ingestor files, not the raw investigation prose.

---

## 5. Knowledge-Category Priority Ranking

When multiple insights compete for filing in a single dispatch, prioritize by category (highest value first):

| Rank | Category | Description | Filing guidance |
|------|----------|-------------|-----------------|
| 1 | **Anti-Patterns** | What NOT to do, with consequences | Always file when admission and F3 pass; these prevent recurring damage |
| 2 | **Decision Frameworks** | Routing tables, decision trees, classification rules | File when the framework applies broadly across the domain |
| 3 | **Investigation Protocols** | Step-by-step procedures for repeatable investigation tasks | File when the protocol is non-obvious and reusable |
| 4 | **Checklists** | Sequential verification steps | File when the checklist covers a common, error-prone workflow |
| 5 | **Patterns with Context** | Reusable approaches with applicability conditions | File when the pattern has clear when-to-apply vs when-to-avoid guidance |
| 6 | **Context and Constraints** | System-level facts (performance bounds, rate limits, environment constraints) | Never file alone; only file as a section within a higher-ranked page |

**Reconciling clarifier (`spec.md`, its `Knowledge-category priority` bullet):** This ranking governs what TYPE of content is worth filing — it does NOT demote pages whose primary content is a constraint-level synthesis. A page documenting a CLI verb contract, an exit-code matrix, or a design invariant is classified at the level of its *primary content type* (typically Decision Framework or Anti-Pattern), not treated as "Context and Constraints" merely because it describes a system-level constraint. A page qualifies as "Context and Constraints" only when its content is purely descriptive (e.g., "this system handles X req/s") with no instructive verb. When in doubt, apply the verb test: if the page can be written as an instruction, it earns a higher classification tier.

---

## 6. Classification Override Rules (D14, D29)

After the admission gate and compression pass, the researcher classifies the insight as project-specific or domain-generic. The default uses judgment, but two override mechanics apply:

### D14 — Citation Override (Project-Scoped Filing Forced)

If the insight's cited paths (in-body markdown links, or a legacy `code-cites:` list if the page still carries one) include a path under `.claude/`, `scratch/`, or a repo-specific directory, it is classified as **project-scoped**, regardless of whether the principle appears generalizable. Reason: the cited path is the evidence; if the evidence is project-specific, the finding cannot be promoted to a domain-generic wiki without severing its citation anchor.

**Override trigger:** cited paths (markdown link or legacy `code-cites:`) include any path under `.claude/` or a project-specific directory.
**Override action:** File to `{project}-expert/` wiki; do NOT file to `{domain}-expert/` wiki.

Classification routes scope; it does not decide whether the finding is filed. A finding that cites `.claude/` and fails **Sought** is not project-specific knowledge, it is the workstream's research, and it stays in `scratch/{project}/`.

### D29 — Judgment Override (Domain-Generic Filing Forced)

If the insight has no project-specific citations AND the principle applies identically in any project using the same technology (e.g., DynamoDB pagination behavior, EF Core navigation loading, Redis TTL semantics), it is classified as **domain-generic**, regardless of where it was discovered.

**Override trigger:** Insight has no project-specific citations AND applies identically in any project using the same technology.
**Override action:** File to `{domain}-expert/` wiki; do NOT file to `{project}-expert/` wiki.

### Default (No Override Triggered)

When neither D14 nor D29 applies, use judgment:
- Does the insight only make sense in the context of this specific project's architecture? → Project-scoped.
- Does the insight apply to anyone using this technology stack? → Domain-generic.
- Does the insight apply in both contexts? → File the project-specific version to `{project}-expert/` and add a cross-reference note; do NOT duplicate the page body (D24).

---

## 7. Drift Handling (D21)

Drift is detected when a wiki page claims X but live investigation or deep freshness verification confirms the codebase has changed to Y.

### Drift Response

**There is one tier.** Every drift becomes a drift capture, whatever the researcher's context
budget and however unambiguous the correction — the two-tier split existed to decide when the
researcher rewrote the page itself, and it never does (D15).

**`severity:` is your hint to the next reader, not a routing key.** D15 moved the judgment about
what happens to the page out of this agent entirely. `knowledge-ingestor` corrects on evidence it
can see and escalates only what it cannot verify, so nothing you write in this field decides
whether the page gets rewritten. What it decides is how a person scanning the queue reads the
finding, so assign it honestly under the rule its owner states — `knowledge-capture/SKILL.md`
§ Drift Severity, which this agent preloads: **`minor` only under certainty, and default to
`misleading` when uncertain.** Anything interpretive, multi-fact, or whose correction itself
requires judgment is `misleading`. Never write `escalation-reason` yourself — that field belongs
to `learned-check mark-escalated`.

What is still wholly yours is the capture's evidence. Name the file, the output or the page you
checked the claim against, because that is what the ingestor corrects on.

Under D15 the researcher is the drift detector, so the evidence you name is what a correction
rests on. A capture that names none leaves the ingestor with nothing to verify against, and the
page keeps its claim.

### Drift Trailer

When a drift capture is written, the trailer fires:

```
Captured: {absolute-path} -> {target-domain}/{stale-slug}
Source: wiki+verified
```

The path is `scratch/{project}/learned/drift-{ts}-{slug}.md`. The stale page is unchanged until
`knowledge-ingestor` files the capture, and the prose must say so — a caller told about a
correction will otherwise assume the page already carries it.

### Drift File Frontmatter

| Field | Value |
|-------|-------|
| `type` | `drift` |
| `severity` | `minor` (correction unambiguous) or `misleading` (which side is wrong is unclear) — a hint to whoever reads the queue; nothing routes on it, per `knowledge-capture/SKILL.md` § Drift Severity. See § Drift Response above |
| `status` | always `captured` at emission — the researcher never writes `escalated` itself. `knowledge-ingestor` sets that later, on a claim it could not verify |
| `source` | Resolved from dispatcher context (see §8 Source Enum Resolution) |
| `target-domain` | Skill-folder name of the stale page's domain (e.g., `claude-code-ref-expert`) |

**A domain with no wiki still gets its real name.** Write the domain the finding belongs to in `target-domain:` and leave `status: captured`, even when no wiki exists for it — do not substitute a sentinel. `knowledge-ingestor` probes the domain (`wiki-memory/protocols/ingest-groom.md` Step 2), fails, and escalates the file itself and names the missing domain in its return, which is actionable only because `{domain}` is the real name. A human runs `/wiki-init {domain}` and the capture files on the next pass.

---

## 8. Source Enum Resolution

Every capture's `source:` field uses the existing knowledge-capture `source` enum. The researcher resolves which value to use by reading the `## Dispatch context` block from the orchestrator's prompt:

| Dispatch context | `source:` value |
|-----------------|----------------|
| Researcher dispatched from `/brainstorming` | `brainstorming/research` |
| Researcher dispatched from `/plan-it` | `planning/investigation` |
| Researcher dispatched from `/implement-code` step N | `implementation/step-NN` (where NN is the current step number) |
| Researcher dispatched ad-hoc (no dispatch context block, or unknown) | `implementation/ad-hoc` |

**Fallback rule:** If the `## Dispatch context` block is absent from the prompt (orchestrator omitted it), fall back to `implementation/ad-hoc` — it is the least-specific valid value. The knowledge-capture schema requires `source:` with no `unknown` enum value; never invent a new enum value.

**Never invent new source enum values.** Any extension requires updating the knowledge-capture skill schema first.

---


## 9. Cross-Filter Precedence Rule (Inter-Filter Tiebreaker)

When the knowledge-distillation admission gate and the knowledge-capture negative rules disagree, this table resolves the conflict.

**This is an INTER-filter rule** — it governs conflicts between the two authority sources. The intra-filter tiebreaker (within knowledge-capture alone) says "negative rule wins" when both a positive and negative rule within knowledge-capture apply. The inter-filter rule below extends this to the cross-skill case.

| knowledge-distillation admission gate | knowledge-capture heuristic | Ruling | Filing decision |
|---------------------------------|----------------------------|--------|----------------|
| **Admission clears** (ingest) | Heuristic says **WRITE** | Both agree | **File** |
| **Admission clears** (ingest) | Heuristic says **SKIP** (negative rule fires: obvious from code, already in spec, generic, transient, task-specific, or answers the workstream's own question) | **knowledge-capture WINS** | **Skip** — do not file |
| **Admission FAILS** (reject) | Heuristic says **WRITE** | **Admission WINS** | **Skip** — the heuristic cannot override an admission rejection |
| **Admission FAILS** (reject) | Heuristic says **SKIP** | Both agree | **Skip** |

**Key principle:** The knowledge-capture negative rule wins over a knowledge-distillation positive signal. The spirit: a lean wiki with high-signal entries outperforms a bloated one. When in doubt, do not file.

**Reference:** This inter-filter precedence rule is complementary to the dual-filter authority rule in `file-paths-discipline.md`, which defines HOW both filters are applied in sequence.

---

## 10. Type Taxonomy and Decision Boundary Table

The researcher uses the knowledge-capture type taxonomy when writing any `learned/` file. The taxonomy applies to captures, drift files, and fallback learned files alike.

### Full Type Taxonomy

| Type | Description | When to use |
|------|-------------|-------------|
| `research` | Factual findings about the codebase or technology | Brainstorming investigation, planning investigation; facts that clear admission but don't fit another type |
| `decision` | Why a specific approach was chosen — **ONLY for decisions that emerged DURING IMPLEMENTATION** | Use ONLY when a decision was made mid-work that wasn't anticipated in the spec or plan |
| `gotcha` | Counter-intuitive behavior or surprising constraint | Implementation discoveries; behaviors that contradict reasonable developer assumptions |
| `pattern` | Reusable approach that worked well and should be standardized | Post-implementation; patterns that apply consistently across the domain |
| `drift` | Wiki or doc content found to be out of sync with code | Any phase where the researcher reads wiki/docs and finds the codebase differs |

### Decision Boundary Table

The `type: decision` boundary is the most commonly violated rule. Use this table to determine the correct type:

| Scenario | Correct type | Rationale |
|----------|-------------|-----------|
| Mid-implementation, the team chose approach A over approach B (was not predetermined) | `decision` | A genuine implementation-phase decision |
| The spec says "use event-driven architecture" — researcher documents why | NOT `decision` — use `research` or `pattern` | Pre-existing spec choice; not an implementation-phase emergence |
| Researcher finds that the codebase consistently uses PascalCase for all public APIs | NOT `decision` — use `pattern` | A codebase-predating architectural pattern, not an in-session decision |
| Researcher finds a surprising API behavior that changes how to write code | NOT `decision` — use `gotcha` | Counter-intuitive discovery, not a decision |
| Researcher finds that the wiki says method returns `null` but code returns `[]` | NOT `decision` — use `drift` | Staleness detection, not a decision |
| During implementation, the team decided to paginate using cursor-based rather than offset (not spec'd) | `decision` | Emerged during work; not in the spec |
| Researcher discovers an architectural pattern predating the current session | NOT `decision` — use `pattern` or `research` | Pre-existing; the researcher didn't decide it |

**Critical rule (from knowledge-capture):** `type: decision` is ONLY for decisions that emerged during implementation. Codebase patterns or architectural decisions predating the session use `type: pattern` or `type: research`, not `type: decision`. Decisions already documented in idea.md belong there, not in `learned/`.

---

## Quick Reference: Researcher Routing Checklist

Before writing a capture, verify:

- [ ] Admission: Can you name a task, in work unrelated to this workstream, that opens this and acts differently? → If no, skip; it stays in `scratch/{project}/`.
- [ ] Admission: Would Claude reliably know this without the wiki? → If yes, skip.
- [ ] Admission: Can this be written as an instruction (verb attached)? → If no, skip.
- [ ] Admission: Would it need editing if the implementation changed but its purpose did not (a roster, a count, "is now fixed")? → If yes, skip and cite the file.
- [ ] F3: Is this a generalizable principle? Or does it meet one of the three exception criteria? → If neither, skip.
- [ ] Cross-filter: Does knowledge-capture say "skip" (negative rule)? → If yes, skip even if admission says file.
- [ ] Compression pass complete? Captured content should be compressed (table rows, checklist items, principles — not raw prose).
- [ ] Classification determined? (D14 citation override or D29 judgment override applied?)
- [ ] `target-domain:` set, and `target-page:` set only when a page you actually read fits?
- [ ] Source enum resolved from dispatch context?
- [ ] Type taxonomy applied? (Not `type: decision` unless the decision emerged during this implementation session)
