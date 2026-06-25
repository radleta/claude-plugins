---
tags: [claude-code/dispatch, claude-code/performance]
updated: 2026-04-23
summary: "Cache-economics trade-off analysis for sub-agent dispatch: agent body vs dispatch prompt vs runtime file reads"
---

# Sub-Agent Dispatch Cache Economics: Agent Body Beats Inlined Boilerplate by ~50×

When a Claude Code command dispatches a sub-agent with a prompt that contains stable boilerplate (report-body structure, MCP-call shape, return-text contract, banned-pattern reminders), that boilerplate passes through three distinct cost regimes depending on where it lives:

| Destination | Main-session cost | Sub-agent cost | Cacheable across dispatches? |
|---|---|---|---|
| Inlined in dispatch prompt | **Output tokens** (generated every time; ~5× input cost; never cached) | Input tokens (user turn; partial cache only if prefix is byte-identical) | Partial — breaks at first variable byte |
| Agent body / preloaded skill (via `skills:` YAML) | Zero (never regenerated) | **Cached input tokens** (full system-prompt cache hit on dispatch #2+ within 5-min TTL) | **Yes — full prefix cache** |
| File the sub-agent Reads at runtime | Zero | Tool-result input tokens (fresh every dispatch) | Rarely — tool result lands after variable user turn |

## Net cost differential

Moving the same bytes from the dispatch prompt into the agent system prompt is roughly **50× cheaper per token** on dispatch #2+:
- **5× savings** from output→input tokens (Anthropic's input tokens are ~20% the cost of output tokens in current pricing)
- **10× savings** from cached-input vs fresh-input (cache hit is ~10% of input cost)

Even with no cache warming (dispatch #1), the move is still 5× cheaper because main-session output tokens are expensive. Caching compounds the win on every subsequent dispatch within the TTL window.

## Why runtime Read doesn't help

An agent Reading a file at runtime seems like it should cache — but tool-results land in the sub-agent's context *after* the variable user turn (dispatch prompt), so the cache typically breaks before the Read result position. The body content ends up as fresh input tokens every dispatch. Reserve runtime Reads for **step-specific** content that genuinely varies per dispatch (the step file, prior verdicts, feed-forward output) — not for stable body-structure boilerplate.

## Dispatch-prompt prefix hygiene

Even with stable content moved out, the remaining dispatch prompt is still a user turn. To maximize partial caching of what remains, start the dispatch with a **byte-identical prefix** across all steps, with variable bits (step number, iter, paths) placed AFTER. The cache holds through the stable header; only the variable tail re-enters as fresh input.

## Pattern summary

For any Claude Code command that dispatches sub-agents repeatedly:

1. **Stable content** (body-structure templates, call shapes, return contracts, domain reminders) → **agent body** or **preloaded skill** (via `skills:` YAML). Cached system prompt = best destination.
2. **Step-variable content** (step number, iter, paths, feed-forward) → dispatch prompt, placed after a byte-identical prefix header.
3. **Bulk content needed lazily** (plan README, step file, prior verdicts) → paths in dispatch prompt; agent Reads at runtime.

## Application

Applies to every Claude Code command that dispatches sub-agents — `/implement-code`, `/brainstorming`, any future command that uses the sub-agent dispatch pattern. Future dispatch-prompt designs should default to "stable content in agent, variable content in dispatch" rather than re-teaching the agent its own contract on every dispatch.

## See Also

- [Agent Builder Patterns](../builders/agent-patterns.md) — Cache-Aware System Prompt Architecture section on agent body vs dispatch prompt placement

- [Session Data](../platform-features/session-data.md) — Analyzing cache hit rates and token costs via JSONL transcript parsing
- [Hooks](../platform-features/hooks.md) — Hook events that fire during cached dispatch sequences
- [Agent Teams](../platform-features/teams.md) — Teams dispatch economics vs single-agent sub-agent cache patterns
