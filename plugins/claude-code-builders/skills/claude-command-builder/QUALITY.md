# Quality Standards & Definitions

This document defines quality standards, appropriateness criteria, and validation frameworks for slash command creation. Referenced throughout the claude-command-builder skill to ensure objective, measurable quality assessments.

---

## Purpose

Provide explicit definitions for terms that might otherwise be subjective or ambiguous, enabling agents to make consistent, objective decisions when creating and validating slash commands.

---

## Core Definitions

### "Appropriate" Tool Permissions

**Definition:** Tool permissions match user intent for restrictions, NOT operation risk level.

**CRITICAL PRINCIPLE:** `allowed-tools` limits Claude's ability to accomplish tasks effectively. Only add when:
1. **User explicitly requests restrictions** ("limit this command to only git operations")
2. **User wants command-specific sandboxing** ("make this command only read files")
3. **Never add proactively** - Omit by default

**When User Requests allowed-tools:**

| User Intent | Example Request | Appropriate Response |
|-------------|-----------------|----------------------|
| **Restrict to specific tools** | "Create a command that ONLY uses git" | `allowed-tools: Bash(git *)` |
| **Prevent destructive actions** | "Make it read-only" | `allowed-tools: Read, Grep, Glob` |
| **Limit network access** | "Don't let it access the network" | Omit WebFetch, curl, wget from allowed-tools |
| **Sandbox for safety** | "Restrict what this can do" | Ask user which tools to allow |

**Default Behavior (No User Request):**

| Operation Type | Appropriate Action |
|----------------|-------------------|
| **ALL operations** | **Omit allowed-tools entirely** |
| - Analysis, reviews, exploration | Omit allowed-tools |
| - Git operations (any type) | Omit allowed-tools |
| - File operations | Omit allowed-tools |
| - Testing, building, deploying | Omit allowed-tools |
| - Network operations | Omit allowed-tools |

**Why:** Claude already requests user permission for risky operations. Adding allowed-tools unnecessarily limits Claude's problem-solving ability.

**Decision Matrix: How to Determine Appropriate Tool Permissions**

| User Statement | User Intent | Action | Pattern Example |
|----------------|-------------|--------|-----------------|
| "Create a command to..." (no restriction mentioned) | General command creation | **Omit allowed-tools entirely** | N/A - no property |
| "Make this read-only" | Prevent destructive operations | Add read-only tools | `allowed-tools: Read, Grep, Glob` |
| "Limit to git operations only" | Restrict to specific tool category | Add specific tool patterns | `allowed-tools: Bash(git *)` |
| "Only allow git push" | Restrict to specific command | Add precise command pattern | `allowed-tools: Bash(git push *)` |
| "Don't let it access network" | Block network operations | Omit WebFetch and network tools | Omit WebFetch, curl, wget from allowed-tools |
| "Create deploy command" (no restriction mentioned) | Deployment without restrictions | **Omit allowed-tools entirely** | N/A - Claude will request permission for risky ops |
| Uncertain whether user wants restrictions | Unknown user intent | **ASK user first** | "Should this be restricted, or left flexible?" |

**Decision Rules:**

1. **Pattern Matching Rule:**
   - User said "restrict", "limit", "only", "read-only" → User wants restrictions
   - User gave general task with no restriction keywords → Omit allowed-tools
   - User unclear → ASK before adding

2. **Specificity Rule (when adding restrictions):**
   - ✓ GOOD: Specific command `Bash(git push *)`
   - ~ AVOID: Broad category `Bash(git *)` (too limiting)
   - ✗ BAD: Wildcard everything `Bash(*)` (defeats purpose)

3. **Default Mindset Rule:**
   - **NEVER add allowed-tools proactively**
   - allowed-tools is user-requested limitation, NOT best practice
   - Omitting allowed-tools = best practice for flexibility

**Examples:**

✅ **Appropriate - User explicitly requested restrictions:**
```yaml
# User said: "Create a deploy command that ONLY uses npm and git push"
allowed-tools: Bash(npm run deploy *), Bash(git push *)
```

