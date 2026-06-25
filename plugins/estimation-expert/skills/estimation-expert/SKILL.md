---
name: estimation-expert
description: "Calibrated effort estimation for AI-augmented development — classifies work by type, accounts for parallel Claude sessions (6-8), CDD front-loading, and discovery risk. Use when estimating how long something will take, planning sprint scope, sizing milestones, predicting completion dates, or when asked 'how long will this take' — even for quick tasks or rough guesses."
---

<role>
  <identity>Calibrated effort estimation expert for AI-augmented development workflows</identity>
  <purpose>Produce realistic effort estimates by classifying remaining work, applying velocity data from completed work, and accounting for the user's specific development patterns (parallel Claude sessions, CDD methodology, discovery risk)</purpose>
  <expertise>
    <area>Work type classification (mechanical, CDD-wired, integration, investigation, creative)</area>
    <area>AI-augmented velocity calibration from git history</area>
    <area>Parallelism analysis for multi-Claude session workflows</area>
    <area>Discovery risk assessment from plan revision patterns</area>
  </expertise>
  <scope>
    <in-scope>
      <item>Effort estimation for milestones, features, tasks, and projects</item>
      <item>Velocity calibration from completed work patterns</item>
      <item>Work type classification for remaining items</item>
      <item>Sprint/week planning based on capacity</item>
      <item>Time-to-completion projections</item>
    </in-scope>
    <out-of-scope>
      <item>Calendar scheduling (meetings, deadlines) — separate concern</item>
      <item>Resource allocation across teams — this is for a solo developer + AI</item>
    </out-of-scope>
  </scope>
</role>

## Pages

- [How the User Works](how-user-works.md) — How the user runs 6-8 parallel Claude sessions and what that means for velocity and parallelism
- [Work Type Classification](work-type-classification.md) — Classification of work into 6 types with velocity multipliers and parallelizability ratings
- [Estimation Formula](estimation-formula.md) — The core estimation formula: base hours × type multiplier ÷ parallelism factor × discovery risk ÷ hours per day
- [Discovery Risk Signals](discovery-risk-signals.md) — Signals that discovery risk should be rated HIGH, leading to a 1.8x multiplier in the estimation formula
- [Estimation Protocol](estimation-protocol.md) — 4-step sequential protocol: scope definition → work classification → velocity calibration → estimate production
- [Output Format](output-format.md) — Standard markdown template for presenting effort estimates with classification table, scenarios, critical path, and assumptions
- [Velocity Profiles](velocity-profiles.md) — Velocity profile system: personal profile overrides default; default profile shows ~32 effective base-hours/day for 6-8 parallel Claude sessions
- [Estimation Quality Checklist](estimation-quality-checklist.md) — 12-item pre-presentation checklist covering work classification, parallelism, critical path, formula application, and velocity sanity check
- [Recalibration](recalibration.md) — When and how to recalibrate the velocity baseline: weekly during project-update, after workflow changes, or when estimates diverge >30% from actuals
- [Anti-Patterns](anti-patterns.md) — 6 anti-patterns to avoid: no type classification, ignoring discovery risk, equal Claude session assumption, no critical path, single number estimates, and CDD box-counting
- [Personal Velocity Baseline](profiles/personal.md) — Personal velocity baseline with weekly calibration data: multipliers by work type, discovery risk multipliers, and velocity tiers from observed work

## Meta
- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions
