# Agent-Optimized Skill Design

## Critical Insight

**Skills are consumed by AI agents, not humans.** This means instruction design benefits from more structure and explicitness than typical human documentation — but models are capable reasoners, not rote instruction followers.

Modern LLMs are smart. They have good theory of mind and can generalize from understood principles. The goal is to give them enough structure to execute reliably while explaining *why* things matter so they can adapt to novel situations.

---

## The Balanced Approach

Structure and explicitness help agents execute consistently, but over-constraining with rigid MUSTs and heavy XML can be counterproductive. Anthropic's own best-performing skills use conversational markdown with clear organization — no XML, no rigid contracts.

**The sweet spot:** Use structure when complexity demands it (multi-step protocols, critical operations). Use natural language with clear reasoning for everything else. Match the level of formality to the task's fragility.

---

## Agent vs Human Instructions

Agents benefit from more structure than human readers, but the difference is a spectrum, not a binary. Anthropic's own skill-creator — their most sophisticated skill — uses conversational markdown throughout.

| Aspect | Human Documentation | Agent-Friendly | Over-Engineered |
|--------|---------------------|----------------|-----------------|
| **Ambiguity** | Tolerable | Minimize, explain why | Rigid contracts for everything |
| **Structure** | Paragraphs | Clear headings, numbered steps | XML tags for simple lists |
| **Examples** | Illustrative | Positive + negative patterns | Exhaustive case coverage |
| **Dependencies** | Implicit | State when order matters | Formal dependency graphs |
| **Instructions** | "Consider X" | "Do X because Y" | "MUST ALWAYS X" (yellow flag) |
| **Validation** | Subjective | Specific criteria where measurable | Formal acceptance criteria per step |

**Target the middle column.** Move right only for mission-critical operations.

---

## The 25 Agent-Optimization Principles

Organized into 5 categories based on 2025 agentic AI research.

### Category 1: Structure & Format

**1. Use Structured Formats When Complexity Warrants It**
- Complex protocols with many steps → consider XML tags or numbered sections
- Plain markdown with clear headings works for most skills — Anthropic's own complex skills use zero XML
- Reserve XML for data structures (schemas, role definitions) not process flows

**2. Explicit Format Specification**
- Specify output structure (templates, schemas)
- No ambiguous outputs
- Enables validation

**3. Treat as API Design Not Conversation**
- Define inputs, outputs, pre/post conditions
- Contracts not suggestions
- Specify error handling

**4. Organize with Clear Hierarchy**
- Group related items with headings, nested lists, or tags
- Clear parent-child relationships
- Markdown headings and indentation often suffice; XML is one option, not the default

**5. Use Markdown Tables for Specifications**
- Parameters, comparisons, criteria
- Structured at a glance
- Better than paragraphs

**6. Separate Instructions from Examples**
- Clear sections for each
- Aids pattern recognition
- Instructions → Examples → Anti-patterns

---

### Category 2: Explicitness & Clarity

**7. Make Every Step Executable** ⭐ ALWAYS APPLY
- No vague directives ("ensure quality")
- Specific, actionable, measurable
- Example: "Verify each function has docstring with params, returns, example"

**8. State Dependencies Explicitly**
- Prerequisites tagged
- Execution order specified
- What blocks what

**9. Avoid Ambiguity and Vagueness** ⭐ ALWAYS APPLY
- No subjective terms ("good", "appropriate")
- Quantify when possible
- Define ambiguous terms

**10. Provide Comprehensive Acceptance Criteria**
- How to know when done
- Specific, measurable, verifiable
- Prioritized (critical, high, medium, low)

**11. Specify Quantitative Thresholds**
- "≥80% coverage" not "good coverage"
- "3-5 examples" not "sufficient examples"
- Numbers over adjectives

**12. Define Expected Behavior for All Cases**
- Normal case
- Edge cases
- Error conditions
- Ambiguity resolution

**13. Use Imperative Voice with Rationale** ⭐ ALWAYS APPLY
- "Add tests" not "Consider adding tests"
- Pair actions with reasoning: "Add tests because untested helpers break silently"
- If you find yourself writing ALWAYS or NEVER in all caps, that's a yellow flag — reframe with reasoning instead

---

### Category 3: Examples & Patterns

**14. Provide Both Positive and Negative Examples** ⭐ BEST PRACTICE
- LLMs learn from patterns
- Show what to do AND what not to do
- Explain why good/bad

**15. Show Sufficient Distinct Instances**
- 3-5 examples minimum
- Vary scenarios (simple, moderate, complex)
- Demonstrate variations

**16. Use Before/After Comparisons**
- Shows transformation clearly
- Teaching tool
- Demonstrates improvement

**17. Provide Template Patterns**
- Exact format expected
- Reports, schemas, code structures
- Copy-able templates

**18. Include Anti-Patterns**
- Common mistakes catalog
- Why problematic
- Correct alternative

---

### Category 4: Process & Workflow

**19. Define Iterative Frameworks**
- Think → Act → Observe cycles
- Support investigation → implementation → validation
- Enable iteration