✅ **Appropriate - User requested read-only:**
```yaml
# User said: "Make this command read-only for safety"
allowed-tools: Read, Grep, Glob
```

✅ **BEST - Default case (no user request for restrictions):**
```yaml
# User said: "Create a command to deploy" or "Create a commit command"
# (no allowed-tools property)
# Let Claude use whatever tools are needed
```

❌ **Inappropriate - Adding restrictions without user request:**
```yaml
# User said: "Create a git commit command"
# DON'T add this without user asking:
allowed-tools: Bash(git commit *)
# This limits Claude unnecessarily
```

**When to Recommend Restrictions to the User**

Even though the default is "omit," there are cases where restricting tools clearly benefits the command. In these cases, **ask the user** whether they want restrictions — don't add them silently.

**Recommend restrictions when:**
- Command uses `context: fork` + `user-invocable: false` (forked internal workers have less user visibility)
- Command is purely read-only by design (analysis, verification, review)
- Command uses `model: haiku` (weaker models benefit more from guardrails)

**How to recommend:**
> "This command is a forked read-only worker. Restricting tools to `Read, Glob, Grep` would prevent accidental writes and keep the agent focused. Want me to add `allowed-tools`?"

**Common restriction patterns (when user agrees):**

| Worker Type | Suggested Restriction |
|-------------|----------------------|
| Read-only analysis | `allowed-tools: Read, Glob, Grep` |
| Read-only with skill loading | `allowed-tools: Read, Glob, Grep, Skill` |
| Git-only read operations | `allowed-tools: Read, Glob, Grep, Bash(git *)` |

**Pattern: `Skill` vs `Skill(name)` in allowed-tools:**
- `Skill(plan-expert)` — restricts to one specific skill
- `Skill` (bare) — allows all skill invocations
- Skills are knowledge injection only — loading a skill does NOT grant additional tool access
- Bare `Skill` is usually sufficient since the tool restriction on Read/Bash/etc. is the real guardrail

**Examples:**

✅ **Forked read-only worker (user approved restrictions):**
```yaml
# Internal verification worker — reads files, loads knowledge skills
context: fork
user-invocable: false
model: haiku
allowed-tools: Read, Glob, Grep, Skill
```

✅ **Forked git-dependent worker (user approved restrictions):**
```yaml
# Internal git analysis worker — reads files + git history
context: fork
user-invocable: false
model: haiku
allowed-tools: Read, Glob, Grep, Bash(git *)
```

---

### "Proper" Standards

**Definition:** Follows established conventions and correctness criteria.

**Context-Specific Standards:**

#### Proper YAML Frontmatter
- **Indentation:** 2 spaces per level (never tabs)
- **Delimiters:** Opening `---` on line 1, closing `---` with blank line after
- **Property names:** Valid keys (description, allowed-tools, model, argument-hint, disable-model-invocation, user-invocable, context, agent, hooks, memory)
- **Values:** Quoted if containing special characters (`: , [ ] { } # & * ! | > ' " % @ \``)

**Validation:**
```bash
# Check for tabs (should return 0)
grep $'\t' file.md | wc -l

# Check for valid delimiters (should return 2)
head -n 20 file.md | grep -c "^---$"
```

#### Proper Argument Syntax
- **Format:** `$ARGUMENTS` or `$1, $2, $3` (positional)
- **Never:** `$ARG`, `${1}` (bash-style), `$ARGS`, `$(1)`
- **Placement:** Ideally once at end for `$ARGUMENTS`

**Validation:**
```bash
# Check for invalid patterns
grep '$ARG[^U]' file.md  # Should return nothing
grep '\${[0-9]}' file.md  # Should return nothing
```

#### Proper Description Content

**"Clear and Specific" Defined:**

A description is clear and specific when it meets ALL 3 measurable criteria:

