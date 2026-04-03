# Troubleshooting

<troubleshooting>
  <issue name="script-not-found">
    <symptom>scratch.mjs not found OR command not found</symptom>
    <diagnosis>
      <command>find . -name "scratch.mjs" -path "*scratch-management*"</command>
    </diagnosis>
    <fix>
      <step>Use full path to script</step>
      <step>Verify .claude/skills/scratch-management/scratch.mjs exists</step>
    </fix>
  </issue>

  <issue name="folder-not-found">
    <symptom>Folder 'X' not found in scratch/</symptom>
    <diagnosis>
      <command>ls scratch/</command>
    </diagnosis>
    <fix>
      <step>Verify folder exists: ls scratch/</step>
      <step>Folder must be direct child of scratch/ (not nested)</step>
      <step>Check spelling of folder name (case-sensitive)</step>
    </fix>
  </issue>

  <issue name="not-initialized">
    <symptom>Scratch repo not initialized / fatal: not a git repository</symptom>
    <diagnosis>
      <command>ls scratch/.git</command>
    </diagnosis>
    <fix>
      <step>Ask user for git remote URL</step>
      <step>Load protocols/initialize.md</step>
      <step>Execute Initialize Protocol (preserves existing files)</step>
    </fix>
  </issue>

  <issue name="remote-not-configured">
    <symptom>fatal: 'origin' does not appear to be a git repository</symptom>
    <diagnosis>
      <command>git -C scratch remote -v</command>
    </diagnosis>
    <fix>
      <step>Ask user for git remote URL</step>
      <command>git -C scratch remote add origin {URL}</command>
    </fix>
  </issue>

  <issue name="push-rejected">
    <symptom>failed to push / rejected / non-fast-forward</symptom>
    <diagnosis>
      <command>git -C scratch status</command>
      <command>git -C scratch log --oneline -3</command>
    </diagnosis>
    <fix>
      <step>If remote has content: git -C scratch pull --rebase origin main</step>
      <step>Then retry push: git -C scratch push origin main</step>
      <step>If conflicts: resolve manually or ask user</step>
    </fix>
  </issue>

  <issue name="branch-name-mismatch">
    <symptom>error: src refspec main does not match any</symptom>
    <diagnosis>
      <command>git -C scratch branch</command>
    </diagnosis>
    <fix>
      <command>git -C scratch branch -M main</command>
      <command>git -C scratch push -u origin main</command>
    </fix>
  </issue>

  <issue name="permission-denied">
    <symptom>Permission denied (publickey) OR Authentication failed</symptom>
    <fix>
      <step>For SSH: Check SSH key is added to GitHub/GitLab</step>
      <step>For HTTPS: Check credentials or use personal access token</step>
      <step>Test access: git ls-remote {URL}</step>
    </fix>
  </issue>

  <issue name="archive-branch-missing">
    <symptom>Archive branch doesn't exist</symptom>
    <fix>
      <step>Archive branch is auto-created on first archive command</step>
      <step>Just run: node {script} archive {folder}</step>
    </fix>
  </issue>

  <issue name="first-time-config">
    <symptom>Script prompts for project name</symptom>
    <fix>
      <step>This is normal on first run</step>
      <step>Enter project name when prompted (or accept auto-detected)</step>
      <step>Config saved to scratch/.scratch-config.json</step>
    </fix>
  </issue>
</troubleshooting>

## Quick Diagnostic Commands

```bash
# Check if scratch is a git repo
ls scratch/.git

# Check remote configuration
git -C scratch remote -v

# Check current branch
git -C scratch branch

# Check status
git -C scratch status

# Check recent commits
git -C scratch log --oneline -5
```
