---
name: design-record
description: "Design-record rubric: the decision line (X, not Y, because Z) and the form each kind of design content takes, with diagram rules, anti-bloat tests and healing rows. Use when writing or reviewing a decision, an epic, an idea.md, an issue or a wiki page's design — even one decision line."
---

# Design Record

Record a design in the forms below, from epic to `idea.md` to wiki page. A file that names one
of these forms cites this page and restates none of it.

## The decision line

```markdown
## Decisions
- X, not Y, because Z.
```

- One `- ` bullet per decision under `## Decisions`. `X` is the choice, `Z` the reason it holds.
- Write `not Y` only when an agent would plausibly try `Y`; otherwise the line is `X, because Z`.
  An exception to a decision is its own line.
- On an epic, the slug of the spike that settled a decision follows the alternative it ruled out,
  `X, not Y (spike-slug), because Z`, or the decision itself when the line names no alternative,
  `X (spike-slug), because Z`.
- In `idea.md`, each line is numbered, `- D7. X, not Y, because Z`, so a build's `(D7)` citations
  survive. A number is never reused within a file. An `idea.md` written before this form keeps its
  `## Decisions` table, and a reader takes each row (`D1`, `D2` in its `#` column) as one decision.
- A line is current state: rewritten in place when the decision changes, never dated, never a
  history of what it used to say.

## What form each kind of content takes

| Content | Form | Where it lives |
|---|---|---|
| A decision and its reason | One decision line, as above | Epic, spike `## Resolution`, non-epic issue, `idea.md`, wiki subject page |
| The alternatives that lost | The one an agent would try is the line's `not Y`; the full set, in the user's words, goes to `changelog.md` or the spike's `## Resolution`. Never a table column, never on the wiki beyond the line | `changelog.md`, spike `## Resolution` |
| System structure: parts and seams | Mermaid `flowchart`. **Required** when the record names two or more parts with a seam between them (a call, a dispatch, a read or a write). A record with no seam of its own says only "no new seam; sits inside [picture]" and draws nothing | Epic `## Architecture` (after `## Destination`), the opening of `idea.md` `## Architecture`, the body of the wiki project overview, its caption carrying the routes |
| Interaction across parts over time | `sequenceDiagram`. **Earned** when the order of calls is what the design settles and one read of the code would not show it | The `idea.md` section whose prose it replaces, usually `### Contracts`; a wiki subject page when it passes admission |
| Lifecycle: states and transitions | `stateDiagram-v2`. **Earned** when the transitions carry guards a reader must honour | Same |
| Data shape | `erDiagram` when entities relate; a table when the shape is flat. **Earned** | Same |
| A contract or interface | The signature, envelope or shape itself in a code fence, with one sentence saying what it promises | `idea.md` `### Contracts`; wiki subject page |
| A mechanism, constraint or failure mode | Prose, one paragraph each; a failure mode as `category: design implication`. The default form | `idea.md` sections; wiki subject page |
| Evidence a reason rests on | One dated measurement or failure beside the reason, only when the reason would be a bare assertion without it; anything larger is a linked file | `scratch/E-{slug}/`, `scratch/{project}/`; on the wiki, a citation |
| An open question | A checkbox line; empty at approval | Epic `## Not Yet Specified`, `idea.md` `## Open Questions`; never the wiki |
| How it got here | Git history and `changelog.md` | Never the epic, `idea.md` or a wiki page |
| An inventory: files, menus, verbs, counts | Not recorded; cite the file that owns it. A table only when flat data *is* the design (a code-to-fix routing table) | — |

## Diagram rules

- **One picture per structure, carried forward.** The system flowchart is drawn once at the epic
  and rewritten in place through `idea.md` to the wiki overview, like a decision line. An `idea.md`
  shows the system as it stands after its build; the overview shows only what shipped. A planned
  part never appears on a wiki page.
- **The code's names.** Every node is something a reader can open: a file, service, table,
  command, skill, agent or script, named as the code names it. Every edge is a real call,
  dispatch, read, write or data flow, labelled with the verb or the data that crosses. A node a
  reader cannot open means the picture is at the wrong altitude.
- **One screen.** It renders without scrolling in the viewer the record is read in. A larger
  system is split by subsystem, the parent showing each subsystem as one node.
- **Syntax.** `flowchart` (never the older `graph`), `sequenceDiagram`, `stateDiagram-v2`,
  `erDiagram`. No `style`, `classDef`, colours or `click`; `<br/>` only to break a long name; no
  beta types. A fifth type enters only by editing this page.
- **Parsed before it lands.** Run `mermaid-check {file}`, this skill's own script
  (`scripts/mermaid-check.mjs`, put on PATH by `scripts/install.sh`); it parses every block against
  the pinned Mermaid version, the one `scripts/mermaid-pin.json` names. A block that fails renders
  as an error box in place of the diagram. Exit `69` means the check was skipped, never that the block is clean.
- **A caption, not a legend.** One sentence under the diagram says what to read it for and
  carries the links. On a wiki page those in-prose links are the citation; node text cites
  nothing.
- **What a diagram never contains:** a count (lines, tokens, minutes), a status mark, a
  before/after half, a step number, a date, a procedure's steps in a node, a roster (menu items,
  CLI verbs, file lists), a colour carrying meaning. Each is state or history, and goes stale on a
  change that has nothing to do with the structure.
- **Replaces prose.** Nothing the diagram shows is also said in prose in the same section; when
  both exist, the prose goes. When the prose would be shorter than the diagram (a three-branch
  `if`, a list of three commits), the prose stays and the diagram goes.
- **Going stale.** A node or edge naming something gone or moved at HEAD is wrong against the
  code, and is corrected as any other claim the code settles.

## Anti-bloat tests

Ask each of the whole record:

1. **Once.** Is this structure, decision or fact stated in one form, in one place, in this file?
2. **Shorter.** Is this the form a reader gets through fastest? A diagram longer than its prose
   decorates.
3. **Durable.** Would it need editing if the implementation changed but its purpose did not? Then
   it is state, and the file that owns it is cited instead.
4. **Openable.** Can a reader open every name in it?
5. **Current.** Does nothing in any form say what used to be?

## Healing

Each pass that holds a record moves it toward the forms above, within its own budget: the
knowledge ingestor on every wiki page it holds (`wiki-memory/protocols/ingest-groom.md`, which
maps these rows onto its determinations and tiers), and the epic groom, `/refresh-issue` and the
brainstorming review loop on the epic, issue or `idea.md` text they already edit.

| Found | Determination | Tier |
|---|---|---|
| A project overview with parts and seams and no system picture | `update`: draw it from the code at HEAD, parts that exist only | B, one decision |
| Prose that walks parts and seams, or states and transitions | `update`: the diagram replaces the prose; the caption keeps the links | B, one decision |
| A diagram and prose saying the same thing | `update`: cut the prose | B |
| A `**Why` or `## Why` paragraph that states a choice this repo made and its reason | `update`: one `## Decisions` line; the paragraph goes | B |
| A `**Why` or `## Why` paragraph that explains a mechanism | `leave` | — |
| A node, edge or label naming something gone or moved at HEAD | `update` | A |
| A diagram carrying a count, colour, before/after half, roster or step number | `update`: strip it; cut the diagram when nothing structural remains | A when the code settles it, else B |
| An `## Architecture` or wiki overview that names no seam and carries a diagram | `update`: one sentence replaces it | B |

A scratch record healed on contact takes the same rows, with "rewrite" for `update`; its pass
rewrites only the text it already edits, never the whole file.
