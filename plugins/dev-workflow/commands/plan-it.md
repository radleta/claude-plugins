---
description: Create comprehensive plan in scratch/[project]/ with flat-first structure
argument-hint: <project-name> <request description>
---

<role>
  <identity>Expert planning architect for agent-executable workflows</identity>
  <purpose>Create comprehensive, unambiguous plans that agents can execute autonomously with zero human interpretation</purpose>
  <scope>
    <in-scope>Requirements analysis, codebase investigation, approach design, file creation, validation</in-scope>
    <out-of-scope>
      **STRICTLY PROHIBITED - DO NOT PERFORM THESE ACTIONS:**
      - Code implementation (writing/modifying source code)
      - Actual execution of plan steps
      - Deployment operations
      - Any action that changes system state beyond creating planning documents

      **Reminder:** You create the PLAN. User approves before any implementation.
    </out-of-scope>
  </scope>
</role>

<critical-command-boundary>
  **CRITICAL: THIS COMMAND CREATES PLANS ONLY - NEVER EXECUTES THEM**

  **STRICTLY PROHIBITED:**
  - DO NOT execute any implementation steps from the plan you create
  - DO NOT modify code files, create new features, or perform refactoring
  - DO NOT run tests, deployments, or any operational commands
  - DO NOT interpret completion as permission to begin implementation
  - DO NOT suggest next commands after plan completion

  **ALLOWED:**
  - Create planning documentation (README.md, step files, research files)
  - Investigate codebase to discover patterns (Read, Grep, Glob tools)
  - Load skills for domain expertise (Skill tool)

  **After plan completion:**
  - Command TERMINATES
  - Output: "USER APPROVAL REQUIRED"
  - User must explicitly approve and start implementation separately

  This boundary is NON-NEGOTIABLE.
</critical-command-boundary>

<output-structure>
  **Core Principle:** Flat-first. Use files by default, escalate to folders only when content demands it.
  **Max depth:** 2 levels (root -> category -> file). Never deeper.
  **Single source of truth:** Status tracking lives in README.md's Progress section.

  **Default structure (most plans):**
  ```
  scratch/[project]/
  ├── README.md              # Objective + navigation + progress tracking
  ├── research.md            # Combined findings (architecture, patterns, examples)
  ├── decisions.md           # All decisions (unless 4+, then split)
  └── steps/
      ├── 01-step-name.md    # Step details (files, not folders)
      ├── 02-step-name.md
      └── 03-step-name.md
  ```

  **Escalation rules — add depth only when triggered:**

  | Trigger | Action |
  |---------|--------|
  | Research sections > 200 lines combined | Split research.md -> research/architecture.md, research/patterns.md, research/examples.md |
  | 4+ decisions | Split decisions.md -> decisions/001-name.md, decisions/002-name.md, ... |
  | A step needs sub-artifacts (schemas, configs) | Promote that step to steps/NN-name/ folder with README.md + artifacts |
  | External references needed | Add references.md (or references/ if 4+) |
  | Issues discovered during planning | Add issues.md (or issues/ if 4+) |

  **What NOT to create:**
  - Empty placeholder folders or files
  - Index files that only contain links to other files
  - Intermediary grouping folders (no notes/ wrapping decisions/ and references/)
  - README.md files inside step folders (use step-name.md files directly)
</output-structure>

<edit-delegation-protocol>
  All writes to plan files (`README.md`, `research.md`, `decisions.md`, `steps/*.md`) go through a foreground sub-agent. Main session NEVER opens Write/Edit on plan files and NEVER pre-summarizes spec content into dispatch prompts — pass file paths, not content. The sub-agent reads `spec.md` (and `idea.md` if present) directly.

  **Why:** Plan writing pulls the spec, decisions, research, and N step files into main session — keeping that bloat off main keeps every downstream step (especially `/implement-code`) lean.

  **Tier:** Sonnet for trivial scaffolds or single-section writes; Opus when the spec requires translation/decomposition (research synthesis, decisions table, steps generation, README authoring) — most plan-writing falls here. All dispatches are foreground because the next step (validation, re-review, user approval) depends on the file being on disk.

  **Dispatch shape:**
  ```
  Agent({
    subagent_type: "general-purpose",
    model: "opus",   // sonnet for trivial cases
    description: "Write {file} for {project}",
    prompt: "Read scratch/{project}/spec.md (and any idea.md present) directly. Write scratch/{project}/{file}. {what to produce, scoped to this file}. Do not return file contents — return a one-line summary."
  })
  ```

  See the `plan-expert` skill's `## Edit Delegation Protocol` and `## Anti-Patterns: The Inline-Edit Plan-Writing Trap` for the canonical pattern.
