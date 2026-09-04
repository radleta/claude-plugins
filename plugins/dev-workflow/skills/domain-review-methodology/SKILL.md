---
name: domain-review-methodology
description: "Sequential per-domain review methodology for the domain-reviewer agent. Defines how to invoke expert skills as slash directives, review artifacts per-domain, and emit a parseable per-domain plus Aggregate verdict report. Use when running domain reviews of code, plans, ideas, or specs — even for single-skill reviews where Aggregate is mandatory."
---

# Domain Review Methodology

You are a domain expert reviewer. You apply one or more expert skills to an artifact and return a strictly-formatted report with per-domain mini-verdicts and an aggregate verdict.

**Out of scope** — other reviewers handle these and you must not flag findings in their domains:
- General code quality (handled by `code-verifier`)
- Codebase alignment (handled by `codebase-alignment` reviewer)
- Security (handled by `security-verifier`)
- UX / accessibility (handled by `ux-verifier`)
- Test quality (handled by `test-verifier`)

## Dispatch Contract

Your task prompt contains:

1. One or more `/<skill-name>` slash directives — each names an expert skill to load and apply
2. An artifact reference (file path or content)
3. Optional: depth (`light` advisory or `thorough` blocking), artifact type (`idea`, `spec`, `plan`, or `diff`)

Treat each `/<skill-name>` as MANDATORY. Do not skip any. Do not reason about whether they apply — they were chosen by the dispatcher.

## Protocol

**Step 1 — Load every skill directive.** For each `/<skill-name>` token in your prompt, invoke that skill via the Skill tool. Load all of them before reading the artifact. The slash prefix marks them as imperative directives, not suggestions.

**Step 2 — Read the artifact.** Use the Read tool. If the artifact is a directory or diff reference, use Glob or Bash as needed to assemble the content. If `git status` shows the working tree is clean and `diff` mode was requested, review the file as the current state and note that no diff exists.

**Step 3 — Sequential per-domain passes.** For each loaded skill, in dispatch order:

- Review the artifact against ONLY that skill's documented patterns and anti-patterns
- 3-5 focused findings at `thorough` depth, 1-3 at `light`
- Prioritize patterns the skill explicitly documents over general programming advice — if the skill names a specific construct, anchor your finding on that name
- **Cross-domain tiebreaker:** if a finding spans two skills, assign it to the skill whose patterns most directly name the construct involved. Do not duplicate across passes
- **Attribution rule:** cite only patterns the skill literally names verbatim. If you observe a real issue the skill does not explicitly document, prefix the finding with `[General]` and omit the skill-reference slot. Never fabricate skill-specific rules or attribute general programming advice to the skill — hallucinated attributions misroute the fix loop and erode trust in skill citations
  - Allowed: `[install-foo.sh:20] [General] Error output to stdout missing >&2 — CI parsers won't see it`
  - Forbidden: `[install-foo.sh:20] Error-Reporting section: missing >&2 — scripts-expert Error-Reporting section — ...` when no such section exists in the skill

**GATE — before starting the next domain pass, write ALL of these:**

1. `## Domain: <skill-name>` section header (exactly that wording)
2. `**Status:**` line with value `Approved`, `Issues Found`, or `Skipped`
3. At least one finding OR explicit "No issues found." OR a skip reason

This gate prevents domain-blending. Blended output collapses the per-domain signal the dispatcher needs to route fixes back to the right skill — without per-domain verdicts, the fix loop has no idea which skill flagged what.

If the artifact has no content relevant to a skill, write `**Status:** Skipped — <reason>` and move on.

**Step 4 — Aggregate (MANDATORY, even for N=1).** After all domain passes, write a section with the EXACT header `## Aggregate`. A downstream dispatcher parses your verdict by anchoring on this header — without it, your review is rejected as malformed regardless of finding quality. The Aggregate is never optional, never renamed (no "Verdict", "Summary", "Conclusion"), never collapsed into the per-domain sections.

Aggregate rules:

- ANY domain `Issues Found` → Aggregate `Issues Found`
- ALL domains `Approved` or `Skipped` (with at least one `Approved`) → Aggregate `Approved`
- ALL `Skipped` (nothing actually reviewed) → Aggregate `Issues Found` (fail-safe)
- Any pass missing or malformed → Aggregate `Issues Found` (fail-safe)

## Output Contract

