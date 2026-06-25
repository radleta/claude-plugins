---
tags: [estimation-expert/calibration]
summary: "Velocity profile system: personal profile overrides default; default profile shows ~32 effective base-hours/day for 6-8 parallel Claude sessions"
---

# Velocity Profiles

Estimation accuracy depends on calibrated velocity data. The skill ships with a default profile showing the expected format. Create your own profile with real data for accurate estimates.

## Profile Loading Order

1. `profiles/personal.md` (your calibrated data — not published, gitignored from marketplace)
2. `profiles/default.md` (shipped example — used when no personal profile exists)

If a personal profile exists, it overrides the default entirely.

## Default Profile (Example)

| Work Type | Example Completed | Approx Base Hours | Actual Days | Implied Multiplier |
|-----------|-------------------|-------------------|-------------|-------------------|
| Infrastructure (data models, table setup, storage) | 8 plan steps | ~40h traditional | ~2 days | 0.3x |
| CDD-Wired (UI phases with stories + backend) | 2 full phases | ~60h traditional | ~2 days | 0.2x |
| Mechanical (templates, repeated controls) | 33 items | ~30h traditional | ~1 day | 0.2x |
| Integration (webhooks, API clients, external services) | 4 integrations | ~20h traditional | ~1 day | 0.3x |
| Investigation (root cause analysis + fix) | 1 incident | ~12h traditional | ~0.5 days | 0.3x |

**Example total: ~162 base-hours accomplished in ~5 work-days = ~32 base-hours/day effective velocity**

This represents a developer running 6-8 parallel Claude sessions. Traditional "1 developer = 6 productive hours/day" becomes "1 developer + AI agents = ~32 effective hours/day" for a mixed workload. Your actual multiplier will differ — calibrate with your own data.

## Creating Your Personal Profile

Create `profiles/personal.md` with the same table format above, filled with YOUR actual completed work from a representative week. Re-calibrate monthly as your workflow evolves. See [Personal Velocity Baseline](profiles/personal.md) for the current calibrated data.
