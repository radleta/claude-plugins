---
tags: [email-draft-expert/draft-management]
summary: "Managing AI-labeled drafts: list, read, edit, attach/detach files, and dry-run preview (v3.0+)."
---

# Draft Management (v3.0)

AI-created drafts are labeled with `draftLabelName` for scoped access. Requires Gmail Advanced Service enabled in Apps Script editor and `draftLabelName` set in Script Properties.

## List AI-Created Drafts

```bash
email-draft list-drafts --profile personal
```

Returns JSON array of drafts with draftId, subject, snippet, hasAttachments. Only shows drafts labeled with `draftLabelName`.

## Read a Draft

```bash
email-draft read-draft --profile personal --id <draftId>
```

Returns full draft content (HTML body, recipients, subject) plus attachment list with filenames and content IDs.

## Edit a Draft

```bash
email-draft edit --profile personal --id <draftId> --subject "New Subject"
email-draft edit --profile personal --id <draftId> --to "new@example.com" --cc "cc@example.com"
email-draft edit --profile personal --id <draftId> updated-body.md
```

Update subject, recipients, or body of an existing draft. Uses replace semantics — existing attachments are preserved.

## Attach Files

```bash
email-draft attach --profile personal --id <draftId> document.pdf
email-draft attach --profile personal --id <draftId> report.pdf slides.pptx logo.png
email-draft attach --profile personal --id <draftId> --content-id logo logo.png report.pdf
```

Add one or more attachments to an existing draft in a single call. Multiple files are parsed, added, and rebuilt in one MIME operation. Use `--content-id <cid>` before a file for inline images (applies to the next file only). Max 15MB per file.

## Remove an Attachment

```bash
email-draft detach --profile personal --id <draftId> --filename document.pdf
```

Remove an attachment by filename from an existing draft.

## Dry-Run Preview

```bash
email-draft edit --profile personal --id <draftId> --dry-run --subject "New Subject"
email-draft attach --profile personal --id <draftId> --dry-run file1.pdf file2.pdf
email-draft detach --profile personal --id <draftId> --dry-run --filename old.pdf
```

Preview what would change without updating the draft. Shows before/after diff for subject, recipients, body length, and attachments added/removed.

## Draft Workflow (Create → Review → Edit → Send)

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
