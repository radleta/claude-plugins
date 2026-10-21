---
name: wrap-up
description: "Wrap up a workstream before archiving: sort each decision, lesson, question, task or stray file in scratch/S-{id}/ into a durable home, land what the user approves, commit, archive. Use when a workstream is finished, when asked to close or archive an S- folder, or when resuming a stopped wrap-up — even for a small one. Archiving a project folder is scratch-management: a different test."
disable-model-invocation: true
---

# Wrap-up — Closing a Workstream Without Losing It

A workstream folder `scratch/S-{id}/` holds knowledge nothing else carries: cumulative decisions
and lessons in its session logs, open and blocked tasks, still-open questions, and working files.
Archiving hides all of it. The wrap-up gives every **item** a disposition — a promotion to a
durable destination, a question answered or filed or closed, or a line saying where it already lives or
why it goes.

The user triggers a wrap-up; never propose one. Nothing is committed without their review, and
nothing is archived without a second, separate go-ahead.

## Invocation

`/wrap-up {session_id}`, from a live session in the repo whose `scratch/` holds `S-{session_id}/`.
When `{session_id}` is empty or holds a character outside `[A-Za-z0-9._-]`, print
`ERROR: /wrap-up requires a session_id (e.g. /wrap-up my-feature).` and stop.

For each open lane record (`lane-methodology` § Identity) whose `workstream` is `{session_id}`,
print `Open lane on S-{session_id}: {lane} — end it with /end-lane {lane}`, and stop. When
`scratch/S-{session_id}/sessions/` does not exist, print `ERROR: no workstream at
scratch/S-{session_id}/` and stop.

`{W}` below is `scratch/S-{session_id}/wrap/`. Every command runs from the repository root.

## Resume

Every stage leaves its output on disk, so a first run and a re-run take the same entry: find the
first stage whose **done test** fails and start there. Report the stage you are starting at.

| Stage | Done test |
|---|---|
| 1 Destinations | `{W}destinations.md` exists |
| 2 Groom | `{W}groom-done` exists |
| 3 Collect | `{W}items.json` exists and is newer than `{W}groom-done` (`[ "{W}items.json" -nt "{W}groom-done" ]`) |
| 4 Map | `{W}map.md` exists and passes stage 4's slice check |
| 5 Sort | `{W}slices/{N}-notes.md` exists for every slice `map.md` names |
| 6 Reconcile | `{W}README.md` has a `## Cost` section |
| 7 Review | no file under `{W}` carries `decision: pending` in its frontmatter |
| 8 Land | every promotion or question file ruled `approve` or `edit`, and `question-closes.md` unless its `decision` is `reject`, carries a non-empty `landed:`, and `{W}ingest.md` exists when any `learned` item landed. `held.md` and `drops.md` carry no `landed:` and are not tested for it |
| 9 Commit | no path stage 8 landed shows in `git status --porcelain` run in its own top level; on a resume, re-derive each top level with `git -C "$(dirname <path>)" rev-parse --show-toplevel` |
| 10 Sign off and archive | `scratch/S-{session_id}/` is gone from the working tree |

## Cost

`{W}cost.md` collects the run's cost as it happens, so a resumed run still has the earlier
numbers. Read the clock with `date -u +%s` just before each agent dispatch and again when its
result lands, and append one line per agent pass straight away:
`| {pass} | {tokens}k tok | {minutes} min |`, `{tokens}` the Agent result's `subagent_tokens` in
thousands, `? tok` when the result carries none. The passes are `groom`, `mapper`,
`sorter {N}` and `reconciler`. For stages 7 and 8, append `| stage {n} (main) | — | {minutes} min |`. A stage
that spans a resume records `?` for the minutes it cannot measure.

## Stage 1 — Destinations

Probe which destinations this repo has:

- **learned** — wiki domains: `grep -l '^wiki: true' .claude/skills/*/SKILL.md`, listing
  `{repo name}-expert` first when it exists. Lands as a `learned/` capture and a boundary ingest.
- **docs** — `README.md`, `docs/`, `CLAUDE.md` and `.claude/CLAUDE.md`, whichever exist.
- **issues** — `scratch/issues/`. Lands through `write_issue`, or a dated update on a match.
- **primitive** — skills, agents and commands under `.claude/`.
- **code** — the repo's source tree.

