# Email Drafter — Troubleshooting

## Checking that the CLI is on PATH

```bash
which email-draft
# Should return a path like ~/bin/email-draft
```

If missing, re-create the shim (see SETUP.md Step 2).

## Common issues

| Symptom | Fix |
|---------|-----|
| `command not found: email-draft` | Create the PATH shim (see SETUP.md Step 2) |
| `Email drafter not configured` | Create `~/.config/email-drafter/config.env` with URL and KEY |
| `Profile "X" not found in config` | Check profile name matches config.env (`EMAIL_DRAFTER_PROFILE_X_URL`) |
| `Multiple profiles configured` | Use `--profile <name>` to specify which profile |
| Health check fails | Redeploy Apps Script or check Google account permissions |
| Draft not appearing | Check Gmail Drafts folder; verify Apps Script execution log at script.google.com |
| `marked` not found | Run `npm install` in the skill directory or delete `node_modules/.package-hash` to force reinstall |

## Label-gated features (v2)

| Symptom | Fix |
|---------|-----|
| `label-gated features not configured` | Set `labelName` in Script Properties via the Apps Script UI |
| `label "x" not found` | Create the label in Gmail first (Labels > Create new label) |
| `access denied — thread does not have label` | The message's thread needs the label. Label it in Gmail first |
| `list` returns empty | No messages have the label — label some messages in Gmail |
| `unknown action: list` | Apps Script is still v1 — update Code.gs with new `apps-script.js` and redeploy |
| `unknown action: thread` | Apps Script needs updating — update Code.gs with latest `apps-script.js` and redeploy |
| Reply draft not threaded | Verify the `messageId` is correct (from `thread` output) |

## Draft management features (v3.0)

| Symptom | Fix |
|---------|-----|
| `draft management features not configured` | Set `draftLabelName` in Script Properties via the Apps Script UI |
| `Gmail is not defined` | Enable Gmail Advanced Service: Apps Script editor → Services (+) → Gmail API → Add |
| `access denied — draft does not have label` | The draft's thread needs the `draftLabelName` label. Only AI-created drafts are auto-labeled |
| `list-drafts` returns empty | No AI-created drafts exist, or `draftLabelName` was set after drafts were created |
| `unknown action: list-drafts` | Apps Script is pre-v3.0 — update Code.gs with new `apps-script.js` and redeploy |
| `File too large` | Attachments are limited to 15MB per file |
| Attachment upload is slow | Files >10MB trigger a warning. Consider compressing or splitting |

## Configure action (v2.1)

| Symptom | Fix |
|---------|-----|
| `no configurable fields provided` | Pass at least one flag: `--to`, `--cc`, `--max-results`, `--default-subject` |
| `unknown action: configure` | Gateway is pre-v2.1. Run `email-draft update` to get the latest code |
| `unauthorized` | API key mismatch. Check `apiKeys` in Script Properties matches your config.env KEY |
| Want to change apiKeys or labelName | Edit Script Properties directly in Apps Script UI — cannot be set via `configure` for security |

## Update action (v2.1)

| Symptom | Fix |
|---------|-----|
| `Could not read GATEWAY_VERSION` | Local `apps-script.js` is corrupt or missing the version constant |
| `Could not copy to clipboard` | Clipboard tool not available. Manually copy from the file path shown in the error |
| Version shows "unknown" | Remote gateway is pre-v2.1 (no version in GET response). Update manually |
| "Gateway is up to date" but behavior differs | Same version but different code — force update by copying `apps-script.js` manually |

## Thread and download caching

| Symptom | Fix |
|---------|-----|
| Stale thread data | Use `--refresh` to bypass cache |
| Stale attachment data | Use `--refresh` to re-download |
| Cache location | `~/.cache/email-drafter/{profile}/` |
| Clear all cache | `rm -rf ~/.cache/email-drafter/{profile}/` |
| Thread cached but new messages added | Use `--refresh` — thread content may have changed if new replies arrived |

## Download / attachment extraction

| Symptom | Fix |
|---------|-----|
| `No MIME boundary` | Single-part message (plain text or HTML only) — no attachments to extract |
| `No attachments found` | Message has MIME parts but none have `Content-Disposition: attachment` or `filename` |
| Attachment is corrupted | Check `Content-Transfer-Encoding` — the parser handles `base64` and `quoted-printable` |
| Large message timeout | Apps Script has a 30s execution limit. Very large attachments may exceed it |
| `.eml` file is empty | Gateway returned empty `raw` — check Apps Script execution logs |
| `unknown action: raw` | Apps Script needs updating — update Code.gs with latest `apps-script.js` and redeploy |

## Checking Apps Script logs

1. Open https://script.google.com/home
2. Open the Email Drafter project
3. Click **Executions** in the left sidebar
4. Check for errors in recent executions

## Checking gateway version

```bash
source ~/.config/email-drafter/config.env
curl -sL "$EMAIL_DRAFTER_PROFILE_personal_URL"
```

- v1: `{"status":"ok","version":"1.0"}`
- v2.0 (draft-only): `{"status":"ok","version":"2.0"}`
- v2.0 (with label): `{"status":"ok","version":"2.0","label":"leah-read"}`
- v2.1: `{"status":"ok","version":"2.1"}`
- v2.1 (with label): `{"status":"ok","version":"2.1","label":"leah-read"}`
- v3.0: `{"status":"ok","version":"3.0"}`
- v3.0 (with labels): `{"status":"ok","version":"3.0","label":"leah-read","draftLabel":"ai-drafts"}`
- v3.3.0: `{"status":"ok","version":"3.3.0"}`
- v3.3.0 (with labels): `{"status":"ok","version":"3.3.0","label":"leah-read","draftLabel":"ai-drafts"}`

## Script Properties reference

All config lives in Script Properties (Apps Script editor > Project Settings > Script Properties):

| Property | Purpose | Editable via `configure` |
|----------|---------|--------------------------|
| `apiKeys` | JSON map of API keys to labels | No (UI only) |
| `labelName` | Gmail label for read access | No (UI only) |
| `draftLabelName` | Gmail label for AI draft access | No (UI only) |
| `to` | Default recipients | Yes (`--to`) |
| `cc` | Default CC recipients | Yes (`--cc`) |
| `defaultSubject` | Fallback subject | Yes (`--default-subject`) |
| `maxResults` | Max list results | Yes (`--max-results`) |
