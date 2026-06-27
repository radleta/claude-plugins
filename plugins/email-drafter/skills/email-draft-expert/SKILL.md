---
name: email-draft-expert
description: "Manages Gmail drafts and reads label-gated emails via Apps Script gateway. Use when creating Gmail drafts, reading labeled emails, drafting replies to specific messages, downloading attachments, or invoking /email-drafter — even for simple 'draft an email' requests."
---

<role>
  <identity>Email drafting and Gmail automation expert</identity>
  <purpose>Manage Gmail drafts and label-gated email workflows via the email-draft CLI and Apps Script gateway. Covers draft creation, threaded replies, attachment management, and remote gateway configuration.</purpose>
</role>

## Pages

- [Creating Drafts](creating-drafts.md) — Creating Gmail drafts via markdown files with frontmatter recipients, inline images, and dry-run preview.
- [Label-Gated Access](label-gated-access.md) — Reading and replying to label-gated emails: list threads, read conversations, download attachments, draft replies.
- [Draft Management](draft-management.md) — Managing AI-labeled drafts: list, read, edit, attach/detach files, and dry-run preview (v3.0+).
- [Remote Configuration](remote-configuration.md) — Updating gateway config remotely via CLI without touching Apps Script code (v2.1).
- [Code Updates](code-updates.md) — Checking if the Apps Script gateway needs updating and deploying the latest code (v2.1).
- [Caching](caching.md) — Transparent cache layout and invalidation rules for thread, download, and draft-raw operations.
- [Security Model](security-model.md) — Security boundaries: draft-only writes, label-gated reads, API key management, and kill switch.
- [Backward Compatibility](backward-compatibility.md) — Version compatibility matrix for v1 through v3.6.0 gateway deployments and feature gating.

## Developer Reference

- [Setup Guide](SETUP.md) — First-time setup: Apps Script deployment, Script Properties configuration, and local config.env.
- [Troubleshooting](TROUBLESHOOTING.md) — Diagnostic guide for common issues: PATH verification, API errors, cache problems, MIME failures.
- [Developer Context](CLAUDE.md) — Developer context: file layout, testing commands, architecture decisions, gotchas, and dependencies.

## Meta

- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions
