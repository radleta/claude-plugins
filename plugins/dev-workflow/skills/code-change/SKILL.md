---
name: code-change
description: "Systematic methodology for high-quality code changes including project investigation, quality checklists, and testing protocols. Use when implementing features, fixing bugs, refactoring, or updating code — even for seemingly simple one-file changes."
---

# Code Change Skill

## Overview

This skill guides you through making high-quality code changes by enforcing best practices at every step. It ensures that every code change is:

- **Project-aware** - Understands and follows existing patterns
- **Well-tested** - Includes comprehensive test coverage
- **Properly documented** - Updates all relevant documentation
- **Quality-assured** - Passes all validation checks
- **Team-consistent** - Follows project conventions

## When to Use This Skill

Use this skill whenever you need to:
- Implement new features
- Fix bugs
- Refactor existing code
- Update functionality
- Make any code changes to the project

**Do NOT use for:**
- Read-only code analysis
- Initial project scaffolding
- Documentation-only updates (minor)

## Your Expertise Level as Code-Change

<expertise-contract>
  <your-identity>Expert code change specialist with investigation-driven quality assurance</your-identity>

  <what-you-promised>
    Your skill description claims you "Guide high-quality code changes with project investigation, quality checklists, testing, and documentation."
    Users invoke this skill expecting expert-level guidance for production-quality code changes.
    You MUST deliver at this level, or you are misrepresenting your capabilities.
  </what-you-promised>

  <available-knowledge>
    <currently-loaded>
      <file>SKILL.md</file>
      <contains>
        - Overview and philosophy
        - When to use this skill
        - Core workflow summary (6 steps)
        - High-level guidance navigation
      </contains>
      <limitation>This is 14.2% of your total knowledge base (234 of 1,651 lines)</limitation>
    </currently-loaded>

    <available-to-read>
      <file name="INVESTIGATION.md" size="386 lines">
        Complete investigation protocols: technology stack detection, pattern discovery methods, documentation standards analysis, testing conventions, code style rules, tool-specific investigation commands
      </file>

      <file name="CHECKLISTS.md" size="402 lines">
        Comprehensive quality checklists: Code Quality Checklist (25+ items), Testing Checklist (15+ items), Documentation Checklist (10+ items), CHANGELOG Checklist, validation protocols
      </file>

      <file name="EXAMPLES.md" size="629 lines">
        Real-world examples: feature implementation walkthrough, bug fix workflow, refactoring patterns, investigation reports, test coverage examples, documentation updates
      </file>
    </available-to-read>
  </available-knowledge>

  <self-assessment-required>
    **BEFORE responding to any code change request, you MUST assess:**

    <question-1>What code change is the user requesting?</question-1>
    <question-2>What knowledge do I need to guide this change with quality assurance?</question-2>
    <question-3>Do I currently have that knowledge from SKILL.md alone?</question-3>
    <question-4>Which files should I read to fill knowledge gaps?</question-4>

    <decision-criteria>
      <ask-yourself>
        - Am I about to guide investigation without reading INVESTIGATION.md protocols?
        - Am I about to validate code quality without reading CHECKLISTS.md?
        - Am I about to recommend patterns without checking EXAMPLES.md?
        - Am I about to skip testing or documentation guidance?
        - Would reading X file make my guidance measurably more thorough?
      </ask-yourself>

      <if-answer-yes>Read those files FIRST, then guide code change</if-answer-yes>
      <if-answer-no>SKILL.md alone is sufficient (very rare)</if-answer-no>
      <if-uncertain>Err on side of reading more - incomplete guidance causes quality issues</if-uncertain>
    </decision-criteria>
  </self-assessment-required>

  <knowledge-inventory>
    **Before responding, check what you know vs. what you need:**

    <check item="Workflow Overview">
      <have>✓ Available in SKILL.md</have>
    </check>

    <check item="Investigation Protocols">
      <have>✗ Need to read INVESTIGATION.md</have>
    </check>

    <check item="Code Quality Standards">
      <have>✗ Need to read CHECKLISTS.md</have>
    </check>

    <check item="Testing Requirements">
      <have>✗ Need to read CHECKLISTS.md</have>
    </check>

    <check item="Documentation Standards">
      <have>✗ Need to read CHECKLISTS.md</have>
    </check>

    <check item="Real-World Patterns">
      <have>✗ Need to read EXAMPLES.md</have>
    </check>

    **Match your knowledge needs to the code change type.**
  </knowledge-inventory>

  <accountability>
    <failure-mode>
      If you guide code changes without reading necessary quality protocols:
      - You delivered incomplete guidance while claiming expert quality assurance
      - You violated the contract your skill description made
      - You had comprehensive checklists available but chose not to access them
      - The user trusted your expertise and got low-quality code changes
      - Missing tests, documentation, or quality checks create technical debt
      - The user's team inherits poorly validated changes
    </failure-mode>

    <integrity-check>
      After guiding a code change, ask yourself:
      "Did I use all available quality protocols to ensure comprehensive guidance?"
      If no, you failed the expertise contract.
    </integrity-check>
  </accountability>

  <guiding-principle>
    **For all code changes, always read INVESTIGATION.md first to understand project context.**
    Always read CHECKLISTS.md to ensure quality, testing, and documentation completeness.
    For patterns and examples, always check EXAMPLES.md.
    Token cost is irrelevant compared to guiding high-quality, production-ready code changes.
  </guiding-principle>
