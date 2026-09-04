---
summary: "create a new wiki-backed skill folder from scratch"
---

# Init Workflow

`/wiki-memory init <domain>`

Creates a new wiki-backed skill. Fails if skill already exists (no overwrite).

## Pre-check: is this skill wiki-natural?

Before creating a wiki-backed skill, run the shared 4-test heuristic + naming
heuristics + carve-outs (see [wiki-natural-heuristic.md](wiki-natural-heuristic.md)).
If the skill fails any methodology test, bail out — wiki structure adds navigation
overhead without query value for sequential procedural content.

**If the skill is methodology-flavored:** stop here.

```
RESULT: SKIP-METHODOLOGY
Reason: <free-text — which test(s) failed>
Action: Create a monolithic SKILL.md via `/skill-builder new <name>` instead.
        Wiki structure would add navigation overhead without query value.
```

**If the skill passes (wiki-natural):** continue to the numbered steps below.

---

1. **Validate domain name**: Must match `[a-zA-Z0-9_-]+` — reject `/`, `\`, `..`, spaces.
2. **Determine skill name and scope**:
   - Default skill name: `{domain}-expert` (confirm with user)
   - Default scope: project-scoped (`.claude/skills/{skill-name}/`)
   - User-scoped: `~/.claude/skills/{skill-name}/` — use `~/.claude/skills/` as the base path
   - Ask user to confirm scope if ambiguous (no `.claude/` present, or in home directory)
3. **Scaffold wiki-backed skill directly** (no staging step):
   Ask user for the skill description (drives auto-discovery — WHAT + WHEN + Be Pushy formula).
   If user declines, use a placeholder and remind them to fill it in before first use.

   ```bash
   mkdir -p .claude/skills/{skill-name}/
   ```

   (For user-scoped skills, use `mkdir -p ~/.claude/skills/{skill-name}/` instead.)

   Write three files directly to `.claude/skills/{skill-name}/` (or
   `~/.claude/skills/{skill-name}/` for user-scoped), each from its named block under
   `## Templates` below, substituting `{skill-name}`, `{domain}` and `{description}`:

   - `SKILL.md` — `### Template: SKILL.md`
   - `.mditerc` — `### Template: .mditerc`
   - `schema.md` — `### Template: schema.md`

   A new wiki has no knowledge pages yet; those arrive via `ingest`, a `query` filing, or
   `migrate`, each of which writes them through `wiki-write`.
4. **Write the Meta page directly** (`schema.md` is a Meta scaffolding page — not a knowledge
   page — so it is written with direct Write, same as `SKILL.md` and `.mditerc`):

   Write `schema.md` from its template to `.claude/skills/{skill-name}/` (or
   `~/.claude/skills/{skill-name}/` for user-scoped). Do NOT route it through `wiki-write` —
   `wiki-write` is for knowledge content pages that get indexed under `## Pages` in SKILL.md;
   Meta pages live under `## Meta` and must not be auto-appended to `## Pages`.
5. **Report**: Confirm creation with path and file list:
    - `.claude/skills/{skill-name}/SKILL.md` (wiki index — YAML frontmatter incl. `wiki: true` + role stub + `## Pages`)
    - `.claude/skills/{skill-name}/.mditerc` (`entrypoint: SKILL.md`)
    - `.claude/skills/{skill-name}/schema.md`

    Next steps:
    - Add knowledge pages through `wiki-write`, which installs the page and files its
      `## Pages` entry in the same call — the fenced region is machine-owned and is never
      hand-edited
    - Run `/wiki-memory ingest {domain}` after a session with domain discoveries

---

## Templates

Each block below is delimited by its `### Template: {name}` heading and ends at the next
`### Template:` heading or at end-of-file. **The block's content is the single fenced code
block under its heading** — prose after that fence is guidance for whoever writes the file,
never part of it. `protocols/audit.md` and `protocols/migrate.md` resolve template references
against these headings by name.

### Template: SKILL.md

