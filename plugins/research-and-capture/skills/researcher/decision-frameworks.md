---
tags: [investigation, wiki, decision-frameworks, 3-filter, classification, drift, knowledge-routing]
summary: "3-filter routing decision table, cross-filter precedence rules, knowledge-category priority ranking, classification override rules, drift handling, borderline handling (D39), type taxonomy with decision boundary table, and --update vs create rule for researcher wiki writes."
---

# Decision Frameworks

This page is the researcher's routing authority. It documents every decision the researcher must make during a dispatch: when to file, what to file, how to classify, and how to handle edge cases. Each section is self-contained — a researcher mid-dispatch can navigate here without consulting sibling pages.

---

## 1. 3-Filter Routing Decision Table

The knowledge-distillation 3-filter is applied after live investigation produces a candidate insight. All three filters must return PASS for the insight to earn wiki filing.

| Filter | Name | Pass condition | Fail condition |
|--------|------|---------------|----------------|
| **F1** | Claude already knows? | Claude wouldn't reliably know this for the current project or domain without the wiki | Generic knowledge Claude has from training (e.g., "SQL injection requires parameterized queries") |
| **F2** | Changes behavior? (verb test) | The insight has a verb attached — it can be written as an instruction (see §F2 Verb-Attachment Test) | Purely descriptive — describes state without instructing ("the project uses React 18") |
| **F3** | Principle vs instance? | General principle extractable from the instance; OR the instance itself IS the convention, contradicts reasonable assumptions, or causes repeated failures (see §F3 Exception Criteria) | Pure instance with no generalizable value; single case with no broader pattern |

**Routing outcomes:**

| F1 | F2 | F3 | Action |
|----|----|----|--------|
| PASS | PASS | PASS | **File via wiki-write** (clear-pass path) |
| FAIL | — | — | Skip — Claude already knows; no filing |
| PASS | FAIL | — | Skip — purely descriptive; no verb; not actionable |
| PASS | PASS | FAIL | Borderline — evaluate §F3 Exception Criteria; if not met, skip; if met, file |
| Mixed: any filter borderline | — | — | Emit borderline `learned/` file per §Borderline Handling (D39) |

**Load skill:** When 3-filter application is uncertain, load the `knowledge-distillation` skill via the Skill tool for the full framework text.

**Filter 4** — forward-looking content routes to /capture-issue, not wiki. See knowledge-capture/SKILL.md § Capture Heuristic for the canonical rule and Tiebreaker.

**D7 carve-out:** A defect-gotcha (gotcha that includes a defect observation) writes BOTH a wiki page with `type: gotcha` (current-state framing) AND a `/capture-issue` with forward-looking framing in the same dispatch. The wiki write is NOT blocked by Filter 4 because the wiki half describes current-state behavior; Filter 4 is satisfied by the wiki half's framing. The rule is `knowledge-capture/SKILL.md` § Capture Heuristic (**D7 dual-routing**).

---

## 2. F2 Verb-Attachment Test

**Core test:** "Can this insight be written as an instruction? Does it have a verb?"

- **Include column (PASS):** Contains an instruction verb — "always use", "never write", "must call", "require", "prefer", "avoid". Example: *"Always call `.Include()` explicitly — EF Core never auto-loads navigation properties."*
- **Exclude column (FAIL):** Purely descriptive — no actionable instruction. Example: *"The project uses EF Core 8.0."* (Observable state; Claude can see it in the project file.)

**Borderline signal:** When you can only write the insight as a description and adding a verb would be forced or trivial, it fails F2. Do not manufacture a verb to salvage a weak insight.

---

## 3. F3 Exception Criteria

F3's default behavior is to prefer principles over instances. The exception criteria allow an instance to earn filing even when it doesn't generalize:

1. **The instance IS the convention** — the specific casing, naming, enum value, or configuration that applies everywhere in this project.
2. **Contradicts reasonable assumptions** — an engineer new to this project would assume X; the actual behavior is Y, and acting on the wrong assumption causes breakage.
3. **Causes repeated failures** — this exact instance is responsible for recurring bugs or gotchas.

If none of the three criteria are met, the instance fails F3 and should not be filed as a standalone page. Consider whether a compression pass (§Compression Pass) reveals a principle the instance represents.

---

## 4. Compression Pass

**When:** Fires between the 3-filter gate and classification. Run this pass before constructing the wiki-write payload.

