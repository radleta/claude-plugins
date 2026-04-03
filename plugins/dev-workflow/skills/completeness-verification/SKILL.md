---
name: completeness-verification
description: "Structural completeness methodology with 10 named fingerprints for plan conformance and stub detection. Use when verifying implementation matches a plan, auditing acceptance criteria, detecting structural drift, checking for stubs and deferred work, or running completeness gates — even for small changes."
---

<role>
  <identity>Structural completeness auditor methodology</identity>
  <purpose>Provide the checklist, fingerprints, and output format for verifying implementation completeness against a plan</purpose>
  <scope>
    <in-scope>Plan file-list conformance, acceptance criteria audit, stub/deferral detection, structural drift</in-scope>
    <out-of-scope>Code quality, naming style, security, domain patterns, semantic correctness (code-verifier handles these)</out-of-scope>
  </scope>
</role>

## Two Modes

### Plan Mode (plan path provided)

Run fingerprints 1-6 when a plan path is provided. Read plan step files, extract affected files and acceptance criteria, then compare against the actual implementation.

| # | Fingerprint | Check | FAIL condition |
|---|------------|-------|----------------|
| 1 | STRUCTURAL-DRIFT | Every file in plan "Affected Files" appears in changed files | Plan file missing from diff with no documented deviation |
| 2 | UNEXPECTED-FILE | No changed files absent from all plan steps | File in diff not in any plan step's affected files |
| 3 | UNCHECKED-CRITERIA | Completed step acceptance criteria checkboxes are checked | Step marked completed but all criteria are `- [ ]` (zero checked) |
| 4 | MISSING-FILE | Files plan says to "create" actually exist on disk | Expected file does not exist |
| 5 | UNMODIFIED-FILE | Files plan says to "modify" have actual changes | File in plan's modify list has no diff |
| 6 | SKIPPED-STEP | Every non-superseded plan step has corresponding changes | Step has zero files touched and zero criteria addressed |

**Documented Deviations:** For fingerprints 1 and 2, check whether the deviation is documented in the implementation summary. Undocumented deviations are reported as `UNDOCUMENTED-DEVIATION` (sub-fingerprint).

### Stub Mode (always runs)

Run fingerprints 7-10 on all changed files, with or without a plan.

| # | Fingerprint | Check | FAIL condition |
|---|------------|-------|----------------|
| 7 | STUB-MARKER | No TODO/FIXME/HACK/XXX in changed files | Pattern found in changed file |
| 8 | DEFERRAL-LANGUAGE | No deferral phrases in changed files | "TBD", "for now", "phase 2", "skip for now", "will add", "later:", "next iteration", "future:", "deferred", "out of scope for now" found |
| 9 | TRUNCATION | No truncation patterns in changed files | `// ...`, `// rest of code`, `/* ... */`, `// implement here`, `// similar to above`, `// continue pattern`, `// add more as needed`, `// same as above`, `// repeat for` found |
| 10 | STRUCTURAL-SHORTCUT | No placeholder implementations | `throw new Error('Not implemented')`, `throw new Error("Not implemented")`, `NotImplementedException`, `NotImplementedError`, `unimplemented!()`, `todo!()`, `raise NotImplementedError` found |

## Superseded Steps

Steps with status containing "SUPERSEDED" are skipped entirely — not checked, not reported. Match pattern: `COMPLETED` followed by `SUPERSEDED by` in the step's status field or progress table.

## Status Protocol

The **first line** of output MUST be the verdict in this exact format:

```
**Verdict:** COMPLETE
```
or
```
**Verdict:** INCOMPLETE
```

Callers parse this line to determine gate pass/fail. No other text before the verdict.

**COMPLETE** = all fingerprints PASS (or only plan-mode fingerprints skipped due to no plan).
**INCOMPLETE** = any fingerprint FAIL.

## Output Format

```
**Verdict:** COMPLETE | INCOMPLETE

## Completeness Verification Report

### Plan Conformance (if plan provided)
| # | Fingerprint | Status | Details |
|---|------------|--------|---------|
| 1 | STRUCTURAL-DRIFT | PASS/FAIL | [specifics] |
| 2 | UNEXPECTED-FILE | PASS/FAIL | [specifics] |
| 3 | UNCHECKED-CRITERIA | PASS/FAIL | [specifics] |
| 4 | MISSING-FILE | PASS/FAIL | [specifics] |
| 5 | UNMODIFIED-FILE | PASS/FAIL | [specifics] |
| 6 | SKIPPED-STEP | PASS/FAIL | [specifics] |

### Stub Detection
| # | Fingerprint | Status | Details |
|---|------------|--------|---------|
| 7 | STUB-MARKER | PASS/FAIL | [file:line if found] |
| 8 | DEFERRAL-LANGUAGE | PASS/FAIL | [file:line if found] |
| 9 | TRUNCATION | PASS/FAIL | [file:line if found] |
| 10 | STRUCTURAL-SHORTCUT | PASS/FAIL | [file:line if found] |

### Summary
**Blocking Issues:** [count]
**Gate Signal:** COMPLETE — proceed to code review | INCOMPLETE — return to implementation
```

## Workflow

1. Read plan step files provided in the dispatch prompt
2. Extract: affected files (create/modify lists), acceptance criteria checkboxes, step statuses
3. Filter out superseded steps
4. Compare affected files against changed file list (fingerprints 1-2, 4-5)
5. Check criteria status for completed steps (fingerprint 3)
6. Check for skipped steps (fingerprint 6)
7. Grep changed files for stub patterns (fingerprints 7-10)
8. Compile report with per-fingerprint PASS/FAIL
9. Output verdict as first line, then full report

## No-Plan Fallback

When no plan path is provided, skip fingerprints 1-6 entirely. Run only stub detection (7-10). Report: "No plan provided — stub detection only."

## Anti-Patterns

- Do NOT judge code quality — only check structural completeness
- Do NOT flag pre-existing patterns in unchanged files
- Do NOT interpret "what the code should do" — only check against plan lists and grep patterns
- Do NOT hedge the verdict — COMPLETE or INCOMPLETE, no "mostly complete"
