---
name: agent-verification
description: "Validates Claude Code agent files against the claude-agent-builder framework including thin agent pattern, description formula, YAML frontmatter, and archetype alignment. Use when reviewing agents for quality, validating agent changes, or auditing agent auto-discovery — even for simple utility agents."
---

# Agent Verification Methodology

## Purpose

Verify that Claude Code agent files (.claude/agents/*.md) meet quality standards for the thin agent pattern, auto-discovery, and proper configuration.

## Detection Categories

### AG-01: YAML Frontmatter (CRITICAL)

- Opening `---` on line 1 (no blank lines or content before)
- No blank lines before opening `---`
- `name` field present and kebab-case
- `description` field present and non-empty
- Valid YAML syntax (no tabs, proper indentation, valid structure)
- Closing `---` present
- All fields are valid properties: `name`, `description`, `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `isolation`
- `model` value valid if present: `inherit`, `sonnet`, `opus`, `haiku`
- `permissionMode` value valid if present: `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan`
- `memory` value valid if present: `user`, `project`, `local`
- `skills` is a YAML list (not comma-separated string)
- `mcpServers` is a YAML list (not comma-separated string)

### AG-02: Description Quality (CRITICAL)

- **WHAT component**: Clear statement of what the agent does (active voice, specific)
- **WHEN component**: "Use when" + 3-5 trigger scenarios
- Length: 80-250 characters (under 80 is too vague, over 250 is excessive)
- Contains 5+ trigger words (domain nouns + action verbs that users actually type)
- Active voice throughout ("Builds" not "Helps build", "Performs" not "Assists with")
- No weak language: avoid "helps with", "assists users", "can be used for"
- Specific to the agent's domain (not too broad or vague)

### AG-03: Thin Agent Pattern (HIGH)

- Agent body (content after closing `---`) is under 30 lines
- Methodology lives in referenced skills, not in the agent body
- All skill references in `skills:` field resolve to existing skill directories
- Agent file is wiring (name, tools, skills, model), not content (no inline checklists, no long workflows)
- If agent has complex methodology inline, it should be extracted to a skill

**Thin agent test:** Could you describe the agent body in one sentence? If not, it's too thick — extract to a skill.

### AG-04: System Prompt (HIGH)

- Role definition present (who the agent is)
- Primary objective stated (what the agent's mission is)
- Constraints specified (what the agent must NOT do)
- Instructions are clear and actionable (not vague)
- If complex agent: workflow steps present (4-8 actionable steps)
- If using skills: references the skill for methodology ("Follow the X methodology loaded in your skills")
- No contradictions between agent body and referenced skill methodology

### AG-05: Configuration (MEDIUM)

- `tools` appropriate: omitted to inherit all, or restricted to specific needs
- `model` appropriate: `inherit` recommended unless complexity demands specific model
- If `Bash` in tools: agent body or skill documents what Bash commands are allowed
- If `mcpServers` present: agent has corresponding skill for MCP methodology
- If `memory` present: appropriate scope for the agent's role
- If `permissionMode` set: matches the agent's risk level (read-only = default, write = acceptEdits)
- No unnecessary tool restrictions (don't over-restrict unless needed for safety)

### AG-06: Archetype Alignment (MEDIUM)

Auto-detect archetype from content, then validate archetype-specific requirements:

**Technical Specialist:**
- Deep competencies in specific technical area
- Workflow with investigation and implementation steps
- Technical depth appropriate for domain

**Domain Expert:**
- Business/domain knowledge encoded
- Methodologies and frameworks referenced
- Clear deliverable format

**QA/Auditor:**
- Evaluation dimensions defined
- Checklists or detection categories present
- Structured report output format
- Read-only constraint (does not modify files)

**Utility:**
- Single focused task
- Minimal structure
- Specific constraints
- Fast execution (typically haiku model)

## Workflow

### Step 1: Gather Context

1. Read the agent file(s) specified in the session summary or $ARGUMENTS
2. Parse YAML frontmatter for all configuration fields
3. Parse agent body (system prompt)
4. If skills are referenced, check that skill directories exist
5. List other agents in the same directory to understand the ecosystem

### Step 2: Analyze

1. Check AG-01 (YAML frontmatter) — syntax, valid fields, valid values
2. Check AG-02 (description quality) — component analysis, trigger words, length
3. Check AG-03 (thin agent pattern) — body line count, methodology location, skill refs
4. Check AG-04 (system prompt) — role, objective, constraints, workflow
5. Check AG-05 (configuration) — tool appropriateness, model, MCP, permissions
6. Check AG-06 (archetype alignment) — detect and validate archetype

### Step 3: Verdict

Determine **APPROVED** or **ISSUES_FOUND**.

- Any CRITICAL finding (AG-01, AG-02) → ISSUES_FOUND
- 3+ HIGH findings → ISSUES_FOUND
- Isolated HIGH or MEDIUM-only → APPROVED with recommendations

## Output Format

```
## Agent Verification Report

**VERDICT: [APPROVED|ISSUES_FOUND]**
**Agent:** [name from YAML]
**Archetype:** [Technical Specialist|Domain Expert|QA/Auditor|Utility]
**File:** [path] ([body line count] lines)

---

### Configuration Summary
| Field | Value | Status |
|-------|-------|--------|
| name | [value] | ✅/❌ |
| description | [truncated] | ✅/❌ |
| tools | [value or INHERITED] | ✅/❌ |
| skills | [list or NONE] | ✅/❌ |
| model | [value] | ✅/❌ |
| mcpServers | [list or NONE] | ✅/N/A |
| memory | [value or NONE] | ✅/N/A |

### Thin Agent Check
**Body lines:** [n] (target: < 30)
**Methodology in skills:** [yes/no]
**Skill refs valid:** [all valid / list broken refs]

---

### Findings

#### CRITICAL
| Category | Location | Issue | Fix |
|----------|----------|-------|-----|

#### HIGH
| Category | Location | Issue | Fix |
|----------|----------|-------|-----|

#### MEDIUM
| Category | Location | Issue | Fix |
|----------|----------|-------|-----|

---

### Description Analysis
**WHAT:** [extracted component] — [pass/fail]
**WHEN:** [extracted component] — [pass/fail]
**Length:** [character count] (target: 80-250)
**Trigger words:** [list of words found] ([count] — target: 5+)

---

### Summary
**Overall:** [PROCEED / ADDRESS issues first]
```