1. **Word Count:** 10-50 words
   - Validation: `echo "$description" | wc -w` returns between 10 and 50
   - Too short (<10): Likely vague or incomplete
   - Too long (>50): Excessive detail that should be in command body

2. **Action Verb:** Contains at least one action verb
   - Valid verbs: analyze, create, review, deploy, test, generate, optimize, fix, refactor, validate, document, etc.
   - Validation: `echo "$description" | grep -iE "(analyze|create|review|deploy|test|generate|optimize|fix|refactor|validate|document)"` returns match
   - Identifies WHAT the command does

3. **Domain Context:** Includes technical domain or tool reference
   - Valid contexts: git, PR, code, dependencies, tests, API, database, files, security, performance, etc.
   - Validation: `echo "$description" | grep -iE "(git|pr|pull request|code|test|api|file|security|performance|dependency)"` returns match
   - Identifies WHERE/WHAT the command operates on

**Examples:**

Pass: "Create a git commit with conventional commit format"
- ✓ Word count: 8 words (10-50 range)
- ✓ Action verb: "Create"
- ✓ Domain context: "git commit"

Pass: "Review pull request with comprehensive security and performance checks"
- ✓ Word count: 10 words
- ✓ Action verb: "Review"
- ✓ Domain context: "pull request", "security", "performance"

Fail: "Does stuff"
- ✗ Word count: 2 words (below 10)
- ~ Action verb: "Does" (weak)
- ✗ Domain context: None ("stuff" is not specific)

Fail: "Process things"
- ✗ Word count: 2 words (below 10)
- ~ Action verb: "Process"
- ✗ Domain context: None ("things" is not specific)

#### Proper File Organization
- **Project commands:** `.claude/commands/` (tracked in git)
- **Personal commands:** `~/.claude/commands/` (user-specific)
- **Naming:** Descriptive, action-oriented, hyphenated (review-pr.md, not reviewpr.md)
- **Structure:** 1-2 levels deep max (commands/git/commit.md, not commands/git/workflows/commit/default.md)

#### Proper Model Specification
- **Use aliases:** `sonnet`, `opus`, `haiku`, `default`, `inherit`
- **Never:** Full model IDs like `claude-sonnet-4-20241022`
- **Reason:** Forward compatibility, simplicity
- **Note:** `inherit` explicitly inherits the conversation's model (same effect as omitting `model`)

---

### "Quality" Standards

**Definition:** Code or output meets measurable correctness, completeness, and maintainability criteria.

#### Code Quality Metrics

**Quantitative Thresholds:**

| Aspect | Metric | Threshold | How to Measure |
|--------|--------|-----------|----------------|
| **Linting** | Errors/Warnings | 0 | `npm run lint` or equivalent |
| **Type Safety** | Compilation errors | 0 | `tsc --noEmit` |
| **Test Coverage** | Line coverage | ≥80% | `npm test -- --coverage` |
| **Function Size** | Lines per function | <50 (ideal), <100 (max) | Count lines |
| **Complexity** | Cyclomatic complexity | <10 per function | `complexity-report`, `plato` |
| **Nesting** | Nesting levels | ≤3 levels | Visual inspection |
| **Duplication** | Duplicate code blocks | <5 lines acceptable | `jsinspect`, `jscpd` |

**Qualitative Checklist:**

- [ ] **Readability:**
  - Functions have single, clear purpose
  - Variables have descriptive names (not x, tmp, data)
  - Complex logic has "why" comments (not "what")

- [ ] **Maintainability:**
  - No magic numbers (use named constants)
  - No hardcoded values (use configuration)
  - Consistent naming conventions

- [ ] **Error Handling:**
  - All async operations have try/catch or .catch()
  - Errors include context (not just error.message)
  - User-facing errors exclude stack traces

**Validation Commands:**
```bash
# Run all quality checks
npm run lint          # Must pass with 0 errors, 0 warnings
tsc --noEmit          # Must succeed (if TypeScript)
npm test              # All tests must pass
npm test -- --coverage # Coverage must be ≥80%
```

