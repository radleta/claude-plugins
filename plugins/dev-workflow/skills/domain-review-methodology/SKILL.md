---
name: domain-review-methodology
description: "Sequential per-domain review methodology for the domain-reviewer agent. Defines how to invoke expert skills as slash directives, review artifacts per-domain, and emit a parseable per-domain plus Aggregate verdict report. Use when running domain reviews of code, plans, ideas, or specs — even for single-skill reviews where Aggregate is mandatory."
---

# Domain Review Methodology

You apply one or more expert skills to an artifact and return a report with one mini-verdict per
domain and an aggregate verdict. Every finding follows `reviewer-contract`: a location, a verbatim
quote, a concrete consequence, and one label from its scale (`would-ship-bug`, `real-minor`,
`nit`).

**Out of scope** — other reviewers own these, so a finding here belongs to them:
- General code quality (`code-verifier`)
- Codebase alignment (`codebase-alignment-reviewer`)
- Security (`security-verifier`)
- UX / accessibility (`ux-verifier`)
- Test quality (`test-verifier`)

## Dispatch Contract

Your task prompt contains:

1. One or more `/<skill-name>` slash directives — each names an expert skill to load and apply
2. An artifact reference (file path or content)
3. Optional: depth (`light` or `thorough`) and artifact type (`idea`, `spec`, `plan`, or `diff`)

Load and apply every `/<skill-name>`: the dispatcher chose them, so whether one applies is not
yours to decide.

## Protocol

**Step 1 — Load every skill directive** via the Skill tool, all of them before reading the
artifact.

**Step 2 — Read the artifact.** Use the Read tool. If the artifact is a directory or diff
reference, use Glob or Bash as needed to assemble the content. If `git status` shows the working
tree is clean and `diff` mode was requested, review the file as the current state and note that
no diff exists.

**Step 3 — Sequential per-domain passes.** For each loaded skill, in dispatch order:

- Review the artifact against only that skill's documented patterns and anti-patterns.
- Report every finding you reach, at the label its consequence earns, most consequential first.
  Depth decides only which list a finding goes on (§ Depth Behavior), never whether it is
  reported. Zero findings is a valid pass; a finding written to fill a count is noise the caller
  has to triage.
- Anchor a finding on the construct the skill names, ahead of general programming advice.
- **Cross-domain tiebreaker:** a finding that spans two skills goes to the skill whose patterns
  most directly name the construct involved, and to that one only.
- **Attribution rule:** cite only patterns the skill literally names verbatim. A real issue the
  skill does not document is prefixed `[General]` with the skill-reference slot omitted.
  Hallucinated attributions misroute the fix loop and erode trust in skill citations.
  - Allowed: `[install-foo.sh:20] [General] ...`
  - Wrong: `[install-foo.sh:20] Error-Reporting section: ... — scripts-expert Error-Reporting section — ...` when the skill has no such section

**Finish each domain section before starting the next:** the `## Domain: <skill-name>` header,
its `**Status:**` line (`Approved`, `Issues Found`, or `Skipped — <reason>`), and its findings or
"No issues found." Blended output loses the per-domain signal: the fix loop cannot tell which
skill flagged what. A skill with nothing relevant in the artifact is `Skipped — <reason>`.

A domain's `**Status:**` is `Issues Found` when its `**Issues:**` list holds a finding, else
`Approved`. It is that domain's dimension line (`reviewer-contract` clause 5): `Approved` is
clean, `Skipped` is not evaluable, with its reason.

**Step 4 — Aggregate, even for N=1.** After all domain passes, write `## Aggregate` as the final
section. The dispatcher and the `write_review` server parse the verdict by anchoring on that
header, so a missing or renamed one is rejected as malformed whatever the findings say.

- ANY domain `Issues Found` → Aggregate `Issues Found`
- ALL domains `Approved` or `Skipped` (with at least one `Approved`) → Aggregate `Approved`
- ALL `Skipped` (nothing actually reviewed) → Aggregate `Issues Found` (fail-safe)
- Any pass missing or malformed → Aggregate `Issues Found` (fail-safe)

The Aggregate's `Issues:` count counts `**Issues:**` findings only; non-blocking findings never
change it.

## Output Contract

The dispatcher anchors on exact headers, and a verdict that breaks them is discarded whole:

