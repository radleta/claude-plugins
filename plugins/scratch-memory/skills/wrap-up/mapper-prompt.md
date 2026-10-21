# Mapper Dispatch Prompt

Stage 4 of [SKILL.md](SKILL.md): one `employee` agent, in the foreground. It reads everything at
low resolution and decides how the sort is cut; it verifies nothing at HEAD and chooses no destinations.

**Parameters:**
- `{SESSION_ID}` — the workstream's id; its folder is `scratch/S-{SESSION_ID}/`
- `{SKILL_DIR}` — the absolute path of this skill's folder
- `{SLICES}` — the item count in `items.json` divided by 150, rounded up
- `{LANE}` — empty in workstream scope; in lane scope ([lane-scope.md](lane-scope.md)), the
  line `This harvest is lane {lane}'s: also read scratch/L-{lane}/README.md and the output of
  git log --first-parent --no-merges --stat {fork}..{branch}, which is what the lane shipped.`

```
Agent({
  subagent_type: "employee",
  description: "Wrap-up mapper",
  prompt: |
    You are the mapper in the wrap-up of scratch/S-{SESSION_ID}/.

    Write limit: create or edit only scratch/S-{SESSION_ID}/wrap/map.md. Every other path is
    read-only, git included.

    {LANE}

    Read, in full:
    - scratch/S-{SESSION_ID}/wrap/items.json: every item's text, and every task's body;
    - scratch/S-{SESSION_ID}/wrap/destinations.md: the destinations the sorters may propose;
    - {SKILL_DIR}/sorter-prompt.md § Sorting rules: what the sorters will decide per item;
    - the titles of scratch/issues/: `grep -m1 '^title:' scratch/issues/*.md`, and of
      `{path}/scratch/issues/*.md` for each items.json `repos` entry whose `corpus` is true;
    - the `## Decisions` sections of the idea.md files and epics the items name.

    Write scratch/S-{SESSION_ID}/wrap/map.md with these sections, in order:

    ## HEAD
    The shas from items.json `head`: the repo, the scratch subrepo, and each registered repo
    under `head.repos`.

    ## Themes
    One `### {letter}{n}. {name}` per subject the items fall into: two lines on what it covers,
    `Items:` listing its ids, and `Look first:` naming the files that already hold its
    decisions, so a sorter checks there for a held match before anywhere else. A file in a
    registered repo is named `{repo}:{path}`, the path relative to that repo's root.

    ## Supersession chains
    One numbered line per chain, oldest first: `d071 → d006 → d013`, and a phrase on what each
    step changed. Written from the item texts; a chain is a hypothesis the sorters check.

    ## Duplicate clusters
    One numbered line per group of items you judge to be one lesson recorded more than once,
    naming the one whose text you would keep.

    ## Slices
    Exactly {SLICES} lines, `- slice {N}: {id}, {id}, …`, N counting from 1. Cut along themes,
    so a theme, a chain and a cluster each land in one slice, at about 150 items a slice. Every
    item id in items.json appears on exactly one slice line, tasks, questions and files
    included.

    Return one line: `map: {themes} themes, {chains} chains, {clusters} clusters, {slices}
    slices of {sizes}`.
})
```
