---
summary: "check wiki structural integrity and content freshness"
---

# Lint Workflow — Tier-1 detection + emission engine

`/wiki-memory lint <domain>`

Runs the mechanical bundle (freshness/`maintenance-due`, `mdite`, `churn-check` — git + mdite
only, **zero LLM tokens in detection**) over `<domain>`, deep-confirms a capped set of
candidates, bumps `last-verified` on clean confirms, and emits `learned/drift-{page}.md` files
for confirmed contradictions. This protocol IS the "Tier-1 bounded sweep" the architecture
diagram shows. **Nothing invokes it as a side effect of doing something else.** It runs when a
person types `/wiki-memory lint <domain>`, and when `wiki-grooming`'s groom protocol reuses its
mechanical baseline — and groom is itself only ever dispatched by a user-typed
`/wiki-memory groom` or `/wiki-memory audit --fix`. **This protocol does not itself gate on
`due`** — an invocation always runs the full bounded sweep below; the due-check belongs to the
caller deciding whether to invoke it at all.

Never invokes `wiki-health --full` (the separate, manually-triggered deep-audit pass) — that
would break the zero-LLM-tokens invariant this protocol commits to for its detection phase.

**Correction ownership:** this protocol is emit-only for confirmed contradictions — it never
rewrites a page's content itself. `severity: minor` / `severity: misleading` drift files it
writes are picked up by the existing `knowledge-ingestor` chain (unchanged by this rewrite) at
the next qualifying boundary, which performs the actual auto-correct or escalation. The one
wiki page write this protocol DOES perform directly is the `last-verified` bump on a page that
deep-confirmed clean (no contradiction found) — see Step 7.

---

## Step 1 — Resolve wiki path

Resolve `{domain}` → `{skill-name}` and `{wiki-path}` via convention-based lookup:

(a) If `.claude/skills/{domain}/SKILL.md` exists → `{skill-name} = {domain}`, `{wiki-path} = .claude/skills/{domain}/`
(b) Else if `.claude/skills/{domain}-expert/SKILL.md` exists → `{skill-name} = {domain}-expert`, `{wiki-path} = .claude/skills/{domain}-expert/`
(c) Else if `~/.claude/skills/{domain}/SKILL.md` exists → `{skill-name} = {domain}`, `{wiki-path} = ~/.claude/skills/{domain}/`
(d) Else if `~/.claude/skills/{domain}-expert/SKILL.md` exists → `{skill-name} = {domain}-expert`, `{wiki-path} = ~/.claude/skills/{domain}-expert/`

If found AND the candidate's `SKILL.md` carries the wiki declaration (D15) —
`grep -q '^wiki: true' {wiki-path}SKILL.md` exits 0, the key bare, lowercase and unquoted, at
the top level of the frontmatter block whose first line is exactly `---`, which is the same
`_wiki_is_declared` test `wiki-health` applies:
- `{index-file} = SKILL.md` (the `## Pages` section is the navigation hub)
- `{mditerc} = {wiki-path}.mditerc`

`.mditerc` is still `mdite`'s config — Step 3 runs `mdite` against it — and still a required
conformance artifact of a healthy wiki, but it is no longer the identity test. Resolving on it
instead would select folders `wiki-health` refuses (an undeclared skill carrying a leftover
`.mditerc`) and refuse folders it accepts, so this protocol's Step 2 and Step 4 calls would then
abort on a domain Step 1 had already accepted.

If no matching skill found → abort: "Cannot find wiki for domain '{domain}'.
Run `/wiki-memory init {domain}` or `/wiki-memory migrate {domain}` first."

Every remaining step below is scoped to this resolved `{skill-name}` / `{wiki-path}` pair.

## Step 2 — Compute the maintenance-due verdict

```bash
wiki-health maintenance-due "{skill-name}" --json
```

Exit `2` (bad skill arg) → abort with the same message as Step 1 (should not occur — Step 1
already validated resolution; treat a hit as an internal inconsistency, not a normal outcome).
Exit `0`/`1` (not-due/due) are both expected and both proceed identically — this protocol does
not branch on the boolean itself (see header note above).

Capture from the JSON payload:

