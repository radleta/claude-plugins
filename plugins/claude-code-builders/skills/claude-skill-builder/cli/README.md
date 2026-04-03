# CLI/Tool Skills Guide

Complete guidance for creating syntax-focused and configuration-heavy skills that document technical formats, command structures, and tool usage.

## What Are CLI Skills?

CLI skills provide comprehensive syntax knowledge, validation rules, configuration guidance, and troubleshooting for file formats, command structures, and technical configurations. They are the go-to resource when Claude needs to create, edit, or work with structured technical files.

**Examples of CLI skills:**
- **claude-command-builder** - Syntax for creating slash command files (.md files with YAML frontmatter)
- **claude-md-manager** - Syntax for CLAUDE.md files (@import syntax, memory hierarchy)

**Characteristics of CLI skills:**
- Syntax is the primary focus (exact formatting requirements)
- Technical precision is critical (one error breaks everything)
- Validation and error handling are extensive
- Templates provide working scaffolds
- Configuration options explained with trade-offs
- Troubleshooting for common errors is comprehensive

**When to create CLI skills:**
- Documenting file formats (YAML, JSON, XML configs)
- Teaching command structures (CLI tools, syntax rules)
- Explaining configuration options (settings files, frontmatter)
- Providing validation guidance (syntax checking, error detection)
- Creating technical documentation (API formats, data structures)
- Building tools that require exact syntax knowledge

---

## Agent-Optimization for CLI Skills

CLI skills benefit from agent-optimization due to technical precision requirements. See [AGENTIC.md](../AGENTIC.md) - Use Read tool when optimizing CLI skills for technical precision (provides complete 25-principle framework with decision criteria).

**Most valuable for CLI skills:** #2, #3, #5, #7, #9, #11, #17, #20, #23, #24

**When to apply:**
- Tool specifications (parameters, when/when-not/how)
- Configuration options with constraints and trade-offs
- Validation rules (syntax requirements, formats)
- Multi-step command sequences

**Pattern examples:** See [patterns/README.md](../patterns/README.md) - Use Read tool when applying agent-optimization patterns (provides 20+ categorized examples: tool specifications, validation criteria, structured formats)
- Category 3: Tool Specifications (structured specification)
- Category 4: Validation & Acceptance Criteria (quantitative vs qualitative)

**Complete framework:** [AGENTIC.md](../AGENTIC.md) (25 principles), [patterns/README.md](../patterns/README.md) (20+ examples)

---

## Core Principles

### 1. Syntax Accuracy

**What it means**: Provide precise, unambiguous technical documentation with zero room for interpretation.

**Why it matters**: A single syntax error breaks everything. Users need exact specifications, not approximations.

**How to implement**:
- Document every syntax element completely
- Show exact format requirements (spacing, case, delimiters)
- Specify required vs optional elements clearly
- Include data types and valid values exhaustively
- Note edge cases and special character handling
- Provide tested, working examples
- Use tables for systematic reference
- Include character-by-character syntax breakdown when needed

**Example from claude-command-builder**:
```markdown
## YAML Frontmatter Syntax

```yaml
---
name: skill-name           # Required: kebab-case identifier
description: text          # Required: 100-500 characters
allowed-tools: Tool1       # Optional: comma-separated
model: claude-3-5-sonnet   # Optional: specific model
---
```

**Required fields**: name, description
**Optional fields**: allowed-tools, model
**Constraints**:
- No blank lines before opening ---
- Valid YAML syntax (spaces not tabs)
- name: lowercase-with-hyphens only
- description: 100-500 chars (ideal: 200-400)
```

### 2. Validation Focus

**What it means**: Comprehensive validation catches errors before they cause failures.

**Why it matters**: Prevents runtime failures, reduces debugging time, enables self-service error detection.

**How to implement**:
- Create detailed validation checklists (15-30 items)
- Provide validation commands and tools
- Document common validation errors with examples
- Include self-validation instructions
- Show how to test before deploying
- Explain what each validation rule checks
- Provide error message → solution mappings
- Include validation automation guidance

