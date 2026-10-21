# Corpus Conformance Audit

Contents: Audit procedure · Class 1 — a closed file with no `## Resolution` section · Class 2 — missing `## Summary` · A third class: stale status

Procedure for auditing `scratch/issues/` against the schema and lifecycle rules in
[SKILL.md](SKILL.md), plus disposition guidance for each non-conformance class the procedure finds.
Run the checks below against your own corpus — don't trust any fixed inventory, including the
dated example at the bottom of this file, to still reflect your corpus's current state. No tooling
enforces conformance, so drift is expected.

## Audit procedure

Three checks to start — Classes 1 and 2 below, plus a no-frontmatter scan. A fourth, for stale
status, is at the end of this file.

```bash
# Class 1: a closed file with no ## Resolution section
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

Class 2 and Class 3 are automated by `scratch-memory tasks lint 'scratch/issues/'` — Class 2 → rule
I9, Class 3 (below) → rule I8. **Class 1 no longer has a lint**: rule I7 keyed off the retired
`resolved` status, and retargeting it at the settled four would have fired on files closed before
the citation requirement existed. The Class 1 loop above is now the only sweep for it, so run it by
hand when auditing. The others remain as the tool-free equivalent, for a corpus or a machine without
the CLI on `PATH`.

## Class 1 — a closed file with no `## Resolution` section

**What it means:** the file's frontmatter claims `status: resolved`, but no section heading matches
`^## Resolution\b` — the pairing rule in [SKILL.md](SKILL.md)'s Lifecycle section is violated.

**Why it happens:** the MCP server always writes `status: open` at capture time (see SKILL.md's
frontmatter table) and exposes no `resolve_issue` tool. The `scratch-memory issue close` CLI verb
writes the status and the `## Resolution` together, but a status can still be hand-typed by
someone editing the file directly, and nothing enforces that the same hand-edit also adds the
matching closing section.

**How to fix it:** write a real `## Resolution (YYYY-MM-DD)` section by hand, describing what
actually closed the issue and where (commit SHA, file, or plan reference) — **never** a mechanical
`_Not captured._` stamp. The whole point of the pairing rule is that a `resolved` file is traceable
to what resolved it; a placeholder satisfies the regex and defeats the purpose in the same motion.

### Worked example: `harden-researcher-md-pretooluse-hook-no.md`

This file, from the originating corpus's audit, illustrates a case the mechanical check alone gets
wrong. It flagged as Class 1 — a closed status, no `## Resolution` heading — but it wasn't
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

### Legacy files, with frontmatter or without

Some files predate the MCP writer entirely — the writer has always emitted the full 10-key block on
every write (see [SKILL.md](SKILL.md)'s frontmatter table), so a file missing any of those keys was
never touched by that writer. Their git history is unrecoverable in the sense that matters here:
there is no prior write-time state to reconstruct `commit`, `branch`, `repo`, or `captured` from,
because no writer ever recorded that state for these files.

**Two shapes, one rule.** The original wording here covered only files with *no* frontmatter block
at all, and the lint's D12 exemption was written to match. That turned out to be the rarer shape. A
corpus migrated by hand instead tends to carry *partial* frontmatter — typically `title`, `slug`,
`status`, sometimes an honest `tool: manual-migration` — and those files fell straight through an
exemption written for the all-or-nothing case, reporting provenance findings that could never be
legitimately cleared without breaking the first rule below.

The lint now keys the exemption off the claim rather than the shape: the six provenance keys
(`tool`, `repo`, `branch`, `commit`, `captured`, `working_tree`) are demanded only of files carrying
`tool: write_issue`, the literal the server always emits. A file that does not claim the writer is
not asked for the writer's stamps. Everything else stays enforced, `kind` included — it is a
classification you get by reading the file, not a provenance record.

One consequence worth naming: a modern file whose `tool` value is edited away silently leaves the
enforced set. That is the intended reading, not a hole — a file that no longer claims the writer no
longer asserts the provenance the writer would have stamped. If you find a file claiming
`tool: write_issue` while missing one of the six, the honest repair is to correct the claim, never
to invent the missing value.

**Disposition rules, if frontmatter is ever added to or completed on a legacy file:**

- **Do not fabricate a plausible-looking `commit` SHA, `branch` name, or `captured` timestamp.** A
  SHA that looks real but isn't is worse than an admittedly-missing field — it will be trusted by
  the next reader who has no way to tell it apart from a genuine one.
- **`captured: unknown`-style sentinels are a known tradeoff, not a solution.** A magic-string
  sentinel poisons an otherwise-typed field: every future consumer of `captured` (sorting by date,
  computing staleness, filtering a range) now has to special-case the sentinel or silently
  mishandle it. That converts a field that's reliable everywhere else into one that's unreliable
  everywhere, because every consumer now needs defensive code it wouldn't otherwise need.
- **Prefer omitting the file from mechanical treatment over fabricating values.** If a corpus-wide
  script or query ever needs to iterate `captured` dates or commit references, legacy files
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
