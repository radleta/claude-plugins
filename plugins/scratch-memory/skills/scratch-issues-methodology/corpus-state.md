# Corpus Conformance Audit

Procedure for auditing `scratch/issues/` against the schema and lifecycle rules in
[SKILL.md](SKILL.md), plus disposition guidance for each non-conformance class the procedure finds.
Run the checks below against your own corpus — don't trust any fixed inventory, including the
dated example at the bottom of this file, to still reflect your corpus's current state. No tooling
enforces conformance, so drift is expected.

## Audit procedure

Three checks to start — Classes 1 and 2 below, plus a no-frontmatter scan. A fourth, for stale
status, is at the end of this file.

```bash
# Class 1: status: resolved with no ## Resolution section
for f in scratch/issues/*.md; do
  if grep -q '^status: resolved' "$f" && ! grep -qE '^## Resolution\b' "$f"; then
    echo "$f"
  fi
done

# Class 2: missing ## Summary
for f in scratch/issues/*.md; do
  grep -q '^## Summary' "$f" || echo "$f"
done

# No frontmatter at all (predates the MCP writer)
for f in scratch/issues/*.md; do
  [ "$(head -1 "$f")" = "---" ] || echo "$f"
done
```

The Class 1 check and the no-frontmatter check are the same recipes as SKILL.md's query
cookbook, run in isolation and labeled by class. The Class 2 check is specific to this audit —
SKILL.md's cookbook has no ## Summary check.

All three classes above are now automated by `scratch-memory tasks lint 'scratch/issues/'` — Class 1
→ rule I7, Class 2 → rule I9, Class 3 (below) → rule I8. The loops above remain as the tool-free equivalent, for a corpus or a machine without the CLI on `PATH`.

## Class 1 — `status: resolved` with no `## Resolution` section

**What it means:** the file's frontmatter claims `status: resolved`, but no section heading matches
`^## Resolution\b` — the pairing rule in [SKILL.md](SKILL.md)'s Lifecycle section is violated.

