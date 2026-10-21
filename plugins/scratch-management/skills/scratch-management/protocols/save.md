# Save Protocol

<protocol name="save">
  <trigger>User wants to checkpoint active work</trigger>

  <prerequisites>
    <prereq>Folder exists in scratch/</prereq>
    <prereq>Folder will continue to be used (not finished)</prereq>
  </prerequisites>

  <critical-behavior>
    Save stages the folder and commits it by path, so anything else already staged in the
    scratch index stays out of the commit. It commits on the checked-out branch, named on its
    `Branch:` line. Off a lane it never pushes, since the push of `main` is the user's. On a lane
    (`lane-methodology` § Claim) it runs § Scratch commit's mechanical steps: fetch, the catch-up
    merge of `main` and `origin/main`, the commit as `chore(scratch): save {FOLDER}`, and a plain
    push of the scratch lane branch. It saves one folder in scratch alone and touches no other
    lane repo. When a base has moved, paths staged outside the folder stop a lane
    save instead, since the merge cannot run past them.
  </critical-behavior>

  <execution>
    <step order="1">
      <action>On a lane only: screen the folder's added lines as `commit-methodology` Step 2
      does (`lane-methodology` § Git rules, secret screen): the first command's diff, and every
      file the second command lists read in full, since a new file's lines are all added lines
      and the diff leaves untracked files out. A credential-shaped file or secret pattern stops
      the save with one line naming the file.</action>
      <command>git -C scratch diff HEAD -- {FOLDER}/; git -C scratch ls-files --others --exclude-standard -- {FOLDER}/</command>
    </step>

    <step order="2">
      <action>Execute save command</action>
      <command>scratch save {FOLDER}</command>
      <expected-output>[OK] Folder saved successfully, with `Status:` naming the commit; on a
      lane with an origin, `pushed to origin/{BRANCH}`</expected-output>
      <on-conflict>A lane save that prints `conflicts in:` aborted the merge and committed
      nothing. Run the catch-up merge yourself, `git -C scratch merge --no-edit {base}` for the
      base it names, resolve it by `lane-methodology` § Git rules, catch-up merge, commit the
      merge, then run this step again. A lane save that prints `block the catch-up merge` refused
      because other paths are staged in scratch: they are another session's, so show them to the
      user and wait (`lane-methodology` § Scratch commit step 5), then run this step again. A lane
      save that prints `Catch-up merge of {base} into {BRANCH} failed:` refused on git's own
      reason, which names the files, most often uncommitted edits outside the folder that the
      merge would overwrite: those are another session's too, so show them to the user and wait
      the same way.</on-conflict>
    </step>

    <step order="3">
      <action>Verify save completed</action>
      <command>scratch list</command>
      <verify>Folder shows as [saved] not [uncommitted]</verify>
      <verify>Folder still visible in scratch/ directory</verify>
    </step>
  </execution>

  <on-success>
    Report to user, off a lane:
    "Committed {FOLDER} on local {BRANCH}, not pushed. Folder remains active and visible to agents."
    On a lane: "Committed {FOLDER} on {BRANCH} and pushed it to origin/{BRANCH}. Folder remains
    active and visible to agents." With no origin, say it was committed and not pushed.
  </on-success>

  <on-failure>
    Read troubleshooting.md for diagnosis.
    Common issues: folder not found, not initialized, git errors.
  </on-failure>
</protocol>

## When to Use Save vs Archive

| Scenario | Use Save | Use Archive |
|----------|----------|-------------|
| Still working on project | ✓ | |
| Want to checkpoint progress | ✓ | |
| Project is finished | | ✓ |
| Agents picking up old docs | | ✓ |
| Need folder hidden from agents | | ✓ |
