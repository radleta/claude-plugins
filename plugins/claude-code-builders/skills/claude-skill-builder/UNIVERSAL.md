# Universal Skill Principles

This file contains requirements and best practices that apply to **all** skill types (expert, CLI, and writer skills).

## YAML Frontmatter Requirements

Every SKILL.md **must** start with valid YAML frontmatter:

```yaml
---
name: skill-name
description: What the skill does and when to use it
---
```

### Critical Rules

1. **No blank lines before frontmatter** — Must be first thing in file
2. **`name` field** — Lowercase letters, numbers, hyphens only. Max 64 chars. No consecutive hyphens, can't start/end with hyphen. Must match parent directory name. Gerund form recommended (`processing-pdfs`, not `helper` or `utils`). Reserved words `anthropic` and `claude` are not allowed.
3. **`description` field** — The most important field for auto-discovery. Max 1024 chars. Must be on a single line (multi-line wrapping silently breaks discovery). Use third person ("Processes files" not "I can help you"). See Description Engineering below.
4. **Valid YAML syntax** — Proper colons, quotes, indentation (spaces, not tabs). Quote descriptions with double quotes to prevent YAML parsing issues.

### Additional Frontmatter Fields

Beyond `name` and `description`, skills support 8 additional fields: `argument-hint`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `model`, `context`, `agent`, `hooks`.

**See [reference/frontmatter.md](reference/frontmatter.md)** — Use Read tool for complete field reference, invocation control matrix, string substitutions (`$ARGUMENTS`, `$N`, `${CLAUDE_SESSION_ID}`), context fork, and hooks syntax.

## Description Engineering

The description determines when Claude loads your skill. This is **THE MOST IMPORTANT** part of skill creation.

### How Discovery Works

At startup, Claude Code injects only the `name` and `description` from every skill into a system prompt block. **There is no algorithmic routing** — Claude uses pure LLM reasoning to match user intent against descriptions. The SKILL.md body is invisible until after invocation.

This means: the description is the **sole mechanism** for auto-discovery. Everything that helps Claude decide whether to load your skill must be in the description.

### The Formula: WHAT + WHEN (+ Be Pushy)

```
[What the skill does — direct, keyword-rich, third person]. Use when [scenario 1], [scenario 2], [scenario 3], or [scenario 4] — even when [edge case users might not think to invoke the skill for].
```

**Two parts, each with one job:**
1. **WHAT** — What the skill does. Direct capability statement, keyword-rich, third person.
2. **WHEN** — When to use it. Explicit trigger scenarios plus "pushy" edge cases.

**Rules:**
- Maximum 2 sentences (WHAT + WHEN). No third sentence needed.
- Use third person ("Processes files") not first ("I can help you") or second ("You can use this"). Inconsistent POV causes discovery problems because descriptions are injected into the system prompt.
- All trigger info goes in `description`, NOT in the body. The body only loads AFTER triggering — "When to Use" sections in the body don't help discovery.
- Description must be on a single YAML line. Multi-line wrapping (e.g., from Prettier) silently breaks discovery.
- When refining, rewrite the entire description from scratch — never append.
- See "Description Refinement Rules" section below for full guidance.

### The "Be Pushy" Directive

Claude's default behavior is to **undertrigger** skills — it errs toward not loading when uncertain. Combat this by making descriptions "a little bit pushy" (Anthropic's own term):

- **Expand trigger conditions** with "even when" / "even if" edge cases
- **Claim adjacent territory** — include near-miss scenarios users might phrase differently
- **Lower the activation threshold** — make it clear the skill should load for related tasks too

❌ **Not pushy enough:**
```yaml
description: "Commit creation with conventional format. Use when creating git commits."
```

✅ **Appropriately pushy:**
```yaml
description: "Commit creation with security checks, smart staging, and conventional format. Use when creating git commits, reviewing staged changes, or preparing code for version control — even for quick single-file commits."
```

### Example (Anthropic-Style)

```yaml
description: "Validated React patterns for component architecture, performance, and testing. Use when building React components, fixing render performance, choosing state management, or writing component tests — even for seemingly straightforward React tasks."
```

**Why this works:**
- **WHAT**: "Validated React patterns for..." — direct, keyword-rich, no preamble
- **WHEN**: 4 trigger scenarios with action verbs + pushy edge case
- **No boilerplate**: No "AFTER loading" preamble, no "WITHOUT" scare tactic
- **~240 chars**: Concise and scannable

### More Examples (From Anthropic's Official Docs)

```yaml
description: "Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction."
```

```yaml
description: "Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes."
```

```yaml
description: "Explains code with visual diagrams and analogies. Use when explaining how code works, teaching about a codebase, or when the user asks 'how does this work?'"
```

### What NOT to Do

**Don't add preambles.** Just state what the skill does directly.
- ❌ "AFTER loading this skill, you gain access to validated patterns for..."
- ✅ "Validated patterns for..."

**Don't add scare tactics.** The WITHOUT clause wastes budget and doesn't help discovery.
- ❌ "...WITHOUT this skill, you will systematically miss critical patterns across all tasks—resulting in..."
- ✅ (just omit it — save the budget for better trigger keywords)