Then add the **registered repos'** destinations. Run stage 3's collect command now, only to read
the registered repos (`scratch-memory repos`); groom then writes a newer `groom-done`, so
stage 3's done test fails and the collect runs again. Exit 1 or 2:
show the `ERROR:` line and stop. Show every `note:` line it printed on stderr. For each entry of
`repos` in `{W}items.json`, add one destination per name in its `accepts`, named
`{repo}-{destination}` (e.g. `tools-issues`), landing under that entry's `path`, with two limits:

- `{repo}-learned` only when `{repo}` is `items.json`'s `learned_repo`, since a `scope: user`
  capture reaches no other root;
- `{repo}-issues` only when the entry's `corpus` is true.

Name each repo whose `learned` or `issues` a limit skipped, with the limit, in one line.

Show the list without a question: it is derived from the probe above and `items.json`, so it is the agent's, and it
lands in stage 9's commit, whose approval shows it. A correction the user gives before stage 4
rewrites it; once stage 4 starts, the set stands for this run. Owner: agent (user-decision-rubric). Write the set to `{W}destinations.md`, one line per destination: the name, then the path or procedure it lands
by; a registered repo's line also names its root. A destination name is also the folder its promotions go in, under `{W}`.

## Stage 2 — Groom

Run `/groom {session_id}` unchanged, its question about user-only edits included, and append
its agent pass to `cost.md`. Its question closes are already in the workstream's ledger,
`scratch/S-{session_id}/groom-closes.md`, which stage 3's collect reads. Then write the empty
marker `{W}groom-done` (`rm -f 'scratch/S-{session_id}/wrap/groom-done' && : > 'scratch/S-{session_id}/wrap/groom-done'`, the `rm` so a link left at that name is replaced, not written through): its existence is how a
resume knows groom ran.

## Stage 3 — Collect

```bash
scratch-memory wrap collect 'scratch/S-{session_id}/'
```

It writes `{W}items.json` and prints the path; `cli-verbs.md` in `scratch-memory` holds the item
shapes, the registered-repo fields included. Exit 1 or 2: show the `ERROR:` line and stop. Report
the item count by kind, and any `note:` line it printed. A registered repo's root, HEAD, corpus and
item paths are read from `items.json` from here on: `repos`, `head.repos` and each item's
`repo_paths`.

## Stage 4 — Map

Take the `before` snapshot ([write-boundary-check.md](write-boundary-check.md)) unless one already exists: a resumed stage 4
keeps the first one, so a stray write by an interrupted mapper still shows. Show the user its
`sha1sum` line. Then dispatch one
`employee` agent in the foreground with the prompt in
[mapper-prompt.md](mapper-prompt.md). When it returns, run the slice check: every item id in
`items.json` appears in exactly one slice line of `map.md`, and no slice line names an id
`items.json` lacks.

```bash
node -e 'const fs=require("fs"),w=process.argv[1];const ids=JSON.parse(fs.readFileSync(w+"items.json")).items.map(i=>i.id);const seen=[...fs.readFileSync(w+"map.md","utf8").matchAll(/^- slice \d+: (.*)$/gm)].flatMap(m=>m[1].split(/,\s*/));const c=n=>seen.filter(x=>x===n).length;const bad=ids.filter(i=>c(i)!==1).concat(seen.filter(s=>!ids.includes(s)));console.log(bad.length?"FAIL "+[...new Set(bad)].join(" "):"OK "+ids.length)' 'scratch/S-{session_id}/wrap/'
```

On `FAIL`, send the ids back to the mapper through `SendMessage` and re-run the check; the stage
is done only on `OK`.

## Stage 5 — Sort

Dispatch one `employee` agent per slice, all in ONE message, with the prompt in
[sorter-prompt.md](sorter-prompt.md). End your turn and wait for every return; append each pass
to `cost.md` as it lands. A sorter whose `{N}-notes.md` is missing has not finished: resume it
through `SendMessage`.

## Stage 6 — Reconcile

Dispatch one `employee` agent in the foreground with the prompt in
[reconciler-prompt.md](reconciler-prompt.md). When it returns, append its pass to `cost.md`, then
check coverage: every item id in `items.json` has exactly one disposition — an `item:` or `qid:`
field, an `Absorbs:` entry, or a line in `held.md`, `drops.md` or `question-closes.md`. Send any
id with none or two back to the reconciler through `SendMessage`.

Then take the `after` snapshot and run the boundary diff and the `landed:` check of
[write-boundary-check.md](write-boundary-check.md), and report what they print to the user before stage 7 begins; a path they
report is theirs to rule on before any review. Owner: user-decision-rubric `base-and-history`

