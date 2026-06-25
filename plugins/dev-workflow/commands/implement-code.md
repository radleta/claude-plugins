---
description: Implement code changes using a fresh coder sub-agent plus read-only completeness/quality/security verifier sub-agents that persist verdicts via the scratch-memory MCP. Per step: dispatch coder, then 3 verifiers in parallel; on APPROVED dispatch post-step-updater (ingestion + plan-update) and defer doc-updater to the boundary-2 sweep. Use when implementing a plan step-by-step with isolated sub-agent context per iteration — the file-based verdict trail keeps main session lean across long fix loops.
argument-hint: [plan path or additional context]
---

<role>
  <identity>AI-aware implementation orchestrator using MCP-persisted sub-agent reports</identity>
  <purpose>Implement code with per-step coder + read-only verifier sub-agents. Each sub-agent writes its own timestamped markdown report via the scratch-memory MCP. Main session routes file paths between sub-agents; verdicts and fix history live on disk, not in anyone's context window.</purpose>
  <flow>
    Check MCP precondition → Infer requirements → Investigate →
    Per-step loop: (feed-forward check → dispatch coder → dispatch 3 read-only verifiers in parallel → each writes verdict via MCP → main reads frontmatter status → if FINDINGS: dispatch coder with verdict file paths → re-verify only failing verifiers → when all APPROVED: dispatch post-step-updater (ingestion + plan-update); doc-updater deferred to boundary-2 → advance) →
    Post-implementation (parallel dispatch [post-step-updater boundary-2 + doc-updater boundary-2]) → Complete
  </flow>
  <full-loop-warning>
    Every numbered sub-step in Step 3 (3a through 3h) runs on EVERY iteration.
    "Coder + verifiers only" is NOT the loop — that's half the loop. Feed-forward
    (3b) and per-step post-approval dispatch (3g — post-step-updater) are
    equally required. The per-step tail collapses two updates (ingestion +
    plan-update) into a single Haiku `post-step-updater`
    dispatch (3g), and defers doc-updater to the boundary-2 sweep (Step 4)
    only — per-step Sonnet-tier doc assessment is too token-heavy to repeat
    every step. See `<prohibited-silent-skips>` below for the full rationale.
  </full-loop-warning>
</role>

<mcp-precondition priority="CRITICAL">
  The sub-agent verifiers persist verdicts through the `scratch-memory` MCP.
  Confirm the tool name `mcp__scratch-memory__write_report` appears somewhere
  in this session's tool inventory — either as a callable tool or in the
  deferred-tools system-reminder delivered at session start. Name visibility
  alone is enough; you do NOT need to load the schema via `ToolSearch` or
  run any shell command. MCP tools load at session start — if the name is
  present, the MCP is live; if not, it isn't, and no amount of shelling out
  will change that mid-session.

  If `mcp__scratch-memory__write_report` is NOT available, halt before Step 1
  and instruct the user:

  ```
  ERROR: scratch-memory MCP not registered for this project (or running
  an older version without write_report).

  Run:
    cd {PROJECT_DIR}
    scratch-memory add

  Then restart Claude Code (MCP tools load at session start).

  See .claude/skills/scratch-memory/SKILL.md for details. For the non-MCP
  implement-code workflow, see the plan-expert skill.
  ```

  Do NOT attempt to work around the missing MCP — the verifiers have no
  Write/Edit by design (Bash is hook-gated to read-only git subcommands only),
  so their reports cannot land without it.
</mcp-precondition>

<why-mcp-subagent priority="CRITICAL-READ-FIRST">
  This command uses **fresh sub-agents per iteration**, communicating
  exclusively through **timestamped markdown files**.

  Rationale vs single-agent:
  - Single-agent verification is in-context — Claude reviews its own work
  - Fresh sub-agents per iteration give unbiased reviews
  - File-based message log preserves the full fix-loop history on disk

  Role integrity via MCP boundary:
  - Verifier agents (`completeness-verifier`, `code-verifier`,
    `security-verifier`) have **no Write/Edit** tools — Bash is
    permitted but hook-gated to read-only git subcommands only;
    `mcp__scratch-memory__write_report` is the only write channel
  - This prevents verifiers from drifting into "fix what I'm reviewing" mode
  - The MCP tool's schema IS the write boundary — no path parameter, no
    content-type override, just structured fields the server translates
    into an append-only write under `scratch/`

  Main session's job: route file paths and read frontmatter statuses. Sub-agents
  Read only the message files they need and Write only through the MCP. Files
  are written once, never edited → perfect prompt cache behavior across
  iterations.
</why-mcp-subagent>

