# Archive Protocol

<protocol name="archive">
  <trigger>User wants to hide completed folder from agents</trigger>

  <prerequisites>
    <prereq>Folder exists in scratch/</prereq>
    <prereq>On a lane's branch, the folder's work is done: archive it and record the archive in the lane record's `## Decisions made`. Owner: agent (user-decision-rubric). On `main`, the user confirmed the folder is complete or asked for the archive, since its removal is a base commit. Owner: user-decision-rubric `base-and-history`</prereq>
    <prereq>Folder is committed and clean on the checked-out branch (no untracked or modified files) — otherwise save it by protocols/save.md (scratch save {FOLDER})</prereq>
    <prereq>Folder holds no git-ignored files — otherwise the archive refuses and lists them. Delete them, or git -C scratch add -f them and save by protocols/save.md (scratch save {FOLDER}); or, with the user's approval, run scratch archive {FOLDER} --force, which deletes them with the folder. Owner: user-decision-rubric `base-and-history`</prereq>
    <prereq>scratch/ is on a branch (`main`, or a lane's `lane/{lane}`), and that branch is not behind its upstream — otherwise run: git -C scratch pull --no-rebase. A branch with no upstream, and a scratch repo with no remote, skip this check</prereq>
  </prerequisites>

  <critical-behavior>
    Archive moves folder to archive branch:
    - Folder will NO LONGER be visible in working tree
    - Agents will NOT be able to see or search it
    - Folder IS preserved in git (archive branch)
    - Can be viewed with: git -C scratch show archive:{FOLDER}/

    Archive never switches branches. It builds the archive commit from the checked-out
    branch's committed tree, so no file outside the folder, and no index entry outside it, changes. Another
    session's uncommitted or staged work stays exactly as it was.

    Archive pushes the archive commit to origin/{archive branch} itself: that push is this
    command's mechanism, the backup that keeps the next archive's local-archive-ahead
    refusal from firing. With no origin it builds the local archive branch and pushes
    nothing. It commits the folder's removal on the checked-out branch, named on its
    `Branch:` line, and never pushes that branch; on `main` the push is the user's, and on a
    lane branch it is the lane's plain push (`lane-methodology` § Scratch commit).
  </critical-behavior>

  <execution>
    <step order="0">
      <action>Pre-archive knowledge gate</action>
      <command>learned-check status scratch/{FOLDER}/learned/</command>
      <gate>
        If learned/ directory does not exist → skip gate, proceed to step 1.
        If exit code 0 → proceed to step 1 (archive).
        If exit code 1 → dispatch knowledge-ingestor agent for learned/, then re-run this check (max 2 retries). If still exit code 1 after max retries → escalate to user (same as exit code 2).
        If exit code 2 → present escalated items to user, wait for resolution before proceeding: the
        captures leave with the archive. Owner: user-decision-rubric `persons-hand` for a
        `cannot-verify` item; Owner: user-decision-rubric (test: Conflict) for `sources-disagree`.
      </gate>
    </step>

    <step order="1">
      <action>Execute archive command</action>
      <command>scratch archive {FOLDER}</command>
      <expected-output>[OK] Folder archived successfully</expected-output>
      <gate>
        Exit 0 → the archive is done; tell the user the branch on the `Branch:` line holds
        the unpushed removal commit.
        Exit 1 → the one [ERROR] line names the cause and the next command; nothing on
        the checked-out branch changed. Run that command (or ask the user when it needs their decision),
        then rerun scratch archive {FOLDER}. A line saying the push is the user's waits on
        the user: report it, and rerun once they have pushed. A refusal over git-ignored
        files always needs the user's decision: show them the listed files, since --force
        deletes them. Owner: user-decision-rubric `base-and-history`
      </gate>
    </step>

    <step order="2">
      <action>Verify archive completed</action>
      <verify>Folder no longer in scratch/ directory: ls scratch/</verify>
      <verify>Folder appears in archived list: scratch archived</verify>
    </step>
  </execution>

  <on-success>
    Report to user:
    "Archived {FOLDER}. Folder is now hidden from agents but preserved in archive branch.
    To view: git -C scratch show archive:{FOLDER}/"
  </on-success>

  <on-failure>
    Read troubleshooting.md for diagnosis.
    Archive refuses, exit 1, when: the folder holds unsaved work; scratch/ is on a detached
    HEAD; the checked-out branch is behind or diverged from its upstream; origin is set but
    unreachable; the folder holds git-ignored files and
    --force was not given; the local archive branch holds commits
    origin/archive lacks; origin/archive already holds the folder with a different tree; or
    the archive push is rejected because another clone pushed first.
  </on-failure>
</protocol>

## Archive vs Delete

Archive moves the folder's committed files to the archive branch:
- Files are preserved in git history
- Can be viewed anytime with git commands
- Can be restored if needed

The one exception is `--force`: it permanently deletes the folder's git-ignored files. They were
never committed, so they are not on the archive branch and cannot be restored. Say so when asking
the user to approve `--force`.

To view archived folder contents:
```bash
git -C scratch show archive:{FOLDER}/README.md
git -C scratch ls-tree archive:{FOLDER}/
```
