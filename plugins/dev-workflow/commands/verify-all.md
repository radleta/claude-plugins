---
description: Run the full verification pipeline (todo, code, security) in correct order with autonomous fix loops
argument-hint: [plan name or path — auto-detected if omitted]
---

<role>
  <identity>Verification pipeline orchestrator</identity>
  <purpose>
    Run the complete verify-* pipeline in the correct order, exactly as
    /implement-code does post-implementation, but as a standalone command.
    Optionally accepts a plan path to propagate structured context to all sub-commands.
  </purpose>
</role>

<context-summary>
  Before running the pipeline, summarize the current session into a concise paragraph covering:
  - What files were changed and why
  - What was implemented, fixed, or refactored
  - Key decisions or constraints that affect verification
  - If a plan was used (e.g., `scratch/*/`), include the plan path and its objective
  - If a todo/task file is being used (e.g., `scratch/*/todos.md`), include the file path

  This summary is passed as the prompt to each verification agent. Agents run in
  isolated contexts with no conversation history, so the summary is their only context.

  For the completeness-verifier, also include: plan path, step file paths, decisions
  path, changed file list, and any documented deviations from the plan.
</context-summary>

<autonomous-execution priority="CRITICAL">
  This pipeline runs AUTONOMOUSLY. Do NOT stop to ask user between gates.
  Proceed automatically from one gate to the next.

  After each gate completes, IMMEDIATELY proceed to the next step.
  DO NOT ask "Should I continue?" or "Ready for next gate?"
  DO NOT wait for user confirmation between steps.

  completeness-verifier runs as an Agent with plan context. When it returns,
  treat its verdict (COMPLETE/INCOMPLETE) as a definitive gate signal,
  NOT a suggestion requiring user acknowledgment.

  Only stop when:
  - Same issue fails 3+ fix attempts (escalate)
  - Iteration count >= 4 (require acknowledgment)
</autonomous-execution>

## Plan Detection

Before running the pipeline, detect whether a plan exists for this work:
- Look for plan path in $ARGUMENTS or scratch/ directories
- If plan found: set REVIEW_DEPTH = "light" (earlier phases did heavy review)
- If no plan found: set REVIEW_DEPTH = "thorough" (compensate for skipped phases)

When REVIEW_DEPTH = "thorough" (no plan):
- Run skill coverage detection: scan the files being changed (extensions, imports, dependency files)
- Match each technology to {technology}-expert skill name convention
- Hard gate on ALL coverage gaps — present to user, must build or waive each

## Pipeline Order

The verification pipeline runs in this specific order:

```
Step 1: completeness-verifier agent     (completeness gate — plan-aware, read-only)
Step 2: code-verifier agent             (quality focus — naming, style, DRY, codebase-alignment, plan-decision-conformance)
Step 2: codebase-alignment reviewer     (drift from plan or duplicate patterns — always runs)
Step 2: requirements-coverage reviewer  (traces code to plan steps — only if plan exists)
Step 2: domain reviewers                (one per technology with matching expert skill — dynamic)
Step 2: test-verifier agent             (test quality — if tests exist)
Step 2: ux-verifier agent               (UX/a11y/responsive — if UI/CLI files changed)
Step 3: security-verifier agent         (security — FINAL gate, reviews approved code)
```

## Execution Protocol

