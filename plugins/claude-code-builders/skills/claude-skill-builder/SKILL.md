---
name: claude-skill-builder
description: "Validated patterns for building SKILL.md files that auto-discover reliably. Use when creating, editing, validating, or optimizing any Claude Code skill — even for simple single-file skills."
---

<role>
  <identity>Expert Claude Code skill builder and meta-skill specialist</identity>

  <purpose>
    Guide creation, validation, and optimization of Claude Code skills
    with type-specific guidance for maximum quality and agent-execution
  </purpose>

  <expertise>
    <area>Skill type-specific guidance (Expert, Writer, CLI, Meta)</area>
    <area>YAML frontmatter validation and description optimization</area>
    <area>Token optimization and multi-file architecture</area>
    <area>Agent-optimization principle application (26 principles)</area>
    <area>Validation protocols and quality frameworks</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Creating Claude Code skills (all types)</item>
      <item>Validating and optimizing skills</item>
      <item>Type-specific guidance (Expert, Writer, CLI, Meta)</item>
      <item>Multi-file architecture and @ references</item>
      <item>Token efficiency and agent-execution</item>
    </in-scope>

    <out-of-scope>
      <item>Creating agents (use claude-agent-builder)</item>
      <item>Creating standalone slash commands without skill features (use claude-command-builder). Note: slash commands and skills are now unified since v2.1.3</item>
      <item>General Claude Code usage (not skill-specific)</item>
    </out-of-scope>
  </scope>
</role>

# Claude Skill Builder

## Skill Hot-Reload (v2.1+)

Skills hot-reload automatically when files change. **Do NOT tell users to restart their session** after creating or modifying skills. Changes are picked up immediately.

## User Discovery

Users discover and invoke skills via **`/` autocomplete** in Claude Code (e.g., `/commit`, `/verify-code`). Skills with `user-invocable: true` appear in this list. Skills without that flag are auto-discovered by Claude based on the description — they don't appear in `/` autocomplete but are still loaded when relevant. Note: agents use `@` prefix instead (e.g., `@chrome-browser`).

## ⚠️ CRITICAL: Post-Change Validation Protocol

**This protocol applies to ALL skills created or modified with claude-skill-builder.**

When you create or modify ANY skill using claude-skill-builder, you MUST validate the work:

1. **Complete all changes** to the skill files
2. **Launch a validation agent** to audit the changes
3. **Use the validation agent prompt** from [validation/README.md](validation/README.md)

**Exception**: When creating claude-skill-builder itself, or when no validation agent is available, perform self-validation using the comprehensive checklists in [validation/README.md](validation/README.md) manually.

**Why This Matters:**
- Ensures every skill meets quality standards
- Catches errors before they affect users
- Validates skills follow claude-skill-builder best practices
- Provides objective quality assessment

**See validation/README.md** - Use Read tool on validation/README.md for complete validation protocol with comprehensive checklists and agent audit instructions.

## What I Can Do

I help you **create, validate, and optimize** Claude Code skills with type-specific guidance:

- **Create** expert skills (domain knowledge), CLI skills (syntax docs), or writer skills (content creation)
- **Validate** using comprehensive checklists and agent audits
- **Optimize** for token efficiency, agent-execution, and auto-discovery
- **Apply** agent-optimization principles (26 principles from 2025 research)
- **Guide** through complete workflow with templates and examples

See "Interactive Creation Workflow" below for detailed steps.

## Quick Start (Simple Skills < 200 lines)

For simple, single-file skills, skip the deep dive and follow this fast path:

1. **Create SKILL.md** with YAML frontmatter (name + description using WHAT + WHEN formula)
2. **Write clear instructions** in imperative voice with concrete examples
3. **Validate basics**: YAML parses correctly, description has 3+ WHEN triggers, < 200 lines total
4. **Test**: Verify skill loads and triggers on expected keywords (skills hot-reload automatically)

**See UNIVERSAL.md** - Use Read tool on UNIVERSAL.md for YAML requirements, description formula, and universal principles.

For complex skills (> 200 lines, multiple files, extensive examples), use the full workflow below.

---

## Expertise Contract & Self-Assessment

**Use Read tool on [EXPERTISE-CONTRACT.md](EXPERTISE-CONTRACT.md)** when you need to self-assess your knowledge before skill creation.

**Core Principle:** When creating skills, always read UNIVERSAL.md + [type]/README.md as minimum. For comprehensive skills, also read TOKEN-OPTIMIZATION.md. Token cost is irrelevant compared to creating production-quality skills.

---

## Loading Strategy

**As an agent using this skill, here's what to load and when:**

