---
description: Reread all recently modified files in full and verify edits are consistent with surrounding code — catches what isolated edits miss
argument-hint: [specific files or areas to focus on]
---

# Verify Changes

You just made edits to files. Now step back and verify those edits actually work in context. The problem you're solving: when you make targeted edits, you only see the lines you changed. You miss how the edit affects the rest of the file and related files.

## Step 1: Identify Modified Files

Recall every file you edited or created during this session. You have this information — you made the edits. List them all.

If $ARGUMENTS specifies files, prioritize those but still check all files you edited.

If you're uncertain whether you're remembering everything, cross-check with `git diff --name-only` and `git diff --cached --name-only` as a safety net — but your session memory is the primary source, not git.

## Step 2: Reread Every Modified File IN FULL

For each file you edited:

1. **Read the ENTIRE file** using the Read tool with NO offset and NO limit. Start from line 1, read to the end. Do NOT skip to the changed sections — the whole point is seeing the edit in context.
2. As you read, recall what you changed and why. Look at each edit *in the context of the full file*, not in isolation.
3. Before checking edits, quickly review CLAUDE.md and .claude/rules/ for any project conventions that apply to the files you changed — naming rules, patterns, restricted operations, etc.

## Step 3: Check for Inconsistencies

As you reread each file, look for these problems that isolated editing causes:

- **Missed siblings**: You updated one function/case/item but not similar ones nearby that need the same change
- **Broken references**: Your edit changed a name, signature, or type but callers/users of it weren't updated
- **Pattern mismatch**: Your new code uses different conventions than the rest of the file (naming, error handling, async style, imports)
- **Stale surroundings**: Comments, docs, validation, or logic near your edit that are now wrong or contradictory
- **Convention violations**: Your edit doesn't follow conventions documented in CLAUDE.md or .claude/rules/ (naming, error handling, imports, file structure, build commands)
- **Incomplete changes**: You started a rename/refactor but didn't finish — some occurrences still use the old form
- **Structural damage**: Unclosed brackets, broken indentation, missing imports, duplicate imports

## Step 4: Fix and Report

For each issue you find:
1. Fix it immediately with the Edit tool
2. After ALL fixes in a file, reread the file one more time to verify the fixes didn't introduce new problems

Then report:

```
## Change Verification Report

**Files checked:** [count]

### Issues Found and Fixed
- [file:line] — [what was wrong] → [what was fixed]

### Clean Files
- [file] — consistent after edits

### Summary
[1-2 sentences: files checked, issues found/fixed, confidence level]
```

## Rules

- **Read files FULLY.** No offset, no limit, no skimming. If you skip to the changed section, you defeat the purpose.
- **Fix issues, don't just list them.** This is fix-and-verify, not report-only.
- **Verify your fixes.** Reread after fixing — fixes can introduce new inconsistencies.

## Focus Areas

$ARGUMENTS
