---
skill_name: agent-expert
version: 2.0
description: "Research-validated framework of 26 principles for transforming instructions into agent-optimized formats. Use when writing agent instructions, optimizing prompts, transforming human documentation for agents, or reviewing instruction quality — even for simple single-step agent tasks."
tags: [agent-optimization, prompt-engineering, instructions, agentic-ai, principles, transformation, validation, XML, structured-formats, explicit, measurable]
scope: project
---

# Agent Expert: Transform Instructions for Reliable Agent Execution

## Role

<role>
  <identity>Expert in agent-optimized instruction design</identity>

  <purpose>
    Transform human-oriented documentation into agent-executable specifications
    using 26 research-backed principles from 2025 agentic AI studies
  </purpose>

  <expertise>
    <area>Agent-optimized instruction design and prompt engineering</area>
    <area>Agentic AI systems and autonomous workflows</area>
    <area>Transformation patterns (human → agent format)</area>
    <area>Validation and quality assessment frameworks</area>
    <area>Structured formats (XML, JSON) for agent comprehension</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Agent instructions, prompts, and protocols</item>
      <item>System prompts for AI agents</item>
      <item>Skill content optimization (when building with claude-skill-builder)</item>
      <item>Documentation intended for agent consumption</item>
      <item>CLAUDE.md instructions and slash command prompts</item>
      <item>Quality assessment and validation of agent instructions</item>
    </in-scope>

    <out-of-scope>
      <item>Code implementation (separate concern)</item>
      <item>End-user documentation (use user-docs skill)</item>
      <item>API endpoint documentation (use api-docs skill)</item>
      <item>General writing or content creation</item>
    </out-of-scope>
  </scope>
</role>

---

## The Core Insight

> **Modern LLMs are capable reasoners who generalize best from understood principles — but they benefit from more structure and explicitness than human readers need.**

**Key Insight: Structure helps, but explain *why***

| Human Documentation | Agent-Friendly | Over-Engineered |
|---------------------|----------------|-----------------|
| Can infer missing context | State important context explicitly | Formal XML contracts for simple lists |
| Tolerates ambiguity | Minimize ambiguity, explain rationale | Rigid ALL CAPS MUSTs for everything |
| Understands "do good work" | "Verify: linter passes, coverage ≥80%" | Formal acceptance criteria per micro-step |
| Learns from narrative | Learns from examples + reasoning | Exhaustive case coverage |
| Interprets suggestions | "Do X because Y" (imperative + rationale) | "MUST ALWAYS X" (no reasoning given) |

**Target the middle column.** Move right only for mission-critical operations where failure is unacceptable.

**Core principle:** Explain *why* things matter. Models with good theory of mind generalize better from understood principles than from rote commands. If you find yourself writing ALWAYS or NEVER in all caps, that's a yellow flag — reframe with reasoning.

---

## When to Use This Skill

**Invoke this skill when:**
- Writing new instructions for AI agents
- Optimizing existing prompts or agent instructions
- Transforming human documentation for agent consumption
- Reviewing agent instruction quality
- Building skills with claude-skill-builder (optimize skill instructions)
- Creating CLAUDE.md instructions or slash command prompts
- Debugging agent failures (often caused by vague instructions)
- Ensuring reliable, consistent agent execution

---

## Your Expertise Level as Agent-Expert

<expertise-contract>
  <your-identity>Senior-level agent optimization expert</your-identity>

  <what-you-promised>
    Your skill description claims you can "transform instructions using 26 research-backed principles."
    Users invoke this skill expecting senior-level expertise — deliver at that level by loading
    the supporting files when needed.
  </what-you-promised>

  <available-knowledge>
    <currently-loaded>
      <file>SKILL.md</file>
      <contains>
        - All 26 agent-optimization principles (complete with examples)
        - Quick decision framework
        - Complete 4-phase workflow (INVESTIGATE, APPLY, TRANSFORM, VALIDATE)
        - Common transformation patterns
        - Meta-pattern overview (expertise contract)
        - Navigation to supporting files
      </contains>
      <limitation>This is approximately 60% of your total knowledge base</limitation>
    </currently-loaded>

    <available-to-read>
      <file name="workflow.md" size="600 lines">
        Complete 4-phase transformation process (INVESTIGATE, APPLY, TRANSFORM, VALIDATE) with detailed actions, checklists, and examples
      </file>

      <file name="transformation-patterns.md" size="575 lines">
        10+ transformation patterns with before/after examples, quick reference table, common anti-patterns
      </file>

      <file name="validation.md" size="516 lines">
        10-item quality checklist, A/B/C/D grading system, failure modes and fixes
      </file>

      <file name="examples.md" size="603 lines">
        8 complete transformations across complexity levels (simple, multi-step, complex, mission-critical, subagent dispatch)
      </file>

      <file name="expertise-contract-pattern.md" size="354 lines">
        Meta-pattern for progressive disclosure architecture: 5 psychological levers, implementation template, anti-patterns, empirical validation
      </file>

      <file name="subagent-patterns.md" size="~250 lines">
        Subagent dispatch methodology: context crafting, model selection, status handling, prompt templates, review ordering, trust verification, parallel dispatch, anti-patterns
      </file>
    </available-to-read>
  </available-knowledge>

  <self-assessment-required>
    **BEFORE responding to any request, you MUST assess:**

    <question-1>What is the user asking me to do?</question-1>
    <question-2>What knowledge do I need to deliver senior-level work on this task?</question-2>
    <question-3>Do I currently have that knowledge from SKILL.md alone?</question-3>
    <question-4>Which files should I read to fill knowledge gaps?</question-4>

    <decision-criteria>
      <ask-yourself>
        - Am I about to guess at principles beyond Core 4?
        - Am I about to transform something without seeing transformation patterns?
        - Am I about to validate without knowing the grading criteria?
        - Am I about to follow a workflow I haven't fully read?
        - Would reading X file make my response measurably better?
      </ask-yourself>

      <if-answer-yes>Read those files FIRST, then respond</if-answer-yes>
      <if-answer-no>SKILL.md alone is sufficient</if-answer-no>
      <if-uncertain>Err on side of reading more - reputation at stake</if-uncertain>
    </decision-criteria>
  </self-assessment-required>

  <knowledge-inventory>
    **Before responding, check what you know vs. what you need:**

    <check item="Core 4 Principles">
      <have>✓ Available in SKILL.md</have>
    </check>

    <check item="Meta-Pattern Overview">
      <have>✓ Available in SKILL.md</have>
    </check>

    <check item="All 26 Principles">
      <have>✓ Available in SKILL.md</have>
    </check>

    <check item="Transformation Patterns">
      <have>✗ Need to read transformation-patterns.md</have>
    </check>

    <check item="Systematic 4-Phase Workflow">
      <have>✗ Need to read workflow.md</have>
    </check>

    <check item="Quality Grading Criteria">
      <have>✗ Need to read validation.md</have>
    </check>

    <check item="Complete Transformation Examples">
      <have>✗ Need to read examples.md</have>
    </check>

    <check item="Expertise Contract Implementation">
      <have>✗ Need to read expertise-contract-pattern.md</have>
    </check>

    <check item="Subagent Dispatch Patterns">
      <have>✗ Need to read subagent-patterns.md</have>
    </check>

    **Match your knowledge needs to the task at hand.**
  </knowledge-inventory>

  <guiding-principle>
    **When in doubt, read more.** Loading a supporting file takes a moment but produces
    measurably better output — the user gets specific patterns and validated guidance
    instead of generic advice. Token cost is irrelevant compared to quality.
  </guiding-principle>
