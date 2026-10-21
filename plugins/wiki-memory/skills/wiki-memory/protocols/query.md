---
page-kind: procedure
summary: "answer questions using wiki knowledge with index-first navigation"
---

# Query Workflow

Reached when an agent answers a question from a domain, index-first.

Answers questions using wiki knowledge, with index-first navigation. It is a read path: its one
page write is step 3c's drift-fix correction, and a synthesis worth keeping leaves as a `learned/`
capture for `knowledge-ingestor`.

1. **Resolve wiki path**: Resolve `{domain}` → `{skill-name}` and `{wiki-path}` via convention-based lookup:
   (a) If `.claude/skills/{domain}/SKILL.md` exists → `{skill-name} = {domain}`, `{wiki-path} = .claude/skills/{domain}/`
   (b) Else if `.claude/skills/{domain}-expert/SKILL.md` exists → `{skill-name} = {domain}-expert`, `{wiki-path} = .claude/skills/{domain}-expert/`
   (c) Else if `~/.claude/skills/{domain}/SKILL.md` exists → `{skill-name} = {domain}`, `{wiki-path} = ~/.claude/skills/{domain}/`
   (d) Else if `~/.claude/skills/{domain}-expert/SKILL.md` exists → `{skill-name} = {domain}-expert`, `{wiki-path} = ~/.claude/skills/{domain}-expert/`
   (e) Else abort: domain not found — suggest `/wiki-init {domain}`.
   Load `{wiki-path}SKILL.md` as the wiki index.
2. **Read index**: Read the `## Pages` section of `SKILL.md` to identify relevant pages.
3. **Drill into pages — full JIT read-gate (D12/D17)**: Read the most relevant pages (typically
   1-3). Before synthesizing from each page, run the full mechanical bundle on exactly the pages
   about to be surfaced (and every page the answer plans to lift from) — never a whole-domain
   audit. `mdite` and `churn-check` run immediately on this main-session path.

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
   - `stale-timestamp`: optionally re-run with `--deep --json` for a semantic
     confirmation. If `--deep` confirms drift (or `--deep` is skipped and the mechanical signal
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
   Both `mdite` calls are grounded via the unconditional `cd "{wiki-path}"` subshell shown
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
     --from {payload} --update` (payload mechanics below), rewriting the stale claim in place with
     contradicting-evidence provenance (page, short quote of the removed claim, the
     contradicting commit SHA or path) recorded in the trailer and in the git diff of the
     correcting write itself — never a body annotation, never deletion, and never a separate
     provenance file. Proceed to step 4 using the corrected content. Emit the
     **Drift-corrected** trailer below at report time.
   - **`misleading` → escalate, no edit**: do NOT silently lift the page's content. Write
     `learned/drift-{page-name}.md` (knowledge-capture schema: `type: drift`, `severity:
     misleading`, `escalation-reason:` populated with the applicable D16 rationale —
     interpretive / multi-fact / judgment-required / uncertain-default; a collision with an
     existing same-session drift file gets a uniqueness suffix per `lint.md` Step 6's
     convention). Skip normal synthesis for this page; emit the **Drift-detected** trailer
     below instead — do not silently lift.

   **Payload mechanics** for the `minor` write. Write the corrected page to a `mktemp` payload
   file, guarded by a `trap` so it is removed once this query run ends (success or failure) —
   `wiki-write` never deletes its `--from` payload itself:

   ```bash
   payload="$(mktemp)"
   trap 'rm -f "${payload:?}"' EXIT
   ```

   - The payload is the full existing body, read, merged and written back, under a YAML
     frontmatter block. `tags:` and `summary:` are required on every call — `wiki-write`
     validates their presence unconditionally. `code-cites:` is legacy/tolerated per AD9; do not
     add it, and never copy an existing page's stale `code-cites:` array verbatim.
   - The auditable reference set is literal markdown links in the body (AD1): the file in the
     link, a stable token and never a line number in the anchor text.
   - Per-domain `schema.md` may require additional frontmatter fields.
   - `wiki-write` exit `0` → the page is corrected. Exit `2` (malformed payload, missing
     `tags:`/`summary:`, unknown flag) or `3` (infrastructure) → the correction did not land;
     write the payload as `scratch/{project}/learned/{slug}-fallback.md` with the knowledge-capture
     frontmatter (`type: drift`, `status: captured`, `source: implementation/ad-hoc`,
     `scope: project`, `target-domain: {domain}`, `severity: minor`), say so in prose, and emit no
     `Drift:` line.

   **Trailers.** They are this protocol's own — `researcher/output-format.md` does not define them:

   - **Drift-corrected** (the `minor` write exited `0` — the page was corrected in place):
     ```
     Drift: <domain>/<slug>
     Source: wiki+verified
     ```
   - **Drift-detected** (a page assessed `misleading`; no page edit applied):
     ```
     Source: wiki+verified
     ```
     No `Drift:` line; the drift `learned/` file location is described in prose.
   - A read with no finding emits no trailer.

   **Check-only (D17):** a clean mechanical bundle pass (fresh/unknown-uncomputable freshness +
   clean mdite + clean churn-check, for every surfaced page) writes NOTHING — reads stay pure
   reads. `last-verified` bumps come only from sweep/groom deep-confirms, never from this
   read-gate.
4. **Synthesize answer**: Combine information from pages to answer the question.
5. **Report**: Present the synthesized answer.

**A synthesis worth keeping** — one this protocol's answer found and no page states — becomes a
`learned/` capture, written under `knowledge-capture` § Capture Heuristic, and then `/ingest`, so
`knowledge-ingestor` decides under [`page-standard.md`](../page-standard.md) `## Admission` whether
and where it lands. This protocol files no page of its own.
