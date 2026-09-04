---
tags: [investigation, workflow, wiki-first, index-first, knowledge-distillation]
summary: "Numbered 7-step investigation protocol for the researcher agent: index-read → page-drill → freshness-check → live-fallback → 3-filter → classify → persist. Includes FSM state references and per-step decision rules."
---

# Investigation Workflow

The researcher follows a fixed 7-step protocol in every dispatch. The steps map directly to the FSM State & Transition Matrix (spec.md §State & Transition Matrix). Each step is self-contained: a reader following this page can execute the full protocol without consulting sibling pages, though Decision Frameworks (decision-frameworks.md) contains the detailed 3-filter routing table and classification override rules.

---

<protocol>

## Step 1 — Read the Index (FSM: `dispatched` → `index-read`)

**Action:** Read `{project}-expert/SKILL.md` (if it exists) then the matching `{domain}-expert/SKILL.md`. Locate the `## Pages` heading and enumerate listed pages.

**Why first:** Index-first navigation is a core LLM Wiki principle (llm-wiki-expert core-principles.md principle 4). Reading the index before drilling into pages avoids redundant live investigation when the answer is already synthesized.

**Branch conditions from `index-read`:**

| Condition | Next step |
|-----------|-----------|
| `{project}-expert/` folder does not exist | Silent fall-through to domain checks (no error, no auto-init here) |
| `{domain}-expert/` folder does not exist at any scope | Skip to Step 4 (live-fallback); may auto-init at project scope when filing |
| Folder exists but `SKILL.md` has no `## Pages` heading or heading is empty | Skip to Step 4 (live-fallback); do NOT re-init an existing domain |
| Folder exists with `## Pages` but no page matches the question | Skip to Step 4 (live-fallback); add a new page via wiki-write after 3-filter |
| Folder exists with matching pages | Proceed to Step 2 (drilling) |

---

## Step 2 — Drill Into Candidate Pages (FSM: `index-read` → `drilling`)

**Action:** Read 1-3 candidate pages relevant to the investigation question. Choose pages whose `## Pages` entry summary most closely matches the question domain.

**Limit:** Read at most 3 pages. If the question requires more than 3 pages to answer from the wiki, treat it as a cache miss and proceed to Step 4.

**Special case — principle pages:** If a candidate page has no external reference — no non-empty legacy `code-cites:` value AND no external markdown link in the body (the union cite set per AD1/AD9) — it is a principle page with nothing cited to check freshness against. Skip Step 3 for that page and proceed directly to Step 4 (synthesize-from-wiki).

---

## Step 3 — Per-Page Freshness Check (FSM: `drilling` → `freshness-check`)

**Action:** For each candidate page that has at least one external reference (a non-empty legacy `code-cites:` value, an external markdown link in the body, or both — the union cite set per AD1/AD9), run:

```bash
wiki-health freshness {domain}-expert {page-slug}
```

Interpret the output status string:

| Status string | Meaning | Action |
|--------------|---------|--------|
| `fresh` | Wiki page is current vs cited paths | Proceed to Step 4 (synthesize-from-wiki) |
| `stale-timestamp` | A cited path changed since the wiki page was last written | Run deep verification (Step 3a) |
| `unknown` | Page has no external reference (no `code-cites:` value and no external md-link) or git metadata unavailable | Treat as fresh; proceed to Step 4 |

**Step 3a — Deep verification (on `stale-timestamp`):**

```bash
wiki-health freshness --deep {domain}-expert {page-slug}
```

| Deep result | Action |
|-------------|--------|
| `stale-semantic` — researcher will rewrite | Write a drift learned file (path: `scratch/{project}/learned/drift-{ts}-{slug}.md`), then proceed to Step 4 (live-fallback) to gather corrected content |
| `stale-semantic` — researcher does NOT rewrite (insufficient context budget or borderline) | Write a drift learned file, return prose with a bare `Source: wiki+verified` trailer (no `Wiki:`/`Issue:`/`Drift:` line — the drift learned file location is described in prose); stop |
| `fresh` (false alarm — file changed elsewhere) | The page is confirmed accurate: stamp `last-verified` (see below), then proceed to Step 4 (synthesize-from-wiki) |

**Drift learned file frontmatter:** `type: drift`, `severity: minor|misleading` (informational only — does not affect routing), `status: captured`, `source:` resolved from dispatcher identity (see Step 7 for source resolution rules), `target-domain:` uses the skill-folder name (e.g., `claude-code-ref-expert`).