</expertise-contract>

---

## Quick Decision Framework

**Which principles to apply depends on instruction complexity:**

| Complexity | Principles to Apply | When to Use | Example |
|------------|---------------------|-------------|---------|
| **Simple** | Core 4 only | 1-2 steps, obvious validation | "Run tests before committing" |
| **Multi-Step** | Core 4 + Best Practices | 3-5 steps, some dependencies | "Create component and add tests" |
| **Complex** | Core 4 + Structured Formats | 6+ steps, many dependencies, tool usage | "Implement feature with investigation" |
| **Mission-Critical** | All 26 Principles | Cannot fail, production systems, security | "Authentication microservice" |
| **Subagent Dispatch** | Context crafting + Model selection + Status handling | When launching worker agents | See subagent-patterns.md |

**Complete decision framework and all 26 principles:** See "The Complete 26 Principles: Summary Table" and "Additional Principles" sections below in this file

---

## Core 4 Principles (ALWAYS APPLY)

These 4 principles apply to **ALL** instructions, regardless of complexity.

> **Meta-principle: Explain the Why.** Modern LLMs are capable reasoners who generalize best from understood principles, not rote directives. When writing any instruction, pair the *what* with the *why*. An agent that understands the rationale behind a rule will apply it correctly to novel situations — one that only memorizes "MUST do X" will fail when X doesn't quite fit. This meta-principle applies across all 26 principles below.

### Principle #7: Make Every Step Executable ⭐

**Category:** Explicitness & Clarity
**Priority:** ALWAYS APPLY
**Complexity Cost:** Low

**What it means:**
- No vague directives like "ensure quality" or "add appropriate tests"
- Every step must be specific, actionable, and measurable
- Agent must be able to verify completion (yes/no)

**How to apply:**

1. **Identify vague terms** in your instruction:
   - "good", "appropriate", "sufficient", "reasonable"
   - "ensure quality", "follow best practices"
   - "properly", "correctly", "well"

2. **Replace with specific, measurable actions:**
   ```markdown
   ❌ "Ensure code quality"
   ✅ "Verify code quality:
       - Run linter: npm run lint (must pass with 0 warnings)
       - Compile TypeScript: tsc --noEmit (must succeed)
       - Run tests: npm test (all must pass)
       - Check coverage: npm test -- --coverage (≥80%)
       - Verify all public functions have JSDoc comments"
   ```

3. **Make validation explicit:**
   - Specify the command to run
   - State the expected outcome
   - Define pass/fail criteria

**Examples:**

```markdown
❌ Vague: "Add appropriate tests"
✅ Executable: "Create test file with:
    - Test for each public method
    - Tests for edge cases (null, empty, invalid inputs)
    - Tests for error conditions
    - Achieve coverage ≥80%
    - All tests must pass (run: npm test)"

❌ Vague: "Document the changes"
✅ Executable: "Update documentation:
    - Add JSDoc to all exported functions (params, returns, example)
    - Update README.md if public API changed (add new sections for new features)
    - Add entry to CHANGELOG.md under [Unreleased] section
    - Follow format: [type]: [description]"

❌ Vague: "Follow project conventions"
✅ Executable: "Follow these discovered conventions:
    - File naming: [specific pattern from investigation, e.g., PascalCase.tsx]
    - File location: [specific path from investigation, e.g., src/components/]
    - Code style: [specific style from investigation, e.g., 2-space indent, single quotes]
    - Test location: [specific path from investigation, e.g., __tests__/]"
```

**Why it matters:**
- Vague directives cause agent confusion and inconsistent execution
- Agents cannot infer what you mean - they need explicit guidance
- Executable steps can be verified objectively (yes/no, pass/fail)
- Reduces errors and increases reliability

---

### Principle #9: Avoid Ambiguity and Vagueness ⭐

**Category:** Explicitness & Clarity
**Priority:** ALWAYS APPLY
**Complexity Cost:** Low

**What it means:**
- No subjective terms that can be interpreted differently
- Quantify everything possible
- Define any potentially ambiguous terms explicitly
- Provide examples to clarify meaning

**How to apply:**

1. **Identify subjective/ambiguous terms:**
   - Quality judgments: "good", "bad", "high-quality", "clean"
   - Quantity: "sufficient", "enough", "many", "few"
   - Performance: "fast", "slow", "efficient"
   - Size: "large", "small", "reasonable"

2. **Replace with quantitative metrics:**
   ```markdown
   ❌ "Good test coverage"
   ✅ "Test coverage ≥80% for lines, branches, and functions"

   ❌ "Fast enough performance"
   ✅ "Response time <200ms (95th percentile), initial load <1s"

   ❌ "Sufficient documentation"
   ✅ "Documentation with: purpose (1-2 sentences), all parameters (name + type + description), return value, 1-2 usage examples"
   ```

3. **Define ambiguous terms in context:**
   ```markdown
   Example: Instead of "Follow best practices", specify:
   "Follow these React best practices:
    - Use functional components with hooks (not class components)
    - Memoize expensive calculations with useMemo
    - Use useCallback for event handlers passed to children
    - Lift state to common ancestor when shared
    - Keep components focused (single responsibility)"
   ```

**Examples:**

```markdown
❌ Ambiguous: "Add sufficient examples"
✅ Specific: "Add 3-5 distinct examples covering simple, moderate, and complex use cases"

❌ Ambiguous: "Keep components small"
✅ Specific: "Keep components <200 lines. If larger, split into sub-components."

❌ Ambiguous: "Ensure good performance"
✅ Specific: "Ensure performance meets:
    - First Contentful Paint <1.8s
    - Time to Interactive <3.9s
    - Cumulative Layout Shift <0.1
    - Lighthouse Performance Score ≥90"
```

**Why it matters:**
- Ambiguity causes inconsistent agent behavior across runs
- Different agents may interpret the same term differently
- Quantitative criteria are objectively measurable
- Removes guesswork and increases reliability

---

### Principle #13: Use Imperative Voice with Rationale ⭐

**Category:** Explicitness & Clarity
**Priority:** ALWAYS APPLY
**Complexity Cost:** Low

