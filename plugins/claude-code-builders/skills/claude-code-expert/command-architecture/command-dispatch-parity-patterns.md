---
tags: [claude-code/architecture]
updated: 2026-04-23
summary: "Structural differences between main-session and sub-agent-dispatching command variants"
---

# Command Dispatch Parity Patterns

## Pattern

When Claude Code commands come in paired variants — a main-session version and a sub-agent-dispatching version — the internal per-step loop structures are fundamentally different, not merely stylistic variations.

### Why They Differ

**Sub-agent-dispatching commands** encapsulate critical work (tests, acceptance checks) inside thin sub-agents. The parent command never runs those checks itself; instead, it dispatches the agent, reads the agent's verdict, and propagates findings downstream.

**Main-session commands** are monolithic. They must perform all checks inline — including mechanical acceptance-criteria verification — before moving to the next phase. There is no encapsulation boundary where testing can hide.

### Consequence for Loop Design

The per-step loops have the same overall structure (initialization → verification → review → fix-loop → cleanup), but the verification and review phases invert:

| Phase | Sub-Agent Dispatch | Main-Session |
|-------|-------------------|--------------|
| **Verification** | Encapsulated inside coder sub-agent; parent never runs explicit check | Parent must explicitly run acceptance-criteria tests; retries up to N times before proceeding |
| **Review** | Separate dispatch of verifier agents reading coder's report | Dispatch of verifiers only after explicit mechanical pass |

Same outcome (code is verified before proceeding), different implementation.

### Structural Implication

When normalizing two command variants to have the same step count (e.g., 11 sub-steps a–k), the step identifiers (3a, 3b, 3c, 3d, 3e) have different semantic meaning:

- **Main-session steps 3c–3e**: Implement → Verify Acceptance Criteria → Review
- **Sub-agent-dispatch steps 3c–3e**: Dispatch Coder → Dispatch Verifiers → Evaluate Verdicts

Same step letter, entirely different operation. This is **intentional design**, not a bug.

## Design Rule

**When designing a new command pair (main-session variant + dispatcher variant):**

1. Identify the critical checks that only the dispatcher's sub-agents will run (e.g., tests, acceptance-criteria validation, internal verifications).
2. In the main-session variant, create an explicit step for those checks before moving to the external verifier dispatch.
3. In the dispatcher variant, embed those checks inside the sub-agent; the parent command skips the explicit step.
4. Document this asymmetry clearly so future maintainers don't "simplify" one variant to match the other and lose the check.

## Danger Zone

The instinct to "mirror exactly" is correct for 70% of the steps. It is **wrong for steps that encapsulate critical checks**. Mirroring verification-phase steps can collapse necessary checks into earlier phases and silently break the verification contract.

---

*Discovered while designing parity between the former `/implement-code` (main-session) and `/implement-code-hybrid` (dispatcher), April 2026. The hybrid duality was subsequently collapsed (implement-code-v2, April 2026): `/implement-code` is now the sub-agent-dispatching variant; the separate main-session variant no longer exists.*

*Related: Command Parity Guidelines, Main-Session vs Dispatcher Command Checklist*

## See Also

- [Command Builder Patterns](../builders/command-patterns.md) — Complete command/skill file authoring reference including cost-aware dispatch design
