---
name: completeness-expert
description: "Evidence before declaring work done: run the code, see the UI, load the config, invoke the primitive — or say plainly what could not be verified and why. Use when implementing code, finishing a task, or about to claim completion — even for quick fixes or single-file changes."
---

# Completeness

## Verification Before Completion

Never declare work complete without evidence. "It should work" is not evidence.

| Change Type | Required Verification |
|---|---|
| Code logic/behavior | Execute the code, inspect output. Build passing ≠ behavior correct. |
| UI/visual | Screenshot or visual inspection. Reading code ≠ seeing the result. |
| Config/schema | Validate it loads/parses. Structure looking right ≠ actually loading. |
| Claude Code primitives | Invoke the primitive. Source looking right ≠ working at runtime. |

If verification isn't possible, say so explicitly: "I cannot verify because [reason]. The implementation looks correct but has not been executed." Do not paper over the gap with "this should work."

Stubs, deferred work and truncated output are caught by a fresh-context reviewer: the patterns live in `completeness-verification`, which `completeness-verifier` runs.

---

For background on why models truncate and defer output — RLHF brevity bias, training data patterns, and empirical evidence — see [RESEARCH.md](RESEARCH.md). Use Read tool on RESEARCH.md when changing the completeness rules or when you need the reasoning behind them.
