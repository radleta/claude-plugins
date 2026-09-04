---
tags: [wiki-memory/churn-detection]
summary: "Single-backtick inline code spans bypass churn-check's fence toggle, causing false MISSING hits on illustrative link syntax"
last-verified: "2026-08-25"
---

## A New Wiki Page Documenting Link Syntax Can Trigger Churn Against Itself

`churn-check`'s md-link extractor matches the literal bracket-close-then-parenthesized-path
sequence anywhere on a non-fenced line, regardless of backtick wrapping — only a triple-backtick `
``` ` fence toggles extraction off (AD5). A single-backtick inline code span containing
illustrative link syntax (e.g. an author writing an example like a
bracket-title-then-parenthesized-path pattern to *describe* the convention) is NOT fence-toggled
and is extracted exactly like a real link, producing a false MISSING hit against whatever
placeholder path was used as the illustrative target.

This bites even a page whose entire purpose is documenting this exact limitation: drafting
`claude-code-ref-expert/churn-check-link-extraction-scope.md` in step 05c, the first draft used
literal inline-code examples (a bracket-title-then-path snippet, and a bare
bracket-close-then-paren snippet) to illustrate the syntax being discussed. Both would have added
brand-new churn targets to `claude-code-ref-expert`'s own baseline the moment the page was
written, failing the step's no-NEW-churn-vs-baseline gate on the very page meant to explain the
mechanism.

**Discovered:** During step 05c while authoring the new churn-check-link-extraction-scope.md
page — `grep -n '\](' <payload>` before writing caught both offending lines pre-write.
**Impact:** Any future wiki page (in any domain) that needs to illustrate or discuss Markdown
link syntax must describe the pattern in words (e.g. "bracket-title, parenthesized-path syntax")
or place the full illustrative example inside a proper triple-backtick fence — never inside a
single-backtick inline span outside a fence. A quick `grep -n '\](' <payload-file>` before any
`wiki-write` call is a cheap pre-flight check for this class of self-inflicted churn hit.
