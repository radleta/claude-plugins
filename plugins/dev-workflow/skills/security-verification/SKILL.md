---
name: security-verification
description: "OWASP Top 10 security verification methodology with 7 detection categories, attack surface mapping, and AI-specific vulnerability patterns. Use when reviewing code for injection risks, authentication issues, data exposure, or security misconfigurations — even for internal-only endpoints."
---

# Security Verification Methodology

## AI Awareness

AI-generated code frequently introduces security vulnerabilities:
- AI often generates code with injection vulnerabilities (SQL, XSS, command)
- AI may use deprecated or insecure functions
- AI tends to skip input validation for "internal" code
- AI may expose sensitive data in logs or error messages
- AI often uses hardcoded secrets or weak defaults

## Detection Categories

**injection** (CRITICAL): Code vulnerable to injection attacks
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

**authentication** (CRITICAL): Authentication and session security issues
- Hardcoded credentials or API keys
- Weak password requirements
- Missing authentication on sensitive endpoints
- Insecure session management
- Missing CSRF protection
- Broken access control (missing authorization checks)
- JWT without proper validation
- Tokens stored in localStorage (vulnerable to XSS)

**data-exposure** (CRITICAL): Sensitive data exposure risks
- Logging sensitive data (passwords, tokens, PII)
- Error messages exposing internal details
- Sensitive data in URLs/query strings
- Missing encryption for sensitive data at rest
- Sensitive data transmitted without TLS
- API responses including unnecessary sensitive fields
- Debug mode enabled in production code

**input-validation** (HIGH): Missing or insufficient input validation
- User input used without validation
- Missing length limits on string inputs
- Missing type checking on inputs
- Regex patterns vulnerable to ReDoS
- File upload without type/size validation
- Missing URL validation for redirects
- Integer overflow potential

**cryptography** (HIGH): Weak or incorrect cryptographic practices
- Use of weak algorithms (MD5, SHA1 for security)
- Hardcoded encryption keys
- Predictable random values for security
- Missing salt for password hashing
- ECB mode encryption
- Insufficient key length

**configuration** (HIGH): Security misconfiguration
- Debug mode or verbose errors in production
- Default credentials not changed
- Unnecessary features enabled
- Missing security headers (CSP, X-Frame-Options, etc.)
- CORS misconfiguration (wildcard origins)
- Insecure cookie settings (missing Secure, HttpOnly)
- Exposed admin interfaces

**dependencies** (MEDIUM): Vulnerable dependencies and components
- Known vulnerable dependencies
- Outdated packages with security patches available
- Unnecessary dependencies increasing attack surface
- Dependencies from untrusted sources

**logging-failures** (MEDIUM): Insufficient logging that hinders incident response (OWASP A09)
- Swallowed exceptions: `catch` blocks that discard the exception without logging (bare `catch {}`, `catch (Exception) { }`, `catch (Exception ex)` using only `ex.Message` without logging the full exception). Full exception objects must reach observability tools (Application Insights, Sentry, etc.)
- Security-relevant events not logged (failed auth, access denied, input validation failures)
- Missing correlation IDs for request tracing
- Log injection via unsanitized user input in log messages (use structured logging parameters, not string interpolation)

## Out of Scope

- Completeness verification (use /verify-todo)
- Code quality and requirements verification (use /verify-code)
- Test quality (use /verify-tests)

## Workflow

### Step 1: Identify Attack Surface

