# Combinatorial Completeness Reviewer Dispatch Prompt

Dispatched via the `combinatorial-completeness-reviewer` agent at spec-review time. Read-only; persists its verdict through `mcp__scratch-memory__write_review`.

**Parameters:**
- `{ARTIFACT_PATH}` — absolute path to the spec.md under review
- `{PROJECT_NAME}` — scratch project name
- `{ITER}` — iteration counter (1-based)
- `{PRIOR_COMBINATORIAL_PATHS}` — list of prior ISSUES_FOUND verdict paths for this reviewer (inject via `## Your Prior Verdicts`)

```
Agent({
  subagent_type: "combinatorial-completeness-reviewer",
  description: "Combinatorial completeness iter-{ITER}",
  prompt: |
    Contract lives in your system prompt — inputs follow.

    ## Inputs
    - phase: spec
    - artifact_path: {ARTIFACT_PATH}
    - project: {PROJECT_NAME}
    - iteration: {ITER}

    ## Your Prior Verdicts (iteration 2+ only — read these first)
    You previously reviewed this artifact and flagged issues. Read each prior verdict
    to remember what YOU raised:
    {one bullet per path in PRIOR_COMBINATORIAL_PATHS, in iteration order}
    (Omit this block entirely on iter 1 — no prior verdicts exist.)

    ## Step 1: Read the spec in full
    Use the Read tool on artifact_path.

    ## Step 2: Absent-artifact behavior
    When no State Matrix, Decision Table, Method Contracts, or Invariants are present
    in the spec, return APPROVED with no findings. Do not proceed to Step 3.

    ## Step 3: Apply the six check classes

    **Check class 1 — Empty cells**
    Every cell in every State Matrix and Decision Table must be populated.
    An empty cell (blank, dash-only, or "TBD") is ISSUES_FOUND.

    **Check class 2 — Contradictory rows**
    No two rows in a Decision Table or State Matrix may share identical condition
    columns but differ in outcome columns, unless explicit priority ordering resolves
    the conflict. Contradictory rows without priority ordering are ISSUES_FOUND.

    **Check class 3 — Missing rows**
    Every state/event combination or condition combination mentioned in prose or
    implied by the state set must appear as a table row. A missing row is ISSUES_FOUND.

    **Check class 4 — Examples-vs-contracts violations**
    For each Method Contract + Examples pair, every example's input/output must satisfy
    the contract's `requires` and `ensures` clauses. A violation is ISSUES_FOUND.

    **Check class 5 — Invariants-vs-transitions breaks**
    For each State Matrix transition, if spec Invariants asserts a property, the
    transition must preserve it — or the spec must explicitly document the exception.
    A break without documented exception is ISSUES_FOUND.

    **Check class 6 — Reachable-state closure**
    BFS-walk all transitions via prose reasoning from the designated start state.
    - Matrices ≤20 rows: any state unreachable from the start state is ISSUES_FOUND.
    - Matrices >20 rows: return APPROVED and include an Implementation Note:
      "matrix size exceeds heuristic confidence — reachability check skipped"
      (advisory only; does not contribute to ISSUES_FOUND).

    ## Calibration

    Check classes 1–5 apply to any spec containing the relevant artifact types.
    Check class 6 (reachable-state closure) is heuristic and advisory for large matrices.
    Do NOT check document quality, codebase alignment, or decision traceability —
    other reviewers handle those.
})
```

**Reviewer returns (to main session):** two lines — `Wrote:` and `Status:`.
