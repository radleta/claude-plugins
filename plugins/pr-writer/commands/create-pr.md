---
description: Generate PR title, description, and test plan as copy-paste-ready markdown files in scratch/pr-[date]/ (or .git/pr-drafts/ if scratch/ is absent)
argument-hint: "[base-branch] [additional context]"
---

<role>
  <identity>Pull request content generator</identity>
  <purpose>
    Analyze branch changes comprehensively and generate copy-paste-ready PR content
    as markdown files in scratch/ (falling back to .git/pr-drafts/ when scratch/ doesn't
    exist) — works with any git hosting provider's PR interface
  </purpose>
  <scope>
    <in-scope>
      <item>Analyzing commit history and diff against base branch</item>
      <item>Generating PR title following conventional format</item>
      <item>Writing structured PR description with summary and test plan</item>
      <item>Writing output files to scratch/pr-[YYYY-MM-DD]/, or .git/pr-drafts/pr-[YYYY-MM-DD]/ when scratch/ is absent</item>
    </in-scope>
    <out-of-scope>
      <item>Pushing branches or creating PRs via CLI</item>
      <item>Modifying code or making commits</item>
      <item>Resolving merge conflicts</item>
    </out-of-scope>
  </scope>
</role>

## Content Rules

Load the `pr-writer` skill (via the Skill tool) before generating content — it is
the canonical source for title format (50-char soft / 72-char hard limit, imperative
mood, conventional-commit-style prefixes) and description template selection (Minimal
vs Standard, optional sections). This command owns only the mechanics below: gathering
branch state, resolving the output directory, and writing the three files.

## Current State

Current branch:
!`git branch --show-current`

Status:
!`git status -sb`

## Workflow

