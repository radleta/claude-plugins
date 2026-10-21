# /pickup

Contents: Step 1 — Argument parsing · Step 2 — Resolve session_id · Step 2a — Lane lookup · Step 3 — CLI pickup call · Step 4 — Error handling · Step 4a — Event groom · Step 5 — Assemble resume context · Step 6 — Skills loading · Step 6a — Groom stop · Step 7 — Instruction · Step 8 — NBS execution

## Entry: /pickup

`/pickup [<session_id>] [<instruction>]`.

### Step 1 — Argument parsing

Split the arguments on whitespace. The first token is `session_id`. Every remaining token, rejoined with single spaces, is `instruction` — freeform natural language for this session to carry out before the Next best step.

- `/pickup` — `session_id` empty, `instruction` empty.
- `/pickup my-workstream` — `session_id=my-workstream`, `instruction` empty.
- `/pickup my-workstream re-read the failing test first` — `session_id=my-workstream`, `instruction=re-read the failing test first`.

There are no flags. An instruction always requires a `session_id` in front of it, because the first token is read as a slug and `/pickup fix the tests` would resume a workstream named `fix`.

Resuming a workstream under a *different* slug is not reachable from this command. Run `scratch-memory pickup '<from>' --to-session-id '<to>'` directly for that.

### Step 2 — Resolve session_id

If `session_id` is empty:

- Run `Bash("scratch-memory handoff list")`.
- Take the first 3 lines of stdout (most-recent-first ordering; client-side truncation).
- Present those 3 workstreams (slug, goal) to the user. Await selection. Owner: user-decision-rubric `what-to-work-on`
- Bind the selected value as `session_id`.

### Step 2a — Lane lookup

When `scratch/S-{session_id}/` is absent from the checked-out scratch branch, the workstream may
live on a lane's scratch branch. Read the record at each lane ref (`lane-methodology` § Identity),
`session_id` passing the lane-name pattern first. For a record whose `workstream` is `session_id`,
print, and stop:

```
S-{session_id} lives on lane {lane}: switch to it with /begin-lane {primary}
```

Switch no branch yourself: the user chooses where this session works. With no such record, go on to
Step 3.

### Step 3 — CLI pickup call

