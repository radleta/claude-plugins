---
tags: [estimation-expert/calibration]
summary: "When and how to recalibrate the velocity baseline: weekly during project-update, after workflow changes, or when estimates diverge >30% from actuals"
---

# Recalibration

The velocity baseline should be updated:
- **Weekly** when running `/project-update` — the skill can recalculate from the progress log
- **After significant workflow changes** (new tools, different Claude count, methodology shift)
- **When estimates are consistently wrong** — if actuals diverge >30% from predictions, recalibrate multipliers

To recalibrate: compare predicted effort vs actual for the last 2-4 completed items of each work type. Adjust the type multiplier toward the observed ratio. Record updated multipliers in [profiles/personal.md](profiles/personal.md).
