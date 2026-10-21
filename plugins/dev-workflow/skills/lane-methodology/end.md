# End a Lane

Contents: 1. Checks · 2. Closing work · 3. Catch-up, build and tests · 4. Merge review · 5. The reply · 6. Land · 7. Report · PR landing · Abandon

Companion to [SKILL.md](SKILL.md): what `/end-lane <lane> [abandon]` runs. Terms are defined
there, as are `lane` and its exit codes (§ The lane script); the record's fields, sections and
`lane:` rules are [record.md](record.md).

`/end-lane` does the lane's closing work on the lane, unattended, then asks for one merge review,
then lands. The diff the user approves is what lands, caught up and tested. It deletes no branch,
never closes an epic, and never pushes a base to a remote.

## 1. Checks

Each check that fails stops the run with one line naming what is wrong.

1. **The lane line reads** (`SKILL.md` § Lane line), printing its one clash line when it has one.
2. **The lane is open and this session's.** Test the resume first: when `scratch/L-{lane}/` is gone
   from the scratch lane branch and `git -C scratch show archive:L-{lane}/README.md` prints the
   record, an earlier landing archived it and then stopped. Go straight to § 6's `lane land`,
   skipping checks 3 and 4 and the routes below. Otherwise `lane status` names the lane, or, when the
   lane's branch is checked out nowhere, `lane begin {primary}` resumes it here; then the switch
   hook. Held elsewhere (exit 4): stop naming the holder.
3. **The event groom runs,** only when `workstream-groomer` is among this session's available agent
   types; otherwise skip this check whole. Load `handoff-methodology` with the Skill tool and run its
   `boundary-groom.md` with event `end-lane`: it tests the argument and the record itself, runs
   nothing on `abandon`, on `state: pr-open` or when the workstream closes with the lane, and writes
   each edit open to veto into the record's `## Decisions made`. It never stops the run.
4. **Uncommitted lane work is committed.** Files `git status --porcelain` lists in any lane repo
   are the lane's work, check 3's edits and record lines included: screen them (`SKILL.md` § Git rules,
   secret screen) and commit them on the lane branch, path-scoped, with a `## Log` line.

Then branch on the argument and the record:

- `abandon` → § Abandon.
- `state: pr-open` → § PR landing, resume.
- `state: open` → § 2.

## 2. Closing work

Run in order, on the lane, asking nothing. Each writes on the lane branches, commits by
`SKILL.md` § Scratch commit or path-scoped in the code repo or an extra lane repo, and adds a
`## Log` line.

1. **Groom.** `/groom-lane {lane}`, through the Skill tool. On a lane it applies its notes, links
   and markers, and applies each close with its promotion on the branch (`issue-groom-methodology`
   § Entry: /groom-lane); keep each applied close and promotion, with its scratch commit and its code
   commit, for § 4's veto list.
2. **Harvest.** Read `../wrap-up/SKILL.md` and `../wrap-up/lane-scope.md`, beside this skill's
   folder, with the Read tool, since `wrap-up` does not load through the Skill tool, and run it on
   the record's `workstream` as `lane-scope.md` gives, which passes `--since-ref {scratch_fork}` to
   its collect. It skips an
   issue already settled, so no close is ruled twice; keep each close and promotion it applies, with
   its commits, for the veto list.
3. **Workstream close.** When the record's `workstream` is the lane's own name and no other open
   lane's record names it in `workstream`, or the user said so, run the workstream-only parts
   `wrap-up` `lane-scope.md` names, on the lane, and keep "workstream closes" for § 4.

## 3. Catch-up, build and tests

1. `lane catch-up`. It first brings in each `pending` repo now present in the checkout, then
   merges every base into its lane branch. Exit 3: resolve by the catch-up merge (`SKILL.md`
   § Git rules), commit, and run it again until it exits 0.
2. Run the full build and every test command the repo's `CLAUDE.md` and `CLAUDE.local.md` name;
   with none named, § 4 says so. A failure stops the run and shows the output.
3. Note `{reviewed}`: each base's tip as merged, per lane repo. Then `lane push`.

## 4. Merge review

Owner: user-decision-rubric `accept-and-merge`. One message, in this order above the diff
commands, each part omitted when empty:

1. the record's `## Decisions made`, its `Event groom` lines numbered for veto in one sequence
   with item 4's;
2. for each build its `## Log` names, the run card's `## Decisions made` and `## I did not verify`,
   and, for a skills, commands or agents build, its `## Tier check`;
3. the record's `## Rulings`;
4. the closes and promotions applied on the branch, and the harvest's items held for a registered
   repo (`../wrap-up/lane-scope.md`, Stage 1), numbered for veto;
5. "workstream closes", when § 2.3 ran;
6. the record's `## Log` and `## Assets`;
7. `lane diff`'s output, which gives each lane repo's diff command to run and its `--stat`, and
   the build and test commands § 3 ran, with their results;
8. the reply it takes: `accept-and-merge`, optionally followed by `except <numbers>` naming items
   to veto and `keep workstream` to veto the workstream close.

End the turn.

## 5. The reply

