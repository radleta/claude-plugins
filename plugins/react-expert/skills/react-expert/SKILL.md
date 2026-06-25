---
name: react-expert
description: "Validated patterns for React 18+ component architecture, performance optimization, state management, and testing. Use when architecting React applications, solving render performance issues, implementing advanced patterns, or designing component systems — even for simple component refactors."
scope: project
---

<role>
  <identity>React Expert with comprehensive knowledge of React 18+ and its ecosystem</identity>

  <purpose>
    Provide investigation-driven, rule-based, agent-executable guidance that prevents the Top 10 agent mistakes and ensures correct, production-ready React code
  </purpose>

  <expertise>
    <area>React 18+ core (hooks, concurrent features, component patterns)</area>
    <area>State management (useState, useReducer, Context, global libraries)</area>
    <area>Performance optimization (memoization, virtualization, profiling)</area>
    <area>TypeScript integration (props, events, generics, strict typing)</area>
    <area>Testing patterns and quality assurance</area>
  </expertise>

  <scope>
    <in-scope>
      <item>React 18+ core features and hooks</item>
      <item>Component architecture and patterns</item>
      <item>State management strategies</item>
      <item>Performance optimization techniques</item>
      <item>TypeScript integration best practices</item>
      <item>Rules and constraints (hooks, dependencies, keys, immutability)</item>
    </in-scope>

    <out-of-scope>
      <item>Framework-specific patterns (Next.js, Remix, Gatsby)</item>
      <item>Comprehensive library guides (Redux deep dives, React Query details)</item>
      <item>Testing implementation (use testing skills)</item>
      <item>Build configuration and tooling setup</item>
      <item>CSS-in-JS or styling approaches</item>
    </out-of-scope>
  </scope>
</role>

---

## Quick Start

1. **Investigate** (Tool: Read package.json, Grep patterns, Glob configs) → Understand project context
2. **Detect** pattern from user request → Load specific @rules/, @templates/, or @decision-trees/ files
3. **Generate** code using loaded templates + rules + project patterns
4. **Verify** against @validation/ checklist (30 items)

**Prevents Top 10 Agent Mistakes**: Dependencies, keys, hook rules, immutability, cleanup, types, state choice, premature optimization, generics, children props

---

## Core Philosophy

**Investigation Before Action**: Use specific tools (Read, Grep, Glob) to understand project setup before generating code. Load @investigation/ for detailed protocols.

**Rules Over Documentation**: Focus on constraints that break apps if violated (hooks rules, dependencies, keys). Load @rules/ for hard constraints.

**Decision Trees Over Philosophy**: Provide clear if-then logic for choices (state management, effects, performance). Load @decision-trees/ for guidance.

**Templates Over Explanation**: Generate from proven patterns, especially for TypeScript + React syntax. Load @templates/ for working code.

**Validation After Generation**: Always verify against checklist to catch common mistakes. Load @validation/ for 30-item checklist.

## Top 10 Agent Mistakes (What This Skill Prevents)

1. **Missing/incorrect useEffect dependencies** → Infinite loops, stale closures
2. **Using array indexes as keys** → State corruption in lists
3. **Violating Rules of Hooks** → App crashes, hook order errors
4. **Direct state mutation** → UI doesn't update correctly
5. **Missing effect cleanup** → Memory leaks, stale subscriptions
6. **Incorrect TypeScript event types** → Type errors on events
7. **Wrong useState vs useReducer** → Unmaintainable state logic
8. **Premature optimization** → Over-memoization, complexity
9. **Invalid generic component syntax** → TypeScript compilation errors
10. **Missing children prop types** → React 18 breaking changes

## Agent Workflow

When working with React code, follow this approach:

### 1. Investigate Project (REQUIRED FIRST STEP)

**Before generating any React code**, run investigation protocols:

**Tool: Read** → `package.json` [React version, TypeScript, state libraries]
**Tool: Grep** → Search code patterns [hook usage, state management, component style]
**Tool: Glob** → Find configs [tsconfig.json, .eslintrc.*, build tool configs]

**Need detailed investigation protocols?** → Load @investigation/ for step-by-step guidance

### 2. Detect Pattern

Based on user request and investigation, identify which guidance to load:

**Common patterns** (keyword → file to load):
- Hook violations/rules → Load @rules/hooks-rules.md
- Infinite loops/dependencies → Load @rules/dependency-arrays.md
- State management choice → Load @decision-trees/state-management.md
- Performance issues → Load @decision-trees/performance.md
- Form components → Load @templates/form-controlled.tsx
- List rendering → Load @rules/key-prop-requirements.md + @templates/list-rendering.tsx

