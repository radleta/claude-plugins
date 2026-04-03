---
name: skill-verification
description: "Validates Claude Code SKILL.md files against the claude-skill-builder framework including description formula, YAML frontmatter, file structure, and type-specific checklists. Use when reviewing skills for quality, validating skill changes, or auditing skill auto-discovery — even for simple single-file skills."
---

# Skill Verification Methodology

## Purpose

Verify that Claude Code skill files (SKILL.md) meet quality standards for auto-discovery, agent-optimization, and token efficiency. This methodology validates skills against the canonical checklists maintained by the claude-skill-builder skill.

## Detection Categories

### SK-01: YAML Frontmatter (CRITICAL)

- Opening `---` on line 1 (no headings or blank lines before it)
- No blank lines before opening `---`
- `name` field present and kebab-case (e.g., `my-skill-name`)
- `description` field present and non-empty
- Valid YAML syntax (no tabs, proper colon spacing, proper quoting)
- Closing `---` present with blank line after

### SK-02: Description Quality (CRITICAL)

- **WHAT component**: Direct capability statement, keyword-rich, no preamble ("Validated patterns for..." not "AFTER loading this skill...")
- **WHEN component**: "Use when" + 3-5 trigger scenarios covering primary use cases
- **Be Pushy edge case**: "even when/if [edge case]" clause to combat Claude's undertriggering
- Length: 150-400 characters (ideal: 150-300)
- No boilerplate: no "AFTER loading..." preamble, no "WITHOUT this..." scare tactics
- Rich keywords: technology names and action verbs front-loaded
- Multiple action verbs (creating, building, implementing, writing, reviewing)
- Trigger words match how users actually phrase requests

### SK-03: File Structure (HIGH)

- Main SKILL.md under 400 lines (ideal under 300)
- Relative markdown links with Read instructions for large external content
- All referenced files actually exist (no broken links)
- Sub-folders have README.md explaining their contents and when to load them
- No orphan files (every file reachable from SKILL.md navigation)
- Templates externalized to separate files if over 100 lines
- File organization matches complexity level (minimal/moderate/comprehensive)

### SK-04: Content Quality (HIGH)

- Clear, actionable guidance (not vague platitudes)
- Concrete examples included (inline or in supporting EXAMPLES.md)
- Examples show real usage, not just theory
- Principles explained with rationale (why, not just what)
- Checklists are specific and verifiable (not "ensure good quality")
- Cross-references correct and pointing to valid targets
- Writing clear, concise, and organized with clear headings
- Troubleshooting guidance for common issues

### SK-05: Agent Optimization (HIGH)

- Every step is executable (specific, actionable, measurable — no vague directives)
- No ambiguity (subjective terms eliminated or quantified)
- Imperative voice (direct commands, not suggestions)
- Positive AND negative examples (show what to do and what not to do)
- Dependencies explicit (prerequisites and execution order clear)
- Validation criteria measurable (acceptance criteria are specific)
- Structured formats used for complex protocols (XML, tables, checklists)
- Output format specified (templates or schemas for what the skill produces)
- Tool usage documented if applicable (when, how, and when not to use tools)
- Role explicitly defined (identity, purpose, scope)

### SK-06: Token Efficiency (MEDIUM)

- Main SKILL.md length appropriate (under 400 lines strict, under 300 ideal)
- Large content blocks (over 100 lines) externalized to separate files
- Supporting files documented with "Use Read tool when..." guidance
- Clear navigation structure (explicit pointers to supporting content)
- Token efficiency measured (initial load vs total content ratio reasonable)
- Follows established patterns from similar skills in the project

### SK-07: Type Compliance (HIGH)

Auto-detect skill type from content, then validate type-specific requirements:

**Expert skills:**
- Investigation protocols focusing on outcomes (what to discover)
- 5-7 core principles with rationale
- Comprehensive checklists (40-55 items typical)
- Project-awareness (encourages discovering existing patterns)
- Domain-specific techniques and best practices

**CLI skills:**
- Complete syntax reference with all options documented
- Validation checklist (15-30 items)
- Working templates (copy-paste ready)
- Common errors mapped to solutions
- Edge cases and special character handling

**Writer skills:**
- Target audience clearly defined (role, technical level)
- Content templates for each document type
- Writing quality criteria (measurable and specific)
- Before/after examples
- Progressive disclosure guidance

**For full type-specific checklists**, Read the canonical validation files:
- `.claude/skills/claude-skill-builder/validation/README.md` (universal + type checklists)
- `.claude/skills/claude-skill-builder/expert/README.md` (expert-specific)
- `.claude/skills/claude-skill-builder/cli/README.md` (CLI-specific)
- `.claude/skills/claude-skill-builder/writer/README.md` (writer-specific)

## Workflow

### Step 1: Gather Context

1. Read the skill file(s) specified in the session summary or $ARGUMENTS
2. If a directory is specified, read the main SKILL.md first
3. Identify skill type (expert, CLI, writer, hybrid) from content
4. Read the canonical checklists from claude-skill-builder for the detected type
5. List all files in the skill directory to check structure

### Step 2: Analyze

1. Check SK-01 (YAML frontmatter) — exact syntax validation
2. Check SK-02 (description quality) — component analysis and character count
3. Check SK-03 (file structure) — line counts, link validation, orphan detection
4. Check SK-04 (content quality) — guidance, examples, principles, checklists
5. Check SK-05 (agent optimization) — executability, ambiguity, format
6. Check SK-06 (token efficiency) — size, externalization, navigation
7. Check SK-07 (type compliance) — apply detected type's specific checklist

### Step 3: Verdict

Determine **APPROVED** or **ISSUES_FOUND**.

- Any CRITICAL finding (SK-01, SK-02) → ISSUES_FOUND
- 3+ HIGH findings → ISSUES_FOUND
- Isolated HIGH or MEDIUM-only → APPROVED with recommendations

## Output Format

```
## Skill Verification Report

**VERDICT: [APPROVED|ISSUES_FOUND]**
**Skill:** [skill name from YAML]
**Type:** [expert|CLI|writer|hybrid]
**Main file:** [path] ([line count] lines)

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
**Pushy:** [extracted edge case] — [present/missing]
**Length:** [character count] — [within range / over / under]
**Keywords:** [list of trigger words found]

---

### Structure Summary
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| SKILL.md lines | [n] | < 400 | ✅/❌ |
| Supporting files | [n] | documented | ✅/❌ |
| Broken references | [n] | 0 | ✅/❌ |
| Orphan files | [n] | 0 | ✅/❌ |

---

### Summary
**Overall:** [PROCEED / ADDRESS issues first]
```
