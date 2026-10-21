# Boundary Ingest

The one normative copy of the ingest a workflow runs at its boundary: `/brainstorming` before
the user review, the build lead after `doc-updater`, `/discovery` at session end, `/wrap-up`
stage 8 over the workstream's `learned/`, `/close-issue` after an approved close writes its
promotion captures. Each points here in one line and adds only what it keeps of the output.

**Input:** one `learned/` path, as the caller received or derived it, and a type: `drift` or
nothing. Only the build's end, `/wrap-up` and `/close-issue` ingest every capture, so those
three pass no type; `/brainstorming` and `/discovery` pass `drift`, because a drift capture
removes wrong content and cannot wait for a build that may never come. Their other captures stay `captured` for the build.
Run every command from the repository root.

1. **Gate.** **Check the path yourself before it goes into the command:** it is one line, and
   every character is in `[-A-Za-z0-9_./:\]`. **Check the type the same way:** it is exactly
   `drift` or empty. Refuse anything else without running a shell. Then put the path between
   the single quotes, which the allow-list guarantees it cannot end early, adding ` --type drift`
   when the caller passed `drift`:

```bash
learned-check gate '<path>'
```

   `gate` repeats both checks, then requires the path to realpath to
   `<top>/scratch/<project>/learned` under the current directory's git top level, and refuses
   when `.claude`, `.claude/skills` or an entry directly under it is a symlink. It accepts
   `C:\…`, `C:/…` and `/c/…` spellings. Success prints four lines: the resolved learned
   directory, `project: <name>`, `pending: <n>` and `pending exit: <0|1>`. The `pending:` line is
   the count of captured files, type-filtered when the run is; the ingest record's `Flag:` line
   reads it. The gate mirrors `/ingest` Step 1, for the same reason: the path becomes the whole
   scope of an agent holding `Write`, `Bash` and page-retire authority.
2. **Route on the result.**
   - `refused:` (exit `3`) → stop and dispatch nothing. The caller tells the user the refusal
     line.
   - `pending exit: 0` → stop. Dispatch nothing, write nothing, and print nothing about ingest. A
     directory holding only `escalated` files lands here.
   - `pending exit: 1` → step 3. Only this line routes there: an exit code of `1` without it is a
     `learned-check` too old to know `gate`.
   - Anything else (`127` when `learned-check` is not installed, `1` from an older one, `2` with
     `pending: ?`) → stop and dispatch nothing. The caller reports
     `learned-check pending exited {code}`: the failure is told, not worked around.
3. **Snapshot, then dispatch one `knowledge-ingestor`.** In place of `<learned-dir>` put the path
   step 1 was given, already checked, or, for a proposal run, `scratch/<project>/learned` for the
   project whose ingest proposed it, after checking that name is one line matching
   `^[a-zA-Z0-9_-]+$`:

```bash
{ scratch-memory repos list --json 2>/dev/null || true; } | learned-check snapshot '<learned-dir>' --repos -
```

   The pipeline's exit status is `snapshot`'s whether or not the shell runs with `pipefail`. Every
   stop prints `refused:` (exit `3`), dispatches nothing, releases what it took, and is handled as
   step 2's refusal. The snapshot also covers every **registered repo** that accepts `learned`,
   where a `scope: user` page lands; one it must skip prints a `note:` line, kept for the caller.
   Otherwise read the clock (`date -u +%s`), which the ingest record's `Run:` line needs, and
   dispatch the ingestor. Its prompt is the resolved learned directory step 1 printed, on line
   one, and, when the caller passed `drift`, `type: drift` on line two; nothing else. It reads its
   own protocols; a prompt that paraphrases them competes with them.
4. **Snapshot again and compare with step 3's file.** Put the same `<learned-dir>` in place:

```bash
learned-check compare '<learned-dir>'
```

   It diffs exactly the roots step 3 locked and prints one line per path the ingest wrote,
   shell-quoted: `page <path>` for a `.md` file outside any `scripts/` directory, `other <path>`
   for anything else, and for a registered repo `repo-page <root> <path>` and
   `repo-other <root> <path>`, the path relative to `<root>`. The `page` and `repo-page` paths are
   the **wiki-path set**; the `other` and `repo-other` paths are the **non-page paths**. A run
   whose step 3 could not read the registered repos adds `note: repos not read`. An `aborted:` line (exit
   `4`) means neither set can be computed: the caller still holds the ingestor's return, and says
   the snapshot aborted and why.

