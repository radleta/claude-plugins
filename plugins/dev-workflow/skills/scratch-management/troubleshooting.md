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
    <symptom>the user's push of scratch main fails: rejected / non-fast-forward</symptom>
    <diagnosis>
      <command>git -C scratch status</command>
      <command>git -C scratch log --oneline -3</command>
    </diagnosis>
    <fix>
      <step>If remote has content: git -C scratch pull --no-rebase origin main</step>
      <step>Then tell the user main now holds origin's commits and the push is the user's to retry</step>
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
      <step>Then tell the user the branch is renamed and the push is the user's</step>
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
    <symptom>Archive branch doesn't exist, or init-repo.sh reports [NONE] for it</symptom>
    <fix>
      <step>Nothing to fix: the first scratch archive {folder} creates the branch on origin</step>
      <step>init-repo.sh only tracks an archive branch origin already has; it never creates one</step>
    </fix>
  </issue>

  <issue name="archive-refused">
    <symptom>scratch archive exits 1 with one [ERROR] line</symptom>
    <fix>
      <step>The line names the cause and the next command; nothing on the checked-out branch changed</step>
      <step>"holds work {branch} does not" → save by protocols/save.md (scratch save {folder}), then rerun; --force does not bypass this</step>
      <step>"holds git-ignored files: …" → show the user the list; delete the files, or git -C scratch add -f them and save by protocols/save.md (scratch save {folder}), then rerun — or, with the user's approval, scratch archive {folder} --force, which deletes them with the folder</step>
      <step>"detached HEAD" → git -C scratch switch {branch}, then rerun</step>
      <step>"behind or diverged from origin/{branch}" → git -C scratch pull --no-rebase, then rerun</step>
      <step>"Local archive holds N commit(s)" → origin/archive lacks local archive commits and the push is the user's; report it, then rerun once they have pushed</step>
      <step>"already holds '{folder}' with tree …" → a different folder of that name is archived; rename the folder on the checked-out branch and archive the new name</step>
      <step>"Push to origin/archive was rejected" or "local archive moved during the run" → rerun scratch archive {folder}; it rebuilds on the new origin/archive, or finishes without pushing when the folder is already there</step>
    </fix>
  </issue>

  <issue name="archive-left-main-unpushed">
    <symptom>[INFO] Local {branch} holds unpushed commits after [OK] Folder archived successfully</symptom>
    <fix>
      <step>Nothing to fix: archive commits the removal on the checked-out branch and never pushes it</step>
      <step>On main, tell the user the removal commit is local and the push is the user's; on a lane branch, the lane's plain push carries it</step>
    </fix>
  </issue>

  <issue name="files-show-modified-after-lfs-routing">
    <symptom>git -C scratch status shows image or binary files modified that nobody edited</symptom>
    <diagnosis>
      <command>git -C scratch check-attr filter -- {path}</command>
    </diagnosis>
    <fix>
      <step>The file was committed as a raw blob before .gitattributes routed its path to LFS; archive no longer trips on it, but status keeps reporting it</step>
      <step>Clean up per clone, with the user's approval: git -C scratch add --renormalize . then commit</step>
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
