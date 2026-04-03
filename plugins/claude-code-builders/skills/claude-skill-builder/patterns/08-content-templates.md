# Pattern Category 8: Content Templates

### Pattern 16: Investigation Report Template

**Before:**
```markdown
Write a report about what you found.
```

**After:**
```markdown
**Output Format (Required Structure):**

```markdown
# Investigation Report: [Component Name]

## Executive Summary
- Component purpose: [1-2 sentences]
- Current state: [existing, needs refactor, new creation]
- Key findings: [3-5 bullet points]

## Component Analysis

### Structure
- Location: [file path]
- Type: [class/functional/hooks]
- Lines of code: [count]
- Dependencies: [list imports]

### Props Interface
```typescript
[Current props interface or "None defined"]
```

### State Management
- State variables: [list with types]
- State management pattern: [useState/useReducer/context/external]
- Complexity: [simple/moderate/complex]

### Side Effects
- useEffect hooks: [count and purposes]
- Event handlers: [list]
- External interactions: [API calls, localStorage, etc.]

## Testing Analysis

### Current Coverage
- Test file: [exists/missing]
- Test coverage: [percentage if available]
- Test quality: [comprehensive/basic/missing]

### Test Gaps
- [Gap 1]
- [Gap 2]
- [Gap 3]

## Recommendations

### Priority 1 (Critical)
- [Recommendation with rationale]

### Priority 2 (Important)
- [Recommendation with rationale]

### Priority 3 (Nice to have)
- [Recommendation with rationale]

## Implementation Plan
1. [Step 1 with acceptance criteria]
2. [Step 2 with acceptance criteria]
3. [Step 3 with acceptance criteria]
```
```

**Why Better:**
- Exact structure specified
- All required sections listed
- Template is copy-able
- Placeholders guide content
- Hierarchical organization

---

### Pattern 17: API Documentation Template

**Before:**
```markdown
Document the API.
```

**After:**
```markdown
**API Documentation Template:**

```markdown
# [Component/Function Name] API

## Overview
[1-2 sentence description of purpose]

## Import
```typescript
import { [Name] } from '[path]';
```

## Signature
```typescript
[Full TypeScript signature]
```

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| [param1] | [type] | Yes/No | [value or "n/a"] | [description] |
| [param2] | [type] | Yes/No | [value or "n/a"] | [description] |

## Returns

**Type:** [return type]

**Description:** [what is returned]

## Examples

### Basic Usage
```typescript
[Simple example]
```

### Advanced Usage
```typescript
[Complex example showing multiple features]
```

### Error Handling
```typescript
[Example showing error cases]
```

## Edge Cases

- **[Edge case 1]:** [behavior]
- **[Edge case 2]:** [behavior]

## Notes

- [Important note 1]
- [Important note 2]

## See Also

- [Related API 1]
- [Related API 2]
```
```

**Why Better:**
- Complete documentation structure
- Table for parameters (structured)
- Multiple example types
- Edge cases explicitly called out
- Consistent format

---
