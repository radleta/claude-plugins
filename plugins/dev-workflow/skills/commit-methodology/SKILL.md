---
name: commit-methodology
description: "Comprehensive commit creation with adaptive analysis, security screening, conventional format, and execution protocol. Use when creating git commits, analyzing staged changes, screening for secrets, or formatting commit messages — even for quick single-file commits."
---

# Commit Methodology

## Context vs. Staged Files

Arguments may include a session context summary describing what was done and why. Use this to inform the "why" in your commit message, but **always perform your own full analysis of all staged files** — the summary may be incomplete. The commit message must cover every staged change, not just what the summary mentions.

## Out of Scope

- Push operations (separate command)
- Branch management
- Merge conflict resolution

## Workflow

### Step 0: Gather State and Triage

**If pre-gathered state is provided:** When the task prompt contains "Pre-gathered state: {path}", read that file instead of running `git-state`. The file uses the same sectioned format (`STATUS`, `STAGED_STAT`, etc.). Skip directly to the staging area assessment below.

**Otherwise**, run the git-state script to collect all repository state in one call:

```bash
git-state
```

This writes sectioned output to `.git/claude-git-state.txt` with headers: `STATUS`, `STAGED_STAT`, `STAGED_SHORTSTAT`, `STAGED_FILES`, `RECENT_COMMITS`. Use Read or Grep on that file — do not re-run git commands individually.

Then assess the staging area from the `STATUS` section. Follow the first matching case:

| Staging Area | Unstaged Changes | Action |
|---|---|---|
| Has staged files | Any | Proceed to Step 1 (analyze staged changes) |
| Empty | Has unstaged changes | Auto-stage all changes (`git add -A`), then re-run the script to refresh cached state |
| Empty | None (clean tree) | Report "Nothing to commit — working tree is clean." and **STOP** |

Auto-staging is the default. If the user provides instructions to stage selectively, follow those instead.

### Step 1: Analyze Staged Changes

Use adaptive depth based on changeset size:

**Small changeset** (files <= 5 AND lines <= 200):
- Run `git diff --cached` for full diff analysis
- Most accurate approach, token-efficient for small changes

**Medium changeset** (files <= 10 AND lines <= 500):
- For security-sensitive files: `git diff --cached -- [file]`
- For remaining files: load individually, prioritize by change volume
- Manage token usage with selective analysis

**Large changeset** (files > 10 OR lines > 500):
- For security-flagged files: `git diff --cached -- [file]` (MUST analyze)
- For remaining: use --stat summary, sample 3-5 representative files
- Recommend splitting: "This is a large commit (X files, Y lines). Consider splitting into smaller, focused commits."

After loading diffs, analyze:
1. Identify change nature: feat/fix/refactor/docs/test/chore/style/perf
2. Determine scope (component/module affected)
3. Note patterns or themes across all files
4. Understand "why" and impact from code changes
5. Identify breaking changes if any

### Step 2: Security Verification

**Filename screening** (CRITICAL — run on every commit):

Screen all staged filenames against these patterns:

Critical patterns (STOP if found):
- `.env`, `.env.*`, `.env.local`, `.env.production`, `.env.development`
- `*credentials*`, `*credential.*`, `*.key`, `*.pem`, `*.p12`, `*.pfx`
- `*secret*`, `*secrets.*`, `*token*`, `*tokens.*`, `*password*`, `*passwords.*`
- `*id_rsa*`, `*id_dsa*`, `*private*`, `*.ppk`
- `scratch/`, `claude-iterate/workspaces/`

Warning patterns (confirm with user):
- `.DS_Store`, `Thumbs.db`, `desktop.ini`
- `*.log`, `*.tmp`, `*.temp`
- `node_modules/`, `dist/`, `build/`, `.cache/`
- `*.swp`, `*.swo`, `*~`

If critical patterns found: STOP immediately, display flagged files, explain security risk, request user to unstage with `git reset HEAD [file]`. Do NOT proceed.

If warning patterns found: warn user, ask for confirmation, suggest .gitignore if appropriate.

**Content verification** (for security-sensitive files):

For files matching security patterns, scan diff content for:
- API keys: `/[A-Za-z0-9_-]{32,}/`
- AWS keys: `/AKIA[0-9A-Z]{16}/`
- Private keys: `/-----BEGIN (RSA |DSA )?PRIVATE KEY-----/`
- Tokens: `/token["\s:=]+[A-Za-z0-9_-]{20,}/`

If secrets detected: STOP, display affected file and line numbers, recommend environment variables.

**Large file detection**: Check --stat for files with >1000 lines changed. Suggest Git LFS for binaries >1MB.

### Step 3: Create Commit Message

**Format:**

Simple (single change):
```
type(scope): brief summary
```

Complex (multiple changes):
```
type(scope): brief summary

- Detail about first change
- Detail about second change
- Impact or reason for changes
```

