# Pattern Category 4: Validation & Acceptance Criteria

### Pattern 8: Vague vs Specific Validation

**Before:**
```markdown
Ensure the component is high quality.
```

**After:**
```markdown
**Acceptance Criteria (Component Quality):**

<acceptance-criteria category="component-quality">
  <criterion id="cq-001" priority="critical">
    Component file exists at correct location (per investigation findings)
  </criterion>

  <criterion id="cq-002" priority="critical">
    File naming follows project convention (per investigation findings)
  </criterion>

  <criterion id="cq-003" priority="high">
    Component has TypeScript props interface (if TypeScript project)
  </criterion>

  <criterion id="cq-004" priority="high">
    All props documented with JSDoc including type and purpose
  </criterion>

  <criterion id="cq-005" priority="high">
    Component exported correctly (default or named per project convention)
  </criterion>

  <criterion id="cq-006" priority="critical">
    Linter passes with zero errors or warnings
  </criterion>

  <criterion id="cq-007" priority="high">
    TypeScript compiles with zero errors (if TypeScript project)
  </criterion>

  <criterion id="cq-008" priority="medium">
    Component has docstring describing purpose and usage
  </criterion>

  <criterion id="cq-009" priority="high">
    Test file exists at expected location (per investigation findings)
  </criterion>

  <criterion id="cq-010" priority="critical">
    All tests pass
  </criterion>

  <criterion id="cq-011" priority="high">
    Test coverage ≥ 80% (or project standard per investigation)
  </criterion>
</acceptance-criteria>

**Validation Method:**
1. Run: npm run lint (or discovered command)
2. Run: tsc --noEmit (if TypeScript)
3. Run: npm test (or discovered command)
4. Run: npm test -- --coverage (check percentage)
5. Manual review: Check criteria 1-5, 8
```

**Why Better:**
- 11 specific, measurable criteria
- Prioritized (critical, high, medium)
- References investigation findings
- Validation method provided
- Each criterion verifiable (yes/no)

---

### Pattern 9: Quantitative vs Qualitative

**Before:**
```markdown
- Good test coverage
- Sufficient documentation
- Fast enough performance
```

**After:**
```markdown
- Test coverage ≥ 80% (or project standard from investigation)
  - Run: npm test -- --coverage
  - Verify: Coverage report shows ≥ 80% for lines, branches, functions

- Documentation complete:
  - All exported functions have docstrings (100% coverage)
  - Each docstring includes: purpose (1-2 sentences), params (all), returns, example (for non-trivial)
  - README.md updated (if public API changed)
  - CHANGELOG.md entry added

- Performance acceptable:
  - Component render time < 16ms (60fps)
  - Initial load time < 200ms
  - Bundle size increase < 50KB gzipped
  - Measure: Use React DevTools Profiler or performance.measure()
```

**Why Better:**
- Specific numbers (80%, 16ms, 200ms, 50KB)
- Measurable criteria
- How to measure specified
- No ambiguity

---
