---
tags: [claude-code/handoff]
updated: 2026-04-22
summary: "External handoff patterns surveyed April 2026: dual-output, manual ~70-80% trigger, 5-section structured summary emerge as consistent themes"
---

## Handoff Skill Landscape — External Patterns Survey (April 2026)

Five external handoff patterns surveyed while designing a handoff skill for claude-code-ref. No single dominant design; consistent themes: **dual-output** (direction + details), **manual trigger at 70–80% context**, and **structured 5-section summary**.

### Pattern 1: Smart Handoff (blog.skinnyandbald.com)

- **Files:** `.claude/commands/smart-handoff.md` + `context/WORKING.md`
- **Trigger:** Manual `/smart-handoff` at ~70–80% context
- **Output:** (a) custom `/compact` message tuned to goal + (b) `WORKING.md` details file
- **Resume:** Paste custom compact message, then `Read context/WORKING.md and continue`
- **Insight:** Direction alone loses nuance; details alone lose purpose. Dual output is the point.

### Pattern 2: Cult of Claude `/handoff`

- **Files:** `.claude/handoffs/[date]-[description].md`
- **Trigger:** Manual
- **Sections:** Metadata (date, project path, duration), Current State, What We Did, Decisions Made (with rationale), Code Changes, Open Questions, Context to Remember, Next Steps, Files to Review
- **Flow:** Claude assesses → asks what to capture → generates → saves
- **Insight:** Human-curated scope (Claude asks what to capture) reduces noise but loses a key class of implicit context Claude never thinks to ask about.

### Pattern 3: Continuous-Claude-v3 (GitHub parcadei)

- **Files:** `thoughts/ledgers/CONTINUITY_<topic>.md` (within-session) + `thoughts/shared/handoffs/<session>/` (between-session)
- **Trigger:** Hooks: `pre-compact-continuity` (auto-save before compaction), `session-end-cleanup`
- **Schema:** YAML frontmatter with `date`, `session_name`, `status` (complete | in_progress)
- **Infrastructure:** PostgreSQL (sessions, file_claims, archival_memory, handoffs) + BGE-large embeddings for semantic recall
- **Insight:** Two-tier split — active ledger for live progress + archival handoff for cross-session — is the cleanest conceptual model. Heavy infra for general use.

### Pattern 4: JD Hodges handoff prompt template

- **Files:** Single prompt pasted into next session (no file)
- **Sections:** Goal / Current status (done / in-progress / todo) / Important context / Decisions made (with reason) / What to avoid (failed attempts) / Open questions / Next best step / How to respond
- **Insight:** "What to avoid" section is underrepresented elsewhere — failed attempts are high-value context that compaction discards first.

### Pattern 5: superpowers SessionStart re-injection (obra)

- **Not a work-state handoff.** Re-injects `using-superpowers` skill on `startup|clear|compact` via SessionStart hook.
- **Insight:** Even without work-state, you must re-inject *routing knowledge* so post-compact Claude knows how to find skills again. Handoff without this safeguard fails silently when Claude forgets skills exist.

### Anthropic Official Position

- CLAUDE.md is the only auto-surviving file across sessions — "keep it lean, every token is one you can't use for conversation"
- `/compact` is "low effort, Claude decides what mattered" — lossy summarization
- `/clear` — "zero rot; you control exactly what carries forward" — but fresh canvas, nothing preserved
- Esc-Esc rewind — preserves file reads, discards failed attempts
- Recommend: fresh session for new task; subagents for intermediate output

### Compaction Failure Modes (badlogic gist)

1. Auto-compact at 95% triggers mid-task → "goes off the rails"
2. Sequential compactions degrade cumulatively
3. Generic summaries lose implementation detail
4. **Recommended:** trigger earlier (85–90%), structure around 5 dimensions (completed / current state / in-progress / next steps / constraints), allow custom instructions (`/compact --focus-todos-only`)
5. **Behavioral erosion:** post-compaction Claude shows "ghost lexicon" (missing terminology) and altered tool-call patterns

### Synthesis — Design Implications

Any handoff skill should:

1. **Produce a dual output** — compact hint + detail file (Pattern 1)
2. **Trigger before auto-compact** at ~85% (badlogic)
3. **Include an explicit "what to avoid / failed attempts" section** (Pattern 4)
4. **Re-inject skill-routing knowledge on resume** (Pattern 5)
5. **Prefer the /clear + structured-doc path over /compact** when the user can reach for it manually (see [Handoff → Clear → Pickup Flow](handoff-clear-pickup-flow.md))

### Related Pages

- [Handoff → Clear → Pickup Flow](handoff-clear-pickup-flow.md) — the clear-based alternative to compaction
- [Session-ID Lifecycle](../session-lifecycle/session-id-lifecycle.md) — which session events preserve vs mint session_id

**Discovered:** During brainstorming step 1 investigation for handoff skill design (2026-04-22).
