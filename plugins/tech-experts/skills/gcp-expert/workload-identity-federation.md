---
tags: [gcp-expert/security]
summary: Workload Identity Federation (WIF) keyless authentication for CI/CD — GitHub Actions example, benefits over JSON key files, and local dev limitations.
---

# Workload Identity Federation (Keyless Auth)

For CI/CD pipelines and cloud workloads, prefer WIF over downloaded keys.

## GitHub Actions Example

```yaml
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: 'projects/PROJECT_NUM/locations/global/workloadIdentityPools/POOL/providers/PROVIDER'
    service_account: 'sa-name@project.iam.gserviceaccount.com'
```

Benefits:
- No long-lived keys to manage or rotate
- Short-lived tokens (1 hour, auto-refreshed)
- Identity mapped from external provider (GitHub, Azure AD, AWS)
- Audit trail in Cloud Audit Logs

For local CLI development, WIF is not practical — use service account key files with the security practices in [security-best-practices.md](security-best-practices.md).
