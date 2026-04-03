# Email Drafter — Setup Guide

## Architecture

Each Gmail account needs its own Apps Script deployment. Each deployment gets:
- Its own URL
- Its own API key(s) in Script Properties (supports multiple machines)
- Its own `to`/`cc` recipients (set via `configure` or Script Properties UI)
- Optionally, a `labelName` for label-gated read/reply access

Config lives at `~/.config/email-drafter/config.env`:

```env
# Default profile (used when --profile is omitted and only one exists)
EMAIL_DRAFTER_DEFAULT_PROFILE=personal

# Profile: personal
EMAIL_DRAFTER_PROFILE_personal_URL=https://script.google.com/macros/s/.../exec
EMAIL_DRAFTER_PROFILE_personal_KEY=<hex-key>

# Profile: work (optional second account)
EMAIL_DRAFTER_PROFILE_work_URL=https://script.google.com/macros/s/.../exec
EMAIL_DRAFTER_PROFILE_work_KEY=<hex-key>
```

## First-Time Setup

### Step 1: Generate an API key

```bash
openssl rand -hex 32
```

Save this — you'll need it for both Script Properties and config.env.

### Step 2: Create the PATH shim

The CLI needs to be on PATH. Create a wrapper script:

**macOS/Linux:**
```bash
cat > ~/bin/email-draft << 'EOF'
#!/bin/bash
exec node "/path/to/email-draft-expert/publish.mjs" "$@"
EOF
chmod +x ~/bin/email-draft
```

**Windows (Git Bash):**
```bash
cat > ~/bin/email-draft << 'EOF'
#!/bin/bash
exec node "/d/path/to/email-draft-expert/publish.mjs" "$@"
EOF
chmod +x ~/bin/email-draft
```

### Step 3: Create the config directory

```bash
mkdir -p ~/.config/email-drafter
cat > ~/.config/email-drafter/config.env << 'EOF'
EMAIL_DRAFTER_DEFAULT_PROFILE=personal
EMAIL_DRAFTER_PROFILE_personal_URL=
EMAIL_DRAFTER_PROFILE_personal_KEY=<paste-your-hex-key>
EOF
```

### Step 4: Deploy the Apps Script

