---
name: dispatch-tier-rubric
description: "Normative complexity/value rubric for choosing a sub-agent's model and effort at dispatch time, with reactive escalation triggers. Use when authoring or editing any command/skill that dispatches agents via the Agent tool, or when deciding a dispatch tier in an orchestrator — even when the dispatch site already carries a condensed copy of the rules."
---

# Dispatch Tier Rubric

The single normative copy of the tier-selection rules. Orchestrating commands and skills inline a **condensed copy** at each dispatch site (hot-path, no skill load at runtime) with a parity pointer back here — the same inline-mechanics/reference-skill split `handoff-methodology` uses. Edit here first, then sync the condensed copies.

The benchmark data behind every rule here, and the cost-per-task math that traces each tier to it, live in [Model-Tier Delegation Economics](../claude-code-expert/command-architecture/model-tier-delegation-economics.md).

## Pick the tier

Opus is the floor: on the benchmark every Sonnet configuration loses to some Opus configuration on pass rate, cost and steps at once. Effort is the lever, and its frontier ends at `high`. Ties break upward.

| Job | Model | Effort |
|---|---|---|
| Verdict work — output is a verdict, not a diff: reviewer and verifier gates, alignment checks, doc-quality passes | `claude-opus-5-5` | `low` |
| **Default** — standard implementation, review, research and doc work | `claude-opus-5-5` | `medium` |
| Any trigger below fires | `claude-opus-5-5` | `high` |
| Mechanical or deterministic work (checkbox updates, scaffold-from-template, single-cell or row edits, format conversions) **and** its output is verified downstream. Never judgment work, never the coder role | `claude-haiku-4-5` | `medium` |
| A documented per-agent cost constraint outweighs pass rate. Today only `chrome-browser`, whose browser traffic makes token volume the binding cost | `claude-sonnet-5-5` | `medium` |

**Never `xhigh` or `max`, on any model; never Sonnet above `medium`.** Do not create an `xhigh` or `max` agent variant, and retire any that exists. When `high` is not enough, the problem is the prompt, the unit size, or the context the agent was handed — not the effort setting.

The variant pattern still stands in the other direction: an agent variant carrying a **lower** effort pin (e.g. a `coder-low.md`) is the sanctioned way to test a cheaper configuration, created on evidence and retired or promoted by measurement.

### Triggers for `high`

Pick a `high` agent over a `medium` one when ANY a-priori trigger fires:

*Complexity (a priori):*
- Cross-cutting or multi-file architectural change
- Novel algorithm, or subtle state/concurrency/correctness reasoning
- Spec requires translation or decomposition, not transcription

*Value / blast radius (a priori):*
- Security-sensitive surface (auth, secrets, injection paths)
- Data-integrity or migration logic
- Artifact published under the user's name

*Observed quality (reactive):* effort cannot change per dispatch (§ Every agent pins both), so a
reactive raise re-dispatches the work one tier up: `intern` → `employee` → `principal`.
- Fix-loop iteration ≥ 2 on the same step → re-dispatch that step and its later iterations one tier up
- The same FINDING recurs across iterations → re-dispatch one tier up
- A verifier/reviewer verdict looks shallow (rubber-stamp, no file/line refs, missed a known issue) → re-dispatch **only that agent**, unchanged; a shallow verdict that survives the re-run is evidence for raising that agent's `effort:` pin one step, a file edit the user reviews

## Every agent pins both, always

**Each agent file carries an explicit `model:` naming a model *version*, and an explicit `effort:`.** No agent inherits either one, and no agent names a bare alias.

| Write | Not |
|---|---|
| `model: claude-opus-5-5` | `model: opus`, `model: inherit`, `model: claude-opus-5` |
| `model: claude-sonnet-5-5` | `model: sonnet`, `model: claude-sonnet-5` |
| `model: claude-haiku-4-5` | `model: haiku` |
| `effort: medium` | omitting `effort:` to inherit |

A Haiku agent pins `effort: medium` too. Haiku 4.5 does not support effort, so the pin is inert
today; it is in place for the day the Haiku pin moves to a model that reads it.

An alias re-points when Anthropic ships the next generation, and an inherited effort changes the moment someone edits `effortLevel` in `settings.json`; either one moves a tuned agent to a configuration nobody chose. Pin agents whose tier equals today's session default too — the point is that the value cannot drift tomorrow.

`effort` cannot be set per dispatch. The Agent tool takes `model` only, and effort resolves as the agent's own `effort:` frontmatter, else the session default, so frontmatter is the only mechanism that varies effort by role. A dispatch site names a `model` only to override the agent's pin, and never names an effort.

**Skills pin only when they fork.** An inline skill or command sets no `model:`: a skill's pin
switches the session model for the rest of the turn, so it moves the user's session rather than
a sub-agent. A `context: fork` skill runs as a sub-agent and pins a version ID and an explicit
`effort:` exactly like an agent file.

Every pin is revisited when a model generation ships or retires, or when the benchmark publishes new rows. [Refreshing the DeepSWE Curve](../claude-code-expert/command-architecture/deepswe-benchmark-refresh.md) is that procedure; a tier change it surfaces is the owner's decision.

## Condensed-copy sites (keep in parity)

| Site | What it carries |
|---|---|
| `commands/verify-all.md` reviewer dispatch | No `model` override, so each reviewer runs at its own pin (`claude-opus-5-5` at `low` for verdict work); a shallow verdict is re-dispatched unchanged once, and one that survives the re-run is evidence for raising that agent's `effort:` pin; the tier-up raises are named and marked inapplicable, since its reviewers have no tier above them and its fixes run in the main session |

`skills/brainstorming/review-loop.md` cites this skill instead of carrying a copy. Add a new copy only when a dispatch site cannot reasonably load this skill, since every copy is one more surface to keep in parity.

**Known divergence.** The build loop (owned by `project-lead`) does not apply the reactive rule above (fix-loop iteration ≥ 2 → one tier up). A fix turn returns to the same coder context, which cannot change its own model or effort mid-run; there is no cap, the count is reported, and a finding that changes a decision goes to the user. `implement-code-methodology`'s `<artifact-convention>` block states the exception.

**Known divergence.** The three copy agents — `copy-drafter`, `copy-persona` and `copy-reviewer` — all pin `claude-opus-5-5` at `medium`, although the published-under-the-user's-name trigger fires for site copy. The owner ruled effort one pin across the whole copy pass: a reviewer at a different tier from the drafter it reviews makes the pass hard to reason about.

**Known divergence.** The generic workers — `intern` (`low`), `employee` (`medium`) and `principal` (`high`) — do not raise to `high` on the a-priori triggers. Security, data-integrity and published-under-the-user's-name work dispatched to a generic worker goes to `employee`. `principal` is reached only on escalation: `employee` came back wrong or shallow on the same work, or one decision binds a whole build or epic and cannot be cheaply redone.

Each known divergence binds its named agents only; the rule stands for every other dispatch site.