**Always loaded**:
- SKILL.md (you're reading this now) - Main orchestrator and workflow

**Load when creating your first skill**:
- Use Read tool on UNIVERSAL.md - Core principles (YAML, descriptions, token optimization, file structures)
- Use Read tool on [type]/README.md - Your skill type: expert/README.md, cli/README.md, or writer/README.md

**Load on-demand as needed**:
- Use Read tool on TOKEN-OPTIMIZATION.md when optimizing token efficiency or designing comprehensive skills
- Use Read tool on AGENTIC.md when applying agent-optimization principles to complex skills
- Use Read tool on validation/README.md when validating completed skills
- Use Read tool on patterns/ when need before/after transformation examples (60+ examples across 10 categories)
- Use Read tool on examples/ when need concrete case studies (token-optimization-case-study.md)
- Use Read tool on reference/README.md when troubleshooting issues
- Use Read tool on reference/frontmatter.md when need complete YAML field reference (10 fields, invocation control, string substitutions)
- Use Read tool on reference/gotchas.md when debugging skill issues (known bugs with workarounds)
- Use Read tool on reference/best-practices.md when need official Anthropic guidance (evaluation-driven development, degrees of freedom)
- Use Read tool on reference/capabilities.md when need v2.1+ feature details (hot-reload, commands merger, nested discovery)
- Use Read tool on reference/community-patterns.md when need community-tested patterns (forced-eval hooks, file-path triggering)

**Don't load everything at once** - this skill uses lazy-loading architecture. Load what you need, when you need it.

## Write Strategy: skill-edit

Claude Code's protected-directory check prompts on Edit/Write to `.claude/skills/` regardless of permission settings (upstream bug, anthropics/claude-code#36497). **All skill file modifications MUST use `skill-edit`** — the staging-based workaround.

**Commands:**
```bash
skill-edit pull <skill>              # Stage skill to temp dir, snapshot mtimes
skill-edit push --dry-run <skill>    # Preview changes (diff), no writes
skill-edit push <skill>              # Verify mtimes, backup, overwrite, clean staging
skill-edit list                      # Show staged skills
skill-edit diff <skill>              # Diff staged vs live
```

**Workflow — creating a new skill:**
1. Create files via Write to the staging path: `$LOCALAPPDATA/Temp/skill-staging/<skill-name>/`
2. Run `skill-edit push <skill-name>` — copies from staging to `.claude/skills/`

**Workflow — editing an existing skill:**
1. `skill-edit pull <skill-name>` — copies to staging, snapshots mtimes
2. Edit/Write files in staging path (no permission prompt)
3. `skill-edit push --dry-run <skill-name>` — preview diff
4. `skill-edit push <skill-name>` — verify no external changes, backup, overwrite

**Safety:** Push checks mtime snapshot from pull. If another session modified the skill since pull, push aborts with a conflict error. Backups are kept in `$LOCALAPPDATA/Temp/skill-backups/`.

**Install:** `bash .claude/skills/claude-skill-builder/scripts/install.sh` (creates `~/.local/bin/skill-edit` exec wrapper).

---

## Universal Principles (All Skills)

Before diving into type-specific guidance, understand the principles that apply to **all skills**:

**See UNIVERSAL.md** - Use Read tool on UNIVERSAL.md when creating your first skill for:
- YAML frontmatter requirements (syntax, required fields, name validation)
- Description engineering (WHAT + WHEN + Be Pushy formula, Anthropic-aligned, anti-bloat rules)
- Agent-optimization principles (core concepts)
- Token optimization techniques (quick reference; see TOKEN-OPTIMIZATION.md for architectural guidance)
- File structure patterns (minimal to complex)
- Installation locations (personal vs project)
- Hot-reload behavior (v2.1+)
- Best practices summary

**Key Takeaways:**
- Description is THE MOST IMPORTANT part (determines auto-discovery)
- Use relative links + Read instructions to keep files concise
- Follow WHAT + WHEN + Be Pushy formula (no AFTER/WITHOUT boilerplate)
- Main SKILL.md should be < 300-400 lines

## Description Formula: WHAT + WHEN + Be Pushy

Descriptions are the **sole mechanism** for auto-discovery. Claude uses pure LLM reasoning to match user intent against descriptions — no algorithmic routing.

| Component | Pattern | Purpose |
|-----------|---------|---------|
| **WHAT** | Direct capability statement, keyword-rich | What the skill does |
| **WHEN** | "Use when [scenario 1], [scenario 2]..." | Trigger keywords |
| **Be Pushy** | "...even when [edge case]" | Combat Claude's undertriggering tendency |

**Do NOT use** "AFTER loading..." preambles or "WITHOUT this skill..." scare tactics — they waste description budget on boilerplate. See UNIVERSAL.md for the complete formula, examples, and anti-patterns.

**Description examples:** See [patterns/11-description-patterns.md](patterns/11-description-patterns.md)

## Skill Type Selection

| Type | Focus | When to Use | Load |
|------|-------|-------------|------|
| **Expert** | Domain knowledge, investigation | Deep expertise, checklists | expert/README.md |
| **CLI** | Syntax, formats, config | Technical precision | cli/README.md |
| **Writer** | Documentation, content | Guides, tutorials | writer/README.md |
| **Hybrid** | Multiple aspects | Combines approaches | Multiple type files |

**Quick Decision:**
- Domain knowledge + investigation? → **Expert** → Read expert/README.md
- Syntax/formats/configuration? → **CLI** → Read cli/README.md
- Documentation/content creation? → **Writer** → Read writer/README.md
- Combines multiple aspects? → **Hybrid** → Read multiple type files

**Full type descriptions:** Use Read tool on [SKILL-TYPES.md](SKILL-TYPES.md)

**Templates:** Each type folder contains template.md for scaffolding.

## Validation & Quality Assurance

After creating your skill, validate it comprehensively:

**See validation/README.md** - Use Read tool on validation/README.md when validating completed skills for:
- Universal validation checklist (all skills)
- Expert skill validation
- CLI skill validation
- Writer skill validation
- Agent audit process (required for all skills)
- Self-validation instructions

**Key Validation Steps:**
1. YAML frontmatter valid
2. Description follows formula (WHAT + WHEN)
3. Type-specific requirements met
4. All @ references valid
5. Agent audit passes with Grade A+

## Troubleshooting & Advanced Topics

**See reference/README.md** - Use Read tool on reference/README.md when troubleshooting or need advanced guidance for:
- Common issues and solutions (skill doesn't load, description not triggering, etc.)
- Advanced topics (bash execution syntax, complex file structures)
- Performance optimization
- Quick reference tables
- Installation commands

## Interactive Creation Workflow

**Use Read tool on [workflows/creation-workflow.md](workflows/creation-workflow.md)** when creating skills.

**Quick Flow:**
1. **Gather requirements** - Domain, capabilities, scope (user vs project)
2. **Determine type** - Expert/CLI/Writer/Hybrid → Load [type]/README.md
2.5. **Extract knowledge** - (Expert + source material only) Launch insight-extractor agent to curate domain insights via 3-filter framework
3. **Apply principles** - YAML frontmatter, role definition, file structure
4. **Create files** - Scope-appropriate content strategy
5. **Validate** - Agent audit, Grade A+ target
6. **Deliver** - Usage guidance (skills hot-reload automatically)

**Scope implications:**
- **User-scoped** (~/.claude/skills/): Self-contained with inline examples
- **Project-scoped** (.claude/skills/): Reference actual project files ("show not tell")

## Testing & Iteration

claude-skill-builder teaches how to *design* a good skill. For iterative testing and improvement, use Anthropic's `/skill-creator`. It provides the complete eval infrastructure:

- **Test cases**: Run with-skill vs without-skill (or old vs new) in parallel
- **Benchmarking**: Quantitative grading with pass rates, timing, and token usage
- **Description optimization**: Automated train/test loops with multi-run reliability scoring
- **Blind comparison**: A/B testing between skill versions with independent judges

**Recommended workflow:** Design with claude-skill-builder patterns → Test and iterate with `/skill-creator` → Validate structure with claude-skill-builder checklists.

---

## File Organization Reference

```
claude-skill-builder/
├── SKILL.md (this file) - Lean orchestrator
├── SKILL-TYPES.md - Detailed type descriptions (load on-demand)
├── EXPERTISE-CONTRACT.md - Self-assessment framework (load on-demand)
├── UNIVERSAL.md - Shared principles for all skills
├── TOKEN-OPTIMIZATION.md - Token efficiency patterns (6 patterns)
├── AGENTIC.md - Agent-optimization framework (26 principles)
├── workflows/
│   └── creation-workflow.md - Full creation workflow + request patterns
├── expert/, cli/, writer/ - Type-specific guidance + templates
├── patterns/ - 60+ before/after transformation examples
├── validation/ - Checklists and agent audit protocol
├── examples/ - Case studies (token-optimization)
├── scripts/
│   ├── skill-edit.sh - Staging-based skill editor (bypasses protected-dir)
│   └── install.sh - Installs skill-edit to ~/.local/bin/
└── reference/
    ├── README.md - Troubleshooting and advanced topics
    ├── frontmatter.md - Complete YAML field reference (10 fields)
    ├── best-practices.md - Official Anthropic guidance
    ├── gotchas.md - Known bugs and workarounds
    ├── capabilities.md - New features since v2.1
    └── community-patterns.md - Community-tested patterns
```

