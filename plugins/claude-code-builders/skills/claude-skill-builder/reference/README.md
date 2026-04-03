# Reference & Troubleshooting Guide

Quick reference, troubleshooting solutions, advanced topics, and edge cases for skill creation.

## Quick Reference Tables

### Skill Type Decision Matrix

| If your skill needs... | Type | See |
|------------------------|------|-----|
| Domain knowledge & investigation | Expert | @expert/README.md |
| Syntax documentation & validation | CLI | @cli/README.md |
| Content creation & documentation | Writer | @writer/README.md |
| Multiple aspects combined | Hybrid | Multiple type files |

### Description Length Guidelines

| Aspect | Guideline |
|--------|-----------|
| **All Skill Types** | 100-500 characters |
| **Ideal Range** | 200-400 characters |
| **Minimum** | 100 characters (sufficient triggers) |
| **Maximum** | 500 characters (maintain clarity) |

**Note:** All skill types (Expert, CLI, Writer) now use the same uniform character limits for consistency and simplicity.

### File Structure Complexity

| Lines in SKILL.md | Structure | What to do |
|-------------------|-----------|------------|
| < 200 | Minimal | Single SKILL.md file |
| 200-400 | Simple | Add EXAMPLES.md or templates/ |
| 400-600 | Moderate | Use @ references extensively |
| 600+ | Too large | Split into multiple skills or use sub-folders |

### Checklist Size by Type

| Skill Type | Target Items | Range | Categories |
|------------|-------------|-------|------------|
| Expert | 40-55 | 35-60 | Investigation, Domain, Adaptability, Documentation |
| CLI | 40-50 | 35-55 | Syntax, Validation, Configuration, Templates |
| Writer | 45-55 | 40-60 | Audience, Structure, Writing Quality, Templates |

---

## Common Issues & Solutions

### Issue 1: Skill Doesn't Load

**Symptoms**: Skill not appearing when it should trigger

**Causes**:
- Skill not in correct location
- YAML frontmatter invalid
- Description doesn't match user request keywords
- Multi-line description silently breaking discovery (see [gotchas.md](gotchas.md))

**Solutions**:

1. **Check location**:
   ```bash
   # Personal skills
   ls ~/.claude/skills/my-skill/SKILL.md

   # Project skills
   ls .claude/skills/my-skill/SKILL.md
   ```

2. **Validate YAML**:
   - No blank lines before `---`
   - Valid YAML syntax (colons, quotes)
   - Required fields present (`name`, `description`)

3. **Check description keywords**:
   - Does it include terms users will mention?
   - Are there 3-5 WHEN scenarios?
   - Are technology names included?

4. **Check hot-reload**:
   - Skills hot-reload automatically since v2.1
   - If still not loading, check for multi-line description bug (see [gotchas.md](gotchas.md))

---

### Issue 2: Description Not Triggering Auto-Discovery

**Symptoms**: Skill exists but Claude doesn't load it when expected

**Cause**: Description lacks trigger keywords or WHEN scenarios

**Solution**: Enhance description with WHAT + WHEN formula

**Before**:
```yaml
description: Helps with React development
```

**After**:
```yaml
description: Creates React components with TypeScript, props typing, and hooks. Use when building UI components, refactoring class components, or scaffolding component structures in React projects.
```

**Key improvements**:
- Added specific capabilities (TypeScript, props typing, hooks)
- Added 3 WHEN scenarios (building, refactoring, scaffolding)
- Added context (React projects)
- Added rich keywords (React, TypeScript, components, props, hooks, UI)

---

### Issue 3: @ References Not Loading

**Symptoms**: @ references in skill don't auto-load supporting files

**Root Cause**: @ references resolve from PROJECT ROOT, not skill directory

**Understanding Path Resolution**:
```
Your skill location: /path/to/project/.claude/skills/your-skill/
Your file location: /path/to/project/.claude/skills/your-skill/expert/README.md

When you write: :at:expert/README.md
Claude looks for:  /path/to/project/expert/README.md  ❌ WRONG (doesn't exist)
NOT looking for:   /path/to/project/.claude/skills/your-skill/expert/README.md
```