**Rule:** Before filing, compress: collapse multiple instances to the principle they represent; prefer a table row over a paragraph; prefer a checklist item over a sentence.

**Protocol:**
1. Write the insight as a plain sentence.
2. Ask: does this sentence compress to a table row? If yes, write the table.
3. Ask: does this paragraph compress to a checklist item? If yes, write the checklist.
4. Ask: do these three examples collapse to one principle? If yes, file the principle, not the examples.

**Output of the compression pass** is the wiki-write payload body — the compressed form is what gets filed, not the raw investigation prose.

---

## 5. Knowledge-Category Priority Ranking

When multiple insights compete for filing in a single dispatch, prioritize by category (highest value first):

| Rank | Category | Description | Filing guidance |
|------|----------|-------------|-----------------|
| 1 | **Anti-Patterns** | What NOT to do, with consequences | Always file when F1/F2/F3 pass; these prevent recurring damage |
| 2 | **Decision Frameworks** | Routing tables, decision trees, classification rules | File when the framework applies broadly across the domain |
| 3 | **Investigation Protocols** | Step-by-step procedures for repeatable investigation tasks | File when the protocol is non-obvious and reusable |
| 4 | **Checklists** | Sequential verification steps | File when the checklist covers a common, error-prone workflow |
| 5 | **Patterns with Context** | Reusable approaches with applicability conditions | File when the pattern has clear when-to-apply vs when-to-avoid guidance |
| 6 | **Context and Constraints** | System-level facts (performance bounds, rate limits, environment constraints) | Never file alone; only file as a section within a higher-ranked page |

**Reconciling clarifier (spec.md:165):** This ranking governs what TYPE of content is worth filing — it does NOT demote pages whose primary content is a constraint-level synthesis. A page documenting a CLI verb contract, an exit-code matrix, or a design invariant is classified at the level of its *primary content type* (typically Decision Framework or Anti-Pattern), not treated as "Context and Constraints" merely because it describes a system-level constraint. A page qualifies as "Context and Constraints" only when its content is purely descriptive (e.g., "this system handles X req/s") with no instructive verb. When in doubt, apply the F2 verb test: if the page can be written as an instruction, it earns a higher classification tier.

---

## 6. `--update` vs Create Decision Rule

When calling `wiki-write`, the researcher must choose between creating a new page or updating an existing one:

| Situation | Flag to use | Notes |
|-----------|------------|-------|
| Filing a new slug (page does not exist yet) | No `--update` flag | `wiki-write` exits 2 on collision; collision is a signal to investigate what already exists |
| Drift correction: rewriting a stale wiki page | `--update` | Researcher must synthesize a complete set of in-body `**Source:**` markdown links from the content it authored — do not copy an existing page's stale `code-cites:` array verbatim if one is still present (AD1/AD9) |
| Extending an existing page with new synthesis | `--update` | Read the existing page first; merge new findings with existing content; produce the complete page as the payload. The merged payload must preserve each existing `## ` section's BODY, not merely its heading — `wiki-write`'s no-silent-section-loss guard refuses (exit 2) an `--update` whose payload keeps a heading but empties or substantially shrinks its body, exactly the failure mode a lossy condense-while-merging step produces |
| Page exists at a slug researcher thought was new | Investigate before `--update` | Read the existing page to understand what it already covers; ensure the new content genuinely extends, not duplicates, the existing page |

**Critical:** When calling `wiki-write --update`, researcher must author the full updated set of in-body markdown-link citations from the content it authored — not copied from an existing legacy `code-cites:` array, which may be stale or empty.

---

## 7. Classification Override Rules (D14, D29)

After the 3-filter and compression pass, the researcher classifies the insight as project-specific or domain-generic. The default uses judgment, but two override mechanics apply:

### D14 — Citation Override (Project-Scoped Filing Forced)

If the insight's cited paths (in-body markdown links, or a legacy `code-cites:` list if the page still carries one) include a path under `.claude/`, `scratch/`, or a repo-specific directory, it is classified as **project-scoped**, regardless of whether the principle appears generalizable. Reason: the cited path is the evidence; if the evidence is project-specific, the finding cannot be promoted to a domain-generic wiki without severing its citation anchor.

**Override trigger:** cited paths (markdown link or legacy `code-cites:`) include any path under `.claude/` or a project-specific directory.
**Override action:** File to `{project}-expert/` wiki; do NOT file to `{domain}-expert/` wiki.

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

