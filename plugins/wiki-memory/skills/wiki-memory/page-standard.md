---
tags: [wiki-memory/page-standard]
summary: "The rubric an agent applies to a wiki page it is already touching, and the determination it records"
page-kind: reference
---
# Wiki Page Standard

Contents: Admission · Domain shape · Determinations · Page kinds · Reference pages · Map pages · Procedure pages · Citations · Condensed-copy sites (keep in parity)

The single normative copy of what a wiki page must be. Every skill that writes a wiki page keeps a **condensed copy** of the one rule it needs at its own write point, with a parity row in the table at the bottom of this page; edit here first, then sync those copies.

This is advice, not a gate. Nothing measures a page against it, nothing scores a page, and nothing dispatches an agent at a page because a count came back wrong. No number can tell a good page from a bad one, and a number that looks right in aggregate is worse than none: it hides the pages it is wrong about. The standard binds at one moment only — an agent is already at a page, for its own reasons, and has to decide what to do with it. That decision is the whole mechanism.

One agent applies this standard: `knowledge-ingestor`, at every page it holds. A whole-domain sweep is the same agent on a wider scope, not a different authority, and no writing path waits for one — every touch is the groom.

## Admission

The wiki is Claude's brain. It keeps what Claude would not otherwise know and would act on, and
nothing else; a brain that retains junk becomes less useful with every page. This section decides
what enters, in what shape, and what stays. It binds the ingestor at every capture it files and
every page it holds. Nothing here is a count: the shape of a domain is dynamic, and the only numbers
in the groom are the work budgets in `ingest-groom.md` `### Work measure` and `sweep.md`
`## Restructure branch`.

### Four questions

Ask them of each claim, not of a capture or a page as a whole. A claim must pass all four.

| | Question | Fails when |
|---|---|---|
| **Sought** | Who opens this page, on work that is not the work that produced the capture? Name the task. | The only reader you can name is the workstream the capture came from, a later step of its epic, or "anyone changing X" where X is what that workstream was changing. Research that answered the workstream's own question — what an upstream project does, which files read a heading it was adding, what the transcripts showed before it changed the rule — stays in `scratch/{project}/`, cited from the decision it served. The capture's `**Discovered:**` line names that question; a claim that answers it fails here. One exception: the reason for a choice that shipped passes when its reader is whoever would change that choice, the agent that would otherwise try the alternative. |
| **Novel** | Would Claude get this wrong, or not think of it, with only the code in front of it? | It is general practice, documented library behavior, or anything one read of the file or one search of the repo answers. A *hint* — a one-line reminder of something Claude mostly knows — passes only when this repo departs from what Claude would assume or when getting it wrong has cost you before; keeping it, and in what shape, is your judgment. A choice this repo made passes on its reason only when the file that makes the choice does not state it; when it does, link the file and carry nothing. |
| **Enforcing** | What does the reader do differently because of it? Name the verb. | It describes: what the architecture is called, what a step observed, what a count was, that something exists, what another project does. No verb, no place. "Keep this as it is, because" is a verb: protecting a choice is a decision. Context the verb cannot be read without folds into the verb's paragraph; context that only introduces is cut. |
| **Durable** | Would this sentence need editing if the implementation changed but its purpose did not? | It copies state: a roster, a count, a list or table of which files currently do or say X, "is now fixed", "still lacks", a step number, a completion date. Linking the files does not save the table; keep the instruction and the one command that rebuilds it. Cite the file that owns the state instead; open work goes to `scratch/issues/`. A mechanism, a constraint, a failure mode, a decision and why: those are durable. A fact about the code stated as a deliberate choice with its reason is intent and passes; the same fact stated as an inventory fails. The evidence a reason rests on — a measurement, a failure — stays with the reason, dated, when the reason would be a bare assertion without it, and no more of it than the reason needs. |

### Shape

A claim that passes goes where its **subject** lives. The subject is what a reader would look up:
a component, a convention, a mechanism, a procedure. It is never the finding, the workstream, the
step or the sentence that discovered it.

