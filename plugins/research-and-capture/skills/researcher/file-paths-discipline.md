---
tags: [investigation, wiki, file-paths, discipline, dual-filter, knowledge-routing]
summary: "File-paths-not-content rule and dual-filter authority rule for the researcher. Both the knowledge-distillation admission gate AND knowledge-capture negative rules must clear before a finding is captured. Inter-filter precedence defers to decision-frameworks.md."
---

# File-Paths Discipline

<!-- BEGIN:CONTENTS -->
- Rule 1: File-Paths-Not-Content
- Rule 2: Dual-Filter Authority
- Summary
<!-- END:CONTENTS -->

This page documents two hard rules that govern how the researcher handles file references and knowledge-capture decisions. Both rules are self-contained and apply in every dispatch.

---

## Rule 1: File-Paths-Not-Content

**The researcher records file paths as references, not as file content inline in findings.**

When the researcher discovers that a relevant file exists at a path, the finding should reference the path — not copy the file content into the capture. Inline content:

- Becomes stale the moment the file changes (content drift with no auditable link/citation anchor).
- Bloats the wiki with data that is already readable via `Read` at the authoritative source.
- Defeats the purpose of the auditable reference set (markdown links; a legacy `code-cites:`
  value is tolerated but no longer required, per AD1/AD9), which exists to track cited paths
  for freshness checking.

**Correct pattern:**

```markdown
**Source:** [`server.mjs` `dispatchTool`](.claude/skills/scratch-memory/scripts/server.mjs)
```

Followed by a brief description of what `dispatchTool` does — not a copy of the 50 lines around
it. Precision goes in the anchor text as a **token**, never a line number: a line number is wrong
after the next edit to that file, while a function name survives until the function does. The link
itself is the auditable reference the freshness/churn checker tracks (AD1).

**Incorrect pattern:**

> The following code from `server.mjs` shows how tool dispatch works:
> ```js
> // [50 lines of inline content]
> ```

The inline-content pattern is never the right choice. Reference the path; describe the finding; let the freshness checker track the cited path.

**Corollary — capture-level discipline:** A capture is a synthesis, not a content mirror. If all it does is copy content from source files, it adds no value, it will become stale immediately, and it hands `knowledge-ingestor` nothing to file. A capture earns its page by synthesizing a finding that instructs future work — not by reproducing what is already readable in the codebase.

---

## Rule 2: Dual-Filter Authority

Before the researcher captures a finding, TWO independent filters must both clear:

1. **Admission gate (the four questions of `wiki-memory/page-standard.md` § Admission, then F3)** — determines whether the insight is worth persisting at all.
2. **knowledge-capture negative rules** — determines whether the insight is appropriate to capture in a learned file.

Both filters are applied **in sequence**. A finding that clears admission but is blocked by a knowledge-capture negative rule is still a skip.

### How to Apply Both Filters

**Step 1 — Apply the knowledge-distillation admission gate:**

See `decision-frameworks.md` §1. Admission Routing Decision Table for the full routing table.

| Check | Pass condition |
|--------|---------------|
| Sought | A task in work unrelated to this workstream opens it and acts differently; research that answers the workstream's own question stays in `scratch/{project}/` |
| Novel | Claude wouldn't reliably know this for the current project or domain without the code in front of it |
| Enforcing | The insight has a verb attached (instructive, not just descriptive) |
| Durable | It would not need editing if the implementation changed but its purpose did not — it states no roster, count or "is now fixed" |
| F3 | Generalizable principle, OR instance meets one of the three exception criteria |

If any check FAILS → skip; no further evaluation needed.

**Step 2 — Apply the knowledge-capture negative rules:**

Apply ALL of the following negative rules. If any fires, the finding is a skip:

| Negative rule | Example |
|--------------|---------|
| Obvious from the code | "The project uses React 18" (visible in package.json) |
| Already in the spec/plan | A design decision already documented in idea.md, spec.md, or a plan file |
| Generic knowledge Claude already has | "Use parameterized SQL to prevent injection" |
| Transient | "The build is broken right now because of X" (will be fixed this session) |
| Task-specific | "Step 3 took longer than expected" (process observation, not domain knowledge) |
| Answers the workstream's own question | Which files read a heading this workstream is adding; what an upstream project does, researched for this workstream's decision |

If any negative rule fires → skip, even if admission passed.

### Tiebreaker Protocol

When the two filters disagree, the **inter-filter precedence rule** in `decision-frameworks.md` §9 resolves the conflict. Summary:

- knowledge-distillation says INGEST + knowledge-capture says SKIP → **SKIP wins**
- knowledge-distillation says REJECT + knowledge-capture says WRITE → **REJECT wins**
- a check knowledge-distillation can only call plausible is a REJECT → **SKIP**, and the prose names the question and why

**The knowledge-capture negative rule wins over a knowledge-distillation positive signal.** This is the inter-filter tiebreaker. It complements the intra-filter tiebreaker within knowledge-capture (which applies when positive and negative rules within knowledge-capture alone conflict).

---

## Summary

| Rule | Scope | Override? |
|------|-------|-----------|
| File-paths-not-content | Every capture the researcher writes | No — this is a hard constraint |
| Dual-filter authority | Every capture decision | Tiebreaker in `decision-frameworks.md` §9 applies when filters disagree |

Both rules apply in every dispatch. Neither is optional.
