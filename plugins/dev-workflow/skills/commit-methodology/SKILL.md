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

**If the task prompt names a working directory** (e.g. `Working directory: scratch/`), pass it to `git-state` with `-C` rather than `cd`-ing to it. Nothing sets a sub-agent's cwd for it, and a `git-state` run from the wrong directory silently gathers the *parent* repo's state and yields a confident commit message describing the wrong changeset. `-C` keeps the path a single argument, so a directory containing spaces cannot come apart:

```bash
git-state -C "<working directory>"
```

Run plain `git-state` only when no working directory was named.

**Then confirm you read the repo you were sent to.** `git-state` prints `Repo: <path>` as its first stdout line and writes a `REPO_ROOT` section into the output file. If that path is not the repo the prompt named, stop and report it — do not commit. Every other git command in this workflow must likewise be scoped with `git -C "<working directory>"`, quoted.

**Missing-command fallback:** `git-state` reaches `PATH` only on machines that ran this repo's `--user-install` step. If the command is not found, run the sibling script that ships inside the skill folder instead: `bash <skill-dir>/git-state.sh` (the skill-load preamble reports the skill's base directory — use that path). If the sibling script is also unavailable, fall back to inline git commands covering the same sections: `git status`, `git diff --cached --stat`, `git diff --cached --shortstat`, `git diff --cached --name-only`, and `git log -5 --oneline`.

This writes sectioned output to `$(git rev-parse --git-dir)/claude-git-state.txt` (path printed on stdout) with headers: `STATUS`, `STAGED_STAT`, `STAGED_SHORTSTAT`, `STAGED_FILES`, `RECENT_COMMITS`. Use Read or Grep on that file — do not re-run git commands individually.

Then assess the staging area from the `STATUS` section. Follow the first matching case:

