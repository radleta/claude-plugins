---
tags: [claude-code/agent-design, claude-code/drift]
updated: 2026-04-23
summary: "Agent constraint blocks can drift from tools: frontmatter when capabilities expand"
---

# Agent Constraint Drift: Tools vs. Descriptive Text

## The Gotcha

When a Claude Code agent's `tools:` frontmatter is expanded (e.g., adding Bash to read-only verifiers), descriptive `<constraint>` blocks in the agent body text are easy to miss. The body text stays wrong ("No Write/Edit/Bash") while the actual capabilities have shifted ("Bash allowed but hook-gated to git read-only"). This is a specific sub-case of documentation drift: the tools list IS the capability contract, but a reader inspecting the body often reads the constraint text first and trusts it.

### Why this matters

- A security verifier scanning the agent file will flag the discrepancy as an apparent elevation of capability when it's actually an outdated description.
- Each constraint-block edit that follows a tool-list change costs a full verification iteration (coder + security re-verify).
- The contract mismatch is non-obvious — a reader sees "No Bash" in prose and concludes Bash is blocked, contradicting the YAML.

## Fix Pattern

When adding a tool to an existing agent's `tools:` list that contradicts any descriptive body constraint, **update both in the same commit**.

### Wording guidance

Prefer wording that states the capability AND its gating (e.g., "Bash restricted to git read-only commands via tool-guard hook") rather than a blanket deny. This keeps the constraint block truthful and prevents future readers from trusting a one-sided prohibition.

### Example

Instead of:
```
<constraint>
No Write/Edit/Bash
</constraint>
```

Use:
```
<constraint>
No Write/Edit. Bash restricted to git read-only commands via tool-guard hook.
</constraint>
```

## Detection

Security verifiers will flag any Bash/Write/Edit in `tools:` that contradicts a `<constraint>` block claiming they are denied. This is correct behavior — the verifier is catching the drift. The fix is to update the prose to match the actual capability.

## Related

- **Command Architecture** — See [Command Dispatch Parity Patterns](../command-architecture/command-dispatch-parity-patterns.md) for broader agent design patterns
- **Tool Guards** — Bash restrictions on agents are enforced via `~/.claude/scripts/tool-guard.sh` (PreToolUse hook)
