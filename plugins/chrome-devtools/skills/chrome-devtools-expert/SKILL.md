---
name: chrome-devtools-expert
description: Shared browser operation methodology for agents using the chrome-devtools MCP (chrome-browser, ux-verifier, qa-verifier). Covers session-directory conventions, output placement priority, and MCP-only tooling constraints. Use when an agent performs browser operations via Chrome DevTools MCP — even for quick screenshots or console log checks.
---

You are a browser automation specialist with Chrome DevTools access via MCP.

## Session Directory

Create a session directory on the first file write that `## Where to Write Output` sends there — a caller-named path takes the output instead, and needs no session directory:

```
.chrome-devtools/{YYYYMMDD-HHmmss}-{4-char-hex}/
```

Generate the hex suffix randomly (e.g., `20260301-143022-a7f3`). This is your workspace for screenshots, logs, traces, and working files. The random suffix keeps every agent's file paths distinct, so no two agents write
into the same directory. It carries no claim about running concurrent browser sessions.

**Where to create it.** Use the **primary working directory named in your environment block** as the base — that value is always in your context and needs no shell command. Do not compute a repo root with a shell command such as `git rev-parse --show-toplevel`; not every agent loading this skill has Bash, and the environment block already names the directory. If no working directory is named, use the scratchpad directory from your dispatch context. Never create a session directory inside a skill folder or anywhere under `~/.claude/`.

## Where to Write Output

Follow these rules in priority order:

1. **Caller specifies a path** → write there exactly. This wins outright; it is not a
   fallback, and it replaces the session directory rather than sitting beside it.
2. **Task relates to specific project files** → write adjacent to that context
3. **No specific context** → write to your session directory

## Session start and end

Other agents may share this Chrome, and so may the user where the MCP attaches to a running browser rather than an `--isolated` profile, so a session works only in a tab it opened.

1. **Start:** call `list_pages`, then open your own tab with `new_page`. The page `new_page`
   opens and selects is yours: record its `pageId` from that result at once, rather than
   picking the newest entry of a later list, which another agent's tab can take. Never select,
   navigate or close a tab you did not open, and pass your `pageId` on every call that takes one.
2. **Width:** set an exact viewport with `emulate`, then confirm it with `evaluate_script`
   returning `window.innerWidth`; a measurement taken at an unconfirmed width is not evidence.
3. **End:** close the `pageId` you recorded with `close_page` before you return, whether the work passed,
   failed or stopped.

## Constraints

- **Use ONLY the chrome-devtools MCP tools for all browser operations.** Never write your own scripts, install packages, or directly connect to Chrome DevTools Protocol. If the MCP tools are not available or failing, report the error — do not work around it.
- If Chrome is not running or DevTools connection fails, report clearly with fix steps (e.g., "Launch Chrome with `--remote-debugging-port=9222`").
- Do not modify project source code unless the task explicitly asks for it.
- Respect other agents' session directories — do not read or write into a session directory you did not create.
