# Step 5 — Ingest drift outcomes

Step 5 runs `knowledge-capture` § Boundary Ingest on `scratch/{project}/learned/` with type `drift`; every other capture stays `captured` for the build's end ingest. One outcome applies:

- **No drift pending** → say nothing about ingest and go to step 6.
- **Refused** (exit `3`, from § Boundary Ingest step 1's path gate or its step 3 snapshot) or **failed**
  (any other `learned-check pending` exit) → nothing was dispatched: relay the refusal or the
  failure to the user with its reason — the `refused:` line, or `learned-check pending exited
  {code}` — and go to step 6.
- **The ingestor ran and § Boundary Ingest step 4 printed its paths** → append the return to
  `scratch/{project}/ingest.md` as `project-lead-methodology` § The ingest record gives, relay
  it to the user as it came back, and keep the wiki-path set. Non-page paths get § Boundary Ingest's question now, before
  step 7's commit: whether each was intended, and whether to include it
  (Owner: user-decision-rubric `base-and-history`). The `Proposal:`
  blocks get `/ingest` Step 3's sort and are asked or run as § Boundary Ingest's proposal wrap
  says, in one dispatch, and the disposition of every block that did not
  run is appended as `project-lead-methodology` § The ingest record `### Proposal disposition`
  says.
- **The ingestor ran and § Boundary Ingest step 4 aborted** (exit `4`) → record and relay its return the same way, then
  tell the user the snapshot aborted and the `aborted:` line's reason. Neither set exists, so
  this ingest asks no non-page question and contributes no wiki-path set of its own: say that
  the pages it wrote stay in the working tree for the user to commit by hand. The `Proposal:`
  blocks still get `/ingest` Step 3's sort, the proposal wrap and disposition; a proposal run carries its own two
  snapshots, and a set it yields reaches step 7's commit like the set of any earlier pass
  through this step.

**Done when** the ingest was found clear of drift captures by the type-filtered `learned-check
pending`; or refused or failed with
its reason told to the user; or ran with its return relayed and every non-page path and any
asked proposal answered and every proposal dispositioned; or ran with its return relayed, the abort
and its reason told to the user, and any asked proposal answered and every proposal dispositioned.