- The subject has a page → the claim joins it: a bullet, a table row or a section, whichever the
  reader of that page needs. The form is your judgment; a one-line gotcha and a decision table are
  both right when they fit what the reader will do with them.
- The subject has no page → create one, named for the subject, and link it in prose from the
  sibling page that leads to it.
- Two pages share a subject → one page. The survivor takes what passes; the other is removed.
- A page holds one claim that would be a line on another page → `demote`: fold the line into the
  page whose subject it belongs to, then remove the page. A hint that passes **Novel** only under
  the hint clause is the usual case — a page is the wrong shape for one sentence of instruction,
  however sound the sentence.
- Nothing in the capture passes → `drop`, one line of reason.

**Decisions.** A choice this repo made, with its reason, joins its subject page as one line under
that page's `## Decisions` section, in the shape [`design-record`](../design-record/SKILL.md)
gives; the section is added the first time a line lands, and the line is rewritten in place when
the choice changes. Every other form a page's design content takes, a diagram included, is the one
that page gives.

**The system flowchart.** A close-time capture carrying the shipped system flowchart, aimed at the
project overview (`target-page: overview`, `source: close-issue`), is admitted by the `map`-kind
node check under `## Map pages` instead of the four questions, and merged as
`protocols/ingest-groom.md` gives.

A capture may split: part joins a page, part is dropped. A page may split the same way: paragraphs
that pass stay, paragraphs that fail go, and a page with nothing left is removed.

### Existing pages

The four questions apply to every page you hold, paragraph by paragraph, on every visit. A page
whose title names a finding is renamed for its subject or merged into the page that has it. A page
none of whose paragraphs pass is obsolete: fold what still passes into its subject page, then
remove it. Removal, demotion and rename go through the git gate in `ingest-groom.md`.

### What you record

Nothing on the page. In the return, one line per capture and per page, naming the outcome and the
thing you checked it against — a file, output you read, or the page that says it correctly:
`append → wiki-write — checked against wiki-write.sh _validate_slug`, `retire (obsolete) —
subject gone at HEAD; folded: none`.

Name the deciding question only on a `drop` or a `demote`, where the content leaves the wiki and
nothing else records why: `drop — sought: answers the workstream's own question; lives in
scratch/{project}/idea.md`, `drop — durable: a roster of four copies`, `demote — novel: a hint,
folded into awk-exit-and-end-block`. That line is the whole provenance and the only recovery key.

## Domain shape

`## Admission` decides what a claim is worth; this decides where claims live. Ask these of the page
in hand and its neighbors — the pages it links to and the pages that link to it — on every visit,
and of every subject in a domain on a restructure. Each is yes or no, and a no is work.

| Quality | Question |
|---|---|
| **Subject title** | Does the page's title name a subject a reader would look up? |
| **Linked in prose** | Does a sibling page or a group hub link to it in a sentence, so a reader reaches it from the subject next door? |
| **Grouping follows the reader** | Do the domain's groups and `## Pages` sub-sections sort subjects the way a reader looks for them? |
| **One subject, one page** | Does this page hold one subject, and is it the only page holding it? |
| **Names are subjects** | Does every slug and group name a subject, never a finding, a workstream, a step or a date? |

A no whose fix stays inside the radius and the work budget in `ingest-groom.md` is fixed on the
visit that finds it: `rename`, `merge`, `split`, or a prose link written. A no whose fix reaches
past the radius — gathering one subject's pages from several groups — is a `Restructure:`
proposal, one per subject, or on a domain dispatch a subject-map line for `sweep.md`
`## Restructure branch`. Whether `## Pages` reads better flat or as `### Topic Areas` /
`### Standalone Pages` is judged here too. A hub's own shape is `### Hubs`.

### Hubs

A **hub** is a domain's `SKILL.md` `## Pages` section or a group `index.md`. Every run that holds
a hub asks it the five checks below; `wiki-health` asks checks 1 to 3 of every hub on every run.
Each check is yes or no, and a no is work. A hub that passes all five is left alone, whatever its
length: never regroup because a list is long.

