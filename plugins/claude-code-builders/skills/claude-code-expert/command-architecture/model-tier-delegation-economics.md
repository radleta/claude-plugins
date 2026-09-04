---
tags: [claude-code/architecture, claude-code/performance]
updated: 2026-04-29
summary: "Why mechanical edits should leave Opus main sessions for Sonnet/Haiku sub-agents; cost math, self-rationalization patterns to resist, and anti-recursion via in-rule audience scoping"
---

# Model-Tier Delegation Economics

When the main Claude Code session runs on an expensive model (Opus), mechanical work that does not need Opus reasoning should be dispatched to a cheaper sub-agent (Sonnet or Haiku). The model-tier price differential dwarfs sub-agent dispatch overhead, and the savings compound — naive intuition that "a single Edit is cheaper inline than dispatching" usually underestimates main-session cost.

## Price Differential

Per-token costs (Anthropic published rates, approximate):

| Model | Input | Output | vs Opus |
|-------|-------|--------|---------|
| Opus | $15 / M | $75 / M | 1× |
| Sonnet | $3 / M | $15 / M | ~5× cheaper |
| Haiku | $1 / M | $5 / M | ~15× cheaper |

The model running the session determines the bill for every token of reasoning. Reasoning that does not need Opus quality is paying a 5–15× premium when it stays inline.

## Why Mechanical Edits Compound on Main Session

The naive cost model — "an Edit call costs roughly the size of the diff" — misses what actually accumulates in main-session context:

1. **File contents** pulled in by the pre-edit Read
2. **The diff itself** lingering in context
3. **Post-edit verification Read** to confirm the change landed
4. **Follow-on reasoning tokens** for any subsequent step that touches the same file

All of those tokens are billed at the main-session model's rate. For Opus sessions that compounds quickly — a single "small" mechanical edit can reach 5–10K tokens of Opus pricing once verification and downstream reasoning are counted.

A sub-agent dispatch costs: agent system prompt + inherited CLAUDE.md + skill loads + dispatch prompt + tool-call cycle + return summary. That sounds expensive in absolute tokens, but at Haiku rates it is still cheaper than a few thousand Opus tokens. The break-even is much lower than the "3+ files" intuition suggests.

## The Self-Rationalization Trap

Models given a delegation rule with broad escape hatches ("don't delegate when it needs context / requires judgment / is just one file") will under-apply the rule because they bias to happy-path and overestimate how much main-session context the current task "really needs."

Phrases that sound like reasoning but are usually rationalizations to skip delegation:

- *"I need to keep this file in context"* — the diff report is sufficient for almost any follow-up
- *"This requires judgment"* — judgment was usually exercised already in deciding what to do; execution is mechanical
- *"Briefing the sub-agent costs more than doing it"* — under-counts post-edit Read, file content, and follow-on tokens
- *"It's just a one-liner"* — the one-liner still costs Opus rate for context, verification, and downstream reasoning

A rule that wants to actually fire should:

- Default to delegation (no opt-in threshold)
- List exceptions narrow enough that the model cannot easily rationalize the current task into them — keyed on user-observable signals ("user explicitly said inline", "user is dictating turn-by-turn"), not on model self-judgment about complexity

## Anti-Recursion: Writing Rules Visible to Sub-Agents

`~/.claude/CLAUDE.md` (level 4 user memory) and `./CLAUDE.md` (level 2 project memory) are loaded at session start for the main session AND for every Agent-tool-dispatched sub-agent. There is no "main-session-only" memory tier — any delegation rule placed in inheritable memory is read by sub-agents too.

Sub-agents have **no reliable self-identifying signal** to detect "I am a sub-agent and should not re-delegate":

- No environment variable distinguishes parent vs child sessions
- Tool availability is not a reliable proxy (general-purpose has full tools including Agent)
- Agent-specific system prompts often (but not always) override CLAUDE.md guidance

The only reliable mitigation is **explicit audience scoping inside the rule itself.** The rule's text must include guidance like *"if you are running as a dispatched sub-agent, complete the work directly — do not re-delegate. The cost rationale applies to the expensive main-session model; you are already on a cheaper model and your context is isolated."*

This works because models with theory-of-mind read the *why* and apply it correctly: the cost math inverts when you are already on the cheap tier, so the rule's premise no longer holds. Sub-agents read the same rule, internalize its scope, and do not recurse.

## Where This Lives

User memory: `~/.claude/CLAUDE.md`, section `## Delegate Mechanical Work to Cheaper Sub-Agents`. The section pairs the cost rationale, the default-to-delegate rule, named self-rationalization red flags, narrow user-observable exceptions, and an explicit anti-recursion clause.

## Related

- [Sub-Agent Dispatch Cache Economics](subagent-dispatch-cache-economics.md) — different concern: cache hit/miss cost, agent body vs dispatch prompt placement. Cache economics asks "when do these tokens get recomputed"; model-tier economics asks "what does each token cost." Both inform dispatch design.

- [Session Data](../platform-features/session-data.md) — Per-model token cost analysis: Opus vs Sonnet vs Haiku cost breakdown
- [Hooks](../platform-features/hooks.md) — Hook timeout budgets and model-tier impact on hook execution latency
- [Agent Teams](../platform-features/teams.md) — Model tier selection for teammate agents vs lead agent cost optimization