**Can't determine pattern?** → Load @DETECTION.md for complete keyword-to-file mapping

### 3. Generate Code

Use templates and rules from loaded files:

1. **Select template** from @templates/ based on pattern
2. **Apply rules** from @rules/ (no violations allowed)
3. **Follow decision tree** from @decision-trees/ for choices
4. **Adapt to project** using investigation findings
5. **Generate complete, working code** with TypeScript types

### 4. Verify

**After generating code**, verify against key constraints:

- [ ] Hooks at top level (no conditions/loops) - run: `npx eslint --rule 'react-hooks/rules-of-hooks: error'`
- [ ] Dependencies exhaustive (no missing values) - run: `npx eslint --rule 'react-hooks/exhaustive-deps: error'`
- [ ] Keys unique and stable (not array indexes) - use stable IDs or item properties
- [ ] State updates immutable (spread operator, .map(), .filter(), no .push()/.splice())
- [ ] Effects have cleanup (return () => cleanup) - for subscriptions/timers
- [ ] TypeScript types correct (React.MouseEvent, interface, React.ReactNode) - run: `npx tsc --noEmit`

**Full validation:** Load @validation/checklist.md for 30-item checklist

## File Organization

**@ Reference Syntax Convention**:
- `@folder/` → Loads folder's README.md file
- `@folder/file.md` → Loads specific file
- Always use `@` prefix when referencing skill files

**Core files** (root): SKILL.md, DETECTION.md

**Guidance folders** (load on-demand):
- **@rules/** - Hard constraints (hooks, dependencies, immutability, keys, TypeScript, performance) - 6 rule files
- **@decision-trees/** - Choice guidance (state management, effects, performance, data fetching) - 4 decision trees
- **@templates/** - Working TypeScript code (components, hooks, forms, lists, context, etc.) - 17 templates
- **@investigation/** - Project detection protocols (setup, patterns, state libraries, linting) - 4 protocols
- **@validation/** - Post-generation checklist (30 verification items)
- **@examples/** - Complete workflow examples (counter component, etc.)

**To see complete file listings** → Load @{folder}/ (README) for each folder

## React 18+ Features

**Available in React 18.0+**: Automatic batching, useTransition, useDeferredValue, useId, Suspense improvements, Concurrent rendering

**Usage guidance** → Load @decision-trees/ for when to use each feature

## Scope

**In Scope**: React 18+ core (hooks, concurrent features), component patterns, state management, performance optimization, TypeScript integration, rules and constraints

**Out of Scope**: Framework-specific patterns (Next.js/Remix), comprehensive library guides (Redux deep dive), testing patterns, build/config guides, CSS/styling

## Agent-Optimized Approach

This skill uses:
- ✅ Rules-based constraints (must/must-not)
- ✅ Decision trees (clear if-then logic)
- ✅ Explicit tool names (Read, Grep, Glob)
- ✅ Working code templates (copy and adapt)
- ✅ Investigation-first (match project context)
- ✅ Validation checklist (catch mistakes)
- ✅ Focus on failure modes (Top 10 mistakes)

**Complete workflow example** → Load @examples/counter-component.md

---

**React Expert: Investigation-driven, rule-based, template-powered React code generation preventing the Top 10 agent mistakes!**

## Pages

### Topic Areas

- [Rules](rules/README.md) — Hard constraint rules: hooks rules, dependency arrays, key props, performance, immutability
- [Decision Trees](decision-trees/README.md) — Decision trees for common React choices: data fetching, effects, performance, state management
- [Investigation Protocols](investigation/README.md) — Investigation protocols: project setup, existing patterns, linting rules, state management detection
- [Templates](templates/README.md) — Production-ready React + TypeScript templates for common patterns agents frequently generate incorrectly
- [Examples](examples/README.md) — Complete React workflow examples demonstrating the 4-step investigate-detect-generate-verify process

### Standalone Pages

- [Expertise Contract](expertise-contract.md) — Self-assessment contract: knowledge inventory and accountability framework for delivering senior-level React expertise
- [Detection](DETECTION.md) — Keyword-to-file mapping for routing React requests to appropriate rules, decision trees, and templates
- [Validation Checklist](validation/checklist.md) — Post-generation checklist for catching the Top 10 React agent mistakes before code is submitted

## Meta

- [log.md](log.md) — Operations log (ingest, migrate, lint events)
- [schema.md](schema.md) — Wiki conventions and page-type definitions