**20. Specify Tool Usage Explicitly**
- When to use, when NOT to use
- Syntax and parameters
- Examples of usage

**21. Make Execution Order Explicit**
- Sequential vs parallel
- Step numbers or IDs
- Dependencies tagged

**22. Specify Parallel vs Sequential Execution**
- What can run concurrently
- What must be sequential
- Optimize agent performance

---

### Category 5: Role & Context

**23. Explicit Role Definition** ⭐ ALWAYS APPLY
- Identity, purpose, scope
- In-scope vs out-of-scope
- Expertise areas

**24. Contextual Grounding**
- Environment specs
- Assumptions stated
- Constraints documented
- Current date/version

**25. Goal-Oriented Specification**
- Primary goals
- Sub-goals (hierarchy)
- Success criteria
- Measurable outcomes

---

## Decision Framework: When to Use What Level

### Simple Format (Current Default)

**Use when:**
- Skill < 200 lines
- Instructions inherently clear
- Few dependencies
- Simple checklists
- No complex protocols

**Characteristics:**
- Markdown prose
- Bullet lists
- Simple examples
- Human-friendly

**Example:** Basic conventions skill, simple style guide

---

### Structured Format (Agent-Optimized)

**Use when:**
- Skill 200-600 lines
- Complex multi-step protocols
- Dependencies between steps
- Validation criteria needed
- Tool usage specifications

**Characteristics:**
- XML tags for complex protocols
- Explicit validation criteria
- Dependencies documented
- Positive + negative examples
- Format specifications

**Example:** Investigation protocols, implementation workflows

**Techniques:**
```xml
<protocol name="investigation">
  <objective>Clear goal</objective>
  <steps>
    <step id="1">
      <description>What to do</description>
      <acceptance-criteria>
        <criterion>Specific measurable criterion</criterion>
      </acceptance-criteria>
    </step>
  </steps>
  <dependencies>
    <prerequisite>What must be true first</prerequisite>
  </dependencies>
</protocol>
```

---

### Highly Structured Format (Mission-Critical)