#### Command Quality Standards

**Command File Quality:**

| Aspect | Criteria | How to Verify |
|--------|----------|---------------|
| **Description** | Present (10-50 words) + action verb + domain context | Check: word count, verb list, domain keywords |
| **Argument Handling** | Correct syntax | Check for $ARGUMENTS or $1, $2 |
| **Tool Permissions** | Appropriate for risk | Use decision matrix above |
| **Prompt Length** | <50 lines (good), <100 (acceptable) | `wc -l file.md` |
| **Single Responsibility** | One clear purpose | Can describe in 1 sentence |

---

### "Comprehensive" Standards

**Definition:** Covers all necessary aspects with sufficient detail.

**Quantified Scope:**

| Context | Comprehensive Means | How to Measure |
|---------|---------------------|----------------|
| **PR Review** | 5+ categories checked | Count categories |
| **Test Suite** | All public methods + edges | Count test cases |
| **Documentation** | Purpose + params + returns + example | Check all present |
| **Validation** | 10+ checklist items | Count items |
| **Examples** | 3-5 distinct instances | Count examples |

**PR Review Comprehensive Standard:**

Must include ALL 5 categories:
1. Code Quality (4+ specific checks)
2. Functionality (3+ specific checks)
3. Testing (3+ specific checks)
4. Documentation (3+ specific checks)
5. Security (5+ specific checks)

**Total:** 18+ specific validation points

**Complete when:**
- [ ] All 5 categories assessed
- [ ] Each check has pass/fail/N/A determination
- [ ] Issues documented with severity
- [ ] At least 1 positive finding per category

---

### "Good" / "Better" / "Best" Standards

**Definition:** Comparative quality levels with specific criteria.

**Pattern Quality Levels:**

#### Good (Acceptable - Meets Minimum)
- ✓ Functionally correct
- ✓ Follows basic syntax rules
- ✓ Works as intended
- ⚠️ May have efficiency issues
- ⚠️ May lack best practices

#### Better (Recommended - Follows Best Practices)
- ✓ All "Good" criteria
- ✓ Follows best practices
- ✓ Efficient implementation
- ✓ Maintainable code structure
- ⚠️ May lack optimization

#### Best (Optimal - Fully Optimized)
- ✓ All "Better" criteria
- ✓ Optimized for performance
- ✓ Exemplary code quality
- ✓ Pattern to emulate
- ✓ Handles all edge cases

**Example Application:**

```markdown
# Argument Handling Comparison

## Good (Acceptable)
$ARGUMENTS appears multiple times in prompt
- Functional but inefficient
- Wastes tokens
- Dilutes importance

## Better (Recommended)
$ARGUMENTS appears once, at end
- Token efficient
- Claude's ending bias utilized
- Clear focus

## Best (Optimal)
$ARGUMENTS once at end + clear context before
- All "Better" benefits
- Plus: Context guides interpretation
- Plus: Maximum clarity
```

---

## Validation Frameworks

### Command Validation Checklist

**Critical (Must Pass):**
- [ ] YAML syntax valid (no tabs, proper delimiters)
- [ ] Argument variables correct syntax
- [ ] Tool permissions appropriate for risk level
- [ ] Filename descriptive and action-oriented
- [ ] Description present and specific

**High Priority (Should Pass):**
- [ ] Prompt length reasonable (<50 lines ideal)
- [ ] Single responsibility maintained
- [ ] argument-hint matches actual usage
- [ ] Model uses alias if specified

**Medium Priority (Nice to Have):**
- [ ] Examples or patterns included
- [ ] Error handling guidance
- [ ] Edge cases considered

**Validation Process:**
1. Run critical checks first (must all pass)
2. Then high priority (aim for 100%)
3. Then medium priority (aim for 80%+)

---

### Quality Assessment Framework

**For Any Artifact (Code, Command, Documentation):**

