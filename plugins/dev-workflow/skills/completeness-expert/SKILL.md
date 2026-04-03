---
name: completeness-expert
description: "Enforces complete output and verification before declaring work done. Use when implementing code, finishing a task, about to claim completion, or wrapping up work — even for quick fixes or single-file changes."
---

# Completeness

## Scope-Locking Protocol

Before coding, count distinct deliverables (files, functions, components, tests). Lock that count — state it explicitly. After implementation, cross-check: does the deliverable count match the locked scope? If anything is missing, implement it before declaring done.

## Banned Output Patterns

Hard failures — never produce these.

**Code truncation:**
`// ...`, `/* ... */`, `// rest of code`, `// rest of the code`, `// implement here`, `// similar to above`, `// same as above`, `// continue pattern`, `// add more as needed`, `// repeat for remaining`, bare `...` standing in for omitted code

**Structural shortcuts:**
- Skeleton instead of full implementation (function signature + comment, no logic)
- First-and-last with middle skipped
- One example + "repeat for remaining N" instead of all N instances
- Describing what code should do instead of writing the actual code
- Empty function/method bodies (only pass/return/throw with no logic)

**Deferred work:**
`// TODO:`, `// FIXME:`, `// HACK:`, `// XXX:`, `// Later:`, `// Phase 2:`, `// For now`, `// TBD`, `// Will add`, `// Next iteration`, `// Future:`, `// Skip for now`, `// Deferred`, `// Out of scope for now`

**Placeholder code:**
`throw new Error('Not implemented')`, `raise NotImplementedError`, `unimplemented!()`, `todo!()`, `enabled: false` (as placeholder for unfinished feature)

## Clean Pause Protocol

When approaching context or token limits:
- Do not compress remaining sections to fit
- Do not skip ahead to a conclusion
- Write at full quality up to a clean breakpoint (end of function, end of file, end of section)
- State what remains and where to resume
- On continuation, pick up exactly where stopped — no recap, no repetition

## Verification Before Completion

Never declare work complete without evidence. "It should work" is not evidence.

| Change Type | Required Verification |
|---|---|
| Code logic/behavior | Execute the code, inspect output. Build passing ≠ behavior correct. |
| UI/visual | Screenshot or visual inspection. Reading code ≠ seeing the result. |
| Config/schema | Validate it loads/parses. Structure looking right ≠ actually loading. |
| Claude Code primitives | Invoke the primitive. Source looking right ≠ working at runtime. |

If verification isn't possible, say so explicitly: "I cannot verify because [reason]. The implementation looks correct but has not been executed." Do not paper over the gap with "this should work."

## Pre-Completion Cross-Check

Before declaring done:
- [ ] Scope-lock count matches actual deliverables
- [ ] No banned patterns anywhere in new/modified code
- [ ] Every function body contains actual logic (not just pass/return/throw)
- [ ] All stated requirements have corresponding implementation
- [ ] Error handling is implemented, not deferred
- [ ] Edge cases are handled, not deferred
- [ ] Output has been verified per the verification matrix above

---

For background on why these rules exist — RLHF brevity bias, training data patterns, and empirical evidence — see [RESEARCH.md](RESEARCH.md). Use Read tool on RESEARCH.md when modifying these rules or need to understand the reasoning behind them.