**The `last-verified` stamp.** A `--deep` confirm is the only researcher path that may write `last-verified`, and it writes on exactly two outcomes: a deep result that comes back clean, and a drift correction applied through `wiki-write --update`. Never on `unknown`, never on the Step 3 mechanical result, and never from the JIT read-gate bundle — that gate treats an uncomputable page as fresh, so a stamp from it would record a verification that never happened. Stamping a clean confirm means re-filing the page through `wiki-write --update` with its body unchanged and the field set to today's date. The value is a **quoted** YAML string (`last-verified: "2026-08-27"`): `wiki-write` never auto-quotes, and rejects a bare date with exit 2, so construct the quoted form in the payload yourself. This is the one read path that writes, and it is what keeps verification state from going stale — nothing else bumps the field.

---

## Step 4 — Live Investigation on Cache Miss or Drift (FSM: `live-fallback` → `live-investigate`)

**Trigger conditions:**
- No matching wiki domain or page found (Step 1 branch conditions above)
- Freshness check confirmed drift requiring live correction (Step 3a)

**Action:** Use Read, Glob, Grep to investigate the codebase directly. File-paths-not-content discipline applies: collect file paths and line references first; read content only for the specific sections needed to answer the question.

**Context-fill gate:** If context fill reaches ≥80% mid-investigation, stop exploration. Return prose stating the investigation is incomplete, with a bare `Source: live` trailer (no `Wiki:`/`Issue:`/`Drift:` line — Layer 3 dropped the `Status:` field, so the trailer's mere presence plus incomplete-signaling prose is the orchestrator's cue). Partial notes MAY be written to `learned/` at researcher's discretion; if written, prose must reference the path so the next dispatch can feed-forward. The 80% threshold is a design decision (not a fixed framework constant) chosen to leave enough context for synthesis and output construction.

**Bash scope:** Bash is authorized for these commands only during investigation:
- `git log`, `git config --get remote.origin.url`, `git rev-parse --show-toplevel`
- `wiki-health freshness {domain} [{page}]` (with optional `--deep`, `--json`, `--quiet`)
- `wiki-health cited-paths {domain} {page}`
- `wiki-write {domain} {slug} --from {payload-file}` (Step 7 only)

No other Bash commands are permitted during investigation.

---

## Step 5 — Apply Knowledge-Distillation 3-Filter (FSM: `live-investigate` → `apply-3-filter`)

**Action:** Apply all three filters from the knowledge-distillation skill to each candidate finding:

| Filter | Test | Pass condition |
|--------|------|----------------|
| **F1 — Claude already knows?** | Would a well-trained LLM know this without project context? | Pass only if Claude would NOT know this without the codebase |
| **F2 — Verb attached?** | Can this be written as an instruction? ("Include X when Y", "Call Z before W") | Pass only if the insight has an actionable verb — purely descriptive facts fail |
| **F3 — Principle, not instance?** | Is this a repeatable pattern (not a one-off)? | Pass if it's a principle; or if it's a justified instance that IS a convention, contradicts what Claude would assume, or causes repeated failures |

**Routing:**

| 3-filter result | Next step |
|----------------|-----------|
| All three pass (clear-pass) | Step 6 (classify) |
| One or more fail (reject) | Return prose only; no persistence; no trailer |
| Mixed / borderline | Write `learned/research-borderline-{ts}-{slug}.md`; return prose only; NO trailer |

**Also apply knowledge-capture negative rules** (dual-filter authority — both must clear):
- "Already in the spec/plan" → skip
- "Generic knowledge Claude already has" → skip
- "Transient" → skip
When a finding passes the 3-filter but hits a knowledge-capture negative rule, the negative rule wins.

If a Filter 4 failure is detected on existing wiki content during this step, apply the auto-heal protocol — see § Auto-Heal Rules.

**Compression pass** (before Step 6): Collapse instances to a principle. Prefer a table row over a paragraph. Prefer a checklist item over a sentence. File the compressed form, not the raw finding.

---

## Step 6 — Classify the Finding (FSM: `apply-3-filter` → `classify`)

**Action:** Determine whether the finding is project-specific or domain-generic, then resolve the target scope.

**Classification rules:**

| Finding type | Indicator | Target |
|-------------|-----------|--------|
| **Project-specific** | Cites internal paths (`.claude/`, `scratch/`, project-owned files) | `.claude/skills/{domain}-expert/` (project scope) |
| **Domain-generic** | No internal path citations; applies across projects | Probe project scope first, then user scope; auto-init at project scope only (NEVER auto-init at user scope) |

