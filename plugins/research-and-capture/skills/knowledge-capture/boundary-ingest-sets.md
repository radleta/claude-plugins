# Boundary Ingest: the path sets

Reference for [`boundary-ingest.md`](boundary-ingest.md) steps 3 and 4: what the wiki-path set and
the non-page paths contain, how registered repos join them, and why ingests on one project, and
on one repo, run one at a time.

**What the sets cover.** Git's status entries decide them, read with `--porcelain -z`, so a name
`--short` would C-quote comes back as its real path.
- **A deletion** (` D`) is a path the ingest wrote: a retired page is in the wiki-path set, and a
  scoped commit carries the retire.
- **A rename pairs only when staged.** A staged rename (`R`) yields both its old and its new path;
  an unstaged move reads as ` D old` and `?? new`, two separate entries, and both land in the sets
  the same way.
- **A page dirty before the ingest** whose status the ingest leaves unchanged (` M`, `??`) matches
  its step 3 entry and is left out, even when the ingestor edited it again. A page staged before
  and edited again comes back `MM` or `AM` and is included, staged edits and all.
- **User-scope pages** under `~/.claude/skills/`, written for a `scope: user` capture, land in
  whichever registered repo owns that directory, and step 4 lists them as `repo-page` or
  `repo-other` lines under that repo's root, however the ingestor spelled the path. When no
  registered repo that accepts `learned` owns it, they are outside every snapshotted repository
  and show only in the ingestor's return.
- **A symlinked `.claude`, `.claude/skills`, or entry directly under `.claude/skills/`** hides the
  files behind it from `git status`, so step 1 refuses instead of reporting empty sets. A link
  deeper inside a domain is not checked. A `git status` that fails stops step 3 or aborts step 4;
  it never yields empty sets.

**Registered repos.** Step 3 reads `scratch-memory repos list --json` once, from its pipe, and snapshots the
`.claude/skills/` of every entry that is `ok` and accepts `learned`, deduplicated by realpath and
never the calling repo twice. Its snapshot file records one `root` line per repo it locked,
tab-separated with that repo's lock path (the calling repo as `.`), each status entry prefixed by
its root, and a last `repos: read` or `repos: not-read` line. Step 4 works from that file alone: it
diffs exactly those roots and prints `note: repos not read` from the last line without calling the
CLI. `not-read` means `scratch-memory` is not on PATH, its `list` failed, or what it printed was
not a JSON array; the run then covers
the calling repo alone, as before registered repos existed, and the gate never depends on the CLI.

A registered repo is **skipped with a note** rather than refusing the run:
- `note: skipped registered repo <root>: <path> is a symlink` — its `.claude`, `.claude/skills` or
  a domain directory directly under it is a link that `git status` cannot see behind;
- `note: skipped registered repo <root>: its ingest lock is held by the ingest whose snapshot is
  <path>` — another ingest holds that repo;
- `note: skipped registered repo <root>: git rev-parse failed`;
- `note: skipped registered repo <path>: realpath failed` — its registered path no longer
  resolves.

The ingestor of a run that skipped a repo can still write pages there, and step 4 does not list
them. They then appear in the lock holder's step 4 as registered-repo lines, and every commit offer
shows its paths and waits for the user, who can leave another session's pages out; otherwise that
repo's pages are committed by hand there.

**The repo lock.** Every snapshotted repo, calling or registered, is held under one file,
`boundary-ingest-skills.lock` in its `git rev-parse --absolute-git-dir`, holding `snapshot: <the
owning ingest's snapshot file>` and `created: <epoch seconds>`. It is the same lock whether an
ingest runs in that repo or reaches it as a registered repo, so two ingests never snapshot one
repo at once. It records no PID, since steps 3 and 4 are separate commands with the ingestor
running for minutes between them: a contender breaks it only when its recorded snapshot file no
longer exists or it is over 2 hours old. A lock missing either line is held until its file is 2
hours old. Taking, breaking and releasing the lock happen while holding
`boundary-ingest-skills.lock.mutex`, created only when none exists and removed milliseconds later,
so a break can never remove a lock another contender just took. A contender waits up to 2 seconds
for the mutex, then step 3 refuses naming it, or skips a registered repo with a note, and step 4
releases its own lock without it. A mutex over 30 seconds old is taken for one left by a killed
process and removed. The gap left: a process stopped (not killed) for over 30 seconds inside the
mutex, or two contenders removing one dead mutex together, can let two ingests hold the repo; the
commit offers, which show every path, are what catch it. Otherwise a held lock refuses the run in the calling
repo, with the same "remove it only when none is running" advice as a held snapshot file, and
skips a registered repo with a note. Step 3 releases what it took when it refuses; step 4, on
every exit once it finds the snapshot file, releases only the locks whose recorded snapshot is its
own, together with the snapshot file. An interrupted step 3 or 4 exits non-zero.

**One ingest per project at a time.** Step 3 creates its file only when none exists, and step 4
removes it on every exit once it finds it, so a second ingest on the same project is refused while
the first runs. A file left by an ingest that stopped between steps 3 and 4 keeps refusing until a
person removes it. Ingests on two different projects in one repo contend for that repo's lock, so the second is
refused until the first's step 4 runs; run them one at a time, as `/discovery` does.
