# CLAUDE.md — email-draft-expert developer context

## File Layout

| File | Purpose |
|------|---------|
| `SKILL.md` | Agent-facing skill (auto-discovered by Claude Code) |
| `publish.mjs` | CLI entry point — 13 actions, arg parsing, caching, gateway client |
| `lib/mime.mjs` | MIME parsing via `postal-mime` and building via `mimetext` (attachments, draft state, round-trip rebuild) |
| `apps-script.js` | Google Apps Script gateway — deploy as Web App, not run locally |
| `email-draft` | Shell wrapper on PATH (calls `node publish.mjs`) |
| `SETUP.md` | First-time setup instructions (Apps Script deploy, Script Properties, config.env) |
| `TROUBLESHOOTING.md` | Diagnostic guide for common issues |
| `test/mime.test.mjs` | MIME parser, builder, and round-trip tests |
| `test/gateway.test.mjs` | GAS gateway handler tests (vm-based with mocked globals) |
| `test/cli.test.mjs` | CLI integration tests with mock HTTP server |

## Testing

```bash
npm test                             # Run all tests
node --test test/mime.test.mjs       # MIME parser/builder only
node --test test/gateway.test.mjs    # GAS gateway handlers only
node --test test/cli.test.mjs        # CLI integration only
```

- Uses `node:test` + `node:assert/strict` — zero test dependencies
- CLI tests spin up a real HTTP server to mock the Apps Script gateway
- CLI tests use temp dirs for config and cache isolation
- Gateway tests load `apps-script.js` into a `node:vm` context with mocked GAS globals (Gmail, GmailApp, etc.) to test actual handler logic

## Architecture Decisions

**Config in Script Properties (v2.1)** — All config (including apiKeys) lives in Google Apps Script Script Properties, not in the code file. This means `apps-script.js` is 100% generic — code updates are a clean paste-and-deploy with zero merge. The `configure` CLI action can update most properties remotely, but `apiKeys` is excluded from the whitelist (human-managed via Apps Script UI only).

**Thread-oriented design** — The CLI was designed around `list → thread → reply` to minimize agent turns. `list` returns thread summaries (not full bodies) to keep token usage low during triage. `thread` returns the full conversation in one call. This gets an email workflow done in 3 CLI calls instead of N+1.

**Transparent caching** — `thread` and `download` cache to `~/.cache/email-drafter/{profile}/` so repeat access in the same session (or across sessions) is free. `list` is never cached because it's the "what's new" check. `--refresh` busts cache when needed.

**Filename deduplication in download** — When multiple attachments share the same filename (common with inline images named `image.png`), the download action appends `_2`, `_3`, etc. before the extension so all files are preserved on disk.

**MIME parsing via `postal-mime`** — The `download` action parses raw RFC 2822 messages client-side to extract attachments without another round-trip. Originally a custom single-level boundary parser; replaced with `postal-mime` (by Andris Reinman, Nodemailer author) to handle nested multipart structures like `multipart/related` wrapping `multipart/mixed`.

**Apps Script gateway pattern** — No OAuth tokens stored on client. The Apps Script runs server-side with the user's Gmail permissions. Client only needs a URL + API key. Kill switch = disable the deployment.

**Frontmatter is regex, not YAML** — Intentionally simple `key: value` parser. Avoids YAML dependency and the quoting/escaping gotchas that come with it. Downside: values are always strings, no arrays.

**apiKeys and labelName security boundary** — The `configure` action whitelist explicitly excludes `apiKeys`, `labelName`, and `draftLabelName`. `apiKeys` controls authentication (adding keys = granting access). `labelName` controls read scope (changing it to a well-known label like INBOX = reading all email). `draftLabelName` controls draft access scope. All three can only be managed through the Apps Script UI, requiring Google account authentication.

**Draft label gating (v3.0)** — AI-created drafts are auto-labeled with `draftLabelName` (set in Script Properties). `list-drafts`, `read-draft`, `edit`, `attach`, and `detach` only operate on drafts whose thread has this label. This prevents AI from seeing or modifying the user's manual drafts.

**Client-side MIME rebuild (v3.3)** — `edit`, `attach`, and `detach` now parse and rebuild MIME client-side using `postal-mime` (parsing) and `mimetext` (building) in `lib/mime.mjs`. The gateway provides three lightweight actions: `draft-raw` (fetch raw MIME + metadata), `draft-meta` (metadata only for cache validation), and `raw-update` (accept pre-built MIME). This eliminates GAS 30-second timeout risk for large drafts. A `messageId`-based cache in `~/.cache/email-drafter/{profile}/draft-raw/` avoids redundant fetches. Version-gated fallback: gateway >= 3.3 uses client-side flow, < 3.3 falls back to the original server-side `buildMimeMessage_()`.

**MIME header injection prevention** — Both server-side (`sanitizeHeaderValue_()` in GAS) and client-side (`sanitizeHeader()` in `lib/mime.mjs`) strip `\r\n` (prevents header injection) and replace `"` with `'` (prevents quote escaping in filenames/Content-IDs). Applied to all user-controlled values embedded in MIME headers: To, Cc, From, Subject, filenames, and Content-IDs.

**Batch attach (v3.3)** — Multiple files can be attached in a single `attach` call (`email-draft attach --id <draftId> file1.pdf file2.pdf`). Client-side MIME rebuild parses once, adds all attachments, rebuilds once, and updates once. `--content-id <cid>` applies to the next positional file only, then resets — allowing interspersed inline images (`--content-id logo logo.png report.pdf`). Gateway < 3.3 falls back to sequential server-side `attach` calls. Inline images in markdown are auto-detected and attached with `cid:` references after the draft is created.

## Gotchas

**Node test runner glob** — `node --test test/` (directory path) fails with MODULE_NOT_FOUND on Node 24. Use `node --test test/*.test.mjs` instead.

**Apps Script `var` usage** — The gateway uses `var` throughout for GAS V8 runtime compatibility. `let`/`const` work in modern GAS but `var` is safer across all deployment targets.

## Dependencies

| Dependency | Purpose |
|------------|---------|
| `marked` | Markdown-to-HTML conversion for draft/reply bodies |
| `mimetext` | RFC 5322 MIME message building for client-side draft reconstruction |
| `postal-mime` | RFC 2822 MIME parsing for attachment extraction and draft state parsing |

Everything else is Node builtins (`fs`, `path`, `http`, `child_process`, `url`, `node:test`).
