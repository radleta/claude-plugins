---
tags: [investigation, wiki, tool-capabilities, capability-based-descriptions]
summary: "Capability-based (not name-based) descriptions of researcher's allowed tools: file reading and pattern matching, command execution under the agent file's one Bash rule, write-to-learned-only, runtime skill load, and external retrieval."
---

# Tool Capabilities

<!-- BEGIN:CONTENTS -->
- Capability 1: File Reading and Pattern Matching
- Capability 2: Command Execution
- Capability 3: Write to `learned/` Only
- Capability 4: Runtime Skill Load
- Capability 5: External Retrieval
- Capability Summary Table
<!-- END:CONTENTS -->

The researcher's tool set is intentionally narrow. Each capability is described by what it enables (not just which tools it covers), so the mapping stays valid even as the underlying tool names evolve.

**Why capability-based descriptions?** Tool names change (e.g., `Grep` may become a different tool ID in a future Claude Code release). Capability descriptions anchor to the *function* — "file reading and pattern matching" — so the dispatch contract remains stable across tool renames.

---

## Capability 1: File Reading and Pattern Matching

**Tools:** Read, Glob, Grep

**What this enables:**
- Read wiki index pages (`{domain}-expert/SKILL.md`) to discover available pages before live exploration.
- Read individual wiki pages to extract findings, check citations (in-body markdown links, or a legacy `code-cites:` value if one is still present — AD1/AD9), and assess freshness.
- Read codebase source files during live investigation (only after wiki index and page checks).
- Glob across the `.claude/skills/` directory to find wiki domains at project scope, and across `~/.claude/skills/` for user scope.
- Grep for patterns in source files, wiki pages, or `learned/` files to verify freshness or locate cited paths (markdown links or legacy `code-cites`).

**Researcher usage rules:**
1. Always read the wiki index first (index-first protocol) — never open source files before checking for a relevant wiki page.
2. Read only files relevant to the current investigation question — do not broad-scan the entire codebase without narrowing first via index + page reads.
3. Glob is the tool for discovering which domains exist; use it before concluding "no wiki coverage" for a topic.

---

## Capability 2: Command Execution

**Tools:** Bash

What Bash may run and write is one rule in `.claude/agents/researcher.md` `<hard-rules>`; typical reads are `git log --follow -p -- <file>`, `git show <sha>:<file>`, `wiki-health` and `churn-check <skill> --json`.

---

## Capability 3: Write to `learned/` Only

**Tools:** Edit, Write (target: `learned/` directory only)

**What this enables:**
- Write the capture for a clear-pass finding — the one persistence path this agent has.
- Write drift captures (when a wiki page's content is semantically stale).
- Write partial-notes `learned/` files (when context fill ≥80% mid-investigation).

**Hard constraint:** Edit and Write MUST only target paths under `scratch/{project}/learned/`. The researcher never modifies a wiki page under `.claude/skills/` or `~/.claude/skills/` — not with Edit, not with Write, and not with `wiki-write` (D15).

**Why not let it write pages?** One writer means one groomer, one blast radius, and one enforcement point. `knowledge-ingestor` reads the capture, makes the determination against `wiki-memory/page-standard.md`, and files it — so page shape, citation form, and update-versus-create are decided in one place instead of two.

---

## Capability 4: Runtime Skill Load

**Tools:** Skill

**What this enables:**
- Load `{domain}-expert` skills at runtime during an investigation when additional domain knowledge is needed to interpret findings or apply the admission gate.
- Example: while investigating a DynamoDB access pattern, load `dynamodb-expert` to apply its filter recommendations and routing table to the current finding.
- Load `knowledge-distillation` skill if admission is uncertain and the researcher needs the full framework text.

**Researcher usage rules:**
1. Load domain-expert skills only when they are directly relevant to the current investigation question — not speculatively.
2. Skills loaded via Skill tool are injected into context; they do not persist across dispatches. Each researcher dispatch starts with a clean context (no carry-over from prior dispatches).
3. The `researcher` SKILL.md itself is pre-loaded by the dispatcher — no need to load it via Skill tool.

---

## Capability 5: External Retrieval

**Tools:** WebFetch, WebSearch

**What this enables:**
- Open a primary source cited by URL — a vendor doc page, an API reference, a paper abstract — and
  establish what it actually says rather than relying on a summary of it.
- Verify a citation kind that is not grep-able: a code path can be checked against the working tree,
  a vendor claim cannot.
- Search for a source when a wiki page or a dispatch names a claim without a link.

**Researcher usage rules:**
1. Wiki-first still governs. External retrieval is a fallback for questions the wiki and the working
   tree cannot answer, not a first move, and it never replaces the index-first read at Step 1.
2. A finding taken from an external source is filed with its URL and the date it was read, because
   a page that moved or changed cannot be re-derived from the claim alone.
3. Report what was not retrievable. A paywalled paper, an abstract-only page, or a dead link is a
   result to state plainly, never a gap to fill by inference from the title.

**Constraint:** these are read-only network tools. They do not authenticate, so a source behind a
login is out of reach and must be reported as unretrieved rather than approximated.

---

## Capability Summary Table

| Capability | Included tools | Target scope | Write? |
|---|---|---|---|
| File reading and pattern matching | Read, Glob, Grep | Any readable path | No |
| Command execution | Bash | the rule in the agent's `<hard-rules>` | `scratch/{project}/`, temp files, dispatch-named output only |
| Write to `learned/` only | Edit, Write | `scratch/{project}/learned/` paths only | Yes — `learned/` only |
| Runtime skill load | Skill | Any loaded skill | No |
| External retrieval | WebFetch, WebSearch | Public URLs and web search | No |

**Out-of-scope tools for researcher:** Agent (no sub-agent dispatch), AskUserQuestion (researcher is fully autonomous — no mid-dispatch user prompts).
