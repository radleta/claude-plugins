---
tags: [email-draft-expert/security-model]
summary: "Security boundaries: draft-only writes, label-gated reads, API key management, and kill switch."
---

# Security Model

| Boundary | Enforcement |
|----------|-------------|
| Write | Drafts only — `createDraft()` and `createDraftReply()`, no send |
| Read | Label-gated — only threads with the configured label are visible |
| Draft access | Draft-label-gated — AI can only see/edit drafts labeled with `draftLabelName` |
| Config | `configure` action uses whitelist — cannot modify apiKeys, labelName, or draftLabelName remotely |
| Auth | API key per machine, stored in Script Properties, revocable individually |
| Tokens | None stored locally — Apps Script runs server-side |
| Kill switch | Disable the Apps Script deployment (instant) |
| HTML injection | `escapeHtml_()` encodes sender `From:` address before embedding in reply quote block (v3.6.0+) |

## Apps Script Gateway Pattern

No OAuth tokens are stored on the client. The Apps Script runs server-side with the user's Gmail permissions. The client only needs a URL + API key. Kill switch = disable the deployment.
