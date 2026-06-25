---
tags: [csharp-expert/decision-trees]
summary: "Index of decision trees for common C# choices: async vs sync, collection types, DI lifetimes, null handling"
---

# Decision Trees for C# Development

## Overview

This folder contains **clear, executable decision trees** for common choices C# developers face. Each tree uses branching logic to guide you from a question to the right solution.

## Purpose

Decision trees solve a critical problem: agents often make poor architectural choices not because they lack knowledge, but because they lack a clear decision-making process. These trees provide that process.

## Available Decision Trees

### 1. async-vs-sync.md
**Async vs Sync Methods** — When to use async/await versus synchronous code, and ConfigureAwait guidance

**Solves:**
- "Should this method be async?"
- "Is this I/O-bound or CPU-bound?"
- "When do I need ConfigureAwait(false)?"

---

### 2. collection-types.md
**Collection Type Selection** — Choosing between List, HashSet, Dictionary, Array, and other collection types

**Solves:**
- "Should I use List<T> or IEnumerable<T>?"
- "When do I need a HashSet vs List?"
- "What collection minimizes allocations here?"

---

### 3. di-lifetimes.md
**DI Lifetime Selection** — Choosing Transient, Scoped, or Singleton for service registrations

**Solves:**
- "Should this service be Singleton or Scoped?"
- "Does this service hold state?"
- "Will a Singleton capturing this Scoped cause issues?"

---

### 4. null-handling.md
**Null Handling Patterns** — Choosing between nullable annotations, null-forgiving operators, and throw patterns

**Solves:**
- "Should I use ? or ! here?"
- "When do I throw ArgumentNullException?"
- "How do I handle nullable returns correctly?"

---

## Pages

- [async-vs-sync.md](async-vs-sync.md) — Decision tree for async vs sync methods: I/O-bound vs CPU-bound, ConfigureAwait usage
- [collection-types.md](collection-types.md) — Decision tree for collection type selection: List vs HashSet vs Dictionary vs Array
- [di-lifetimes.md](di-lifetimes.md) — Decision tree for DI lifetime selection: Transient vs Scoped vs Singleton
- [null-handling.md](null-handling.md) — Decision tree for null handling: nullable annotations, null-forgiving operators, throw patterns
