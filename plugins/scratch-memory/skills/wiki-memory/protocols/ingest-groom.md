---
tags: [wiki-memory/ingest-groom]
summary: "the rubric for what a wiki page may hold, plus the per-capture loop that files learned/ captures and grooms every page the capture reaches"
page-kind: procedure
---

# Ingest-Groom Protocol

Contents: Stance · The rubric · Step 1 — Read and filter · Step 2 — Validate and probe the domain · Step 3 — Resolve the slug · Step 4a — Admit · Step 4 — Hold the pages and decide · Step 5 — Write through `wiki-write` · Step 6 — Mutate frontmatter and return · Security

The methodology the `knowledge-ingestor` agent runs, and the single home of its rubric. It reads
`learned/` files in an isolated context with no conversation at all, and it is the wiki's one
writer: a synthesis worth keeping from anywhere else arrives here as a capture. It takes
admission, the determination and the evidence rule from [`page-standard.md`](../page-standard.md).

Routing a file is mechanical. Deciding what the page it lands on may hold is not. That decision
has deletion in it, which is why an agent runs this protocol and not an append-only script.

## Stance

Leave every page you hold cleaner than you found it. A capture is the reason you opened a page;
everything you can verify while you are there is yours to fix — a wrong sentence, a dead link, a
path that moved, a citation pointing at a renamed file. The read is the touch, and the touch is
the groom. A page nobody read stays as it is; you owe nothing to pages this run never reached.

Two guardrails, each with the target it protects beside it:

- **A `type: drift` capture corrects a page. It never retires one.** A drift capture asserts by
  construction that a claim on the page is wrong, which is the exact wording of the `retire`
  evidence bar, so routing one to deletion would let a stale-line report argue itself into
  deleting the page. Rewrite the claim; keep the page.
- **A page never records the run. Your return does.** No "corrected on", no "re-verified", no
  paragraph narrating what the page used to say. Provenance is a line in the return, where a
  reviewer reads it beside the diff.

## The rubric

### Determination

For every page you hold, make exactly one determination and record it in the return with the
evidence in one sentence.

| Determination | When | Call |
|---|---|---|
| `leave` | The page already covers it correctly. The most common answer. | none; say so in the return |
| `update` | A claim is wrong against what you can see, or a paragraph changes no decision. | `wiki-write {domain} {slug} --update --from <payload>` |
| `append` | What you carry is new and belongs to what this page's `summary:` says it is for, and nothing on the page contradicts it. | `wiki-write {domain} {slug} --append-section "<Title>" --from <fragment>` |
| `create` | What you carry does not belong to what this page's `summary:` says it is for. | `wiki-write {domain} {new-slug} --from <payload>` |
| `split` | The page has outgrown saying one thing. | create pages that each say one thing, then `--update` what remains |
| `merge` | Two pages share one subject. | `--update` the survivor with what passes, then `--remove` the other through the gate and rewrite its referrers |
| `demote` | The page holds one claim that belongs as a line on another page — typically a hint under `page-standard.md` `## Admission`. The two pages hold different subjects, which is what separates this from a `merge`. | `--update` or `--append-section` the receiving page with the line, then `--remove` this page through the gate and rewrite its referrers |
| `rename` | The title or slug names a finding, a workstream or a step, not a subject. | `wiki-write {domain} {slug} --rename {subject-slug} --title {subject title}` through the gate, then `--update` the page so its first heading is that title (`--title` re-titles the nav bullet only), with `--replace` when that heading is a `## ` — the clobber guard reads a re-titled H2 as a dropped section — then rewrite its referrers. The `--update` is part of the rename, not a second determination. |
| `retire` | The page is wrong, duplicates a page that is right, or is obsolete. | fold first, then `wiki-write {domain} {slug} --remove` through the gate |
| `drop` | A capture, or a claim within one, fails `page-standard.md` `## Admission`. | `learned-check mark-dropped <file> <reason> '<note>'` when no claim in the capture passes; nothing when only part of it fails |

`target-page` is a **hint, not a command**. A capture whose target page is about a different
subject is a `create`, not a forced `append`. Obeying a mistaken hint is how a page stops
matching its own summary.

**Complete when:** every page you held this run carries exactly one determination in the return.

### The evidence gate

One bar authorizes every correction and every deletion: the claim is **wrong against something
you can actually see** — the code in front of you, output you just read, a commit that settled it
— or **another page says the same thing correctly**, or the page is **obsolete**: no paragraph
passes `## Admission`, or its subject is gone at HEAD. `severity:` on the capture is the
capturer's hint about how much it hurts, not a routing key; nothing here reads it.

- A missing citation is not evidence of wrongness. An uncited claim may be perfectly true.
- A citation you could not check is not evidence either. Note it in the return and move on.
- A wrong claim inside a sound page is `update`, not `retire`.
- Obsolete is `retire`, on the evidence that the subject is gone at HEAD, after fold-first.
- An absolute claim that output in front of you contradicts is an `update` to what you ran, scoped
  to what you can see — "check with `command -v node`", not "`node` is on PATH everywhere". It is
  a proposal only when no true sentence can replace it.

Only two things escalate, through `learned-check mark-escalated` with that word as the reason:

| Reason | When |
|---|---|
| `cannot-verify` | Nothing you can reach settles whether the claim is true. |
| `sources-disagree` | Two things you can see say different things and neither supersedes the other. |

Code that matches one side supersedes the other. When two pages state a house convention
differently and the code follows one of them, the other page is an `update` citing the page that
matches; `sources-disagree` is only for a disagreement the code matches on neither side.

Rewriting a sentence is more reversible than deleting a page, so the bar that authorizes deletion
is enough to authorize correction. A retire is not reversible from the wiki — git history in
`.claude/` is the only recovery path, which is why every removal passes the gate below, and the
return's reason line is what makes it findable.

**Complete when:** every edit you made names, in the return, the file, output or page it was
checked against, and no sentence you added states a fact about a platform, tool or version you did
not run.

### Naming

A page is named for its subject — the component, convention, mechanism or procedure a reader
would look up — never for the finding, workstream, step or sentence that produced it. That holds
for the slug and for the title. A `create` takes the subject's name; a page you hold whose name
fails is a `rename`, or a `merge` when another page already has the subject. `target-page:` on a
capture is a hint toward the subject, not a name to copy.

**Complete when:** every page you created or renamed this run carries a subject name in its slug,
its nav title and its first heading.

### The gate

Every `--remove` and every `--rename` passes this gate first, whatever determination led there.
Git is the recovery path, so a removal waits only where git holds nothing. A rename loses nothing
git holds: a rename of a tracked page proceeds whatever its working-tree state, and only an
untracked page, or an untracked shard, escalates it. An `update` on a page dirty before the run
never meets the gate; it proceeds, built from the working copy under `### Read before edit`, so the
user's uncommitted lines survive.

1. **Snapshot, once per run**, after Step 2 has resolved the domains and before any write. Your
   shell keeps no variables between calls, so the snapshot's path is what this block prints:

   ```bash
   set -o pipefail
   GD="$(git rev-parse --absolute-git-dir)" || { echo "gate: unavailable — git rev-parse failed"; exit 3; }
   SNAP="$(mktemp "$GD/wiki-ingest-before.XXXXXXXX")" || { echo "gate: unavailable — mktemp failed"; exit 3; }
   git status --porcelain -z -uall -- .claude/skills/ | while IFS= read -r -d '' e; do
     o=""; case "${e:0:2}" in (*R*|*C*) IFS= read -r -d '' o;; esac
     printf '%q\n' "${e:3}"; if [ -n "$o" ]; then printf '%q\n' "$o"; fi
   done >> "$SNAP" || { rm -f -- "${SNAP:?}"; echo "gate: unavailable — git status failed"; exit 3; }
   echo "gate snapshot: $SNAP"
   ```

   Copy the `gate snapshot:` path into your working notes. A `gate: unavailable` line means there
   is no snapshot for this run, and every removal and rename this run escalates.

