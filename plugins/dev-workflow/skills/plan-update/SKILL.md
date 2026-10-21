---
name: plan-update
description: "Plan progress update methodology for marking completed work in plan files. Use when updating plan checkboxes, marking steps complete, updating progress tables, or reflecting completed work in scratch/ plans — even for partial progress on a single step."
user-invocable: false
---

Cross-reference completed work against a plan's checklists and progress table, marking finished
items and noting partial progress directly in the plan files on disk.

**In scope:**
- Updating markdown checkboxes in step files (- [ ] → - [x])
- Updating the README.md progress table (pending → completed/in-progress)
- Noting partial progress on in-progress items
- Reporting what was updated

**Out of scope:**
- Creating new plan items or steps
- Deleting or reordering steps
- Modifying step descriptions beyond progress markers

<rules>
  Edit the plan files on disk, not the session's TaskList: the files are what the next session reads.
  Touch only items the reported work bears on, and add no steps or items; this is an update, not a
  planning pass. Check a box only when every requirement under it was met; for partial work, note
  what was done and leave the box unchecked. With no plan path found, say so and stop.
</rules>

<workflow type="sequential">
  <step id="1-locate-plan" order="first">
    <description>Find the plan directory</description>

    <actions>
      <action>Parse the prompt for the plan path (e.g., scratch/my-feature/) and work summary</action>
      <action>If no path provided, scan scratch/ for the most recently modified plan directory</action>
      <action>Verify the path contains a README.md — if not, report "no plan found" and stop</action>
    </actions>
  </step>

  <step id="2-read-plan" order="second">
    <description>Read the plan's current state</description>

    <actions>
      <action>Read the README.md to find the progress table</action>
      <action>Use Glob to find all step files (steps/*.md)</action>
      <action>Read each step file to find checkboxes (- [ ] and - [x])</action>
    </actions>
  </step>

  <step id="3-cross-reference" order="third">
    <description>Match completed work against plan items</description>

    <actions>
      <action>Review the completed work summary from the prompt</action>
      <action>For each step: determine if the work fully or partially satisfies it</action>
      <action>For each checkbox within steps: determine if it was completed</action>
      <action>Categorize each item as: fully-completed, partially-completed, or unrelated</action>
    </actions>
  </step>

  <step id="4-update-files" order="fourth">
    <description>Edit the plan files to reflect progress</description>

    <actions>
      <action>In step files: change `- [ ]` to `- [x]` for completed checkboxes using Edit tool</action>
      <action>In README.md: update the progress table status column (pending → completed or in-progress)</action>
      <action>For partially-completed steps: add a brief progress note (e.g., "in-progress — 3 of 5 actions done")</action>
      <action>Do NOT modify any other content in the files</action>
    </actions>
  </step>

  <step id="5-report" order="last">
    <description>Report all updates made</description>

    <actions>
      <action>List all changes made</action>
      <action>Summarize overall plan progress</action>
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
