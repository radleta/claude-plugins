# Contracts & Acceptance

`idea.md` is binding, so its `## Contracts & Acceptance` carries:

- **Interface contracts** between the parts (module boundaries, CLI/API shapes, data formats),
  enough that the coder builds each without re-negotiating the seams.
- **Acceptance outcomes**: for each major deliverable, at least one real-input, end-to-end
  observable behavior ("given this actual payload, this command exits 2 and writes this state
  file"). Grep counts, string-presence checks and exit codes on synthetic input are all
  satisfiable by behaviorally dead code. An outcome that must be seen running in a browser is
  marked `verify-live:`; the coder dispatches `chrome-browser` for that one.
- **The tests the build runs.** Name the commands; they are the build's whole acceptance
  surface. A prose, skill, command or agent deliverable takes its evidence from its effect in
  the diff: it names a test only when invoking the primitive is the evidence, and the coder
  invents none.
- **Signals**, under `### Signals`: what the built thing emits while it runs, so the build and
  anyone after it can see that it works. One bullet per signal.

Scale to the work: a trivial component gets one acceptance line.

**Signals scale with the tier**, judged by what the change touches and written as the
`### Agent judgments` entry starting `Signals tier:`:

- **None** when the change alters no effect: a prose edit that changes no output, file
  written, verdict or return is none, and one that changes any of those is not.
  `### Signals` then reads `None`.
- **Existing system** when it changes the behavior of something that already runs:
  `### Signals` names only its new signals.
- **New system** when it introduces a new system, service or entry point: `### Signals`
  declares its full set, and sets the record's conventions when it declares a signal read
  outside the diff.

Every signal is *quiet by default*: code logs its detail at debug level or behind a
verbose flag, off in production unless the record's conventions say otherwise; a skill or agent
declares its effect (the file it changes, the verdict it shapes, the return its caller reads) as
one line pointing at its acceptance outcome, and never adds a line to its normal output. A
signal read outside the diff, such as a log, a metric or a production read path, goes through
the repo's **observability record**, found through the one `CLAUDE.md` line starting
`Observability record:` and naming its path. The record holds where logs go, how to read them,
where access is obtained (never a credential or connection string), and the conventions; it
lives in the expert wiki when the repo has one, otherwise in a docs file. When the record is
needed and missing, the design lists writing it, and the pointer line, as its own deliverables.
A design whose signals change a fact in the record lists that change as a deliverable: the build
edits a docs-file record, and changes a wiki-page record through a `learned/` capture the
build's end ingest files.
