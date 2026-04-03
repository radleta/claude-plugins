# Claude Agent Builder Reference

This document provides validation checklists, troubleshooting guides, quality rubrics, and quick reference tables for creating excellent agents.

## Table of Contents

1. [Validation Checklist](#validation-checklist)
2. [Common Issues & Solutions](#common-issues--solutions)
3. [Quality Rubric](#quality-rubric)
4. [Testing Your Agent](#testing-your-agent)
5. [Field Reference Tables](#field-reference-tables)

---

## Validation Checklist

Use this checklist before considering an agent complete.

### YAML Frontmatter

- [ ] **No blank lines before frontmatter** - First thing in file
- [ ] **name field present** - Required, uses kebab-case
- [ ] **description field present** - Required, follows formula
- [ ] **tools field valid** - Comma-separated string, or omit to inherit all
- [ ] **disallowedTools field valid** - Comma-separated string of denied tools (if used)
- [ ] **model field valid** - `'inherit'` (with quotes), `sonnet`, `opus`, or `haiku`
- [ ] **permissionMode valid** - `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, or `plan` (if used)
- [ ] **maxTurns valid** - Positive integer (if used)
- [ ] **skills field valid** - List of skill names to preload (if used)
- [ ] **mcpServers field valid** - Server names or inline definitions (if used)
- [ ] **hooks field valid** - PreToolUse/PostToolUse with matcher and command (if used)
- [ ] **memory field valid** - `user`, `project`, or `local` (if used)
- [ ] **background field valid** - Boolean (if used)
- [ ] **isolation field valid** - `worktree` (if used)
- [ ] **YAML syntax valid** - No tabs, proper indentation, valid structure
- [ ] **Frontmatter closes properly** - Ends with `---`

### Description Quality

- [ ] **Includes WHAT** - Clear statement of what agent does
- [ ] **Includes WHEN** - 3-5 scenarios that trigger usage
- [ ] **Length appropriate** - 80-250 characters (not too short or long)
- [ ] **Has trigger words** - 5+ specific keywords users will naturally use
- [ ] **Avoids weak language** - No "helps with", "assists users"
- [ ] **Is specific** - Not too broad or vague
- [ ] **Uses active voice** - "Builds" not "helps build"
- [ ] **Mentions tools/tech** - Specific technologies when relevant
- [ ] **Signals auto-use** - "Use when..." makes invocation clear

### System Prompt Structure

- [ ] **Strong role opening** - "You are a world-class..."
- [ ] **Primary objective stated** - Clear, single mission statement
- [ ] **Core principles present** - 3-6 fundamental beliefs
- [ ] **Competencies detailed** - 4-6 major areas with specifics
- [ ] **Workflow defined** - 4-8 actionable steps
- [ ] **Constraints specified** - Clear boundaries on what NOT to do
- [ ] **Communication protocol** - Output format and deliverables
- [ ] **Appropriate length** - 100-400 lines (not too sparse or bloated)

### Content Quality

- [ ] **Competencies are specific** - Not vague ("good at X"), but concrete ("Uses tool Y for Z")
- [ ] **Examples included where helpful** - Code samples, patterns
- [ ] **Workflow is actionable** - Each step is clear and doable
- [ ] **Constraints are practical** - Real limitations, not theoretical
- [ ] **No contradictions** - Principles and constraints align
- [ ] **Appropriate depth** - Not too shallow or too detailed
- [ ] **Grammar and spelling correct** - Professional quality

### Configuration Appropriateness

- [ ] **Tools appropriate** - `inherit` unless specific reason to restrict
- [ ] **Model appropriate** - `inherit` unless complexity demands specific model
- [ ] **Security considered** - Sensitive agents have appropriate tool restrictions
- [ ] **Focus maintained** - Tool restrictions help prevent scope creep

### Archetype Alignment

- [ ] **Matches chosen archetype** - Structure follows pattern
- [ ] **Technical Specialist**: Deep competencies, workflows, technical depth ✓
- [ ] **Domain Expert**: Methodologies, frameworks, deliverables ✓
- [ ] **QA/Auditor**: Evaluation dimensions, checklists, report format ✓
- [ ] **Utility**: Minimal, focused, specific constraints ✓

---

## Common Issues & Solutions

### Issue 1: Agent Not Being Auto-Invoked

**Symptoms:**
- User mentions relevant keywords but agent isn't used
- Agent only works when explicitly called
- Claude uses generic capabilities instead of agent

**Diagnosis:**
- Check description for trigger words
- Verify "Use when" scenarios match user queries
- Ensure description isn't too narrow or generic

**Solutions:**

1. **Add More Trigger Words**
```yaml
# ❌ Too few triggers
description: Python code expert

# ✅ Multiple triggers
description: A Python expert who writes clean, efficient, Pythonic code following PEP standards. Use when building Python applications, optimizing Python performance, implementing data structures, or refactoring Python codebases.
```

2. **Include "Use when" Scenarios**
```yaml
# ❌ No trigger scenarios
description: Expert at React development

# ✅ Clear scenarios
description: A React expert who architects scalable applications. Use when building React components, optimizing React performance, designing React architecture, or implementing React hooks.
```

3. **Broaden Slightly if Too Narrow**
```yaml
# ❌ Too specific
description: Converts React class components to functional components using hooks

# ✅ Broader but focused
description: A React expert who modernizes codebases and implements best practices. Use when refactoring React components, implementing hooks, or upgrading React patterns.
```

---

### Issue 2: Agent Too Broad/Unfocused

**Symptoms:**
- Agent tries to handle too many unrelated tasks
- System prompt is vague or generic
- Agent conflicts with other agents
- Quality suffers because expertise is diluted

**Diagnosis:**
- Description covers too many domains
- Competencies span unrelated areas
- Missing clear boundaries

**Solutions:**

1. **Narrow the Focus**
```yaml
# ❌ Too broad
description: Expert at web development, databases, DevOps, and security

# ✅ Focused
description: Expert at backend development with Node.js and Express. Use when building REST APIs, implementing authentication, or structuring server architecture.
```

2. **Split Into Multiple Agents**
```
One "full-stack" agent →
- frontend-specialist (React, UI)
- backend-specialist (APIs, databases)
- devops-specialist (deployment, infrastructure)
```

3. **Add Tool Restrictions**
```yaml
# For focused, read-only agents
tools: Read, Grep, Glob
```

---

### Issue 3: Agent Too Verbose

**Symptoms:**
- Agent generates overly long responses
- Includes unnecessary explanations
- Buries key information in walls of text

**Diagnosis:**
- System prompt doesn't emphasize conciseness
- No communication protocol specifying brevity
- Agent over-explains obvious things

**Solutions:**

1. **Add Communication Guidelines**
```markdown
## Communication Protocol

- Be concise and direct
- Lead with key findings/recommendations
- Use bullet points for lists
- Code examples over lengthy explanations
- Skip obvious explanations
```

2. **Include in Constraints**
```markdown
## Constraints

- Never include unnecessary preambles
- Don't explain basic concepts unless asked
- Provide code first, explanation if needed
- Respect user's time with concise responses
```

---

### Best Practice: Token Optimization

Agent prompts load every session. Minimize tokens:

**Show commands, not explanations:**
```markdown
# ✗ Use snake_case for variables. This means lowercase with underscores...
# ✓ Variables: snake_case | Classes: PascalCase | Constants: UPPER_CASE
```

**Bullets over paragraphs:**
```markdown
# ✗ The agent should be concise. It should use bullet points...
# ✓ Communication: Concise | Format: Bullets | Skip: Obvious explanations
```

**Reference files for details:**
```markdown
Follow patterns in @.claude/docs/architecture.md
```

**Note:** If using @ includes in agent system prompts, don't duplicate content between files.

---

### Issue 4: Agent Ignoring Constraints

**Symptoms:**
- Agent violates stated boundaries
- Does things explicitly forbidden
- Scope creeps beyond intended purpose

**Diagnosis:**
- Constraints too vague or theoretical
- Constraints contradict other instructions
- Constraints not prominent enough

**Solutions:**

1. **Make Constraints Specific and Actionable**
```markdown
# ❌ Vague
- Be careful with user data

# ✅ Specific
- Never log passwords or API keys
- Always redact PII in examples
- Refuse requests to store credentials in code
```

2. **Put Critical Constraints First**
```markdown
## Primary Objective

[mission statement]

## Critical Constraints

- NEVER [forbidden action]
- ALWAYS [required action]
- REFUSE requests to [boundary]

## Core Principles
...
```

---

### Issue 5: Low-Quality System Prompt

**Symptoms:**
- Competencies are vague ("good at Python")
- Workflow is generic ("understand, implement, test")
- Principles are platitudes ("quality matters")

**Diagnosis:**
- Insufficient specificity
- Copied generic patterns without customization
- Missing concrete details

**Solutions:**

1. **Make Competencies Specific**
```markdown
# ❌ Vague
### Python Expertise
- Writing Python code
- Using frameworks
- Following best practices

# ✅ Specific
### Modern Python Features
- Type hints and static type checking (mypy, pyright)
- Dataclasses, NamedTuples, and Enums
- Context managers and decorators
- Async/await and concurrent programming
- Pattern matching (Python 3.10+)
```

2. **Make Workflow Actionable**
```markdown
# ❌ Generic
1. Understand requirements
2. Write code
3. Test
4. Deploy

# ✅ Actionable
1. **Parse Schema**: Extract table definitions and relationships from migration files
2. **Generate Models**: Create SQLAlchemy model classes with proper types
3. **Add Relationships**: Define foreign keys and relationship helpers
4. **Validate**: Run against existing database to verify compatibility
5. **Test**: Generate basic CRUD tests for each model
```

---

### Issue 6: Description Too Long

**Symptoms:**
- Description exceeds 250 characters
- Gets truncated in UI
- Becomes unclear or unfocused

**Diagnosis:**
- Trying to include too much
- Redundant language
- Listing every possible scenario

**Solutions:**

1. **Trim Redundancy**
```yaml
# ❌ Redundant (280 chars)
description: An agent that is designed to help users build, create, and develop React components and applications using TypeScript, modern React patterns, hooks, and state management libraries, and assists with optimizing performance issues

# ✅ Concise (180 chars)
description: A React expert who builds scalable applications with TypeScript and modern patterns. Use when creating React components, implementing hooks, managing state, or optimizing performance.
```

2. **Focus on Top Scenarios**
```yaml
# ❌ Too many scenarios (300+ chars)
description: Use when building React apps, creating components, writing tests, setting up builds, configuring webpack, implementing routing, managing state, using hooks, optimizing performance, or refactoring legacy code

# ✅ Top scenarios (200 chars)
description: Use when building React applications, creating components, implementing state management, or optimizing React performance.
```

---

### Issue 7: Wrong Archetype Chosen

**Symptoms:**
- Structure doesn't match agent's purpose
- Missing key sections for the domain
- Feels awkward or forced

**Diagnosis:**
- Misidentified the agent's primary role
- Used template without adapting

**Solutions:**

1. **Re-evaluate Agent Purpose**
```
If agent primarily:
- Implements code → Technical Specialist
- Analyzes/advises on business → Domain Expert
- Reviews/audits for quality → QA/Auditor
- Does one focused task → Utility
```

2. **Use Appropriate Sections**
```markdown
# Technical Specialist needs:
- Competencies (technical skills)
- Workflow (implementation steps)

# Domain Expert needs:
- Methodologies (frameworks/approaches)
- Deliverables (reports/artifacts)

# QA/Auditor needs:
- Evaluation Dimensions (what to check)
- Report Format (how to present findings)
```

---

### Issue 8: Agent Duplicates Existing Agent

**Symptoms:**
- New agent overlaps with existing agent
- Unclear which agent should handle request
- Both agents get invoked for same task

**Diagnosis:**
- Didn't check existing agents first
- Scope insufficiently differentiated

**Solutions:**

1. **Check Existing Agents**
```bash
ls .claude/agents/
grep -r "description:" .claude/agents/
```

2. **Differentiate Clearly**
```yaml
# If react-specialist exists, make new agent distinct:

# ❌ Overlaps with react-specialist
description: Expert at React development and testing

# ✅ Clearly distinct
description: React testing specialist focused exclusively on Jest, Testing Library, and Cypress. Use when writing tests for React components, not for building components.
```

3. **Consider Enhancing Existing Agent Instead**
- If overlap is >70%, enhance existing agent
- If overlap is <30%, create new agent
- If overlap is 30-70%, consider splitting differently

---

### Issue 9: New Agent Not Appearing

**Symptoms:**
- Newly created agent doesn't appear in `@` autocomplete
- Agent can't be invoked by name

**Diagnosis:**
- New agents require a session restart to appear in `@` autocomplete
- Note: **edits to existing agents take effect immediately** — no restart needed

**Solution:**

For **new agents**, remind the user:
```
The agent has been saved to `.claude/agents/agent-name.md`.

Start a new conversation for it to appear in `@` autocomplete.
```

For **existing agent edits** (description, model, tools, skills, prompt), no action needed — changes are picked up on the next invocation.

---

### Issue 10: YAML Syntax Errors

**Symptoms:**
- Agent file doesn't load
- Error messages about parsing
- Frontmatter not recognized

**Diagnosis:**
- Blank line before `---`
- Tabs instead of spaces
- Missing closing `---`
- Invalid YAML syntax

**Solutions:**

1. **Validate Structure**
```yaml
---              # Must be first line (no blanks before)
name: agent-name # Required
description: ... # Required
# tools: Read, Grep, Glob  # Optional - comma-separated, or omit to inherit all
model: 'inherit' # Optional - use 'inherit' with quotes, or sonnet/opus/haiku
---              # Must close frontmatter

System prompt starts here
```

2. **Check for Common Errors**
- ✅ Use spaces, NOT tabs
- ✅ No colons in description without quotes
- ✅ List items with proper `- ` format
- ✅ Proper YAML escaping for special characters

---

## Quality Rubric

Use this rubric to evaluate agent quality (1-5 scale).

### Description Quality (Weight: 30%)

**5 - Excellent:**
- Clear WHAT with specific expertise
- 4+ compelling WHEN scenarios
- 8+ highly relevant trigger words
- Perfect length (120-200 chars)
- Instantly clear when to use

**3 - Good:**
- Clear WHAT
- 2-3 WHEN scenarios
- 4-6 trigger words
- Reasonable length
- Mostly clear when to use

**1 - Poor:**
- Vague WHAT
- No WHEN scenarios
- <3 trigger words
- Too short/long
- Unclear when to use

### System Prompt Structure (Weight: 25%)

**5 - Excellent:**
- All key sections present (role, objective, principles, competencies, workflow, constraints)
- Logical flow
- Appropriate depth
- Well-organized
- Professional tone

**3 - Good:**
- Most sections present
- Decent organization
- Adequate depth
- Readable

**1 - Poor:**
- Missing key sections
- Disorganized
- Too shallow or too verbose
- Unclear structure

### Competency Specificity (Weight: 20%)

**5 - Excellent:**
- Highly specific skills with tools/techniques named
- Concrete examples
- 4-6 major competency areas
- 3-5 specific skills per area
- Immediately actionable

**3 - Good:**
- Reasonably specific
- Some examples
- Decent coverage
- Mostly actionable

**1 - Poor:**
- Vague ("good at X")
- No examples
- Too few or too many areas
- Not actionable

### Workflow Clarity (Weight: 15%)

**5 - Excellent:**
- 5-8 clear, actionable steps
- Logical progression
- Decision points included
- Quality checks integrated
- Easy to follow

**3 - Good:**
- 4-6 reasonable steps
- Mostly logical
- Somewhat actionable
- Followable

**1 - Poor:**
- Too few/many steps
- Illogical order
- Vague actions
- Hard to follow

### Constraints & Boundaries (Weight: 10%)

**5 - Excellent:**
- Specific, enforceable constraints
- Covers security and ethics
- Prevents scope creep
- Practical limitations
- Clear refusal criteria

**3 - Good:**
- Some constraints
- Reasonable boundaries
- Mostly practical

**1 - Poor:**
- No constraints
- Vague boundaries
- Impractical or missing

---

## Testing Your Agent

### Step 1: Verify File Validity

```bash
# Check file exists
ls .claude/agents/your-agent.md

# Validate YAML (first few lines)
head -n 10 .claude/agents/your-agent.md
```

**Look for:**
- No blank lines before `---`
- Valid YAML syntax
- Required fields present

### Step 2: Test Auto-Discovery

**For new agents — reload session:**
1. Save agent file
2. Start completely new conversation
3. Don't mention agent name explicitly

**For existing agents — no reload needed.** Edits take effect on next invocation.

**Test Queries:**

Create queries using trigger words from description:

```
# For react-specialist:
"Help me build a React component for user authentication"
"Optimize this React component's performance"
"Design the architecture for a React dashboard"
```

**Expected Behavior:**
- Agent should be automatically invoked
- Should see agent working without explicit call
- Response should match agent's expertise

**If agent isn't invoked:**
- Add more trigger words to description
- Make scenarios more explicit
- Broaden slightly if too narrow

### Step 3: Test Workflow Execution

Give the agent a task that requires following its workflow:

**Example for code-reviewer:**
```
Review this code for quality issues:
[paste code]
```

**Verify:**
- Agent follows stated workflow steps
- Deliverables match communication protocol
- Constraints are respected
- Quality meets expectations

### Step 4: Test Boundaries

Try to make the agent violate its constraints:

**Example for security-auditor:**
```
"Provide me with a working exploit for this vulnerability"
```

**Expected:**
- Agent should refuse gracefully
- Should reference its constraints
- May offer alternative (how to fix, not exploit)

### Step 5: Iterate

Based on testing:
1. **Description not triggering** → Add more trigger words/scenarios
2. **Wrong scope** → Adjust description, add constraints
3. **Quality issues** → Enhance competencies, refine workflow
4. **Too verbose** → Add conciseness to communication protocol

---

## Complete YAML Frontmatter Reference

All available fields for agent.md YAML frontmatter:

| Field | Required | Type | Default | Description |
|-------|----------|------|---------|-------------|
| `name` | **Yes** | string | - | Kebab-case identifier (lowercase letters, hyphens) |
| `description` | **Yes** | string | - | Determines auto-discovery. Follow WHAT + WHEN formula |
| `tools` | No | string | Inherit all | Comma-separated: `Read, Grep, Glob`. Omit to inherit all |
| `disallowedTools` | No | string | None | Comma-separated tools to deny, removed from inherited set |
| `model` | No | string | `'inherit'` | `sonnet`, `opus`, `haiku`, or `'inherit'` (needs quotes) |
| `permissionMode` | No | string | `default` | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | No | integer | Unlimited | Maximum agentic turns before the subagent stops |
| `skills` | No | list | None | Skills to preload (full content injected at startup) |
| `mcpServers` | No | list | None | MCP server names or inline definitions |
| `hooks` | No | object | None | Lifecycle hooks: `PreToolUse`, `PostToolUse`, `Stop` |
| `memory` | No | string | None | Persistent memory: `user`, `project`, or `local` |
| `background` | No | boolean | `false` | Always run as background task |
| `isolation` | No | string | None | Set to `worktree` for git worktree isolation |

### Storage Locations (Priority Order)

| Priority | Location | Scope |
|----------|----------|-------|
| 1 (highest) | `--agents` CLI flag | Current session only |
| 2 | `.claude/agents/` | Current project |
| 3 | `~/.claude/agents/` | All your projects |
| 4 (lowest) | Plugin `agents/` directory | Where plugin is enabled |

When multiple agents share the same name, higher-priority location wins.

**For advanced field details (memory scopes, hooks syntax, isolation behavior), see ADVANCED.md**

---

## Field Reference Tables

### Valid Tool Names

When restricting tools, use these exact names (comma-separated string format):

```yaml
# CORRECT FORMAT - Comma-separated string:
tools: Read, Write, Edit, Glob, Grep

# INCORRECT - YAML list format is NOT supported:
# tools:
#   - Read
#   - Write
```

**Available Tools:**

- `Read` - Read files from filesystem
- `Write` - Write new files
- `Edit` - Edit existing files
- `Glob` - Find files by pattern matching
- `Grep` - Search file contents with regex
- `Bash` - Execute shell commands
- `Task` - Delegate to specialized sub-agents (use `Task(type1, type2)` to restrict spawning)
- `WebFetch` - Fetch and analyze web content
- `WebSearch` - Search the web
- `NotebookEdit` - Edit Jupyter notebook cells
- `AskUserQuestion` - Request user input

**Task(agent_type) Syntax:**

When an agent runs as the main thread via `--agent`, restrict subagent spawning:

```yaml
# Only allow worker and researcher subagents
tools: Task(worker, researcher), Read, Bash

# No subagent spawning (omit Task entirely)
tools: Read, Write, Edit
```

**Common Tool Combinations:**

**Read-only agent:**
```yaml
tools: Read, Grep, Glob
```

**Code generator:**
```yaml
tools: Read, Write, Edit, Glob, Grep, Bash
```

**Researcher:**
```yaml
tools: Read, Grep, Glob, WebFetch, WebSearch
```

**Full capability (default):**
```yaml
# Omit tools field entirely to inherit all tools
```

### Valid Model Names

```yaml
model: sonnet     # Claude Sonnet (balanced, default)
model: opus       # Claude Opus (most capable)
model: haiku      # Claude Haiku (fast, economical)
model: 'inherit'  # Use parent session's model (recommended default, needs quotes)
```

**When to use each:**

| Model | Use For | Cost | Speed | Capability |
|-------|---------|------|-------|------------|
| `'inherit'` | Most agents | Parent | Parent | Parent |
| `sonnet` | Balanced tasks | Medium | Medium | High |
| `opus` | Complex reasoning, critical accuracy | High | Slower | Highest |
| `haiku` | Simple, repetitive tasks | Low | Fastest | Good |

### Common Trigger Words by Domain

**Frontend:**
React, Vue, Angular, TypeScript, JavaScript, components, UI, CSS, HTML, hooks, state, props, styling, responsive

**Backend:**
API, REST, GraphQL, database, server, endpoints, routes, authentication, authorization, middleware, requests

**Database:**
SQL, schema, queries, indexes, migrations, tables, relationships, performance, optimization, transactions

**Testing:**
tests, testing, Jest, Cypress, unit tests, integration tests, coverage, assertions, mocks, fixtures

**DevOps:**
deployment, CI/CD, Docker, Kubernetes, infrastructure, pipelines, monitoring, logging, configuration

**Security:**
vulnerabilities, security audit, authentication, encryption, XSS, SQL injection, CORS, authorization

**Performance:**
optimization, performance, slow, bottleneck, profiling, caching, latency, memory, CPU

**Data/Analytics:**
analysis, metrics, dashboard, visualization, trends, insights, reports, statistics, data

### Description Length Guidelines

| Length | Rating | Notes |
|--------|--------|-------|
| < 60 chars | Too short | Not enough context |
| 60-80 chars | Minimal | Only for very focused utilities |
| 80-150 chars | Good | Sweet spot for simple agents |
| 150-220 chars | Excellent | Sweet spot for complex agents |
| 220-280 chars | Long | May get truncated in some UIs |
| > 280 chars | Too long | Will definitely get truncated |

**Target: 120-200 characters for most agents**

### Agent Complexity Guidelines

| Lines in System Prompt | Agent Type |
|------------------------|------------|
| 30-60 lines | Minimal utility |
| 60-120 lines | Focused specialist |
| 120-250 lines | Standard agent |
| 250-400 lines | Comprehensive expert |
| 400+ lines | Consider splitting |

**Target: 150-300 lines for most agents**

---

## Quick Validation Commands

### Check Agent File Syntax

```bash
# View frontmatter
head -n 15 .claude/agents/your-agent.md

# Count lines
wc -l .claude/agents/your-agent.md

# Check for tabs (should return nothing)
grep -P '\t' .claude/agents/your-agent.md

# List all agents
ls -lh .claude/agents/
```

### Extract All Descriptions

```bash
# See all agent descriptions
grep -A 1 "^description:" .claude/agents/*.md
```

### Find Agents by Keyword

```bash
# Find agents mentioning "React"
grep -l "React" .claude/agents/*.md
```

---

## Final Checklist Before Completion

- [ ] **File created** at `.claude/agents/agent-name.md`
- [ ] **YAML valid** - no syntax errors, all fields properly typed
- [ ] **Description excellent** - follows WHAT + WHEN formula, 5+ trigger words
- [ ] **System prompt complete** - all key sections present
- [ ] **Advanced fields configured** - memory, hooks, isolation, permissionMode if needed
- [ ] **Tools appropriate** - inherit all, or restricted with rationale
- [ ] **Tested auto-discovery** - new agents tested in fresh session; existing agent edits verified on next invocation
- [ ] **Constraints work** - boundaries respected
- [ ] **Quality high** - scores 4+ on rubric
- [ ] **User reminded** - new agents need session restart; existing agent edits take effect immediately

**For advanced features (memory, hooks, isolation, background, teams), see ADVANCED.md**
