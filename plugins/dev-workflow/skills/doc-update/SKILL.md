---
name: doc-update
description: "Accuracy-driven documentation update methodology for code changes. Use when updating docs after implementation, assessing documentation impact, or determining which docs need changes — even for small internal changes that might invalidate project knowledge files like CLAUDE.md, skills, or agent definitions."
user-invocable: false
---

Ensure all project documentation remains accurate after code changes. Every change gets its docs
checked. Only inaccurate docs get updated.

**In scope:**
- README sections affected by changed behavior
- CLAUDE.md instructions (conventions, architecture, patterns) in the same scope as the changes
- Skill SKILL.md files that describe changed methodology or behavior
- Agent .md files whose wiring, tools, or constraints changed
- Command/skill description frontmatter when behavior changes — but see the wiki-page carve-out in
  out-of-scope before editing any page of a `wiki: true` skill
- Inline JSDoc/docstrings on changed exported/public APIs
- Config documentation when config shape changes
- Any existing doc section that references changed functionality

**Scope matching:** check the docs in the scope the changes live in — project-scoped docs for
changes in `.claude/`, user-scoped docs for changes in `~/.claude/`, both when the changes span
both — and cross scopes only when the change itself bridges them.

**Out of scope:**
- Creating new documentation for existing features
- Rewriting unrelated documentation sections
- Adding documentation that didn't exist before (unless new API or convention)
- Style or formatting improvements to existing docs
- Generating changelog entries
- Any wiki page — a page under a skill folder whose SKILL.md declares `wiki: true`, body and
  frontmatter alike. `knowledge-ingestor` is the only writer of wiki pages, so a stale claim on one
  goes to it as a drift capture (`<wiki-pages>` below), never as your edit. The skill's own
  `SKILL.md` is not a wiki page.

<scope-guard>
  <principle>Accuracy — every change gets docs checked; only inaccurate docs get updated</principle>

  <rules>
    <rule>Check docs for accuracy on every change, because change size does not predict doc impact: a one-line wiring change can invalidate a whole CLAUDE.md section</rule>
    <rule>Update only the docs the change has made inaccurate</rule>
    <rule>Stay within the directly impacted docs, and create a new doc file only when the change requires one</rule>
    <rule>Leave prose that still accurately describes behavior as it is</rule>
  </rules>

  <accuracy-check>
    Before updating a doc, ask:
    1. Does it say something the change has made wrong?
    2. Is there a new API, convention, or project pattern with no existing documentation?

    If neither, skip that doc rather than improving it.
  </accuracy-check>
</scope-guard>

<skip-conditions>
  Skip this step entirely (report "no doc impact") only when:
  <condition>Code style or formatting changes (whitespace, linting)</condition>
  <condition>Test-only changes that don't alter documented test conventions</condition>

  Every other change, small internal refactors included, gets its docs checked.
  You cannot know the doc impact without reading the docs.
</skip-conditions>

<wiki-pages>
  A doc you would fix that turns out to be a wiki page is reported, not edited. Which report
  depends on whether your prompt names a `learned/` directory (a `Learned:` line).

  **With a `learned/` directory:** load `knowledge-capture` via the Skill tool and write one drift
  capture per page, holding every stale claim you found on it:
  - **File:** `drift-{page-name}.md` in that directory, `{page-name}` the page's slug. When that
    name already exists, `drift-{page-name}-{timestamp}.md` with `{timestamp}` from
    `date -u +%Y%m%dT%H%M%SZ`, per `wiki-memory/protocols/lint.md` Step 6. Never overwrite.
  - **Frontmatter:** `source: implementation/ad-hoc`, `type: drift`, `scope` (`project` for a page
    under this repo's `.claude/skills/`, `user` for one under `~/.claude/skills/`), `target-domain`
    and `target-page` naming the page, `status: captured`, `severity: misleading` unless the claim
    is one mechanically checkable fact with direct contradicting evidence (`minor`). Never
    `escalation-reason`.
  - **Body:** `knowledge-capture` § File Body Template. Quote each stale claim beside the changed
    file that falsifies it. `**Discovered:**` names the build and the change; `**Impact:**` names
    the page whose readers the claim misleads.
  - Run `learned-check validate {that directory}` and fix anything it reports before you return.

  **Without one** (an `/update-docs` run outside a build): write nothing for it. Name each stale
  claim, its page and the changed file that falsifies it in the report's `### Drift captures
  written` section, marked `not written — no learned/ directory`.

  **Done when** every stale wiki claim you found is in a validated capture or named in the report,
  and no wiki page appears among your edits.
</wiki-pages>

<workflow type="sequential">
  <step id="1-check-docs" order="first">
    <description>Read docs that could be affected and check their accuracy</description>

    <actions>
      <action>Review the list of changed files and change summary from the prompt</action>
      <action>Determine the scope of changes (project .claude/, user ~/.claude/, or both)</action>
      <action>Search for and read all docs in the matching scope that reference changed functionality:
        - README.md and any docs/ files
        - CLAUDE.md instructions in the same scope as the changes
        - Skill SKILL.md files that describe changed methodology
        - Agent and command .md files whose behavior or wiring changed
        - Inline JSDoc/docstrings on changed functions
        - Command/skill description frontmatter
      </action>
      <action>For each doc found, apply the accuracy check: is anything now wrong?</action>
    </actions>
  </step>

  <step id="2-update-docs" order="second">
    <description>Fix inaccurate documentation</description>

    <actions>
      <action>For each inaccurate doc: update only the sections that are now wrong</action>
      <action>For each wiki page with a stale claim: report it as `<wiki-pages>` says</action>
      <action>For new APIs or conventions: add minimal documentation (signature, purpose, usage)</action>
      <action>For changed config shapes: update config documentation to match</action>
      <action>For changed primitives (in matching scope): update descriptions and CLAUDE.md sections that describe them</action>
    </actions>
  </step>

  <step id="3-report" order="last">
    <description>Report what was updated</description>

    <actions>
      <action>List files updated with brief description of what changed</action>
      <action>List files examined but not updated (with reason: "still accurate")</action>
      <action>Confirm "no doc impact" if nothing needed updating</action>
      <action>Fill `### Drift captures written` from `<wiki-pages>`, or write "none"</action>
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

  ### Drift captures written
  [One line per wiki page with a stale claim, or "none"]
  - [capture path] → [domain/page]: [the stale claims, in a phrase each]

  ### Summary
  [One line: "N files updated, M examined, no doc impact" or similar]
  ```
</output-format>