**What the sets cover** (deletions, renames, pages dirty before the ingest, user-scope pages,
symlinks, registered repos), **one ingest per project at a time** and **the repo lock** are in
[`boundary-ingest-sets.md`](boundary-ingest-sets.md). Read it when a set holds a path you did not
expect or misses one you did, when step 3 refuses on an existing snapshot file or a held lock, or
when it skips a registered repo.

**Output to the caller:** the ingestor's return verbatim, in
[`ingest-groom.md`](../wiki-memory/protocols/ingest-groom.md) Step 6 shape, the `pending:` count
step 1 printed, the wiki-path set, the non-page paths, and every `note:` line steps 3 and 4
printed. The caller owns what happens next: relaying the return to a user, writing
a record of it (`project-lead-methodology` § The ingest record), the commit of the wiki-path
set below, and the `Proposal:` blocks, asked or run as the proposal wrap below says.

**A commit of the wiki-path set is one commit per repo.** Take each path as a file — a `page`
path under the calling repo, a `repo-page` line as `<root>/<path>` — realpath it, or its nearest
existing parent for a deleted page, and group it under its own `git rev-parse --show-toplevel`,
realpathed; a nested subrepo is its own top level. Each group names its top level, its paths
relative to it, and `git -C <top level>` for every git command. A registered repo's pages are
committed in that repo, never left behind in its working tree.

- **On a lane** (`lane-methodology` § Claim), commit each group whose top level is a lane repo —
  the calling repo, its `scratch/`, or a path the `extras:` key of `scratch/L-{lane}/README.md`
  names, each entry `{path}:{base}:{sha}` — on
  its lane branch as a commit of its own, path-scoped after `lane-methodology` § Git rules' secret
  screen, push the branch plain, and record the commit in the lane record's `## Decisions made`
  for veto at `/end-lane`. Owner: agent (user-decision-rubric)
- **Off a lane**, and for a group in a repo not on this lane, offer one `/commit` scoped to the
  group and wait for the answer. Owner: user-decision-rubric `base-and-history`

**Non-page paths go to a person, never silently in or out.** Show each one and ask whether it was
intended and whether to include it; a path the person includes joins the wiki-path set. A caller
with no user, the build lead, records them for the person who reviews its work.
Owner: user-decision-rubric `base-and-history`

**Proposals are asked or run by lane**, after `/ingest` Step 3's sort:

- **On a lane** (`lane-methodology` § Claim): a block runs unasked, and is recorded with the pages
  it names in the lane record's `## Decisions made` by `lane-methodology` § Scratch commit for veto
  at the merge review — unless it is a `New domain:` block, a gate escalation (a removal or rename
  whose gate output does not end `gate: clear`, as `wiki-memory` `ingest-groom.md` `### The gate`
  says), a `.rulings/` line, or names a page outside the calling repository: a page's domain
  resolves as `/ingest` Step 1 resolves one, and a domain that does not resolve under this
  repository's `.claude/skills/` is outside it. Those four are asked as off a lane: the proposal
  run reads each approved block as the user's yes. Read every other block before it runs: one
  naming anything but `domain/slug` pages in a domain the sort kept is asked as well.
- **Off a lane:** every block is put to a person as one numbered question: run all, or name the
  numbers to drop. It has no commit item: committing what the run writes is the caller's.

Owner: user-decision-rubric (tests)

The blocks that run go in one `knowledge-ingestor` dispatch carrying each verbatim, in order, as
its whole scope. That run writes paths too, so wrap it in the same two snapshots under the project
whose ingest proposed it: step 3's command before the dispatch, where a `refused:` line means the
proposal does not run; step 4's command after it; and add what step 4 prints to the two sets.

**A failed ingest is reported, not recovered.** A `learned-check` that will not run stops at step 2,
before any dispatch. A CLI missing inside the ingestor's run, or a failed page write, comes back in
its return, and the caller relays it like any other return. Nothing retries, nothing blocks, and
nothing falls back to filing pages another way.

**Unlike the archive gate** (`scratch-management` `protocols/archive.md` step 0), a boundary ingest
never blocks on escalations and never re-dispatches: the project stays live, so an escalated file
waits for the next boundary, `/ingest`, or the archive.
