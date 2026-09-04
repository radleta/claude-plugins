---
tags: [claude-code/log]
updated: 2026-04-24T00:00:00Z
summary: "Operations log for claude-code wiki"
---

# Claude-Code Wiki — Operations Log

## [2026-05-12] ingest | builders/skill-edit-bypass-permissions-exemption.md
- Ingested from research investigation into Claude Code skill-edit security prompt history
  - Findings → builders/skill-edit-bypass-permissions-exemption.md
- Finding (platform behavior): v2.1.79 regressed `.claude/skills/` edit protection to fire even in bypassPermissions mode; docs always claimed exemption but binary only listed commands/agents.
- Fix: v2.1.120 wired `.claude/skills/` (plus agents and commands) into the bypass-mode exemption; v2.1.126 broadened to all `.claude/`, `.git/`, `.vscode/`, and shell config files.
- Caveat: default-mode + Edit(.claude/**) allow-list still prompts (Issue #36497 OPEN); .claude/settings* still gated.
- Impact: skill-edit wrapper is no longer strictly required in bypass mode on v2.1.120+ but remains the portability default per project convention.
- Sources: anthropics/claude-code issues #36497, #41526, #42366; Claude Code changelog v2.1.120 + v2.1.126.
- Updated: SKILL.md ## Pages — added entry in Standalone Pages section; builders/skill-patterns.md — Write Strategy section updated with version-gated guidance and cross-link.

## [2026-05-07] ingest | impl-subagent-model-inheritance-gotcha.md
- Ingested 1 learned file from `scratch/install-scope-flags/learned/`
  - impl-subagent-model-inheritance-gotcha.md → subagent-model-tier-inheritance.md
- Finding (gotcha): Agent model tier is declared in its own YAML frontmatter, not inherited from parent `--model` flag on `claude -p`. Appears high-cost when parent claims to use cheap tier but dispatches high-tier subagent.
- Mitigation: Check subagent frontmatter before running `claude -p` smoke tests; for fast validation of MCP tools, call MCP directly (seconds vs. 11+ minutes).
- Impact: Any test of a command that dispatches high-tier subagents will incur the subagent's full cost regardless of parent flags.
- Updated: SKILL.md ## Pages — added entry in Standalone Pages section

## [2026-05-03] ingest | CLI wrapper path coupling (deploy-branch-tags step 8)
- Ingested 1 learned file from `scratch/deploy-branch-tags/learned/`
  - step-08-command-edit-wrapper-broken.md → merged into builders/skill-edit-path-coupling.md
- Finding (gotcha): During `claude-command-builder` → `claude-code-expert` consolidation, `command-edit.sh` was not migrated; it required manual reconstruction at `claude-code-expert/scripts/command-edit.sh` from the `skill-edit.sh` pattern. The `~/.local/bin/command-edit` wrapper then needed updating to point to the new location.
- Key distinction: `command-edit` handles single-file commands (flat staging with `.md`/`.snapshot`/`.origin` per command), whereas `skill-edit` handles skill directories (subdirectory staging). Both are vulnerable to path-coupling failures during consolidation.
- Impact: Consolidation protocol must account for CLI tool relocation before source deletion. Reconstruction may be required if a tool script was not copied during consolidation.
- Updated: builders/skill-edit-path-coupling.md — added "Related Tools: command-edit Wrapper" section with consolidation gotcha and generalized pattern

## [2026-04-30] consolidate | 9 sources → claude-code-expert: 10 pages written

Page-routing manifest:

```json
[
  {"source_skill": "claude-skill-builder", "target_path": "builders/skill-patterns.md", "action": "PROMOTE"},
  {"source_skill": "claude-agent-builder", "target_path": "builders/agent-patterns.md", "action": "PROMOTE"},
  {"source_skill": "claude-command-builder", "target_path": "builders/command-patterns.md", "action": "PROMOTE"},
  {"source_skill": "claude-plugin-builder", "target_path": "builders/plugin-patterns.md", "action": "PROMOTE"},
  {"source_skill": "claude-md-builder", "target_path": "builders/md-builder-patterns.md", "action": "PROMOTE"},
  {"source_skill": "claude-hooks-expert", "target_path": "platform-features/hooks.md", "action": "PROMOTE"},
  {"source_skill": "claude-session-data-expert", "target_path": "platform-features/session-data.md", "action": "PROMOTE"},
  {"source_skill": "claude-dash-p-expert", "target_path": "platform-features/dash-p.md", "action": "PROMOTE"},
  {"source_skill": "claude-teams-expert", "target_path": "platform-features/teams.md", "action": "PROMOTE"},
  {"source_skill": "(new)", "target_path": "builders/index.md", "action": "NEW-INDEX"},
  {"source_skill": "(new)", "target_path": "platform-features/index.md", "action": "NEW-INDEX"}
]
```

- Sources: 9 skills absorbed (claude-skill-builder, claude-agent-builder, claude-command-builder, claude-md-builder, claude-plugin-builder, claude-hooks-expert, claude-session-data-expert, claude-dash-p-expert, claude-teams-expert)
- Pages written: 10 (5 in builders/, 4 in platform-features/, 2 index.md hubs)
- Cross-references rewritten: 0 (all 58 mentions were prose-only; no skills: YAML or ## Pages link targets found)
- Source folders deleted: 9
- SKILL.md ## Pages: replaced with Topic Areas sub-section (6 subdir hubs, 0 standalone pages)
- schema.md ## Scope: rewritten to remove absorbed-skill boundary referrals
- plugin-manifests/claude-code-builders.json: updated to replace 6 absorbed skills with claude-code-expert
- claude-teams-expert log.md/schema.md: wiki infrastructure merged via content synthesis (not file copy)

## [2026-04-24] ingest | Agent registration timing (handoff-cli step 1)
- Ingested 1 learned file from `scratch/handoff-cli/learned/`
  - new-subagent-types-require-session-restart.md → agent-registration-requires-restart.md
- Finding (gotcha): Creating new agent files mid-session does NOT register them for `Agent({ subagent_type: ... })` dispatch in the same session. Agent registry is built at session start (same index as `@` autocomplete). Both UI and programmatic dispatch fail until next session.
- Patterns: (1) Sequential sessions with /clear boundary, (2) Probe-before-dispatch with clear fallback message, (3) Inline behavior as command/skill rather than new agent file.
- Impact: Command design — any command that creates a new agent file must use one of the three patterns; silent fallback violates design intent (e.g., lean command's tail can't run without its new agent).
- Updated: index.md — added entry under Agent Design section; bumped page count 8 → 9

## [2026-04-24] created | /rename and session folder labels (session-name-folders step 10)
- Created: rename-and-session-labels.md
- Source: session-name-folders steps 1-10 implementation (2026-04-23)
- Sections: What /rename does | Name lifecycle table | scratch-memory slug resolution algorithm | session folder naming rules | known limitations (restart loses name, first-handoff-after-clear, mid-workstream rename, collision)
- Cross-links added to: handoff-clear-pickup-flow.md (new paragraph on slug resolution), rename-persistence-mechanism.md (referenced), session-id-lifecycle.md (referenced)
- Updated: handoff-clear-pickup-flow.md — added "How /rename Populates the Slug" section with PID file resolution description and link to new page
- Updated: index.md — added entry under Session Lifecycle section; bumped page count 6 → 7

## [2026-04-23] ingest | Hybrid dispatch — Boundary 1 step 4 (coder + step 3 tail)
- Ingested 1 new learned file from `scratch/hybrid-dispatch-lean/learned/`
  - step-03-constraint-body-tools-drift.md → agent-constraint-drift.md
- Finding (gotcha): Agent `tools:` list and `<constraint>` block descriptions can drift when capabilities expand. Readers trust prose first, creating security verifier confusion and verification iteration tax. Fix: wording that states capability AND its gating (e.g., "Bash restricted to git read-only via hook") rather than blanket deny.
- Impact: Agent design pattern — applies to any agent that gains tool access; prevents constraint-block staleness from accumulating in the codebase.
- Note: research-subagent-dispatch-cache-economics.md already ingested in prior step; page exists with `updated: 2026-04-23`.

## [2026-04-23] ingest | Sub-agent dispatch cache economics (hybrid-dispatch-lean)
- Ingested 1 learned file from `scratch/hybrid-dispatch-lean/learned/`
  - research-subagent-dispatch-cache-economics.md → subagent-dispatch-cache-economics.md
- Finding: Boilerplate inlined in dispatch prompts costs ~50× more per token than placing in agent body/preloaded skill (5× output→input, 10× fresh→cached within 5-min TTL). Runtime file Reads don't cache effectively (tool-result lands after variable dispatch). Pattern: stable structure → agent body; step-variable data → dispatch prompt; lazy bulk → paths.
- Impact: All hybrid commands (`/implement-code-hybrid`, `/brainstorming-hybrid`) should follow dispatch-prompt hygiene: byte-identical prefix with variables after.

## [2026-04-22] ingest | Handoff skill research findings
- Ingested 3 learned files from `scratch/handoff-skill/learned/`
  - research-handoff-landscape.md → handoff-landscape.md
  - research-session-id-lifecycle.md → session-id-lifecycle.md
  - research-handoff-clear-pickup-flow.md → handoff-clear-pickup-flow.md
- Created 3 wiki pages with cross-links
- Findings: session_id lifecycle differs across 4 SessionStart matchers (compact preserves, clear mints new, startup injection unreliable per #10373, resume fully reliable); /handoff → /clear → /pickup flow bypasses context rot by replacing lossy /compact with structured state doc; external handoff pattern survey (5 patterns) converges on dual-output + ~85% trigger + what-to-avoid section + skill-routing re-injection

## [2026-04-23] ingest | Command parity discovery
- Ingested 1 learned file from `scratch/implement-code-parity/learned/`
  - research-3d-verify-per-step-asymmetry-user.md → command-dispatch-parity-patterns.md
- Finding: Sub-agent-dispatching commands encapsulate verification internally (coder agents run tests, verifiers read reports); main-session commands must explicitly run acceptance-criteria checks before dispatching verifiers. Both patterns valid, intentional design difference. Steps 3c/3d/3e have inverted semantics but same letter designations across command pairs.
- Related architectural pattern: When designing paired command variants, the instinct to "mirror exactly" is correct for 70% of steps; dangerously wrong for steps that encapsulate critical checks.

## [2026-04-23] ingest | Boundary 1 step 5 — implement-code-parity (confirmation pass)
- Scanned: `scratch/implement-code-parity/learned/`
- Status: 0 new files to ingest (2 files already ingested in prior boundary; no new captures in step 5 implementation)
- Related files: `scratch/implement-code-parity/learned/research-3d-verify-per-step-asymmetry-user.md` already routed to command-dispatch-parity-patterns.md

## [2026-04-23] update | handoff-clear-pickup-flow — slug-or-uuid folder naming
- Updated: handoff-clear-pickup-flow.md
- Change: Replaced bare `{id}` and `{old_id}/{new_id}` references with `{slug-or-uuid}` throughout, to reflect the Invariant #1 rewrite in handoff-methodology SKILL.md (step 06 of session-name-folders). Invariant 1 now explicitly states: slug when named, uuid fallback when unnamed. `session_chain` stores UUIDs only, never slugs.

## [2026-04-23] ingest | /rename persistence mechanism (session-name-folders step 1)
- Ingested 1 learned file from `scratch/session-name-folders/learned/`
  - research-rename-persistence-mechanism.md → rename-persistence-mechanism.md
- Finding: `/rename` writes to process-scoped `~/.claude/sessions/{pid}.json` with name + updatedAt fields. Survives `/clear` (same process), lost on process exit. Does not propagate to `sessions-index.json` (no persistence across restart). Deterministic PID matching requires cwd + session_chain + updatedAt tiebreak.
- Impact: Session-name-folders can use `/rename` to drive `scratch/S-{slug}/` folder naming via PID file reading at handoff/pickup time.

## [2026-04-22] init | Wiki created
- Created: index.md, log.md, schema.md, .mditerc
- Domain registered in paths.env
- Thin skill created: `.claude/skills/claude-code-expert/SKILL.md`