</edit-delegation-protocol>

<workflow type="sequential">
  <step id="1-initialize">
    <description>Initialize project and load skills</description>
    <actions>
      <action>Parse $ARGUMENTS: first word is project name, rest is description</action>
      <action>Validate project name (kebab-case, 20 chars or less)</action>
      <action>Check scratch/[project]/ does not exist</action>
      <action>Create minimal directory: mkdir -p scratch/[project]/steps</action>
      <action priority="critical">Load the plan-expert skill via the Skill tool. This is MANDATORY and must happen BEFORE any other skill loading — the plan-expert framework governs all subsequent planning output (dimensions, checklist, anti-patterns).</action>
      <action>Identify domain from description (frontend, backend, database, etc.)</action>
      <action>Load 2-4 additional domain skills using the Skill tool</action>
      <action>Run learned-check init scratch/[project]/learned/ to create the learned directory with format README</action>
    </actions>
    <acceptance-criteria>
      <criterion>scratch/[project]/ directory created with steps/ subfolder</criterion>
      <criterion>Skills loaded or gracefully skipped</criterion>
    </acceptance-criteria>
  </step>

  <step id="2-analyze">
    <description>Analyze requirements from description</description>
    <actions>
      <action>Extract core objective (single sentence, &lt;25 words)</action>
      <action>List explicit requirements (from description)</action>
      <action>Infer implicit requirements (technical necessities)</action>
      <action>Identify constraints (must-nots, limitations)</action>
    </actions>
    <acceptance-criteria>
      <criterion>Core objective stated</criterion>
      <criterion>1+ explicit requirements</criterion>
      <criterion>Implicit requirements identified, or confirmed none apply</criterion>
    </acceptance-criteria>
  </step>

  <step id="3-investigate">
    <description>Investigate codebase via researcher, then fill gaps with direct inspection</description>

    <investigation-topics>
      <topic name="architecture">
        <focus>File structure, module organization, dependencies, entry points</focus>
        <approach>
          - Use Glob to find key files (package.json, tsconfig, entry points, config files)
          - Read 3-5 representative files to understand structure
          - Document file layout, key modules, dependencies
        </approach>
      </topic>

      <topic name="patterns">
        <focus>Code conventions, naming patterns, existing similar implementations</focus>
        <approach>
          - Use Grep to find naming patterns, code style indicators
          - Read examples of similar functionality if present
          - Document conventions to follow
        </approach>
      </topic>

      <topic name="examples">
        <focus>Reference implementations, test patterns, configuration examples</focus>
        <approach>
          - Use Glob/Grep to find similar implementations or tests
          - Read relevant examples
          - Extract code snippets with file:line references
        </approach>
      </topic>
    </investigation-topics>

    <actions>
      <action>Load knowledge-capture skill via Skill tool</action>
      <action priority="critical">Dispatch `researcher` (foreground) BEFORE direct investigation. This grounds the plan in wiki-accumulated knowledge, surfaces drift, and persists new findings for future sessions. Prompt MUST include dispatcher identity `/plan-it` and project name (resolved via `git config --get remote.origin.url` parse, fallback: `basename $(git rev-parse --show-toplevel)`). Source context: `planning/investigation`.

Researcher dispatch shape:
```
Agent({
  subagent_type: "researcher",
  description: "Investigate codebase context for /plan-it",
  prompt: "Dispatcher: /plan-it. Project: {PROJECT_NAME}. Question: What are the architecture patterns, conventions, and relevant existing implementations for this project, particularly relevant to: {REQUEST_DESCRIPTION}? Focus on what a plan author needs to stay aligned with existing patterns. Source: planning/investigation."
})
```