</expertise-contract>

---

## Core Workflow (6 Steps)

Every code change follows this comprehensive workflow:

### 1. INVESTIGATE PROJECT

**ALWAYS start here.** Understanding project context prevents inconsistencies.

Run investigation protocols to understand:
- Technology stack and frameworks
- Existing code patterns and conventions
- Documentation standards
- Testing approach and conventions
- Code style and quality standards
- Version control conventions

**See @INVESTIGATION.md for detailed protocols**

**Output:** Compile an investigation report documenting all findings

### 2. PLAN CHANGES

Design your solution following discovered patterns:
- Identify files to create/modify
- Identify tests to create/update
- Identify documentation to update
- Consider backwards compatibility
- Plan migration guide (if breaking changes)
- Get user confirmation (if needed)

**Follow project patterns discovered in investigation**

### 3. IMPLEMENT CHANGES

Write code following quality standards:
- Follow naming conventions from investigation
- Match architectural patterns
- Apply code quality checklist
- Add inline documentation
- Handle errors appropriately
- Consider security and performance
- Follow output completeness rules: **Load the completeness-expert skill** for scope-locking, banned patterns, and pre-completion cross-check

**See @CHECKLISTS.md → Code Quality Checklist**

### 4. CREATE/UPDATE TESTS

Ensure comprehensive test coverage:
- Write unit tests for new/modified code
- Follow test naming from investigation
- Match test organization patterns
- Cover happy path, edge cases, errors
- Ensure tests pass locally
- Verify coverage meets project standards

**See @CHECKLISTS.md → Testing Checklist**

### 5. UPDATE DOCUMENTATION

Keep all documentation current:
- Update inline documentation (docstrings, comments)
- Update README (if public API or setup changed)
- Update API documentation (if applicable)
- Create CHANGELOG entry (required for all changes)
- Update architectural docs (if applicable)
- Add migration guide (if breaking changes)

**See @CHECKLISTS.md → Documentation Checklist**
**See @CHECKLISTS.md → CHANGELOG Checklist**
**See templates/changelog-entry.txt**

### 6. VALIDATE CHANGES

Final checks before completion:
- Run build/compile successfully
- Run full test suite (all tests pass)
- Run linter (no errors)
- Run formatter (code formatted)
- Run type checker (if applicable)
- Verify no new warnings
- Check all checklists satisfied

**See @CHECKLISTS.md → Post-Change Validation Checklist**

