# Reconciler Dispatch Prompt

Stage 6 of [SKILL.md](SKILL.md): one `employee` agent, in the foreground, after every sorter has
written its notes. It reasons over the proposals themselves, bodies included, never over
frontmatter alone.

**Parameters:**
- `{SESSION_ID}` — the workstream's id; its folder is `scratch/S-{SESSION_ID}/`
- `{SKILL_DIR}` — the absolute path of this skill's folder
- `{LANE}` — empty in workstream scope; in lane scope ([lane-scope.md](lane-scope.md)), the
  line `This harvest is lane {lane}'s: also read scratch/L-{lane}/README.md and the output of
  git log --first-parent --no-merges --stat {fork}..{branch}, which is what the lane shipped.`

```
Agent({
  subagent_type: "employee",
  description: "Wrap-up reconciler",
  prompt: |
    You are the reconciler in the wrap-up of scratch/S-{SESSION_ID}/.

    Write limit: create, edit or delete files only under scratch/S-{SESSION_ID}/wrap/. Every
    other path is read-only, git included: read it at HEAD, never change it.

    {LANE}

    Read, in full: {SKILL_DIR}/sorter-prompt.md § Sorting rules and § File shapes;
    scratch/S-{SESSION_ID}/wrap/map.md and destinations.md; every slices/*-notes.md; every promotion
    and question file under wrap/; every line of every slices/*-held.md, *-drops.md and
    *-question-closes.md.

    Then, in order:
    1. Merge duplicates across slices into one file: keep the stronger `## Land as`, fold in
       what the other adds, list the absorbed ids in `Absorbs:`, and delete the absorbed files.
    2. Settle every conflict: two slices appending to one target, a chain or cluster a sorter
       disputed, an item a sorter says belongs elsewhere. Re-sort an item when the evidence says
       so, and say so in its `Why here:`.
    3. Re-verify at the HEAD shas in items.json, a registered repo's target at its
       `head.repos` sha under its root from `repos`, every `confidence: low` promotion and every
       `action: append` target: the target exists and does not already say it; every
       `action: close` target: the issue is still open and its work is done at HEAD. Raise a
       confidence you confirmed; turn a promotion you disproved into a held or drop line.
    4. Merge the slice files into three block files, each opening with frontmatter
       `decision: pending`, and question-closes.md also `landed:` empty:
       wrap/held.md, wrap/drops.md, wrap/question-closes.md, one line per item in the slice
       files' format, grouped under a `## {reason} ({count})` heading per reason word. A question
       close exists only as a line in question-closes.md, never also as a question file.
    5. Write wrap/README.md:
       - the HEAD shas, each registered repo's included;
       - a tally table: files and items per destination, then held, drops, closes and the total, which
         equals the item count in items.json; counted from the files, not estimated;
       - `## Promotions`: promotions, question issues and question answers grouped by the map's
         themes, quick direct edits first within a theme, one line each:
         `N. {id} | {destination} → {target} | {action} | {route} | {confidence} | Land as: {the first
         ~100 characters of ## Land as}… | [file]({relative path})`;
       - one section per block file: its counts per reason, and for each reason up to three
         spot checks, the lines you judge likeliest to be wrong, each quoted with its evidence;
       - `## What reconciliation changed`: every merge, re-sort and confidence change.

    Return one line: `reconciled: {promotions} promotions, {questions} question files, {held}
    held, {drops} drops, {closes} closes, {merged} merged`.
})
```
