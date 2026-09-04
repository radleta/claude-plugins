#!/usr/bin/env node
// handoff-legacy.mjs — V1→V2 upgrade machinery for trailing legacy handoff folders.
//
// Most fleets are already V2 (sessions/ log) or v3 (thin pointer). A few old
// folders predate the per-session log: a single 10-section HANDOFF.md and no
// sessions/ subfolder. The only live consumer of these constants is pickup.mjs's
// `shape === 'legacy'` migration block, which rewrites such a folder into a V2
// skeleton on first /pickup (after which the next /handoff regenerates a v3
// pointer). The maintained write paths in handoff.mjs no longer touch V1/V2 —
// they redirect to `rewrite-pointer` instead — so this machinery lives here,
// off the hot path, to keep handoff.mjs focused on the current v3 surface.
//
// Exports:
//   EXPECTED_SECTIONS_V1   — legacy ordered section headings (pre-v2)
//   HANDOFF_TEMPLATE_V2     — v2 HANDOFF.md template (schema_version: 2)

// V1 (legacy) ordered section headings. pickup.mjs uses these to recognize a
// pre-v2 HANDOFF.md body when refining an 'inconsistent' detectShape result into
// 'legacy' before mechanical migration.
export const EXPECTED_SECTIONS_V1 = [
  '## Goal',
  '## Current state',
  '## Done this session',
  '## In progress',
  '## Decisions made',
  '## What to avoid',
  '## Open questions',
  '## Key files & artifacts',
  '## Next best step',
  '## Skills loaded',
];

// V2 HANDOFF.md template: YAML frontmatter block + 10-section body per spec Data Model.
// schema_version: 2. pickup.mjs extracts the body (after the frontmatter block) to
// build the V2 skeleton when migrating a legacy folder forward.
export const HANDOFF_TEMPLATE_V2 = `---
session_id: ''
session_chain: []
goal: ''
first_written: ''
last_updated: ''
last_synthesized: ''
schema_version: 2
git_branch: ''
session_name: ''
related_projects: []
---
## Goal

## Current state

## Next best step

## Active decisions

## Active what-to-avoid

## Open questions (still open)

## Skills — Mandatory

## Skills — Available

## Projects

## Sessions
`;