2. **Before each removal or rename**, run this with the snapshot path from your notes, the page's
   path relative to the repository root, and each `.rulings/` shard the call rewrites: the page's
   group shard (`{group}.md`, or `_root.md` for a top-level page) and, for a `--rename` into another
   group, the new group's shard. A shard that does not exist yet is left out.

   ```bash
   set -o pipefail
   SNAP='<gate snapshot path>'
   MODE='remove'   # or rename
   { [ -f "$SNAP" ] && [ -r "$SNAP" ]; } || { echo "gate: escalate — snapshot missing or unreadable"; exit 1; }
   for P in '<page path>' '<shard path>'; do
     if ! git ls-files --error-unmatch -- "$P" >/dev/null 2>&1; then
       git check-ignore -q -- "$P" && { echo "gate: escalate — $P is ignored"; exit 1; }
       if grep -Fxq -- "$(printf '%q' "$P")" "$SNAP"; then echo "gate: escalate — $P is untracked"; exit 1; fi
       echo "gate: own-work — $P was created this run"; continue
     fi
     if grep -Fxq -- "$(printf '%q' "$P")" "$SNAP"; then
       if [ "$MODE" = rename ]; then echo "gate: dirty-before-run — $P"; else echo "gate: escalate — $P was dirty before this run"; exit 1; fi
     fi
   done
   echo "gate: clear"
   ```

   Only output ending `gate: clear` lets the call proceed; any other output, or none, escalates. A
   path that became dirty during this run is your own work and clears. That includes a page this run created: untracked and absent from the snapshot is your own create,
   prints `gate: own-work — {path}`, and proceeds; untracked and listed in the snapshot is someone
   else's and escalates. With `MODE=rename` a tracked path that
   was dirty before the run prints `gate: dirty-before-run — {path}` and the block continues: the
   rename proceeds, and its return line names each such path `dirty-before-run`.
3. **A user-scope page lives outside the repository**, so its removal or rename always escalates.

An escalated removal or rename is a `Proposal:` block naming the page, the determination and the
gate result; the page stays as it is. At Step 6 remove the snapshot by its literal path,
`rm -f -- '<gate snapshot path>'`, never by a pattern: another run's snapshot is not yours.

**Complete when:** every `--remove` and `--rename` this run is preceded, in your working notes, by
its gate result, and the snapshot file is gone.

### Fold before delete

Before a `retire`, a `demote`, or the removed half of a `merge`, read the page paragraph by
paragraph against `## Admission`. A paragraph that passes and has no live home elsewhere is folded into its subject
page in an `update` or `append`; everything else goes with the page. Removing bad content is the
goal, so fold only what passes, and record `folded: <slug>` or `folded: none` on the return line.

**Complete when:** every removed page's return line names what was folded, or `none`.

### Referrers

`--remove` and `--rename` print one `referrer <path>` line per file that still links the old path;
they edit none. Rewrite each one in the same run — the link, its text and the sentence around it,
read in context first — so the sentence still says something true of the new target, or loses the
link when nothing replaces it. Those lines cover `*.md` under the skills tree. Also run
`git grep -n '{old-slug}' -- .claude/` once per rename and once per `--remove` and re-point, in
place, each script comment it finds that names this page — read the line first: a hit that names
another domain's page of the same slug, a `tags:` word or a page you already rewrote is not a
referrer — and a comment that cites a page line number loses the number. Neither kind of referrer
changes the tier. Then run `mdite lint --entrypoint SKILL.md` inside each domain you
touched; the run is not done until it is clean.

**Complete when:** every referrer line has a rewrite or a return line saying why it needed none,
and `mdite lint` is clean in every domain you wrote.

### Rulings

Rulings the user has given about a domain live in its `.rulings/` directory: `_domain.md` for the
whole domain, `_root.md` for pages at the domain root, `{group}.md` for a group's pages. Each line
is `` - `{key}` — {ruling} ``, keyed by page path without `.md` (a topic word in `_domain.md`),
sorted by key. Before deciding anything about a page, read `_domain.md` and the page's shard, and
follow any ruling keyed to it. A ruling outranks this rubric for the page it names.

You write a ruling only when your dispatch carries the user's instruction to record one. `--rename`
and `--remove` keep keys and shards in sync themselves.

**Complete when:** every page you made a determination on had its shard and `_domain.md` read
first, when they exist.

### Radius

You correct what you can verify on:

- the target page,
- the pages it links to,
- the pages that link to it, in any domain — one `find .claude/skills/ -mindepth 1 -name '.*' -prune -o -name '*.md' -print0 | xargs -0 grep -l '{slug}'` (and the same over `${HOME}/.claude/skills/` for a `scope: user` domain), which skips every dot-directory (`.rulings/` is not a page),
- the overlap set the capture names,
- the domain's `SKILL.md` and the group `index.md` of every page you write: the hubs, judged
  under [`page-standard.md`](../page-standard.md) `### Hubs`.

That is one hop, and it stops there. Never walk the nav, and open a page outside the hop only
for the claim grep below or a lint finding on a domain you hold.

