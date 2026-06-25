---
tags: [estimation-expert/formula]
summary: "The core estimation formula: base hours × type multiplier ÷ parallelism factor × discovery risk ÷ hours per day"
---

# Estimation Formula

```
remaining_effort_days = Σ(each_remaining_item) {
  base_hours(item)
  × type_multiplier
  ÷ parallelism_factor
  × discovery_risk
} ÷ hours_per_day
```

## Variables

- **base_hours** = estimated hours for a solo senior developer without AI (the "traditional" estimate)
- **type_multiplier** = from the [Work Type Classification](work-type-classification.md) table
- **parallelism_factor** = how many Claude sessions can work on this simultaneously
  - Highly parallelizable: active_claude_count (6-8)
  - Moderately: 2-3
  - Somewhat: 2
  - Serial: 1
- **discovery_risk** = likelihood of scope expansion
  - Low (done before, well-understood): 1.0x
  - Medium (new but bounded, clear spec): 1.3x
  - High (uncharted, external deps, has surprised before): 1.8x
  - Flag items where the plan has been revised as high-risk
- **hours_per_day** = assume 6 productive hours (not 8)
