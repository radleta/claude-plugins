# Initialize Protocol

<protocol name="initialize">
  <trigger>User provides git URL for scratch setup OR scratch repo not initialized</trigger>

  <prerequisites>
    <prereq>User provided a git remote URL</prereq>
  </prerequisites>

  <critical-warning>
    PRESERVE ALL EXISTING FILES in scratch/.
    The git init command does NOT delete files.
    All existing folders and files MUST be included in the initial commit.
  </critical-warning>

  <execution>
    <step order="1">
      <action>Check if scratch/ directory exists</action>
      <command>ls -la scratch/ 2>/dev/null || echo "NOT_FOUND"</command>
      <if-not-found>
        <command>mkdir scratch</command>
      </if-not-found>
      <observe>Note any existing files/folders - these MUST be preserved</observe>
    </step>

    <step order="2">
      <action>Check if already initialized</action>
      <command>ls scratch/.git 2>/dev/null && echo "ALREADY_INIT"</command>
      <if-already-init>
        <action>Check if remote matches</action>
        <command>git -C scratch remote get-url origin</command>
        <if-matches>Report: "Scratch already initialized with this remote." STOP.</if-matches>
        <if-different>Ask user: "Scratch has different remote ({current}). Replace with {new}?"</if-different>
      </if-already-init>
    </step>

    <step order="3">
      <action>Initialize git repo (preserves all existing files)</action>
      <command>git -C scratch init</command>
      <verify>scratch/.git directory exists</verify>
    </step>

    <step order="4">
      <action>Add remote</action>
      <command>git -C scratch remote add origin {GIT_URL}</command>
      <verify>git -C scratch remote -v shows correct URL</verify>
    </step>

    <step order="5">
      <action>Stage all existing files</action>
      <command>git -C scratch add -A</command>
      <observe>All existing folders/files are now staged</observe>
    </step>

    <step order="6">
      <action>Create initial commit</action>
      <command>git -C scratch status --porcelain</command>
      <if-has-changes>
        <command>git -C scratch commit -m "Initial commit: existing scratch files"</command>
      </if-has-changes>
      <if-empty>
        <action>Create placeholder to enable push</action>
        <command>echo "# Scratch" > scratch/README.md</command>
        <command>git -C scratch add README.md</command>
        <command>git -C scratch commit -m "Initialize scratch repo"</command>
      </if-empty>
    </step>

    <step order="7">
      <action>Push to remote</action>
      <command>git -C scratch push -u origin main</command>
      <if-fails-branch-name>
        <command>git -C scratch branch -M main</command>
        <command>git -C scratch push -u origin main</command>
      </if-fails-branch-name>
    </step>

    <step order="8">
      <action>Verify setup complete</action>
      <command>scratch list</command>
      <verify>Command runs without "not initialized" error</verify>
      <verify>All original folders appear in list</verify>
    </step>
  </execution>

  <on-success>
    Report to user:
    "Scratch initialized with remote {GIT_URL}.
    All existing files preserved and committed.

    Folders preserved:
    - {list each folder that was in scratch/}"
  </on-success>

  <on-failure>
    Common issues:
    - Remote already exists: git -C scratch remote remove origin, then retry
    - Push rejected: Remote may have existing content, check if empty repo
    - Permission denied: Check SSH keys or HTTPS credentials
  </on-failure>
</protocol>

## URL Formats Supported

| Format | Example |
|--------|---------|
| HTTPS | `https://github.com/user/repo.git` |
| SSH | `git@github.com:user/repo.git` |
| GitLab | `https://gitlab.com/user/repo.git` |
| Azure DevOps | `https://dev.azure.com/org/project/_git/repo` |
