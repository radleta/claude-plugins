# Validation & Quality Assurance

**Behavioral vs structural validation:** This document covers *structural* validation — does the skill follow best practices, is the YAML valid, is the description well-formed? For *behavioral* validation — does the skill actually produce good output on real prompts? — use `/skill-creator`'s eval loop. Both are needed; behavioral should come first.

After creating your skill, validate it comprehensively to ensure quality, completeness, and adherence to claude-skill-builder best practices.

## Lightweight Validation (Simple Skills < 200 Lines)

For simple, single-file skills, use this fast path instead of the full checklist:

1. **YAML parses** — frontmatter has no syntax errors
2. **Description triggers correctly** — test 3 realistic queries mentally or with `/skill-creator`
3. **Skill produces expected output** — run 1 test prompt with the skill loaded
4. **No broken references** — all linked files exist

If all four pass, the skill is ready. Use the full checklists below for production/shared skills.

---

## Universal Validation Checklist

Use this checklist for **all** skill types before deployment:

### YAML Frontmatter (6 items)
- [ ] Opening `---` is on line 1 of the file (CRITICAL: no headings, blank lines, or any content before it)
- [ ] No blank lines or content before opening `---`
- [ ] `name` field present and kebab-case
- [ ] `description` field present and follows WHAT + WHEN formula
- [ ] Valid YAML syntax (no tabs, proper colons/quotes)
- [ ] Description length 150-400 chars (ideal: 150-300 chars)

### Description Quality (9 items)
- [ ] WHAT component: Direct capability statement, keyword-rich, no preamble
- [ ] WHEN component: "Use when" + 3-5 trigger scenarios
- [ ] "Be Pushy" edge case: "even when/if [edge case]" to combat undertriggering
- [ ] Rich keywords: Technology names and action verbs front-loaded
- [ ] Trigger words match how users will phrase requests
- [ ] Not vague (e.g., "helps with coding" → specific capabilities)
- [ ] Multiple action verbs (creating, building, implementing, writing, etc.)
- [ ] Length appropriate (150-300 chars ideal, under 400 acceptable)
- [ ] No boilerplate: No "AFTER loading..." preamble, no "WITHOUT this skill..." scare tactic

### File Structure (7 items)
- [ ] Main SKILL.md < 400 lines (ideal < 300)
- [ ] Relative markdown links with Read instructions used for large content
- [ ] All referenced files exist
- [ ] Sub-folders used appropriately (if applicable)
- [ ] Templates externalized if needed
- [ ] Scripts externalized if needed
- [ ] File organization matches complexity level

### Content Quality (10 items)
- [ ] Clear, actionable guidance provided
- [ ] Concrete examples included (inline or in separate EXAMPLES.md)
- [ ] Examples show real usage, not just theory
- [ ] Principles explained with rationale
- [ ] Checklists specific and verifiable
- [ ] Cross-references correct (links to UNIVERSAL.md, etc.)
- [ ] No broken file references
- [ ] Writing clear and concise
- [ ] Organized with clear headings
- [ ] Troubleshooting guidance for common issues

### Agent-Optimization (10 items)

Apply based on skill complexity. Always apply core principles; use structured formats for complex skills.

- [ ] **Every step executable** - No vague directives; specific, actionable, measurable
- [ ] **No ambiguity** - Subjective terms eliminated; quantified where possible
- [ ] **Imperative voice** - Direct commands, not suggestions
- [ ] **Positive + negative examples** - Show what to do AND what not to do
- [ ] **Dependencies explicit** - Prerequisites and execution order clear (if applicable)
- [ ] **Validation criteria measurable** - Acceptance criteria specific, not subjective
- [ ] **Structured formats used appropriately** - XML for complex protocols (if 3+ steps/areas)
- [ ] **Output formats specified** - Templates or schemas provided (if applicable)
- [ ] **Tool usage documented** - When/when-not/how specified (if skill uses tools)
- [ ] **Role explicitly defined** - Identity, purpose, scope clear

For complete agent-optimization guidance: [AGENTIC.md](../AGENTIC.md)
For transformation examples: [patterns/README.md](../patterns/README.md)

### Token Optimization (6 items)

Skills load every conversation. Token efficiency is an architectural decision. See [TOKEN-OPTIMIZATION.md](../TOKEN-OPTIMIZATION.md) for complete guidance.