Then append `## Cost` to `{W}README.md`: the `cost.md` table so far, and its token sum as the
run's token cost for the agent passes.

## Stage 7 — Review

Walk `{W}README.md` with the user, theme by theme, as [stage-7-walk.md](stage-7-walk.md) gives,
writing every ruling into the matching `decision:` field as they give it.

Append the stage's minutes to `cost.md` when every `decision:` is ruled.

## Stage 8 — Land

Land every file ruled `approve` or `edit` whose `landed:` is empty, as its `route:` says where
it has one and as its `destination:` says otherwise, and write `landed: <target>` into the file straight
after each one lands — the issue slug, the file path, or the capture path; a list when one item
touched several files. An approved held or drop item lands nothing and gets `landed: none`.

- **learned** — write each as a capture in `scratch/S-{session_id}/learned/`, following
  `knowledge-capture` § Frontmatter Schema with `source: wrap-up`, the target's domain in
  `target-domain:` and its page in `target-page:`; run `learned-check init` first when the folder
  is missing. After the last one, run `knowledge-capture` § Boundary Ingest once over that
  folder with no type, which files every capture there, including any that was there before.
  Append its record to `{W}ingest.md` in the format of `project-lead-methodology`
  § The ingest record, caller `[wrap-up]`, and keep the wiki page paths its step 4 printed:
  stage 9 commits them.
- **issues** — a new issue through `mcp__scratch-memory__write_issue`, its body composed from
  `## Land as`; an append is a dated `## Update (YYYY-MM-DD)` hand edit on the matched issue; a
  close is `issue-groom-methodology` § Entry: /close-issue on it, passing the item's cited commits
  as `{oldest}^..{newest}` when it cites any and no range otherwise. A close it refuses lands
  nothing: write `landed: none` and relay its refusal line to the user. A question filed as an
  issue gets `landed:` the moment `write_issue` returns.
- **docs and code**, route `edit` — a working-tree edit.
- **primitive**, route `edit` — a skill through `/skill-builder`; an agent or a command as a
  working-tree edit, since only skills have a builder here. Then run `/verify-skill`,
  `/verify-agent` or `/verify-command` on every one changed.
- **docs, code or primitive**, route `issue` — as **issues**.
- **A registered repo's destination**, `{repo}-{destination}`, lands under that repo's root from
  `items.json` `repos`, by the same rules as `{destination}`, with four differences: a close passes
  `--repo {repo}`; an issue is filed with `scratch-memory issue write --repo {repo}`, naming the
  repo so its root never enters the command, its fields as one JSON object on stdin in
  `write_issue`'s input schema, and `landed:` takes the absolute path it prints; an edit is a
  working-tree edit under `{root}`, and `landed:` takes its absolute path; a `{repo}-learned` item
  is a capture in `scratch/S-{session_id}/learned/` with `scope: user`, landed with the other
  captures by the same boundary ingest, whose step 4 prints its page under that repo's root.
- **tasks** — `promote` is the promotion two-step: `write_issue`, then set `status: promoted` and
  `promoted_to: <slug>` on the task file. A file whose `landed:` already names an issue while its
  task is not yet `promoted` gets only that hand edit. `done` runs `scratch-memory tasks done
  'scratch/S-{session_id}/' t-<6hex> --note '<reason>'`, writing each `'` in the note as `'\''`;
  `drop` sets `status: dropped`. Every hand edit of a task bumps `updated:` to a full ISO UTC
  timestamp of now, or the `scratch-lint.sh` H1 rule fires. `tasks done` fires no edit hook, so
  once the tasks land, run `scratch-memory session lint 'scratch/S-{session_id}/'` and
  `scratch-memory tasks lint 'scratch/S-{session_id}/tasks/'`.