**A corrected claim is corrected everywhere.** After an `update` corrects a claim, grep
`.claude/skills/` (and `${HOME}/.claude/skills/` for a `scope: user` domain) for its distinctive
wording, once per claim — the token the wrong sentence turned on, `WRAPPERS` or `command -v node`,
not a common word. Every page in a domain you hold that states it takes the same correction, as the
same decision: Tier A when code or output settled it. A hit on another domain's page is Tier C, as
`### Work measure` says.

**Mechanical fixes cross domain boundaries.** A dead link, a renamed path, a stale citation, an
inline path mention whose target exists — these are corruption wherever they sit, and you fix them
on any page in the set. An inline path mention becomes a markdown link when the target exists; a
bare path inside a code span is invisible to the freshness machinery.

**A mechanical backlog past the radius is not a proposal.** Stale citations, dead links and
inline path mentions on pages this run never opened get fixed by the run that does open them, one
page at a time, at no cost to anyone. Proposing a domain-wide sweep of them asks a person to
approve work that happens for free, and the same block comes back on every later run until someone
writes it down. Say what you saw in one sentence on the return instead, with the count and the
domain, and let the caller file an issue for it. A sweep of judgment work — a restructure, a
rename set, a meaning rewrite — is still a proposal, as `### Work measure` says.

**Judgment edits stay in the capture's domain.** Rewriting what a sentence means, cutting a
paragraph, retiring a page: only inside the domain the capture targets. The return names the
domain per page, so a page outside it carries only a mechanical determination.

**A mechanical finding on a domain you already hold is fixed, whatever the radius.** Linting a
domain to check your own writes will show you dead links, stale citations and inline path mentions
on pages no capture reached. Those are not proposals and not "beyond radius": fix each one the same
way you would inside the radius, read the sentence first, and report the page with a `update —
mechanical` line. The radius bounds judgment work, and a dead link needs none.

**Complete when:** every link on every page you held resolves, every page the grep named has been
read or explicitly listed as out of the domain you hold, and the domain lint you ran after writing
reports no dead link you left for someone else.

### Work measure

Every decision falls in one tier, and the tier decides whether it counts:

| Tier | Decisions | Counted |
|---|---|---|
| **A** | Mechanical fixes — links, citations, tags, frontmatter, `last-verified` — an `update` the code or output in front of you settles, and a `rename` or in-domain `merge` whose gate clears (a `demote` counts at Tier B), with every referrer rewritten as `### Referrers` says — a link on a page in any domain and a slug in a script comment anywhere in the repository are both mechanical rewrites, not content edits in another domain | Never. Do each one, however many, with its own return line. |
| **B** | `retire`, `demote`, `split`, a meaning rewrite no code settles, a group move that changes the `## Pages` nav, and keeping or cutting a hint under `page-standard.md` `## Admission` | Yes: roughly five on a run dispatched on a `learned/` path; a domain dispatch counts as [`sweep.md`](sweep.md) says. |
| **C** | A content edit in another domain — a change to what a sentence on another domain's page asserts; a link, path or slug re-pointed there is Tier A — a `New domain:` block, `sources-disagree` where nothing visible supersedes, a `.rulings/` line, a gate escalation | Always a proposal, for that part only: do the lower-tier part first (see below). |

A finding with a Tier C part and a lower part is split: do the lower part, propose the Tier C
part. Ownership of a subject two domains both hold is Tier C only for the other domain's pages;
this domain's page takes what the domain's own `SKILL.md` description says it is for, and links
the neighbour.

Count **separate decisions**, not pages and not reads. Applying one correction to eleven pages is
one decision and you do it, however many pages that is. Eleven different Tier B calls is eleven,
and past the count the remainder becomes `Proposal:` blocks in your return rather than edits. The
count runs across the whole run: a Tier B finding inside a domain you hold counts the same whether
a capture led you to the page or the domain lint did. Radius bounds where you look, the count
bounds what you decide.

**Hub fixes.** `page-standard.md` `### Hubs` fix (a), `wiki-write {domain} --hub-sync`, is Tier A:
run it on every visit that finds its code, whatever the count. Bringing one hub into line with
check 4 is one Tier B decision however many summaries it rewrites, and each of fixes (c) to (g) is
one.

