---
tags: [email-draft-expert/caching]
summary: "Transparent cache layout and invalidation rules for thread, download, and draft-raw operations."
---

# Caching

Transparent cache at `~/.cache/email-drafter/{profile}/`:

| Cache path | What is cached |
|-----------|----------------|
| `threads/{threadId}/thread.json` | Cached thread responses |
| `messages/{messageId}/` | Raw `.eml` + extracted attachments + `meta.json` |
| `draft-raw/{draftId}/` | Raw MIME + metadata for client-side edit/attach/detach (invalidated by messageId change) |

- `list` is never cached (it's the "what's pending" check)
- `--refresh` busts cache for `thread` and `download`
