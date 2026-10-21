# Judging severity

How to choose a value from the scale in [SKILL.md § Severity](SKILL.md#severity), which defines it.

**One field, one queue.** Defects and ideas share this scale deliberately, so a single ranked list
answers "what matters most" without anyone reconciling two vocabularies. The cost is that the word
`severity` reads oddly against an idea; the benefit is that a second axis does not have to be
maintained, populated and kept honest. Read the field as "how much this matters," and the defect
column as the specialization of that for something already broken.

**For a defect, severity describes what happens if the issue ships unfixed.** For an idea, it
describes how much the product loses by never building it. Neither reading is ever about how hard
the work is, how long it has sat, or how annoying it is. Those are real considerations and they
belong in the body, not in this field.

**`unrated` is for ideas whose value only a person can judge**, and it means something different
from an absent key. Absent means nobody has triaged the file at all. `unrated` means someone read
it, established there is no defect to grade, and left the value call to a human. An agent triaging
a `kind: idea` capture should write `unrated` rather than guess a value, unless the idea's worth is
uncontroversial. `unrated` is not a rung on the scale: it sorts out of the severity queue rather
than to the bottom of it, and a review that drives severities to zero does not touch it.

**A severity the user did not name is a proposal.** When the user asks for an issue and names no
severity, write the value you judge (for `kind: idea`, the `unrated` rule above decides it) and add
`- YYYY-MM-DD: Severity proposed by the agent; awaiting the user's confirmation.` under `## Notes`.
When the user confirms or changes it, replace that note with their ruling. Their wording while
describing the problem is not a ruling on this field, and a proposed value is not a completed triage.

Scope for judging severity is everything a user, staff member, or tester can reach in the shipped
product. Staff-reachable counts.

**Reachability does not lower a security or privacy exposure below `blocker`.** The `blocker` row
names the exposure itself, with no qualifier about who can reach it, and that is deliberate: an
exposure's audience is a fact about today's deployment, not about the defect. A credential committed
to a repository is a `blocker` even though only repository holders can read it, the same as an
unauthenticated endpoint that leaks the same credential. Argue reachability in the body, where it
informs what to do first; do not spend it against the severity.

**`low`'s "internal-only" means no production reach, not "an operator noticed it".** A defect that
only an operator can observe is still `medium` or above when its consequence lands in production —
a dev-environment path that writes to production data, a security control whose failure has no log
line, a limit that silently loosens across nodes. The `medium` row's second clause exists for the
recurring shape where a control passes every test, behaves correctly in every single-node
environment, and is wrong only where it runs for real. Nobody re-reads `low`, so that class must
not land there.

**Judge the feature live, not its current gating.** A feature dark behind a flag, a release gate, or
an unfinished rollout still gets the severity it will carry once it is on. The literal reading — a
dark feature cannot break, so every defect in it is `low` — grades a data-corruption bug the same as
a typo, and silently re-grades the whole corpus the day the flag flips.

**A severity gate and a scheduling assignment are different axes.** A project that says "nothing
above severity X ships" is stating a release gate: work at that severity blocks its release from
going out. It is not saying where the work is scheduled. If your project schedules work by an
attribute the issue inherits from somewhere (a milestone, a release, an epic), the gate does not
move that attribute, and reading it as though it did produces per-issue overrides that duplicate
what the parent already says.

**For a deploy or provisioning prerequisite, judge the consequence of deploying without it.** An
absent database record, an unrun bootstrap command, or a missing credential is not code, so "what
happens if it ships unfixed" has no literal answer — nothing ships. Answer what the field exists to
answer: what breaks in the environment that goes live without it. A prerequisite whose absence takes
a whole fleet out of rotation is a `blocker`, not a `low`.

A project applying these to its own release process records that application in the project, not
here. See [Project-specific application](#project-specific-application).

The field is hand-added during triage; the MCP writer never emits it, so its absence means nobody
has triaged the file yet and is not itself a finding. `grep -l '^severity: blocker' scratch/issues/*.md`
is the tool-free review queue at one level; a project with a planning layer over this corpus usually
has a command that does the same grouped by epic.

Keep two states apart, since the difference is the point of `unrated`: a file with no `severity:`
key has never been triaged and nobody has read it, while `severity: unrated` means someone read it
and left the value to a person's judgment. The query for each is in
[query-cookbook.md](query-cookbook.md).

## Project-specific application

The `scratch-issues-methodology` skill defines the vocabulary and the judgment rules. It does not know your project's release
process, and it must not learn it — the corpus conventions are shared across every project that
uses `scratch/issues/`, so a milestone name, a release gate, or a tool path recorded here is wrong
everywhere else it loads.

Record in the project, not here:

| Belongs in the project | Belongs in this skill |
|---|---|
| Milestone, release, or epic names | The five severity values and what they mean |
| Which severities gate which release | That a severity gate and a scheduling assignment are different axes |
| What is dark, flagged, or out of scope this release | That a gated feature is judged as if live |
| Names of project lints, CLIs, and planning files | The frontmatter schema, the status enum, the I- and E-rules |

Where in the project depends on scope. A ruling that outlives the current effort belongs in the
planning system's own conventions doc. A ruling scoped to one effort belongs in that effort's own
record — for a `/discovery` epic, its `## Decisions` section, which is already what the skill's E5
rule expects a settled spike to write to.
