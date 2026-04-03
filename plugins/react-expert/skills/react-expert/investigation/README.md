# Investigation Protocols for React Expert

## Overview

This folder contains **tool-specific investigation protocols** that guide systematic discovery of project conventions, patterns, and configurations before generating React code. Investigation ensures generated code seamlessly integrates with existing project standards.

## Why Investigation Matters

**Problem**: Generic React advice fails in real projects because:
- Projects use different React versions (16.8 vs 18.3 = different APIs)
- Teams have different component style conventions (function declarations vs arrow functions)
- State management varies wildly (Redux vs Zustand vs Context vs Jotai)
- TypeScript configurations differ (strict mode vs loose typing)
- ESLint rules enforce different patterns (hooks rules, prop validation)

**Solution**: Investigate before generating to match exact project conventions.

**Result**: Code that integrates perfectly without requiring manual adjustments.

## When to Investigate

**ALWAYS investigate for**:
- Production code generation
- Component creation
- State management integration
- New feature development

**MAY SKIP for**:
- Quick prototypes explicitly marked as throwaway
- Learning examples outside project context
- Documentation snippets

**Default**: When in doubt, investigate.

## Investigation Workflow

```
1. PROJECT SETUP
   ↓
   Detect: React version, TypeScript, Framework
   Tools: Read package.json, Glob config files

2. EXISTING PATTERNS
   ↓
   Discover: Component style, props naming, exports
   Tools: Grep existing components for patterns

3. STATE MANAGEMENT
   ↓
   Identify: Library and integration patterns
   Tools: Read package.json, Grep usage patterns

4. LINTING RULES
   ↓
   Extract: ESLint rules, Prettier config
   Tools: Glob config files, Read configurations

5. GENERATE CODE
   ↓
   Apply: All discovered conventions
   Result: Perfectly integrated code
```

## Protocol Files

### 1. project-setup.md
**Purpose**: Detect React version, TypeScript, and framework to determine available APIs

**Key Protocols**:
- React Version Detection → Determines available hooks and features
- TypeScript Detection → Enables type-safe code generation
- Framework Detection → Identifies Next.js/Remix/Vite patterns

**When to use**: First step for every code generation task

---

### 2. existing-patterns.md
**Purpose**: Discover team's component conventions and code style preferences

**Key Protocols**:
- Component Style → Function declaration vs arrow function
- Props Naming → Interface naming patterns
- Export Style → Named vs default exports
- React Import Style → Namespace vs named imports

**When to use**: Before creating any new component

---

### 3. state-management-detection.md
**Purpose**: Identify state management library and integration patterns

**Key Protocols**:
- Library Detection → Find Redux/Zustand/Jotai/Recoil/Context
- Pattern Detection → Discover how library is used in project

**When to use**: Before implementing state logic or data flow

---

### 4. linting-rules.md
**Purpose**: Extract linting and formatting rules to ensure generated code passes validation

**Key Protocols**:
- ESLint Config Detection → Find linting rules
- Key Rules Check → Verify critical React rules
- Prettier Config → Match formatting style

**When to use**: Before finalizing any code generation

---

## Tool Usage Patterns

### Read Tool
**Use for**: Reading specific known files
- `package.json` - Dependencies and versions
- `tsconfig.json` - TypeScript configuration
- `.eslintrc.*` - Linting rules

### Glob Tool
**Use for**: Finding files by pattern
- `**/components/**/*.tsx` - Component files
- `next.config.*` - Framework configs
- `.eslintrc.*` - Config file variations

### Grep Tool
**Use for**: Searching code patterns
- `export function` - Component style patterns
- `interface.*Props` - Props naming conventions
- `createSlice` - Library usage patterns

## Investigation Best Practices

### 1. Parallel Investigation
Run independent checks in parallel for speed:
```
✓ Read package.json AND Glob config files (parallel)
✓ Grep multiple patterns in single call
✗ Sequential reads when parallel possible
```

### 2. Evidence-Based Decisions
Base decisions on actual code, not assumptions:
```
✓ Grep existing components, count results, choose majority pattern
✗ Assume arrow functions because "that's common"
```

### 3. Graceful Degradation
Handle missing information elegantly:
```
✓ No ESLint config? Use React best practices
✓ No TypeScript? Generate JavaScript
✗ Error and stop if config missing
```

### 4. Verification Commands
Include verification commands in protocol output:
```
✓ "Verify: grep 'export function' src/**/*.tsx"
✓ "Verify: cat package.json | grep react"
✗ Trust without verification path
```

## Protocol Structure Standard

Every protocol MUST include:

```markdown
**Protocol N: [Name]**
- **Tool**: [Read|Grep|Glob] → [target]
- **Extract**: [what to look for]
- **Decision Tree**:
  ```
  [Condition]?
  ├─ [Case 1]
  │   └─ [Action/Implication]
  ├─ [Case 2]
  │   └─ [Action/Implication]
  └─ [Case 3]
      └─ [Action/Implication]
  ```
- **Verification**: [command to verify findings]
```

This structure ensures:
- Clear tool selection
- Explicit extraction targets
- Systematic decision making
- Verifiable results

## Example: Complete Investigation Flow

```
Task: Create a new UserProfile component

1. PROJECT SETUP (project-setup.md)
   Read package.json → React 18.2.0 (can use useId)
   Glob tsconfig.json → Found, strict mode enabled
   Glob next.config.js → Next.js project detected

2. EXISTING PATTERNS (existing-patterns.md)
   Grep "export function" → 47 matches
   Grep "export const.*=" → 12 matches
   Decision: Use function declarations (majority pattern)

   Grep "interface.*Props {" → Pattern found
   Decision: Use "interface UserProfileProps"

3. STATE MANAGEMENT (state-management-detection.md)
   Read package.json → zustand found
   Grep "create(" → Usage pattern identified
   Decision: Use Zustand store if state needed

4. LINTING RULES (linting-rules.md)
   Glob .eslintrc.json → Found
   Read config → react-hooks/exhaustive-deps: "error"
   Decision: Ensure all useEffect dependencies complete

5. GENERATE
   Create UserProfile component:
   - TypeScript with strict types ✓
   - Function declaration style ✓
   - Named export ✓
   - useId for accessibility ✓
   - Zustand for state ✓
   - Complete deps arrays ✓
```

## Success Criteria

Investigation is successful when:
- [ ] All relevant project configurations identified
- [ ] Code style patterns discovered with evidence
- [ ] State management approach clear
- [ ] Linting rules known and will be followed
- [ ] Generated code will integrate without modification

Investigation failed if generated code requires manual adjustment to match project conventions.

## Next Steps

After reading this overview:
1. Start with **project-setup.md** for environment detection
2. Continue to **existing-patterns.md** for style discovery
3. Check **state-management-detection.md** if state needed
4. Verify with **linting-rules.md** before finalizing

Each protocol file provides detailed, tool-specific instructions for systematic investigation.
