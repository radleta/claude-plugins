---
name: local-memory
description: "Manages Active Projects working memory in CLAUDE.local.md — a minimal-token index that survives context compaction and session boundaries. Use when starting a session, completing a plan step, changing direction, forking into sub-tasks, or wrapping up — even for quick status updates between steps."
user-invocable: true
argument-hint: "[push|pop|defer|sync|show] [project-name]"
---

<role>
  <identity>Working memory manager for active project context</identity>
  <purpose>Keep CLAUDE.local.md as a live index of what Claude is doing, why, and where to find details — surviving compaction and session boundaries with minimal token cost</purpose>
  <scope>
    <in-scope>
      <item>Active Projects section in CLAUDE.local.md</item>
      <item>Stack operations: push (start/fork), pop (return to parent), defer (park for later)</item>
      <item>Sync: read scratch/ plans and git state to refresh status</item>
    </in-scope>
    <out-of-scope>
      <item>Long-form project documentation (belongs in scratch/)</item>
      <item>Persistent cross-session memory (use ~/.claude memory system)</item>
      <item>Plan creation or modification (use /plan-it)</item>
    </out-of-scope>
  </scope>
</role>

## Operations

Parse `$ARGUMENTS` to determine operation:

| Command           | Action                                                                |
| ----------------- | --------------------------------------------------------------------- |
| `sync` or no args | Read scratch/ plans, git log, update Active Projects to current state |
| `push <name>`     | Add a new project or fork entry to the stack                          |
| `pop`             | Complete current top-of-stack item, return to parent                  |
| `defer <reason>`  | Park current work with a note, pop to parent                          |
| `show`            | Display current Active Projects state (no changes)                    |

## Sync Protocol

When syncing (default operation):

1. **Read** current CLAUDE.local.md
2. **Scan** scratch/ for plan files matching `scratch/*/plan.md` and `scratch/*/impl-*.md` — look for `✅ COMPLETED` phase headers, `- [x]`/`- [ ]` checkboxes, and `## Step N:` progress
3. **Check** recent git log (last 10 commits) for changes touching files in active project scratch/ paths or since the last-updated date
4. **Update** all three sections inside the `<local-memory>` tags — move projects between Active/Deferred/Completed as status warrants
5. **Preserve** everything outside the `<local-memory>` tags (instance config, etc.)
6. If no `<local-memory>` tags exist, append the section after existing content

## Active Projects Entry Format

Each project entry is 6-8 lines max — detail lives in scratch/.

```
### {Project Name} (`scratch/{path}/`)
- **Status**: {one-line: current step/phase}
- **Direction**: {key design approach — the thing compaction loses}
- **Stack**: {current focus} → {parent task} → {root goal}
- **Plans**: `scratch/{path}/plan.md`, `scratch/{path}/impl-phase-X.md`
- **Skills**: {skill-1}, {skill-2} — {why loaded}
- **Decisions this session**: {D-id}: {one-liner} | {D-id}: {one-liner}
- **Last updated**: {ISO date}
```

**Key fields**:

- **Stack** — the focus chain. After compaction, Claude reads "I was debugging X which is part of step Y which is part of project Z."
- **Direction** — the thing most likely to be lost: architectural decisions, approach changes made mid-conversation.
- **Skills** — which skills to load for this work, preventing re-discovery overhead.

## Stack Operations

### Push (start new work or fork into sub-task)

```
/local-memory push user-library
/local-memory push "fix CSS grid layout"
```

- If project exists: prepend new focus to its Stack field
- If new: add entry with Status = "Starting", scan scratch/ for plan files
- Push during existing work = fork (e.g., fix iteration during implementation)

### Pop (complete current focus, return to parent)

```
/local-memory pop
```

- Remove top of Stack for current project
- If one item left: project is at root task
- If popping completes the project: move to `## Completed Projects` section (keep `###` heading, strip Stack/Decisions/Skills fields, keep Status/Direction/Plans/Last updated)

### Defer (park work with context)

```
/local-memory defer "waiting on design review"
```

- Move project entry from `## Active Projects` to `## Deferred Projects` section (keep `###` heading level)
- Add `Deferred` field with reason and trigger condition for resuming
- Preserve all other fields (Status, Direction, Stack, Plans, Skills, Decisions, Last updated)
- Resume = move entry back to `## Active Projects`, remove `Deferred` field

## Data Format

Wrap everything in `<local-memory>` tags. Inside, use three `##` sections in this order:

1. `## Active Projects` — work in progress
2. `## Deferred Projects` — parked with reason and resume trigger
3. `## Completed Projects` — shipped work (minimal: Status set to "Committed ({hash})" or "Completed", Direction, Plans, Last updated)

All projects use `###` headings regardless of section. Deferred entries keep the full active format plus a `Deferred` field. Completed entries drop Stack, Skills, Decisions, and Deferred fields.

### Legacy Format Migration

If CLAUDE.local.md uses the old format (blockquote instructions, `<!-- BEGIN/END_ACTIVE_PROJECTS -->` HTML comment markers, flat one-line deferred entries), upgrade it during the next sync:

1. Remove `<!-- BEGIN_ACTIVE_PROJECTS -->` and `<!-- END_ACTIVE_PROJECTS -->` markers
2. Remove the blockquote instruction block (`> **Claude: You MUST...`)
3. Wrap the section in `<local-memory>` tags
4. Convert flat deferred entries to full-format with `Deferred` field
5. Add `## Deferred Projects` and `## Completed Projects` sections; move entries to their correct section

## Example: Complete Active Projects Section

```markdown
<local-memory>
## Active Projects

### User Library (`scratch/user-library/`)
- **Status**: Phase 3-5 UI — building Step 2 (SaveToLibraryDialog)
- **Direction**: Drive-like folder browser — folders as primary navigation with breadcrumbs, not sidebar filters. Search is main discovery. Rework planned after Phase 5 components built.
- **Stack**: SaveToLibraryDialog stories → Phase 3-5 UI impl → User Library feature
- **Plans**: `scratch/user-library/plan.md`, `scratch/user-library/impl-phase-3-5.md`
- **Skills**: akn-frontend-expert, plan-expert — UI component architecture + CDD phasing
- **Decisions this session**: E6: dialog is standalone | Drive-like rework after Phase 5
- **Last updated**: 2026-03-13

## Deferred Projects

### tier-pricing-page (`scratch/tier-pricing/`)
- **Status**: Spec complete, awaiting content
- **Direction**: Three-tier pricing with annual discount
- **Deferred**: Waiting on marketing copy from Bill
- **Stack**: (empty)
- **Plans**: `scratch/tier-pricing/README.md`
- **Skills**: frontend-design, react-expert
- **Decisions this session**: D1-D5 in idea.md
- **Last updated**: 2026-03-28

## Completed Projects

### Skill-Builder Wiki Pattern (`scratch/skill-builder-wiki/`)
- **Status**: Committed (c414b48)
- **Direction**: Wiki-backed as file structure pattern in claude-skill-builder
- **Plans**: `scratch/skill-builder-wiki/README.md`
- **Last updated**: 2026-04-08
</local-memory>
```
