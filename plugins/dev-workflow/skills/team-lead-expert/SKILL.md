---
name: team-lead-expert
description: "Battle-tested patterns for orchestrating Claude Code agent teams — teammate rotation, verification pipelining, task decomposition, context management, and error recovery. Use when creating teams, spawning teammates, managing multi-agent workflows, debugging stuck teammates, or planning team-based implementations — even for small 2-agent setups."
---

<role>
  <identity>Expert in Claude Code agent team orchestration</identity>
  <purpose>Guide team leads through reliable multi-agent workflows using validated patterns from real-world team executions and community best practices</purpose>
  <expertise>
    <area>Team composition and teammate spawning</area>
    <area>Task decomposition with file-boundary isolation</area>
    <area>Verification pipelining (verify behind the coder)</area>
    <area>Teammate rotation and context management</area>
    <area>Feedback delivery that survives idle/wake cycles</area>
    <area>Error recovery and stalled teammate detection</area>
  </expertise>
  <scope>
    <in-scope>
      <item>Team creation and lifecycle management</item>
      <item>Teammate spawning, briefing, and rotation</item>
      <item>Task list design with dependencies</item>
      <item>Verification and review workflows</item>
      <item>Communication patterns (DM, broadcast, step files)</item>
      <item>Debugging stuck or confused teammates</item>
    </in-scope>
    <out-of-scope>
      <item>Subagent (Agent tool) patterns without teams — use agent-expert instead</item>
      <item>Skill/agent file creation — use claude-skill-builder or claude-agent-builder</item>
      <item>Plan creation — use plan-expert</item>
    </out-of-scope>
  </scope>
</role>

## When to Use Teams vs Subagents vs Solo

| Approach | Use When | Avoid When |
|----------|----------|------------|
| **Solo agent** | < 5 steps, tight feedback loops, design-as-you-go | Context would overflow reading all source files |
| **Subagents** | Isolated tasks (research, verification), no inter-agent communication needed | Tasks need to share findings or coordinate |
| **Agent teams** | 5+ step plans, file-heavy implementation, need verification pipelining | < 3 steps, single-file changes, strict sequential work |

**The team lead pattern:** You orchestrate the plan, track progress, dispatch verification agents, and send feedback. A coder teammate does all implementation. Your context stays clean for the full plan lifecycle.

## Before You Create a Team

Assess whether a team is warranted:

- [ ] Plan has 5+ implementation steps?
- [ ] Steps require reading 100+ lines of existing code each?
- [ ] A spec or detailed step files exist for the coder to follow?
- [ ] Files can be isolated per teammate (no overlapping edits)?
- [ ] The 3-4x token cost is justified by context isolation benefit?

If fewer than 3 boxes checked, use solo agent or subagents instead. Teams add coordination overhead that only pays off with sufficient scale.

## The 5 Rules

### 1. Rotate Teammates Every 5-6 Tasks

Teammates accumulate context (file reads, diffs, messages) that fills their window. After ~6 tasks, reliability degrades — they repeat themselves, lose track of the task list, or miss feedback.

```
Plan: 12 steps

Coder A: Steps 1-6 (scaffold → core implementation)
  └── Shutdown after Step 6 verified

Coder B: Steps 7-11 (integration → tests)
  └── Shutdown after Step 11 verified

Coder C: Fix tasks from verification (fresh eyes)
  └── Shutdown when clean
```

**Spawn prompt for rotation:** Include what was completed, what files were changed, and what the next batch needs. The new teammate gets clean context loaded only with CLAUDE.md + your spawn prompt.

### 2. Feedback Goes in Step Files, Not Messages

Messages are lossy — they get buried during implementation bursts and lost across idle/wake cycles. Step files persist on disk and are the coder's native interface.

```
Verifier finds issue
  → Write scratch/{project}/steps/NN-fix-name.md (actions + acceptance criteria)
  → TaskCreate pointing to step file
  → SendMessage: "Read step file at scratch/.../steps/NN-fix-name.md"
```

**Never** send inline code fixes via SendMessage alone. The coder will drop them.

### 3. Idle Notifications Are Not Signals

Idle notifications fire between every turn — even when a teammate is actively working on a multi-turn task. They mean "turn ended," not "work ended."

- **Do NOT** send "are you stuck?" messages in response to idle
- **Do NOT** re-direct a teammate based on idle alone
- **Wait** for explicit "Task #N complete" messages before reacting
- **Only** use idle as an opportunity to assign NEW work

### 4. Isolate Files Per Teammate

Two teammates editing the same file causes overwrites. Break work by file/directory ownership.

```
Coder A: src/MyApp.Core/    (models, interfaces)
Coder B: src/MyApp.Api/     (controllers, middleware)
Coder C: tests/             (all test projects)
```

For sequential plans where each step builds on the previous, use ONE coder (with rotation) rather than parallel coders.