Show the user `apps-script.js` (in this skill's directory) and instruct them to:

1. Go to https://script.google.com/home
2. Create new project → name it "Email Drafter"
3. Replace `Code.gs` contents with `apps-script.js`
4. Save (Ctrl+S)
5. Deploy → New deployment → Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the deployment URL

### Step 5: Enable Gmail Advanced Service (for draft management)

If you want to use draft management features (list-drafts, read-draft, edit, attach, detach):

1. In the Apps Script editor, click **Services** (+ icon) in the left sidebar
2. Find **Gmail API** in the list and click **Add**
3. Keep the default identifier (`Gmail`) — the code expects this exact name

This is optional — skip if you only need basic draft creation and label-gated reading.

### Step 6: Set Script Properties

In the Apps Script editor:
1. Click **Project Settings** (gear icon) in the left sidebar
2. Scroll to **Script Properties**
3. Add the following properties:

| Property | Value | Required |
|----------|-------|----------|
| `apiKeys` | `{"<your-hex-key>":"desktop"}` | Yes |
| `to` | `you@example.com` | For draft action |
| `labelName` | `leah-read` (or your label name) | For read/reply features |
| `draftLabelName` | `ai-drafts` (or your label name) | For draft management features |
| `cc` | `archive@example.com` | Optional |
| `defaultSubject` | `Draft` | Optional (defaults to "Draft") |
| `maxResults` | `25` | Optional (defaults to 25) |

The `apiKeys` value must be valid JSON. Use the key you generated in Step 1.

**Alternative:** Set non-sensitive config remotely after the URL is saved:
```bash
email-draft configure --profile personal --to "you@example.com"
```

### Step 7: Save the URL

```bash
sed -i "s|^EMAIL_DRAFTER_PROFILE_personal_URL=$|EMAIL_DRAFTER_PROFILE_personal_URL=<paste-url>|" ~/.config/email-drafter/config.env
```

### Step 8: Test

Test the full chain (shim → wrapper → publish.mjs → gateway):
```bash
email-draft --help 2>&1 | head -1
# Expected: "Usage:"
```

Test the gateway:
```bash
source ~/.config/email-drafter/config.env
curl -sL "$EMAIL_DRAFTER_PROFILE_personal_URL"
# Expected: {"status":"ok","version":"3.3.0"}
# With label: {"status":"ok","version":"3.3.0","label":"leah-read","draftLabel":"ai-drafts"}
```

Test label-gated features (if configured):
```bash
# List labeled threads
email-draft list --profile personal
# Read an entire conversation
email-draft thread --profile personal --id <threadId>
# Download attachments from a specific message
email-draft download --profile personal --id <messageId>
# Draft a reply
echo "Thanks for your message." | email-draft reply --profile personal --id <messageId>
```

Repeat for each Gmail account, using the key generated for that profile.

**Label-gated features:** If you set `labelName`, create that label in Gmail before testing. Messages must have this label for `list`, `read`, and `reply` to work.

## Adding a Machine to an Existing Profile

1. Generate a new API key: `openssl rand -hex 32`
2. In the Apps Script editor: Project Settings → Script Properties → edit `apiKeys` to add the new key
   - e.g., `{"old-key":"desktop","new-key":"laptop"}`
3. Create `~/.config/email-drafter/config.env` on the new machine with the new key and same URL
4. Create the PATH shim on the new machine (Step 2 above)

## Updating the Gateway Code

When `apps-script.js` changes (new features, bug fixes):

```bash
email-draft update --profile personal
```

This checks the remote version, and if stale, copies the latest code to your clipboard. Then:
1. Open the Apps Script editor
2. Select all in Code.gs (Ctrl+A) and paste (Ctrl+V)
3. Save (Ctrl+S)
4. Deploy → Manage deployments → Edit → New version → Deploy

The code is 100% generic — no config in the file. Config lives in Script Properties and is preserved across code updates.

## Updating Config Remotely

Change gateway config without touching Apps Script:

```bash
email-draft configure --profile personal --to "new@example.com"
```

Available flags: `--to`, `--cc`, `--max-results`, `--default-subject`.

`apiKeys`, `labelName`, and `draftLabelName` cannot be set remotely — manage via Script Properties UI for security.

## Upgrading from v2.0 to v2.1

If you have an existing v2.0 deployment with hardcoded CONFIG:

1. Open Apps Script editor → Project Settings → Script Properties
2. Copy your existing CONFIG values into Script Properties:
   - `apiKeys`: `{"your-key":"desktop"}` (JSON format)
   - `to`: your recipient email
   - `labelName`: your label (if using label-gated features)
   - `cc`, `defaultSubject`, `maxResults` as needed
3. Replace Code.gs with the new `apps-script.js` (or use `email-draft update`)
4. Deploy a **new version** (Manage deployments → Edit → New version)

Future code updates will be zero-merge — just paste and deploy.

## Security Model

| Concern | Mitigation |
|---------|-----------|
| Recipients | Defaults to Script Properties config. Caller can override via `--to`/`--cc` |
| Send capability | `GmailApp.createDraft()` only — no send endpoint exists |
| Read capability | Label-gated — only threads with the configured label are visible |
| Draft access | Draft-label-gated — AI can only see/edit drafts labeled with `draftLabelName` |
| Config changes | `configure` uses whitelist — apiKeys, labelName, draftLabelName excluded, manage via UI only |
| Token exposure | None — no OAuth tokens stored locally. Apps Script runs server-side |
| Prompt injection | Worst case: draft with unexpected content to configured recipients. User reviews before sending |
| API key leaked | Can only create drafts / read labeled messages. Rotate key in Script Properties to revoke |
| Kill switch | Disable the Apps Script deployment — instant, 5 seconds |