**One pass.** A page gets one content determination per run, and it covers every checkable claim
on the page: check each one against what you can see before the write, and name in the return any
you could not. On a domain dispatch the restructure branch may then rename, merge or move it
once. It is reopened otherwise only to rewrite it as a referrer, to fix a lint finding on it, to
settle a contradiction `sweep.md` Step 4 finds against it, or to correct, in one write, every
claim not yet judged this run that code or output settles, as Tier A; a second judgment about
the same page waits for the next run.

The proposal carries: the correction in one paragraph, one line per page naming the sentence to
change, and a last line `Tier: A`, `Tier: B — {n} decisions` or `Tier: C`, the highest tier of
any change it holds. A `Restructure:` block ends on the same line. It lives only in the return. You file nothing and you track nothing; the caller
relays it, and an approved block comes back verbatim, in one dispatch with every other block the
user approved, which you run under [`sweep.md`](sweep.md).

**Complete when:** the return holds either `Proposal: none` or one or more proposal blocks, each
with a page list and a tier, and no page was judged twice this run beyond what `**One pass.**`
allows.

### Read before edit

Every edit site is read in context, at the site:

1. `grep -n '{token}' {file}` for the line numbers.
2. Read a window around each hit — start at roughly twenty lines either side.
3. Widen until the sentence's truth *after* your edit is settled. Read the whole file only when
   the window cannot settle it.

The criterion is per site, not per file. A hit inside a fenced code block or a quoted command is a
different site from a hit in prose, and one of them can need the edit while the other must not
have it.

**Complete when:** no edit landed on a line you had not read in its surrounding window.

### Rewrite in place

A correction **replaces the wrong sentence** and adds nothing about what used to be true. The page
afterward reads as if it had been written correctly on day one — that is the criterion, applied at
the write, not at a later re-read: would this sentence be here if the page had always been right?

