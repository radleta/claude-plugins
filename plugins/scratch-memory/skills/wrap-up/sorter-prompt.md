# Sorter Dispatch Prompt

Contents: Sorting rules · File shapes

Stage 5 of [SKILL.md](SKILL.md): one `employee` agent per slice `map.md` names, all dispatched in
one message. This file also holds § Sorting rules and § File shapes, which the mapper and the
reconciler read too.

**Parameters:**
- `{SESSION_ID}` — the workstream's id; its folder is `scratch/S-{SESSION_ID}/`
- `{N}` — the slice number, from `map.md`'s `- slice {N}:` line
- `{SKILL_DIR}` — the absolute path of this skill's folder
- `{LANE}` — empty in workstream scope; in lane scope ([lane-scope.md](lane-scope.md)), the
  line `This harvest is lane {lane}'s: also read scratch/L-{lane}/README.md and the output of
  git log --first-parent --no-merges --stat {fork}..{branch}, which is what the lane shipped.`

```
Agent({
  subagent_type: "employee",
  description: "Wrap-up sorter slice {N}",
  prompt: |
    You are slice sorter {N} in the wrap-up of scratch/S-{SESSION_ID}/.

    Write limit: create or edit files only under scratch/S-{SESSION_ID}/wrap/. Every other path
    is read-only, git included: read it at HEAD, never change it.

    {LANE}

    Read first, in full:
    - {SKILL_DIR}/sorter-prompt.md § Sorting rules and § File shapes: the rules you sort by and
      the files you write;
    - scratch/S-{SESSION_ID}/wrap/map.md: the themes, their "look first" files, the chains and
      clusters, and the `- slice {N}:` line listing your items;
    - scratch/S-{SESSION_ID}/wrap/destinations.md: the only destinations you may propose;
    - your items in scratch/S-{SESSION_ID}/wrap/items.json.

    Sort every item on your slice line: each gets exactly one promotion file, question file, or
    line in one of your slice files. Verify at the HEAD shas `items.json` records, as the rules
    say. The map is a hypothesis; where you disagree with it, sort by what you find and say so in
    your notes.

    Write scratch/S-{SESSION_ID}/wrap/slices/{N}-notes.md last, and only when every item on
    your line has its disposition: it is how the wrap-up knows your slice is done.

    Return one line: `slice {N}: {promotions} promotions, {questions} question files,
    {held} held, {drops} drops, {closes} closes, {notes} notes`.
})
```

## Sorting rules

**One disposition per item.** Every item leaves the sort as exactly one of: a promotion file, a
question file, or a line in a held, drop or question-close file. An item another item absorbs
appears in that item's `Absorbs:` and nowhere else.

**Churn decides what to verify.** An item whose `churn.status` is `untouched` is taken as
current. A `changed` or `no-path` item has its claim checked at HEAD before you propose anything
but a drop: read the file it names, or find where its subject lives now. `churn.repo_changed`
lists the changed paths in registered repos. Record what you checked
in `Evidence:` with a file:line.

**Held means it already lives somewhere durable.** Hold an item only when its meaning, not just
its subject, sits at a durable file:line at HEAD. Anything under `scratch/S-{SESSION_ID}/`
archives with the workstream and is never a durable destination, and neither is any other
`scratch/S-*/` session folder or `scratch/L-*/` lane record. A project folder `scratch/{project}/`
is durable: archiving works folder by folder, and its `idea.md` and `facts.md` are a design's
record.

**Promote only what is still true and still wanted.** Never propose an edit that overwrites
information still valid at HEAD: append to it, or narrow the edit to the stale part.

**Destinations** — only those `destinations.md` lists:

- **learned** — current-state knowledge of the codebase or a tool that passes
  `knowledge-capture`'s capture heuristic: what exists, not what should. `target` is the wiki
  domain and page. Something forward-looking — a defect, a gap, a proposal — is an issue instead.
- **issues** — workflow lessons, defects, and anything wanting future work. Match first: read the
  titles in `scratch/issues/`, then the likely matches. A match gets `action: append` with the
  new evidence; anything else is `action: new`. A match that is open, is not `role: epic` or
  `role: spike`, and whose work is done at HEAD gets `action: close`, its `Evidence:` naming the
  commit or file:line that did the work. A lesson the wiki would drop still needs a destination,
  and this is usually it.
