---
name: knowledge-distillation
description: "Systematic admission gate for evaluating which domain knowledge earns inclusion in expert skills — the four admission questions plus the principle-versus-instance filter, knowledge categories, and compaction techniques. Use when distilling insights from research, curating knowledge for skill creation, or deciding what to include vs exclude — even when the source material seems straightforward."
---

# Knowledge Distillation Framework

## Purpose

Expert skills give Claude immediate, supersized domain knowledge. But indiscriminate inclusion bloats skills with information Claude already has or that doesn't change behavior. This framework provides systematic filters to determine what earns inclusion.

The principle filter, the knowledge categories and the compaction techniques are this skill's own — they say how to *state* knowledge that has already been admitted, which [`wiki-memory/page-standard.md`](../wiki-memory/page-standard.md) does not cover.

## The Admission Gate

Every candidate insight must clear **admission**, then be stated as a principle rather than an instance (the principle filter below). Two gates, in that order.

### Admission: does this earn its place?

Ask each claim the four questions — Sought, Novel, Enforcing, Durable — in [`wiki-memory/page-standard.md` `## Admission`](../wiki-memory/page-standard.md#admission), the single normative copy, and admit only a claim that passes all four.

### The principle filter: is this a principle or an instance?

**Prefer principles** over individual instances. Compress multiple instances into the pattern they represent.

| Include (Principle) | Exclude (Instance) |
|--------------------|--------------------|
| "All retry logic must use exponential backoff with jitter" | "The UserService retry uses 100ms, 200ms, 400ms delays" |
| "Config files are validated at startup, not at use" | "database.yml is loaded in config/initializers/database.rb" |
| "Error responses follow RFC 7807 Problem Details format" | "The /users endpoint returns {type, title, status, detail}" |

**Exception:** Include specific instances when:
- The instance IS the convention (e.g., a specific file path that must be used)
- The instance contradicts what Claude would assume
- The instance is a critical "gotcha" that causes repeated failures

## Knowledge Categories (Ranked by Value)

Highest value first — prioritize categories at the top:

### 1. Anti-Patterns (Highest Value)
Knowledge Claude would get wrong without explicit guidance.
```
"Never use setTimeout for retry delays — use the RetryPolicy class which handles
backoff, jitter, and circuit breaking. setTimeout retries cause thundering herd."
```

### 2. Decision Frameworks
When-to-use-what guidance that prevents wrong choices.
```
"Choose storage strategy by data lifecycle:
- Session data → Redis (auto-expiry)
- User preferences → PostgreSQL (durable, queryable)
- File uploads → S3 (scalable, CDN-ready)
- Cache → Redis with LRU (evictable)"
```

### 3. Investigation Protocols
Step-by-step procedures for diagnosing common problems.
```
"When auth fails, check in this order:
1. Token expiry (most common, check exp claim)
2. Clock skew (servers > 30s apart breaks JWT)
3. Key rotation (was the signing key rotated?)
4. Audience mismatch (check aud claim)
5. Revocation (check blacklist cache)"
```

### 4. Checklists
Completeness checks for common tasks.
```
"New API endpoint checklist:
- [ ] Input validation with Joi schema
- [ ] Rate limiting middleware
- [ ] Auth middleware on protected routes
- [ ] Error handler returns RFC 7807
- [ ] OpenAPI spec updated
- [ ] Integration test added"
```

### 5. Patterns with Context
How-to guidance with rationale for WHY.
```
"Use repository pattern for data access — not because of abstraction purity,
but because it enables test isolation. Mock the repository interface, not
the database driver."
```

### 6. Context and Constraints (Lowest Actionable Value)
Background that informs decisions but doesn't directly instruct.
```
"The system handles 10K req/s peak. Performance-sensitive paths are marked with
@HotPath annotation. Do not add synchronous I/O to annotated methods."
```

## Compaction Techniques

### Tables Over Prose
```
BAD (45 words):
"When handling errors in the API layer, you should use a 400 status for
validation errors, a 401 for authentication failures, a 403 for authorization
failures, and a 404 for missing resources. Server errors should use 500."

GOOD (table, 6 rows):
| Error Type | Status | When |
|-----------|--------|------|
| Validation | 400 | Input fails schema |
| Auth | 401 | No/invalid token |
| Authz | 403 | Valid token, wrong role |
| Not Found | 404 | Resource doesn't exist |
| Conflict | 409 | Duplicate/state conflict |
| Server | 500 | Unhandled exception |
```

### Checklists Over Explanations
```
BAD: "Make sure to validate the input, check permissions, log the operation,
update the audit trail, and invalidate relevant caches."

GOOD:
- [ ] Validate input (Joi schema)
- [ ] Check permissions (RBAC middleware)
- [ ] Log operation (structured logger)
- [ ] Update audit trail (AuditService)
- [ ] Invalidate caches (CacheManager.invalidate)
```

### Patterns Over Instances
```
BAD: "UserService uses retry. OrderService uses retry. PaymentService uses retry."

GOOD: "All external service calls use RetryPolicy with exponential backoff.
Config: maxRetries=3, baseDelay=100ms, maxDelay=5s, jitter=true."
```

### Conditional Tables for Decision Logic
```
| Condition | Action | Why |
|-----------|--------|-----|
| Input < 100 items | Sync processing | Fast enough, simpler |
| Input 100-10K | Batch with progress | User needs feedback |
| Input > 10K | Background job + webhook | Would timeout HTTP |
```

## Output Format

When distilling insights, return them in this structured format:

```
## Knowledge Distillation Report

### Source
[What was analyzed — file paths, session context, research material]

### Insights Extracted: [total count]

**High Priority ([count]):**

1. **[Category: Anti-Pattern/Framework/Protocol/Checklist/Pattern/Context]**
   [The insight, written as an instruction]
   - Admission: [The task outside this workstream that seeks it, why it is novel, the verb it enforces, and why it is durable]
   - Principle filter: [Principle or justified instance]
   - Compact form: [Table/checklist/pattern version for skill inclusion]

**Medium Priority ([count]):**
[Same format]

**Excluded ([count]):**
1. [Observation] — Excluded because: [admission, or the principle filter]

### Recommendations for Skill Inclusion

**Must include:** [List of high-priority insights with their compact forms]
**Consider including:** [List of medium-priority insights]
**Exclude:** [Summary of excluded items with filter reasons]

### Token Estimate
Including recommended insights would add approximately [N] lines / [N] tokens
to the target skill.
```