**Example validation checklist**:
```markdown
## Validation Checklist

Before using your configuration, verify:

**Syntax Validation** (5 items)
- [ ] YAML syntax valid (no tabs, proper indentation)
- [ ] No blank lines before opening delimiter
- [ ] All required fields present
- [ ] Field names spelled correctly
- [ ] Values meet format requirements

**Content Validation** (5 items)
- [ ] Field values within allowed ranges
- [ ] File references point to existing files
- [ ] No circular dependencies
- [ ] Enum values match allowed options
- [ ] String lengths within limits

**Testing** (3 items)
- [ ] Test with minimal valid example
- [ ] Test with full-featured example
- [ ] Validate error handling

**Validation Commands**:
```bash
# Check YAML syntax
python -c "import yaml; yaml.safe_load(open('file.yaml'))"

# Validate field presence
grep "required_field:" file.yaml || echo "Missing required field"
```
```

### 3. Template-Driven

**What it means**: Provide working templates as starting scaffolds that users can copy and modify.

**Why it matters**: Users want to start from working examples, not build from scratch. Templates reduce errors.

**How to implement**:
- Provide complete, tested templates
- Include annotated versions with inline comments
- Create multiple templates (simple, moderate, advanced)
- Store templates in templates/ directory or inline
- Ensure every template actually works
- Show progression from basic to complex
- Include real-world templates, not toy examples
- Explain when to use each template

**Example template structure**:
```markdown
## Basic Template (Minimal Working Example)

Use when: Getting started, simple needs

```yaml
---
name: my-command
description: What this does
---

Content here
```

## Intermediate Template (Common Features)

Use when: Standard use case, typical features

```yaml
---
name: my-command
description: What this does
option1: value
option2: value
---

Content with common patterns:
- Feature 1
- Feature 2
```

## Advanced Template (Full-Featured)

Use when: Complex requirements, power user needs

```yaml
---
name: my-command
description: What this does
option1: value
option2: value
option3: complex_value
advanced-features:
  - feature1
  - feature2
---

Content with advanced patterns:
- Complex feature 1
- Edge case handling
- Performance optimization
```
```

### 4. Configuration Guidance

**What it means**: Explain all configuration options with trade-offs and when to use each.

**Why it matters**: Users need to understand implications of choices, not just what options exist.

**How to implement**:
- Document all configuration options comprehensively
- Explain trade-offs for each option
- Provide recommended defaults with reasoning
- Note security implications
- Note performance implications
- Show configuration examples
- Create decision trees for complex choices
- Include "when to use" guidance
- Note compatibility requirements

**Example configuration guidance**:
```markdown
## Model Selection Configuration

| Option | Use Case | Trade-offs |
|--------|----------|------------|
| `'inherit'` (default) | **Recommended for most cases** | Uses conversation's model, consistent behavior |
| `sonnet` | Balanced complexity tasks | Good reasoning, reasonable cost, slower than haiku |
| `haiku` | Simple, repetitive tasks | Fast and economical, less capable reasoning |
| `opus` | Complex reasoning needs | Highest capability, highest cost, slower |

**Decision Guide**:
```
Is task simple and repetitive?
  YES → Use haiku (fast, cheap)
  NO ↓

Does task require highest reasoning?
  YES → Use opus (best quality)
  NO ↓

Use 'inherit' (recommended default)
```

**Security Note**: Specifying models can override user's choice. Only specify when task requirements truly demand it.

**Performance Note**: Model specified in config cannot be overridden by user without editing config.
```

### 5. Troubleshooting Ready

**What it means**: Document common errors with clear diagnosis and solutions.

**Why it matters**: Reduces user frustration, enables self-service problem solving, reduces support burden.

**How to implement**:
- Create troubleshooting section with common issues
- Use "Symptoms → Diagnosis → Solution" format
- Provide step-by-step debugging guidance
- Include error messages with exact text
- Link to validation tools
- Show examples of fixing broken configs
- Explain why errors occur, not just how to fix
- Provide preventive measures