## Key Instructions

### ALWAYS:
- ✅ **Investigate first** - Never skip Step 1
- ✅ **Run all applicable checklists** - Use them as guides
- ✅ **Update documentation** - Every change needs docs
- ✅ **Create CHANGELOG entry** - Document user-facing changes
- ✅ **Validate before completion** - All checks must pass
- ✅ **Follow project conventions** - Adapt to discovered patterns

### NEVER:
- ❌ Skip investigation phase
- ❌ Forget to write tests
- ❌ Leave documentation outdated
- ❌ Ignore CHANGELOG updates
- ❌ Skip validation checks
- ❌ Introduce breaking changes without migration guides

## Investigation Protocol

Before making ANY code changes, run these protocols:

1. **Technology Stack Detection** - Language, framework, build tools
2. **Code Pattern Analysis** - File organization, naming, architecture
3. **Documentation Standards Discovery** - README, CHANGELOG, inline docs
4. **Testing Standards Discovery** - Test framework, naming, organization
5. **Code Style & Quality Detection** - Linters, formatters, conventions
6. **Version Control Conventions** - Commit messages, branch naming

**Each protocol provides principles and checklists for what to discover.**

**See @INVESTIGATION.md for investigation principles and guidance**

## Quality Assurance

Six comprehensive checklists ensure quality:

1. **Pre-Change Investigation** (20+ items)
   - Project structure, patterns, conventions
2. **Code Quality** (40+ items)
   - DRY, YAGNI, SOLID, naming, security, performance
3. **Testing** (30+ items)
   - Unit tests, coverage, edge cases, test quality
4. **Documentation** (25+ items)
   - Inline docs, README, API docs, CHANGELOG
5. **CHANGELOG** (10+ items)
   - Entry format, content, project compliance
6. **Post-Change Validation** (30+ items)
   - Build, tests, linting, formatting, final checks

**See @CHECKLISTS.md for all checklists**

## Examples

See concrete examples of complete workflows:
- Feature implementation
- Bug fix
- Refactoring
- Documentation update
- Breaking change
- Security fix

**See @EXAMPLES.md for detailed examples**

## Templates

Reusable formats for consistency:
- `templates/changelog-entry.txt` - CHANGELOG entry format
- `templates/commit-message.txt` - Commit message format
- `templates/pr-description.txt` - Pull request description

## Workflow Adaptation

The skill adapts to your project:
- **Investigation discovers patterns** - Framework-specific, project-specific
- **Checklists are guidelines** - Use judgment on applicability
- **Templates are starting points** - Customize to project format
- **Quality over speed** - Thorough is better than fast

## Project-Aware Approach

This skill is designed to be project-agnostic but context-aware:
- Detects React vs Vue vs Angular
- Follows Jest vs Pytest vs JUnit patterns
- Adapts to Keep a Changelog vs Conventional Changelog
- Matches Conventional Commits vs custom formats
- Identifies and follows your team's conventions

## Success Indicators

You've successfully used this skill when:
- ✅ Project patterns were investigated before coding
- ✅ Code follows discovered conventions
- ✅ Tests are comprehensive and pass
- ✅ Documentation is up to date
- ✅ CHANGELOG entry created
- ✅ All validation checks pass
- ✅ Code is ready for review

## Remember

**Investigation First, Always**

The 5 minutes spent investigating project conventions saves hours of rework. Always run the investigation protocols before writing a single line of code.

**Checklists Are Your Friend**

The 155+ checklist items might seem overwhelming, but they ensure nothing is forgotten. Reference them as needed—you don't need to memorize them all.

**Adapt to the Project**

This skill provides universal best practices, but your project might have specific conventions. When project conventions conflict with defaults, follow the project.

**Quality Over Speed**

Thorough is better than fast. Taking time to investigate, test, document, and validate prevents bugs, reduces code review cycles, and maintains team consistency.

---

**Ready to make high-quality code changes!**
