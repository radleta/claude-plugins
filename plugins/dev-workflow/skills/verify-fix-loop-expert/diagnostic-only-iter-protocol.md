---
tags: [verify-fix-loop/sub-protocol, iteration-discipline]
summary: "When manual gate reveals ambiguous symptom, iterate with pure diagnostics before shipping behavior changes — preserve the controlled-experiment discipline"
---

# Diagnostic-Only Iteration Protocol

## The Pattern

When a manual verification gate produces a symptom whose root cause spans multiple plausible explanations, and no existing log line would definitively prove which explanation is correct, the next iteration must be diagnostic-only: add instrumentation to reveal the real cause, deploy, re-run the gate, THEN fix in a subsequent iteration.

## Why This Matters

The three-seal gate discipline (verifier gates + manual gate + runtime-diagnostic gate) depends on controlled experiments. Mixing diagnostic instrumentation with behavioral fixes in the same iteration breaks the experiment:
- The next gate either reveals the logs OR confirms your fix, but rarely both cleanly
- If the manual gate still fails, you don't know whether the symptom persists or the instrumentation revealed something unexpected
- You've lost your ability to distinguish signal from change

## The Anti-Pattern

```
Iter N (code fix) → Manual gate fails with ambiguous symptom
  ↓
Iter N+1: "I'll add logging AND try this fix"
  ↓
Next manual gate still unclear (logs show the problem, but the fix also fired)
  ↓
Iter N+2: Try a different fix (now you've burned two iters)
```

The root problem: you added signal (logs) and change (behavior fix) simultaneously, so the gate result doesn't cleanly validate either.

## The Right Pattern

```
Iter N (code fix) → Manual gate fails with ambiguous symptom (e.g., "nothing happens on hover")
  ↓
Iter N+1 (DIAGNOSTIC ONLY):
  - Add heartbeat logs (e.g., 1/sec state dump)
  - Add transition logs (dwell increments, grace corridor entry/exit, form visibility changes)
  - Add null-guard warnings (if config-race suspected)
  - Add bounds-change tracking (if coordinate mismatch suspected)
  - NO behavioral changes
  - Deploy with .dev-build marker → Debug logging enabled
  ↓
Manual gate re-run with instrumentation active
  ↓
Logs definitively show root cause
  ↓
Iter N+2: Targeted fix based on diagnostic evidence
```

## Implementation Checklist

When writing a diagnostic-only iteration:

- [ ] Enumerate the 2–4 most plausible root causes
- [ ] For each, identify what log line would prove or disprove it
- [ ] Add instrumentation for all missing signals (heartbeat, transitions, state dumps, warnings)
- [ ] Use Debug-level logging (gated by `.dev-build` marker so production never pays)
- [ ] Make ZERO behavioral changes (no flag additions, no state-machine tweaks, no data flow changes)
- [ ] Add a code comment: `// DIAGNOSTIC ONLY — iter N+1 — investigate [symptom]`
- [ ] Update monitor/hook logs to show the new instrumentation points
- [ ] Deploy and note in test output: "This iteration is diagnostic only; awaiting gate results"

## Example: Step 03 Iter-5 (Overlay Dashboard)

**Symptom from iter-4 manual gate:** "if i have focus elsewhere, i hover nothing happens"

**Plausible root causes:**
1. DPI coordinate mismatch after desktop switch → hit-test failure
2. Hover hover below dwell threshold → form showed but user didn't notice
3. Null controller from config-race → event fires but handler is null
4. Stale overlay bounds → cursor considered outside hover zone

**Diagnostic instrumentation in iter-5:**
- Heartbeat log (1/sec): current cursor position, `_dwellTicks`, `IsHoverActive`, form visibility
- Transition logs: "dwell tick increment", "grace corridor entry", "form visibility changed"
- Null-guard log: "HoverDashboardController is null" (if constructor race suspected)
- Bounds-change log: "overlay bounds changed" (track screen coordinate drift)

**Result:** When user re-tested, all instrumentation showed normal behavior (dwell incremented, grace corridor active, form showed). Combined with the absence of coordinate-mismatch logs, this suggested the iter-4 fix was correct and the prior symptom was a transient test artifact (brief cursor pass, DPI jitter after desktop switch, etc.).

**Outcome:** No further behavior changes needed. Diagnostic logs now serve as permanent debug aid for future regressions.

## Interaction With Three-Seal Gate

The three-seal gate (verifier + manual + runtime-diagnostic) works best when each seal owns its signal:

1. **Verifier seals** (completeness, quality, security) → code structure and consistency
2. **Manual seal** (user interaction) → functional correctness and UX
3. **Diagnostic seal** (runtime logs) → hidden bugs and state transitions

Diagnostic-only iterations **strengthen** the manual seal by ensuring that when a symptom appears, the runtime logs contain all the evidence needed to pinpoint the cause. This is the bridge between manual observation and code-level debugging.

## When NOT to Use This Protocol

- Symptom has a single obvious cause (e.g., "form doesn't appear and the log says 'config null'") → fix immediately
- Previous iters already added relevant instrumentation → no need to repeat it
- Root cause is architectural (requires code refactoring) → diagnostic logs won't help distinguish options

## Related

- Three-Seal Gate Doctrine (platform-boundary-three-seal-gate.md) — The outer discipline that diagnostic-only iters support
