---
name: completeness-verification
description: "Structural completeness methodology with 11 named fingerprints for plan conformance, stub and deferral detection, and unbacked claims. Use when verifying implementation matches a plan, auditing acceptance criteria, or running a completeness gate — even for small changes."
---

# Completeness Verification

Checks an implementation against its plan and for stubs, deferrals and unbacked claims. Code
quality, naming, security, domain patterns and semantic correctness are `code-verifier`'s.

## Modes

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

Run fingerprints 7-10 on all changed files, with or without a plan. Patterns 7-9 are found by
grep; 10's shapes by reading the changed code.

| # | Fingerprint | Check | FAIL condition |
|---|------------|-------|----------------|
| 7 | STUB-MARKER | No TODO/FIXME/HACK/XXX in changed files | Pattern found in changed file |
| 8 | DEFERRAL-LANGUAGE | No deferral phrases in changed files | "TBD", "for now", "phase 2", "skip for now", "will add", "later:", "next iteration", "future:", "deferred", "out of scope for now" found |
| 9 | TRUNCATION | No truncation patterns in changed files | `// ...`, `// rest of code`, `// rest of the code`, `/* ... */`, `// implement here`, `// similar to above`, `// continue pattern`, `// add more as needed`, `// same as above`, `// repeat for`, or a bare `...` standing in for omitted code found |
| 10 | STRUCTURAL-SHORTCUT | No placeholder implementations | `throw new Error('Not implemented')`, `throw new Error("Not implemented")`, `NotImplementedException`, `NotImplementedError`, `unimplemented!()`, `todo!()`, `raise NotImplementedError`, or `enabled: false` holding a feature's place found; or a shape: a signature with a comment and no logic, a body that only passes, returns or throws, first and last cases with the middle skipped, one instance plus "repeat for the rest", prose describing code instead of the code, error or edge-case handling left for later |

### Claim Mode (always runs)

| # | Fingerprint | Check | FAIL condition |
|---|------------|-------|----------------|
| 11 | UNBACKED-CLAIM | Every negative claim the implementation summary makes ("no callers remain", "nothing else uses it", "not reachable") rests on a check over the whole population, and every disclosure of unverified work ("not tested", "manual sanity check only", "logically sound") is backed by evidence | A negative claim rests on a sample, or a disclosure stands with no evidence behind it |

The same bar holds for your own report: before writing that something is absent, unreachable or
not a problem, check every file or domain it could be in, never a sample of them.

## Superseded Steps

Steps with status containing "SUPERSEDED" are skipped entirely — not checked, not reported. Match pattern: `COMPLETED` followed by `SUPERSEDED by` in the step's status field or progress table.

## Verdict Determination

**COMPLETE** = all fingerprints PASS (or only plan-mode fingerprints skipped for want of a plan).
**INCOMPLETE** = any fingerprint FAIL.

Output format is owned by the dispatching agent's contract.

## Workflow

1. Read plan step files provided in the dispatch prompt
2. Extract: affected files (create/modify lists), acceptance criteria checkboxes, step statuses
3. Filter out superseded steps
4. Compare affected files against changed file list (fingerprints 1-2, 4-5)
5. Check criteria status for completed steps (fingerprint 3)
6. Check for skipped steps (fingerprint 6)
7. Grep changed files for stub patterns (fingerprints 7-9) and read them for the shapes fingerprint 10 names
8. Check each negative claim and disclosure in the implementation summary against the whole population (fingerprint 11)
9. Compile report with per-fingerprint PASS/FAIL
10. Determine the verdict per `## Verdict Determination` above and report the per-fingerprint results to the dispatching agent

## No-Plan Fallback

When no plan path is provided, skip fingerprints 1-6 entirely. Run stub detection (7-10) and the claim check (11). Report: "No plan provided — stub and claim checks only."

## Anti-Patterns

- Judge structural completeness only, against the plan lists and the patterns and shapes named here; code quality and intended behavior belong to `code-verifier`
- Report patterns in changed files only
- Return COMPLETE or INCOMPLETE, never a qualified verdict such as "mostly complete"
