# Ingest Workflow

`/wiki-memory ingest <domain>`

Extracts insights from the current session and integrates them into the wiki. Ingestion
sources include direct session observations, architectural decisions, corrections to
existing knowledge, and query-derived synthesis answers filed via the query-filing branch
(WMF-D18) — all of these count as ingest-eligible content.

0. **Step 0 — resolve domain to skill folder**:
   Resolve `{domain}` → `{skill-name}` and `{wiki-path}` using convention-based lookup:
   (a) If `.claude/skills/{domain}/SKILL.md` exists → `{skill-name} = {domain}`, `{wiki-path} = .claude/skills/{domain}/`
   (b) Else if `.claude/skills/{domain}-expert/SKILL.md` exists → `{skill-name} = {domain}-expert`, `{wiki-path} = .claude/skills/{domain}-expert/`
   (c) Else if `~/.claude/skills/{domain}/SKILL.md` exists → `{skill-name} = {domain}`, `{wiki-path} = ~/.claude/skills/{domain}/`
   (d) Else if `~/.claude/skills/{domain}-expert/SKILL.md` exists → `{skill-name} = {domain}-expert`, `{wiki-path} = ~/.claude/skills/{domain}-expert/`
   (e) Else abort: domain not found.

   Verify `tr -d '\r' < {wiki-path}.mditerc 2>/dev/null | grep -q '^entrypoint:[[:space:]]*SKILL\.md'` exits 0.

   **Ingest precondition (D5)**: Confirm `{wiki-path}SKILL.md` exists AND
   contains a `## Pages` heading.
   - If SKILL.md has no `## Pages` heading → append a `## Pages` section (with a blank line
     and a placeholder comment) before continuing; do not silently overwrite other content.
   - If `{wiki-path}` does not exist at all → refuse: "Skill folder not found.
     Run `/wiki-memory init {domain}` first."

1. **Read current state**: Read `{wiki-path}SKILL.md` to understand existing
   `## Pages` entries and structure.
2. **Identify new knowledge**: Review the current conversation for:
   - New facts, patterns, or architectural decisions
   - Corrections to existing knowledge
   - New connections between existing topics
   - **(4) Recently filed query pages** — entries in `log.md` with operation type `query-filing`
     since the last ingest log entry. These are query-derived synthesis pages (per WMF-D18)
     that count as ingest-eligible content. Check whether their content should trigger
     updates to related existing pages or cross-reference additions.
   - If nothing new: report "no new insights to ingest" and stop
3. **Classify changes**:
   - **Update existing page**: New info fits an existing page's scope
   - **Create new page**: Info represents a distinct topic not covered
   - **Cross-reference**: New connections between existing pages
4. **Apply changes** via `wiki-write` (the sole canonical wiki-write path — no bare Edit/Write on wiki pages):
   - For each change classified in step 3, pre-write a payload markdown file with the full page body.
     The payload MUST begin with a YAML frontmatter block containing all required fields:
     `tags`, `summary`, and `code-cites: []` (empty list is valid for principle pages).
   - **Create new page**: `wiki-write {domain} {slug} --from {payload-file}`
     - The verb atomically installs the page and appends the new entry to `## Pages` in SKILL.md.
     - Do NOT manually edit SKILL.md to add the `## Pages` entry; the verb handles it.
   - **Update existing page**: `wiki-write {domain} {slug} --from {payload-file} --update`
     - No `## Pages` mutation occurs for updates; the entry already exists.
   - **Cross-reference links**: add inline cross-reference prose to the affected page body (in the payload
     file) before invoking `wiki-write`; the verb writes exactly what the payload contains.
5. **Log the operation**: Append entry to `{wiki-path}log.md`:
   ```markdown
   ## [{today}] ingest | {brief description}
   - Updated: {page}.md ({what changed})
   - New page: {page}.md
   - Pages index updated: +{n} entries in SKILL.md ## Pages
   ```
6. **Lint cadence check**: If 10+ ingests since last lint (count `## [` entries with `ingest`
   in log.md), recommend running `/wiki-memory lint {domain}`
