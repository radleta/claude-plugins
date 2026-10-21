# The Refresh

Companion to [SKILL.md](SKILL.md): the procedure § Entry: /refresh-issue runs on one open or
deferred issue that is not an epic. A refresh works inward: it brings that one issue up to the
current code before work starts on it, and its own rewrites edit no other issue. Any change around
it is step 4's separate proposal. Pull scratch first by `lane-methodology` § Scratch commit step
1, loading that skill for it; a pull that fails is that rule's step 5. Then run the steps in order.

1. **Skip test.** Take the anchor SKILL.md § Inputs defines, as the full sha its revision check
   prints, and the issue's **repo paths**: every backticked token in its body that is a path by
   § Inputs' shell values and exists in the tree or in git history
   (`git log -1 --oneline -- '{path}'` prints a line). Stop with one line,
   `{slug} is current at {anchor}: nothing it names has changed`, writing nothing, when either
   holds:
   - the anchor resolves to the same commit as `HEAD`;
   - the issue has at least one repo path, `git log --oneline {anchor}..HEAD -- '{path}' …` prints
     nothing, and no `blocked_by` target settled after the anchor: none carries a settled
     `status:` with a `## Resolution` dated on or after `git log -1 --format=%cs {anchor}`.

   An issue with no repo path is never skipped short of `HEAD`, and one with no anchor is never
   skipped. **Done when** the skip line is printed, or the anchor (or its absence) and the repo
   paths are in hand.
2. **Check against `HEAD`.** Each check below is a source of findings:
   - **Paths and lines.** Every path and `path:line` the issue cites. A path gone from the tree is
     traced: `git log --name-status --diff-filter=RD --oneline {anchor}..HEAD -- '{path}'`, or the
     whole history with no anchor. **Done when** each cited path is present, renamed (its new
     path in hand) or deleted, and each cited line still shows what the issue says it shows or is
     a finding.
   - **Blockers.** The `status:` of every `blocked_by` target. **Done when** each target's status
     is read and each settled one is a finding.
   - **Claims.** Every claim the issue body makes about what a path or symbol it names does, read
     against that code at `HEAD`. Only the claims the body makes, not an audit of the code at
     large. **Done when** each claim is confirmed or contradicted, citing the line that shows it.
   - **Shipped.** Whether the work the issue asks for is already at `HEAD`: the commits in
     `{anchor}..HEAD` that touch its repo paths, and the code its `## Summary` asks for. On a
     spike, whether its question is already answered. **Done when** the answer is yes, no, or in
     part, citing the commit or line that shows it.
3. **Rule.** Every finding from step 2 appears in one numbered list. Each is a proposed rewrite of
   the issue in place, naming the exact edit and one line of evidence, written as
   `discovery/keeping-the-epic-current.md` rewrites an epic line: the new text states what holds
   now and replaces the old, with no dated revision note beside it. Work shipped in part is a
   rewrite of the issue down to what remains. Each rewrite takes the form
   [`design-record`](../design-record/SKILL.md) § Healing gives for what it holds, a decision as
   its line; text no rewrite touches stays as it is. SKILL.md step 6 decides each rewrite's owner:
   a rewrite that narrows or widens what the issue asks for is `corpus-calls`, ruled off a lane and
   applied for veto on one; a corrected path, line or claim is the agent's, applied and reported.

   Work shipped in full is a report line, not a rewrite:
   - on a spike, say that `discovery` settles it;
   - on any other issue, print `Next: /close-issue {slug}`, and leave its `status:` and
     `## Resolution` for that close to write.
4. **Cluster.** Once step 3's rulings are applied, find the issue's cluster as
   `scratch-issues-methodology` `issue-standard.md` `## Cluster groom` defines it, and put the
   `## Determinations` each member needs — chiefly a merge or an obsolete close — to the user as a
   second numbered list of its own, never folded into step 3's, or, on a lane, apply them for veto
   as SKILL.md step 6 gives; a close is SKILL.md § Entry: /close-issue's close and its promotion.
   **Done when** the cluster is searched and each proposal is applied or ruled, or the search found
   nothing to propose and you said so in one line.
5. **Mark and commit.** Write the **Refreshed marker** with
   `scratch-memory issue mark-refreshed {slug}`: it appends `- YYYY-MM-DD: Refreshed: {sha}` under
   the issue's `## Notes`, replacing `_Not captured._` when that is all the section holds, `{sha}`
   the short `HEAD` of the code repo, never of its `scratch/` subrepo. Leave the marker off only when
   step 3 found the work shipped in full, so the close's range still starts before it. On a lane,
   commit by `lane-methodology` § Scratch commit with no ruling, and add a `## Log` line to the lane
   record. Off a lane, the last item of the refresh's ruling list is the scratch commit, by path, of the issue, approved
   rewrites and marker included, and every cluster file step 4 changed: on step 4's list, or a
   one-item ruling of its own when step 4 proposed nothing. When the user approves it, commit by
   `lane-methodology` § Scratch commit; a rejected commit leaves the files in the working tree.

The refresh writes no `Groomed:` marker, so `/groom-lane` and `/close-issue` still groom the issue.

**Done when** the issue was skipped with its line, or every step 2 finding and step 4 proposal is
applied or ruled, the rewrites and the marker (when written) are committed in scratch — on a lane
always, off a lane when the user approved the commit, scratch `main` never pushed — and shipped
work has its report line.
