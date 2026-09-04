# winforms-expert Wiki Operations Log

## [2026-04-29] protocol-revision-canary | healthy → healthy | iter-8 re-canary (no changes needed)
- wiki-health winforms-expert --full exits 0 under iter-8 audit.md (WMF-D22/D23 relationship-strength + content-class rubric); no re-migration required

## [2026-04-28] migrate | partial-migration → healthy | cross-reference pass (round 2)

Second round of cross-references: 122 heading-similarity pairs discovered after round 1. Added See Also sections for cross-group links (quality-checklist ↔ notifyicon-lifecycle ↔ core-principles, gdi-icon-rendering ↔ all groups). Also fixed color-aging.md code block boundary (## Related was inside ``` block). Also added AC4 backlink: SKILL.md AOT pitfall → notifyicon-lifecycle/contextmenu-patterns.md.

## [2026-04-28] migrate | partial-migration → healthy | cross-reference pass

Step 5b deep scan (29 tag-overlap pairs) + noun-phrase cross-links applied. All cross-reference additions are additive — no pages deleted, no structural reshaping. Pages updated:
- quality-checklist/lifecycle-disposal.md: Added Related (disposal-on-exit, notifyicon-lifecycle/disposal) + Related Checklists section
- quality-checklist/thread-safety.md: Added Related Checklists section
- quality-checklist/icon-rendering.md: Added Related Checklists section
- quality-checklist/notifications-ux.md: Added Related Checklists section
- quality-checklist/architecture.md: Added Related Checklists section
- notifyicon-lifecycle/disposal.md: Added Related section (disposal-on-exit, creation, icon-updates, balloon-notifications)
- notifyicon-lifecycle/balloon-notifications.md: Added Related section (creation, disposal, icon-updates)
- notifyicon-lifecycle/creation.md: Added Related section (disposal, icon-updates, balloon-notifications)
- notifyicon-lifecycle/icon-updates.md: Extended Related section (creation, disposal, balloon-notifications)
- core-principles/thread-affinity.md: Added Related section (gdi-handles, single-instance, message-pump, disposal-on-exit)
- core-principles/single-instance.md: Added Related section (message-pump, thread-affinity, gdi-handles, disposal-on-exit)
- core-principles/message-pump.md: Added Related section (thread-affinity, single-instance, gdi-handles, disposal-on-exit)
- core-principles/disposal-on-exit.md: Added Related section (notifyicon-lifecycle/disposal, gdi-handles, thread-affinity, message-pump, single-instance)
- core-principles/gdi-handles.md: Extended Related section (thread-affinity, disposal-on-exit, single-instance, message-pump)
- gdi-icon-rendering/color-aging.md: Added Related section (circle-icon, text-overlay)
- gdi-icon-rendering/circle-icon.md: Extended Related section (color-aging)
- gdi-icon-rendering/text-overlay.md: Extended Related section (color-aging)
- layout-collapse-mental-walk.md: Added Related section (tablelayoutpanel-getrowheights-type)
- tablelayoutpanel-getrowheights-type.md: Added Related section (layout-collapse-mental-walk)

## [2026-04-26 20:52] ingest | 4 new pages from overlay-dashboard-context/learned/

Ingested 4 learned files from `scratch/overlay-dashboard-context/learned/step-08-*.md`:
- layered-window-bounds-cache-staleness.md (gotcha: Form.Bounds stale on layered windows)
- form-anchor-bottom-edge-on-resize.md (pattern: reanchor form on resize with AutoSize)
- windowfrompoint-z-order-gate-for-hover.md (gotcha: Rectangle.Contains insufficient for hover intent)
- layered-window-bounds-sync-setbounds.md (gotcha: SetBounds partial mitigation for Form.Bounds)

## [2026-04-28] migrate | partial-migration → healthy | body decomposition

Decomposed 508-line SKILL.md body into wiki pages. 7 pre-existing pages retained (KEEP). New pages:
- agent-mistakes.md (promoted: Top 10 Agent Mistakes)
- core-principles/ (split: 5 sub-pages for Core Principles)
- notifyicon-lifecycle/ (split: 4 sub-pages for NotifyIcon Lifecycle)
- contextmenu-patterns.md (promoted: ContextMenuStrip Patterns)
- gdi-icon-rendering/ (split: 3 sub-pages for GDI+ Icon Rendering)
- application-context-pattern.md (promoted: ApplicationContext Pattern)
- quality-checklist/ (split: 5 sub-pages for Quality Checklist)
Retained inline: Investigation Protocol, .NET 10 AOT, Common Pitfalls, Success Indicators.
`## Pages` placed at END (D34: retained prose > 30 lines). schema.md tag prefix already correct.

## [2026-04-26] migrate | static→wiki-backed | seed (no prior wiki content)

Migrated `winforms-expert` from static-format SKILL.md to wiki-backed format. No prior `~/.wiki-memory/winforms-expert/` directory existed — this is a seed migration triggered by escalated learned files in `scratch/overlay-dashboard-context/learned/` (step 8 of overlay-dashboard-context plan). Subsequent `/wiki-memory ingest winforms-expert` will populate the `## Pages` index.