| # | Check | Who asks |
|---|---|---|
| 1 | A whole-file Read of the hub returns without a `PARTIAL view` notice: the file is under the Read cap (25,000 tokens, or `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` when set). A `PARTIAL view` notice on a hub is a failure: read the rest before you rely on the hub, then fix it. | `wiki-health`, and you on every Read |
| 2 | `SKILL.md` `## Pages` ends within the first 5,000 tokens of the file, the part of a skill that re-attaches after compaction. | `wiki-health` |
| 3 | The hub follows the grouped-page listing convention in [`SKILL.md` `## Page Conventions`](SKILL.md). | `wiki-health`, and you on contact |
| 4 | Every group-hub summary covers its group, written as `#### Writing a group-hub summary` says. | you on contact |
| 5 | This visit did not open a hub that failed to hold what its summary promised. | you, from this run's own reads |

`wiki-health` reports checks 1 to 3 as reason codes; route on the code. `NAV_SUMMARY_MISMATCH` on
a group index answers the equality half of check 4, and an `--update` of the page fixes it.
`ORPHAN_PAGE` on a grouped page means its index lists it but `SKILL.md` links neither it nor the group hub: fix (a).

| Code | Check | Fix |
|---|---|---|
| `HUB_PAST_READ_CAP` | 1 | on `SKILL.md`: (a), then (c), (d), (e); on an `index.md`: (g) |
| `PAGES_PAST_REATTACH` | 2 | (a), then (c), (d), (e) |
| `GROUPED_PAGE_IN_SKILL_MD` | 3 | (a) |
| `GROUPED_PAGE_UNLISTED` | 3 | (a) |
| `GROUP_INDEX_MISSING` | 3 | (f), then (a) |
| `GROUP_INDEX_HEADLESS` | 3 | add the `## Pages` heading to the index by hand, then (a) |
| `HEADLESS_PAGES_FENCE` | none; a nav-structure defect | write a `###` sub-heading above the fence by hand, outside it; the next `wiki-write` regeneration also merges adjacent fences |

The fixes, cheapest first. Each answers a failing check; a fix whose check passed is never made.

| Fix | Answers | Tier (`ingest-groom.md` `### Work measure`) |
|---|---|---|
| **(a)** `wiki-write {domain} --hub-sync`: lists every grouped page in its group index and drops its `SKILL.md` bullet | 3 | **A** |
| **(b)** Rewrite a group-hub summary: the index's `summary:` through `wiki-write {domain} {group}/index --update`, which resyncs its `SKILL.md` bullet | 4, 5 | **B** |
| **(c)** Move body prose that sits above `## Pages` in `SKILL.md` onto pages | 2 | **B** |
| **(d)** Move loose root pages into an existing group whose subjects already cover them | 1 or 2, still failing after (a) and (c) | **B** |
| **(e)** Create a group, with its `index.md`, for a subject loose root pages share when no group covers it | 1 or 2 on a flat domain | **B** |
| **(f)** Write the missing `index.md` through `wiki-write {domain} {group}/index`, with a payload that carries a `## Pages` heading | 3 | **B** |
| **(g)** Split a group `index.md` into sibling groups, never a new tier | 1 on an `index.md` | **B** |

- **The hub is in the radius.** A run that writes into a domain holds its `SKILL.md` and the group
  index of every page it writes, so a hub fix is never a proposal for reaching past the radius.
- **Fix (a) always runs.** It is Tier A: run it on every visit that finds its code, whatever the
  budget.
- **One hub, one decision.** Bringing one hub into line with check 4 is one Tier B decision,
  however many summaries it rewrites. Each (c), (d), (e), (f) and (g) is one decision of its own.
  They share the run's one Tier B budget with the capture's work.
