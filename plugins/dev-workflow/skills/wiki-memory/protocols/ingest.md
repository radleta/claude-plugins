---
summary: "extract session insights and integrate them into wiki pages"
---

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

   A candidate resolves only if its `SKILL.md` carries the wiki declaration (D15) —
   `grep -q '^wiki: true' {wiki-path}SKILL.md` exits 0, the key bare, lowercase and unquoted,
   at the top level of the frontmatter block whose first line is exactly `---` (the same
   `_wiki_is_declared` test `wiki-health` applies). An undeclared skill folder is not a wiki:
   refuse rather than ingesting into it. `.mditerc` remains a required conformance artifact and
   is still `mdite`'s config, but resolving on it instead would select folders `wiki-health`
   refuses — an undeclared skill carrying a leftover `.mditerc` — and refuse folders it accepts.

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
   - **(4) Recently filed query pages** — pages recently added to this domain, enumerated from
     git: `git log --diff-filter=A --name-only --format= -20 -- {wiki-path}`. Query filing
     (WMF-D18) writes its synthesis pages through the same `wiki-write` path ingest uses, so
     they arrive as ordinary page adds in the domain's history and are not distinguishable by
     any tracked event record — nor should they be (D3/D9: what the wiki knows about itself is
     derived from the tree and its git history, never from a maintenance log). Check whether
     their content should trigger updates to related existing pages or cross-reference additions.
   - If nothing new: report "no new insights to ingest" and stop
3. **Filing-worthiness gate (per item)**: Before classifying each candidate identified in
   step 2, apply query.md's WMF-D18 filing-worthiness gate on a per-candidate basis — read
   `protocols/query.md` step 5 for the full three-criterion definition (synthesis of ≥2
   things, undocumented connection, plausible re-ask) and filing rule (file on (a AND b) OR
   (c AND (a OR b)); bias toward NOT filing when in doubt). Apply it here exactly as written,
   substituting "candidate" for "answer." This is a per-candidate gate, not a whole-session
   gate: step 2's "any new insights?" check only gates whether candidates exist at all — THIS
   gate decides, per candidate, whether each one is worth writing. A session can have some
   candidates that pass and others that don't. Candidates that fail the gate are dropped
   silently — no write, no log entry.
4. **Classify changes** (only for candidates that passed step 3):
   - **Overlap check (before deciding Create vs Update)**: Compare the candidate's likely tags
     + slug tokens against every existing `## Pages` entry in SKILL.md (link target, title,
     and one-line summary). If an existing entry shares a tag-prefix match or a clear
     slug/title token overlap with the candidate, prefer **Update** (or **Cross-reference**)
     on that overlapping page over creating a new one — even when the candidate covers a
     related-but-distinct nuance. This is a lightweight, mechanical check (tag + slug-token
     comparison against the index only) — NOT audit.md Step 5's full 3-signal system
     (tag overlap + code-block fingerprint + semantic-relatedness judgment), which stays
     reserved for audit/migrate's heavier promotion-candidate analysis.
   - **Update existing page**: New info fits an existing page's scope
   - **Create new page**: Info represents a distinct topic not covered, AND the overlap check
     above found no overlapping page
   - **Cross-reference**: New connections between existing pages
