# CLI Skills Guidance - Summary

This folder contains comprehensive guidance for creating CLI/Tool skills - syntax-focused and configuration-heavy skills.

## Files Created

### README.md (865 lines, 27KB)
Complete guidance for CLI skill creation covering:

**Core Content:**
1. **What Are CLI Skills?** (50+ lines) - Definition, characteristics, when to create
2. **7 Core Principles** (350+ lines) - Detailed principles with examples:
   - Syntax Accuracy
   - Validation Focus
   - Template-Driven
   - Configuration Guidance
   - Troubleshooting Ready
   - Examples Abundant
   - Progressive Complexity
3. **Comprehensive Checklist** (55 items) - Organized by category:
   - Syntax Documentation (15 items)
   - Validation & Error Handling (15 items)
   - Configuration & Options (15 items)
   - Templates & Examples (10 items)
4. **File Structure Patterns** (60+ lines) - When to use simple/moderate/comprehensive
5. **Description Patterns** (100+ lines) - Formula, characteristics, examples with analysis
6. **Creation Workflow** (80+ lines) - 10-step process from identification to validation
7. **Examples Section** (60+ lines) - Analysis of claude-command-builder and claude-md-manager
8. **Common Pitfalls** (80+ lines) - What to avoid and what to do instead
9. **Cross-References** (30+ lines) - Links to other guidance files

**Key Features:**
- 100-500 character descriptions (ideal: 200-400), same as all skill types
- Emphasis on syntax precision and validation
- Template-driven approach with 3 complexity levels
- Extensive troubleshooting guidance
- Configuration with trade-off analysis

### template.md (567 lines, 13KB)
Complete template for creating CLI skills including:

**Template Structure:**
- YAML frontmatter with CLI-specific description
- Core capabilities sections
- Complete syntax reference structure
- Validation checklist structure (with command examples)
- Configuration guide with trade-off tables
- Three template levels (basic/intermediate/advanced)
- Troubleshooting section with symptoms/diagnosis/solution
- Best practices by category
- Edge cases and limitations
- Complete working example
- Creation process workflow
- Success criteria checklist

**Customization Guide:**
- How to replace placeholders
- Structure adaptation for simple/moderate/comprehensive skills
- Format-specific adjustments (YAML/JSON/DSL/CLI)
- Testing checklist
- Example instantiation (Terraform config)

## Usage

**For creating new CLI skills:**
1. Read cli/README.md to understand CLI skill principles
2. Use cli/template.md as starting scaffold
3. Follow the 10-step creation workflow
4. Verify against the 55-item checklist

**For understanding CLI patterns:**
- Study the 7 core principles in detail
- Review description patterns with 100-500 char guidance
- Examine file structure patterns
- Analyze existing skills (claude-command-builder, claude-md-manager)

## Integration

This guidance integrates with:
- **@../UNIVERSAL.md** - Universal principles (YAML, descriptions, tokens)
- **@../validation/README.md** - Post-creation validation
- **@../EXAMPLES.md** - Complete CLI skill examples
- **@../REFERENCE.md** - Advanced troubleshooting

## Success Metrics

A complete CLI skill has:
- ✓ 55/55 checklist items addressed
- ✓ All 7 core principles implemented
- ✓ Complete syntax reference with examples
- ✓ Validation checklist (15-30 items)
- ✓ Three template levels
- ✓ Top 10 errors documented
- ✓ Configuration with trade-offs
- ✓ Description 100-500 chars (ideal: 200-400), same as all types
- ✓ Working examples for every concept

## Research Sources

This guidance was created by analyzing:
- claude-command-builder (469-line SKILL.md + SYNTAX.md + EXAMPLES.md + TIPS.md)
- claude-md-manager (216-line SKILL.md + EXAMPLES.md + REFERENCE.md)
- scratch/skill-builder-enhancement/skill-type-analysis.md (CLI Skills Analysis section)
- scratch/skill-builder-enhancement/content-design.md (CLI-SKILLS.md Design section)

All patterns extracted from real, production CLI skills used in Claude Code.
