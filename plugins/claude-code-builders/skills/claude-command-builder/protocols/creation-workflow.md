# Command Creation Workflow

> This document contains the full 5-step sequential creation workflow. Referenced from SKILL.md.

## Step 1: Understand Requirements

**Actions:**
- **CRITICAL:** Identify what the command should do (primary purpose)
- **CRITICAL:** Determine what arguments are needed ($ARGUMENTS or $0, $1, etc.)
- **CRITICAL:** Decide command location (project .claude/commands/ or personal ~/.claude/commands/)
- **HIGH:** Check if user mentioned tool restrictions (see @QUALITY.md lines 15-96)
- **MEDIUM:** Identify any bash execution or file reference needs

**Outputs:**
- Requirements specification document
- Argument handling approach
- Tool restriction requirements (if user requested)

**Acceptance Criteria:**

| ID | Priority | Description | Test | Pass | Fail |
|----|----------|-------------|------|------|------|
| 1-1 | CRITICAL | Primary purpose identified and can be stated in one sentence | Can answer: "This command does X" in <=20 words | Single-sentence description exists | Cannot articulate purpose or takes >20 words |
| 1-2 | CRITICAL | Argument approach determined | Decision made: use $ARGUMENTS, or $0 $1 positional, or no args | Explicit choice documented | Uncertain which argument pattern to use |
| 1-3 | CRITICAL | Tool restrictions requirement clear | Can answer: Did user request restrictions? YES/NO | Explicit YES or NO based on user's words | Uncertain - need to re-read user request or ASK |
| 1-4 | HIGH | Location decided | Chosen: .claude/commands/ (project) or ~/.claude/commands/ (personal) | Location matches team/personal usage pattern | Uncertain whether project or personal scope |

**Dependencies:**
- Requires: User request or problem statement
- Blocks: Step 2 (cannot design structure without requirements)

---

## Step 2: Design Structure

**Actions:**
- **CRITICAL:** Read @SYNTAX.md lines 22-39 for file naming rules
- **CRITICAL:** Choose descriptive, action-oriented filename (verb-noun.md pattern)
- **HIGH:** Determine if frontmatter needed (YAML for description/allowed-tools/model)
- **HIGH:** Plan argument variable placement ($ARGUMENTS once at end - see @TIPS.md lines 60-77)
- **MEDIUM:** Identify bash execution needs (check @SYNTAX.md lines 187-213)
- **MEDIUM:** Identify file reference needs (check @SYNTAX.md lines 215-232)

**Outputs:**
- Command filename (e.g., review-pr.md, create-commit.md)
- Frontmatter specification (properties and values)
- Argument placement plan
- Bash/file reference plan

**Acceptance Criteria:**

| ID | Priority | Description | Test | Pass | Fail |
|----|----------|-------------|------|------|------|
| 2-1 | CRITICAL | Filename follows naming conventions | Check: hyphenated, lowercase, action-oriented, .md extension | Matches pattern: [verb]-[noun].md (e.g., review-pr.md) | Missing hyphens, has uppercase, no action verb, or wrong extension |
| 2-2 | CRITICAL | Frontmatter plan is valid | If using YAML: has description, correct property names, valid values | All frontmatter properties are valid per @SYNTAX.md lines 40-136 | Invalid property names or missing required properties |
| 2-3 | HIGH | Argument placement optimized | Check: $ARGUMENTS used once at end, OR $0 $1 for positional | Follows @TIPS.md golden rule (lines 60-77) | Multiple $ARGUMENTS or unclear placement |
| 2-4 | MEDIUM | Bash execution syntax correct | If using bash: follows correct syntax per @SYNTAX.md lines 187-213 | Uses proper format, not bare commands | Uses bare commands or incorrect syntax |

**Dependencies:**
- Requires: Step 1 completed (requirements known)
- Requires: @SYNTAX.md read for file naming and frontmatter rules
- Blocks: Step 3 (cannot write command without structure plan)

---

## Step 3: Write Command

**Actions:**
- **CRITICAL:** If using frontmatter: Write opening --- on line 1
- **CRITICAL:** Write description that meets @QUALITY.md lines 132-173 standards
- **CRITICAL:** If user requested restrictions: Add allowed-tools per @QUALITY.md lines 15-96
- **CRITICAL:** If frontmatter: Write closing --- with blank line after
- **CRITICAL:** Write clear, focused command prompt
- **HIGH:** Add argument variables ($ARGUMENTS once at end)
- **MEDIUM:** Include bash execution if needed
- **MEDIUM:** Include file references if needed (@file.md)
- **LOW:** Add context or examples if helpful

**Outputs:**
- Complete command file content
- YAML frontmatter (if used)
- Command prompt body

**Acceptance Criteria:**

| ID | Priority | Description | Test | Pass | Fail |
|----|----------|-------------|------|------|------|
| 3-1 | CRITICAL | YAML frontmatter is syntactically valid | Run: `grep $'\t' file.md \| wc -l` (should return 0) | No tabs, proper delimiters, 2-space indentation | Has tabs, missing delimiters, or wrong indentation |
| 3-2 | CRITICAL | Description meets quality standards | Apply @QUALITY.md lines 132-173 criteria: word count 10-50, has action verb, has domain context | All 3 criteria pass | Any criterion fails |
| 3-3 | CRITICAL | Tool permissions match user request | Apply @QUALITY.md decision matrix (lines 46-73): did user request restrictions? | If NO user request: omitted. If YES user request: added per request | Added without user request, or wrong pattern |
| 3-4 | HIGH | Argument variables are correct | Run: `grep '$ARG[^U]' file.md` (should return nothing) | Only $ARGUMENTS or $0, $1, etc. used | Invalid patterns like $ARG, ${0}, $ARGS found |
| 3-5 | MEDIUM | Prompt is clear and focused | Check: single responsibility, no shell logic (if/then/else), concise | One clear purpose, no shell conditionals, <50 lines ideal | Multiple purposes, shell logic present, or >100 lines |

