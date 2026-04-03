---
description: Update plan progress to reflect completed work — marks done checkboxes and updates progress table in plan files
argument-hint: [plan-path] [summary of completed work]
---

<role>
  <identity>Plan progress updater</identity>

  <purpose>
    Cross-reference completed work against a plan's checklists and progress
    table, marking finished items and noting partial progress directly in the
    plan files on disk.
  </purpose>

  <scope>
    <in-scope>
      <item>Updating markdown checkboxes in step files (- [ ] → - [x])</item>
      <item>Updating the README.md progress table (pending → completed/in-progress)</item>
      <item>Noting partial progress on in-progress items</item>
      <item>Reporting what was updated</item>
    </in-scope>

    <out-of-scope>
      <item>Creating new plan items or steps</item>
      <item>Deleting or reordering steps</item>
      <item>Modifying step descriptions beyond progress markers</item>
      <item>Using Claude's internal TaskList/TaskUpdate tools (those are ephemeral session state, NOT the plan)</item>
    </out-of-scope>
  </scope>
</role>

<rules>
  <rule priority="critical">Update the PLAN FILES ON DISK, not Claude's internal TaskList</rule>
  <rule priority="critical">Only update items DIRECTLY related to work that was performed</rule>
  <rule priority="critical">Do NOT create new steps or plan items — this is an update step, not a planning step</rule>
  <rule priority="high">Only mark a checkbox done if ALL of its requirements were met</rule>
  <rule priority="high">For partially completed items, note what was done but leave the checkbox unchecked</rule>
  <rule priority="high">If no plan path can be found, report clearly and skip</rule>
</rules>

<workflow type="sequential">
  <step id="1-locate-plan" order="first">
    <description>Find the plan directory</description>

    <actions>
      <action priority="critical">Parse $ARGUMENTS — first argument is the plan path (e.g., scratch/my-feature/), rest is the work summary</action>
      <action priority="high">If no path provided, scan scratch/ for the most recently modified plan directory</action>
      <action priority="critical">Verify the path contains a README.md — if not, report "no plan found" and stop</action>
    </actions>

    <acceptance-criteria>
      <criterion>Plan directory located with README.md</criterion>
      <criterion>Work summary extracted from arguments</criterion>
    </acceptance-criteria>
  </step>

  <step id="2-read-plan" order="second">
    <description>Read the plan's current state</description>

    <actions>
      <action priority="critical">Read the README.md to find the progress table</action>
      <action priority="critical">Use Glob to find all step files (steps/*.md)</action>
      <action priority="critical">Read each step file to find checkboxes (- [ ] and - [x])</action>
    </actions>

    <acceptance-criteria>
      <criterion>Progress table parsed</criterion>
      <criterion>All step files read with their checkbox states</criterion>
    </acceptance-criteria>
  </step>

  <step id="3-cross-reference" order="third">
    <description>Match completed work against plan items</description>

    <actions>
      <action priority="critical">Review the completed work summary from $ARGUMENTS</action>
      <action priority="critical">For each step: determine if the work fully or partially satisfies it</action>
      <action priority="high">For each checkbox within steps: determine if it was completed</action>
      <action priority="high">Categorize each item as: fully-completed, partially-completed, or unrelated</action>
    </actions>

    <acceptance-criteria>
      <criterion>Each step and checkbox evaluated against completed work</criterion>
      <criterion>Clear categorization for each item</criterion>
    </acceptance-criteria>
  </step>

  <step id="4-update-files" order="fourth">
    <description>Edit the plan files to reflect progress</description>

    <actions>
      <action priority="critical">In step files: change `- [ ]` to `- [x]` for completed checkboxes using Edit tool</action>
      <action priority="critical">In README.md: update the progress table status column (pending → completed or in-progress)</action>
      <action priority="high">For partially-completed steps: add a brief progress note (e.g., "in-progress — 3 of 5 actions done")</action>
      <action priority="high">Do NOT modify any other content in the files</action>
    </actions>

    <acceptance-criteria>
      <criterion>Completed checkboxes marked with [x]</criterion>
      <criterion>Progress table updated</criterion>
      <criterion>No unrelated content modified</criterion>
    </acceptance-criteria>
  </step>

  <step id="5-report" order="last">
    <description>Report all updates made</description>

    <actions>
      <action priority="high">List all changes made</action>
      <action priority="high">Summarize overall plan progress</action>
    </actions>
  </step>
</workflow>

<output-format>
  ```
  ## Plan Progress Update

  **Plan:** [plan path]

  ### Steps Completed
  - Step N: [name] — marked completed (all checkboxes done)

  ### Steps With Progress
  - Step N: [name] — [M of K actions done, what remains]

  ### Steps Unchanged
  - Step N: [name] — not related to current work

  ### Overall Progress
  [N of M steps completed, K in progress, J remaining]
  ```
</output-format>

<examples>
  <example type="steps-updated">
    <scenario>Two of three steps fully completed by implementation</scenario>
    <result>
      - Step 1: "Create middleware" — marked completed (3/3 checkboxes)
      - Step 2: "Add routes" — marked completed (2/2 checkboxes)
      - Step 3: "Write integration tests" — unchanged (not started)
      - Overall: 2 of 3 steps completed
    </result>
  </example>

  <example type="partial-progress">
    <scenario>One step fully done, one partially done</scenario>
    <result>
      - Step 1: "Create models" — marked completed
      - Step 2: "Add API endpoints" — in-progress (3 of 5 endpoints done)
      - Overall: 1 of 2 steps completed, 1 in progress
    </result>
  </example>

  <example type="no-plan-found">
    <scenario>No plan directory exists or path not provided</scenario>
    <result>
      - No plan found at specified path (or no scratch/ plans exist)
      - Summary: skipped (no plan to update)
    </result>
  </example>
</examples>

---

**Update the plan to reflect completed work.**

Context: $ARGUMENTS

**Instructions:**

1. **Locate plan:** Find the plan directory from $ARGUMENTS or scan scratch/ — if no plan found, report and stop
2. **Read state:** Read README.md progress table and all step files with their checkboxes
3. **Cross-reference:** Match the completed work summary against each step and checkbox
4. **Update files:**
   - Mark completed checkboxes: `- [ ]` → `- [x]` (Edit tool)
   - Update README.md progress table status (Edit tool)
   - Note partial progress where applicable
5. **Report:** List all updates and overall plan progress
