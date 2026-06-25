---
tags: [email-draft-expert/code-updates]
summary: "Checking if the Apps Script gateway needs updating and deploying the latest code (v2.1)."
---

# Code Updates (v2.1)

Check if the gateway needs updating and copy the latest code to clipboard for paste-and-deploy.

```bash
email-draft update --profile personal
# If up to date: "Gateway [personal] is up to date (v2.1)."
# If stale: copies apps-script.js to clipboard with paste instructions
```

The code is 100% generic — no config in the file. Paste replaces the entire Code.gs with no merge needed.
