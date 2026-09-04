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

3. **MCP write_report args** (required — the agent unconditionally persists its verdict via
   `mcp__scratch-memory__write_report`; there is no skip-persistence mode, so a standalone
   dispatch must supply real keys or the MCP call fails):
   - `project`: the plan root's scratch subdir slug (e.g., `my-feature` from `scratch/my-feature/`);
     if no plan was found, use a slug derived from the current task or branch name (e.g.,
     `standalone-verify-todo`)
   - `step`: the plan step number under review, or `0` for ad-hoc/standalone runs
   - `iter`: `1` for a first-time standalone check — this command doesn't track fix-loop
     iterations the way `/implement-code` does; bump manually if re-running against the same changes
   - Pass these as a `project: "{PROJECT_NAME}" | step: {N} | iter: {ITER} | role: "completeness"` line

4. **Instructions**: "Run the completeness-verification skill checklist. Report per-fingerprint PASS/FAIL. If no plan path is provided, run stub detection only."

## Dispatch

Launch the **completeness-verifier** agent via the Agent tool with the constructed prompt, and wait for its completion notification — this command's entire output is the agent's verdict.

The agent is read-only (tools: Read, Grep, Glob, Skill, Bash — Bash hook-gated to read-only git
subcommands) and runs on haiku with the completeness-verification skill preloaded. It reads plan
files itself, compares against the changed file list, persists its verdict via
`mcp__scratch-memory__write_report` for durable persistence, and returns exactly three lines — it does
not echo the full report back to this command.

## Verdict

Parse the agent's three-line return:
- `Status: APPROVED` → gate PASS
- `Status: FINDINGS` → gate FAIL
- `Carry-over: {N}` → count of findings still open from a prior iteration (0 on a first-time standalone check)

Read the file at the returned `Wrote:` path for the full per-fingerprint report and relay it, plus the verdict, to the caller.

If the agent returns an error or needs user input, relay the message to the user. After resolution, resume the same agent via SendMessage — preserves the agent's analysis context and avoids re-reading all files.

Additional instructions (when provided) override the above:
$ARGUMENTS