**The final session file.** When everything else has landed, check the newest file in
`scratch/S-{session_id}/sessions/`: when its `## Done` already opens with the line
`- /wrap-up final session file` and the file is newer than this run's `{W}groom-done`, which
`find 'scratch/S-{session_id}/sessions' -name '*.md' -newer '{W}groom-done'` shows by listing it
(the file's name goes into no command), a run stopped after writing it, so skip to setting the `landed:` fields below. Otherwise write one
session file to `S-{session_id}` through `mcp__scratch-memory__write_session`, with all eleven
per-session headings of `handoff-methodology` § Per-Session File Schema. Take each question's
id and kernel from its `cat-sessions --format json` row: the kernel is its `text` up to and
including the first `?`.

- `## Open questions resolved` — one `- q-<id> {kernel} → RESOLVED: …` line for every question
  the wrap-up disposed of: an issue names its slug, an answer carries the answer, a close carries
  its reason.
- `## Tasks touched` — one line per task changed: `done` from the `tasks-methodology.md` verbs,
  and `promoted → {slug}` or `dropped` for the two changes that table has no verb for.
- `## Done` — first the line `- /wrap-up final session file`, which every such file carries and
  the check above reads; then what landed, one line per target.
- Every section with nothing to record stays empty, with no placeholder bullet.

Then set `landed:` on `question-closes.md` and on every answered or closed question file, to the
session file's path. Run `scratch-memory cat-sessions 'scratch/S-{session_id}/' --format json`.
If Bash saved the output to a file behind a preview, read the whole file before continuing.
Confirm `still_open_questions` is empty; a question still open there was missed, so resolve it
in a further session file, its `## Done` opening with the same line, before moving on.

Append the stage's minutes to `cost.md`, and copy the two stage lines into `README.md`'s
`## Cost`.

## Stage 9 — Commit

Build the path list: every `landed:` path other than `none`, each issue slug as `scratch/issues/{slug}.md`, the wiki
page paths in `{W}ingest.md` with their shell quoting removed (a `repo-page` line
as its `<root>/<path>`), and `scratch/S-{session_id}/`.

Split the list by repo: realpath each path, or its nearest existing parent for a deleted one,
and assign it to its own `git rev-parse --show-toplevel`, realpathed too. A nested subrepo, such as
this repo's `scratch/` or a registered repo's, is its own top level, so its paths commit there and
never through its parent; a `scope: user` page spelled through `~/.claude/skills` lands in the
registered repo git reports. Take each path relative to its top level, then check it before it
goes near a git command: no leading `/`, no `..` segment, and every character in
`[A-Za-z0-9._/-]`. A path that fails, or whose top level is none of this repo, its `scratch/`, a
registered repo in `items.json`, or a git repo nested under a registered repo's root (its
`scratch/`, where `issue write` files), is shown to the user and left out; never quote around it.
A top level holding a `'`, `"`, `$`, backtick, control character or, off Windows, a `\` is shown
and left out with all its paths; every other top level is single-quoted wherever a command names it.
Show `git status --porcelain` and `git diff` for each repo's list, every path single-quoted after
`--` (`git -C scratch diff -- 'issues/x.md' 'S-x/'`), and wait for the user's approval.
Owner: user-decision-rubric `base-and-history`

Commit exactly those paths with `/commit`, one dispatch per repo, each nested subrepo before its
parent and this repo's scratch subrepo first, so `scratch archive` later runs on a clean scratch
tree. Each dispatch names its repo's top level, tells the worker to run every git command as
`git -C '{top level}'`, since a sub-agent keeps the session's launch directory, and lists the
checked paths it may stage, to be passed single-quoted after `--`; it stages nothing else.
`/commit-all` is never used here: it stages everything in a checkout other sessions share.

## Stage 10 — Sign off and archive

Archive only on the user's explicit approval, a go-ahead separate from stage 9's. Ask,
and end your turn. Owner: user-decision-rubric `base-and-history`. Without it, the wrap-up ends after stage 9 with the folder in place.

With their approval:

1. `git -C scratch status --porcelain` must print nothing outside `S-{session_id}/`. Anything else
   stops the stage: show it to the user.
2. A dirty `S-{session_id}/` means a resumed run whose handoff already ran: skip to its commit.
   Otherwise run `/handoff {session_id}`. Then commit `S-{session_id}/` in the scratch subrepo,
   dispatched as in stage 9.
3. Run `scratch-management`'s archive protocol on `S-{session_id}`. It owns every refusal and
   its next command. The stage is done when the archive exits 0 or the user has ruled on what stopped it.

## Files

- [mapper-prompt.md](mapper-prompt.md) — stage 4's dispatch.
- [sorter-prompt.md](sorter-prompt.md) — stage 5's dispatch, and the § Sorting rules and
  § File shapes all three passes read.
- [reconciler-prompt.md](reconciler-prompt.md) — stage 6's dispatch.
- [write-boundary-check.md](write-boundary-check.md) — the snapshot and boundary-diff scripts stages 4 and 6 run.
- [stage-7-walk.md](stage-7-walk.md) — stage 7's rulings, theme by theme.
- [lane-scope.md](lane-scope.md) — the stages as `/end-lane` runs them on a lane.
