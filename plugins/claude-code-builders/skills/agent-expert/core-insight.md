---
tags: [agent-expert/core-insight]
summary: "The core insight: structure helps but explain why — target agent-friendly middle ground between human docs and over-engineered protocols"
---

# The Core Insight

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