- **Worst first, then propose.** Fix within the budget in this order: a hub failing check 1, then
  check 2, then a summary that names no subject, then one missing a subject or carrying a count.
  What the budget leaves becomes a `Proposal:` block, opening `Restructure:` for (d), (e) and (g).

#### Writing a group-hub summary

A group-hub summary is the sentence a reader uses, from `SKILL.md` alone, to pick a hub. Write it
general, so it does not grow when the group grows.

- **Name the group's subjects at the level a reader looks them up:** "the subscription lifecycle"
  or "webhooks and the jobs they enqueue", not a class name or a slug.
- **Cover every subject and name no page.** A summary that misses a subject the group holds
  fails check 4. A new page under a subject already named leaves the summary unchanged; a summary
  that lists pages gains a clause every time one is filed.
- **Carry no count:** not "21-command reference" or "the 4 checklists".
- **Name subjects, never the container:** "Group hub for X pages" with nothing after it names no
  subject.
- Good: "Rhythm, concision, diction, cutting darlings".

## Determinations

For the page in front of you, make exactly one determination and record it, with a one-line reason, in the report you are already writing: the groom ledger or the ingestor's return. Nothing goes on the page itself — no score, no number, no frontmatter field recording a judgment.

| Determination | When |
|---|---|
| `leave` | The page answers its questions below. The default, and the right answer most of the time. |
| `update` | A claim is wrong against what you can see, or a paragraph changes no decision and can be cut. Rewrite in place, in positive prose. |
| `append` | What you carry is new and belongs to what this page's `summary:` says it is for. |
| `create` | What you carry does not belong to what this page's `summary:` says it is for. Write a separate page. |
| `split` | The page has outgrown saying one thing. Move its content into pages that each say one thing. |
| `merge` | Two pages share one subject. The survivor takes what passes `## Admission` through `update`; the other is removed through the gate, and every prose link to it is rewritten. |
| `demote` | The page holds one claim that belongs as a line on another page — typically a hint that passes **Novel** only under the hint clause. Fold the line into that page, then remove this one through the gate. The two pages hold different subjects, which is what separates this from a `merge`. |
| `rename` | The page's title or slug names a finding, a workstream or a step rather than its subject. `wiki-write <domain> <slug> --rename <subject-slug> --title <subject title>` through the gate, then `--update` the page so its first heading is that title (`--title` re-titles the nav bullet only; `--replace` when that heading is a `## `, since the clobber guard reads a re-titled H2 as a dropped section), then rewrite every referrer it prints. The `--update` is part of the rename, not a second determination. |
| `retire` | The page is wrong, duplicates a page that is right, or is obsolete. Fold in first whatever still passes `## Admission`, then delete it with `wiki-write <domain> <slug> --remove` through the gate. |
| `drop` | A capture, or a claim within one, fails `## Admission`. Nothing is filed; the capture stays in `learned/` as `dropped` when no claim in it passes. |

Admission comes first. The table decides what a page becomes; `## Admission` decides whether a claim reaches the table at all, and in what shape.

**The evidence rule.** Retire needs evidence that the page is wrong, duplicates a page that is right, or is obsolete. Nothing else clears the bar:

- **A missing citation is not evidence of wrongness.** An uncited claim may be perfectly true. Note it in your report and move on.
- **A citation you cannot check is not evidence either.** An unfetched source proves nothing in either direction. Note it and move on; the ingestor holds no web tools to go looking.
- **Obsolete is `retire`,** on the evidence that the page's subject is gone at HEAD, after fold-first.
- **A wrong claim inside a sound page is `update`, not `retire`.** Rewrite the claim; keep the page.

A retire is not reversible from the wiki — the file is gone, and git history in `.claude/` is the only recovery path. The gate in `ingest-groom.md` escalates instead wherever git holds nothing to recover, and the reason line in your report is what makes a removal findable later. Write it as if someone will need it.

Its callers repeat this evidence rule at their own write points. They are all listed in the parity table at the bottom of this page; editing the rule here means visiting every row that names it.

