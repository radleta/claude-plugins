---
summary: "answer questions using wiki knowledge with index-first navigation"
---

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
3. **Drill into pages — full JIT read-gate (D12/D17)**: Read the most relevant pages (typically
   1-3). Before synthesizing from each page, run the full mechanical bundle on exactly the pages
   about to be surfaced (and every page the answer plans to lift from) — never a whole-domain
   audit. Unlike researcher's read path (Bash-hook-restricted), `query.md`'s main-session path is
   unrestricted: `mdite` and `churn-check` run immediately, no hook-whitelist admission gate
   applies here.

   3a. **Group-aware freshness** (per surfaced page):
   ```bash
   wiki-health freshness {skill-name} {page-slug} --quiet
   ```
   Status values: `fresh`, `stale-timestamp`, `unknown`. Group-subdirectory pages resolve to a
   real status now that the freshness group-page extension has landed — `unknown` is reserved
   for the genuinely uncomputable case (no external reference — neither a legacy `code-cites:`
   value nor an external md-link, per AD1/AD9 — or a git-log miss), never a blanket group-page
   no-op.
   - `fresh` or `unknown`: no drift signal from this leg for this page.
   - `stale-timestamp`: optionally re-run with `--deep --json` for a Tier-2 semantic
     confirmation. If `--deep` confirms drift (or `--deep` is skipped and the Tier-1 signal
     alone is treated as confirmed), this page carries a finding — fold into 3c below.

   3b. **Structural + churn bundle** (once per resolved domain, scoped to this read-gate
   invocation — not an independent audit sweep):
   ```bash
   (cd "{wiki-path}" && mdite lint . --entrypoint SKILL.md --format json)
   mdite_lint_rc=$?
   (cd "{wiki-path}" && mdite files --orphans --format json)
   mdite_orphans_rc=$?
   churn-check "{skill-name}" --json
   churn_rc=$?
   ```
   Both `mdite` calls MUST be grounded via the unconditional `cd "{wiki-path}"` subshell shown
   above — `mdite files --orphans` takes no path argument and always operates on cwd (not merely
   a README-default entrypoint), so an ungrounded call, or a `--config`-only call left
   ungrounded, silently audits the wrong graph rather than the target wiki. `--config
   {wiki-path}.mditerc` may additionally be passed for rule customization but is never a
   substitute for `cd`. `--format json` makes a clean pass mechanically distinguishable from a
   findings pass (empty `[]` array vs. a populated array) — a plain-text `mdite lint` prints a
   non-empty human-readable summary even when clean, which cannot be parsed as "empty = clean".

   Read exit codes per the `mdite` wrapper's own remap contract — never mdite's native exit
   value:
   - Wrapper exit `0` → mdite ran; parse the JSON array on stdout (`[]` = clean for that leg,
     non-empty array = findings: broken links/missing entrypoint from `lint`, orphan pages from
     `files --orphans`).
   - Wrapper exit `69` (`EX_UNAVAILABLE`) → mdite unavailable for that leg; skip it, report
     "integrity check skipped" for the mdite legs — never report a false "verified clean".
   - `churn-check` exit `0` = clean, `1` = churn found (parse `--json` for the itemized
     `{target, kind: "code-cite"|"md-link", contradicting-sha}` list regardless of exit code),
     `2`+ = bad input (internal inconsistency — step 1 already validated the skill).

   3c. **Assign severity for each surfaced page carrying a finding** (a confirmed
   `stale-semantic` from 3a, a mdite finding naming the page, or a churn-check hit on the page's
   own `code-cites` or as an md-link target) — per the D16 Decision Table, the loop's safety
   boundary (a `minor` assignment authorizes an unattended write, so default-deny under
   uncertainty):

   | Severity | Definition | Routing |
   |----------|-----------|---------|
   | `minor` | A single mechanically-verifiable fact with direct contradicting evidence (commit SHA, dead path) whose correction is deterministic | fix before use (`wiki-write --update`) |
   | `misleading` | Anything interpretive, multi-fact, or where the correction itself requires judgment | escalate, no edit |
   | _uncertain_ | **DEFAULT TO MISLEADING** | escalate |

   - **`minor` → fix before use**: correct the page via `wiki-write {skill-name} {page-slug}
     --from {payload} --update` (payload mechanics per step 5b — full existing body
     read-merge-written, `tags:`/`summary:` required on every call — `code-cites:` is
     legacy/tolerated per AD9, not required), rewriting the stale claim in place with
     contradicting-evidence provenance (page, short quote of the removed claim, the
     contradicting commit SHA or path) recorded in the trailer and in the git diff of the
     correcting write itself — never a body annotation, never deletion, and never a separate
     provenance file. Proceed to step 4 using the corrected content. Emit the
     **Drift-corrected path** trailer (step 5e) at report time.
   - **`misleading` → escalate, no edit**: do NOT silently lift the page's content. Write
     `learned/drift-{page-name}.md` (knowledge-capture schema: `type: drift`, `severity:
     misleading`, `escalation-reason:` populated with the applicable D16 rationale —
     interpretive / multi-fact / judgment-required / uncertain-default; a collision with an
     existing same-session drift file gets a uniqueness suffix per `lint.md` Step 6's
     convention). Skip normal synthesis for this page; route to the **Drift-detected path**
     (step 5e) instead — do not silently lift.

   **Check-only (D17):** a clean mechanical bundle pass (fresh/unknown-uncomputable freshness +
   clean mdite + clean churn-check, for every surfaced page) writes NOTHING — reads stay pure
   reads. `last-verified` bumps come only from sweep/groom deep-confirms, never from this
   read-gate.
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
No staging; the page write itself has no lock file and is last-writer-wins per D34. On
create (no `--update`, the common case for filing), `wiki-write` internally serializes its
`## Pages` nav-list update with its own mkdir-based mutex — this protocol needs no lock or
guard of its own around the call, `wiki-write` owns that race.

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
      auto-init it (permitted for project scope per D40).

