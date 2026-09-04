---
tags: [agent-expert/additional-principles]
summary: "Principle #20: Specify Required Capabilities Explicitly — describe WHAT capability is needed, not WHICH tool, for future-proof instructions"
---

# Principle #20: Specify Required Capabilities Explicitly

**Category:** Process & Workflow
**Priority:** Tool-heavy workflows
**Complexity Cost:** Medium

**When to use:**
- Complex workflows requiring specific capabilities
- When capability requirements matter
- When avoiding ambiguous capability selection

**What it means:**
- Describe WHAT capability is needed, not WHICH tool to use
- Specify the operation (search, find, read) and its parameters
- Let the agent select the best available tool for the capability
- Instructions remain valid as tooling evolves

**How to apply:**

```xml
<capability name="pattern-search">
  <purpose>Search for code patterns across files</purpose>

  <when-needed>
    <scenario>Finding all usages of a function</scenario>
    <scenario>Searching for patterns with regex</scenario>
  </when-needed>

  <when-not-needed>
    <scenario>Reading full file (use file-reading capability instead)</scenario>
    <scenario>Finding files by name (use file-finding capability instead)</scenario>
  </when-not-needed>

  <requirements>
    <requirement name="pattern" required="true">Regex pattern to search for</requirement>
    <requirement name="scope" required="false">Directory to search (default: project root)</requirement>
  </requirements>

  <examples>
    <example>
      Search for pattern "use[A-Z]\\w+" in src/ directory
    </example>
    <example>
      Find all usages of function "processData" in codebase
    </example>
  </examples>
</capability>
```

**Why capability-based vs tool-specific:**
- Tools evolve and improve over time (e.g., basic search → semantic search → AI-assisted search)
- New, better tools may become available
- Instructions remain valid as tooling improves
- Agent can select best available tool for the capability
- Avoids coupling instructions to specific tool names