**Solutions**:

1. **For project-root files** - @ references work correctly:

> IMPORTANT: `@ ` was used in place of `@` to prevent the actual inclusion of the mentioned files.

   ```markdown
   ✅ @ .claude/CLAUDE.md (project conventions)
   ✅ @ path/to/standards.md (project documentation)
   ✅ @ README.md (project README)
   ```

2. **For skill-internal files** - Use relative markdown links + Read instructions:

> IMPORTANT: `@ ` was used in place of `@` to prevent the actual inclusion of the mentioned files.

   ```markdown
   ❌ @ expert/README.md
      (resolves to /path/to/project/expert/README.md - WRONG location)

   ✅ [Expert guidance](expert/README.md)
      Use Read tool on `expert/README.md` when creating expert skills
      (provides 40-item checklist and investigation protocols)
   ```

3. **For critical content** - Inline directly in SKILL.md:
   ```markdown
   Copy content from supporting file into main SKILL.md
   (Recommended for: <200 lines AND used >50% of invocations)
   ```

**Why This Matters**:
- Skill portability: Skills must work when copied/renamed/moved
- No absolute project paths: Breaks when skill location changes
- Clear expectations: Relative links + Read instructions show intent

---

### Issue 4: Skill Too Large (Token Usage High)

**Symptoms**: SKILL.md > 400 lines, loads slowly

**Solutions**:

1. **Use @ references** to externalize content:
   ```markdown
   ## Examples
   See EXAMPLES.md for usage examples
   (Use Read tool on EXAMPLES.md when you need concrete examples)

   ## Templates
   See templates/ folder for scaffolds
   (Template files available as separate resources)
   ```

2. **Move templates to files**:
   ```
   my-skill/
   ├── SKILL.md (now 200 lines)
   ├── EXAMPLES.md
   └── templates/
       ├── basic.txt
       └── advanced.txt
   ```