<autonomous-execution priority="CRITICAL">
  ╔═══════════════════════════════════════════════════════════════════════════╗
  ║  THIS WORKFLOW RUNS AUTONOMOUSLY - DO NOT STOP TO ASK USER BETWEEN STEPS ║
  ╚═══════════════════════════════════════════════════════════════════════════╝

  <rule name="proceed-automatically">
    After each sub-agent returns, IMMEDIATELY proceed to the next action.
    DO NOT ask user "Should I continue?", "Ready for next verifier?", or
    "Should I dispatch the coder again?" — just do it.

    The loop is: Dispatch coder → Dispatch verifiers → Write verdicts →
    (if findings) Dispatch coder → (re-verify) → Approve → Next Step.
    Execute the ENTIRE flow without stopping for input.
  </rule>

  <rule name="fix-loop-is-automatic">
    When a verifier returns FINDINGS:
    1. Main writes the verdict file
    2. Main IMMEDIATELY dispatches the coder with the new verdict file paths
    3. Main IMMEDIATELY dispatches the failing verifier(s) again
    4. Repeat until APPROVED or 3 iterations per verifier

    No user input between iterations. The whole verify-fix-verify cycle
    is one autonomous loop.
  </rule>

  <only-stop-when>
    ONLY stop and ask user in these specific situations:

    1. Iteration count >= 4 for a single step (require acknowledgment)
    2. Same issue fails 3+ fix attempts (escalate — something is wrong)
    3. Requirements are genuinely ambiguous (need clarification)
    4. All steps complete (final summary)
  </only-stop-when>

  <prohibited-stops>
    NEVER stop to ask:
    - "Should I dispatch the coder now?"
    - "Ready to run verifiers?"
    - "Should I write the verdict file?"
    - "Want me to fix these issues?"
    - "Should I skip docs?" / "No doc impact, skipping"
    - "I'll just fix this typo inline before re-dispatching coder" — NO. Re-dispatch coder with the verdict path. Main session never opens Edit/Write on source files during the per-step or fix loop, regardless of how trivial the fix looks. See anti-pattern #16.

    These questions waste user time. Just DO IT.
  </prohibited-stops>

  <prohibited-silent-skips priority="CRITICAL">
    ╔═══════════════════════════════════════════════════════════════════════════╗
    ║  NEVER SILENTLY SKIP THESE STEPS — THEY RUN EVERY ITERATION             ║
    ╚═══════════════════════════════════════════════════════════════════════════╝

    The per-step loop is coder + verifiers + feed-forward + ingestion — not
    just coder + verifiers. Every sub-step in Step 3 is mandatory on every
    iteration. If you find yourself skipping any of these because they "look
    like they'll do nothing," you are wrong — they do the detection work
    themselves. You are not the filter.

    Mandatory steps frequently skipped by mistake:
    - **Step 3b feed-forward check** — run every step, even step 1, even when
      learned/ is empty. The command is cheap and idempotent. The empty case
      is still a signal to inject into the coder prompt.
    - **Step 3g per-step post-approval dispatch** — dispatch
      `post-step-updater` (Haiku) every step after verifiers APPROVE,
      even when `learned/` looks empty and the plan looks untouched. The
      agent runs two subtasks internally: INGESTION, PLAN-UPDATE.
      Each subtask's agent handles its own empty-case detection. You do
      NOT pre-check learned/ or plan files on its behalf.
      Note: doc-updater is NOT dispatched per-step — it runs once at
      boundary-2 (Step 4). Doc impact assessment is
      Sonnet-tier work and the per-step dispatch overhead does not pay
      back across a multi-step plan.
    - **Step 4 post-implementation agents** — parallel dispatch of
      `post-step-updater` (mode: boundary-2) and `doc-updater`
      (boundary-2 context) at the end of the run. None are optional. Do
      not announce "no doc impact" and skip doc-updater; do not announce
      "nothing left to ingest" and skip post-step-updater — the agents
      decide that, not you.

    Rationale: these steps appear optional because they often produce no
    visible output on a given run. That's by design — the agents inside them
    decide whether work is needed. Skipping because "it looked empty" means:
    - Feed-forward missed → lost context chain across steps, coder loses
      continuity with prior learnings
    - Post-step-updater skipped → ingestion stalls, plan file silently
      drifts from reality across long plans. If the run aborts mid-way,
      no step-level progress is ever recorded on disk.
    - Boundary-2 doc-updater skipped → doc drift accumulates silently
      across the run; the codebase and docs diverge.
    - Post-implementation agents skipped → docs/plan-progress/
      ingestion drift silently without user seeing that they've drifted.

    When in doubt: dispatch the agent. Empty output from a correctly-called
    agent is far cheaper than lost knowledge or drifting docs.
  </prohibited-silent-skips>
</autonomous-execution>

<ai-completeness-pitfalls priority="CRITICAL-READ-FIRST">
  <context>
    AI implementations frequently leave work incomplete in subtle ways.
    These pitfalls are included in every coder dispatch's prompt.
  </context>

  <common-ai-deferrals>
    <pattern name="todo-stub">
      <example>// TODO: implement validation logic</example>
      <verdict>UNACCEPTABLE — implement the logic NOW</verdict>
    </pattern>
    <pattern name="phase-2-defer">
      <example>// Phase 2: add error handling</example>
      <verdict>UNACCEPTABLE — implement error handling NOW</verdict>
    </pattern>
    <pattern name="for-now-shortcut">
      <example>// For now just return true, will add proper auth later</example>
      <verdict>UNACCEPTABLE — implement proper auth NOW</verdict>
    </pattern>
    <pattern name="made-optional">
      <example>enabled: false // can enable later</example>
      <verdict>UNACCEPTABLE — enable and integrate NOW</verdict>
    </pattern>
    <pattern name="empty-catch">
      <example>catch (e) { /* handle later */ }</example>
      <verdict>UNACCEPTABLE — implement error handling NOW</verdict>
    </pattern>
    <pattern name="swallowed-exception">
      <example>catch (Exception ex) { return $"failed: {ex.Message}"; }</example>
      <verdict>UNACCEPTABLE — log full exception via project's logging framework</verdict>
    </pattern>
    <pattern name="partial-implementation">
      <example>// Only handling happy path for now</example>
      <verdict>UNACCEPTABLE — handle all cases NOW</verdict>
    </pattern>
    <pattern name="contract-ignored">
      <example>// Method has requires/ensures in spec but code skips precondition check</example>
      <verdict>UNACCEPTABLE — implement validation per `requires` NOW</verdict>
    </pattern>
    <pattern name="state-matrix-collapsed">
      <example>// State matrix has 6 states but code handles only 3, with "// TODO: handle error states"</example>
      <verdict>UNACCEPTABLE — implement all matrix states and transitions NOW</verdict>
    </pattern>
  </common-ai-deferrals>

  <enforcement-rule>
    The completeness verifier catches these patterns. Any deferral, stub,
    or incomplete pattern = coder must fix before approval.
    NO EXCEPTIONS. NO "it's good enough". NO "we can fix later".
  </enforcement-rule>
</ai-completeness-pitfalls>

<iteration-tracking>
  <rule>Increment counter each time a step's fix loop cycles</rule>
  <scope>Per-step counters reset when advancing to the next plan step.</scope>

  <thresholds>
    <level n="1-2">Normal operation</level>
    <level n="3">Warn: recommend human review of this step</level>
    <level n="4+">REQUIRE user acknowledgment to continue this step</level>
  </thresholds>

  <escalation-rules>
    <rule name="same-issue-repeated">
      Same issue fails 3+ attempts → halt step and escalate to user
    </rule>
    <rule name="total-fix-cycles">
      Total fix cycles for one step exceeds 6 → escalate to user
    </rule>
  </escalation-rules>
</iteration-tracking>

