---
summary: "Seven foundational principles for understanding PowerShell semantics when porting PS1 scripts to C#: objects, pipelines, scope, hashtables, typing, errors, and investigation order."
tags: [powershell-expert/core-principles]
---

# Core Principles

## 1. Everything Is an Object

PowerShell wraps everything in objects. Even simple strings are `System.String`. Cmdlet output is always `object[]` or a specific .NET type. When porting, identify the underlying .NET type — the C# equivalent is often the same class.

## 2. Pipeline Is Lazy Enumeration

The PowerShell pipeline (`|`) processes items one at a time (streaming). This maps to C# `IEnumerable<T>` and LINQ. Key difference: PowerShell auto-unwraps single-element arrays, which C# does not. Always check whether pipeline output is treated as scalar or collection in the original script.

## 3. Script Scope Is Module-Level State

`$script:` variables persist for the script's lifetime and are visible to all functions in that script. They are the PowerShell equivalent of **C# static fields** in the enclosing class. When porting, collect all `$script:` variables and promote them to static fields (or instance fields on a long-lived service class).

## 4. Hashtables Are the Universal Container

PowerShell hashtables (`@{}`) serve as dictionaries, configuration objects, and even argument bags (splatting). In C#, map them to `Dictionary<string, T>`, configuration classes, or anonymous objects depending on usage context.

## 5. Loose Typing Requires Explicit Translation

PowerShell silently coerces types (`"5" + 2` yields `"52"`, `2 + "5"` yields `7`). When porting, every variable needs an explicit C# type. Look at how the variable is used (arithmetic, string interpolation, comparison) to determine the correct type.

## 6. Error Handling Is Mode-Based

PowerShell's error behavior depends on `$ErrorActionPreference` and per-cmdlet `-ErrorAction`. With `Set-StrictMode -Version Latest`, uninitialized variable access throws. Port these to C# try/catch with explicit null checks and consider what was silent vs. terminating in the original.

## 7. Investigate Before Translating

Before porting any PS1 script, investigate its structure: what assemblies it loads, what `$script:` state it maintains, what .NET types it creates via `Add-Type`, and what event-driven patterns it uses. This determines the C# architecture (single class vs. multi-service, sync vs. async, WinForms vs. WPF).
