# Groom Workflow — Tier-2 semantic maintenance pass

`/wiki-memory groom <domain> [--all]`

Runs a manual, judgment-driven maintenance pass on a wiki domain. Groom is the single
consented place an agent performs semantic wiki maintenance (D15) — it never auto-runs and
nothing recommends it unasked; the `large-drift` signal reaches the user only inside a `lint`
or `audit` run they asked for (D6). This protocol reuses the existing `wiki-memory`
`protocols/lint.md` mechanical baseline verbatim (DRY, D3's "one remediation path for all
staleness") and layers the semantic work only Tier-2 is trusted to do on top of it: full
semantic lint, cross-page contradiction scan, rewrite-in-place supersession corrections,
archive-tier retirement, and an advisory nudge for inline-code path mentions.

**Never delete (D4):** every remediation below is a rewrite-in-place (AD6) or an archive-tier
move (Step 5a, AD8). No wiki content or file is ever removed by this protocol.

---

## Step 1 — Resolve target domain(s)

**Single domain:** resolve `{domain}` → `{skill-name}` / `{wiki-path}` via the same
convention-based lookup `lint.md` Step 1 uses: (a) `.claude/skills/{domain}/SKILL.md`, (b)
`.claude/skills/{domain}-expert/SKILL.md`, (c)/(d) the equivalent `~/.claude/skills/` user-scope
paths — each gated on the wiki declaration, `wiki: true` in that `SKILL.md`'s frontmatter. If no
matching skill resolves →
abort: "Cannot find wiki for domain '{domain}'. Run `/wiki-memory init {domain}` or
`/wiki-memory migrate {domain}` first."

**`--all`:** enumerate every wiki domain via the same dual-scope glob `wiki-memory` `SKILL.md`'s
Show Workflow uses — glob `.claude/skills/*/` (project) and `~/.claude/skills/*/` (user),
keeping only folders whose `SKILL.md` declares `wiki: true` (`grep -q '^wiki: true'`, the key bare
and lowercase inside the frontmatter block). Use the declaration, not `.mditerc`: `.mditerc` is a
conformance artifact, and Step 9's `wiki-health` call resolves a domain by the declaration alone —
a folder selected on `.mditerc` that has not declared itself is one `wiki-health` will refuse.
Run Steps 2–10 below for
EACH resolved domain in turn (one full pass per domain, not a merged cross-domain pass), then
emit a fleet summary line (Step 10) after the last domain.

Every remaining step is scoped to the one resolved `{skill-name}` / `{wiki-path}` pair for the
domain currently being groomed.

## Step 2 — Run the reused mechanical baseline (lint.md's mechanical-baseline steps, verbatim)

Read `.claude/skills/wiki-memory/protocols/lint.md` and execute its mechanical-baseline steps
exactly, end to end, scoped to this domain — do NOT re-derive this logic inline. Cite that protocol
by section name rather than by step number; its numbering is its own to change. This gives groom a fresh, evidence-cited
baseline before any semantic work begins: `maintenance-due`'s compound condition, the mechanical
bundle (freshness, `mdite`, `churn-check`), capped `--deep` deep-confirms, `severity: minor |
misleading` drift-file emission (capped at `correction-cap`) into the active project's
`learned/` directory for the standard `knowledge-ingestor` chain to consume, and `last-verified`
bumps on clean confirms (capped at `K`).

Record `lint.md`'s own final report verbatim into this run's `## Mechanical Baseline` section
(below) — groom does not re-summarize it in different words.

**Why reuse instead of a groom-specific mechanical pass:** D3's "one remediation path for all
staleness" means mechanical findings — whether first surfaced by a user-typed Tier-1 `lint` run or
resurfaced during a manual Tier-2 groom — flow through the identical severity-gated
`knowledge-ingestor` chain. Groom's own value-add is Steps 3–5 below: judgment work no
mechanical detector can perform.

## Step 3 — Full semantic lint of page prose

For every `*.md` page under `{wiki-path}` (excluding `SKILL.md`, `schema.md`,
`protocols/*.md`, group `index.md` nav pages), read the full body and evaluate whether any
claim it states reads as stale or incorrect given current understanding of the domain — a check
mechanical Tier-1 cannot perform, because it has no auditable `code-cites`/md-link target to
churn-check against. This is deliberately a judgment call, not a checklist.

For each confirmed finding, route it per Step 6's decision rule below (apply directly via Step
5, or emit a drift file via Step 6) — do not skip a finding just because it lacks a code-cite;
absence of a mechanical trail is exactly the class of drift this step exists to catch.

