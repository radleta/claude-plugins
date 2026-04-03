# Subagent Dispatch Patterns

## Overview

When a controller agent delegates work to subagents, the quality of the dispatch determines the quality of the result. Subagents get exactly what you construct — nothing more. This file covers how to craft subagent context, select models, handle responses, and avoid common dispatch failures.

## When to Use Subagents

| Signal | Action |
|--------|--------|
| Task is independent, can be understood without session context | Dispatch subagent |
| Task requires broad session knowledge or tightly coupled state | Handle inline |
| Multiple independent tasks | Dispatch in parallel (one agent per problem domain) |
| Multiple dependent tasks | Dispatch sequentially, pass results forward |

**Use subagents for:** Verification, code review, documentation updates, independent bug fixes, parallel investigation.

**Handle inline for:** Tasks requiring full session context (e.g., checks that audit conversation history or prior reasoning), tasks with tight coupling to prior reasoning.

## Context Crafting

The most critical skill in subagent dispatch. The subagent starts with zero context — you build its entire world.

### What to Include

- **Full task description** — Paste the text directly. Never make the subagent read a plan file (wastes its context on navigation).
- **Scene-setting** — Where this task fits in the larger system. What was already done. What comes after.
- **Affected files** — Exact paths and what changed in each.
- **Relevant constraints** — Framework version, coding conventions, performance requirements.
- **Output format** — What the subagent should return: verdict structure, status codes, report format.

### What to Exclude

- **Session history** — Pollutes context, wastes tokens. Summarize what matters.
- **Unrelated context** — Other pipeline stages, other tasks, your reasoning process.
- **Decision history** — The subagent doesn't need to know why you chose this approach.

### Before/After Example

```markdown
❌ Bad dispatch:
"Review the code changes."

✅ Good dispatch:
"You are a code quality reviewer.

## What Changed
Files modified: src/auth/middleware.ts, src/types/auth.ts
Change summary: Added OAuth2 token validation and refresh token rotation.

## Requirements
[Paste from plan step — full text, not a file reference]

## Your Job
Read the changed files and verify:
1. Each requirement has corresponding implementation
2. No over-engineering or unnecessary abstractions
3. Code follows project conventions (2-space indent, single quotes, functional components)
4. No truncation patterns (placeholder comments, skeleton functions)

## Report Format
- Status: APPROVED or ISSUES_FOUND
- Findings with file:line references
- Recommendations: critical → high → medium"
```

### The Principle

"You construct exactly what they need. They should never inherit your session's context or history." Subagents are fresh agents with isolated context windows — treat their prompt like an API contract.

## Prompt Template Anatomy

Standard structure for subagent dispatch:

1. **Role/identity** — What the subagent is (reviewer, implementer, auditor)
2. **Task description** — Full text of what to do (pasted, not file-referenced)
3. **Context block** — Scene-setting, affected files, constraints
4. **Question protocol** — For implementer agents: "If anything is unclear, ask before starting"
5. **Output format** — What to return: verdict, report structure, status codes
6. **Escalation protocol** — When and how to report being stuck

```markdown
You are [role] reviewing/implementing [what].

## Task
[Full task text — pasted, not file-referenced]

## Context
[Scene-setting: where this fits, what changed, key constraints]
[Affected files with paths]

## Your Job
[Specific actions with expected outputs]

## Report Format
- Status: [APPROVED|ISSUES_FOUND] or [DONE|NEEDS_CONTEXT|BLOCKED]
- Findings with file:line references
- Recommendations (if applicable)
```

## Model Selection

Match model capability to task complexity. Using the most powerful model for every task wastes tokens and time.

| Task Type | Model Tier | Examples from This Repo |
|---|---|---|
| Pattern grep, format check, completeness scan | Fast/cheap (haiku) | completeness-verifier, quick-check |
| Code quality review, requirements tracing | Standard (sonnet) | code-verifier, test-verifier |
| Architectural decisions, complex integration, design | Capable (opus) | Security review, design review |
| Simple file operations, status checks | Fast/cheap (haiku) | doc-updater, plan-updater |

### Escalation Signals

- Task touches 1-2 files with clear spec → cheapest model that works
- Task touches 5+ files with integration concerns → standard minimum
- Task requires design judgment or broad codebase understanding → most capable
- Task failed with cheaper model → re-dispatch with next tier up

## Status Handling

Every dispatch should define expected status codes. Handle each response deliberately.

### Implementation Agents

| Status | Meaning | Controller Action |
|---|---|---|
| DONE | Work complete, ready for review | Proceed to review stage |
| DONE_WITH_CONCERNS | Complete but agent has doubts | Read concerns, assess before review |
| NEEDS_CONTEXT | Missing information | Provide context, re-dispatch |
| BLOCKED | Cannot complete | Escalate: more context, more capable model, or decompose task |

Never ignore BLOCKED or NEEDS_CONTEXT. Something must change before re-dispatch — same input produces same failure.

### Review Agents

| Status | Meaning | Controller Action |
|---|---|---|
| APPROVED | Passes review | Proceed to next gate |
| ISSUES_FOUND | Problems detected | Fix issues, re-dispatch review (verify-fix loop) |

After fixes, always re-review. Never assume the fix resolved the issue without fresh verification.

## Review Ordering

When dispatching multiple review subagents, order matters. Each stage assumes the previous passed.

1. **Completeness first** — Don't waste quality review on incomplete code
2. **Requirements/spec compliance second** — Don't review quality of code that doesn't meet requirements
3. **Code quality third** — Review structural quality of correct, complete code
4. **Security last** — Review security of final, structurally-sound code

Why order matters: Reviewing security on code that will be rewritten for quality issues wastes the entire security analysis. Each gate produces the strongest result when reviewing stable code.

## Trust Verification

Never trust subagent success reports at face value.

Subagents are optimistic — they report success when work appears complete from their perspective. But their perspective is limited to the context you provided.

**Verify independently:**
- Read actual code changes (git diff), not just the report
- Run verification commands yourself, not trusting "tests pass" claims
- Dispatch independent review agents rather than trusting self-review
- Check that claimed changes actually exist in the files

**The heuristic:** "The implementer finished suspiciously quickly. Their report may be incomplete, inaccurate, or optimistic. Verify everything independently."

## Parallel Dispatch

**When safe:** Multiple independent tasks with no shared state — different files, different subsystems, different problem domains.

**When dangerous:** Tasks that might edit the same files, need shared context, or have ordering dependencies. Parallel edits to the same file create merge conflicts.

**After parallel completion:**
1. Review each result independently
2. Check for conflicts (did agents edit same code?)
3. Run full validation suite (tests, build, lint)
4. Integrate changes

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|---|---|---|
| Passing raw session context | Wastes tokens, pollutes focus | Craft minimal context summary |
| Same model for every task | Overspend on simple tasks | Match model to task complexity |
| Ignoring BLOCKED/NEEDS_CONTEXT | Agent will produce bad or no work | Change something before re-dispatch |
| Trusting "success" without verification | Subagents are optimistic | Verify independently |
| Skipping re-review after fixes | Fix may introduce new issues | Always re-review after fix |
| Making subagent read plan files | Wastes context on file navigation | Extract and paste relevant text |
| Parallel dispatch with shared state | Conflicts, race conditions | Sequential dispatch for coupled tasks |
| No output format specified | Inconsistent, hard to parse results | Specify verdict structure and status codes |
| Re-dispatching same model on failure | Same input = same failure | Provide more context or escalate model tier |