## 8. Drift Handling (D21 + D5 Two-Tier)

Drift is detected when a wiki page claims X but live investigation or deep freshness verification confirms the codebase has changed to Y.

### D5 Two-Tier Drift Response

| Tier | Condition | Researcher action |
|------|-----------|------------------|
| **Tier 1 (rewrite)** | Researcher has sufficient context budget and the correction is unambiguous | Write corrected content as wiki-write payload; call `wiki-write --update`; emit trailer with a `Drift:` line (same slug updated, not a new page) |
| **Tier 2 (drift file)** | Researcher has insufficient context budget, or correction is ambiguous (which side is right is unclear) | Write drift `learned/` file; emit trailer with a bare `Source:` line |

### D21 Trailer (Drift File)

When a drift file is written (Tier 2), the trailer fires:

```
Source: wiki+verified
```

No `Wiki:`/`Issue:`/`Drift:` lines (no wiki page was created or corrected in this dispatch — prose describes the drift `learned/` file location: `scratch/{project}/learned/drift-{ts}-{slug}.md`).

### Drift File Frontmatter

| Field | Value |
|-------|-------|
| `type` | `drift` |
| `severity` | `minor` (correction unambiguous) or `misleading` (which side is wrong is unclear) — **informational only, does not affect routing** |
| `status` | `captured` (default); escalation is reviewer-driven based on context ambiguity, not severity value |
| `source` | Resolved from dispatcher context (see §Borderline Handling — D39 for source resolution rules) |
| `target-domain` | Skill-folder name of the stale page's domain (e.g., `claude-code-ref-expert`) |

**`unknown-domain` sentinel:** When the stale page belongs to a domain with no established wiki, use `target-domain: unknown-domain` and `status: escalated` with an `escalation-reason` field. `knowledge-ingestor` skips automatic filing for `unknown-domain` drift files; a human curator re-assigns the domain and resets `status: captured` before re-filing.

---

## 9. Borderline Handling (D39)

A borderline result occurs when one or more filters returns a partial signal — not a clear PASS or FAIL. Borderlines are handled by emitting a `learned/` file for human review, NOT by filing to the wiki.

### Source Enum Resolution

The `source:` field in the borderline `learned/` file uses the existing knowledge-capture `source` enum. The researcher resolves which value to use by reading the `## Dispatch context` block from the orchestrator's prompt:

| Dispatch context | `source:` value |
|-----------------|----------------|
| Researcher dispatched from `/brainstorming` | `brainstorming/research` |
| Researcher dispatched from `/plan-it` | `planning/investigation` |
| Researcher dispatched from `/implement-code` step N | `implementation/step-NN` (where NN is the current step number) |
| Researcher dispatched ad-hoc (no dispatch context block, or unknown) | `implementation/ad-hoc` |

**Fallback rule:** If the `## Dispatch context` block is absent from the prompt (orchestrator omitted it), fall back to `implementation/ad-hoc` — it is the least-specific valid value. The knowledge-capture schema requires `source:` with no `unknown` enum value; never invent a new enum value.

**Never invent new source enum values.** D39 mandates reuse of the existing knowledge-capture `source` enum. Any extension requires updating the knowledge-capture skill schema first.

### Borderline File Path and Schema

- **Path:** `scratch/{project}/learned/research-borderline-{ts}-{slug}.md`
- **Frontmatter:** `type: research`, `status: captured`, with normal `source`/`scope`/`target-domain` fields (standard knowledge-capture schema).
- **Body:** Must be fully schema-compliant: title heading, body text, `**Discovered:**` field, `**Impact:**` field. Then a `## Filter Verdicts` section with per-filter verdicts:

```markdown
## Filter Verdicts
- **F1:** [Why Claude might or might not know this]
- **F2:** [Whether a verb is attached; what the instruction would be]
- **F3:** [Whether principle or justified instance; why borderline]
- **Compact form:** [Table row / checklist item / pattern version — ready for wiki inclusion]
```

**Trailer behavior:** Writing a borderline `learned/` file is a side effect, NOT a persistence event. The trailer does **NOT** fire for borderline paths. Orchestrators will see prose only (ephemeral mode). This is correct behavior.

---

## 10. Auto-Init Scope Cascade (D40)