```markdown
---
name: {skill-name}
description: "{description — WHAT + WHEN + Be Pushy formula}"
wiki: true
---

<role>
  <identity>{domain} expert</identity>
  <purpose>{brief purpose statement}</purpose>
</role>

## Pages
<!-- Pages are listed below, one bullet per page: a markdown link to the page
     file, an em dash, then that page's one-line summary. wiki-write writes
     them into the fenced region on every write. -->
<!-- BEGIN:PAGES -->
<!-- END:PAGES -->

## Meta
- [Schema](schema.md) — Wiki conventions and page-type definitions

## Foundational Principles

<!-- Add key domain principles here -->
```

**`wiki: true` is what makes this folder a wiki (D15), and it is the only identity test any
script or protocol applies.** Write it bare and lowercase, unquoted, as a top-level key inside
the frontmatter block whose first line is exactly `---`. `wiki: True`, `wiki: "true"`,
`wiki: yes`, `wiki:true`, an indented copy and a trailing comment all fail the same test
`wiki-health` applies (`_wiki_is_declared` in `scripts/wiki-health.sh`) — and they fail it
*silently*, because a rejected declaration is indistinguishable from no declaration at all. A
skill scaffolded without it is invisible to `/wiki-memory audit`, to `show`, and to every
protocol that resolves a domain, and nothing fails at creation time to tell you so. Verify it
after writing: `wiki-health {skill-name}` must not answer `not-a-wiki`.

The template above sits inside a fenced block in this protocol's body, so it declares nothing
about `init.md` itself — the parser stops at the frontmatter's closing `---`. What matters is
that the key lands inside the frontmatter of the `SKILL.md` you scaffold.

**The `<!-- BEGIN:PAGES -->` / `<!-- END:PAGES -->` pair** marks `## Pages` as a machine-owned
region that `wiki-write` regenerates wholesale on every write — an empty fence pair is the
correct scaffold for a domain with zero pages. Do not delete them as apparent noise; see
[marker-fenced-regions-convention](../../claude-code-ref-expert/marker-fenced-regions-convention.md)
for the full convention.

**Do NOT add a "Last updated" rollup line** to `SKILL.md` or `schema.md`. Rollup lines like
`*Last updated: {date}*` cause git merge conflicts when multiple sessions edit the same wiki in
parallel — never auto-bump them. Page staleness is tracked per page via `last-verified` plus
`git log`, never by a rollup line and never by an `updated:` frontmatter key, which
`wiki-health` flags as `FORBIDDEN_UPDATED_FIELD`.

### Template: .mditerc

```
entrypoint: SKILL.md
```

`.mditerc` is `mdite`'s config and a required conformance artifact of a healthy wiki — a
missing one is `MDITERC_MISSING` — but it is not the identity test; the declaration above is.

### Template: schema.md

````markdown
# {skill-name} Wiki — Schema

## Page Types
- **Knowledge page**: Core domain content with frontmatter (tags, summary, plus any per-domain required fields)

## Conventions
- Filenames: kebab-case, descriptive
- Links: standard markdown (`[Page](page.md)`)
- Frontmatter: `tags` and `summary` required on all knowledge pages; additional required fields declared in this schema.md

## Tag Prefix

Every knowledge page's `tags:` value opens with this domain's prefix:

```yaml
tags: [{skill-name}/{subtopic}]
summary: "One-line description of the page"
```

## Evolution
Review and update this schema after every 10-20 ingests.
````

**The fenced `tags:` example is load-bearing — do not drop it, unfence it, or indent it.**
`wiki-health`'s tag-prefix conformance check (`TAG_PREFIX_MISMATCH`) derives the prefix it
enforces by scraping the **first fenced `tags:` line in this file** and taking everything before
the first `/`. Its extractor matches the fence markers and the `tags:` line **at column zero
only**, so an indented example, an unfenced example, or no example at all yields an empty
prefix — and an empty prefix makes the check **skip every page** instead of failing one. A
domain scaffolded without it reports `healthy` with tag conformance silently unenforced, which
is indistinguishable from passing it. Substitute the real skill name when you write the file:
the literal `{skill-name}` placeholder would enforce a prefix no page can ever match.