**What it means:**
- Use direct commands, not suggestions or questions
- Be authoritative and decisive
- Start with action verbs (Create, Verify, Run, Add, Update)
- Avoid passive voice, conditional language, or hedging
- **Pair commands with rationale** — agents generalize better from understood principles than from rote directives
- **ALL CAPS MUSTs are a yellow flag** — if you need shouting to enforce a rule, the instruction may lack the "why" that makes compliance natural

**How to apply:**

1. **Replace suggestive language with commands:**
   ```markdown
   ❌ "You might want to consider adding tests"
   ✅ "Add tests for all public functions"

   ❌ "It would be good to document the API"
   ✅ "Document the API with JSDoc comments"

   ❌ "Consider following project conventions"
   ✅ "Follow project conventions (from investigation)"
   ```

2. **Start sentences with action verbs:**
   - Create, Build, Implement
   - Verify, Check, Validate
   - Run, Execute, Perform
   - Add, Update, Modify
   - Document, Explain, Describe

3. **Remove hedging and qualifiers:**
   ```markdown
   ❌ "Probably should check if tests pass"
   ✅ "Run tests and verify all pass"

   ❌ "Maybe add some error handling"
   ✅ "Add error handling for: invalid input, network failures, timeout"
   ```

**Examples:**

```markdown
❌ Suggestive: "You should probably run the linter"
✅ Imperative: "Run the linter (npm run lint)"

❌ Question: "Have you added tests?"
✅ Imperative: "Add tests for each public method"

❌ Passive: "Tests should be run before committing"
✅ Imperative: "Run tests before committing"

❌ Conditional: "If possible, document the code"
✅ Imperative: "Document all public functions with JSDoc"
```

4. **Pair directives with rationale (the "why"):**
   ```markdown
   ❌ Bare directive: "MUST use parameterized queries"
   ✅ With rationale: "Use parameterized queries — string concatenation enables SQL injection"

   ❌ Shouting: "NEVER use eval()"
   ✅ With rationale: "Avoid eval() — it executes arbitrary code and breaks static analysis"
   ```
   When the agent understands *why*, it generalizes the principle to novel situations rather than treating it as a rote rule.

**Why it matters:**
- Suggestions are ambiguous (should I? maybe? if I feel like it?)
- Commands are clear and unambiguous (do this, period)
- Agents execute direct instructions more reliably
- Removes uncertainty about whether action is required
- Rationale enables generalization — the agent applies the principle to cases you didn't enumerate

---

### Principle #23: Explicit Role Definition ⭐

**Category:** Role & Context
**Priority:** ALWAYS APPLY
**Complexity Cost:** Medium

**What it means:**
- Define who/what the agent is (identity)
- State what the agent does (purpose)
- List areas of expertise
- Clarify what's in scope and out of scope

**How to apply:**

Use XML structure for role definition:

```xml
<role>
  <identity>[Who/what the agent is]</identity>

  <purpose>
    [What the agent does, its primary objective]
  </purpose>

  <expertise>
    <area>[Area of expertise 1]</area>
    <area>[Area of expertise 2]</area>
    <area>[Area of expertise 3]</area>
  </expertise>

  <scope>
    <in-scope>
      <item>[Task type 1 this handles]</item>
      <item>[Task type 2 this handles]</item>
      <item>[Task type 3 this handles]</item>
    </in-scope>

    <out-of-scope>
      <item>[Task type agent should NOT handle]</item>
      <item>[Separate concern to be handled elsewhere]</item>
    </out-of-scope>
  </scope>
</role>
```

**Complete Example:**

```xml
<role>
  <identity>Expert React component creator</identity>

  <purpose>
    Create production-quality React components with TypeScript, testing,
    and documentation following project patterns
  </purpose>

  <expertise>
    <area>React functional components and hooks</area>
    <area>TypeScript type safety and props interfaces</area>
    <area>Component testing with React Testing Library</area>
    <area>JSDoc documentation for components</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Creating new functional components</item>
      <item>Adding TypeScript props interfaces</item>
      <item>Writing component tests</item>
      <item>Adding JSDoc documentation</item>
      <item>Following discovered project patterns</item>
    </in-scope>

    <out-of-scope>
      <item>State management libraries (Redux, Zustand - separate concern)</item>
      <item>Backend API integration (separate concern)</item>
      <item>Build configuration (webpack, vite - separate concern)</item>
      <item>Deployment and CI/CD (separate concern)</item>
    </out-of-scope>
  </scope>
</role>
```

**Why it matters:**
- Aligns agent behavior with expected expertise level
- Sets vocabulary and terminology (technical vs. beginner-friendly)
- Clarifies boundaries (what to do, what NOT to do)
- Prevents scope creep and confusion
- Establishes context for decision-making

---

## Additional Principles (Apply Based on Complexity)

### Principle #1: Use Structured Formats When Complexity Warrants It

**Category:** Structure & Format
**Priority:** Complex workflows (3+ steps, dependencies)
**Complexity Cost:** High (more verbose, but worth it for clarity)

**When to use:**
- Multi-step protocols with dependencies
- Complex hierarchies (steps with substeps)
- Clear semantic boundaries needed

**When NOT to use:**
- Simple instructions that plain markdown handles well
- Linear lists without dependencies (numbered markdown list is fine)
- Short content where XML adds more noise than structure

**How to apply:**

For complex workflows, XML or structured formats can help — but markdown with clear headings works for simpler cases. Choose the lightest format that eliminates ambiguity:

```xml
<workflow type="sequential">
  <step id="1-investigate" order="first">
    <description>Investigate project patterns</description>

    <actions>
      <action priority="critical">Find existing files matching relevant patterns</action>
      <action priority="high">Document patterns with examples</action>
    </actions>

    <acceptance-criteria>
      <criterion>Patterns documented with 3+ examples</criterion>
      <criterion>File structure identified</criterion>
    </acceptance-criteria>

    <blocks>
      <step-id>2-implement</step-id>
      <reason>Cannot implement without knowing patterns</reason>
    </blocks>
  </step>

  <step id="2-implement" order="second">
    <description>Implement following discovered patterns</description>

    <dependencies>
      <requires>Step 1 completed</requires>
      <prerequisite>Investigation report exists</prerequisite>
    </dependencies>

    <actions>
      <action>Create files at [location from investigation]</action>
      <action>Use [naming pattern from investigation]</action>
    </actions>

    <acceptance-criteria>
      <criterion>Files created at correct location</criterion>
      <criterion>Naming follows pattern</criterion>
    </acceptance-criteria>
  </step>
</workflow>
```

**Why structured formats over prose (when warranted):**
- Unambiguous boundaries (`<step>` clearly marks step boundaries)
- Hierarchical relationships clear (parent/child)
- Dependencies explicit and tagged
- But: plain markdown with numbered steps works for simple sequences — don't add XML overhead for linear workflows

---

### Principle #2: Explicit Format Specification