**Example troubleshooting entry**:
```markdown
## Troubleshooting

### Issue: YAML Parsing Error

**Symptoms**:
- Error message: "yaml.scanner.ScannerError: while scanning..."
- File won't load
- Unexpected behavior

**Diagnosis Steps**:
1. Check for tabs instead of spaces
   ```bash
   cat -A file.yaml | grep "^I"  # Shows tabs as ^I
   ```

2. Check for incorrect indentation
   ```bash
   # Should be consistent 2-space indents
   head -20 file.yaml
   ```

3. Check for unquoted special characters
   ```bash
   # Look for : or # in values without quotes
   grep "value.*:" file.yaml
   ```

**Common Causes**:
- Tabs used instead of spaces (YAML requires spaces)
- Inconsistent indentation (mixed 2 and 4 spaces)
- Unquoted strings containing colons (:)
- Missing closing quotes

**Solutions**:
```bash
# Fix tabs → spaces
expand -t 2 file.yaml > file_fixed.yaml

# Validate YAML syntax
python -c "import yaml; yaml.safe_load(open('file.yaml'))"

# Show line-by-line parsing
python -c "
import yaml
with open('file.yaml') as f:
    try:
        yaml.safe_load(f)
        print('✓ Valid YAML')
    except yaml.YAMLError as e:
        print(f'✗ Error: {e}')
"
```

**Prevention**:
- Configure editor to use spaces, not tabs
- Use YAML-aware editor with syntax highlighting
- Validate YAML before committing
- Use validation in CI/CD pipeline
```

### 6. Examples Abundant

**What it means**: Show working examples for every concept, pattern, and use case.

**Why it matters**: Examples clarify abstract documentation. Users learn by seeing concrete instances.

**How to implement**:
- Provide example for every syntax element
- Show multiple complexity levels (simple/moderate/advanced)
- Include before/after examples (wrong vs right)
- Make examples complete and copy-paste ready
- Add annotated examples with explanatory comments
- Show real-world examples from actual use
- Include edge cases and special scenarios
- Reference external EXAMPLES.md for comprehensive collection

**Example structure**:
```markdown
## Argument Handling Examples

### Example 1: All Arguments (Simple)

**Use case**: Command accepts free-form text input

```markdown
Process this request: $ARGUMENTS
```

**Usage**: `/process implement user authentication`
**Result**: "Process this request: implement user authentication"

### Example 2: Positional Arguments

**Use case**: Command requires specific ordered parameters

```markdown
Fix issue #$1 with priority $2 assigned to $3
```

**Usage**: `/fix-issue 123 high alice`
**Result**: "Fix issue #123 with priority high assigned to alice"

### Example 3: Mixed Arguments (Advanced)

**Use case**: First argument is special, rest are free-form

```markdown
Review PR #$1 focusing on: $ARGUMENTS
```

**Usage**: `/review-pr 456 security and performance`
**Result**: "Review PR #456 focusing on: 456 security and performance"

**Note**: `$1` is included in `$ARGUMENTS`, so appears twice

### Example 4: Wrong Patterns (Anti-patterns)

```markdown
❌ WRONG - Shell syntax doesn't work in commands
if [ -n "$1" ]; then
  echo "Process $1"
fi

✓ CORRECT - Use arguments directly
Process $1 with the following: $ARGUMENTS
```

See [EXAMPLES.md](EXAMPLES.md) - Use Read tool when implementing argument handling (provides 50+ examples across all use cases: simple, positional, mixed, and anti-patterns).
```

### 7. Progressive Complexity

**What it means**: Start with simplest valid example, progressively add complexity.

**Why it matters**: Users shouldn't need to understand advanced features to get started.

**How to implement**:
- Begin with absolute minimum working example
- Add features incrementally
- Explain what each addition provides
- Show when you need each level
- Provide "complexity decision tree"
- Label examples by complexity level
- Cross-reference between levels

---

## CLI Skill Checklist

Use this comprehensive checklist to ensure your CLI skill is complete and high-quality.

### Syntax Documentation (15 items)

