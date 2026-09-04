---
tags: [csharp-expert/rules]
summary: "Index of hard constraint rules for C#: async/await, IDisposable, DI lifetimes, LINQ, null safety, naming conventions, file I/O"
---

# C# Rules Reference

This directory contains **hard constraints** that break C# applications if violated. These are not best practices or style preferences — these are the rules that, when broken, cause deadlocks, resource leaks, crashes, and production incidents.

## Purpose

C#/.NET rules exist because of how the runtime, async state machine, and dependency injection container work internally. Violating these rules doesn't just make code "less clean" — it makes code **broken** or **dangerous**.

## When to Use This Reference

**Use this when:**
- Writing C# code from scratch
- Reviewing agent-generated .NET code
- Debugging mysterious deadlocks, leaks, or null errors
- Auditing DI registrations for lifetime mismatches

## The 7 Rule Categories

### 1. async-await-rules.md
**Async/Await Constraints** — No async void (except event handlers), no .Result/.Wait(), correct ConfigureAwait usage

**When violated**: App hangs, threads blocked, exceptions swallowed, deadlocks in ASP.NET contexts

---

### 2. idisposable-patterns.md
**IDisposable Patterns** — Using declarations, dispose order, SafeHandle, finalize/dispose pattern

**When violated**: File handle exhaustion, undisposed connections, memory leaks

---

### 3. dependency-injection-rules.md
**DI Lifetime Rules** — No Singleton capturing Scoped, captive dependency prevention

**When violated**: Stale data, DbContext reuse across requests, hidden thread-safety bugs

---

### 4. linq-best-practices.md
**LINQ Performance Rules** — Avoid multiple enumeration, materialize with ToList/ToArray when needed

**When violated**: Double database queries, deferred execution surprises, N+1 patterns

---

### 5. null-safety.md
**Nullable Reference Type Rules** — ? annotations, null checks, null-forgiving operators, NRT migration

**When violated**: NullReferenceException, compiler warnings suppressed unsafely, incorrect nullable flow

---

### 6. naming-conventions.md
**C# Naming Rules** — PascalCase classes/methods, I-prefix interfaces, _camelCase fields, Async suffix

**When violated**: Convention mismatch with .NET ecosystem, failing code reviews, ambiguous identifiers

---

### 7. file-io-rules.md
**File I/O Constraints** — FileSystemWatcher + atomic write incompatibility, async file patterns

**When violated**: Missed file events, partial-write corruption, sync-over-async on file operations

---

## Pages

- [async-await-rules.md](async-await-rules.md) — Hard rules for async/await: no async void, no .Result/.Wait(), proper ConfigureAwait usage
- [idisposable-patterns.md](idisposable-patterns.md) — IDisposable patterns: using declarations, dispose order, SafeHandle, finalize/dispose pattern
- [dependency-injection-rules.md](dependency-injection-rules.md) — DI lifetime rules: no Singleton capturing Scoped, captive dependency prevention
- [linq-best-practices.md](linq-best-practices.md) — LINQ performance rules: avoid multiple enumeration, materialize with ToList/ToArray
- [null-safety.md](null-safety.md) — Nullable reference type rules: ? annotations, null checks, null-forgiving operators, NRT migration
- [naming-conventions.md](naming-conventions.md) — C# naming rules: PascalCase classes/methods, I-prefix interfaces, _camelCase fields, Async suffix
- [file-io-rules.md](file-io-rules.md) — File I/O constraints: FileSystemWatcher + atomic write incompatibility, async file patterns
