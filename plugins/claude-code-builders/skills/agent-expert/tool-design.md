---
tags: [agent-expert/tool-design]
summary: "Design-time tool engineering: granularity heuristics, input/output schema philosophy, idempotency semantics, error-message design, result-shape conventions, tool surface budgeting, similar-tool disambiguation, versioning. Complements workflow-following.md (runtime) and token-turn-optimization.md (descriptions and tokens)."
---

# Tool Design: The Agent-Computer Interface

## Overview

This page covers **design-time tool engineering** — how to shape tools so agents select and use them correctly before you tune descriptions or worry about token cost. Good ACI (Agent-Computer Interface) design is the foundation that makes runtime reliability possible.

Anthropic frames tool design as "writing a great docstring for a junior developer on your team" — and stresses investing the same rigor in ACI as in human interface design. (https://www.anthropic.com/engineering/building-effective-agents) The research backs this up: even small refinements to tool definitions produced state-of-the-art SWE-bench results from Claude Sonnet 3.5, reducing error rates measurably. (https://www.anthropic.com/engineering/writing-tools-for-agents)

This page covers **what** to design. For **how to write the descriptions** that reach agents, see [token-turn-optimization.md](token-turn-optimization.md) (description engineering, parallel calls, caching). For **what happens when a tool call goes wrong at runtime**, see [workflow-following.md](workflow-following.md) (error classification, retry logic, tool-use loops).

---

## When to Read This Page

Read this page when:

- Defining a new tool set for an agent and deciding how many tools to expose
- Two tools in your set are functionally adjacent and you cannot decide where one ends and the other begins
- Agents are selecting the wrong tool or calling tools with wrong parameters
- Tool results are returning unstructured prose that the agent cannot parse reliably
- A mutating tool is being retried and causing duplicate side effects (double-send, double-charge)
- Tool error messages are not actionable and agents are looping without recovery
- You are evolving an existing tool and need to do it without breaking agents trained on the old shape

---

## The ACI Framing

**Tools are a contract between deterministic systems and non-deterministic agents.** JSON schema defines what is structurally valid, but cannot express when to call a tool, which optional parameters matter, or what combinations make sense. (https://www.anthropic.com/engineering/writing-tools-for-agents) The ACI is everything the agent uses to make that call correctly: the name, description, parameter names, schema constraints, result shape, and error message.

Anthropic's most direct guidance: *"If a human engineer can't definitively say which tool should be used in a given situation, an AI agent can't be expected to do better."* (https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) This is the test to apply to every tool boundary decision.

---

## Tool Granularity

### One Tool Per Intent, Not Per Resource

The canonical failure mode is wrapping API endpoints one-for-one: `list_users`, `list_events`, `create_event`. Agents receive a large flat surface and must compose intent from primitives. Anthropic's guidance is explicit — consolidate: replace `get_customer_by_id` + `list_transactions` + `list_notes` with `get_customer_context`. Replace `list_events` + `create_event` with `schedule_event`. (https://www.anthropic.com/engineering/writing-tools-for-agents)

**The heuristic:** one tool per *intent*, not per *resource*. An intent is what an agent is trying to accomplish in one logical step. If the agent always needs A before it can call B, collapse them.

### When to Split

Consolidation has limits. Split a tool when:

- The two operations have meaningfully different side effects (read vs. write)
- The input schemas differ enough that one tool's parameters would always be partially empty
- The tool description would need an `if/else` branch to explain when to use each mode — that branch is the split point

### The Narrow-Tool / Broad-Tool Trade-off

| Approach | Benefit | Cost |
|---|---|---|
| Many narrow tools | Each tool is unambiguous; schema enforces correct use | More selection decisions; larger tool surface |
| Fewer broad tools | Simpler API; fewer selection decisions | Ambiguous behavior; harder to describe cleanly |

MCP resolves this with **lazy-loaded narrow tools**: expose many specific tools but load definitions into context only on first use, so each definition only enters context when called. (https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) This gives narrow-tool precision without the token cost of loading all definitions upfront. See [token-turn-optimization.md § Context Budget Management](token-turn-optimization.md) for the mechanics.

---

## Input Schema Philosophy

### Make Wrong Inputs Impossible, Not Just Rejected

Schema design should *prevent* incorrect inputs from being constructed, not just reject them at runtime. This is the "Poka-yoke" principle applied to ACI: redesign the tool so the mistake cannot be made. (https://www.anthropic.com/engineering/building-effective-agents)

**Concrete example:** The SWE-bench team fixed a whole class of filepath errors by changing tool parameters from relative to absolute paths. The agent was constructing valid-looking relative paths that broke after directory changes — switching to `absolute_file_path` (required, string) made the invalid input class structurally impossible. (https://www.anthropic.com/engineering/building-effective-agents)

### Required vs. Optional

- Mark a parameter `required` when the tool cannot execute without it — not as a soft convention
- Optional parameters should have a documented default behavior, stated in the description: *"Omit for the full set; provide to filter"*
- Avoid optional parameters that silently change the tool's fundamental behavior — that is a split point (see granularity above)

### Parameter Naming

Names carry semantic load before the description is read. Anthropic guidance: use `user_id` not `user`, `file_path` not `fp`, `departure_date` not `date`. (https://www.anthropic.com/engineering/writing-tools-for-agents) Each parameter name should be unambiguously parseable without the description.

**Naming conventions:**
- Prefer `snake_case` (consistent with most LLM training data)
- Use the full noun: `organization_id`, not `org`; `start_timestamp`, not `start`
- Suffix with `_id` for identifiers, `_path` for file locations, `_date` / `_timestamp` for time values

### Enums vs. Strings vs. Nested Objects

| Type | Use when | Avoid when |
|---|---|---|
| `enum` | Fixed set of valid values; wrong values are meaningless | The set evolves frequently (version churn) |
| `string` + pattern | Open values but with format constraint (ISO date, regex) | No format constraint exists |
| Flat parameters | ≤5 related params | Parameters can be grouped by sub-intent |
| Nested object | Logical grouping of 3+ params used together | Single-level params — nesting adds noise |

Response format as an enum parameter is a high-value pattern: `{"format": "detailed" | "concise"}` let a Slack tool return 206 tokens in detailed mode vs. 72 in concise mode — a 65% token reduction with no schema change. (https://www.anthropic.com/engineering/writing-tools-for-agents)

### `additionalProperties: false`

Add this to every input schema object. It prevents agents from constructing calls with invented parameters that silently pass schema validation, and signals to strict validation modes that extra fields are errors. (https://modelcontextprotocol.io/specification/2025-11-25/server/tools.md)

---

## Output / Result Shape Philosophy

### Structured JSON, Not Prose

Agents must answer *"did this succeed?"* and *"what do I act on?"* from the tool result alone, without parsing English. Prose results are fragile: "The operation completed successfully, though the record may take a few minutes to appear" — which clause is the actionable signal?

**Preferred result shape:**

```json
{
  "status": "ok",
  "record_id": "usr_9a3f",
  "created_at": "2026-05-08T14:22:00Z"
}
```

**Status field conventions:**
- Always include a machine-readable `status` field: `"ok"`, `"not_found"`, `"partial"`, `"error"`
- Never rely on HTTP status codes alone — agents consuming MCP or SDK tools may not see them
- `"not_found"` and `"error"` are different: `"not_found"` is a valid answer ("I looked; it doesn't exist"); `"error"` is a malfunction

### "Found Nothing" vs. Error

This distinction trips up agents consistently. Define it explicitly per tool:

- Empty result set: `{"status": "ok", "results": [], "count": 0}` — success, the search ran, nothing matched
- Execution failure: `{"status": "error", "error_code": "SEARCH_TIMEOUT"}` — something broke

Never return an empty array with `isError: true`. Never return a non-empty result with `isError: true`. The `isError` flag (MCP standard) (https://modelcontextprotocol.io/specification/2025-11-25/server/tools.md) and the status field must agree.

### Pagination and Partial Results

- Always include a `next_cursor` or `next_page` field when results are truncated. Claude Code limits tool responses to 25,000 tokens by default. (https://www.anthropic.com/engineering/writing-tools-for-agents)
- The truncation message must be actionable: *"Showing 50 of 312 results. Use `cursor: 'abc123'` to fetch the next page, or add `filter_by:` to narrow results."*
- Partial success: `{"status": "partial", "processed": 47, "failed": 3, "failures": [...]}`

### Semantic Names in Output

Return `file_type` not `mime_type`, `display_name` not `uuid`, `image_url` not `256px_image_url`. (https://www.anthropic.com/engineering/writing-tools-for-agents) The agent must understand what to do with a field without a lookup table.

### `outputSchema` (MCP)

MCP 2025-11-25 formalizes this: tools MAY declare an `outputSchema` JSON Schema alongside `inputSchema`. When provided, servers MUST return structured results that conform to it; clients SHOULD validate. (https://modelcontextprotocol.io/specification/2025-11-25/server/tools.md) Declare `outputSchema` for any tool whose result feeds another tool — it documents the contract and enables validation.

---

## Idempotency Semantics

### The Three Classes

| Class | Behavior | Retry-safe? |
|---|---|---|
| **Read** (`GET`-like) | Returns state; changes nothing | Yes — always safe |
| **Idempotent write** (`PUT`-like) | Sets state to a target value; repeated calls = same result | Yes — safe to retry |
| **Non-idempotent write** (`POST`-like) | Creates new state each call; repeated calls multiply side effects | No — requires explicit guard |

The real-world failure: a timeout causes an agent to retry a `send_email` or `charge_payment` tool. Both calls succeed. The user receives two emails; the customer is charged twice. Production post-mortems show this pattern causes duplicate CRM records, duplicate Slack pings, and duplicate orders. (https://medium.com/@kaushalsinh73/7-patterns-that-make-agent-retries-idempotent-not-duplicative-dd48f022ce9b)

### Design Idempotency In, Not Around

**Idempotent write pattern:** `create_or_update_contact(email, fields)` — if the contact exists, update it; if not, create it. The result is always "this contact has these fields," regardless of how many times it runs.

**Idempotency key pattern:** For non-idempotent operations that cannot be restructured, require an explicit `idempotency_key` parameter:

```json
{
  "tool": "send_email",
  "parameters": {
    "to": "...",
    "subject": "...",
    "idempotency_key": "task-7f3a-step-2"
  }
}
```

The server stores the key and returns the cached result on duplicate calls without re-executing. Durable execution frameworks (Temporal, AWS Step Functions) enforce this at the infrastructure level. (https://www.buildmvpfast.com/blog/idempotent-ai-agent-retry-safe-patterns-production-workflow-2026)

### MCP Idempotency Annotations

MCP's `ToolAnnotations` includes `idempotentHint: true` to signal that repeated calls with the same arguments have no additional effect. (https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/) Clients use this to enable automatic retry on timeout. Mark all read tools and idempotent write tools with this hint; omit it for non-idempotent writes. These are **hints, not guarantees** — enforcement must live in the server implementation, not just the annotation.

The full MCP annotation set and when to use each:

| Annotation | Meaning | When to set `true` |
|---|---|---|
| `readOnlyHint` | Tool does not modify state | Search, read, list operations |
| `idempotentHint` | Repeated calls with same args = same result, no extra effect | PUT-style writes; reads |
| `destructiveHint` | Modifications may be irreversible | Delete, overwrite, send |
| `openWorldHint` | Tool interacts with external systems (APIs, email, web) | Any tool that reaches outside local state |

For the retry classification logic that consumes these signals at runtime: see [workflow-following.md § Tool-Use Loops](workflow-following.md).

---

## Error-Message Design

### What an Error Owes the Agent

An actionable error message answers three questions:
1. What went wrong (specific, not generic)?
2. What input should the agent have provided instead?
3. Is retrying safe, and if so, when?

**Anti-pattern:**
```json
{"error": "Internal server error", "code": 500}
```

**Pattern:**
```json
{
  "status": "error",
  "error_code": "FILE_NOT_FOUND",
  "message": "The path 'reports/q1.csv' does not exist. Check the spelling or run list_files(directory='reports') to see available files.",
  "retryable": false
}
```

Anthropic guidance: *"You can prompt-engineer your error responses to clearly communicate specific and actionable improvements."* (https://www.anthropic.com/engineering/writing-tools-for-agents) Error messages are part of the tool design, not an afterthought.

### MCP Two-Tier Error Model

MCP defines two distinct error channels: (https://modelcontextprotocol.io/specification/2025-11-25/server/tools.md)

- **Protocol errors** (JSON-RPC level): unknown tool name, malformed request — structural issues the agent cannot self-correct; returned as error objects outside the result
- **Tool execution errors** (`isError: true` in result content): input validation failure, API failure, business logic error — actionable feedback the agent CAN use to retry with corrected parameters

Clients SHOULD always pass tool execution errors to the agent; protocol errors are less useful for agent self-correction. Never wrap a tool execution error in a protocol error — it strips the actionable detail.

### Error Codes, Not Messages

Use short, stable error codes as the primary signal: `FILE_NOT_FOUND`, `RATE_LIMITED`, `PERMISSION_DENIED`, `INVALID_DATE_FORMAT`. The message is for humans and agent reasoning; the code is for programmatic handling by orchestrators. Agents can recognize stable codes; they cannot reliably parse evolving prose messages.

### Truncation Errors Are Different

When a tool result is too large, the truncation message is not an error — it is a direction: *"Showing 50 of 1,247 records. Add a `filter_by:` parameter or use pagination with `cursor: 'xyz'` to narrow results."* (https://www.anthropic.com/engineering/writing-tools-for-agents) Never return `isError: true` for truncation.

---

## Distinguishing Similar Tools

### The Disambiguation Requirement

Anthropic: *"Similar tools without clear distinctions create usage errors."* (https://www.anthropic.com/engineering/building-effective-agents) Each tool needs a `NOT when:` clause in its description naming the look-alike tool. This clause is one of the most important lines in the tool definition — it is the only text that tells the agent when NOT to call this tool.

### Worked Example: File Tools

| Tool | Use when | NOT when |
|---|---|---|
| `read_file(path)` | You need the full content of a known file | You need a section of a large file — use `read_file_section` |
| `read_file_section(path, start_line, end_line)` | You know the line range you need in a large file | You need to search for content — use `search_files` |
| `search_files(query, directory)` | You don't know which file or line contains the content | You know the exact path — use `read_file` |

Without these distinctions, an agent asked to "check the error handling in auth.ts" may call `read_file` on a 4,000-line file, consuming the full 25K token budget, when `search_files("error handling", "src/auth")` would have returned 20 lines.

### Namespacing as Disambiguation

When tools from multiple services are in the same context, prefix by service: `asana_search`, `jira_search`, `slack_search` — not three tools named `search`. Prefix by resource within a service: `asana_projects_search`, `asana_users_search`. (https://www.anthropic.com/engineering/writing-tools-for-agents) Consistent prefixes let agents reason about tool selection before reading the full description.

---

## Tool Surface Budgeting

### The Performance Cost of Too Many Tools

The "tool-use tax" research (https://arxiv.org/html/2605.00136v1) found that the tool-use protocol itself introduces performance overhead — 14–33% accuracy degradation across models even before considering selection errors. Protocol-induced errors account for a majority of agent failures in tool-heavy settings, not capability gaps. This establishes the cost side of adding tools: more tools = more protocol overhead per call.

Beyond protocol cost, selection degrades as surface area grows. Red Hat research on production agent deployments confirms: *"Giving the model access to all [tools] at once simply doesn't scale. The model's context window gets overloaded. It struggles to distinguish between similar tools. Hallucinations increase, and overall performance degrades."* (https://next.redhat.com/2025/11/26/tool-rag-the-next-breakthrough-in-scalable-ai-agents/) Intelligent retrieval (Tool RAG) can triple invocation accuracy while cutting prompt length in half.

### Practical Budget Heuristics

- **Curate a minimal viable tool set** for the specific agent's task domain — Anthropic: *"one of the most common failure modes we see is bloated tool sets that cover too much functionality."* (https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- **Selection reliability degrades sharply** as tool count grows into the dozens; the exact threshold varies by model and task, but the qualitative effect is consistent across reports
- **For larger surfaces**, use lazy-loading or Tool RAG to present only the relevant subset rather than loading all definitions upfront. (https://next.redhat.com/2025/11/26/tool-rag-the-next-breakthrough-in-scalable-ai-agents/) See [token-turn-optimization.md § Context Budget Management](token-turn-optimization.md).

### The Human-Engineer Test

Before adding a tool: can a human engineer, given the same context, definitively choose between the new tool and any existing tool? If not, the boundary is not clear enough for an agent. Fix the boundary first; add the tool second.

---

## Versioning and Deprecation

### Backward-Compatible Evolution

Agents that learned a tool's shape through training or repeated use will continue constructing calls with the old schema. Breaking changes cause silent failures — the agent passes validation if required fields are still present but behaves incorrectly against new semantics.

**Safe changes (backward-compatible):**
- Adding an optional parameter with a documented default
- Expanding an enum with new values (agents pass old values; they still work)
- Adding new fields to the output schema
- Softening a constraint (e.g., loosening a regex)

**Breaking changes (require versioning):**
- Removing a parameter, even if it was rarely used
- Renaming a parameter
- Changing a parameter from optional to required
- Changing the semantics of an existing parameter (same name, different behavior)
- Restructuring the output shape

### Deprecation Pattern

For deprecated parameters, mark them in the description rather than removing them:

```json
{
  "name": "user",
  "type": "string",
  "description": "[DEPRECATED: use user_id instead — this parameter will be removed in a future version] The user identifier."
}
```

Keep deprecated parameters functional for at least two major release cycles. Never remove a required parameter without first making it optional.

### Tool Name Versioning

When a tool's semantics change fundamentally, introduce a new name rather than changing behavior in place: `search_files_v2` alongside `search_files`. Announce the replacement in the old tool's description; route callers gradually. Once traffic to the old tool reaches near zero, remove it.

MCP `listChanged` notification (https://modelcontextprotocol.io/specification/2025-11-25/server/tools.md) signals tool list changes to clients — use this to notify connected agents when a tool surface update occurs, rather than relying on agents to rediscover via polling.

---

## Anti-Patterns

| Pattern | Why It Fails | Correct Approach |
|---|---|---|
| One tool per API endpoint | Forces agents to compose intent from primitives; creates bloated surface | One tool per agent intent; consolidate related operations |
| Ambiguous overlapping tools | Anthropic: agents cannot choose better than human engineers when the boundary is unclear | Add `NOT when:` clause naming the look-alike tool; enforce separation |
| Prose-only tool results | Agent cannot programmatically determine success/failure | Include machine-readable `status` field; reserve prose for `message` / `hint` |
| Conflating "not found" and "error" | Agent cannot distinguish "I searched correctly and found nothing" from "something broke" | `{"status": "not_found"}` vs. `{"status": "error", "error_code": "..."}` |
| Non-idempotent tool without idempotency key | Network retry causes double-send, double-charge, duplicate record | Require `idempotency_key` for POST-like operations; set `idempotentHint: false` |
| Generic error messages ("Internal error", stack traces) | Not actionable; agent loops without recovery | Error must name what went wrong, what to try instead, and whether to retry |
| `isError: true` for truncated results | Agent treats valid-but-large results as failures | Truncation is success + direction; include `cursor` and filter guidance |
| Short parameter names (`fp`, `uid`, `dt`) | Agent infers wrong semantics before reading description | Full names: `file_path`, `user_id`, `departure_date` |
| No `additionalProperties: false` on input schema | Invented parameters pass validation silently | Add `additionalProperties: false` to all input schemas |
| Breaking parameter changes without versioning | Agents trained on old shape fail silently | Add optional new parameter; deprecate old parameter in description before removing |
| Kitchen-sink tool surface | Selection paralysis; context overload; hallucinations increase | Curate the minimal viable tool set; use MCP lazy-loading for larger surfaces |
| Omitting `outputSchema` on chained tools | Downstream tools receive undocumented shapes | Declare `outputSchema` for any tool whose result feeds another tool |

---

## Cross-References

- [workflow-following.md](workflow-following.md) — Runtime tool-use reliability: error classification, retry logic, tool-use loops, three-strikes give-up rule
- [token-turn-optimization.md](token-turn-optimization.md) — Tool description engineering, parallel tool calls, MCP lazy-loading, context budget management
- [failure-mode-diagnostics.md](failure-mode-diagnostics.md) — Diagnosing tool-related failures at runtime: prompt vs. environment triage, repro/isolation protocol
- [subagent-patterns.md](subagent-patterns.md) — When to wrap tool execution in a sub-agent to isolate large tool results from the orchestrator context
