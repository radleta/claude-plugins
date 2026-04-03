# Linting Rules Investigation

## Purpose

Extract linting and formatting rules to ensure generated code passes validation without manual fixes. This prevents code review delays and ensures compliance with project quality standards.

## Why This Matters

**Linting rules are enforced**:
- Pre-commit hooks block commits with errors
- CI/CD pipelines fail on linting violations
- Code reviews focus on linting before logic
- Time wasted fixing avoidable issues

**React-specific rules are critical**:
- `react-hooks/rules-of-hooks` - Hooks must follow rules
- `react-hooks/exhaustive-deps` - useEffect dependencies complete
- `react/jsx-key` - Keys required in lists
- `react/prop-types` - PropTypes validation (if used)

**Formatting matters**:
- Prettier auto-formats on save
- Inconsistent formatting causes diff noise
- Team conventions must be matched

## Investigation Protocols

---

### Protocol 1: ESLint Configuration Detection

**Objective**: Find and read ESLint configuration to understand project's linting rules

**Tool**: Glob → Search for ESLint config files, then Read → Parse configuration

**Search Patterns**:
1. `.eslintrc.js`
2. `.eslintrc.json`
3. `.eslintrc.yaml` / `.eslintrc.yml`
4. `eslint.config.js` (Flat config, ESLint 9+)
5. `package.json` → `eslintConfig` field

**Error Handling**:
- If Glob finds no ESLint config files → Fallback: Check package.json for eslintConfig field, if none found, use React community defaults
- If config file exists but cannot be parsed → Report to user: "ESLint config found but malformed. Using React community defaults."
- If config exists but no React plugins → Report to user: "ESLint configured but missing React plugins. Add plugin:react/recommended and plugin:react-hooks/recommended."

**Extract**:
- Extends (base configs like `eslint:recommended`, `plugin:react/recommended`)
- Plugins (react, react-hooks, jsx-a11y, import, etc.)
- Rules (specific rule configurations)
- Parser (babel-eslint, @typescript-eslint/parser)
- Parser options (JSX, ECMAScript version)

**Decision Tree**:
```
ESLint config found?
├─ YES
│   ├─ Config format
│   │   ├─ .eslintrc.* (classic config)
│   │   │   ├─ Read: Configuration object
│   │   │   └─ Parse: extends, plugins, rules
│   │   │
│   │   └─ eslint.config.js (flat config, ESLint 9+)
│   │       ├─ Read: Exported array of configs
│   │       └─ Parse: Newer format structure
│   │
│   ├─ Base configurations (extends)
│   │   ├─ eslint:recommended
│   │   │   └─ Basic JavaScript best practices
│   │   │
│   │   ├─ plugin:react/recommended
│   │   │   ├─ React-specific rules
│   │   │   ├─ Component naming, prop validation
│   │   │   └─ JSX best practices
│   │   │
│   │   ├─ plugin:react-hooks/recommended
│   │   │   ├─ rules-of-hooks (error)
│   │   │   ├─ exhaustive-deps (warn)
│   │   │   └─ Critical for hooks correctness
│   │   │
│   │   ├─ plugin:@typescript-eslint/recommended
│   │   │   ├─ TypeScript-specific rules
│   │   │   ├─ Type safety enforcement
│   │   │   └─ Matches tsconfig strictness
│   │   │
│   │   ├─ plugin:jsx-a11y/recommended
│   │   │   ├─ Accessibility rules
│   │   │   ├─ ARIA attributes, keyboard nav
│   │   │   └─ alt text, labels, etc.
│   │   │
│   │   └─ airbnb, standard, google, etc.
│   │       ├─ Opinionated style guides
│   │       └─ Comprehensive rule sets
│   │
│   ├─ Custom rule overrides
│   │   ├─ Check "rules" object
│   │   ├─ Note: Overrides take precedence
│   │   └─ May relax or strengthen base configs
│   │
│   └─ Apply to generated code
│       ├─ Follow all enabled rules
│       ├─ Especially "error" level rules
│       └─ Consider "warn" level rules
│
└─ NO
    ├─ Check for inline comments (/* eslint-disable */)
    ├─ Assume: Basic React best practices
    ├─ Follow: React hooks rules strictly
    └─ Suggest: ESLint setup if appropriate
```

