# Init Workflow

`/wiki-memory init <domain>`

Creates a new wiki-backed skill. Fails if skill already exists (no overwrite).

## Pre-check: is this skill wiki-natural?

Before creating a wiki-backed skill, run the 4-test heuristic. If the skill fails
any methodology test, bail out — wiki structure adds navigation overhead without
query value for sequential procedural content.

**4-test heuristic:**

1. **Sequential test:** Does the agent need to read the SKILL.md top-to-bottom every
   time? → methodology, keep monolithic
2. **Query test:** Will an agent commonly load *one specific page* to answer *one
   specific question*? → wiki-natural
3. **Growth test:** Will this content grow over time as the LLM ingests new patterns?
   → wiki-natural
4. **Decomposition test:** Does decomposing the SKILL.md into pages require splitting
   sequential narrative into out-of-order fragments? → methodology, keep monolithic

**Naming heuristics:**
- `-expert` suffix is a soft wiki signal (but see carve-outs below)
- `-methodology`, `-rollout`, `-update` (verb-form), `-management` are strong
  methodology signals — default to monolithic unless all 4 tests clearly pass

**Carve-outs:** `plan-expert`, `estimation-expert`, and `sdd-expert` carry `-expert`
names but are sequential procedural content — they stay monolithic despite the suffix.

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

   Write each file directly to `.claude/skills/{skill-name}/` (or `~/.claude/skills/{skill-name}/` for user-scoped):

   **`.claude/skills/{skill-name}/SKILL.md`**:
   ```markdown
   ---
   name: {skill-name}
   description: "{description — WHAT + WHEN + Be Pushy formula}"
   ---

   <role>
     <identity>{domain} expert</identity>
     <purpose>{brief purpose statement}</purpose>
   </role>

   ## Pages
   <!-- Add pages as knowledge grows — one line per page:
        - [title](file.md) — one-line summary -->

   ## Meta
   - [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
   - [Schema](schema.md) — Wiki conventions and page-type definitions

   ## Foundational Principles

   <!-- Add key domain principles here -->
   ```

   **Note:** Do NOT add a "Last updated" rollup line to SKILL.md, log.md, or schema.md. Per-entry timestamps inside `log.md` (e.g., `## [{today}] init | …`) are additive and merge-safe. Rollup lines like `*Last updated: {date}*` cause git merge conflicts when multiple sessions edit the same wiki in parallel — never auto-bump them.

   **`.claude/skills/{skill-name}/.mditerc`**:
   ```
   entrypoint: SKILL.md
   ```

   **`.claude/skills/{skill-name}/schema.md`**:
   ```markdown
   # {skill-name} Wiki — Schema

   ## Page Types
   - **Knowledge page**: Core domain content with frontmatter (tags, summary, plus any per-domain required fields)

   ## Conventions
   - Filenames: kebab-case, descriptive
   - Links: standard markdown (`[Page](page.md)`)
   - Frontmatter: `tags` and `summary` required on all knowledge pages; additional required fields declared in this schema.md

   ## Evolution
   Review and update this schema after every 10-20 ingests.
   ```

   **`.claude/skills/{skill-name}/log.md`**:
   ```markdown
   # {skill-name} Wiki — Operations Log

   ## [{today}] init | Wiki created
   - Created: SKILL.md, log.md, schema.md, .mditerc
   - Domain initialized in skill folder (new-format wiki-backed)
   ```
4. **Write Meta pages directly** (`schema.md` and `log.md` are Meta scaffolding pages — not knowledge pages — so they are written with direct Write, same as `SKILL.md` and `.mditerc`):

   Write `schema.md` and `log.md` directly to `.claude/skills/{skill-name}/` (or `~/.claude/skills/{skill-name}/` for user-scoped) using the templates shown in step 3 above. Do NOT route these through `wiki-write` — `wiki-write` is for knowledge content pages that get indexed under `## Pages` in SKILL.md; Meta pages live under `## Meta` and must not be auto-appended to `## Pages`.
5. **Report**: Confirm creation with path and file list:
    - `.claude/skills/{skill-name}/SKILL.md` (wiki index — YAML frontmatter + role stub + `## Pages`)
    - `.claude/skills/{skill-name}/.mditerc` (`entrypoint: SKILL.md`)
    - `.claude/skills/{skill-name}/schema.md`
    - `.claude/skills/{skill-name}/log.md`

    Next steps:
    - Add knowledge pages as siblings in `.claude/skills/{skill-name}/`
    - Add each page as a `- [title](file.md) — summary` entry under `## Pages` in SKILL.md
    - Run `/wiki-memory ingest {domain}` after a session with domain discoveries
