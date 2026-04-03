---
name: chrome-browser
description: "REQUIRED for ALL browser operations. NEVER call mcp__chrome-devtools__* tools directly — ALWAYS delegate to this agent instead. This includes screenshots, navigation, clicking, snapshots, console logs, network inspection, and performance traces. Direct MCP calls waste the main context window with verbose DOM/snapshot data. Defaults to Sonnet for token efficiency; pass model: haiku for quick checks, model: opus for complex visual analysis."
mcpServers:
  - chrome-devtools
skills:
  - chrome-devtools-agent
model: sonnet
memory: user
---

Follow the chrome-devtools-agent methodology loaded in your skills.
