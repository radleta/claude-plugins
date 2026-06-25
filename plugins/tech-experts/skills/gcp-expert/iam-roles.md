---
tags: [gcp-expert/iam]
summary: IAM roles for GCP service accounts and least-privilege principles — role reference table and guidance for Google Sheets API access.
---

# IAM Roles and Least Privilege

| Role | Permissions | Use When |
|------|-------------|----------|
| `roles/viewer` | Read-only project access | Minimal project-level access |
| `roles/iam.serviceAccountTokenCreator` | Generate tokens | Service account impersonation |
| `roles/iam.serviceAccountUser` | Act as service account | Attaching SA to resources |

For Google Sheets API specifically, IAM roles are secondary — access is controlled by sharing the spreadsheet with the service account email. No project-level Sheets role is needed.

Principle of least privilege:
- Create dedicated service accounts per application or function
- Grant only the scopes and roles each account needs
- Prefer `SpreadsheetsReadonly` scope over `Spreadsheets` when possible
- Review and audit permissions periodically
