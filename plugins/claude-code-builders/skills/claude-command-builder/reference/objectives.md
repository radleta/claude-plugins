# Objectives & Success Metrics

> Full measurable outcomes for command creation quality. Referenced from SKILL.md.

## Primary Goal

Create production-quality command files that execute correctly on first attempt.

- **Measurement:** Command loads without errors AND executes as intended with arguments
- **Target:** 100% of created commands pass CRITICAL success criteria (syntax, arguments, permissions)

## Measurable Outcomes

### 1. Syntax Correctness (CRITICAL)

- **Target:** 100% of commands load without YAML parsing errors
- **Test method:** Start new Claude Code session -> check command list
- **Pass threshold:** Command appears in list with zero errors
- **Validation command:** `grep $'\t' file.md | wc -l` (expect: 0)
- **Reference:** @SYNTAX.md lines 341-398 for validation commands

### 2. Argument Functionality (CRITICAL)

- **Target:** 100% argument substitution success rate
- **Test method:** Test with no args, single arg, multiple args
- **Pass threshold:** 3/3 test cases pass with correct substitution
- **Validation command:** `grep '$ARG[^U]' file.md` (expect: no matches)
- **Reference:** @SYNTAX.md lines 137-185 for argument syntax

### 3. Permission Accuracy (CRITICAL)

- **Target:** Tool permissions match user request (not operation type)
- **Test method:** Apply @QUALITY.md decision matrix to user request
- **Pass threshold:** Matches decision matrix result for user's statement
- **Validation decision tree:**
  - IF user said "restrict/limit/only" THEN command has allowed-tools matching request
  - ELSE command omits allowed-tools property
- **Reference:** @QUALITY.md lines 46-73 for decision matrix

### 4. Best Practice Compliance (HIGH)

- **Target:** >=90% validation checklist pass rate
- **Test method:** Run validation checklist items
- **Pass threshold:** passed_items / (critical_items + high_items) >= 0.90
- **Validation checklist:** See protocols/validation-checklist.md
- **Calculation:** Count PASS items, divide by total CRITICAL+HIGH items

### 5. Discoverability (HIGH)

- **Target:** Users understand purpose from description alone
- **Test method:** Check description against 3 measurable criteria
- **Pass threshold:** 3/3 criteria pass (word count + verb + context)
- **Validation criteria:**
  - Word count: 10-50 words (test: `echo "$desc" | wc -w`)
  - Has action verb (test: grep match for verb list)
  - Has domain context (test: grep match for domain keywords)
- **Reference:** @QUALITY.md lines 132-173 for measurable definition

### 6. Reusability (MEDIUM)

- **Target:** Commands work across contexts via arguments
- **Test method:** Search for hard-coded values
- **Pass threshold:** Zero inappropriate hard-coded values found
- **Validation pattern:** grep for numbers, specific names, dates that should be $0 or $ARGUMENTS
- **Examples:**
  - Bad: `PR #123` (should be `PR #$0`)
  - Bad: `User alice` (should be `$0` or `$1`)
  - Good: `PR #$0` (flexible)

## Success Criteria

### 1. Syntax Correctness (CRITICAL)

- **Description:** Loads in Claude Code without errors
- **Test:** Start new Claude Code session and check slash command list
- **Pass condition:** Command appears in list, no YAML parsing errors, no syntax warnings
- **Fail condition:** Command missing from list, YAML errors reported, or syntax warnings shown
- **Measurement:** Binary: PASS if loads, FAIL if any error

### 2. Argument Functionality (CRITICAL)

- **Description:** Executes as intended with arguments
- **Test:** Test command with: no args, single arg, multiple args
- **Pass condition:** All test cases: $ARGUMENTS/$0/$1 substitute correctly, no "undefined variable" errors
- **Fail condition:** Any test case: substitution fails, shows "$ARGUMENTS" literally, or "undefined" errors
- **Measurement:** Pass rate: 3/3 test cases = PASS, <3/3 = FAIL

### 3. Permission Accuracy (CRITICAL)

- **Description:** Tool permissions match user request
- **Test:** Apply @QUALITY.md decision matrix (lines 46-73) to user's original request
- **Pass condition:** If user requested restrictions -> has allowed-tools matching request. If no request -> omitted allowed-tools.
- **Fail condition:** User didn't request restrictions but allowed-tools added, OR user requested but pattern wrong/missing
- **Measurement:** Binary: PASS if matches decision matrix, FAIL if doesn't

### 4. Best Practice Compliance (HIGH)

- **Description:** Passes validation checklist
- **Test:** Run all items from validation checklist (see protocols/validation-checklist.md)
- **Pass condition:** >=90% of CRITICAL+HIGH items pass (calculate: passed/(critical+high) >= 0.90)
- **Fail condition:** <90% pass rate, OR any CRITICAL item fails
- **Measurement:** Percentage: count passed items / total items >= 0.90

### 5. Discoverability (HIGH)

- **Description:** Users understand purpose from description
- **Test:** Read description without seeing command body - can user predict what it does?
- **Pass condition:** Description meets @QUALITY.md standards (10-50 words + action verb + domain context)
- **Fail condition:** Description fails any of the 3 measurable criteria from @QUALITY.md lines 132-173
- **Measurement:** 3/3 criteria = PASS, <3/3 = FAIL

### 6. Reusability (MEDIUM)

- **Description:** Works across contexts via arguments
- **Test:** Check for hard-coded values (PR numbers, usernames, dates, paths)
- **Pass condition:** No hard-coded values, OR hard-coding is intentional for specific-purpose command
- **Fail condition:** Has hard-coded values that should be arguments (e.g., "PR #123" instead of "PR #$0")
- **Measurement:** Binary: PASS if no inappropriate hard-coding, FAIL if found

## Overall Success

- **PRODUCTION-READY:** All CRITICAL + HIGH pass -> Command is production-ready
- **BLOCKED:** Any CRITICAL fails -> Command is blocked, must fix before use
- **USABLE-NEEDS-IMPROVEMENT:** CRITICAL pass but HIGH fail -> Command is usable but should improve
- MEDIUM criteria encouraged but not required for success

## Out of Scope

1. Creating skills -> use claude-skill-builder instead
2. Writing CLAUDE.md files -> use claude-md-manager instead
3. Creating agent.md files -> use agent-builder instead
4. Teaching general bash scripting -> out of scope
5. Configuring MCP servers -> out of scope
6. Optimizing Claude Code itself -> out of scope
