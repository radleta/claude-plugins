# Session-end drift ingest

Run after the session-end lint ([SKILL.md](SKILL.md) § Session-End Lint), when this session relayed at
least one `Captured:` line.

Load `knowledge-capture` via the Skill tool and
follow § Boundary Ingest with type `drift` once for each `learned/` directory named in a `Captured:`
line this session — the
directory holding that line's path — one directory at a time, never in parallel: two directories
can feed the same wiki domain, and a domain takes one writer at a time. That directory comes from
an agent's output, so the section's path gate decides it; relay a refusal or a failure to the user
with its reason. Append each return to that directory's project `ingest.md`, as
`project-lead-methodology` § The ingest record gives, and relay it to the user as it came back. The `Proposal:` blocks get
`/ingest` Step 3's sort and are asked or run as § Boundary Ingest's proposal wrap says, in one
dispatch, the disposition of every block that did not run is appended as
`project-lead-methodology` § The ingest record `### Proposal disposition` says, and non-page paths get § Boundary Ingest's intent-and-include question
before the commit below. Every other capture stays `captured` for the build's end ingest.

When any of those ingests wrote pages, commit their combined wiki-path set, proposal runs
included, as `knowledge-capture` § Boundary Ingest's commit of the wiki-path set says, on a lane
and off, before the Breakdown Gate or the stop.
Uncommitted wiki edits from discovery would otherwise ride into the next brainstorming's and
build's diff.

**Done when** every directory named in a `Captured:` line is ingested, refused, failed, or found
clear of drift captures by the type-filtered `learned-check pending`; every return is relayed; every non-page path
and every asked proposal has an answer and every proposal not run a disposition line; and any commit offer has an answer.