**Verification**:
```bash
# Search for ESLint config files
ls -la .eslintrc.* eslint.config.* 2>/dev/null

# Check package.json for eslintConfig
cat package.json | grep -A 20 '"eslintConfig"'

# Read config (example for .eslintrc.json)
cat .eslintrc.json

# Check for ESLint in package.json scripts
grep '"lint"' package.json
```

**Example Output**:
```
ESLint config: .eslintrc.json

Configuration:
  extends:
    - eslint:recommended
    - plugin:react/recommended
    - plugin:react-hooks/recommended
    - plugin:@typescript-eslint/recommended

  plugins:
    - react
    - react-hooks
    - @typescript-eslint

  Custom rules:
    - react-hooks/exhaustive-deps: "error" (stricter than default)
    - react/react-in-jsx-scope: "off" (new JSX transform)
    - @typescript-eslint/no-explicit-any: "error"

Decision: Follow all recommended rules + custom overrides
Critical: exhaustive-deps as error (must fix, not ignore)
```

---

### Protocol 2: React Hooks Rules Check

**Objective**: Verify React hooks linting rules to ensure hooks compliance

**Tool**: Read → ESLint config (from Protocol 1)

**Extract**:
Focus on hooks-specific rules:
- `react-hooks/rules-of-hooks` - Hooks rules enforcement
- `react-hooks/exhaustive-deps` - Dependency array completeness

**Decision Tree**:
```
react-hooks/rules-of-hooks?
├─ "error" (default recommended)
│   ├─ Strictly enforce hooks rules
│   ├─ Must follow:
│   │   ├─ Only call hooks at top level
│   │   ├─ Only call hooks in React functions
│   │   ├─ No hooks in loops, conditions, nested functions
│   │   └─ Hook names must start with "use"
│   │
│   └─ Generate code that:
│       ├─ Calls all hooks before any returns
│       ├─ No conditional hook calls
│       ├─ Custom hooks follow naming convention
│       └─ Hooks not in callbacks or event handlers
│
├─ "warn"
│   └─ Same constraints, but less strict enforcement
│
└─ "off" (unusual, likely misconfigured)
    └─ Still follow hooks rules (React requirement)

react-hooks/exhaustive-deps?
├─ "error"
│   ├─ All dependencies MUST be in dependency array
│   ├─ Cannot ignore warnings
│   ├─ Must fix or use suppressions with justification
│   │
│   └─ Generate code with:
│       ├─ Complete dependency arrays
│       ├─ useCallback for function dependencies
│       ├─ useMemo for object/array dependencies
│       └─ Ref-based mutable values when appropriate
│
├─ "warn" (default recommended)
│   ├─ Warnings shown but not blocking
│   ├─ Best practice: Fix anyway
│   │
│   └─ Generate code with complete deps
│       └─ Avoid future technical debt
│
└─ "off"
    ├─ No automatic checking
    ├─ Manual responsibility
    └─ Still follow best practices (avoid bugs)

Dependency array completeness:
├─ Include all reactive values
│   ├─ Props
│   ├─ State variables
│   ├─ Context values
│   ├─ Variables derived from above
│   └─ Functions that use reactive values
│
├─ Stable values (no need to include)
│   ├─ setState functions (from useState)
│   ├─ dispatch (from useReducer/Redux)
│   ├─ Refs (from useRef)
│   └─ Static imports
│
└─ Strategies for complex dependencies
    ├─ useCallback for function deps
    ├─ useMemo for object/array deps
    ├─ useRef for mutable values (when appropriate)
    └─ Extract non-reactive logic outside component
```

**Verification**:
```bash
# Check hooks rules in ESLint config
cat .eslintrc.json | grep -A 2 "react-hooks"

# Test hooks rules with example file
npx eslint src/components/Example.tsx --rule 'react-hooks/rules-of-hooks: error' --rule 'react-hooks/exhaustive-deps: error'
```

