---
tags: [csharp-expert/validation]
summary: "Post-generation validation checklist and quality verification for C# code"
---

# C# Validation

## Overview

Validation runs **after code generation** as the final gate before submitting. The checklist in this folder catches the Top 10 C# agent mistakes that survive generation and would otherwise reach code review.

## Purpose

Code that compiles is not necessarily correct. The checklist provides a systematic 30-item verification that covers async patterns, resource management, null safety, naming conventions, and DI lifetimes.

## When to Use

**Always run validation when:**
- Finalizing any generated C# code
- Reviewing agent-generated code before submission
- Auditing existing code for common mistake patterns

## Available Validation Resources

### checklist.md
**30-Item Post-Generation Checklist** — Covers async void, .Result/.Wait(), IDisposable, null handling, naming conventions, LINQ enumeration, cancellation, captive dependencies, collection types, and exception handling

---

## Pages

- [checklist.md](checklist.md) — 30-item post-generation checklist: async void, .Result/.Wait(), IDisposable, null handling, naming conventions
