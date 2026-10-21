---
name: security-verification
description: "OWASP Top 10 security verification methodology with 9 detection categories and attack surface mapping. Use when reviewing code for injection risks, authentication issues, data exposure, or security misconfigurations — even for internal-only endpoints."
---

# Security Verification Methodology

## Detection Categories

**injection**: Code vulnerable to injection attacks
- String concatenation in SQL queries
- Template literals in SQL without parameterization
- innerHTML with user input
- dangerouslySetInnerHTML with unsanitized data
- document.write with user data
- exec/spawn with user input
- Shell commands with string interpolation
- File paths with user input without validation
- LDAP queries with unsanitized input
- Template engines with user-controlled templates

**authentication**: Authentication and session security issues
- Hardcoded credentials or API keys
- Weak password requirements
- Missing authentication on sensitive endpoints
- Insecure session management
- Missing CSRF protection
- Broken access control (missing authorization checks)
- JWT without proper validation
- Tokens stored in localStorage (vulnerable to XSS)

**data-exposure**: Sensitive data exposure risks
- Logging sensitive data (passwords, tokens, PII)
- Error messages exposing internal details
- Sensitive data in URLs/query strings
- Missing encryption for sensitive data at rest
- Sensitive data transmitted without TLS
- API responses including unnecessary sensitive fields
- Debug mode enabled in production code

**input-validation**: Missing or insufficient input validation
- User input used without validation
- Missing length limits on string inputs
- Missing type checking on inputs
- Regex patterns vulnerable to ReDoS
- File upload without type/size validation
- Missing URL validation for redirects
- Integer overflow potential

**cryptography**: Weak or incorrect cryptographic practices
- Use of weak algorithms (MD5, SHA1 for security)
- Hardcoded encryption keys
- Predictable random values for security
- Missing salt for password hashing
- ECB mode encryption
- Insufficient key length

**configuration**: Security misconfiguration
- Debug mode or verbose errors in production
- Default credentials not changed
- Unnecessary features enabled
- Missing security headers (CSP, X-Frame-Options, etc.)
- CORS misconfiguration (wildcard origins)
- Insecure cookie settings (missing Secure, HttpOnly)
- Exposed admin interfaces

**dependencies**: Vulnerable dependencies and components
- Known vulnerable dependencies
- Outdated packages with security patches available
- Unnecessary dependencies increasing attack surface
- Dependencies from untrusted sources

**logging-failures**: Insufficient logging that hinders incident response (OWASP A09)
- Swallowed exceptions: `catch` blocks that discard the exception without logging (bare `catch {}`, `catch (Exception) { }`, `catch (Exception ex)` using only `ex.Message` without logging the full exception). Full exception objects must reach observability tools (Application Insights, Sentry, etc.)
- Security-relevant events not logged (failed auth, access denied, input validation failures)
- Missing correlation IDs for request tracing
- Log injection via unsanitized user input in log messages (use structured logging parameters, not string interpolation)

**security-invariants-honored**: Security-relevant spec invariants have no enforcement
- For each invariant in `## Invariants` containing security keywords (PII, token, secret, credential, expire, audit, log, permission, role, deny), verify the invariant is honored across all code paths
- Examples: "no PII logged" → check all logger call sites; "tokens expire within N seconds" → check token creation + validation TTL; "admin actions audit-logged" → check all admin handlers
- Conditional: runs only when `## Invariants` is present, non-empty, and contains security-relevant keywords
- Anti-pattern: security invariants documented in spec but no code path enforces them

## OWASP Top 10 Coverage

Ensure analysis addresses all ten categories, even where this skill's named Detection
Categories above don't use OWASP numbering directly:

| # | OWASP Category | Mapped Detection Category |
|---|-----------------|---------------------------|
| A01 | Broken Access Control | authentication |
| A02 | Cryptographic Failures | cryptography |
| A03 | Injection | injection |
| A04 | Insecure Design | assess against the attack surface mapped in Step 1 |
| A05 | Security Misconfiguration | configuration |
| A06 | Vulnerable Components | dependencies |
| A07 | Auth Failures | authentication |
| A08 | Data Integrity Failures | verify deserialization / CI-CD integrity where applicable |
| A09 | Logging Failures | logging-failures |
| A10 | SSRF | verify outbound request validation where applicable |

## Out of Scope

- Completeness verification (use /verify-todo)
- Code quality and requirements verification (use /verify-code)
- Test quality (use /verify-tests)

## Workflow

### Step 1: Identify Attack Surface

Security conventions come from the project instruction files (CLAUDE.md, .claude/CLAUDE.md,
.claude/rules/*.md): restricted operations, blocked paths, credential handling, required tooling.
What changed comes from the task prompt, and from the plan's research and architecture when it
names one. **Done when** every entry point the change adds or touches is mapped with its data
flow from input to storage or output, its authentication and authorization boundary, and the
sensitive data it handles.

### Step 2: Analyze Vulnerabilities

Check the attack surface against every Detection Category above.

### Step 3: Verdict

Label every finding (below); the status is blocking when any `would-ship-bug` or `real-minor`
finding stands.

## Labels

Label each finding by its consequence on the `reviewer-contract` scale, beside its CWE / OWASP
tag; each finding carries a location, a verbatim quote and that consequence.

- `would-ship-bug` — an attacker or an ordinary failure can exploit it as shipped: an injection with a reachable input, a missing authorization check, a secret or PII written where it leaks
- `real-minor` — a real weakness with no exploit path today: validation missing behind a boundary that currently holds, a weak default no caller relies on, logging that would hinder incident response
- `nit` — hardening that closes no current weakness

## Output Format

The dispatching agent's `<verdict-body-structure>` owns the literal report structure. Findings are
grouped by detection category (injection, authentication, data-exposure, input-validation,
cryptography, configuration, dependencies, logging-failures, security-invariants-honored) with
`file:line` citations, the contract label and the CWE / OWASP tag.
