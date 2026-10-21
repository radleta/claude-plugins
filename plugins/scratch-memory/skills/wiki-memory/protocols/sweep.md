---
tags: [wiki-memory/sweep]
summary: "the whole-domain pass — mechanical baseline, semantic lint, contradiction scan, health check and the coverage ledger — reached on a domain groom or an approved sweep proposal"
page-kind: procedure
---

# Sweep Protocol

Contents: Step 1 — Resolve the domain · Step 2 — Mechanical baseline · Step 3 — Semantic lint, page by page · Step 4 — Contradiction scan · Step 5 — Conformance catalog, when the dispatch carries one · Restructure branch · Step 6 — Health check and return

The whole-domain half of the `knowledge-ingestor`'s work. Two dispatches reach it and nothing else
does:

| Dispatch | Scope |
|---|---|
| A domain name, with or without a `learned/` path | every page in the domain: Steps 1–5, then `## Restructure branch` over the subject map, then Step 6 |
| A `Proposal:` block opening `Restructure: {domain} — {subject}` | that subject only: Step 1, `## Restructure branch` for the subject, then Step 6 |
| Any other `Proposal:` block from a prior return, verbatim | only the pages that block names |

A dispatch carrying several `Proposal:` blocks runs each by its row, one at a time, in the order
given, and returns once. An approved block is the user's yes to every decision it names: nothing
in a proposal dispatch counts against `ingest-groom.md` `### Work measure`, and its one-pass rule
still bounds the run. Step 1 and the gate snapshot run once for the dispatch, and Step 6 once at
the end.

A domain dispatch is the user choosing to spend on that domain, so Step 3 runs over every page
uncounted; the restructure branch counts subjects, as its step 2 says. `ingest-groom.md`
`### Work measure`'s tiers still decide what is always a proposal, and its one-pass rule bounds
both branches.

The rubric — admission, the determination table, the evidence gate, naming, the git gate, fold
before delete, the radius, the work measure, read before edit, rewrite in place — is in
[`ingest-groom.md`](ingest-groom.md) `## The rubric` and is not restated here. Read it before
Step 3. This page adds only what a whole-domain pass needs and a per-capture run does not.

An approved plain sweep proposal runs Steps 1, 3 and 6 over the proposal's page list, and skips Steps 2, 4 and 5:
the proposal already named the correction and the pages, so the pass is the edits and the ledger.

## Step 1 — Resolve the domain

**Validate the domain name before it reaches any shell command.** It must match
`^[a-zA-Z0-9_-]+$` — no `/`, no `\`, no `..`, no spaces. On failure, stop this branch and say so
in the return; run nothing. The gate is stated here, and not only in
[`ingest-groom.md`](ingest-groom.md) Step 2, because a domain dispatch reaches this page without
reading those numbered steps, and `{domain}` is interpolated into filesystem probes and into
`wiki-health "{skill-name}"` below.

Then resolve `{domain}` to `{skill-name}` and `{wiki-path}` the way
[`ingest-groom.md`](ingest-groom.md) Step 2 does — `.claude/skills/{domain}/`, then
`.claude/skills/{domain}-expert/`, then the `~/.claude/skills/` equivalents, each gated on
`wiki: true` in its own `SKILL.md`. Quote every path variable
(`"$skill_dir/SKILL.md"`), never `eval` or concatenation. No match: say so in the return and name
`/wiki-init {domain}` as the fix. Do not guess a neighbouring domain.

**Complete when:** the domain name has passed the regex above, and one `{skill-name}` and one
`{wiki-path}` are resolved, or the return says why none is.

## Step 2 — Mechanical baseline

Read [`lint.md`](lint.md) and execute its mechanical-baseline steps end to end, scoped to this
domain. Do not re-derive that logic here; cite it by section name, since its numbering is its own
to change. It gives you the freshness verdict, the `mdite` link and orphan check, `churn-check`,
and the capped deep-confirms.

Two differences from a `lint` run, because you are the agent that fixes things rather than the pass
that reports them:

- A finding you can settle against something you can see is an edit under Step 3, not a drift file.
- A finding you cannot settle is a line in the return, not a drift file. You are already the
  consumer of drift files; writing one to yourself is a loop.

Carry `lint.md`'s own report into the return's `## Mechanical Baseline` verbatim.

**Complete when:** the mechanical baseline has run over this domain and every one of its findings
is either fixed, listed in the return, or explicitly named as out of scope.

## Step 3 — Semantic lint, page by page

For every `*.md` page under `{wiki-path}` — excluding `SKILL.md`, `schema.md`, `protocols/*.md`,
group `index.md` nav pages, and anything under a path segment starting with `.` such as `.rulings/` — read the body and ask whether any claim it states is wrong against
what you can see. This is the check no mechanical detector performs: a stale claim with no
`code-cites` and no link has no trail to follow, and that is exactly the class of drift this step
exists to catch.

Apply the rubric per page: one determination, the evidence gate, read before edit, rewrite in
place, and the radius grep for the page. Every edit goes through `wiki-write` under
[`ingest-groom.md`](ingest-groom.md) Step 5.

Content is decided here: `leave`, `update`, `append`, `retire`. A `## Domain shape` no — a
finding-named slug, two pages on one subject, a page in the wrong group — goes on the ledger row
and onto the subject map, and `## Restructure branch` folds it after the map has decided gather or
separate. It is not a proposal from this step, and no `rename`, `merge`, `demote`, `split` or move
happens before the map is written.

