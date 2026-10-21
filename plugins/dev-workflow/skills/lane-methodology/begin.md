# Begin a Lane

Contents: 1. Checks · 2. Bases · 3. Name · 4. Begin · 5. Workstream · 6. Post and next stage · Mid-lane

Companion to [SKILL.md](SKILL.md): what `/begin-lane [<issue-slug>]` runs. Terms — lane name,
branch, baseline, bases, lane repos, lane refs, open, held — are defined there, as are `lane` and
its exit codes (§ The lane script); the record's fields and sections are [record.md](record.md).

`/begin-lane` asks nothing: it runs, then posts what it did (§ 6). With no argument, ask what to
work on, and stop (Owner: user-decision-rubric `what-to-work-on`).

## 1. Checks

**The lane line reads.** Read it from the repo's `CLAUDE.md` (`SKILL.md` § Lane line), printing
its one clash line when it has one. `lane begin` makes every other check itself and exits 2 with
one line naming the one that failed: scratch is a repo (point at `scratch-management`'s initialize
protocol), the issue exists with `status: open` (missing: run `/capture-issue` first), every
`blocked_by` is settled (a `deferred` blocker still blocks), the lane repos table reads, and each
extra lane repo is on its base. Work around none of them.

## 2. Bases

The scratch base is always scratch `main`, and an extra lane repo's is its table row's. For the
code base, take the first case that matches:

- **The issue carries `role: epic`.** This is the epic lane; its base is the baseline.
- **The issue has no `epic:`.** The base is the baseline.
- **An open lane record at the lane refs has one of its epics as `primary`.** That is the epic's
  lane: the base is its record's `branch`. With more than one, the first in its `epic:` list. The
  epics' `lane:` keys are not read for this, since an epic lane writes its `lane:` on its own
  branch only.
- **Its epic's `lane:` is `none`.** The base is the baseline.
- **No open record is its epic's lane.** When the epic's `## Notes` hold an
  `Epic branch recommended:` bullet, this run begins the epic lane too (§ 4, epic form), and the
  member's base is the epic lane's branch. Otherwise the base is the baseline, and § 6's post says
  `/begin-lane {epic}` gives the epic a branch.

## 3. Name

The lane name is `{slug}` and its branch fills the convention. `lane begin` tests the name and
exits 5 when it is **taken**: its record sits in the archive, or its branch exists in a lane repo
with no open record. Then pick a name drawn from the work that matches the lane-name pattern and is
not an existing issue slug, run § 4 again with `--name {name}`, and say in § 6's post which name
was taken and why.

## 4. Begin

**Screen the issue file first.** When a new lane opens, `lane begin` commits
`scratch/issues/{slug}.md` whole on a branch it forks from scratch `main`, and pushes it. Nothing
says before the call whether one will open, so screen on every run (`SKILL.md` § Git rules, secret
screen) what that commit would add: the lines of `git -C scratch diff main -- issues/{slug}.md`,
or the whole file when `git -C scratch status --porcelain -- issues/{slug}.md` shows it untracked.
A hit stops the run before the call. Where `scratch/` is not a git repo, skip the screen: `lane
begin` stops there with § 1's line. The epic form screens the epic's issue file the same way
before its first call.

Then one call, from the checkout root:

```bash
lane begin {slug} [--name {name}] [--base {code base}] [--branch {branch}] [--workstream {slug}]
```

- `--base` when § 2 gave an epic lane's branch or the repo's `CLAUDE.md` names a baseline;
  `--branch` when it states a branch convention.
- `--workstream` names the `S-` folder this session resumed or started. With none in flight, omit
  it: the record names `{lane}`, and § 5 starts that workstream.

It fetches, then takes the first that applies:

- **An open lane holds the issue, checked out here or nowhere.** It resumes: every lane repo is
  switched to the lane branch where it is not on it, and nothing new opens. A `cc-lane` relaunch
  after its old worktree is gone lands here.
- **Held in another worktree, or only on `origin` refs.** Exit 4, naming the holder: stop with that
  line, unless the lane is on `origin` only and the user said to take it over, as when picking up a
  long build on another machine; then run it again with `--take-over`.
- **Otherwise** it branches every lane repo from its base, records each listed repo absent from
  the checkout as `pending`, writes `L-{lane}/README.md` and `lane: {lane}` on the issue, commits
  both on the scratch lane branch, and pushes every lane branch with its upstream.

By exit code (`SKILL.md` § The lane script): 0, go on; 2, stop with its line; 4, as above; 5, § 3.

After exit 0, when a new lane opened:

1. Files `git status --porcelain` lists in a lane repo rode the switch: they are pre-work the user
   declined to commit on the base. Screen them (`SKILL.md` § Git rules, secret screen), commit them
   on the lane, path-scoped, and `lane push`.
2. The switch hook (`SKILL.md` § Git rules).
3. A `warning:` line names an extra lane repo `.subrepos` does not list, which `/commit-all` will
   not survey: carry it into § 6's post.

**Epic form**, when this run begins the epic lane too: `lane begin {epic} --workstream none`
first, with § 3's name test on the epic's slug, then `lane begin {slug} --base {epic lane's
branch}`. The checkout ends on the member's branches.

**Done when** `lane status` names the lane and shows every lane repo on its branch, and the
primary issue carries `lane: {lane}`.

## 5. Workstream

When the record's `workstream` is the lane's own name and no `S-{lane}` folder exists, run `/start
{lane}` now, on the lane, so the `S-` folder it writes lands on the scratch lane branch and scratch
`main` stays untouched; it commits by `SKILL.md` § Scratch commit. Only the lane the checkout ends
on names a workstream: an epic lane begun as a member's base carries `workstream: none`, since no
session works on it, and a workstream two open records name closes with neither lane.

## 6. Post and next stage

Post one message: the lane, whether it began or resumed, its lane repos with their bases and
forks, any `pending` repo, the workstream, any taken name and the one picked, files carried over
from the base and committed, any `warning:` line, and the epic line from § 2 when it applies.

Then, when the lane opened at the build point (`SKILL.md` § When a lane opens), go back to the
build. Otherwise run `/refresh-issue {slug}` on the issue, read it, and recommend `/discovery`,
`/brainstorming` or `code-change` for it, with one line of reason, and ask.

## Mid-lane

- Every piece of work the lane does gets a `## Log` line (`record.md` § Sections): a build, a fix
  asked for mid-lane, a groom, a refresh, a fold, a catch-up resolution.
- Take in base work with `lane catch-up` (`SKILL.md` § Git rules, catch-up merge), and in
  scratch alone by `SKILL.md` § Scratch commit step 1.
- A commit in an extra lane repo follows `SKILL.md` § Lane repos.
- Fold another issue when the user asks: [record.md](record.md) § Fold.
