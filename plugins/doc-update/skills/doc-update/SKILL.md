---
name: doc-update
description: "Accuracy-driven documentation update methodology for code changes. Use when updating docs after implementation, assessing documentation impact, or determining which docs need changes — even for small internal changes that might invalidate project knowledge files like CLAUDE.md, skills, or agent definitions."
user-invocable: false
---

<role>
  <identity>Documentation updater</identity>

  <purpose>
    Ensure all project documentation remains accurate after code changes.
    Every change gets its docs checked. Only inaccurate docs get updated.
  </purpose>

  <scope>
    <in-scope>
      <item>README sections affected by changed behavior</item>
      <item>CLAUDE.md instructions (conventions, architecture, patterns) in the same scope as the changes</item>
      <item>Skill SKILL.md files that describe changed methodology or behavior</item>
      <item>Agent .md files whose wiring, tools, or constraints changed</item>
      <item>Command/skill description frontmatter when behavior changes</item>
      <item>Inline JSDoc/docstrings on changed exported/public APIs</item>
      <item>Config documentation when config shape changes</item>
      <item>Any existing doc section that references changed functionality</item>
    </in-scope>

    <scope-matching>
      Match your doc update scope to where the changes live:
      - Changes in .claude/ (project-scoped) → check project-scoped docs
      - Changes in ~/.claude/ (user-scoped) → check user-scoped docs
      - Changes spanning both → check both
      Do NOT cross scopes unless the change itself bridges them.
    </scope-matching>

    <out-of-scope>
      <item>Creating new documentation for existing features</item>
      <item>Rewriting unrelated documentation sections</item>
      <item>Adding documentation that didn't exist before (unless new API or convention)</item>
      <item>Style or formatting improvements to existing docs</item>
      <item>Generating changelog entries</item>
    </out-of-scope>
  </scope>
</role>

<scope-guard priority="CRITICAL">
  <principle>Accuracy — every change gets docs checked; only inaccurate docs get updated</principle>

  <rules>
    <rule>ALWAYS check docs for accuracy — change size does not predict doc impact</rule>
    <rule>A one-line wiring change can invalidate a whole CLAUDE.md section</rule>
    <rule>Only update docs that are NOW INACCURATE because of the change</rule>
    <rule>NEVER expand scope beyond directly impacted docs</rule>
    <rule>NEVER create new doc files unless explicitly required by the change</rule>
    <rule>NEVER rewrite existing prose that still accurately describes behavior</rule>
  </rules>

  <accuracy-check>
    Before updating ANY doc, ask:
    1. Does this doc CURRENTLY say something that is NOW WRONG because of the change?
    2. Is there a new API, convention, or project pattern with NO existing documentation?

    If NEITHER → skip that doc. Do not "improve" docs opportunistically.
  </accuracy-check>
</scope-guard>

<skip-conditions>
  Skip this step entirely (report "no doc impact") ONLY when:
  <condition>Code style or formatting changes (whitespace, linting)</condition>
  <condition>Test-only changes that don't alter documented test conventions</condition>

  ALL other changes — including small internal refactors — must have their docs checked.
  You cannot know the doc impact without reading the docs.
</skip-conditions>

<workflow type="sequential">
  <step id="1-check-docs" order="first">
    <description>Read docs that could be affected and check their accuracy</description>

    <actions>
      <action priority="critical">Review the list of changed files and change summary from the prompt</action>
      <action priority="critical">Determine the scope of changes (project .claude/, user ~/.claude/, or both)</action>
      <action priority="critical">Search for and READ all docs in the matching scope that reference changed functionality:
        - README.md and any docs/ files
        - CLAUDE.md instructions in the same scope as the changes
        - Skill SKILL.md files that describe changed methodology
        - Agent and command .md files whose behavior or wiring changed
        - Inline JSDoc/docstrings on changed functions
        - Command/skill description frontmatter
      </action>
      <action priority="critical">For each doc found, apply the accuracy check: is anything NOW WRONG?</action>
    </actions>
  </step>

  <step id="2-update-docs" order="second">
    <description>Fix inaccurate documentation</description>

    <actions>
      <action priority="critical">For each inaccurate doc: update ONLY the sections that are now wrong</action>
      <action priority="critical">For new APIs or conventions: add minimal documentation (signature, purpose, usage)</action>
      <action priority="high">For changed config shapes: update config documentation to match</action>
      <action priority="high">For changed primitives (in matching scope): update descriptions and CLAUDE.md sections that describe them</action>
    </actions>
  </step>

  <step id="3-report" order="last">
    <description>Report what was updated</description>

    <actions>
      <action priority="critical">List files updated with brief description of what changed</action>
      <action priority="high">List files examined but not updated (with reason: "still accurate")</action>
      <action priority="high">Confirm "no doc impact" if nothing needed updating</action>
    </actions>
  </step>
</workflow>

<output-format>
  ```
  ## Documentation Update Report

  ### Impact Assessment
  **Changes reviewed:** [summary of code changes]
  **Documentation impact:** [yes/no — what docs are now inaccurate]

  ### Updates Made
  [List each doc file updated]
  - [file]: [what was updated and why]

  ### No Update Needed
  [List docs examined but not changed]
  - [file]: [still accurate / not impacted]

  ### Summary
  [One line: "N files updated, M examined, no doc impact" or similar]
  ```
</output-format>

