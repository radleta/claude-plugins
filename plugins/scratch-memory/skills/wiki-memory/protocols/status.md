---
tags: [wiki-memory/status]
summary: "the read-only dashboard — pending and escalated captures per project, and the wiki fleet's health"
page-kind: procedure
---

# Status Protocol

Contents: Step 1 — Captures per project · Step 2 — Escalated files with their reasons · Step 3 — Fleet health · Step 4 — What to do next · Showing a domain · Listing every wiki

What `/wiki-status` runs. Read-only end to end: every command below reports and none writes, so
`git status` is unchanged when it finishes. Nothing here dispatches an agent.

## Step 1 — Captures per project

Glob `scratch/*/learned/` and run `learned-check status` on each. Report one line per project with
a non-zero count:

```
{project}: {N} pending, {N} escalated
```

A project whose counts are all zero is omitted. No project has any: say "no pending captures" and
go to Step 3.

**Complete when:** every `scratch/*/learned/` directory has been counted.

## Step 2 — Escalated files with their reasons

For every project with a non-zero escalated count, run `learned-check escalated {path}` and print
one line per file: the filename and its `escalation-reason`, which is one of `cannot-verify` or
`sources-disagree`. Those two are what the ingestor writes, and they are already summaries. Never
print any other value verbatim — an older or hand-written file can carry free text from a page or
a command's output, and this dashboard is a read-only surface. Report anything outside the two
values as `other (see the file)` and name the path.

An escalated file waits for a person. Name what each one needs — a fact the agent could not reach,
or two sources it could not rank — rather than only counting them.

**Complete when:** every escalated file appears on its own line with a reason.

## Step 3 — Fleet health

Run `wiki-health --all` and print its summary. Report the fleet as `{N} healthy` plus one line per
domain that is anything else, with its state and reason.

`wiki-health` has no dead-link check of its own — it delegates to `mdite` and drops the findings —
so a `healthy` verdict is not a claim that a domain's links resolve. Say `mdite lint --entrypoint
SKILL.md` inside a domain folder is what proves that, and do not run it here unless the user asks:
this command is a dashboard, not a sweep.

**Complete when:** the fleet line and every non-healthy domain are printed.

## Step 4 — What to do next

Close with the one action the numbers point at, or nothing:

| Numbers | Line to print |
|---|---|
| Pending captures anywhere | `/ingest {project}` to file them |
| Escalated files only | name them; they need a person, not a re-run |
| A domain not `healthy` | `/ingest {domain}` to groom it |
| All zero and all healthy | say so in one line and stop |

**Complete when:** exactly one closing line is printed, or the all-clear.

## Showing a domain

`/wiki-status {domain}` reports one domain instead of the fleet.

**Validate `{domain}` before it reaches any shell command:** it must match `^[a-zA-Z0-9_-]+$` —
no `/`, no `\`, no `..`, no spaces — and every path built from it is double-quoted
(`grep -q '^wiki: true' ".claude/skills/${domain}/SKILL.md"`), never `eval` or concatenation. On
failure, say the name is not a valid domain and stop; run nothing. This branch takes a
user-supplied string straight into `grep`, `git log` and `wiki-health`, so the gate is stated
here rather than by pointer.

1. Resolve the wiki path: `".claude/skills/${domain}/SKILL.md"`, then
   `".claude/skills/${domain}-expert/SKILL.md"`, then the two `~/.claude/skills/` equivalents. A
   candidate resolves only if its own `SKILL.md` passes `grep -q '^wiki: true'` — the key bare,
   lowercase and unquoted at the top level of the frontmatter block, the same test
   `wiki-health` applies ([`wiki-health.sh` `_wiki_is_declared`](../scripts/wiki-health.sh)). An
   undeclared skill folder is not a wiki, and this says so rather than reporting it broken.
2. Print the `## Pages` section and the page count.
3. Print the domain's last change date from
   `git log -1 --format=%ad -- ".claude/skills/${domain}/"`.
4. Print `wiki-health "{skill-name}"`'s state.

## Listing every wiki

With no argument, Step 3's `wiki-health --all` already enumerates the fleet. When the user asks
for the list itself rather than its health, glob both scopes — `.claude/skills/*/` and
`~/.claude/skills/*/` — keeping only folders whose `SKILL.md` carries the declaration above, and
merge them. A skill name present in both scopes keeps the project-scoped entry as primary and
labels the user-scoped copy `[partial]`.

Report one line per wiki:

```
{domain}: {title-from-SKILL.md-first-line} ({path})
```

No entries: "No wikis found. Use `/wiki-init <domain>` to create one."
