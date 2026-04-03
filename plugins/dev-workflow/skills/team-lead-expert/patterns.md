# Team Composition Patterns

## Pattern 1: Lead + Sequential Coder (Most Common)

Best for plan-based implementations with step dependencies.

```
Lead (you): Orchestrate, verify, track progress
Coder A: Steps 1-5
Coder B: Steps 6-10
Coder C: Fix tasks from verification
```

**Spawn prompt emphasis:** Project skill, spec path, step files, conventions, "read step file for each task."

**Rotation trigger:** After 5-6 tasks, or when coder starts repeating itself / missing feedback.

**Task structure:** Linear with `addBlockedBy` dependencies. One task per plan step.

## Pattern 2: Lead + Parallel Coders (File-Isolated)

Best for independent modules or layers that don't share files.

```
Lead: Orchestrate, resolve cross-cutting issues
Frontend Coder: src/app/, src/components/ (owns all frontend files)
Backend Coder: src/api/, src/services/ (owns all backend files)
Test Coder: tests/ (owns all test files, runs after both coders)
```

**Critical:** Strict file ownership per coder. Overlap = overwrites.

**Task structure:** Parallel batches with cross-batch dependencies.

**Team size:** 3-5 teammates max. Beyond 5, lead context is consumed by coordination.

## Pattern 3: Lead + Review Panel (Parallel Verification)

Best for code review, security audit, or quality gate workflows.

```
Lead: Orchestrate, synthesize findings
Security Reviewer: OWASP checks, auth patterns, injection risks
Performance Reviewer: N+1 queries, memory leaks, bundle size
Coverage Reviewer: Test coverage, edge cases, assertion quality
```

**All reviewers read-only** — spawn with instructions to only read/analyze, not edit files. Or use the `code-verifier` agent type via the Agent tool's `subagent_type` parameter.

**Task structure:** All review tasks parallel (no dependencies). Lead synthesizes.

## Pattern 4: Competing Hypothesis Debugging

Best for complex bugs with multiple possible root causes.

```
Lead: Assign hypotheses, evaluate results
Investigator A: "It's a race condition in the cache layer"
Investigator B: "It's a stale closure in the event handler"
Investigator C: "It's a misconfigured retry policy"
```

Each investigator gets a specific hypothesis + the bug reproduction steps.

**First one to prove/disprove wins.** Lead kills the others.

## Model Mixing for Cost Optimization

Assign models based on task complexity:

| Role | Model | Rationale |
|------|-------|-----------|
| Lead / Orchestrator | Opus | Needs full plan awareness, synthesis |
| Coder (complex steps) | Opus | Architecture decisions, new patterns |
| Coder (simple steps) | Sonnet | Mechanical implementation, test writing |
| Reviewer (read-only) | Sonnet | Analysis, no creative decisions |
| Quick checks | Haiku | Linting, formatting, simple validation |

Set via `model` parameter when spawning agents. Note: model mixing applies to subagents (Agent tool). Teammate model assignment depends on the spawning mechanism — check current Claude Code docs for teammate-specific model selection.

## Delegate Mode

For 4+ teammate teams, enable **delegate mode** (Shift+Tab) to prevent the lead from competing with its own teammates for work. Reduces wasted lead context significantly.

## Anti-Patterns

### Don't: One Coder For Everything
```
❌ Coder A: All 15 steps
   → Context saturates around step 8, confused by step 12
```

### Don't: Parallel Coders On Same Files
```
❌ Coder A: "Add feature to UserService.cs"
   Coder B: "Add tests for UserService.cs"
   → Coder B overwrites Coder A's changes
```

### Don't: Lead Does Implementation
```
❌ Lead: "I'll just do this small fix myself while the coder works"
   → Lead context fills with implementation details, loses plan awareness
   
Exception: Truly trivial changes (< 5 lines) that don't require reading source files
```

### Don't: Broadcast Everything
```
❌ SendMessage to: "*" for every status update
   → Every teammate's context grows with irrelevant messages
   
Use DM (to: "coder") for targeted communication. Broadcast only for team-wide coordination.
```
