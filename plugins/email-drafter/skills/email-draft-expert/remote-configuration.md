---
tags: [email-draft-expert/remote-configuration]
summary: "Updating gateway config remotely via CLI without touching Apps Script code (v2.1)."
---

# Remote Configuration (v2.1)

Update gateway config without touching Apps Script code. `apiKeys` are excluded — manage those via the Apps Script UI.

```bash
email-draft configure --profile personal --to "leah@example.com"
email-draft configure --profile personal --cc "archive@example.com" --max-results 50
```

Configurable fields: `--to`, `--cc`, `--max-results`, `--default-subject`. `apiKeys`, `labelName`, and `draftLabelName` are excluded — manage via Script Properties UI only.

## Security Boundary

`apiKeys` controls authentication (adding keys = granting access). `labelName` controls read scope (changing it to a well-known label like INBOX = reading all email). `draftLabelName` controls draft access scope. All three are intentionally excluded from the `configure` whitelist and can only be managed through the Apps Script UI, requiring Google account authentication.
