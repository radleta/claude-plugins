---
name: project-update
description: "Generates business-facing project updates from git history across repos and branches. Use when creating weekly updates, monthly summaries, stakeholder reports, or team progress updates — even for single-repo projects or quiet periods."
user-invocable: true
argument-hint: "<cadence> [anchor-date]"
allowed-tools: ["Read", "Glob", "Grep", "Bash", "Write", "Edit", "Agent"]
---

<role>
  <identity>Business-oriented project update writer</identity>
  <purpose>Generate engaging, non-technical stakeholder updates by synthesizing git history, release notes, and project context into readable progress reports</purpose>
  <expertise>
    <area>Git history analysis across multiple repos and branches</area>
    <area>Technical-to-business translation</area>
    <area>Stakeholder communication</area>
  </expertise>
  <scope>
    <in-scope>
      <item>Generating markdown update documents from git history</item>
      <item>Multi-repo and multi-branch commit gathering</item>
      <item>Updating the "What's Next" section in the context doc</item>
    </in-scope>
    <out-of-scope>
      <item>Distribution (email, Slack) — separate concern</item>
      <item>Technical release notes — use existing release workflows</item>
    </out-of-scope>
  </scope>
</role>

# Project Update Skill

## Context Doc Discovery

Find the project context doc in this order:
1. **Repo root**: `PROJECT_UPDATE.md` (check if it's a pointer — if it says "moved to", follow the path)
2. **Sub-repo docs**: `akn-docs/PROJECT_UPDATE.md` or similar docs sub-repo
3. **Argument override**: user passes path as second arg after cadence
4. **CLAUDE.md reference**: look for a `project-update` or `PROJECT_UPDATE.md` reference

If no context doc found, error with:
> No PROJECT_UPDATE.md found. Create one in the repo root with project name, author, cadences, and data sources. See the Project Update skill for the expected format.

## Context Doc Format

The context doc (`PROJECT_UPDATE.md`) defines everything project-specific:

```markdown
# Project Update Configuration

## Project
- **Name**: Project Name
- **Author**: Author Name
- **Audience**: Who reads these (names, roles)

## Cadences
| Name | Period | Output Directory | Filename |
|------|--------|-----------------|----------|
| weekly | 7 days back from anchor | path/to/updates/weekly/ | YYYY-MM-DD.md |
| monthly | Calendar month of anchor | path/to/updates/monthly/ | YYYY-MM-DD.md |

## Email Distribution
- **Profile**: `work` (sender@example.com)
- **To**: recipient@example.com
- **CC**: cc-recipient@example.com
- **Subject pattern**: `Project Weekly Update — {date range}`
- **Send from**: `cd path/to/updates/weekly && email-draft --profile work YYYY-MM-DD.md`
- **Note**: Update files use relative image paths so email-draft can resolve and inline them when run from the output directory.

## Data Sources
- **Sub-repos**: `.subrepos` (if file exists, read it for repo list)
- **Release notes**: path/to/releases/ (optional — read overlapping files as input)
- **Additional context**: path/to/business-brief.md (optional — read for business context)
- **Planning docs**: path/to/planning/ (optional — read for roadmap and milestone context)
- **Scratch projects**: scratch/ (optional — read plan.md files for project status)

## Active Projects
Projects currently in flight. Updated by Claude each run — status reflects latest git history and plan progress.

| Project | Progress | Status | Summary |
|---------|----------|--------|---------|
| Example Project | 60% | Phase 2 of 4 | Brief description |

## Project Details
<!-- Claude's working notes. Tells future-Claude WHERE to check for progress each run. -->
<!-- Updated by Claude after each update generation and by update-docs after significant changes. -->

### Example Project
- **Check**: scratch/example/ plans, src/features/example/
- **Key files**: main entry points and plan files
- **Last known**: what was true as of last update
- **Next signal**: what to look for to detect progress
- **Blockers**: what's preventing forward motion

## Progress Log
<!-- Newest first. Claude appends after significant work. update-docs checks this file. -->
<!-- Captures milestone-relevant notes that git history alone doesn't tell. -->

### YYYY-MM-DD
- Project: what happened and why it matters for the milestone

## What's Next
Forward-looking priorities and upcoming milestones (not immediate tasks — those live in Active Projects status).
- Priority 1
- Priority 2

## Roadmap Image
- **Template**: path/to/roadmap-template.png (reference image for Gemini)
- **Logo**: path/to/logo.png (brand anchor for Gemini)
- **Style**: description of the visual style (e.g., chalk art chalkboard)

## Tone & Style
Description of desired tone and audience expectations.
```

### Active Projects vs What's Next

These are **different sections** serving different purposes:

| Section | Purpose | Grain | Updated by |
|---------|---------|-------|------------|
| **Active Projects** | Track all work in flight with current status | Per-project with status | Claude updates status each run based on git history and plans |
| **What's Next** | Forward-looking priorities and upcoming milestones | Strategic direction | User directs content, Claude suggests additions |

**Active Projects** should include everything being actively worked on — even if no commits landed this period. A project is "active" until it's explicitly completed or shelved. Include projects in planning stages, awaiting approval, or blocked.

**What's Next** should be higher-level priorities: what the team is focused on in the coming weeks/months, major milestones approaching, strategic direction.

## Invocation

```
/project-update <cadence> [anchor-date]
```

- `<cadence>` — name from the Cadences table in context doc (e.g., `weekly`, `monthly`)
- `[anchor-date]` — optional, defaults to today. Format: `YYYY-MM-DD`
- The cadence row defines the period calculation and output path

## Execution Protocol

<workflow type="sequential">
  <step id="1-discover" order="first">
    <description>Find and read the context doc</description>
    <actions>
      <action>Search for PROJECT_UPDATE.md using discovery order above</action>
      <action>Parse project name, author, audience, cadences, data sources, tone</action>
      <action>Validate the requested cadence exists in the Cadences table</action>
      <action>Calculate date range from cadence period and anchor date</action>
    </actions>
  </step>

  <step id="2-gather" order="second">
    <description>Collect git history and supplementary data</description>
    <actions>
      <action>Run git log across ALL branches in the main repo for the date range:
        `git log --all --oneline --after="START" --before="END+1day"`
        Also run with --stat for file change metrics</action>
      <action>If .subrepos file exists, read it and run the same git log in each sub-repo directory that exists on disk</action>
      <action>If release notes directory is configured, read any release files with dates overlapping the period</action>
      <action>If additional context files are configured, read them for business context</action>
      <action>If planning docs directory is configured, read roadmap and milestone docs for strategic context</action>
      <action>If scratch projects are configured, read plan.md/README.md files in active project directories for status context</action>
      <action>Collect summary stats: total commits, repos touched, files changed, insertions/deletions</action>
    </actions>
    <acceptance-criteria>
      <criterion>Git logs collected from main repo and all accessible sub-repos</criterion>
      <criterion>All branches included (not just main/master)</criterion>
      <criterion>Stats aggregated across all repos</criterion>
    </acceptance-criteria>
  </step>

  <step id="3-synthesize" order="third">
    <description>Write the update document</description>
    <actions>
      <action>Group commits by theme/area (not by repo or branch) — use business language</action>
      <action>Identify 3-5 top highlights (biggest wins, most exciting progress)</action>
      <action>Write each section following the Output Template below</action>
      <action>Draw from release notes for richer detail where available</action>
      <action>Match the tone and style defined in the context doc</action>
    </actions>
    <quality-rules>
      <rule>Translate technical commits into business-language descriptions</rule>
      <rule>Never hallucinate features — only describe what git history shows</rule>
      <rule>Group by theme (Billing, Search, Content) not by repo or branch</rule>
      <rule>Skip empty repos or periods with no activity gracefully</rule>
      <rule>Highlights should feel exciting — lead with the most impactful work</rule>
    </quality-rules>
  </step>

  <step id="4-output" order="fourth">
    <description>Write the file and update context doc</description>
    <actions>
      <action>Create output directory if it doesn't exist</action>
      <action>Write the update markdown file to the cadence's output directory with YYYY-MM-DD.md filename (using anchor date)</action>
      <action>Update the "Active Projects" table in PROJECT_UPDATE.md — refresh progress percentages, status, and summaries from git history and plan files</action>
      <action>Update "Project Details" notes — refresh last-known state, blockers, and next-signal for each project so future runs can check efficiently</action>
      <action>Append to "Progress Log" — add dated entries for milestone-relevant changes this period (what advanced, what was decided, what's blocked)</action>
      <action>Update the "What's Next" section in PROJECT_UPDATE.md — remove completed items visible in git history, keep items still upcoming, suggest new items based on active branches</action>
      <action>If Roadmap Image config exists, generate updated image using template reference and logo with current progress percentages</action>
      <action>If Email Distribution config exists in the context doc, add frontmatter (to, cc, subject) to the update file and offer to create a Gmail draft via email-draft CLI. Run from the output directory so inline images resolve correctly.</action>
      <action>Report the output file path to the user</action>
    </actions>
  </step>
</workflow>

## Output Template

```markdown
---
to: {from Email Distribution config}
cc: {from Email Distribution config}
subject: {Subject pattern from Email Distribution config}
---

# {Project Name} — {Cadence} Update
**Period**: {Start Date} – {End Date}
**Author**: {Author}

## Highlights
- {Punchy one-liner about biggest win}
- {Another exciting achievement}
- {Third highlight}

## What Got Done

### {Area/Theme Name}
{Business-language description of what changed and why it matters. 2-4 sentences per area.}

### {Area/Theme Name}
{Description}

## Roadmap Overview
{Optional — include if context doc references planning docs with a roadmap.
Show milestone tables grouped by phase with current status.
For inaugural updates, provide full context. For recurring updates, only show status changes.}

## Active Projects

| Project | Status | This Period |
|---------|--------|-------------|
| {Project Name} | {Phase/milestone status} | {What happened this period, or "No activity" if quiet} |

## By The Numbers
| Metric | Value |
|--------|-------|
| Commits | {N} |
| Repos active | {N} of {Total} |
| Files changed | {N} |
| Lines of code | +{added} / -{removed} |

## What's Next
- {Strategic priority or upcoming milestone}
- {Another forward-looking item}

## Technical Notes
{Deeper detail for anyone curious — specific systems changed, architecture decisions,
infrastructure improvements. This section bridges business and technical audiences.}
```

## Writing Guidelines

- **Highlights**: Lead with impact, not implementation. "Launched the billing system" not "Added 47 DynamoDB entities"
- **What Got Done**: Business language, grouped by theme. A non-engineer should understand what changed and why it matters
- **By The Numbers**: Raw stats that show effort and velocity. Include all repos and branches
- **Active Projects**: Every project in the context doc's Active Projects table should appear — even if no commits landed this period. Update status from git history and plan files. Show "No activity" for quiet projects rather than omitting them
- **What's Next**: Strategic priorities and upcoming milestones, not immediate tasks. Pulled from context doc
- **Technical Notes**: For the curious — specific systems, tools, architecture. OK to be more technical here
- **Tone**: Match the context doc's tone guidance. Default: informative, exciting, accessible
- **Quiet periods**: If a week has few commits, still write the update — note what's in progress on branches, what's being planned
