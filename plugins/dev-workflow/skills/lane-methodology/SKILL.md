---
name: lane-methodology
description: "Lanes: one issue's work on its own branch in every lane repo, claimed by the record at the scratch branch's tip, opened at the build point or at launch, landed after one merge review. Use when work is about to build, running /begin-lane or /end-lane, folding an issue, or meeting an issue's lane: key — even for a small change. Grooming a lane's issues is issue-groom-methodology: a different test."
user-invocable: false
---

# Lane Methodology

A **lane** is one issue's work on one branch of one name in every **lane repo** (§ Lane repos):
begun by `/begin-lane`, claimed by its record at the scratch branch's tip, and landed back on its
**bases** by `/end-lane` after the user's one merge review. Agents commit freely on a lane's
branches; the user reviews the lane whole, at the merge. The lane is generic; what is particular
to a repo — where its lanes run, its extra lane repos, its build and test commands — comes from
that repo's `CLAUDE.md` and `CLAUDE.local.md`.

The mechanical steps run in the `lane` script (§ The lane script), the same way in every lane
repo; these pages keep the judgment.

Every lane runs through this skill. The procedures sit beside it:

- [begin.md](begin.md) — `/begin-lane`: the checks, resume, the name, the bases, the branches and
  the record.
- [end.md](end.md) — `/end-lane`: the closing work, the catch-up, the merge review, the landing,
  and `abandon`.
- [record.md](record.md) — the lane record's fields and sections, the `lane:` key, and § Fold.

## Lane line

One line in the repo's `CLAUDE.md` sets where and when its lanes run. Every setting is optional,
and its default is the first value:

```
- **Lanes:** run as branch | worktree via `<launcher> <slug>` | clone; open at build | at launch; at build offer | open; baseline <branch>.
```

- **branch** — the lane's branches are switched to in this checkout, in every lane repo.
- **worktree via `<launcher> <slug>`** — the user runs the launcher, which makes a worktree whose
  `scratch/` and extra lane repos are worktrees of the main checkout's copies and starts the
  session with `/begin-lane {slug}` as its first prompt. The generic launcher is `lane open
  <slug>`; a repo whose launch needs more names its own.
- **clone** — the user keeps full clones set up by hand; a lane is a branch lane in whichever clone
  the session runs in. No agent creates a worktree or a clone for it.
- **open at build | at launch** — when the lane opens (§ When a lane opens).
- **at build offer | open** — at the build point, offer the lane for the user's yes, or open it and
  say so.
- **baseline `<branch>`** — the repo's baseline (§ Identity). `<branch>` passes
  `git check-ref-format --branch`. It has no first value: without it the baseline is the repo's
  default branch.

The settings are the `;`-separated parts up to the line's first full stop that a space or the
line's end follows; `baseline` may be any one of them.

`worktree` pairs only with `at launch`; `branch` and `clone` pair only with `at build`; `offer |
open` applies only at build. A repo with no lane line gets every default. A line with any other
pairing: print one line naming the clash, and take the default for the setting that clashes. Read
the line at the build point, at `/begin-lane` and at `/end-lane`.

`lane open` and `lane remove` are typed by a person, through the PATH wrapper that `bash {skill
directory}/scripts/install.sh` writes; run it once per machine, and again after the skill's folder
moves, since the wrapper falls back to the path it was installed from.

## Lane repos

A lane's repos are the code repo, `scratch/`, and each **extra lane repo**: a git repo nested in
the checkout that the repo's `CLAUDE.md` lists in this table, one row per repo, the path relative
to the checkout root:

```
| Lane repo | Base |
|---|---|
| {path} | {branch} |
```

The script reads the table from `CLAUDE.md` at the root, else `.claude/CLAUDE.md`. `/begin-lane`
snapshots it into the record ([record.md](record.md) § Fields): `extras`, the repos the lane
holds, and `pending`, the repos listed then and absent from the checkout. An open lane is read
from its record, so a later edit to the table changes only lanes begun after it.

**Commit in an extra lane repo** with `git -C {repo}`, path-scoped and screened (§ Git rules), on
the lane branch. When the repo is not on the lane branch, because it is in `pending` or the table
gained it, run `lane add-repo {path}` first.

## The lane script

