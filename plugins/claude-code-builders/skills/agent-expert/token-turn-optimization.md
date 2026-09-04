---
tags: [agent-expert/optimization]
summary: "Token and turn optimization for agents: prompt caching, parallel tool calls, tool description engineering, context budget, extended thinking, output formats, sub-agent dispatch, cache-aware skill design, anti-patterns"
---

# Token & Turn Optimization

## Overview

Token and turn cost are the two levers for reducing agent operating cost and latency. This page covers mechanics — how caching works, how context fills, what output formats cost, when sub-agent dispatch pays off. For dispatch mechanics (context crafting, model selection, status handling), see [subagent-patterns.md](subagent-patterns.md). For the progressive disclosure architecture that complements caching, see [expertise-contract-pattern.md](expertise-contract-pattern.md).

---

## When to Read This Page

Read this page when:

- Designing skills or agents with large system prompts or tool definitions (>2K tokens)
- Building agents that loop — multi-step workflows, evaluator-optimizer cycles, scraping pipelines
- Optimizing cost on production workflows where token bills are visible
- Debugging slow turns (extended thinking, verbose tool results, large context)
- Choosing between inline handling vs. sub-agent dispatch for a specific task
- Configuring prompt caching breakpoints for repeated agent invocations

---

## Prompt Caching Mechanics

Anthropic: caching *"reduce[s] costs by up to 90% and latency by up to 85% for long prompts."* (https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching)

### Pricing

| Operation | Cost |
|---|---|
| Cache read | 10% of base input token price (10x discount) |
| Cache write (5-min TTL) | 1.25x base input token price |
| Cache write (1-hour TTL) | 2.0x base input token price |
| Repeated 50K-token document within TTL | ~95% cost reduction on subsequent turns |

### TTL Options

- Default: 5 minutes — use for single-session loops
- 1-hour TTL: `{"type": "ephemeral", "ttl": "1h"}` — use for agentic workflows with longer gaps between invocations

### Breakpoint Limits and Ordering

Maximum **4 explicit breakpoints** per request. For most agent loops, one automatic breakpoint (single top-level `cache_control`) is sufficient — it advances forward each turn.

**Ordering rule (critical):** Cache prefix builds in this fixed order:

```
tools → system prompt → messages
```

A change to tool definitions invalidates all three layers. A system prompt change invalidates system + messages. Adding new messages invalidates only messages. Order your most stable content earliest.

### Minimum Cacheable Lengths

Content below minimum token length is silently not cached.

| Model | Minimum Tokens |
|---|---|
| Opus 4.x / Haiku 4.5 | 4,096 |
| Sonnet 4.6 | 2,048 |
| Opus 4.1 and older | 1,024 |

**Verify caching works:** Check `cache_creation_input_tokens` and `cache_read_input_tokens` in the response. Both at 0 = caching failed (content too short or prefix changed).

### What to Cache

- Tool definitions (entire array — use `cache_control` on last tool)
- Large skill/system text loaded per session
- Loaded documents used across turns
- Growing message history (automatic caching handles this)

### What Invalidates Cache

| Change | Layers Invalidated |
|---|---|
| Any tool definition change | tools + system + messages |
| System prompt change | system + messages |
| Toggling web search / citations / speed mode | system + messages |
| Changing `thinking` parameters | messages |
| Adding or removing images | messages |
| Changing `budget_tokens` between turns | messages (system preserved) |
| New user/assistant message turn | messages only |

### Cache Pattern for Agents

```
1. Tool definitions array → cache_control on last tool
2. System prompt → own cache_control breakpoint
3. Message history → automatic caching (no explicit breakpoint needed)
```

---

## Parallel Tool Calls

(https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use)

### Native Behavior

Claude 4 (Opus, Sonnet) issues parallel calls by default for independent operations. Sonnet 3.7 and older are less likely to parallelize without explicit prompting.

### Prompt Formulas

**Lighter (soft nudge):**
```
For maximum efficiency, whenever you need to perform multiple independent operations,
invoke all relevant tools simultaneously rather than sequentially.
```

**Stronger (explicit instruction):**
```xml
<use_parallel_tool_calls>
When reading multiple files, run all Read calls in parallel.
When searching multiple patterns, run all Grep calls in parallel.
</use_parallel_tool_calls>
```