**Coverage ledger (mandatory).** As you work the page list above, maintain a running per-page
ledger — page → reviewed-at-citation-level (yes/no) → outcome (finding(s) / clean / skipped +
reason). Carry it into Step 10's report verbatim; an aggregate "{N} pages reviewed" claim is no
longer valid without it — a page you didn't reach, or reached but didn't check its claims against
current code/domain state, is `no`, and `no` rows are explicit rows in the ledger, never silently
absorbed into the total.

A ledger with any `no` rows is itself a signal, not just a gap to note: it means this pass ran too
long to sustain per-page citation-level rigor somewhere before the end of the page list — context
domination. Say so plainly in the report rather than letting it hide inside a count, and flag
those pages for a follow-up pass.

## Step 4 — Cross-page contradiction scan

For every pair of pages under `{wiki-path}` whose `tags:` frontmatter shares a prefix, or whose
bodies plausibly cover the same sub-topic, compare their claims for direct contradiction — NOT
mere topical overlap or a missing cross-reference (that is `wiki-health --full`'s cross-link
scan, explicitly out of scope for this protocol per the skill's Task list).

- **Confirmed contradiction with a clear resolution** (e.g. one page's claim is directly
  falsifiable against current code, or one page cites a commit/event that supersedes the
  other) → apply the supersession rewrite to the outdated page via Step 5, citing the other
  page's slug and the specific superseded claim as the evidence.
- **Ambiguous** (cannot determine which page is correct without asking the user) → emit a drift
  file via Step 6 with `severity: misleading` and an `escalation-reason` of `interpretive` or
  `multi-fact` as applicable.

## Step 5 — Apply supersession rewrites directly

For each finding from Steps 3–4 that this run resolves with confidence (a single, directly
falsifiable contradiction — not "anything interpretive, multi-fact, or judgment-required", which
routes to Step 6 instead per the D16 criteria):

**Worked example — telling the two apart:** a page claiming a retry cap of 3 where a single
commit changed the constant to 5 is one directly falsifiable fact — apply here. A page describing
a script that has since grown a *second* interacting mechanism — e.g. a new mode flag that can
skip the behavior the page documents, plus a new check whose ordering relative to the first must
also be stated for the page to read accurately — routes to Step 6 instead, even though each
individual fact (the flag exists, the new check exists, their order) is independently verifiable
by reading the script. What makes it `misleading` is not any one fact's uncertainty; it's that a
faithful correction requires narrating how the two mechanisms interact — that narration is itself
the interpretive step D16 reserves for escalation. Emit `severity: misleading`,
`escalation-reason: multi-fact`.

**The fresh-reader test.** Every rewrite this step applies is a silent inline edit: the page
afterward must read as if it had always been correct, with no record that a groom touched it, when
it ran, or what the old value said. Apply this test to every sentence you write into a page: would
this sentence be here if the page had been written correctly on day one? If yes, it is content. If
no, it belongs in this run's report (Step 10) and in the commit message that lands the edit, not
on the page. The test is context-aware
in a way a fixed pattern-match can never be: "this guard landed in commit c0193d9" passes — a page
written correctly from the start can legitimately cite when a behavior landed. "Re-verified
2026-07-13 (groom pass)" fails — no page written correctly on day one would ever describe its own
verification event, because that sentence isn't a domain fact, it's a diary entry about the page.

**Worked example — a citation fix, page and provenance side by side:**

- Page before: `...the check runs at wiki-health.sh:320-375.`
- Page after: `...the check runs at wiki-health.sh:380-412.`
- Report line (Step 10): `wiki-health-subcommand-and-check-scope: citation 320-375 → 380-412
  (code growth above the block; behavior unchanged)`

The page shows only the corrected line numbers, in the exact sentence shape it already had — a
reader has no way to tell a correction ever landed. The old numbers, the fact that they changed,
and why live in the report and in the diff of the commit that lands the edit. That is the
fresh-reader test passing: apply it to your own edit before you write it, not after.

**Anti-pattern: the "re-verified trailer".** Appending a paragraph like this to page content is
the Superseded-block accretion failure (D4) in a new shape:

> **Line citation re-verified {date}** (groom pass): previously cited as X, now Y — behavior
> confirmed unchanged.

It fails the fresh-reader test outright — no page written correctly from day one narrates its own
re-verification. It duplicates what the commit diff already shows, poisons the article with
process noise, accretes across runs, and can even ship while the stale inline value sits unfixed
elsewhere on the page. Never
write this: fix the citation in place and say nothing about having fixed it.

**Domain-knowledge history is not page-maintenance history.** What the system used to do, when a
gap closed, or which commit landed a behavior is legitimate page content (e.g. "this guard landed
in commit c0193d9"; a History subsection recording an old gap and when it closed) — the
fresh-reader test passes these, because a page written correctly on day one could always have said
them. What a groom did to *this page* — that it ran, when, what the prior citation said — never
passes that test; it belongs only in this run's report and the commit that lands the edit.

With that test applied, execute the rewrite:

1. Read the page's current full body.
2. Rewrite the stale/contradicted claim to the correct current fact, in place, in positive
   prose (AD6) — never add a dedicated "retired claim" heading of any kind and never annotate
   the stale claim as superseded in the page body. Optionally add a single positive-phrased
   re-encounter guard sentence when the dead fact is likely to be rediscovered (e.g. "use X —
   the former Y was consolidated into this hub in `<sha>`"). Provenance for the removed claim
   (page, short quote of the removed claim, the contradicting commit SHA for a code-related
   finding, or the contradicting page + claim for a cross-page finding) goes in this run's Step 10
   report and in the commit message that lands the edit (AD7). Never delete the page or file
   outright.
3. Bump `last-verified` on the SAME write — the bump rides the content edit, not a separate
   write (D17b) — as a quoted YAML string.
4. Write via `mktemp` + `trap 'rm -f "$payload"' EXIT` for the payload file, then:
   ```bash
   wiki-write "{skill-name}" "{slug}" --from "$payload" --update
   ```
   Never a raw Edit/Write on a wiki content page — all wiki-page writes route through
   `wiki-write` (soft-clobber guard, atomic rename, `## Pages` nav update).
5. **Soft-clobber fallback:** if the call exits `2` (the live page now has a `## ` heading
   missing from, or whose body diverges enough from, this step's stale-read payload — a
   concurrent edit landed between read and write), do
   not treat this as a groom failure. Emit a `severity: misleading` escalation drift file instead (Step 6),
   citing the concurrent-edit collision as the `escalation-reason`, and move to the next finding.
6. **JIT `schema.md` update:** before this run's first such write for this domain, check
   `grep -q last-verified {wiki-path}schema.md`. If absent — and Step 2's reused baseline did
   not already perform this check for the domain this run — this write is the domain's first to
   introduce the field: add a one-line `last-verified` mention directly (Edit/Write — `schema.md`
   is a Meta scaffold file, not routed through `wiki-write`), scoped to this one domain only,
   never a bulk pre-emptive sweep across every domain.
7. **Bounded meta-file lint fixes (this run's own domain only):** if Step 2's reused baseline
   flagged a `FORBIDDEN_UPDATED_FIELD` (or an equivalent lint-flagged forbidden frontmatter
   field) on the domain's own `schema.md` or `SKILL.md`, correct it directly
   (Edit/Write — same Meta-scaffold convention as point 6 above), plus the minimal accompanying
   `schema.md` prose needed to keep the schema doc accurate for the field being fixed (e.g.
   documenting a `last-verified` convention the fix just introduced, or noting a forbidden field
   just removed). Record each such fix as its own line in this run's Step 10 report. Nothing
   beyond the flagged field's correction and that minimal accompanying text is in
   scope here — restructuring a meta file, adding unrelated sections, or touching a domain this
   run isn't grooming stays out of bounds; propose it to the user instead.

## Step 5a — Archive-tier retirement (AD8, groom-only)

When Steps 3–4's judgment work identifies a page as **wholly obsolete** — not merely stale, but
every claim on the page has been superseded or the page's topic no longer applies to the
domain — retire it via the archive tier instead of a per-claim rewrite:

1. Read `{wiki-path}SKILL.md` and locate the page's link under `## Pages`.
2. If `## Pages` has no `### Archived` subsection yet, add one at the end of the `## Pages`
   section — still nested under `## Pages` (a subsection, not a sibling top-level heading) so
   the page stays part of the navigation graph `mdite` validates and is never reported as an
   orphan.
3. Move the page's link line from its current position under `## Pages` to under the
   `### Archived` subsection, verbatim (same link target, same slug) — do not rewrite the link
   text itself; optionally append " (archived)" to the summary so agents recognize it at a
   glance without opening the page. That one suffix is the full extent of the edit: the summary
   text is otherwise left unaltered — no other wording changes, additions, or "— completed"-style
   annotations, even ones that feel harmless.
4. Write the updated `SKILL.md` directly via Edit/Write — `SKILL.md` is a Meta scaffold file,
   not routed through `wiki-write` (same convention as the JIT `schema.md` update in Step 5
   point 6 above).
5. The page's file itself is never moved, edited, or deleted — content, frontmatter, and
   history stay exactly as they are; only its nav position changes. Agents doing index-first
   investigation (researcher's Step 1) skip pages listed under `### Archived` by convention.
6. Record the retirement in this run's Step 10 report — count of pages archived this run.

This is the concrete implementation of the archive tier the wiki-aging-loop design promised
(D4: "out of nav, still on disk") but that no protocol step previously implemented; groom is
the only place it happens (D15's single consented semantic-maintenance locus).

## Step 6 — Emit drift files for anything not resolved directly

Same schema as `lint.md` Step 6 — `learned/drift-{page-name}.md` under the active project's
`learned/` directory:

```yaml
---
source: implementation/step-NN   # or implementation/ad-hoc when groom fires outside any active step context
type: drift
scope: project
target-domain: {domain}
target-page: {slug}
status: captured
severity: minor | misleading
escalation-reason: "..."         # required when severity: misleading
---
```

Bind every emission to the D16 Severity-assignment Decision Table — the same criteria that bind
the mechanical `lint` pass and the researcher JIT live-correct path bind groom too; there is no
groom-specific relaxation:

| Severity | Definition | Routing |
|----------|-----------|---------|
| `minor` | A single mechanically-verifiable fact with direct contradicting evidence whose correction is deterministic | auto-correct (via `knowledge-ingestor`) |
| `misleading` | Anything interpretive, multi-fact, or where the correction itself requires judgment | escalate, no edit |
| _uncertain_ | **DEFAULT TO MISLEADING** | escalate |

In practice, groom's own semantic-layer findings (Steps 3–4) are almost always `misleading` by
this definition — a genuinely single-fact, deterministic contradiction would already have
surfaced in Step 2's reused mechanical baseline. Populate `escalation-reason` with the
applicable rationale (`interpretive` / `multi-fact` / `judgment-required` / `uncertain-default`).

These emissions are NOT subject to Step 2's reused `correction-cap` — that cap bounds only the
mechanical baseline's `minor`-severity auto-corrections; groom's own emissions here cost no
auto-correct spend, only manual-review attention, so no additional cap applies.

**Collision handling:** if a drift file for the same page already exists in `learned/` this
session, do not clobber it — append a uniqueness suffix (timestamp) to the new filename instead.

## Step 7 — Advisory nudge (D13, groom-only)

Scan page bodies under `{wiki-path}` for inline-code path mentions — backtick-wrapped,
path-shaped tokens (e.g. `` `foo/bar.ts` ``) that are neither an actual markdown link
(`[text](path)`, mdite-validated) nor a `code-cites:` frontmatter entry. For each one found,
record it in the report's `## Advisory Nudges` section as a suggested conversion to a md-link or
`code-cites:` entry.

Report-only — never auto-applied. This is the migration path for pre-D13 pages (D13); zero
false-positive risk in the automated tiers comes specifically from NOT parsing prose there — the
one place this convention is bent is here, under manual human review, where a person decides the
correct link text and target before any edit lands. No automated tier ever performs this scan.

## Step 8 — Re-read checkpoint

Before Step 9's log write, re-read every page you touched this run — Step 5's rewrites and
Step 5a's archive-tier moves — end to end, as a first-time reader who does not know a groom ran.
Apply the fresh-reader test to every sentence you added. Anything that fails moves into the log
entry you are about to write — that entry is exactly the place for what you want to say about
your edits.

Run this checkpoint even though Step 5 already states the same rule: a rule read once near the
top of a long pass competes with every page you've read since, and by the last page of a
multi-page domain it has faded under everything read in between. Re-reading at the moment of the
write re-fires the fresh-reader contract exactly when it matters, and gives the impulse to
narrate your own edit its one sanctioned outlet — the log entry — right when that impulse is
strongest.

## Step 9 — Wiki health check

After all writes for this domain, run `wiki-health "{skill-name}"` (never `--full` — that stays
a separate, manually-triggered deep-audit pass; adding missing cross-references is its concern,
not groom's, per the skill's Task list). Record the resulting state and carry it into Step 10.

This is a read of a domain the user asked you to groom, surfaced in the report they asked for —
not a health verdict volunteered to a session that came for something else (D4).

**Where the audit trail for a removed claim now lives (AD7).** Groom writes no operations log;
the domain's operations log was retired outright (D3), and the page-voice rule forbids putting
provenance on the
page itself. Every rewrite's provenance therefore rides the three artifacts groom already
produces, and no fourth is invented for it:

| Artifact | Carries |
|----------|---------|
| This run's Step 10 report | one provenance line per rewrite, in the shape Step 5's worked example gives |
| The commit that lands the edit | the diff — old claim and new, exactly — plus the reasoning in its message |
| The `learned/` drift file, or the `/capture-issue` file | anything escalated rather than applied (Step 6) |

The commit is the durable half: a rewritten page no longer carries the claim it replaced, and
`git log -p` over the page is what reconstructs it. Say so in the commit message rather than
relying on the diff alone to explain itself.

**Provenance is evidence-by-reference, not narrative.** Every line of it states what changed and
points to where the evidence lives (the `learned/`/drift file path, the escalation's issue path,
the exact greps or citations checked), never the correction narrated in full. A single page's
provenance line stays one clause — the worked example in Step 5 is the shape,
`{page-slug}: removed "{quote}" — contradicted by {sha or page+claim}` — and a multi-page pass adds
one such line per page rather than expanding into a citation-by-citation narrative. The detail
already lives in the drift file, the issue, or the diff; the report points to it, it does not
restate it.

If Step 2's reused `maintenance-due` verdict still reports `large-drift: true` after this run's
corrections (e.g. escalations remain, or `--all` is being run domain-by-domain and this domain's
queue exceeded what one pass could clear), note that in the report — informational only; it does
not block or repeat this run.

## Step 10 — Report

Summarize per domain groomed:

```markdown
# Groom Report — {domain}

## Mechanical Baseline
{lint.md's Report step, verbatim}

## Semantic Lint
- Coverage ledger (one row per page under `{wiki-path}` in scope for Step 3 — never omit a page,
  and never fold a skipped page into the count below):
  | Page | Reviewed at citation level | Outcome |
  |------|---------------------------|---------|
  | {slug} | yes / no | finding(s) / clean / skipped — {reason} |
  | ... one row per page ... |
- Pages reviewed: {N of M}, derived from the ledger above — never reported standalone
- Findings: {N} ({N} resolved directly via supersession rewrite, {N} escalated as severity: misleading)

## Contradiction Scan
- Page pairs compared: {N}
- Contradictions found: {N} ({N} resolved, {N} escalated)

## Supersession Rewrites
{one line per rewrite: page, the removed claim in a short quote, and the evidence cited (SHA or
contradicting page+claim). This section IS the run's provenance record (AD7) — the rewritten page
no longer carries the claim, so nothing else states it until the commit lands}

## Archive-Tier Retirements
{one line per page moved under `### Archived` this run (Step 5a), or "none"}

## Advisory Nudges
{one line per inline-code path mention found, or "none"}

## Wiki Health Post-Groom
{state from Step 9, e.g. healthy / partial-migration}
```

For `--all`, append one final aggregate line after every domain's individual report:
`Fleet groom: {N} domains, {N} rewrites, {N} archive-tier retirements, {N} escalations, {N} advisory nudges.`

**Convergence re-run recommended after correction commits land.** Once any `severity: misleading`
escalation from this run's drift files is manually resolved and committed, recommend in the report
that the user run a convergence groom of the same domain next. It is cheap — this protocol's own
cost — and catches residual drift the prior pass missed; the coverage ledger above exists because
exactly this kind of re-run once caught findings a prior pass's Step 3 had silently skipped. The
recommendation is advisory only — groom still never self-invokes (D6).

---

## Invariants this protocol upholds

- **Never delete (D4):** every remediation is a rewrite-in-place (AD6) citing the contradicting
  evidence in this run's report and the commit that lands it (AD7), or an archive-tier move
  (Step 5a, AD8 — out of nav under `### Archived`, still on disk). No page content or file is ever
  removed, and no claim is ever rewritten or removed without citing the contradicting SHA or
  contradicting page + claim in that record.
- **D16 binds groom too:** every `type: drift` file this protocol emits carries a severity
  assigned per the same Decision Table that binds the mechanical `lint` pass and researcher's
  JIT live-correct path — no groom-specific relaxation, no unattested `minor` under uncertainty.
- **Evidence-cited:** every direct supersession rewrite cites the contradicting commit SHA or
  the specific contradicting page + claim — never an unsupported edit.
- **Manual-only (D6):** this protocol never self-invokes. It runs only from a command a human
  explicitly typed — `/wiki-memory groom {domain} [--all]`, or `/wiki-memory audit {domain} --fix`,
  which dispatches `wiki-groomer` per affected domain to apply the conformance catalog (D14). Both
  are user-initiated; neither is a schedule.
