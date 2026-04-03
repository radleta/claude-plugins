# Pattern 12: Show Not Tell for Project-Scoped Skills

## Overview

For project-scoped skills (`.claude/skills/`), reference actual project files instead of duplicating code inline. The codebase IS the source of truth.

## When to Apply

- **Always** for project-scoped skills that document code patterns
- **When** the skill explains how to use existing implementations
- **When** examples would duplicate code that already exists in the codebase

## When NOT to Apply

- User-scoped skills (`~/.claude/skills/`) - must be self-contained
- Skills documenting patterns that don't exist in the codebase yet
- Generic guidance not tied to specific implementations

## Pattern Structure

### File Reference Table

```markdown
## Key Files - Read When Needed

| Purpose | File | Read When |
|---------|------|-----------|
| [What it demonstrates] | `path/to/file` | [When agent should read it] |
| [Another purpose] | `another/path` | [Another trigger condition] |
```

### Key Elements

1. **Purpose column**: What the file demonstrates or contains
2. **File column**: Relative path from project root
3. **Read When column**: Explicit trigger for when to load the file

---

## Transformation Examples

### Example 1: Generator Skill (Real Case)

**Before (891 lines total - inline code):**

```markdown
# AKN Generator Developer Skill

## Creating a Generator

### Base Class Pattern

Here's how the SimpleGenerator base class works:

```csharp
public abstract class SimpleGenerator<TInput, TState> : IGenerator
    where TInput : SimpleGeneratorInput
    where TState : SimpleGeneratorState
{
    public Document CreateWorksheet(TInput input)
    {
        ValidateInput(input);
        var state = CreateState(input);
        // ... 40 more lines of code
    }

    protected abstract void ValidateInput(TInput input);
    protected abstract TState CreateState(TInput input);
    // ... more methods
}
```

### Reference Implementation

Here's a complete generator example:

```csharp
public class CrosswordSimpleGenerator : SimpleGenerator<CrosswordInput, CrosswordState>
{
    protected override void ValidateInput(CrosswordInput input)
    {
        // ... 30 lines of validation code
    }

    protected override CrosswordState CreateState(CrosswordInput input)
    {
        // ... 50 lines of state initialization
    }

    // ... 200 more lines of implementation
}
```

### Input Class Pattern

```csharp
public class CrosswordSimpleGeneratorInput : SimpleGeneratorInput
{
    public const int MinGridSize = 5;
    public const int MaxGridSize = 30;

    // ... 100 more lines
}
```

[EXAMPLES.md with 400+ more lines of code examples]
```

**After (182 lines total - file references):**

```markdown
# AKN Generator Developer Skill

## Key Files - Read When Needed

| Purpose | File | Read When |
|---------|------|-----------|
| Base generator | `Akn/Generators/SimpleGenerator.cs` | Understanding page templates, header/footer |
| Base input | `Akn/Generators/SimpleGeneratorInput.cs` | Designing input properties |
| Base state | `Akn/Generators/SimpleGeneratorState.cs` | Designing state management |
| **Reference impl** | `Akn/Generators/CrosswordSimpleGenerator.cs` | Complete generator example |
| Reference input | `Akn/Generators/CrosswordSimpleGeneratorInput.cs` | Input validation patterns |
| Reference state | `Akn/Generators/CrosswordSimpleGeneratorState.cs` | State design patterns |
| **Adding types** | `Akn/Generators/CreatingGeneratorTypeDoc.md` | Full checklist for new types |

## Creating a New Generator

Follow the crossword generator as reference:

1. **Input class** (`CrosswordSimpleGeneratorInput.cs`)
   - Validation constants (Min/Max values)
   - Generator-specific properties with defaults

2. **State class** (`CrosswordSimpleGeneratorState.cs`)
   - Computed values derived from input
   - Cached calculations

3. **Generator class** (`CrosswordSimpleGenerator.cs`)
   - `CreateWorksheet()` orchestrates document creation
   - `ValidateInput()` for input validation
   - `CreateState()` for state initialization
```

**Result:** 79% reduction (891 → 182 lines), always current, zero maintenance

---

### Example 2: API Patterns Skill

**Before (inline examples):**

```markdown
# Our API Patterns Skill

## Authentication Pattern

Here's how we implement authentication:

```typescript
// src/middleware/auth.ts
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
```

## Error Handling Pattern

```typescript
// src/utils/errorHandler.ts
export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number = 500,
        public code?: string
    ) {
        super(message);
    }
}

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    // ... 50 lines of error handling
};
```

[300+ more lines of inline code examples]
```

