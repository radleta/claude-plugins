---
name: email-draft-expert
description: "Manages Gmail drafts and reads label-gated emails via Apps Script gateway. Use when creating Gmail drafts, reading labeled emails, drafting replies to specific messages, downloading attachments, or invoking /email-drafter — even for simple 'draft an email' requests."
---

# Email Drafter

`email-draft` is on PATH. Thirteen actions: `draft` (default), `list`, `thread`, `read`, `reply`, `download`, `list-drafts`, `read-draft`, `edit`, `attach`, `detach`, `configure`, `update`.

## Creating Drafts

Pipe or pass a markdown file. Frontmatter sets recipients and subject.

    ---
    to: alice@example.com
    subject: Hello
    ---

    # Body

    This is **markdown**.

```bash
email-draft --profile personal draft.md
email-draft --profile personal --subject "Override" draft.md
echo -e "---\nto: alice@example.com\nsubject: Hello\n---\n\nBody" | email-draft --profile personal
```

**Frontmatter is NOT YAML** — it's a simple `key: value` regex parser. Never quote or escape subject values. Write them bare:
- `subject: Setting Up "Leah" - Our AI Assistant` (correct)
- `subject: "Setting Up \"Leah\""` (WRONG — quotes and backslashes pass through literally)

**Multiple recipients**: Use separate `to:` and `cc:` lines. Comma-separated addresses in a single `to:` field cause "Invalid To header" errors when using `edit`, `attach`, or `detach` (the MIME rebuild fails):

```
# ✅ Correct
to: primary@example.com
cc: secondary@example.com, third@example.com

# ❌ Breaks attach/edit — "Invalid To header"
to: primary@example.com, secondary@example.com
```

## Label-Gated Email Access (v2)

Profiles with a configured label can list, read, and reply to labeled messages. Humans control what the agent sees by labeling messages in Gmail.

### List labeled threads

```bash
email-draft list --profile support
```

Returns JSON array of thread summaries (threadId, subject, messageCount, participants, lastDate, snippet, hasAttachments, isUnread). Always fresh — never cached.

### Read an entire conversation

```bash
email-draft thread --profile support --id <threadId>
email-draft thread --profile support --id <threadId> --refresh
```

Returns all messages in chronological order with plain text bodies and attachment metadata. **Cached** — repeat calls return instantly from `~/.cache/email-drafter/{profile}/threads/`. Use `--refresh` to bust cache.

### Read a single message

```bash
email-draft read --profile support --id <messageId>
```

Returns JSON with full message body. Not cached. Use `thread` instead for most workflows.

### Draft a reply

```bash
echo "Thanks for reaching out..." | email-draft reply --profile support --id <messageId>
email-draft reply --profile support --id <messageId> reply.md
email-draft reply --profile support --id <messageId> --reply-sender-only reply.md
```

Creates a threaded draft reply. Uses reply-all by default; `--reply-sender-only` replies to sender only.

### Download attachments

```bash
email-draft download --profile support --id <messageId>
email-draft download --profile support --id <messageId> -o /tmp/email-out
email-draft download --profile support --id <messageId> --refresh
```

Downloads full RFC 2822 message, saves `.eml`, and extracts MIME attachments. Duplicate filenames are deduplicated (`image.png`, `image_2.png`, `image_3.png`). **Cached** — defaults to `~/.cache/email-drafter/{profile}/messages/{messageId}/`. Use `-o` to override output dir. Returns JSON with file paths.

### Efficient agent workflow (3 calls per conversation)

```bash
# 1. See all pending threads (always fresh)
email-draft list --profile support

# 2. Read full conversation (cached after first fetch)
email-draft thread --profile support --id <threadId>
# → check attachment metadata in response

# 2b. Download attachments if needed (cached)
email-draft download --profile support --id <messageId>
# → files extracted to ~/.cache/email-drafter/support/messages/<id>/

# 3. Draft reply
echo "reply body" | email-draft reply --profile support --id <messageId>
# → Human reviews in Gmail Drafts and sends
```

## Draft Management (v3.0)

AI-created drafts are labeled with `draftLabelName` for scoped access. Requires Gmail Advanced Service enabled in Apps Script editor and `draftLabelName` set in Script Properties.

### List AI-created drafts

```bash
email-draft list-drafts --profile personal
```

Returns JSON array of drafts with draftId, subject, snippet, hasAttachments. Only shows drafts labeled with `draftLabelName`.

### Read a draft

```bash
email-draft read-draft --profile personal --id <draftId>
```

Returns full draft content (HTML body, recipients, subject) plus attachment list with filenames and content IDs.

### Edit a draft

```bash
email-draft edit --profile personal --id <draftId> --subject "New Subject"
email-draft edit --profile personal --id <draftId> --to "new@example.com" --cc "cc@example.com"
email-draft edit --profile personal --id <draftId> updated-body.md
```

Update subject, recipients, or body of an existing draft. Uses replace semantics — existing attachments are preserved.

### Attach files

```bash
email-draft attach --profile personal --id <draftId> document.pdf
email-draft attach --profile personal --id <draftId> report.pdf slides.pptx logo.png
email-draft attach --profile personal --id <draftId> --content-id logo logo.png report.pdf
```