Retiring a page whose file someone already deleted by hand is not this path: `--remove` refuses, because the page does not exist. The stale nav bullet it left behind is a `wiki-health` orphan finding, and the repair is to recreate the page and then remove it properly.

## Page kinds

`page-kind:` declares which rubric below binds a page. Its three values are `reference`, `map` and `procedure`, and **absent means `reference`** — no per-domain `schema.md` may declare a different default. `wiki-write` rejects any other value (exit 2), except in `--append-section` mode, which skips frontmatter validation entirely; a page reached only that way keeps whatever kind it already stored.

## Reference pages

The default kind, and the one the full rubric applies to. Whether a paragraph earns its space is `## Admission`'s four questions, asked of **each paragraph** rather than of the page as a whole; a paragraph that fails one of them is cut inside an `update`, and a page no paragraph of which passes is the obsolete case `### Existing pages` routes to `retire`. Two further questions are this kind's own:

1. **Does each factual claim say where it came from, and could a reader check it?** See `## Citations`.
2. **Is any of it now wrong against what you can see?** Only what you can actually see — the code in front of you, the output you just read. Not what you suspect.

Of these two, only the second can produce a `retire`, and only on evidence.

## Map pages

A map page exists to route the reader onward, so it is judged on its links, and on its diagram's
nodes when it carries one, and nothing else:

- **Does every bullet point at a page that exists?**
- **Does every bullet say what that page is for**, so the reader can choose without opening it?
- **Does every diagram node name a part the page routes to**, through a `## Pages` bullet or a link
  in the diagram's caption, a link to code included? The domain's `overview.md` is a root page with
  no `## Pages` list, so its nodes route through caption links alone.

Nav structure, grouping and the entry format are not this page's rules. They belong to [`wiki-memory` SKILL.md `## Page Conventions`](SKILL.md) and are not restated here.

## Procedure pages

A procedure page is shaped by the `agent-voice` skill, which owns how instructions are written. From this standard it takes one question only:

- **Does each factual claim say where it came from, and could a reader check it?**

The other reference questions do not apply: a procedure's steps are meant to be followed rather than known, so "would the reader have written this unprompted" is the wrong test.

## Citations

A citation is a literal markdown link in prose (AD1). That form is not cosmetic — the freshness and churn machinery reads in-prose links and sees nothing else. A bare path inside a code span is not a citation as far as any tooling is concerned, however precise it looks.

**Never cite a line number.** A line number is right until the next edit to the file it points at, so a page that carries one goes stale on changes that have nothing to do with what it says, and re-pointing them is work that buys nothing. Name a stable token instead — a function, an identifier, a heading, a literal string — and let the reader search for it.

Three kinds count. The citation names its kind in the prose around it:

| Kind | Durable form |
|---|---|
| A code path | ``[`wiki-write.sh` `_validate_slug`](scripts/wiki-write.sh)`` — the link target is the file; precision, when it is needed, is a token named in the anchor text. Never a line number, in either half. |
| A vendor or external source | A link to the source, with the date it was observed stated in the prose. External pages change without telling you; the date is what makes a later reader able to judge the claim. |
| A commit or issue that settled a decision | A link to the commit or the issue file. This is the citation kind for "why is it done this way", which no code path can answer. |

## Condensed-copy sites (keep in parity)

Every site below keeps a short copy of one rule from this page, or owns a rule this page cites rather than restates. Changing a rule here means visiting its row.

