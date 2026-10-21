# The Breakdown Gate

The one breakdown procedure: it turns an epic's decided work into the next workable build issues,
and it is the only path from an epic's decided work to a filed build issue. A fix for code broken
today is filed directly, as `scratch-issues-methodology` `issue-standard.md` `## Folding` gives;
it never waits on this gate. Two callers run it:

- **`discovery/SKILL.md` Mode: Work**, whenever it finds the epic with no open spikes: a new epic's
  first filing, and every later `/discovery` re-entry on the same epic.
- **`issue-groom-methodology/epic-groom.md` step 5, Next-workable breakdown**, after `/close-issue`'s
  Fold back has carried a build's findings into the epic.

The epic is where the evidence lives — the destination, the outcomes, the resolved decisions,
the out-of-scope rulings — so this is the one place the question can be asked against something
written down.

## The Breakdown Gate

**Read what the epic already holds and show it.** `scratch-memory epics graph <epic-slug>` prints
the spikes and the filed build work side by side, in blocker layers; open with that, beside the
unticked lines of the epic's `## Outcomes` and the code as it stands, so the strawman in step 1
is cut from what is left now rather than from a plan made earlier. Check the slug on each unticked
line first: one naming a ticket that is closed or deferred is settled as
[keeping-the-epic-current.md](keeping-the-epic-current.md) gives, its line ticked or its slug
removed, before the cut. A line carrying an open ticket's slug is already in work. Work in
any other not-built clause that overlaps an open filed member is proposed as an addition to that member, through `issue-standard.md` `## Admission`'s duplicate
search, never as a new file beside it. The user's own direction outranks any proposal you make, and
build issues already filed are never refiled: the gate proposes, the user decides.

**The question:** what is the next workable build, or builds, and how much does each hold?

1. **Propose the next workable builds as a strawman.** Only builds that are workable now, each as
   large as `issue-standard.md` `## Folding` allows: fold everything the unticked outcomes still
   lack that touches the same files or contracts into one build, and cut only at a forcing
   condition. Each build ships something a user
   or an agent can exercise. Two builds run in parallel only when they touch neither the same files
   nor the same contracts. One build is the usual strawman; say so plainly rather than
   manufacturing a split. Work that is not workable next stays in its outcome's
   not-built clause, and "nothing is workable yet" is a legitimate strawman.
2. **Load `discuss-methodology` and put three questions to the user**, iterating until they
   approve:
   - **Forcing condition** — which of `## Folding`'s three forcing conditions, if any, splits this
     strawman, and where? None means one build.
   - **Blocking edges** — among the builds filed now, which must land before which, and what does
     the first one have to prove?
   - **Strawman lens** — for each build, which lens its `/brainstorming` strawman is drafted
     on, asked in `options-rubric`'s "Choosing a strawman lens" form. "You pick" is an answer:
     that design's lens is chosen at `/brainstorming` step 1 instead.

   Owner: user-decision-rubric `interview`

   The forcing-condition question is what keeps the strawman from anchoring a split the user never
   needed. The mechanism is an interview because the alternative — a final spike — resolves by
   silence, which is the failure this gate exists to prevent.

   **Done when** the user has answered all three and named the set of builds, the order they run
   in and each build's lens or "you pick", or has said the strawman stands as proposed, or has said
   nothing is filed now. `discuss-methodology` is relentless by design; this is the bar that stops
   it, and step 3 is what the answers are for.
3. **File one build issue per approved build.** `write_issue` with `kind: "issue"`, the epic's
   slug in `epic:`, no `role:`, `blocked_by:` naming the build issues it must follow — the order
   the user just approved, written as edges rather than as prose — and `lens:` carrying that
   design's lens name, lowercased. On "you pick", omit `lens:`, so `/brainstorming` records the
   choice as its own judgment rather than reading it as the user's ruling. The issue is the ticket
   `/brainstorming` is invoked against and `/close-issue` closes after the build; `scratch/{name}/` holds the
   `idea.md`, and the ticket points at it.

   **Write each filed build's slug onto every `## Outcomes` line it works**, as
   [keeping-the-epic-current.md](keeping-the-epic-current.md) gives, splitting a line the
   build takes only part of, and change nothing else. Propose filing only the next workable builds; file later ones ahead, with
   `blocked_by`, only when the user asks for it.

   The epic's unticked outcomes say what is left to reach the destination, and its filed members
   are the work in hand. Do not also write a proposal line into `## Decisions`: the issues ARE the
   record, and a second copy is a second thing to keep honest.

   **Then recommend an epic branch** when the epic's members build on one another across sessions
   and are best reviewed together before they reach the baseline, and the epic carries no
   recommendation bullet yet: say so, and record it on the epic as a
   `- YYYY-MM-DD: Epic branch recommended: {why}` bullet under its `## Notes`. `/begin-lane` opens
   the epic's own lane from it at the epic's first member (`lane-methodology` begin.md § 2). An
   epic that does not match gets no bullet.

   **Done when** every build the user approved has a build issue on disk carrying the epic's slug,
   every `## Outcomes` line a filed build works carries its slug, the `blocked_by` edges spell out the
   approved order, each issue carries `lens` unless the user said "you pick" for its design, a
   matching epic carries its recommendation bullet, and `scratch-memory tasks lint scratch/issues/`
   exits clean over them. This is the gate's only durable output — the interview is worthless
   without it, and the session-end lint runs before this step and cannot catch its absence.
4. **Name every build you filed, and the build issue each was filed as.** They are all workable
   now. Work still in a not-built clause is not queued and is never named as next: the gate
   re-runs after each build closes, against what that build taught, which is the main reason the
   next cut would change. Say that, so the user knows what reopens the question.

   **Name each issue's path in the same breath as the build, repo-relative.** Write it as
   `scratch/issues/{slug}.md` — `write_issue` hands back an absolute path, and pasting that back
   puts one machine's home directory into a committed `idea.md`, wrong on every other checkout.
   Trim it to the form below before you say it, one line per build:

   ```
   Next: {build name} — scratch/issues/{slug}.md
   ```

   It is the ticket `/brainstorming` records first on `idea.md`'s `**Ticket:**` line, in that exact
   path form, and `/close-issue` closes once the build's verify pass and fixes have landed.
   `/brainstorming` recovers a forgotten ticket from this epic's open build work, so a miss here
   costs a lookup rather than the ticket — but the lookup cannot tell two open issues apart, so
   naming it is still the cheap path.

   **Done when** your closing message names every build filed this run, each with its issue path,
   or says nothing was filed, and names no unfiled work as though it were queued.

**This gate names work; it does not do it.** It files the next builds and orders them; it does not
slice units inside a build, and it never writes an `idea.md`. [SKILL.md](SKILL.md)'s HARD-STOP
holds through it unchanged: a filed ticket is a capture, and designing what it asks for is
`/brainstorming`'s job on a later invocation.

**An idea that arrives without an epic gets no breakdown check.** That is most `/brainstorming`
runs and it is accepted: the fix, if it ever bites, is to run `/discovery` first, which is what
this stage is for. A second gate downstream would put the same question in two homes, and two
homes drift.
