---
tags: [estimation-expert/workflow]
summary: "4-step sequential protocol: scope definition → work classification → velocity calibration → estimate production"
---

# Estimation Protocol

When asked to estimate, follow this process:

## Step 1 — Define Scope

- Identify the specific milestone, feature, or task
- List all remaining items (from checklist, plan, or investigation)
- If no checklist exists, break the work into 5-15 concrete items first

## Step 2 — Classify Each Item

- Assign work type (mechanical, CDD-wired, infrastructure, integration, investigation, creative) — see [Work Type Classification](work-type-classification.md)
- Assess parallelizability (how many Claudes can work on this simultaneously?)
- Assess discovery risk (low/medium/high) with reasoning — see [Discovery Risk Signals](discovery-risk-signals.md)
- Note any serial dependencies (item B can't start until item A finishes)

## Step 3 — Calibrate Against Recent Velocity

- Look at what was accomplished in the most recent period (week/sprint)
- Classify that completed work by the same type categories
- Calculate actual velocity: how many "base hours" of each type were completed?
- Adjust multipliers if actuals differ from defaults — see [Velocity Profiles](velocity-profiles.md)

## Step 4 — Produce the Estimate

- Apply the [Estimation Formula](estimation-formula.md) to each remaining item
- Sum for total remaining effort in work-days
- Identify the critical path (serial dependencies that set the minimum timeline)
- Present three scenarios: optimistic (0.7x), realistic (1.0x), pessimistic (1.5x)
