---
tags: [claude-code-expert/command-architecture]
summary: "Group hub for command architecture pages"
---

## Pages

- [Command Dispatch Parity Patterns](command-dispatch-parity-patterns.md) — Structural differences between main-session and sub-agent-dispatching command variants; why exact mirroring fails.
- [Sub-Agent Dispatch Cache Economics](subagent-dispatch-cache-economics.md) — Cache-economics trade-off analysis: agent body vs dispatch prompt vs runtime file reads; ~50× cost difference per token on dispatch #2+.
- [Model-Tier Delegation Economics](model-tier-delegation-economics.md) — Why mechanical edits should leave Opus main sessions for Sonnet/Haiku sub-agents; cost math, self-rationalization patterns to resist, and anti-recursion via in-rule audience scoping.