Run `Bash("scratch-memory pickup '<session_id>' --to-session-id '<session_id>' --json")` — the same value on both sides, each wrapped in single quotes so shell metacharacters (`;`, `|`, `$`, `` ` ``, etc.) are not interpreted by the shell. `--to-session-id` is required at the CLI boundary even though this command never varies it. Single-quoted strings cannot contain a literal `'`; if `session_id` contains one, surface `PICKUP_INVALID_FROM_SESSION_ID` and stop rather than attempting the call. Capture stdout as JSON.

### Step 4 — Error handling

On exit code 1: read the first line of stderr. Surface the specific error string with the id used:

- `PICKUP_COLLISION` → "PICKUP_COLLISION: target folder S-{session_id} is owned by a different session. Resume it under another slug with `scratch-memory pickup '{session_id}' --to-session-id '<other>'`."
- `PICKUP_SOURCE_MISSING` → "PICKUP_SOURCE_MISSING: no workstream folder found for session_id={session_id}."
- `PICKUP_INVALID_FROM_SESSION_ID` or `PICKUP_INVALID_TO_SESSION_ID` → "{error string}: {session_id} contains invalid characters."
- `PICKUP_IDEMPOTENT_SOURCE_NOT_EMPTY` → "PICKUP_IDEMPOTENT_SOURCE_NOT_EMPTY: source folder for session_id={session_id} still holds real session data and was not deleted. Resolve the slug conflict manually before retrying."
- `no handoff found matching` → surface verbatim and suggest running `scratch-memory handoff list` (or re-run `/pickup` with no argument to use the picker). This is also where a slugless instruction lands, `{session_id}` holding its first word, so add "if you meant an instruction, put the session_id in front of it" when the value reads like ordinary prose.
- Any other exit-1 error code → surface the first line of stderr verbatim, prefixed "PICKUP ERROR: ".

Stop after surfacing the error. Do not proceed to the resume-brief assembly.

On exit code 2 (infrastructure error): surface "OS-level error during pickup — check disk space and permissions. Error details: {stderr}." and stop.

### Step 4a — Event groom

Only when `workstream-groomer` is among this session's available agent types; otherwise skip to Step 5. Run the event groom on `scratch/S-{session_id}/` with event `pickup`, as [boundary-groom.md](boundary-groom.md) gives, before Step 5 builds the brief, so the brief shows the groomed state. It dispatches the `workstream-groomer` only when a session file or commit is newer than its last run, prints the groomer's return and its veto list when it does, and prints nothing when it does not. Whatever it does, continue to Step 5 once it has finished: it cancels nothing and asks the user nothing, and it makes no fetch, merge, commit or push.

### Step 5 — Assemble resume context

The `session_id` is shell-safe at this point: Step 3's single-quote rejection guard ensures it contains no literal `'`, so interpolating it into a single-quoted shell argument cannot break out of the quoting.

Run:
```
Bash("scratch-memory cat-sessions 'scratch/S-{session_id}/' --format full --with-tasks")
```

If Bash saved the output to a file behind a preview, read the whole file before continuing.

The output is the authoritative resume brief: still-open questions (a block over the brief's cap shows its newest raises and ends with a count line pointing at `HANDOFF.md`, which lists them all), newest-inlined session bodies, the summary tail, and the `## Tasks` block (open and blocked tasks with their age, a closed-task count line, and any `WARN:` lines for malformed task files). The thin v3 `HANDOFF.md` is NOT read by `/pickup`.

`WARN:` lines in the `## Tasks` block are informational only: they never stop the pickup, and the resuming agent should surface them rather than act on them silently. `/pickup` auto-executes Next best step, so a warning that reads as a blocker would stall an unattended resume.

After the `## Tasks` block, the brief may carry up to two `GROOM:` lines, counts only:

- **Data line** — `GROOM: <N> task data problem(s) — detail: scratch-memory session lint '<session-dir>'`. Print-only: it never stops the pickup. Recommend `/groom {session_id}` in your first reply.
- **Version line** — `GROOM: task methodology v<current> is newer than this workstream's <v<marker>|missing marker> — run /groom <session_id>`. Step 6a stops on it.

No manual migration is needed for legacy sessions — `rewrite-pointer <session-dir>` regenerates the v3 thin pointer from any existing session log; the derived-summary fallback covers sessions written before this design.

### Step 6 — Skills loading

First check for a save point, a task file whose body carries `Save point ` header lines, per `handoff-methodology`'s `tasks-methodology.md` § Save points. Consider only a path in `## Next best step` shaped `scratch/S-{session_id}/tasks/t-<6hex>-<slug>.md`, with the Step 3-validated `session_id` and no `..` segment; Step 6 reads no other path. Read the first such path named. When its body carries `Save point ` lines and its frontmatter `status` is `open` or `blocked`, split its newest block's header, the last `Save point ` line, into `<invocation>` and `<position>` on the first ` — `. The name is the first token of `<invocation>`, leading `/` removed.

- **The name is within `[A-Za-z0-9._-]` and is an installed skill** — check the characters first, then Glob `{name}/SKILL.md` finds it under `~/.claude/skills`, then the project's `.claude/skills`, then `**/skills/{name}/SKILL.md` under `~/.claude/plugins`. Load it with the Skill tool and no arguments, outside the 5-skill cap and without judgment, then print once:

  ```
  Resuming under <invocation> at <position> (t-<6hex>)
  ```

- **Otherwise** — a command, a name outside `[A-Za-z0-9._-]`, or nothing installed — load nothing unjudged. A command name becomes one more candidate for the judgment below, on the same terms as a `## Skills used` entry. Print instead:

  ```
  WARN: save point t-<6hex> names <name>, which is not an installed skill — not loaded unjudged; resuming from the Next best step
  ```

Print `<invocation>`, `<position>` and `<name>` as plain text, each cut to its first 120 characters.

Then locate the `## Skills used` section in the newest inlined session from the `cat-sessions` output. Apply pushy-load using judgment against `## Next best step`, the `instruction` from Step 1, and recent session state: load each skill whose description plausibly applies to the upcoming work, preferring a false-positive over a false-negative. Cap at 5 skills to keep context bounded. A skill the save point already loaded is not a candidate here and does not count toward the cap.

### Step 6a — Groom stop

If the Step 5 brief carries no version `GROOM:` line (`GROOM: task methodology v…`), continue to Step 7.

If it carries one, print the line, then ask in plain text whether to run `/groom {session_id}` before going any further, end your turn, and wait for the reply. On no, continue to Step 7; the line returns at the next pickup. On yes, invoke `groom` with the Skill tool, args `{session_id}`, and follow it; it ends turns of its own, to wait for its agent and to ask the user which edits to apply. Once `/groom` stops — after its Step 4, or after its Step 3 prints `No user-only edits recommended.` — and the user's groom reply is handled, continue to Step 7.

### Step 7 — Instruction

If `instruction` is empty, continue to Step 8.

Otherwise carry it out now, with the resume brief and the Step 6 skills in context. It is a live request from the user in this session, so it takes precedence over the prior session's `## Next best step`.

When it finishes, continue to Step 8 — unless the instruction plainly supersedes the Next best step, by redirecting the work elsewhere or by doing the same thing a different way. In that case name the Next best step you are skipping, say why, and stop. Adjacency is not supersession: an instruction that merely precedes the next step does not replace it.

### Step 8 — NBS execution

If `## Next best step` is empty, emit `WARN: No Next Best Step found — nothing to execute` and stop.

Read up to 2 files explicitly path-mentioned in `## Next best step` that exist on disk and satisfy ALL of the following containment rules. A save point Step 6 already read is in context: do not read it again, and do not count it toward the 2.

- The path must be relative (no leading `/` or `~`) OR begin with `scratch/S-<session_id>/` OR begin with `scratch/<project>/`. Absolute paths (e.g. `/etc/passwd`, `~/.ssh/id_rsa`) are forbidden.
- The path must not contain any `..` traversal segments.

If a mentioned path does not satisfy both rules, emit `WARN: refusing to read out-of-project path: <path>` and continue without reading that file.

Execute the contents of `## Next best step` directly. NBS execution is ordinary work: it proceeds under normal permission prompts.