### Critical Implementation Rule

All tool results for a parallel batch **must be returned in a single user message**. Returning results in separate messages teaches Claude to avoid parallel calls on future turns in the same session.

### When to Disable

Set `disable_parallel_tool_use=true` when:

- Operations have side effects where ordering matters (write-then-read the same file)
- Sequential database mutations where atomicity matters

### Token-Efficient Tool Use Beta

Header `token-efficient-tools-2025-02-19` reduces output tokens for tool calls by up to 70%; early adopter average is 14% reduction across real workloads. (https://platform.claude.com/docs/en/agents-and-tools/tool-use/token-efficient-tool-use)

Available for: Sonnet 4.6, Opus 4.6, Haiku 4.5.

---

## Tool Description Engineering

Anthropic "Building Effective Agents": tool descriptions are "Agent-Computer Interface" design — invest as much as in HCI design. (https://www.anthropic.com/engineering/building-effective-agents)

### What Causes Wrong-Tool Selection

1. **Functional overlap** — if engineers can't definitively choose between two tools given the same input, agents will waste turns guessing. Anthropic: *"Similar tools without clear distinctions create usage errors."*
2. **Vague descriptions** — no edge cases, no example usage, no explicit boundaries
3. **Parameter ambiguity** — SWE-bench team fixed a class of tool errors by switching to absolute filepaths in all tool inputs

### Description Content

Include per tool:

- Example usage (one concrete input → expected output)
- Edge cases (what the tool handles that looks unexpected)
- Input format and boundaries
- `NOT when:` clause — the case that looks similar but should use a different tool

Do not over-stuff. Context engineering guidance flags over-stuffed tool descriptions as a top context-wasting pattern.

### Tool Output Verbosity

Compact structured output, not prose. A 10K-line log file appends to every subsequent turn in the conversation. Use preprocessing:

```bash
grep -E 'ERROR|FAIL' output.log | head -100
```

JSON key-value output is preferred over prose for downstream agent consumers.

### Per-Request System Overhead

Each request adds **313–346 tokens** for the tool-use system prompt (amount depends on `tool_choice` setting). Prompt caching amortizes this across turns — the overhead appears once per TTL, not once per request.

---

## Context Budget Management

Claude Code best practices: *"Claude's context window fills up fast, and performance degrades as it fills."* (https://code.claude.com/docs/en/best-practices)

### What Eats Context Fastest

1. Raw tool results (large command outputs, log files, full file reads)
2. Repeated file reads across turns (every Read re-appends the full content)
3. Over-loaded system prompts and CLAUDE.md
4. Unused MCP tool definitions loaded even when never called
5. Long debugging sessions with failed attempts in history

### Compression Techniques

**Sub-agent dispatch** (most powerful structural technique): sub-agent returns a 1,000–2,000 token summary to parent context. The detailed exploration — file scanning, test output, log analysis — stays isolated and is discarded after dispatch. See [subagent-patterns.md](subagent-patterns.md).

**File-not-output pattern:** Write large tool output to `.git/`-tracked temp files, then Read/Grep specific sections on demand. The file path is ~10 tokens; the content would be thousands.

**Context compaction** (beta header `compact-2026-01-12`): server-side 60–80% history reduction. Preserves architectural decisions, key outputs, and unresolved issues. Use `/compact Focus on X` to direct what survives. (https://platform.claude.com/docs/en/build-with-claude/compaction)

**Proactive `/clear`:** After 2 failed correction attempts on the same issue, `/clear` + a better prompt outperforms continued correction in a polluted context.

**Lazy-loading MCP tools:** Claude Code defers MCP tool definitions by default — only tool names enter context until first use. Design MCP servers to expose many narrow tools rather than few broad tools; each definition only enters context when called.

### CLAUDE.md Guideline

Aim for ≤200 lines. Bloated CLAUDE.md causes critical rules to be ignored — not because Claude can't read them, but because important rules get lost in the noise.

---

## Extended Thinking

(https://platform.claude.com/docs/en/docs/build-with-claude/extended-thinking)

### When to Use

- Complex multi-step reasoning problems
- Architectural decisions requiring trade-off analysis
- Problems where intermediate reasoning steps improve final answer quality
- Tool-use workflows requiring reasoning between calls (not just: call → respond)

### When to Disable

- Simple queries with single-step answers
- Fast-response use cases where latency matters
- Cost-sensitive loops where thinking tokens (billed as output tokens at full price) accumulate

### Budget Tiers

| Complexity | Budget Tokens |
|---|---|
| Simple analysis | 5,000–10,000 |
| Moderate complexity | 10,000–20,000 |
| Complex problems | 20,000–32,000 |
| Beyond 32K | Diminishing returns; Claude often does not use full budget |

### Opus 4.7 Adaptive Thinking

Manual `thinking: {type: "enabled"}` is removed in Opus 4.7. Use adaptive thinking with the effort parameter:

| Effort | Use for |
|---|---|
| `xhigh` | Coding tasks, agentic workflows requiring deep reasoning |
| `high` | Most intelligence-sensitive tasks |
| `medium` | Balanced cost/quality |
| `low` | Cost reduction where quality loss is acceptable |

### Cache Interaction

Changing `budget_tokens` between turns invalidates the message-layer cache (system cache is preserved). Keep `budget_tokens` consistent across turns in a session to maintain cache hits.

**Display:** Set `display: "omitted"` to suppress thinking from the response stream. The user pays the thinking token cost either way; `"omitted"` starts text output immediately (lower perceived TTFT).

---

## Output Format Choices

| Scenario | Format | Reason |
|---|---|---|
| Agent-to-agent communication | JSON key-value | Terser, structured, parseable |
| Human-facing final output | Prose or markdown | Readable |
| Status verdicts | Enums: APPROVED / ISSUES_FOUND / INCOMPLETE | Single token; unambiguous |
| Repeated agent turns | "Output only [format], no preamble" | Eliminates 15–40 token preambles |

**Eliminate preambles:** "Sure, I'll analyze..." costs 15–40 tokens per turn. In a 20-turn agent loop, that's 300–800 tokens of pure waste. Add to every agent prompt for repeated turns: "Do not explain your reasoning; output only [format]."

**Progressive disclosure in skills:** Multi-file skill (nav SKILL.md → sub-pages) loads only relevant subsection per invocation. A skill covering 10 domains costs 1/10th the tokens when only one domain is needed per session.

**Terse status enums:** Replace narrative verdicts ("The code appears to be well-structured and meets most of the requirements, though there are a few areas...") with `ISSUES_FOUND` + a bulleted list of specific findings.

---

## Turn-Count Reduction

Every unnecessary turn costs: one model inference, one round-trip latency, and context accumulation.

1. **Front-load complete success criteria.** State the exact test command and exact expected output in the initial prompt. Eliminates "did this work?" follow-up turns.

2. **Embed verification targets.** "Run `npm test` and verify all 47 tests pass" — the count makes success unambiguous without a follow-up.

3. **Gather ambiguities before starting.** Use AskUserQuestion to collect all unclear requirements in one turn, write a spec, then start implementation in a fresh session. Prevents mid-implementation disambiguation turns.

4. **Single-response directive.** For tool-heavy tasks: *"Use all tools you need and return a complete answer. Do not ask for clarification."* This enables parallel tool dispatch and prevents false stopping.

5. **Separate plan-mode from implementation.** Plan-mode exploration (broad file reading, pattern identification) fills context with investigation artifacts. Complete planning, then start implementation in a fresh context with only the relevant findings.

---

## Sub-Agent Dispatch as Token Strategy

(https://code.claude.com/docs/en/costs)

### When Dispatch Pays Off

Sub-agents return 1,000–2,000 token summaries to the parent. Detailed exploration stays isolated. Dispatch pays off for:

- Codebase investigation across many files (the investigation fills the sub-agent's context, not the orchestrator's)
- Log analysis with verbose tool output
- Test runs with large output
- Security review requiring broad file scanning

### When Dispatch Costs More Than It Saves

"Simple shell actions or quick git operations" — the architectural overhead (agent setup, context initialization, result parsing) exceeds the savings. Anthropic notes an Opus 4.6 over-spawning tendency: dispatching sub-agents for tasks that an inline tool call handles in 200 tokens.

### Model-Tier Delegation

Match model tier to task complexity:

| Role | Model | Token Cost Ratio |
|---|---|---|
| Orchestrator | Opus (complex reasoning, decomposition, evaluation) | 1x (baseline) |
| Workers | Sonnet | ~4x cheaper than Opus per token |
| Simple workers | Haiku | ~15x cheaper than Opus per token |

Typical pattern: 2K–3K Opus tokens (orchestration) + 15K–25K Haiku tokens (workers). Set `model: haiku` in sub-agent YAML.

### Team-Mode Cost

Anthropic Claude Code docs: *"agent teams use ~7x more tokens than standard sessions when teammates run in plan mode"* (each agent maintains its full context). Only use team-mode-equivalent patterns when task isolation value exceeds this 7x overhead.

---

## Cache-Aware Skill Design

### Stable Content Stays Stable

Cache prefix hits only when byte-identical. Any per-request content (session IDs, timestamps, dynamic values) must appear after the last cache breakpoint. Never embed dynamic values in system prompts or tool definitions.

### Version Bumps Invalidate

Editing SKILL.md changes the prefix hash — all cache entries for that prefix become invalid. Batch edits together rather than making incremental changes across sessions. Pre-warm the cache after publishing by running one representative request.

### Ordering in Multi-File Skills

In multi-file skills, the static navigation hub (SKILL.md) appears earliest in context — it is the most cacheable content. Dynamic sub-pages loaded on demand appear later. This ordering maximizes prefix cache hits.

**On-demand loading beats always-loaded.** A skill that loads everything on every invocation invalidates cache benefits from progressive disclosure. Load sub-pages only when the task requires them.

### Tool Definition Caching Pattern

Place `cache_control` on the **last tool** in the tools array. This caches all preceding tool definitions as a single prefix. Adding a new tool at the end invalidates only that one entry, not the entire array.

For cache-aware skill design that complements progressive disclosure: see [expertise-contract-pattern.md § Token Economics](expertise-contract-pattern.md).

---

## Anti-Patterns

| Pattern | Why It Fails | Correct Approach |
|---|---|---|
| Re-reading files across turns | Each Read re-appends full content; context fills quickly | Read once, summarize, pass summary forward |
| Verbose tool results not summarized | 10K-line log stays in context for every remaining turn | Preprocess with grep/head; write to file, read sections on demand |
| Over-loaded CLAUDE.md (>200 lines) | Important rules get lost in noise; claude ignores them | Keep ≤200 lines; cut rules that aren't being followed |
| Redundant per-turn instructions | "Always use TypeScript" repeated each turn burns tokens | Put once in system prompt and cache it |
| Vague task scope | "Improve this codebase" → broad scanning → massive context | Narrow scope: "Add input validation to login function in auth.ts" |
| Kitchen-sink sessions | Unrelated tasks fill context with irrelevant history | Use `/clear` between unrelated tasks; start fresh |
| Correcting same mistake repeatedly | Each correction adds to a polluted context | After 2 failed corrections: `/clear` + rewrite the prompt |
| Over-spawning sub-agents for small tasks | ~7x base token cost in plan mode; overhead exceeds savings | Inline tool calls for simple shell actions and quick git ops |
| Changing `budget_tokens` between turns | Invalidates message-layer cache every turn | Keep `budget_tokens` consistent across turns in a session |
| Parallel tool results in separate messages | Teaches Claude to avoid parallel calls in future turns | Return all parallel results in a single user message |
| Dynamic values in system prompts | Any change invalidates cache for all downstream layers | Move dynamic content below last cache breakpoint |
| Tool definitions changed per request | Invalidates all three cache layers on every request | Stabilize tool definitions; use a fixed set per session |

---

## Cross-References

- [subagent-patterns.md](subagent-patterns.md) — Dispatch mechanics: context crafting, model selection, status handling, parallel dispatch
- [expertise-contract-pattern.md](expertise-contract-pattern.md) — Progressive disclosure architecture that complements cache-aware skill design
- [workflow-following.md](workflow-following.md) — Runtime reliability: managing context across long multi-step workflows
