# Rest Point

Companion to [SKILL.md](SKILL.md): its § Entry: rest point, which `discovery` follows at each
rest point, for the epic it is working. Before step 1, pull scratch by `lane-methodology` § Scratch commit step 1; a pull that fails is that rule's step 5.
The epic slug matches SKILL.md § Inputs' slug pattern before it reaches a command line; one that
fails stops the walk with one line naming it.

1. **Diff the epic.** `git -C scratch diff HEAD -- issues/{epic-slug}.md`; when
   `git -C scratch ls-files --error-unmatch issues/{epic-slug}.md` fails, the whole file is the
   diff. An empty diff ends the walk, and you say nothing.
2. **Walk the changed decisions.** When the diff adds, rewrites or removes a line under
   `## Decisions` or `## Outcomes`, run [epic-groom.md](epic-groom.md) step 3, Reshape, over every open issue those
   lines bind, as SKILL.md § Inputs defines binding, members of the epic or not; then SKILL.md's
   steps 4 to 6, with the epic as the comb's start ticket and the diff as the findings. A drop
   proposed here has no range: a `wont-fix` drop names no file, and a `fixed` drop cites the commit
   or code line its findings name. Leave closed issues as they are, and any open issue the user has
   said in this session is being worked.
3. **Commit the epic.** On a lane, commit it by `lane-methodology` § Scratch commit with no ruling.
   Off a lane, the epic's commit is a ruled item: it joins SKILL.md step 6's commit item when step 6 runs,
   and is put to the user as a one-item ruling of its own when it does not. A non-empty
   diff proposes it whatever the rulings and whether or not any issue was bound. On approval,
   commit by `lane-methodology` § Scratch commit, so the next rest point diffs from here and never
   re-proposes a rejected rewrite. A rejected commit leaves the files in the working tree, and the
   next rest point re-proposes from the same diff.

The walk writes no `Groomed:` marker: it grooms from decisions, not from landed work, and a marker
would make `/groom-lane` skip the issue.