**After (file references):**

```markdown
# Our API Patterns Skill

## Key Patterns - Read When Needed

| Pattern | File | Read When |
|---------|------|-----------|
| Authentication | `src/middleware/auth.ts` | Implementing protected routes |
| Error handling | `src/utils/errorHandler.ts` | Adding error handling to new endpoints |
| Validation | `src/middleware/validate.ts` | Input validation patterns |
| Response format | `src/utils/response.ts` | Consistent API responses |
| Database access | `src/services/db.ts` | Data layer patterns |

## Using These Patterns

### Authentication
See `src/middleware/auth.ts` for our JWT-based auth middleware.
Apply to routes: `router.get('/protected', authMiddleware, handler)`

### Error Handling
See `src/utils/errorHandler.ts` for our AppError class and handler.
Throw errors: `throw new AppError('Not found', 404, 'RESOURCE_NOT_FOUND')`

### Response Format
See `src/utils/response.ts` for consistent response helpers.
Usage: `return success(res, data)` or `return error(res, 'message', 400)`
```

**Result:** ~70% reduction, patterns stay in sync with actual code

---

### Example 3: Component Library Skill

**Before (inline component examples):**

```markdown
# Our Component Library

## Button Component

```tsx
// Full 80-line Button component with all variants
export const Button = ({ variant, size, children, ...props }: ButtonProps) => {
    // ... implementation
};
```

## Modal Component

```tsx
// Full 120-line Modal component
export const Modal = ({ isOpen, onClose, children }: ModalProps) => {
    // ... implementation
};
```

[500+ lines of component code]
```

**After (file references with usage guidance):**

```markdown
# Our Component Library

## Component Reference

| Component | File | Read When |
|-----------|------|-----------|
| Button | `src/components/Button/Button.tsx` | Adding buttons with variants |
| Modal | `src/components/Modal/Modal.tsx` | Implementing modal dialogs |
| Form | `src/components/Form/Form.tsx` | Building forms with validation |
| Table | `src/components/Table/Table.tsx` | Data display patterns |

## Props Reference

| Component | Props File | Read When |
|-----------|------------|-----------|
| Button | `src/components/Button/Button.types.ts` | Understanding button options |
| Modal | `src/components/Modal/Modal.types.ts` | Modal configuration |

## Usage Patterns

For each component:
1. Read the component file to understand implementation
2. Read the types file to understand props
3. Check `src/components/[Name]/[Name].stories.tsx` for usage examples
```

**Result:** ~85% reduction, Storybook examples always current

---

## Anti-Patterns

### Anti-Pattern 1: Duplicating code that exists in codebase

```markdown
# DON'T: Copy code into skill
Here's our authentication:
```typescript
[100 lines copied from src/middleware/auth.ts]
```

# DO: Reference the file
See `src/middleware/auth.ts` for authentication middleware.
Read when implementing protected routes.
```

### Anti-Pattern 2: Missing "Read When" guidance

```markdown
# DON'T: Just list files without context
- src/utils/auth.ts
- src/utils/db.ts
- src/middleware/validate.ts

# DO: Explain when to read each file
| File | Read When |
|------|-----------|
| `src/utils/auth.ts` | Implementing authentication flows |
| `src/utils/db.ts` | Database query patterns |
| `src/middleware/validate.ts` | Adding input validation |
```

### Anti-Pattern 3: Using show-not-tell for user-scoped skills

```markdown
# DON'T: Reference project files in ~/.claude/skills/
See `src/components/Button.tsx` for button patterns.
# This breaks when skill is used in different project!

# DO: Include inline examples for user-scoped skills
```tsx
export const Button = ({ children }) => <button>{children}</button>;
```
```

---

## Benefits Summary

| Metric | Inline Code | Show Not Tell |
|--------|-------------|---------------|
| **Maintenance** | Must update when code changes | Zero - files are source of truth |
| **Freshness** | Can become stale | Always current |
| **Token usage** | High (duplicated content) | Low (just paths + guidance) |
| **Accuracy** | May diverge from reality | IS reality |
| **Skill size** | Often 500-1000+ lines | Often 100-200 lines |

## Quick Reference

**Apply when:**
- Project-scoped skill (`.claude/skills/`)
- Documenting existing code patterns
- Examples would duplicate codebase files

**Don't apply when:**
- User-scoped skill (`~/.claude/skills/`)
- Teaching concepts not in codebase
- Patterns don't exist in project yet

**Table structure:**
```markdown
| Purpose | File | Read When |
|---------|------|-----------|
| [What] | `path` | [Trigger] |
```