**Citation override:** If researcher's judgment suggests domain-generic but the finding cites internal paths → override to project-specific. The citation is authoritative.

**`--update` vs create decision:**
- New page slug (does not exist yet): call `wiki-write` WITHOUT `--update`
- Existing page slug (drift correction or synthesis extending an existing page): call `wiki-write` WITH `--update`; synthesize a complete set of `**Source:**` links from content authored (do NOT copy an existing legacy `code-cites:` list verbatim — write real in-prose links per AD1)

---

## Step 7 — Persist via wiki-write or learned/ (FSM: `classify` → `persist-wiki` OR `emit-fallback-learned`)

**Primary path — wiki-write:**

```bash
wiki-write {domain}-expert {slug} --from {payload-file}
```

**Payload cleanup is deliberately absent here — do not add it.** Every other `wiki-write --from`
callsite is instructed to clean up its payload via `mktemp` plus a `trap`. This agent cannot: its
own `PreToolUse` Bash hook enforces a character allowlist (letters, digits, space, and
`- _ . / = :`) plus a command allowlist (`wiki-health`, `wiki-write`, `churn-check`, narrow
`mdite`, read-only `git`). That rejects `$(mktemp)`, `trap`, and `rm` outright — and rewriting the
call above to pass `"$payload_file"` instead of a literal path makes the write itself blocked, not
just the cleanup. Keep the literal-path form. Payloads land in `/tmp`, which the OS reclaims.

Payload file format (write to `/tmp/researcher-payload-{slug}.md` or similar):

```markdown
---
tags: [relevant, tags]
summary: "One-sentence description of what this page documents."
---

## [Page Title]

[Page body — compressed finding in instruction form]

**Source:** [file.ext:NN](../../relative/path/to/file.ext)

**Discovered:** [phase/context]
**Impact:** [scope of effect]
```

Add a `last-verified:` line to that frontmatter **only** when this write is a deep-confirm stamp or an applied drift correction (Step 3a) — quoted, e.g. `last-verified: "2026-08-27"`. An ordinary filing never carries one.

**Source field resolution** (for `source:` in any learned/ file emitted this step):

| Dispatcher identity in prompt | `source:` value |
|-------------------------------|----------------|
| `/brainstorming` | `brainstorming/research` |
| `/implement-code` (with step number) | `implementation/step-NN` |
| `/implement-code` (no step number) | `implementation/ad-hoc` |
| `/plan-it` | `planning/investigation` |
| Not stated | `implementation/ad-hoc` (least-specific valid fallback) |

**Fallback path — emit-fallback-learned** (when wiki-write exits non-zero):

Write to `scratch/{project}/learned/{slug}.md` using the knowledge-capture schema. Trailer fires with a bare `Source: live` line — no `Wiki:` line, since no wiki page was written. Prose describes where the fallback file landed. Orchestrators detect the fallback via a `Source: live` trailer with zero `Wiki:` lines.

**Output trailer** (bimodal contract):

```
Wiki: {domain}/{slug} (created|updated)          # 0+ lines, one per wiki page filed
Issue: <absolute-path>                            # 0+ lines, one per issue file filed
Drift: {domain}/{slug}                            # 0+ lines, drift heal applied without writing a new wiki page
AutoHeal: {category}={domain}/{slug}->{target}    # 0+ lines, one per D6 auto-heal action
Withheld: {domain} (<one-line reason>)            # 0+ lines, filing declined despite a 3-filter clear-pass
Source: wiki | wiki+verified | live               # exactly 1, present whenever the trailer fires
```

Trailer fires only on persistence events. Pure cache hits (wiki answered the question, no drift, no write) produce NO trailer — prose only.

</protocol>

---

## Auto-Heal Rules

**Trigger condition:** Researcher reads an existing wiki page during normal investigation AND notices content that fails Filter 4 with high confidence. Auto-heal is opportunistic — it fires at the moment of reading, not as a separate sweep.

### High-Confidence Operationalization

Content fails Filter 4 with **high confidence** when ALL of the following hold:
- The content appears in the page body (not under any `## Known Issues`, `## Future Work`, `## TODO`, or equivalent explicit forward-looking header)
- The content uses future-tense modal verbs (`should`, `needs to`, `could be improved`) or imperative cleanup framing ("fix X", "refactor Y", "consider changing Z")

When in doubt — leave the wiki page alone. High-confidence-only is a hard constraint.

### Hard Constraints (all must hold before proceeding)