### 5. Pipeline Verification Behind the Coder

Don't block the coder for verification. Dispatch read-only verifier agents in the background while the coder continues to the next step.

```
Coder:    Step 3 ──→ Step 4 ──→ Step 5 ──→ Step 6
Verifier:      ↗ Verify 3    ↗ Verify 4-5    ↗ ...
Lead:     Dispatch    Review    Send fixes
```

If a verifier finds issues, write step files (Rule 2) and create tasks. The coder picks them up after the current batch.

## Team Setup Checklist

- [ ] Create team: `TeamCreate` with descriptive name
- [ ] Create ALL tasks upfront with `TaskCreate` (one per plan step)
- [ ] Set dependencies with `TaskUpdate.addBlockedBy`
- [ ] Assign first task to coder with `TaskUpdate.owner`
- [ ] Spawn coder with rich spawn prompt:
  - Project context (what skill to load, key files)
  - Task instructions (read step files, mark complete via TaskUpdate, check TaskList for next)
  - Convention summary (language, style, test framework)
- [ ] Plan rotation points (every 5-6 tasks)

## Spawn Prompt Template

```
You are the implementation coder for the "{team-name}" team.

## Your Role
- Implement code changes assigned via the task list
- After completing each task: mark completed (TaskUpdate), check TaskList for next work
- If blocked: message the team lead

## Project Context
{1-2 sentences about the project}

Load `{project-skill}` skill via Skill tool for full project knowledge.

## Key Files
- {spec/plan path} — the full specification
- {research path} — codebase patterns (if exists)
- Step files in {steps path} — read the step file for your current task

## Conventions
- {language/framework}
- {test framework}
- {key patterns to follow}

## Your First Task
Task #{N}: {subject}. Read {step file path} for full details.

After each task: run build + tests, mark complete, check TaskList.
```

## Verification Dispatch Template

```
Verify Step {N} of the {project} project.

What was built: {summary}

Files to check:
- {file paths}

Verify against spec at {spec path} — specifically:
{numbered requirements to check}

Also check: {cross-cutting concerns — column parity, DI registration, error handling}

Report issues found.
```

## Error Recovery

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Coder reports same task done repeatedly | Context saturation after 6+ tasks | Rotate: shutdown and spawn fresh coder |
| Coder doesn't pick up fix tasks | Message lost during implementation burst | Create TaskCreate + write step file + re-send |
| Coder goes idle and doesn't respond | Between turns (normal) OR context maxed | Wait 1-2 minutes. If no progress, send explicit "TaskList → work on Task #N" |
| Verifier returns empty output | Subagent stalled or timed out | Do a manual spot-check (read 2-3 key files), re-dispatch verifier if needed |
| DI or build errors after teammate changes | Teammate made incorrect assumption | Send specific error message + file:line, or fix directly if small |

## Known Limitations

| Limitation | Impact | Workaround |
|-----------|--------|------------|
| Lead context compaction loses team awareness ([#23620](https://github.com/anthropics/claude-code/issues/23620)) | Lead can't message teammates after compaction | Keep lead context lean; checkpoint state in files |
| No /resume for teammates | Session restart loses all teammates | Accept — keep work checkpointed in files on disk |
| Can't distinguish idle vs dead ([#29271](https://github.com/anthropics/claude-code/issues/29271)) | May send messages to dead teammates | Wait for completion messages, not idle |
| No persistent shared channel ([#30140](https://github.com/anthropics/claude-code/issues/30140)) | Messages are ephemeral | Use step files + task list as persistent shared state |
| 3-4x token cost vs solo | Expensive for small tasks | Only use teams for 5+ step plans where coordination benefit justifies cost |
| Split-pane not on Windows Terminal | Limited to in-process mode | Use in-process mode (works everywhere) |
| Custom agents can't be teammates ([#24316](https://github.com/anthropics/claude-code/issues/24316)) | Specialize via spawn prompts only | Rich spawn prompts with skill loading instructions |

## Cost-Benefit Summary

| Aspect | Benefit | Cost |
|--------|---------|------|
| Context isolation | Lead stays clean for full plan lifecycle | Initial briefing tokens (~500-1000) |
| Verification pipelining | Parallel work, no blocking | Late feedback → fix tasks accumulate |
| Coder autonomy | 10+ steps with minimal direction | Front-loading investment in step files |
| Teammate rotation | Fresh context for each batch | Rotation overhead (~2 min per swap) |
| Follow-up fixes | — | High coordination cost if coder is saturated |

## File Loading Protocol

<loading-decision>
  <file path="patterns.md">
    <load-when>Need detailed team composition examples or advanced patterns (parallel review teams, competing hypothesis debugging, full-stack feature teams)</load-when>
    <provides>Proven team compositions with spawn prompts, task structures, and rotation strategies</provides>
  </file>
</loading-decision>
