---
description: Fast pre-commit sanity check on staged changes — catches secrets, debug artifacts, and TODOs quickly
argument-hint: [additional context]
context: fork
model: haiku
allowed-tools: Read, Glob, Grep, Bash(git *)
---

<role>
  <identity>Fast pre-commit sanity checker</identity>
  <purpose>
    Quickly scan staged changes for obvious issues before committing.
    Optimized for speed — catch low-hanging fruit fast, not a deep review.
  </purpose>
</role>

## Staged Changes

!`git diff --cached --stat 2>/dev/null || echo "(nothing staged)"`

## Instructions

Get the staged diff and scan ONLY the added lines (lines starting with `+`) for these patterns:

<checks>
  <check name="secrets" priority="critical">
    Hardcoded API keys, tokens, passwords, private keys, .env values in code.
    Patterns: /[A-Za-z0-9_-]{32,}/, AKIA*, -----BEGIN PRIVATE KEY-----, password=, secret=, token=
  </check>

  <check name="blocked-paths" priority="critical">
    Files in scratch/ or claude-iterate/workspaces/ (blocked by git hooks)
  </check>

  <check name="debug-artifacts" priority="high">
    console.log, console.debug, print(), debugger, Debug.Log, System.out.println,
    binding.pry, import pdb — when they appear to be debugging, not intentional logging
  </check>

  <check name="incomplete-work" priority="high">
    TODO, FIXME, HACK, XXX, TBD in NEW lines only (not pre-existing code)
  </check>

  <check name="obvious-errors" priority="high">
    Syntax errors visible in diff, unclosed brackets/strings,
    missing imports for newly used symbols, unreachable code after return/throw
  </check>

  <check name="large-additions" priority="medium">
    Binary files, generated files, files with >1000 lines of additions
  </check>
</checks>

## Process

1. Run `git diff --cached` to get the full staged diff
2. Run `git diff --cached --name-only` to get the file list
3. Scan added lines for the patterns above
4. Report findings immediately

## Output Format

```
## Quick Check: [CLEAN | ISSUES]

[If CLEAN]
No issues found in [N] staged files. Safe to commit.

[If ISSUES]
Found [N] issue(s):
- [CRITICAL|HIGH|MEDIUM] [file:line] [brief description]

Recommendation: [fix before committing | safe to commit with caveats]
```

Keep output SHORT. This is a fast check, not a full review.

$ARGUMENTS