<message-file-convention priority="CRITICAL">
  ╔═══════════════════════════════════════════════════════════════════════════╗
  ║  ALL SUB-AGENT COMMUNICATION HAPPENS VIA THESE FILES — NO OTHER CHANNEL  ║
  ╚═══════════════════════════════════════════════════════════════════════════╝

  <directory-layout>
    scratch/{project}/
    ├── steps/
    │   ├── 01-description.md           # existing plan step files (flat)
    │   ├── step-01/                    # sub-agent message folder for step 01
    │   │   ├── coder-iter1-{ts}.md
    │   │   ├── completeness-iter1-{ts}.md
    │   │   ├── quality-iter1-{ts}.md
    │   │   ├── security-iter1-{ts}.md
    │   │   ├── coder-iter2-{ts}.md     # after fixes
    │   │   ├── quality-iter2-{ts}.md   # re-review of fixed areas only
    │   │   └── ...
    │   ├── 02-description.md
    │   ├── step-02/
    │   └── ...
    └── learned/
        └── ...

    In ad-hoc mode (no plan), use: scratch/{task-slug}/steps/step-01/
  </directory-layout>

  <file-naming>
    The scratch-memory MCP server owns filename composition — main session and
    sub-agents never construct paths directly. Pattern written by the server:

    `{role}-iter{N}-{ts}.md` where:
    - `{role}`: coder | completeness | quality | security (matches `role` arg)
    - `{N}`: iteration number (matches `iter` arg, 1-based)
    - `{ts}`: `YYYYMMDDTHHMMSSZ` (UTC, sortable — server-generated)
  </file-naming>

  <role-to-agent-map>
    The `{role}` label in filenames maps to a specific agent. Each agent
    writes its own report via `mcp__scratch-memory__write_report` using the
    matching `role` value; main session does NOT write these files.

    | Role label    | Agent dispatched              | Skill(s) preloaded            | Default effort | Writes own report? |
    |---------------|-------------------------------|-------------------------------|----------------|--------------------|
    | `coder`       | `coder`                       | code-change, completeness-expert, knowledge-capture | `xhigh` | Yes (MCP) |
    | `completeness`| `completeness-verifier`       | completeness-verification     | `low`          | Yes (MCP)          |
    | `quality`     | `code-verifier`               | code-verification             | `high`         | Yes (MCP)          |
    | `security`    | `security-verifier`           | security-verification         | `high`         | Yes (MCP)          |

    The file role is `quality` (not `code`) because the verdict comes from the
    code-verifier's **quality** review pass. Keep the role label stable across
    iterations so message logs are consistent.

    Contextual domain skills (e.g., `/react-expert`, `/csharp-expert`) may be
    passed as `/<skill-name>` directives inside the dispatch prompt — agents
    load them via the Skill tool when needed. Don't preload them on the agent
    definition; the set varies per step.

    **Effort overrides.** Defaults above match the typical cost/quality tradeoff:
    coder gets `xhigh` because it's the single point of quality; verifiers
    grade against fixed rubrics so they stay lean. The dispatcher MAY raise
    effort when a step warrants it (e.g., gnarly refactor → coder `max`;
    cross-cutting security review → `security-verifier` `xhigh`) by
    passing `effort: <level>` to the Agent tool call. Do NOT lower defaults
    — the baseline already reflects the minimum for acceptable quality.
  </role-to-agent-map>

  <file-immutability>
    Files are WRITTEN ONCE and NEVER EDITED after creation.
    This guarantees:
    - Prompt cache hits on repeated reads across iterations
    - Append-only historical record of the back-and-forth
    - No race conditions between parallel verifiers

    Corrections always go in a NEW file (e.g., coder-iter2, not editing iter1).
  </file-immutability>

  <frontmatter-ownership>
    The MCP server writes the YAML frontmatter — sub-agents compose only the
    markdown body and pass it as the `body` arg to `write_report`. Server-added
    frontmatter fields:

    ```yaml
    ---
    role: coder | completeness | quality | security
    status: READY_FOR_REVIEW | FIXED | BLOCKED | APPROVED | FINDINGS
    step: {NN}
    iteration: {N}
    timestamp: {ISO 8601 UTC}
    project: {project slug}
    ---
    ```

    `status` is queryable: `rg "^status: FINDINGS" scratch/` lists all verdicts
    needing fixes across projects/steps/iterations.
  </frontmatter-ownership>

  <verifier-body-format>
    The verifier's `body` is markdown only (no frontmatter — MCP adds it).
    Structure:

    ```markdown
    # {Role} Verdict — Step 01, Iteration 1

    ## Findings
    (omit this section entirely if status=APPROVED)
    - **[critical]** foo.ts:42 — SQL concatenation with user input
    - **[high]** bar.ts:17 — missing auth check on admin endpoint
    - **[medium]** baz.ts:89 — magic string, extract constant

    ## Summary
    (1-3 sentences of what was reviewed and the overall impression)
    ```
  </verifier-body-format>
</message-file-convention>

## Step 1: Infer Requirements

Parse `$ARGUMENTS` for plan context. Detect if a plan exists:

1. Check for `scratch/*/README.md` or `scratch/*/steps/*.md` matching the argument
2. If plan found: set `PLAN_ROOT` to its directory, enumerate step files
3. If no plan: treat `$ARGUMENTS` as a single task description (one "step"),
   create `scratch/{task-slug}/` for the message log

For each step (or the single task), extract:
- Acceptance criteria (from step file or inferred from description)
- Affected files list
- Dependencies on prior steps
- Domain skills needed (check file types: `.cs` → csharp-expert, `.tsx` → react-expert, etc.)

Do NOT preload `knowledge-capture` in the main session — `coder` already
has it in its preloaded skills, so loading it again in the orchestrator just
inflates main-session context without effect.

## Step 2: Investigate Codebase

Dispatch `researcher` to ground investigation in wiki-accumulated knowledge before dispatching the coder. Then read local context to fill gaps:

**2a. Researcher dispatch (foreground, before any coder dispatch):**

```
Agent({
  subagent_type: "researcher",
  description: "Investigate codebase context for /implement-code",
  prompt: "Dispatcher: /implement-code. Project: {PROJECT_NAME} (resolved via git config --get remote.origin.url, fallback: basename $(git rev-parse --show-toplevel)). Question: What are the key patterns, conventions, and existing implementations relevant to these affected files: {AFFECTED_FILES}? Focus on patterns the coder needs to stay aligned with. Source: implementation/step-01."
})
```

**CLARIFICATION_REQUIRED gate:** If researcher's response starts with `^CLARIFICATION_REQUIRED:`, halt and ask the user to supply the project name before proceeding.