**Don't use comma-heavy capability lists in the WHAT part.**
- ❌ "Provides fixtures, mocking, coverage analysis, test strategies, and assertion patterns"
- ✅ "Comprehensive testing patterns for test suite creation"

### Length Guidelines

Descriptions share a **context budget** (2% of context window, ~16K chars fallback). Each skill consumes ~109 chars of XML overhead plus description length. With many installed skills, some get **silently hidden**.

| Collection Size | Recommended Max Length | Rationale |
|---|---|---|
| 10-20 skills | Up to 400 chars | Budget is generous, use it |
| 20-40 skills | Under 300 chars | Balance detail with budget |
| 40-60 skills | Under 200 chars | Front-load keywords |
| 60+ skills | Under 150 chars | Critical: budget overflow risk |

**General target**: 150-300 characters. Front-load domain keywords in the first 50 characters — Claude reads the full list at every turn, and early keywords have more impact.

**Hard limit**: 1,024 characters (system-enforced).

### Eval Queries: Testing Your Description

Test descriptions with eval queries before shipping:

1. **Write 20 test queries** — 10 that SHOULD trigger, 10 that SHOULD NOT
2. **Should-trigger queries** (8-10): Vary phrasing — formal, casual, some with typos or abbreviations. Include cases where the user doesn't name the skill but clearly needs it. Include uncommon use cases.
3. **Should-NOT-trigger queries** (8-10): Focus on *near-misses* — queries sharing keywords but needing something different. "Write a fibonacci function" as a negative for a PDF skill is too easy. The hard cases are adjacent domains with overlapping vocabulary.
4. **Make queries realistic**: Include file paths, personal context, column names, casual speech. Not abstract "Format this data" but concrete "my boss sent me this xlsx file called Q4 sales final v2.xlsx and wants a profit margin column..."
5. **Test mentally**: For each query, would Claude match it to your description over other available skills?
6. **Refine**: Adjust trigger keywords based on false positives/negatives

**Example for a React skill:**
- Should trigger: "fix the re-render loop", "add a useEffect", "component keeps re-rendering"
- Should NOT trigger: "add a button to the page" (generic HTML), "fix the CSS layout" (styling)

**Automated testing**: For rigorous description optimization with train/test splits, multi-run reliability scoring, and automated improvement loops, use `/skill-creator`.

### Description Refinement Rules (Preventing Bloat)

**Critical problem:** When refining skills, agents tend to *append* new information to descriptions instead of *rewriting* them. This causes descriptions to grow unbounded.

<description-refinement-rules>
  <rule id="rewrite-not-append" priority="critical">
    <name>Rewrite the entire description — never append to it</name>
    <rationale>Appending creates run-on sentences with redundant clauses. Each refinement should produce a fresh, cohesive description that incorporates new information by replacing weaker phrases, not adding more.</rationale>
    <positive>Read the current description. Draft a new one from scratch that incorporates the new insight. Replace the old description entirely.</positive>
    <negative>Copy the current description and add a new sentence or clause at the end.</negative>
  </rule>

  <rule id="two-part-limit" priority="critical">
    <name>Maximum 2 sentences: WHAT + WHEN</name>
    <rationale>Two parts, each with one job. Adding more sentences dilutes the signal-to-noise ratio. Every character should earn its place.</rationale>
    <structure>
      Sentence 1 (WHAT): What the skill does — direct capability statement.
      Sentence 2 (WHEN): "Use when" + trigger scenarios + pushy edge cases.
    </structure>
  </rule>

  <rule id="no-boilerplate" priority="critical">
    <name>No preambles, no scare tactics</name>
    <rationale>"AFTER loading this skill, you gain access to..." wastes ~50 chars of budget on zero-information preamble. "WITHOUT this skill, you will systematically miss..." wastes ~200 chars on a scare tactic that doesn't help Claude's LLM reasoning match user intent to skill description. Budget is better spent on trigger keywords.</rationale>
    <anti-patterns>
      - "AFTER loading this skill, you gain access to..."
      - "Once loaded, this skill when executed gives Claude..."
      - "WITHOUT this skill, you will systematically..."
      - "Without loading this skill, Claude cannot..."
    </anti-patterns>
  </rule>

  <rule id="no-comma-lists" priority="high">
    <name>Avoid long comma-separated capability lists in the WHAT part</name>
    <rationale>Comma-heavy clauses like "provides X, Y help, Z engineering, and W patterns" dilute the signal. Each item becomes an ambiguous standalone claim that may overlap with other skills' triggers.</rationale>
    <positive>"Validated testing patterns for comprehensive test suites" — one clear capability statement</positive>
    <negative>"Provides type-specific guidance, YAML frontmatter help, description engineering, and token efficiency patterns" — 4 comma-separated items fighting for attention</negative>
    <note>Comma lists in the WHEN part are fine — short action phrases like "Use when creating, editing, validating, or optimizing" are the expected pattern.</note>
  </rule>
</description-refinement-rules>

**Before/After example:**

❌ **Bloated (old dual-qualification pattern):**
```yaml
description: "AFTER loading this skill, you gain access to research-validated patterns for creating SKILL.md files. Use when creating, editing, validating, or optimizing SKILL.md files. WITHOUT this skill, you will systematically produce malformed skill definitions across all skill types, missing critical validation requirements."
```
Problems: 3 sentences, ~50 chars wasted on AFTER preamble, ~150 chars wasted on WITHOUT scare tactic. Only ~100 chars doing actual work.

