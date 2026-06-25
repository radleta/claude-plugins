---
tags: [claude-code/builders]
summary: "SKILL.md authoring patterns: description formula, frontmatter, types, wiki-backed layout, write strategy, and validation workflow"
code-cites: [builders/skill-edit-bypass-permissions-exemption.md]
---

# Skill Builder Patterns

Validated patterns for building Claude Code `SKILL.md` files. Source: `claude-skill-builder` skill.

## Description Formula: WHAT + WHEN + Be Pushy

Descriptions are the sole mechanism for auto-discovery. Claude uses pure LLM reasoning to match user intent against descriptions.

| Component | Pattern | Purpose |
|-----------|---------|---------|
| **WHAT** | Direct capability statement, keyword-rich | What the skill does |
| **WHEN** | "Use when [scenario 1], [scenario 2]..." | Trigger keywords |
| **Be Pushy** | "...even when [edge case]" | Combat Claude's undertriggering tendency |

Do NOT use "AFTER loading..." preambles or "WITHOUT this skill..." scare tactics.

## YAML Frontmatter

Required fields for all skills:

```yaml
---
name: my-skill-name       # kebab-case
description: "WHAT statement. Use when WHEN1, WHEN2 — even for EDGE_CASE."
---
```

Optional fields: `model`, `user-invocable`, `allowed-tools`, `context`, `hooks`, `memory`.

## Skill Types

| Type | Focus | When to Use |
|------|-------|-------------|
| **Expert** | Domain knowledge, investigation | Deep expertise, checklists |
| **CLI** | Syntax, formats, config | Technical precision |
| **Writer** | Documentation, content | Guides, tutorials |
| **Hybrid** | Multiple aspects | Combines approaches |

## Choosing Skill Structure: Monolithic vs Wiki-Backed

Not every skill benefits from wiki-backed format. Apply the 4-test heuristic before
committing to wiki structure.

**4-test heuristic:**

1. **Sequential test:** Does the agent need to read the SKILL.md top-to-bottom every
   time? → methodology, keep monolithic
2. **Query test:** Will an agent commonly load *one specific page* to answer *one
   specific question*? → wiki-natural
3. **Growth test:** Will this content grow over time as the LLM ingests new patterns?
   → wiki-natural
4. **Decomposition test:** Does decomposing the SKILL.md into pages require splitting
   sequential narrative into out-of-order fragments? → methodology, keep monolithic

**Naming heuristics:**
- `-expert` suffix is a soft wiki signal (but not sufficient on its own — see carve-outs)
- `-methodology`, `-rollout`, `-update` (verb-form), `-management` are strong
  methodology signals — keep monolithic unless all 4 tests clearly pass

**Concrete examples from wiki-fleet-conversion (Phase 3):**

| Skill | Structure | Why |
|-------|-----------|-----|
| `dynamodb-expert` | wiki-backed | Query by API pattern, grows with new DynamoDB features |
| `react-expert` | wiki-backed | Query by hook/pattern, grows with React version knowledge |
| `csharp-expert` | wiki-backed | Query by API, async pattern, etc. |
| `github-actions-expert` | wiki-backed | Query by workflow type, grows with Actions ecosystem |
| `ff-scraper` | wiki-backed | Queryable scraping patterns per endpoint |
| `codex-cli` | wiki-backed | CLI flag reference is queryable knowledge, not a workflow |
| `handoff-methodology` | monolithic | Sequential protocol — read top-to-bottom every time |
| `code-change` | monolithic | Sequential checklist — step 1 → step 2 → step 3 |
| `brainstorming` | monolithic | Procedural workflow, decomposition fragments the narrative |
| `commit-methodology` | monolithic | Sequential commit creation protocol |
| `doc-update` | monolithic | Sequential doc-impact assessment workflow |
| `analyzer-rollout` | monolithic | Sequential rollout process, not a reference |
| `api-docs` | monolithic | Procedural documentation workflow |
| `scratch-management` | monolithic | Sequential lifecycle management |
| `knowledge-capture` | monolithic | Sequential capture workflow |

