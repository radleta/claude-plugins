---
summary: "worked examples for audit.md's normative rules, referenced on demand to keep audit.md lean"
---

# Audit Worked Examples

Companion reference to `audit.md` — worked examples and edge-case illustrations for the audit
protocol's normative rules, split out to keep `audit.md` lean at dispatch time (migrate loads
audit as its own Step 2, so audit.md's size is paid on every migrate dispatch too). All
normative rules, thresholds, and tables live in `audit.md`; this file only illustrates them
with concrete scenarios. The winforms-expert GDI/NotifyIcon migration recurs as the running
example because it was the first skill migrated through this pipeline.

## Step 2a Tag-Prefix PATCH Example

Concrete example from winforms-expert migration:

| Path | Action | Detail |
|------|--------|--------|
| `dual-context-form-mode-flag.md` | PATCH | tag prefix winforms → winforms-expert |
| `form-anchor-bottom-edge-on-resize.md` | PATCH | tag prefix winforms → winforms-expert |
| `layered-window-bounds-cache-staleness.md` | PATCH | tag prefix winforms → winforms-expert |

## Step 3a Content-Class Examples

One worked example per content class (see audit.md Step 3a for the class definitions and
default actions):

- **Procedural (KEEP):**
  - *winforms-expert example:* `## Investigation Protocol` — the agent consults this before
    writing any WinForms code. Keeping it inline means it is immediately available. Action: KEEP.
  - *csharp-expert example:* `## Project Detection` — environment detection steps the agent
    needs before deciding which patterns apply. Action: KEEP.
- **Lookup-time reference (PROMOTE):**
  - *winforms-expert example:* `## Common Pitfalls` — consulted when something goes wrong, not
    proactively. Thin SKILL.md + dedicated page is better. Action: PROMOTE.
  - *react-expert example:* `## Common Hooks Mistakes` — reference content, not procedural.
    Action: PROMOTE.
- **Conditional / niche (PROMOTE):**
  - *winforms-expert example:* `## .NET 10 and AOT Considerations` — only relevant when targeting
    AOT. Agents working on standard WinForms apps never need it. Action: PROMOTE.
  - *csharp-expert example:* `## Nullable Reference Type Migration` — niche topic for projects
    enabling NRTs. Action: PROMOTE.
- **End-of-work QA (PROMOTE):**
  - *winforms-expert example:* `## Success Indicators` — reviewed after implementation is done.
    Action: PROMOTE.
  - *react-expert example:* `## Quality Checklist` — post-implementation QA; not needed at
    skill-load time. Action: PROMOTE.

## Step 5b Signal Edge Cases

Illustrations of what does NOT count as a signal match (see audit.md Step 5b for the three
signal definitions):

*Anti-example (code-block fingerprint):* Two pages each containing a `csproj` snippet with
`<TargetFramework>` are NOT near-identical — one may be a NuGet packaging guide and the other
a multi-target build setup. Code-block fingerprint fires only when the surrounding code logic
(not just framework boilerplate) overlaps substantially.

*Not a separate signal (semantic relatedness):* heading-text similarity alone should not emit
`CROSS-REFERENCE`. It must combine with substantive content overlap to clear the "reader
benefit" bar.

## Step 5b Cross-Link Example

`core-principles/gdi-handles.md` describes the clone-and-destroy pattern.
`notifyicon-lifecycle/icon-updates.md` and `gdi-icon-rendering/circle-icon.md` both use the
pattern (code-block fingerprint match). None of the three currently link to each other.
Step 5b should emit:

| Path | Action | Detail |
|------|--------|--------|
| `core-principles/gdi-handles.md` | CROSS-REFERENCE | bidirectional link to notifyicon-lifecycle/icon-updates.md |
| `notifyicon-lifecycle/icon-updates.md` | CROSS-REFERENCE | bidirectional link to core-principles/gdi-handles.md |
| `core-principles/gdi-handles.md` | CROSS-REFERENCE | bidirectional link to gdi-icon-rendering/circle-icon.md |
| `gdi-icon-rendering/circle-icon.md` | CROSS-REFERENCE | bidirectional link to core-principles/gdi-handles.md |

## Step 5b Saturation Cap Example

