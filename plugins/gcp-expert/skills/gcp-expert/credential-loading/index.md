---
tags: [gcp-expert/auth]
summary: Navigation hub for GCP credential loading patterns in .NET/C# — covers file, stream, ADC, and JSON string approaches.
---

# Credential Loading Patterns

Four patterns for loading Google credentials in .NET/C# applications. Choose based on how the credential is delivered at runtime.

## Pages
- [From JSON Key File](from-file.md) — Load credential from a known file path (CLI tools)
- [From Stream](from-stream.md) — Load from a stream (embedded resource, secret manager)
- [Application Default Credentials](adc.md) — Environment-portable credential resolution
- [From JSON String](from-json.md) — Load from an environment variable or secret store string
