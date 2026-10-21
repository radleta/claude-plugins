# learned-check CLI

`learned-check` takes the `learned/` directory, or the project directory holding
one — both resolve to the same place.

```bash
learned-check status scratch/my-proj/learned/                # dashboard
learned-check pending scratch/my-proj/learned/               # captured files
learned-check pending scratch/my-proj/learned/ --type drift  # captured drift files only
learned-check escalated scratch/my-proj/learned/             # escalated, with reasons
learned-check validate scratch/my-proj/learned/              # schema check
learned-check feed-forward scratch/my-proj/learned/ --step 5 # files targeting step >= 5
learned-check init scratch/new-proj/learned/                 # create dir + .gitkeep
```

The ingestor is the only caller of the four status writers — `mark-ingested <file>`,
`mark-escalated <file> "<reason>"`, `mark-dropped <file> <reason> '<note>'` and
`reroute <file> <domain>`. Never edit a status field by hand.

`status` exit codes: `0` clear, `1` pending files present, `2` escalated files present.
`pending` exits `0` (no `status: captured` file, including a missing directory), `1` (captured
files present) or `2` (a usage error: no path, an unknown flag, or a `--type` value outside the
schema's five types). With `--type`, both the list and the exit code count only captured files of
that type. An escalated file never makes it exit `1`. A `dropped` file is
finished work: it counts in neither exit code, `pending` never lists it, and `status` reports it
beside the ingested ones.

Three verbs run a boundary ingest, each one step of
[`boundary-ingest.md`](boundary-ingest.md), which owns their commands and routing. They take the
`learned/` directory only, never a project directory, and run from the repository root:

```bash
learned-check gate 'scratch/my-proj/learned' --type drift   # step 1: path gate + pending count
learned-check compare 'scratch/my-proj/learned'             # step 4: paths written, then release
```

- `gate` prints the resolved directory, `project:`, `pending:` and `pending exit:` lines and exits
  `0` or `1` as `pending` would; `3` with one `refused:` line; `2` on a usage or scan error.
- `snapshot <learned-dir> [--repos -]` (step 3) takes the repo lock and records `git status` of
  `.claude/skills/`, in every registered repo too when `scratch-memory repos list --json` is piped
  in. It prints nothing on success, a `note:` line per skipped registered repo, and exits `3` with
  one `refused:` line, having released what it took.
- `compare` prints `page`, `other`, `repo-page` and `repo-other` lines byte-sorted, then
  `note: repos not read` when step 3 could not read the registered repos, and exits `0`; `4` with
  one `aborted:` line. It releases its locks and the snapshot file either way.

A usage error on `snapshot` or `compare` is a `refused:` or `aborted:` line, so callers route it
like any other stop.

**Validate in the turn that writes the file, not at the boundary.** `validate`
takes a directory, so run it on `learned/` right after writing. Every schema
error it reports is one edit while you still hold the context that produced the
file. `validate` exits 1 on schema errors — distinct from the `1` in the exit
table above, which means pending files — and writes no status of its own.

Left unvalidated, the file reaches `knowledge-ingestor` at the boundary instead,
which cannot route a file missing `target-domain` and escalates it. The finding
then waits for a human rather than reaching its wiki, and the turn that could
have fixed it in one edit is long gone. That is how a build's best discovery
gets lost.