Add one or more attachments to an existing draft in a single call. Multiple files are parsed, added, and rebuilt in one MIME operation. Use `--content-id <cid>` before a file for inline images (applies to the next file only). Max 15MB per file.

### Remove an attachment

```bash
email-draft detach --profile personal --id <draftId> --filename document.pdf
```

Remove an attachment by filename from an existing draft.

### Inline images in markdown

Local image references in markdown (`![alt](local-file.png)`) are automatically detected, rewritten to `cid:` references, and attached as inline images after draft creation. URL images are left unchanged.

**Image path resolution**: Paths are resolved relative to **CWD**, not the markdown file. If images are next to the markdown file, `cd` to that directory first:

```bash
# ✅ Correct — run from the directory containing both .md and .png
cd path/to/updates/weekly && email-draft --profile work 2026-03-28.md

# ❌ Wrong — relative path in markdown won't resolve for cid: inlining
email-draft --profile work path/to/updates/weekly/2026-03-28.md
# → Warning: image not found, leaving reference unchanged
```

Use sibling-relative image references in markdown (`![alt](image.png)`) not deep paths (`![alt](path/to/image.png)`).

### Dry-run preview

```bash
email-draft edit --profile personal --id <draftId> --dry-run --subject "New Subject"
email-draft attach --profile personal --id <draftId> --dry-run file1.pdf file2.pdf
email-draft detach --profile personal --id <draftId> --dry-run --filename old.pdf
```

Preview what would change without updating the draft. Shows before/after diff for subject, recipients, body length, and attachments added/removed.

### Draft workflow (create → review → edit → send)

```bash
# 1. Create draft with inline images
email-draft --profile personal draft-with-images.md

# 2. List AI drafts to find the draftId
email-draft list-drafts --profile personal

# 3. Read draft to review
email-draft read-draft --profile personal --id <draftId>

# 4. Edit if needed (preview first with --dry-run)
email-draft edit --profile personal --id <draftId> --dry-run --subject "Updated Subject"
email-draft edit --profile personal --id <draftId> --subject "Updated Subject"

# 5. Attach additional files (batch)
email-draft attach --profile personal --id <draftId> report.pdf slides.pptx

# 6. Human reviews in Gmail and sends
```

## Remote Configuration (v2.1)

Update gateway config without touching Apps Script code. apiKeys are excluded — manage those via the Apps Script UI.

```bash
email-draft configure --profile personal --to "leah@example.com"
email-draft configure --profile personal --cc "archive@example.com" --max-results 50
```

Configurable fields: `--to`, `--cc`, `--max-results`, `--default-subject`. `apiKeys`, `labelName`, and `draftLabelName` are excluded — manage via Script Properties UI only.

## Code Updates (v2.1)

Check if the gateway needs updating and copy the latest code to clipboard for paste-and-deploy.

```bash
email-draft update --profile personal
# If up to date: "Gateway [personal] is up to date (v2.1)."
# If stale: copies apps-script.js to clipboard with paste instructions
```

The code is 100% generic — no config in the file. Paste replaces the entire Code.gs with no merge needed.

## Caching

Transparent cache at `~/.cache/email-drafter/{profile}/`:
- `threads/{threadId}/thread.json` — cached thread responses
- `messages/{messageId}/` — raw `.eml` + extracted attachments + `meta.json`
- `draft-raw/{draftId}/` — raw MIME + metadata for client-side edit/attach/detach (invalidated by messageId change)
- `list` is never cached (it's the "what's pending" check)
- `--refresh` busts cache for `thread` and `download`

## Security Model

| Boundary | Enforcement |
|----------|-------------|
| Write | Drafts only — `createDraft()` and `createDraftReply()`, no send |
| Read | Label-gated — only threads with the configured label are visible |
| Draft access | Draft-label-gated — AI can only see/edit drafts labeled with `draftLabelName` |
| Config | `configure` action uses whitelist — cannot modify apiKeys, labelName, or draftLabelName remotely |
| Auth | API key per machine, stored in Script Properties, revocable individually |
| Tokens | None stored locally — Apps Script runs server-side |
| Kill switch | Disable the Apps Script deployment (instant) |

## Backward Compatibility

- v1 Apps Script deployments (no `labelName` configured) still work — `draft` action only
- v1 payloads (no `action` field) are treated as `draft`
- `list`, `thread`, `read`, `reply`, `download` require `labelName` to be set in Script Properties
- `raw` is accepted as an alias for `download`
- v2.1: all config moved to Script Properties — code file is generic
- v3.0: `list-drafts`, `read-draft`, `edit`, `attach`, `detach` require `draftLabelName` + Gmail Advanced Service enabled
- v3.0: `draft` and `reply` now return `draftId` in response and label drafts with `draftLabelName` (if configured)
- v3.3: `edit`, `attach`, `detach` use client-side MIME rebuild (postal-mime + mimetext) with version-gated fallback to server-side for gateway < 3.3
- v3.3: new gateway actions `draft-raw`, `draft-meta`, `raw-update` for lightweight MIME fetch/update