**Dependencies:**
- Requires: Step 2 completed (structure plan exists)
- Requires: @QUALITY.md read for description standards and tool permissions
- Blocks: Step 4 (cannot validate without content)

---

## Step 4: Validate

**Actions:**
- **CRITICAL:** Run YAML syntax validation: `grep $'\t' file.md | wc -l`
- **CRITICAL:** Run argument syntax validation: `grep '$ARG[^U]' file.md`
- **CRITICAL:** Check description quality against @QUALITY.md lines 132-173
- **CRITICAL:** Verify tool permissions match user request (apply @QUALITY.md decision matrix)
- **HIGH:** Review against validation checklist (see validation-checklist.md)
- **HIGH:** Check file references use @ syntax
- **MEDIUM:** Verify argument-hint matches actual usage
- **MEDIUM:** Check for anti-patterns (@EXAMPLES.md lines 1028-1360)

**Outputs:**
- Validation results (PASS/FAIL for each check)
- List of identified issues
- Fixes needed (if any)

**Acceptance Criteria:**

| ID | Priority | Description | Test | Pass | Fail |
|----|----------|-------------|------|------|------|
| 4-1 | CRITICAL | All CRITICAL validation checks pass | Run all CRITICAL validation commands from validation-checklist.md | All CRITICAL checklist items return expected results | Any CRITICAL check fails |
| 4-2 | HIGH | All HIGH PRIORITY validation checks pass | Run all HIGH validation commands from validation-checklist.md | All HIGH PRIORITY checklist items pass | Any HIGH check fails |
| 4-3 | MEDIUM | No anti-patterns detected | Review command against @EXAMPLES.md anti-patterns checklist (lines 1342-1360) | Zero anti-patterns from checklist detected | Any anti-pattern from checklist found |
| 4-4 | HIGH | Fixes applied if needed | If validation failed: apply fixes and re-validate | Re-validation passes all criteria | Issues remain after fixes attempted |

**Dependencies:**
- Requires: Step 3 completed (command content exists)
- Requires: Validation checklist (see validation-checklist.md)
- Requires: @QUALITY.md standards (for validation criteria)
- Blocks: Step 5 (cannot save file with validation failures)

---

## Step 5: Create File and Inform User

**Actions:**
- **CRITICAL:** Use Write tool with correct file path (.claude/commands/filename.md or ~/.claude/commands/filename.md)
- **CRITICAL:** Ensure content uses 2-space indentation (not tabs)
- **CRITICAL:** Preserve indentation throughout file
- **CRITICAL:** Remove trailing whitespace
- **CRITICAL:** Inform user that reload may be required (see Hot-Reload Note below)
- **MEDIUM:** Summarize command purpose and usage

**Outputs:**
- Command file saved to disk
- User notification about reload requirements
- Usage instructions for user

**Acceptance Criteria:**

| ID | Priority | Description | Test | Pass | Fail |
|----|----------|-------------|------|------|------|
| 5-1 | CRITICAL | File created at correct location | Check: file exists at planned path | File exists at .claude/commands/*.md or ~/.claude/commands/*.md | File not found or at wrong location |
| 5-2 | CRITICAL | File content matches validated version | Check: no changes introduced during save | File content identical to validated version | Content differs from validated version |
| 5-3 | CRITICAL | User informed about reload requirements | Check: user message includes reload instruction | User told about session reload or hot-reload behavior | No reload instruction given to user |
| 5-4 | HIGH | Usage instructions provided | Check: user knows how to invoke command | User told command name and example usage (e.g., "/review-pr 123") | No usage example provided |

**Dependencies:**
- Requires: Step 4 completed (validation passed)
- Blocks: None (workflow complete)

---

## Workflow Rules

- **Sequential:** 1 -> 2 -> 3 -> 4 -> 5
- Each step MUST complete with all CRITICAL criteria passing before next step
- If any CRITICAL criterion fails, STOP and fix before proceeding
- If any HIGH criterion fails, note issue but may proceed if CRITICAL pass
- Do not skip steps or execute out of order

**Overall Workflow Acceptance:**

| ID | Priority | Description | Test | Pass | Fail |
|----|----------|-------------|------|------|------|
| W-1 | CRITICAL | All 5 steps completed in order | Verify each step's acceptance criteria passed before proceeding to next | Steps executed 1->2->3->4->5 with all critical criteria passing | Steps skipped, executed out of order, or critical criteria failed |
| W-2 | CRITICAL | Command loads without errors | Start new Claude Code session and check command list | Command appears in slash command list without errors | Command missing, has syntax errors, or fails to load |
| W-3 | HIGH | Command executes as intended | Test command with various argument combinations | Command executes, arguments substituted correctly, produces expected behavior | Execution errors, argument substitution fails, or unexpected behavior |

## Hot-Reload Note

- **Skills** (`.claude/skills/`) hot-reload when files change (v2.1.0+)
- **Legacy commands** (`.claude/commands/`) may require session restart
- Always inform users about reload requirements based on file location