1. Read project instruction files (CLAUDE.md, .claude/CLAUDE.md, .claude/rules/*.md) for security-relevant conventions: restricted operations, blocked paths, credential handling rules, known security requirements, and security tooling.
2. Read session context (provided in task prompt): what was implemented, which files changed, why, and any plan path or security-relevant details. If a plan path is mentioned, read the plan's research/architecture for entry points and dependencies.
3. Find all entry points (from session context)
4. Identify data flows from input to storage/output
5. Map authentication and authorization boundaries
6. Identify sensitive data handling

### Step 2: Analyze Vulnerabilities

1. Check for injection vulnerabilities (SQL, XSS, command)
2. Verify authentication and authorization
3. Check for sensitive data exposure
4. Verify input validation
5. Check cryptographic practices
6. Review security configuration
7. Check for vulnerable dependencies

### Step 3: Verdict

Determine APPROVED or ISSUES_FOUND with detailed findings.

## Output Format

```
## Security Verification Report

**VERDICT: [APPROVED|ISSUES_FOUND]**

---

### Attack Surface Summary

**Entry Points Identified:**
[List of API endpoints, user inputs, file uploads, etc.]

**Sensitive Data Flows:**
[List of sensitive data and how it flows through the system]

**Authentication Boundaries:**
[List of protected vs unprotected endpoints]

---

### Security Analysis

**✅ Good Security Practices Found:**
- [Practice]: [Where observed and why it's good]

**❌ Vulnerabilities Found:**
- [Vulnerability]: [file:line] - [Severity: CRITICAL/HIGH/MEDIUM/LOW]

---

### Detailed Findings (if ISSUES_FOUND)

**Injection Vulnerabilities:**
| File | Line | Type | Vulnerable Code | Remediation |
|------|------|------|-----------------|-------------|

**Authentication Issues:**
| File | Line | Issue | Risk | Remediation |
|------|------|-------|------|-------------|

**Data Exposure Risks:**
| File | Line | Data Type | Exposure | Remediation |
|------|------|-----------|----------|-------------|

**Input Validation Issues:**
| File | Line | Input | Missing Validation | Risk |
|------|------|-------|-------------------|------|

**Cryptography Issues:**
| File | Line | Issue | Risk | Remediation |
|------|------|-------|------|-------------|

**Configuration Issues:**
| File | Line | Misconfiguration | Risk | Remediation |
|------|------|------------------|------|-------------|

---

### OWASP Top 10 Checklist

| # | Category | Status | Notes |
|---|----------|--------|-------|
| A01 | Broken Access Control | ✅/❌ | [Details] |
| A02 | Cryptographic Failures | ✅/❌ | [Details] |
| A03 | Injection | ✅/❌ | [Details] |
| A04 | Insecure Design | ✅/❌ | [Details] |
| A05 | Security Misconfiguration | ✅/❌ | [Details] |
| A06 | Vulnerable Components | ✅/❌ | [Details] |
| A07 | Auth Failures | ✅/❌ | [Details] |
| A08 | Data Integrity Failures | ✅/❌ | [Details] |
| A09 | Logging Failures | ✅/❌ | [Details] |
| A10 | SSRF | ✅/❌ | [Details] |

---

### Recommendations

**Critical (must fix before merge):**
1. [Specific fix with file:line and exact remediation]

**High Priority (should fix before merge):**
1. [Specific fix with file:line]

**Medium Priority (fix soon):**
1. [Improvement suggestion]

---

### Summary

**Overall Assessment:**
[Detailed paragraph explaining security status]

**Security Risk Score:** [X/10] (10 = critical risk, 0 = minimal risk)
**Vulnerabilities Found:** [count] critical, [count] high, [count] medium, [count] low
**Recommendation:** [APPROVED for merge / FIX security issues first]
```

## Examples

### ISSUES_FOUND Example

```
## Security Verification Report

**VERDICT: ISSUES_FOUND**

### Detailed Findings

**Injection Vulnerabilities:**
| File | Line | Type | Vulnerable Code | Remediation |
|------|------|------|-----------------|-------------|
| api/users.ts | 45 | SQL | `WHERE name LIKE '%${query}%'` | Use parameterized query |

**Authentication Issues:**
| File | Line | Issue | Risk | Remediation |
|------|------|-------|------|-------------|
| api/admin.ts | 12 | No auth check | Unauthorized data access | Add requireAdmin middleware |

**Security Risk Score:** 9/10
**Recommendation:** FIX security issues first
```

### APPROVED Example

```
## Security Verification Report

**VERDICT: APPROVED**

### Security Analysis

**✅ Good Security Practices Found:**
- Parameterized queries: All SQL uses prepared statements
- Input validation: All user inputs validated and sanitized
- Authentication: JWT with proper validation on all protected routes
- Secure headers: CSP, X-Frame-Options, X-Content-Type-Options set

**Security Risk Score:** 1/10
**Recommendation:** APPROVED for merge
```
