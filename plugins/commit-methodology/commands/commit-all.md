---
description: "Multi-repo commit: surveys all sub-repos via .subrepos and creates coordinated conventional commits. Use when committing work that spans the main repo, scratch or another sub-repo — even when only one repo has changes."
argument-hint: "[session context]"
---

<role>
  <identity>Multi-repo commit orchestrator</identity>
  <purpose>
    Run the Multi-Repo Workflow (M0-M3) from the commit-methodology skill directly in this
    session — gather state, check plan accuracy, and produce the final summary here — while
    delegating only the per-repo commit action (M2) to a fresh commit-worker agent per dirty
    repo. commit-worker has no Agent tool (it cannot dispatch itself or plan-updater), so
    per-repo dispatch ordering and the plan-accuracy check are this command's job, not its.
  </purpose>
</role>

Load the **commit-methodology** skill via the Skill tool, then execute its **## Multi-Repo
Workflow (commit-all)** section as follows:

1. **M0 — Gather Multi-Repo State**: run this step yourself (`git-status-all`, read the summary
   file). If all repos are clean, report "All repos clean, nothing to commit." and stop.
2. **M1 — Plan Accuracy Check**: run this step yourself in this session. Dispatch
   **plan-updater** directly (via the Agent tool) if a touched plan has completed-but-unchecked
   steps — do not route this through commit-worker.
3. **M2 — Per-Repo Commit**: for each dirty repo, in the skill's documented order (scratch/
   first, other sub-repos in `.subrepos` order, main repo last), auto-stage the repo and dispatch
   a fresh **commit-worker** agent via the Agent tool with: working directory `{repo_path}` (the
   worker `cd`s there and runs `git-state` itself, after staging) and the session context below
   (files changed across repos, why, key decisions). Do not pass the M0 diff file as pre-gathered
   state — it was captured before staging. commit-worker commits inline via Bash
   within that one repo and returns the commit result — it does not dispatch any other agent.
   If a repo's commit fails (security block, pre-commit hook, etc.), log the error and continue
   to the next repo; do not halt the loop.
4. **M3 — Summary**: after all repos are processed, produce the structured commit-all summary
   yourself (committed / skipped / failed repos, plan updates, warnings) per the skill's M3
   output format.

**On a lane** (`lane-methodology` § Claim), an agent runs this command without an approval item: scratch, the main repo and each surveyed
repo the `extras:` key of `scratch/L-{lane}/README.md` names (comma-separated `{path}:{base}:{sha}` entries) commit on
their lane branches, and M3 then pushes each lane branch plain (`git -C {repo} push origin
{branch}`, `git push origin {branch}`; no remote, no push; `{branch}` reaches a command line only
when it matches `^[A-Za-z0-9._/@+-]+$`, and any other stops the push with one line naming it). `.subrepos` stays the one survey source, so an `extras` repo it does not list is not committed here. A surveyed repo `extras` does not name and the record's `pending:` key or the
`| Lane repo | Base |` table of the repo's `CLAUDE.md` does is an extra lane repo not yet on the lane
branch: leave it uncommitted and name it in M3 with the step that comes before its first commit,
`lane add-repo {path}` (`lane-methodology` § Lane repos). Any other surveyed repo `extras` does not
name, as `marketplace/`, which is publish-only, has no lane branch: show its `git status --porcelain` and commit it only on the user's approval. Off a
lane, every commit is the user's to approve, as the commit rule says, and the user's own
`/commit-all` is that approval. Owner: user-decision-rubric `base-and-history`

If a dispatched commit-worker agent returns an error or needs user input, relay the message to
the user. Once the user resolves the issue, resume that same agent via SendMessage with the
user's response — do not launch a fresh agent for that repo.

Additional instructions (when provided) override the above:
$ARGUMENTS
