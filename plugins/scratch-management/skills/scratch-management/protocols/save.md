# Save Protocol

<protocol name="save">
  <trigger>User wants to checkpoint active work</trigger>

  <prerequisites>
    <prereq>Folder exists in scratch/</prereq>
    <prereq>Folder will continue to be used (not finished)</prereq>
  </prerequisites>

  <execution>
    <step order="1">
      <action>Execute save command</action>
      <command>scratch save {FOLDER}</command>
      <expected-output>[OK] Folder saved successfully</expected-output>
    </step>

    <step order="2">
      <action>Verify save completed</action>
      <command>scratch list</command>
      <verify>Folder shows as [saved] not [uncommitted]</verify>
      <verify>Folder still visible in scratch/ directory</verify>
    </step>
  </execution>

  <on-success>
    Report to user:
    "Saved {FOLDER} to main branch. Folder remains active and visible to agents."
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