- `## Domain: <skill-name>` — two hashes, that wording, one per loaded skill in dispatch order.
- `## Aggregate` — two hashes, always present, always the final section.
- `**Status:** <Approved | Issues Found | Skipped>` in each domain section;
  `**Status:** <Approved | Issues Found>` in `## Aggregate`.
- Inside a domain section, these bold labels and no `##` or `###` header:
  - `**Issues:**` — the blocking list. Omit it when empty rather than relabeling it.
  - `**Non-blocking findings:**` — every finding the depth does not block, at both depths, and on
    an `Approved` domain too. Omit it when empty.
  - `**Undecided:**` — choices the artifact deliberately leaves to its builder; never findings
    (`reviewer-contract` clause 6). Omit it when empty.

These shapes broke the parse in earlier runs; each has its correct form beside it:

- `## Domain Review`, `# Domain Review` → `## Domain: <skill-name>`.
- `## Verdict`, `### Verdict`, or any heading with "Verdict" → `## Aggregate`.
- `## Review`, `## Summary`, `## Conclusion`, `## Findings` → per-domain sections, then `## Aggregate`.
- `**Findings:**`, `**Concerns:**` → `**Issues:**`.
- A domain section and the Aggregate merged into one → two headers, two Status lines.

**Template — match the headers, labels and status lines exactly:**

```
## Domain: <skill-name-1>
**Status:** <Approved | Issues Found | Skipped>
**Issues:**
- [<label>][<carry-over|new>] [<file>:<line>] <pattern name>: "<verbatim quote>" — <skill reference> — <consequence>
**Non-blocking findings:**
- [<label>][<carry-over|new>] [<file>:<line>] <pattern name>: "<verbatim quote>" — <skill reference> — <consequence>

## Domain: <skill-name-2>
...

## Aggregate
**Status:** <Approved | Issues Found>
Domains reviewed: <skill-1>, <skill-2>, ...
Issues: <count> (<which domains>)
```

## Depth Behavior

Depth is the bar for what blocks. Both depths report every finding.

| Depth | Goes on `**Issues:**` | Goes on `**Non-blocking findings:**` |
|---|---|---|
| `light` | A finding that invalidates a design decision, whatever its label; an `Approved` aggregate never hides one | Every other finding: implementation-level detail for an already-accepted decision, and every `nit` |
| `thorough` | Every `would-ship-bug` and `real-minor` | Every `nit`, including step-sequencing items deferred to the plan |

A loaded skill that sets its own bar overrides this table for its section:
`design-review-methodology` findings always go on `**Issues:**`.

## WRONG vs RIGHT Examples

**WRONG — domain-blending:**

```
## Review
I found issues with both React patterns and TypeScript types...
**Status:** Issues Found
- Mixed concerns in a single list
```

The per-domain signal is lost, so the dispatcher cannot route fixes back to the right skill. Even
with one skill, this format is rejected.

**WRONG — Aggregate missing for N=1:**

```
## Domain Review: scripts/install.sh vs scripts-expert
### Verdict: PASS

(detailed findings...)
```

`## Domain Review` is the wrong header, `### Verdict` stands in for the Aggregate, and there is no
`## Aggregate` section.

**RIGHT — per-domain plus Aggregate (N=1 too), at `thorough` depth:**

```
## Domain: scripts-expert
**Status:** Issues Found
**Issues:**
- [real-minor][new] [install-foo.sh:13] Argument Validation Guard: "for f in "$@"; do" — scripts-expert Argument Validation Guard section — no `--help` handler or `-*` reject, so `--help` is treated as a filename
- [would-ship-bug][new] [install-foo.sh:20] [General] Error output to stdout: "echo "ERROR: $dest missing"" — missing `>&2`, so CI parsers and shell redirection never see the error and the install reports success
**Non-blocking findings:**
- [nit][new] [install-foo.sh:25] Status Reporting: "cp "$src" "$dest"" — scripts-expert Status Reporting section — re-runs are silent, so users cannot tell what changed

## Aggregate
**Status:** Issues Found
Domains reviewed: scripts-expert
Issues: 2 (scripts-expert)
```

The `[General]` prefix on the second finding marks a real issue that `scripts-expert` does not
name, so the skill-reference slot is omitted. The other two anchor on section names the skill
documents verbatim. The nit is reported and does not count toward the Aggregate.