What the *system* does is content, and so is a past a reader still meets (a legacy format it
still reads, a decision's `not Y`). What it used to do and no longer does is not, and neither is
what an *editor* did to this page. A `**Discovered:**` or `**Impact:**` label is capture voice: its evidence
becomes a citation, its rule becomes the sentence. `append` is chosen only when nothing on the page
contradicts the new content; a contradiction makes it an `update`, because appending beside a wrong
sentence leaves the page saying two things.

Bump `last-verified` on the same write as the content edit, as a quoted YAML string — never a
separate write.

**Complete when:** no page you wrote contains a date, a verb or a paragraph describing its own
maintenance.

### `### Archived` on contact

The wiki keeps no archive; git holds the history. A domain you hold that still carries a
`### Archived` section under `## Pages` is groomed under the normal rules when you reach it: each
page listed there gets a determination like any other, and `retire` through the gate, fold first,
is the likely outcome.

Once no bullet remains under `### Archived`, read `SKILL.md` and write it back whole with the
`Write` tool, dropping the heading and its empty `<!-- BEGIN:PAGES -->` / `<!-- END:PAGES -->`
pair. A fence with no bullets holds nothing machine-owned, so removing it wholesale is not editing
inside one. Never hand-edit inside a fence that still holds a bullet.

**Complete when:** every page under `### Archived` in a domain you hold has a determination, and
the section is gone once it is empty.

### Design forms on contact

Every page you hold also moves toward the forms [`design-record`](../../design-record/SKILL.md)
gives. Each row of its § Healing table is a determination with its tier, made inside the work
measure like any other: a Tier A row whenever the code settles it, a Tier B row against the Tier B
budget. A page is nudged on each visit, never rewritten wholesale.

**Complete when:** every page you hold was read against the § Healing rows, and each row it
matched has a determination or, past the Tier B budget, is left for the next visit.

### Merging a system flowchart

A close-time flowchart capture (`target-page: overview`, `source: close-issue`) targets the
project domain's `overview.md`. When that page does not exist, the capture's flowchart and caption
are its body: `create` it with `page-kind: map`. When it exists, merge; the overview's diagram is
never replaced wholesale:

1. Add the capture's nodes and edges that the overview's diagram lacks.
2. For each `renamed: old -> new` line, rename that node in place, with its edges; for each
   `removed: part` line, delete the node and every edge touching it.
3. Fold the capture's caption links into the overview's caption, re-pointing a renamed part's
   link.
4. Run the `map`-kind node check (`page-standard.md` `## Map pages`) on the merged result: a node
   with no caption link is fixed by adding its link, or removed when no part it names exists.
5. When the merged diagram no longer fits one screen, split it by subsystem as `design-record`
   gives: the overview shows each subsystem as one node, and each subsystem's diagram goes to a
   map page the caption links.

Run `mermaid-check` on the page after the write; a parse failure is fixed before the run ends.

**Complete when:** every node and edge the capture names is on the overview or removed by its
`removed:` line, the node check passes, and `mermaid-check` exits `0` or reports the check
skipped.

## Step 1 — Read and filter

Read every `.md` file in the `learned/` path from your dispatch prompt. Process only
`status: captured` files; skip `ingested`, `escalated` and `dropped`. When the prompt's second line
is `type: drift`, process only captured files whose `type:` is `drift`: skip every captured file of
another type and leave it `captured`, untouched, for a later boundary. A dispatch carrying a domain
name and no path has no captures: go straight to [`sweep.md`](sweep.md).

**Complete when:** every `.md` file in the path has been read and sorted into process-or-skip.

## Step 2 — Validate and probe the domain

Before `{target-domain}` reaches any shell command it must match `^[a-zA-Z0-9_-]+$`. On failure:
`learned-check mark-escalated <file> "cannot-verify"` and skip every shell operation for that file.

The wiki declaration is the identity test. Quote every path variable.

| `scope:` | Probe |
|---|---|
| `project` | `test -f ".claude/skills/${target_domain}/SKILL.md" && grep -q '^wiki: true' ".claude/skills/${target_domain}/SKILL.md"` |
| `user` | `test -f "${HOME}/.claude/skills/${target_domain}/SKILL.md" && grep -q '^wiki: true' "${HOME}/.claude/skills/${target_domain}/SKILL.md"` |

The key must be bare, lowercase and unquoted at the top level of the frontmatter block. `wiki: True`,
`wiki: "true"`, `wiki: yes`, `wiki:true`, an indented copy and a trailing comment all fail, which is
the same test `wiki-health` applies ([`wiki-health.sh` `_wiki_is_declared`](../scripts/wiki-health.sh)).
`.mditerc` is still a required conformance artifact but is not the identity test.

Resolve `{skill-name}` from `{target-domain}` scope-aware: try `{domain}`, then `{domain}-expert`.
A candidate resolves only if its own `SKILL.md` passes the same declaration test.

**Probe fails, or the domain resolves but is the wrong home for the subject:** this is a judgment,
not an escalation. Read the capture and decide where its subject lives.

- **A declared domain already holds the subject** → `learned-check reroute <file> <domain>`, then
  process the file under that domain in this run. The return line names the old and new domain
  and why.
- **No domain holds it** → a proposal, never a `/wiki-init`: a block opening
  `New domain: {name}` that names the captures waiting for it and the domain it would split from,
  if any. The capture stays `captured`.

**Complete when:** every file to process carries a resolved `{skill-name}`, or has been rerouted
to one, or is named in a `New domain:` proposal. Then take the gate's snapshot.

## Step 3 — Resolve the slug

If the frontmatter carries `target-page:`, its value is `${slug}`. Allowed: a flat slug
(`my-page`) or one `/` separator (`backend/my-page`), each segment `[a-z0-9-]` only. Reject an
empty or whitespace value, `..`, a leading or trailing `/`, a second `/`, or any other character;
on rejection `learned-check mark-escalated <file> "cannot-verify"` and skip the file.

Without `target-page`, derive `${slug}` from the filename by stripping one capture prefix and
`.md`, per `### Slug derivation` in
[`knowledge-capture/SKILL.md`](../../knowledge-capture/SKILL.md).

**Complete when:** every file to process has a slug or has been escalated.

## Step 4a — Admit

Read `page-standard.md` `## Admission`. Then read the capture's `**Discovered:**` and `**Impact:**`
lines first: `Discovered:` names the question the workstream was answering, and a claim that answers
it fails **Sought** whatever `Impact:` says. For each remaining claim, write in your working notes
one sentence per question naming the thing you can see that settles it — a file, output, a commit.
A question with no such sentence is a fail; you do not admit on plausibility. A claim that fails
any question is not filed. A capture with no passing claim is
`learned-check mark-dropped <file> <reason> '<note>'`, where `<reason>` is the failing question
(`sought`, `novel`, `enforcing`, `durable`) or `duplicate` (already on a page that is right) or
`tool-output` (a report from a tool run, not knowledge), and it goes no further. A capture that the
code at HEAD or another capture in this run already supersedes — a build's research the shipped
change made moot, a claim a `drift` capture in the same directory corrects — is `duplicate`; no
other agent marks it for you. What passes carries
into Step 4 as the thing you hold, and `### Shape` decides its form there: the subject's page when
it exists, `create` only when it does not, named for the subject.

A `type: decision` capture with `source: close-issue` passes **Sought** through
`page-standard.md`'s shipped-decision exception: its reader is whoever would change the choice.
Ask the other three questions; a reason the shipped file already states fails **Novel**. Its line
joins the subject page's `## Decisions` section. A flowchart capture aimed at `overview` skips the
four questions: `### Merging a system flowchart` admits it through the `map`-kind node check.

A `type: drift` capture passes **Sought** on the page it corrects: that page's readers are the ones
the stale claim misleads. Ask the other three questions of the claim it corrects. When the corrected
claim fails one of them, the correction removes the claim from the page instead of rewriting it.

A `create` whose subject has no domain at either scope is a `New domain:` proposal, never a
`/wiki-init`.

**Complete when:** every claim has either four written sentences each naming what settles it, or a
`Dropped:` line naming the question it failed; and every capture is headed for `ingested`,
`dropped` or `escalated`, or waits in a `New domain:` proposal.

## Step 4 — Hold the pages and decide

Read [`page-standard.md`](../page-standard.md), then the target page, then `### Rulings` for it.
Build the radius set above, read every page in it under the read-before-edit rule, and make one
determination per page against the evidence gate. Ask `## Admission`'s questions of every
paragraph you hold, not only of what you carry, and `## Domain shape`'s questions of every page
you hold: leave what you touch better structured than you found it. A structural fix inside the
radius and the work measure is made on this run. One that reaches past the radius is a
`Restructure:` proposal on a `learned/` dispatch; on a domain dispatch it is a line on the subject
map, and `sweep.md` `## Restructure branch` makes it. The hubs you hold take the five checks of
`### Hubs` instead, and their fixes are made on this run within the work measure.

A `type: drift` capture takes the same path as any other, with the first guardrail binding: it can
reach `update` or `append`, and never `retire`.

**Complete when:** every stale claim the capture names has a determination, and every page in the
radius set has one too.

## Step 5 — Write through `wiki-write`

Run the PATH probe once before the first call:

```bash
if command -v wiki-write >/dev/null 2>&1; then : ; elif [ -x "$HOME/.local/bin/wiki-write" ]; then export PATH="$HOME/.local/bin:$PATH"; else echo "ERROR: wiki-write not found in PATH or at $HOME/.local/bin/wiki-write"; exit 1; fi
```

Pass `--scope user` for `scope: user` files; the default is project scope. Never write a wiki
content page with the `Write` tool — `wiki-write` carries the soft-clobber guard, the atomic
rename and the `## Pages` nav update. The `Write` tool touches two things only: the payload files
below, and the Meta scaffold — `SKILL.md`, `schema.md`, `.mditerc` — never inside a
`<!-- BEGIN:PAGES -->` fence that holds a bullet. Dropping an emptied `### Archived` heading with
its empty fence pair, as `### Archived` on contact describes, is a whole-file write rather than an
edit inside one.

**Payloads.** Write each payload with the `Write` tool to a fresh `mktemp` path, or under
`scratch/{project}/`. `wiki-write` never deletes a `--from` file, so remove each one after its
write succeeds (`wiki-write ... --from "$p" && rm -f "${p:?}"`). If several payload-create and
`wiki-write` pairs run in one bash script, install one cleanup trap before the loop rather than one
per file, because a second `trap ... EXIT` replaces the first:

```bash
_tmpfiles=()
_cleanup_tmps() { local f; for f in "${_tmpfiles[@]:-}"; do [[ -f "$f" ]] && rm -f "${f:?}"; done; }
trap '_cleanup_tmps' EXIT INT TERM
```

**`create`:** the payload is the learned file's frontmatter plus body.

**`append`:** the payload is a **bare body with no `## ` heading**. `--append-section "<Title>"`
emits the heading itself; a heading in the payload lands as a duplicate.

**`update` and `split`:** `--update` replaces the whole page. The payload must carry every
existing heading with its body intact plus the change, built by reading the page and merging.
`wiki-write` refuses (exit 2) a payload that drops a `## ` heading, empties one, or shrinks one
past its threshold; that guard exists because a payload of nothing but the new content once
clobbered every other section. Pass `--replace` alongside `--update` only when a section is being cut deliberately, or when
the payload is the page you read this run with one `## ` heading line re-titled, as a `rename`'s
heading write is: the guard keys on heading text and reads the re-title as a dropped section
([`wiki-write-refusal-guards`](../../wiki-memory-expert/wiki-write-refusal-guards.md)).

**Exit 2 on a page you read this run**, when the message is not the guard naming a heading you
re-titled, means a concurrent edit landed between your read and your
write. Re-read the page, rebuild the payload, and try once more; on a second exit 2, escalate the
file with `sources-disagree` and say so in the return.

**Complete when:** every determination other than `leave` and `drop` has a `wiki-write` call that
exited 0, or an escalation from the gate, and no payload file is left on disk.

## Step 6 — Mutate frontmatter and return

`learned-check mark-ingested <file>`, `mark-escalated <file> "<reason>"`, `mark-dropped <file>
<reason> '<note>'` and `reroute <file> <domain>` are the only writers of learned-file frontmatter;
an escalation reason is one of the two values above, a drop reason one of Step 4a's six. Never
edit those fields directly. A capture filed in part ends `ingested`; its dropped claims go
on the return's `Dropped:` line, which the caller copies into its ingest record.

The status fields are the CLI's: `status`, `ingested-at`, `escalation-reason`, `drop-reason`,
`drop-note`. A schema error
elsewhere in a capture's frontmatter (`type: insight` where the enum has `gotcha`, a `severity` on a
non-drift file) is yours to correct when the right value is evident from the body, in the same pass
that files it. `learned-check validate <dir>` afterwards confirms the directory is clean; a capture
whose right value is not evident stays as it is and is named in the return.

