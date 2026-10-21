---
description: Run the knowledge-ingestor over a project's learned/ captures, or groom a wiki domain
argument-hint: "[project or domain]"
---

Dispatch the `knowledge-ingestor` agent. It files `learned/` captures onto wiki pages and grooms
every page each capture reaches; the rubric it applies is
`.claude/skills/wiki-memory/protocols/ingest-groom.md`, and the whole-domain steps are
`.claude/skills/wiki-memory/protocols/sweep.md`. Do not restate either in the dispatch prompt — a paraphrase competes with
the protocol for authority and the looser authority wins. The prompt carries context only.

## Step 1 — Resolve what to dispatch on

**No argument.** List every `scratch/*/learned/` with a non-zero `learned-check status` count and
ask which to run. One candidate is the answer; none means there is nothing to ingest — say so and
stop. Do not infer a project from what the session has been doing.
Owner: user-decision-rubric `what-to-work-on`

**An argument.** Validate it first: it must match `^[a-zA-Z0-9_-]+$` — anchored, so a name
carrying `/`, `\`, `..` or a space is rejected whole rather than matched in part. A rejected
argument stops here with that reason; nothing is resolved and nothing is dispatched, because
whatever it resolves to becomes the whole scope of an agent holding `Write`, `Bash` and
page-delete authority.

Then resolve it as a project first: `scratch/{arg}/learned/` existing wins. Failing that, resolve
it as a wiki domain: `.claude/skills/{arg}/` or `.claude/skills/{arg}-expert/`, each gated on
`wiki: true` in its own `SKILL.md`. Neither resolves: say which two paths you checked and stop.

**A domain resolved.** Run `git status --porcelain -- .claude/skills/{resolved domain}/`. When it
prints anything, print it and tell the user those pages are uncommitted, so any removal on them
will escalate, then go on to Step 2; this is a notice, not a question.

**Complete when:** the argument has passed the rule above, and you hold either one `learned/` path
or one domain name, or you have stopped with a reason.

## Step 2 — Dispatch

| Resolved | Prompt carries |
|---|---|
| A `learned/` path | that path |
| A domain name | that domain name, plus a `learned/` path if this session has one |

Before any command takes the `learned/` path, check it is `scratch/<name>/learned[/]` with `<name>`
one line matching `^[a-zA-Z0-9_-]+$`; refuse anything else with that reason, without running a
shell. Read the clock (`date -u +%s`) just before dispatching one `knowledge-ingestor`, after the
snapshot below on a lane; the ingest record's `Run:` line needs it. On a `learned/` path, also count the files
`learned-check pending <path>` lists just before the dispatch; the record's `Flag:` line reads it.
A domain dispatch has no such count and writes no flag. The agent reads its protocols itself.

On a lane (`lane-methodology` § Claim), wrap the dispatch in `knowledge-capture` § Boundary
Ingest's two snapshots, step 3's before and step 4's after, with the `learned/` path, or
`scratch/wiki-groom-{domain}/learned` for a domain with none (create `scratch/wiki-groom-{domain}/`
first), as `<learned-dir>`. Any snapshot result other than success, a `refused:` line or a
non-zero exit such as `127` with `learned-check` missing, stops the run with its reason, nothing
dispatched. Off a lane, the first run takes no snapshot.

**Complete when:** exactly one agent is dispatched, or a snapshot refused it.

## Step 3 — Record and relay the return

Append the return to the ingest record, in the shape and with the counts
`project-lead-methodology` § The ingest record gives: `scratch/{project}/ingest.md` for a
`learned/` path, `scratch/wiki-groom-{domain}/ingest.md` for a domain with no `learned/` path. Off
a lane the first run has no snapshot, so its section reads `Non-page: not measured`; a proposal
run's section carries the sets the proposal wrap's snapshots measured.

Print the agent's return as it came back. It is the run's provenance: one line per page with its
determination and the evidence, a `Dropped:` line per capture or claim turned away, the pages read
and left alone, and `Proposal: none` or one or more `Proposal:` blocks.

Split the proposals at every line starting `Proposal:`, and sort them as
`project-lead-methodology` § The ingest record `### Proposal disposition` says: a block lapses
unless its domain is the one you were given or one a capture on the return's `Ingested:`,
`Dropped:` or `Escalated:` lines targeted, and a
`Tier: C` block that changes no wiki page is filed with `mcp__scratch-memory__write_issue`. List
the blocks left to offer numbered, each with its tier, and ask or run each as
`.claude/skills/knowledge-capture/boundary-ingest.md`'s proposal wrap says, on a lane and off.
Then dispatch one `knowledge-ingestor` carrying every block that runs verbatim, in the order
listed, and record and relay its return the same way; the agent runs the blocks in that order. A
`Proposal:` block in that run's return is not offered: it lapses, as the same rule says. A
`New domain: {name}` block is never part of that dispatch: when it is approved, run
`/wiki-init {name}`, then `/ingest` the captures it names.
Owner: user-decision-rubric `wiki-domain` for a `New domain:` block
Say each dropped proposal is dropped; it stays in the ingest record, and the next contact
re-derives it. Once the proposal run's section, if any, is recorded, append the
`### Proposal disposition` subsection at the end of the ingest record, its `For:` line naming the
first run's heading line, one bullet per lapsed, filed or declined block.

The snapshots this command took, the first run's on a lane and every proposal run's, give the
wiki-path set and the non-page paths. Put the non-page paths to the user as `knowledge-capture`
§ Boundary Ingest's non-page rule says, then commit the set as its whole commit of the wiki-path
set says: a lane-repo group committed on a lane, every other group offered `/commit`. A run whose
compare printed `aborted:` adds no set: say its pages stay uncommitted, and why. Off a lane the first
run took no snapshot, so its pages are in no set: show the user `git status --short` to review,
beside any offer.

**Complete when:** the return is appended to the ingest record and relayed, every block that runs
has run as the proposal wrap says, every block that did not run has a disposition line, and the
wiki-path set is committed or offered as that rule says, or an `aborted:` compare is reported.

$ARGUMENTS
