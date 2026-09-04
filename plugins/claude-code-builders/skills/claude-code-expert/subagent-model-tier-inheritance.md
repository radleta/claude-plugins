---
tags: [claude-code/subagent-dispatch]
summary: "Subagent model tier is declared in its own YAML frontmatter, not inherited from parent --model flag"
---

## Subagent Model Tier Ignores --model on Parent claude -p

When you run `claude -p "<prompt>" --model haiku`, the `--model` flag sets only the *parent* session's model. Any subagent dispatched via the Agent tool runs at the model declared in its own YAML frontmatter, regardless of the parent's flag. The parent flag does not propagate down the dispatch chain.

**Concrete impact:** `claude -p "/handoff <id>" --model haiku` looks like a cheap smoke test, but `/handoff` dispatches the `handoff-manager` subagent whose frontmatter declares `model: opus`. The synthesizer step that composes `HANDOFF.md` runs on Opus and takes ~11 minutes, even though the parent is Haiku and would finish in seconds.

**Mitigation options:**
- Use `--max-turns N` to prevent the subagent from ever firing if you only need to test the parent-level command parsing.
- For true fast validation of MCP-backed tools, call the MCP tool directly (e.g., `mcp__scratch-memory__write_session`) instead of going through the command layer — round-trip in seconds vs. 11 minutes.
- If you need the full command path but want to bound cost, check subagent frontmatter before running and accept the synthesizer tier's cost deliberately.

**Discovered:** During install-scope-flags session. Two `claude -p "/handoff ..."` smoke tests each ran ~11 min despite `--model haiku` on the parent. The fast-validation alternative turned out to be a direct MCP tool call, which completed in seconds and confirmed the same server-side behavior.

**Impact:** Any `claude -p` invocation that triggers a subagent with a high-tier model declaration will incur that tier's cost and latency unconditionally. Check subagent frontmatter before using `claude -p` as a "cheap test."