**Type selection:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation only
- `refactor` — Code restructuring (no behavior change)
- `test` — Adding/updating tests
- `chore` — Maintenance, dependencies, config
- `style` — Formatting, whitespace
- `perf` — Performance improvement

**Requirements:**
- Follow conventional commit format
- Match repository's commit style (check recent commits from Step 0)
- Cover ALL staged changes accurately
- Focus on "why" and impact, not just "what"
- Use multi-line format for complex changes
- Include scope when relevant

### Step 4: Execute Commit

1. Show commit message for transparency
2. Create commit using HEREDOC for proper formatting:
   ```bash
   git commit -m "$(cat <<'EOF'
   [commit message here]
   EOF
   )"
   ```
3. Verify completion: `git status`
4. If pre-commit hook modifies files:
   - Check authorship: `git log -1 --format='%an %ae'`
   - Check not pushed: `git status` shows "Your branch is ahead"
   - If both true: amend commit
   - Otherwise: create NEW commit

## Constraints

- Auto-stage all changes by default (`git add -A`); stage selectively only when user instructs
- Never skip hooks with --no-verify unless explicitly requested by user
- Never commit to `scratch/` or `claude-iterate/workspaces/` (per CLAUDE.md)
- Follow repository's commit message style from recent history
- If uncertain about any staged file, ask before committing
- Use HEREDOC format for multi-line messages

## Examples

### Good Commit

**Context:** Staged files: src/auth/oauth.ts, src/auth/types.ts, docs/auth.md
**Analysis:** New feature adding OAuth support
**Message:**
```
feat(auth): add OAuth 2.0 support

- Implement OAuth 2.0 provider integration
- Add TypeScript types for OAuth tokens
- Document authentication flow
```
Why good: correct type, appropriate scope, covers all changes, multi-line for complexity, follows repo style.

### Security Block

**Context:** Staged files: .env, src/auth/oauth.ts, scratch/test.md
**Issue:** .env contains secrets, scratch/test.md in blocked directory
**Action:** STOP — ask user to unstage .env and scratch/test.md before proceeding.

### Bad Commit

**Context:** Staged files: 5 different unrelated changes
**Message:** `chore: updates`
**Why bad:** Vague, wrong type, doesn't cover all changes, not descriptive.

## Success Criteria

- Commit created successfully with no errors
- All staged changes included in commit
- No security violations (secrets, blocked dirs)
- Message follows conventional commit format
- Message matches repository style
- Message is accurate and comprehensive
- Pre-commit hook changes handled properly

## Multi-Repo Workflow (commit-all)

This section is used when invoked via `/commit-all`. It orchestrates commits across multiple repos defined in a `.subrepos` file.

### Prerequisites
- `.subrepos` file in repo root (one directory per line, `#` comments allowed)
- If no `.subrepos`: stop with "No .subrepos file found. Create one with sub-repo directories, one per line."

### Step M0: Gather Multi-Repo State

Run the multi-repo status script:

```bash
git-status-all
```

This reads `.subrepos`, surveys all repos + main, and writes:
- `.git/commit-all-summary.txt` — per-repo status overview
- `.git/commit-all-diffs/{name}.diff` — full diff per dirty repo (sectioned format)

Read the summary file to identify which repos have changes.

If all repos are clean: report "All repos clean, nothing to commit." and **STOP**.

### Step M1: Plan Accuracy Check

1. Read `CLAUDE.local.md` for active projects (look for `<local-memory>` tags)
2. For each active project with plan files in scratch/:
   - Read the plan's README.md progress table
   - Read the matching diff file (`.git/commit-all-diffs/scratch.diff` and `.git/commit-all-diffs/main.diff`)
   - Identify steps that appear completed based on diff content
   - If completed steps are not checked in the plan: dispatch **plan-updater** agent with the plan path and a summary of completed work
3. If a dirty repo has no matching active project AND no `$ARGUMENTS` context was provided: warn the user and ask whether to proceed
4. If `$ARGUMENTS` were provided: proceed (user context implies acknowledgment)

### Step M2: Per-Repo Commit

Commit repos in this order:
1. **scratch/** (first, if dirty) — plans and docs
2. **Other sub-repos** (in `.subrepos` file order) — supporting changes
3. **Main repo** (always last) — primary codebase

For each dirty repo:
1. Auto-stage all changes: `git -C {repo_path} add -A`
2. Dispatch **commit-worker** agent with prompt:
   - Working directory: `{repo_path}`
   - Pre-gathered state: `.git/commit-all-diffs/{name}.diff`
   - Session context: `$ARGUMENTS` (if provided)
3. If commit fails (security block, pre-commit hook, etc.): log the error and **continue** to next repo. Do not halt.

### Step M3: Summary

Output a structured summary:

```
## Commit-All Summary

### Committed
- {repo}: {hash} — {commit message}

### Skipped (clean)
- {repo}

### Failed
- {repo}: {error}

### Plan Updates
- {plan}: marked steps X, Y as complete

### Warnings
- {warning}
```
