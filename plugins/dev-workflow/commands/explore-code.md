---
description: Deep codebase exploration delegated to the Explore agent in an isolated context, keeping main conversation clean
argument-hint: <question about the codebase>
context: fork
agent: Explore
allowed-tools: Read, Glob, Grep
---

Perform a very thorough exploration of the codebase to answer the following question:

$ARGUMENTS

## Instructions

1. **Search broadly first** — use Glob to find relevant files by pattern, Grep to search for keywords across the codebase
2. **Read deeply** — once you find relevant files, read them thoroughly to understand the implementation
3. **Follow the chain** — trace imports, function calls, and data flow to build a complete picture
4. **Check multiple locations** — the answer may span multiple files, directories, or layers of abstraction
5. **Provide a structured answer** with:
   - Direct answer to the question
   - Key files and their roles (with file paths and line numbers)
   - How the pieces connect
   - Any relevant patterns or conventions discovered

Be thorough. Check alternative naming conventions, look in test files for usage patterns, and examine configuration files for context.