**The ledger.** Maintain one row per page as you go: page, read at citation level yes or no,
determination, outcome. Never fold a page you skipped into a total. A ledger row that says `no` is
a signal in itself — it means the pass ran past the point where it could sustain per-page rigor —
so say that plainly in the return and name those pages for a follow-up rather than letting the gap
hide inside a count.

**Complete when:** the ledger has one row per page in scope, and every row carries a determination.

## Step 4 — Contradiction scan

For every pair of pages whose `tags:` share a prefix, or whose bodies plausibly cover the same
sub-topic, compare their claims for direct contradiction — not topical overlap, and not a missing
cross-reference. A pair's second page may sit in another domain: one `ingest-groom.md` `### Radius`'s grep named
for a page in this domain, or one whose `tags:` carry the same sub-topic word — the part after the
`/` — as a page in this domain. Find the second kind once per run: for each distinct word in this
domain's `tags:`, `grep -rl --include='*.md' "^tags:.*\b{word}\b" .claude/skills/` (and
`${HOME}/.claude/skills/` for a `scope: user` domain), dropping hits inside `{wiki-path}`. A page from another domain found either way is read once and
held against every page in this domain that states the same convention or mechanism — not only the
page whose tag or slug led to it.

- One page is falsifiable against what you can see, or one cites the commit or event that
  supersedes the other: rewrite the outdated page under Step 3, citing the other page's slug and
  the superseded claim as the evidence. A contradiction settled by code across domains is an
  `update` on this domain's page citing the other, as the evidence gate says; the other domain's
  page is never edited from here.
- Neither can be settled: the pair is a `sources-disagree` line in the return, naming both slugs
  and the claim in dispute. Do not pick one.

**Complete when:** every candidate pair has been compared and each contradiction is either
rewritten or named in the return.

## Step 5 — Conformance catalog, when the dispatch carries one

An `audit --fix` dispatch is a domain sweep whose prompt also carries that domain's `wiki-health`
findings and the conformance catalog verbatim. Apply the catalog as
[`audit.md`](audit.md) `## Applying with --fix` states — that page holds what the catalog obliges
and what closes a finding, and this step adds nothing to it. The audit's own re-run of the
detector, not your word, is what closes a finding.

**Complete when:** every catalog item is applied or its refusal is stated with a reason.

## Restructure branch

Applies [`page-standard.md`](../page-standard.md) `## Domain shape` to the domain as a whole.

1. **Write the subject map first.** Before moving anything, list every subject the domain holds,
   one line each: `{subject} — {target slug or group} ← {every page now holding it}`. A subject is
   what a reader would look up, per `## Admission` `### Shape`. A `Restructure:` dispatch starts from
   the map line its block carries and checks it against the pages as they now stand. Pages sharing
   a `tags:` value are one candidate subject: decide on the map whether they gather into one page
   or stay separate subjects before renaming any of them. The map goes in the return under
   `## Subject map`, so a later run folds against the same subjects.
2. **Fold subject by subject.** Take subjects in map order. For each one, carry out every change
   its map line implies — `merge`, `demote`, `rename`, `split`, move into a group, the prose links
   and the `## Pages` layout — under the rubric and the gate, then take the next. The budget counts
   subjects folded by a `merge`, `demote`, `split` or move — roughly ten per run, not the decisions
   inside them. A subject folded by `rename` alone is Tier A and counts nothing, however many there
   are; a subject already in shape is marked so on its map line and counts nothing. A subject that
   would not finish within the run is not started. The hubs take
   [`page-standard.md`](../page-standard.md) `### Hubs` on this pass too: fix (a) counts nothing,
   and one hub's check-4 rewrites, or any one of fixes (c) to (g), counts one subject.
3. **Propose the remainder.** Each unstarted subject is one `Proposal:` block opening
   `Restructure: {domain} — {subject}`, carrying its map line, its page list and its `Tier:` line; on a domain dispatch a group move
under one map line is one subject however many pages it moves, and its `Tier:` line says so
(`Tier: B — 1 subject`).

**Complete when:** the subject map is in the return, every subject on it is either fully folded
with `mdite lint --entrypoint SKILL.md` clean or named in its own `Restructure:` block, and no
subject is half-moved.

## Step 6 — Health check and return

After every write for this domain, run `wiki-health "{skill-name}"` — never `--full`, which is a
separate deep-audit pass whose concern is adding cross-references, not this one's. Record the
state.

Then re-read every page you wrote, end to end, as a first-time reader who does not know a sweep
ran. Anything that reads as a diary entry about the page moves into the return. Re-read even
though Step 3 already said so: a rule read once at the top of a long pass has faded by the last
page, and the re-read re-fires it exactly when the impulse to narrate your own edit is strongest.

The return extends the report shape in
[`ingest-groom.md`](ingest-groom.md) Step 6. Two sections are added on either branch:

```markdown
## Ledger
| Page | Read at citation level | Determination | Evidence |
|------|------------------------|---------------|----------|

## Health after
{state from wiki-health}
```

A run that took `## Restructure branch` adds `## Subject map` above them, carrying its map. A
whole-domain sweep adds one more, above them, carrying Step 2's output:

```markdown
## Mechanical Baseline
{lint.md's report, verbatim}
```

An approved sweep skipped Step 2 and has no baseline to report, so it omits that section rather
than running `lint.md` over the whole domain to fill it — the cost that branch exists to avoid.

You commit nothing. The uncommitted diff is what the user reviews.

**Complete when:** the return carries the ledger, the health state, and one line per page written
naming what it was checked against.
