# Lint Workflow

`/wiki-memory lint <domain>`

Checks wiki structural integrity and content freshness.

1. **Resolve wiki path:** Resolve `{domain}` → `{skill-name}` and `{wiki-path}` via convention-based lookup:
   (a) If `.claude/skills/{domain}/SKILL.md` exists → `{skill-name} = {domain}`, `{wiki-path} = .claude/skills/{domain}/`
   (b) Else if `.claude/skills/{domain}-expert/SKILL.md` exists → `{skill-name} = {domain}-expert`, `{wiki-path} = .claude/skills/{domain}-expert/`
   (c) Else if `~/.claude/skills/{domain}/SKILL.md` exists → `{skill-name} = {domain}`, `{wiki-path} = ~/.claude/skills/{domain}/`
   (d) Else if `~/.claude/skills/{domain}-expert/SKILL.md` exists → `{skill-name} = {domain}-expert`, `{wiki-path} = ~/.claude/skills/{domain}-expert/`

   If found AND `tr -d '\r' < {wiki-path}.mditerc 2>/dev/null | grep -q '^entrypoint:[[:space:]]*SKILL\.md'` exits 0:
   - `{index-file} = SKILL.md` (the `## Pages` section is the navigation hub)
   - `{mditerc} = {wiki-path}.mditerc`

   If no matching skill found → abort: "Cannot find wiki for domain '{domain}'.
   Run `/wiki-memory init {domain}` or `/wiki-memory migrate {domain}` first."

2. **Structural lint** (if mdite available):
   - Run `mdite lint` against `{wiki-path}` using the `.mditerc` found in step 1
   - Report: orphan pages, broken links, missing entrypoint
   - If mdite not available: skip structural lint, report it was skipped
3. **Frontmatter checks**: For each `*.md` page in `{wiki-path}` (excluding `SKILL.md`,
   `log.md`, `schema.md`):
   - Verify `tags`, `summary` frontmatter fields present
   - Report missing fields per page
4. **Staleness detection**: For each page, determine last-modified time:
   - Primary: run `git log -1 --format=%ad -- <file>` and parse the commit date
   - Fallback (file untracked or not in a git repo): use filesystem mtime
   - Flag pages with last-modified older than 90 days as potentially stale
   - Compare against recent log.md entries — pages not mentioned since newer ingests may have
     outdated info
5. **Stale claims check**: Cross-reference page last-modified times against `log.md` ingest entries:
   - If a page hasn't been modified since a newer ingest touched related topics, flag for review
6. **Log the operation**: Append to `{wiki-path}/log.md`:
   ```markdown
   ## [{today}] lint | Health check
   - Structural: {pass/N issues}
   - Frontmatter: {pass/N missing}
   - Staleness: {N pages flagged}
   ```
7. **Report**: Summary of findings with specific file references for each issue