| Field | How used below |
|-------|----------------|
| `N` | reported only. It was the ingests-before-lint threshold; that leg was dropped with the operations log (D3), so `N` is still emitted for `--json` shape compatibility and now gates nothing. Never explain `due` in terms of accumulated ingests — `due` is driven by the git-derived churn and freshness legs alone |
| `K` | Step 4's deep-confirm cap |
| `correction-cap` | Step 6's per-run cap on `severity: minor` drift-file emissions |
| `large-drift` | carried into Step 8's report for the caller's own groom-recommendation decision — this protocol never emits a groom recommendation itself |
| `queue` | Step 4's ordered candidate list — `[{page, "last-verified", "cited-churn"}, ...]`, oldest-`last-verified`-first, uncited pages ordered by git-age |
| `stats` | carried into Step 8's report verbatim (`pages-total`, `pages-code-cited`, `fresh`, `unknown`, `stale-semantic`, `stale-semantic-pct`, `mdite-available`, `churn-check-available`) |

This single call already runs the churn-check + mdite legs internally to compute its own
`due` condition, but its `--json` payload exposes only aggregate booleans/counts — it does not
give itemized per-target detail (which page, which target, which commit). Steps 3–5 below
re-invoke the underlying tools directly to get that itemized detail for building drift files.

**Gotcha — strip `.md` before reusing a queue entry's `page` value:** `maintenance-due`'s queue
entries carry the `page` field straight from the raw page-enumeration helper, WITH the `.md`
extension (e.g. `foo.md`, or `group/foo.md`). `wiki-health freshness <skill> <page>` (Step 4)
appends `.md` itself when resolving its `<page>` argument to a file path — passing a queue
entry's `page` value through unchanged double-suffixes the lookup (`foo.md.md`), the file is
not found, and the page silently comes back `unknown` instead of being deep-confirmed. Always
strip a trailing `.md` from a queue entry's `page` before passing it to `freshness`.

## Step 3 — Run the mechanical bundle directly

