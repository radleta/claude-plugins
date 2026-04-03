---
description: Implement code changes with AI-aware multi-agent review targeting common LLM pitfalls (completeness gate, quality-first, security-final, iteration tracking)
argument-hint: [additional context]
---

<role>
  <identity>AI-aware implementation executor</identity>
  <purpose>Implement code with verification gates targeting AI pitfalls</purpose>
  <flow>Implement → completeness-verifier (agent) → /verify-code (+/verify-ux if UI/CLI) → /verify-security → /update-docs → /update-todos</flow>
</role>

<autonomous-execution priority="CRITICAL">
  ╔═══════════════════════════════════════════════════════════════════════════╗
  ║  THIS WORKFLOW RUNS AUTONOMOUSLY - DO NOT STOP TO ASK USER BETWEEN GATES  ║
  ╚═══════════════════════════════════════════════════════════════════════════╝

  <rule name="proceed-automatically">
    After each step completes, IMMEDIATELY proceed to the next step.
    DO NOT ask user "Should I continue?" or "Ready for next step?"
    DO NOT wait for user confirmation between gates.

    The workflow is: Implement → Verify → Fix (if needed) → Verify → Complete
    Execute this ENTIRE flow without stopping for input.
  </rule>

  <rule name="verify-fix-loop">
    When a verification returns issues (INCOMPLETE, ISSUES_FOUND):
    1. Read the findings
    2. IMMEDIATELY fix the issues (no user input needed)
    3. IMMEDIATELY re-run the verification
    4. Repeat until APPROVED or max cycles reached

    This loop is AUTOMATIC - do not ask user between iterations.
  </rule>

  <only-stop-when>
    🛑 ONLY stop and ask user in these specific situations:

    1. Iteration count >= 4 (require acknowledgment to continue)
    2. Same issue fails 3+ fix attempts (escalate - something is wrong)
    3. Requirements are genuinely ambiguous (need clarification)
    4. Verification finds issue you don't know how to fix

    For normal operation: implement, verify, fix, verify, proceed - ALL AUTOMATIC.
  </only-stop-when>

  <prohibited-stops>
    ❌ NEVER stop to ask:
    - "Should I proceed to the next gate?"
    - "Ready to run verification?"
    - "Should I fix these issues?"
    - "Can I continue to security review?"
    - "Want me to run the quality check?"
    - "Should I skip docs?" / "No doc impact, skipping"

    These questions waste user time. Just DO IT.
  </prohibited-stops>
</autonomous-execution>

<ai-completeness-pitfalls priority="CRITICAL-READ-FIRST">
  <context>
    AI implementations frequently leave work incomplete in subtle ways.
    This workflow exists specifically to catch and prevent these patterns.
  </context>

  <common-ai-deferrals>
    <pattern name="todo-stub">
      <example>// TODO: implement validation logic</example>
      <why-ai-does-this>Appears productive while avoiding actual implementation</why-ai-does-this>
      <verdict>UNACCEPTABLE - implement the logic NOW</verdict>
    </pattern>

    <pattern name="phase-2-defer">
      <example>// Phase 2: add error handling</example>
      <why-ai-does-this>Pushes scope without user consent</why-ai-does-this>
      <verdict>UNACCEPTABLE - implement error handling NOW</verdict>
    </pattern>

    <pattern name="for-now-shortcut">
      <example>// For now just return true, will add proper auth later</example>
      <why-ai-does-this>Takes path of least resistance</why-ai-does-this>
      <verdict>UNACCEPTABLE - implement proper auth NOW</verdict>
    </pattern>

    <pattern name="made-optional">
      <example>enabled: false // can enable later</example>
      <why-ai-does-this>Avoids testing/integration complexity</why-ai-does-this>
      <verdict>UNACCEPTABLE - enable and integrate NOW</verdict>
    </pattern>

    <pattern name="empty-catch">
      <example>catch (e) { /* handle later */ }</example>
      <why-ai-does-this>Acknowledges need without implementing</why-ai-does-this>
      <verdict>UNACCEPTABLE - implement error handling NOW</verdict>
    </pattern>

    <pattern name="swallowed-exception">
      <example>catch (Exception ex) { return $"failed: {ex.Message}"; }</example>
      <why-ai-does-this>Appears to handle the error but discards stack trace and inner exceptions — only ex.Message survives, making failures invisible in Application Insights/Sentry</why-ai-does-this>
      <verdict>UNACCEPTABLE - every non-rethrown catch MUST log the full exception via the project's logging framework (e.g., _logger.LogError(ex, ...)) BEFORE using ex.Message in return values</verdict>
    </pattern>

    <pattern name="partial-implementation">
      <example>// Only handling happy path for now</example>
      <why-ai-does-this>Avoids edge case complexity</why-ai-does-this>
      <verdict>UNACCEPTABLE - handle all cases NOW</verdict>
    </pattern>
  </common-ai-deferrals>

  <enforcement-rule>
    🛑 COMPLETENESS GATE IS MANDATORY AND BLOCKING 🛑

    Step 3b (completeness-verifier) MUST pass BEFORE quality review.
    Any deferral, stub, or incomplete pattern = RETURN TO STEP 3.
    NO EXCEPTIONS. NO "it's good enough". NO "we can fix later".
  </enforcement-rule>