Suppose `gdi-icon-rendering/circle-icon.md` (A) has 12 candidate cross-references after the
pairwise pass. Ranked by tier (see audit.md Step 5b's Relationship-strength ranking table):

| Candidate | Tier | Keep? |
|---|---|---|
| A → `core-principles/gdi-handles.md` | Strongest (tag + code) | yes |
| A → `gdi-icon-rendering/square-icon.md` | Strong (code only) | yes |
| A → `notifyicon-lifecycle/icon-updates.md` | Strong (code only) | yes |
| A → `rendering-patterns/clip-region.md` | Medium (semantic) | yes |
| A → `rendering-patterns/double-buffer.md` | Medium (semantic) | yes (5th) |
| A → 7 remaining pages | Weak | no |

Result: page A emits exactly 5 `CROSS-REFERENCE` rows. Each referenced page independently
applies its own top-5 cap.

## Step 6 Group-Affinity Examples

**Anti-examples — do NOT propose group membership for these patterns:**

[a] **Slug-prefix coincidence**: pages under `decision-trees/` (csharp-expert) share the
directory name token "decision-tree" in their slugs. A new candidate tagged
`csharp-expert/null-handling` should NOT be filed into `decision-trees/` solely because
its slug contains "null-handling" and `decision-trees/null-handling.md` exists. The slug
prefix is a filing convention — `null-handling` under `decision-trees/` and a new
`null-handling-advanced.md` at top level address different navigation needs.

[b] **Same tag, orthogonal concerns**: pages tagged `react/hooks` may cover `useState` rules
(state management) and `useEffect` dependency arrays (side-effect management). A new
candidate also tagged `react/hooks` about `useReducer` patterns does NOT automatically
belong in an existing `hooks/` group — the shared tag reflects domain category, not
navigational grouping. Assess whether a reader navigating the group would expect to find
all three pages there together.

**Concrete example** — `contextmenu-patterns.md` (about ContextMenuStrip for NotifyIcon):
- `notifyicon-lifecycle/` group contains pages about NotifyIcon creation, lifecycle, disposal.
- The candidate covers ContextMenuStrip *for* NotifyIcon — same component, same lifecycle context.
  A reader navigating `notifyicon-lifecycle/` would expect to find it there.
- Action: `PROMOTE`, Target: `notifyicon-lifecycle/contextmenu-patterns.md`
- Detail: `group-affinity: candidate covers NotifyIcon sub-domain, fits notifyicon-lifecycle/`

## Fleet Report and Dispatch Ceiling Example

Illustrates `## Fleet mode` and `## Applying with --fix` Step 12 (see audit.md for the normative
rules — the ceiling of 10, the alphabetical ordering, and the never-truncate-silently obligation).

A fleet of 48 declared domains where 12 carry findings and one undeclared skill folder is
structurally wiki-shaped. Report mode prints:

```
Fleet audit: 48 declared domains — 36 healthy, 12 with findings, 1 adoption candidate.
```

The 47 undeclared skills with no structural signal produce no rows at all — they are
`not-a-wiki`, and that is the difference between this report and one that flags every
deliberately-monolithic skill in the repo as an unmigrated wiki.

With `--fix`, 12 affected domains exceed the 10-per-run ceiling. The first 10 alphabetically are
dispatched, and the run says so rather than reporting 12 repairs:

```
Deferred: 2 domain(s) over the 10-per-run dispatch ceiling — winforms-expert, xlsx-expert
Re-run `/wiki-memory audit --all --fix` to continue.
```

Then Step 13's re-run reports what the second mechanical pass found, per domain — not what the
agents said they did:

```
react-expert:   3 finding(s) → 0 remaining   [closed: MISSING_SUMMARY, TAG_PREFIX_MISMATCH, ORPHAN_PAGE]
csharp-expert:  2 finding(s) → 1 remaining   [closed: LEGACY_LOG_PRESENT | still open: NAV_SUMMARY_MISMATCH]
```

`csharp-expert`'s remaining finding is the expected shape, not a failure: `NAV_SUMMARY_MISMATCH`
is repaired by re-running `wiki-write --update` on the page so the fenced nav regenerates, and an
agent that correctly refused to hand-edit inside the fence leaves it open and says so.

## Example Plan Output

```markdown
state: partial-migration
triggers: BODY_WEIGHT_EXCEEDED, D34_PLACEMENT_VIOLATION
files-accounted: 12
pages-current: 6
pages-proposed: 14

## Files

| Path | Action | Detail |
|------|--------|--------|
| SKILL.md | DECOMPOSE | 512 lines / 11 sections after ## Meta → per section-decomposition table |
| schema.md | PATCH | fix tag prefix winforms → winforms-expert |
| .mditerc | KEEP | entrypoint already correct |
| bounds-cache.md | MERGE-INTO | substantial overlap with new bounds-cache section |
| form-anchor-bottom-edge-on-resize.md | KEEP | standalone page, no overlap |

## Section Decomposition

| Section | Lines | Action | Target |
|---------|-------|--------|--------|
| ## Overview | 8 | KEEP | SKILL.md landing prose |
| ## Architecture | 45 | PROMOTE | architecture.md |
| ## Configuration | 62 | PROMOTE | configuration.md |
| ## Event Handling | 38 | PROMOTE | event-handling.md |
| ## Layered Windows | 120 | SPLIT | layered-windows/ (group index + 3 pages) |
```
