# Description Pattern Transformations

Before/after examples showing how to write effective skill descriptions using the **WHAT + WHEN + Be Pushy** formula aligned with Anthropic's official guidance.

## The Formula

```
[What the skill does — direct, keyword-rich, third person]. Use when [scenario 1], [scenario 2], [scenario 3] — even when [pushy edge case].
```

**Two parts only**: WHAT + WHEN. No preambles, no scare tactics.

---

## Anti-Pattern: The Old "Dual Qualification" Bloat

The old pattern (AFTER + WHEN + WITHOUT) wasted description budget on boilerplate:

```yaml
# OLD PATTERN — DON'T USE
description: "AFTER loading this skill, you gain access to validated patterns and best
practices for React component architecture, performance optimization, state management,
and testing. Use when architecting React applications, solving performance issues,
implementing advanced patterns, or designing React component systems. WITHOUT this skill,
you will systematically miss critical React patterns across component development tasks—
including composition anti-patterns, performance bottlenecks, state management issues,
and testing gaps—resulting in applications with poor render performance."
```

**Problems:**
- ~50 chars wasted on "AFTER loading this skill, you gain access to" (zero information)
- ~200 chars wasted on WITHOUT scare tactic (doesn't help LLM matching)
- Total: ~550 chars, only ~300 doing actual work
- Every skill sounds identical because they follow the same template

---

## Example 1: React Expert

### Before (Bloated — old pattern)

```yaml
description: "AFTER loading this skill, you gain access to validated patterns and best practices for React component architecture, performance optimization, state management, and testing. Use when architecting React applications, solving performance issues, implementing advanced patterns, or designing React component systems. WITHOUT this skill, you will systematically miss critical React patterns across component development tasks."
```
**~430 chars. Budget waste: ~200 chars on AFTER/WITHOUT boilerplate.**

### After (Anthropic-aligned)

```yaml
description: "Validated React patterns for component architecture, performance, state management, and testing. Use when building React components, fixing render performance, choosing state management, or writing component tests — even for seemingly straightforward React tasks."
```
**~270 chars. 100% working content. Pushy edge case included.**

---

## Example 2: Commit Methodology

### Before (Bloated)

```yaml
description: "AFTER loading, provides comprehensive commit creation methodology with adaptive analysis, security screening, conventional commit format, and execution protocol. Use when creating git commits, analyzing staged changes, screening for secrets, or formatting commit messages. WITHOUT this skill, commits will lack security screening and conventional format compliance."
```

### After (Anthropic-aligned)

```yaml
description: "Commit creation with security screening, smart staging triage, and conventional format. Use when creating git commits, reviewing staged changes, or preparing code for version control — even for quick single-file commits."
```

---

## Example 3: TypeScript Expert

### Before (Bloated)

```yaml
description: "AFTER loading this skill, you gain access to validated patterns for TypeScript type system mastery, architectural patterns, and compiler optimization. Use when designing type architectures, solving complex typing problems, optimizing tsconfig, or implementing advanced TypeScript patterns. WITHOUT this skill, you will systematically miss critical TypeScript patterns across type system implementations."
```

### After (Anthropic-aligned)

```yaml
description: "Validated TypeScript patterns for type system design, architectural patterns, and compiler optimization. Use when designing type architectures, solving typing problems, configuring tsconfig, or implementing advanced TypeScript patterns — even when the types seem straightforward."
```

---

## Example 4: API Documentation Writer

### Before (Bloated)

```yaml
description: "AFTER loading this skill, you gain access to industry-standard patterns and best practices for creating API documentation, SDK guides, and developer-focused technical content including REST APIs, GraphQL endpoints, OpenAPI specifications, code samples, and authentication flows. Use when documenting APIs, writing SDK guides, creating developer portals, or producing technical reference materials. WITHOUT this skill, you will systematically miss critical documentation patterns across API types."
```

### After (Anthropic-aligned)

```yaml
description: "Industry-standard patterns for API documentation, SDK guides, and developer technical content. Use when documenting REST APIs, writing SDK guides, creating OpenAPI specs, or building developer portals — even for internal or simple endpoints."
```

---

## Example 5: Claude Skill Builder (Meta-Skill)

### Before (Bloated)

```yaml
description: "Loads research-validated patterns for building SKILL.md files that auto-discover reliably. Use when creating, editing, validating, or optimizing any Claude Code skill. Without this skill, Claude cannot systematically produce well-formed skill definitions that meet validation and auto-discovery requirements."
```

### After (Anthropic-aligned)

```yaml
description: "Validated patterns for building SKILL.md files that auto-discover reliably. Use when creating, editing, validating, or optimizing any Claude Code skill — even for simple single-file skills."
```

---

## Example 6: Security Verification

### Before (Bloated)

```yaml
description: "AFTER loading, provides OWASP Top 10 security verification methodology with 7 detection categories, attack surface mapping, and AI-specific vulnerability patterns. Use when reviewing code for injection risks, authentication issues, data exposure, or security misconfigurations. WITHOUT this skill, security reviews will miss AI-specific vulnerability patterns."
```

### After (Anthropic-aligned)

```yaml
description: "OWASP Top 10 security verification with attack surface mapping and AI-specific vulnerability detection. Use when reviewing code for injection risks, authentication issues, data exposure, or security misconfigurations — even for internal-only code."
```

---

## The "Be Pushy" Technique

Claude undertriggers skills by default. The "even when" / "even if" clause at the end of WHEN pushes Claude to load the skill for edge cases:

| Skill Domain | Pushy Edge Case |
|---|---|
| React | "even for seemingly straightforward React tasks" |
| Commits | "even for quick single-file commits" |
| Security | "even for internal-only code" |
| Testing | "even for simple unit tests" |
| API docs | "even for internal or simple endpoints" |
| TypeScript | "even when the types seem straightforward" |
| Skills | "even for simple single-file skills" |

**Source:** Anthropic's own skill-creator states Claude tends to "undertrigger" and recommends descriptions be "a little bit pushy."

---

## Quick Checklist

When writing a description:

- [ ] Starts with WHAT — direct capability statement, no preamble
- [ ] Has WHEN — "Use when" + 3-5 trigger scenarios
- [ ] Has pushy edge case — "even when/if [edge case]"
- [ ] No "AFTER loading" preamble
- [ ] No "WITHOUT this skill" scare tactic
- [ ] Third person voice (not "I can" or "You can")
- [ ] Under 300 chars (ideal), under 400 chars (acceptable)
- [ ] Front-loads domain keywords in first 50 chars
- [ ] On a single YAML line (no multi-line wrapping)