- **docs, code, primitive** — an item that needs a change there is proposed as an issue by
  default: `route: issue`, `direct: no`. Propose the direct edit, `route: edit` and
  `direct: quick`, only when the edit is one or two lines and obvious.
- **`{repo}-{destination}`** — the same destination in a registered repo, sorted by the rule
  above for `{destination}` and checked in that repo: its root is the `repos` entry's `path` in
  `items.json`, its HEAD is `head.repos`, and an item's paths there are its `repo_paths`. Match
  issues against `{root}/scratch/issues/`. `target` is relative to that root. Choose it when the
  item's subject lives in that repo: a path in `repo_paths` under that repo is the usual sign.

**Tasks** go under `wrap/tasks/`, as `promote` (it outlives the workstream: `destination: issues`, an
issue to file), `done` (finished at HEAD: `Evidence:` shows where), or `drop` (no longer wanted:
the reason in `Why here:`). Done and drop take `destination: tasks`.

**Stray files** (`kind: file`) are moved to a durable path (`action: move`), folded into a destination
(`new` or `append`), or left to archive with the workstream: a drop with reason `archives`.

**Questions** get one of three:

- an **issue**, when answering it needs work or a decision the user has not made;
- an **answer** from the code at HEAD, with the answer text and its evidence;
- a **close** with a reason word — `superseded`, `obsolete`, `duplicate` or `out-of-scope` —
  when the question no longer needs answering.

**Drop reasons**, one word each: `superseded` (a later item or decision replaced it), `done`
(it happened and nothing about it needs keeping), `stale` (no longer true at HEAD), `one-off`
(it bound only that session), `low-value` (true, but no reader would miss it), `archives` (a
stray file the archive branch keeps well enough).

**`## Land as` is the text that lands, verbatim.** Write it for the destination's reader: whole,
self-contained, and free of workstream-private references — no item ids, no session file names,
no "this workstream".

**Confidence** is `high` when you verified the claim and the target at HEAD and would defend the
destination; `low` otherwise. The reconciler re-verifies every `low`.

## File shapes

All paths are under `scratch/S-{SESSION_ID}/wrap/`. `{slug}` is three to six kebab-case words
naming the item.

**Promotion file** — `{destination}/{id}-{slug}.md`, or `tasks/{id}-{slug}.md` for a task:

```
---
item: {id}
kind: {decision|avoid|file|task}
slice: {N}
theme: {the map's theme heading}
destination: {a destinations.md name, or tasks}
target: {page, issue slug, file:line, or path}
action: {new|append|close|edit|move|promote|done|drop}
direct: {quick|no}
route: {issue|edit}
churn: {untouched|changed|no-path}
confidence: {high|low}
cluster: {the map's cluster, or none}
source: {the item's source}
since: {the item's since}
decision: pending
landed:
---
## Land as
{the verbatim text}

Evidence: {what you checked at HEAD, with file:line}
Why here: {one sentence}
Absorbs: {ids this item absorbs, or none}
```

`route:` appears only on a code, docs or primitive item.

**Question file** — `questions/{qid}-{slug}.md`, for a question you propose as an `issue` or an
`answer`:

```
---
qid: {q-xxxxxx}
proposal: {issue|answer}
decision: pending
landed:
---
{the question kernel, verbatim from items.json}

## Land as
{the issue summary, or the answer}

Evidence: {what you checked at HEAD, with file:line}
```

A question file with `proposal: close` also exists, but only the review writes one, when the user
pulls a line out of `question-closes.md`.

**Slice files**, one line per item, each file written even when empty:

- `slices/{N}-held.md` — `- {id} | {where it is held: wiki, issue, primitive, docs, code or project} | {durable file:line} — {gist}`
- `slices/{N}-drops.md` — `- {id} | {reason word} | {one line of evidence}`
- `slices/{N}-question-closes.md` — `- {q-xxxxxx} | {reason word} | {one line of evidence}`
- `slices/{N}-notes.md` — for the reconciler: every map chain or cluster you disagree with and
  why, an item you believe belongs in another slice, a target you appended to that another slice
  might also append to, and every held line you could match only loosely. `none` under a heading
  with nothing to report.