<workflow type="sequential">
  <step id="1-gather-state" order="first">
    <description>Gather branch state and determine base branch</description>

    <actions>
      <action priority="critical">
        Determine base branch:
        - If $0 is provided, use $0 as base branch
        - Otherwise, detect default branch: git remote show origin | grep 'HEAD branch'
        - Common defaults: main, master, develop
      </action>

      <action priority="critical">
        Fetch the latest remote state so comparisons reflect what the hosting
        platform will show:
        git fetch origin [base-branch]
      </action>

      <action priority="critical">
        Get commit history for this branch (compare against remote ref):
        git log --oneline --no-merges --first-parent origin/[base-branch]..HEAD
      </action>

      <action priority="critical">
        Get diff summary (compare against remote ref):
        git diff --stat origin/[base-branch]..HEAD
      </action>

      <action priority="high">
        Get detailed diff for analysis (compare against remote ref):
        git diff origin/[base-branch]..HEAD
        (For large diffs, use --stat and sample key files)
      </action>
    </actions>

    <acceptance-criteria>
      <criterion priority="critical">Base branch determined</criterion>
      <criterion priority="critical">Commit history obtained</criterion>
      <criterion priority="critical">Diff summary obtained</criterion>
    </acceptance-criteria>
  </step>

  <step id="2-analyze-changes" order="second">
    <description>Analyze all commits and changes to understand the PR scope</description>

    <actions>
      <action priority="critical">
        Analyze ALL commits (not just the latest):
        - Read every commit message in the branch
        - Understand the overall arc of changes
        - Identify the primary change type (feat/fix/refactor/etc.)
      </action>

      <action priority="critical">
        Determine PR scope:
        - What files were changed and why
        - What new functionality was added
        - What bugs were fixed
        - What was refactored
      </action>

      <action priority="high">
        Identify testing implications:
        - Were tests added/modified?
        - What should be tested manually?
        - Are there breaking changes?
      </action>
    </actions>

    <acceptance-criteria>
      <criterion priority="critical">All commits analyzed (not just latest)</criterion>
      <criterion priority="critical">Primary change type identified</criterion>
      <criterion priority="high">Testing implications understood</criterion>
    </acceptance-criteria>
  </step>

  <step id="3-generate-content" order="third">
    <description>Generate PR content and write to the resolved output directory</description>

    <output-directory>
      Resolve the output directory first:
      - If `scratch/` exists at the repo root, use `scratch/pr-[YYYY-MM-DD]/`
      - Otherwise (scratch/ is absent — e.g. a foreign install of this plugin), fall back to
        `.git/pr-drafts/pr-[YYYY-MM-DD]/` (untracked, naturally excluded from commits)

      Create the resolved directory. If it already exists (multiple PRs same day), append a
      counter: `-2/`, `-3/`, etc.
    </output-directory>

    <file name="title.md">
      Contains ONLY the PR title — one line, no markdown formatting.
      Ready to paste into the "Title" field of any PR interface.

      Follow the pr-writer skill's title rules (loaded above) for length, mood,
      and format.
    </file>

    <file name="description.md">
      Contains the full PR body — ready to paste into the "Description" field.
      Uses standard markdown that renders on GitHub, GitLab, Bitbucket, Azure DevOps.

      Follow the pr-writer skill's template selection (loaded above) — Minimal vs
      Standard, plus only the optional sections relevant to this PR.
    </file>

    <file name="metadata.md">
      Contains PR metadata for reference — not pasted directly but useful context:

      ```
      ## PR Metadata

      **Branch:** [current-branch]
      **Base:** [base-branch]
      **Commits:** [count]
      **Files changed:** [count] (+insertions, -deletions)

      ### Commits
      [full commit list]

      ### Files
      [file list grouped by area]
      ```
    </file>

    <acceptance-criteria>
      <criterion priority="critical">Resolved output directory created (scratch/pr-[date]/, or .git/pr-drafts/pr-[date]/ if scratch/ is absent)</criterion>
      <criterion priority="critical">title.md contains one-line title per the pr-writer skill's title rules</criterion>
      <criterion priority="critical">description.md contains full PR body with Summary and Test plan</criterion>
      <criterion priority="critical">metadata.md contains branch info and commit list</criterion>
      <criterion priority="high">All content uses standard markdown (no provider-specific syntax)</criterion>
    </acceptance-criteria>
  </step>

  <step id="4-confirm" order="last">
    <description>Display the generated content and file locations</description>

    <actions>
      <action priority="critical">
        Show the user:
        1. The generated PR title
        2. A preview of the description
        3. The file paths for copy-pasting
      </action>
    </actions>

    <output-format>
      ## PR Ready

      **Title:** [the title]

      **Files written to:** [resolved output directory]
      - `title.md` — paste into Title field
      - `description.md` — paste into Description field
      - `metadata.md` — reference info (commits, files, branch)

      ### Preview
      [show the description.md content]
    </output-format>
  </step>
</workflow>

## Conversation Context

If the preceding conversation contains discussion about the changes on this branch — motivation,
design decisions, trade-offs, or instructions for how the PR should be framed — use that context
to inform the PR title, summary, and description. Conversation context takes priority over
inferences drawn solely from commit messages and diffs.

## Additional Context

$ARGUMENTS

## Constraints

<constraints>
  <constraint priority="critical">
    Analyze ALL commits in the branch, not just the most recent one
  </constraint>

  <constraint priority="critical">
    Use standard markdown only — no GitHub-specific, GitLab-specific, or provider-specific syntax.
    Stick to: headings, bullets, checkboxes (- [ ]), bold, code blocks, tables.
  </constraint>

  <constraint priority="high">
    Follow the pr-writer skill's title length rules — use description for details
  </constraint>

  <constraint priority="high">
    Write files to the resolved output directory (scratch/pr-[date]/, or .git/pr-drafts/pr-[date]/
    when scratch/ is absent) — never hardcode scratch/ as the only option, since not every
    repo this plugin installs into has one, and not every repo's git hooks treat scratch/ the
    same way this one does
  </constraint>

  <constraint priority="medium">
    If the branch has many unrelated changes, note this in the description
    and suggest splitting into multiple PRs
  </constraint>
</constraints>