**Category:** Structure & Format
**Priority:** Recommended for reports/analysis
**Complexity Cost:** Medium

**When to use:**
- Investigation reports
- Analysis outputs
- Any structured data response

**How to apply:**

Provide template or schema for expected output:

````markdown
**Output Format (Required):**

```markdown
# Investigation Report: [Name]

## Summary
- Finding 1: [description]
- Finding 2: [description]

## Details
[Detailed findings with evidence and examples]

## Recommendations
1. [Recommendation with rationale]
2. [Recommendation with rationale]
```
````

**Why it matters:**
- Prevents ambiguous outputs
- Ensures consistency across runs
- Enables validation and downstream processing

---

### Principle #8: State Dependencies Explicitly

**Category:** Explicitness & Clarity
**Priority:** Multi-step workflows
**Complexity Cost:** Medium

**When to use:**
- Multi-step workflows (2+ steps)
- Steps that must execute in specific order
- Prerequisites exist for certain steps

**How to apply:**

```xml
<step id="2" order="second">
  <description>Create component</description>

  <dependencies>
    <requires>Step 1 (investigation) must be completed</requires>
    <prerequisite>Investigation report exists and is complete</prerequisite>
  </dependencies>

  <blocks>
    <step-id>3-test</step-id>
    <reason>Cannot test what doesn't exist</reason>
  </blocks>
</step>
```

**Dependency types:**
- `<requires>`: Previous step that must complete first
- `<prerequisite>`: State that must be true before starting
- `<blocks>`: What this step prevents from starting
- `<optional-for>`: Can run before, during, or after this

---

### Principle #10: Comprehensive Acceptance Criteria

**Category:** Explicitness & Clarity
**Priority:** Best practice for all multi-step tasks
**Complexity Cost:** Low

**When to use:**
- Every step in a multi-step workflow
- Any task where validation is important

**How to apply:**

```xml
<acceptance-criteria>
  <criterion id="1" priority="critical">File exists at expected path</criterion>
  <criterion id="2" priority="high">Linter passes (npm run lint, 0 warnings)</criterion>
  <criterion id="3" priority="high">Tests pass (npm test, all green)</criterion>
  <criterion id="4" priority="medium">Coverage ≥80%</criterion>
</acceptance-criteria>
```

**Priority levels:**
- **critical**: Must pass, cannot proceed without
- **high**: Should pass, important for quality
- **medium**: Nice to have, but not blocking
- **low**: Optional, best-effort

---

### Principle #14: Positive AND Negative Examples ⭐

**Category:** Examples & Patterns
**Priority:** Best practice (recommended for most instructions)
**Complexity Cost:** Medium

**When to use:**
- Teaching patterns
- Showing transformations
- Clarifying ambiguous concepts
- Skill descriptions and documentation

**How to apply:**

```xml
<examples category="skill-descriptions">
  <positive>
    <example>
      Creates React components with TypeScript, props typing, and hooks.
      Use when building UI components, refactoring class components, or
      scaffolding component structures.
    </example>
    <why-good>
      - WHAT: Specific capabilities (React, TypeScript, props, hooks)
      - WHEN: 3 clear trigger scenarios (building, refactoring, scaffolding)
      - Keywords: Rich and technical (React, TypeScript, components, props, hooks, UI)
    </why-good>
  </positive>

  <negative>
    <example>Helps with React</example>
    <why-bad>
      - WHAT: Vague ("helps with" - helps how?)
      - WHEN: Missing entirely (when would I use this?)
      - Keywords: Only "React" (too sparse, not discoverable)
    </why-bad>
  </negative>
</examples>
```

**Why both positive AND negative:**
- Agents learn from pattern matching
- Positive shows what to do
- Negative shows what NOT to do (and why)
- Contrast clarifies boundaries

> **LLM-Specific Insight:** For instructions consumed by LLMs, negative examples (anti-patterns) are
> disproportionately effective because they target specific statistical biases in model outputs. A list
> of 20 banned patterns often outperforms equivalent positive prescriptions. LLMs default to certain
> outputs (e.g., Inter font, purple gradients, placeholder comments) due to training data frequency.
> Explicitly banning these defaults forces the model off its statistical path. When writing agent
> instructions, weight your negative examples heavily — they do more work than the positive ones.
>
> **The Exhaustive Enumeration Technique:** When targeting known LLM failure modes, enumerate every
> specific banned pattern rather than describing the category generically. "Don't use placeholder
> comments" is weaker than listing every variant: `// ...`, `// rest of code`, `// implement here`,
> `// similar to above`. The model may interpret the generic instruction loosely but cannot rationalize
> away an explicit pattern match.

---

### Principle #19: Iterative Frameworks

**Category:** Process & Workflow
**Priority:** Complex investigative workflows
**Complexity Cost:** High

**When to use:**
- Investigation-driven tasks
- When agent needs to observe and adapt
- Uncertain environments requiring exploration

**How to apply:**

Support Think → Act → Observe → Decide cycles:

```xml
<workflow type="iterative">
  <phase name="investigate">
    <thought>What do I need to discover?</thought>
    <action>Explore codebase (search for patterns, find files, read contents)</action>
    <observation>Document findings with examples</observation>
    <decision>
      If patterns clear → Proceed to implementation
      If unclear → Ask user for clarification
      If no patterns found → Ask user for preferred approach
    </decision>
  </phase>

  <phase name="implement">
    <thought>How do I apply discovered patterns?</thought>
    <action>Create files following patterns</action>
    <observation>Verify files created correctly</observation>
    <decision>
      If validation passes → Proceed to testing
      If validation fails → Fix issues and retry
    </decision>
  </phase>
</workflow>
```

---

### Principle #20: Specify Required Capabilities Explicitly

**Category:** Process & Workflow
**Priority:** Tool-heavy workflows
**Complexity Cost:** Medium

**When to use:**
- Complex workflows requiring specific capabilities
- When capability requirements matter
- When avoiding ambiguous capability selection

**What it means:**
- Describe WHAT capability is needed, not WHICH tool to use
- Specify the operation (search, find, read) and its parameters
- Let the agent select the best available tool for the capability
- Instructions remain valid as tooling evolves

**How to apply:**

```xml
<capability name="pattern-search">
  <purpose>Search for code patterns across files</purpose>

  <when-needed>
    <scenario>Finding all usages of a function</scenario>
    <scenario>Searching for patterns with regex</scenario>
  </when-needed>

  <when-not-needed>
    <scenario>Reading full file (use file-reading capability instead)</scenario>
    <scenario>Finding files by name (use file-finding capability instead)</scenario>
  </when-not-needed>

  <requirements>
    <requirement name="pattern" required="true">Regex pattern to search for</requirement>
    <requirement name="scope" required="false">Directory to search (default: project root)</requirement>
  </requirements>

  <examples>
    <example>
      Search for pattern "use[A-Z]\\w+" in src/ directory
    </example>
    <example>
      Find all usages of function "processData" in codebase
    </example>
  </examples>
</capability>
```

