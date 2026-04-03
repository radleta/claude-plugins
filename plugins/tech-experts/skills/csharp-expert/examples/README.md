# C# Expert Examples

Complete workflow examples demonstrating the 4-step process: Investigate → Detect → Generate → Verify

## Available Examples

### async-service.md
**Scenario**: "Create an async service that fetches data with cancellation support"
**Demonstrates**:
- Investigation (Read .csproj, Program.cs, Grep DI patterns)
- Pattern detection (async + cancellation → async-await-rules.md)
- Template usage (@templates/async-with-cancellation.cs, @templates/constructor-injection.cs)
- Verification against checklist
- Prevention of Top 10 Mistakes #1, #2, #3, #8

**Best for**: Understanding the complete workflow from start to finish

---

## When to Use Examples

**Load examples when**:
- You need to see the complete workflow end-to-end
- You're unsure how investigation informs code generation
- You want to understand how templates get adapted to projects
- You need to see verification in practice

**Don't load examples when**:
- You already understand the workflow
- You just need a specific rule or template
- Time is limited and you need quick guidance

---

## Example Categories (Future)

**Planned examples** (load on-demand as needed):

**Async Patterns**:
- Async service with cancellation (available now)
- Async method with timeout
- Parallel async operations

**Resource Management**:
- IDisposable implementation
- Using statements for file I/O
- DbContext lifecycle management

**Dependency Injection**:
- Service registration with correct lifetimes
- Avoiding captive dependencies
- Constructor injection patterns

**LINQ Optimization**:
- Avoiding multiple enumeration
- Materialization decisions (ToList vs streaming)
- Query performance patterns

**Null Safety**:
- Nullable reference type annotations
- Null-conditional operators
- Null-coalescing patterns

---

**Examples complement, don't replace, the core guidance in @rules/, @templates/, and @decision-trees/**
