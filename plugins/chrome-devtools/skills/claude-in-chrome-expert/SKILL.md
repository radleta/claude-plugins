---
name: claude-in-chrome-expert
description: "Tab-disciplined browser operation methodology for agents using the claude-in-chrome MCP. Covers per-agent tab ownership, proven concurrency limits, cold-start retry, export-over-transcription, read-only defaults on sites the user does not own, and report-data caveats. Use when an agent operates a site through claude-in-chrome — navigating it, working a report builder, reading a signed-in page, exporting a file — even for a single page read. Instrumenting a page for console, network, performance, or DOM is `chrome-devtools-expert`: a different test."
---

You operate real websites inside the user's own Chrome, in a tab you create and own.

## Tab discipline

Isolation here is tab discipline, not sandboxing. Every agent shares one Chrome and one tab-group
listing, so the tabs you see include the user's and other agents'. Nothing but your own discipline
keeps you out of them.

1. Create your own tab with `tabs_create_mcp` before any navigation.
2. **Record the returned tab id immediately**, before any other call.
3. Pass that id explicitly on every subsequent call.
4. Close only the tab you created, and only once your work is done.

**Close nothing you did not create.** When you are unsure whether a tab is yours, close nothing
and say so in your result — a tab left open costs the user one click, and a tab wrongly closed
destroys another agent's run. An agent has already closed another agent's tab while under an
explicit instruction not to, because it had not yet registered which tab was its own. Recording
the id at step 2 is what prevents that.

### Cold start

A first `tabs_create_mcp` can fail with `This session's tab group no longer exists (tabs were
closed)`. Retry with `createIfEmpty: true`.

## Concurrency

**Up to 3 agents against one Chrome is proven. 4 or more is untested — run those in sequence.**

The evidence, so the claim stays checkable: on 2026-08-31 two agents ran concurrently against the
same Chrome with zero cross-tab contamination and zero contention errors. Their timestamps
interleaved about 2 seconds apart while both lanes spanned roughly 60 seconds, which confirms
real overlap — serialized, the same work would have taken about 120 seconds. A third agent joined
later without incident.

## Load your tools in one call

The `mcp__claude-in-chrome__*` tools are deferred. Batch every tool the task is likely to need
into a single `ToolSearch` `select:` query — one call, comma-separated — rather than one call per
tool. Issue a second call only when the task later reaches for something you did not anticipate.

## Read-only by default

On any site the user does not own — and on their live revenue and analytics accounts especially —
report what you see and change nothing. Navigate, read, and export; that is the whole job. Do not
save, submit, alter settings, or enter credentials.

Acting on a site takes a dispatch that asks for that specific action in so many words.

If a login wall, consent gate, or 2FA challenge appears, stop and report it with what you saw.
Do not attempt to authenticate.

## Pulling data off a page

**Export the file rather than transcribing the table.** Reading a long table off screen loses
rows: a 64-row AdSense table lost 4 impressions to screenshot stitching. Use the site's own CSV or
export control, then report the file path.

Where the site offers no export, read the text with `get_page_text` rather than reading numbers
off screenshots, and state in your result that the figures were read rather than exported.

## Reporting numbers

State the source's own reporting timezone beside any date range — day boundaries move figures
between days, and a report pulled in one timezone read as another is wrong by a whole day at each
end.

Flag every figure the source marks partial, estimated, or subject to revision. Ad and analytics
platforms revise recent days, so the most recent day in a range is the one most likely to move.

## Session Directory

Create a session directory on the first file write that `## Where to Write Output` sends there — a caller-named path takes the output instead, and needs no session directory:

```
.claude-in-chrome/{YYYYMMDD-HHmmss}-{4-char-hex}/
```

Generate the hex suffix randomly (e.g., `20260301-143022-a7f3`). This is your workspace for
exports, screenshots, notes, and working files. The random suffix keeps every agent's file paths
distinct, so no two agents write into the same directory.

**Where to create it.** Use the **primary working directory named in your environment block** as
the base — that value is always in your context and needs no shell command. Do not try to compute a
repo root with `git rev-parse --show-toplevel`; you have no Bash tool. If no working directory is
named, use the scratchpad directory from your dispatch context. Never create a session directory
inside a skill folder or anywhere under `~/.claude/`.

## Where to Write Output

Follow these rules in priority order:

1. **Caller specifies a path** → write there exactly. This wins outright; it is not a
   fallback, and it replaces the session directory rather than sitting beside it.
2. **Task relates to specific project files** → write adjacent to that context
3. **No specific context** → write to your session directory

## Constraints

- **Use ONLY the claude-in-chrome MCP tools for all browser operations.** Never write your own
  automation scripts, install packages, or drive Chrome by another route. If the MCP tools are
  unavailable or failing, report the error — do not work around it.
- Do not modify project source code unless the task explicitly asks for it.
- Respect other agents' session directories — do not read or write into a session directory you
  did not create.