**Why it happens:** there is no writer for `status`. The MCP server always writes `status: open` at
capture time (see SKILL.md's frontmatter table) and exposes no `resolve_issue` tool — every
`resolved` value in the corpus was hand-typed by someone editing the file directly, and nothing
enforces that the same hand-edit also adds the matching closing section.

**How to fix it:** write a real `## Resolution (YYYY-MM-DD)` section by hand, describing what
actually closed the issue and where (commit SHA, file, or plan reference) — **never** a mechanical
`_Not captured._` stamp. The whole point of the pairing rule is that a `resolved` file is traceable
to what resolved it; a placeholder satisfies the regex and defeats the purpose in the same motion.

### Worked example: `harden-researcher-md-pretooluse-hook-no.md`

This file, from the originating corpus's audit, illustrates a case the mechanical check alone gets
wrong. It flagged as Class 1 — `status: resolved`, no `## Resolution` heading — but it wasn't
actually missing a resolution. It had one, just under the wrong heading: a `## Update (2026-07-12)`
section describing a real, dated closure. The original fix mechanism (a metacharacter denylist) was
replaced, not extended, by an allowlist-based hardening (GATE 0 / GATE 0a) that closed the
parser-differential bypass class the denylist could never fully close by enumeration. That's a
complete, concrete resolution narrative — it just wasn't under `## Resolution`.

The judgment this demands: when a Class 1 hit turns out to have a real closure narrative parked
under a different heading, the fix is to **cite or carry that existing content forward** into the
`## Resolution` section, not to restate a generic closure or, worse, stamp `_Not captured._` over
content that already answers the question. A mechanical stamp here would have inserted a falsehood
into a file that already contained the true answer, purely to satisfy a regex. Read what a Class 1
hit actually contains before assuming it needs work from scratch.

## Class 2 — missing `## Summary`

**What it means:** the file has no section matching `## Summary` at all.

**Why it happens:** files that predate the MCP writer (see below) never had one stamped in the
first place; other files can lose or never gain one through hand-editing, since nothing enforces
the body template outside the write path.

**How to fix it:** write a real summary from the file's own existing prose — never a mechanical
placeholder. The same rule that governs Class 1 applies here: a stamp that satisfies a structural
check but contains no actual content is worse than an honestly-missing section, because it looks
done to the next reader without being done.

### No-frontmatter files

Some files predate the MCP writer entirely and carry no frontmatter block — the writer has always
emitted the full 10-key block on every write (see [SKILL.md](SKILL.md)'s frontmatter table), so a
file with none of it was never touched by that writer. Their git history is unrecoverable in the
sense that matters here: there is no prior write-time state to reconstruct `commit`, `branch`,
`repo`, or `captured` from, because no writer ever recorded that state for these files.

**Disposition rules, if frontmatter is ever added to a no-frontmatter file:**

- **Do not fabricate a plausible-looking `commit` SHA, `branch` name, or `captured` timestamp.** A
  SHA that looks real but isn't is worse than an admittedly-missing field — it will be trusted by
  the next reader who has no way to tell it apart from a genuine one.
- **`captured: unknown`-style sentinels are a known tradeoff, not a solution.** A magic-string
  sentinel poisons an otherwise-typed field: every future consumer of `captured` (sorting by date,
  computing staleness, filtering a range) now has to special-case the sentinel or silently
  mishandle it. That converts a field that's reliable everywhere else into one that's unreliable
  everywhere, because every consumer now needs defensive code it wouldn't otherwise need.
- **Prefer omitting the file from mechanical treatment over fabricating values.** If a corpus-wide
  script or query ever needs to iterate `captured` dates or commit references, no-frontmatter files
  should be treated as absent from that pass, not patched with invented data to make them fit. A
  reader who wants to know when one was written can `git log --follow` the file itself — the answer
  is recoverable per-file even where the frontmatter isn't.

## A third class: stale status

In principle there's a third non-conformance class — an `open` file carrying a `## Resolution`
section (resolved-looking content left under an open status). The two checks above don't cover it;
a third one-liner does:

```bash
# Class 3: status: open with a ## Resolution section
for f in scratch/issues/*.md; do
  if grep -q '^status: open' "$f" && grep -qE '^## Resolution\b' "$f"; then
    echo "$f"
  fi
done
```

If this check ever returns hits, they belong in a third section here with the same what/why/how
treatment as Classes 1 and 2 — not folded into either.

## Originating corpus, audited 2026-08-19

This is an example of the procedure's output, not a claim about your corpus. The originating
`claude-code-ref` repo ran this audit and a cleanup pass on 2026-08-19:

- **Class 1:** 0 remaining (was 6 — all fixed with evidence-backed `## Resolution` sections citing
  commits `4379b81`, `35075f8`, `7094e9b`, and deferred-findings rows).
- **Class 2:** 0 remaining (was 7 — all summarized from each file's own existing prose).
- **Class 3 (stale status):** 0 — no `open` file carries a `## Resolution` section.
- Corpus size and split were unchanged by the cleanup: 104 files, 27 open / 74 resolved. No
  `status` value was altered; the diff was 52 insertions, 0 deletions.
- Three files still carry no frontmatter — `knowledge-graduation-gap.md`,
  `teams-shutdown-ack-orphans.md`, `test-write-session-followup.md` — deliberately left that way,
  per the disposition rules above: their git state is unrecoverable, and fabricating
  `commit`/`branch`/`working_tree` values would be worse than the gap. This is a standing, accepted
  exception, not an open TODO.

Numbers like these describe one corpus at one point in time. Re-run the audit procedure above
against your own corpus rather than trusting this section to still be current.

## T10 legacy conformance sweep, 2026-08-23

This is the plan's one-time legacy conformance sweep (T10) — the first run of the shipped
`scratch-memory tasks lint 'scratch/issues/'` against the live corpus. It supersedes the audit above
in fact (the corpus has grown from 104 to 128 files since that earlier audit, and this run measures
all nine rules I1–I9, not just the three structural classes the earlier audit checked) but not in
history — that entry is left exactly as written above.

- **Before:** exit=1, 7 findings across 7 files (`/tmp/issues-lint-before.txt`).
  - I1, I2, I3, I4, I6, I7: 0 each.
  - **I5** (title > 80 chars, Class B): 4 —
    `convert-heavy-commands-to-orchestrator-agent-pattern.md` (83 chars),
    `human-voice-misses-labeled-announcement-colon.md` (99),
    `knowledge-ingest-stale-subdomain-attribution.md` (116),
    `subrepos-cannot-hold-external-repo-paths.md` (108).
  - **I8** (`open` with a stale `## Resolution`, Class A): 3 —
    `log-md-dual-writer-collision.md`, `no-post-write-quality-gate.md`,
    `wiki-write-from-payload-files-persist-in.md`.
  - **I9** (missing `## Summary`, Class 2): 0 — measured for the first time by this sweep.
- **After:** exit=0, 0 findings. The corpus lints clean.
- **Class A (I8) dispositions — 3 files, same shape:** each carries a `## Resolution (2026-07-11)`
  section immediately followed by a later `## Validation` section that reopens the issue for
  unresolved sub-problems — the resolution narrative never genuinely closed the issue. Per this
  file's own Class 1 guidance (read a hit's content before assuming it needs mechanical work), the
  fix was a heading retitle, not a status flip: `## Resolution (2026-07-11)` was renamed to
  `## Partial Progress (2026-07-11, NOT resolved)` — the Lifecycle table's documented non-closing
  form. `status: open` was left unchanged in all three; it was already correct.
- **Class B (I5) dispositions — 4 files, title shortened, meaning preserved, `slug`/filename
  untouched:** `convert-heavy-commands-to-orchestrator-agent-pattern.md` 83→58 chars;
  `human-voice-misses-labeled-announcement-colon.md` 99→68 chars;
  `knowledge-ingest-stale-subdomain-attribution.md` 116→77 chars;
  `subrepos-cannot-hold-external-repo-paths.md` 108→78 chars.
- **Class C (I4) outcome:** the recommended default shipped (`captured` accepts both `YYYY-MM-DD`
  and the full datetime), so `human-voice-misses-labeled-announcement-colon.md`'s date-only
  `captured: 2026-07-14` is not a finding. Zero findings, no edit, no standing exception recorded —
  the strict-I4 branch that would have required one did not ship.
- **Class D (I9) dispositions:** empty set — zero files lacked a `## Summary` section, so none
  needed writing, promoting, or renaming.
- Corpus size and split were unchanged by the sweep: 128 files, 38 open / 87 resolved. No `status`
  value was altered — the diff was 7 insertions, 7 deletions across exactly 7 files (the 3 Class A
  heading retitles plus the 4 Class B title shortenings; Class D contributed no files since its set
  was empty). The three no-frontmatter exempt files — `knowledge-graduation-gap.md`,
  `teams-shutdown-ack-orphans.md`, `test-write-session-followup.md` — produced zero lint output and
  were left untouched. Nothing was committed; the change sits in the `scratch/` subrepo working tree
  pending a user-approved `/commit-all`.
