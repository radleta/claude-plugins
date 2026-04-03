# Skill Types: Detailed Descriptions

This document contains detailed descriptions of each skill type. Load this when you need to understand the characteristics of a specific type or help users choose between types.

---

## 1. Expert Skills

**What they are**: Domain knowledge and investigation-driven skills that guide through principles-based, checklist-driven approaches.

**Examples**: agent-builder, code-change, claude-skill-builder (itself)

**When to create**:
- Need deep domain expertise (React architecture, testing strategies, etc.)
- Investigation required before action
- Project patterns must be discovered and followed
- Comprehensive checklists ensure quality

**Key characteristics**:
- Investigation-first principles
- Principles over prescriptions approach
- Comprehensive checklists (40-55 items)
- Project-aware adaptation strategies
- Outcome-focused guidance

**See expert/README.md** - Use Read tool on expert/README.md when creating expert skills for:
- Investigation-first principles
- Principles over prescriptions approach
- Comprehensive checklists (40-55 items)
- Project-aware adaptation strategies
- Outcome-focused guidance
- File structure patterns (minimal/moderate/comprehensive)
- Description patterns for expert skills
- Creation workflow
- Examples: code-change, agent-builder

**Template**: Use Read tool on expert/template.md for scaffolding expert skill structure

---

## 2. CLI/Tool Skills

**What they are**: Syntax and configuration-focused skills that document file formats, command structures, and technical specifications.

**Examples**: claude-command-builder, claude-md-manager

**When to create**:
- Document file formats or command syntax
- Provide configuration options and validation
- Need comprehensive troubleshooting
- Technical precision is critical

**Key characteristics**:
- Syntax accuracy requirements
- Validation-focused approach
- Template-driven development
- Configuration guidance (options, trade-offs)
- Troubleshooting patterns

**See cli/README.md** - Use Read tool on cli/README.md when creating CLI/tool skills for:
- Syntax accuracy requirements
- Validation-focused approach
- Template-driven development
- Configuration guidance (options, trade-offs)
- Troubleshooting patterns
- File structure patterns
- Description patterns for CLI skills (100-500 chars, same as all types)
- Creation workflow
- Examples: claude-command-builder

**Template**: Use Read tool on cli/template.md for scaffolding CLI skill structure

---

## 3. Writer Skills

**What they are**: Documentation and content creation skills focused on audience-aware, structure-templated approaches.

**Examples**: api-docs, user-docs, pr-writer

**When to create**:
- Create guides, tutorials, documentation
- Need audience-specific tone and style
- Structure templates important
- Quality criteria for writing

**Key characteristics**:
- Audience-first approach
- Structure and organization templates
- Writing quality criteria
- Tone and style guidance
- Content templates

**See writer/README.md** - Use Read tool on writer/README.md when creating writer/documentation skills for:
- Audience-first approach
- Structure and organization templates
- Writing quality criteria
- Tone and style guidance
- Content templates
- File structure patterns
- Description patterns for writer skills
- Creation workflow
- Examples: api-docs, user-docs, pr-writer

**Template**: Use Read tool on writer/template.md for scaffolding writer skill structure

---

## 4. Hybrid Skills

**What they are**: Skills that combine multiple type characteristics.

**Example**: A skill might need domain expertise (expert) + templates (CLI) + documentation (writer)

**When to create**:
- Skill needs multiple aspects
- Combines investigation + syntax + content
- Complex multi-faceted guidance

**Guidance**: Reference multiple type files as needed:
- Use Read tool on expert/README.md for investigation and principles
- Use Read tool on cli/README.md for syntax and validation
- Use Read tool on writer/README.md for documentation and content
- Blend approaches to fit your needs

---

## Type Selection Decision Tree

```
What is the PRIMARY focus of your skill?

├─ Domain knowledge + investigation required?
│   └─ Expert Skill → Read expert/README.md
│
├─ Syntax, formats, or configuration documentation?
│   └─ CLI Skill → Read cli/README.md
│
├─ Creating guides, tutorials, or documentation?
│   └─ Writer Skill → Read writer/README.md
│
└─ Combines multiple aspects?
    └─ Hybrid Skill → Read multiple type files as needed
```

## Quick Comparison Table

| Aspect | Expert | CLI | Writer |
|--------|--------|-----|--------|
| **Focus** | Domain knowledge | Technical syntax | Content creation |
| **Approach** | Investigation-first | Validation-focused | Audience-first |
| **Key element** | Checklists | Templates | Structure |
| **Examples** | code-change, agent-builder | claude-command-builder | api-docs, pr-writer |
| **Principle** | Principles over prescriptions | Syntax accuracy | Tone and style |