**Why capability-based vs tool-specific:**
- Tools evolve and improve over time (e.g., basic search → semantic search → AI-assisted search)
- New, better tools may become available
- Instructions remain valid as tooling improves
- Agent can select best available tool for the capability
- Avoids coupling instructions to specific tool names

---

### Principle #21: Make Execution Order Explicit

**Category:** Process & Workflow
**Priority:** Sequential workflows
**Complexity Cost:** Low

**When to use:**
- Multi-step workflows where order matters
- Parallel vs. sequential distinction important

**How to apply:**

```xml
<execution-order type="sequential">
  <step id="1" order="first">Investigation</step>
  <step id="2" order="second" depends-on="step-1">Implementation</step>
  <step id="3" order="third" depends-on="step-2">Validation</step>
</execution-order>
```

For parallel execution:

```xml
<execution-order type="parallel" can-run-concurrently="true">
  <task>Read file A</task>
  <task>Read file B</task>
  <task>Read file C</task>
</execution-order>

<sequential-after-parallel>
  <task depends-on="all-reads">Analyze files together</task>
</sequential-after-parallel>
```

---

### Principle #26: Design for Agent Audience, Not Human Readers

**Category:** Meta-Architecture / Audience Alignment
**Priority:** ALWAYS APPLY (for agent-consumed instructions)
**Complexity Cost:** Medium (requires mindset shift)

**What it means:**
- Instructions consumed by agents should be written FOR agents, not humans
- Users will never directly read most agent instructions (skills, CLAUDE.md, slash commands)
- Use executable protocols instead of conversational examples
- Use decision logic instead of motivational language
- Agent pattern-matching works on structure, not narrative

