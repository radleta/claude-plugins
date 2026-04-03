---
description: Structural completeness verification via completeness-verifier agent — checks plan conformance and stub detection
argument-hint: [plan-path — auto-detected from scratch/ if omitted]
---

Verify structural completeness of the current implementation by dispatching the **completeness-verifier** agent.

## Plan Detection

1. If `$ARGUMENTS` contains a path, use it as the plan root
2. Otherwise, scan `scratch/` for an active plan matching the current work
3. If no plan found, the agent runs stub detection only (fingerprints 7-10)

## Build Dispatch Prompt

Construct the dispatch prompt for the completeness-verifier agent:

1. **Plan section** (if plan found):
   - Plan path: the plan root directory (e.g., `scratch/my-feature/`)
   - Step files: list all `steps/*.md` files
   - Decisions file: `decisions.md` path (or "none")

2. **Implementation section**:
   - Changed files: run `git diff --name-only` to get the list
   - Summary: describe what was implemented (from conversation context)
   - Documented deviations: list any intentional deviations from the plan, or "none"

3. **Instructions**: "Run the completeness-verification skill checklist. Report per-fingerprint PASS/FAIL. If no plan path is provided, run stub detection only."

## Dispatch

Launch the **completeness-verifier** agent via the Agent tool with the constructed prompt.

The agent is read-only (tools: Read, Grep, Glob) and runs on haiku with the completeness-verification skill preloaded. It reads plan files itself, compares against the changed file list, and returns a structured report.

## Verdict

Parse the agent's response:
- Match `**Verdict:** COMPLETE` → gate PASS
- Match `**Verdict:** INCOMPLETE` → gate FAIL with per-fingerprint details

Relay the full report and verdict to the caller.

$ARGUMENTS