1. **High-confidence only** — when uncertain whether content is misclassified, do NOT proceed
2. **Preserve human-curated sections** — never extract or modify content under explicit `## Known Issues`, `## Future Work`, `## TODO`, or equivalent forward-looking section headers; these are intentionally forward-looking and are exempt from D6 auto-heal
3. **Single page per investigation** — after completing one auto-heal action, the protocol exits — no fan-out, no second-page scan within the same investigation
4. **No new agent dispatches** — use only tools already in researcher's toolset; do not invoke the Agent tool from within auto-heal
5. **No commit** — researcher writes only; the user reviews D6 actions in the normal `/commit-all` (or `git commit`) diff
6. **Issue write before wiki write** — the `/capture-issue` write MUST succeed before touching the wiki page; if the issue write fails, abort entirely
7. **No retry of issue on wiki-write failure** — if wiki-write fails after the issue is already filed, report the failure in prose and stop; the issue serves as the durable record

### 7-Step Protocol

1. Read the target wiki page in full.

2. Identify content that fails Filter 4 with high confidence. If no high-confidence candidates exist, exit the protocol — do not touch the wiki page.

3. Construct the `/capture-issue` body with `kind: mixed`. **Separately**, pass `related: "wiki:{wiki-domain}/{wiki-slug}"` as a parameter to `mcp__scratch-memory__write_issue` — the `related` parameter (NOT a body-template field) is what produces the D12 back-link in the rendered issue's `## Related` section. This back-link is **MANDATORY** for every D6 auto-heal call — never omit it; the wiki page being healed must be reachable from the issue.

4. Call `mcp__scratch-memory__write_issue` **FIRST**. If this call fails, **abort** — do not touch the wiki page. The issue must exist before any wiki modification begins.

5. Build a modified payload file with the misclassified content removed. Preserve all human-curated sections verbatim. The payload MUST include both required frontmatter fields (`tags:`, `summary:`) — `wiki-write --update` enforces these unconditionally. Update any `**Source:**` links to reflect path citations in the edited page content (a legacy `code-cites:` value is tolerated if the page already carries one, per AD9, but is no longer required).

6. Invoke `wiki-write {domain} {slug} --from {modified-payload} --update`. Use the exact domain name from the page being healed (e.g., `billing-backend-expert`, `dynamodb-expert`) — the domain here is the skill-folder name, which includes the `-expert` suffix for expert-skill domains. If this fails, do NOT retry the issue write (the issue is already filed with a `related:` back-reference to the wiki page); proceed to step 7, which reports the failure to the caller.

7. Emit the `AutoHeal:` trailer field in the response, and state in prose what was moved and where:
   ```
   AutoHeal: {category}={domain}/{slug}->{target}
   ```

   | Token | Values |
   |-------|--------|
   | `{category}` | `drift` or `misclassification` |
   | `{domain}/{slug}` | the wiki page that was healed |
   | `{target}` | `/capture-issue` file path (for `misclassification`) or `(none)` (for `drift`) |

   The field is present only when a D6 auto-heal action was performed. Do not emit `AutoHeal: (none)` — absence means no action ran.

   **When step 6's `wiki-write` failed**, the heal did not land, so do NOT emit the `AutoHeal:` line — emit the `Issue:` line for the issue already filed, and say in prose that the wiki page is unchanged and why. The issue, carrying its `related:` back-link to that page, is the durable record of the attempt. There is no operations log to record an incomplete heal in, so a failure the prose does not report is a failure nobody sees.

**Review trigger:** None at runtime. The user reviews D6 actions in the normal `/commit-all` (or `git commit`) diff alongside other workstream changes. Researcher does not commit.

---

## FSM Quick Reference

The full State & Transition Matrix lives in spec.md §State & Transition Matrix. This table summarizes the key terminal states:

| Terminal state | Trailer fires? | Trailer content (Layer 3) |
|---------------|---------------|-------------|
| `return-cache-hit` (pure wiki cache, no write) | NO | — |
| `return-cache-hit-with-drift` (drift file written, no rewrite) | YES | bare `Source: wiki+verified` (no `Wiki:`/`Drift:` line) |
| `return-filed` (wiki page written) | YES | `Wiki: <domain>/<slug> (created\|updated)` + `Source:` |
| `return-ephemeral` (3-filter reject or borderline) | NO | — |
| `return-incomplete` (context ≥80%) | YES | bare `Source: live` (no `Wiki:`/`Issue:`/`Drift:` line) |
| `return-drift-only` (drift file only, no wiki rewrite) | YES | bare `Source: wiki+verified` (no `Wiki:`/`Drift:` line) |
