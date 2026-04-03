---
description: Update documentation impacted by code changes — checks all docs for accuracy, no pre-filtering by change size
argument-hint: [list of changed files and summary of changes]
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
      <action priority="critical">Review the list of changed files and change summary from $ARGUMENTS</action>
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

    <acceptance-criteria>
      <criterion>All potentially affected docs have been READ (not just listed)</criterion>
      <criterion>Each doc assessed for accuracy against the actual changes</criterion>
    </acceptance-criteria>
  </step>

  <step id="2-update-docs" order="second">
    <description>Fix inaccurate documentation</description>

    <actions>
      <action priority="critical">For each inaccurate doc: update ONLY the sections that are now wrong</action>
      <action priority="critical">For new APIs or conventions: add minimal documentation (signature, purpose, usage)</action>
      <action priority="high">For changed config shapes: update config documentation to match</action>
      <action priority="high">For changed primitives (in matching scope): update descriptions and CLAUDE.md sections that describe them</action>
    </actions>

    <acceptance-criteria>
      <criterion>Each updated doc section accurately reflects new behavior</criterion>
      <criterion>No unrelated doc sections were modified</criterion>
    </acceptance-criteria>
  </step>

  <step id="3-sync-memory" order="third">
    <description>Sync local-memory to reflect doc changes</description>

    <actions>
      <action priority="high">If CLAUDE.local.md Active Projects tracks the current work:
        Edit directly to update Status with doc update completion and any Direction
        changes if the documentation revealed approach shifts. This keeps local-memory
        consistent with the actual state of the work across all dimensions (code, docs, plans).</action>
    </actions>

    <skip-condition>Skip if no Active Projects entry exists for the current work.</skip-condition>
  </step>

  <step id="4-report" order="last">
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
  **Changes reviewed:** [summary of code changes from arguments]
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

<examples>
  <example type="doc-updated">
    <scenario>New public function added to existing module</scenario>
    <result>
      - README.md: Added `newFunction()` to API reference table
      - src/utils.ts: Added JSDoc to exported `newFunction()`
      - Summary: 2 files updated — new public API documented
    </result>
  </example>

  <example type="internal-knowledge-update">
    <scenario>Changed doc-updater agent to use new skill and expanded tool set</scenario>
    <result>
      - .claude/agents/doc-updater.md: Updated skills and tools in frontmatter
      - .claude/CLAUDE.md: Updated verification pipeline description
      - Summary: 2 files updated — agent primitive and project architecture docs
    </result>
  </example>

  <example type="no-impact">
    <scenario>Renamed private helper function, no docs reference it</scenario>
    <result>
      - Checked: README.md (still accurate), CLAUDE.md (still accurate)
      - Summary: 0 files updated, 2 examined — no doc impact
    </result>
  </example>

  <example type="config-change">
    <scenario>Added new required field to config schema</scenario>
    <result>
      - README.md: Updated configuration section with new field
      - src/config.ts: Updated JSDoc on config interface
      - Summary: 2 files updated — config shape change documented
    </result>
  </example>
</examples>

---

**Update documentation impacted by the following changes.**

Context: $ARGUMENTS

**Instructions:**

1. **Check docs:** Search for and READ all docs that could reference changed functionality
2. **Assess accuracy:** For each doc, ask: is anything NOW WRONG because of the changes?
3. **Update inaccurate docs:** Fix only the sections that are now wrong
4. **Report:** List what was updated, what was examined but unchanged, and overall summary
