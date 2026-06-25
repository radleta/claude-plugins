---
tags: [agent-expert/workflow-following]
summary: "How to make agents reliably follow workflows: 5 canonical patterns, drift causes and countermeasures, tool-use loops, state preservation, copy-pasteable patterns, anti-patterns"
---

# Workflow Following: Runtime Reliability

## Overview

This page covers **runtime reliability** — why agents drift from workflows mid-execution and how to prevent it. For authoring multi-step workflows (deciding step order, writing phase definitions, structuring the overall flow), see [workflow.md](workflow.md). These pages are complementary: author the workflow with workflow.md, then harden it for runtime reliability using this page.

---

## When to Read This Page

Read this page when:

- An agent completes "step 3" but the output doesn't match what step 3 required
- An agent loops indefinitely or stops at an unexpected point
- An orchestrator over-parallelizes and produces conflicting outputs
- A multi-step workflow produces correct outputs on step 1 but drifts by step 4
- Tool calls are retried in infinite loops on non-retryable errors
- Context pressure causes the agent to abandon the original goal
- You are designing a workflow with 4+ steps and need to harden it before shipping

---

## The 5 Canonical Workflow Patterns

### Prompt Chaining

**Use when:** The task decomposes cleanly into fixed sequential subtasks where each output is the next step's input. Anthropic: *"ideal for situations where the task can be easily and cleanly decomposed into fixed subtasks."* Examples: translate → quality-check → format; research → draft → cite.

