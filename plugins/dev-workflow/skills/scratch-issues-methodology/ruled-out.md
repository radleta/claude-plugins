# Ruled Out

Tooling proposals considered for `scratch/issues/` and rejected, with the evidence, so the next
agent doesn't re-propose them from scratch. If you're about to suggest a script, CLI verb, or lint
for this corpus, check here first — it's very likely already been tried and killed.

**Scope of these verdicts.** They were reached against the originating corpus (`claude-code-ref`,
measured 2026-08-19, roughly 100 files). The reasoning is portable — it generalizes to any similarly
structured corpus. The measurements underneath it are not: file counts, byte sizes, and percentiles
below describe that one corpus at that one point in time. Re-measure your own corpus (see
SKILL.md's "size up your corpus" recipe) before assuming a verdict still holds — especially the
scale caveat at the end of this file.

## A read-side MCP tool

**Rejected.** The `scratch-memory` MCP server's whole premise is a narrow WRITE channel for
sub-agents that deliberately lack Write/Bash/Edit — the schema it exposes *is* the capability
boundary those sub-agents operate inside. A read tool doesn't fit that premise: any agent capable of
calling a read tool already has Read/Grep/Glob and needs nothing from an MCP wrapper around them.

**Asymmetry worth recording:** a `resolve_issue` *write* tool would NOT contradict this reasoning —
flipping `status` and appending a `## Resolution` section is exactly the kind of narrow, schema-
shaped write the server already does for `write_report`/`write_review`/`write_session`. It was
declined on YAGNI (no sub-agent consumer exists today that needs to resolve an issue), not on
principle. If a sub-agent workflow ever needs to close issues programmatically, this is the one
candidate on this page that's a straightforward "yes" rather than a "no."

## A `scratch-memory issues list` CLI verb

**Rejected.** Every query measured during the audit — status counts, open-issue listing, kind
filtering, title scanning — was reproducible with a first-try grep one-liner (see the cookbook in
[SKILL.md](SKILL.md)). A CLI verb here would reimplement `grep` behind a new interface, with all the
maintenance cost of a new verb (argument parsing, help text, test coverage) and none of the
capability gain.

## A `show` subcommand (full-file or section-selective)

**Rejected.** On the originating corpus, the median file measured ~1.2k tokens (4,832 bytes at
p50) — small enough that a plain `Read` on a single file was already the right tool, no wrapper
needed. Section-selective extraction (`sed -n '/^## Summary/,/^## Context/p'
scratch/issues/<slug>.md`) already does the narrower job.

The original case for `show` leaned on that corpus's 22,103-byte max file while ignoring its
4,832-byte median — a worst-case argument dressed as a typical one. And a section-selective `show`
fails by the same logic that kills the full-file version: it would be a `sed` clone by the exact
reasoning that makes full-file `show` a `cat` clone. If the argument for a tool works equally well
as an argument against it once you swap `cat`/`sed` for `show`, that's the tell. See the scale
caveat at the end of this file — this verdict rests on "the median file is small," which is a
property of the corpus it was measured on, not a law.

## A frontmatter lint

**Rejected for now** — and the specific reason matters more than the verdict, because it's the
reason a future proposal needs to answer first. Sixteen design decisions were made for this
lint during the earlier brainstorming cycle, and **not one of them covered when the lint
runs.** The scratch subrepo has no hooks (`core.hooksPath` is unset there) — no commit-time,
push-time, or CI trigger was available to wire it into. Check your own setup before assuming
this rejection still holds. A manually-invoked lint has the exact same fatal property that
killed the static README index below: nobody remembers to run it, so it silently stops
reflecting reality the moment a hand-edit skips it.

If a lint is ever revisited, **deciding its invocation site is the first question, not the
sixteenth.** A lint with no attached trigger isn't a lighter-weight tool — it's a heavier one that
does nothing extra.

**Revisit — 2026-08-23: the lint shipped.** The rejection's stated condition is now answered:
`register install-hooks` (`scratch-memory/scripts/register.mjs`) registers `hooks/scratch-lint.sh`
as a PostToolUse hook, in its own `Edit|Write|MultiEdit` matcher group, so a PostToolUse hook is the
invocation site — the lint runs at every hand-edit to `scratch/issues/*.md` rather than waiting to
be remembered. The original objection was correct and remains the reason a manually-invoked-only
lint was never built: the hook is what makes this viable, not the rule set. The sixteen design
decisions from the earlier brainstorming cycle didn't change; what changed is that the missing
seventeenth question — the invocation site — now has an answer.

This does **not** disturb the `A scratch-memory issues list CLI verb` verdict above. That verdict
rests entirely on every measured query being a first-try grep one-liner — status counts, open-issue
listing, kind filtering, title scanning. `tasks list` / `tasks lint` are a materially different kind
of thing: **schema-rule evaluation**, not grep filtering (spec.md's Plan-time resolution 8) — a rule
set that checks 10 required keys, two enums, `captured`'s ISO-8601 format, `title` length,
`slug`-versus-filename, a bidirectional `## Resolution` heading-pairing rule, and a `## Summary`
body-structure rule is not something `grep` reproduces, no matter how many one-liners are chained.
Do not read "a lint shipped" as "the `issues list` rejection was overturned" — they answer different
questions.

**Caveat on the invocation site:** the `scratch` subrepo still has no hooks of its own —
`core.hooksPath` is unset there, exactly as when this rejection was first written. The invocation
site that answers "when does it run" is a Claude Code PostToolUse hook registered in the **parent
repo's** `settings.json`, not a git hook inside the subrepo. The original "no trigger was available"
finding was accurate at the time it was written — a git-hook trigger genuinely didn't exist for this
corpus — it's a different, external trigger mechanism that made the lint viable, not a git hook that
was somehow overlooked.

## A static `scratch/issues/README.md` triage index

**Built and deleted.** This is the one proposal that actually shipped, ran for roughly six weeks,
and was removed on 2026-08-19 after a drift audit. Full account preserved in
`scratch/issues/issues-lifecycle-missing.md` under `## Update — 2026-08-19: README index removed`.

At removal it claimed `## Resolved (32)` against an actual count of 74 — more than double. It
referenced 58 of 104 corpus files and missed 4 open issues entirely. Of its 106 lines, 9 were ranked
triage judgment and 49 were inventory listings — the exact kind of thing `grep` reproduces correctly
every time, with no staleness window.

The post-mortem line worth quoting verbatim: **"a static file cannot track a mutating corpus."**

What's notable, and easy to miss if you only remember "the index went stale": the *judgment* half
had not rotted at all. Every issue the index had ranked was still `open` six weeks later — the
prioritization was still correct. The failure was specific to the *mechanical* half (counts, file
coverage), not the analytical half. That's the general shape of the lesson: hand-written judgment
about a moving corpus ages fine; a hand-maintained inventory of that corpus does not, because
nothing forces it to stay in sync with the thing it's summarizing.

Recoverable at `git show 8bcfe8c:issues/README.md` inside the `scratch` subrepo, if the ranked
triage content is ever wanted as a seed for a regenerated replacement.

**Rule that follows:** read status from live files; never persist a second copy of corpus state.
This is why [SKILL.md](SKILL.md)'s Triage guidance points at the query cookbook instead of an index.

## `mdite` as a frontmatter validator

**Impossible, not merely rejected** — this wasn't a judgment call, it doesn't do the job.
`mdite lint` implements exactly three rules (`orphan-files`, `dead-link`, `dead-anchor`), and
`.mditerc` has no extension point for custom field-level rules — there's no config surface to add
"resolved implies a Resolution section" to. Separately, `mdite files --frontmatter` is a JMESPath
*query* tool, not a validator — it has no pass/fail semantics — and it silently returns `[]` on
unquoted YAML dates rather than erroring, which would make it actively misleading if reached for as
a conformance check.

## A third status state (`partial`)

**Rejected.** On the originating corpus it appeared, in effect, in exactly 2 files — both handled
as `status: open` plus a `## Partial Progress (..., NOT resolved)` prose note. A third state buys
one boundary case ("when is something partial versus open-with-a-note?") and doesn't remove any
existing ambiguity — those two files already said what they meant without it.

Adding a state later, if a real need shows up, is cheap: it's a one-line enum change and a batch of
files to re-tag. Removing a state once files have shipped with it is not cheap — every file tagged
`partial` would need re-editing to migrate off it. Asymmetric cost is a reason to wait.

## Required-key / enum validation as a general feature

**Near-dead code if built today.** On the originating corpus, every frontmatter-bearing file
already carried the complete 10-key set with a valid `status` value. The structural reason
generalizes: the sole writer (`write_issue`) always emits all 10 keys and validates `kind` against
its enum before writing, so there is no live *write-time* population of files missing required keys
or carrying invalid enum values — as long as that remains the only writer. The only error class
that actually occurs is *hand-edit drift after the fact* (see [corpus-state.md](corpus-state.md)),
which a schema validator running at write time can't catch — the drift happens after the write, not
during it.

**Revisit — 2026-08-23: the shipped lint runs at edit time, not write time.** The verdict above is
about a write-time validator sitting beside `write_issue` — the required-key set and the `kind`/
`status` enums are already guaranteed correct at write time, so a second check there really would
have nothing new to catch. The lint that shipped is a different thing: `hooks/scratch-lint.sh` fires
on every `Edit`/`Write`/`MultiEdit` to a corpus file, which means it *does* catch the one error class
this section already names as live — hand-edit drift after the fact. Concrete evidence: the legacy
conformance sweep found four titles exceeding 80 characters in the corpus on 2026-08-22 (rule I5),
even though `writeIssue()` has enforced `title` at 1–80 characters since `server.mjs:719` — every one
of those four files was hand-edited past the write-time bound sometime after capture, not written
past it. This note draws the line the verdict above already implied — edit-time coverage of hand-edit
drift versus write-time coverage of nothing new — rather than overturning it; the required-key and
enum guarantees at write time remain exactly as unnecessary as originally found.

## Scale caveat

Every verdict on this page was validated on a corpus of roughly 100 files (the originating
`claude-code-ref` corpus, measured 2026-08-19). That validates "grep is fast enough" and "the
median file is small" *at that scale*. It does **not** establish either claim at 1,000 files, or
10,000 — those regimes were never measured, and both a linear grep scan and a human's patience for
scrolling `grep -l` output are exactly the kind of thing that can degrade an order of magnitude
before it's obviously wrong.

If your corpus is an order of magnitude larger than roughly 100 files, re-run the measurements (see
SKILL.md's "size up your corpus" recipe) before accepting these rejections at face value. The two
verdicts most exposed to this:

- **The `scratch-memory issues list` CLI verb** — rests entirely on "every query is a first-try
  grep one-liner," which was true at ~100 files. A grep across 10,000 files is still fast in
  absolute terms, but the case for a wrapper gets stronger as raw output volume grows past what a
  human can scan directly.
- **The `show` subcommand** — rests on "the median file is small enough that `Read` is already the
  right tool." That's a property of the corpus's *files* rather than its file *count*, so it's less
  scale-sensitive on its face — but it was still only measured once, on one corpus, and a project
  with a different capture style could easily produce a different median.

This page is a record of what held once, not a permanent law.
