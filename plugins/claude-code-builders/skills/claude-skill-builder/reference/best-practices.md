# Official Anthropic Best Practices

Guidance from Anthropic's official skill authoring documentation at `platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices`.

## Concise Is Key

The context window is a shared resource. Only add context Claude doesn't already have. Challenge each piece of information: "Does this justify its token cost?"

**Questions to ask before adding content:**
- Does Claude already know this? (General programming knowledge, common patterns)
- Is this specific to MY domain/project? (If yes, include it)
- Could I link to a reference file instead of inlining? (Progressive disclosure)

## Degrees of Freedom

Match instruction specificity to the task's fragility:

| Task Fragility | Degrees of Freedom | Example |
|---------------|-------------------|---------|
| **Low fragility** (flexible) | High freedom — describe goals, let Claude choose approach | Code reviews, documentation, refactoring |
| **High fragility** (critical) | Low freedom — prescribe exact steps and validation | Database migrations, deployment scripts, security configs |

**Why this matters**: Over-specifying flexible tasks wastes tokens and constrains Claude unnecessarily. Under-specifying critical tasks risks dangerous mistakes.

## Evaluation-Driven Development

Anthropic's recommended skill development workflow:

1. **Identify gaps**: Run Claude on representative tasks WITHOUT the skill. Note where it fails or produces subpar results.
2. **Create evaluations**: Build at least 3 scenarios covering simple, moderate, and complex use cases.
3. **Establish baseline**: Run evaluations without the skill to measure current performance.
4. **Write minimal instructions**: Add only what's needed to pass evaluations. Start small.
5. **Iterate**: Run evaluations again. Add more content only where evaluations fail.
6. **Test across models**: What works for Opus may need more detail for Haiku. Test with all models you plan to use.

**Two-Claude method**: Use one Claude instance ("Claude A") to write skills, another ("Claude B") to test them.

**Automated eval infrastructure**: Anthropic's `/skill-creator` provides complete tooling for this workflow — test case management, parallel with-skill vs without-skill runs, quantitative grading, HTML result viewers, and automated description optimization with train/test splits. Use it instead of building ad-hoc eval tooling.

## Description Best Practices

### Third-Person Voice

Descriptions must use third person. Inconsistent point-of-view causes discovery problems.

| Voice | Example | Status |
|-------|---------|--------|
| Third person | "Processes Excel files and generates reports" | Correct |
| First person | "I can help you process Excel files" | Wrong |
| Second person | "You can use this to process Excel files" | Wrong |

### All Triggers in Description, Not Body

The skill body only loads AFTER the skill is triggered. "When to Use This Skill" sections in the body do NOT help Claude discover the skill.

All trigger information must be in the YAML `description` field.

```yaml
# WRONG — trigger info hidden in body where Claude can't see it during discovery:
---
description: "Handles database operations."
---

## When to Use This Skill
Use when writing migrations, optimizing queries, or designing schemas.

# RIGHT — triggers in description where Claude sees them during discovery:
---
description: "Handles database operations for schema design and query optimization. Use when writing migrations, optimizing queries, or designing schemas."
---
```

## Naming Conventions

### Gerund Form (Recommended)

Use verb-ing form for skill names:
- `processing-pdfs`
- `analyzing-spreadsheets`
- `managing-databases`
- `reviewing-code`

### Names to Avoid

- **Vague names**: `helper`, `utils`, `tools`, `misc`
- **Overly generic**: `documents`, `data`, `files`
- **Reserved words**: Names containing `anthropic` or `claude` (reserved by the open standard)

### Name Validation Rules (Open Standard)

| Rule | Example |
|------|---------|
| Max 64 characters | `my-skill-name` (14 chars) |
| Lowercase letters, numbers, hyphens only | `pdf-processor-v2` |
| Cannot start or end with hyphen | `processing-pdfs` not `-processing-` |
| No consecutive hyphens | `code-review` not `code--review` |
| Must match parent directory name | `skills/my-skill/SKILL.md` → `name: my-skill` |

## Content Guidelines

### Avoid Time-Sensitive Information

Don't include dates that will become outdated. Use "old patterns" sections instead of date-based conditionals.

```markdown
# WRONG:
As of January 2026, use the new API...

# RIGHT:
## Current Pattern
Use the new API...

## Legacy Pattern (Deprecated)
The old API is still supported but...
```

### Use Consistent Terminology

Choose one term and stick with it throughout the skill. Don't alternate between "component", "widget", and "element" for the same concept.

### Use Forward Slashes in Paths

Even on Windows, use forward slashes (`scripts/validate.py`) not backslashes (`scripts\validate.py`).

### Don't Offer Too Many Options

Provide a default approach with escape hatches, rather than presenting 5 options and asking Claude to choose.

## Anti-Patterns

Patterns to avoid in skill content:

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Windows-style paths (`scripts\helper.py`) | Breaks on Unix systems | Use forward slashes: `scripts/helper.py` |
| Too many options without default | Claude wastes time choosing | Provide one recommended approach |
| Deeply nested references | File A → File B → File C | Keep references one level deep from SKILL.md |
| Verbose explanations of known things | Wastes tokens on general knowledge | Only add what Claude doesn't already know |
| "Voodoo constants" in scripts | Unexplained magic numbers | Document why specific values are chosen |
| "When to Use" sections in body | Not visible during discovery | Put all trigger info in `description` field |

## Standard Directory Conventions

The Agent Skills open standard recommends these directory names:

| Directory | Purpose | Contents |
|-----------|---------|----------|
| `scripts/` | Executable code agents can run | Python, Bash, JavaScript files |
| `references/` | Documentation loaded into context as needed | Detailed guides, specifications |
| `assets/` | Static resources used in output | Templates, images, data files |

**Validation tool**: `skills-ref validate ./my-skill` (from agentskills.io)

## Progressive Disclosure (Official 3-Level Model)

Anthropic's official architecture for skill content:

| Level | When Loaded | Token Cost | Content |
|-------|------------|------------|---------|
| **Level 1: Metadata** | Always (at startup) | ~100 tokens | `name` and `description` from YAML frontmatter |
| **Level 2: Instructions** | When skill is triggered | < 5,000 tokens recommended | SKILL.md body with instructions and guidance |
| **Level 3: Resources** | As needed during execution | Effectively unlimited | Files in `scripts/`, `references/`, `assets/` loaded via Read or executed via Bash |

**Key insight**: Level 1 (description) determines whether the skill loads. Level 2 (body) should be under 500 lines. Level 3 (resources) has no practical limit.

## Plugin Distribution

Skills can be distributed as plugins:

```bash
# Install from marketplace
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills

# Official skills repository
# https://github.com/anthropics/skills
```

Community marketplaces:
- [skillsmp.com](https://skillsmp.com/) — Agent Skills Marketplace
- [github.com/anthropics/skills](https://github.com/anthropics/skills) — Official Anthropic skills
- [github.com/VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) — 300+ community skills