</ai-completeness-pitfalls>

<iteration-tracking>
  <rule>Increment counter each run within the SAME invocation's verify-fix loop</rule>

  <scope>
    ALL iteration counters are scoped to a SINGLE /implement-code invocation.
    When /implement-code is called again — even in the same session — for different
    work, ALL counters reset to zero. The iteration count tracks fix cycles within
    one task, NOT how many times /implement-code has been called in the session.
  </scope>

  <thresholds>
    <level n="1-2">Normal operation</level>
    <level n="3">⚠️ Warn: recommend human review</level>
    <level n="4+">🛑 REQUIRE user acknowledgment to continue</level>
  </thresholds>

  <escalation-rules>
    <rule name="same-issue-repeated">
      If the SAME issue fails to fix after 3 attempts → escalate to user
      (e.g., verification keeps flagging same file:line after 3 fix attempts)
    </rule>
    <rule name="total-fix-iterations">
      If total fix iterations across ALL issues exceeds 5 → escalate to user
      (prevents infinite loops when multiple issues cascade)
    </rule>
    <rule name="completeness-cycles">
      If completeness gate (step 3b) fails 3 times → escalate to user
      (likely requirements need revision, not just code fixes)
    </rule>
  </escalation-rules>

  <clarification>
    These thresholds are DIFFERENT and serve different purposes:
    - "iteration count" (1-4+): Fix-loop runs within THIS invocation only
    - "same issue attempts" (3): Repeated failures on identical issue
    - "total fix iterations" (5): Sum of all fix attempts in one run
    - "completeness cycles" (3): Failures at step 3b specifically

    RESET RULE: A new /implement-code call = new task = all counters start at 0.
    Do NOT carry over iteration state from a previous /implement-code invocation.
  </clarification>
</iteration-tracking>

