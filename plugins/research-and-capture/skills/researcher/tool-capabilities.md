---
tags: [investigation, wiki, tool-capabilities, capability-based-descriptions]
summary: "Capability-based (not name-based) descriptions of researcher's allowed tools: file reading and pattern matching, read-only command execution, write-to-learned-only, and runtime skill load."
---

# Tool Capabilities

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

## Capability 2: Read-Only Command Execution

**Tools:** Bash (narrowly scoped)

**What this enables:**
- `git log --follow -p -- <file>` — check file history to assess whether a code-cited file changed since a wiki page was last updated (freshness check).
- `git show <sha>:<file>` — read a specific historical version of a file during deep-verify.
- `wiki-health [--skill <name>]` — check the health state of a specific wiki domain before reading it.
- `wiki-write <domain> <slug> [--update] [--scope project|user]` — persist synthesis findings to the wiki (this is the ONLY write-capable command in scope; see Capability 3 for routing rules).

**Bash is NOT used for:**
- Running tests, builds, or linters.
- Reading arbitrary CLI output unrelated to investigation freshness or wiki persistence.
- Spawning subagents or child claude sessions.

**Constraint:** Every Bash call the researcher makes must fall into one of the four categories above. If a proposed Bash command does not fit (e.g., `npm test`, `cat bigfile.log`), it is out of scope for the researcher's dispatch.

---

## Capability 3: Write to `learned/` Only (Wiki Writes via Verb)

**Tools:** Edit, Write (target: `learned/` directory only)

**What this enables:**
- Write borderline `learned/` files (when 3-filter is mixed — see D39).
- Write drift `learned/` files (when wiki page content is semantically stale).
- Write fallback `learned/` files (when `wiki-write` verb exits non-zero).
- Write partial-notes `learned/` files (when context fill ≥80% mid-investigation).

**Hard constraint:** Edit and Write MUST only target paths under `scratch/{project}/learned/`. The researcher MUST NOT use Edit or Write to directly modify wiki pages under `.claude/skills/` or `~/.claude/skills/`. Wiki page writes go through the `wiki-write` verb (Bash Capability 2) exclusively — the verb handles create-or-update semantics, page validation, and SKILL.md index registration.

**Why route wiki writes through the verb?** Direct Edit/Write to wiki pages bypasses the wiki's create-or-update semantics, page-type validation, and SKILL.md `## Pages` index registration. The `wiki-write` verb ensures all three are handled atomically.

---

## Capability 4: Runtime Skill Load

**Tools:** Skill

**What this enables:**
- Load `{domain}-expert` skills at runtime during an investigation when additional domain knowledge is needed to interpret findings or apply the 3-filter.
- Example: while investigating a DynamoDB access pattern, load `dynamodb-expert` to apply its filter recommendations and routing table to the current finding.
- Load `knowledge-distillation` skill if the 3-filter application is uncertain and the researcher needs the full 3-filter framework text.

**Researcher usage rules:**
1. Load domain-expert skills only when they are directly relevant to the current investigation question — not speculatively.
2. Skills loaded via Skill tool are injected into context; they do not persist across dispatches. Each researcher dispatch starts with a clean context (no carry-over from prior dispatches).
3. The `researcher` SKILL.md itself is pre-loaded by the dispatcher — no need to load it via Skill tool.

---

## Capability Summary Table

| Capability | Included tools | Target scope | Write? |
|---|---|---|---|
| File reading and pattern matching | Read, Glob, Grep | Any readable path | No |
| Read-only command execution | Bash (scoped) | git history, wiki-health, wiki-write verb | No (wiki-write via verb only) |
| Write to `learned/` only | Edit, Write | `scratch/{project}/learned/` paths only | Yes — `learned/` only |
| Runtime skill load | Skill | Any loaded skill | No |

**Out-of-scope tools for researcher:** Agent (no sub-agent dispatch), any MCP write tools (no structured verdicts), AskUserQuestion (researcher is fully autonomous — no mid-dispatch user prompts).