- [ ] **Complete syntax reference** - Every element documented with examples
- [ ] **Required vs optional** - Clearly marked for all elements
- [ ] **Default values** - Specified for all optional elements
- [ ] **Data types** - String, boolean, number, array, object documented
- [ ] **Format requirements** - Case sensitivity, length limits, character restrictions
- [ ] **Special characters** - Escaping rules, quote handling, delimiters
- [ ] **Edge cases** - Empty values, null, undefined, special values
- [ ] **Version-specific syntax** - Note if syntax varies by version
- [ ] **Deprecated syntax** - Clearly marked with alternatives
- [ ] **Valid value ranges** - Enums, min/max, patterns, regex
- [ ] **Syntax examples** - Working, tested examples for each element
- [ ] **Error messages** - Expected errors for invalid syntax
- [ ] **Case sensitivity** - Documented for all elements
- [ ] **Whitespace rules** - Significance of spaces, tabs, newlines
- [ ] **Multi-line handling** - How to span across lines if applicable

### Validation & Error Handling (15 items)

- [ ] **Validation checklist** - 15-30 specific validation items
- [ ] **Common errors** - Top 10 errors with examples
- [ ] **Error messages** - Exact text users will see
- [ ] **Validation commands** - Commands to validate syntax
- [ ] **Validation tools** - External tools that help validate
- [ ] **Debugging guidance** - Step-by-step debugging process
- [ ] **Test cases** - Examples of valid and invalid input
- [ ] **Edge case validation** - Unusual but valid cases
- [ ] **Error recovery** - How to fix broken configurations
- [ ] **Validation automation** - Scripts to automate checking
- [ ] **False positives** - Known validator limitations
- [ ] **Warning vs error** - Distinguish severity levels
- [ ] **Validation failures** - Examples with explanations
- [ ] **Self-validation** - Users can check their own work
- [ ] **CI/CD integration** - How to validate in pipelines

### Configuration & Options (15 items)

- [ ] **All options documented** - No hidden options
- [ ] **Default configurations** - What happens if option omitted
- [ ] **Trade-offs explained** - Pros and cons of each option
- [ ] **Recommended configs** - Guidance for common cases
- [ ] **Security considerations** - Security implications noted
- [ ] **Performance implications** - Speed and resource impacts
- [ ] **Compatibility requirements** - Version dependencies, prerequisites
- [ ] **Configuration examples** - Working examples for each option
- [ ] **Configuration validation** - How to validate option combinations
- [ ] **Configuration precedence** - Which config wins in conflicts
- [ ] **Environment-specific** - Dev vs prod vs staging differences
- [ ] **Migration guidance** - How to upgrade configurations
- [ ] **Advanced patterns** - Power user configurations
- [ ] **Anti-patterns** - What not to do and why
- [ ] **Troubleshooting configs** - Common configuration issues

### Templates & Examples (10 items)

- [ ] **Basic template** - Minimal working example (10-20 lines)
- [ ] **Intermediate template** - Common features (30-50 lines)
- [ ] **Advanced template** - Full-featured (60+ lines)
- [ ] **Annotated templates** - Inline comments explain parts
- [ ] **Multiple scenarios** - Different use cases covered
- [ ] **Before/after** - Wrong → right examples
- [ ] **Complete examples** - Copy-paste ready, no placeholders
- [ ] **Real-world examples** - Actual production configurations
- [ ] **Templates tested** - Confirmed working, not theoretical
- [ ] **Template files** - In templates/ directory if complex

---

## File Structure Patterns

See [UNIVERSAL.md](../UNIVERSAL.md) - Use Read tool when designing file structure (File Structure Patterns section provides 6 patterns: minimal/simple/template-based/script-powered/complex/sub-folder with token counts and decision criteria).

**CLI-specific variations:**

**Simple** (150-300 lines): Single SKILL.md for single file format, limited options (<10)

**Moderate** (300-600 lines): SKILL.md + EXAMPLES.md + templates/ (basic/intermediate/advanced)
- Multiple configuration options (10-30), moderate complexity

**Comprehensive** (600+ lines): SKILL.md + SYNTAX.md + EXAMPLES.md + TIPS.md + REFERENCE.md + templates/
- Example: claude-command-builder (469-line main + 4 reference files)
- Complex file format, extensive options (30+), comprehensive troubleshooting

