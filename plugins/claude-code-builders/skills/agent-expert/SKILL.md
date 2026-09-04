---
skill_name: agent-expert
version: 2.0
description: "Research-validated framework of 26 principles for agent-optimized instructions, runtime reliability (workflow drift, tool-use loops, state preservation), token/turn optimization (caching, parallel tools, context budget), failure-mode diagnostics (MAST 2025 taxonomy, transcript reading, prompt-vs-model-vs-environment triage, post-mortem methodology), and tool design (ACI, granularity, schema, idempotency, error-message engineering). Use when writing agent instructions, optimizing prompts, hardening multi-step workflows, reducing token cost, diagnosing why an agent did the wrong thing, or designing a tool set — even for simple single-step tasks."
tags: [agent-optimization, prompt-engineering, instructions, agentic-ai, principles, transformation, validation, XML, structured-formats, explicit, measurable, workflow-reliability, drift, tool-use-loops, prompt-caching, context-budget, token-optimization, failure-modes, MAST, post-mortem, transcript-reading, ACI, tool-design, schema-design, idempotency, error-design]
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
      <item>Skill content optimization (when building with claude-code-expert builders)</item>
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

## When to Use This Skill

**Invoke this skill when:**
- Writing new instructions for AI agents
- Optimizing existing prompts or agent instructions
- Transforming human documentation for agent consumption
- Reviewing agent instruction quality
- Building skills with claude-code-expert (optimize skill instructions)
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
        - Quick Decision Framework (which principles for which complexity level)
        - When to Use this skill
        - Navigation to all 26 principles via ## Pages
      </contains>
      <limitation>This is approximately 20% of your total knowledge base after wiki migration</limitation>
    </currently-loaded>

    <available-to-read>
      <file name="core-principles/index.md">
        Core 4 Principles (always apply): #7 Executable, #9 No Ambiguity, #13 Imperative Voice, #23 Role Definition — with detailed how-to and examples per principle
      </file>

      <file name="additional-principles/index.md">
        9 additional complexity-based principles: #1 Structured Formats, #2 Format Spec, #8 Dependencies,
        #10 Acceptance Criteria, #14 Examples, #19 Iterative, #20 Capabilities, #21 Order, #26 Agent Audience
      </file>

      <file name="workflow.md" size="~620 lines">
        Complete 4-phase transformation process (INVESTIGATE, APPLY, TRANSFORM, VALIDATE) with detailed actions, checklists, and core workflow summary
      </file>

      <file name="transformation-patterns.md" size="~680 lines">
        10+ transformation patterns with before/after examples, quick reference table, common anti-patterns,
        writing future-proof instructions (capability-based approach)
      </file>

      <file name="validation.md" size="~520 lines">
        10-item quality checklist, A/B/C/D grading system, failure modes and fixes
      </file>

      <file name="examples.md" size="~640 lines">
        8 complete transformations across complexity levels (simple, multi-step, complex, mission-critical, subagent dispatch) plus quick start example
      </file>

      <file name="expertise-contract-pattern.md" size="~370 lines">
        Meta-pattern for progressive disclosure architecture: 5 psychological levers, implementation template, anti-patterns, empirical validation
      </file>

      <file name="subagent-patterns.md" size="~260 lines">
        Subagent dispatch methodology: context crafting, model selection, status handling, prompt templates, review ordering, trust verification, parallel dispatch, anti-patterns
      </file>

      <file name="principles-summary.md">
        Complete 26-principle summary table with categories, priorities, and when-to-apply guidance
      </file>

      <file name="core-insight.md">
        The core insight: target agent-friendly middle ground; structure helps but explain why
      </file>

      <file name="workflow-following.md" size="~450-500 lines">
        Runtime reliability for multi-step workflows: 5 canonical workflow patterns (prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer), 3 drift root causes with MAST statistics and countermeasures, self-correction and reflection loops (Reflexion pattern), tool-use loop error classification and circuit breakers, state and context preservation across long workflows (three-layer architecture, file-paths-not-content rule, TODO list pattern), copy-pasteable step headers / tool descriptions / dispatch blocks / error-handling rules, and anti-patterns table
      </file>

      <file name="token-turn-optimization.md" size="~500-550 lines">
        Token and turn optimization: prompt caching mechanics (10x read discount, TTL options, breakpoint ordering, minimum cacheable lengths per model, cache invalidation triggers), parallel tool calls (native behavior, prompt formulas, critical single-message rule), tool description engineering (ACI design, overlap avoidance, per-request overhead), context budget management (what eats fastest, compaction, file-not-output pattern), extended thinking (budget tiers, Opus 4.7 adaptive effort, cache interaction), output format choices (terse enums, preamble elimination), turn-count reduction, sub-agent dispatch as token strategy (when it pays off vs. costs more), cache-aware skill design, and anti-patterns table
      </file>

      <file name="failure-mode-diagnostics.md" size="~400-450 lines">
        Failure-mode diagnostics: MAST 2025 14-failure-mode taxonomy with measured frequencies (FC1 Specification 41.77%, FC2 Inter-Agent Misalignment 36.94%, FC3 Task Verification 21.30%), the diagnostic question hierarchy and triage decision table, transcript reading methodology (first-divergence-point, reasoning-action mismatch, hallucinated tools, repeated identical calls, self-contradictions), step-level vs. agent-level attribution in multi-agent systems, copy-pasteable detection patterns for FM-2.6 reasoning-action mismatch and FM-2.2 fail-to-clarify, MAST LLM-as-judge classifier prompt template (94% accuracy), prompt-vs-model-vs-environment triage and isolation protocol (4-round ablation), repro and minimal-trace freezing, post-mortem 10-section template (critical / non-critical), escalation heuristics (fix-locally / architecture / model-tier), and anti-patterns table
      </file>

      <file name="tool-design.md" size="~330-380 lines">
        Design-time tool engineering (ACI / Agent-Computer Interface): the human-engineer test for tool boundaries, granularity heuristics (one tool per intent, not per resource; consolidate related operations; narrow-vs-broad trade-offs), input schema philosophy (Poka-yoke / wrong-inputs-impossible, required-vs-optional, parameter naming, enums vs. strings vs. nested objects, additionalProperties: false), output / result-shape philosophy (structured JSON status fields, not-found vs. error, pagination, semantic field names, MCP outputSchema), idempotency semantics (read / idempotent-write / non-idempotent-write, idempotency_key parameter, MCP ToolAnnotations: readOnlyHint / idempotentHint / destructiveHint / openWorldHint), error-message design (actionable codes, MCP two-tier error model, truncation handling), similar-tool disambiguation (NOT-when clauses, namespacing), tool surface budgeting (tool-use tax, lazy-loading), versioning and deprecation patterns, and anti-patterns table
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
        - Am I about to apply principles without reading core-principles/ or additional-principles/?
        - Am I about to transform something without seeing transformation-patterns.md?
        - Am I about to validate without knowing the grading criteria in validation.md?
        - Am I about to follow a workflow I haven't fully read from workflow.md?
        - Would reading X file make my response measurably better?
      </ask-yourself>

      <if-answer-yes>Read those files FIRST, then respond</if-answer-yes>
      <if-answer-no>SKILL.md alone is sufficient</if-answer-no>
      <if-uncertain>Err on side of reading more - reputation at stake</if-uncertain>
    </decision-criteria>
  </self-assessment-required>

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
| **Runtime/Long-Running** | Workflow pattern selection + drift countermeasures + tool-use loop hardening + context budget | When designing multi-step or looping workflows, or debugging agent drift | See workflow-following.md + token-turn-optimization.md |