- **`accept-and-merge`.** Revert each vetoed item on its branches — `git revert --no-edit` of each
  of its commits, or an edit restoring the file when the commit carries other work; an `Event
  groom` item is undone from its `## Decisions made` line, as `handoff-methodology`
  `boundary-groom.md` § Undo gives — and, on `keep
  workstream`, the workstream-only parts, each with a `## Log` line. When anything was reverted,
  re-run § 3's build and tests. Then § 6.
- **Any other reply** is feedback. Work it on the lane, with a `## Log` line, re-run § 3, and ask
  again with § 4.

## 6. Land

1. **Registered-repo items.** Land each one § 4 listed and the reply kept, by `wrap-up` stages 8
   and 9 for its repo, `accept-and-merge` standing as stage 9's approval, each with a `## Log`
   line; then run `wrap-up` stage 10 when `lane-scope.md` held it for them. A stop here comes
   before anything lands.
2. **`lane land {lane}`.** It lands each extra lane repo, then the code repo, appends the closing
   line and archives the record on the scratch lane branch, lands scratch, and pushes every lane
   branch. A stage whose result already holds is skipped, so after any stop, run it again. Then
   the switch hook. By exit code:
   - **6, a base moved** since `{reviewed}`; no base moved in this call. Catch up again by § 3,
     build and tests included. The lane lands without a new review when that merge had no conflict
     and changed no file the lane changes (`git diff --name-only {reviewed}...{branch}` before the
     merge, in that repo); otherwise ask again with § 4. Then `lane land {lane}` again.
   - **3, scratch `main` moved after the record was archived** and its merge conflicts. Resolve by
     the catch-up merge, commit, and run it again; this merge takes no second review.
   - **2, a push refused** because the checkout with the base out has uncommitted changes: its
     line names that checkout. Another session's uncommitted files are the user's; stop, and
     `/end-lane {lane}` resumes once they are cleared. Any other line: stop with it.

A worktree lane lands by a local push into each base, which `receive.denyCurrentBranch
updateInstead` (set by `lane open`) lets update the checkout that has the base out, and its
worktrees stay on the lane branch. A branch or clone lane ends with every lane repo switched to
its base.

**Done when** `lane land {lane}` exits 0: every base holds its lane branch's tip, the record is
gone from scratch `main` and present in the archive with its closing line, and every base is
unpushed.

## 7. Report

From the record's fields as read before the archive: unless `workstream` is `none` or closed with
the lane, whether it has other open lanes (the records at the lane refs whose `workstream` names
it). When the record has an `epic`, an open lane record at the lane refs has that epic as
`primary`, `scratch-memory epics graph {epic} --json` shows no member whose `status:` is not
settled, and the epic's `## Outcomes` holds no unticked line, print `Next: /end-lane {epic-lane}` for the user to type; a `deferred`
member counts as outstanding.

For a worktree lane, a checkout whose `git rev-parse --git-dir` differs from its
`git rev-parse --git-common-dir`, print how to remove it, for the user to run from the main
checkout once they leave the worktree, since this session runs inside it. When the repo's
`CLAUDE.md` names a command that removes a lane worktree, print that one command. Otherwise print
`lane remove {slug}`, `{slug}` the suffix of this checkout's folder after the main checkout's
folder name and a hyphen.

## PR landing

Only for a repo whose `CLAUDE.md` asks for PR landing. After `accept-and-merge` and § 6.1's
registered-repo items, in place of § 6.2: run `/create-pr {base}` for the title and body, then
`lane push`. With `gh` installed, open it with `gh pr create --base {base} --head {branch}`, using the
drafted title and body, and take its URL as `pr`. Without `gh`, `pr` is the host's compare URL for
`{base}...{branch}`, or `{origin url} {base}...{branch}` for a host with none; print it for the
user to open the PR. Build either from `git remote get-url origin` with any userinfo removed
(`scheme://user:token@host/…` becomes `scheme://host/…`): the record is archived for good, so a
credential written into it cannot be taken back. Set `state: pr-open` and `pr` in the record,
commit by `SKILL.md` § Scratch commit, and **stop**. The PR carries the code repo alone.

**Resume.** With `gh`, `gh pr view {pr} --json state` reads `MERGED`; without `gh`, ask the user
whether the PR merged. Never test ancestry of the lane tip in `origin/{base}`: a squash or rebase
merge breaks it. Not merged: say so and stop. Merged: `lane land {lane} --code-landed`, which lands
the extra lane repos and scratch and leaves the code base alone, by § 6.2's exit-code rules, then
§ 7. In a branch or clone lane it switches the code repo to its base without moving that base, for
the user to pull; a code repo with uncommitted changes stays on the lane branch, and its line says so.

## Abandon

No closing work, no merge review and no landing. Owner: user-decision-rubric (test: Undo).
Post what abandoning drops — every lane branch's commits, the scratch branch's issue edits among
them, stay unlanded on their branches — and wait for the user's yes. Then `lane abandon {lane}
--reason '{the user's reason, or no reason given}'`, single-quoted with each `'` in the reason
written `'\''`, so the shell expands nothing in it: it appends the `Abandoned:` line, archives
the record, pushes every lane branch, and switches a branch or clone lane's repos back to their
bases; then the switch hook. It prints a line for each `pending` repo present in the checkout and
leaves that repo as it is. Close no issue and leave every `status:` and `lane:` as it is.
