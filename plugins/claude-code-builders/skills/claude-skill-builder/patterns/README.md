# Agent-Optimization Pattern Library

20+ before/after examples showing human-optimized vs agent-optimized instruction design.

## Pattern Categories

This library is organized into 10 categories, each demonstrating specific agent-optimization transformations:

### 1. Investigation Protocols
[Investigation Protocols](01-investigation-protocols.md)

Shows how to structure investigation-driven workflows with explicit objectives, success criteria, and output formats.

**Patterns:** Basic Investigation Protocol, Investigation Output Format

### 2. Checklist Items
[Checklist Items](02-checklist-items.md)

Demonstrates transforming vague checklist items into specific, measurable, validated criteria.

**Patterns:** Simple Checklist Item, Structured Validation Checklist, Conditional Checklist

### 3. Tool Specifications
[Tool Specifications](03-tool-specifications.md)

Examples of comprehensive tool documentation with when/when-not/how guidance.

**Patterns:** Basic Tool Usage, Complete Tool Documentation

### 4. Validation & Acceptance Criteria
[Validation & Acceptance Criteria](04-validation-criteria.md)

Shows transformation from subjective quality statements to measurable, quantitative criteria.

**Patterns:** Vague vs Specific Validation, Quantitative vs Qualitative

### 5. Examples Sections
[Examples Sections](05-examples-sections.md)

Demonstrates providing positive AND negative examples with explicit why-good/why-bad explanations.

**Patterns:** Examples with Positive + Negative, Sufficient Distinct Instances

### 6. Workflow & Dependencies
[Workflow & Dependencies](06-workflow-dependencies.md)

Shows how to make execution order, dependencies, and parallel/sequential relationships explicit.

**Patterns:** Implicit vs Explicit Dependencies, Parallel vs Sequential

### 7. Role & Context
[Role & Context](07-role-context.md)

Demonstrates explicit role definition with identity, purpose, scope, and contextual grounding.

**Patterns:** Vague vs Explicit Role, Contextual Grounding

### 8. Content Templates
[Content Templates](08-content-templates.md)

Shows exact structure specifications for investigation reports, API documentation, and other outputs.

**Patterns:** Investigation Report Template, API Documentation Template

### 9. Anti-Patterns
[Anti-Patterns](09-anti-patterns.md)

Catalogs common mistakes with examples, why they're problematic, impact, and fixes.

**Patterns:** Common Anti-Patterns, Before/After Comparison

### 10. Goal Specification
[Goal Specification](10-goal-specification.md)

Demonstrates hierarchical goal structures with measurable outcomes and success criteria.

**Patterns:** Vague vs Goal-Oriented

### 11. Description Patterns (WHAT + WHEN + Be Pushy)
[Description Patterns](11-description-patterns.md)

Shows how to write effective skill descriptions using Anthropic's official WHAT + WHEN formula with "be pushy" edge cases for reliable auto-discovery.

**Patterns:** Direct capability statements, trigger expansion, undertrigger prevention

### 12. Show Not Tell Pattern (Project-Scoped Skills)
[Show Not Tell Pattern](12-show-not-tell-pattern.md)

Demonstrates referencing actual project files instead of duplicating code inline. Critical for project-scoped skills.

**Patterns:** File reference tables, "Read When" guidance, scope-appropriate content strategy

---

## How to Use This Library

**When creating agent-optimized skills:**

1. **Identify complexity** - Simple/Structured/Highly Structured (see [AGENTIC.md](../AGENTIC.md))
2. **Select applicable patterns** - Based on skill needs
3. **Apply transformations** - Convert human → agent format using pattern examples
4. **Validate** - Check against agent-optimization principles
5. **Test** - Verify agent can execute without ambiguity

**Pattern selection by skill type:**
- **Expert skills:** Patterns 1-5, 12-15, 20 (investigation, checklists, dependencies)
- **CLI skills:** Patterns 6-7, 8-9, 16-17 (tools, validation, templates)
- **Writer skills:** Patterns 10-11, 16-17, 18-19 (examples, templates, before/after)

---

## Complete Framework

- **[AGENTIC.md](../AGENTIC.md)** - 25 agent-optimization principles and decision framework
- **This directory** - 20+ concrete before/after transformation examples
- **[validation/README.md](../validation/README.md)** - Agent-optimization validation checklist

---

## Summary: Pattern Categories

1. **Investigation Protocols** - Structured discovery with explicit criteria
2. **Checklist Items** - Specific, measurable, validated
3. **Tool Specifications** - Complete documentation (when/how/examples)
4. **Validation & Criteria** - Measurable, prioritized, verifiable
5. **Examples Sections** - Positive + negative with explanations
6. **Workflow & Dependencies** - Explicit order and relationships
7. **Role & Context** - Identity, scope, environment
8. **Content Templates** - Exact structure for outputs
9. **Anti-Patterns** - What NOT to do with fixes
10. **Goal Specification** - Hierarchical, measurable objectives
11. **Description Patterns** - WHAT + WHEN + Be Pushy for reliable auto-discovery
12. **Show Not Tell** - File references for project-scoped skills