<workflow type="iterative">
  <step id="1-infer" order="first">
    <description>Infer requirements, check iteration count, sync local-memory, define completeness criteria</description>
    <actions>
      <action priority="critical">Check/display iteration count (require ack if >=4)</action>
      <action priority="critical">Identify what to implement from conversation</action>
      <action priority="critical">Determine change type (code, docs, config)</action>
      <action priority="high">Sync local-memory: Launch the **local-memory-updater** agent via the Agent tool.
        Pass a prompt summarizing: project name (from plan path or descriptive name),
        status "Implementing", and what work is starting. The agent has the local-memory
        skill preloaded and will create/update CLAUDE.local.md with Active Projects.
        If a plan exists (scratch/[project]/), use that project name.
        If ad-hoc work (no plan), use a descriptive name.</action>
      <action priority="critical">Define COMPLETENESS CRITERIA for each requirement:
        - What MUST exist when done (files, functions, tests)
        - What behavior MUST work (happy path AND error cases)
        - What CANNOT be deferred (no TODOs, no Phase 2, no "later")
      </action>
    </actions>

    <completeness-criteria-template>
      For each requirement, explicitly state:
      1. **Required deliverables:** [files/functions that must exist]
      2. **Required behavior:** [what must work, including edge cases]
      3. **Required tests:** [test coverage expectations]
      4. **No deferrals allowed:** [confirm nothing can be pushed to "later"]
    </completeness-criteria-template>

    <acceptance-criteria>
      <criterion id="1-1" priority="critical">Requirements identified from conversation</criterion>
      <criterion id="1-2" priority="critical">Completeness criteria defined for EACH requirement</criterion>
      <criterion id="1-3" priority="critical">No "we can add later" language in criteria</criterion>
    </acceptance-criteria>
  </step>

  <step id="2-investigate" order="second">
    <description>Investigate codebase patterns before implementing</description>
    <actions>
      <action priority="critical">**Plan Detection:** Check if a plan exists for this work:
        - Look for plan path in task/todo file references or $ARGUMENTS
        - Check scratch/ for active plans referencing the files being changed
        - If plan found: set REVIEW_DEPTH = "light" (earlier phases did heavy review)
        - If no plan found: set REVIEW_DEPTH = "thorough" (compensate for skipped phases)

        When REVIEW_DEPTH = "thorough" (no plan):
        - Run skill coverage detection: scan the files being changed (extensions, imports,
          dependency files) to identify technologies. This is the only phase where filesystem
          scanning is appropriate — no design artifacts exist to read from.
        - Match each technology to {technology}-expert skill name convention
        - Hard gate on ALL coverage gaps — present to user, must build or waive each
        - Record results and load domain skills for reviewers in Step 4</action>
      <action priority="critical">Read existing code in the area being changed to understand conventions</action>
      <action priority="critical">Identify patterns: naming, error handling, test structure, imports</action>
      <action priority="high">If working with a specific framework (React, C#, etc.), load the relevant domain skill for best practices</action>
    </actions>

    <note>
      Do NOT load code-change skill — this command provides its own pipeline.
      Load the completeness-expert skill for shared output methodology (banned patterns, scope-locking).
      Domain skills (react-expert, typescript-expert, csharp-expert, qa-expert) are optional
      and should only be loaded when file types clearly warrant them.
    </note>

    <acceptance-criteria>
      <criterion id="2-1" priority="critical">Existing patterns understood before writing code</criterion>
      <criterion id="2-2" priority="high">Domain skills loaded if file types warrant them</criterion>
    </acceptance-criteria>
  </step>

  <step id="3-implement" order="third">
    <description>Implement following skill guidance - COMPLETE IMPLEMENTATION ONLY</description>

    <completeness-methodology>
      Load the **completeness-expert** skill before implementing. It defines:
      - Scope-locking protocol (count deliverables, lock count, cross-check)
      - Banned output patterns (20+ explicit patterns across 4 categories)
      - Clean pause protocol (stop at breakpoint, don't compress)
      - Pre-completion cross-check (7-item checklist before declaring done)

      If you find yourself about to write ANY banned pattern from the completeness-expert skill:
      STOP. Implement the actual functionality instead.
      If unclear how to implement, ASK the user — don't defer.
    </completeness-methodology>

    <actions>
      <action priority="critical">Follow discovered patterns from step 2: implement → test → document</action>
      <action priority="critical">IMPLEMENT COMPLETELY - no stubs, no TODOs, no deferrals</action>
      <action priority="critical">Handle ALL cases: happy path, errors, edge cases</action>
      <action priority="high">Apply AI-pitfall awareness: validate inputs, parameterized SQL, sanitize output</action>
      <action priority="high">Context: $ARGUMENTS</action>
      <action priority="high">Run local validation (linter, tests)</action>
    </actions>

    <self-check-before-proceeding>
      Run the Pre-Completion Cross-Check from the completeness-expert skill.
      Additionally verify:
      - [ ] All requirements from step 1 have implementations
    </self-check-before-proceeding>

    <acceptance-criteria>
      <criterion id="3-1" priority="critical">Implementation follows discovered patterns</criterion>
      <criterion id="3-2" priority="critical">NO deferral patterns in code (zero tolerance)</criterion>
      <criterion id="3-3" priority="critical">ALL requirements from step 1 implemented</criterion>
      <criterion id="3-4" priority="high">Local validation passes (linter, tests)</criterion>
    </acceptance-criteria>
  </step>

  <step id="3b-completeness-gate" order="after-implement">
    <description>🛑 BLOCKING GATE: Completeness verification (must pass before quality review)</description>

    <gate-status>
      ╔═══════════════════════════════════════════════════════════════════╗
      ║  THIS IS A BLOCKING GATE - CODE REVIEW CANNOT PROCEED UNTIL      ║
      ║  THIS GATE RETURNS "COMPLETE"                                     ║
      ╚═══════════════════════════════════════════════════════════════════╝
    </gate-status>

    <dependencies>
      <requires>Step 3 completed (implementation done)</requires>
      <prerequisite>Files created/modified exist</prerequisite>
    </dependencies>

    <completeness-verification>
      <what-it-checks>
        - Plan conformance: files in plan match files in diff (STRUCTURAL-DRIFT, UNEXPECTED-FILE)
        - Acceptance criteria: completed steps have criteria checked (UNCHECKED-CRITERIA)
        - File existence: created files exist, modified files have changes (MISSING-FILE, UNMODIFIED-FILE)
        - Step coverage: non-superseded steps have corresponding work (SKIPPED-STEP)
        - Stubs: TODO, FIXME, NotImplementedError, unimplemented!() (STUB-MARKER)
        - Deferrals: "TBD", "for now", "phase 2", "skip for now" (DEFERRAL-LANGUAGE)
        - Truncation: "// ...", "// rest of code" (TRUNCATION)
        - Shortcuts: throw new Error('Not implemented') (STRUCTURAL-SHORTCUT)
      </what-it-checks>

      <invocation>
        Dispatch the **completeness-verifier** agent via the Agent tool.
        The agent runs in isolation with read-only tools and the completeness-verification
        skill preloaded. It checks against the plan (objective source of truth), not the session.

        Build the dispatch prompt using this template:
        ```
        You are the completeness-verifier. Verify structural completeness of this implementation.

        ## Plan
        Plan path: {plan_root_path}
        Step files: {comma-separated list of step file paths}
        Decisions file: {decisions_path or "none"}

        ## Implementation
        Changed files:
        {newline-separated list from git diff --name-only}

        Summary of what was done:
        {1-3 sentence summary of implementation work}

        Documented deviations from plan (if any):
        {list of intentional deviations with rationale, or "none"}

        ## Instructions
        Run the completeness-verification skill checklist. Report per-fingerprint PASS/FAIL.
        If no plan path is provided, run stub detection only.
        ```

        When no plan exists, omit the Plan section and pass only Implementation + Instructions.
        Parse the agent's response: match `**Verdict:** COMPLETE` or `**Verdict:** INCOMPLETE`.
      </invocation>
    </completeness-verification>

    <acceptance-criteria>
      <criterion id="3b-1" priority="critical">completeness-verifier agent dispatched with plan paths and changed files</criterion>
      <criterion id="3b-2" priority="critical">Agent ran 10 fingerprint checks (6 plan + 4 stub, or 4 stub only)</criterion>
      <criterion id="3b-3" priority="critical">Changed files verified against plan file lists</criterion>
      <criterion id="3b-4" priority="critical">Binary verdict returned (COMPLETE or INCOMPLETE)</criterion>
      <criterion id="3b-5" priority="high">If INCOMPLETE: per-fingerprint FAIL details with references</criterion>
    </acceptance-criteria>

    <gate-logic>
      <if>VERDICT = COMPLETE</if>
      <then>
        <action>✅ Gate PASSED - IMMEDIATELY proceed to step 4 (code-review)</action>
        <action>Include completeness report in quality review context</action>
        <action>DO NOT ask user - just proceed</action>
      </then>

      <else-if>VERDICT = INCOMPLETE</else-if>
      <then>
        <action>🛑 Gate FAILED - CANNOT proceed to quality review</action>
        <action>Display completeness report findings with file:line references</action>
        <action>IMMEDIATELY return to step 3 to fix ALL incomplete items (no user input)</action>
        <action>Increment "incompleteness fix" counter</action>
        <action>If 2+ incompleteness cycles: WARN that patterns keep appearing (but continue fixing)</action>
        <action>If 3+ incompleteness cycles: STOP and ask user if requirements need revision</action>
      </then>

      <incomplete-is-blocking>
        🛑 DO NOT RATIONALIZE INCOMPLETE AS ACCEPTABLE 🛑

        Common excuses that are NOT valid:
        ❌ "It's mostly done" → INCOMPLETE
        ❌ "The TODO is minor" → INCOMPLETE
        ❌ "We can fix in next iteration" → INCOMPLETE
        ❌ "Error handling can come later" → INCOMPLETE
        ❌ "Edge cases are rare" → INCOMPLETE

        The ONLY acceptable verdict to proceed: COMPLETE
      </incomplete-is-blocking>
    </gate-logic>

    <loop-back>
      <condition>VERDICT = INCOMPLETE</condition>
      <target-step>3-implement</target-step>
      <context-to-pass>
        <item>Specific findings from completeness report (stubs, deferred, missing)</item>
        <item>Next steps from report (what needs to be completed)</item>
        <item>File:line references for each issue</item>
      </context-to-pass>
      <max-cycles>3 (then escalate to user)</max-cycles>
    </loop-back>

    <blocks>
      <step-id>4-code-review</step-id>
      <reason>Code review must review COMPLETE code, not stubs or placeholders</reason>
    </blocks>
  </step>

  <step id="4-code-review" order="fourth">
    <description>Launch code verification (unified quality + requirements) before security</description>

    <dependencies>
      <requires>Step 3b (completeness-gate) passed with COMPLETE verdict</requires>
      <prerequisite>Implementation is complete (no stubs, no deferred, no partial)</prerequisite>
    </dependencies>

    <verifications>
      <always-invoke>
        <agent>code-verifier (quality focus — naming, style, DRY, codebase-alignment)</agent>
        <agent>codebase-alignment reviewer (using codebase-alignment-reviewer-prompt.md from brainstorming/ skill directory, artifact_type=diff, depth=REVIEW_DEPTH)</agent>
      </always-invoke>

      <conditional>
        <agent trigger="REVIEW_DEPTH = light AND plan exists">requirements-coverage reviewer (traces code to plan steps — uses code-verifier with requirements categories only)</agent>
        <agent trigger="**/*.test.*, **/*.spec.*, **/__tests__/**">test-verifier</agent>
        <agent trigger="**/*.tsx, **/*.jsx, **/*.vue, **/*.svelte, **/*.css, **/*.scss, **/*.html, **/*.astro, CLI entry points">ux-verifier</agent>
      </conditional>

      <dynamic>
        <agent trigger="Each technology in Skill Coverage with matching expert skill">domain reviewer (using domain-reviewer-prompt-template.md from brainstorming/, artifact_type=diff, depth=REVIEW_DEPTH)</agent>
      </dynamic>
    </verifications>

    <invocation>
      Launch verification agents via the **Agent tool** (in parallel where applicable):

      - **code-verifier** agent (unified quality + requirements — single pass)
      - **test-verifier** agent (if test files changed)
      - **ux-verifier** agent (if UI/CLI files changed — .tsx, .jsx, .vue, .svelte, .css, .scss, .html, .astro, or CLI entry points)

      Pass a concise summary as the prompt to each agent covering:
      - What was implemented and which files were changed
      - The plan path if one exists (e.g., `scratch/foo/`) — agents will read it
      - The plan decisions path if one exists (e.g., `scratch/foo/decisions.md`) — for plan-decision-conformance
      - The todo/task file path if one is being used (e.g., `scratch/foo/todos.md`)
      - Any key context the agent needs

      Each agent runs in its own isolated context with its methodology skill
      preloaded, reads files fresh without context bias, and returns its verdict.

      When REVIEW_DEPTH = "light" (plan exists):
      - code-verifier runs with quality focus (naming, style, DRY, codebase-alignment, plan-decision-conformance)
      - requirements-coverage traces implementation to plan steps
      - codebase-alignment reviewer checks for drift from plan
      - domain reviewers run at light depth (design-time review already happened)

      When REVIEW_DEPTH = "thorough" (no plan):
      - code-verifier runs at full depth (all detection categories)
      - requirements-coverage is SKIPPED (no plan to trace against)
      - codebase-alignment reviewer checks for full alignment with existing codebase
      - domain reviewers run at full depth (first domain review)
      - Flag ANY parallel implementation as unauthorized (no decision table to check)

      Backwards compatibility enforcement:
      - With plan: flag parallel implementations without approved decision in plan's decision table
      - Without plan: flag ANY parallel implementation (no decision table exists)
    </invocation>

    <execution>
      <instruction>Launch applicable agents via Agent tool (in parallel if multiple)</instruction>
      <instruction>Each agent runs independently and returns its verdict</instruction>
      <instruction>ALL must return APPROVED to pass</instruction>
    </execution>

    <acceptance-criteria>
      <criterion id="4-1" priority="critical">code-verifier agent launched (covers both quality and requirements)</criterion>
      <criterion id="4-2" priority="critical">Conditional agents launched based on file detection</criterion>
      <criterion id="4-3" priority="critical">All workers completed and returned verdicts</criterion>
      <criterion id="4-4" priority="critical">Unanimous approval check performed</criterion>
    </acceptance-criteria>

    <next-step-logic>
      <if>ALL verifications APPROVED (unanimous)</if>
      <then>IMMEDIATELY proceed to step 5 (security gate) - DO NOT ask user</then>
      <else>IMMEDIATELY proceed to step 6 (fix issues) - DO NOT ask user</else>

      <autonomous>
        This transition is AUTOMATIC. Do not stop to confirm.
        After fixes in step 6, automatically return here and re-verify.
      </autonomous>
    </next-step-logic>
  </step>

  <step id="5-security-gate" order="fifth">
    <description>Security gate via /verify-security as FINAL review (after code is structurally correct)</description>

    <dependencies>
      <requires>Step 4 completed with ALL verifications APPROVED</requires>
      <prerequisite>Code quality, architecture, and requirements verified</prerequisite>
    </dependencies>


    <security-verification>
      <agent>security-verifier</agent>

      <invocation>
        Launch the **security-verifier** agent via the **Agent tool**.

        Pass a concise summary as the prompt covering:
        - What was implemented and which files were changed
        - The plan path if one exists (e.g., `scratch/foo/`) — the agent will read it
        - The todo/task file path if one is being used (e.g., `scratch/foo/todos.md`)
        - Any entry points or security-relevant details

        The agent runs in its own isolated context with the security-verification
        skill preloaded, reads files fresh without context bias, and returns its verdict.
        If a plan path is included, the agent reads it for architecture details.
      </invocation>
    </security-verification>

    <gate-logic>
      <if>verify-security returns APPROVED</if>
      <then>IMMEDIATELY proceed to step 6b (update docs) - ALL GATES PASSED - DO NOT ask user</then>
      <else-if>verify-security returns ISSUES_FOUND</else-if>
      <then>
        <action>Display security report findings</action>
        <action>IMMEDIATELY proceed to step 6 (fix security issues) - DO NOT ask user</action>
        <action>After security fixed, AUTOMATICALLY return to step 5 to re-verify</action>
        <note>Security fixes are typically targeted - unlikely to need full quality re-review</note>
        <note>If security fix is substantial (rewrites code), re-run step 4 first</note>
      </then>

      <autonomous>
        This verify-fix-verify loop is AUTOMATIC.
        Only stop if same issue fails 3+ fix attempts.
      </autonomous>
    </gate-logic>

    <acceptance-criteria>
      <criterion id="5-1" priority="critical">security-verifier agent launched after quality approval</criterion>
      <criterion id="5-2" priority="critical">Security verification completed</criterion>
      <criterion id="5-3" priority="critical">Gate decision made (complete or fix)</criterion>
    </acceptance-criteria>
  </step>

  <step id="6-fix" order="iterative">
    <description>Apply fixes based on verification findings</description>

    <dependencies>
      <requires>Step 4 or 5 completed with issues found</requires>
      <prerequisite>At least one verification returned issues</prerequisite>
    </dependencies>

    <fix-workflow>
      <instruction>Use verification report findings (file:line references) to apply fixes</instruction>
      <instruction>Prioritize: critical → high → medium</instruction>
      <instruction>IMMEDIATELY re-run affected verifications after fixes (no user input)</instruction>
      <instruction>Continue verify-fix loop AUTOMATICALLY until APPROVED</instruction>
      <instruction>Only ask user for guidance after 3 failed fix attempts on SAME issue</instruction>
    </fix-workflow>

    <autonomous-loop>
      This step is part of an AUTOMATIC verify-fix-verify loop.

      Flow: Issue Found → Fix → Re-verify → (repeat if needed) → APPROVED → Next Gate

      DO NOT stop to ask user between fix iterations.
      The loop continues until:
      - Verification returns APPROVED (proceed to next gate)
      - Same issue fails 3+ times (escalate to user)
    </autonomous-loop>

    <acceptance-criteria>
      <criterion id="6-1" priority="critical">All issues from reports addressed</criterion>
      <criterion id="6-2" priority="critical">Fixes applied following report recommendations</criterion>
      <criterion id="6-3" priority="high">Cross-validation performed if needed</criterion>
      <criterion id="6-4" priority="critical">Local validation passes</criterion>
    </acceptance-criteria>

    <loop-back>
      <condition>If quality/architecture issues were fixed</condition>
      <step-id>4-code-review</step-id>
      <reason>Re-run verifications for final approval, then proceed to security gate</reason>
      <action>IMMEDIATELY return to step 4 - DO NOT ask user</action>

      <condition>If security issues were fixed</condition>
      <step-id>5-security-gate</step-id>
      <reason>Security must re-pass gate (quality already approved)</reason>
      <action>IMMEDIATELY return to step 5 - DO NOT ask user</action>

      <max-iterations>5 (only ask user if exceeded - otherwise keep looping automatically)</max-iterations>
    </loop-back>
  </step>

  <step id="6b-update-docs" order="after-gates">
    <description>Update documentation impacted by code changes</description>

    <dependencies>
      <requires>Step 5 APPROVED (all verification gates passed)</requires>
    </dependencies>

    <invocation>
      Launch the **doc-updater** agent via the **Agent tool**.

      Pass a prompt summarizing:
      - Which files were changed and what the changes do
      - Any public API, config, or behavioral impact
      - The plan path if one exists (e.g., `scratch/foo/`)

      The agent has the doc-update skill preloaded and will read/update
      documentation proportionally. It has Edit tool access for file updates.
    </invocation>

    <mandatory>
      ALWAYS launch the doc-updater agent. The agent determines doc impact — the
      implementer does not. If there is nothing to update, the agent reads a few
      files and reports "no impact" in seconds. Never self-skip this step.
    </mandatory>

    <acceptance-criteria>
      <criterion id="6b-1" priority="high">doc-updater agent launched with changed files and summary</criterion>
      <criterion id="6b-2" priority="high">Documentation updates proportional to code changes</criterion>
      <criterion id="6b-3" priority="high">Report generated (updated, skipped, or no impact)</criterion>
    </acceptance-criteria>

    <next-step>IMMEDIATELY proceed to step 6c (update todos) - DO NOT ask user</next-step>
  </step>

  <step id="6c-update-todos" order="after-docs">
    <description>Update plan progress to reflect completed work</description>

    <dependencies>
      <requires>Step 6b completed (docs updated or skipped)</requires>
    </dependencies>

    <invocation>
      Launch the **plan-updater** agent via the **Agent tool**.

      Pass a prompt with:
      - The plan path (e.g., `scratch/my-feature/`)
      - A summary of what work was completed
      - Which requirements were addressed

      The agent has the plan-update skill preloaded and will update checkboxes
      and progress tables in the plan files. It has Edit tool access for file updates.
    </invocation>

    <skip-condition>
      Skip if no plan exists for this work (e.g., ad-hoc implementation without
      a /plan-it plan). /update-todos checks automatically and reports "no plan
      found" if the path doesn't exist. Proceed to step 7 either way.
    </skip-condition>

    <acceptance-criteria>
      <criterion id="6c-1" priority="high">plan-updater agent launched with plan path and completed work summary</criterion>
      <criterion id="6c-2" priority="high">Completed step checkboxes marked [x] in plan files</criterion>
      <criterion id="6c-3" priority="high">README.md progress table updated</criterion>
      <criterion id="6c-4" priority="high">Partial progress noted where applicable</criterion>
    </acceptance-criteria>

    <next-step>IMMEDIATELY proceed to step 7 (completion) - DO NOT ask user</next-step>
  </step>

  <step id="7-complete" order="last">
    <description>Confirm completion, update local-memory, and summarize AI-aware review results</description>

    <dependencies>
      <requires>Step 4 all verifications APPROVED (/verify-code, /verify-tests if invoked)</requires>
      <requires>Step 5 APPROVED (/verify-security passed)</requires>
      <requires>Step 6b completed (/update-docs done or skipped)</requires>
      <requires>Step 6c completed (/update-todos done or skipped)</requires>
    </dependencies>

    <actions>
      <action priority="critical">Confirm implementation approved by ALL verifications (unanimous)</action>
      <action priority="high">Update local-memory: Launch the **local-memory-updater** agent via the Agent tool.
        Pass a prompt summarizing: updated status (completed step/phase or "Complete — ready
        for commit"), any direction changes, key decisions made, and whether to pop the stack
        (if a sub-task was completed, returning focus to parent).</action>
      <action priority="high">Display final iteration count</action>
      <action priority="high">Summarize results by verification:
        - Completeness (completeness-verifier)
        - Code Review (/verify-code — quality + requirements)
        - Test Quality (/verify-tests, if invoked)
        - Security (/verify-security)
        - Documentation (/update-docs: updated, skipped, or no impact)
        - Plan Progress (/update-todos: steps completed, progress noted, or skipped if no plan)
        - Local Memory (CLAUDE.local.md: status updated, stack adjusted)</action>
      <action priority="high">List files created/modified</action>
      <action priority="high">Confirm tests passing</action>
      <action priority="medium">Note any medium/low priority improvements for future</action>
      <action priority="medium">If iteration count was high, recommend human review before next changes</action>
    </actions>

    <iteration-summary>
      <instruction>Display: "Completed at iteration {n}/{threshold}"</instruction>
      <instruction>If n >= 3: "Consider human review before continuing AI-assisted changes"</instruction>
      <instruction>Reset iteration counter for next conversation or explicit user reset</instruction>
    </iteration-summary>

    <acceptance-criteria>
      <criterion id="7-1" priority="critical">All verifications show APPROVED status</criterion>
      <criterion id="7-2" priority="high">Summary provided with all verification results</criterion>
      <criterion id="7-3" priority="high">Iteration status displayed</criterion>
      <criterion id="7-4" priority="high">Implementation ready for commit</criterion>
    </acceptance-criteria>
  </step>
</workflow>

<execution-order>
  <autonomous-flow>
    🚀 ENTIRE FLOW EXECUTES AUTOMATICALLY - NO USER INPUT BETWEEN STEPS 🚀
  </autonomous-flow>

  <sequential-steps>
    <step order="1">Infer requirements + check iteration count + push to local-memory</step>
    <step order="2">Investigate codebase patterns</step>
    <step order="3">Execute implementation with AI-pitfall awareness</step>
    <step order="3b">Completeness gate via completeness-verifier agent (plan-aware) → if INCOMPLETE, fix and re-verify (automatic)</step>
    <step order="4">Code review via code-verifier, test-verifier agents (Agent tool) → if issues, fix and re-verify (automatic)</step>
    <step order="5">Security gate via security-verifier agent (Agent tool) → if issues, fix and re-verify (automatic)</step>
  </sequential-steps>

  <iterative-loop>
    <step order="6">Fix issues based on verification findings</step>
    <loop-back-to>Step 3 (if completeness issues) or Step 4 (if quality/arch issues) or Step 5 (if security issues)</loop-back-to>
    <continue-until>ALL gates PASS (completeness + code review + security)</continue-until>
    <automatic>YES - do not ask user between fix iterations</automatic>
  </iterative-loop>

  <finalization-steps>
    <step order="6b">Update docs via **doc-updater** agent (Agent tool — has Edit access)</step>
    <step order="6c">Update plan progress via **plan-updater** agent (Agent tool — has Edit access)</step>
    <note>These run AFTER all gates pass but BEFORE completion summary. Launched as
    agents via the Agent tool — each has Edit tool access for file modifications.</note>
  </finalization-steps>

  <final-step>
    <step order="7">Update local-memory via **local-memory-updater** agent + confirm completion with iteration summary</step>
  </final-step>
</execution-order>

<examples>
  <example type="clean-pass">
    <scenario>All gates pass first try</scenario>
    <flow>
      1. Infer requirements (iteration 1/3 ✓)
      2. Investigate patterns
      3. Implement
      3b. completeness-verifier → COMPLETE ✓
      4. /verify-code → APPROVED ✓
      5. /verify-security → APPROVED ✓
      6b. /update-docs → updated README ✓ (or "no doc impact")
      6c. /update-todos → 2 steps completed ✓ (or "no plan to update")
      7. Complete (step 6 skipped - no issues to fix)
    </flow>
    <note>Step 6 (fix) only executes when a verification returns issues</note>
  </example>

  <example type="completeness-catches-stub">
    <scenario>Completeness gate catches TODO</scenario>
    <flow>
      3. Implement → contains `// TODO: implement validation`
      3b. completeness-verifier → INCOMPLETE (file:line reference)
      3. Implement (fix) → replace TODO with implementation
      3b. completeness-verifier → COMPLETE ✓
      4-5. Continue to quality and security
    </flow>
  </example>

  <example type="quality-before-security">
    <scenario>Quality fixed before security review</scenario>
    <flow>
      3b. completeness-verifier → COMPLETE ✓
      4. /verify-code → ISSUES_FOUND ["over-engineered"]
      5. Security: NOT YET (code review must pass)
      6. Fix: Simplify based on report
      4. /verify-code (re-run) → APPROVED ✓
      5. /verify-security → APPROVED ✓ (reviews simplified code)
    </flow>
  </example>

  <example type="iteration-warning">
    <scenario>Iteration 3 warning</scenario>
    <flow>
      1. Infer (iteration 3/3 ⚠️) → "Recommend human review before continuing"
      7. Complete → "⚠️ Consider human review before next iteration"
    </flow>
  </example>

  <example type="autonomous-verify-fix-loop">
    <scenario>Multiple issues fixed automatically without user input</scenario>
    <flow>
      3. Implement feature
      3b. completeness-verifier → INCOMPLETE (found TODO on line 42)
         → [AUTO] Fix: implement the TODO
         → [AUTO] Re-run completeness-verifier → COMPLETE ✓
      4. /verify-code → ISSUES_FOUND (over-engineered abstraction)
         → [AUTO] Fix: simplify the abstraction
         → [AUTO] Re-run /verify-code → APPROVED ✓
      5. /verify-security → ISSUES_FOUND (SQL injection on line 87)
         → [AUTO] Fix: use parameterized query
         → [AUTO] Re-run /verify-security → APPROVED ✓
      7. Complete (all gates passed - user sees final result only)
    </flow>
    <note>User sees: implementation started → implementation complete. NO questions in between.</note>
  </example>
</examples>

<anti-patterns priority="READ-CAREFULLY">
  <warning>
    ⚠️ THESE ARE PATTERNS THAT CAUSE IMPLEMENTATION FAILURES ⚠️
    If you catch yourself doing ANY of these, STOP and correct.
  </warning>

  <completeness-anti-patterns category="CRITICAL">
    <anti-pattern name="accept-deferrals">
      <bad>Accepting "// TBD", "// Phase 2", "// For now" as complete</bad>
      <good>Deferral patterns = INCOMPLETE, no exceptions</good>
      <consequence>Incomplete work ships, user must fix later</consequence>
    </anti-pattern>

    <anti-pattern name="skip-completeness">
      <bad>Sending stubs/TODOs to quality review</bad>
      <good>Run completeness-verifier BEFORE quality review</good>
      <consequence>Quality review wastes time reviewing incomplete code</consequence>
    </anti-pattern>

    <anti-pattern name="rationalize-incomplete">
      <bad>Saying "it's mostly done" or "the TODO is minor"</bad>
      <good>INCOMPLETE is INCOMPLETE, regardless of severity</good>
      <consequence>Small deferrals accumulate into major gaps</consequence>
    </anti-pattern>

    <anti-pattern name="defer-error-handling">
      <bad>Implementing happy path only, deferring error cases</bad>
      <good>Implement ALL cases: happy path, errors, edge cases</good>
      <consequence>Production code fails on error conditions</consequence>
    </anti-pattern>

    <anti-pattern name="empty-implementations">
      <bad>Creating function signatures without bodies</bad>
      <good>If you create a function, implement it completely</good>
      <consequence>Code compiles but doesn't work</consequence>
    </anti-pattern>
  </completeness-anti-patterns>

  <workflow-anti-patterns category="HIGH">
    <anti-pattern name="stop-between-gates">
      <bad>Asking user "Should I proceed to quality review?" or "Ready for security check?"</bad>
      <good>Proceed AUTOMATICALLY to next gate - no questions</good>
      <consequence>User wastes time answering obvious questions</consequence>
    </anti-pattern>

    <anti-pattern name="ask-to-fix">
      <bad>Asking user "Should I fix these issues?" when verification fails</bad>
      <good>AUTOMATICALLY fix issues and re-verify - only escalate after 3+ failed attempts</good>
      <consequence>User wastes time on decisions Claude should make autonomously</consequence>
    </anti-pattern>

    <anti-pattern name="security-before-code-review">
      <bad>Running /verify-security before code review</bad>
      <good>Code review first, then security reviews FINAL code</good>
    </anti-pattern>

    <anti-pattern name="skip-code-review">
      <bad>Skipping /verify-code for "simple" changes</bad>
      <good>ALWAYS verify code (quality + requirements — AI loses context)</good>
    </anti-pattern>

    <anti-pattern name="ignore-iterations">
      <bad>Ignoring iteration warnings</bad>
      <good>Human review at iteration 3, require ack at 4+</good>
    </anti-pattern>
  </workflow-anti-patterns>
</anti-patterns>

<key-differences>
  <diff>AUTONOMOUS EXECUTION - no user input between gates</diff>
  <diff>Automatic verify-fix-verify loops until APPROVED</diff>
  <diff>Completeness gate (completeness-verifier agent) before quality review</diff>
  <diff>Modular verification commands (reusable independently)</diff>
  <diff>/verify-security as FINAL gate (not parallel)</diff>
  <diff>/verify-code covers both quality AND requirements in single pass</diff>
  <diff>Iteration tracking with warnings at 3, block at 4+</diff>
  <diff>AI-pitfall awareness in all verifications</diff>
  <diff>Only escalate to user after 3+ failed fix attempts on same issue</diff>
  <diff>Post-gate finalization: /update-docs + /update-todos before completion</diff>
</key-differences>