Call it by this skill's own path, never from PATH: `node {skill directory}/scripts/lane.mjs
{verb}`, `{skill directory}` the base directory this skill loaded from; `lane {verb}` below is
short for that. Run it from the checkout root. `--verbose` adds each git command it runs.

| Verb | What it does |
|---|---|
| `begin <slug>` | checks, resume, taken-name probes, branches, record, first push ([begin.md](begin.md)) |
| `add-repo <path>` | branches one more extra lane repo into the open lane |
| `push` | pushes every lane branch plain |
| `catch-up` | merges each repo's base, and `origin/{base}`, into its lane branch |
| `diff`, `log` | per repo, the review diff command with its `--stat`; the lane's own commits with their paths |
| `status`, `held <issue>` | the lane this checkout is on, or `lane: none`; § Held check |
| `land <lane>`, `abandon <lane>` | the landing and the abandon ([end.md](end.md)) |
| `open <slug>`, `remove <slug>` | the worktree launcher and its removal |

It prints one line per repo it acted on and a `switched: {repo}` line per repo it switched. Its
exit code picks the rule:

| Code | Meaning | Rule |
|---|---|---|
| 0 | Done | Go on |
| 1 | Usage error | Fix the call |
| 2 | A check failed or git refused; one stderr line names it | Stop the run with that line |
| 3 | A merge conflict in one repo, left in progress | Resolve by the catch-up merge (§ Git rules), commit, run the verb again |
| 4 | The issue or lane is held elsewhere; the line names the holder | § Held check's question, or stop |
| 5 | The lane name is taken | Pick a name ([begin.md](begin.md) § 3), run `begin` again with `--name` |
| 6 | `land` only: a base moved; no base moved in this call | `catch-up`, then [end.md](end.md) § 6's moved-base rule, then `land` again |
| any other | The script crashed or was interrupted | Stop the run with the code |

## When a lane opens

Every change that builds runs in a lane. A session already on a lane (§ Claim), including one the user began
before this conversation, gets no offer; its work lands on that lane.

- **At build (branch, clone).** Pre-work — discovery, design, grooms — runs on the base, code and
  scratch, with commits the user approves. The **build point** is `/brainstorming` step 7 before
  it invokes `/implement-code`, and `code-change` before its first edit. There, with no lane branch
  checked out:
  1. Pre-work files still uncommitted on the base (an `idea.md`, a `changelog.md`, issue edits) are
     offered as one base commit for the user's approval (Owner: user-decision-rubric
     `base-and-history`). Declined, they ride the branch switch onto
     the lane, are committed there, and reach the user in the merge review.
  2. With `open`, run `/begin-lane {build issue}` and say so in one line. With `offer`, name the lane
     `{build issue}` and wait for the user's yes or a rename.
- **At launch (worktree).** Pre-work, the build and the landing all run inside the lane the
  launcher opened. An agent in the main checkout asked for work that builds prints the launch
  command from the lane line, `<launcher> {issue}`, and stops.
- **Hatch.** The user calls it, only in words asking for the work on the base or outside a lane
  ("do it on main"); a request for a fix alone is not a call, and the agent never offers it. The
  fix then lands on the base with the user's commit approval, and that commit is its record: no
  lane record is written.

A fix the user asks for while a lane is open lands on that lane, with a `## Log` line in its record;
only a session on the base fixes on the base. No step switches a session's directory or branch
unless the user started it or the agent announced it.

Every lane links to an issue: with none, run `/capture-issue` first.

## Identity

- **Lane name** — the primary issue's slug, matching `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$` and never
  `none`.
- **Lane branch** — the repo `CLAUDE.md` branch naming convention with the lane name in its name
  slot; `lane/{lane}` when the repo states no convention or its convention has no name slot.
  Every lane repo's branch takes the code branch's exact name. Pass a stated convention's branch
  to `lane begin` as `--branch`.
- **Baseline** — the branch the lane line's `baseline <branch>` setting names (§ Lane line), read
  from the repo's main checkout. When the value fails `git check-ref-format --branch`, or names a
  branch the repo has neither locally nor on `origin`, stop and say so in one line naming the
  value: a lane forked from the default branch in its place lands on the wrong base. When the
  branch exists only on `origin`, create the local one first, the value in single quotes with
  any `'` of its own written `'\''`, `git branch '<branch>' 'origin/<branch>'`: the fork and the
  landing name the local branch.
  Without that setting, the
  repo's default branch: `git symbolic-ref refs/remotes/origin/HEAD` with `refs/remotes/origin/`
  stripped; with no remote, or when that ref is missing, `main` when that local branch exists,
  else `master`. `lane begin` computes that default; pass a named baseline as `--base`, which
  stops when the code repo has no local branch of that name.
- **Bases** — the branches a lane forks from and lands on. The code base is the baseline, or an
  epic lane's code branch for a member of that epic. The scratch base is scratch `main` for every
  lane, an epic member's included, and an extra lane repo's base is its table row's.