**Full principle details:** See [core-principles/](core-principles/index.md) and [additional-principles/](additional-principles/index.md)

---

## Integration with Other Skills

**With claude-code-expert (consolidated builders hub):**
1. Use claude-code-expert to create skill structure
2. Use agent-expert to optimize instructions within the skill
3. Result: Well-structured skill with agent-optimized content

**With any skill containing instructions:**
Apply agent-expert principles when writing:
- Skill content (SKILL.md files)
- CLAUDE.md instructions
- Slash command prompts
- Any agent protocols or workflows

---

## Transformation Priorities

1. ✅ **Explicit over implicit** - Agents can't infer
2. ✅ **Structured over prose** - XML > paragraphs for complex tasks
3. ✅ **Measurable over subjective** - "≥80%" > "good"
4. ✅ **Imperative over suggestive** - "Do X" > "Consider X"
5. ✅ **Both over one** - Positive + negative examples > positive only

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

---

## Pages

- [Core Insight](core-insight.md) — The core insight: target agent-friendly middle ground; structure helps but explain why
- [Core Principles](core-principles/index.md) — Navigation hub for Core 4 Principles (always apply: #7, #9, #13, #23)
- [Additional Principles](additional-principles/index.md) — Navigation hub for 9 complexity-based additional principles
- [Principles Summary](principles-summary.md) — Complete 26-principle summary table with categories, priorities, and when-to-apply guidance
- [Transformation Patterns](transformation-patterns.md) — 10+ transformation patterns with before/after examples, quick reference table, and common anti-patterns
- [Validation](validation.md) — 10-item quality checklist, A/B/C/D grading system, failure modes and fixes for agent-optimized instructions
- [Workflow](workflow.md) — Complete 4-phase transformation process (INVESTIGATE, APPLY, TRANSFORM, VALIDATE) with detailed actions and checklists
- [Examples](examples.md) — 8 complete before/after transformations across all complexity levels (simple, multi-step, complex, mission-critical)
- [Expertise Contract Pattern](expertise-contract-pattern.md) — Meta-pattern for progressive disclosure architecture with 5 psychological levers, implementation template, and anti-patterns
- [Subagent Patterns](subagent-patterns.md) — Subagent dispatch methodology: context crafting, model selection, status handling, prompt templates, and anti-patterns
- [Workflow Following](workflow-following.md) — Runtime reliability: 5 canonical workflow patterns, drift causes and countermeasures, tool-use loops, state preservation across long workflows
- [Token & Turn Optimization](token-turn-optimization.md) — Prompt caching, parallel tool calls, context budget management, sub-agent dispatch as token strategy, cache-aware skill design
- [Failure Mode Diagnostics](failure-mode-diagnostics.md) — Post-mortem methodology for agent failures: MAST 2025 14-failure-mode taxonomy, transcript reading, prompt-vs-model-vs-environment triage, repro/isolation protocol, copy-pasteable detection patterns, MAST LLM-as-judge classifier
- [Tool Design](tool-design.md) — Design-time tool engineering: ACI framing, granularity heuristics, input/output schema philosophy, idempotency semantics, error-message design, similar-tool disambiguation, tool surface budgeting, versioning

## Meta

- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions
