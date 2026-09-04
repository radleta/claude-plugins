---
tags: [email-draft-expert/label-gated-access]
summary: "Reading and replying to label-gated emails: list threads, read conversations, download attachments, draft replies."
---

# Label-Gated Email Access (v2)

Profiles with a configured label can list, read, and reply to labeled messages. Humans control what the agent sees by labeling messages in Gmail.

## List Labeled Threads

```bash
email-draft list --profile support
```

Returns JSON array of thread summaries (threadId, subject, messageCount, participants, lastDate, snippet, hasAttachments, isUnread). Always fresh — never cached.

## Read an Entire Conversation

```bash
email-draft thread --profile support --id <threadId>
email-draft thread --profile support --id <threadId> --refresh
```

Returns all messages in chronological order with plain text bodies and attachment metadata. **Cached** — repeat calls return instantly from `~/.cache/email-drafter/{profile}/threads/`. Use `--refresh` to bust cache.

## Read a Single Message

```bash
email-draft read --profile support --id <messageId>
```

Returns JSON with full message body. Not cached. Use `thread` instead for most workflows.

## Draft a Reply

```bash
echo "Thanks for reaching out..." | email-draft reply --profile support --id <messageId>
email-draft reply --profile support --id <messageId> reply.md
email-draft reply --profile support --id <messageId> --reply-sender-only reply.md
```

Creates a threaded draft reply. Uses reply-all by default; `--reply-sender-only` replies to sender only.

The draft body includes the quoted original (v3.6.0+): the new reply text appears first, followed by a Gmail-style attribution line (`On <date>, <sender> wrote:`) and a `<blockquote class="gmail_quote">` wrapping the original message body — matching the appearance of a native Gmail reply.

## Download Attachments

```bash
email-draft download --profile support --id <messageId>
email-draft download --profile support --id <messageId> -o /tmp/email-out
email-draft download --profile support --id <messageId> --refresh
```

Downloads full RFC 2822 message, saves `.eml`, and extracts MIME attachments. Duplicate filenames are deduplicated (`image.png`, `image_2.png`, `image_3.png`). **Cached** — defaults to `~/.cache/email-drafter/{profile}/messages/{messageId}/`. Use `-o` to override output dir. Returns JSON with file paths.

## Efficient Agent Workflow (3 Calls per Conversation)

```bash
# 1. See all pending threads (always fresh)
email-draft list --profile support

# 2. Read full conversation (cached after first fetch)
email-draft thread --profile support --id <threadId>
# check attachment metadata in response

# 2b. Download attachments if needed (cached)
email-draft download --profile support --id <messageId>
# files extracted to ~/.cache/email-drafter/support/messages/<id>/

# 3. Draft reply
echo "reply body" | email-draft reply --profile support --id <messageId>
# Human reviews in Gmail Drafts and sends
```