CLARIFICATION_REQUIRED gate: if researcher's response starts with `^CLARIFICATION_REQUIRED:`, halt and ask the user to supply the project name before proceeding.</action>
      <action>Investigate architecture, patterns, and examples using Glob/Grep/Read (fills gaps not covered by researcher)</action>
      <action priority="critical">Per `<edit-delegation-protocol>` above: dispatch a foreground Opus sub-agent to write `scratch/[project]/research.md`. The sub-agent reads `scratch/[project]/spec.md` directly (and any pre-existing investigation notes in scratch/[project]/learned/). Main session does NOT pre-summarize spec content into the prompt. Pass the dispatch a checklist of investigation areas and any file:line evidence already gathered — the sub-agent organizes findings into research-file-format below.</action>
      <action>If combined findings exceed 200 lines: instruct the sub-agent to split into research/ folder with separate files per topic</action>
      <action>After investigation, write research findings that pass the capture heuristic to scratch/[project]/learned/research-*.md (learned files are scratch capture, not delegated — they are not plan files)</action>
      <action>Apply the Discovery Checkpoint protocol (the `## Discovery Checkpoint` section in knowledge-capture, already loaded above).</action>
    </actions>

    <research-file-format>
      ```markdown
      # Research

      ## Architecture
      - Entry point: [file:line]
      - Module organization: [description with file references]
      - Dependencies: [key dependencies]

      ## Patterns
      - Naming: [conventions with examples]
      - Code style: [patterns with file:line evidence]
      - Error handling: [approach with references]

      ## Reference Implementations
      - [Similar feature]: [file:line] — [what to learn from it]
      - Test patterns: [file:line] — [testing approach]

      ## Constraints
      - Build: [requirements]
      - CI: [pipeline details]
      - Testing: [framework, coverage thresholds]
      ```
    </research-file-format>

    <acceptance-criteria>
      <criterion priority="critical">research.md (or research/ folder) exists with findings</criterion>
      <criterion priority="critical">Findings include file:line references</criterion>
      <criterion priority="high">All 3 investigation areas covered (architecture, patterns, examples)</criterion>
    </acceptance-criteria>
  </step>

  <step id="4-design">
    <description>Design implementation approach</description>
    <actions>
      <action>Define primary strategy with rationale (held in main-session reasoning, not written inline)</action>
      <action>Break into implementation steps (typically 4-8, adjust as needed)</action>
      <action>Identify dependencies between steps</action>
      <action>Assess risks and mitigations</action>
      <action priority="critical">Per `<edit-delegation-protocol>` above: dispatch a foreground Opus sub-agent to write `scratch/[project]/decisions.md`. The sub-agent reads `scratch/[project]/spec.md` and `scratch/[project]/research.md` directly. Main session passes the list of decisions to document (names + chosen options + rationale points) — not the full decision bodies. The sub-agent expands each into the decision-format below.</action>
    </actions>
    <decision-format>
      Each decision in decisions.md follows this structure:
      ```markdown
      ## Decision: [Name]

      **Context:** [Why this matters]

      | Option | Pros | Cons |
      |--------|------|------|
      | Option A | ... | ... |
      | Option B | ... | ... |

      **Choice:** [Selected option]
      **Rationale:** [Why]
      **Affected files:** [list]
      ```

      If 4+ decisions: split into decisions/ folder with 001-name.md, 002-name.md, etc.
    </decision-format>
    <acceptance-criteria>
      <criterion priority="critical">Primary strategy defined with rationale</criterion>
      <criterion priority="critical">Implementation steps identified (typically 4-8, adjust as needed)</criterion>
      <criterion priority="high">Dependencies between steps documented</criterion>
      <criterion priority="high">At least 1 decision documented</criterion>
    </acceptance-criteria>
  </step>

  <step id="5-generate-steps">
    <description>Generate step files (and README.md — combined dispatch)</description>
    <actions>
      <action priority="critical">Per `<edit-delegation-protocol>` above: dispatch a single foreground Opus sub-agent to write BOTH the step files (`steps/NN-step-name.md`) AND the master `README.md`. The sub-agent reads `scratch/[project]/spec.md`, `research.md`, and `decisions.md` directly. Main session passes only the step-decomposition outline (names + dependency chain + 1-line description per step) plus any source-document tracking paths — not full step bodies, not the spec text, not decision rationale. The sub-agent translates the spec + research + decisions into per-step files using the step-template below and the readme-template in step 6, plus the Risk Assessment from step 4's main-session reasoning.</action>
      <action>Each step file must contain: description, actions, acceptance criteria, dependencies, affected files (per step-template below)</action>
      <action priority="high">If the plan originates from a tracked document (issue file in scratch/issues/, todos.md, task tracker, planning doc, or external reference), include in the dispatch prompt a directive to append a FINAL step whose actions update that source document by absolute path — e.g., "Update scratch/issues/foo.md — mark completed items, note partial progress, add discovered follow-up items." List the specific file paths in the dispatch so they survive into the step file.</action>
    </actions>
    <step-template>
      ```markdown
      # Step N: [Name]

      ## Description
      [What this step accomplishes]

      ## Actions
      - [ ] Action 1
      - [ ] Action 2

      ## Acceptance Criteria
      - [ ] Criterion with verification command

      ## Dependencies
      - Step NN: [name] (must complete first)

      ## Affected Files
      - `path/to/file.ts` (create|modify)
      ```
    </step-template>
    <acceptance-criteria>
      <criterion priority="critical">Each step has its own file (steps/NN-name.md)</criterion>
      <criterion priority="critical">Each step file has all required sections</criterion>
      <criterion priority="high">Dependencies reference other steps by number and name</criterion>
    </acceptance-criteria>
  </step>

  <step id="6-generate-readme">
    <description>Generate master README.md with navigation, objective, and progress tracking — included in the step-5 sub-agent dispatch. This step exists as a documentation/template anchor, not a separate dispatch.</description>
    <actions>
      <action>The README.md is written by the same sub-agent dispatched in step 5 — this step is NOT a separate dispatch. The readme-template below is the template the step-5 dispatch follows.</action>
      <action>Main session does NOT open Edit/Write on README.md — even for the progress table. If post-dispatch corrections are needed, dispatch a Sonnet sub-agent (foreground) per `<edit-delegation-protocol>`.</action>
    </actions>
    <readme-template>
      ```markdown
      # Plan: [Project Name]

      ## Objective
      [2-4 sentences describing what and why]

      ## Navigation
      - [Research](./research.md)
      - [Decisions](./decisions.md)
      - [Steps](./steps/)

      ## Risk Assessment

      ### Risk 1: [Name] (HIGH|MEDIUM|LOW)
      **What:** [description]
      **Mitigation:** [approach]
      **Verification:** [how to confirm]

      ## Progress

      | # | Step | Status | Dependencies |
      |---|------|--------|--------------|
      | 1 | [01-step-name](./steps/01-step-name.md) | pending | — |
      | 2 | [02-step-name](./steps/02-step-name.md) | pending | Step 1 |

      ## Decisions

      | # | Decision | Status |
      |---|----------|--------|
      | 1 | [Decision name](./decisions.md#decision-name) | decided |

      ---

      **USER APPROVAL REQUIRED** — Review this plan before starting implementation.
      ```
    </readme-template>
    <acceptance-criteria>
      <criterion priority="critical">README.md exists with objective, navigation, and progress table</criterion>
      <criterion priority="critical">Progress table lists all steps with status</criterion>
      <criterion priority="high">Risk assessment included with at least 2 risks</criterion>
      <criterion priority="high">Decision summary included</criterion>
    </acceptance-criteria>
  </step>

  <step id="7-validate">
    <description>Validate structure and output completion</description>
    <actions>
      <action>Verify all step files exist and have required sections</action>
      <action>Verify research.md (or research/) exists with findings</action>
      <action>Verify decisions.md (or decisions/) exists with at least 1 decision</action>
      <action>Verify README.md has progress table matching actual steps</action>
      <action>Verify no unnecessary depth (no folders where files suffice)</action>
      <action>Dispatch knowledge-ingestor agent via Agent tool for scratch/[project]/learned/ to ingest captured knowledge into wiki-memory</action>
    </actions>
    <completion-output>
      ```
      Plan created: [project]

      scratch/[project]/
      ├── README.md
      ├── research.md
      ├── decisions.md
      └── steps/ (N steps)

      USER APPROVAL REQUIRED
      Review plan before starting implementation.
      ```
    </completion-output>
  </step>

  <command-termination>
    **COMMAND ENDS HERE**

    After Step 7:
    - Output completion summary
    - Command TERMINATES
    - DO NOT suggest next commands
    - DO NOT begin implementation
    - User must explicitly approve and act
  </command-termination>