**When to apply:**
- Writing Claude Code skills (SKILL.md files)
- Writing CLAUDE.md instructions
- Writing slash command prompts (.claude/commands/*.md)
- Writing any agent-consumed instructions or protocols

**When NOT to apply:**
- User-facing documentation (README.md for end users)
- API documentation for human developers
- Tutorials and guides intended for people to read
- Marketing or explanatory content

**How to apply:**

**1. Replace conversational prompts with executable protocols:**

```markdown
❌ Human-Oriented:
## Ready to Build?

Tell me:
- What domain or purpose for the skill?
- What should it help you do?

I'll guide you through creating a production-ready skill!

✅ Agent-Oriented:
## Skill Creation Protocol

<workflow type="sequential">
  <step id="gather-requirements" order="first">
    <description>Gather skill requirements from user</description>

    <required-information>
      <item priority="critical">Domain or purpose</item>
      <item priority="critical">Use cases</item>
      <item priority="high">Constraints</item>
    </required-information>

    <actions>
      <action>Request missing critical information from user</action>
      <action>Confirm understanding with user</action>
    </actions>

    <acceptance-criteria>
      <criterion>Domain clearly identified</criterion>
      <criterion>At least 2 use cases documented</criterion>
    </acceptance-criteria>

    <blocks>determine-type</blocks>
  </step>
</workflow>
```

**2. Replace "quick reference" lists with loading protocols:**

```markdown
❌ Human-Oriented:
## Quick Reference

Here are the available files:
- UNIVERSAL.md - Universal principles
- expert/README.md - Expert skill guidance
- validation/README.md - Validation checklists

✅ Agent-Oriented:
## File Loading Protocol

<loading-decision>
  <trigger>User requests skill creation</trigger>

  <required-files>
    <file path="UNIVERSAL.md">
      <load-when>Creating first skill of any type</load-when>
      <contains>YAML requirements, description formula</contains>
      <outcome>Understand universal skill requirements</outcome>
    </file>

    <file path="expert/README.md">
      <load-when>Skill type determined as expert</load-when>
      <contains>Investigation protocols, checklists</contains>
      <outcome>Apply expert skill patterns</outcome>
    </file>
  </required-files>
</loading-decision>
```

**3. Replace conversational examples with pattern-matching logic:**

```markdown
❌ Human-Oriented:
## How to Use This Skill

**Tell me what you need:**

"Create a skill for [domain]" → I'll detect type and create it
"Validate this skill" → I'll run validation

✅ Agent-Oriented:
## Request Pattern Matching

<request-patterns>
  <pattern type="skill-creation">
    <triggers>
      <keyword>create</keyword>
      <keyword>skill</keyword>
      <context>domain mentioned</context>
    </triggers>
    <execution>
      <step>Determine skill type from domain</step>
      <step>Load UNIVERSAL.md</step>
      <step>Load [type]/README.md</step>
      <step>Execute creation workflow</step>
    </execution>
  </pattern>

  <pattern type="skill-validation">
    <triggers>
      <keyword>validate</keyword>
      <keyword>skill</keyword>
    </triggers>
    <execution>
      <step>Load validation/README.md</step>
      <step>Apply validation checklist</step>
      <step>Launch validation agent</step>
    </execution>
  </pattern>
</request-patterns>
```

**Why it matters:**

| Human-Oriented Writing | Agent-Oriented Writing |
|------------------------|------------------------|
| "Ready to build?" | `<workflow>` with explicit steps |
| "Tell me what you need" | `<required-information>` with priorities |
| "I'll guide you through..." | `<execution>` with sequential actions |
| "Here's a quick reference" | `<loading-decision>` with when-to-load rules |
| Example phrases users might say | `<request-patterns>` with trigger keywords |
| Friendly, motivational | Structured, executable |
| Works for humans reading docs | Works for agents executing instructions |

**Agent execution differences:**

- **Human-oriented:** Agent interprets as "engage in friendly conversation, ask open-ended questions"
  - Result: Vague back-and-forth, unclear requirements, inconsistent behavior

- **Agent-oriented:** Agent interprets as "execute requirement-gathering protocol with specific criteria"
  - Result: Systematic collection, clear completion criteria, reliable execution

**Common mistakes to avoid:**

```markdown
❌ "You might want to validate your skill when done"
✅ "After skill creation completes: Load validation/README.md, execute validation protocol"

❌ "Here are some examples of what you can say:"
✅ "<request-patterns> with trigger keywords and execution logic"

❌ Section heading: "Let's Get Started!"
✅ Section heading: "Initialization Protocol" or "Workflow Entry Point"

❌ "Feel free to ask me questions if you're unsure"
✅ "<clarification-protocol> Request missing required-information items before proceeding"
```

**Trade-offs:**

- **Pro:** Higher execution reliability, clearer decision logic, better token efficiency
- **Pro:** Agents pattern-match on structure more reliably than narrative
- **Pro:** Reduces ambiguity and increases consistent behavior
- **Con:** Less friendly for humans who browse skill files (rare - users don't read skills)
- **Con:** Requires more upfront design (creating protocols vs writing conversationally)

**Verdict:** For agent-consumed instructions (skills, CLAUDE.md, slash commands), optimize for agent execution over human friendliness. But remember: structured formats are a tool, not a religion. Use XML when it adds clarity (complex workflows, multi-branch decisions). Use plain markdown when it's sufficient (linear steps, simple checklists). The goal is *unambiguous, executable instructions* — the format that achieves that most concisely wins.

---

## The Complete 26 Principles: Summary Table

| # | Principle | Category | Priority | When to Apply |
|---|-----------|----------|----------|---------------|
| 1 | Use Structured Formats When Complexity Warrants It | Structure | Complex | 3+ steps, dependencies |
| 2 | Explicit Format Specification | Structure | Recommended | Reports, analysis |
| 3 | Treat as API Design | Structure | Mission-Critical | High-stakes tasks |
| 4 | Hierarchical Tags | Structure | Recommended | Complex hierarchies |
| 5 | Markdown Tables | Structure | Best Practice | Specs, comparisons |
| 6 | Separate Instructions/Examples | Structure | Recommended | Teaching patterns |
| **7** | **Make Every Step Executable** | **Explicitness** | **ALWAYS** | **All instructions** |
| 8 | State Dependencies Explicitly | Explicitness | Multi-Step | 2+ steps with order |
| **9** | **Avoid Ambiguity** | **Explicitness** | **ALWAYS** | **All instructions** |
| 10 | Comprehensive Acceptance Criteria | Explicitness | Best Practice | Validation needed |
| 11 | Quantitative Thresholds | Explicitness | Best Practice | Performance, quality |
| 12 | Define All Cases | Explicitness | Recommended | Edge cases matter |
| **13** | **Use Imperative Voice with Rationale** | **Explicitness** | **ALWAYS** | **All instructions** |
| **14** | **Positive + Negative Examples** | **Examples** | **Best Practice** | **Teaching patterns** |
| 15 | Sufficient Distinct Instances | Examples | Recommended | 3-5 examples |
| 16 | Before/After Comparisons | Examples | Recommended | Transformations |
| 17 | Template Patterns | Examples | Recommended | Showing structure |
| 18 | Anti-Patterns | Examples | Recommended | Common mistakes |
| 19 | Iterative Frameworks | Process | Complex | Investigation-driven |
| 20 | Tool Usage Specifications | Process | Tool-Heavy | Multiple tools |
| 21 | Execution Order Explicit | Process | Sequential | Order matters |
| 22 | Parallel vs Sequential | Process | Recommended | Optimization |
| **23** | **Explicit Role Definition** | **Role** | **ALWAYS** | **All instructions** |
| 24 | Contextual Grounding | Role | Recommended | Environment matters |
| 25 | Goal-Oriented Specification | Role | Recommended | Clear objectives |
| **26** | **Design for Agent Audience** | **Meta-Architecture** | **ALWAYS** | **Agent-consumed instructions** |

**Legend:**
- **Bold**: Core principles (always apply to relevant contexts)
- ALWAYS: Apply to every instruction
- Best Practice: Apply to most instructions (80%+)
- Recommended: Apply when beneficial (50%+)
- Specific conditions: Apply when criteria met

---

## The 4-Phase Workflow

### Phase 1: INVESTIGATE 🔍

**Objective:** Understand the current instruction and determine the appropriate optimization approach

**Actions:**

1. **Read the instruction carefully**
   - What is the instruction trying to achieve?
   - Who is the intended executor (agent type/role)?
   - What is the expected outcome?

2. **Identify complexity level**

   Use this decision tree:

   ```
   Is it a single action with obvious validation?
   ├─ Yes → **Simple** (1-2 steps)
   └─ No → Does it have 3-5 steps with some dependencies?
       ├─ Yes → **Multi-Step**
       └─ No → Does it have 6+ steps, complex dependencies, tool usage?
           ├─ Yes → **Complex**
           └─ No → Is it mission-critical (cannot fail)?
               └─ Yes → **Mission-Critical**
   ```

   **Complexity Definitions:**

   - **Simple:** 1-2 steps, obvious validation, no dependencies
     - Example: "Run tests before committing"
     - Apply: Core 4 principles only

   - **Multi-Step:** 3-5 steps, some dependencies, multiple validation points
     - Example: "Create component and add tests"
     - Apply: Core 4 + #8 (dependencies), #10 (acceptance criteria), #14 (examples)

   - **Complex:** 6+ steps, many dependencies, tool usage, investigation required
     - Example: "Implement new feature following project patterns"
     - Apply: Core 4 + #1 (XML), #2 (formats), #8, #10, #14, #19 (iterative), #20 (tools)

   - **Mission-Critical:** Cannot fail, production systems, security-critical
     - Example: "Implement authentication microservice"
     - Apply: All 26 principles comprehensively

3. **List current issues**

   Use this checklist to identify problems:

   **Vague Terms:**
   - [ ] Contains subjective quality terms? ("good", "bad", "clean", "appropriate")
   - [ ] Contains vague quantities? ("sufficient", "enough", "many", "several")
   - [ ] Contains undefined terms? ("follow conventions", "use best practices")

   **Ambiguous Validation:**
   - [ ] Validation criteria unclear? ("ensure quality")
   - [ ] Success criteria subjective? ("looks good")
   - [ ] No measurable thresholds? (no numbers, percentages, counts)

   **Missing Dependencies:**
   - [ ] Step order implicit? ("Do A, Do B" without stating B requires A)
   - [ ] Prerequisites unstated? (assumes things exist without verifying)
   - [ ] Blocking relationships unclear? (doesn't specify what must complete first)

   **Missing Examples:**
   - [ ] No examples provided?
   - [ ] Only positive examples? (no negative/anti-pattern examples)
   - [ ] Examples not representative? (too simple, doesn't cover edge cases)

   **Subjective Criteria:**
   - [ ] Acceptance criteria are feelings? ("should be fast", "must be clean")
   - [ ] No quantitative thresholds? (no specific numbers)
   - [ ] Cannot be verified objectively? (requires judgment vs. measurement)

   **Passive/Suggestive Language:**
   - [ ] Uses suggestions? ("consider", "you might want to")
   - [ ] Uses passive voice? ("tests should be run" vs "run tests")
   - [ ] Uses questions? ("have you checked?" vs "check")

4. **Determine principle level to apply**

   Based on complexity identified in step 2:

   - **Simple** → Core 4 only (#7, #9, #13, #23)
   - **Multi-Step** → Core 4 + #8, #10, #14
   - **Complex** → Core 4 + #1, #2, #8, #10, #14, #19, #20, #21
   - **Mission-Critical** → All 26 principles

---

### Phase 2: APPLY PRINCIPLES 🎯

**Objective:** Select and prepare to apply appropriate principles based on complexity

**Actions:**

1. **Apply Core 4 ALWAYS**

   No matter the complexity, these 4 are non-negotiable:

   - **#7 Make Every Step Executable:** Replace vague directives with specific, measurable actions
   - **#9 Avoid Ambiguity:** Quantify everything, define unclear terms
   - **#13 Use Imperative Voice:** Direct commands, not suggestions
   - **#23 Explicit Role Definition:** Define identity, purpose, expertise, scope

2. **Add principles for multi-step workflows**

   If complexity is Multi-Step or higher, add:

   - **#8 State Dependencies Explicitly:** Use `<dependencies>`, `<requires>`, `<blocks>`
   - **#10 Comprehensive Acceptance Criteria:** Add measurable validation for each step
   - **#14 Positive + Negative Examples:** Show both what to do and what not to do

3. **Add principles for complex workflows**

   If complexity is Complex or Mission-Critical, add:

   - **#1 Use Structured Formats:** Use XML for steps, workflow, dependencies
   - **#2 Explicit Format Specification:** Provide output templates/schemas
   - **#19 Iterative Frameworks:** Support Think → Act → Observe → Decide cycles
   - **#20 Tool Usage Specifications:** Document when/when-not to use each tool
   - **#21 Execution Order Explicit:** Use `order="first|second|third"` attributes

4. **For mission-critical, consider all 25**

   Review full principle list above and apply all relevant ones.

---

### Phase 3: TRANSFORM ✨

**Objective:** Convert human format → agent-optimized format using selected principles

**Core Transformation Actions:**

1. **Transform vague → executable** (#7)

   For every vague directive:
   - Identify the vague term
   - Replace with specific command or action
   - Add verification method (command to run, expected output)

   ```markdown
   ❌ "Ensure tests pass"
   ✅ "Run tests and verify all pass:
       - Command: npm test
       - Expected: All tests green, 0 failures
       - If failures: Fix failing tests before proceeding"
   ```

2. **Transform ambiguous → quantified** (#9)

   For every ambiguous term:
   - Identify subjective/vague quality term
   - Replace with number, percentage, or measurable threshold
   - Provide formula or calculation if needed

   ```markdown
   ❌ "Good test coverage"
   ✅ "Test coverage ≥80% for lines, branches, and functions
       - Command: npm test -- --coverage
       - Verify: Coverage report shows ≥80% in all categories"
   ```

3. **Transform suggestions → commands** (#13)

   For every suggestion or question:
   - Replace with imperative verb (Add, Create, Run, Verify, etc.)
   - Remove hedging language ("consider", "might want to", "probably")
   - Make it a direct order

   ```markdown
   ❌ "You should probably add some tests"
   ✅ "Add tests for each public function"

   ❌ "Consider documenting this"
   ✅ "Document this function with JSDoc"
   ```

4. **Add role definition** (#23)

   At the start of the instruction, add:

   ```xml
   <role>
     <identity>[Who/what the agent is]</identity>
     <purpose>[What the agent does]</purpose>
     <expertise>
       <area>[Expertise 1]</area>
       <area>[Expertise 2]</area>
     </expertise>
     <scope>
       <in-scope>
         <item>[What agent handles]</item>
       </in-scope>
       <out-of-scope>
         <item>[What agent doesn't handle]</item>
       </out-of-scope>
     </scope>
   </role>
   ```

**Multi-Step Transformation Actions:**

5. **Make dependencies explicit** (#8)

   For multi-step workflows:
   - Identify which steps depend on which
   - Add `<dependencies>`, `<requires>`, `<prerequisite>`, `<blocks>`
   - State what must be true before each step starts

6. **Add acceptance criteria** (#10)

   For each step:
   - List measurable criteria for "done"
   - Assign priorities (critical, high, medium, low)
   - Specify validation method

7. **Add positive + negative examples** (#14)

   For concepts being taught:
   - Show a good example (and explain why it's good)
   - Show a bad example (and explain why it's bad)
   - Use contrast to clarify boundaries

---

### Phase 4: VALIDATE ✅

**Objective:** Ensure the transformation meets quality standards

**Validation Checklist:**

Run through this 10-item checklist:

**Critical (Must Pass 100%):**
- [ ] Every step is executable (specific, actionable, measurable)
- [ ] No ambiguous or subjective terms remain
- [ ] Imperative voice used throughout
- [ ] Role explicitly defined (identity, purpose, scope)

**High Priority (Must Pass ≥90%):**
- [ ] Positive AND negative examples provided (where applicable)
- [ ] Dependencies explicit for multi-step workflows
- [ ] Acceptance criteria measurable (not subjective)
- [ ] Output formats specified (for reports/analysis)

**Medium Priority (Should Pass ≥80%):**
- [ ] Structured formats used appropriately (XML for complex)
- [ ] Tool usage documented (for tool-heavy workflows)

**Quality Grading:**

Assign grade based on checklist results:

**Grade A (Excellent):**
- All critical items pass (100%)
- ≥90% high priority items pass
- ≥80% medium priority items pass
- Ready for production use

**Grade B (Good):**
- All critical items pass (100%)
- 70-89% high priority items pass
- Some improvement needed but usable

**Grade C (Needs Work):**
- All critical items pass (100%)
- 50-69% high priority items pass
- Significant improvement needed

**Grade D (Insufficient):**
- Some critical items fail
- Major revisions required
- Not ready for use

**Iteration:**

If grade is B or lower:

1. **Identify failures** - Which checklist items failed?
2. **Prioritize fixes** - Critical first, then high priority
3. **Apply fixes** - Transform again addressing failures
4. **Re-validate** - Run checklist again
5. **Repeat until Grade A**

---

## Quick Start Example

**Before (Human):**
```markdown
Make sure the code is good quality before committing.
```

**After (Agent-Optimized):**
```markdown
Verify code quality before committing:
- [ ] Linter passes (run: npm run lint, expect 0 warnings)
- [ ] TypeScript compiles (run: tsc --noEmit, must succeed)
- [ ] All tests pass (run: npm test)
- [ ] Coverage ≥80% (run: npm test -- --coverage)
- [ ] All public functions have JSDoc comments
```

**Principles Applied:** #7 (Executable), #9 (No Ambiguity), #13 (Imperative), #10 (Acceptance Criteria)

**Grade:** A (Excellent)

**For 7 more complete transformation examples:** Use Read tool on examples.md for 8 full case studies across all complexity levels

---

## Common Transformation Patterns

### Pattern: Vague → Specific

```markdown
❌ "Add appropriate tests"
✅ "Create tests for:
    - Each public method
    - Edge cases (null, empty, invalid inputs)
    - Error conditions
    - Achieve coverage ≥80%"
```

### Pattern: Implicit → Explicit Dependencies

```xml
❌ "1. Create component, 2. Add tests"

✅ <step id="1">Create component <blocks>2</blocks></step>
    <step id="2" depends-on="1">
      Add tests
      <prerequisite>Component exists and compiles</prerequisite>
    </step>
```

### Pattern: Prose → Structured XML

**When:** Complex workflows (3+ steps, dependencies)

**Use:** XML structure with `<workflow>`, `<step>`, `<dependencies>`, `<acceptance-criteria>`

**For 10+ transformation patterns with before/after examples:** Use Read tool on transformation-patterns.md for complete pattern catalog with quick reference table and anti-patterns

---

## Writing Future-Proof Instructions

When specifying how agents should interact with codebases and systems, focus on **capabilities** rather than **specific tools**:

### The Problem with Tool-Specific Instructions

❌ **Don't:** Hard-code tool names
```xml
<action>Use Glob to find files</action>
<action>Run Grep to search patterns</action>
<action>Use Read to examine implementation</action>
```

**Why this is problematic:**
- Tools evolve (today: Glob/Grep/Read → future: semantic search, AI-assisted finding)
- New, better tools may become available
- Instructions become outdated and require rewrites
- Can't automatically benefit from improved tooling

### Capability-Based Approach

✅ **Do:** Specify capabilities and requirements
```xml
<action>Find files matching pattern **/*Component*.tsx</action>
<action>Search for pattern "use[A-Z]\\w+" in codebase</action>
<action>Read file contents to examine implementation</action>
```

**Benefits:**
- Instructions remain valid as tooling improves
- Agent selects best available capability for the task
- Automatically benefits from better tools as they become available
- Focus on WHAT is needed, not HOW to do it

### Common Capabilities

| Capability | Description | Example Specification |
|------------|-------------|----------------------|
| **File Finding** | Locate files by name/pattern | `Find files matching pattern **/*.test.ts` |
| **Pattern Search** | Search for code patterns | `Search for pattern "interface\\s+\\w+" in src/` |
| **File Reading** | Read file contents | `Read file contents to examine structure` |
| **File Writing** | Create/update files | `Create file at [path] with [content]` |
| **Code Analysis** | Understand code structure | `Analyze component structure to identify patterns` |

### When Tool Names Are Acceptable

Tool-specific references ARE appropriate for:

1. **Meta-navigation** within skill documentation (e.g., "Use Read tool on examples.md")
2. **User-facing commands** where tool is part of the interface
3. **Troubleshooting guides** for specific tools

But avoid them in example workflows that teach agents how to write instructions.

---

## Supporting Files & Navigation

**Note:** All 26 principles and the complete 4-phase workflow are now inline in this file (above). The following supporting files provide additional reference material:

| File | Contains | Use When |
|------|----------|----------|
| **[transformation-patterns.md](transformation-patterns.md)** | 10+ before/after patterns, quick reference table, anti-patterns | Use Read tool on transformation-patterns.md when need concrete before/after examples (10+ patterns, anti-patterns, quick ref) |
| **[validation.md](validation.md)** | 10-item checklist, grading (A/B/C/D), failures & fixes | Use Read tool on validation.md when validating instruction quality (10-item checklist, grading rubric, failure mode fixes) |
| **[examples.md](examples.md)** | 8 complete transformations across complexity levels | Use Read tool on examples.md when need full case studies (8 transformations across all complexity levels) |
| **[expertise-contract-pattern.md](expertise-contract-pattern.md)** | Meta-pattern for progressive disclosure, 5 psychological levers, template | Use Read tool on expertise-contract-pattern.md when building progressive disclosure skills (meta-pattern, template, validation) |
| **[subagent-patterns.md](subagent-patterns.md)** | Subagent dispatch: context crafting, model selection, status handling, templates, anti-patterns | Use Read tool on subagent-patterns.md when dispatching subagents, crafting agent context, selecting models, or designing multi-agent workflows |

---

## Integration with Other Skills

**With claude-skill-builder:**
1. Use claude-skill-builder to create skill structure
2. Use agent-expert to optimize instructions within the skill
3. Result: Well-structured skill with agent-optimized content

**With any skill containing instructions:**
Apply agent-expert principles when writing:
- Skill content (SKILL.md files)
- CLAUDE.md instructions
- Slash command prompts
- Any agent protocols or workflows

---

## Meta-Pattern: Expertise-Driven File Loading

**This skill demonstrates a transferable pattern for skills with progressive disclosure.**

### The Pattern

This skill uses an **expertise contract** (see "Your Expertise Level as Agent-Expert" section above) that motivates Claude to proactively read supporting files when needed:
- Identity-driven self-assessment
- Explicit knowledge gaps (~10% of knowledge base in SKILL.md alone)
- Accountability framing

**Result:** 73% token savings while maintaining expert-level output (empirically validated).

### When to Apply

Use when building skills with:
- ✅ Progressive disclosure (lean SKILL.md + detailed supporting files)
- ✅ Variable task complexity
- ✅ Expert-level capability claims

### Implementation

**Complete pattern documentation:** See expertise-contract-pattern.md
- 5 psychological levers explained
- Copy-paste implementation template
- Anti-patterns and success factors
- Empirical validation results

---

## Transformation Priorities

1. ✅ **Explicit over implicit** - Agents can't infer
2. ✅ **Structured over prose** - XML > paragraphs for complex tasks
3. ✅ **Measurable over subjective** - "≥80%" > "good"
4. ✅ **Imperative over suggestive** - "Do X" > "Consider X"
5. ✅ **Both over one** - Positive + negative examples > positive only

---

## Core Workflow Summary

```
1. INVESTIGATE
   ↓
   Determine complexity (Simple/Multi-Step/Complex/Mission-Critical)
   ↓
2. APPLY PRINCIPLES
   ↓
   Select principles based on complexity
   ↓
3. TRANSFORM
   ↓
   Convert human → agent format using patterns
   ↓
4. VALIDATE
   ↓
   Check quality (Grade A/B/C/D), iterate if needed
```

---

## Further Reading

**Inline in this file (above):**
- All 26 principles with decision framework (see "Core 4 Principles" and "Additional Principles" sections)
- Complete 4-phase workflow (see "The 4-Phase Workflow" section)
- Summary table of all 26 principles (see "The Complete 26 Principles: Summary Table")

**Supporting files (use Read tool):**
- [transformation-patterns.md](transformation-patterns.md) - Use Read tool when need 10+ transformation patterns with before/after examples
- [validation.md](validation.md) - Use Read tool when need quality assessment framework and validation checklist details
- [examples.md](examples.md) - Use Read tool when need 7 complete real-world transformation examples across complexity levels
- [expertise-contract-pattern.md](expertise-contract-pattern.md) - Use Read tool when need meta-pattern for progressive disclosure skill architecture

---

## Key Takeaway

> Agents are "eager, helpful, but inexperienced and unworldly" - they need explicit, structured, unambiguous guidance with pattern-based examples.

**Transform thinking:**
- From conversational → to API contracts
- From implicit → to explicit
- From ambiguous → to measurable
- From suggestions → to commands
- From narrative → to patterns

**Result:** Reliable, consistent, high-quality agent execution.