- **Lane refs** — in scratch, `refs/heads/{branch}` and, after `git -C scratch fetch origin`,
  `refs/remotes/origin/{branch}`. A repo with no remote reads local refs only and never fetches
  or pushes. Every reader scans `refs/heads/lane/*` and `refs/remotes/origin/lane/*` (or the
  convention's prefix) and reads a record with `git -C scratch show {ref}:L-{lane}/README.md`.

## Claim

The record `L-{lane}/README.md` lives only on the scratch lane branch, and the branch tip is the
claim. A lane is **open** while a lane ref's tip carries its record; `/end-lane` archives the record
on the branch, so an archived lane's ref, local or on `origin`, holds no claim. An issue is **held**
when an open record names it as `primary` or in `folded`.

**On a lane** means `scratch/` holds an `L-{lane}/README.md` whose `branch:` is the code repo's
`git branch --show-current`. The test reads the record, never the branch name, so it holds under
any branch naming convention. This is the one definition; every other file cites it.

Who holds an open lane:

- a local lane branch checked out in another worktree — that worktree (`git -C scratch worktree
  list --porcelain` names it);
- a lane seen only on `origin` refs — another clone or machine;
- a local lane branch checked out here or nowhere — this session, to resume.

Local refs see every worktree lane on the machine, since those lanes share one scratch repo;
`origin` refs see clones and other machines after a fetch.

The `lane:` key on an issue names the last lane that held it, and stays after the lane ends as
provenance. It is written on the lane branch, so whether a lane holds an issue is read from the
open records at the lane refs, never from `lane:`. Its write rules are
[record.md](record.md) § The lane key.

`L-*/` folders are lane records, never project work and never a destination for anything else, as
`S-*/` folders are session records.

## Held check

The one rule every pickup path cites. Given an issue:

1. Skip it when it carries `role: epic`.
2. Run `lane held {issue}`. It reads the open records at the lane refs, never the issue's `lane:`,
   which the base and other lanes do not carry.
3. Exit 0: go on, printing nothing. Exit 4: print its `HELD:` line and ask whether to go on.

## Git rules

- A push is never forced. Agents push lane branches plain with `lane push`, after lane commits
  and at checkpoints, and never push a base to a remote. A rejected push is handled by the rule
  for its step.
- Every read and write of scratch goes through `git -C scratch`, with scratch-relative paths.
- Check a value from the arguments, an issue's frontmatter or a record before it reaches a command
  line: a slug, lane or workstream name matches `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`, a branch passes
  `git check-ref-format --branch` and holds only letters, digits and `._/@+-`, a fork is a full commit sha, and an extra lane repo's path from
  a record's `extras` or `pending` passes [record.md](record.md) § Fields' path rule. A value that fails stops the run
  with one line naming it.
- **Switch hook.** When the repo's `CLAUDE.md` names a step to run after a branch switch, run it
  once after every `lane` call that printed a `switched:` line, and after any switch made by hand,
  following whatever that `CLAUDE.md` says about waiting on it and reading its exit.
- **Catch-up merge.** `lane catch-up` brings each base into its lane branch by a merge, never a
  rebase, and exits 3 at the first conflict, naming the repo and the files. Resolve each conflict
  by the epic rule: appends keep both sides in date order; only two
  different rewrites of one line go to the user, asked in one question naming both sides (Owner:
  user-decision-rubric (test: Conflict)). Commit the merge in that repo, give each resolution a
  `## Log` line, and run the verb again.
- **Secret screen.** Before any commit an agent makes on a lane, screen the added lines of the paths
  it commits as `commit-methodology` Step 2 does. A credential-shaped file or secret pattern stops
  the run with one line naming the file, which stays uncommitted (`Owner: user-decision-rubric
  secret`).
- A step that fails stops the run with one line naming what failed, unless its procedure says how
  to go on.

## Scratch commit

The one rule for every scratch write a lane, a groom, a refresh or a rest point makes. On a lane
is § Claim's test.

1. **Bring scratch current**, at a lane step's start, or before a groom's, a refresh's or a rest
   point's first read.
   - On a lane: with a remote, `git -C scratch fetch origin`; then, in scratch alone, `git -C
     scratch merge --no-edit main`, and the same of `origin/main` when it exists, a conflict
     resolved by the catch-up merge's rule (§ Git rules). `lane catch-up` is not this step: it
     merges every lane repo's base.
   - Off a lane: `git -C scratch pull --no-rebase`; with no remote, nothing.
2. Write the files.
3. Screen the paths (§ Git rules, secret screen), then commit only the paths this step wrote,
   named on the commit itself so anything else already staged in the scratch index stays out: `git -C scratch add -- {paths}`, then
   `git -C scratch commit -m "…" -- {paths}`.
4. **Approval and push.**
   - On a lane: no approval item; `lane push`, and report what was committed.
   - Off a lane: the plan or ruling list that approves the commit names those paths, and scratch
     `main` stays unpushed, because a push of a base is the user's. The one push of scratch left is
     the `archive` branch push `scratch archive` makes itself.
5. **A step 1 that fails** is handled by its cause:
   - On a lane, a conflict follows the catch-up merge's rule, and only its two-rewrites case waits.
   - Off a lane, a merge conflict pauses the run. Show the files and wait for the user to commit,
     keep or discard them, then resume from the pull.
   - A refusal because uncommitted scratch files would be overwritten pauses the run, on a lane or
     off: another session's uncommitted files are the user's. Show them and wait.
   - Any other failure (origin unreachable, origin without `main`) ends the run with one line
     naming it.