**What the prompt needs:** Explicit output format per step (the next step's literal input schema), a gate condition per step ("proceed only if [measurable condition]"), and a programmatic checkpoint between steps.

**Gotcha:** Errors compound with no recovery path. A wrong output at step 2 poisons steps 3–N. Embed a gate condition at each step boundary; without it, the chain propagates garbage silently.

---

### Routing

**Use when:** A classifier must direct input to a specialized handler based on input type. A routing classifier sends customer intents to specialized agents (billing, technical, escalation).

**What the prompt needs:** A stable classification taxonomy pasted directly into the classifier prompt (not file-referenced), a named fallback route for unclassified inputs, and separate prompts per route — not a single prompt with conditional logic.

**Gotcha:** Overlapping category boundaries cause misclassification. Each category must be mutually exclusive and exhaustive. State the specific trigger condition for each route as a boolean: "If the query mentions an invoice number or payment, route to billing."

---

### Parallelization

**Use when:** The task decomposes into independent subtasks with no shared mutable state. Two variants:

- **Sectioning** — split task into independent subtasks, run concurrently, merge. Example: scan 5 files simultaneously for security issues.
- **Voting** — multiple independent attempts on the same task, select best. Example: 3 agents independently draft a summary; synthesizer picks the strongest.

Anthropic: *"LLMs generally perform better when each consideration is handled by a separate LLM call."*

**What the prompt needs:** Confirmation that subtasks are truly independent (no shared file writes), explicit merge/arbitration rule in the synthesizer prompt. When parallel results conflict, the synthesizer must have a concrete resolution rule — not "use your judgment."

**Gotcha:** Parallel tool results that conflict require an explicit arbitration rule embedded in the synthesizer prompt. Omitting it produces nondeterministic synthesis.

---

### Orchestrator-Workers

**Use when:** The task requires dynamic decomposition that cannot be pre-specified — the orchestrator must decide at runtime how many workers to spawn and what each should do.

**What the prompt needs:** Effort-scaling heuristic in the orchestrator prompt. Anthropic's multi-agent research system learned that simple, short orchestration instructions ("research the semiconductor shortage") caused worker duplication. The orchestrator prompt must specify: *"Simple fact-finding: 1 agent with 3–10 tool calls. Direct comparisons: 2–4 subagents with 10–15 calls each."* Workers write artifacts to external storage and return lightweight references — not full content.

Each worker prompt must include: objective, output format, explicit tool list, and scope boundary (what is OUT of scope).

**Gotcha:** Without effort-scaling hints, orchestrators either over-parallelize (spawning redundant workers) or under-parallelize (doing multi-step work inline when isolation would help). Embed the heuristic directly in the orchestrator prompt.

---

### Evaluator-Optimizer

**Use when:** Output quality is objectively measurable, iterative refinement demonstrably improves it, and you have clear evaluation criteria. Anthropic: *"Effective when we have clear evaluation criteria, and when iterative refinement provides measurable value."*

**What the prompt needs:** Evaluator prompt articulates criteria as a checklist (see Self-Correction section below). Hard max-iterations guard — embed it in the orchestrator, not the evaluator.

**Gotcha:** Using the same model as both generator and evaluator in a single call produces systematically weak self-critique. The evaluator must run in a fresh context (separate agent or separate turn). See Self-Correction section.

---

## What Agents Need to Follow Workflows Reliably

MAST 2025 (arXiv:2503.13657) found *"Unaware of termination conditions"* caused 12.4% of all multi-agent system failures. The following 7 prompt elements address the leading causes of drift:

1. **Explicit acceptance criteria per step.** Replace "complete the analysis" with "write a 3-sentence summary to scratch/summary.txt; done when file exists and contains ≥3 sentences." Measurable, not subjective.

2. **Goal restated at every step.** Per-step context (the prior step's output) dominates original goal by step 3–4. Prepend the original objective verbatim to each step's prompt.

3. **State externalized.** Anthropic's research system saves its plan to memory: *"if the context window exceeds 200,000 tokens it will be truncated and it is important to retain the plan."* Write intermediate state to a file at each checkpoint. Pass the file path (not content) to the next step.

4. **Stopping conditions made explicit.** Include *"stopping conditions (such as a maximum number of iterations)"* and `maxTurns` in agent definitions (Claude Code best practices). "Keep going until done" is not a stopping condition.

5. **Boolean decision criteria, not judgment calls.** "If tests pass" is testable. "If the implementation looks good" is not. Every branch in a workflow must resolve to a binary condition an agent can evaluate without interpretation.

6. **Output format locked per step.** Tool definitions and step specifications deserve the same prompt engineering attention as the overall prompt. Format mismatches between producer and consumer are the leading cause of chaining failures — the next step receives a shape it cannot parse.

7. **Effort-scaling hints for orchestrators.** Without guidance, orchestrators either over-parallelize or under-parallelize. Specify the heuristic inline.

---

## Drift: Three Root Causes and Countermeasures

MAST 2025 found 43.8% of multi-agent failures are system design issues — not model capability gaps.

### Context Dilution

MAST statistics: *"Step repetition"* (15.7%) and *"Disobeying task specs"* (11.8%) both trace to context dilution — the original goal gets buried under accumulated tool outputs and intermediate results.

**Countermeasures:**

- Restate the original goal at the start of each step prompt verbatim.
- Trigger context compaction before 80% window fill. Anthropic compacts at 95%; 80% is safer for agents because the last 15% is when context-pressure completion mode activates.
- Use `/compact Focus on [task-specific constraint]` to direct what survives compaction.

### Ambiguous Next Step

The agent improvises when the workflow has a gap between steps — no explicit handoff, no declared input for the next step.

**Countermeasures:**

- Number steps with `## Step N:` headers.
- Require a mandatory "what I'm about to do" declaration at the start of each step as a forcing function for self-verification.
- Specify the exact output a step produces and the exact input the next step expects. No gaps.

### Missing or Incorrect Verification

MAST statistics: *"No/incomplete verification"* (8.2%) + *"Incorrect verification"* (9.1%) = 17% of failures. The highest-improvement intervention (+15.6%): *"added high-level task objective verification."*

**Countermeasures:**

- Every step must have a verification command the agent runs and inspects — not self-report.
- Use `## Acceptance Criteria` per plan step with mechanically runnable commands (not prose).
- Distinguish between proxy verification ("the file exists") and objective verification ("the file exists AND the test suite passes with 0 failures").

### Drift Countermeasures Checklist

Before deploying any multi-step workflow:

- [ ] Each step has a measurable acceptance criterion (a command to run, an expected output to check)
- [ ] `maxTurns` declared in agent frontmatter
- [ ] Original goal restated at the start of each step prompt
- [ ] Intermediate state written to a file at each phase boundary
- [ ] Stopping conditions explicit and boolean
- [ ] Output format per step matches input format of next step
- [ ] Verification is mechanical (run a command), not self-report
- [ ] Compaction trigger set at ≤80% window fill

---

## Self-Correction and Reflection Loops

**Reflexion pattern** (Shinn et al. 2023, https://arxiv.org/pdf/2303.11366): Generate → Critique → Refine, with critique stored in "verbal memory" persisting across attempts. Delivers 10–20 percentage-point pass-rate improvements on coding benchmarks. The key mechanism: failure observations are stored as explicit text, not silently discarded.

### When to Add a Critic Loop

Add a reflection loop when all three conditions hold:

1. Output has objectively measurable quality (a checklist, test suite, or specification to check against)
2. Iterative refinement demonstrably improves it (not just reshuffles content)
3. Critique can be specified as a checklist — not "make it better"

### When Reflection Hurts

- **Over-correction:** No convergence criterion → indefinite rewrites. Fix: max 3 iterations + threshold gate ("stop when all criteria PASS").
- **Infinite loops:** Critic finds an issue the generator structurally cannot fix. Fix: 3-strikes circuit breaker. GSD Agentic Architecture Playbook: *"after three failed debugging attempts, the agent dumps state and recommends a fresh session to prevent circular reasoning."* (https://dstreefkerk.github.io/2026-02-agentic-architecture-playbook-patterns-for-reliable-llm-workflows/)
- **Weak self-critique:** Same model evaluating its own output is biased toward approval. Fix: fresh context or separate agent. Claude Code best practices: *"A fresh context improves code review since Claude won't be biased toward code it just wrote."*
- **Context collapse:** Reflection loops accumulate failed attempts. Fix: compact failed attempts to summary, retain only "what failed and why."

### Generator ≠ Critic Rule

Never use the same agent turn to both generate and critique. The generator and evaluator must run in separate contexts — either separate agent dispatches or separate turns with compaction between them.

### Reliable Evaluator Prompt Structure

```
You are evaluating [artifact].
Acceptance criteria (check each):
- [ ] Criterion 1 (testable)
- [ ] Criterion 2 (testable)
Return: PASS | FAIL + specific list of unmet criteria.
Do not explain met criteria.
```

---

## Tool-Use Loops

**Classify errors before retrying.** ReAct retry analysis (https://towardsdatascience.com/your-react-agent-is-wasting-90-of-its-retries-heres-how-to-stop-it/): 90.8% of retries were wasted — not because the model was wrong, but because the system kept retrying tools that did not exist. 19 of 21 failures had `hallucinated_tool_exhausted_retries` as root cause.

**Error classification:**

| Error Type | Examples | Action |
|---|---|---|
| **Non-retryable** | tool-not-found, invalid input schema, permission denied | Fail immediately; record and continue |
| **Retryable** | network timeout, rate limit, transient error | Exponential backoff: 1s, 2s, 4s, 8s |

**Per-tool circuit breakers.** Use per-tool retry counters, not a global retry counter. A global counter causes unrelated tools to exhaust the budget from one bad tool's failures.

**Deterministic tool routing.** ReAct benchmark: *"0 hallucination events"* when tool name selection moved from LLM output to Python dictionaries resolved at plan time. For Claude Code: explicit tool list, distinct descriptions, no functional overlap between tools. Anthropic: *"Similar tools without clear distinctions create usage errors."*

**Give space to reason.** Ask the agent to produce a `<plan>` block before the first tool call in multi-step sequences: *"Give models enough tokens to think before it writes itself into a corner."*

**Partial-result handling.** Without explicit instructions, agents either silently use incomplete data or loop indefinitely. Specify: "If the tool returns fewer results than expected, proceed with what you have and note the gap in your output."

**Three-strikes give-up rule.** Embed in every tool-use workflow:

```
If a tool fails 3 times with the same error, record the tool name and error,
skip this step, and continue. Include [TOOL FAILURE: tool_name] in your output.
```

---

## State and Context Preservation Across Long Workflows

Claude Code best practices: *"Claude's context window holds your entire conversation... LLM performance degrades as context fills."*

### Three-Layer Architecture

Target 10–15% orchestrator context fill to maintain reasoning quality across long workflows:

```
Orchestrator / Commands (~50-100 lines, keeps context at 10-15%)
  ↓ passes FILE PATHS, not file content
Workflows (~200-400 lines per step)
  ↓ spawns with full task + acceptance criteria
Agents (fresh 200K context, discarded after)
```

Anthropic's research system: *"subagents call tools to store their work in external systems, then pass lightweight references back to the coordinator."*

**File-paths-not-content rule:** Pass `scratch/step2-output.md` to step 3, not the content of that file. The next step reads what it needs; the orchestrator context stays lean.

**Sub-agent dispatch as isolation.** Each sub-agent starts with a fresh 200K context window. Use dispatch to contain large tool outputs, verbose investigation, and multi-file scanning. See [subagent-patterns.md](subagent-patterns.md) for dispatch mechanics.

**Persistent memory frontmatter.** `memory: user | project | local` in agent frontmatter writes to `~/.claude/agent-memory/`. Use for: codebase patterns discovered during execution, recurring issues, learned preferences. Do NOT use for task state or large artifacts.

**TODO list pattern.** Embed a checklist in the workflow prompt; agent appends `[DONE]` to each item. MAST: *"Adding high-level task objective verification"* produced the highest improvement (+15.6%). The TODO list provides that objective anchor across all steps.

**Compaction hints.** Add to CLAUDE.md: *"When compacting, always preserve the full list of modified files, the current step number, the original goal, and any test commands."* This survives `/compact` and gives the agent enough context to resume.

For caching and context-budget mechanics that determine how fast context fills: see [token-turn-optimization.md](token-turn-optimization.md).

---

## Copy-Pasteable Patterns

**Step header — paste at the top of every step prompt:**

```markdown
## Step N: [Step Name]
**Original goal:** [restate verbatim]
**This step does:** [single sentence]
**Acceptance criteria:** run `[command]`; expect `[specific output]`
**On failure:** [specific recovery instruction]
**Output:** write to `[path]`
```

**Tool description — use for every tool in a multi-tool workflow:**

```
tool_name: [what it does — one line]
  Use when: [specific condition]
  NOT when: [boundary that looks similar]
  Returns: [exact format description]
```

**Sub-agent dispatch — use for every worker dispatch:**

```markdown
Objective: [specific goal]
Output format: [exact structure]
Tools: [explicit list]
Scope boundary: [what is OUT of scope]
Write output to: [path]
```

**Error-handling rule — embed in every tool-use workflow:**

```
If a tool returns an error:
- Not-found / invalid-input: do not retry; record [TOOL FAILURE: name, reason] and continue
- Timeout / rate-limit: retry up to 3 times with 2s pause between attempts
- After 3 retries: record failure and continue without blocking
```

---

## Anti-Patterns

| Pattern | Why It Fails | Correct Approach |
|---|---|---|
| Vague acceptance criteria ("complete the task") | No testable end condition; agent self-reports done | Replace with a runnable command and specific expected output |
| No stopping condition | MAST: 12.4% of failures trace to missing termination conditions | Set `maxTurns` in agent frontmatter; embed iteration cap in prompt |
| Orchestrator reads all files inline | Context fills to 80%+ by step 2; reasoning degrades | Pass file paths; sub-agents read what they need |
| Retrying non-retryable errors | ReAct: 90.8% retry budget wasted on tool-not-found loops | Classify errors; fail immediately on non-retryable |
| Same model as generator and critic | Biased toward approving its own output | Separate agent dispatch or fresh context for evaluator |
| No restating original goal per step | Goal gets buried under accumulated outputs by step 3 | Prepend original goal verbatim to each step prompt |
| Implicit step handoff ("then do X") | Agent improvises the transition | Explicit output format per step = exact input format of next step |
| Over-specified CLAUDE.md | Important rules get lost in noise | Aim for ≤200 lines; cut rules that aren't being followed |
| Trusting model completion claims | Agents are optimistic; context-pressure completion mode at 80%+ | Run mechanical verification commands; never accept self-report |
| Reflection loop without max-iterations | No convergence → indefinite rewrites | Hard cap at 3 iterations; threshold gate to exit |
| Chained agents without explicit handoff format | Consumer receives unrecognized output shape | Specify exact producer output format; lock it per step |
| Parallel dispatch with shared state | Agents edit same file; merge conflicts | Sequential dispatch for coupled tasks; parallel only for independent |

---

## Cross-References

- [workflow.md](workflow.md) — Authoring workflows: step ordering, phase definitions, overall flow structure
- [subagent-patterns.md](subagent-patterns.md) — Sub-agent dispatch mechanics: context crafting, model selection, status handling
- [token-turn-optimization.md](token-turn-optimization.md) — Context budget management, prompt caching, and turn-count reduction