3. **Split into multiple skills**:
   - One 800-line skill → Two 400-line focused skills
   - Better discovery (each has specific triggers)
   - Faster loading (only load what's needed)

4. **Use sub-folder organization** (advanced):
   ```
   my-skill/
   ├── SKILL.md (orchestrator)
   ├── UNIVERSAL.md
   ├── type1/
   │   └── README.md
   └── type2/
       └── README.md
   ```

---

### Issue 5: YAML Frontmatter Errors

**Symptoms**: Skill won't parse or load

**Common Errors**:

1. **Blank line before frontmatter**:
   ```markdown
   ❌ Wrong:

   ---
   name: my-skill
   ---

   ✅ Correct:
   ---
   name: my-skill
   ---
   ```

2. **Tabs instead of spaces**:
   ```yaml
   ❌ Wrong:
   ---
   name:	my-skill  # Tab character
   ---

   ✅ Correct:
   ---
   name: my-skill    # Spaces
   ---
   ```

3. **Missing colon**:
   ```yaml
   ❌ Wrong:
   ---
   name my-skill
   ---

   ✅ Correct:
   ---
   name: my-skill
   ---
   ```

4. **Unmatched quotes**:
   ```yaml
   ❌ Wrong:
   ---
   description: "Creates components
   ---

   ✅ Correct:
   ---
   description: "Creates components"
   ---
   ```

**Validation**: Use online YAML validator or:
```bash
python3 -c "import yaml; yaml.safe_load(open('SKILL.md').read().split('---')[1])"
```

---

### Issue 6: Examples Not Helpful

**Symptoms**: Users confused despite examples

**Causes**:
- Examples too abstract
- Examples don't show complete usage
- Examples lack context

**Solutions**:

1. **Show complete workflows**:
   ```markdown
   ❌ Abstract:
   Use this skill for API documentation.

   ✅ Complete:
   Example: Document a new REST endpoint
   1. Skill identifies endpoint type (GET, POST, etc.)
   2. Generates OpenAPI specification section
   3. Creates code samples in 3 languages
   4. Adds authentication documentation
   5. Includes error response examples
   ```

2. **Include before/after**:
   ```markdown
   Before: No documentation
   After: Complete API reference with examples, auth, errors
   ```

3. **Show multiple scenarios**:
   - Simple case (minimal options)
   - Common case (typical usage)
   - Complex case (advanced features)

---

### Issue 7: Skill Portability Problems

**Symptoms**: Skill works in original location but breaks when copied, renamed, or shared

**Causes**:
- Absolute project paths in skill files
- @ references to skill-internal files
- Hardcoded project-specific paths

**Solutions - Portability Best Practices**:

Skills must work when:
- Copied to different projects
- Renamed or reorganized
- Shared with team members
- Moved between directories

**Portability Rules**:

1. **NO absolute project paths** in skill files:
   ```markdown
   ❌ @.claude/skills/skill-name/file.md
      (breaks if skill renamed)

   ✅ [File guidance](file.md)
      (relative path works everywhere)
   ```

2. **NO @ references for skill-internal files**:
   ```markdown
   ❌ @expert/README.md
      (resolves from project root, not skill directory)

   ✅ [Expert guidance](expert/README.md)
      Use Read tool when creating expert skills
   ```

3. **@ references ONLY for project-level standards**:
   ```markdown
   ✅ @.claude/CLAUDE.md (project conventions file)
   ✅ @docs/coding-standards.md (shared project docs)

   Use sparingly - only when skill truly depends on project standard
   ```

4. **Use relative paths for skill-internal navigation**:
   ```markdown
   ✅ [Validation](validation/README.md)
   ✅ [Examples](../examples/basic-example.md)
   ✅ [Templates](templates/template.txt)
   ```

**Two-Tier Pattern for Content Inclusion**:

**Tier 1: Inline (Immediate Scope)**
- Critical content needed for skill operation
- Frequently referenced information (<50% of invocations)
- Small content blocks (<200 lines)
- Evaluation criteria: importance + frequency + size

**Tier 2: Progressive Disclosure (Read Instructions)**
- Reference material (examples, templates, detailed docs)
- Occasionally needed content (>50% of invocations)
- Large content blocks (>200 lines)
- **MUST include clear motivation:** WHEN to read and WHY valuable

**Decision Framework** (Quick Reference):
```
Is it critical AND small (<200 lines)?
├─ Yes → Inline in SKILL.md (Tier 1)
└─ No → Use Read instruction (Tier 2)

Read instruction template:
Use Read tool on `[file.md]` when [WHEN condition] (provides [WHY benefit])

Example:
Use Read tool on `expert/README.md` when creating expert skills
(provides 765 lines with 40-item quality checklist)
```

**For complete decision framework**: See [TOKEN-OPTIMIZATION.md](../TOKEN-OPTIMIZATION.md)

**Portability Testing**:
```bash
# Test 1: Copy skill to different location
cp -r .claude/skills/my-skill /tmp/test-skill
# Verify: All relative links still work

# Test 2: Rename skill directory
mv .claude/skills/my-skill .claude/skills/renamed-skill
# Verify: No broken references

# Test 3: Check for absolute paths
grep -r "@\.claude/skills/" .claude/skills/my-skill/
# Expected: 0 matches (no absolute skill paths)
```

---

## Advanced Topics

### Bash Execution Syntax

Skills can execute bash commands when loaded using special syntax.

**Syntax**: `!\`command\``

**Example**:
```markdown
Current branch: !\`git rev-parse --abbrev-ref HEAD\`
Project type: !\`[ -f package.json ] && echo "Node.js" || echo "Unknown"\`
```

**Important for Documentation**:

When documenting this syntax in skill files, you must escape it to prevent execution during skill load:

```markdown
❌ Wrong (executes during load):
Example: !\`git status\`

✅ Correct (shows as example only):
Example: !\\\`git status\\\`
```

**Use Cases**:
- Get current git branch
- Check environment variables
- Detect project structure
- Gather dynamic context

**Cautions**:
- Commands run at skill load time
- May slow down skill loading
- Should be fast commands only (< 100ms)
- Avoid side effects (no writes, commits, etc.)
- Most skills don't need this feature

---

### Complex File Structures

For very large or multi-faceted skills, use advanced organization:

#### Sub-Folder Organization

```
my-complex-skill/
├── SKILL.md                    # Main orchestrator
├── UNIVERSAL.md                # Shared principles
├── type1/
│   ├── README.md              # Type 1 guidance
│   └── template.md            # Type 1 templates
├── type2/
│   ├── README.md              # Type 2 guidance
│   └── template.md            # Type 2 templates
├── validation/
│   └── README.md              # Validation checklists
└── reference/
    └── README.md              # Troubleshooting
```

**When to use**:
- Skill covers multiple distinct types/approaches
- Each type needs 200+ lines of guidance
- Skill serves as meta-orchestrator
- Need extreme modularity

**Example**: claude-skill-builder itself uses this pattern

**Orchestrator Pattern** (SKILL.md):
```markdown
---
name: my-complex-skill
description: [WHAT + WHEN formula]
---

# My Complex Skill

## Universal Principles
See [UNIVERSAL.md](UNIVERSAL.md) for shared guidance
(Use Read tool on UNIVERSAL.md for principles common to all use cases)

## Type 1: [Name]
See [type1/README.md](type1/README.md) for:
- [Key features]
- [When to use]
(Use Read tool when working with Type 1 scenarios)

## Type 2: [Name]
See [type2/README.md](type2/README.md) for:
- [Key features]
- [When to use]
(Use Read tool when working with Type 2 scenarios)

## Validation
See [validation/README.md](validation/README.md) for quality assurance
(Use Read tool on validation/README.md when validating your work)
```

---

### Hybrid Skills

Some skills need multiple type characteristics:

**Example**: A skill might need:
- Domain expertise (expert)
- Syntax templates (CLI)
- Documentation guidance (writer)

**Approach**:

```markdown
---
name: my-hybrid-skill
description: [Emphasize primary type in WHAT, include secondary in WHEN]
---

# My Hybrid Skill

## Core Domain Expertise
See [expert/README.md](../expert/README.md) for investigation protocols and principles
(Use Read tool on expert/README.md when creating expert-focused sections)

## Syntax Reference
See [cli/README.md](../cli/README.md) for exact syntax requirements
(Use Read tool on cli/README.md when documenting syntax)

## Documentation Standards
See [writer/README.md](../writer/README.md) for writing quality criteria
(Use Read tool on writer/README.md when creating documentation)
```

**Tips**:
- Identify primary type (what's most important?)
- Use that type's structure as base
- Add sections from other types as needed
- Keep @ references clear about what comes from where

---

### Performance Optimization

Optimize skills for fast loading and low token usage:

#### Token Reduction Techniques

1. **Progressive disclosure**:
   ```markdown
   # Main concepts (always loaded)

   ## Advanced Topics
   See @ADVANCED.md (loaded only when referenced)
   ```

2. **External scripts** (not loaded until used):
   ```markdown
   Validation: Run `scripts/validate.py`
   Processing: Run `scripts/process.py`
   ```

3. **Template externalization**:
   ```
   my-skill/
   ├── SKILL.md (200 lines)
   └── templates/
       ├── basic.txt (not loaded unless referenced)
       └── advanced.txt
   ```

4. **Checklist condensing**:
   ```markdown
   ❌ Verbose (100 lines):
   - [ ] Check that the YAML frontmatter is valid
   - [ ] Verify that the name field is present
   - [ ] Ensure the description field exists
   [... 97 more like this ...]

   ✅ Concise (20 lines):
   - [ ] YAML frontmatter valid (syntax, required fields)
   - [ ] Description follows WHAT + WHEN formula
   - [ ] @ references exist and correct
   [... 17 more concise items ...]
   ```

#### Loading Speed

- Target: < 100ms load time
- Main SKILL.md: < 300 lines ideal
- Avoid bash execution unless necessary
- Use @ references to defer large content

---

## Installation Commands

### Personal Skills (All Projects)

```bash
# Create skill folder
mkdir -p ~/.claude/skills/my-skill

# Create SKILL.md
cat > ~/.claude/skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: [WHAT + WHEN formula]
---

[Skill content...]
EOF

# Skill hot-reloads automatically
```

### Project Skills (This Project Only)

```bash
# Create skill folder
mkdir -p .claude/skills/my-skill

# Create SKILL.md
cat > .claude/skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: [WHAT + WHEN formula]
---

[Skill content...]
EOF

# Commit to version control
git add .claude/skills/my-skill/
git commit -m "Add my-skill skill"

# Skill hot-reloads automatically
```

### Installing from Template

```bash
# Copy template
cp -r /path/to/template ~/.claude/skills/my-skill

# Customize SKILL.md
vim ~/.claude/skills/my-skill/SKILL.md

# Test (try trigger words - skill hot-reloads automatically)
```

---

## Edge Cases

### Empty Skill (Conventions Only)

Some skills are pure conventions without tools or complex logic:

```markdown
---
name: code-style
description: Code style conventions for this project. Use when formatting code, naming variables, or organizing files.
---

# Code Style Conventions

## Naming Conventions
- Components: PascalCase
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE

## File Organization
- One component per file
- Tests alongside source (component.test.ts)
- Index files for public API

[... more conventions ...]
```

**Valid use case**: Project-specific standards that don't change often

---

### Skill Dependencies

Skills can reference other skills:

```markdown
## Related Skills

This skill works well with:
- **api-docs** - For documenting generated APIs
- **code-change** - For making code modifications
- **claude-skill-builder** - For creating new skills

Consider using together for comprehensive workflow.
```

**Note**: No formal dependency system; just guidance for users

---

### Multi-Language Skills

Skills can support multiple programming languages:

```markdown
---
name: test-writer
description: Creates unit tests with mocking and fixtures. Use when writing tests, adding test coverage, or setting up test infrastructure in Python, JavaScript, or Go projects.
---

# Test Writer

## Language Detection

This skill adapts to your project language:
- Python → pytest with fixtures
- JavaScript → Jest with mocks
- Go → testing package with table tests

[... language-specific sections ...]
```

---

## Troubleshooting Checklist

Use when skill isn't working as expected:

- [ ] Skill in correct location (personal or project)
- [ ] YAML frontmatter valid (no blank lines, syntax correct)
- [ ] Description follows WHAT + WHEN formula
- [ ] Trigger keywords match user requests
- [ ] @ references valid (files exist, paths correct)
- [ ] Main SKILL.md < 400 lines
- [ ] Skill hot-reloaded (automatic since v2.1)
- [ ] Examples concrete and complete
- [ ] Checklist items specific (40-55 items)
- [ ] Type-specific requirements met

If all checked and still issues, validate with agent (see @validation/README.md).

---

## See Also

- **[UNIVERSAL.md](../UNIVERSAL.md)** - Shared principles for all skills
- **[expert/README.md](../expert/README.md)** - Expert skill creation guidance
- **[cli/README.md](../cli/README.md)** - CLI skill creation guidance
- **[writer/README.md](../writer/README.md)** - Writer skill creation guidance
- **[validation/README.md](../validation/README.md)** - Validation and quality assurance
- **[frontmatter.md](frontmatter.md)** - Complete YAML frontmatter field reference
- **[best-practices.md](best-practices.md)** - Official Anthropic guidance
- **[gotchas.md](gotchas.md)** - Known bugs and workarounds
- **[capabilities.md](capabilities.md)** - New features since v2.1
- **[community-patterns.md](community-patterns.md)** - Community-tested patterns
