# Expert Skills Guide

Expert skills encode deep domain knowledge and guide Claude through investigation-driven, principle-based approaches. They adapt to project contexts and provide comprehensive guidance through checklists and outcomes rather than prescriptive commands.

## What Are Expert Skills?

Expert skills are domain knowledge and investigation-driven skills that:
- **Provide expertise** in a specific domain (React architecture, code quality, agent creation, etc.)
- **Guide investigation** before action (understand context first)
- **Offer principles** over prescriptions (outcomes, not commands)
- **Ensure quality** through comprehensive checklists
- **Adapt to projects** by discovering and following existing patterns

### Examples of Expert Skills

**code-change**: Guides high-quality code changes with project investigation, quality checklists, testing, and documentation. (7 files, 1,764 lines)

**agent-builder**: Expert at creating Claude Code agents with YAML frontmatter, system prompts, and optimal configurations. (4 files with templates)

**claude-skill-builder**: Expert at creating Claude Code skills with type-specific guidance, YAML frontmatter, and description optimization. (This skill itself)

### When to Create Expert Skills

Create an expert skill when you need:
- **Deep domain expertise** - React architecture, testing strategies, security patterns, etc.
- **Investigation required** - Must understand project context before taking action
- **Project pattern discovery** - Different projects need different approaches
- **Comprehensive checklists** - Ensure quality and completeness (40-100+ items)
- **Principles-based guidance** - Outcomes and "why," not rigid "how"
- **Adaptability** - One approach doesn't fit all projects

### When NOT to Create Expert Skills

Don't create an expert skill when:
- **Syntax documentation** is primary need → Use CLI skill instead
- **Content creation** is primary need → Use writer skill instead
- **Simple checklist** suffices → Consider simpler skill type
- **No investigation needed** → May not need expert-level complexity

---

## Core Principles (Expert Skills)

These principles define what makes a skill an "expert" skill:

### 1. Investigation Before Action

**What it means**: Always understand context before creating or doing anything.

**Why it matters**: 5 minutes of investigation saves hours of rework. Projects have established patterns that must be discovered and followed.

**How to implement**:
- Provide **what to investigate** (outcomes), not how (commands)
- Give "Why it matters" context for each investigation area
- Offer "How to find out" suggestions, not bash commands
- Encourage using judgment and available tools
- Document findings for reference during work

**Example from code-change**:
```markdown
## Code Organization & Patterns

**What to discover:**
- File and directory organization
- Naming conventions
- Architectural patterns

**Why it matters:** Your changes must match existing style

**How to find out:**
- Search for similar functionality
- Review file organization
- Examine existing modules
```

**Anti-pattern**:
```markdown
❌ Run: grep -r "function.*Component" src/
```

**Better**:
```markdown
✓ Find examples of how components are structured in the codebase.
  Look for patterns in naming, organization, and implementation.
```

---

## Agent-Optimization for Expert Skills

Expert skills benefit from agent-optimization due to complexity. See [AGENTIC.md](../AGENTIC.md) - Use Read tool when optimizing complex expert skills (provides complete 25-principle framework with decision criteria).

**Most valuable for expert skills:** #1, #7, #8, #9, #13, #14, #19, #20, #23, #25

**When to apply:**
- Investigation protocols with multiple areas (3+)
- Comprehensive checklists (40+ items with validation)
- Multi-step workflows with dependencies
- Tool-heavy processes requiring specification

**Pattern examples:** See [patterns/README.md](../patterns/README.md) - Use Read tool when applying agent-optimization patterns (provides 20+ categorized examples: investigation protocols, checklists, workflows, role definitions)
- Category 1: Investigation Protocols (structured discovery)
- Category 2: Checklist Items (measurable validation)
- Category 6: Workflow & Dependencies (explicit relationships)
- Category 7: Role & Context (explicit scope)

**Complete framework:** [AGENTIC.md](../AGENTIC.md) (25 principles), [patterns/README.md](../patterns/README.md) (20+ examples)

---

### 2. Principles Over Prescriptions

**What it means**: Provide guiding principles and outcomes, not step-by-step commands.

**Why it matters**: Projects vary widely. Principles adapt; commands don't. Empowers Claude to use its capabilities optimally rather than following rigid scripts.