**Example Output**:
```
React Hooks Rules:
  - react-hooks/rules-of-hooks: "error"
  - react-hooks/exhaustive-deps: "error" (custom override, stricter)

Decision: Strict hooks compliance required
Actions:
  - All hooks at top level, no conditional calls
  - Complete dependency arrays (error level)
  - Use useCallback/useMemo for complex dependencies
  - Cannot ignore exhaustive-deps warnings

Example compliant code:
  useEffect(() => {
    // All dependencies included
    fetchData(userId, filter)
  }, [userId, filter])  // Complete deps array
```

---

### Protocol 3: React-Specific Rules Check

**Objective**: Identify other React linting rules beyond hooks

**Tool**: Read → ESLint config (from Protocol 1)

**Extract**:
Key React rules:
- `react/jsx-key` - Keys in lists
- `react/react-in-jsx-scope` - React import requirement
- `react/prop-types` - PropTypes validation
- `react/jsx-no-target-blank` - Security for external links
- `react/self-closing-comp` - Self-closing tags
- `react/jsx-boolean-value` - Boolean prop syntax

**Decision Tree**:
```
react/jsx-key?
├─ "error" or "warn" (recommended: error)
│   ├─ Keys required for array elements
│   ├─ Keys required in React.Children.toArray
│   │
│   └─ Generate:
│       {items.map(item => (
│         <Item key={item.id} {...item} />
│       ))}
│
└─ "off"
    └─ Still use keys (React best practice)

react/react-in-jsx-scope?
├─ "error" (default)
│   ├─ React must be imported for JSX
│   ├─ Old JSX transform
│   │
│   └─ Generate:
│       import React from 'react'
│
├─ "off" (common with new JSX transform)
│   ├─ React 17+ with new transform
│   ├─ React import not needed for JSX
│   │
│   └─ Generate:
│       // No React import needed
│       import { useState } from 'react'  // Only if hooks used
│
└─ Check: tsconfig.json "jsx" setting for confirmation

react/prop-types?
├─ "error" or "warn"
│   ├─ PropTypes validation required (JavaScript projects)
│   ├─ TypeScript projects: usually "off"
│   │
│   └─ Generate (if required):
│       Component.propTypes = {
│         name: PropTypes.string.isRequired,
│         age: PropTypes.number
│       }
│
└─ "off"
    └─ Skip PropTypes (TypeScript handles validation)

react/jsx-no-target-blank?
├─ "error" or "warn" (security rule)
│   ├─ Require rel="noopener noreferrer" for target="_blank"
│   │
│   └─ Generate:
│       <a href={url} target="_blank" rel="noopener noreferrer">
│         Link
│       </a>
│
└─ "off"
    └─ Still follow security best practice

react/self-closing-comp?
├─ "error" or "warn"
│   ├─ Self-close components without children
│   │
│   └─ Generate:
│       <Component />  ✓
│       <Component></Component>  ✗
│
└─ "off"
    └─ Either style acceptable

react/jsx-boolean-value?
├─ "error" or "warn"
│   ├─ Usually configured as "always" or "never"
│   │
│   └─ Generate:
│       "never": <Component active />
│       "always": <Component active={true} />
│
└─ "off"
    └─ Either style acceptable
```

**Verification**:
```bash
# Check React rules in ESLint config
cat .eslintrc.json | grep -A 1 '"react/'

# List all enabled React rules
npx eslint --print-config src/components/Example.tsx | grep '"react/'
```

**Example Output**:
```
React Rules:
  - react/jsx-key: "error"
  - react/react-in-jsx-scope: "off" (new JSX transform)
  - react/prop-types: "off" (TypeScript project)
  - react/jsx-no-target-blank: "warn"
  - react/self-closing-comp: "error"

Decision:
  - Keys required in all lists
  - No React import needed
  - No PropTypes needed (TypeScript)
  - rel="noopener noreferrer" for target="_blank"
  - Self-closing tags enforced
```

---

### Protocol 4: Prettier Configuration Detection

**Objective**: Find Prettier config to match formatting style

**Tool**: Glob → Search for Prettier config files, then Read → Parse settings

**Search Patterns**:
1. `.prettierrc`
2. `.prettierrc.json`
3. `.prettierrc.js`
4. `.prettierrc.yaml` / `.prettierrc.yml`
5. `prettier.config.js`
6. `package.json` → `prettier` field

