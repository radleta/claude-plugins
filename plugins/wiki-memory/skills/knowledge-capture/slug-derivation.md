# Slug derivation

Reference for [`SKILL.md`](SKILL.md) § File Naming Conventions.

When a learned file has no `target-page:` field, its wiki page slug is derived
from its filename: **strip one leading capture prefix, then drop `.md`.** The
prefixes are exactly the patterns in the [`SKILL.md`](SKILL.md) § File Naming Conventions
table — that table is the only list; do not maintain a second copy here or in any consuming agent.

Four rules govern the edge cases:

- **Strip at most one prefix.** `research-drift-foo.md` derives `drift-foo`, not
  `foo`. Repeated stripping mangles a topic that legitimately opens with a
  prefix word.
- **The number segment goes with `step-`.** `step-{NN}-` is one prefix, so
  `step-03-efcore-include-gotcha.md` derives `efcore-include-gotcha`. Digits
  elsewhere in the topic survive: `impl-api-returns-204-not-200.md` derives
  `api-returns-204-not-200`.
- **`drift-` is stripped like the rest.** `drift-{page-name}.md` names the page
  it corrects, so the remainder already *is* the intended slug. No special case.
- **An empty remainder is an error, not a slug.** `research-.md` yields nothing
  to name a page with — escalate via
  `learned-check mark-escalated <file> "empty slug after prefix strip"` and skip
  the file rather than writing a page named for its prefix.

A file with no recognized prefix passes through unchanged (`some-topic.md` →
`some-topic`). `target-page:`, when present, wins outright and is used verbatim,
subject to the format validation the ingesting agent applies.