| Site | What it keeps |
|---|---|
| `design-record/SKILL.md` | **Owner, not a copy:** the decision line shape, the form each kind of design content takes, and the diagram rules. `### Shape`'s **Decisions** paragraph cites it. |
| `knowledge-distillation/SKILL.md` | A one-sentence pointer to `## Admission`, and the `Admission:` line in its report format. Its principle filter (principle versus instance), its categories and its compaction techniques are its own, not copies of anything here: they say how to state admitted knowledge. |
| `knowledge-capture/SKILL.md` | The researcher's half of `## Admission` in § Capture Heuristic: do-not-write rule 7 (a capture that copies state the file already owns), rule 8 (research that answers the workstream's own question — **Sought**), and the pointer to the four questions, with shape left to the ingestor. The `**Impact:**` line of the body template and the Capture Checkpoint's IF carry **Sought** too, each with its shipped-decision exception, and rules 2, 7 and 8 exempt a decision or flowchart the close step writes. Also the optional `**Source:**` line in the `learned/` body template, in the citation forms above. The capture path never rejects an uncited capture. |
| `researcher/investigation-workflow.md` | The four questions of `## Admission` as applied at its **Step 5**, one table row each, and at **Step 6** the rule that a finding failing **Sought** stays in `scratch/{project}/` whatever its classification. Its FSM state for that step is `apply-admission`. The researcher is not a caller of this standard: it writes captures and makes no determination (D15), so nothing here binds its Step 7. |
| `researcher/decision-frameworks.md`, `file-paths-discipline.md`, `positive-negative-examples.md` | The same admission questions restated for routing, for the dual-filter authority rule, and in worked examples. They state the questions in their own words, so they move when `## Admission` moves. |
| `wiki-memory/SKILL.md` `## Page Conventions` | **Owner, not a copy:** page voice, the `## Pages` entry format, sub-sectioning and grouping, and which frontmatter fields exist and which are required. This page cites those rules and does not restate them; of the frontmatter it adds only the `page-kind` value set and its default. Its `**Citations**` line points at `## Citations` above rather than restating the form. |
| `wiki-memory/protocols/query.md` (step 3c) | The drift-fix correction: a stale claim is rewritten in place on direct contradicting evidence, never deleted. Removal belongs to the ingestor. |
| `wiki-memory/protocols/ingest-groom.md` (`## The rubric`, Step 4a) | The evidence gate in its own words: wrong against something you can actually see, duplicating a page that is right, or obsolete at HEAD — and neither a missing citation nor an uncheckable one clears it. Step 4a applies `## Admission` to each claim, and Step 4 asks `## Domain shape` of the pages it holds. It also carries the naming rule, the git gate, fold-before-delete, the radius and the work measure, which are its own and not this page's. |
| `wiki-memory/protocols/sweep.md` | **Not a copy:** it points at `ingest-groom.md` `## The rubric` and restates nothing. It owns the whole-domain steps — mechanical baseline, contradiction scan, the coverage ledger, and the restructure branch that applies `## Domain shape` subject by subject within its subject budget — which are not this page's concern. Its restructure branch says how `### Hubs` fixes count against that budget. |
| `wiki-memory/protocols/ingest-groom.md` (`### Radius`, `### Work measure`, Step 4) | The `### Hubs` rules in its own words: the radius holds the domain's `SKILL.md` and the group index of every page written; fix (a) is Tier A whatever the budget; one hub's check-4 rewrites count one Tier B decision and fixes (c) to (g) one each. Step 4 points at `### Hubs` for the hubs it holds. |
| `wiki-memory/SKILL.md` `## Page Conventions` (grouped pages) | **Owner, not a copy:** the grouped-page listing convention check 3 cites, and the `--hub-sync` and `{group}/index` write paths fixes (a), (b) and (f) use. |
| `wiki-memory/scripts/wiki-health.sh` | **Owner, not a copy:** the byte thresholds approximating checks 1 and 2, and the seven reason codes in the code table above. Renaming a code means editing that table. |
| `wiki-memory/protocols/audit.md` `## The conformance catalog` (`### Pages and navigation`) | The code-to-repair routing of the code table above, as one catalog row per code, plus `ORPHAN_PAGE` on a grouped page routed to (a). Changing a fix in the code table means changing that row. |
| `wiki-memory/protocols/audit.md` (Step 3b split-into-group, Step 4 hub placement) | Its own layout rules for a decomposition: split a section with three or more `###` into a group, and place `## Pages` by body weight. They do not contradict `### Hubs`, whose check 2 is fixed by moving body prose onto pages; a change to either side means re-reading the other. |
