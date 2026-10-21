# Query Cookbook

Contents: Triage guidance · Recipes

Corpus-wide grep/sed recipes for `scratch/issues/`, and the `scratch-memory` verbs that replace the
ones worth automating. The schema and the judgment rules these query are in
[SKILL.md](SKILL.md); this page is only the shell.

For a single file, a plain `Read` is usually the right tool. These recipes are for corpus-wide
sweeps, where reading every file individually would be wasteful — but corpus size varies by
project, so size yours before assuming that's true for you.

## Triage guidance

Read status from the live files, every time — never from a maintained index; see
[ruled-out.md](ruled-out.md) for the history of the hand-built triage index this rule replaced.
**A static file cannot track a mutating corpus** — query it fresh with
the recipes below instead of trusting anything that claims to summarize it.

To triage a batch of open issues:

1. `grep -l '^status: open' scratch/issues/*.md` for the working set.
2. Pull titles and kinds for a first pass: `grep -h '^title:\|^kind:' <files>`.
3. Read full files for anything you're about to act on — cheap if your corpus's files run short;
   use the sizing recipe below to check rather than assuming.
4. Rank by your own judgment of impact and staleness — there is no numeric priority field to sort
   on. Staleness signal: an old `captured:` date with no `## Update` section suggests nobody has
   touched it since filing; an `## Update` section with a recent date suggests it's still being
   tracked.

## Recipes

**Size up your corpus:**

```bash
# File count
ls scratch/issues/*.md | wc -l

# Status split
grep -h '^status:' scratch/issues/*.md | sort | uniq -c

# Kind split
grep -h '^kind:' scratch/issues/*.md | sort | uniq -c
```

**Find, read, and check issues:**

```bash
# List open issues (filenames)
grep -l '^status: open' scratch/issues/*.md

# List by kind
grep -l '^kind: idea' scratch/issues/*.md

# All titles, for a quick scan / duplicate check before filing
grep -h '^title:' scratch/issues/*.md

# Read one section of one file without pulling in the whole body
sed -n '/^## Summary/,/^## Context/p' scratch/issues/<slug>.md

# Conformance check: closed files with no closing section
# — automated by `scratch-memory tasks lint 'scratch/issues/'` (rule I7); this
# recipe remains as the tool-free equivalent.
for f in scratch/issues/*.md; do
  if grep -qE '^status: (fixed|wont-fix|accepted|moved|settled)' "$f" && ! grep -qE '^## Resolution\b' "$f"; then
    echo "$f"
  fi
done

# Never triaged — nobody has read these
grep -L '^severity:' scratch/issues/*.md

# Triaged, and waiting on a person's value judgment
grep -l '^severity: unrated' scratch/issues/*.md

# Files with no frontmatter at all (predate the MCP writer)
for f in scratch/issues/*.md; do
  [ "$(head -1 "$f")" = "---" ] || echo "$f"
done
```

**Epics and spikes share this corpus, so `role:` is the excluder.** Since epics and spikes are
ordinary files here, they answer the status and kind queries above alongside ordinary captures — an
epic is `status: open` for as long as its route is unfinished. Anything that means "captures only"
has to say so:

```bash
# Open captures only — excludes epics and spikes
grep -l '^status: open' scratch/issues/*.md | xargs -r grep -L '^role:'

# Epics only
grep -l '^role: epic' scratch/issues/*.md

# Every spike of one epic — the ^epic: value is a comma-separated list, so match it as one
grep -lE '^epic: ([a-z0-9-]+,)*<epic-slug>(,[a-z0-9-]+)*$' scratch/issues/*.md

# Open spikes of one epic that are actually workable right now (blockers all settled).
# Derived from the live files every time; nothing stores this list.
scratch-memory epics frontier <epic-slug>

# One epic's whole membership -- decision work and build work in blocker layers,
# plus cycles, external blockers and a progress count. --json is the contract;
# the text form is for a person.
scratch-memory epics graph <epic-slug>

# Every open issue that is waiting on something, with what it waits on. Blocked
# issues stay in the triage lists above -- filtering them out is how a real
# defect goes quiet for a month -- so this recipe surfaces them rather than
# hiding them.
grep -l '^status: open' scratch/issues/*.md \
  | xargs -r grep -H '^blocked_by:'
```

`xargs -r` matters in the first recipe: without it, an empty result leaves `grep -L` reading stdin
instead of exiting.

Compose these with plain shell — `grep -l ... | xargs grep -l ...` for AND queries, `comm` or `diff`
on two sorted `grep -l` outputs for set operations. See [ruled-out.md](ruled-out.md).
