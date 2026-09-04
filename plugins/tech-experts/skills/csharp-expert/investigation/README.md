---
tags: [csharp-expert/investigation]
summary: "Index of C# project investigation protocols: .NET version, SDK type, NuGet packages, and existing patterns"
---

# C# Investigation Protocols

## Overview

Investigation runs **before any code generation**. Skipping it is the root cause of most agent-generated C# code that fails code review — generated code that ignores project conventions, targets the wrong .NET version, or misses existing DI registrations.

## Purpose

Each protocol in this folder provides step-by-step tooling instructions (Read, Grep, Glob) for discovering the project context that shapes every code decision downstream.

## When to Use

**Always run investigation when:**
- Working in an unfamiliar C# project
- The .csproj target framework is unknown
- The DI container setup is unclear
- Existing async or null-safety patterns need to be matched

## Available Protocols

### project-detection.md
**Project Detection Protocol** — Identify .NET version, SDK type, NuGet packages, nullable reference type settings, and existing code patterns

**Covers:**
- Read `.csproj` for `<TargetFramework>`, SDK type, `<Nullable>` setting
- Glob for `Directory.Build.props`, `.editorconfig`, `global.json`
- Grep for existing async patterns, DI registration style, IDisposable usage
- Determine which rules and templates apply based on findings

---

## Pages

- [project-detection.md](project-detection.md) — Project detection protocol: identify .NET version, SDK type, NuGet packages, and existing patterns