**Use when:**
- Skill 600+ lines
- Mission-critical execution (can't fail)
- Many edge cases
- Complex state management
- Integration with automated systems

**Characteristics:**
- Extensive XML structuring
- Formal acceptance criteria (every step)
- Comprehensive error handling
- State transition specs
- Full tool usage contracts
- API-like design

**Example:** Production deployment, security audits, compliance checks

---

## Applying to Skill Types

### Expert Skills

Agent-optimization particularly valuable for:
- **Investigation protocols** (multi-area, complex)
- **Comprehensive checklists** (40-100+ items with validation)
- **Multi-step workflows** (dependencies critical)
- **Tool-heavy processes** (specification needed)

**Recommended principles:** 1, 2, 7, 8, 9, 10, 14, 19, 20, 23, 25

**Example transformation:**
[Investigation protocols patterns](patterns/01-investigation-protocols.md)

---

### CLI Skills

Agent-optimization particularly valuable for:
- **Syntax specifications** (exact format critical)
- **Configuration options** (all parameters documented)
- **Validation rules** (when syntax valid/invalid)
- **Tool documentation** (when/how to use)

**Recommended principles:** 2, 3, 5, 7, 9, 11, 17, 20, 23, 24

**Example transformation:**
[Tool specification patterns](patterns/03-tool-specifications.md)

---

### Writer Skills

Agent-optimization particularly valuable for:
- **Content structure templates** (exact sections expected)
- **Audience specifications** (explicit characteristics)
- **Tone and style criteria** (measurable attributes)
- **Quality checklists** (specific verification)

**Recommended principles:** 2, 7, 10, 11, 14, 17, 18, 23

**Example transformation:**
[Content template patterns](patterns/08-content-templates.md)

---

## Quick Reference: Principles by Priority

### ⭐ Always Apply (Universal)
- **#7:** Make Every Step Executable
- **#9:** Avoid Ambiguity and Vagueness
- **#13:** Use Imperative Voice
- **#23:** Explicit Role Definition

### Apply for Complex Skills (200+ lines)
- **#1:** Use Structured Formats (XML)
- **#2:** Explicit Format Specification
- **#4:** Hierarchical Tags
- **#8:** State Dependencies
- **#19:** Iterative Frameworks
- **#20:** Specify Tool Usage

### Best Practice (All Skills)
- **#14:** Positive + Negative Examples
- **#15:** Sufficient Distinct Instances
- **#16:** Before/After Comparisons
- **#24:** Contextual Grounding
- **#25:** Goal-Oriented Specification

### Mission-Critical Only
- **#3:** API Design (full contract)
- **#10:** Comprehensive Acceptance Criteria (every step)
- **#11:** Quantitative Thresholds (all measures)
- **#12:** Define All Cases (normal, edge, error)
- **#21:** Explicit Execution Order
- **#22:** Parallel vs Sequential

---

## Implementation Checklist

When creating agent-optimized skill:

### Planning
- [ ] Determine appropriate complexity level (simple/structured/highly structured)
- [ ] Identify which of 25 principles apply
- [ ] Plan file structure (SKILL.md + supporting files)

### Structure
- [ ] Use XML tags for complex protocols (#1)
- [ ] Organize hierarchically (#4)
- [ ] Separate instructions from examples (#6)

### Explicitness
- [ ] Make every step executable (#7)
- [ ] Eliminate all ambiguity (#9)
- [ ] Use imperative voice throughout (#13)
- [ ] State all dependencies explicitly (#8)
- [ ] Define acceptance criteria (#10)

### Examples
- [ ] Provide positive examples (#14)
- [ ] Provide negative examples (#14)
- [ ] Include 3-5 distinct instances (#15)
- [ ] Show before/after where helpful (#16)
- [ ] Include anti-patterns (#18)

### Process
- [ ] Define iterative workflow if applicable (#19)
- [ ] Specify tool usage explicitly (#20)
- [ ] Make execution order clear (#21)

### Context
- [ ] Define role explicitly (#23)
- [ ] Provide contextual grounding (#24)
- [ ] Specify goals and success criteria (#25)

### Validation
- [ ] All format specifications provided (#2)
- [ ] Output templates included (#17)
- [ ] Quantitative thresholds specified (#11)
- [ ] All cases covered (normal, edge, error) (#12)

---

## Pattern Library

For 20+ concrete before/after examples, see **[patterns/README.md](patterns/README.md)**

Categories:
1. Investigation Protocols
2. Checklist Items
3. Tool Specifications
4. Validation Criteria
5. Examples Sections
6. Workflow Definitions
7. Role Definitions
8. Content Templates

---

## Detailed Principles Reference

For comprehensive documentation of all 25 principles with research citations, rationale, implementation guidance, and trade-offs:

See **scratch/skill-builder-agentic/agentic-principles.md** (not loaded by default; reference for deep understanding)

---

## Validation

When validating agent-optimized skills, check:

See **[validation/README.md](validation/README.md)** for agent-optimization validation checklist (30+ items)

Key validation areas:
- Structure appropriate for complexity
- Explicitness verified (no ambiguity)
- Examples include positive + negative
- Dependencies explicit
- Tool usage specified
- Acceptance criteria provided
- Format specifications included

---

## Benefits of Agent-Optimization

### Reliability
- Agents execute more consistently
- Fewer interpretation errors
- Reduced ambiguity-caused failures

### Clarity
- Unambiguous instructions
- Clear expectations
- Explicit success criteria

### Executability
- Every step is actionable
- No gaps in information
- Complete specifications

### Quality
- Validation criteria clear
- Standards measurable
- Consistency across executions

### Maintainability
- Structure makes updates easier
- Clear organization
- Well-documented rationale

---

## Common Mistakes to Avoid

### ❌ Over-Engineering Simple Skills
Don't use extensive XML for a 50-line conventions skill.

**Fix:** Use decision framework to choose appropriate level.

### ❌ Vague Instructions
"Ensure code quality" tells agent nothing.

**Fix:** Specific criteria: "Verify linter passes, coverage ≥80%, docstrings on all public functions"

### ❌ Missing Negative Examples
Only showing good examples leaves agents guessing what's bad.

**Fix:** Always include what NOT to do with explanation.

### ❌ Implicit Dependencies
Assuming agent knows what must happen first.

**Fix:** Tag all prerequisites and execution order explicitly.

### ❌ Ambiguous Validation
"Code should be good" is unmeasurable.

**Fix:** Specific acceptance criteria with measurable standards.

---

## Examples in This Repository

Several skills demonstrate agent-optimization principles:

**code-change**: Investigation protocols, comprehensive checklists
**agent-builder**: Explicit role definition, template patterns
**claude-skill-builder**: Structured organization, before/after examples

Study these for real-world application of principles.

---

## Getting Started

1. **Understand the paradigm shift**: Agents ≠ humans
2. **Review the 25 principles**: Know what's possible
3. **Use decision framework**: Choose appropriate complexity
4. **Start with always-apply principles**: #7, #9, #13, #23
5. **Add structure as needed**: Based on complexity
6. **Validate thoroughly**: Use agent-optimization checklist

---

## Further Reading

**Research synthesis:** scratch/skill-builder-agentic/research-findings.md
**Detailed principles:** scratch/skill-builder-agentic/agentic-principles.md
**Pattern library:** [patterns/README.md](patterns/README.md)
**Validation:** [validation/README.md](validation/README.md)
**Architecture:** scratch/skill-builder-agentic/architecture.md

---

## Summary

Agent-optimization transforms skills from human documentation to agent-executable instructions through:

- **Structure** (XML, hierarchies, organization)
- **Explicitness** (no ambiguity, specific criteria)
- **Examples** (positive + negative patterns)
- **Process** (workflows, tools, execution order)
- **Context** (role, goals, environment)

Apply based on complexity. Prioritize value over verbosity. Optimize for agent execution reliability.

**Key principle:** Write for "eager, helpful, but inexperienced and unworldly" agents who need explicit, structured guidance.
