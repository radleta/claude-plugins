# Community Patterns

Novel approaches and patterns discovered by the Claude Code community.

## Forced-Eval Hooks for Activation Reliability

**Source**: [scottspence.com](https://scottspence.com/posts/how-to-make-claude-code-skills-activate-reliably) (200+ tests)

Without hooks, skills auto-activate at only ~20%. A "forced-eval" hook achieves **84% activation rate** by requiring Claude to explicitly state YES/NO reasoning for each skill before proceeding.

| Approach | Activation Rate | Notes |
|----------|----------------|-------|
| No hook (baseline) | ~20% | Claude often skips skills |
| Simple instruction | 20% | Fails at multi-skill tasks |
| LLM eval hook | 80% | Can fail on complex prompts |
| Forced eval hook | 84% | Most consistent, never completely failed |

**Key insight**: The difference is whether Claude *acknowledges* instructions passively versus *commits* to them through explicit evaluation steps.

## File-Path-Based Skill Triggering

**Source**: [paddo.dev](https://paddo.dev/blog/claude-skills-hooks-solution/)

Deterministic triggering based on which files are being edited, using a `skill-rules.json`:

```json
{
  "backend-dev-guidelines": {
    "fileTriggers": {
      "pathPatterns": ["src/**/*.ts", "backend/**/*.ts"]
    }
  }
}
```

**Strengths**: Deterministic, progressive disclosure, reduced token overhead.
**Limitations**: Cannot trigger during planning (no files open), cannot prevent activation on simple fixes.

## Auto-Generated Skills from Conversations

**Source**: [Sionic AI](https://huggingface.co/blog/sionic-ai/claude-code-skills-training) (1,000+ ML experiments/day)

A `/retrospective` command that:
1. Reads the conversation after a session
2. Extracts insights (what worked, what failed, workarounds)
3. Structures them into a SKILL.md file
4. Creates a git branch, commits, pushes, and opens a PR to a team skill registry

**Key insight on descriptions**: Specific trigger conditions naming exact error messages and model names work better than general terms.
- Bad: `"pruning experiments"`
- Good: `"GRPO training with external vLLM server, vllm_skip_weight_sync errors"`

**On failure documentation**: "The hard part of knowledge management has never been storage. It's getting people to write things down."

## TDD Enforcement Pattern

**Source**: [Obra Superpowers](https://github.com/obra/superpowers)

A skill that enforces RED-GREEN-REFACTOR by making Claude delete code written before tests. Three-command workflow:
1. `/superpowers:brainstorm` — Explores alternatives before coding
2. `/superpowers:write-plan` — Breaks work into 2-5 minute tasks
3. `/superpowers:execute-plan` — Dispatches tasks to subagents with code review

## Gemini CLI as Fallback Web Access

**Source**: [ykdojo/claude-code-tips](https://github.com/ykdojo/claude-code-tips)

A skill that uses Gemini CLI as a fallback for web content Claude cannot access, coordinated via tmux.

## MCP Tool Lazy-Loading

Set `ENABLE_TOOL_SEARCH` in `settings.json` for on-demand MCP tool loading, achieving 85% context reduction for tool descriptions.

## The Controllability Problem

**Source**: [paddo.dev](https://paddo.dev/blog/claude-skills-controllability-problem/)

Skills are designed to activate autonomously, but in practice "without proper hooks, skills just sit there collecting dust whilst Claude bypasses them." Consider hooks for critical skills that must activate reliably.