- [ ] **SKILL.md length appropriate** - < 400 lines strict, < 300 lines ideal (exceptions: meta-skills < 400)
- [ ] **Large content externalized** - Content blocks > 100 lines moved to separate files with Read instructions
- [ ] **Supporting files documented** - Each folder has README.md explaining contents and when to load
- [ ] **Clear navigation** - SKILL.md provides explicit pointers to supporting content with "Use Read tool when..." guidance
- [ ] **Token efficiency measured** - Initial load vs total content ratio documented (target < 2% comprehensive, < 5% moderate)
- [ ] **Follows established patterns** - Architecture matches appropriate pattern (minimal/moderate/comprehensive/meta)

For architectural guidance and decision framework: [TOKEN-OPTIMIZATION.md](../TOKEN-OPTIMIZATION.md)

### Integration (5 items)
- [ ] Skill type determined correctly (expert, CLI, writer, hybrid)
- [ ] Type-specific requirements met (see type sections below)
- [ ] Cross-references to type guidance included if helpful
- [ ] Follows patterns from similar skills
- [ ] Compatible with claude-skill-builder best practices

**Total Universal Items**: 43

---

## Expert Skill Validation

In addition to universal checklist, verify expert skills have:

### Investigation Protocols (5 items)
- [ ] Investigation sections focus on **what** to discover (outcomes)
- [ ] "Why it matters" context provided for investigation areas
- [ ] "How to find out" suggestions offered (not bash commands)
- [ ] Investigation encourages using judgment and available tools
- [ ] Investigation documented for reference during work

### Principles & Guidance (7 items)
- [ ] Principles over prescriptions (outcomes not commands)
- [ ] 5-7 core principles clearly articulated
- [ ] Each principle has: what/why/how/examples
- [ ] Guidance empowers Claude to use tools and judgment
- [ ] Avoids rigid "run this command" instructions
- [ ] Outcomes and success criteria stated clearly
- [ ] Examples drawn from real expert skills

### Checklists (5 items)
- [ ] Comprehensive checklist (40-55 items typical)
- [ ] Organized by category (Investigation, Domain, Adaptability, Documentation)
- [ ] Each item specific and verifiable
- [ ] [ ] format used consistently
- [ ] Checklist ensures quality and completeness

### Project-Awareness (5 items)
- [ ] Encourages discovering existing project patterns
- [ ] Adapts to different project contexts
- [ ] Investigates before prescribing solutions
- [ ] Follows "investigation before action" principle
- [ ] References project-specific examples or patterns

### Domain Coverage (5 items)
- [ ] Deep domain knowledge encoded
- [ ] Domain-specific techniques named
- [ ] Best practices for domain included
- [ ] Common patterns explained
- [ ] Anti-patterns or pitfalls noted

### File Structure (3 items)
- [ ] File structure appropriate (minimal/moderate/comprehensive)
- [ ] Uses @ references for modularity (if comprehensive)
- [ ] Templates in separate files if needed

**Total Expert Skill Items**: 30 (in addition to 43 universal = 73 total)

---

## CLI Skill Validation

In addition to universal checklist, verify CLI skills have:

### Syntax Documentation (8 items)
- [ ] Complete syntax reference provided
- [ ] All options documented with examples
- [ ] Required vs optional elements clearly marked
- [ ] Data types and valid values specified
- [ ] Edge cases and special character handling noted
- [ ] Exact format requirements shown (spacing, case, delimiters)
- [ ] Character-by-character breakdown when needed
- [ ] Tables used for systematic reference

### Validation (8 items)
- [ ] Validation checklist included (15-30 items)
- [ ] Validation commands/tools provided
- [ ] Common validation errors documented with examples
- [ ] Self-validation instructions included
- [ ] How to test before deploying explained
- [ ] What each validation rule checks clarified
- [ ] Error message → solution mappings provided
- [ ] Validation automation guidance included

### Configuration (5 items)
- [ ] Configuration options explained comprehensively
- [ ] Trade-offs for each option noted
- [ ] Security considerations documented
- [ ] Performance implications explained
- [ ] Default values and recommendations provided

### Templates (5 items)
- [ ] Working templates provided (copy-paste ready)
- [ ] Multiple complexity levels offered
- [ ] Templates tested and functional
- [ ] Template customization guidance included
- [ ] Real-world template examples shown

