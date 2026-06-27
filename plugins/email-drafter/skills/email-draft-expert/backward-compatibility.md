---
tags: [email-draft-expert/backward-compatibility]
summary: "Version compatibility matrix for v1 through v3.6.0 gateway deployments and feature gating."
---

# Backward Compatibility

| Version | Notes |
|---------|-------|
| v1 | Apps Script deployments with no `labelName` configured still work — `draft` action only |
| v1 payloads | No `action` field treated as `draft` |
| v2 | `list`, `thread`, `read`, `reply`, `download` require `labelName` to be set in Script Properties |
| v2.1 | All config moved to Script Properties — code file is generic; `raw` accepted as alias for `download` |
| v3.0 | `list-drafts`, `read-draft`, `edit`, `attach`, `detach` require `draftLabelName` + Gmail Advanced Service enabled |
| v3.0 | `draft` and `reply` now return `draftId` in response and label drafts with `draftLabelName` (if configured) |
| v3.3 | `edit`, `attach`, `detach` use client-side MIME rebuild (postal-mime + mimetext) with version-gated fallback to server-side for gateway < 3.3 |
| v3.3 | New gateway actions `draft-raw`, `draft-meta`, `raw-update` for lightweight MIME fetch/update |
| v3.6.0 | `reply` action now appends a Gmail-style quoted original (attribution line + `<blockquote class="gmail_quote">`) to reply drafts; sender address is HTML-escaped via `escapeHtml_()` |