5b. **Pre-write payload**:
    Write the synthesized answer to a `mktemp` payload file, guarded by a `trap` so it is
    removed once this query run ends (success or failure) — `wiki-write` never deletes its
    `--from` payload itself:

    ```bash
    payload="$(mktemp)"
    trap 'rm -f "$payload"' EXIT
    ```

    The payload MUST include a valid YAML frontmatter block with these required fields:

    ```yaml
    ---
    tags: [{domain}/{subtopic}]
    summary: "One-line description of the synthesized answer"
    ---
    ```

    - `tags:` and `summary:` are the only required frontmatter fields — `wiki-write` validates
      their presence unconditionally on both create and update paths. `code-cites:` is
      legacy/tolerated per AD9; do not add it to new payloads.
    - The auditable reference set is literal markdown links in the answer body (AD1) — cite
      source paths inline (e.g. `[UserRepository.cs:42](../../path/to/UserRepository.cs)`)
      rather than in a frontmatter array. For `--update` of an existing page, synthesize the
      links from the content actually being authored — never copy an existing page's stale
      `code-cites:` array verbatim if one is still present.
    - Write the synthesized answer body after the frontmatter.
    - Per-domain `schema.md` may require additional frontmatter fields.

5c. **Invoke `wiki-write` verb**:
    ```bash
    wiki-write <domain> <slug> --from "$payload" [--update] [--scope project|user]
    ```
    - Omit `--update` when creating a new page slug (collision → exit 2 without it).
    - Pass `--update` when the slug already exists and the intent is to extend or correct it.
      Use `--update` only on 3-filter clear-pass findings where the existing page is known.
    - Pass `--scope project` when classification resolved to project scope.
    - Capture exit code and stdout.

5d. **Handle exit codes**:

    | Exit code | Meaning | Action |
    |-----------|---------|--------|
    | `0` | Success — page written, `## Pages` updated (if created) | Emit trailer (step 5e) |
    | `2` | User/argument error: slug collision without `--update`, malformed payload, missing `tags:`/`summary:`, unknown flag | Fall back to `learned/` (emit-fallback-learned path; see below) |
    | `3` | Infra error: target skill folder absent and auto-init blocked, cross-filesystem tmp dir, failed atomic rename | Same fallback as exit 2 |

    **emit-fallback-learned path** (exit 2 or 3): the synthesis is too valuable to discard.
    Write the payload content as a `learned/` file at `scratch/{project}/learned/{slug}-fallback.md`
    using the existing knowledge-capture frontmatter schema
    (`type: research`, `status: captured`, `source: implementation/ad-hoc`,
    `scope: project`, `target-domain: {domain}`). Preserve the full synthesized answer body.
    Emit the fallback trailer (step 5e fallback path).

5e. **Emit trailer** (per the trailer schema — D20):

    **Success path** (exit 0, wiki page created):
    ```
    Wiki: <domain>/<slug> (created)
    Source: live
    ```

    **Success path** (exit 0, wiki page updated via `--update`):
    ```
    Wiki: <domain>/<slug> (updated)
    Source: live
    ```

    **Fallback path** (exit 2 or 3 — `wiki-write` failed; fallback `learned/` written):
    ```
    Source: live
    ```
    *(no `Wiki:` line — no wiki page was created; the fallback `learned/` file location is
    described in prose. Orchestrators distinguish fallback from a true wiki-file write by
    checking for the presence of at least one `^Wiki: ` line)*

    **Drift-corrected path** (exit 0, `wiki-write --update` succeeded on step 3c's `minor` →
    fix-before-use branch — the existing page was corrected in place, not created or filed
    anew):
    ```
    Drift: <domain>/<slug>
    Source: wiki+verified
    ```
    *(no `Wiki:` line — matches researcher's own `Drift:` trailer line, output-format.md D20)*

    **Drift-detected path** (wiki page found stale/misleading during step 3's read-gate —
    freshness, mdite, or churn-check — and assessed `misleading` per the D16 criteria; no page
    edit applied):
    ```
    Source: wiki+verified
    ```
    *(no `Wiki:`/`Issue:`/`Drift:` lines — the drift `learned/` file location is described in
    prose per output-format.md's Prose-Content Rules)*

    **Investigation-incomplete path** (context fill ≥80% mid-investigation; step 5 not reached):
    ```
    Source: live
    ```
    *(no `Wiki:`/`Issue:`/`Drift:` lines; prose states the investigation is incomplete and
    references any partial notes written)*

    **Ephemeral path** (step 5 decision = skip; no filing):
    *No trailer emitted.* Response ends with prose answer only.

---

6. **If filing**: note the new page slug and wiki-path in the response.
7. **Report**: Present the synthesized answer. If filed, note the new page.