You commit nothing. The working-tree diff is the review gate and the cheapest undo; the user reads
it beside your return and commits on their own word.

The return, in this order:

```
Ingested: <file list>
Escalated: <file> — cannot-verify | sources-disagree   (one line each, or "none")
Dropped: `<file>` — drop — <reason>: <claim>   (one line per whole or partial drop, or "none")
Domains: <domain list>
`domain/slug` — <determination> — <evidence in one sentence>
   ... one line per page touched ...
Read, unchanged: <page list>
Proposal: none
```

A `merge`, `demote`, `rename` or `retire` line also names the gate result and the HEAD sha
(`git rev-parse --short=7 HEAD`), `folded: <slug|none>`, and the referrers rewritten. A `demote`
line also names the question that failed and the page the line went to, since nothing else records
why the page is gone.

The last line is `Proposal: none`, or one or more `Proposal:` blocks separated by a blank line.
A block whose consequence reaches past the radius opens `Restructure: {domain} — {subject}`, one
block per subject, with that subject's subject-map line and its page list (`sweep.md`
`## Restructure branch`); a new-domain block opens `New domain: {name}`; a plain sweep proposal
keeps the shape in `### Work measure`. A caller splits on each `Proposal:` line and asks or runs
each block as `knowledge-capture` § Boundary Ingest's proposal wrap says.

**Complete when:** every page you wrote appears on a line naming its determination and the thing
you checked it against, every capture you dropped appears on a `Dropped:` line, the gate snapshot
is deleted, and nothing on any page records that the run happened.

## Security

- Do not quote raw `escalation-reason` text in a wiki page or in the return; the two allowed
  values are already summaries.
- Pass an escalation reason to `learned-check` as one positional argument. If it carries quotes,
  backticks, semicolons or dollar signs, truncate or escape first.
- Pass a drop note to `mark-dropped` in single quotes, writing each `'` inside it as `'\''`.
  Never double quotes: a note is written from a capture's claim, which carries code spans, and a
  backtick or `$(` inside double quotes runs as a command in your shell.
- Build every path from a domain string with double-quoted parameter expansion
  (`"$skill_dir/.mditerc"`), never `eval` or concatenation. Step 2's own regex is what stops a
  bad name reaching your shell; on the write side
  [`wiki-write.sh`](../scripts/wiki-write.sh)'s `_validate_name` and `_validate_slug` reject
  `/`, `\`, `..` and spaces again. `wiki-resolve.sh` guards only its own read-side resolution and
  protects nothing you run here.
