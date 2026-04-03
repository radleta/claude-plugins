# Archive Protocol

<protocol name="archive">
  <trigger>User wants to hide completed folder from agents</trigger>

  <prerequisites>
    <prereq>Folder exists in scratch/</prereq>
    <prereq>User confirmed folder is complete OR explicitly requested archive</prereq>
  </prerequisites>

  <critical-behavior>
    Archive moves folder to archive branch:
    - Folder will NO LONGER be visible in working tree
    - Agents will NOT be able to see or search it
    - Folder IS preserved in git (archive branch)
    - Can be viewed with: git -C scratch show archive:{FOLDER}/
  </critical-behavior>

  <execution>
    <step order="1">
      <action>Execute archive command</action>
      <command>scratch archive {FOLDER}</command>
      <expected-output>[OK] Folder archived successfully</expected-output>
    </step>

    <step order="3">
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
    Common issues: folder not found, git conflicts, push failures.
  </on-failure>
</protocol>

## Archive vs Delete

Archive does NOT delete files - it moves them to the archive branch:
- Files are preserved in git history
- Can be viewed anytime with git commands
- Can be restored if needed

To view archived folder contents:
```bash
git -C scratch show archive:{FOLDER}/README.md
git -C scratch ls-tree archive:{FOLDER}/
```
