# wiki-memory Wiki — Schema

## Wiki Domain Structure

| File | Purpose |
|------|---------|
| `SKILL.md` | Navigation hub: YAML frontmatter + role stub + `## Pages` (page links + one-line summaries) |
| `schema.md` | Wiki conventions: page types, naming rules, frontmatter requirements |
| `.mditerc` | mdite config: `entrypoint: SKILL.md` |
| `*.md` | Knowledge pages — flat siblings alongside SKILL.md |

## Wiki Declaration

A skill is a wiki when its `SKILL.md` frontmatter declares it. That declaration is the only
identity test: `wiki-health` reads it and nothing else, and a skill folder that does not declare
itself is not reported as a broken wiki — it is not reported at all.

| Key | Required | Meaning |
|-----|----------|---------|
| `wiki: true` | yes | This skill folder is a wiki domain |
| `tags-prefix:` | no | The tag namespace this domain's pages use |
| `audit-skip:` | no | Check IDs this wiki intentionally deviates on, so the audit reports the deviation as declared rather than as a finding |

`wiki: true` must be bare, lowercase and unquoted, at the top level of the frontmatter block whose
first line is exactly `---`. `wiki: True`, `wiki: "true"`, `wiki: yes`, `wiki:true`, an indented
copy, and a trailing comment all fail — the reader is `_wiki_is_declared` in
`scripts/wiki-health.sh`, and it is deliberately narrow, because a declaration that parses
differently in different readers is not a declaration. Of the three keys, only `wiki: true` is
read today; the tag prefix is still derived from the fenced `tags:` example in this file.

**That key set is closed, and closing it is the point. Adding a key to it is a design change, not
an implementation detail.** No free-text key, no append-shaped key, no timestamp, and no record of
which maintenance has run: a declaration that accepts any of those becomes an operations log under
a new name within a few protocol edits — the accretion this wiki has already been through once,
and the reason its routine operations log was retired outright rather than reformatted.

## Page Conventions

Every wiki page (except `SKILL.md`, `schema.md`, `.mditerc`, `protocols/*.md`) requires YAML frontmatter:

```yaml
---
tags: [wiki-memory/operations]
summary: "One-line description"
---
```

`tags:` and `summary:` are required on every write — `wiki-write` validates their presence
unconditionally on both create and update paths. The auditable reference set (what
churn/freshness checking tracks) is literal markdown links in prose (AD1), e.g.
`[wiki-write.sh:196](../../wiki-memory/scripts/wiki-write.sh)` — line precision goes in the
anchor text, not a separate frontmatter field. A legacy `code-cites:` array is tolerated if
present on an existing page but is no longer required or written on new pages; churn/freshness
checking reads the union of legacy `code-cites:` values and in-prose external links until
migration to links-only is complete (AD9).

## Machine-Owned Regions in SKILL.md

`SKILL.md`'s `## Pages` bullet list is a machine-owned region: it is
regenerated wholesale by `wiki-write` on every write, not hand-patched entry
by entry. The region is delimited by HTML-comment fences,
`<!-- BEGIN:PAGES -->` / `<!-- END:PAGES -->`, wrapping each contiguous run of
`- [slug](slug.md) — summary` bullets under `## Pages`. Sub-headings
(`### Topic Areas`, `### Standalone Pages`, `### Archived`, or any bespoke
sub-heading) and the `## Meta` section are human curation and are never
fenced.

This is the wiki-specific instance of a general repo convention — the fence
syntax, the HTML-comment-only rule (with its `mdite`-orphan evidence), the
bullet-run grammar, and the idempotency requirement are defined once, in
[`marker-fenced-regions-convention`](../claude-code-ref-expert/marker-fenced-regions-convention.md),
and are not restated here.

## Verification Tracking

Pages carry a `last-verified:` field (YAML quoted date string, e.g. `last-verified: "2026-08-20"`) tracking when they were last confirmed against current code knowledge. It is written only on a substantive verification event — a clean `--deep` confirm, or an applied drift correction — never on an `unknown` result and never on a skipped check. Edit history is tracked by git; verification history is tracked by this field alone.