**How to implement**:
- State **what to achieve** (outcomes, goals, success criteria)
- Explain **why it's important** (rationale, context)
- Provide **checklists for verification** (measurable criteria)
- Avoid prescriptive "run this command" instructions
- Empower Claude to use tools and judgment

**Example from code-change (principles-based)**:
```markdown
## Testing Approach

**What to discover:**
- Testing framework and tools
- Test directory structure
- Test organization patterns
- Coverage requirements

Use your tools to find existing tests and understand the patterns.
```

**Anti-pattern (prescriptive)**:
```markdown
❌ Run these commands:
1. find . -name "*.test.js"
2. grep -r "describe(" test/
3. cat jest.config.js
```

**Why principles work better**:
- Adapts to different project structures (tests/ vs __tests__ vs spec/)
- Handles different test frameworks (Jest vs Mocha vs Vitest)
- Empowers Claude to investigate efficiently
- Doesn't assume specific file locations or naming

---

### 3. Checklist-Driven Quality

**What it means**: Comprehensive, organized checklists ensure nothing is forgotten.

**Why it matters**: Expert knowledge has many nuanced details. Checklists capture all requirements and verification steps.

**How to implement**:
- Create checklists with **40-100+ items** organized by category
- Make items **specific and verifiable** (not vague)
- Use **checkbox format** `[ ]` for tracking
- Organize by **category or phase** (Investigation, Quality, Testing, etc.)
- Include **context** ("Why it matters") when helpful

**Example from code-change**:
- Pre-Change Investigation: 20+ items
- Code Quality: 40+ items
- Testing: 30+ items
- Documentation: 25+ items
- CHANGELOG: 10+ items
- Post-Change Validation: 30+ items
- **Total: 155+ items** across 6 checklists

**Checklist characteristics**:
```markdown
✓ Specific: "Public functions have docstrings with params and return values"
✓ Verifiable: Can check yes/no
✓ Actionable: Clear what to do

❌ Vague: "Code is good quality"
❌ Subjective: "Code feels right"
```

---

### 4. Project-Aware Adaptation

**What it means**: Discover and follow project patterns rather than imposing your own.

**Why it matters**: Every project has established conventions. Changes must feel native to the project, not foreign.