### Troubleshooting (5 items)
- [ ] Common errors documented
- [ ] Error messages mapped to solutions
- [ ] Debugging steps provided
- [ ] Edge cases addressed
- [ ] FAQ section for frequent issues

### Examples (4 items)
- [ ] Technical precision in examples
- [ ] Examples are tested and working
- [ ] Multiple scenarios covered
- [ ] Edge cases demonstrated

**Total CLI Skill Items**: 35 (in addition to 43 universal = 78 total)

---

## Writer Skill Validation

In addition to universal checklist, verify writer skills have:

### Audience Analysis (6 items)
- [ ] Target audience clearly defined (role, technical level)
- [ ] Technical level specified (beginner/intermediate/advanced/expert)
- [ ] Prior knowledge assumptions stated explicitly
- [ ] Tone and voice guidelines provided
- [ ] Accessibility requirements noted (reading level)
- [ ] Audience goals and pain points addressed

### Structure & Organization (7 items)
- [ ] Content templates for each document type included
- [ ] Section organization defined (what sections, what order)
- [ ] Information hierarchy established (overview → details → examples)
- [ ] Consistent patterns across similar content types
- [ ] Progressive disclosure guided (simple → complex)
- [ ] Content made scannable (headings, bullets, short paragraphs)
- [ ] Navigation aids included (TOC, breadcrumbs, cross-links)

### Writing Quality (8 items)
- [ ] Quality criteria measurable and specific
- [ ] Clarity emphasized over cleverness
- [ ] Examples of good documentation shown
- [ ] Before/after examples provided
- [ ] Plain language guidance included
- [ ] Active voice preferred and demonstrated
- [ ] Grammar and spelling standards noted
- [ ] Tone appropriate for content creators

### Templates (5 items)
- [ ] Templates for multiple content types (tutorial, reference, troubleshooting)
- [ ] Template structure clear and complete
- [ ] Real-world template examples included
- [ ] Template customization guidance provided
- [ ] Templates follow best practices for audience

### Content Quality Standards (4 items)
- [ ] What makes "good" content defined
- [ ] Quality checklist for writers provided
- [ ] Review criteria specified
- [ ] Iterative improvement guidance included

**Total Writer Skill Items**: 30 (in addition to 43 universal = 73 total)

---

## Agent Audit Process (Required)

**⚠️ CRITICAL**: After creating or modifying ANY skill, you MUST validate using an agent audit.

### Why Agent Audit?

- **Objective assessment**: Unbiased review by independent agent
- **Catches errors**: Spots issues you might miss
- **Validates completeness**: Ensures all requirements met
- **Quality assurance**: Confirms skill meets Grade A+ standards
- **Best practice compliance**: Verifies claude-skill-builder principles followed

### How to Run Agent Audit

Launch a validation agent after skill creation/modification:

**Agent Prompt Template** (adapt to specific needs):

```
You are auditing a Claude Code skill for quality, completeness, and adherence to claude-skill-builder best practices.

## Skill Location
[Path to skill folder, e.g., .claude/skills/my-skill/]

## Your Mission

Comprehensively audit this skill and provide:

1. **YAML Frontmatter Analysis**
   - Syntax validation
   - Required fields present
   - Description quality (WHAT + WHEN formula)

2. **Content Quality Analysis**
   - Clarity and actionability
   - Examples included and useful
   - Principles well-explained
   - Checklists comprehensive and specific

3. **Structure Analysis**
   - File organization appropriate
   - @ references valid
   - Token optimization applied
   - Main SKILL.md length appropriate

4. **Type-Specific Analysis**
   - [Expert/CLI/Writer] skill requirements met
   - Type-specific checklist items verified
   - Patterns from similar skills followed

5. **Integration Analysis**
   - Cross-references correct
   - Compatible with claude-skill-builder practices
   - No conflicts with existing skills

6. **Issues Found**
   - List all issues by severity (Critical/Major/Minor)
   - Specific line numbers or sections
   - Recommended fixes

7. **Overall Grade**
   - Grade: A+, A, B, C, D, F
   - Justification for grade
   - Path to A+ (if not already)

## Validation Checklists

Use these checklists from validation/README.md:
- Universal Validation Checklist (43 items)
- [Type]-Specific Validation Checklist (30-35 items)

## Success Criteria

A skill achieves Grade A+ when:
- All YAML valid, description excellent (WHAT + WHEN + rich keywords)
- All content clear, actionable, well-organized
- All file references valid, appropriate file structure
- All type-specific requirements met
- All checklists comprehensive (40-55 items for expert/writer, 40-50 for CLI)
- All examples concrete and useful
- Zero critical issues, zero major issues, < 3 minor issues

Begin your audit by reading all skill files, then provide comprehensive assessment.
```