5. **Apply changes** via `wiki-write` (the sole canonical wiki-write path — no bare Edit/Write on wiki pages):
   - For each change classified in step 4, pre-write a payload markdown file with the full page body.
     The payload MUST begin with a YAML frontmatter block containing the required fields:
     `tags` and `summary`. `code-cites:` is legacy/tolerated per AD9 — do not add it to new
     payloads.
   - **Payload cleanup**: `wiki-write` never deletes its `--from` payload file, and this step
     loops over every classified change from step 4 — potentially more than one candidate per
     ingest run. A per-candidate `mktemp` path plus its own `trap 'rm -f "$payload"' EXIT` is
     safe only when each candidate's payload-create → `wiki-write` call runs in its own separate
     Bash tool invocation, since a second `trap ... EXIT` in the same shell REPLACES the first
     rather than accumulating. If payload creation for multiple candidates is instead
     consolidated into one bash script or loop, set up cleanup ONCE before the loop using
     `wiki-write.sh`'s own accumulate-array idiom (`wiki-write.sh:869-882`), then have every
     `mktemp` call append its path to the array instead of installing its own trap:
     ```bash
     _tmpfiles=()
     _cleanup_tmps() { local f; for f in "${_tmpfiles[@]:-}"; do [[ -f "$f" ]] && rm -f "$f"; done; }
     trap '_cleanup_tmps' EXIT INT TERM
     # ... per candidate:
     payload="$(mktemp)"; _tmpfiles+=("$payload")
     # ... write the classified change's payload body to "$payload" ...
     wiki-write {domain} {slug} --from "$payload" [--update]
     ```
   - **Cite via links, not frontmatter**: The auditable reference set is literal markdown links
     in the page body (AD1) — cite source paths inline (e.g.
     `[wiki-write.sh:196](../../wiki-memory/scripts/wiki-write.sh)`) reflecting the content
     actually being authored in THIS payload. For `--update`, never copy an existing page's
     stale `code-cites:` array verbatim if one is still present — write real in-prose links
     instead (same rule query.md step 5b applies to filed synthesis answers).
   - **Create new page**: `wiki-write {domain} {slug} --from {payload-file}`
     - The verb atomically installs the page and appends the new entry to `## Pages` in SKILL.md.
     - Do NOT manually edit SKILL.md to add the `## Pages` entry; the verb handles it.
   - **Update existing page**: `wiki-write {domain} {slug} --from {payload-file} --update`
     - No `## Pages` mutation occurs for updates; the entry already exists.
   - **Cross-reference links**: add inline cross-reference prose to the affected page body (in the payload
     file) before invoking `wiki-write`; the verb writes exactly what the payload contains.
   - **Exit-code handling** (mirrors query.md steps 5c-5d):

     | Exit code | Meaning | Action |
     |-----------|---------|--------|
     | `0` | Success — page written, `## Pages` updated (if created) | Continue to next candidate |
     | `2` | User/argument error: slug collision on Create (page already exists), malformed payload, missing required frontmatter field, unknown flag | **Collision on Create**: read the existing page, merge the new content into a fresh payload, retry as `wiki-write {domain} {slug} --from {payload-file} --update`. **Any other cause** (malformed payload, missing field): fix the payload and retry once; if it fails again, fall back to `learned/` below |
     | `3` | Infra error: target skill folder absent and auto-init blocked, cross-filesystem tmp dir, failed atomic rename | Fall back to `learned/` below — do not retry blindly |

     **learned/ fallback** (exit 2 after one retry, or exit 3): the candidate is too valuable
     to discard.
     - **Re-validate `{slug}` before constructing the fallback path.** The exit-2 cause may be
       the slug itself failing `wiki-write`'s own validation (not merely a collision or a
       malformed payload) — never reuse an already-rejected value in a filesystem path without
       checking it first. Apply the same allowlist `knowledge-ingestor.md`'s `target-page`
       validation uses: reject if `{slug}` is empty or whitespace-only, contains `..`, has a
       leading or trailing `/`, has more than one `/`, or contains any character outside
       `[a-z0-9/-]`.
       - **Passes**: write the payload content at
         `scratch/{project}/learned/{slug-flat}-fallback.md`, where `{slug-flat}` is `{slug}`
         with any `/` subdir separator replaced by `-` (keeps the fallback file flat inside
         `learned/` regardless of slug shape).
       - **Fails**: do NOT use the raw slug in any path or shell command. Write the fallback
         file at `scratch/{project}/learned/ingest-fallback-{timestamp}.md` instead (timestamp
         in `YYYYMMDDTHHMMSSZ` form), recording the original rejected slug value as plain text
         inside the file body only — never in a path — for manual review on the next ingest pass.
     - Use the standard knowledge-capture frontmatter schema (`type: research`,
       `status: captured`, `source: implementation/ad-hoc`, `scope: project`,
       `target-domain: {domain}`). Note the fallback in the completion report so a future
       ingest pass retries it.
6. **Report**: Name every page written (created or updated), every candidate dropped by the
   step 3 gate, and any `learned/` fallback. An ingest leaves no record of itself anywhere in
   the wiki — the pages it wrote and the commit that lands them are the record (D3/D9), so a
   write the report does not name is a write nobody can see.