**How to implement**:
- Include **investigation phase** to discover patterns
- Recognize **multiple valid approaches** (React/Vue/Angular, Jest/Pytest/JUnit)
- Adapt guidance to **discovered patterns** (don't assume)
- Handle **conflicting patterns** gracefully (old vs new code)
- Document **project-specific findings** in investigation report

**Example from code-change**:
```markdown
This skill adapts to your project:
- Detects React vs Vue vs Angular
- Follows Jest vs Pytest vs JUnit patterns
- Adapts to Keep a Changelog vs Conventional Changelog
- Matches Conventional Commits vs custom formats
- Identifies and follows your team's conventions
```

**How it adapts**:
- **Investigation discovers** what's actually used in the project
- **Principles remain constant** (quality, testing, documentation)
- **Implementation varies** based on what was discovered
- **Checklists adjust** (some items may not apply to all projects)

**Example adaptation**:
```markdown
Investigation finds:
- Test files in __tests__/ directory
- Test naming: *.test.tsx
- Test framework: Vitest (not Jest)
- Coverage requirement: 80%

Skill adapts:
- Creates tests in __tests__/
- Names files *.test.tsx
- Uses Vitest patterns and APIs
- Aims for 80% coverage
```

---

### 5. Outcome-Focused Guidance

**What it means**: Define what to achieve, not how to achieve it. Focus on goals and success criteria.

**Why it matters**: Empowers Claude to use its capabilities optimally. Different projects may need different paths to the same outcome.

**How to implement**:
- Frame as **goals and success criteria** (what good looks like)
- Provide **principles for achieving goals** (guiding philosophy)
- Include **quality criteria** (measurable standards)
- Let **implementation vary** based on context
- Focus on **"what" not "how"**

**Example (outcome-focused)**:
```markdown
✓ **Outcome**: Ensure all public APIs are documented
  **Success criteria**:
  - Every exported function has docstring
  - Parameters documented with types and purpose
  - Return values documented
  - Examples included for non-trivial APIs
```

**Anti-pattern (prescriptive)**:
```markdown
❌ **Steps**:
1. Add /** */ comment above function
2. Write @param for each parameter
3. Write @returns for return value
4. Write @example with code sample
```

**Why outcome-focused works**:
- Adapts to documentation style (JSDoc vs docstrings vs XML docs)
- Allows Claude to determine best approach
- Focuses on quality of result, not rigidity of process
- Works across languages and frameworks

---

### 6. Comprehensive Documentation

**What it means**: Rich documentation with multiple entry points and progressive disclosure.

**Why it matters**: Complex domains need extensive guidance. Different users need different depth.

**How to implement**:
- Split into **multiple files** (@INVESTIGATION.md, @CHECKLISTS.md, @EXAMPLES.md)
- Use **@ references** for organization (keeps main file concise)
- Provide **workflow examples** (not language-specific code)
- Include **multiple scenarios** (feature implementation, bug fix, refactor)
- Document **edge cases and gotchas** (common pitfalls)
- Offer **progressive disclosure** (quick reference → detailed sections)

**Example from code-change file structure**:
```
code-change/
├── SKILL.md (234 lines) - Orchestrator with @ references
├── INVESTIGATION.md (387 lines) - Investigation protocols
├── CHECKLISTS.md (402 lines) - 6 comprehensive checklists
├── EXAMPLES.md (630 lines) - Workflow examples
└── templates/ - Reusable templates
```

**Documentation organization**:
- **SKILL.md**: Overview, workflow, key principles, @ references to details
- **INVESTIGATION.md**: Deep dive into investigation protocols
- **CHECKLISTS.md**: All verification checklists organized
- **EXAMPLES.md**: Concrete workflow examples
- **templates/**: Reusable formats (CHANGELOG, commit messages)

**Benefits**:
- Main file stays concise and readable
- Users can drill down into areas they need
- Total comprehensive coverage without overwhelming
- Easy to maintain and update specific sections

---

### 7. Scalable Complexity

**What it means**: Guidance scales from simple to comprehensive based on need.

**Why it matters**: Different tasks need different depth. Bug fix needs less than major feature.

**How to implement**:
- **Progressive disclosure**: Start simple, provide paths to detailed info
- **Quick reference + detailed sections**: Summary up front, details via @references
- **Multiple examples**: Simple → moderate → complex
- **Conditional checklists**: "Applies if..." conditions
- **Levels indicated**: Beginner, intermediate, advanced (when relevant)

**Example structure**:
```markdown
## Quick Start (Simple)
1. Investigate project
2. Make changes
3. Test
4. Document
5. Validate

## Detailed Workflow (Comprehensive)
For full details on each step, see:
- @INVESTIGATION.md for investigation protocols
- @CHECKLISTS.md for quality checklists
- @EXAMPLES.md for complete examples
```

---

## Expert Skill Checklist

Use this comprehensive checklist when creating or validating an expert skill.

### Investigation & Research (15 items)

- [ ] **Identifies what to investigate** - Specifies outcomes to discover, not commands to run
- [ ] **Provides investigation principles** - Guidance and philosophy, not rigid scripts
- [ ] **Includes "Why it matters"** - Context for each investigation area
- [ ] **Offers "How to find out" suggestions** - Helpful pointers, not prescriptive commands
- [ ] **Avoids prescriptive bash commands** - Principles-based, not command-based
- [ ] **Encourages using judgment and tools** - Empowers Claude's capabilities
- [ ] **Documents findings format** - Investigation report template or structure
- [ ] **Looks for similar functionality** - Pattern discovery through existing examples
- [ ] **Identifies consistency patterns** - Recognizes what repeats across codebase
- [ ] **Notes project-specific conventions** - Captures unique project patterns
- [ ] **Handles conflicting patterns** - Gracefully deals with old vs new code
- [ ] **Scales investigation depth** - Quick to thorough based on need
- [ ] **Provides red flags** - Warns about common pitfalls to watch for
- [ ] **Adapts to project type** - Different approach for library vs app vs CLI
- [ ] **Creates investigation checklist** - Domain-specific items to discover

### Domain Knowledge (15 items)

- [ ] **Comprehensive domain coverage** - Nothing major missing from expertise area
- [ ] **Concrete techniques named** - Specific tools, frameworks, patterns (not vague)
- [ ] **Real-world examples included** - Practical scenarios, not toy examples
- [ ] **Handles multiple frameworks** - Works across React/Vue/Angular, Jest/Pytest, etc.
- [ ] **Provides architectural guidance** - Patterns, anti-patterns, design principles
- [ ] **Best practices with rationale** - Explains "why" not just "what"
- [ ] **Covers edge cases** - Gotchas and unusual scenarios documented
- [ ] **References authoritative sources** - Cites established best practices (2025+)
- [ ] **Explains trade-offs** - When to use what, pros and cons
- [ ] **Decision-making frameworks** - How to choose between options
- [ ] **Troubleshooting guidance** - Common issues and solutions
- [ ] **Addresses misconceptions** - Corrects common errors and myths
- [ ] **Scales beginner to advanced** - Accessible entry points, deep details available
- [ ] **Technology/language agnostic** - Where possible, principles apply broadly
- [ ] **Current practices** - Reflects 2025 best practices, not outdated approaches

### Adaptability & Project-Awareness (15 items)

- [ ] **Adapts to project contexts** - Different setups handled gracefully
- [ ] **Discovers existing patterns** - Investigation-driven, not assumption-based
- [ ] **Avoids one-size-fits-all** - Flexible, not rigid
- [ ] **Identifies project type** - Library vs app vs CLI vs service vs framework
- [ ] **Recognizes framework specifics** - React vs Vue, Django vs Flask, etc.
- [ ] **Follows discovered conventions** - Project's way, not imposed preferences
- [ ] **Adapts checklists to project** - Not all items apply to all projects
- [ ] **Handles multiple architectures** - MVC, MVVM, Clean Architecture, microservices
- [ ] **Works across tech stacks** - Python, JavaScript, Java, Go, etc.
- [ ] **Respects team conventions** - Prioritizes project patterns over defaults
- [ ] **Integrates with workflows** - CI/CD, git flow, review processes
- [ ] **Scales complexity** appropriately - Simple project = simple approach
- [ ] **Recognizes when to ask** - Versus when to assume based on evidence
- [ ] **Handles legacy vs modern** - Old codebases vs cutting-edge
- [ ] **Adapts to team maturity** - Beginners vs experienced teams

### Documentation & Examples (10 items)

- [ ] **Workflow examples** - Process examples, not language-specific code
- [ ] **Multiple scenarios** - Feature, bug fix, refactor, breaking change, etc.
- [ ] **Comprehensive checklists** - 40+ items ensuring nothing forgotten
- [ ] **Before/after patterns** - Shows improvement and quality levels
- [ ] **Progressive examples** - Simple → moderate → complex progression
- [ ] **Real-world cases** - Practical examples, not contrived scenarios
- [ ] **Edge cases documented** - Unusual situations and how to handle
- [ ] **Anti-patterns shown** - What NOT to do and why
- [ ] **Cross-references work** - All @ references point to existing files
- [ ] **Templates provided** - When appropriate (CHANGELOG, reports, etc.)

### Agent-Optimization (10 items)

- [ ] **Every step executable** - No vague directives; specific, actionable, measurable (#7)
- [ ] **No ambiguity** - All terms defined; subjective words eliminated; quantified where possible (#9)
- [ ] **Imperative voice** - Direct commands ("Add tests") not suggestions ("Consider tests") (#13)
- [ ] **Positive + negative examples** - Show what to do AND what not to do with explanations (#14)
- [ ] **Dependencies explicit** - Prerequisites tagged; execution order clear; blocks defined (#8)
- [ ] **Validation criteria measurable** - Specific acceptance criteria, not subjective quality (#10)
- [ ] **Structured formats where appropriate** - XML for complex protocols (3+ steps/areas) (#1)
- [ ] **Output formats specified** - Templates or schemas for investigation reports, etc. (#2)
- [ ] **Tool usage documented** - When/when-not/how for tools used in skill (#20)
- [ ] **Role explicitly defined** - Identity, purpose, scope, in/out-of-scope clear (#23)

---

## File Structure for Expert Skills

See [UNIVERSAL.md](../UNIVERSAL.md) - Use Read tool when designing file structure (File Structure Patterns section provides 6 patterns: minimal/simple/template-based/script-powered/complex/sub-folder with token counts and decision criteria).

**Expert-specific variations:**

**Minimal** (150-300 lines): Single SKILL.md with principles (5-7), checklist (20-40 items), inline examples

**Moderate** (300-600 lines): SKILL.md + EXAMPLES.md + REFERENCE.md
- Example: agent-builder

**Comprehensive** (600-2000+ lines): SKILL.md (orchestrator) + INVESTIGATION.md + CHECKLISTS.md + EXAMPLES.md + REFERENCE.md + templates/
- Example: code-change (1,764 lines across 7 files)

---

## Description Patterns for Expert Skills

See [UNIVERSAL.md](../UNIVERSAL.md) - Use Read tool when writing descriptions (Description Engineering section provides WHAT + WHEN formula, length guidelines, keyword optimization, and 10+ examples).

**Expert-specific adaptations:**
- Start with expert language: "Expert at [domain]", "Guides [process]", "Comprehensive [domain] knowledge"
- Emphasize key capabilities that make this expert-level
- Include 3-5 trigger scenarios
- Length: 100-500 chars (ideal: 200-400), same as all skill types

**Examples:**

**code-change** (185 chars):
```yaml
description: Guides high-quality code changes with project investigation, quality checklists, testing, and documentation. Use when implementing features, fixing bugs, refactoring, or updating code.
```
Expert language ("Guides"), 4 key capabilities, 4 trigger scenarios, 185 chars

**agent-builder** (247 chars):
```yaml
description: Expert at creating Claude Code agents with YAML frontmatter, system prompts, and optimal configurations. Use when building new agents, writing agent.md files, designing specialized agents, or optimizing agent descriptions for auto-discovery.
```
Expert language ("Expert at creating"), 3 key capabilities, 4 trigger scenarios, 247 chars

---

## Creating an Expert Skill - Workflow

Follow this workflow when creating a new expert skill.

### 1. Identify Domain

**Questions to answer**:
- What expertise area? (React architecture, API design, testing strategies, security)
- What problem does this solve?
- Who benefits from this skill?
- What makes this "expert" level (vs simple guidance)?

**Output**: Clear domain statement - "Expert skill for [domain] that helps with [problems]"

---

### 2. Define Investigation Needs

**Questions to answer**:
- What must be discovered before taking action?
- What varies across projects in this domain?
- What patterns need to be identified?
- What conventions must be followed?

**Output**: Investigation protocol outline - areas to investigate and why they matter

---

### 3. Extract Principles

**Questions to answer**:
- What are the 5-7 guiding principles for this domain?
- What philosophy guides good work in this area?
- What trade-offs must be considered?
- What makes work in this domain "high quality"?

**Output**: 5-7 core principles with rationale and implementation guidance

---

### 4. Build Checklists

**Questions to answer**:
- What must be verified for quality?
- What can be forgotten or overlooked?
- How to organize items (by phase, category, type)?
- How many items needed (40-100+ for comprehensive)?

**Output**: Comprehensive checklists organized by category with specific, verifiable items

---

### 5. Gather Examples

**Questions to answer**:
- What workflow examples illustrate principles?
- What scenarios should be covered (simple, moderate, complex)?
- What anti-patterns should be shown?
- What edge cases need documentation?

**Output**: Workflow examples (language-agnostic) showing principles in action

---

### 6. Handle Adaptability

**Questions to answer**:
- How does this adapt to different projects?
- What frameworks/approaches exist (React/Vue, Jest/Pytest)?
- What can be discovered via investigation?
- What project-specific conventions matter?

**Output**: Adaptation strategy documenting how skill adjusts to different contexts

---

### 7. Organize Files

**Questions to answer**:
- How complex is this domain?
- Minimal (150-300 lines), Moderate (300-600 lines), or Comprehensive (600+ lines)?
- What content goes in each file?
- What @ references are needed?

**Output**: File structure decision and content organization plan

---

### 8. Write Description

**Questions to answer**:
- What expert language to use (Expert at, Guides, Provides)?
- What key capabilities define this?
- What trigger scenarios (3-5)?
- Length target (100-500 chars, ideal: 200-400)?

**Output**: YAML description following expert skill formula

---

### 9. Validate

**Questions to answer**:
- Does it follow all 7 core principles?
- Does checklist have 40+ items?
- Are examples comprehensive?
- Do @ references work?

**Output**: Validated skill passing expert skill checklist and agent audit (see [validation/README.md](../validation/README.md) - Use Read tool for comprehensive validation checklist and agent audit process)

---

## Examples of Expert Skills

### code-change

**Domain**: High-quality code changes across any language/framework

**Key Features**:
- Investigation protocols (387-line INVESTIGATION.md)
- 6 comprehensive checklists (155+ items total)
- Workflow examples for different scenarios
- Project-aware adaptation (React vs Vue, Jest vs Pytest)

**Files**: 7 files, 1,764 lines total

**What to learn from it**:
- Excellent investigation protocols ("what to discover" not "commands to run")
- Comprehensive checklists organized by phase
- Outcome-focused guidance throughout
- Strong project-awareness

---

### agent-builder

**Domain**: Claude Code agent creation and optimization

**Key Features**:
- Agent archetypes (Technical Specialist, Domain Expert, QA, Utility)
- Description engineering (most important section)
- System prompt architecture guidance
- Templates for different archetypes

**Files**: 4 files with templates directory

**What to learn from it**:
- Clear archetype patterns for adaptation
- Focus on description as "THE MOST IMPORTANT" part
- Interactive creation workflow
- Template-driven approach

---

### claude-skill-builder (this skill)

**Domain**: Claude Code skill creation with type-specific guidance

**Key Features**:
- Type-specific guidance (expert, CLI, writer)
- Description formula (WHAT + WHEN)
- Token optimization techniques
- File structure patterns

**Files**: Multiple files organized by type with @ references

**What to learn from it**:
- Meta-skill approach (skill for creating skills)
- Type-based organization
- Progressive disclosure through @ references
- Comprehensive validation protocol

---

## Common Pitfalls

### ❌ What to Avoid

**Too prescriptive**:
```markdown
❌ Run: grep -r "pattern" src/
❌ Execute: npm test --coverage
❌ Step 1: Open file X
```

**Not project-aware**:
```markdown
❌ "Use React Testing Library" (assumes React)
❌ "Create tests in __tests__/" (assumes structure)
❌ "Follow Keep a Changelog" (assumes format)
```

**Incomplete checklists**:
```markdown
❌ Only 10-15 items (not comprehensive)
❌ Vague items: "Code is good"
❌ No organization (flat list)
```

**Vague guidance**:
```markdown
❌ "Do good work"
❌ "Make it quality"
❌ "Follow best practices"
```

**No investigation**:
```markdown
❌ Jumps straight to solution
❌ Assumes project structure
❌ Ignores existing patterns
```

**Code-specific examples**:
```markdown
❌ TypeScript-specific examples in general skill
❌ React patterns for framework-agnostic guidance
```

**Monolithic file**:
```markdown
❌ Everything in SKILL.md (800+ lines)
❌ No @ references or organization
```

---

### ✓ What to Do Instead

**Principles-based**:
```markdown
✓ Find examples of similar functionality in the codebase
✓ Discover how tests are organized in this project
✓ Identify the patterns used for error handling
```

**Investigation-first**:
```markdown
✓ Step 1: INVESTIGATE PROJECT
   - Understand technology stack
   - Discover existing patterns
   - Document findings
```

**Comprehensive checklists**:
```markdown
✓ 40-100+ items organized by category
✓ Specific: "Public functions have docstrings"
✓ Verifiable: Can check yes/no
```

**Outcome-focused**:
```markdown
✓ "Ensure comprehensive test coverage"
  Success criteria:
  - All new code paths tested
  - Coverage meets project standards
  - Tests pass consistently
```

**Project-aware**:
```markdown
✓ "This skill adapts to your project:
   - Detects React vs Vue vs Angular
   - Follows Jest vs Pytest patterns"
```

**Well-organized**:
```markdown
✓ SKILL.md (orchestrator) with @ references
✓ INVESTIGATION.md for protocols
✓ CHECKLISTS.md for verification
✓ EXAMPLES.md for workflows
```

---

## See Also

**Universal principles** (apply to all skills):
- [UNIVERSAL.md](../UNIVERSAL.md) - Use Read tool for YAML frontmatter syntax, description formula, token optimization techniques, and @ reference guidance

**Other skill types**:
- [cli/README.md](../cli/README.md) - Use Read tool when creating syntax/configuration-focused skills
- [writer/README.md](../writer/README.md) - Use Read tool when creating documentation/content-focused skills

**Validation**:
- [validation/README.md](../validation/README.md) - Use Read tool for post-creation validation checklist and agent audit process

**Reference**:
- [reference/README.md](../reference/README.md) - Use Read tool for troubleshooting and advanced topics

---

**You're ready to create expert skills that provide comprehensive domain knowledge, adapt to projects, and ensure quality through investigation and checklists!**