Grounded via an unconditional `cd` into `{wiki-path}` for every `mdite` call below — `mdite
files` takes **no path argument** and always operates on cwd (not merely a README-default
entrypoint), so an ungrounded call, or a `--config`-only call left ungrounded, silently audits
the wrong graph. `--config {wiki-path}/.mditerc` may additionally be passed for rule
customization but is never a substitute for `cd`. `mdite lint` still passes `--entrypoint
SKILL.md` (mandatory — the tool's own default entrypoint is `README.md`).

```bash
(cd "{wiki-path}" && mdite lint . --entrypoint SKILL.md --format json)
mdite_lint_rc=$?
(cd "{wiki-path}" && mdite files --orphans --format json)
mdite_orphans_rc=$?
churn-check "{skill-name}" --json
churn_rc=$?
```

**"mdite ran with findings" vs "mdite unavailable" is read from the WRAPPER's own exit code
— never from mdite's native exit value.** The `mdite` wrapper already remaps
mdite's native exit-`1`-on-findings behavior to wrapper-exit-`0`-with-findings-on-stdout, so:
- wrapper exit `0` → mdite ran; parse stdout — empty stdout = clean for that leg, non-empty
  stdout = findings (broken links / missing entrypoint from `lint`, orphan pages from
  `files --orphans`) to fold into Step 5/6's drift-file emission.
- wrapper exit `EX_UNAVAILABLE` (`69`) → mdite unavailable for that leg; skip it, degrade to
  git-only inputs (churn-check's md-link/code-cite churn still runs — it has no external-fetch
  dependency), and report "integrity check skipped" for the mdite legs — never report a false
  "verified clean".

`churn-check` exit `0` = clean, `1` = churn found (parse `--json` regardless of exit code for
the itemized `{target, kind: "code-cite"|"md-link", "contradicting-sha"}` list), `2`+ = bad
input (should not occur — Step 1 already validated the skill; treat as an internal
inconsistency and abort like Step 2's exit-`2` case).

**Frontmatter checks (carried forward from the pre-rewrite protocol, cheap and unaffected by
the churn/drift machinery above):**
- For each `*.md` page in `{wiki-path}` (excluding the meta files `SKILL.md` and `schema.md`): verify
  `tags`, `summary` present; report missing fields per page.
- **Forbidden `updated:` field check** (widened past the original meta-files-only scope): for
  every `*.md` page in `{wiki-path}` — `SKILL.md`, `schema.md`, and every ordinary knowledge
  page alike — check whether the file's YAML frontmatter contains an `updated:` key —
  page staleness is tracked via `git log`/mtime, never a YAML field, so an `updated:` line on
  any wiki page is always stale data and a merge-conflict risk. Flag each hit as
  `FORBIDDEN_UPDATED_FIELD: {file}`. `wiki-health.sh`'s `_classify_skill` also runs this check
  mechanically (zero LLM tokens), and its coverage is already the same as this protocol-level
  check's: one loop over ordinary knowledge pages plus a second, dedicated loop over the meta
  files that `wiki-health.sh`'s page *census* (`all_pages`) excludes, but that this
  forbidden-`updated:` check does not, precisely because of its own second loop. This
  protocol-level check is not filling a gap the script leaves open — it is a second line of
  defense against the script itself regressing, so the rule doesn't depend solely on an LLM
  remembering to apply it.
- **Bare-date `last-verified` check (new):** for every page carrying a `last-verified:` key,
  verify the value is a quoted YAML string (`last-verified: "2026-07-11"`). An unquoted value
  parses as a JS `Date` and silently breaks the `mdite files --frontmatter` verification-queue
  query. Flag each hit as `BARE_DATE_LAST_VERIFIED: {file}`.
- **External-ref presence (feeds Step 4's `unknown` disambiguation):** for each page, record
  whether it has ≥1 external reference — a non-empty legacy `code-cites:` frontmatter value OR
  ≥1 external markdown link in the page body (the union cite set per AD1/AD2/AD9, the same set
  `wiki-health` derives via `_extract_cite_set` for its own freshness check and the
  `pages-code-cited` stat). A page with neither a `code-cites:` value nor an external md-link
  target has "no external ref". This per-page fact is not itself reported as a finding; Step 4
  below consumes it to route the `unknown` freshness status correctly.

## Step 4 — Select and deep-confirm the K candidates

Select the first `K` entries from Step 2's `queue` **in the order the queue already provides**
— never an ad-hoc per-hit reordering. This ordering (oldest `last-verified` first, tie-broken
by largest cited-code churn, no-`last-verified` pages ordered by git-age) is what lets an
uncited page — one with no external ref (no code-cite value and no external md-link target),
so it never produces a churn hit — still reach a deep-confirm and receive a `last-verified`
bump once it surfaces at the front of the queue under the `K` cap.

For each of the `K` selected pages (stripping the queue entry's `.md` suffix per the Step 2
gotcha):

```bash
wiki-health freshness "{skill-name}" "{page-slug}" --deep --json
```

This is the existing wiki-health Tier-2 mechanic. Per cite it runs `git diff --quiet
<page-last-commit> HEAD -- <cited-path>`: **any** content difference — including a one-line
comment reword — confirms `stale-semantic`. It does NOT collapse comment-only or otherwise
trivial diffs; the only two false positives it actually collapses are (a) cited content
identical between the page's last commit and HEAD (timestamp-only churn, or a change later
reverted), and (b) an unresolvable-cite path disambiguated as having existed somewhere in the
file's full git history (vs. one that genuinely never existed, which stays a contradiction per
AD4). Parse the single-element `pages[]` array's `status`:
- `fresh` → no contradiction confirmed; queue this page for the Step 7 `last-verified` bump.
- `stale-semantic` → confirmed code-cite contradiction; queue this page for Step 6 drift-file
  emission (this is a code-cite finding — carries the page + the contradicting commit context
  from the freshness call). This confirms *some* diff exists between the page's last-verified
  commit and HEAD — it does NOT confirm the diff is substantive. Step 6 must not assume trivial
  changes were filtered out when assigning severity.
- `unknown` → freshness not computable via wiki_mtime alone, but `unknown` has two distinct
  causes this protocol must NOT treat identically — conflating them would make an uncited
  page's `last-verified` bump permanently unreachable, contradicting the promise made two
  paragraphs above and this step's own Acceptance Criterion 8. Use Step 3's recorded
  external-ref-presence fact for this page to pick a branch:
  - **No external ref (no `code-cites:` value and no external md-link target)** — a
    principle/reference page with nothing to verify against code. Nothing-to-contradict IS the
    substantive verification result for a page like this — queue it for the Step 7
    `last-verified` bump, exactly like `fresh`.
  - **Has an external ref, but `unknown` anyway** — a genuine git-miss (the wiki page itself has
    no git history yet) or other infra hiccup, not a verification result — no bump, no drift
    file, never blocks. This is the only case the "never blocks" language now describes.

## Step 5 — Fold in the already-confirmed mechanical findings

Unlike Step 4's code-cite churn (ambiguous until a deep-confirm resolves it to `fresh` or
`stale-semantic` — see the corrected mechanic above), the following are already-confirmed
mechanical facts with no ambiguity to resolve — they queue directly for Step 6's severity
assignment, without consuming a Step 4 deep-confirm slot and without counting against the `K`
cap (that cap bounds deep-confirm *operations* only):

