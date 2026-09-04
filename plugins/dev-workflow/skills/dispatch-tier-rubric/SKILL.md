---
name: dispatch-tier-rubric
description: "Normative complexity/value rubric for choosing a sub-agent's model and effort at dispatch time, with reactive escalation triggers. Use when authoring or editing any command/skill that dispatches agents via the Agent tool, or when deciding a dispatch tier in an orchestrator — even when the dispatch site already carries a condensed copy of the rules."
---

# Dispatch Tier Rubric

The single normative copy of the tier-selection rules. Orchestrating commands and skills inline a **condensed copy** at each dispatch site (hot-path, no skill load at runtime) with a parity pointer back here — the same inline-mechanics/reference-skill split `handoff-methodology` uses. Edit here first, then sync the condensed copies.

## The model is settled; the lever is `effort`

**Dispatch at opus unless the haiku test below passes.** On the deepswe agentic
coding benchmark every Sonnet configuration is strictly dominated by some Opus
configuration on all three axes at once — pass@1, cost, and steps. `opus[low]`
scores 58 % at $1.66 and 36 steps; `sonnet-5[max]` scores 54 % at $26.40 and 268
steps. There is no task shape where reaching for sonnet over opus is the better
trade, so "escalate to opus" is no longer a decision — it is the floor.

That leaves `effort` as the only lever worth pulling, and its frontier ends at
`high`:

| Step | Δ pass@1 | Δ cost | Δ steps | Verdict |
|---|---|---|---|---|
| low → medium | +11 | +98 % | +44 % | Cheapest quality on the curve |
| medium → high | +4 | +85 % | +40 % | Buy it when a trigger fires |
| high → xhigh | **0** | +49 % | +22 % | **Never** — no measurable gain |
| xhigh → max | +1, inside the error bars | +31 % | +11 % | **Never** |

Steps are wall clock. Per-turn latency measures flat across models in this repo
(~8 s thinking+TTFT on every model), so a configuration that takes twice the
steps takes roughly twice the time.

`effort` cannot be set per dispatch. The Agent tool takes `model` only, and
effort resolves as: the agent's own `effort:` frontmatter, else the session
default. Frontmatter is therefore the only mechanism that varies effort by role.

## Every agent pins both, always

**Each agent file carries an explicit `model:` naming a model *version*, and an
explicit `effort:`.** No agent inherits either one, and no agent names a bare
alias.

| Write | Not |
|---|---|
| `model: claude-opus-5` | `model: opus`, `model: inherit` |
| `model: claude-sonnet-5` | `model: sonnet` |
| `model: claude-haiku-4-5` | `model: haiku` |
| `effort: medium` | omitting `effort:` to inherit |

An alias re-points when Anthropic ships the next generation, and an inherited
effort changes the moment someone edits `effortLevel` in `settings.json`. Either
one moves a tuned agent to a configuration nobody chose. Pinning both makes the
change explicit: the numbers move only when a human edits the file.

This includes agents whose tier happens to equal the current session default —
pin them anyway. The point is not the value today, it is that the value cannot
drift tomorrow.

The cost is a re-sweep surface: every pin has to be revisited when a model
generation retires or new benchmark data lands. That is the intended trade, and
the mechanism against fossilization is a standing re-sweep task, not a ban on
pinning. Supersedes the earlier no-`effort`-pin rule outright.

Evidence: `scratch/claude-5-slowness/findings-2026-08-27-wiki-health-fixes-build.md`
(deepswe frontier, and the measured build it reconciles against). Supersedes the
claude-code-ref-expert wiki page `effort-pin-fossilization`, whose benchmark
compared models rather than efforts.

## The rubric (quality-leaning: ties break upward)

**Default: `claude-opus-5` at `medium`.** Standard implementation, review,
research, and doc work. This is the value knee — 93 % of the quality at 28 % of
the cost of `max`, and half its steps.

**`claude-opus-5` at `low`** — read-and-judge work whose output is a verdict
rather than a diff: reviewer and verifier gates, alignment checks, doc-quality
passes. Still outscores every Sonnet configuration at any effort.

**`claude-haiku-4-5` at `medium`** — only when BOTH hold: the work is
mechanical/deterministic (checkbox updates, scaffold-from-template, single-cell
or row edits, format conversions) AND its output is independently verified
downstream. Never for judgment work; never for the coder role. The frontier above
does not measure this class of task, so the tier stands on the old reasoning.

**`claude-sonnet-5` at `medium`** — only where a documented per-agent cost
constraint outweighs the frontier, and only at `medium`. Today that is
`chrome-browser` alone, whose browser traffic makes token volume the binding
constraint rather than pass@1. Both its MCPs are heavy — chrome-devtools
snapshots, and claude-in-chrome runs measured at 51k-340k tokens.
Above `medium` is a trap on Sonnet: the
data shows `sonnet-5[xhigh]` at 186 steps and `[max]` at 268, for 50 % and 54 %
pass@1 — more than triple `opus[medium]`'s steps to score worse.

**`claude-opus-5` at `high`** — raise effort from `medium` when ANY trigger
fires:

*Complexity (a priori):*
- Cross-cutting or multi-file architectural change
- Novel algorithm, or subtle state/concurrency/correctness reasoning
- Spec requires translation or decomposition, not transcription

*Value / blast radius (a priori):*
- Security-sensitive surface (auth, secrets, injection paths)
- Data-integrity or migration logic
- Artifact published under the user's name

*Observed quality (reactive):*
- Fix-loop iteration ≥ 2 on the same step → raise effort for that and subsequent iterations
- A verifier/reviewer verdict looks shallow (rubber-stamp, no file/line refs, missed a known issue) → re-dispatch **only that agent** one effort step up
- The same FINDING recurs across iterations

## There is no escalation beyond `high`

`xhigh` costs 49 % more than `high` for zero measured pass@1 gain; `max` adds one
point against ±3 and ±4 error bars. **Do not create an `xhigh` or `max` agent
variant**, and retire any that exists. When `high` is not enough, the problem is
the prompt, the unit size, or the context the agent was handed — not the effort
setting.

The variant pattern still stands in the other direction: an agent variant
carrying a **lower** effort pin (e.g. a `coder-low.md`) is the sanctioned way to
test a cheaper configuration, created on evidence and retired or promoted by
measurement.

Sonnet has the same ceiling one step earlier. `sonnet-5` above `medium` buys
nothing that `claude-opus-5` at `medium` does not already beat on all three
axes — never pin `sonnet-5` at `high` or above.

## Condensed-copy sites (keep in parity)

| Site | What it carries |
|---|---|
| `commands/verify-all.md` reviewer dispatch | `claude-opus-5` at `low` for verdict work, plus a-priori and shallow-verdict escalation to `medium` |

A dispatch site names a `model` only when it needs to override the agent's own
pin. It never names an effort, because it cannot.

`commands/implement-code.md` and `skills/brainstorming/SKILL.md` no longer
carry a condensed copy — each cites this skill
instead. Removing a copy removes a surface that has to be kept in parity; add a
new one only when a dispatch site cannot reasonably load this skill.

**Known divergence.** The build loop (owned by `project-lead`) deliberately does
not apply the reactive rule above (fix-loop iteration ≥ 2 → raise effort). A fix
turn returns to the same coder context, which cannot change its own effort
mid-run; there is no cap, the count is reported, and a finding that changes a
decision goes to the user. The rule stands for every other dispatch site.
`implement-code.md`'s `<artifact-convention>` block states the exception.