When the researcher determines that a domain wiki does not exist and filing is warranted (3-filter clear-pass):

**Rule: Auto-init at project scope only — NEVER at user scope.**

| Condition | Researcher action |
|-----------|-----------------|
| `{project}-expert/` does not exist at project scope | Researcher may auto-init by calling `wiki-write` (the verb handles scaffold + first page write in one atomic operation) |
| `{domain}-expert/` does not exist at user scope | Do NOT auto-init at user scope; file to project scope instead, or escalate to the user |
| Domain exists at project scope, page is new | Call `wiki-write {domain} {slug} --from <payload>` (no `--update`) |
| Domain exists at user scope, page is new | Call `wiki-write {domain} {slug} --scope user --from <payload>` (no `--update`) — only when the insight is domain-generic and the user scope already has the domain folder |

**Auto-init generated SKILL.md description (D26):**

```
Project-scoped expert for {project} domain — populated by /wiki-memory ingest and the researcher agent. <!-- TODO: refine description before publishing -->
```

The `<!-- TODO: ... -->` marker causes the page to show as needing-attention in `wiki-memory show` and `wiki-memory lint`. The researcher never blocks on user input mid-write to confirm the description.

---

## 11. Cross-Filter Precedence Rule (Inter-Filter Tiebreaker)

When the knowledge-distillation 3-filter and the knowledge-capture negative rules disagree, this table resolves the conflict.

**This is an INTER-filter rule** — it governs conflicts between the two authority sources. The intra-filter tiebreaker (within knowledge-capture alone) says "negative rule wins" when both a positive and negative rule within knowledge-capture apply. The inter-filter rule below extends this to the cross-skill case.

| knowledge-distillation 3-filter | knowledge-capture heuristic | Ruling | Filing decision |
|---------------------------------|----------------------------|--------|----------------|
| **All 3 filters PASS** (ingest) | Heuristic says **WRITE** | Both agree | **File** |
| **All 3 filters PASS** (ingest) | Heuristic says **SKIP** (negative rule fires: obvious from code, already in spec, generic, transient, or task-specific) | **knowledge-capture WINS** | **Skip** — do not file |
| **3-filter FAILS** (reject) | Heuristic says **WRITE** | **3-filter WINS** | **Skip** — heuristic cannot override a 3-filter rejection |
| **3-filter FAILS** (reject) | Heuristic says **SKIP** | Both agree | **Skip** |
| **3-filter BORDERLINE** | Heuristic says **SKIP** | **knowledge-capture WINS** | **Skip** — emit no file |
| **3-filter BORDERLINE** | Heuristic says **WRITE** | Borderline prevails | **Emit borderline `learned/` file** per §Borderline Handling (D39) |

**Key principle:** The knowledge-capture negative rule wins over a knowledge-distillation positive signal. The spirit: a lean wiki with high-signal entries outperforms a bloated one. When in doubt, do not file.

**Reference:** This inter-filter precedence rule is complementary to the dual-filter authority rule in `file-paths-discipline.md`, which defines HOW both filters are applied in sequence.

---

## 12. Type Taxonomy and Decision Boundary Table

The researcher uses the knowledge-capture type taxonomy when writing any `learned/` file. The taxonomy applies to drift files, borderline files, and fallback learned files alike.

### Full Type Taxonomy

| Type | Description | When to use |
|------|-------------|-------------|
| `research` | Factual findings about the codebase or technology | Brainstorming investigation, planning investigation; facts that pass 3-filter but don't fit another type |
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

Before calling `wiki-write` or writing a `learned/` file, verify:

- [ ] F1: Would Claude reliably know this without the wiki? → If yes, skip.
- [ ] F2: Can this be written as an instruction (verb attached)? → If no, skip.
- [ ] F3: Is this a generalizable principle? Or does it meet one of the three exception criteria? → If neither, skip.
- [ ] Cross-filter: Does knowledge-capture say "skip" (negative rule)? → If yes, skip even if 3-filter says file.
- [ ] Compression pass complete? Filed content should be compressed (table rows, checklist items, principles — not raw prose).
- [ ] Classification determined? (D14 citation override or D29 judgment override applied?)
- [ ] `--update` flag decision made? (Is this a new slug or updating an existing page?)
- [ ] Source enum resolved from dispatch context? (For `learned/` files)
- [ ] Type taxonomy applied? (Not `type: decision` unless the decision emerged during this implementation session)