**Extract**:
- Print width (line length)
- Tab width (spaces per indent)
- Tabs vs spaces
- Semicolons (true/false)
- Single quotes vs double quotes
- Trailing commas
- Bracket spacing
- JSX quotes
- Arrow function parentheses

**Decision Tree**:
```
Prettier config found?
├─ YES
│   ├─ Print width (printWidth)
│   │   ├─ Default: 80
│   │   ├─ Common: 80, 100, 120
│   │   └─ Match: Line length for generated code
│   │
│   ├─ Indentation (tabWidth, useTabs)
│   │   ├─ Default: 2 spaces
│   │   ├─ Common: 2 spaces, 4 spaces, tabs
│   │   └─ Match: Indentation in generated code
│   │
│   ├─ Semicolons (semi)
│   │   ├─ true: Always semicolons
│   │   ├─ false: No semicolons (ASI)
│   │   └─ Match: Semicolon presence
│   │
│   ├─ Quotes (singleQuote, jsxSingleQuote)
│   │   ├─ singleQuote: true → 'string' in JS/TS
│   │   ├─ singleQuote: false → "string" in JS/TS (default)
│   │   ├─ jsxSingleQuote: true → <div attr='value' />
│   │   ├─ jsxSingleQuote: false → <div attr="value" /> (default)
│   │   └─ Match: Quote style for strings and JSX
│   │
│   ├─ Trailing commas (trailingComma)
│   │   ├─ "es5": Trailing commas where valid in ES5 (objects, arrays)
│   │   ├─ "all": Trailing commas wherever possible (including function params)
│   │   ├─ "none": No trailing commas
│   │   └─ Match: Comma placement
│   │
│   ├─ Bracket spacing (bracketSpacing)
│   │   ├─ true: { foo: bar } (default)
│   │   ├─ false: {foo: bar}
│   │   └─ Match: Object literal formatting
│   │
│   └─ Arrow function parentheses (arrowParens)
│       ├─ "always": (x) => x (default)
│       ├─ "avoid": x => x
│       └─ Match: Arrow function formatting
│
└─ NO
    ├─ Use Prettier defaults
    ├─ Or match existing code style (grep for patterns)
    └─ Suggest: Prettier setup for consistency

Common Prettier configurations:
├─ Default Prettier
│   ├─ 80 chars, 2 spaces, double quotes
│   ├─ Semicolons, trailing commas (ES5)
│   └─ Bracket spacing, "always" arrow parens
│
├─ Modern/wider
│   ├─ 100-120 chars, 2 spaces, single quotes
│   ├─ Semicolons, trailing commas (all)
│   └─ Common in larger projects
│
└─ Minimal
    ├─ 80 chars, 2 spaces, single quotes
    ├─ No semicolons, trailing commas (ES5)
    └─ Cleaner, less punctuation
```

**Verification**:
```bash
# Search for Prettier config
ls -la .prettierrc* prettier.config.* 2>/dev/null

# Check package.json for prettier config
cat package.json | grep -A 10 '"prettier"'

# Check existing code for style patterns
head -20 src/components/*.tsx | grep -E '(;$|".*")'
```

**Example Output**:
```
Prettier config: .prettierrc.json

Settings:
  - printWidth: 100
  - tabWidth: 2
  - useTabs: false
  - semi: true
  - singleQuote: true
  - jsxSingleQuote: false
  - trailingComma: "all"
  - bracketSpacing: true
  - arrowParens: "avoid"

Decision: Format generated code to match
  - 100 character lines
  - 2 space indentation
  - Single quotes in JS/TS: 'string'
  - Double quotes in JSX: <div attr="value" />
  - Always semicolons
  - Trailing commas everywhere
  - x => x (avoid parens when possible)
```

---

### Protocol 5: TypeScript ESLint Rules Check

**Objective**: Verify TypeScript-specific linting rules (if TypeScript project)

**Tool**: Read → ESLint config (from Protocol 1)

**Extract**:
TypeScript-specific rules:
- `@typescript-eslint/no-explicit-any` - Disallow any type
- `@typescript-eslint/explicit-function-return-type` - Require return types
- `@typescript-eslint/no-unused-vars` - Unused variables
- `@typescript-eslint/consistent-type-imports` - Type-only imports

