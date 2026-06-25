---
tags: [claude-code/platform-features]
summary: "Skill listing budget mechanics: skillListingBudgetFraction and skillListingMaxDescChars settings, two-pass truncation algorithm, usage-decay ranking, /skills behavior, and practical tuning guidance"
---

# Skill Listing Budget

How Claude Code controls how much of the context window the skill listing consumes — the settings keys, the truncation algorithm, the ranking model, and what to actually do when you hit the budget warning.

## Why a Budget Exists

Before v2.1.86, Claude Code sent full descriptions for every skill every session. As skill sets grew, this became expensive. The budget system trades completeness (all descriptions visible) against cost (tokens per session), using usage history to decide which descriptions are worth keeping.

## Settings Keys

Both keys live in the `settings.json` Zod schema.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `skillListingBudgetFraction` | `number().gt(0).lte(1).optional()` | `0.01` | Fraction of the context window (in characters) reserved for the skill listing |
| `skillListingMaxDescChars` | `number().int().positive().optional()` | `1536` | Per-skill description character cap in the skill listing sent to Claude |

### Environment Variable Override

`SLASH_COMMAND_TOOL_CHAR_BUDGET` — overrides `skillListingBudgetFraction` with an absolute character budget. Precedence: env var > settings key.

## Truncation Algorithm (Two-Pass)

Pass 1 — per-skill cap: descriptions exceeding `skillListingMaxDescChars` (default 1536) are truncated to that length.

Pass 2 — global budget: if the total after pass 1 still exceeds the fraction budget, full descriptions are **dropped entirely** for the lowest-ranked skills. Names remain visible to the model; only descriptions are dropped.

The two passes are intentionally independent. You can lower the per-skill cap without touching the global budget, or raise the global budget without changing how much any single skill can contribute.

## Usage-Decay Ranking ("Most-Used")

When descriptions must be dropped, the highest-ranked skills keep their descriptions. Ranking uses **exponential decay**:

```
score = Math.pow(0.5, daysSinceLastUse / 7)
```

Score halves every 7 days of inactivity. This means "most-used" tracks *recent* activity, not lifetime invocation count.

Usage data is stored in `~/.claude.json` under the top-level `skillUsage` key:

```json
{
  "skillUsage": {
    "<skill-name>": {
      "usageCount": 42,
      "lastUsedAt": 1746400000000
    }
  }
}
```

`lastUsedAt` is epoch milliseconds. A skill you used yesterday outranks one you used 100 times six months ago.

## Budget Warning Message

When descriptions are dropped, Claude Code emits a user-visible warning:

```
Skill listing will be truncated. N descriptions dropped (full descriptions kept for
most-used skills) (X.X%/Y% of context): name1, name2, +N more. Run /skills to
disable some, or raise skillListingBudgetFraction (currently Y%) in settings.json.
```

The `X.X%` is the actual usage; `Y%` is the current budget ceiling. The listed skill names are those that lost their descriptions (lowest-ranked first).

## Historical Evolution

| Version | Change |
|---------|--------|
| Pre-v2.1.86 | No caps, no budget. Full descriptions for all skills every session |
| **v2.1.86** | 250-char per-skill cap introduced |
| **v2.1.105** | Per-skill cap raised 250 → 1,536 chars; budget warning added. These shipped together — the higher cap would have been expensive without the global budget to constrain total cost |
| v2.1.131 | Same mechanism (current) |

## `/skills` — Does NOT Disable Skills

`/skills` is an alphabetical, type-to-filter menu. Press `t` to sort by estimated token count. Selecting an entry pre-fills `/<skill-name>` in the prompt — it does not disable anything.

To actually remove a skill from the listing, use one of:

| Method | Effect |
|--------|--------|
| `disable-model-invocation: true` in skill YAML frontmatter | Hides from model and from `/` |
| Deny rule in `permissions` — `Skill(skill-name)` | Blocks invocation |
| `skillOverrides` setting (per-skill, three modes) | `off` hides from model and `/`; `user-invocable-only` hides from model only; `name-only` collapses description |

`skillOverrides` is per-skill and distinct from the budget — it suppresses a skill regardless of usage rank.

## Practical Tuning

Default 1% targets roughly 2K tokens on a 200K context window. The right response to a budget warning depends on *why* descriptions are being dropped.

**Before raising `skillListingBudgetFraction`:** check whether the dropped skills are genuinely unused. The decay ranking is doing real work — the long tail often is cold. Raising the fraction restores descriptions at proportional token cost *every session*, even when those skills are never invoked.

| Situation | Recommended action |
|-----------|-------------------|
| A specific skill you use regularly lost its description | Invoke it by name (`/<skill-name>`) once to refresh its usage score |
| Many actively-used skills are being dropped | Raise `skillListingBudgetFraction` (e.g., `0.02`–`0.05`) |
| Descriptions are long but you want all skills visible | Lower `skillListingMaxDescChars` to reduce per-skill cost without touching the global budget |
| Skills you never use are filling the budget | Suppress them via `skillOverrides` or `disable-model-invocation` to free budget for the ones you do use |
| Evaluating cost before committing | The warning shows the current percentage; a "Opting in would cost ~10k tokens" hint may appear for context |

**Don't raise the fraction reflexively.** A 5× increase (1% → 5%) costs 5× more context tokens on every session start, including sessions where those skills are never touched.

## See Also

- [Hooks](hooks.md) — `SLASH_COMMAND_TOOL_CHAR_BUDGET` env var can be set via hooks if you want per-project budget overrides
- [Session Data](session-data.md) — Token analysis for measuring actual skill listing overhead in transcripts