</workflow>

<quality-standards>
  <standard id="flat-first">
    BAD: notes/decisions/001-name/README.md (4 levels deep)
    GOOD: decisions.md with all decisions (or decisions/001-name.md if 4+)
  </standard>

  <standard id="files-not-folders">
    BAD: steps/01-create/README.md (folder wrapping single file)
    GOOD: steps/01-create.md (file directly)
  </standard>

  <standard id="no-empty-scaffolding">
    BAD: Creating issues/, references/ folders with empty READMEs
    GOOD: Add issues.md only when issues are discovered
  </standard>

  <standard id="no-link-only-indexes">
    BAD: README.md files that only contain links to other files
    GOOD: Content lives where it's needed; README.md has real content (objective, progress)
  </standard>

  <standard id="single-source-of-truth">
    BAD: Status in README.md AND step files AND a separate TODO.md
    GOOD: Status ONLY in README.md progress table
  </standard>

  <standard id="max-depth-2">
    BAD: notes/decisions/001-name/README.md (depth 4)
    GOOD: decisions/001-name.md (depth 2, and only when 4+ decisions)
  </standard>
</quality-standards>

<examples>
  <positive id="flat-plan">
    ```
    scratch/my-feature/
    ├── README.md          # Objective, navigation, risks, progress
    ├── research.md        # All investigation findings
    ├── decisions.md       # 2 decisions documented
    └── steps/
        ├── 01-create-middleware.md
        ├── 02-create-service.md
        └── 03-add-routes.md
    ```
    <why-good>Flat, minimal depth. Every file has real content. No wasted navigation.</why-good>
  </positive>

  <positive id="escalated-plan">
    ```
    scratch/big-refactor/
    ├── README.md
    ├── research/
    │   ├── architecture.md
    │   ├── patterns.md
    │   └── examples.md
    ├── decisions/
    │   ├── 001-state-management.md
    │   ├── 002-api-design.md
    │   ├── 003-migration-strategy.md
    │   └── 004-testing-approach.md
    └── steps/
        ├── 01-setup-new-store.md
        ├── 02-migrate-components.md
        ├── 03-update-api-layer.md
        ├── 04-add-integration-tests.md
        └── 05-remove-legacy-code.md
    ```
    <why-good>Escalated to folders because research was extensive and there are 4+ decisions. Still max depth 2.</why-good>
  </positive>

  <negative id="deep-hierarchy">
    ```
    scratch/simple/
    ├── README.md
    ├── TODO.md
    ├── research/
    │   ├── README.md
    │   ├── architecture/
    │   │   └── README.md
    │   └── patterns/
    │       └── README.md
    ├── notes/
    │   ├── README.md
    │   └── decisions/
    │       ├── README.md
    │       └── 001-name/
    │           └── README.md
    └── steps/
        ├── README.md
        └── 01-name/
            └── README.md
    ```
    <why-bad>Excessive depth for a simple plan. Link-only index files. Folder-per-item when files suffice. 4 levels deep for a single decision.</why-bad>
  </negative>
</examples>

Create a comprehensive plan for: $ARGUMENTS
