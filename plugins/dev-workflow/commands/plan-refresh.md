---
description: Re-walk an existing plan through ideation, spec, and planning phases to align with current process guidance — reusable after any methodology update
argument-hint: <project-name> [focus areas or context]
---

<role>
  <identity>Plan modernization facilitator</identity>
  <purpose>Bring existing plans up to date with current brainstorming, spec, and planning standards by re-walking each phase interactively with the user</purpose>
  <scope>
    <in-scope>Reviewing and updating idea.md, spec.md, and plan artifacts against current skill guidance</in-scope>
    <out-of-scope>Code implementation, creating new plans from scratch (use /plan-it), executing plan steps</out-of-scope>
  </scope>
</role>

<interactive-execution priority="CRITICAL">
  This command is INTERACTIVE — present findings and proposed changes to the user at each phase.
  DO NOT auto-fix without user review. The user drives decisions; you surface gaps and recommendations.

  Between phases, pause and ask: "Ready to proceed to [next phase]?"
  Within a phase, present all findings together, then ask for approval before making edits.
</interactive-execution>

<workflow type="sequential">
  <step id="1-discover">
    <description>Discover existing artifacts and load current guidance</description>
    <actions>
      <action>Parse $0 as project name. Verify scratch/$0/ exists.</action>
      <action>Inventory existing artifacts:
        - scratch/$0/idea.md (ideation phase)
        - scratch/$0/spec.md (spec phase)
        - scratch/$0/README.md + scratch/$0/steps/ (plan phase)
        - scratch/$0/research.md or scratch/$0/research/ (investigation)
        - scratch/$0/decisions.md or scratch/$0/decisions/ (decisions)</action>
      <action>Read each existing artifact in full to understand current state.</action>
      <action>Load current guidance skills:
        - Load `brainstorming` skill (for idea and spec standards)
        - Load `plan-expert` skill (for planning standards)
        - Load any domain expert skills referenced in the plan's Skill Coverage section</action>
      <action>Report to user: which artifacts exist, which phases will be reviewed, and which skills were loaded.</action>
    </actions>
  </step>

  <step id="2-idea-phase">
    <description>Review and update idea.md against current brainstorming guidance</description>
    <gate>Skip if idea.md does not exist. Ask user: "No idea.md found. Create one from the current template, or skip ideation phase?"</gate>
    <actions>
      <action>Compare idea.md structure against current idea-template.md (read the template from the brainstorming skill directory).</action>
      <action>Check for missing sections introduced by recent process changes:
        - Skill Coverage table (Technology | Expert Skill | Status)
        - All template sections present and populated
        - Decisions table format current
        - Open Questions resolved or carried forward</action>
      <action>Run the idea-document-reviewer prompt against the current idea.md (dispatch as subagent). Collect findings.</action>
      <action>Run codebase-alignment-reviewer against idea.md (depth: light). Collect findings.</action>
      <action>If Skill Coverage section exists or was added, run skill coverage detection against the technologies listed. Report any new gaps.</action>
      <action>Present ALL findings to user in a single summary:
        - Structural gaps (missing/outdated sections)
        - Document quality issues (from reviewer)
        - Codebase alignment issues
        - Skill coverage gaps
        - Proposed edits</action>
      <action>After user approves changes, apply edits to idea.md.</action>
      <action>Save via scratch-management after user confirms.</action>
    </actions>
  </step>

  <step id="3-spec-phase">
    <description>Review and update spec.md against current spec guidance</description>
    <gate>Skip if spec.md does not exist. Ask user: "No spec.md found. Create one from idea.md using the current template, or skip spec phase?"</gate>
    <actions>
      <action>Compare spec.md structure against current spec-template.md (read the template from the brainstorming skill directory).</action>
      <action>Check for missing sections and structural alignment:
        - Skill Coverage carried forward from idea.md
        - All template sections present
        - Spec decisions traceable to idea decisions</action>
      <action>Run the spec-document-reviewer prompt against spec.md. Collect findings.</action>
      <action>Run decision-traceability-reviewer against idea.md + spec.md. Collect findings.</action>
      <action>Run codebase-alignment-reviewer against spec.md (depth: thorough). Collect findings.</action>
      <action>Present ALL findings to user:
        - Structural gaps
        - Document quality issues
        - Traceability gaps between idea and spec
        - Codebase alignment issues
        - Proposed edits</action>
      <action>After user approves, apply edits to spec.md.</action>
      <action>Save via scratch-management after user confirms.</action>
    </actions>
  </step>

  <step id="4-plan-phase">
    <description>Review and update plan artifacts against current plan-expert guidance</description>
    <gate>Skip if README.md does not exist. Ask user: "No plan README.md found. Run /plan-it to create a plan, or skip plan phase?"</gate>
    <actions>
      <action>Evaluate plan against current plan-expert standards:
        - Step granularity: 5-10 min per step, 1-2 files, 1-3 deliverables
        - Step count: 8-15 steps typical
        - Each step references specific file:line extension points
        - New file creation justified (why can't existing file be extended?)
        - No assumed backwards compatibility without explicit user approval
        - No parallel implementations (DRY)
        - Each step has: description, actions, acceptance criteria, dependencies, affected files
        - Dependencies between steps documented</action>
      <action>Check research.md for investigation quality:
        - file:line citations present
        - Architecture, patterns, and examples covered
        - No stale references to files that no longer exist</action>
      <action>Check decisions.md for completeness:
        - Each decision has context, options, choice, rationale
        - Decisions align with current codebase state</action>
      <action>Run step-quality-reviewer prompt against plan steps. Collect findings.</action>
      <action>Run investigation-quality-reviewer prompt against research.md. Collect findings.</action>
      <action>Run PLAN-QUALITY grading (from plan-expert skill) to produce a letter grade.</action>
      <action>Present ALL findings to user:
        - Current grade and target grade
        - Step granularity issues (too coarse, too fine)
        - Missing file:line references
        - DRY violations (parallel implementations, assumed BC)
        - Investigation gaps
        - Decision staleness
        - Proposed changes (which steps to split, merge, or rewrite)</action>
      <action>After user approves changes, apply edits to step files, README.md, research.md, and decisions.md as needed.</action>
      <action>Re-grade after edits. Present new grade to user.</action>
      <action>Save via scratch-management after user confirms.</action>
    </actions>
  </step>

  <step id="5-summary">
    <description>Summarize all changes and final state</description>
    <actions>
      <action>Present a summary of what changed across all phases:
        - Phases reviewed
        - Key changes per phase
        - Final plan grade (if plan phase was reviewed)
        - Skill coverage status
        - Any items that need user follow-up (e.g., build missing expert skills)</action>
    </actions>
  </step>
</workflow>

Additional instructions (when provided) override the above: $ARGUMENTS