| Staging Area | Unstaged Changes | Action |
|---|---|---|
| Has staged files | Any | Proceed to Step 1 (analyze staged changes) |
| Empty | Has unstaged changes | Auto-stage all changes (`git add -A`), then re-run `git-state` to refresh cached state |
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
- `scratch/`, `claude-iterate/workspaces/` — **parent-repo paths only.** These patterns block staging the `scratch/` or `claude-iterate/workspaces/` directories AS FILES inside a **parent-repo** commit (which would embed a nested subrepo's contents as tracked files, breaking the subrepo boundary). This does NOT apply when the commit's working directory IS the scratch subrepo itself (e.g., commit-worker dispatched with `repo_path: scratch/` by `/commit-all`'s M2 step) — committing inside the scratch subrepo is sanctioned and expected, and staged paths there never carry a `scratch/` prefix anyway (they're relative to that repo's own root).

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
- Never stage `scratch/` or `claude-iterate/workspaces/` as tracked paths inside the **parent repo** (per CLAUDE.md) — this constraint does not apply when committing inside the scratch subrepo itself (cwd=scratch/, as dispatched by `/commit-all`'s M2 step); that is sanctioned and expected
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

**Who runs what:** `/commit-all` is a command — it executes in the main session, which has the
Agent tool. M0 (gather state), M1 (plan accuracy check), and M3 (summary) run **directly in the
main session**, not delegated to any sub-agent. Only M2 (per-repo commit) is delegated — the main
session dispatches a fresh **commit-worker** agent once per dirty repo. `commit-worker` has no
Agent tool (see its tools list: Read, Glob, Grep, Bash, Skill) and commits inline via Bash within
the one repo it's pointed at; it never dispatches `commit-worker` (itself) or `plan-updater` — any
plan-update need it notices is returned in its result for the caller to act on. Do not read the
steps below as instructions for `commit-worker` to follow end-to-end; they are the main session's
own workflow, with M2 explicitly calling out the one delegation point.

### Prerequisites
- `.subrepos` file in repo root (one directory per line, `#` comments allowed)
- If no `.subrepos`: stop with "No .subrepos file found. Create one with sub-repo directories, one per line."
- A line may name a repo **outside** the parent tree by absolute path; a leading `~` is expanded. Such a repo is committed by M2 exactly like an in-tree one — auto-staged with `git add -A`, no approval prompt. Do not add a repo holding records that need review before each commit.

### Step M0: Gather Multi-Repo State

Run the multi-repo status script:

```bash
git-status-all
```

**Missing-command fallback:** like `git-state` above, `git-status-all` only reaches `PATH` on machines that ran this repo's `--user-install` step. If the command is not found, run the sibling script that ships inside the skill folder instead: `bash <skill-dir>/git-status-all.sh` (use the skill's base directory reported at load time). If the sibling script is also unavailable, fall back to inline git commands per repo listed in `.subrepos`: `git -C {repo} status`, `git -C {repo} diff --stat`, and `git -C {repo} diff` for dirty repos.

This reads `.subrepos`, surveys all repos + main, and writes (paths printed on stdout, under `$(git rev-parse --git-dir)/`):
- `commit-all-summary.txt` — per-repo status overview
- `commit-all-diffs/{slug}.diff` — full diff per dirty repo (sectioned format). `{slug}` is the repo path made filename-safe: the `$HOME/` prefix is dropped, then every character outside `[A-Za-z0-9._-]` becomes `-` and runs collapse. So `scratch` stays `scratch`, the main repo is `main`, and `~/OneDrive/Family/Housing/2426 W Centennial Pl` becomes `OneDrive-Family-Housing-2426-W-Centennial-Pl`. The repo path itself is never mangled — only the filename.

Read the summary file to identify which repos have changes.

These files are a **pre-staging survey**, consumed by M1 and by your own triage — not by
`commit-worker`. Because M2 stages afterwards, every `STAGED_*` section here is empty; and because
the `DIFF` section is built from `git diff --cached` plus `git diff`, neither of which sees
untracked files, a repo whose changes are all new files (the normal case for `scratch/`) has an
empty `DIFF` section. So M1 reads the file lists, never the diff body, and `commit-worker` gathers
its own state after staging (M2).

If all repos are clean: report "All repos clean, nothing to commit." and **STOP**.

### Step M1: Plan Accuracy Check

Runs in the main session (the `/commit-all` command itself) — not delegated.

1. Discover active plans from the scratch diff file (path printed by `git-status-all` as `commit-all-diffs/scratch.diff` under `$(git rev-parse --git-dir)/`). Read the **union of its `STAGED_FILES` and `UNSTAGED_FILES` sections** — that union lists every changed path whether or not M2 has staged yet, and `UNSTAGED_FILES` is the only section that lists untracked files at all. Match those paths against `*/README.md` and `*/steps/*`; the leading path segment of each match names an active plan touched by this commit.

   Paths in `scratch.diff` are relative to the **scratch subrepo's own root** and never carry a `scratch/` prefix — a plan README appears as `{project}/README.md`. Do not match on `scratch/*/...`; `main.diff` cannot carry those paths either, since `scratch/` is gitignored in the parent.

   Then **discard candidates that are not plans**. `scratch/` holds session folders (`S-*/`) and the issues corpus (`issues/`) alongside plans, and a bare `*/README.md` match cannot tell them apart. Keep a candidate only if the match came from `{project}/steps/...`, or `scratch/{project}/README.md` contains a progress table (a markdown table with a `Status` column) — which is the table step 2 goes on to read anyway, so a candidate failing this test has nothing for M1 to check.
2. For each active plan discovered:
   - Read the plan's README.md progress table
   - Read the plan's changed files directly under `scratch/{project}/` — do **not** rely on the `DIFF` section of `scratch.diff`, which is empty whenever those files are newly added
   - Identify steps that appear completed based on that content
   - If completed steps are not checked in the plan: the main session dispatches **plan-updater** agent (via its own Agent tool) with the plan path and a summary of completed work — this is the caller's job, not `commit-worker`'s; `commit-worker` has no Agent tool and never dispatches other agents
3. If no plan was touched AND no `$ARGUMENTS` context was provided: proceed without plan accuracy check (the commit is unrelated to plan progress)
4. If `$ARGUMENTS` were provided: proceed (user context implies acknowledgment)

### Step M2: Per-Repo Commit

The main session dispatches **commit-worker** once per dirty repo (the one delegation point in
this workflow) — commit repos in this order:
1. **scratch/** (first, if dirty) — plans and docs
2. **Other sub-repos** (in `.subrepos` file order) — supporting changes
3. **Main repo** (always last) — primary codebase

For each dirty repo:
1. Auto-stage all changes: `git -C "{repo_path}" add -A` — quote it; a `.subrepos` path may be external and may contain spaces.
2. Main session dispatches a fresh **commit-worker** agent (via the Agent tool) with prompt:
   - Working directory: `{repo_path}` — the worker passes it to `git-state -C` and scopes every
     other git command with `git -C`, per Step 0. It does not `cd`. Reproduce the path exactly,
     including spaces; do not shorten it to a basename.
   - Session context: `$ARGUMENTS` (if provided)
   Do **not** pass the M0 diff file as pre-gathered state. It was captured before this step's
   `git add -A`, so it reports an empty staging area, and its `DIFF` section is empty outright for a
   repo whose changes are all new files — which is why that file now opens with a `SNAPSHOT` header
   saying so. `commit-worker` runs `git-state` itself in its own Step 0, after staging — the same
   path the single-repo `/commit` already takes.
   `commit-worker` commits inline via Bash within that one repo only — it does not dispatch
   `commit-worker` again (itself) or `plan-updater`; it returns the commit result (hash + message,
   or an error) and, if it noticed a plan-relevant detail during its own analysis, flags that in
   its return for the main session to act on.
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