✅ **Concise (Anthropic-aligned):**
```yaml
description: "Validated patterns for building SKILL.md files that auto-discover reliably. Use when creating, editing, validating, or optimizing any Claude Code skill — even for simple single-file skills."
```
Why better: 2 sentences. No boilerplate. Pushy edge case. ~190 chars — all working.

### Project-Specific vs User-Scoped Skills

**Critical insight:** Project-scoped skills (`.claude/skills/`) require different description strategies than user-scoped skills (`~/.claude/skills/`).

#### The Overlap Problem

Project-scoped skills often share a codebase with other project skills. Without careful description design:
- Multiple skills claim similar triggers ("MCP development", "widget creation")
- Claude cannot predict which skill loads for a given request
- Users get inconsistent behavior depending on which skill wins

#### Narrow and Unique Principle

For project-scoped skills, descriptions must be **narrow** (focused scope) and **unique** (non-overlapping triggers).

<description-strategy scope="project">
  <principle name="narrow">
    Focus on what THIS skill uniquely provides, not general capabilities
  </principle>

  <principle name="unique">
    Avoid trigger words claimed by other project skills
  </principle>

  <principle name="complement">
    Reference related skills in out-of-scope, not compete with them
  </principle>
</description-strategy>

#### Before Creating a Project Skill

**Checklist:**
- [ ] List existing project skills and their trigger words
- [ ] Identify what's UNIQUE to this new skill (not covered elsewhere)
- [ ] Verify no trigger word overlap with existing skills
- [ ] Define clear boundaries (what to use THIS skill for vs others)

#### Example: Avoiding Overlap

**Scenario:** Project has `akn-mcp-developer` (MCP tool patterns) and wants `akn-chatgpt-app` (app context).

❌ **Bad (overlapping):**
```yaml
# akn-chatgpt-app - OVERLAPS with akn-mcp-developer
description: ...MCP server patterns, widget development, OpenAI submission...
# Problem: "MCP" and "widget" triggers conflict with akn-mcp-developer
```

✅ **Good (narrow and unique):**
```yaml
# akn-chatgpt-app - COMPLEMENTS akn-mcp-developer
description: ...app context, OpenAI submission requirements, policy compliance, tool annotation justifications...
# Unique triggers: "submission", "policy", "annotation justifications", "app status"
# No overlap: MCP/widget development handled by akn-mcp-developer
```

#### User-Scoped Skills: Different Strategy

User-scoped skills (`~/.claude/skills/`) don't compete with project skills - they're portable across projects. For these:
- Broader triggers are acceptable (no project-specific conflicts)
- Focus on general capabilities, not project-specific context
- Still avoid overlap with OTHER user-scoped skills you maintain

#### Documenting Skill Relationships

In project-scoped skills, explicitly document relationships:

```markdown
## Related Skills

| Task | Use Skill |
|------|-----------|
| MCP tool development | `akn-mcp-developer` |
| Generator patterns | `akn-generator-developer` |
| App submission | `akn-chatgpt-app` (this skill) |
```

This helps both Claude and human readers understand the skill ecosystem.

## Agent-Optimized Instructions

**Critical insight:** Skills are consumed by AI agents, not humans. This benefits from more structure and explicitness than human documentation — but models are capable reasoners who generalize better from understood principles than from rote commands.

### Core Principles (Always Apply)

**#7 - Make Every Step Executable:**
- ❌ Vague: "Ensure quality"
- ✅ Executable: "Verify: linter passes, coverage ≥80%, docstrings on all public functions"

**#9 - Avoid Ambiguity:**
- ❌ Subjective: "Good test coverage"
- ✅ Quantitative: "Test coverage ≥80%"

**#13 - Use Imperative Voice with Rationale:**
- ❌ Suggestion: "Consider adding tests"
- ✅ Imperative: "Add tests for all public functions because untested helpers break silently"
- ⚠️ Yellow flag: ALL CAPS MUSTs ("ALWAYS do X") — reframe with reasoning instead

**#14 - Provide Positive + Negative Examples:**
- ✅ Show what to do AND what not to do
- ✅ Explain why good/bad for pattern learning

### Quick Agent-Optimization Checklist

Apply based on skill complexity:

- [ ] Every step executable (specific, actionable, measurable)
- [ ] No ambiguous terms (quantify, define, exemplify)
- [ ] Imperative voice with rationale (direct commands paired with reasoning)
- [ ] Positive AND negative examples provided
- [ ] Dependencies explicit (when needed for complex skills)
- [ ] Validation criteria measurable (not subjective)
- [ ] Tool usage specified (when/when-not/how, if applicable)
- [ ] Output formats defined (templates or schemas, if applicable)

### Complete Framework

