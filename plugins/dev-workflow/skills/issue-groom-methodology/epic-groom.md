# The Epic Groom

Companion to [SKILL.md](SKILL.md): the five steps it runs, in order, for each epic its start set
reaches. A shipped build changes its epic's graph and the decisions its body states: it pushes work
out of its own scope, satisfies or moves edges, answers or reframes questions other members were
waiting on, and changes decisions the epic records. The epic groom takes those changes into the
members and the epic body while the build's record is fresh, then files the next workable builds.

**Reached three ways.**

- **From the groom procedure.** SKILL.md step 1 runs steps 1 to 4 below against the findings.
  With no findings source, the findings are the start ticket itself, as SKILL.md § Inputs gives.
- **From § Entry: /close-issue only.** SKILL.md step 7 runs step 5 below, once SKILL.md step 6's
  rulings are applied, so the breakdown reads the epic as Fold back left it.
- **At a `discovery` rest point.** [rest-point.md](rest-point.md) runs step 3 alone, over the open
  issues the epic's changed decision lines bind. The findings are that diff; open no build
  artifacts.

Open with `scratch-memory epics graph {epic-slug} --json` and the findings. Each member carries its
direct `blocked_by`: **upstream** of a member is everything reached by following `blocked_by` from
it, hop after hop, and **downstream** is the reverse walk. Propose every change; SKILL.md step 6 applies
or rules each by its owner. Run the steps in order, since each changes what the next one sees:

1. **Intake.** Sort every piece of work the build pushed out. `process-notes.md`'s wrap lists, as
   `Filed:` lines, the fixes `/implement-code` Step 6d filed with this epic's `epic:`, and, as
   `Pushed out:` lines, the new functionality it left for this epic; the run card's deferred and
   unverified items may hold more, and so may the commit messages of a range.
   - **A fix for code broken today** is a member: propose filing any not yet filed as a build issue
     with the keys `discovery/breakdown-gate.md` step 3 gives, asking its step 2 strawman-lens
     question for it. Write `lens:` only from the user's own answer naming a lens for that
     issue; on "you pick" or an "approve all" reply, omit it (`user-decision-rubric` § Recording a
     ruling).
   - **A question that needs a decision** is a spike: propose filing it with the keys
     `discovery/SKILL.md` § Spikes gives, its edges wired after creation.
   - **New functionality** is not filed here. It joins an outcome's not-built clause in the epic's
     `## Outcomes` at step 4, and is filed only when step 5's breakdown finds it workable.

   Propose each new member's `blocked_by` in either direction: a new spike can sit upstream of
   existing work.
2. **Rewire.** For every open member, propose the edge changes the findings caused: a dependency
   that no longer exists, a new member now upstream. A blocker that is now closed stays as an
   edge, and the graph shows it done.
3. **Reshape.** For every open spike and build issue the findings bear on, propose the edit it now
   needs: its scope, or dropping it.

   A spike the findings answer outright is resolved here with `discovery` Mode: Work step 4's three
   edits, whatever its frontier position, citing the findings as its evidence. Walk its downstream
   members in this same step; its fog graduation (`discovery` Mode: Work step 5) runs once, after
   the groom, and the work its answer decides is written into `## Outcomes` at step 4, before
   step 5 cuts.

   What a build issue may take turns on the first rule that matches:
   - **An open spike is upstream of it** — record what the findings taught as a
     `- YYYY-MM-DD: …` bullet under its `## Notes`, replacing `_Not captured._` when that is all
     the section holds, and change nothing else. That spike's resolution reshapes it, once, when
     the deciding answer exists.
   - **`scratch/{slug}/idea.md` exists** — it changes only through its own `/brainstorming` or
     build. Name the change for that run to take up.
   - **Otherwise** — edit it freely, or drop it with SKILL.md § Entry: /close-issue's close
     proposal alone, drafted from this groom's findings: `fixed` when that work shipped, citing the
     findings source; `wont-fix` when it will not be done. A member that is not workable next and
     passes `scratch-issues-methodology` `issue-standard.md`'s draft test may instead take
     `## Determinations`' `fold into epic`.
4. **Fold back.** Read the epic body against the findings and propose each change it now needs,
   written as `discovery/keeping-the-epic-current.md` gives:
   - a rewrite of every epic line stating something the findings changed;
   - an added epic line for each new decision the findings make that binds the route or more than
     one member;
   - for each start ticket this groom closes, and each closed ticket an unticked `## Outcomes`
     line still names: every line it delivered, carrying its slug or not, rewritten to what it
     delivered and ticked with its slug and commit, and, for what it left undone, the unticked
     line that takes it, a new unticked line, or an `## Out of Scope` line. A ticket that closed
     without delivering a line carrying its slug has the slug removed and the line left unticked.
     A closed start ticket that delivered no line gets one line in the proposal list saying so.
     A tick and its remainder lines are applied only when that ticket's close is applied;
   - a rewrite of the not-built clause of the unticked outcome it serves, for each `Pushed out:`
     line and each other piece of new functionality Intake set aside. New functionality that
     serves no unticked line is put to the user as a new outcome line or an `## Out of Scope`
     line;
   - a ticked line a finding leaves unmet or reworded, rewritten as
     `discovery/keeping-the-epic-current.md` gives;
   - on the one open member a new decision binds, a decision line under its `## Decisions`, as
     `discovery/keeping-the-epic-current.md` gives; build-level detail the findings add that is not
     a decision is a `## Notes` bullet on the member it bears on;
   - the removal of a `## Decisions` line that only restated a now-closed member's build detail, since the
     member's record and the shipped code now hold it.

   **Heal on contact.** Each epic line or section a proposal above already rewrites is written in
   the form [`design-record`](../design-record/SKILL.md) § Healing gives for what it holds: a
   decision as its line, a parts-and-seams paragraph in `## Architecture` as its flowchart. Text
   no proposal touches stays as it is.
5. **Next-workable breakdown.** Read [`discovery/breakdown-gate.md`](../discovery/breakdown-gate.md)
   and run it against the epic as step 4's applied rulings left it. Its strawman and its interview
   questions go to the user as a batch of their own, after SKILL.md step 6's list is ruled, never
   folded into that list. File the builds the user approves before SKILL.md step 8's commit, which
   carries them. Filing nothing is legitimate: the work stays in its outcomes' not-built clauses
   for the next run.

**Done when** every open member and the epic body have been walked, every new member is wired, every
closed start ticket has its outcome proposal, each
proposal is applied or ruled by SKILL.md step 6, or the user said none is needed, and, on § Entry: /close-issue, step 5's
gate has met its own Done-when. A change to the epic's spikes or edges changes its frontier:
SKILL.md step 9 names `/discovery {epic-slug}` next for it.
