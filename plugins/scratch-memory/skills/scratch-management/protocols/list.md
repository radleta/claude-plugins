# List Protocol

<protocol name="list">
  <trigger>User asks about scratch folder status OR needs to see active/archived folders</trigger>

  <execution>
    <step order="1">
      <action>List active folders on main branch</action>
      <command>scratch list</command>
      <observe>
        Status indicators:
        - [uncommitted] = has local changes, not yet saved
        - [saved] = committed to main branch
      </observe>
    </step>

    <step order="3">
      <action>List archived folders</action>
      <command>scratch archived</command>
      <observe>These folders are hidden from agents</observe>
    </step>
  </execution>

  <report-format>
    **Active folders** (visible to agents):
    - folder1 [saved]
    - folder2 [uncommitted]

    **Archived folders** (hidden from agents):
    - old-project-1
    - old-project-2
  </report-format>

  <on-error>
    If "not initialized" error: Ask user for git URL, then load protocols/initialize.md
  </on-error>
</protocol>

## Status Indicators

| Status | Meaning | Action Needed |
|--------|---------|---------------|
| [uncommitted] | Local changes not saved | Run save to checkpoint |
| [saved] | Committed to main | None - up to date |
| (in archived list) | On archive branch | None - hidden from agents |
