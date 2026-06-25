---
tags: [email-draft-expert/creating-drafts]
summary: "Creating Gmail drafts via markdown files with frontmatter recipients, inline images, and dry-run preview."
---

# Creating Drafts

`email-draft` is on PATH. Thirteen actions: `draft` (default), `list`, `thread`, `read`, `reply`, `download`, `list-drafts`, `read-draft`, `edit`, `attach`, `detach`, `configure`, `update`.

## Basic Draft Creation

Pipe or pass a markdown file. Frontmatter sets recipients and subject.

```
---
to: alice@example.com
subject: Hello
---

# Body

This is **markdown**.
```

```bash
email-draft --profile personal draft.md
email-draft --profile personal --subject "Override" draft.md
echo -e "---\nto: alice@example.com\nsubject: Hello\n---\n\nBody" | email-draft --profile personal
```

## Frontmatter Rules

**Frontmatter is NOT YAML** — it's a simple `key: value` regex parser. Never quote or escape subject values. Write them bare:
- `subject: Setting Up "Leah" - Our AI Assistant` (correct)
- `subject: "Setting Up \"Leah\""` (WRONG — quotes and backslashes pass through literally)

**Multiple recipients**: Use separate `to:` and `cc:` lines. Comma-separated addresses in a single `to:` field cause "Invalid To header" errors when using `edit`, `attach`, or `detach` (the MIME rebuild fails):

```
# Correct
to: primary@example.com
cc: secondary@example.com, third@example.com

# Breaks attach/edit — "Invalid To header"
to: primary@example.com, secondary@example.com
```

## Inline Images

Local image references in markdown (`![alt](local-file.png)`) are automatically detected, rewritten to `cid:` references, and attached as inline images after draft creation. URL images are left unchanged.

**Image path resolution**: Paths are resolved relative to **CWD**, not the markdown file. If images are next to the markdown file, `cd` to that directory first:

```bash
# Correct — run from the directory containing both .md and .png
cd path/to/updates/weekly && email-draft --profile work 2026-03-28.md

# Wrong — relative path in markdown won't resolve for cid: inlining
email-draft --profile work path/to/updates/weekly/2026-03-28.md
# Warning: image not found, leaving reference unchanged
```

Use sibling-relative image references in markdown (`![alt](image.png)`) not deep paths (`![alt](path/to/image.png)`).