- **External md-link churn** from Step 3's `churn-check --json` output (`kind: "md-link"`,
  `scope: "external"`) — a dead or changed EXTERNAL link target is a source-drift fact, not a
  false-positive candidate: `MISSING` (any external target) and `CHANGED`-since-page-commit
  (external only, per AD3) both queue here.
- **Internal md-link `MISSING`** (`kind: "md-link"`, `scope: "internal"`) is NOT a source-drift
  finding this protocol emits a drift file for — a dead internal nav link is a dead-nav defect,
  `mdite lint`'s broken-link check's concern (already surfaced structurally by that leg below).
  Note it in Step 8's report for visibility; do not route it through Step 6's
  severity-assignment / drift-file machinery.
- **mdite structural findings** from Step 3's `mdite lint` (broken links, missing entrypoint)
  and `mdite files --orphans` (orphan pages) output, when that leg was not degraded to
  `EX_UNAVAILABLE`.
- **code-cite churn** from `churn-check --json` (`kind: "code-cite"`) for any page NOT among
  the `K` pages Step 4 selected — these still surfaced as a mechanical churn hit, but since
  they fell outside this run's deep-confirm budget, treat the raw churn-check hit itself (not
  a Tier-2-confirmed `stale-semantic`) as the finding; note this distinction in the drift file's
  body so a future reader knows it was not deep-confirmed this run.

## Step 6 — Assign severity and emit drift files

**Batching gate — apply first, before the Decision Table below:** group this run's Step 4
deep-confirmed `stale-semantic` findings and Step 5 external md-link/code-cite churn findings
by contradicting SHA. Any SHA shared by 3 or more pages routes ALL of that SHA's findings to
the batched escalation file (**Batched escalation** below, `severity: misleading`, fixed)
instead of the per-page path — skip the Decision Table for those findings entirely. Everything
else — mixed-SHA findings, a shared SHA covering fewer than 3 pages, `mdite` structural
findings, and frontmatter findings — proceeds through the Decision Table and per-page emission
below, unchanged.

For each remaining page carrying one or more findings from Steps 4–5, assign severity per the
Severity-Assignment Decision Table below (the loop's safety boundary — a `minor` assignment
authorizes an unattended downstream write, so default-deny under uncertainty):

| Severity | Definition | Routing |
|----------|-----------|---------|
| `minor` | A single mechanically-verifiable fact with direct contradicting evidence (commit SHA, dead path) whose correction is deterministic | auto-correct (via knowledge-ingestor) |
| `misleading` | Anything interpretive, multi-fact, or where the correction itself requires judgment | escalate, no edit |
| _uncertain_ | **DEFAULT TO MISLEADING** | escalate |

Practical application: a page with exactly one finding whose fix is mechanically obvious (one
dead code-cite path, one dead md-link target, one broken link, one orphan) is `minor`. A page
that accumulates more than one independent finding in this run, or whose finding requires
interpreting what a `CHANGED` (not `MISSING`) target's diff actually means for the page's
claims, is `misleading` — populate `escalation-reason` citing the applicable rationale
(`interpretive` / `multi-fact` / `judgment-required` / `uncertain-default`). Anything that
doesn't cleanly fit the `minor` row above defaults to `misleading` — never guess toward `minor`.

**Per-run cap on `minor` emissions:** emit at most `correction-cap` (3) `severity: minor` drift
files in this run — each one will eventually cost an LLM-driven correction when
knowledge-ingestor consumes it, and that spend is what this cap bounds. Findings beyond the
3rd `minor`-eligible one in a single run are simply **not emitted this run** — the underlying
churn/finding persists on disk, so the remainder is re-detected the next time a person runs this
protocol on the domain — nothing re-detects it unasked. `severity: misleading` emissions
are NOT subject to this cap — they cost no auto-correct spend, only manual-review attention.

**Drift file (one per page, `learned/drift-{page-name}.md` under the active scratch project's
`learned/` directory — the project context the invoking boundary/session is already operating
in — unless the batching gate above routed the finding to the batched file instead):**

```yaml
---
source: implementation/step-NN   # or implementation/ad-hoc when this run fires at the scratch
                                 # archive gate outside any active step context
type: drift
scope: project
target-domain: {domain}
target-page: {slug}
status: captured
severity: minor | misleading
escalation-reason: "..."         # only when severity: misleading
---
```

Body: what the mechanical evidence showed (target, kind, contradicting commit SHA — from
Step 3/5's churn-check output or Step 3's mdite findings), and a **Correction guidance** note
instructing whoever applies the fix (knowledge-ingestor's auto-correct, or a manual groom
pass) to follow rewrite-in-place (AD6): rewrite the stale claim to the correct current fact in
positive prose, in place — NEVER add a dedicated "retired claim" heading of any kind. Provenance
for the removed claim is journalled by the correcting write itself (AD7): the page, the removed
claim, and the contradicting SHA all live in the git diff for that write, never in the page body
and never in a maintenance file written alongside it. Whole-page retirement moves the page's `## Pages`
nav entry under a `### Archived` subsection in `SKILL.md` (AD8) — the page stays linked (no
mdite orphan) and on disk, just labeled so agents skip it. **Never delete** — deletion is
reserved for the pre-existing never-linked-draft heuristic, unrelated to this loop.

**Collision handling:** if a drift file for the same page already exists in `learned/` this
session (e.g. this sweep and a JIT live-correct both hit one page), do not clobber it — append
a uniqueness suffix (e.g. a timestamp) to the new file's name instead:
`drift-{page-name}-{timestamp}.md`. The same rule applies to a batched file: if
`drift-commit-{shortsha}.md` already exists this session, append a uniqueness suffix the same
way: `drift-commit-{shortsha}-{timestamp}.md`.

**Batched escalation (3+ pages, one contradicting SHA):** when the batching gate above routes a
SHA's findings here, emit exactly ONE consolidated file instead of one per page:
`learned/drift-commit-{shortsha}.md` (7-char short SHA) under the same `learned/` directory.
`severity` is always `misleading` — batching a `minor` finding would hide a
mechanically-obvious fix behind a manual-review file, so only findings already routed to
`misleading` by the gate above are eligible.

Frontmatter — same schema as the per-page block above, with two overrides:

```yaml
target-page: _batch
target-pages: [slug-1, slug-2, ...]   # every affected page slug, this run's order
```

Body — one line/clause per affected page: page slug, its cited target(s), the finding kind
(`code-cite` | `md-link`), and whether it was deep-confirmed this run (Step 4) or is a raw churn
hit (Step 5, outside the `K` cap). State the shared **Correction guidance** block (rewrite-in-place
AD6, provenance in the correcting write's own git diff AD7, whole-page retirement under
`### Archived` AD8, never delete)
**once** for the whole file — do not repeat it per page. Add one instruction line: the triager
must verify each listed page against the commit's actual diff before correcting anything, and
re-stamp `last-verified` on any listed page whose claims turn out unaffected by that diff.

Mixed-SHA findings, a shared SHA covering fewer than 3 pages, `mdite` structural findings, and
frontmatter findings are never batched — they keep the existing per-page `severity: minor |
misleading` emission above, unchanged.

**`correction-cap` scope:** the cap bounds `severity: minor` **per-page** emissions only (per
the Per-run cap paragraph above). A batched file is always `severity: misleading` and was never
subject to that cap — it neither consumes it nor is withheld by it.

## Step 7 — Bump `last-verified` on clean deep-confirms