<workflow type="sequential">
  <step id="1-completeness" order="first">
    <description>Completeness gate (plan-aware)</description>
    <action>Launch the **completeness-verifier** agent via the Agent tool. Build the dispatch prompt with: plan path, step file paths, decisions path, changed file list (git diff --name-only), implementation summary, and documented deviations. Same dispatch template as implement-code step 3b.</action>
    <gate-logic>
      <if>**Verdict:** COMPLETE</if>
      <then>Proceed to step 2</then>
      <else>Fix incomplete items, re-run completeness-verifier (max 3 cycles)</else>
    </gate-logic>
    <blocks>2-code-review</blocks>
  </step>

  <step id="2-code-review" order="second">
    <description>Parallel code review with structural + domain reviewers</description>
    <actions>
      <action>Launch the **code-verifier** agent via the Agent tool (quality focus: naming, style, DRY, codebase-alignment)</action>
      <action>Launch a **codebase-alignment** reviewer via the Agent tool using the prompt template at `~/.claude/skills/brainstorming/codebase-alignment-reviewer-prompt.md` (artifact_type=diff, depth=REVIEW_DEPTH)</action>
      <action condition="plan exists (REVIEW_DEPTH=light)">Launch a **requirements-coverage** reviewer via the Agent tool — traces code to plan steps using code-verifier with requirements categories only</action>
      <action condition="technologies in Skill Coverage with matching expert skill">Launch **domain reviewers** — one per matched technology, using the prompt template at `~/.claude/skills/brainstorming/domain-reviewer-prompt-template.md` (artifact_type=diff, depth=REVIEW_DEPTH)</action>
      <action condition="test files in changes">Launch the **test-verifier** agent via the Agent tool</action>
      <action condition="UI/CLI files in changes">Launch the **ux-verifier** agent via the Agent tool. UI files: .tsx, .jsx, .vue, .svelte, .css, .scss, .html, .astro. CLI files: argument parsers, process.exit, process.stdout, --help literals, commander/yargs/meow imports.</action>
    </actions>
    <note>Launch all applicable agents in parallel (multiple Agent calls in one message).
    Each agent runs in its own isolated context with its methodology skill preloaded.

    When REVIEW_DEPTH = "light" (plan exists):
    - code-verifier runs with quality focus
    - codebase-alignment checks for drift from plan
    - requirements-coverage traces code to plan steps
    - domain reviewers run at light depth

    When REVIEW_DEPTH = "thorough" (no plan):
    - code-verifier runs at full depth (all detection categories)
    - codebase-alignment checks for full alignment with existing codebase
    - requirements-coverage is SKIPPED (no plan to trace against)
    - domain reviewers run at full depth (first domain review)
    - Flag ANY parallel implementation as unauthorized

    Backwards compatibility enforcement:
    - With plan: flag parallel implementations without approved decision
    - Without plan: flag ANY parallel implementation</note>
    <gate-logic>
      <if>ALL APPROVED (unanimous)</if>
      <then>Proceed to step 3</then>
      <else>Fix issues, re-run failed agents (max 3 cycles)</else>
    </gate-logic>
    <blocks>3-security</blocks>
  </step>

  <step id="3-security" order="third">
    <description>Security gate (final review)</description>
    <action>Launch the **security-verifier** agent via the Agent tool, passing session context summary as the prompt</action>
    <gate-logic>
      <if>APPROVED</if>
      <then>All gates passed — report results</then>
      <else>Fix security issues, re-run security-verifier agent (max 3 cycles)</else>
    </gate-logic>
  </step>

  <step id="4-report" order="last">
    <description>Summary report</description>
    <output>
      ## Verification Pipeline Results

      | Gate | Status | Issues Fixed |
      |------|--------|-------------|
      | Completeness | [PASS/FAIL] | [count] |
      | Code Quality | [PASS/FAIL] | [count] |
      | Codebase Alignment | [PASS/FAIL] | [count] |
      | Requirements Coverage | [PASS/FAIL/SKIPPED] | [count] |
      | Domain Reviews | [PASS/FAIL/SKIPPED] | [count] |
      | Tests | [PASS/FAIL/SKIPPED] | [count] |
      | UX | [PASS/FAIL/SKIPPED] | [count] |
      | Security | [PASS/FAIL] | [count] |

      **REVIEW_DEPTH:** [light/thorough]
      **Overall:** [ALL GATES PASSED | ISSUES REMAIN]
    </output>
  </step>
</workflow>

## Fix Protocol

When a verification returns issues:
1. Read the findings (file:line references)
2. IMMEDIATELY fix the issues
3. IMMEDIATELY re-run the verification
4. Repeat until APPROVED or max cycles (3) reached
5. If max cycles reached: stop and report to user

## Context

$ARGUMENTS
