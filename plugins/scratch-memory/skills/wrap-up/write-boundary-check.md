# Wrap-up write-boundary check

Contents: The snapshot · The boundary diff · Pre-filled `landed:` · What it misses

The mapper, the sorters and the reconciler are `employee` agents holding Write, Edit and Bash,
reading text the workstream wrote. Each prompt limits them to `{W}`, and nothing enforces it, so
main checks what they did. Stage 9's diff cannot: it is scoped to the landed paths.

This check is an accident detector, not a security control. It shows the user a sub-agent that
wrote outside `{W}` by mistake; a sub-agent set on getting past it can, by the routes
§ What it misses lists. If a real wrap-up ever shows a sub-agent writing outside `{W}`, the fix
is moving the mapper, sorters and reconciler to an agent type without Bash, not hardening this
check.

## The snapshot

Put `before` (stage 4) or `after` (stage 6) between the quotes of `PHASE=''`,
and `{session_id}` in `S=''`. Per repo — the parent repo, `scratch`, and on a lane each repo the
record's `extras:` key names — it records the files in the git dir's `hooks/`, `info/`
and `config` with their hashes, `HEAD`, every ref, the stash list, and every changed, untracked
and ignored file with its unfiltered content hash, under the parent repo's `.git/`. A directory
an ignore pattern matches, such as `node_modules/` or a build output folder, is one line with no
hash rather than every file inside it, which would cost one `git hash-object` process per file.
A rename is recorded as a deletion of its source and an addition of its destination. Every git
call runs with `core.fsmonitor` off, and the `after` run stops before its own `git status` when a
file in `hooks/`, `info/` or `config` is new or changed, which catches a hook or config a
sub-agent edited by mistake:

```bash
PHASE=''; S=''
[[ $PHASE == before || $PHASE == after ]] || { echo "refused: phase"; exit 3; }
[[ $S =~ ^[A-Za-z0-9._-]+$ ]] || { echo "refused: session_id"; exit 3; }
OUT="$(git rev-parse --git-dir)/wrap-up-$S.$PHASE"
[[ $PHASE == before && -e $OUT ]] && { echo "kept: $OUT"; sha1sum "$OUT"; exit 0; }
g() { git -c core.fsmonitor=false -C "$R" "$@"; }
REPOS=(. scratch); LB="$(git branch --show-current)"
for rec in scratch/L-*/README.md; do
  [[ -f $rec && -n $LB ]] && grep -qxF "branch: $LB" "$rec" || continue
  IFS=, read -ra EX <<<"$(sed -n 's/^extras: *//p' "$rec")"
  for e in "${EX[@]}"; do p="${e%%:*}"
    [[ $p =~ ^[A-Za-z0-9._/@+-]+$ && $p != *..* && $p != /* && $p != -* && -e $p/.git ]] && REPOS+=("$p")
  done
done
cfg() { for R in "${REPOS[@]}"; do for d in hooks info config; do
  P="$(g rev-parse --path-format=absolute --git-path "$d")"
  [ -e "$P" ] && find "$P" -type f -exec sha1sum {} + | sed "s|^|$R\tgit-$d\t|"
done; done; }
if [[ $PHASE == after ]]; then
  C="$(comm -13 <(grep -P '^[^\t]+\tgit-' "${OUT%.after}.before" | sort) <(cfg | sort))"
  [ -n "$C" ] && { printf 'STOP: git hooks, info or config changed; no git status was run\n%s\n' "$C"; exit 1; }
fi
{ cfg
  for R in "${REPOS[@]}"; do
    printf '%s\tHEAD\t%s\n' "$R" "$(g rev-parse HEAD)"
    g for-each-ref --format='%(refname) %(objectname)' | sed "s|^|$R\tref\t|"
    g stash list --format='%gd %H' | sed "s|^|$R\tstash\t|"
    g status --porcelain --ignored=matching -uall | while IFS= read -r l; do
      c="${l:0:2}"; p="${l:3}"
      if [[ $p == *' -> '* ]]; then
        printf '%s\t%s\t%s\t-\n' "$R" "${c//R/D}" "${p%% -> *}"; c="${c//R/A}"; p="${p##* -> }"
      fi
      [ -f "$R/$p" ] && h="$(g hash-object --no-filters -- "$p")" || h=-
      printf '%s\t%s\t%s\t%s\n' "$R" "$c" "$p" "$h"
    done
  done; } > "$OUT" && sha1sum "$OUT"
```