**For comprehensive agent-optimization guidance:**
- **[AGENTIC.md](AGENTIC.md)** - Full framework: 26 principles (including new #26: Design for Agent Audience), decision guide, paradigm shift explanation
- **[patterns/README.md](patterns/README.md)** - 60+ before/after transformation examples across 10 categories

**When to use:** Apply core principles (#7, #9, #13, #14, #26) to all skills. Use structured formats only when complexity warrants it.

---

## Agent Audience vs Human Audience

Skills are consumed by AI agents (Claude), not humans. This means optimizing for clarity and executability over friendliness — but it doesn't mean everything needs XML and formal contracts.

### Who Reads What

| Document Type | Primary Audience | Optimize For |
|---------------|------------------|--------------|
| **SKILL.md** | Claude (agent) | Clear, executable instructions |
| **CLAUDE.md** | Claude (agent) | Project context and protocols |
| **Slash commands** | Claude (agent) | Task workflows |
| README.md | Human users | Human comprehension |

### Writing for Agent Consumption

Since users never directly read skill files, optimize for how Claude processes instructions:

✅ **DO:**
- Write clear, specific instructions with rationale
- Use numbered steps for multi-step processes
- Include "when to load" guidance for referenced files
- Provide positive and negative examples
- Explain *why* things matter (models generalize from understanding)

❌ **DON'T:**
- Conversational prompts ("Ready to build?")
- Motivational language ("I'll guide you through...")
- Vague guidance ("Feel free to ask questions")
- "When to Use" sections in the body (put trigger info in `description`)

**Note on structure level:** Anthropic's own most complex skill (skill-creator, 480 lines) uses conversational markdown with clear headings — no XML, no formal contracts. Use structured formats (XML, schemas) when they genuinely help clarity, not as a default. See [AGENTIC.md](AGENTIC.md) for the full framework and decision guide.

---

## Token Optimization

Token optimization is an **architectural decision**, not just a technique. Only add context Claude doesn't already have — challenge each piece: "Does this justify its token cost?"

**Key rules:**
- **SKILL.md body**: < 500 lines (official max). Our target: < 300 ideal, < 400 acceptable.
- **References one level deep**: SKILL.md can reference supporting files, but those files should NOT reference other files. Avoid A → B → C chains.
- **Standard directories**: Use `scripts/` (executable code), `references/` (docs loaded as needed), `assets/` (templates, data files).
- **Match specificity to fragility**: High freedom for flexible tasks, low freedom for critical tasks. See "Writing Principles" section above.

**For comprehensive guidance** → See [TOKEN-OPTIMIZATION.md](TOKEN-OPTIMIZATION.md) for:
- **Strategic principles** (4 architectural patterns: externalize, lazy load, optimize discovery, measure)
- **Tactical techniques** (5 quick techniques below)
- Decision framework, case study (react-expert 0.9%), and 4 skill patterns (minimal/moderate/comprehensive/meta)

**Quick reference techniques below** are tactical implementations of the strategic principles:

### Technique 1: Use Relative Links + Read Instructions (NOT @ References)

⚠️ **@ Reference Discipline — Two Rules:**

1. **Never `@` files outside the skill directory.** Cross-skill `@` references (e.g., `@.claude/skills/other-skill/SKILL.md`) create fragile path coupling. If the referenced skill moves, renames, or reorganizes, the reference silently breaks. Instead, tell Claude to load the other skill by name: "Load the completeness-expert skill for..."

2. **Minimize `@` even within SKILL.md.** Every `@` in SKILL.md unconditionally loads the referenced file into context when the skill fires — even if that content is only needed 10% of the time. This bloats initial token usage. Reserve `@` for content that MUST load every invocation. For supporting files (examples, reference docs, research), use relative markdown links with Read instructions so Claude loads them conditionally.

```markdown
❌ @RESEARCH.md  (loads ~60 lines every invocation — wasteful if only maintainers need it)
❌ @.claude/skills/completeness-expert/SKILL.md  (cross-skill coupling — breaks if skill moves)

✅ [RESEARCH.md](RESEARCH.md) - Use Read tool when modifying these rules or need background reasoning
✅ "Load the completeness-expert skill for banned patterns and scope-locking protocol"
```

Instead of embedding large content in SKILL.md, use relative markdown links with explicit Read instructions:

```markdown
## Examples
[Examples](EXAMPLES.md) - Use Read tool when need concrete usage patterns (provides 5 complete workflows)

## Reference Documentation
[Reference](REFERENCE.md) - Use Read tool when troubleshooting (30+ common issues with solutions)

## Type-Specific Guidance
[Expert guidance](expert/README.md) - Use Read tool when creating expert skills (40-item checklist)
```

**Benefits:**
- Keeps main file concise
- Organizes content logically
- Loads content on-demand with clear motivation
- Reduces token usage
- Portable across projects (no broken paths)

### Technique 2: External Scripts

Instead of inline code:

```markdown
## Validation
Use `scripts/validate.py` to check inputs

## Processing
Run `scripts/process.py` for data transformation
```

### Technique 3: External Templates

Instead of embedding templates:

```markdown
## Templates
- `templates/basic.txt` - Simple case
- `templates/advanced.txt` - Complex case
- `templates/full-featured.txt` - Complete example
```

### Technique 4: Split Large Skills

When a single skill exceeds 400-500 lines:
- Consider splitting into multiple focused skills
- Or use extensive @ references to externalize content
- Example: One 800-line skill → Multiple 200-line focused skills

**Target:** Main SKILL.md < 300 lines ideal, < 400 lines acceptable

### Technique 5: Content Compression

**Commands over explanations:** `cp .githooks/pre-commit .git/hooks/` not "Install hook by copying..."
**References over details:** "See .githooks/pre-commit" not 50-line explanation
**Bullets over paragraphs:** "Purpose: X | Status: Y" not "The directory is for..."
**No @ duplication:** Content in one file only; others reference it

**Example:** Git hook docs 54→13 lines (76% reduction, ~650 tokens/session)

## File Structure Patterns

Choose the right structure based on skill complexity:

### Minimal (Instructions Only)

```
my-skill/
└── SKILL.md
```

**Use for:**
- Pure instruction skills
- Conventions and checklists
- Simple guidance
- < 200 lines total

### Simple (With Examples)

```
my-skill/
├── SKILL.md
└── EXAMPLES.md
```

**Use for:**
- Skills with many examples that would clutter main file
- Examples can be externalized
- 200-400 lines total

### Template-Based

```
my-skill/
├── SKILL.md
├── EXAMPLES.md
└── templates/
    ├── basic.txt
    └── advanced.txt
```

**Use for:**
- File generation
- Boilerplate creation
- Multiple template variations

### Script-Powered

```
my-skill/
├── SKILL.md
├── REFERENCE.md
└── scripts/
    ├── validate.py
    └── process.py
```

**Use for:**
- Validation and processing
- Complex transformations
- Computational tasks

**Important:** When referencing bundled scripts, use the skill invocation header path for portability. See [TOKEN-OPTIMIZATION.md Pattern 6: Script/Asset References](TOKEN-OPTIMIZATION.md#pattern-6-scriptasset-references-bundled-scripts) for the recommended pattern.

### Complex (Multiple References)

```
my-skill/
├── SKILL.md
├── [TYPE-SPECIFIC].md
├── EXAMPLES.md
├── REFERENCE.md
└── templates/ or scripts/
```

**Use for:**
- Comprehensive skills with extensive guidance
- Multiple aspects (investigation + checklists + examples)
- Domain-heavy skills (expert skills often use this)

### Sub-Folder Organization (Advanced)

```
my-skill/
├── SKILL.md
├── UNIVERSAL.md
├── type1/
│   ├── README.md
│   └── template.md
├── type2/
│   ├── README.md
│   └── template.md
└── validation/
    └── README.md
```

**Use for:**
- Meta-skills (claude-skill-builder itself uses this)
- Multiple distinct types with separate guidance
- High complexity requiring clear organization

### Protocol-Per-File (Operation Variance)

```
my-skill/
├── SKILL.md              ← Lean orchestrator
├── protocols/
│   ├── operation-a.md    ← Load only for operation A
│   ├── operation-b.md    ← Load only for operation B
│   └── operation-c.md    ← Load only for operation C
└── troubleshooting.md    ← Load only on errors
```

**Use for:**
- Skills with 3+ distinct, mutually exclusive operations
- Operations that are never used together
- Significant token savings (40-60% per operation)

**See:** [TOKEN-OPTIMIZATION.md Pattern 5: Protocol-Per-File](TOKEN-OPTIMIZATION.md#pattern-5-protocol-per-file-operation-variance) for complete guidance and case study.

## Installation Locations

### Personal Skills: `~/.claude/skills/skill-name/`

**Characteristics:**
- Available across all your projects
- Your personal workflows and preferences
- Not shared with team members
- Not in version control

**When to use:**
- General-purpose utilities
- Personal coding preferences
- Cross-project patterns
- Your common workflows
- Skills you use everywhere

### Project Skills: `.claude/skills/skill-name/`

**Characteristics:**
- Checked into version control
- Shared with your team
- Project-specific conventions and patterns
- Available to all team members

**When to use:**
- Project-specific conventions
- Team standards
- Project architecture patterns
- Domain-specific knowledge for this project
- Skills specific to this codebase

### Default Choice

**Personal skills** for general-purpose utilities (e.g., "python-tester", "react-component-generator")

**Project skills** for project-specific conventions (e.g., "our-api-patterns", "our-code-style")

## Scope-Specific Content Strategies

**Critical insight:** The skill's scope determines its content strategy. This is one of the most important decisions in skill creation.

### User-Scoped Skills: Self-Contained

| Location | `~/.claude/skills/` |
|----------|---------------------|
| **Content Strategy** | Self-contained with inline examples |
| **Why** | Cannot reference project files - must work anywhere |
| **Examples** | Include complete code snippets in SKILL.md or EXAMPLES.md |
| **Trade-offs** | Larger skill files, but portable and always works |

**When to use:**
- General-purpose utilities (testing, linting, code generation)
- Personal workflows across multiple projects
- Cross-project patterns that don't depend on specific codebases
- Skills you want to use everywhere

**Content approach:**
```markdown
## Example: Creating a Component

```typescript
// Complete inline example
export function MyComponent({ title }: Props) {
  return <div>{title}</div>;
}
```
```

### Project-Scoped Skills: Show Not Tell

| Location | `.claude/skills/` |
|----------|-------------------|
| **Content Strategy** | Reference actual project files |
| **Why** | Codebase IS the source of truth - avoid stale duplicated examples |
| **Examples** | File reference tables with "Read When" guidance |
| **Trade-offs** | Smaller files, always current, but tied to project structure |

**When to use:**
- Project-specific conventions and patterns
- Team standards that apply to this codebase
- Domain knowledge tied to specific implementations
- Skills that document how THIS project works

**Content approach:**
```markdown
## Key Files - Read When Needed

| Purpose | File | Read When |
|---------|------|-----------|
| Base class | `src/Base.cs` | Understanding the pattern |
| Reference impl | `src/Example.cs` | Complete working example |
| Configuration | `docs/CONFIG.md` | Setup and options |
```

### The "Show Not Tell" Pattern for Project Skills

**Principle:** For project-scoped skills, point to real files instead of duplicating code.

**Why this matters:**

| Concern | Inline Examples | File References |
|---------|-----------------|-----------------|
| **Freshness** | Can become stale | Always current |
| **Maintenance** | Must update skill when code changes | Zero maintenance |
| **Token usage** | High (duplicated content) | Low (just paths) |
| **Accuracy** | May diverge from reality | IS reality |

**Pattern structure:**

```markdown
## Reference Files

| Purpose | File | Read When |
|---------|------|-----------|
| [What it demonstrates] | `path/to/file` | [When agent should read it] |
```

**Real example (from akn-generator-developer skill):**

Before (891 lines with inline code):
```markdown
## Creating a Generator

Here's an example generator implementation:

```csharp
public class MyGenerator : SimpleGenerator<MyInput, MyState>
{
    // 50+ lines of duplicated code from actual generator
}
```
```

After (182 lines with file references):
```markdown
## Key Files - Read When Needed

| Purpose | File | Read When |
|---------|------|-----------|
| Base generator | `Akn/Generators/SimpleGenerator.cs` | Understanding page templates |
| Reference impl | `Akn/Generators/CrosswordSimpleGenerator.cs` | Complete generator example |
| Adding types | `Akn/Generators/CreatingGeneratorTypeDoc.md` | Full checklist for new types |
```

**Result:** 79% reduction (891 → 182 lines), always current, zero maintenance

### Scope Decision Tree

```
Is this skill for a specific project/codebase?
├─ No → User-scoped (~/.claude/skills/)
│       → Self-contained with inline examples
│       → Must work without project files
│
└─ Yes → Project-scoped (.claude/skills/)
        → Does it need to reference actual code?
        ├─ Yes → "Show not tell" with file tables
        │       → Codebase is source of truth
        │
        └─ No → Can still use inline examples
                → Consider if file refs would help
```

### Validating Scope-Appropriate Content

**For user-scoped skills, verify:**
- [ ] All examples are inline and complete
- [ ] No references to project-specific files
- [ ] Skill would work if copied to any project
- [ ] No assumptions about project structure

**For project-scoped skills, verify:**
- [ ] File reference tables used where applicable
- [ ] "Read When" guidance provided for each file
- [ ] No duplicated code that exists in codebase
- [ ] Referenced files actually exist
- [ ] Skill documents how to navigate the codebase

## Skill Hot-Reload

Since Claude Code v2.1.0, skills **hot-reload automatically** when files change. No session restart needed.

- Skills in `~/.claude/skills/` and `.claude/skills/` are watched for changes
- Skills in directories added via `--add-dir` are also watched
- Modified or newly created skills become available immediately

**Do NOT tell users to "start a new conversation" after skill changes.** This was required before v2.1.0 but is no longer necessary.

See [reference/capabilities.md](reference/capabilities.md) for all v2.1+ features.

## @ Reference Syntax

⚠️ **CRITICAL: @ references resolve from PROJECT ROOT, NOT skill directory**

### Path Resolution

@ references resolve from the project root directory (e.g., `/path/to/project/`), NOT from the skill's SKILL.md location.

**This means:**
- `@expert/README.md` resolves to `/path/to/project/expert/README.md` (NOT `.claude/skills/your-skill/expert/README.md`)
- `@EXAMPLES.md` resolves to `/path/to/project/EXAMPLES.md` (NOT `.claude/skills/your-skill/EXAMPLES.md`)

### Valid Use Cases

✅ **Use @ ONLY for project-root files:**
- `@.claude/CLAUDE.md` - Project conventions file
- `@docs/api-standards.md` - Shared project documentation
- `@README.md` - Project README

These files exist at project root and @ references will work correctly.

### ❌ CANNOT Use @ for Skill-Internal Files

**@ references break skill portability when used for skill-internal files:**
- When skill is copied to another project
- When skill is renamed or reorganized
- When skill is shared with team members

**Example of what breaks:**
```markdown
# In your skill's SKILL.md:
See @expert/README.md  # ❌ Looks for /path/to/project/expert/README.md (WRONG)
                       # Your file is at .claude/skills/your-skill/expert/README.md
```

### ✅ Alternatives for Skill-Internal Files

**Option 1: Inline Critical Content**
```markdown
Copy content directly into SKILL.md (for <200 lines)
```

**Option 2: Use Relative Markdown Links + Read Instructions**
```markdown
[Expert guidance](expert/README.md)

Use Read tool on `expert/README.md` when creating expert skills (provides 40-item checklist)
```

**Option 3: Explicit Read Instructions with Motivation**
```markdown
**When creating expert skills:** Use Read tool on `expert/README.md`
**Why:** Provides 40-item quality checklist and investigation protocols
```

### Examples

**✅ Valid @ usage (project-root files):**
```markdown
See @.claude/CLAUDE.md for project conventions
See @docs/standards.md for coding standards
```

**❌ Invalid @ usage (skill-internal files):**
```markdown
See @expert/README.md     # Resolves to /path/to/project/expert/README.md (WRONG)
See @EXAMPLES.md          # Resolves to /path/to/project/EXAMPLES.md (WRONG)
See @validation/README.md # Resolves to /path/to/project/validation/README.md (WRONG)
```

**✅ Alternative for skill-internal files:**
```markdown
[Expert guidance](expert/README.md) - Use Read tool when creating expert skills
[Examples](EXAMPLES.md) - Reference material for patterns
[Validation checklist](validation/README.md) - Use Read tool for quality checks
```

### Two-Tier Pattern for Skill Files

**Tier 1: Inline (Immediate Scope)**
- Critical content needed for skill operation
- Frequently referenced information (>50% of invocations)
- Small content blocks (<200 lines)
- Criterion: Content must be immediately visible

**Tier 2: Progressive Disclosure (Read Instructions)**
- Reference material (examples, templates, detailed docs)
- Occasionally needed content (<50% of invocations)
- Large content blocks (>200 lines)
- **MUST include clear motivation:** WHEN to read and WHY valuable

**Example:**
```markdown
# Tier 1: Inline in SKILL.md
Core workflow steps (critical for operation)

# Tier 2: Progressive Disclosure
**When creating expert skills:** Use Read tool on `expert/README.md`
**Why:** Provides comprehensive patterns and 40-item checklist (765 lines)
```

## Bash Execution Syntax (Advanced)

Skills can execute bash commands when loaded using special syntax.

**Syntax**: !`command`

**Important for Documentation:**
Auto-loaded skill files (SKILL.md) process both `!`command`` (execution) and `$ARGUMENTS`/`$0`/`$1` (substitution). To display these literally, use the echo-hex technique:

**Escaping `$` variables** (works reliably):
```markdown
!`echo -e '\x24ARGUMENTS'`
!`echo -e '| \x60\x240\x60 | First positional argument |'`
```
- `\x24` = `$` (prevents variable substitution)
- `\x60` = backtick (prevents execution)

**Escaping bang-tick** (has limitation):
The system re-escapes `!`` in echo output, adding a `\` prefix. There is no workaround in auto-loaded files.

**Recommended approach — move examples to reference files:**
Reference files (loaded via Read tool) are NOT processed by the skill system. All syntax displays literally:

```markdown
# In SKILL.md — point to reference file:
**Template and examples:** Read `SYNTAX.md` — "Quick Reference Template" section

# In SYNTAX.md (reference file) — raw syntax works:
!`git status -sb`
$ARGUMENTS
$0
```

This is the correct pattern for any skill that needs to document bang-tick or argument variable syntax.

**Use Cases for bang-tick execution:**
- Get current git status
- Check environment variables
- Detect project structure
- Gather context dynamically

**Note**: This is an advanced feature. Most skills don't need it.

## Writing Principles

These principles apply to the *content* of all skill types — how you write instructions.

### Explain Why, Not Just What

For every important instruction, explain the reasoning behind it. Models with good theory of mind generalize better from understood principles than from rote commands. "Explain the why" produces more robust skills than "MUST do X" because the model can adapt to novel situations the skill author didn't anticipate.

- ❌ "ALWAYS use semantic HTML elements"
- ✅ "Use semantic HTML elements because screen readers depend on them for navigation, and search engines use them for content ranking"

If you find yourself writing ALWAYS or NEVER in all caps, that's a yellow flag — reframe with reasoning instead. Heavy-handed MUSTs produce brittle compliance; understood principles produce intelligent adaptation.

### Generalize, Don't Overfit

When improving a skill based on test results, resist the urge to add narrow fixes for specific test cases. Identify the underlying principle the skill is missing and teach that instead. A skill used thousands of times must handle diverse inputs — three working test cases don't prove generality.

Oppressively constrictive MUSTs and fiddly edge-case handling often make skills worse for the general case. If a stubborn issue resists direct instruction, try different metaphors, reframe the approach, or explain the underlying concept more clearly.

### Match Specificity to Fragility (Degrees of Freedom)

Match instruction specificity to the task's fragility:

| Task Fragility | Degrees of Freedom | Example |
|---------------|-------------------|---------|
| **Low fragility** (flexible) | High freedom — describe goals, let Claude choose approach | Code reviews, documentation, refactoring |
| **High fragility** (critical) | Low freedom — prescribe exact steps and validation | Database migrations, deployment scripts, security configs |

Over-specifying flexible tasks wastes tokens and constrains Claude unnecessarily. Under-specifying critical tasks risks dangerous mistakes. For low-fragility tasks, the *why* matters more than the *how*.

---

## Best Practices Summary

These apply to **all** skill types:

1. ✅ **Description is critical** - Spend most time getting this right (WHAT + WHEN + be pushy)
2. ✅ **Explain the why** - Pair instructions with reasoning; models generalize from understood principles
3. ✅ **Concise is key** - Only add context Claude doesn't already have. Challenge each piece: "Does this justify its token cost?"
4. ✅ **Start simple** - Begin minimal, expand as needed
5. ✅ **Use relative links + Read instructions** - Keep main file concise, externalize large content
6. ✅ **Include examples** - Always show concrete usage (positive + negative)
7. ✅ **Test discovery** - Verify trigger words work as expected; use `/skill-creator` for automated eval loops
8. ✅ **Optimize tokens** - Use external files for large content
9. ✅ **Follow structure patterns** - Use standard directories: `scripts/`, `references/`, `assets/`
10. ✅ **Validate everything** - Check YAML syntax, test references
11. ✅ **Match specificity to fragility** - Low-fragility tasks get high freedom; high-fragility tasks get exact steps
12. ✅ **Generalize, don't overfit** - Teach principles, not narrow fixes for specific test cases
13. ✅ **Iterate with evaluations** - Use `/skill-creator` for test cases, benchmarking, and description optimization
14. ✅ **Agent-optimize appropriately** - Apply core principles always; use structured formats only when complexity warrants it (see [AGENTIC.md](AGENTIC.md))

## Type-Specific Guidance

After understanding universal principles, see type-specific guidance:

- **[expert/README.md](expert/README.md)** - For domain knowledge and investigation-based skills
- **[cli/README.md](cli/README.md)** - For syntax and configuration-focused skills
- **[writer/README.md](writer/README.md)** - For documentation and content skills

Each type file builds on these universal principles with type-specific best practices, checklists, and patterns.

## Common Pitfalls (All Types)

### ❌ Avoid

- **Vague descriptions** - "Helps with coding" tells Claude nothing
- **Missing trigger words** - No WHEN scenarios = no auto-discovery
- **Blank lines before frontmatter** - Breaks YAML parsing
- **Multi-line descriptions** - Silently breaks discovery (see [reference/gotchas.md](reference/gotchas.md))
- **Monolithic files** - Everything in SKILL.md (hard to maintain)
- **No examples** - Abstract instructions without concrete usage
- **Invalid YAML** - Missing colons, unmatched quotes, wrong indentation
- **Broken references** - Links to files that don't exist
- **"When to Use" in body** - Put trigger info in `description` field, not the skill body (body loads AFTER discovery)

### ✅ Do

- **Specific descriptions** - List exact capabilities and scenarios
- **Multiple triggers** - 3-5 different WHEN scenarios
- **Valid YAML** - Test with YAML parser before shipping
- **Quote descriptions** - Use double quotes to prevent multi-line wrapping
- **Use relative links + Read instructions** - Keep main file concise
- **Provide examples** - Show actual usage, not just theory
- **Test references** - Verify all referenced files exist
- **Follow patterns** - Use established file structures

**Known bugs and workarounds:** See [reference/gotchas.md](reference/gotchas.md) for critical issues that can silently break skills.

## Quick Start Checklist

When creating any skill, verify these essentials. For complete validation, see [validation/README.md](validation/README.md).

- [ ] YAML frontmatter valid (no blank lines before, required fields present)
- [ ] Description follows WHAT + WHEN formula (see Description Engineering above)
- [ ] Description length 100-500 characters (ideal: 200-400 chars)
- [ ] Rich trigger keywords included
- [ ] File structure appropriate for complexity (see File Structure Patterns above)
- [ ] Relative links + Read instructions used for large content
- [ ] Main SKILL.md < 300-400 lines
- [ ] All referenced files exist
- [ ] Examples provided (inline or in separate EXAMPLES.md)
- [ ] Verified no known gotchas apply (see [reference/gotchas.md](reference/gotchas.md))

**Complete validation**: See [validation/README.md](validation/README.md) for comprehensive checklists (35 universal + 30-35 type-specific items)

**Evaluation-driven development**: For iterative improvement with automated test infrastructure, use `/skill-creator`. It provides eval runners, benchmarking, and description optimization. See [reference/best-practices.md](reference/best-practices.md) for Anthropic's recommended workflow.

## See Also

For type-specific details:
- **[expert/README.md](expert/README.md)** - Investigation protocols, principles-based approach, comprehensive checklists
- **[cli/README.md](cli/README.md)** - Syntax accuracy, validation patterns, configuration guidance
- **[writer/README.md](writer/README.md)** - Audience analysis, structure templates, writing quality criteria

For skill management:
- **[validation/README.md](validation/README.md)** - Post-creation validation checklist
- **[reference/README.md](reference/README.md)** - Troubleshooting, advanced topics, edge cases

For reference material:
- **[reference/frontmatter.md](reference/frontmatter.md)** - Complete YAML frontmatter field reference (10 fields, invocation control, string substitutions)
- **[reference/best-practices.md](reference/best-practices.md)** - Official Anthropic guidance (concise-is-key, degrees of freedom, evaluation-driven development)
- **[reference/gotchas.md](reference/gotchas.md)** - Known bugs and workarounds (multi-line description, context:fork, compaction loss)
- **[reference/capabilities.md](reference/capabilities.md)** - New features since v2.1 (hot-reload, commands merger, nested discovery)
- **[reference/community-patterns.md](reference/community-patterns.md)** - Community patterns (forced-eval hooks, file-path triggering, auto-generated skills)
