# Query Workflow

`/wiki-memory query <domain> <question>`

Answers questions using wiki knowledge, with index-first navigation. The query operation
**may write** a new wiki page when the synthesis answer meets filing-worthiness criteria
(WMF-D18). The filing write path uses the `wiki-write` verb for atomic, last-writer-wins
consistency (D34 — staging is fully retired).

**Read-path branch (steps 1–5, default):**

1. **Resolve wiki path**: Resolve `{domain}` → `{skill-name}` and `{wiki-path}` via convention-based lookup:
   (a) If `.claude/skills/{domain}/SKILL.md` exists → `{skill-name} = {domain}`, `{wiki-path} = .claude/skills/{domain}/`
   (b) Else if `.claude/skills/{domain}-expert/SKILL.md` exists → `{skill-name} = {domain}-expert`, `{wiki-path} = .claude/skills/{domain}-expert/`
   (c) Else if `~/.claude/skills/{domain}/SKILL.md` exists → `{skill-name} = {domain}`, `{wiki-path} = ~/.claude/skills/{domain}/`
   (d) Else if `~/.claude/skills/{domain}-expert/SKILL.md` exists → `{skill-name} = {domain}-expert`, `{wiki-path} = ~/.claude/skills/{domain}-expert/`
   (e) Else abort: domain not found — suggest `/wiki-memory init {domain}`.
   Load `{wiki-path}SKILL.md` as the wiki index.
2. **Read index**: Read the `## Pages` section of `SKILL.md` to identify relevant pages.
3. **Drill into pages**: Read the most relevant pages (typically 1-3)
4. **Synthesize answer**: Combine information from pages to answer the question
5. **Assess filing worthiness** (WMF-D18): Evaluate whether to file the answer as a new
   wiki page using these three criteria:
   - **(a)** Answer synthesizes ≥ 2 existing pages (not a single-page lookup)
   - **(b)** Answer reveals an undocumented connection or pattern not explicit in any single page
   - **(c)** Question would plausibly be asked again (not highly session-specific)

   **File when (a) AND (b), OR when (c) AND (a or b).** Criterion (c) alone is insufficient
   — broad applicability without novel synthesis is over-filing. When in doubt, do not file
   (per llm-wiki-expert principle 5: bias toward NOT filing rather than over-filing).
   **Skip if none hold** (simple lookup from one page, or (c) alone) → go to step 7.

---

**Filing branch (steps 5a–5e):** Only entered when step 5 decision = "File".
This branch is a write-path operation that invokes the `wiki-write` verb for atomic writes.
No staging, no lock files, no concurrency guards — last-writer-wins per D34.

5a. **Resolve target scope**:
    Apply researcher's three-filter + classification override rules (D33/D38):
    - Citation-based primary classification: if the synthesized answer cites internal project
      paths (`.claude/`, project-local files), the finding is **project-specific** →
      target `.claude/skills/{skill-name}/`.
    - Judgment-based fallback: if no clear citation anchor, assess whether the insight is
      project-specific (unique to this codebase) or domain-generic (applicable across projects).
    - **Citation override**: if judgment proposed `domain-generic` but the content references
      internal paths, override to `project-specific`.
    - Project-specific → target `.claude/skills/{skill-name}/` (project scope).
    - Domain-generic → probe `.claude/skills/{domain}-expert/` first; if found, use project
      scope. Otherwise probe `~/.claude/skills/{domain}-expert/`. NEVER auto-init at user scope.
    - When the target domain folder does not exist at project scope, `wiki-write` will
      auto-init it (permitted for project scope per D6).

5b. **Pre-write payload**:
    Write the synthesized answer to a temporary payload file (e.g., `/tmp/query-payload-{slug}.md`).
    The payload MUST include a valid YAML frontmatter block with these required fields:

    ```yaml
    ---
    tags: [{domain}/{subtopic}]
    summary: "One-line description of the synthesized answer"
    code-cites: [path/to/cited-file.md, path/to/other.md]
    ---
    ```

    - `code-cites:` is required; use `[]` for principle pages that cite no specific code paths.
    - For `--update` of an existing page: synthesize `code-cites:` from the content being
      authored — NEVER copy existing page frontmatter verbatim (it may be missing the field
      or be stale).
    - Write the synthesized answer body after the frontmatter.
    - Per-domain `schema.md` may require additional frontmatter fields.

5c. **Invoke `wiki-write` verb**:
    ```bash
    wiki-write <domain> <slug> --from /tmp/query-payload-{slug}.md [--update] [--scope project|user]
    ```
    - Omit `--update` when creating a new page slug (collision → exit 2 without it).
    - Pass `--update` when the slug already exists and the intent is to extend or correct it.
      Use `--update` only on 3-filter clear-pass findings where the existing page is known.
    - Pass `--scope project` when classification resolved to project scope.
    - Capture exit code and stdout.

5d. **Handle exit codes**:

    | Exit code | Meaning | Action |
    |-----------|---------|--------|
    | `0` | Success — page written, `## Pages` updated (if created), `log.md` appended | Emit trailer (step 5e) |
    | `2` | User/argument error: slug collision without `--update`, malformed payload, missing `code-cites:`, unknown flag | Fall back to `learned/` (emit-fallback-learned path; see below) |
    | `3` | Infra error: target skill folder absent and auto-init blocked, cross-filesystem tmp dir, failed atomic rename | Same fallback as exit 2 |

    **emit-fallback-learned path** (exit 2 or 3): the synthesis is too valuable to discard.
    Write the payload content as a `learned/` file at `scratch/{project}/learned/{slug}-fallback.md`
    using the existing knowledge-capture frontmatter schema
    (`type: research`, `status: captured`, `source: implementation/ad-hoc`,
    `scope: project`, `target-domain: {domain}`). Preserve the full synthesized answer body.
    Emit the fallback trailer (step 5e fallback path).

5e. **Emit trailer** (per researcher output-format.md trailer schema — D20):

    **Success path** (exit 0, wiki page created):
    ```
    Wrote: <absolute-path-to-wiki-page>
    Status: filed
    Source: live
    Filing: <domain>/<slug> (created)
    ```

    **Success path** (exit 0, wiki page updated via `--update`):
    ```
    Wrote: <absolute-path-to-wiki-page>
    Status: filed
    Source: live
    Filing: <domain>/<slug> (updated)
    ```

    **Fallback path** (exit 2 or 3 — `wiki-write` failed; fallback `learned/` written):
    ```
    Wrote: <absolute-path-to-learned-file>
    Status: filed
    Source: live
    ```
    *(no `Filing:` lines — no wiki page was created; orchestrators distinguish fallback from
    true wiki-file write by checking for the presence of at least one `^Filing: ` line)*

    **Drift-detected path** (wiki page found stale during step 3 freshness check):
    ```
    Wrote: <absolute-path-to-drift-learned-file>
    Status: drift-detected
    Source: wiki+verified
    ```
    *(no `Filing:` lines)*

    **Investigation-incomplete path** (context fill ≥80% mid-investigation; step 5 not reached):
    ```
    Status: investigation-incomplete
    Source: live
    ```
    *(no `Wrote:` if no partial notes written; no `Filing:` lines)*

    **Ephemeral path** (step 5 decision = skip; no filing):
    *No trailer emitted.* Response ends with prose answer only.

---

6. **If filing**: note the new page slug and wiki-path in the response.
7. **Report**: Present the synthesized answer. If filed, note the new page.
