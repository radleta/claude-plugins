# Project update output template

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

Every project from the context doc's Active Projects table — even those with no activity this period.

| Project | Progress | Status | This Period |
|---------|----------|--------|-------------|
| {Project Name} | {%} | {Current status} | {What happened, or "No activity" / "Unchanged"} |

Use ▲ prefix for projects that advanced. Show "No activity" for quiet projects.
Include sub-milestones indented with "—" for flagship products.
This table gives stakeholders a single scan of everything in flight.

## Velocity & Timeline
{Include when calibration data exists from Step 3. Explain in plain language:
- What the estimates predicted vs what actually happened
- Why the timeline shifted (model correction, scope change, or both)
- What's different about the remaining work
- What to watch for next week
Keep it accessible — the audience is business stakeholders, not engineers.
Omit this section for the inaugural update (no prior data to compare).}

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
- **Active Projects**: Every project in the context doc's Active Projects table should appear — even if no commits landed this period. Update status from git history and plan files. Show "No activity" for quiet projects rather than omitting them. Use ▲ for projects that advanced. Include progress percentages for at-a-glance scanning
- **What's Next**: Strategic priorities and upcoming milestones, not immediate tasks. Pulled from context doc
- **Technical Notes**: For the curious — specific systems, tools, architecture. OK to be more technical here
- **Tone**: Match the context doc's tone guidance. Default: informative, exciting, accessible
- **Quiet periods**: If a week has few commits, still write the update — note what's in progress on branches, what's being planned
