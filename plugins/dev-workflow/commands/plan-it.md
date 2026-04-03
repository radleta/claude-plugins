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

<workflow type="sequential">
  <step id="1-initialize">
    <description>Initialize project and load skills</description>
    <actions>
      <action>Parse $ARGUMENTS: first word is project name, rest is description</action>
      <action>Validate project name (kebab-case, 20 chars or less)</action>
      <action>Check scratch/[project]/ does not exist</action>
      <action>Create minimal directory: mkdir -p scratch/[project]/steps</action>
      <action>Identify domain from description (frontend, backend, database, etc.)</action>
      <action>Load 2-4 relevant skills using Skill tool</action>
      <action priority="high">Push project to local-memory:
        Invoke /local-memory push [project-name] to register this plan in Active Projects.
        If CLAUDE.local.md doesn't exist or has no Active Projects section, /local-memory
        initializes it (creates the file, adds markers and inline instructions).
        This pushes the new project to the TOP of the active list — existing tracked
        projects remain in place so all work-in-progress is visible. If the project
        already exists in local-memory, this updates its Stack to reflect the new planning focus.</action>
    </actions>
    <acceptance-criteria>
      <criterion>scratch/[project]/ directory created with steps/ subfolder</criterion>
      <criterion>Skills loaded or gracefully skipped</criterion>
      <criterion>Project registered in CLAUDE.local.md Active Projects (push operation)</criterion>
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
    <description>Investigate codebase directly</description>

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
      <action>Investigate architecture, patterns, and examples using Glob/Grep/Read</action>
      <action>Write research.md with all findings organized by section</action>
      <action>If combined findings exceed 200 lines: split into research/ folder with separate files per topic</action>
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
      <action>Define primary strategy with rationale</action>
      <action>Break into implementation steps (typically 4-8, adjust as needed)</action>
      <action>Identify dependencies between steps</action>
      <action>Assess risks and mitigations</action>
      <action>Document key decisions in decisions.md</action>
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
    <description>Generate step files</description>
    <actions>
      <action>For each implementation step, create steps/NN-step-name.md (NN = 01, 02, etc. zero-padded)</action>
      <action>Each step file contains: description, actions, acceptance criteria, dependencies, affected files</action>
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
    <description>Generate master README.md with navigation, objective, and progress tracking</description>
    <actions>
      <action>Create README.md combining navigation, objective, risk assessment, and progress tracking</action>
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
    <description>Validate structure, update local-memory, and output completion</description>
    <actions>
      <action>Verify all step files exist and have required sections</action>
      <action>Verify research.md (or research/) exists with findings</action>
      <action>Verify decisions.md (or decisions/) exists with at least 1 decision</action>
      <action>Verify README.md has progress table matching actual steps</action>
      <action>Verify no unnecessary depth (no folders where files suffice)</action>
      <action priority="high">Update local-memory with plan details:
        Edit CLAUDE.local.md directly to set:
        - Status: "Plan created — awaiting approval"
        - Direction: key approach/strategy from decisions
        - Plans: scratch/[project]/README.md, scratch/[project]/steps/
        - Skills: skills loaded during planning
        - Decisions this session: key decisions from decisions.md</action>
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