**Step 1: Automated Checks**
- Run linters, type checkers, tests
- All must pass or have explicit exceptions
- **Result:** Pass/Fail (objective)

**Step 2: Quantitative Metrics**
- Apply thresholds (coverage ≥80%, functions <50 lines, etc.)
- Count and measure
- **Result:** Numeric score

**Step 3: Qualitative Checklist**
- Apply criteria checklist (readability, maintainability, etc.)
- Each item: Yes/No/N/A
- **Result:** Checklist completion %

**Step 4: Overall Assessment**
- Automated: Must pass
- Quantitative: ≥80% threshold met
- Qualitative: ≥90% checklist complete
- **Overall:** Good / Better / Best based on combination

---

## Usage Guidelines

### When Creating Commands

**Use this document to:**
1. **Determine tool permissions:** Refer to "Appropriate" decision matrix
2. **Validate syntax:** Check against "Proper" standards
3. **Assess quality:** Apply quality metrics and checklists
4. **Ensure completeness:** Use "Comprehensive" standards

### When Reviewing Commands

**Reference sections:**
- **Description clarity:** Is it specific? Does it trigger correctly?
- **Argument handling:** Proper syntax? Appropriate placement?
- **Tool permissions:** Match risk level per decision matrix?
- **Overall quality:** Run through validation checklist?

### When Troubleshooting

**If unclear whether something is "appropriate" or "proper":**
1. Find the term in this document
2. Read the definition and criteria
3. Apply the decision matrix or validation method
4. Make objective determination

---

## Examples

### Example 1: Determining Appropriate Permissions

**Question:** What permissions for a command that creates commits?

**Answer:**
1. **Check user request:** Did user ask for restrictions?
   - User said: "Create a git commit command" → No restrictions mentioned
   - User said: "Create a RESTRICTED git commit command that ONLY uses git" → Restrictions requested

2. **Default case (no restrictions requested):**
   - **Decision:** **OMIT allowed-tools entirely**
   - **Rationale:** Let Claude use whatever tools needed (git commit, status, diff, log, etc.)
   - **Result:**
   ```yaml
   # (no allowed-tools property)
   ```

3. **If user explicitly requests restrictions:**
   - User said: "Make it only use git commit, nothing else"
   - **Decision:** Add allowed-tools per user request
   - **Ask for confirmation:** "Should I restrict this to only git commit, or allow related git operations like status and diff too?"
   - **Result (if confirmed):**
   ```yaml
   allowed-tools: Bash(git commit *)
   ```

**Key Principle:** Never add allowed-tools without user explicitly requesting it. It limits Claude's problem-solving ability.

### Example 2: Assessing Code Quality

**Scenario:** Review code for "quality"

**Process:**
1. **Run automated checks:**
   ```bash
   npm run lint  # 0 errors, 0 warnings ✓
   tsc --noEmit  # Success ✓
   npm test      # All pass ✓
   npm test -- --coverage  # 85% coverage ✓
   ```

2. **Apply metrics:**
   - Largest function: 45 lines ✓ (under 50)
   - Complexity: Max 8 ✓ (under 10)
   - Duplication: None found ✓

3. **Qualitative checks:**
   - Readable: ✓ Descriptive names, clear structure
   - Maintainable: ✓ No magic numbers, good separation
   - Error handling: ✓ All async wrapped in try/catch

4. **Overall Assessment:** "Better" (Recommended)
   - Passes all automated
   - Meets all quantitative thresholds
   - Complete qualitative checklist
   - Not quite "Best" (could optimize some algorithms)

---

## Maintenance

**This document should be updated when:**
- New quality metrics identified
- Standards evolve
- Thresholds change based on experience
- New tools or validation methods available

**Version:** 2.0
**Last Updated:** February 2026
**Referenced By:** SKILL.md, SYNTAX.md, EXAMPLES.md, TIPS.md

> **Note:** Since v2.1.3, commands and skills are unified. These quality standards apply to both `.claude/commands/` files and `.claude/skills/` SKILL.md files.