**Decision Tree**:
```
TypeScript ESLint rules?
├─ @typescript-eslint/no-explicit-any
│   ├─ "error"
│   │   ├─ Cannot use any type
│   │   ├─ Must type everything explicitly
│   │   └─ Generate: Proper types for all parameters
│   │
│   ├─ "warn"
│   │   └─ Avoid any, but not blocking
│   │
│   └─ "off"
│       └─ any allowed (but still avoid)
│
├─ @typescript-eslint/explicit-function-return-type
│   ├─ "error" or "warn"
│   │   ├─ All functions must have return type
│   │   ├─ Generate:
│   │   │   function foo(): string { return 'bar' }
│   │   │   const bar = (): number => 42
│   │   └─ Apply to all functions and methods
│   │
│   └─ "off"
│       └─ Return type inference allowed
│
├─ @typescript-eslint/no-unused-vars
│   ├─ "error" or "warn"
│   │   ├─ Remove unused imports
│   │   ├─ Remove unused variables
│   │   └─ Use underscore prefix for intentionally unused (_var)
│   │
│   └─ "off"
│       └─ Unused vars allowed (unusual)
│
└─ @typescript-eslint/consistent-type-imports
    ├─ "error" with "prefer": "type-imports"
    │   ├─ Separate type imports
    │   ├─ Generate:
    │   │   import { useState } from 'react'
    │   │   import type { FC } from 'react'
    │   └─ Better for build optimization
    │
    └─ "off"
        └─ Regular imports for types acceptable
```

**Verification**:
```bash
# Check TypeScript ESLint rules
cat .eslintrc.json | grep -A 1 '"@typescript-eslint/'

# Test TypeScript rules
npx eslint src/components/Example.tsx
```

**Example Output**:
```
TypeScript ESLint Rules:
  - @typescript-eslint/no-explicit-any: "error"
  - @typescript-eslint/explicit-function-return-type: "off"
  - @typescript-eslint/no-unused-vars: "error"
  - @typescript-eslint/consistent-type-imports: "error" (prefer type-imports)

Decision:
  - No any type allowed (must type everything)
  - Return types optional (inference OK)
  - No unused variables allowed
  - Use "import type" for type-only imports

Example:
  import { useState } from 'react'
  import type { User } from './types'

  // No any, no unused vars, type imports separated
```

---

## Investigation Checklist

After completing linting rules investigation, verify:

- [ ] ESLint configuration found and parsed
- [ ] Base configurations identified (extends)
- [ ] React hooks rules confirmed (rules-of-hooks, exhaustive-deps)
- [ ] React-specific rules noted (jsx-key, react-in-jsx-scope, etc.)
- [ ] TypeScript ESLint rules checked (if TypeScript project)
- [ ] Prettier configuration found (or defaults noted)
- [ ] Formatting preferences documented (quotes, semicolons, indentation)
- [ ] Critical error-level rules highlighted for compliance

## Linting Quick Reference

### Must-Follow Rules (Common Errors)
```
1. react-hooks/rules-of-hooks
   - Hooks at top level only
   - No conditional hook calls

2. react-hooks/exhaustive-deps
   - Complete dependency arrays
   - Use useCallback/useMemo for deps

3. react/jsx-key
   - Keys in all list items
   - Unique, stable keys

4. @typescript-eslint/no-explicit-any
   - No any type (if error level)
   - Proper typing required
```

### Common Formatting Settings
```
Prettier Defaults:
  - 80 char lines
  - 2 space indent
  - Double quotes
  - Semicolons: yes
  - Trailing commas: ES5

Check project config for deviations
```

## Integration with Other Protocols

**After linting rules investigation**:
1. Apply discovered rules to all generated code
2. Format code according to Prettier config
3. Ensure React hooks compliance
4. Verify TypeScript typing strictness

**Linting rules inform**:
- Code formatting (quotes, semicolons, spacing)
- React patterns compliance (hooks, keys, imports)
- TypeScript strictness (any, return types, imports)
- Security practices (target="_blank" handling)

This investigation ensures generated code passes linting validation on first attempt, avoiding manual fixes and code review delays.