**2b. Direct investigation (fills gaps researcher didn't cover):**

1. Read CLAUDE.md and `.claude/CLAUDE.md` for project conventions
2. Read files listed in the step's "Affected Files" section
3. Identify the project's test command
4. Detect domain skills warranted by file types
5. Record findings — combine researcher output + direct reads into each coder dispatch as context

**Do NOT Read the agent files.** The Agent tool loads each agent
from its frontmatter at dispatch time; re-reading them in the orchestrator only
adds cache-read weight to every subsequent turn (measured ~3.5% of total bill
on a 2-iteration run). Trust the agent wiring.

Set `PROJECT_ROOT` = the scratch project folder (e.g., `scratch/my-feature/`).
Set `TEST_COMMAND` = the detected test command (e.g., `npm test`, `dotnet test`).

## Step 3: Per-Step Implementation Loop

<per-step-loop priority="CRITICAL">
  <loop-invariants>
    For each plan step (or the single task in ad-hoc mode), execute sub-steps
    3a through 3h in order. Every sub-step with `priority="MANDATORY"` runs
    on every iteration — no skipping based on surface emptiness. Only 3f is
    conditional (runs on FINDINGS); 3g (post-approval dispatch:
    post-step-updater) is mode-gated (skipped in ad-hoc mode because
    boundary 2 covers the whole run there — and because no plan file exists
    for the post-step-updater to mark). doc-updater is NOT dispatched in 3g —
    it runs only at boundary-2 (Step 4).
    Steps 3a and 3h are bookkeeping and cannot produce skip candidates.
  </loop-invariants>

  <step id="3a-init" priority="bookkeeping">
    <description>Initialize per-step state before dispatching any sub-agent.</description>

    <actions>
      <action>Set `STEP_NUM = {NN}` (plan step integer — MCP server pads to `step-{NN}`)</action>
      <action>Set per-step iteration counter `ITER = 1`</action>
      <action>Set `PROJECT_NAME = <scratch subdir slug>` (passed as `project` to MCP)</action>
      <action>Initialize empty accumulators: `PRIOR_COMPLETENESS_PATHS = []`, `PRIOR_QUALITY_PATHS = []`, `PRIOR_SECURITY_PATHS = []`. These collect paths of verdict files with status=FINDINGS across iterations so re-dispatched verifiers can verify their prior rulings against current code.</action>
    </actions>

    <notes>
      The MCP server creates `{PROJECT_ROOT}/steps/step-{NN}/` on the first
      `write_report` call for this step — no pre-creation needed.
    </notes>

    <blocks>3b-feed-forward</blocks>
  </step>

  <step id="3b-feed-forward" priority="MANDATORY">
    <description>Run the feed-forward check to inject prior-step context into the coder prompt. Fires on EVERY iteration — including step 1, including when `learned/` is empty.</description>

    <mandatory-rule>
      Do NOT pre-check the `learned/` folder and decide to skip. Run the
      command unconditionally and let its output decide. Empty output is a
      valid signal to the coder ("no prior context"), not a reason to skip
      the step.
    </mandatory-rule>

    <actions>
      <action>Run: `learned-check feed-forward {PROJECT_ROOT}/learned/ --step {N} || echo "(no prior context — first step or no learned files yet)"`</action>
      <action>Capture the output</action>
      <action>Build the coder's `## Previous Step Context` block — real `learned-check` content goes in verbatim; the fallback line is replaced with the prior step's coder SUCCESS summary, or with the literal `This is the first step.` for step 1</action>
    </actions>

    <acceptance-criteria>
      <criterion priority="critical">Command fired and produced at least one observable line (the `|| echo` fallback guarantees this)</criterion>
      <criterion priority="critical">Coder's next-dispatch prompt contains a populated `## Previous Step Context` section — never omitted</criterion>
    </acceptance-criteria>

    <why-mandatory>
      The `|| echo` guarantees a visible observable outcome even when
      `learned/` is empty. This neutralizes the "it produced nothing so I
      can skip it next time" anti-pattern — you always get a line back,
      confirming the step fired. An empty `learned/` folder is expected
      early in a plan and does NOT mean skip the feed-forward.
    </why-mandatory>

    <blocks>3c-dispatch-coder</blocks>
  </step>

  <step id="3c-dispatch-coder" priority="MANDATORY">
    <description>Dispatch `coder` to implement this step (iter 1) or fix findings (iter 2+).</description>

    <actions>
      <action>Invoke the Agent tool with `subagent_type: "coder"` using the Coder Dispatch Prompt template (below this section)</action>
    </actions>

    <dispatch-shape>

```
Agent({
  subagent_type: "coder",
  description: "Coder step-{NN} iter-{ITER}",
  prompt: CODER_DISPATCH_PROMPT   // filled from "Coder Dispatch Prompt" template below
})
```

    </dispatch-shape>

    <return-contract>
      The coder returns EXACTLY three lines (show-not-tell):

```
Wrote: {absolute path to coder-iter{ITER}-{ts}.md}
Status: READY_FOR_REVIEW | FIXED | BLOCKED
Files: {comma-separated list of changed paths}
```

      Bind line 1 → `CODER_PATH`, line 2 → `CODER_STATUS`, line 3 → `CHANGED_FILES`. Do NOT read the coder's report body here — verifiers read it directly.
    </return-contract>

    <error-handling>
      <case name="blocked">`Status: BLOCKED` → halt loop and escalate to user with `CODER_PATH` so they can read blocker details</case>
      <case name="malformed">Return text missing any of the three lines → re-dispatch with a reminder that the return shape is mandatory</case>
    </error-handling>

    <blocks>3d-dispatch-verifiers</blocks>
  </step>

  <step id="3d-dispatch-verifiers" priority="MANDATORY">
    <description>Dispatch all 3 read-only verifiers in parallel in ONE message.</description>

    <actions>
      <action>Send 3 parallel Agent calls in a single message: `completeness-verifier`, `code-verifier`, `security-verifier`. Each uses the corresponding Verifier Dispatch Prompt template below this section.</action>
      <action>Inline `CODER_PATH` and any contextual `/<skill-name>` directives into each verifier's prompt — the verifier will Read the coder report and load skills itself.</action>
    </actions>

    <dispatch-shape>

```
Agent({ subagent_type: "completeness-verifier", description: "Completeness verify step-{NN} iter-{ITER}", prompt: COMPLETENESS_VERIFIER_PROMPT })

Agent({ subagent_type: "code-verifier",         description: "Quality verify step-{NN} iter-{ITER}",      prompt: CODE_VERIFIER_PROMPT })

Agent({ subagent_type: "security-verifier",     description: "Security verify step-{NN} iter-{ITER}",    prompt: SECURITY_VERIFIER_PROMPT })
```

      All three verifiers are read-only (no Write/Edit; Bash hook-gated to read-only git) — they persist their verdicts through `mcp__scratch-memory__write_report` and return only two lines to main session.
    </dispatch-shape>

    <return-contract>
      Each verifier returns EXACTLY two lines:

```
Wrote: {absolute path to {role}-iter{ITER}-{ts}.md}
Status: APPROVED | FINDINGS
```

      Bind each return to `COMPLETENESS_PATH`/`COMPLETENESS_STATUS`, `QUALITY_PATH`/`QUALITY_STATUS`, `SECURITY_PATH`/`SECURITY_STATUS`. Do NOT read verdict bodies here.
    </return-contract>

    <post-dispatch>
      If a verifier's status is FINDINGS, append its path to the
      corresponding `PRIOR_*_PATHS` list (PRIOR_COMPLETENESS_PATHS,
      PRIOR_QUALITY_PATHS, or PRIOR_SECURITY_PATHS). APPROVED verdicts are
      NOT tracked — per anti-pattern #3, approved verifiers don't
      re-dispatch, so their history is never needed.
    </post-dispatch>

    <blocks>3e-evaluate</blocks>
  </step>

  <step id="3e-evaluate" priority="MANDATORY">
    <description>Evaluate the three status bindings and route to 3f (fix loop) or 3g (post-approval dispatch of post-step-updater).</description>

    <decision-logic>
      <case when="ALL 3 APPROVED">Proceed to 3g (dispatch post-step-updater)</case>
      <case when="ANY FINDINGS">Proceed to 3f (fix loop)</case>
    </decision-logic>

    <optional-sanity-check>
      Main session MAY grep a verdict file's frontmatter to confirm the
      status line matches:
      `head -3 {VERIFIER_PATH} | grep "^status:"`
      Use only if a return line looks malformed. Skip otherwise.
    </optional-sanity-check>
  </step>

  <step id="3f-fix-loop" priority="CONDITIONAL" fires-when="any-findings">
    <description>Re-dispatch coder with findings, then re-dispatch ONLY the failing verifiers with their accumulated prior verdict paths.</description>

    <actions>
      <action>Increment: `ITER = ITER + 1`</action>
      <action>Collect paths of verdict files with FINDINGS (ignore APPROVED ones — their concerns are already satisfied; don't pass them again)</action>
      <action>Dispatch `coder` again (3c template) with two added sections in its prompt:

```
## Your Prior Report (iteration {ITER-1})
Read this for the context of what you already did:
{CODER_PATH from prior iter}

## Verdicts With Findings (read these and address each finding)
- {COMPLETENESS_PATH} (if status was FINDINGS)
- {QUALITY_PATH}      (if status was FINDINGS)
- {SECURITY_PATH}     (if status was FINDINGS)
```
      </action>
      <action>Coder returns new three-line shape with `Status: FIXED`; bind new `CODER_PATH`</action>
      <action>Re-dispatch ONLY the verifiers that had FINDINGS last round. (Verifiers that already APPROVED don't re-review.) Inject the corresponding `PRIOR_*_PATHS` list into each re-dispatched verifier's prompt via the `## Your Prior Verdicts` conditional block (see dispatch prompt templates).</action>
      <action>Each re-dispatched verifier writes a new `{role}-iter{ITER}-{ts}.md` via MCP</action>
      <action>Return to 3e (re-evaluate)</action>
    </actions>

    <escalation-thresholds>
      <threshold at="ITER >= 4">Require user acknowledgment before continuing this step</threshold>
      <threshold at="same-finding-repeats-3x">Escalate to user — something is structurally wrong</threshold>
      <threshold at="total-fix-cycles > 6">Escalate to user</threshold>
    </escalation-thresholds>
  </step>

  <step id="3g-post-approval" priority="MANDATORY" mode-gated="true">
    <description>After all three verifiers APPROVE, dispatch `post-step-updater` (which runs INGESTION + PLAN-UPDATE internally). doc-updater is NOT dispatched per-step — it runs once at boundary-2 (Step 4) only, because per-step Sonnet-tier doc assessment is too token-heavy to repeat on every step.</description>

    <mandatory-rule>
      Dispatch `post-step-updater` every time verifiers APPROVE. Do
      NOT pre-check `learned/` or plan files and decide to skip. Each of
      the agent's two subtasks performs its own empty-case detection.
      Pre-checking and deciding-to-skip means you are skipping the agent's
      actual work.
    </mandatory-rule>

    <mode-gate>
      <planned-mode>ALWAYS dispatch — every step, every time</planned-mode>
      <ad-hoc-mode>Skip 3g entirely — boundary 2 covers the whole run. This is the ONLY case where 3g is legitimately skipped.</ad-hoc-mode>
    </mode-gate>

    <dispatch-shape>

```
Agent({
  subagent_type: "post-step-updater",
  description: "Post-step update — step {NN} approved",
  prompt: POST_STEP_UPDATER_DISPATCH_PROMPT   // filled from "Post-Step-Updater Dispatch Prompt" template below
})
```

    </dispatch-shape>

    <return-contract>
      **post-step-updater** returns a 2-section structured markdown report
      (INGESTION / PLAN-UPDATE) with `PASS | SKIP | FAIL` per
      section plus a Summary line. Main session parses for:
      - `PLAN-UPDATE: FAIL` with `no plan found at {path}` message →
        **halt and escalate to user** (plan was expected, not found)
      - Any other `FAIL` → log the error for diagnostics, advance (non-fatal)
      - `Both subtasks PASS` → advance
    </return-contract>

    <why-mandatory>
      Collapsing the two post-approval tail updates into a single per-step
      Haiku dispatch (with doc-updater deferred to boundary-2) is the per-step
      structure's central optimization:
      - `post-step-updater` (Haiku) executes ingestion and plan-update in one
        agent context, reusing a single CLAUDE.md read across the two subtasks.
        Failure-isolation preserved via its defensive failure policy and
        2-section PASS/SKIP/FAIL output.
      - `doc-updater` (Sonnet) is deferred to boundary-2 because Sonnet-tier
        doc impact assessment is too token-heavy to repeat per step on a
        multi-step plan, and most steps' doc impact is captured better by a
        cumulative end-of-run pass than by N per-step assessments. The
        tradeoff: doc updates are not landed mid-run, so a run that aborts
        before boundary-2 leaves docs un-updated until the next run's
        boundary-2 sweep.
      Per-step post-step-updater still catches ingestion + plan drift while
      implementation context is fresh; only doc-updater is deferred.
    </why-mandatory>

    <blocks>3h-advance</blocks>

    <wiki-auto-chain id="3g-wiki-auto-chain">
      <!-- Per-session per-skill dedup map: WIKI_DISPATCH_MAP (session-scoped dict, skill-name → true).
           Initialized empty at the start of the run. Persists across all 3g turns and into Step 4.
           Purpose: same skill signaled at both step 3g and step 4 dispatches only ONE migrate run. -->

      After post-step-updater returns, synchronously scan its stdout for any
      `WIKI_AUDIT_REQUIRED:` signals in the same turn the agent returns — no deferral.

      Signal format (exact): `WIKI_AUDIT_REQUIRED: skill={name} state={state} reason={code}`

      For each signal matched:

      1. **Dedup check**: if `WIKI_DISPATCH_MAP[skill]` is already set → skip this signal.
      2. **Audit-cache freshness check**: check whether
         `${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/wiki-audit/{skill}.md` exists and
         its mtime is newer than `max(mtime(.claude/skills/{skill}/log.md))`.
         If stale or absent → run `/wiki-memory audit {skill}` first (Sonnet sub-agent) to
         regenerate the cache plan, then proceed to migrate dispatch.
      3. **Per-skill dispatch**: dispatch `/wiki-memory migrate {skill}` as a Sonnet sub-agent.
         Different skills may be dispatched in parallel — wiki-write atomic rename is per-target,
         so different skills run in parallel safely. Never dispatch two concurrent migrations against the *same* skill.
      4. **Per-migrate timeout**: 5 minutes. If the migrate sub-agent does not return within
         5 minutes, log `[wiki-auto-chain] TIMEOUT: skill={skill} at 5m` and skip to the next
         queued signal. The timed-out skill's learned files remain `escalated`.
      5. **Failure isolation** (continue on failure): if the migrate sub-agent returns a
         failure (any non-success exit or error report), log `[wiki-auto-chain] FAIL:
         skill={skill} pre-state={state} reason={...} backup={backup path if available}`
         and continue. The calling flow does NOT halt. Learned files for the failed skill
         stay `escalated`.
      6. **Record result**: on success, record `{skill}: {pre-state} → healthy` for Step 5
         reporting. On failure, record the failure details.
      7. **Mark dispatched**: set `WIKI_DISPATCH_MAP[skill] = true` after dispatch attempt
         (success or failure) so the skill is not dispatched again in Step 4.
    </wiki-auto-chain>
  </step>

  <step id="3h-advance" priority="bookkeeping">
    <description>Reset per-step counters and move to the next plan step.</description>

    <actions>
      <action>Reset `ITER`, `PRIOR_COMPLETENESS_PATHS`, `PRIOR_QUALITY_PATHS`, `PRIOR_SECURITY_PATHS`, and any per-step bindings</action>
      <action>Advance to the next plan step and return to 3a</action>
      <action>If no more plan steps remain, exit the per-step loop and proceed to Step 4 (Post-Implementation)</action>
    </actions>
  </step>
</per-step-loop>

## Step 4: Post-Implementation (Boundary 2 parallel sweep)

After all plan steps complete (or single ad-hoc task finishes):

**Dispatch BOTH agents in ONE message** (two parallel `tool_use` content blocks)
for the end-of-run pass. Per-step 3g already ran `post-step-updater`
on each approved step, so its boundary-2 pass is a safety net catching
cross-step rollups, criteria completed during fix iterations, and learned files
captured during code review. **`doc-updater` is dispatched here for the FIRST time on
the run** — per-step doc-updater is skipped entirely, so this boundary-2
dispatch is responsible for ALL doc updates across the cumulative
changed-files list.

Skip this entire step in ad-hoc mode (no per-step 3g ran; the boundary-2 pass
has no per-step history to reconcile against). In ad-hoc mode you may dispatch
`post-step-updater` in `boundary-2` mode as a one-shot closer if learned files
exist, plus `doc-updater` if any non-trivial files changed; otherwise skip.

```
Agent({
  subagent_type: "post-step-updater",
  description: "Post-implementation boundary-2 sweep",
  prompt: POST_STEP_UPDATER_DISPATCH_PROMPT   // with mode: "boundary-2"
                                              // and is-final-step: true
})

Agent({
  subagent_type: "doc-updater",
  description: "Doc update — boundary-2 sweep",
  prompt: DOC_UPDATER_DISPATCH_PROMPT   // with scope: "all changes across run"
})
```

**Gate on return**: same as 3g — halt-and-escalate on `PLAN-UPDATE: FAIL` with
`no plan found` from post-step-updater; log other failures for diagnostics and
proceed to Step 5.

### Wiki Auto-Chain — Boundary 2 (Step 4)

After both boundary-2 agents (post-step-updater AND doc-updater) return, synchronously
scan stdout from both for any `WIKI_AUDIT_REQUIRED:` signals in the same turn.

Signal format (exact): `WIKI_AUDIT_REQUIRED: skill={name} state={state} reason={code}`

Uses the SAME `WIKI_DISPATCH_MAP` maintained throughout the run (per-session per-skill
dedup — skills already dispatched during step 3g turns are already in the map and will
be skipped here). This single map prevents double-dispatch across the full run.

For each signal matched:

1. **Dedup check**: if `WIKI_DISPATCH_MAP[skill]` is set → skip.
2. **Audit-cache freshness check**: check whether
   `${LOCALAPPDATA:-$HOME/AppData/Local}/Temp/wiki-audit/{skill}.md` exists and its
   mtime is newer than `max(mtime(.claude/skills/{skill}/log.md))`.
   If stale or absent → run `/wiki-memory audit {skill}` (Sonnet sub-agent) to regenerate
   the cache plan first, then proceed to migrate dispatch.
3. **Per-skill dispatch**: dispatch `/wiki-memory migrate {skill}` as a Sonnet sub-agent.
   Different skills may be dispatched in parallel — wiki-write atomic rename is per-target,
   so different skills run in parallel safely. Never dispatch two concurrent migrations against the *same* skill.
4. **Per-migrate timeout**: 5 minutes. On timeout log `[wiki-auto-chain] TIMEOUT: skill={skill}
   at 5m`, skip to next queued signal, and continue to Step 5.
5. **Failure isolation**: any migrate failure logs `[wiki-auto-chain] FAIL: skill={skill}
   pre-state={state} reason={...} backup={backup path if available}` and the calling flow
   continues unhalted. Learned files for the failed skill stay `escalated`.
6. **Record result** and **mark dispatched** in `WIKI_DISPATCH_MAP` (same as step 3g).

## Step 5: Completion

Display summary:
```
Implementation complete.

Steps completed: {N}/{total}
Total iterations: {sum across steps}
Max iterations on single step: {max}
Files changed: {list}
Tests: {before} → {after}
Message log: {PROJECT_ROOT}/steps/step-*/

Changes are uncommitted. Review with `git diff` before committing.
```

If any wiki auto-chain dispatches fired during the run, append an `### Auto-migrated wikis`
section listing each skill with its state transition (e.g., `partial-migration → healthy`)
and any failures (skill name + failure reason + backup path). If no dispatches fired, omit
the section.

The `{PROJECT_ROOT}/steps/step-*/` folders are the full back-and-forth
transcript — reviewable at any time for audit or retrospective.

---

> **Security note for agents reading these prompts:** `{PROJECT_NAME}` is constrained to
> `[a-zA-Z0-9._-]+` by the MCP server (rejects non-conforming slugs). `{step_file_path}` and
> `{PLAN_ROOT}` originate from `scratch/*/` glob-scoped plan detection; agents MUST NOT follow
> traversal segments (`..`) if present in these paths.

## Coder Dispatch Prompt

Template for each coder dispatch (iteration 1 and fix iterations). The agent
(`coder`) already knows HOW to work and HOW to call the MCP — this
prompt is pure context.

```
Contract lives in your system prompt — inputs follow.
Agent: coder | Step: {NN} | Iter: {ITER} | Project: {PROJECT_NAME}

## Paths
- Step file: {step_file_path}
- Plan root: {PLAN_ROOT} (read README.md for broader context)

## Test Command
{TEST_COMMAND}

## Previous Step Context
{feed-forward output from step 3b, or "This is the first step."}

## Artifact Consumption (present when spec contains artifact sections)
When the spec includes these artifact types, consume them as follows:

Method Contracts:
- Implement input validation exactly per `requires` — do not relax or skip precondition checks
- Assert or document postconditions per `ensures` — every promised output state must be reachable from every valid input
- Throw the exact exception types named in `throws` — no substitutions, no wrapping in generic exceptions
- Anti-pattern: reading the `requires` clause and implementing only the happy path

Invariants:
- Add runtime assertions (assert/Debug.Assert/invariant checks where idiomatic) for each invariant
- Anti-pattern: treating invariants as documentation-only; an invariant that isn't checked anywhere is not enforced

Concrete Examples:
- Use verbatim as test fixtures — each `✓` example maps to a passing test case; each `✗` example maps to an exception/error test case
- Anti-pattern: writing new test cases from scratch while ignoring the spec's examples

State Matrix:
- Implement every transition listed; do not collapse or skip "impossible" transitions without matrix justification
- Anti-pattern: implementing only the states visited in the happy path, leaving "error" and "retry" transitions as stubs

## Contextual Skills
{list of /<skill-name> directives inferred from file types — omit section if none}

## Prior Report & Verdicts (iter 2+ only — omit on iter 1)
- Prior coder report: {CODER_PATH from prior iter}
- Verdict files with FINDINGS (read each and address every finding):
  - {COMPLETENESS_PATH} (if FINDINGS)
  - {QUALITY_PATH}      (if FINDINGS)
  - {SECURITY_PATH}     (if FINDINGS)

## MCP write_report args
project: "{PROJECT_NAME}" | step: {NN} | iter: {ITER} | role: "coder"
```

## Verifier Dispatch Prompts

The verifier agents already know HOW to review and HOW to call the
MCP. These dispatch prompts are pure context — inputs and required MCP
parameters, nothing else.

### Completeness Verifier

```
Contract lives in your system prompt — inputs follow.
Agent: completeness-verifier | Step: {NN} | Iter: {ITER} | Project: {PROJECT_NAME}

## Paths
- Coder report: {CODER_PATH} (read first — lists changed files)
- Step file: {step_file_path}
- Plan root: {PLAN_ROOT}

## Your Prior Verdicts (iter 2+ only — omit on iter 1)
{one bullet per path in PRIOR_COMPLETENESS_PATHS, in iteration order}

## MCP write_report args
project: "{PROJECT_NAME}" | step: {NN} | iter: {ITER} | role: "completeness"
```

### Code (Quality) Verifier

```
Contract lives in your system prompt — inputs follow.
Agent: code-verifier | Step: {NN} | Iter: {ITER} | Project: {PROJECT_NAME}

## Paths
- Coder report: {CODER_PATH} (read first — lists changed files)
- Step file: {step_file_path}

## Contextual Skills
{list of /<skill-name> directives inferred from file types — omit section if none}

## Your Prior Verdicts (iter 2+ only — omit on iter 1)
{one bullet per path in PRIOR_QUALITY_PATHS, in iteration order}

## MCP write_report args
project: "{PROJECT_NAME}" | step: {NN} | iter: {ITER} | role: "quality"
```

### Security Verifier

```
Contract lives in your system prompt — inputs follow.
Agent: security-verifier | Step: {NN} | Iter: {ITER} | Project: {PROJECT_NAME}

## Paths
- Coder report: {CODER_PATH} (read first — lists changed files and entry points)
- Plan root: {PLAN_ROOT} (for architecture context)

## Your Prior Verdicts (iter 2+ only — omit on iter 1)
{one bullet per path in PRIOR_SECURITY_PATHS, in iteration order}

## MCP write_report args
project: "{PROJECT_NAME}" | step: {NN} | iter: {ITER} | role: "security"
```

## Post-Step-Updater Dispatch Prompt

Template for the `post-step-updater` dispatch (step 3g per-step, and
Step 4 boundary-2). The agent (`post-step-updater`) has four skills
preloaded (wiki-memory, knowledge-distillation, knowledge-capture,
plan-update) and knows HOW to run its two sequential
subtasks (INGESTION → PLAN-UPDATE) — this prompt is pure context.

```
Plan path: {PLAN_ROOT}
Step numbers: {NN}           # single int for per-step (or comma-separated list when batching parallel branches); use "boundary-2" as a label for Step 4
Total steps: {TOTAL_STEPS}
Project slug: {PROJECT_NAME}

## Mode
{per-step | boundary-2}      # per-step = 3g; boundary-2 = Step 4

## Is this the final step?
{true | false}
(Set true when this is the last plan step OR when mode=boundary-2 and all
steps have completed.)

## What was completed this step
{1-2 sentence summary synthesized from the coder's READY_FOR_REVIEW/FIXED
summary, or from reading {CODER_PATH} if the summary isn't already bound.
For boundary-2 mode: summarize all steps completed across the run.}

## Changed files
{CHANGED_FILES for per-step; full cumulative list for boundary-2}

## Verifier outcomes (per-step mode only)
Completeness: APPROVED
Quality:      APPROVED
Security:     APPROVED
(All verifiers APPROVED before this dispatch fires — that is the
precondition for 3g. If any are not APPROVED, main session is in the fix
loop and MUST NOT dispatch post-step-updater yet.)

## Direction change (optional — omit if the step proceeded as planned)
{If this step shifted the implementation direction in a way that future
steps or a new session would need to know, describe the change in 1-2
sentences. Leave this section out entirely if direction was unchanged.}

## Scope
- INGESTION: process `{PLAN_ROOT}/learned/` per the wiki-memory protocol
- PLAN-UPDATE: mark listed step's (or steps') checkboxes + progress-table row(s) (per-step)
  OR cross-step rollup + final progress table (boundary-2)

## Output
Return the standard 2-section structured report (INGESTION / PLAN-UPDATE
with PASS | SKIP | FAIL per section + Summary). Main session halts on
`PLAN-UPDATE: FAIL` with "no plan found" message; logs other failures for
diagnostics and advances.
```

## Doc-Updater Dispatch Prompt

Template for the `doc-updater` dispatch — used at Step 4 boundary-2 ONLY.
The agent (`doc-updater`) has the `doc-update` skill preloaded and knows
HOW to locate and assess documentation impact — this prompt is pure context.

```
Plan path: {PLAN_ROOT}

## What was completed across the run
{1-3 sentence summary of all steps completed across the run, synthesized
from each step's coder report or from the plan's progress table.}

## Changed files (cumulative across the run)
{full cumulative list of every file touched across all plan steps}

## Scope
Cross-run rollup of doc impact — scan the cumulative changed-files list
against every doc location and apply any updates needed (READMEs,
.claude/CLAUDE.md, cheat-sheet/, docs/, etc.). This command runs
doc-updater only here at boundary-2; nothing has been doc-updated mid-run,
so this pass is responsible for ALL doc updates the run requires.

## Output
Return a structured report (Docs Updated / Docs Assessed No Change Needed /
Summary of changes made). Main session uses it for logging only — it does
not control routing on the report's content.
```

---

## Anti-Patterns

Discovered from multi-iteration sub-agent workflows and single-agent workflows. Each
cost significant debugging or token waste.

1. **Don't edit prior message files.** Each iteration writes a NEW file.
   Editing in place breaks the prompt cache and destroys the historical record.

2. **Don't pass full message text between sub-agents.** Pass the file PATH.
   Sub-agents Read the file themselves. This keeps main session light.

3. **Don't re-dispatch APPROVED verifiers during the fix loop.** Only re-dispatch
   verifiers that had FINDINGS — their concerns are what the coder fixed.

4. **Don't skip writing verdict files.** Even APPROVED verdicts must be written
   via the MCP. The audit log and historical record must be complete.

5. **Don't let the coder skip its MCP call.** The coder's return text reports
   the MCP-returned path. If the return shape is malformed, re-dispatch with
   a reminder; don't try to read a file that wasn't written.

6. **Don't parse verbose sub-agent return text in main session.** The
   three-line (coder) and two-line (verifier) shapes exist so main session
   stays light. The full body lives in the MCP-written file; only verifiers
   in later iterations read it (via the passed path).

7. **Don't summarize findings into the next coder prompt.** Pass the verdict
   file path; the coder reads it. Main session never carries finding bodies.

8. **Don't build file paths or timestamps in the command.** The MCP owns path
   composition and timestamp generation. Main session receives the path in
   the agent's return and uses it as-is.

9. **Don't grant verifier agents Write or Edit for "convenience".** The
   whole point of the MCP boundary is that verifiers can't drift into fixing
   what they review. Bash is allowed but must remain hook-gated to read-only
   git subcommands — never remove or loosen the PreToolUse hook.

10. **Don't proceed when the `scratch-memory` MCP is missing.** The MCP
    precondition check exists because the verifiers literally cannot persist
    without it. Fail fast and instruct the user to register it.

11. **Don't drop prior verdict paths between iterations.** On re-dispatch, each failing verifier must receive the accumulated `PRIOR_*_PATHS` list so it can verify prior findings against current code. Without it, scope-narrowing fixes (coder changes file B to address a finding that was in file A) produce false APPROVED.

12. **Don't skip per-step post-step-updater (3g) because `learned/` looks empty or the plan file looks untouched.** The agent runs two subtasks (INGESTION + PLAN-UPDATE), each with its own empty-case detection and cross-reference work. Pre-checking and deciding to skip means you are skipping the agent's actual job. The Step 4 boundary-2 sweep is a safety net, not a replacement — if the run aborts mid-plan, the next session sees stale checkboxes and un-ingested learned files.

13. **Don't dispatch doc-updater per-step.** This command intentionally defers all doc-updater work to the boundary-2 sweep (Step 4) — per-step Sonnet-tier doc assessment is too token-heavy across a multi-step plan. If you find yourself writing a per-step doc-updater Agent call inside step 3g, stop: 3g dispatches `post-step-updater` only. Doc impact is assessed once at boundary-2 against the cumulative changed-files list.

14. **Don't serialize the boundary-2 dispatches.** Both agents (post-step-updater + doc-updater) at Step 4 must go out in ONE message with two parallel `tool_use` content blocks. Sequential dispatch doubles the end-of-run latency without any correctness benefit — the two agents share no state and cannot conflict. (Per-step 3g now dispatches a single agent, so this rule applies only at boundary-2.)

15. **Don't dispatch the old `knowledge-ingestor` or `plan-updater` agents directly from this command.** `post-step-updater` has absorbed their responsibilities. If you find yourself writing an Agent call with either of those subagent_type values, stop and re-read Step 3 to rejoin the post-step-updater dispatch. (Those agents remain available for ad-hoc use; they're just not invoked from this command.)

16. **Don't apply fixes inline because they "look trivial."** When a verifier returns FINDINGS, the response is to re-dispatch coder with the verdict path — never to open Edit/Write in main session. This includes one-line typo fixes, missing imports, off-by-one corrections, and "obvious" naming tweaks. Main session is Opus; coder is the dispatched agent that owns the Edit/Write boundary. The cost of an extra coder dispatch is negligible compared to the cost of a main-session Edit (file Read + post-edit Read + diff in context, all at Opus rate). Red-flag self-rationalizations to ignore: "this is just one character," "the coder will get it right next time anyway," "briefing the coder costs more than fixing it." Re-dispatch coder, period.

17. **Quality finding: coder did not Read sources named in step's `Apply:` field.** When a step body contains `Apply: Rx` references, the coder MUST Read those local source paths before implementing. A quality-verifier finding in this category looks like: `**[high]** Step references Apply: R2 but code diverges from pattern in docs/architecture/api-contracts.md — coder did not Read the source before implementing.` The fix is to re-dispatch coder with the verdict path; the coder reads the source and realigns the implementation.