### After Agent Audit

1. **Review findings**: Read agent's complete assessment
2. **Address issues**: Fix all Critical and Major issues, consider Minor issues
3. **Confirm Grade A+**: If not achieved, iterate until A+
4. **Document validation**: Note that skill passed agent audit

---

## Self-Validation Instructions

Before launching agent audit, do a quick self-check:

### Quick Self-Check (5 minutes)

1. **YAML**: Run YAML parser on frontmatter
2. **Description**: Count characters (100-500, ideal: 200-400 for all types)
3. **References**: Check all referenced files exist
4. **Length**: Count lines in main SKILL.md (< 400 ideal)
5. **Examples**: Verify at least 2-3 concrete examples included

### Deep Self-Check (15 minutes)

1. **Universal checklist**: Go through all 41 items
2. **Type checklist**: Go through all 30-35 type-specific items
3. **Cross-references**: Verify all file references work
4. **Principles**: Ensure 5-7 principles clearly explained
5. **Checklists**: Count items (40-55 target), verify each specific

### Self-Check Questions

- **Discovery**: Will Claude know when to load this skill?
- **Clarity**: Is guidance clear and actionable?
- **Completeness**: Are all aspects covered?
- **Examples**: Can someone follow the examples?
- **Quality**: Does it meet Grade A+ standards?

If you answer "no" to any question, address before agent audit.

---

## Common Validation Issues

### Issue: Vague Description
**Problem**: "Helps with testing"
**Fix**: "Creates pytest test files with fixtures and mocking. Use when writing tests, adding test coverage, or setting up test infrastructure in Python projects."

### Issue: Missing WHEN Scenarios
**Problem**: "Creates React components"
**Fix**: "Creates React components with TypeScript, props typing, and hooks. Use when building UI components, refactoring class components, or scaffolding component structures."

### Issue: Too Few Keywords
**Problem**: Description missing technology names
**Fix**: Include React, TypeScript, components, props, hooks, UI, etc.

### Issue: Broken File References
**Problem**: References EXAMPLES.md but file doesn't exist
**Fix**: Create the file or update reference

### Issue: Monolithic SKILL.md
**Problem**: 800-line SKILL.md with examples, templates, everything
**Fix**: Externalize to separate files with Read instructions (EXAMPLES.md, templates/ folder, etc.)

### Issue: Prescriptive Commands
**Problem**: (Expert skills) "Run: git status"
**Fix**: "Check the current state of your repository to understand what files have changed."

### Issue: Incomplete Checklist
**Problem**: Only 15 checklist items for expert skill
**Fix**: Expand to 40-55 items across Investigation, Domain, Adaptability, Documentation

### Issue: No Examples
**Problem**: Theory only, no concrete usage
**Fix**: Add 2-5 real examples showing actual usage

---

## Validation Workflow

Recommended validation workflow for all skills:

```
1. Create skill
   ↓
2. Self-check (quick)
   ↓
3. Fix obvious issues
   ↓
4. Self-check (deep)
   ↓
5. Launch agent audit
   ↓
6. Review findings
   ↓
7. Address all Critical/Major issues
   ↓
8. Re-audit if needed
   ↓
9. Confirm Grade A+
   ↓
10. Deploy (skill hot-reloads automatically)
```

**Total validation time**: 30-60 minutes (self-check 20 min, agent audit 10-40 min)

---

## See Also

- **[UNIVERSAL.md](../UNIVERSAL.md)** - Shared principles for all skills
- **[expert/README.md](../expert/README.md)** - Expert skill creation guidance
- **[cli/README.md](../cli/README.md)** - CLI skill creation guidance
- **[writer/README.md](../writer/README.md)** - Writer skill creation guidance
- **[reference/README.md](../reference/README.md)** - Troubleshooting and advanced topics