---

## Description Patterns

See [UNIVERSAL.md](../UNIVERSAL.md) - Use Read tool when writing descriptions (Description Engineering section provides WHAT + WHEN formula, length guidelines, keyword optimization, and 10+ examples).

### CLI-Specific Adaptations

**Formula:**
```
Provides [syntax/configuration] knowledge for [what] - [technical details]. Use when [action 1], [action 2], [action 3], or [action 4].
```

**Key characteristics:**
- Technical precision: Mention actual syntax elements, formats, structures
- File/format specific: Name actual files, extensions, paths
- Length: 100-500 chars, ideal 200-400 (same as all skill types)
- Action-oriented triggers: writing, editing, configuring, creating

**Examples:**

**claude-command-builder** (368 chars):
```yaml
description: Provides syntax knowledge for writing Claude Code slash command .md files - YAML frontmatter structure, $ARGUMENTS and positional args ($1, $2), allowed-tools patterns, and bash execution syntax. Use when writing new .claude/commands/*.md files, editing command frontmatter, adding argument variables to commands, or configuring allowed-tools restrictions.
```
Technical details (YAML, $ARGUMENTS, $1/$2), file context (.claude/commands/*.md), 4 triggers, 368 chars

**claude-md-manager** (439 chars):
```yaml
description: Provides syntax knowledge for writing CLAUDE.md instruction files - markdown @import file inclusion syntax, memory hierarchy locations (enterprise/project/user/local), and content organization. Use when writing CLAUDE.md or .claude/CLAUDE.md files, adding @import statements to include other markdown files, deciding which CLAUDE.md location to use (project vs user vs enterprise), or structuring multi-file CLAUDE.md setups.
```
Syntax elements (@import, hierarchy), file paths mentioned, 4 detailed triggers, 439 chars

---

## Creation Workflow

### Step 1: Identify Syntax/Format
- What file format? (YAML, JSON, XML, custom)
- What command structure? (CLI tool, configuration file)
- What technical system? (API format, data structure)
- Document core syntax elements

### Step 2: Document Complete Syntax
- Every syntax element with examples
- Required vs optional for all elements
- Data types and valid values
- Format constraints and rules
- Edge cases and special handling
- Character-by-character breakdown if needed

### Step 3: Create Validation Checklist
- 15-30 specific validation items
- Group by category (syntax, content, structure)
- Make items verifiable and actionable
- Include validation commands
- Provide error → solution mappings

### Step 4: Build Templates
- Basic template (minimal working)
- Intermediate template (common features)
- Advanced template (full-featured)
- Annotate templates with comments
- Test every template works

### Step 5: Write Troubleshooting Section
- Common errors (top 10)
- Symptoms → Diagnosis → Solution format
- Include exact error messages
- Provide debugging steps
- Show examples of fixes
- Add prevention guidance

### Step 6: Document Configuration Options
- All options comprehensively
- Trade-offs for each
- Recommended defaults with reasoning
- Security and performance notes
- Decision guides for complex choices
- Compatibility requirements

### Step 7: Provide Abundant Examples
- Example for every concept
- Multiple complexity levels
- Before/after (wrong vs right)
- Real-world scenarios
- Edge cases covered
- Reference comprehensive EXAMPLES.md

### Step 8: Organize File Structure
- Simple (150-300 lines) → one SKILL.md
- Moderate (300-600 lines) → SKILL.md + EXAMPLES.md + templates/
- Comprehensive (600+ lines) → SKILL.md + SYNTAX.md + EXAMPLES.md + TIPS.md + REFERENCE.md + templates/

### Step 9: Write Description
- Use CLI skill formula
- Include specific technical elements
- Mention file names/paths
- List 4 specific trigger scenarios
- 100-500 characters (ideal: 200-400)
- Technical precision over brevity

### Step 10: Validate
- Use @validation/README.md checklist
- Test all examples work
- Verify all templates function
- Check all validation commands
- Launch agent audit (claude-skill-builder validation protocol)

---

## Examples Section

### Existing CLI Skills to Study

#### claude-command-builder
**Domain**: Slash command file syntax
**Structure**: SKILL.md (469 lines) + SYNTAX.md + EXAMPLES.md + TIPS.md
**Key Features**:
- Complete YAML frontmatter reference
- Argument handling ($ARGUMENTS, $1, $2)
- Tool restriction patterns
- Bash execution syntax
- 14-item validation checklist
- 3 template levels
- Extensive troubleshooting

**Learn from this skill**:
- Systematic syntax documentation
- Clear validation checklist
- Template progression (simple → advanced)
- Troubleshooting structure

#### claude-md-manager
**Domain**: CLAUDE.md file syntax
**Structure**: SKILL.md (216 lines) + EXAMPLES.md + REFERENCE.md
**Key Features**:
- @import file syntax
- Memory hierarchy (enterprise/project/user/local)
- Import depth limits (max 5)
- Circular import handling
- Organization patterns
- File location documentation

**Learn from this skill**:
- Clear syntax rules
- Hierarchy explanation
- Troubleshooting common issues
- Organization guidance

---

## Common Pitfalls

### ❌ What to Avoid

**Incomplete syntax documentation**
- Missing edge cases
- Vague format requirements
- No examples for complex cases
- Undocumented special characters

**Inadequate validation**
- No validation checklist
- No validation commands
- Missing error messages
- No troubleshooting

**Untested examples**
- Examples that don't work
- Placeholder values that break
- Theoretical examples never run
- Copy-paste examples with errors

**Missing troubleshooting**
- No error documentation
- No debugging guidance
- No recovery steps
- No prevention measures

**Vague configuration**
- Options without trade-offs
- No recommended defaults
- Missing security notes
- No decision guidance

**No templates**
- Users start from scratch
- No working scaffold
- No complexity progression
- No annotated versions

**Syntax without examples**
- Abstract descriptions only
- No concrete instances
- Missing real-world use
- No before/after comparisons

### ✓ What to Do Instead

**Complete syntax reference**
- Every element documented
- All edge cases covered
- Examples for everything
- Character-level precision

**Comprehensive validation**
- Detailed checklist (15-30 items)
- Validation commands provided
- Error → solution mappings
- Self-validation guidance

**Working, tested examples**
- Every example tested
- Copy-paste ready
- No placeholders
- Real-world scenarios

**Extensive troubleshooting**
- Top 10 errors documented
- Step-by-step debugging
- Prevention guidance
- Recovery procedures

**Configuration guidance**
- All options explained
- Trade-offs documented
- Defaults with reasoning
- Decision trees provided

**Templates at all levels**
- Basic (minimal)
- Intermediate (common)
- Advanced (full-featured)
- All annotated and tested

**Abundant examples**
- Example per concept
- Multiple complexity levels
- Before/after patterns
- Real production configs

---

## See Also

**Universal principles** (apply to all skill types):
- [UNIVERSAL.md](../UNIVERSAL.md) - Use Read tool for YAML frontmatter syntax, description formula, token optimization techniques, and @ reference guidance

**Validation guidance**:
- [validation/README.md](../validation/README.md) - Use Read tool for post-creation validation checklist and agent audit process

**Advanced reference**:
- [reference/README.md](../reference/README.md) - Use Read tool for advanced troubleshooting, edge cases, and optimization techniques

**Other skill types** (for hybrid skills):
- [expert/README.md](../expert/README.md) - Use Read tool when creating investigation and domain knowledge skills
- [writer/README.md](../writer/README.md) - Use Read tool when creating documentation and content skills

---

## Quick Summary

**CLI skills are for**: Syntax, formats, configurations, commands, technical specifications

**Core focus**: Accuracy, validation, templates, troubleshooting, configuration

**File structure**: Simple (1 file) → Moderate (3-4 files) → Comprehensive (5-6 files)

**Description**: 100-500 chars (ideal: 200-400), same as all skill types

**Checklist**: 40-50 items (15 syntax + 15 validation + 15 configuration + 10 templates)

**Success criteria**: Every syntax element documented, validated, exemplified, and troubleshooted
