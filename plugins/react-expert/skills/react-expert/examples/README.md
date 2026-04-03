# React Expert Examples

Complete workflow examples demonstrating the 4-step process: Investigate → Detect → Generate → Verify

## Available Examples

### counter-component.md
**Scenario**: "Create a counter component with increment/decrement"
**Demonstrates**:
- Investigation (Read package.json, tsconfig, Grep patterns)
- Pattern detection (simple state → useState)
- Template usage (@templates/component-with-state.tsx)
- Verification against checklist
- Prevention of Top 10 Mistakes #4, #6, #7

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

**State Management**:
- Counter component (available now)
- Form with complex state (useReducer)
- Global state with Context

**Effects & Lifecycle**:
- Data fetching with useEffect
- Subscription with cleanup
- Conditional effect logic

**Performance**:
- Optimizing expensive component
- Memoizing derived values
- Preventing unnecessary re-renders

**TypeScript**:
- Generic component with constraints
- Event handlers (all types)
- Children prop patterns

**Advanced Patterns**:
- Custom hook extraction
- Error boundary implementation
- Ref forwarding pattern

---

**Examples complement, don't replace, the core guidance in @rules/, @templates/, and @decision-trees/**