For every page Step 4 queued for a bump — pages marked `fresh` (clean deep-confirm, no
contradiction) and pages marked `unknown` with no external ref (nothing to contradict, per
Step 4's disambiguation) — bump its `last-verified` field — capped at the `K` pages actually
deep-confirmed this run, all performed within this single execution so they land together in
one git-diff for the pre-commit human checkpoint (not spread across separate invocations).

**The other `last-verified`-writing case — "an applied correction" (Data Model §`last-verified`)
— is not performed by this protocol.** Per this document's header, correction application
belongs to the `knowledge-ingestor` chain: when it later auto-corrects a `severity: minor`
drift file this run emitted, that corrective write is the one that should ride the
`last-verified` bump alongside the content fix (bump rides the edit, not a separate write).
This protocol's own direct write is scoped to the clean-confirm case below.

The bump is a full `--update` **read-merge-write**: read the page's current full body, write
it back verbatim alongside the bumped `last-verified` value — never a frontmatter-only
payload (`--update` requires `tags:`/`summary:` on every call — `code-cites:` is legacy/tolerated
per AD9, not required — and the soft-clobber guard refuses a whole-page overwrite whenever any
existing `## ` heading is missing from the payload, has its body emptied, or has its body
shrunk past a conservative threshold — carrying the heading text alone is not sufficient, the
body must survive intact or nearly so).

```bash
payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT
# ... write the unchanged body + bumped last-verified: "YYYY-MM-DD" (quoted) to "$payload" ...
wiki-write "{skill-name}" "{slug}" --from "$payload" --update
```

`wiki-write` never deletes its `--from` payload — this protocol runs at every qualifying
boundary, so an unmanaged payload path would accumulate one stray file per run; `mktemp` +
`trap ... EXIT` is mandatory here, not optional cleanup.

**Soft-clobber fallback (mid-edit collision):** if this `wiki-write --update` call exits `2`
(soft-clobber guard — the live page now has a `## ` heading missing from, or whose body
diverges enough from, this step's stale-read payload, meaning the page was edited by another
agent/session between this step's read and its write), do **not** treat this as a sweep
failure and do **not** silently skip the page. Instead, emit a
`severity: misleading` escalation drift file for that page (per Step 6's format) noting the
concurrent-edit collision as the `escalation-reason`, and move on to the next candidate.

**JIT per-domain `schema.md`:** before performing this run's first bump write, check whether
`{wiki-path}schema.md` already mentions `last-verified` (`grep -q last-verified
{wiki-path}schema.md`). If it does not, this write is the first to introduce the field to
*this* domain — add a one-line `last-verified` mention to that domain's `schema.md` (direct
Edit/Write — `schema.md` is a Meta scaffold file, not routed through `wiki-write`) as part of
processing this same bump. This is scoped to the one touched domain only — never a bulk
pre-emptive sweep across every domain's `schema.md`.

**Do not insert that line above the file's first fenced `tags:` example.** `wiki-health` scrapes
the tag prefix it enforces from that block and matches its fence markers at column zero only, so
an edit that displaces, indents or unfences it yields an empty prefix — which **skips** the
tag-prefix check for every page in the domain rather than failing one, while the domain keeps
reporting `healthy`. Append the mention in prose, then confirm the prefix still resolves.

## Step 8 — Report

Summarize to the caller: evidence-cited findings with specific file references (page, target,
kind, contradicting SHA), drift files emitted this run (path, severity), pages bumped, any
soft-clobber fallback escalations, and Step 2's `large-drift` boolean plus `stats` payload
verbatim — this protocol does not itself decide or word a groom recommendation; that framing
belongs to the caller that invoked this protocol.

---

## Invariants this protocol upholds

- **Zero LLM tokens in detection** (Steps 1–5): every finding is produced by `git`, `mdite`, or
  `churn-check` output parsing — no additional tool/agent dispatch. Severity assignment (Step
  6) and drift-body composition are the thin judgment layer the executing agent already applies
  while running this protocol; they are not a separate dedicated LLM call.
- **Age alone is never invalid:** a page surviving a deep-confirm with no contradiction gets
  its `last-verified` bumped and its body otherwise untouched — it is never flagged, never
  queued for drift, regardless of how old it is.
- **Never delete:** this protocol writes only `last-verified` bumps (unchanged bodies) and
  drift files describing what a later corrector should do. No page content or file is ever
  removed by this protocol.
- **`K` bounds deep-confirm operations; `correction-cap` (3) bounds `severity: minor` drift
  emissions per run** — independent caps, per the Threshold formulas table.
