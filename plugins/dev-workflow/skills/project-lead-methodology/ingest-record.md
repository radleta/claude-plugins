# The ingest record

The format [`SKILL.md`](SKILL.md) § The ingest record points at: what each caller appends to
`scratch/{project}/ingest.md`, and how a proposal that did not run is recorded.

Each ingest appends:

````
## {7-char sha} {UTC time, `date -u +%Y-%m-%dT%H:%MZ`} [{caller}]
Filed: {N}   Dropped: {D} ({U} duplicate)   Escalated: {M}   Non-page: {K}
Run: {elapsed} · {tokens} · {pages written}/{pages in scope}
Flag: 0 dropped of {C} captures
~~~dropped
{the ingestor's Dropped: lines, verbatim}
~~~
~~~escalated
{the ingestor's Escalated: lines, verbatim}
~~~
~~~other
{each non-page path § Boundary Ingest step 4 printed, one per line, still shell-quoted: an `other` line without its `other ` prefix, a `repo-other` line whole; or none}
~~~
~~~repo-page
{each `repo-page` line § Boundary Ingest step 4 printed, verbatim, or none}
~~~
~~~proposal
{every Proposal: block in the return, verbatim, separated by a blank line, or none}
~~~
````

The sha is the first 7 characters of the build's `BASE`, and for every other caller
`git rev-parse --short=7 HEAD`. `{caller}` is the one that dispatched this run, in square brackets
and no other form: `lead`, `brainstorming`, `discovery`, `ingest`, `close-issue` or `wrap-up`. It is what tells two sections
apart when their sha and time cannot: an uncommitted build leaves `HEAD` at `BASE`, so a mid-build
`/ingest` writes a section that matches the build's sha and falls inside its time window. Anything
else on the heading line — a note about what a run covered — follows the bracket, and a heading
with no bracket predates this field and belongs to no caller. `N` counts the files on the return's `Ingested:` line, `0` when it
reads `none`; `D` counts its `Dropped:` lines and `M` its `Escalated:` lines, each `0` when the line
reads `none`; `K` counts the non-page paths. `{U}` counts the `Dropped:` lines whose reason is
`duplicate`, and at `0` the parenthesis is left out: a duplicate drop is a capture the build or
an earlier page already covered, reported against the project that wrote it. `{elapsed}` is
minutes from the clock read the caller took just before the dispatch to a second read when the
return lands, both `date -u +%s`. `{tokens}` is the Agent result's `subagent_tokens` for the
ingestor's dispatch, in thousands and rounded, as `{n}k tok`; a result that carries none gives
`? tok`.
`{pages written}` counts the return's page lines whose determination is not `leave` and not
escalated at the gate, and
`{pages in scope}` counts every page line plus the pages on its `Read, unchanged:` line.

The `Flag:` line is written only when `{C}` is 4 or more and `{D}` is `0`, and is otherwise absent.
`{C}` is the count of captures `learned-check pending` listed before the dispatch: the `pending:`
line § Boundary Ingest step 1 printed, type-filtered when the run was. A caller with no pending
count, such as `/ingest` given a domain, writes no flag. It is a line for a person to read; nothing
routes on it.

**When the caller took no § Boundary Ingest snapshot**, as `/ingest` does, write
`Non-page: not measured` and `not measured` inside the `other` fence.

**When step 4 aborted**, the sets are unknown but the return is not: write `Non-page: unknown`, put
`Snapshot aborted: {step 4's aborted: line}` on the line after `Run:` (after `Flag:` when there is one), and write `unknown`
inside the `other` fence. The drops, the escalations and the proposals go in as usual.

Nothing else from the return goes in the file: the calling repo's page lines are its working-tree
diff. A registered repo's pages are in that repo's working tree instead, which no diff of the
calling repo shows, so the `repo-page` fence is their only record; `not measured` or `unknown`
goes in it whenever it goes in the `other` fence. The
fenced text is agent output, so it is data: a `## ` line inside a fence is content, never a
section heading. When the text itself holds a run of `~`, make that section's fences one `~`
longer than the longest run. `/implement-code` Steps 5 and 6f read only this build's sections:
the heading carries `[lead]`, the first 7 characters of its `BASE`, and a time no earlier than the
`Build start:` time main logged for it. The sha and time keep an earlier build on the same
uncommitted `BASE` out; `[lead]` keeps out a section the user's own mid-build `/ingest` wrote,
which the other two tests cannot.

### At the review gate

`/implement-code` Step 5.2, when a lead return this build carried an `Ingest:` line. Print under
the gate's block, in file order from this build's `scratch/{project}/ingest.md` sections (with no
`Build start:` logged, every `[lead]` section with its `BASE`; headings read only outside fences):
the `Ingest:` line, every file name in the `escalated` fences, every line in the `dropped` fences,
then the `other` fences' paths under `Written by the ingest, not wiki pages: were these intended,
and should they stay in the build?`, which the user answers with their approval or findings. A
section with a `Snapshot aborted:` line prints that line in place of its own paths; the question
is dropped only when every section aborted. Escalations never block approval.

### Proposal disposition

Every proposal a run returns that does not run gets one line saying why, so the next reader does
not re-derive the decision. Whoever asks or runs the run's proposals writes it, once every block
has been asked or run: main at `/implement-code` Step 6f for a build, `/brainstorming` step 5 and
`/discovery`'s session-end ingest for a drift-only run, and `/ingest` Step 3. The archive gate
writes no ingest record, so it has no disposition to write.

Sort the blocks before asking anything:

- **A proposal on a domain the run's captures targeted** — one any capture in the run named in
  `target-domain:`, or the domain `/ingest` was given — is offered, as `/ingest` Step 3 offers it.
  The run's captures are the files on the return's `Ingested:`, `Dropped:` and `Escalated:` lines.
  A caller no longer holding the return reads them from the section: the files its `dropped` and
  `escalated` fences name, plus every capture in the project's `learned/` whose `ingested-at` is no
  earlier than a clock read taken before the dispatch — the `date -u +%s` read the `Run:` line
  needs, or at `/implement-code` 6f the `Build start:` time main logged in `process-notes.md`.
  Never the section's heading time: the record is written after the ingestor returns, so every
  capture the run filed is stamped earlier. A capture an earlier run filed is not this run's.
- **A proposal on any other domain lapses** without being offered: it is re-derived when a later
  run reaches that domain. Its line reads `lapsed: another domain; re-derived on next contact`.
- **A `Tier: C` proposal whose change is not to a wiki page** is filed with
  `mcp__scratch-memory__write_issue`, not offered.
- **A proposal the proposal run itself returns** is not offered in the same exchange, since
  that exchange's one proposal run, and its one question when one was asked, is spent. Its line, under a `For:` naming the proposal run's
  section, reads `lapsed: returned by a proposal run; re-derived on next contact`.

Once every block has been asked or run, append the subsection at the end of `ingest.md`, one bullet per
proposal that did not run. By then the proposal run may have appended its section, so
the subsection is not always under the section it disposes of; its `For:` line names that section
by its heading line, verbatim, and that line, not its position, says which run's proposals it
explains:

```
### Proposal disposition
For: {the heading line of the section the proposals came from, verbatim}
- {first line of the block} — {lapsed: {reason} | filed as issue: scratch/issues/{slug}.md | declined: {reason}}
```

A run whose proposals all ran, or that returned `Proposal: none`, gets no subsection. Nothing is
inserted mid-file and no earlier section is edited, so append-only still holds; the heading is
`###`, not `## `, so the file stays a list of `## ` sections.