Show the user the `sha1sum` line the `before` run prints, in the stage 4 message: it is how
stage 6 knows the snapshot was not rewritten, since a sub-agent can reach `.git/` too.

## The boundary diff

Run after stage 6's snapshot, with `{session_id}` in `S=''` and the `before`
sum from stage 4 in `SUM=''`. It prints every line that differs between the two snapshots, `- `
before a `before` line now gone and `+ ` before an `after` line that is new, so a change prints
both, and a revert, a deleted file, ref or stash prints its `- ` line. It skips a path under
`scratch/S-{session_id}/wrap/` other than the three files main wrote there before the agents ran
— `items.json`, `destinations.md` and `groom-done` — and prints `clean` when nothing is left:

```bash
S=''; SUM=''
[[ $S =~ ^[A-Za-z0-9._-]+$ ]] || { echo "refused: session_id"; exit 3; }
G="$(git rev-parse --git-dir)"; B="$G/wrap-up-$S.before"; A="$G/wrap-up-$S.after"
[[ -f $B && -f $A ]] || { echo "no before snapshot: the boundary cannot be checked"; exit 1; }
if [[ $SUM =~ ^[0-9a-f]{40}$ ]]; then
  echo "$SUM  $B" | sha1sum -c --quiet || { echo "STOP: the before snapshot changed since stage 4"; exit 1; }
else echo "WARN: no stage 4 sum given; the before snapshot is unverified"; fi
D="$(comm -3 <(sort "$B") <(sort "$A") | sed 's/^\t/+ /;t;s/^/- /' | grep -v -P "^[-+] scratch\t..\tS-\Q$S\E/wrap/(?!(items\.json|destinations\.md|groom-done)\t)")"
[ -n "$D" ] && printf '%s\n' "$D" || echo clean
```

A `STOP:` line and every printed line, `HEAD`, ref and stash lines included, go to the user
before review. A resumed run that no longer holds the stage 4 sum runs the diff with `SUM=''`
and tells them the `WARN:` line.

## Pre-filled `landed:`

Only main writes `landed:`, and only in stage 8. After stage 6, every
`landed:` under `{W}` is empty; this prints any that is not, in flow form or as a block list
whose `- ` items start on the next line, or nothing:

```bash
grep -rn -A1 '^landed:' 'scratch/S-{session_id}/wrap/' | grep -P '\.md:\d+:landed: *[^ ]|\.md-\d+-(\s|-(?!--))'
```

A pre-filled one is reported with the boundary diff and cleared before review, its list items
with it, so the item still lands.

## What it misses

- A write into a registered repo: the snapshot covers only `.`, `scratch` and a lane's extra
  repos, so a sub-agent
  writing under a registered repo's root is not seen. Only main writes there, in stage 8.
- A write outside every repo the snapshot covers: the home folder, a shell rc file, and the user-wide
  `~/.gitconfig`, whose `core.fsmonitor`, filters or `diff.external` would still reach every git
  call but the snapshot's own `core.fsmonitor`.
- A write inside a directory an ignore pattern matches: the directory is recorded as one line
  with no hash, so a file added or changed inside it is not seen.
- A path git quotes, one holding a space or an unusual character: it is recorded without a hash,
  so a further edit that keeps its status code is not seen.
- A file under `wrap/` other than the three main wrote: a sub-agent may rewrite another
  sub-agent's proposals, and only the reconciler's reading and the user's review stand between.
- Anything in the git dir outside `hooks/`, `info/`, `config` and the refs: the object store,
  and the per-worktree state of a linked worktree.
- A deliberate bypass: a symlinked hook or `.git/config`, which the `find -type f` in the
  snapshot does not hash; a file removed from `hooks/` or `info/`; a `before` rewritten before
  the `after` run reads it, or at any time once stage 4's sum is no longer held; and a deferred
  write, a detached process or scheduled job a sub-agent started that writes after stage 6's
  snapshot, which nothing re-checks before stage 9's commit.
- Changes main makes in stages 7 and 8, which come after the snapshot; stage 9's diff shows those.