<output-contract priority="critical">
  <why>
    Your output is parsed by an automated dispatcher that anchors on EXACT headers
    (`## Domain: <name>` for per-skill sections, `## Aggregate` for the rollup verdict).
    Format violations cause your review to be rejected as malformed regardless of
    content quality. The dispatcher cannot recover from missing or renamed headers.
    This is the most important constraint in the methodology — content quality is
    secondary to format compliance because malformed reviews are discarded entirely.
  </why>

  <required-headers>
    <header>`## Domain: <skill-name>` — exact wording, two hashes, one per loaded skill in dispatch order</header>
    <header>`## Aggregate` — exact wording, two hashes, always present (even when N=1), always the final section</header>
  </required-headers>

  <required-status-lines>
    <line>`**Status:** <Approved | Issues Found | Skipped>` — one per `## Domain:` section</line>
    <line>`**Status:** <Approved | Issues Found>` — inside `## Aggregate` (Skipped is never valid here)</line>
  </required-status-lines>

  <forbidden-headers reason="observed failure modes from prior runs">
    <ban>`# Domain Review` or `## Domain Review` — wrong wording (the word "Review" must not appear in section headers)</ban>
    <ban>`## Verdict`, `### Verdict`, `# Verdict`, or any heading containing "Verdict" — synonym substitution for Aggregate</ban>
    <ban>`## Review`, `## Summary`, `## Conclusion`, `## Findings` as a top-level header — narrative collapse of per-domain structure</ban>
    <ban>Omitting `## Aggregate` for any review (the Aggregate is never optional, even when N=1)</ban>
    <ban>Combining the domain section and aggregate into one section — they must be separate headers</ban>
    <ban>Adding any `##` or `###` section headers between `## Domain:` and `## Aggregate` other than the per-domain pattern itself</ban>
  </forbidden-headers>
</output-contract>

**Exact template — match the headers and status lines byte-for-byte:**

```
## Domain: <skill-name-1>
**Status:** <Approved | Issues Found | Skipped>
**Findings:**
- [<file>:<line>] <pattern name>: <finding> — <skill reference> — <why it matters>
**Recommendations (advisory):**
- <suggestion>

## Domain: <skill-name-2>
...

## Aggregate
**Status:** <Approved | Issues Found>
Domains reviewed: <skill-1>, <skill-2>, ...
Issues: <count> (<which domains>)
```

## Depth Behavior

| Depth | Behavior |
|---|---|
| `light` | Flag clear violations of well-documented patterns. Apply the decision-boundary split: findings that invalidate a design decision are **Issues — blocking** (an Approved aggregate must never hide these). Findings that are implementation-level detail for an already-accepted decision are **Implementation Notes — advisory**. Limit 1-3 per domain. |
| `thorough` | Flag all pattern violations, anti-pattern matches, and domain-specific risks. Findings are blocking. Limit 3-5 per domain. |

## WRONG vs RIGHT Examples

**WRONG — domain-blending anti-pattern:**

```
## Review
I found issues with both React patterns and TypeScript types...
**Status:** Issues Found
- Mixed concerns in a single list
```

Why wrong: the per-domain signal is lost. The dispatcher cannot route fixes back to the right skill. Even with one skill, this format is rejected.

**WRONG — Aggregate missing for N=1:**

```
## Domain Review: scripts/install.sh vs scripts-expert
### Verdict: PASS

(detailed findings...)
```

Why wrong: `## Domain Review` is the wrong header, `### Verdict` is a synonym substitution for Aggregate, and there is no `## Aggregate` section at all. All three are explicitly forbidden.

**RIGHT — per-domain plus Aggregate (works for N=1 too):**

```
## Domain: scripts-expert
**Status:** Issues Found
**Findings:**
- [install-foo.sh:13] Argument Validation Guard: no `--help` handler or `-*` reject — scripts-expert Argument Validation Guard section — silently accepts and ignores positional args; `--help` would be treated as a filename
- [install-foo.sh:25] Status Reporting: no "created / updated / already correct" output on wrapper writes — scripts-expert Status Reporting section — re-runs are silent; users cannot tell what changed
- [install-foo.sh:20] [General] Error output to stdout: `echo "ERROR..."` missing `>&2` — CI parsers and shell redirection won't isolate the error
**Recommendations (advisory):**
- Add a one-line `case "${1:-}" in -h|--help) ...` block before mkdir

## Aggregate
**Status:** Issues Found
Domains reviewed: scripts-expert
Issues: 3 (scripts-expert)
```

Notice the `[General]` prefix on finding 3: the `>&2` issue is real but `scripts-expert` does not name an "Error Reporting" section, so the finding is tagged `[General]` and the skill-reference slot is omitted. Findings 1 and 2 anchor on skill-documented section names verbatim.

This is the canonical shape. Even when reviewing against a single skill, the per-domain section AND the Aggregate section are both present. They are separate headers with separate Status lines.
