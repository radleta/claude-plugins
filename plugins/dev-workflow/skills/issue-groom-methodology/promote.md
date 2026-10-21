# The Promotion

Companion to [SKILL.md](SKILL.md): what § Entry: /close-issue adds for the build's own ticket, the
first on its `**Ticket:**` line, or the one start ticket when there is no build project. A rider
promotes nothing. A shipped decision keeps its rule in the shipped file but its reason only in
scratch; the promotion carries the reason, and the system flowchart, to the wiki while the build's
record is fresh. Line and form are [`design-record`](../design-record/SKILL.md)'s.

**Wiki domains** are the skill folders whose `SKILL.md` frontmatter carries `wiki: true`. The
**project domain** is `{repo}-expert`, `{repo}` the corpus root's folder name.

## Draft

Run before SKILL.md step 6's list; nothing here writes to disk except step 3's `mermaid-check`
input, a temp file in the session scratchpad.

1. **Read the decisions.** From a build project, every `D{n}.` line under `idea.md`
   `## Decisions`, or every row of a legacy decisions table, and the first `flowchart` (or legacy
   `graph`) block under `## Architecture`. With no build project, the ticket's `## Decisions` lines,
   its body, the Resolution this close drafts, and the source range's log of the files it touched.
2. **Keep the shipped ones.** A decision is listed when a commit in the source's range changed the
   file that carries its rule, and that file at `HEAD` does not already state its reason. Name each
   one's **target domain**: the wiki domain whose folder holds that file, else the wiki domain with the
   most pages citing the file (`grep -rlF -- '{path}'` over the wiki domains' folders), else the
   project domain. Its `target-page:` is the page in that domain whose subject the decision governs.
3. **Redraw the flowchart**, when step 1 found one, to what shipped: keep each node whose part
   exists at `HEAD`, drop each part that never shipped, and strip what `design-record`
   § Diagram rules says a diagram never contains. Write its caption with a link to every node's file,
   relative to the project domain's `overview.md`. List each part
   `git log --name-status --diff-filter=RD {range}` shows renamed or deleted, as
   `renamed: old -> new` or `removed: part`. Run `mermaid-check` on the redrawn block and fix a
   failure; exit `69` or an absent `mermaid-check` is reported as "Mermaid check skipped".
4. **Check the wikis.** With no wiki domain at all, the list carries a `/wiki-init {repo}-expert`
   proposal, and the decisions' target domain is that project domain; declined, each reason is
   written instead as one sentence or comment beside its rule in the shipped file. With wiki domains
   but no project domain, the list carries a `/wiki-init {repo}-expert` proposal for the flowchart
   alone; declined, the flowchart is not promoted.

The **promotion list** is the ticket's third item in SKILL.md § Entry: /close-issue: each decision
line with its target domain, then the redrawn flowchart, its caption and its `renamed:` and
`removed:` lines. It goes with the close — ruled with it off a lane, applied and vetoed with it on a lane — never decision by decision. An empty list is one line
saying nothing is left to promote, and why.

**Done when** every decision step 1 read is listed or left out for a reason step 2 names, and the
flowchart is redrawn or absent.

## Write

Run once the ticket's close is applied (SKILL.md step 6): approved off a lane, applied on the branch on a lane. A rejected close writes nothing. The learned folder is
`scratch/{project}/learned/`, or `scratch/{ticket-slug}/learned/` with no build project.

1. Run an approved `/wiki-init`, or write the declined case's inline reasons into the shipped files.
2. Write each capture as `status: captured`, in `knowledge-capture`'s frontmatter and body
   template, with `source: close-issue` and `target-page:` set, `**Discovered:**` naming the closed
   ticket:
   - one per listed decision: `type: decision`, `target-domain` its target domain, named
     `decision-{kebab-title}.md`, `**Impact:**` naming who would change this choice and what they
     would otherwise try, the body its decision line;
   - one for the flowchart: `type: research`, `target-domain` the project domain,
     `target-page: overview`, named `overview-{project}.md`, `**Impact:**` naming who opens the
     overview and what it shows them, the body the redrawn block and caption, then its `renamed:`
     and `removed:` lines.
3. Run `learned-check validate` on the folder and fix what it reports.
4. Read the clock (`date -u +%s`), then run `knowledge-capture` § Boundary Ingest on the folder,
   with no type. The ingestor admits, places or drops each capture; a drop stands. Off a lane,
   the wiki pages the ingest changed stay in the working tree for the user to keep or discard. On
   a lane, commit them, its wiki-path set, on the code lane branch, path-scoped and screened
   (`lane-methodology` § Git rules), as the close's code commit, so a veto reverts the close and
   its pages together.
5. As soon as the ingest returns, append its record, caller `close-issue`, to `ingest.md` beside
   the learned folder, in the form `project-lead-methodology` `ingest-record.md` gives. The
   captures and the record join the close's own commit on a lane, and SKILL.md step 6's scratch
   commit item off it.

**Done when** every listed decision and the flowchart has a capture that `learned-check validate`
passes, and the boundary ingest has returned, with its record appended, or stopped with its
reported line.