**Carve-outs — `-expert` names that stay monolithic:** `plan-expert`,
`estimation-expert`, and `sdd-expert` are sequential procedural content despite
their `-expert` suffix. The suffix alone is not sufficient to justify wiki structure.

If the skill is methodology-flavored, the `wiki-memory init` and `wiki-memory migrate`
protocols will both bail out with `RESULT: SKIP-METHODOLOGY`. See:
- `wiki-memory/protocols/init.md` — pre-check for new skills
- `wiki-memory/protocols/migrate.md` — pre-check for migrations

## Wiki-Backed Layout (Expert Skills)

Large domain skills use wiki-backed format: SKILL.md as navigation hub, sibling pages for knowledge.

```
my-expert/
├── SKILL.md        # Hub: frontmatter + role stub + ## Pages + ## Meta
├── log.md          # Timestamped operations log
├── schema.md       # Wiki conventions
├── .mditerc        # entrypoint: SKILL.md
└── *.md            # Knowledge pages with YAML frontmatter
```

`## Pages` entry format: `- [Title](file.md) — one-line summary`

When ≥ 4 subdirectory groups: split into `### Topic Areas` (hubs) + `### Standalone Pages` (top-level leaves).

## Write Strategy: Direct Edit

**Wiki-backed skill pages** (skill folders with `## Pages` and `.mditerc`):

Use `wiki-write <domain> <slug> --from <payload-file>` — the verb enforces YAML frontmatter, performs atomic rename, and detects dual-scope (project vs. user wiki) automatically.

```bash
wiki-write claude-code-expert skill-patterns --from /tmp/payload.md
```

**Non-wiki skill folders or single SKILL.md skills:**

Use plain `Edit`/`Write` directly. The v2.1.120+ bypass-permissions exemption covers `.claude/skills/`, `.claude/agents/`, and `.claude/commands/` in `bypassPermissions` mode — no wrapper needed. Sub-agent use on v2.1.120+ confirmed. See [skill-edit-bypass-permissions-exemption.md](skill-edit-bypass-permissions-exemption.md) for caveat on `default` mode (prompt still fires there).

## Hot-Reload Behavior

Skills hot-reload automatically when files change (v2.1+). Do NOT tell users to restart sessions after modifying skills. New agent files still require session restart for `@` autocomplete.

## Skill Types and Token Optimization

Main SKILL.md should stay under 300-400 lines. Use lazy-loading architecture:
- Always-loaded: SKILL.md (navigation hub)
- Load on-demand: supporting pages via `## Pages` index

## Validation Workflow

1. Dispatch the **skill-verifier** agent to audit the skill.
2. IF verdict is APPROVED → complete.
3. IF verdict is ISSUES_FOUND → fix and re-dispatch (mandatory verify-fix loop, max 10 iterations).

The `skill-verification` skill owns the validation methodology; `skill-verifier` agent is the dispatcher.

## Post-Change Validation Protocol

After creating or modifying ANY skill: complete all changes, then dispatch skill-verifier. Exception: when no validation agent is available, perform self-validation using the checklists in `claude-skill-builder/validation/README.md` manually.

## Agent-Optimization Principles

26 validated principles from 2025 research (in `claude-skill-builder/AGENTIC.md`). Key ones:
- Use imperative voice throughout
- Include concrete examples (pattern-matching beats abstract rules)
- Name specific tools explicitly rather than describing what they do
- Scope role tightly (prevents prompt injection and scope creep)

## See Also

- [Hooks](../platform-features/hooks.md) — Hook integration for skills (Stop, PreToolUse, PostToolUse)
- [Session Data](../platform-features/session-data.md) — Session JSONL and token analysis for skill workflows
- [Agent Teams](../platform-features/teams.md) — Agent teams for skill-backed multi-agent workflows
